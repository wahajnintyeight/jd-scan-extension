package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const openAIResponsesURL = "https://api.openai.com/v1/responses"

type chatGPTModel struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func (h *host) models(ctx context.Context) ([]chatGPTModel, error) {
	token, err := h.accessToken(ctx)
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, openAIResource+"/models", nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Authorization", "Bearer "+token)
	response, err := h.client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("Could not load models from OpenAI: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, responseError("Could not load ChatGPT models", response)
	}
	var catalog struct {
		Models []struct {
			Slug        string `json:"slug"`
			DisplayName string `json:"display_name"`
			Visibility  string `json:"visibility"`
		} `json:"models"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(nil, response.Body, 4<<20)).Decode(&catalog); err != nil {
		return nil, fmt.Errorf("OpenAI returned an unreadable model list: %w", err)
	}
	models := make([]chatGPTModel, 0, len(catalog.Models))
	for _, model := range catalog.Models {
		if model.Visibility != "list" || model.Slug == "" {
			continue
		}
		models = append(models, chatGPTModel{ID: model.Slug, Name: firstNonEmpty(model.DisplayName, model.Slug)})
		if len(models) == 300 {
			break
		}
	}
	if len(models) == 0 {
		return nil, errors.New("No ChatGPT plan models are available for this account.")
	}
	return models, nil
}

func (h *host) complete(ctx context.Context, model string, messages []chatMessage) (map[string]string, error) {
	if strings.TrimSpace(model) == "" || len(model) > maxModelNameLength || strings.ContainsAny(model, "\r\n") {
		return nil, errors.New("Choose a valid model in JD Scan settings.")
	}
	if len(messages) == 0 || len(messages) > maxMessages {
		return nil, errors.New("The AI request has an invalid number of messages.")
	}
	instructions := make([]string, 0, 2)
	input := make([]chatMessage, 0, len(messages))
	totalChars := 0
	for _, message := range messages {
		totalChars += len(message.Content)
		if len(message.Content) > maxMessageChars || totalChars > maxMessageChars {
			return nil, errors.New("The AI request is too large. Shorten the resume or job description and try again.")
		}
		switch message.Role {
		case "system":
			if content := strings.TrimSpace(message.Content); content != "" {
				instructions = append(instructions, content)
			}
		case "user", "assistant":
			if strings.TrimSpace(message.Content) == "" {
				continue
			}
			input = append(input, message)
		default:
			return nil, errors.New("The AI request contains an unsupported message role.")
		}
	}
	if len(input) == 0 {
		return nil, errors.New("The AI request did not include any user content.")
	}

	token, err := h.accessToken(ctx)
	if err != nil {
		return nil, err
	}
	body := map[string]any{"model": model, "input": input, "store": false, "stream": true}
	if len(instructions) > 0 {
		body["instructions"] = strings.Join(instructions, "\n\n")
	}
	encoded, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, openAIResponsesURL, bytes.NewReader(encoded))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "text/event-stream")
	response, err := h.client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("Could not reach OpenAI Responses API: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, responseError("ChatGPT plan request failed", response)
	}

	text, err := readResponseStream(response.Body)
	if err != nil {
		return nil, err
	}
	return map[string]string{"text": text}, nil
}

func readResponseStream(body io.Reader) (string, error) {
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 64<<10), 4<<20)
	var output strings.Builder
	completed := false
stream:
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if payload == "" || payload == "[DONE]" {
			continue
		}
		var event struct {
			Type     string `json:"type"`
			Delta    string `json:"delta"`
			Response struct {
				Error struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error"`
			} `json:"response"`
		}
		if err := json.Unmarshal([]byte(payload), &event); err != nil {
			return "", errors.New("OpenAI sent an unreadable Responses stream.")
		}
		switch event.Type {
		case "response.output_text.delta":
			if output.Len()+len(event.Delta) > 120<<10 {
				return "", errors.New("ChatGPT returned more text than JD Scan can process.")
			}
			output.WriteString(event.Delta)
		case "response.failed":
			return "", fmt.Errorf("ChatGPT request failed: %s", firstNonEmpty(event.Response.Error.Message, event.Response.Error.Code, "OpenAI reported a response failure."))
		case "response.incomplete":
			return "", errors.New("ChatGPT stopped before completing its response. Try again or use a shorter prompt.")
		case "response.completed":
			completed = true
			break stream
		}
	}
	if err := scanner.Err(); err != nil {
		return "", fmt.Errorf("ChatGPT response stream ended early: %w", err)
	}
	if !completed {
		return "", errors.New("ChatGPT response stream ended before response.completed.")
	}
	if strings.TrimSpace(output.String()) == "" {
		return "", errors.New("ChatGPT returned an empty response.")
	}
	return output.String(), nil
}

func responseError(prefix string, response *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(response.Body, 64<<10))
	message := ""
	var payload struct {
		Error struct {
			Message string `json:"message"`
			Code    string `json:"code"`
		} `json:"error"`
		Detail string `json:"detail"`
	}
	if json.Unmarshal(body, &payload) == nil {
		message = firstNonEmpty(payload.Error.Message, payload.Error.Code, payload.Detail)
	}
	if message == "" {
		message = strings.TrimSpace(string(body))
	}
	if message == "" {
		message = response.Status
	}
	if response.StatusCode == http.StatusUnauthorized {
		message += ". Reconnect ChatGPT in JD Scan settings if the authorization has expired."
	}
	requestID := response.Header.Get("x-request-id")
	if requestID != "" {
		message += " (request " + requestID + ")"
	}
	return fmt.Errorf("%s: %s", prefix, message)
}

func (h *host) revoke(ctx context.Context, stored credentials) (bool, error) {
	discoveryRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, openAIIssuer+"/.well-known/openid-configuration", nil)
	if err != nil {
		return false, err
	}
	discoveryResponse, err := h.client.Do(discoveryRequest)
	if err != nil {
		return false, err
	}
	defer discoveryResponse.Body.Close()
	if discoveryResponse.StatusCode < 200 || discoveryResponse.StatusCode >= 300 {
		return false, fmt.Errorf("OpenID discovery returned %s", discoveryResponse.Status)
	}
	var metadata struct {
		RevocationEndpoint string `json:"revocation_endpoint"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(nil, discoveryResponse.Body, 1<<20)).Decode(&metadata); err != nil {
		return false, err
	}
	endpoint, err := url.Parse(metadata.RevocationEndpoint)
	if err != nil || endpoint.Scheme != "https" || endpoint.Host != "auth.openai.com" {
		return false, errors.New("OpenAI did not provide a trusted token revocation endpoint.")
	}
	form := url.Values{
		"token":           {stored.Refresh},
		"token_type_hint": {"refresh_token"},
		"client_id":       {stored.ClientID},
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.String(), strings.NewReader(form.Encode()))
	if err != nil {
		return false, err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := h.client.Do(request)
	if err != nil {
		return false, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return false, fmt.Errorf("OpenAI revocation returned %s", response.Status)
	}
	return true, nil
}
