/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Monitor, Moon, Sun, Layout, Layers, Bell, Zap, Cpu, Key, CheckCircle2, AlertCircle, Loader2, Power, Trash2, Sparkles, Shield, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { loadSettings, saveSettings, UserSettings, DEFAULT_SETTINGS, applyColorMode } from '../../utils/settings';
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
} from '../../utils/api';
import SearchableDropdown, { DropdownOption } from '../../components/SearchableDropdown';

export default function App() {
  const [activeTab, setActiveTab] = useState<'general' | 'llm'>('general');
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
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
    loadSettings().then((loaded) => {
      setSettings(loaded);
      applyColorMode(loaded.colorMode);
    });

    const messageListener = (msg: any) => {
      if (msg.type === "SETTINGS_UPDATED") {
        setSettings(msg.settings);
        applyColorMode(msg.settings.colorMode);
      }
    };

    chrome.runtime?.onMessage.addListener(messageListener);
    return () => chrome.runtime?.onMessage.removeListener(messageListener);
  }, []);


  useEffect(() => {
    if (activeTab === 'llm') {
      loadConfigs();
    }
  }, [activeTab]);

  const loadConfigs = async () => {
    setLoading(true);
    const data = await fetchLLMConfigs();
    setConfigs(data);
    setLoading(false);
  };

  const handleSettingsChange = async (newSettings: Partial<UserSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    if (newSettings.colorMode) {
      applyColorMode(newSettings.colorMode);
    }
    await saveSettings(newSettings);
  };

  const handleProviderChange = (provider: string) => {
    const models = getModelsForProvider(provider);
    setFormData({
      ...formData,
      provider,
      model: models[0] || '',
    });
    setTestResult(null);
    setOpenRouterModels([]);
  };

  const handleFetchOpenRouterModels = async (apiKey: string) => {
    if (!apiKey || !apiKey.startsWith('sk-or-v1-')) return;

    setFetchingModels(true);
    setFormError('');
    const result = await fetchOpenRouterModels(apiKey);
    setFetchingModels(false);

    if (result.success && result.models) {
      setOpenRouterModels(result.models);
    } else {
      const errorMessage = typeof result.error === 'string' ? result.error : 'Failed to fetch models';
      setFormError(errorMessage);
    }
  };

  const handleModelSearch = async (query: string): Promise<DropdownOption[]> => {
    if (formData.provider === 'openrouter') {
      if (openRouterModels.length === 0) return [];

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

    const models = getModelsForProvider(formData.provider);
    const filtered = models.filter(model =>
      model.toLowerCase().includes(query.toLowerCase())
    );

    return filtered.map(model => ({ id: model, name: model }));
  };

  const handleTestConnection = async () => {
    setFormError('');
    setTestResult(null);

    if (!formData.provider || !formData.model || !formData.apiKey) {
      setFormError('Fill in provider, model, and API key to test');
      return;
    }

    setTesting(true);
    const result = await testLLMConnection(formData.provider, formData.model, formData.apiKey);
    setTesting(false);
    setTestResult(result);

    if (!result.success) setFormError(result.message || 'Connection test failed');
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
      setFormSuccess('Configuration saved!');
      setFormData({ name: '', provider: 'openai', model: '', apiKey: '', isActive: true });
      setTimeout(() => {
        setShowAddForm(false);
        setFormSuccess('');
        loadConfigs();
      }, 1500);
    } else {
      setFormError(result.error || 'Failed to save');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const result = await updateLLMConfig(id, { isActive: !currentStatus });
    if (result.success) loadConfigs();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) return;
    const result = await deleteLLMConfig(id);
    if (result.success) loadConfigs();
  };

  const goBack = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-400/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-400/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={goBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-card rounded-xl transition-all mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl shadow-lg">
              <Layout className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-foreground">
                Settings
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Customize your JD Scan experience</p>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-card rounded-3xl shadow-xl overflow-hidden border border-border/50">
          {/* Tabs */}
          <div className="flex gap-2 px-8 pt-6 bg-muted/30 border-b border-border/50">
            <button
              onClick={() => setActiveTab('general')}
              className={`relative flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-t-xl transition-all ${
                activeTab === 'general'
                  ? 'bg-background text-brand-600 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <Layout className="w-4 h-4" />
              General
              {activeTab === 'general' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('llm')}
              className={`relative flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-t-xl transition-all ${
                activeTab === 'llm'
                  ? 'bg-background text-brand-600 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <Cpu className="w-4 h-4" />
              LLM API
              {activeTab === 'llm' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600"
                />
              )}
            </button>
          </div>

          {/* Content */}
          <div className="min-h-[600px]">
            <AnimatePresence mode="wait">
              {activeTab === 'general' ? (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-8 space-y-8"
                >
                  {/* Display Mode */}
                  <section>
                    <div className="flex items-center gap-2 mb-5">
                      <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
                        <Layout className="w-4 h-4 text-brand-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-foreground">Display Mode</h3>
                        <p className="text-xs text-muted-foreground">Choose how JD Scan appears</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { id: 'sidebar', label: 'Sidebar Panel', desc: 'Docked to browser side', icon: Layout },
                        { id: 'overlay', label: 'Floating Button', desc: 'Minimal overlay on pages', icon: Layers },
                      ].map((mode) => (
                        <motion.button
                          key={mode.id}
                          onClick={() => handleSettingsChange({ displayMode: mode.id as any })}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`relative p-6 rounded-2xl border-2 transition-all text-left overflow-hidden ${
                            settings.displayMode === mode.id
                              ? 'border-brand-500 bg-gradient-to-br from-brand-50/50 to-purple-50/50 dark:from-brand-900/20 dark:to-purple-900/20 shadow-lg'
                              : 'border-border hover:border-brand-300 hover:bg-muted/50'
                          }`}
                        >
                          {settings.displayMode === mode.id && (
                            <div className="absolute top-3 right-3">
                              <div className="p-1 bg-brand-500 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-white" />
                              </div>
                            </div>
                          )}
                          <mode.icon className={`w-8 h-8 mb-3 ${
                            settings.displayMode === mode.id ? 'text-brand-600' : 'text-muted-foreground'
                          }`} />
                          <p className={`text-sm font-bold mb-1 ${
                            settings.displayMode === mode.id ? 'text-brand-700 dark:text-brand-400' : 'text-foreground'
                          }`}>
                            {mode.label}
                          </p>
                          <p className="text-xs text-muted-foreground">{mode.desc}</p>
                        </motion.button>
                      ))}
                    </div>
                  </section>

                  {/* Appearance */}
                  <section>
                    <div className="flex items-center gap-2 mb-5">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <Sun className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-foreground">Appearance</h3>
                        <p className="text-xs text-muted-foreground">Select your theme preference</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'light', label: 'Light', icon: Sun },
                        { id: 'dark', label: 'Dark', icon: Moon },
                        { id: 'auto', label: 'System', icon: Monitor },
                      ].map((mode) => (
                        <motion.button
                          key={mode.id}
                          onClick={() => handleSettingsChange({ colorMode: mode.id as any })}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`p-5 rounded-xl border-2 transition-all ${
                            settings.colorMode === mode.id
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md'
                              : 'border-border hover:border-purple-300 hover:bg-muted/50'
                          }`}
                        >
                          <mode.icon className={`w-6 h-6 mx-auto mb-2 ${
                            settings.colorMode === mode.id ? 'text-purple-600' : 'text-muted-foreground'
                          }`} />
                          <p className={`text-xs font-bold ${
                            settings.colorMode === mode.id ? 'text-purple-700 dark:text-purple-400' : 'text-muted-foreground'
                          }`}>
                            {mode.label}
                          </p>
                        </motion.button>
                      ))}
                    </div>
                  </section>

                  {/* Preferences */}
                  <section>
                    <div className="flex items-center gap-2 mb-5">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-foreground">Preferences</h3>
                        <p className="text-xs text-muted-foreground">Customize behavior</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { id: 'autoScan', label: 'Auto-scan pages', desc: 'Automatically detect job descriptions', icon: Zap },
                        { id: 'showNotifications', label: 'Notifications', desc: 'Show scan completion alerts', icon: Bell },
                      ].map((pref) => (
                        <label
                          key={pref.id}
                          className="flex items-center justify-between p-4 bg-muted/50 hover:bg-muted rounded-xl cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-background rounded-lg shadow-sm border border-border group-hover:border-brand-200 transition-colors">
                              <pref.icon className="w-4 h-4 text-muted-foreground group-hover:text-brand-600" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{pref.label}</p>
                              <p className="text-xs text-muted-foreground">{pref.desc}</p>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={(settings as any)[pref.id]}
                            onChange={(e) => handleSettingsChange({ [pref.id]: e.target.checked })}
                            className="w-5 h-5 rounded-lg border-border text-brand-600 focus:ring-brand-500 transition-all bg-background"
                          />
                        </label>
                      ))}
                    </div>
                  </section>

                  {/* LLM Config Selection */}
                  <section>
                    <div className="flex items-center gap-2 mb-5">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <Cpu className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-foreground">AI Model for Scanning</h3>
                        <p className="text-xs text-muted-foreground">Select which LLM to use for ATS analysis</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {configs.length === 0 ? (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-amber-900 dark:text-amber-400">No LLM configurations found</p>
                              <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                                Add an LLM API configuration in the "LLM API" tab to enable AI-powered scanning.
                              </p>
                              <button
                                onClick={() => setActiveTab('llm')}
                                className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 underline"
                              >
                                Go to LLM API settings →
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {configs.map((config) => (
                            <label
                              key={config.id}
                              className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border-2 ${
                                settings.selectedLLMConfigId === config.id
                                  ? 'bg-gradient-to-br from-brand-50/50 to-purple-50/50 dark:from-brand-900/20 dark:to-purple-900/20 border-brand-300 shadow-md'
                                  : 'bg-muted/50 hover:bg-muted border-border hover:border-brand-300/50'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${
                                  settings.selectedLLMConfigId === config.id
                                    ? 'bg-brand-100 dark:bg-brand-900/40'
                                    : 'bg-background border border-border'
                                }`}>
                                  <Cpu className={`w-4 h-4 ${
                                    settings.selectedLLMConfigId === config.id
                                      ? 'text-brand-600'
                                      : 'text-muted-foreground'
                                  }`} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold text-foreground">{config.name}</p>
                                    {config.isActive && (
                                      <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[9px] font-black rounded uppercase">
                                        Active
                                      </span>
                                    )}
                                    {!config.isActive && (
                                      <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[9px] font-black rounded uppercase">
                                        Inactive
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {config.provider} • {config.model}
                                  </p>
                                </div>
                              </div>
                              <input
                                type="radio"
                                name="selectedLLMConfig"
                                checked={settings.selectedLLMConfigId === config.id}
                                onChange={() => handleSettingsChange({ selectedLLMConfigId: config.id })}
                                className="w-5 h-5 text-brand-600 focus:ring-brand-500 bg-background"
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </motion.div>
              ) : (
                <motion.div
                  key="llm"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-8 space-y-6"
                >
                  {/* Header with Add Button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-brand-100 to-purple-100 dark:from-brand-900/30 dark:to-purple-900/30 rounded-xl">
                        <Cpu className="w-5 h-5 text-brand-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-foreground">API Configurations</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {configs.length === 0 
                            ? 'No configurations yet' 
                            : `${configs.length} configuration${configs.length > 1 ? 's' : ''} • ${configs.filter(c => c.isActive).length} active`
                          }
                        </p>
                      </div>
                    </div>
                    {!showAddForm && (
                      <motion.button
                        onClick={() => setShowAddForm(true)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-5 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Add Configuration
                      </motion.button>
                    )}
                  </div>

                  {/* Add Form */}
                  <AnimatePresence>
                    {showAddForm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 bg-gradient-to-br from-muted/50 to-brand-50/10 dark:to-brand-900/10 border-2 border-brand-200 dark:border-brand-900 rounded-2xl space-y-5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-brand-600 rounded-lg">
                                <Sparkles className="w-4 h-4 text-white" />
                              </div>
                              <h4 className="text-base font-bold text-foreground">New API Configuration</h4>
                            </div>
                            <button
                              onClick={() => {
                                setShowAddForm(false);
                                setFormError('');
                                setFormSuccess('');
                                setTestResult(null);
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground font-semibold px-3 py-1.5 hover:bg-background/50 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>

                          <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">Configuration Name</label>
                                <input
                                  type="text"
                                  value={formData.name}
                                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                  placeholder="e.g., Production GPT-4"
                                  className="w-full px-4 py-2.5 text-sm bg-background border-2 border-border rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-foreground"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">Provider</label>
                                <select
                                  value={formData.provider}
                                  onChange={(e) => handleProviderChange(e.target.value)}
                                  className="w-full px-4 py-2.5 text-sm bg-background border-2 border-border rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-foreground"
                                >
                                  {LLM_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">Model</label>
                              <SearchableDropdown
                                value={formData.model}
                                onChange={(m) => setFormData({ ...formData, model: m })}
                                onSearch={handleModelSearch}
                                loading={fetchingModels}
                                placeholder="Search and select a model..."
                                renderOption={(option) => (
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-foreground truncate">{option.name}</p>
                                      {option.id !== option.name && (
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">{option.id}</p>
                                      )}
                                    </div>
                                    {option.metadata && (
                                      <div className="text-right shrink-0">
                                        <p className="text-xs font-medium text-muted-foreground">
                                          {option.metadata.context_length.toLocaleString()} ctx
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">API Key</label>
                              <div className="relative">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                  type="password"
                                  value={formData.apiKey}
                                  onChange={(e) => {
                                    const newApiKey = e.target.value;
                                    setFormData({ ...formData, apiKey: newApiKey });
                                    setTestResult(null);
                                    if (formData.provider === 'openrouter' && newApiKey.startsWith('sk-or-v1-')) {
                                      handleFetchOpenRouterModels(newApiKey);
                                    }
                                  }}
                                  placeholder="sk-..."
                                  className="w-full pl-11 pr-4 py-2.5 text-sm bg-background border-2 border-border rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all font-mono text-foreground"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                                <Shield className="w-3 h-3" />
                                Your API key is encrypted and stored securely
                              </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                              <button
                                type="button"
                                onClick={handleTestConnection}
                                disabled={testing || !formData.provider || !formData.model || !formData.apiKey}
                                className="flex-1 px-4 py-3 bg-background hover:bg-muted border-2 border-border hover:border-muted-foreground/30 text-foreground text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                Test Connection
                              </button>
                              <button
                                type="submit"
                                disabled={submitting || !formData.name || !formData.provider || !formData.model || !formData.apiKey}
                                className="flex-[2] px-4 py-3 bg-gradient-to-r from-brand-600 to-brand-500 hover:shadow-lg text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Save Configuration
                              </button>
                            </div>

                            {testResult && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`p-4 rounded-xl text-sm font-medium flex items-start gap-3 ${
                                  testResult.success 
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-2 border-emerald-200 dark:border-emerald-800' 
                                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-2 border-amber-200 dark:border-amber-800'
                                }`}
                              >
                                {testResult.success ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                                <div className="flex-1">
                                  <p className="font-bold">{testResult.success ? 'Connection Successful!' : 'Connection Failed'}</p>
                                  <p className="text-xs mt-1 opacity-90">{testResult.message}</p>
                                </div>
                              </motion.div>
                            )}

                            {formError && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 rounded-xl text-sm font-medium flex items-start gap-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-2 border-red-200 dark:border-red-800"
                              >
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-bold">Error</p>
                                  <p className="text-xs mt-1 opacity-90">{formError}</p>
                                </div>
                              </motion.div>
                            )}

                            {formSuccess && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 rounded-xl text-sm font-medium flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-2 border-emerald-200 dark:border-emerald-800"
                              >
                                <CheckCircle2 className="w-5 h-5" />
                                {formSuccess}
                              </motion.div>
                            )}
                          </form>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Configs List */}
                  <div className="space-y-3">
                    {loading ? (
                      <div className="flex justify-center py-16">
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 text-brand-600 animate-spin mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">Loading configurations...</p>
                        </div>
                      </div>
                    ) : configs.length === 0 ? (
                      <div className="text-center py-16 bg-gradient-to-br from-muted/50 to-background rounded-2xl border-2 border-dashed border-border">
                        <div className="p-5 bg-muted rounded-2xl w-fit mx-auto mb-4 shadow-sm">
                          <Cpu className="w-10 h-10 text-muted-foreground/30" />
                        </div>
                        <h4 className="text-base font-bold text-foreground mb-2">No API Configurations</h4>
                        <p className="text-sm text-muted-foreground px-8 mb-6 max-w-md mx-auto">
                          Add your first AI provider configuration to start using AI-powered resume analysis
                        </p>
                        <button
                          onClick={() => setShowAddForm(true)}
                          className="px-6 py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all inline-flex items-center gap-2"
                        >
                          <Sparkles className="w-4 h-4" />
                          Add Your First Configuration
                        </button>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {configs.map((config, idx) => (
                          <motion.div
                            key={config.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`group relative flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${
                              config.isActive
                                ? 'bg-gradient-to-br from-background to-brand-50/10 dark:to-brand-900/10 border-brand-200 dark:border-brand-900/50 hover:border-brand-300 hover:shadow-lg'
                                : 'bg-background border-border hover:border-muted-foreground/30 hover:shadow-md'
                            }`}
                          >
                            {/* Active Indicator */}
                            {config.isActive && (
                              <div className="absolute top-3 right-3">
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 rounded-full">
                                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                  <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">Active</span>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                              <div className={`p-3.5 rounded-xl border-2 ${
                                config.isActive 
                                  ? 'bg-gradient-to-br from-brand-100 to-purple-100 dark:from-brand-900/40 dark:to-purple-900/40 border-brand-200 dark:border-brand-900/50' 
                                  : 'bg-muted/30 border-border'
                              }`}>
                                <Cpu className={`w-6 h-6 ${config.isActive ? 'text-brand-600' : 'text-muted-foreground'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-base font-bold text-foreground truncate mb-1">{config.name}</h4>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs font-semibold rounded-md">
                                    {LLM_PROVIDERS.find(p => p.value === config.provider)?.label || config.provider}
                                  </span>
                                  <span className="text-muted-foreground/30">•</span>
                                  <span className="text-xs text-muted-foreground font-medium truncate max-w-[200px]">{config.model}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleToggleActive(config.id, config.isActive)}
                                className={`p-2.5 rounded-lg transition-all ${
                                  config.isActive 
                                    ? 'text-muted-foreground hover:text-foreground hover:bg-muted' 
                                    : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600'
                                }`}
                                title={config.isActive ? "Deactivate" : "Activate"}
                              >
                                <Power className="w-4.5 h-4.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(config.id)}
                                className="p-2.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                title="Delete"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );

}
