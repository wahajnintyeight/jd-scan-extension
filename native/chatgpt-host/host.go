package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gofrs/flock"
	"github.com/zalando/go-keyring"
)

const (
	keyringService      = "com.jdscan.chatgpt"
	registrationKey     = "registration"
	credentialsKey      = "credentials"
	hostIDKey           = "host-id"
	refreshLockName     = "chatgpt-refresh.lock"
	openAIResource      = "https://api.openai.com/v1"
	requiredPlanScope   = "chatgpt.tokens.use.direct"
	maxMessages         = 40
	maxMessageChars     = 120_000
	maxModelNameLength  = 200
	credentialChunkSize = 1800
	maxCredentialChunks = 256
)

type nativeRequest struct {
	ID       string        `json:"id"`
	Action   string        `json:"action"`
	Model    string        `json:"model"`
	Messages []chatMessage `json:"messages"`
}

type nativeResponse struct {
	ID      string `json:"id"`
	Success bool   `json:"success"`
	Data    any    `json:"data,omitempty"`
	Error   string `json:"error,omitempty"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type registration struct {
	ClientID string `json:"client_id"`
	Email    string `json:"email,omitempty"`
	Subject  string `json:"subject"`
	HostID   string `json:"ext_agent_host_id"`
}

type credentials struct {
	ClientID    string    `json:"client_id"`
	Email       string    `json:"email,omitempty"`
	Subject     string    `json:"subject"`
	HostID      string    `json:"ext_agent_host_id"`
	IDToken     string    `json:"id_token"`
	AccessToken string    `json:"access_token"`
	Refresh     string    `json:"refresh_token"`
	Scopes      []string  `json:"scopes"`
	ExpiresAt   time.Time `json:"expires_at"`
}

type hostStatus struct {
	Connected  bool   `json:"connected"`
	Registered bool   `json:"registered"`
	Email      string `json:"email,omitempty"`
}

type credentialPointer struct {
	Generation string `json:"generation"`
	Chunks     int    `json:"chunks"`
}

type host struct {
	client *http.Client
}

func newHost() *host {
	return &host{client: &http.Client{
		Timeout:       2 * time.Minute,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}}
}

func (h *host) handle(ctx context.Context, request nativeRequest) nativeResponse {
	response := nativeResponse{ID: request.ID}
	if request.ID == "" || len(request.ID) > 128 {
		response.Error = "Invalid request ID."
		return response
	}

	var data any
	var err error
	switch request.Action {
	case "status":
		data, err = h.status()
	case "connect":
		_, err = h.connect(ctx)
		if err == nil {
			data, err = h.status()
		}
	case "disconnect":
		data, err = h.disconnect(ctx)
	case "switch-account":
		data, err = h.switchAccount(ctx)
	case "models":
		data, err = h.models(ctx)
	case "complete":
		data, err = h.complete(ctx, request.Model, request.Messages)
	default:
		err = errors.New("Unsupported local ChatGPT operation.")
	}
	if err != nil {
		response.Error = err.Error()
		return response
	}
	response.Success = true
	response.Data = data
	return response
}

func loadKeyring[T any](account string, value *T) (bool, error) {
	encoded, err := keyring.Get(keyringService, account)
	if errors.Is(err, keyring.ErrNotFound) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("Could not access Windows Credential Manager or the system keychain: %w", err)
	}
	if err := json.Unmarshal([]byte(encoded), value); err != nil {
		return false, errors.New("The local ChatGPT credential record is unreadable. Disconnect it and sign in again.")
	}
	return true, nil
}

func saveKeyring(account string, value any) error {
	encoded, err := json.Marshal(value)
	if err != nil {
		return err
	}
	if err := keyring.Set(keyringService, account, string(encoded)); err != nil {
		return fmt.Errorf("Could not save credentials to the operating-system keychain: %w", err)
	}
	return nil
}

func loadCredentials() (credentials, bool, error) {
	pointerJSON, err := keyring.Get(keyringService, credentialsKey)
	if errors.Is(err, keyring.ErrNotFound) {
		return credentials{}, false, nil
	}
	if err != nil {
		return credentials{}, false, fmt.Errorf("Could not access the operating-system keychain: %w", err)
	}
	var pointer credentialPointer
	if err := json.Unmarshal([]byte(pointerJSON), &pointer); err != nil || pointer.Generation == "" || pointer.Chunks < 1 || pointer.Chunks > maxCredentialChunks {
		return credentials{}, false, errors.New("The local ChatGPT credential index is unreadable. Disconnect it and sign in again.")
	}
	encoded := make([]byte, 0, pointer.Chunks*credentialChunkSize)
	for index := 0; index < pointer.Chunks; index++ {
		chunk, err := keyring.Get(keyringService, credentialChunkAccount(pointer.Generation, index))
		if err != nil {
			return credentials{}, false, errors.New("The protected ChatGPT credential set is incomplete. Disconnect it and sign in again.")
		}
		encoded = append(encoded, chunk...)
	}
	var value credentials
	if err := json.Unmarshal(encoded, &value); err != nil {
		return credentials{}, false, errors.New("The protected ChatGPT credential set is unreadable. Disconnect it and sign in again.")
	}
	return value, true, nil
}

func saveCredentials(value credentials) error {
	encoded, err := json.Marshal(value)
	if err != nil {
		return err
	}
	chunks := splitCredential(encoded)
	if len(chunks) == 0 || len(chunks) > maxCredentialChunks {
		return errors.New("The ChatGPT credential set is too large for secure local storage.")
	}
	generation, err := randomValue(18)
	if err != nil {
		return err
	}
	written := 0
	for index, chunk := range chunks {
		if err := keyring.Set(keyringService, credentialChunkAccount(generation, index), chunk); err != nil {
			cleanupCredentialChunks(credentialPointer{Generation: generation, Chunks: written})
			return fmt.Errorf("Could not save credentials to the operating-system keychain: %w", err)
		}
		written++
	}
	oldPointerJSON, _ := keyring.Get(keyringService, credentialsKey)
	pointerJSON, err := json.Marshal(credentialPointer{Generation: generation, Chunks: len(chunks)})
	if err != nil {
		cleanupCredentialChunks(credentialPointer{Generation: generation, Chunks: len(chunks)})
		return err
	}
	if err := keyring.Set(keyringService, credentialsKey, string(pointerJSON)); err != nil {
		cleanupCredentialChunks(credentialPointer{Generation: generation, Chunks: len(chunks)})
		return fmt.Errorf("Could not update the protected credential index: %w", err)
	}
	var oldPointer credentialPointer
	if json.Unmarshal([]byte(oldPointerJSON), &oldPointer) == nil && oldPointer.Generation != generation {
		cleanupCredentialChunks(oldPointer)
	}
	return nil
}

func deleteCredentials() error {
	pointerJSON, err := keyring.Get(keyringService, credentialsKey)
	if errors.Is(err, keyring.ErrNotFound) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("Could not access the operating-system keychain: %w", err)
	}
	var pointer credentialPointer
	if err := json.Unmarshal([]byte(pointerJSON), &pointer); err == nil && pointer.Generation != "" && pointer.Chunks > 0 && pointer.Chunks <= maxCredentialChunks {
		if err := cleanupCredentialChunks(pointer); err != nil {
			return fmt.Errorf("Could not clear the protected ChatGPT tokens: %w", err)
		}
	}
	if err := keyring.Delete(keyringService, credentialsKey); err != nil && !errors.Is(err, keyring.ErrNotFound) {
		return fmt.Errorf("Could not clear the protected ChatGPT credential index: %w", err)
	}
	return nil
}

func cleanupCredentialChunks(pointer credentialPointer) error {
	var firstError error
	for index := 0; index < pointer.Chunks; index++ {
		if err := keyring.Delete(keyringService, credentialChunkAccount(pointer.Generation, index)); err != nil && !errors.Is(err, keyring.ErrNotFound) && firstError == nil {
			firstError = err
		}
	}
	return firstError
}

func credentialChunkAccount(generation string, index int) string {
	return fmt.Sprintf("credentials.%s.%d", generation, index)
}

func splitCredential(encoded []byte) []string {
	chunks := make([]string, 0, (len(encoded)+credentialChunkSize-1)/credentialChunkSize)
	for start := 0; start < len(encoded); {
		end := start + credentialChunkSize
		if end > len(encoded) {
			end = len(encoded)
		} else {
			for end > start && end < len(encoded) && !utf8.RuneStart(encoded[end]) {
				end--
			}
		}
		if end == start {
			return nil
		}
		chunks = append(chunks, string(encoded[start:end]))
		start = end
	}
	return chunks
}

func (h *host) status() (hostStatus, error) {
	var registration registration
	registered, err := loadKeyring(registrationKey, &registration)
	if err != nil {
		return hostStatus{}, err
	}
	credentials, connected, err := loadCredentials()
	if err != nil {
		return hostStatus{}, err
	}
	connected = connected && credentials.AccessToken != "" && contains(credentials.Scopes, requiredPlanScope)
	return hostStatus{Connected: connected, Registered: registered, Email: firstNonEmpty(credentials.Email, registration.Email)}, nil
}

func (h *host) disconnect(ctx context.Context) (map[string]any, error) {
	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	lock, err := h.refreshLock(ctx)
	if err != nil {
		return nil, err
	}
	defer lock.Unlock()

	stored, found, err := loadCredentials()
	revoked := !found
	warning := ""
	if err != nil {
		warning = "Disconnected locally, but the saved session could not be verified. Remove JD Scan from your ChatGPT settings to confirm remote sign-out."
	} else if found && stored.Refresh != "" {
		revokeCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
		revoked, err = h.revoke(revokeCtx, stored)
		cancel()
		if err != nil {
			warning = "Disconnected locally, but OpenAI could not confirm remote sign-out. You can remove JD Scan from your ChatGPT settings."
		}
		if !revoked && warning == "" {
			warning = "Disconnected locally, but OpenAI did not confirm remote sign-out. You can remove JD Scan from your ChatGPT settings."
		}
	} else if found {
		warning = "Disconnected locally; there was no refresh token to revoke."
	}
	if err := deleteCredentials(); err != nil {
		return nil, err
	}
	return map[string]any{"revoked": revoked, "warning": warning}, nil
}

func (h *host) switchAccount(ctx context.Context) (map[string]any, error) {
	result, err := h.disconnect(ctx)
	if err != nil {
		return nil, err
	}
	if err := keyring.Delete(keyringService, registrationKey); err != nil && !errors.Is(err, keyring.ErrNotFound) {
		return nil, fmt.Errorf("The session was disconnected, but the saved account could not be cleared: %w", err)
	}
	return result, nil
}

func (h *host) refreshLock(ctx context.Context) (*flock.Flock, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	lockPath := filepath.Join(configDir, "JD Scan", refreshLockName)
	if err := os.MkdirAll(filepath.Dir(lockPath), 0o700); err != nil {
		return nil, err
	}
	lock := flock.New(lockPath)
	for {
		locked, err := lock.TryLock()
		if err != nil {
			return nil, fmt.Errorf("Could not lock ChatGPT token refresh: %w", err)
		}
		if locked {
			return lock, nil
		}
		timer := time.NewTimer(150 * time.Millisecond)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, fmt.Errorf("Could not wait for another ChatGPT token refresh: %w", ctx.Err())
		case <-timer.C:
		}
	}
}

func (h *host) accessToken(ctx context.Context) (string, error) {
	stored, found, err := loadCredentials()
	if err != nil {
		return "", err
	}
	if !found {
		return "", errors.New("Connect a ChatGPT account in JD Scan settings first.")
	}
	if stored.AccessToken == "" || !contains(stored.Scopes, requiredPlanScope) {
		return "", errors.New("The saved ChatGPT session is not authorized for ChatGPT plan usage. Sign in again in JD Scan settings.")
	}
	if time.Until(stored.ExpiresAt) > 2*time.Minute {
		return stored.AccessToken, nil
	}

	lock, err := h.refreshLock(ctx)
	if err != nil {
		return "", err
	}
	defer lock.Unlock()
	stored, found, err = loadCredentials()
	if err != nil || !found {
		if err != nil {
			return "", err
		}
		return "", errors.New("The ChatGPT session was disconnected. Sign in again in JD Scan settings.")
	}
	if time.Until(stored.ExpiresAt) > 2*time.Minute {
		return stored.AccessToken, nil
	}
	if stored.Refresh == "" {
		return "", errors.New("The ChatGPT session expired. Sign in again in JD Scan settings.")
	}

	tokens, err := h.exchangeRefresh(ctx, stored)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "invalid_grant") {
			_ = deleteCredentials()
			return "", errors.New("The ChatGPT session expired. Sign in again in JD Scan settings.")
		}
		return "", err
	}
	if tokens.AccessToken == "" {
		if tokens.RefreshToken != "" {
			stored.Refresh = tokens.RefreshToken
		}
		if tokens.Scope != "" {
			stored.Scopes = strings.Fields(tokens.Scope)
		}
		if err := saveCredentials(stored); err != nil {
			return "", err
		}
		return "", errors.New("OpenAI returned an empty refreshed access token. Try reconnecting ChatGPT.")
	}
	stored.AccessToken = tokens.AccessToken
	if tokens.RefreshToken != "" {
		stored.Refresh = tokens.RefreshToken
	}
	if tokens.Scope != "" {
		stored.Scopes = strings.Fields(tokens.Scope)
	}
	if tokens.ExpiresIn <= 0 {
		tokens.ExpiresIn = 3600
	}
	stored.ExpiresAt = time.Now().Add(time.Duration(tokens.ExpiresIn) * time.Second)
	if err := saveCredentials(stored); err != nil {
		return "", err
	}
	if !contains(stored.Scopes, requiredPlanScope) {
		return "", errors.New("The saved ChatGPT session is not authorized for ChatGPT plan usage. Sign in again.")
	}
	return stored.AccessToken, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func contains(values []string, expected string) bool {
	for _, value := range values {
		if value == expected {
			return true
		}
	}
	return false
}
