import React, { useState, useEffect } from 'react';
import { X, Key, Cpu, Zap, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { 
  LLM_PROVIDERS, 
  getModelsForProvider, 
  fetchLLMConfigs, 
  createLLMConfig, 
  updateLLMConfig, 
  deleteLLMConfig,
  fetchOpenRouterModels,
  LLMAPIConfig 
} from '../utils/api';
import SearchableDropdown, { DropdownOption } from './SearchableDropdown';

interface LLMConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LLMConfigModal({ isOpen, onClose }: LLMConfigModalProps) {
  const [configs, setConfigs] = useState<LLMAPIConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    provider: 'openai',
    model: '',
    apiKey: '',
    isActive: true,
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState<any[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen]);

  const loadConfigs = async () => {
    setLoading(true);
    const data = await fetchLLMConfigs();
    setConfigs(data);
    setLoading(false);
  };

  const handleProviderChange = (provider: string) => {
    const models = getModelsForProvider(provider);
    setFormData({
      ...formData,
      provider,
      model: models[0] || '',
    });
    setOpenRouterModels([]); // Clear OpenRouter models when provider changes
  };

  const handleFetchOpenRouterModels = async (apiKey: string) => {
    if (!apiKey || !apiKey.startsWith('sk-or-v1-')) {
      return;
    }

    setFetchingModels(true);
    setFormError(''); // Clear any previous errors
    const result = await fetchOpenRouterModels(apiKey);
    setFetchingModels(false);

    if (result.success && result.models) {
      setOpenRouterModels(result.models);
      console.log(`Fetched ${result.models.length} OpenRouter models`);
    } else {
      const errorMessage = typeof result.error === 'string' 
        ? result.error 
        : 'Failed to fetch models';
      console.error('Failed to fetch OpenRouter models:', result.error);
      setFormError(errorMessage);
    }
  };

  // Search handler for SearchableDropdown
  const handleModelSearch = async (query: string): Promise<DropdownOption[]> => {
    // For OpenRouter, use fetched models
    if (formData.provider === 'openrouter' && openRouterModels.length > 0) {
      const filtered = openRouterModels.filter(model =>
        model.name.toLowerCase().includes(query.toLowerCase()) ||
        model.id.toLowerCase().includes(query.toLowerCase())
      );

      return filtered.map(model => ({
        id: model.id,
        name: model.name,
        description: model.description,
        metadata: {
          context_length: model.context_length,
          pricing: model.pricing,
        },
      }));
    }

    // For other providers, use static model list
    const models = getModelsForProvider(formData.provider);
    const filtered = models.filter(model =>
      model.toLowerCase().includes(query.toLowerCase())
    );

    return filtered.map(model => ({
      id: model,
      name: model,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formData.name || !formData.provider || !formData.model || !formData.apiKey) {
      setFormError('All fields are required');
      return;
    }

    setSubmitting(true);
    const result = await createLLMConfig(formData);
    setSubmitting(false);

    if (result.success) {
      setFormSuccess('Configuration saved successfully!');
      setFormData({
        name: '',
        provider: 'openai',
        model: '',
        apiKey: '',
        isActive: true,
      });
      setTimeout(() => {
        setShowAddForm(false);
        setFormSuccess('');
        loadConfigs();
      }, 1500);
    } else {
      setFormError(result.error || 'Failed to save configuration');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const result = await updateLLMConfig(id, { isActive: !currentStatus });
    if (result.success) {
      loadConfigs();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) return;
    
    const result = await deleteLLMConfig(id);
    if (result.success) {
      loadConfigs();
    }
  };

  if (!isOpen) return null;

  const availableModels = getModelsForProvider(formData.provider);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-brand-50 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">LLM API Configuration</h2>
              <p className="text-xs text-slate-500">Manage your AI provider settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 premium-scrollbar">
          
          {/* Add New Config Button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full p-4 border-2 border-dashed border-brand-300 rounded-xl hover:border-brand-500 hover:bg-brand-50 transition-all flex items-center justify-center gap-2 text-brand-600 font-semibold"
            >
              <Zap className="w-5 h-5" />
              Add New Configuration
            </button>
          )}

          {/* Add Form */}
          {showAddForm && (
            <div className="glass-card p-6 space-y-4 border-brand-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900">New Configuration</h3>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setFormError('');
                    setFormSuccess('');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Configuration Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., OpenAI GPT-4 Production"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  />
                </div>

                {/* Provider */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Provider
                  </label>
                  <select
                    value={formData.provider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  >
                    {LLM_PROVIDERS.map((provider) => (
                      <option key={provider.value} value={provider.value}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Model */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Model
                  </label>
                  
                  <SearchableDropdown
                    value={formData.model}
                    onChange={(modelId) => setFormData({ ...formData, model: modelId })}
                    onSearch={handleModelSearch}
                    placeholder="Search models..."
                    loading={fetchingModels}
                    renderOption={(option) => (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {option.name}
                          </p>
                          {option.id !== option.name && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {option.id}
                            </p>
                          )}
                          {option.description && (
                            <p className="text-xs text-slate-400 line-clamp-1 mt-1">
                              {option.description}
                            </p>
                          )}
                        </div>
                        {option.metadata && (
                          <div className="text-right shrink-0">
                            <p className="text-xs font-medium text-slate-600">
                              {option.metadata.context_length.toLocaleString()} ctx
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              ${option.metadata.pricing.prompt}/1K
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  />
                  
                  {formData.provider === 'openrouter' && openRouterModels.length === 0 && !fetchingModels && (
                    <p className="text-xs text-slate-500 mt-1.5">
                      Enter your API key to load available models
                    </p>
                  )}
                  
                  {fetchingModels && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-brand-600">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading models...
                    </div>
                  )}
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    API Key
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={formData.apiKey}
                      onChange={(e) => {
                        const newApiKey = e.target.value;
                        setFormData({ ...formData, apiKey: newApiKey });
                        
                        // Auto-fetch OpenRouter models when API key is entered
                        if (formData.provider === 'openrouter' && newApiKey.startsWith('sk-or-v1-')) {
                          handleFetchOpenRouterModels(newApiKey);
                        }
                      }}
                      placeholder="sk-..."
                      className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Your API key is encrypted and stored securely</p>
                </div>

                {/* Active Status */}
                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Set as Active</p>
                    <p className="text-xs text-slate-500">Use this configuration for ATS scanning</p>
                  </div>
                </label>

                {/* Error/Success Messages */}
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <p className="text-xs text-red-700">{formError}</p>
                  </div>
                )}

                {formSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <p className="text-xs text-green-700">{formSuccess}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Save Configuration
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Existing Configs */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 px-1">Saved Configurations</h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
              </div>
            ) : configs.length === 0 ? (
              <div className="text-center py-12">
                <Cpu className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No configurations yet</p>
                <p className="text-xs text-slate-400 mt-1">Add your first LLM API configuration to get started</p>
              </div>
            ) : (
              configs.map((config) => (
                <div
                  key={config.id}
                  className="glass-card p-4 flex items-center justify-between hover:shadow-lg transition-all"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-bold text-slate-800">{config.name}</h4>
                      {config.isActive && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="font-medium">{LLM_PROVIDERS.find(p => p.value === config.provider)?.label}</span>
                      <span>•</span>
                      <span>{config.model}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(config.id, config.isActive)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        config.isActive
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                      }`}
                    >
                      {config.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(config.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
