/**
 * API Configuration and Helper Functions
 */

import { getSessionHeaders } from './session';

// Get API base URL from environment or use default
const getApiBaseUrl = () => {
  // Try to get from import.meta.env (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // Fallback to default
  return 'http://localhost:8881/v2/api';
};

const API_BASE_URL = getApiBaseUrl();

// Debug log to verify API URL is set correctly
console.log('[API] Base URL:', API_BASE_URL);

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

/**
 * Fetch all LLM API configurations
 */
export async function fetchLLMConfigs(): Promise<LLMAPIConfig[]> {
  try {
    const headers = await getSessionHeaders();
    const response = await fetch(`${API_BASE_URL}/llm-api-configs`, {
      headers,
    });
    const data = await response.json();
    
    if (data.code === 1022 && data.result) {
      return data.result;
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
    const response = await fetch(`${API_BASE_URL}/llm-api-config`, {
      method: 'POST',
      headers,
      body: JSON.stringify(config),
    });
    
    const data = await response.json();
    
    if (data.code === 1022 && data.result) {
      return { success: true, data: data.result };
    }
    
    return { success: false, error: data.result || 'Failed to create configuration' };
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
    const response = await fetch(`${API_BASE_URL}/llm-api-config?id=${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(config),
    });
    
    const data = await response.json();
    
    if (data.code === 1022) {
      return { success: true };
    }
    
    return { success: false, error: data.result || 'Failed to update configuration' };
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
    const response = await fetch(`${API_BASE_URL}/llm-api-config?id=${id}`, {
      method: 'DELETE',
      headers,
    });
    
    const data = await response.json();
    
    if (data.code === 1022) {
      return { success: true };
    }
    
    return { success: false, error: 'Failed to delete configuration' };
  } catch (error) {
    console.error('Failed to delete LLM config:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Test LLM API connection
 */
export async function testLLMConnection(provider: string, model: string, apiKey: string): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const headers = await getSessionHeaders();
    const response = await fetch(`${API_BASE_URL}/gollm/test-connection`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        provider,
        model,
        apiKey,
      }),
    });
    
    const data = await response.json();
    
    if (data.code === 1022 && data.result) {
      return {
        success: data.result.success || false,
        message: data.result.message || 'Connection test completed',
        error: data.result.error,
      };
    }
    
    return {
      success: false,
      message: 'Connection test failed',
      error: data.result || 'Unknown error',
    };
  } catch (error) {
    console.error('Failed to test LLM connection:', error);
    return {
      success: false,
      message: 'Network error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
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
export async function scanResumeATS(resumeContent: string, jobDescription: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const headers = await getSessionHeaders();
    const response = await fetch(`${API_BASE_URL}/gollm/ats/scan`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        resume: resumeContent,
        jobDescription: jobDescription,
      }),
    });
    
    const data = await response.json();
    
    if (data.code === 1022 && data.result) {
      return { success: true, data: data.result };
    }
    
    return { success: false, error: data.result || 'Failed to scan resume' };
  } catch (error) {
    console.error('Failed to scan resume:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Fetch available models from OpenRouter
 */
export async function fetchOpenRouterModels(apiKey: string): Promise<{ success: boolean; models?: any[]; error?: string }> {
  try {
    const headers = await getSessionHeaders();
    const response = await fetch(`${API_BASE_URL}/gollm/fetch-models`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        provider: 'openrouter',
        apiKey: apiKey,
      }),
    });
    
    const data = await response.json();
    
    if (data.code === 1022 && data.result) {
      return { 
        success: true, 
        models: data.result.models || [] 
      };
    }
    
    return { success: false, error: data.result || 'Failed to fetch models' };
  } catch (error) {
    console.error('Failed to fetch OpenRouter models:', error);
    return { success: false, error: 'Network error' };
  }
}
