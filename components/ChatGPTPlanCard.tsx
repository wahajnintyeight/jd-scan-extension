import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, LogOut, RefreshCw, Sparkles } from 'lucide-react';
import {
  ChatGPTPlanModel,
  ChatGPTPlanStatus,
  connectChatGPTPlan,
  disconnectChatGPTPlan,
  fetchChatGPTPlanModels,
  getChatGPTPlanPreferences,
  getChatGPTPlanStatus,
  saveChatGPTPlanPreferences,
  switchChatGPTPlanAccount,
} from '../utils/chatgptPlan';

interface ChatGPTPlanCardProps {
  onChanged?: () => void | Promise<void>;
}

export default function ChatGPTPlanCard({ onChanged }: ChatGPTPlanCardProps) {
  const [status, setStatus] = useState<ChatGPTPlanStatus | null>(null);
  const [models, setModels] = useState<ChatGPTPlanModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setBusy(true);
    setError('');
    let statusLoaded = false;
    try {
      const nextStatus = await getChatGPTPlanStatus();
      setStatus(nextStatus);
      statusLoaded = true;
      if (nextStatus.connected) {
        const [availableModels, preferences] = await Promise.all([
          fetchChatGPTPlanModels(),
          getChatGPTPlanPreferences(),
        ]);
        setModels(availableModels);
        const preferred = availableModels.find((model) => model.id === preferences.model) || availableModels[0];
        if (preferred) {
          setSelectedModel(preferred.id);
          if (preferred.id !== preferences.model) {
            await saveChatGPTPlanPreferences({ model: preferred.id });
            await onChanged?.();
          }
        }
      } else {
        setModels([]);
      }
    } catch (cause) {
      if (!statusLoaded) setStatus(null);
      setError(cause instanceof Error ? cause.message : 'Could not reach the local ChatGPT helper.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleConnect = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const nextStatus = await connectChatGPTPlan();
      setStatus(nextStatus);
      await load();
      await onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ChatGPT sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await disconnectChatGPTPlan();
      setStatus({ connected: false, registered: true });
      setModels([]);
      setNotice(result.warning || 'ChatGPT disconnected.');
      await onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not disconnect ChatGPT.');
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchAccount = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await switchChatGPTPlanAccount();
      setStatus({ connected: false, registered: false });
      setModels([]);
      setNotice(result.warning || 'Saved ChatGPT account cleared. Continue with ChatGPT to connect another account.');
      await onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not switch ChatGPT accounts.');
    } finally {
      setBusy(false);
    }
  };

  const handleModelChange = async (model: string) => {
    setSelectedModel(model);
    await saveChatGPTPlanPreferences({ model });
    await onChanged?.();
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">Use ChatGPT plan</h4>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Sign in with ChatGPT or keep using an OpenAI API key below. Plan requests go directly to OpenAI; tokens stay in your system keychain.
            </p>
          </div>
        </div>
        {status?.connected && <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" aria-label="Connected" />}
      </div>

      {status?.connected ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">Connected{status.email ? ` as ${status.email}` : ''}</p>
          <label className="block text-xs font-semibold text-foreground">
            ChatGPT model
            <select
              value={selectedModel}
              onChange={(event) => void handleModelChange(event.target.value)}
              disabled={busy || models.length === 0}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
            >
              {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
            </select>
          </label>
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => void load()} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Refresh models
            </button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void handleSwitchAccount()} disabled={busy} className="rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">Switch account</button>
              <button type="button" onClick={() => void handleDisconnect()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                Disconnect
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {!status
                ? 'Requires the JD Scan local helper on this computer.'
                : status.registered
                  ? `Signed out${status.email ? ` from ${status.email}` : ''}.`
                  : 'Not connected.'}
            </p>
            {status?.registered && <button type="button" onClick={() => void handleSwitchAccount()} disabled={busy} className="mt-1 text-xs font-semibold text-muted-foreground hover:text-foreground">Use another account</button>}
          </div>
          <button type="button" onClick={() => void handleConnect()} disabled={busy} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            Continue with ChatGPT
          </button>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{error}</p></div>
          {!status && <p className="mt-2 break-all font-mono">Install on Windows: <code>.\native\chatgpt-host\install-native-host.ps1 -ExtensionId &lt;extension-id&gt;</code></p>}
        </div>
      )}
      {notice && <p role="status" className="mt-3 text-xs text-muted-foreground">{notice}</p>}
    </section>
  );
}
