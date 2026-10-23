import React, { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import SettingsModal from './SettingsModal';
import FloatingOverlay from './FloatingOverlay';
import { DEFAULT_SETTINGS } from '../utils/settings';

// Development wrapper: the preview host supplies an in-memory chrome API and synthetic responses.
export default function SettingsModalPreview() {
  const [open, setOpen] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  return <>
    <FloatingOverlay onClose={() => {}} onOpenSettings={() => setOpen(true)}>
      <div className="p-4 text-sm space-y-3">
        <h1 className="font-display text-lg">Settings preview</h1>
        <p>Synthetic data only. No configurations or API keys are saved.</p>
        <button className="btn-primary" onClick={() => setOpen(true)}>Open settings</button>
      </div>
    </FloatingOverlay>
    <SettingsModal isOpen={open} onClose={() => setOpen(false)} settings={settings}
      onSettingsChange={change => setSettings(current => ({ ...current, ...change }))} />
  </>;
}

const states = ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'error', 'success'] as const;

export function SettingsStatePreview() {
  return <main className="jd-settings settings-states-preview">
    <style>{`
      .settings-states-preview { padding: var(--jd-space-4); max-width: 640px; }
      .settings-states-preview h1 { font-size: var(--jd-text-title); margin-bottom: var(--jd-space-4); }
      .settings-states-preview section { display: grid; gap: var(--jd-space-2); margin-bottom: var(--jd-space-4); }
      .settings-states-preview button { width: 100%; }
      .settings-states-preview .is-hover { background: oklch(var(--jd-primary) / .9); }
      .settings-states-preview .is-focus { outline: 2px solid oklch(var(--jd-ring)); outline-offset: 2px; }
      .settings-states-preview .is-active { filter: brightness(.96); }
      .settings-states-preview .is-error { background: oklch(var(--jd-card)); color: oklch(var(--jd-foreground)); border-color: oklch(var(--jd-destructive)); }
      .settings-states-preview p { font-size: var(--jd-text-caption); }
    `}</style>
    <h1>Settings controls · eight states</h1>
    {states.map(state => <section key={state} aria-label={state}>
      <h2>{state}</h2>
      <button className={`btn-primary is-${state}`} disabled={state === 'disabled'} aria-busy={state === 'loading'}>
        {state === 'loading' && <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />}
        {state === 'success' && <CheckCircle2 aria-hidden="true" className="w-4 h-4" />}
        {state === 'loading' ? 'Testing connection' : state === 'error' ? 'Try connection again' : state === 'success' ? 'Connection successful' : 'Test connection'}
      </button>
      {state === 'error' && <p role="alert">The API key was rejected. Check the complete key and try again.</p>}
      {state === 'success' && <p role="status">The selected configuration is ready.</p>}
    </section>)}
  </main>;
}
