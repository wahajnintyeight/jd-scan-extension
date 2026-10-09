import { useEffect, useMemo, useState } from 'react';
import { Bot, Clipboard, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { createLLMChatCompletion } from '../utils/api';
import type { LLMAPIConfig } from '../utils/api';
import { buildApplicationAgentMessages, buildApplicationFormMessages, parseApplicationFormAnswers } from '../utils/llmAgent';
import type { ApplicationAgentAction } from '../utils/llmAgent';
import type { ApplicationFormField, JobData, Resume } from './sidepanel/types';

interface ApplicationAgentProps {
  jobData: JobData;
  selectedResumes: Resume[];
  llmConfigs: LLMAPIConfig[];
  selectedLLMConfigId?: string;
  onConfigureProviders: () => void;
}

const ACTIONS: Array<{ id: ApplicationAgentAction; label: string }> = [
  { id: 'cover-letter', label: 'Draft a cover letter' },
  { id: 'resume-summary', label: 'Tailor my summary' },
  { id: 'resume-bullets', label: 'Improve experience bullets' },
  { id: 'application-answer', label: 'Answer an application question' },
  { id: 'interview-prep', label: 'Prepare for an interview' },
  { id: 'custom', label: 'Custom request' },
];

const MAX_APPLICATION_STEPS = 8; // shortcut: cap one run at 8 steps, raise after observing real multi-step flows.
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const formSignature = (fields: ApplicationFormField[]) => fields.map((field) => `${field.type}:${field.label}`).join('|');

export default function ApplicationAgent({ jobData, selectedResumes, llmConfigs, selectedLLMConfigId, onConfigureProviders }: ApplicationAgentProps) {
  const activeConfigs = useMemo(() => llmConfigs.filter((config) => config.isActive), [llmConfigs]);
  const [configId, setConfigId] = useState(selectedLLMConfigId || '');
  const [action, setAction] = useState<ApplicationAgentAction>('cover-letter');
  const [request, setRequest] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);
  const [formFields, setFormFields] = useState<ApplicationFormField[]>([]);
  const [formTabId, setFormTabId] = useState<number | null>(null);
  const [scanningForm, setScanningForm] = useState(false);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [draftFieldId, setDraftFieldId] = useState<string | null>(null);

  useEffect(() => {
    if (activeConfigs.some((config) => config.id === configId)) return;
    setConfigId(activeConfigs.find((config) => config.id === selectedLLMConfigId)?.id || activeConfigs[0]?.id || '');
  }, [activeConfigs, configId, selectedLLMConfigId]);

  useEffect(() => {
    setOutput('');
    setDraftFieldId(null);
    setFormFields([]);
    setFormTabId(null);
  }, [jobData.jd, selectedResumes[0]?.id]);

  const openJobLink = async () => {
    setError('');
    try {
      const url = new URL(jobUrl.trim());
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Use an http or https job link.');
      if (typeof chrome === 'undefined' || !chrome.tabs?.create) throw new Error('Open this from the browser extension to use job links.');
      await chrome.tabs.create({ url: url.toString() });
      setStatus('Job page opened. JD Scan will capture its description when the page supports extraction.');
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Could not open this link.');
    }
  };

  const generate = async (draft?: { action: ApplicationAgentAction; request: string; fieldId?: string }) => {
    const resume = selectedResumes[0];
    if (!resume || !jobData.jd || !configId || working) return;
    const requestedAction = draft?.action || action;
    const requestText = draft?.request ?? request;
    if ((requestedAction === 'application-answer' || requestedAction === 'custom') && !requestText.trim()) {
      setError(requestedAction === 'custom' ? 'Describe what you want the agent to do.' : 'Paste the application question first.');
      return;
    }

    setWorking(true);
    setError('');
    setStatus('');
    setOutput('');
    setDraftFieldId(draft?.fieldId || null);
    const result = await createLLMChatCompletion(configId, buildApplicationAgentMessages({
      action: requestedAction,
      resume: resume.content,
      jobDescription: jobData.jd,
      jobTitle: jobData.title,
      company: jobData.company,
      request: requestText,
    }));
    setWorking(false);
    if (result.success && result.text) setOutput(result.text);
    else setError(result.error || 'The agent could not generate a response.');
  };

  const scanApplicationForm = async () => {
    setError('');
    setStatus('');
    setScanningForm(true);
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id) throw new Error('Could not find the active application tab.');
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_APPLICATION_FIELDS' });
      if (!response?.success) throw new Error(response?.error || 'Could not read application fields on this page.');
      const fields = (response.fields || []) as ApplicationFormField[];
      setFormFields(fields);
      setFormTabId(tab.id);
      const blocked = Number(response.blockedRequiredCount) || 0;
      const truncated = Number(response.truncatedFieldCount) || 0;
      setStatus(fields.length
        ? `Found ${fields.length} supported field${fields.length === 1 ? '' : 's'}${blocked ? `; ${blocked} required item${blocked === 1 ? '' : 's'} need your review` : ''}${truncated ? `; ${truncated} more need manual review` : ''}.`
        : response.applicationContext ? 'Application form found, but no supported fields are available to fill.' : 'No application form detected. Start from a job posting or open the form manually.');
    } catch (scanError) {
      setFormFields([]);
      setFormTabId(null);
      setError(scanError instanceof Error ? scanError.message : 'Could not scan this form.');
    } finally {
      setScanningForm(false);
    }
  };

  const waitForApplicationStep = async (tabId: number, previousUrl: string, previousSignature: string) => {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      await wait(500);
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id !== tabId) throw new Error('Switch back to the application tab to continue.');
      try {
        const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_APPLICATION_FIELDS' });
        if (!response?.success) continue;
        const fields = (response.fields || []) as ApplicationFormField[];
        if (response.applicationContext && (response.url !== previousUrl || formSignature(fields) !== previousSignature)) return response;
      } catch {
        // A new page may need a moment before its content script is ready.
      }
    }
    return null;
  };

  const runApplicationAssistant = async () => {
    const resume = selectedResumes[0];
    if (!resume || !jobData.jd || !configId || automationRunning || working) return;

    setAutomationRunning(true);
    setError('');
    setStatus('Starting the application assistant…');
    setOutput('');
    setDraftFieldId(null);
    setFormFields([]);
    setFormTabId(null);
    let totalFilled = 0;

    try {
      const [initialTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!initialTab?.id) throw new Error('Open the application form in the active tab first.');
      const tabId = initialTab.id;
      let page = await chrome.tabs.sendMessage(tabId, { type: 'GET_APPLICATION_FIELDS' });
      if (!page?.success) throw new Error(page?.error || 'Could not read the application form on this page.');
      if (!page.applicationContext) {
        setStatus('Looking for a clear Apply action on the job posting…');
        const opened = await chrome.tabs.sendMessage(tabId, { type: 'OPEN_APPLICATION_FORM', expectedUrl: page.url });
        if (!opened?.success) throw new Error(opened?.error || 'Could not open the application form.');
        if (!opened.clicked && !opened.alreadyOpen) throw new Error(opened.error || 'Open the application form manually, then run the assistant again.');
        if (!opened.alreadyOpen) {
          page = await waitForApplicationStep(tabId, page.url, formSignature([]));
          if (!page) throw new Error('The application form did not open. Open it manually, then run the assistant again.');
        }
      }
      if (!page.applicationContext) throw new Error('Open the application form before running the assistant.');

      setFormTabId(tabId);
      for (let step = 1; step <= MAX_APPLICATION_STEPS; step++) {
        const fields = (page.fields || []) as ApplicationFormField[];
        const pageUrl = typeof page.url === 'string' ? page.url : '';
        const signature = formSignature(fields);
        setFormFields(fields);

        const emptyFields = fields.filter((field) => !field.value.trim());
        let requiredNeedsUser = false;
        if (emptyFields.length) {
          setStatus(`Reading application step ${step} of ${MAX_APPLICATION_STEPS}…`);
          const result = await createLLMChatCompletion(configId, buildApplicationFormMessages({
            resume: resume.content,
            jobDescription: jobData.jd,
            jobTitle: jobData.title,
            company: jobData.company,
            fields: emptyFields,
          }));
          if (!result.success || !result.text) throw new Error(result.error || 'The provider could not draft answers for this step.');

          const parsed = parseApplicationFormAnswers(result.text, emptyFields);
          requiredNeedsUser = emptyFields.some((field) => field.required && parsed.needsUserIds.includes(field.id));
          if (parsed.answers.length) {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab?.id !== tabId) throw new Error('Switch back to the application tab before the agent fills it.');
            const filled = await chrome.tabs.sendMessage(tabId, {
              type: 'FILL_APPLICATION_FIELDS',
              expectedUrl: pageUrl,
              fields: parsed.answers,
            });
            if (!filled?.success) throw new Error(filled?.error || 'The page changed before the agent could fill it.');
            totalFilled += Number(filled.filled) || 0;
            page = await chrome.tabs.sendMessage(tabId, { type: 'GET_APPLICATION_FIELDS' });
            if (!page?.success) throw new Error('Could not verify the filled fields. The agent stopped before continuing.');
            const refreshedFields = (page.fields || []) as ApplicationFormField[];
            setFormFields(refreshedFields);
            requiredNeedsUser ||= refreshedFields.some((field) => field.required && !field.value.trim());
          }
        }

        if (Number(page.blockedRequiredCount) > 0 || requiredNeedsUser) {
          setStatus(`Filled ${totalFilled} supported field${totalFilled === 1 ? '' : 's'}. A required answer needs your input, so the agent stopped before continuing.`);
          return;
        }
        if (Number(page.truncatedFieldCount) > 0) {
          setStatus(`Filled ${totalFilled} field${totalFilled === 1 ? '' : 's'}. This step has more fields than one run supports; review the remaining fields manually.`);
          return;
        }

        if (step === MAX_APPLICATION_STEPS) {
          setStatus(`Filled ${totalFilled} field${totalFilled === 1 ? '' : 's'}. Reached the ${MAX_APPLICATION_STEPS}-step limit; review the remaining form manually.`);
          return;
        }

        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id !== tabId) throw new Error('Switch back to the application tab to continue.');
        const advance = await chrome.tabs.sendMessage(tabId, { type: 'ADVANCE_APPLICATION_STEP', expectedUrl: pageUrl });
        if (!advance?.success) throw new Error(advance?.error || 'Could not inspect the next application step.');
        if (Number(advance.blockedRequiredCount) > 0) {
          setStatus(`Filled ${totalFilled} field${totalFilled === 1 ? '' : 's'}. A required field needs your input before continuing.`);
          return;
        }
        if (Number(advance.truncatedFieldCount) > 0) {
          setStatus(`Filled ${totalFilled} field${totalFilled === 1 ? '' : 's'}. This step has more fields than one run supports; review the remaining fields manually.`);
          return;
        }
        if (advance.finalActionFound) {
          setStatus(`Filled ${totalFilled} field${totalFilled === 1 ? '' : 's'}. The final review or submission step is ready for you; the agent left it untouched.`);
          return;
        }
        if (!advance.clicked) {
          setStatus(`Filled ${totalFilled} field${totalFilled === 1 ? '' : 's'}. No safe Next or Continue button was found; review this step manually.`);
          return;
        }

        setStatus(`Completed step ${step}; opening the next form step…`);
        const nextPage = await waitForApplicationStep(tabId, pageUrl, signature);
        if (!nextPage) {
          setStatus(`Filled ${totalFilled} field${totalFilled === 1 ? '' : 's'}, but the form did not advance. Check for a validation message and review the page.`);
          return;
        }
        page = nextPage;
      }
    } catch (automationError) {
      setError(automationError instanceof Error ? automationError.message : 'The application assistant stopped unexpectedly.');
    } finally {
      setAutomationRunning(false);
    }
  };

  const fillDraft = async () => {
    if (!draftFieldId || !formTabId || !output) return;
    setError('');
    setStatus('');
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id !== formTabId) throw new Error('Switch back to the application tab before filling this answer.');
      const response = await chrome.tabs.sendMessage(formTabId, {
        type: 'FILL_APPLICATION_FIELD',
        fieldId: draftFieldId,
        value: output,
      });
      if (!response?.success) throw new Error(response?.error || 'Could not fill this field. Scan the form again.');
      setFormFields((current) => current.map((field) => field.id === draftFieldId ? { ...field, value: output } : field));
      setStatus('Answer filled. Review the page; the form has not been submitted.');
    } catch (fillError) {
      setError(fillError instanceof Error ? fillError.message : 'Could not fill this field.');
    }
  };

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setStatus('Draft copied to clipboard. Review it before using it.');
    } catch {
      setError('Clipboard access failed. Select and copy the draft manually.');
    }
  };

  const needsRequest = action === 'application-answer' || action === 'custom';
  const ready = Boolean(selectedResumes.length && jobData.jd && configId && (!needsRequest || request.trim()));
  const canAutomate = Boolean(selectedResumes[0] && jobData.jd && activeConfigs.some((config) => config.id === configId));

  return (
    <section className="space-y-4 animate-in">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-brand-100 dark:bg-brand-900/40 rounded-xl"><Bot className="w-5 h-5 text-brand-600 dark:text-brand-400" /></div>
        <div>
          <h2 className="text-sm font-bold text-foreground">Application Agent</h2>
          <p className="text-[10px] text-muted-foreground">Drafts grounded in your resume and this job</p>
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <label className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground" htmlFor="agent-job-url">Open a job link</label>
        <div className="flex gap-2">
          <input id="agent-job-url" type="url" value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} placeholder="https://company.com/jobs/…" className="min-w-0 flex-1 p-2.5 text-xs bg-muted/50 border border-border rounded-lg outline-none focus:border-brand-400 text-foreground" />
          <button onClick={openJobLink} disabled={!jobUrl.trim()} className="px-3 rounded-lg bg-muted hover:bg-brand-50 dark:hover:bg-brand-900/30 text-brand-700 dark:text-brand-300 disabled:opacity-40" title="Open job link in a new tab" aria-label="Open job link">
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">After the page loads, JD Scan will use its extracted job description when available.</p>
      </div>

      <div className="glass-card p-4 space-y-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5" htmlFor="agent-provider">AI provider and model</label>
          {activeConfigs.length > 0 ? (
            <select id="agent-provider" value={configId} onChange={(event) => setConfigId(event.target.value)} className="w-full p-2.5 text-xs bg-muted/50 border border-border rounded-lg outline-none focus:border-brand-400 text-foreground">
              {activeConfigs.map((config) => <option key={config.id} value={config.id}>{config.name?.trim() || `${config.provider}/${config.model}`} · {config.provider} · {config.model}</option>)}
            </select>
          ) : (
            <button onClick={onConfigureProviders} className="w-full text-left p-3 rounded-lg border border-dashed border-brand-300 text-xs text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20">
              Add an AI provider in Settings
            </button>
          )}
          <p className="text-[10px] text-muted-foreground mt-1.5">Choose any active saved provider. OpenRouter can supply models from multiple AI labs.</p>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5" htmlFor="agent-action">What should the agent do?</label>
          <select id="agent-action" value={action} onChange={(event) => setAction(event.target.value as ApplicationAgentAction)} className="w-full p-2.5 text-xs bg-muted/50 border border-border rounded-lg outline-none focus:border-brand-400 text-foreground">
            {ACTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </div>

        {needsRequest && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5" htmlFor="agent-request">{action === 'custom' ? 'Your request' : 'Application question'}</label>
            <textarea id="agent-request" value={request} onChange={(event) => setRequest(event.target.value)} maxLength={4000} rows={4} placeholder={action === 'custom' ? 'Ask for a tailored response, review, or other job-application help…' : 'Paste the question from the application form…'} className="w-full p-3 text-xs bg-muted/50 border border-border rounded-lg outline-none focus:border-brand-400 resize-y text-foreground" />
          </div>
        )}

        <button onClick={() => void generate()} disabled={!ready || working} className="btn-primary w-full text-xs">
          {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {working ? 'Generating draft…' : 'Generate draft'}
        </button>
        <p className="text-[10px] text-muted-foreground">Automation sends the selected resume, job posting, and supported form questions to your chosen provider. Review every answer before submitting.</p>
      </div>

      <div className="glass-card p-4 space-y-3">
        <div>
          <h3 className="text-xs font-bold text-foreground">Application form</h3>
          <p className="text-[10px] text-muted-foreground mt-1">Run a supervised pass from the job post through its application form.</p>
        </div>
        <button onClick={() => void runApplicationAssistant()} disabled={!canAutomate || scanningForm || automationRunning || working} className="btn-primary w-full text-xs disabled:opacity-50">
          {automationRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {automationRunning ? 'Running application assistant…' : 'Run application assistant'}
        </button>
        <button onClick={scanApplicationForm} disabled={scanningForm || automationRunning} className="w-full flex items-center justify-center gap-2 p-2.5 bg-muted hover:bg-brand-50 dark:hover:bg-brand-900/30 text-xs font-semibold text-foreground rounded-lg disabled:opacity-50">
          {scanningForm ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
          {scanningForm ? 'Scanning page…' : 'Preview supported fields'}
        </button>
        <p className="text-[10px] text-muted-foreground">It opens a clear Apply action, scrolls through supported text and select fields, fills answers grounded in your resume, and advances through clear Next or Continue steps in the same form. It pauses for missing required answers and leaves final review, submission, consent, and file uploads to you.</p>
        {formFields.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {formFields.map((field) => (
              <div key={field.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/70">
                <span className="min-w-0 flex-1 text-[11px] text-foreground line-clamp-2">{field.label}</span>
                {field.value.trim() ? (
                  <span className="shrink-0 text-[9px] text-muted-foreground">Already filled</span>
                ) : (
                  <button onClick={() => { setAction('application-answer'); setRequest(field.label); void generate({ action: 'application-answer', request: field.label, fieldId: field.id }); }} disabled={!selectedResumes.length || !jobData.jd || !configId || working || automationRunning} className="shrink-0 px-2 py-1.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 rounded-md disabled:opacity-40">
                    Draft answer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {draftFieldId && output && (
          <button onClick={fillDraft} disabled={automationRunning} className="btn-secondary w-full text-xs disabled:opacity-50">
            Fill reviewed answer
          </button>
        )}
        <p className="text-[10px] text-muted-foreground">The agent can use resume-stated name, contact details, location, links, and experience. Legal, work-authorization, demographic, medical, financial, availability, verification, background-check, existing-value, file, and consent fields need your review.</p>
      </div>

      {!selectedResumes.length && <p className="text-xs text-amber-700 dark:text-amber-300">Select a resume in the Resumes tab to give the agent candidate context.</p>}
      {!jobData.jd && <p className="text-xs text-amber-700 dark:text-amber-300">Open a supported job page or use Match to enter a job description.</p>}
      {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      {status && <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400">{status}</p>}

      {output && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-foreground">Draft for your review</h3>
            <button onClick={copyOutput} className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg">
              <Clipboard className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
          <textarea aria-label="Edit generated draft" value={output} onChange={(event) => setOutput(event.target.value)} maxLength={12000} rows={12} className="w-full max-h-[420px] overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground bg-transparent resize-y outline-none" />
        </div>
      )}
    </section>
  );
}
