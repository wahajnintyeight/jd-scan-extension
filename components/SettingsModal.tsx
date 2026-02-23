import React, { useState, useEffect } from 'react';
import { X, Monitor, Moon, Sun, Layout, Layers, Bell, Zap, Cpu, Key, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { UserSettings } from '../utils/settings';
import { 
  LLM_PROVIDERS, 
  getModelsForProvider, 
  fetchLLMConfigs, 
  createLLMConfig, 
  updateLLMConfig, 
  deleteLLMConfig,
  testLLMConnection,
  fetchOpenRouterModels,
  LLMAPIConfig 
} from '../utils/api';
import SearchableDropdown, { DropdownOption } from './SearchableDropdown';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSettingsChange: (settings: Partial<UserSettings>) => void;
}

export default function SettingsModal({ isOpen, onClose, settings, onSettingsChange }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'llm'>('general');
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
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [openRouterModels, setOpenRouterModels] = useState<any[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'llm') {
      loadConfigs();
    }
  }, [isOpen, activeTab]);

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
    setTestResult(null); // Clear test result when provider changes
    setOpenRouterModels([]); // Clear OpenRouter models
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
    if (openRouterModels.length === 0) {
      return [];
    }

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
  };

  const handleTestConnection = async () => {
    setFormError('');
    setTestResult(null);

    if (!formData.provider || !formData.model || !formData.apiKey) {
      setFormError('Please fill in provider, model, and API key to test connection');
      return;
    }

    setTesting(true);
    const result = await testLLMConnection(formData.provider, formData.model, formData.apiKey);
    setTesting(false);
    setTestResult(result);

    if (!result.success) {
      setFormError(result.message || 'Connection test failed');
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden animate-in flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-gradient-to-r from-brand-50 to-slate-50">
          <h2 className="text-xl font-bold text-slate-900 font-display">Settings</h2>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-8">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layout className="w-4 h-4" />
            General
          </button>
          <button
            onClick={() => setActiveTab('llm')}
            className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'llm'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Cpu className="w-4 h-4" />
            LLM API
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-8 overflow-y-auto premium-scrollbar flex-1">
          
          {activeTab === 'general' && (
            <>
          {/* Display Mode */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Layout className="w-5 h-5 text-brand-600" />
              <h3 className="text-base font-bold text-slate-900">Display Mode</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => onSettingsChange({ displayMode: 'sidebar' })}
                className={`p-6 rounded-xl border-2 transition-all ${
                  settings.displayMode === 'sidebar'
                    ? 'border-brand-500 bg-brand-50 shadow-sm'
                    : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
                }`}
              >
                <Layout className={`w-8 h-8 mx-auto mb-3 ${
                  settings.displayMode === 'sidebar' ? 'text-brand-600' : 'text-slate-400'
                }`} />
                <p className={`text-sm font-semibold ${
                  settings.displayMode === 'sidebar' ? 'text-brand-700' : 'text-slate-600'
                }`}>
                  Sidebar
                </p>
              </button>
              <button
                onClick={() => onSettingsChange({ displayMode: 'overlay' })}
                className={`p-6 rounded-xl border-2 transition-all ${
                  settings.displayMode === 'overlay'
                    ? 'border-brand-500 bg-brand-50 shadow-sm'
                    : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
                }`}
              >
                <Layers className={`w-8 h-8 mx-auto mb-3 ${
                  settings.displayMode === 'overlay' ? 'text-brand-600' : 'text-slate-400'
                }`} />
                <p className={`text-sm font-semibold ${
                  settings.displayMode === 'overlay' ? 'text-brand-700' : 'text-slate-600'
                }`}>
                  Floating
                </p>
              </button>
            </div>
          </div>

          {/* Overlay Position (only show if overlay mode) */}
          {settings.displayMode === 'overlay' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900">Overlay Position</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'top-left', label: 'Top Left' },
                  { value: 'top-right', label: 'Top Right' },
                  { value: 'bottom-left', label: 'Bottom Left' },
                  { value: 'bottom-right', label: 'Bottom Right' },
                ].map((pos) => (
                  <button
                    key={pos.value}
                    onClick={() => onSettingsChange({ overlayPosition: pos.value as any })}
                    className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                      settings.overlayPosition === pos.value
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color Mode */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sun className="w-5 h-5 text-brand-600" />
              <h3 className="text-base font-bold text-slate-900">Appearance</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'auto', label: 'Auto', icon: Monitor },
              ].map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => onSettingsChange({ colorMode: mode.value as any })}
                  className={`p-5 rounded-xl border-2 transition-all ${
                    settings.colorMode === mode.value
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
                  }`}
                >
                  <mode.icon className={`w-7 h-7 mx-auto mb-2 ${
                    settings.colorMode === mode.value ? 'text-brand-600' : 'text-slate-400'
                  }`} />
                  <p className={`text-sm font-semibold ${
                    settings.colorMode === mode.value ? 'text-brand-700' : 'text-slate-600'
                  }`}>
                    {mode.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Preferences */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">Preferences</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-4">
                  <Zap className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Auto-scan pages</p>
                    <p className="text-xs text-slate-500 mt-0.5">Automatically detect job descriptions</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoScan}
                  onChange={(e) => onSettingsChange({ autoScan: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-4">
                  <Bell className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Notifications</p>
                    <p className="text-xs text-slate-500 mt-0.5">Show scan completion alerts</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showNotifications}
                  onChange={(e) => onSettingsChange({ showNotifications: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
              </label>
            </div>
          </div>

          </>
          )}

          {activeTab === 'llm' && (
            <>
              {/* Add New Config Button */}
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full p-5 border-2 border-dashed border-brand-300 rounded-xl hover:border-brand-500 hover:bg-brand-50 transition-all flex items-center justify-center gap-2 text-brand-600 font-semibold"
                >
                  <Zap className="w-5 h-5" />
                  Add New Configuration
                </button>
              )}

              {/* Add Form */}
              {showAddForm && (
                <div className="glass-card p-6 space-y-5 border-brand-200">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-bold text-slate-900">New Configuration</h3>
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

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Configuration Name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., OpenAI GPT-4 Production"
                        className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                      />
                    </div>

                    {/* Provider */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Provider
                      </label>
                      <select
                        value={formData.provider}
                        onChange={(e) => handleProviderChange(e.target.value)}
                        className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
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
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Model
                      </label>
                      
                      {formData.provider === 'openrouter' && openRouterModels.length > 0 ? (
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
                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                  {option.id}
                                </p>
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
                      ) : (
                        <select
                          value={formData.model}
                          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                        >
                          {availableModels.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      )}
                      
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
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
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
                            setTestResult(null); // Clear test result when API key changes
                            
                            // Auto-fetch OpenRouter models when API key is entered
                            if (formData.provider === 'openrouter' && newApiKey.startsWith('sk-or-v1-')) {
                              handleFetchOpenRouterModels(newApiKey);
                            }
                          }}
                          placeholder="sk-..."
                          className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5">Your API key is encrypted and stored securely</p>
                    </div>

                    {/* Test Connection Button */}
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testing || !formData.provider || !formData.model || !formData.apiKey}
                      className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {testing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Testing Connection...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Test Connection
                        </>
                      )}
                    </button>

                    {/* Test Result */}
                    {testResult && (
                      <div className={`flex items-center gap-2 p-3 border rounded-lg ${
                        testResult.success
                          ? 'bg-green-50 border-green-200'
                          : 'bg-amber-50 border-amber-200'
                      }`}>
                        {testResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <p className={`text-xs ${
                          testResult.success ? 'text-green-700' : 'text-amber-700'
                        }`}>
                          {testResult.message}
                        </p>
                      </div>
                    )}

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
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900">Saved Configurations</h3>
                
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
                      className="glass-card p-5 flex items-center justify-between hover:shadow-lg transition-all"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h4 className="text-base font-bold text-slate-800">{config.name}</h4>
                          {config.isActive && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span className="font-medium">{LLM_PROVIDERS.find(p => p.value === config.provider)?.label}</span>
                          <span>•</span>
                          <span>{config.model}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleActive(config.id, config.isActive)}
                          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                            config.isActive
                              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                          }`}
                        >
                          {config.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(config.id)}
                          className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
