import { useEffect, useId, useState } from 'react';
import { applicationNameKey, loadApplicationName, saveApplicationName } from '../../utils/applicationName';

export default function ApplicationNameForm({ resumeId }: { resumeId: string }) {
  const id = useId();
  const [name, setName] = useState({ firstName: '', lastName: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadApplicationName(resumeId).then(saved => {
      if (!cancelled) setName(saved || { firstName: '', lastName: '' });
    }).catch(() => { if (!cancelled) setError('Could not load your saved name.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [resumeId]);

  return (
    <details className="agent-section">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">Name for application forms</summary>
      <p className="mt-2 text-xs text-muted-foreground">Confirm how to split your name for the selected resume. This saves it on this device for first and last name fields.</p>
      <form className="mt-3 space-y-3" onSubmit={async event => {
        event.preventDefault();
        setSaving(true); setError(''); setMessage('');
        try { await saveApplicationName(resumeId, name); setMessage('Name saved for this resume.'); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your name.'); }
        finally { setSaving(false); }
      }}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(['firstName', 'lastName'] as const).map(part => (
            <div key={part}>
              <label htmlFor={`${id}-${part}`} className="mb-1 block text-sm text-foreground">{part === 'firstName' ? 'First name' : 'Last name'}</label>
              <input id={`${id}-${part}`} value={name[part]} required maxLength={100} disabled={loading || saving} autoComplete={part === 'firstName' ? 'given-name' : 'family-name'} className="w-full rounded-lg border border-border p-2.5 text-foreground" onChange={event => { setName({ ...name, [part]: event.target.value }); setMessage(''); }} />
            </div>
          ))}
        </div>
        <button type="submit" disabled={loading || saving} aria-busy={saving} className="btn-secondary w-full">{saving ? 'Saving…' : 'Save application name'}</button>
        <button type="button" disabled={loading || saving} className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={async () => {
          setSaving(true); setError(''); setMessage('');
          try { await chrome.storage.local.remove(applicationNameKey(resumeId)); setName({ firstName: '', lastName: '' }); setMessage('Saved name cleared. Names will come from your resume.'); }
          catch { setError('Could not clear your saved name.'); }
          finally { setSaving(false); }
        }}>Use resume name instead</button>
        {message && <p role="status" className="text-xs text-accent-foreground">{message}</p>}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </form>
    </details>
  );
}
