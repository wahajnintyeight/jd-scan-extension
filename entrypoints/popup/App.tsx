import { ScanLine, FileText, ExternalLink, Zap } from 'lucide-react';

function App() {
  const openSidePanel = () => {
    chrome.windows.getCurrent((window: any) => {
      if (window.id) {
        chrome.sidePanel.open({ windowId: window.id }).catch((e: any) => console.error(e));
      }
    });
  };

  const openCurrentTab = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'SCAN_PAGE' }).catch(() => { });
      }
    });
  };

  return (
    <div className="w-[360px] bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-200">
          <ScanLine className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">JD Scan</h1>
          <p className="text-xs text-brand-600 font-bold uppercase tracking-wider">Quick Actions</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <button
          onClick={openSidePanel}
          className="w-full flex items-center gap-4 p-4 bg-white hover:bg-brand-50 border-2 border-slate-200 hover:border-brand-300 rounded-xl transition-all duration-200 group shadow-sm hover:shadow-md"
        >
          <div className="w-10 h-10 bg-brand-100 group-hover:bg-brand-200 rounded-lg flex items-center justify-center transition-colors">
            <ExternalLink className="w-5 h-5 text-brand-600" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-sm font-bold text-slate-900">Open Dashboard</h3>
            <p className="text-xs text-slate-500">Full analysis & resume manager</p>
          </div>
        </button>

        <button
          onClick={openCurrentTab}
          className="w-full flex items-center gap-4 p-4 bg-white hover:bg-green-50 border-2 border-slate-200 hover:border-green-300 rounded-xl transition-all duration-200 group shadow-sm hover:shadow-md"
        >
          <div className="w-10 h-10 bg-green-100 group-hover:bg-green-200 rounded-lg flex items-center justify-center transition-colors">
            <Zap className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-sm font-bold text-slate-900">Quick Scan</h3>
            <p className="text-xs text-slate-500">Analyze current job page</p>
          </div>
        </button>

        <div className="pt-2 px-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <FileText className="w-3.5 h-3.5" />
            <span>Supports LinkedIn, Indeed & more</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-slate-200">
        <p className="text-xs text-center text-slate-400">
          Click the extension icon to access quick actions
        </p>
      </div>
    </div>
  );
}

export default App;
