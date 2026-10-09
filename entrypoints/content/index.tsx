import { defineContentScript } from "wxt/utils/define-content-script";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import ReactDOM from "react-dom/client";
import React from "react";
import SidepanelApp from "../sidepanel/App";
import { highlightInDOM, injectHighlightStyles, removeHighlighting, createHighlightToggleButton } from "../../utils/keywordHighlighter";
import { getAdapter } from "../../utils/siteAdapters";
import type { ApplicationFormField } from "../../components/sidepanel/types";
import "../../entrypoints/sidepanel/style.css";

function isLikelyJobPage(): boolean {
    const url = window.location.href.toLowerCase();
    
    const checks = {
        linkedin: url.includes("linkedin.com/jobs") || (url.includes("linkedin.com") && (url.includes("/jobs") || url.includes("/job/"))),
        indeed: url.includes("indeed.com"),
        glassdoor: url.includes("glassdoor.com"),
        wellfound: url.includes("wellfound.com"),
        workable: url.includes("workable.com") || (url.includes("workable") && url.includes("/j/")),
        generic: url.includes("career") || url.includes("/job/") || url.includes("/jobs/") || url.includes("apply")
    };
    
    return Object.values(checks).some(check => check);
}

// Content script overlay — SidepanelApp manages its own overlay/button UI internally
const OverlayApp = ({ colorModeTarget }: { colorModeTarget: HTMLElement }) => {
    const [isJobPage, setIsJobPage] = React.useState(isLikelyJobPage());
    const [highlightToggleButton, setHighlightToggleButton] = React.useState<HTMLElement | null>(null);

    React.useEffect(() => {
        console.log("JD Scan: OverlayApp mounted, isJobPage=", isJobPage, "URL=", window.location.href);

        // Monitor URL changes for SPAs (LinkedIn, etc.)
        let lastUrl = window.location.href;
        const urlObserver = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                const currentIsJob = isLikelyJobPage();
                console.log("JD Scan: URL changed", { from: lastUrl, to: window.location.href, isJob: currentIsJob });
                lastUrl = window.location.href;
                setIsJobPage(currentIsJob);
                
                // Clean up highlight button on URL change
                if (highlightToggleButton) {
                    highlightToggleButton.remove();
                    setHighlightToggleButton(null);
                }
            }
        });
        urlObserver.observe(document, { subtree: true, childList: true });
        return () => {
            urlObserver.disconnect();
            if (highlightToggleButton) {
                highlightToggleButton.remove();
            }
        };
    }, [highlightToggleButton]);

    // Listen for highlight requests
    React.useEffect(() => {
        const handleHighlightRequest = (request: any, sender: any, sendResponse: any) => {
            if (request.type === "HIGHLIGHT_KEYWORDS" && request.resumeContent) {
                const adapter = getAdapter(window.location.href);
                const jobData = adapter.getJobData();
                
                if (jobData.element && jobData.jd) {
                    try {
                        injectHighlightStyles();
                        const result = highlightInDOM(jobData.element, request.resumeContent);
                        
                        // Create or update toggle button
                        if (!highlightToggleButton) {
                            const button = createHighlightToggleButton((isHighlighted) => {
                                // Try to use the original element if connected
                                let target = jobData.element;
                                
                                // If disconnected, try to find it again using the adapter
                                if (target && !document.body.contains(target)) {
                                    console.log("JD Scan: Job element disconnected, searching again...");
                                    const newData = adapter.getJobData();
                                    if (newData.element) {
                                        target = newData.element;
                                    }
                                }
                                
                                if (target && document.body.contains(target)) {
                                    if (isHighlighted) {
                                        highlightInDOM(target, request.resumeContent);
                                    } else {
                                        removeHighlighting(target);
                                    }
                                } else {
                                    console.warn("JD Scan: Could not find job element to highlight");
                                }
                            }, true);
                            document.body.appendChild(button);
                            setHighlightToggleButton(button);
                        }
                        
                        sendResponse({ 
                            success: true, 
                            result,
                            message: `Highlighted ${result.stats.matchedCount} matched and ${result.stats.unmatchedCount} missing keywords`
                        });
                    } catch (error) {
                        console.error("JD Scan: Highlighting failed", error);
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        sendResponse({ success: false, error: errorMessage });
                    }
                } else {
                    sendResponse({ success: false, error: "No job description found on page" });
                }
                return true;
            }
            
            if (request.type === "REMOVE_HIGHLIGHTS") {
                const adapter = getAdapter(window.location.href);
                const jobData = adapter.getJobData();
                if (jobData.element) {
                    removeHighlighting(jobData.element);
                    if (highlightToggleButton) {
                        highlightToggleButton.remove();
                        setHighlightToggleButton(null);
                    }
                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, error: "No job description found" });
                }
                return true;
            }
        };

        chrome.runtime.onMessage.addListener(handleHighlightRequest);
        return () => chrome.runtime.onMessage.removeListener(handleHighlightRequest);
    }, [highlightToggleButton]);

    // Keep the assistant available on every supported web page; job-specific
    // extraction remains guarded by isLikelyJobPage below.
    return (
        <div style={{ pointerEvents: 'auto' }}>
            <SidepanelApp colorModeTarget={colorModeTarget} />
        </div>
    );
};

export default defineContentScript({
    matches: ["http://*/*", "https://*/*"],
    cssInjectionMode: "ui",
    async main(ctx) {
        console.log("JD Scan content script loaded on:", window.location.href);

        const ui = await createShadowRootUi(ctx, {
            name: "jd-scan-overlay",
            position: "overlay",
            alignment: "top-left",
            zIndex: 2147483647,
            onMount(uiContainer, _shadow, shadowHost) {
                shadowHost.id = 'jd-scan-overlay-root';
                uiContainer.classList.add('jd-scan-theme');
                const container = document.createElement('div');
                container.style.pointerEvents = 'auto';
                uiContainer.appendChild(container);

                const root = ReactDOM.createRoot(container);
                root.render(
                    <React.StrictMode>
                        <OverlayApp colorModeTarget={uiContainer} />
                    </React.StrictMode>
                );
                return root;
            },
            onRemove(root) {
                root?.unmount();
            },
        });
        ui.mount();

        const applicationFieldCache = new Map<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>();
        let applicationFieldPageUrl = window.location.href;
        const sensitiveFieldPattern = /password|one-time[- ]?code|credit.?card|cc-number|cc-exp|cc-csc|social.?security|\bssn\b|tax.?id|bank.?account|routing.?number|date.?of.?birth|birth.?date|birthday|\bage\b|\bdob\b|passport|driver.?s.?license|national.?id|government.?id|identity.?number|work.?authori[sz]ation|employment.?authori[sz]ation|legally.?authori[sz]ed|citizenship|immigration|visa|race|ethnicity|gender|pronoun|sexual.?orientation|disability|veteran|medical|health|salary.?expectation|background.?check|criminal|consent|terms|agreement/i;

        const getFieldLabel = (field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, index: number) => {
            const labelledBy = field.getAttribute('aria-labelledby')
                ?.split(/\s+/)
                .map((labelId) => document.getElementById(labelId)?.textContent || '')
                .join(' ');
            return [
                Array.from(field.labels || []).map((item) => item.textContent || '').join(' '),
                field.getAttribute('aria-label') || '',
                labelledBy || '',
                field.getAttribute('placeholder') || '',
                field.getAttribute('name') || '',
            ].join(' ').replace(/\s+/g, ' ').trim().slice(0, 300) || `Text field ${index + 1}`;
        };

        const isApplicationFieldVisible = (field: HTMLElement) => {
            const style = window.getComputedStyle(field);
            return style.visibility !== 'hidden' && style.display !== 'none' && field.getClientRects().length > 0;
        };

        const getApplicationFormRoots = () => Array.from(document.querySelectorAll('form, [role="form"]')).filter((root) => {
            const formText = `${root.getAttribute('aria-label') || ''} ${root.getAttribute('action') || ''} ${root.textContent || ''}`.slice(0, 6000);
            if (/\b(application|applicant|candidate|cover letter|resume|curriculum vitae|employment history|work experience|apply for|apply to)\b/i.test(formText)) return true;
            if (!/\b(apply|application|candidate)\b/i.test(window.location.pathname)) return false;
            return Array.from(root.querySelectorAll('button, input[type="submit"], [role="button"]')).some((element) =>
                /\b(next|continue|proceed|submit|apply)\b/i.test(`${element.textContent || ''} ${element.getAttribute('aria-label') || ''} ${element instanceof HTMLInputElement ? element.value : ''}`),
            );
        });

        const getApplicationFields = (): { fields: ApplicationFormField[]; blockedRequiredCount: number; truncatedFieldCount: number; applicationContext: boolean } => {
            applicationFieldCache.clear();
            applicationFieldPageUrl = window.location.href;
            const applicationForms = getApplicationFormRoots();
            const applicationContext = applicationForms.length > 0;

            const isSupported = (field: Element): field is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => {
                if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return false;
                const owner = field.closest('form, [role="form"]');
                if (!owner || !applicationForms.includes(owner)) return false;
                const type = field instanceof HTMLTextAreaElement ? 'textarea' : field instanceof HTMLSelectElement ? 'select' : field.type.toLowerCase();
                const label = getFieldLabel(field, 0);
                const fieldInfo = `${label} ${field.getAttribute('autocomplete') || ''} ${field.id}`;
                return ['text', 'email', 'tel', 'url', 'search', 'textarea', 'select'].includes(type)
                    && !sensitiveFieldPattern.test(fieldInfo)
                    && !field.disabled
                    && !('readOnly' in field && field.readOnly)
                    && !field.closest('#jd-scan-overlay-root')
                    && isApplicationFieldVisible(field);
            };
            const controls = Array.from(new Set(applicationForms.flatMap((root) => Array.from(root.querySelectorAll('input, textarea, select')))));
            const blockedRequiredCount = controls.filter((field) => {
                if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return false;
                if (!field.required || field.disabled || !isApplicationFieldVisible(field)) return false;
                const label = getFieldLabel(field as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, 0);
                const type = field instanceof HTMLTextAreaElement ? 'textarea' : field instanceof HTMLSelectElement ? 'select' : (field as HTMLInputElement).type.toLowerCase();
                const sensitive = sensitiveFieldPattern.test(`${label} ${field.getAttribute('autocomplete') || ''} ${field.id}`);
                return sensitive || !['text', 'email', 'tel', 'url', 'search', 'textarea', 'select'].includes(type);
            }).length;
            const supportedFields = controls.filter(isSupported);
            const truncatedFieldCount = Math.max(0, supportedFields.length - 30);
            const fields = supportedFields.slice(0, 30);

            const applicationFields = fields.map((field, index) => {
                const id = `field-${index}`;
                applicationFieldCache.set(id, field);
                const label = getFieldLabel(field, index);
                const type = field instanceof HTMLTextAreaElement ? 'textarea' : field instanceof HTMLSelectElement ? 'select' : field.type.toLowerCase();

                return {
                    id,
                    label,
                    type: type as ApplicationFormField['type'],
                    autocomplete: field.getAttribute('autocomplete')?.slice(0, 100) || undefined,
                    value: field.value.slice(0, 1000),
                    required: field.required,
                    maxLength: field instanceof HTMLSelectElement ? undefined : field.maxLength,
                    options: field instanceof HTMLSelectElement
                        ? Array.from(field.options).filter((option) => !option.disabled && option.value).slice(0, 30).map((option) => ({
                            label: (option.textContent || '').trim().slice(0, 200),
                            value: option.value,
                        }))
                        : undefined,
                };
            });
            return { fields: applicationFields, blockedRequiredCount, truncatedFieldCount, applicationContext };
        };

        const fillCachedApplicationField = async (field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, rawValue: string) => {
            if (!field.isConnected || field.disabled || ('readOnly' in field && field.readOnly) || !isApplicationFieldVisible(field)) return false;
            const owner = field.closest('form, [role="form"]');
            if (!owner || !getApplicationFormRoots().includes(owner)) return false;
            if (field.value.trim()) return false;
            const type = field instanceof HTMLTextAreaElement ? 'textarea' : field instanceof HTMLSelectElement ? 'select' : field.type.toLowerCase();
            const fieldInfo = `${getFieldLabel(field, 0)} ${field.getAttribute('autocomplete') || ''} ${field.id}`;
            if (!['text', 'email', 'tel', 'url', 'search', 'textarea', 'select'].includes(type) || sensitiveFieldPattern.test(fieldInfo)) return false;

            let value = rawValue.trim();
            if (!value || value.length > 4000) return false;
            if (field instanceof HTMLSelectElement) {
                const option = Array.from(field.options).find((candidate) =>
                    !candidate.disabled && (candidate.value === value || (candidate.textContent || '').trim().toLocaleLowerCase() === value.toLocaleLowerCase()),
                );
                if (!option) return false;
                value = option.value;
            } else if (field.maxLength >= 0 && value.length > field.maxLength) {
                return false;
            }

            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            field.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
            await new Promise((resolve) => window.setTimeout(resolve, 100));
            if (!field.isConnected || applicationFieldPageUrl !== window.location.href) return false;

            const prototype = field instanceof HTMLTextAreaElement
                ? HTMLTextAreaElement.prototype
                : field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(field, value);
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            return field.value === value;
        };

        // Message listener for commands
        chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
            if (request.type === "GET_JD") {
                const adapter = getAdapter(window.location.href);
                const data = adapter.getJobData();
                sendResponse({ type: "JD_RESULT", data });
                return true;
            }

            if (request.type === "SCAN_PAGE") {
                const adapter = getAdapter(window.location.href);
                const data = adapter.getJobData();
                
                if (data.jd && data.jd.length > 50) {
                    chrome.runtime.sendMessage({ type: "JD_FOUND", data }).catch(() => { });
                    sendResponse({ success: true, data, message: `Found job description (${data.jd.length} characters)` });
                } else {
                    sendResponse({ success: false, message: "No job description found or too short", data });
                }
                return true;
            }

            if (request.type === "OPEN_APPLICATION_FORM") {
                if (sender.id !== chrome.runtime.id || typeof request.expectedUrl !== 'string' || request.expectedUrl !== window.location.href) {
                    sendResponse({ success: false, error: 'The page changed. Start again from the job posting.' });
                    return true;
                }
                if (getApplicationFields().applicationContext) {
                    sendResponse({ success: true, alreadyOpen: true });
                    return true;
                }
                const job = getAdapter(window.location.href).getJobData();
                if (!isLikelyJobPage() || job.jd.length < 80) {
                    sendResponse({ success: false, error: 'Open a job posting with a readable description before starting.' });
                    return true;
                }

                const applyLabel = /^(?:apply(?: now| for this job| to this job)?|easy apply|start (?:your )?application|begin (?:your )?application)$/i;
                const applyAction = Array.from(document.querySelectorAll('a, button, [role="button"]')).find((element) => {
                    const style = window.getComputedStyle(element);
                    if (element.closest('#jd-scan-overlay-root, form, [role="form"]')
                        || style.visibility === 'hidden' || style.display === 'none'
                        || element.getClientRects().length === 0
                        || element.getAttribute('aria-disabled') === 'true'
                        || ('disabled' in element && (element as HTMLButtonElement).disabled)) return false;
                    if (element instanceof HTMLButtonElement && element.type === 'submit') return false;
                    if (element instanceof HTMLAnchorElement) {
                        const href = new URL(element.href, window.location.href);
                        if (!['http:', 'https:'].includes(href.protocol) || element.target === '_blank') return false;
                    }
                    return [element.textContent || '', element.getAttribute('aria-label') || '', element.getAttribute('title') || '']
                        .some((label) => applyLabel.test(label.replace(/\s+/g, ' ').trim()));
                });
                if (!applyAction) {
                    sendResponse({ success: true, clicked: false, error: 'No clear same-tab Apply action was found. Open the application form manually.' });
                    return true;
                }

                const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                applyAction.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
                sendResponse({ success: true, clicked: true });
                window.setTimeout(() => {
                    if (applyAction.isConnected && request.expectedUrl === window.location.href) (applyAction as HTMLElement).click();
                }, 100);
                return true;
            }

            if (request.type === "GET_APPLICATION_FIELDS") {
                const result = getApplicationFields();
                sendResponse({ success: true, ...result, url: window.location.href });
                return true;
            }

            if (request.type === "FILL_APPLICATION_FIELD") {
                if (sender.id !== chrome.runtime.id || typeof request.fieldId !== 'string') {
                    sendResponse({ success: false, error: 'Untrusted extension message.' });
                    return true;
                }
                if (applicationFieldPageUrl !== window.location.href || (request.expectedUrl && request.expectedUrl !== window.location.href)) {
                    sendResponse({ success: false, error: 'The page changed. Scan the form again.' });
                    return true;
                }

                const field = applicationFieldCache.get(request.fieldId);
                const value = typeof request.value === 'string' ? request.value.trim() : '';
                if (!field?.isConnected || !value || value.length > 4000) {
                    sendResponse({ success: false, error: 'Field or draft is no longer available.' });
                    return true;
                }
                if (field.disabled || ('readOnly' in field && field.readOnly) || field.getClientRects().length === 0) {
                    sendResponse({ success: false, error: 'This field is no longer available.' });
                    return true;
                }
                if (field.value.trim()) {
                    sendResponse({ success: false, error: 'This field already has text. Clear it yourself before filling.' });
                    return true;
                }
                if (!(field instanceof HTMLSelectElement) && field.maxLength >= 0 && value.length > field.maxLength) {
                    sendResponse({ success: false, error: `This field allows ${field.maxLength} characters; shorten the draft first.` });
                    return true;
                }
                void fillCachedApplicationField(field, value).then((filled) => {
                    sendResponse(filled ? { success: true } : { success: false, error: 'Could not safely fill this field.' });
                });
                return true;
            }

            if (request.type === "FILL_APPLICATION_FIELDS") {
                if (sender.id !== chrome.runtime.id || typeof request.expectedUrl !== 'string' || !Array.isArray(request.fields)) {
                    sendResponse({ success: false, error: 'Untrusted or invalid form-fill request.' });
                    return true;
                }
                if (applicationFieldPageUrl !== window.location.href || request.expectedUrl !== window.location.href) {
                    sendResponse({ success: false, error: 'The page changed. Scan the form again.' });
                    return true;
                }

                void (async () => {
                    let filled = 0;
                    let skipped = 0;
                    for (const candidate of request.fields.slice(0, 30)) {
                        if (!candidate || typeof candidate.fieldId !== 'string' || typeof candidate.value !== 'string') {
                            skipped++;
                            continue;
                        }
                        const field = applicationFieldCache.get(candidate.fieldId);
                        if (!field || applicationFieldPageUrl !== window.location.href) {
                            skipped++;
                            continue;
                        }
                        if (await fillCachedApplicationField(field, candidate.value)) filled++;
                        else skipped++;
                    }
                    sendResponse({ success: true, filled, skipped });
                })();
                return true;
            }

            if (request.type === "ADVANCE_APPLICATION_STEP") {
                if (sender.id !== chrome.runtime.id || typeof request.expectedUrl !== 'string') {
                    sendResponse({ success: false, error: 'Untrusted or invalid navigation request.' });
                    return true;
                }
                if (request.expectedUrl !== window.location.href) {
                    sendResponse({ success: false, error: 'The page changed. Scan the form again.' });
                    return true;
                }

                const { fields, blockedRequiredCount, truncatedFieldCount } = getApplicationFields();
                if (blockedRequiredCount > 0) {
                    sendResponse({ success: true, clicked: false, blockedRequiredCount });
                    return true;
                }
                if (truncatedFieldCount > 0) {
                    sendResponse({ success: true, clicked: false, truncatedFieldCount });
                    return true;
                }
                if (fields.length === 0) {
                    sendResponse({ success: true, clicked: false });
                    return true;
                }

                const actions = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"], a'))
                    .filter((element) => {
                        const style = window.getComputedStyle(element);
                        return !element.closest('#jd-scan-overlay-root')
                            && style.visibility !== 'hidden' && style.display !== 'none'
                            && element.getClientRects().length > 0
                            && !('disabled' in element && (element as HTMLButtonElement).disabled)
                            && element.getAttribute('aria-disabled') !== 'true';
                    });
                const actionLabels = (element: Element) => {
                    const inputValue = element instanceof HTMLInputElement ? element.value : '';
                    const visible = (inputValue || element.textContent || '').replace(/[›→]\s*$/, '').replace(/\s+/g, ' ').trim();
                    const accessible = [element.getAttribute('aria-label') || '', element.getAttribute('title') || '']
                        .join(' ').replace(/[›→]\s*$/, '').replace(/\s+/g, ' ').trim();
                    return { label: (visible || accessible).slice(0, 120), cues: `${visible} ${accessible}`.slice(0, 300) };
                };
                const labels = actions.map((element) => ({ element, ...actionLabels(element) }));
                const finalPattern = /\b(submit|apply|send|finish|complete|review|confirm|accept|agree|sign|pay|purchase|consent|terms|captcha|verification|verify)\b/i;
                const finalAction = labels.find(({ cues }) => finalPattern.test(cues));
                const nextStep = labels.find(({ element, label, cues }) => {
                    if (finalPattern.test(cues)) return false;
                    if (!/^(?:(?:save|save draft)\s+(?:and|&)\s+)?(?:next|continue|proceed)(?:\s+(?:to|with|application|step|page|section|questions|details))*$/i.test(label)) return false;
                    if (element instanceof HTMLAnchorElement && new URL(element.href, window.location.href).origin !== window.location.origin) return false;
                    const owner = (element instanceof HTMLButtonElement || element instanceof HTMLInputElement)
                        ? element.form || element.closest('[role="form"]')
                        : element.closest('form, [role="form"]');
                    if (!owner || !Array.from(applicationFieldCache.values()).some((field) => owner.contains(field))) return false;
                    return true;
                });

                if (!nextStep) {
                    sendResponse({ success: true, clicked: false, finalActionFound: Boolean(finalAction), finalActionLabel: finalAction?.label });
                    return true;
                }

                const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                nextStep.element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
                window.setTimeout(() => {
                    if (!nextStep.element.isConnected || request.expectedUrl !== window.location.href) {
                        sendResponse({ success: false, error: 'The page changed before the next step could be opened.' });
                        return;
                    }
                    (nextStep.element as HTMLElement).click();
                    sendResponse({ success: true, clicked: true, label: nextStep.label });
                }, 100);
                return true;
            }

        });

        // Proactively send JD if we think we are on a job page
        if (isLikelyJobPage()) {
            let lastSentKey = "";
            let debounceTimer: number | null = null;
            let attempts = 0;
            const maxAttempts = 20;

            const pollJD = (attemptNum: number = 1) => {
                const adapter = getAdapter(window.location.href);
                const data = adapter.getJobData();
                const jdOk = data.jd.length >= 80;
                const key = `${data.title}::${data.company}::${data.jd.slice(0, 300)}`;

                if (jdOk && key !== lastSentKey) {
                    lastSentKey = key;
                    
                    // Method 1: Try sendMessage
                    try {
                        chrome.runtime.sendMessage({ type: "JD_FOUND", data });
                    } catch (e) {
                        console.error("JD Scan: Send error", e);
                    }
                    
                    // Method 2: Also write to storage
                    chrome.storage?.local?.set({ 
                        jdScan_lastJob: { 
                            data, 
                            timestamp: Date.now(),
                            url: window.location.href 
                        } 
                    });
                    
                    return true;
                }
                return false;
            };

            const schedulePoll = (delayMs: number) => {
                if (debounceTimer) window.clearTimeout(debounceTimer);
                debounceTimer = window.setTimeout(() => {
                    attempts++;
                    const success = pollJD(attempts);
                    if (!success && attempts < maxAttempts) {
                        schedulePoll(1000);
                    }
                }, delayMs);
            };

            // Start polling
            schedulePoll(500);
            schedulePoll(1500);
            schedulePoll(3000);

            // LinkedIn SPA mutation observer
            const domObserver = new MutationObserver((mutations) => {
                const hasMeaningfulChange = mutations.some(m => 
                    m.type === 'childList' && 
                    ((m.target as Element).className?.includes('jobs') || 
                    (m.target as Element).className?.includes('description'))
                );
                if (hasMeaningfulChange && isLikelyJobPage()) {
                    schedulePoll(600);
                }
            });
            domObserver.observe(document.documentElement, { subtree: true, childList: true });

            // Poll on clicks
            document.addEventListener('click', () => {
                attempts = 0;
                schedulePoll(800);
                schedulePoll(2000);
            });
        }
    },
});
