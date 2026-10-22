/**
 * API Configuration and Helper Functions
 */

import { getSessionHeaders } from './session';
import { API_BASE_URL, apiFetch } from './apiTransport';

export interface LLMProvider {
  value: string;
  label: string;
  models: string[];
}

export const LLM_PROVIDERS: LLMProvider[] = [
  {
    value: 'openai',
    label: 'OpenAI',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  },
  {
    value: 'groq',
    label: 'Groq',
    models: ['llama-3.1-70b', 'llama-3.1-8b', 'mixtral-8x7b'],
  },
  {
    value: 'huggingface',
    label: 'Hugging Face Inference Providers',
    models: [
      'openai/gpt-oss-120b:fastest',
      'deepseek-ai/DeepSeek-R1:novita',
      'zai-org/GLM-5.3:baseten',
    ],
  },
  {
    value: 'xai',
    label: 'xAI (Grok)',
    models: ['grok-4.7'],
  },
  {
    value: 'mistral',
    label: 'Mistral AI',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'devstral-latest'],
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    models: ['deepseek-flash', 'deepseek-v4-pro'],
  },
  {
    value: 'gemini',
    label: 'Google Gemini',
    models: ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview'],
  },
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
  },
  {
    value: 'ollama',
    label: 'Ollama (Local)',
    models: ['llama2', 'mistral', 'codellama'],
  },
];

// API Response wrapper interface
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  result: T;
}

// Success codes enum
export enum ApiSuccessCode {
  DATA_FETCHED = 1009,
  OPERATION_SUCCESS = 1022,
}

export interface LLMAPIConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLLMConfigRequest {
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  isActive: boolean;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
    request: string;
    image: string;
  };
  architecture: {
    modality: string;
    input_modalities: string[];
    output_modalities: string[];
    tokenizer: string;
    instruct_type: string;
  };
  description: string;
}

export interface FetchModelsResult {
  count: number;
  models: OpenRouterModel[];
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

export interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Check if API response is successful
 */
function isSuccessResponse(code: number): boolean {
  return code === ApiSuccessCode.DATA_FETCHED || code === ApiSuccessCode.OPERATION_SUCCESS;
}

/**
 * Fetch all LLM API configurations
 */
export async function fetchLLMConfigs(): Promise<LLMAPIConfig[]> {
  try {
    const headers = await getSessionHeaders();
    const response = await apiFetch(`${API_BASE_URL}/llm-api-configs`, {
      headers,
    });
    const data: ApiResponse<LLMAPIConfig[] | null> = await response.json();
    
    if (isSuccessResponse(data.code)) {
      const seen = new Set<string>();
      return (Array.isArray(data.result) ? data.result : []).filter((config) => {
        if (!config || typeof config.id !== 'string' || !config.id.trim() || seen.has(config.id)) {
          console.error('Ignoring an LLM configuration with a missing or duplicate ID. Update the backend.');
          return false;
        }
        seen.add(config.id);
        return true;
      });
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch LLM configs:', error);
    return [];
  }
}

/**
 * Create a new LLM API configuration
 */
export async function createLLMConfig(config: CreateLLMConfigRequest): Promise<{ success: boolean; data?: LLMAPIConfig; error?: string }> {
  try {
    const headers = await getSessionHeaders();
    const response = await apiFetch(`${API_BASE_URL}/llm-api-config`, {
      method: 'POST',
      headers,
      body: JSON.stringify(config),
    });
    
    const data: ApiResponse<LLMAPIConfig> = await response.json();
    
    if (isSuccessResponse(data.code) && data.result) {
      return { success: true, data: data.result };
    }
    
    return { success: false, error: data.message || 'Failed to create configuration' };
  } catch (error) {
    console.error('Failed to create LLM config:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Update an existing LLM API configuration
 */
export async function updateLLMConfig(id: string, config: Partial<CreateLLMConfigRequest>): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getSessionHeaders();
    const response = await apiFetch(`${API_BASE_URL}/llm-api-config?id=${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(config),
    });
    
    const data: ApiResponse = await response.json();
    
    if (isSuccessResponse(data.code)) {
      return { success: true };
    }
    
    return { success: false, error: data.message || 'Failed to update configuration' };
  } catch (error) {
    console.error('Failed to update LLM config:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Delete an LLM API configuration
 */
export async function deleteLLMConfig(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getSessionHeaders();
    const response = await apiFetch(`${API_BASE_URL}/llm-api-config?id=${id}`, {
      method: 'DELETE',
      headers,
    });
    
    const data: ApiResponse = await response.json();
    
    if (isSuccessResponse(data.code)) {
      return { success: true };
    }
    
    return { success: false, error: data.message || 'Failed to delete configuration' };
  } catch (error) {
    console.error('Failed to delete LLM config:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Test LLM API connection
 */
export async function testLLMConnection(provider: string, model: string, apiKey: string): Promise<{ success: boolean; message: string; error?: string; usage?: any }> {
  try {
    const headers = await getSessionHeaders();
    const response = await apiFetch(`${API_BASE_URL}/gollm/test-connection`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        provider,
        model: model.trim(),
        apiKey: apiKey.trim(),
      }),
    });

    const data: ApiResponse<TestConnectionResult | string> | null = await response.json().catch(() => null);
    const result = data?.result && typeof data.result === 'object' ? data.result : undefined;
    const success = response.ok && !!data && isSuccessResponse(data.code) && result?.success === true;
    const messages = success
      ? [result?.message]
      : [result?.error, result?.message, typeof data?.result === 'string' ? data.result : undefined, data?.message];
    const detail = messages.find(message =>
      typeof message === 'string' && message.trim() && !/^(error|unknown error)$/i.test(message.trim())
    )?.trim();
    const message = detail || (success
      ? 'Connection successful!'
      : `Connection test failed${response.ok ? '' : ` (HTTP ${response.status})`}. Check the API key and model, then try again.`);

    return {
      success,
      message,
      error: success ? undefined : message,
      usage: result?.usage,
    };
  } catch (error) {
    console.error('Failed to test LLM connection:', error);
    const message = `Could not reach the connection-test API: ${error instanceof Error ? error.message : 'Network request failed.'}`;
    return { success: false, message, error: message };
  }
}

/**
 * Get models for a specific provider
 */
export function getModelsForProvider(provider: string): string[] {
  const providerConfig = LLM_PROVIDERS.find(p => p.value === provider);
  return providerConfig?.models || [];
}

/**
 * Scan resume against job description using ATS
 */
export async function scanResumeATS(
  apiId: string,
  resumeContent: string, 
  jobDescription: string,
  temperature?: number,
  maxTokens?: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const headers = await getSessionHeaders();
    const response = await apiFetch(`${API_BASE_URL}/gollm/ats/scan`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        api_id: apiId,
        resume_text: resumeContent,
        job_description: jobDescription,
        temperature: temperature || 0.7,
        maxTokens: maxTokens || 2000,
      }),
    });
    
    const data: ApiResponse = await response.json();
    
    if (isSuccessResponse(data.code) && data.result) {
      return { success: true, data: data.result };
    }
    
    return { success: false, error: data.message || 'Failed to scan resume' };
  } catch (error) {
    console.error('Failed to scan resume:', error);
    return { success: false, error: 'Network error' };
  }
}

/** Generate a non-streaming chat response with a saved provider configuration. */
export async function createLLMChatCompletion(
  apiId: string,
  messages: LLMChatMessage[],
  maxTokens = 1800,
): Promise<{ success: boolean; text?: string; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const headers = await getSessionHeaders();
    const response = await apiFetch(`${API_BASE_URL}/gollm/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({ api_id: apiId, messages, maxTokens, temperature: 0.4 }),
    });
    const data: ApiResponse<any> = await response.json();

    if (!response.ok || !isSuccessResponse(data.code)) {
      return { success: false, error: data.message || `AI request failed (${response.status})` };
    }

    const result = data.result;
    const text = typeof result === 'string'
      ? result
      : result?.choices?.[0]?.message?.content
        ?? result?.message?.content
        ?? result?.content
        ?? result?.response;

    return typeof text === 'string' && text.trim()
      ? { success: true, text: text.trim() }
      : { success: false, error: 'The AI provider returned an empty response.' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error && error.name === 'AbortError'
        ? 'The AI request timed out. Try again or choose another provider.'
        : error instanceof Error ? error.message : 'Network error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch available models from OpenRouter
 */
export async function fetchOpenRouterModels(apiKey: string): Promise<{ success: boolean; models?: OpenRouterModel[]; count?: number; error?: string }> {
  try {
    const headers = await getSessionHeaders();
    const response = await apiFetch(`${API_BASE_URL}/gollm/fetch-models`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        provider: 'openrouter',
        apiKey: apiKey,
      }),
    });
    
    const data: ApiResponse<FetchModelsResult> = await response.json();
    
    if (isSuccessResponse(data.code) && data.result) {
      return { 
        success: true, 
        models: data.result.models || [],
        count: data.result.count || 0
      };
    }
    
    return { 
      success: false, 
      error: data.message || (typeof data.result === 'string' ? data.result : 'Failed to fetch models')
    };
  } catch (error) {
    console.error('Failed to fetch OpenRouter models:', error);
    return { success: false, error: 'Network error' };
  }
}
