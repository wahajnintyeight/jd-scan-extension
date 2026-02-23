# OpenRouter Provider Support

## Overview

Added OpenRouter as a supported LLM provider to the JD Scan application. OpenRouter provides unified access to multiple AI models through a single API, making it easier to switch between different models and providers.

## What is OpenRouter?

OpenRouter is a unified API gateway that provides access to multiple LLM providers including:
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude 3 Opus, Sonnet, Haiku)
- Google (Gemini Pro)
- Meta (Llama 3)
- Mistral AI (Mixtral)
- And many more...

**Benefits:**
- Single API key for multiple providers
- Automatic fallback between providers
- Competitive pricing
- No rate limits on most models
- Easy model switching

## Changes Made

### Frontend (`jd-scan/utils/api.ts`)

Added OpenRouter to the provider list with popular models:

```typescript
{
  value: 'openrouter',
  label: 'OpenRouter',
  models: [
    'openai/gpt-4-turbo',
    'openai/gpt-3.5-turbo',
    'anthropic/claude-3-opus',
    'anthropic/claude-3-sonnet',
    'google/gemini-pro',
    'meta-llama/llama-3-70b',
    'mistralai/mixtral-8x7b',
  ],
}
```

### Backend Changes

#### 1. LLM Service (`internal/service/llm-service.go`)

Added OpenRouter case to the provider switch:

```go
case "openrouter":
    llm, err = gollm.NewLLM(
        gollm.SetProvider("openrouter"),
        gollm.SetModel(req.Model),
        gollm.SetAPIKey(req.APIKey),
        gollm.SetMaxTokens(req.MaxTokens),
        gollm.SetTemperature(req.Temperature),
    )
```

#### 2. LLM API Config Controller (`internal/controllers/llmApiConfigController.go`)

Updated validation to accept OpenRouter:

```go
validProviders := map[string]bool{
    "openai":     true,
    "anthropic":  true,
    "groq":       true,
    "openrouter": true,  // Added
    "ollama":     true,
}
```

#### 3. Model Documentation (`internal/model/llm-api-config.go`)

Updated provider comment:

```go
Provider string `json:"provider" bson:"provider"` // openai, anthropic, groq, openrouter, ollama
```

#### 4. Test Connection Request (`internal/model/gollm-models.go`)

Updated documentation:

```go
Provider string `json:"provider" bson:"provider"` // LLM provider (e.g., "openai", "anthropic", "openrouter")
```

## Usage

### Getting an OpenRouter API Key

1. Visit [OpenRouter.ai](https://openrouter.ai/)
2. Sign up for an account
3. Go to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-or-v1-...`)

### Using OpenRouter in JD Scan

1. Open JD Scan extension
2. Click Settings (gear icon)
3. Go to "LLM API" tab
4. Click "Add New Configuration"
5. Fill in the form:
   - **Name**: e.g., "OpenRouter GPT-4"
   - **Provider**: Select "OpenRouter"
   - **Model**: Select from dropdown (e.g., "openai/gpt-4-turbo")
   - **API Key**: Paste your OpenRouter API key
6. Click "Test Connection" to verify
7. Click "Save Configuration"

### Model Format

OpenRouter uses a specific model format: `provider/model-name`

Examples:
- `openai/gpt-4-turbo`
- `anthropic/claude-3-opus`
- `google/gemini-pro`
- `meta-llama/llama-3-70b`

### Available Models

The following models are pre-configured in the dropdown:

| Model | Description | Use Case |
|-------|-------------|----------|
| `openai/gpt-4-turbo` | Latest GPT-4 Turbo | Best quality, complex tasks |
| `openai/gpt-3.5-turbo` | GPT-3.5 Turbo | Fast, cost-effective |
| `anthropic/claude-3-opus` | Claude 3 Opus | Long context, analysis |
| `anthropic/claude-3-sonnet` | Claude 3 Sonnet | Balanced performance |
| `google/gemini-pro` | Google Gemini Pro | Multimodal capabilities |
| `meta-llama/llama-3-70b` | Llama 3 70B | Open source, powerful |
| `mistralai/mixtral-8x7b` | Mixtral 8x7B | Fast, efficient |

For a complete list of available models, visit [OpenRouter Models](https://openrouter.ai/models).

## API Endpoints

All existing LLM endpoints now support OpenRouter:

- `POST /v2/api/gollm/test-connection` - Test OpenRouter credentials
- `POST /v2/api/gollm/ats/scan` - Scan resume with OpenRouter
- `POST /v2/api/gollm/chat/completions` - Chat completion
- `POST /v2/api/llm-api-config` - Save OpenRouter config

## Example Configuration

### Frontend Request

```typescript
const config = {
  name: "OpenRouter GPT-4",
  provider: "openrouter",
  model: "openai/gpt-4-turbo",
  apiKey: "sk-or-v1-...",
  isActive: true
};

await createLLMConfig(config);
```

### Backend Request

```json
{
  "provider": "openrouter",
  "model": "openai/gpt-4-turbo",
  "apiKey": "sk-or-v1-...",
  "messages": [
    {
      "role": "user",
      "content": "Hello, world!"
    }
  ],
  "maxTokens": 1000,
  "temperature": 0.7
}
```

## Testing

### Test Connection

```bash
curl -X POST http://localhost:8881/v2/api/gollm/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openrouter",
    "model": "openai/gpt-4-turbo",
    "apiKey": "sk-or-v1-..."
  }'
```

### Expected Response

```json
{
  "code": 1022,
  "result": {
    "success": true,
    "message": "Connection successful! Your credentials are valid.",
    "model": "openai/gpt-4-turbo",
    "usage": {
      "promptTokens": 15,
      "completionTokens": 5,
      "totalTokens": 20
    }
  }
}
```

## Pricing

OpenRouter pricing varies by model. Check current pricing at [OpenRouter Pricing](https://openrouter.ai/pricing).

**Example Costs (as of 2024):**
- GPT-4 Turbo: ~$0.01/1K tokens
- GPT-3.5 Turbo: ~$0.0005/1K tokens
- Claude 3 Opus: ~$0.015/1K tokens
- Llama 3 70B: ~$0.0007/1K tokens

## Benefits of Using OpenRouter

1. **Single API Key**: One key for all providers
2. **No Rate Limits**: Most models have no rate limits
3. **Automatic Fallback**: If one provider is down, automatically uses another
4. **Cost Optimization**: Automatically routes to cheapest available provider
5. **Easy Switching**: Change models without changing API keys
6. **Unified Interface**: Same API format for all providers

## Troubleshooting

### Invalid API Key

**Error**: "Connection failed: Invalid API key"

**Solution**: 
- Verify your API key starts with `sk-or-v1-`
- Check if key is active on OpenRouter dashboard
- Ensure you have credits in your account

### Model Not Found

**Error**: "Connection failed: Model not found"

**Solution**:
- Use the correct model format: `provider/model-name`
- Check available models at [OpenRouter Models](https://openrouter.ai/models)
- Some models require special access

### Rate Limit Exceeded

**Error**: "Rate limit exceeded"

**Solution**:
- Add credits to your OpenRouter account
- Wait a few minutes and retry
- Switch to a different model

## Security

- API keys are encrypted before storage
- Keys are never logged or exposed in responses
- Use HTTPS for all API calls
- Store keys securely in environment variables for production

## Future Enhancements

1. **Model Discovery**: Fetch available models from OpenRouter API
2. **Cost Tracking**: Track token usage and costs per configuration
3. **Auto-Fallback**: Automatically switch models if one fails
4. **Model Comparison**: Compare responses from different models
5. **Streaming Support**: Add streaming responses for real-time output

## Documentation

- OpenRouter Docs: https://openrouter.ai/docs
- API Reference: https://openrouter.ai/docs/api-reference
- Model List: https://openrouter.ai/models
- Pricing: https://openrouter.ai/pricing
