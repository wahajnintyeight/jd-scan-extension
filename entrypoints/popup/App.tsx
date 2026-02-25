import { ScanLine, FileText, ExternalLink, Zap, Settings, Sparkles, TrendingUp, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { loadSettings, UserSettings, DEFAULT_SETTINGS, saveSettings, applyColorMode } from '../../utils/settings';

// Mock Chrome API for web preview
const chromeMock = {
  windows: {
    getCurrent: (cb: (win: any) => void) => cb({ id: 1 }),
  },
  sidePanel: {
    open: async (opts: any) => console.log('Mock: Opening side panel', opts),
  },
  tabs: {
    query: (opts: any, cb: (tabs: any[]) => void) => cb([{ id: 1 }]),
    create: async (opts: any) => console.log('Mock: Creating tab', opts),
    sendMessage: async (id: number, msg: any) => console.log('Mock: Sending message to tab', id, msg),
  },
};

// Use real chrome if available, otherwise mock
const _chrome = typeof window !== 'undefined' && (window as any).chrome && (window as any).chrome.runtime ? (window as any).chrome : chromeMock;

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isScanning, setIsScanning] = useState(false);

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

    if (_chrome?.runtime?.onMessage) {
      _chrome.runtime.onMessage.addListener(messageListener);
      return () => _chrome.runtime.onMessage.removeListener(messageListener);
    }
  }, []);

  const handleSettingsChange = async (newSettings: Partial<UserSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    if (newSettings.colorMode) {
      applyColorMode(newSettings.colorMode);
    }
    await saveSettings(newSettings);
  };

  const openSidePanel = () => {
    _chrome.windows.getCurrent((window: any) => {
      if (window?.id) {
        (_chrome.sidePanel as any).open({ windowId: window.id }).catch((error: any) => {
          console.error('Failed to open side panel:', error);
          (_chrome.sidePanel as any).open({}).catch((e: any) => {
            console.error('Failed to open side panel (fallback):', e);
          });
        });
      } else {
        (_chrome.sidePanel as any).open({}).catch((e: any) => {
          console.error('Failed to open side panel (no window):', e);
        });
      }
    });
  };

  const openCurrentTab = () => {
    setIsScanning(true);
    _chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      if (tabs[0]?.id) {
        _chrome.tabs.sendMessage(tabs[0].id, { type: 'SCAN_PAGE' })
          .catch(() => { })
          .finally(() => {
            setTimeout(() => setIsScanning(false), 1500);
          });
      } else {
        setIsScanning(false);
      }
    });
  };

  return (
    <div className="w-[420px] min-h-[580px] bg-background text-foreground overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-400/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-400/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative px-4 pt-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl blur-lg opacity-40" />
              <div className="relative p-2 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl shadow-lg">
                <ScanLine className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-foreground">
                JD Scan
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Active</span>
                </div>
                <span className="text-[10px] text-muted-foreground/30">•</span>
                <span className="text-[10px] font-medium text-muted-foreground">AI-Powered</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => {
              const url = (_chrome as any).runtime.getURL('settings.html');
              (_chrome.tabs as any).create({ url });
            }}
            className="p-2 hover:bg-muted rounded-xl transition-all active:scale-95 group"
          >
            <Settings className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:rotate-90 transition-all duration-300" />
          </button>
        </div>

        {/* Status Banner */}
        <AnimatePresence mode="wait">
          {settings.displayMode === 'overlay' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 p-2 bg-gradient-to-r from-brand-50 to-purple-50 dark:from-brand-900/20 dark:to-purple-900/20 border border-brand-100/50 rounded-lg">
                <div className="p-1 bg-background rounded-lg shadow-sm">
                  <Sparkles className="w-3 h-3 text-brand-600" />
                </div>
                <p className="text-[10px] font-semibold text-foreground/80 leading-tight flex-1">
                  Floating mode enabled on job sites
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="relative px-4 pb-4 space-y-2.5">
        {/* Primary Action - Quick Scan */}
        <motion.button
          onClick={openCurrentTab}
          disabled={isScanning}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="group relative w-full overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-500 to-purple-600" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          {/* Scan Animation Overlay */}
          {isScanning && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            />
          )}

          <div className="relative flex items-center gap-3 p-3.5">
            <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg group-hover:bg-white/30 transition-colors">
              {isScanning ? (
                <Zap className="w-5 h-5 text-white animate-pulse" />
              ) : (
                <Zap className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-sm font-bold text-white mb-0.5">
                {isScanning ? 'Scanning...' : 'Quick Scan'}
              </h3>
              <p className="text-[11px] text-white/80">
                {isScanning ? 'Analyzing job description' : 'Analyze current page instantly'}
              </p>
            </div>
            <div className="p-1.5 bg-white/10 rounded-lg group-hover:translate-x-1 transition-transform">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
        </motion.button>

        {/* Secondary Action - Dashboard */}
        <motion.button
          onClick={openSidePanel}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="group w-full flex items-center gap-3 p-3 bg-card hover:bg-muted border-2 border-border hover:border-brand-300 rounded-xl transition-all shadow-sm hover:shadow-md"
        >
          <div className="p-2 bg-muted group-hover:bg-brand-50 dark:group-hover:bg-brand-900/30 rounded-lg transition-all">
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-brand-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-sm font-bold text-foreground mb-0.5">Dashboard</h3>
            <p className="text-[11px] text-muted-foreground">Full analysis & resume manager</p>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-5 h-5 rounded-lg bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
              <span className="text-[11px] font-bold text-brand-600">→</span>
            </div>
          </div>
        </motion.button>

        {/* Feature Pills */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="flex flex-col items-center gap-1 p-2 bg-card/60 backdrop-blur-sm rounded-lg border border-border/50">
            <div className="p-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-md">
              <Shield className="w-3 h-3 text-emerald-600" />
            </div>
            <span className="text-[9px] font-bold text-muted-foreground">ATS Ready</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 bg-card/60 backdrop-blur-sm rounded-lg border border-border/50">
            <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded-md">
              <TrendingUp className="w-3 h-3 text-blue-600" />
            </div>
            <span className="text-[9px] font-bold text-muted-foreground">AI Match</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 bg-card/60 backdrop-blur-sm rounded-lg border border-border/50">
            <div className="p-1 bg-purple-100 dark:bg-purple-900/30 rounded-md">
              <Sparkles className="w-3 h-3 text-purple-600" />
            </div>
            <span className="text-[9px] font-bold text-muted-foreground">Smart Tips</span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-border/50">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3 h-3 text-muted-foreground/40" />
            <span className="text-[9px] font-medium text-muted-foreground/60">LinkedIn • Indeed • Glassdoor</span>
          </div>
          <span className="text-[9px] font-bold text-muted-foreground/40">v1.2.0</span>
        </div>
      </main>
    </div>
  );
}
