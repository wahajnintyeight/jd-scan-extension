import { ScanLine, ExternalLink, Settings, ArrowUpRight, Loader2, Bot, PanelRight, PanelsTopLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { loadSettings, UserSettings, DEFAULT_SETTINGS, applyColorMode } from '../../utils/settings';
import { getActiveBrowserTab, sendBrowserTabMessage } from '../../utils/browserTabs';

const chromeMock = {
  windows: { WINDOW_ID_CURRENT: -2 },
  sidePanel: { open: async (_opts: unknown) => {} },
  tabs: {
    create: async (_opts: unknown) => {},
  },
  runtime: { getURL: (path: string) => path },
};
const _chrome = typeof chrome !== 'undefined' && chrome.runtime ? chrome : chromeMock;

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isScanning, setIsScanning] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);

  useEffect(() => {
    loadSettings().then((loaded) => {
      setSettings(loaded);
      applyColorMode(loaded.colorMode);
    });
    const messageListener = (msg: { type: string; settings: UserSettings }) => {
      if (msg.type === 'SETTINGS_UPDATED') {
        setSettings(msg.settings);
        applyColorMode(msg.settings.colorMode);
      }
    };
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
      return () => chrome.runtime.onMessage.removeListener(messageListener);
    }
  }, []);

  const openDashboardTab = () => {
    _chrome.tabs.create({ url: _chrome.runtime.getURL('sidepanel.html') }).catch(() => {
      setFeedback({ error: true, text: 'Could not open the dashboard. Please try again.' });
    });
  };

  const openSidePanel = () => {
    setFeedback(null);
    try {
      _chrome.sidePanel.open({ windowId: _chrome.windows.WINDOW_ID_CURRENT }).catch(openDashboardTab);
    } catch {
      openDashboardTab();
    }
  };

  const sendToPage = async (type: 'SCAN_PAGE' | 'FORCE_SHOW_BUTTON') => {
    setFeedback(null);
    if (type === 'SCAN_PAGE') setIsScanning(true);
    try {
      const tab = await getActiveBrowserTab();
      const response = await sendBrowserTabMessage(tab.id, { type });
      if (type === 'SCAN_PAGE') {
        setFeedback({ error: !response?.success, text: response?.message || 'No job description found on this page.' });
      }
    } catch (error) {
      setFeedback({ error: true, text: error instanceof Error ? error.message : 'Open a website tab and refresh it, then try again.' });
    } finally {
      setIsScanning(false);
    }
  };

  const floating = settings.displayMode === 'overlay';
  return (
    <div className="popup-workbench bg-background text-foreground">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <ScanLine aria-hidden="true" className="h-6 w-6 shrink-0 text-primary" />
          <div>
            <h1 className="font-display text-base font-bold tracking-tight">JD Scan</h1>
            <p className="text-xs text-muted-foreground">Application workspace</p>
          </div>
        </div>
        <button onClick={() => { _chrome.tabs.create({ url: _chrome.runtime.getURL('settings.html') }).catch(() => setFeedback({ error: true, text: 'Could not open settings. Please try again.' })); }} className="popup-icon-button" aria-label="Open settings" title="Settings">
          <Settings aria-hidden="true" className="h-4 w-4" />
        </button>
      </header>

      <main className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-muted-foreground">Current page</span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {floating ? <PanelsTopLeft aria-hidden="true" className="h-3.5 w-3.5" /> : <PanelRight aria-hidden="true" className="h-3.5 w-3.5" />}
            {floating ? 'Floating view' : 'Side panel'}
          </span>
        </div>
        <button onClick={() => floating ? void sendToPage('FORCE_SHOW_BUTTON') : openSidePanel()} className="btn-primary w-full justify-start gap-3 px-3.5 py-3 text-left">
          <Bot aria-hidden="true" className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm">Open assistant</span>
            <span className="mt-0.5 block text-xs font-normal">Work through an application</span>
          </span>
          <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => void sendToPage('SCAN_PAGE')} disabled={isScanning} aria-busy={isScanning} className="popup-utility">
            {isScanning ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-primary" /> : <ScanLine aria-hidden="true" className="h-4 w-4 text-primary" />}
            <span>{isScanning ? 'Scanning…' : 'Scan job page'}</span>
          </button>
          <button onClick={openSidePanel} className="popup-utility">
            <ExternalLink aria-hidden="true" className="h-4 w-4 text-primary" />
            <span>Dashboard</span>
          </button>
        </div>
        {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`rounded-md border p-2.5 text-xs ${feedback.error ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-border bg-muted text-foreground'}`}>{feedback.text}</p>}
        {!floating && <button onClick={() => void sendToPage('FORCE_SHOW_BUTTON')} className="popup-utility w-full">Open floating view on this page <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></button>}
      </main>
    </div>
  );
}
