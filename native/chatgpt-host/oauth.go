package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/zalando/go-keyring"
)

const (
	openAIIssuer    = "https://auth.openai.com"
	openAIAuthorize = "https://auth.openai.com/api/accounts/authorize"
	openAIToken     = "https://auth.openai.com/api/accounts/oauth/token"
	oauthScopes     = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct"
)

type oauthTokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	IDToken      string `json:"id_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
}

type callbackResult struct {
	code     string
	state    string
	clientID string
	err      string
}

func randomValue(size int) (string, error) {
	buffer := make([]byte, size)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func (h *host) connect(parent context.Context) (hostStatus, error) {
	ctx, cancel := context.WithTimeout(parent, 6*time.Minute)
	defer cancel()

	var oldCredentials credentials
	credentialsFound, err := loadKeyring(credentialsKey, &oldCredentials)
	if err != nil {
		return hostStatus{}, err
	}
	var savedRegistration registration
	registered, err := loadKeyring(registrationKey, &savedRegistration)
	if err != nil {
		return hostStatus{}, err
	}

	hostID := ""
	if credentialsFound {
		hostID = oldCredentials.HostID
	}
	if hostID == "" && registered {
		hostID = savedRegistration.HostID
	}
	if hostID == "" {
		hostID, err = newHostID()
		if err != nil {
			return hostStatus{}, fmt.Errorf("Could not create a local host identifier: %w", err)
		}
		if err := keyring.Set(keyringService, hostIDKey, hostID); err != nil {
			return hostStatus{}, fmt.Errorf("Could not save the local host identifier to the system keychain: %w", err)
		}
	}
	if storedHostID, err := keyring.Get(keyringService, hostIDKey); err == nil {
		hostID = storedHostID
	}

	clientID := "dynamic_agent_client"
	if registered && savedRegistration.ClientID != "" {
		clientID = savedRegistration.ClientID
	}
	if credentialsFound && oldCredentials.ClientID != "" {
		clientID = oldCredentials.ClientID
	}
	if clientID == "dynamic_agent_client" {
		savedRegistration = registration{HostID: hostID}
	} else if savedRegistration.HostID == "" {
		savedRegistration.HostID = hostID
	}

	state, err := randomValue(32)
	if err != nil {
		return hostStatus{}, err
	}
	nonce, err := randomValue(32)
	if err != nil {
		return hostStatus{}, err
	}
	verifier, err := randomValue(48)
	if err != nil {
		return hostStatus{}, err
	}
	challenge := sha256.Sum256([]byte(verifier))
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return hostStatus{}, fmt.Errorf("Could not start the local sign-in callback: %w", err)
	}
	defer listener.Close()
	redirectURI := fmt.Sprintf("http://127.0.0.1:%d/auth/callback", listener.Addr().(*net.TCPAddr).Port)
	callback := make(chan callbackResult, 1)
	server := &http.Server{Handler: callbackHandler(state, callback), ReadHeaderTimeout: 5 * time.Second}
	go func() { _ = server.Serve(listener) }()
	defer func() {
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), time.Second)
		defer shutdownCancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	query := url.Values{
		"client_id":             {clientID},
		"ext_agent_host_id":     {hostID},
		"response_type":         {"code"},
		"redirect_uri":          {redirectURI},
		"scope":                 {oauthScopes},
		"resource":              {openAIResource},
		"state":                 {state},
		"nonce":                 {nonce},
		"code_challenge_method": {"S256"},
		"code_challenge":        {base64.RawURLEncoding.EncodeToString(challenge[:])},
	}
	if clientID == "dynamic_agent_client" {
		query.Set("agent_name_hint", "JD Scan")
	} else {
		if credentialsFound && oldCredentials.IDToken != "" {
			query.Set("id_token_hint", oldCredentials.IDToken)
		}
		if savedRegistration.Email != "" {
			query.Set("login_hint", savedRegistration.Email)
		}
	}
	loginURL := openAIAuthorize + "?" + query.Encode()
	if err := openSystemBrowser(loginURL); err != nil {
		return hostStatus{}, fmt.Errorf("Could not open the system browser for ChatGPT sign-in: %w", err)
	}

	var result callbackResult
	select {
	case result = <-callback:
	case <-ctx.Done():
		return hostStatus{}, errors.New("ChatGPT sign-in timed out. Try again.")
	}
	if result.err != "" {
		return hostStatus{}, errors.New("ChatGPT sign-in was cancelled or did not grant plan usage. You can try again or use an API key.")
	}
	if result.state != state {
		return hostStatus{}, errors.New("ChatGPT sign-in state validation failed. Try again.")
	}

	issuedClientID := result.clientID
	if clientID != "dynamic_agent_client" {
		if issuedClientID != "" && issuedClientID != clientID {
			return hostStatus{}, errors.New("ChatGPT returned a different client registration. The existing account connection was not changed.")
		}
		issuedClientID = clientID
	}
	if issuedClientID == "" || issuedClientID == "dynamic_agent_client" {
		return hostStatus{}, errors.New("ChatGPT did not return the client registration needed to finish sign-in.")
	}
	if !registered {
		if err := saveKeyring(registrationKey, registration{ClientID: issuedClientID, HostID: hostID}); err != nil {
			return hostStatus{}, err
		}
	}

	tokens, err := h.exchangeCode(ctx, issuedClientID, result.code, verifier, redirectURI)
	if err != nil {
		return hostStatus{}, err
	}
	scopes := strings.Fields(tokens.Scope)
	if !contains(scopes, requiredPlanScope) {
		return hostStatus{}, errors.New("ChatGPT sign-in succeeded, but permission to use the ChatGPT plan was not granted. Try again and accept that permission, or use an API key.")
	}
	provider, err := oidc.NewProvider(ctx, openAIIssuer)
	if err != nil {
		return hostStatus{}, fmt.Errorf("Could not verify the ChatGPT sign-in: %w", err)
	}
	verified, err := provider.Verifier(&oidc.Config{ClientID: issuedClientID}).Verify(ctx, tokens.IDToken)
	if err != nil {
		return hostStatus{}, fmt.Errorf("Could not verify the ChatGPT identity: %w", err)
	}
	if verified.Nonce != nonce || verified.Subject == "" {
		return hostStatus{}, errors.New("ChatGPT identity verification failed. Try signing in again.")
	}
	if registered && savedRegistration.Subject != "" && savedRegistration.Subject != verified.Subject {
		return hostStatus{}, errors.New("This ChatGPT registration belongs to a different account. Use Switch account in JD Scan settings before signing in again.")
	}
	var identity struct {
		Email string `json:"email"`
	}
	_ = verified.Claims(&identity)
	if tokens.AccessToken == "" || tokens.RefreshToken == "" || tokens.IDToken == "" {
		return hostStatus{}, errors.New("ChatGPT sign-in returned incomplete renewable credentials.")
	}
	if tokens.ExpiresIn <= 0 {
		tokens.ExpiresIn = 3600
	}
	lock, err := h.refreshLock(ctx)
	if err != nil {
		return hostStatus{}, err
	}
	defer lock.Unlock()
	if err := saveKeyring(registrationKey, registration{ClientID: issuedClientID, Email: identity.Email, Subject: verified.Subject, HostID: hostID}); err != nil {
		return hostStatus{}, err
	}
	if err := saveCredentials(credentials{
		ClientID: issuedClientID, Email: identity.Email, Subject: verified.Subject, HostID: hostID,
		IDToken: tokens.IDToken, AccessToken: tokens.AccessToken, Refresh: tokens.RefreshToken,
		Scopes: scopes, ExpiresAt: time.Now().Add(time.Duration(tokens.ExpiresIn) * time.Second),
	}); err != nil {
		return hostStatus{}, err
	}
	return hostStatus{Connected: true, Registered: true, Email: identity.Email}, nil
}

func callbackHandler(expectedState string, output chan<- callbackResult) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/auth/callback", func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			http.Error(writer, "Method not allowed.", http.StatusMethodNotAllowed)
			return
		}
		query := request.URL.Query()
		if query.Get("state") != expectedState {
			http.Error(writer, "Sign-in state did not match. Return to JD Scan and try again.", http.StatusBadRequest)
			return
		}
		result := callbackResult{state: query.Get("state"), code: query.Get("code"), clientID: query.Get("client_id"), err: query.Get("error")}
		if result.err == "" && result.code == "" {
			result.err = "missing_code"
		}
		select {
		case output <- result:
		default:
			http.Error(writer, "This sign-in request was already handled.", http.StatusConflict)
			return
		}
		writer.Header().Set("Content-Type", "text/html; charset=utf-8")
		message := "Sign-in finished. Return to JD Scan."
		if result.err != "" {
			message = "Sign-in did not finish. You can close this page and return to JD Scan."
		}
		_, _ = fmt.Fprintf(writer, "<!doctype html><title>JD Scan</title><p>%s</p>", message)
	})
	return mux
}

func (h *host) exchangeCode(ctx context.Context, clientID, code, verifier, redirectURI string) (oauthTokens, error) {
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"client_id":     {clientID},
		"code":          {code},
		"code_verifier": {verifier},
		"redirect_uri":  {redirectURI},
		"resource":      {openAIResource},
	}
	return h.exchange(ctx, form)
}

func (h *host) exchangeRefresh(ctx context.Context, stored credentials) (oauthTokens, error) {
	form := url.Values{
		"grant_type":    {"refresh_token"},
		"client_id":     {stored.ClientID},
		"refresh_token": {stored.Refresh},
		"resource":      {openAIResource},
	}
	return h.exchange(ctx, form)
}

func (h *host) exchange(ctx context.Context, form url.Values) (oauthTokens, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, openAIToken, strings.NewReader(form.Encode()))
	if err != nil {
		return oauthTokens{}, err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := h.client.Do(request)
	if err != nil {
		return oauthTokens{}, fmt.Errorf("Could not reach OpenAI sign-in: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		var oauthError struct {
			Error       string `json:"error"`
			Description string `json:"error_description"`
		}
		_ = json.NewDecoder(http.MaxBytesReader(nil, response.Body, 64<<10)).Decode(&oauthError)
		message := firstNonEmpty(oauthError.Description, oauthError.Error, "OpenAI rejected the sign-in request.")
		return oauthTokens{}, fmt.Errorf("OpenAI sign-in failed (%s): %s", response.Status, message)
	}
	var tokens oauthTokens
	if err := json.NewDecoder(http.MaxBytesReader(nil, response.Body, 1<<20)).Decode(&tokens); err != nil {
		return oauthTokens{}, fmt.Errorf("OpenAI returned an unreadable token response: %w", err)
	}
	return tokens, nil
}

func newHostID() (string, error) {
	value, err := randomValue(16)
	if err != nil {
		return "", err
	}
	decoded, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return "", err
	}
	decoded[6] = (decoded[6] & 0x0f) | 0x40
	decoded[8] = (decoded[8] & 0x3f) | 0x80
	return fmt.Sprintf("urn:uuid:%08x-%04x-%04x-%04x-%012x", decoded[0:4], decoded[4:6], decoded[6:8], decoded[8:10], decoded[10:16]), nil
}

func openSystemBrowser(target string) error {
	var command *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		command = exec.Command("rundll32", "url.dll,FileProtocolHandler", target)
	case "darwin":
		command = exec.Command("open", target)
	default:
		command = exec.Command("xdg-open", target)
	}
	if err := command.Start(); err != nil {
		return err
	}
	go func() { _ = command.Wait() }()
	return nil
}
