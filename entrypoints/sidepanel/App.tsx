import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
    FileText,
    ScanLine,
    X,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    Settings,
    CloudUpload,
    Sparkles,
    GripVertical,
    RefreshCw,
    PencilLine,
    Globe,
    Building2,
    Briefcase,
    Cpu
} from "lucide-react";
import { jobForPage } from '../../utils/jobContext';
import { applicationNameKey } from '../../utils/applicationName';
import { scanMultipleResumes } from "../../utils/atsScanner";
import { loadSettings, saveSettings, UserSettings, DEFAULT_SETTINGS, applyColorMode } from "../../utils/settings";
import { scanResumeATS, fetchLLMConfigs, LLMAPIConfig } from "../../utils/api";
import { getFileTypeConfig } from "../../components/sidepanel/resumeHelpers";
import { JobData, Resume, ScanResult, UploadingFile } from "../../components/sidepanel/types";
import SettingsModal from "../../components/SettingsModal";
import ApplicationAgent from "../../components/ApplicationAgent";
import { getActiveBrowserTab, sendBrowserTabMessage } from "../../utils/browserTabs";
import AnalysisReport from "../../components/sidepanel/AnalysisReport";
import HistoryTab from "../../components/sidepanel/HistoryTab";
import ResumeLibraryTab from "../../components/sidepanel/ResumeLibraryTab";
import FloatingOverlay from "../../components/FloatingOverlay";
import FloatingButton from "../../components/FloatingButton";
import HighlightedJobDescription from "../../components/HighlightedJobDescription";
import { readResumeFile } from "../../utils/resumeFile";
import { appendStoredResumes } from "../../utils/resumeLibrary";
import { highlightInDOM, injectHighlightStyles } from "../../utils/keywordHighlighter";

export default function App({ colorModeTarget }: { colorModeTarget?: HTMLElement } = {}) {
    // Detect if we're running in a content script context or sidepanel/popup
    const isContentScript = typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol);
    
    const [resumes, setResumes] = useState<Resume[]>([]);
    const [jobData, setJobData] = useState<JobData>({ jd: "", title: "", company: "" });
    const [isManualMode, setIsManualMode] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanError, setScanError] = useState('');
    const [results, setResults] = useState<ScanResult[]>([]);
    const [activeTab, setActiveTab] = useState<'match' | 'agent' | 'resumes' | 'history'>('agent');
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [showUploadZone, setShowUploadZone] = useState(false);
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    const [isOverlayExpanded, setIsOverlayExpanded] = useState(false);
    const [llmConfigs, setLlmConfigs] = useState<LLMAPIConfig[]>([]);
    const [llmConfigsLoading, setLlmConfigsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const dragCounter = useRef(0);
    const selectedLLMConfig = llmConfigs.find((config) => config.id === settings.selectedLLMConfigId);

    // Load settings everywhere, but only contact the API after the page overlay opens.
    useEffect(() => {
        let cancelled = false;
        const shouldLoadConfigs = !isContentScript || isOverlayExpanded;
        setLlmConfigsLoading(shouldLoadConfigs);
        (async () => {
            try {
                const loaded = await loadSettings();
                if (cancelled) return;
                setSettings(loaded);
                applyColorMode(loaded.colorMode, colorModeTarget);

                if (!shouldLoadConfigs) return;

                const configs = await fetchLLMConfigs();
                if (cancelled) return;
                setLlmConfigs(configs);

                console.log("JD Scan: Loaded settings:", loaded);
                console.log("JD Scan: Fetched LLM configs:", configs);

                if (!loaded.selectedLLMConfigId && configs.length > 0) {
                    const activeConfigs = configs.filter((c) => c.isActive);
                    const autoConfig = activeConfigs.length === 1 ? activeConfigs[0] : undefined;
                    console.log("JD Scan: Auto-selecting config:", autoConfig);
                    if (autoConfig) {
                        const newSettings = { ...loaded, selectedLLMConfigId: autoConfig.id };
                        setSettings(newSettings);
                        await saveSettings({ selectedLLMConfigId: autoConfig.id });
                        console.log("JD Scan: Saved auto-selected config on mount:", autoConfig.id);
                    }
                }
            } finally {
                if (!cancelled && shouldLoadConfigs) setLlmConfigsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [colorModeTarget, isContentScript, isOverlayExpanded]);

    useEffect(() => {
        chrome.storage?.local?.get("resumes", (data) => {
            if (data?.resumes && Array.isArray(data.resumes)) {
                setResumes(data.resumes as Resume[]);
            }
        });

        let cancelled = false;
        let jobRequest = 0;
        const receiveJob = async (record: unknown) => {
            const request = ++jobRequest;
            try {
                const tab = isContentScript ? null : await getActiveBrowserTab();
                if (cancelled || request !== jobRequest) return;
                const job = jobForPage(record, tab?.url || window.location.href, tab?.id);
                if (job) {
                    setJobData(job);
                    setResults([]);
                    setIsManualMode(false);
                }
            } catch { /* An inactive or internal tab cannot receive a job context. */ }
        };
        chrome.storage?.local?.get("jdScan_lastJob", data => void receiveJob(data?.jdScan_lastJob));
        const clearPageJob = () => {
            jobRequest++;
            setJobData(previous => jobForPage({ data: previous, url: previous.sourceUrl }, window.location.href)
                || { jd: '', title: '', company: '' });
            setResults([]);
            setIsManualMode(false);
        };
        window.addEventListener('jdscan:location-changed', clearPageJob);
        const messageListener = (msg: any) => {
            if (msg.type === "JD_FOUND") {
                void receiveJob({ data: msg.data, url: msg.url, tabId: msg.tabId });
            }
            if (msg.type === "SCAN_COMPLETE") {
                setResults(msg.data);
                setScanning(false);
            }
            if (msg.type === "FORCE_SHOW_BUTTON" && isContentScript) {
                setIsOverlayExpanded(true);
            }
            if (msg.type === "SETTINGS_UPDATED") {
                setSettings(msg.settings);
                applyColorMode(msg.settings.colorMode, colorModeTarget);
            }
        };

        // Listen for storage changes (reliable fallback)
        const restoreRunningOverlay = (record: any) => {
            if (!isContentScript || !record?.running || Date.now() - record.timestamp > 300000) return;
            void getActiveBrowserTab().then(tab => {
                if (tab.id === record.tabId) setIsOverlayExpanded(true);
            }).catch(() => {});
        };
        chrome.storage.local.get('jdScan_applicationRun', data => restoreRunningOverlay(data.jdScan_applicationRun));
        const storageListener = (changes: any, namespace: string) => {
            if (namespace === 'local' && changes.jdScan_applicationRun) restoreRunningOverlay(changes.jdScan_applicationRun.newValue);
            if (namespace === 'local' && changes.resumes) {
                setResumes(Array.isArray(changes.resumes.newValue) ? changes.resumes.newValue as Resume[] : []);
            }
            if (namespace === 'local' && changes.userSettings) {
                const updated = { ...DEFAULT_SETTINGS, ...changes.userSettings.newValue };
                setSettings(updated);
                applyColorMode(updated.colorMode, colorModeTarget);
            }
            if (namespace === 'local' && changes.jdScan_lastJob) {
                void receiveJob(changes.jdScan_lastJob.newValue);
            }
        };

        chrome.runtime?.onMessage.addListener(messageListener);
        chrome.storage?.onChanged?.addListener(storageListener);

        return () => {
            cancelled = true;
            window.removeEventListener('jdscan:location-changed', clearPageJob);
            chrome.runtime?.onMessage.removeListener(messageListener);
            chrome.storage?.onChanged?.removeListener(storageListener);
        };
    }, []);

    const handleSettingsChange = async (newSettings: Partial<UserSettings>) => {
        setSettings((prev) => {
            const updated = { ...prev, ...newSettings };
            if (newSettings.colorMode) {
                applyColorMode(newSettings.colorMode, colorModeTarget);
            }
            return updated;
        });
        await saveSettings(newSettings);
    };

    const highlightOnPage = async (resumeContent: string) => {
        try {
            // If we're in a content script context, highlight directly in the DOM
            if (isContentScript) {
                // Find the job description element on the page
                const jobElements = document.querySelectorAll('[data-ui="job-description"], .job-description, .jobs-description__content, .jobs-description-content__text, main section, main article');
                if (jobElements.length > 0) {
                    injectHighlightStyles();
                    const result = highlightInDOM(jobElements[0] as Element, resumeContent);
                    console.log("JD Scan: Highlighting applied successfully in content script", result);
                } else {
                    console.warn("JD Scan: No job description element found for highlighting");
                }
                return;
            }
            
            const tab = await getActiveBrowserTab();
            const response = await sendBrowserTabMessage(tab.id, {
                type: "HIGHLIGHT_KEYWORDS",
                resumeContent
            });
            if (!response?.success) {
                throw new Error(response?.error || 'Could not highlight this page.');
            }
        } catch (error) {
            setScanError(error instanceof Error ? error.message : 'Could not highlight this page.');
        }
    };

    const processFiles = useCallback(async (fileList: FileList | File[]) => {
        const files = Array.from(fileList);

        if (files.length === 0) return;

        // Create upload placeholders
        const uploadEntries: UploadingFile[] = files.map((f) => ({
            id: crypto.randomUUID(),
            name: f.name,
            progress: 0,
            status: "uploading" as const,
        }));

        setUploadingFiles((prev) => [...prev, ...uploadEntries]);

        const newResumes: Resume[] = [];
        const processedEntryIds: string[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const entryId = uploadEntries[i].id;

            try {
                setUploadingFiles((prev) =>
                    prev.map((u) => u.id === entryId ? { ...u, status: "processing" } : u)
                );
                const content = await readResumeFile(file);

                newResumes.push({
                    id: crypto.randomUUID(),
                    name: file.name,
                    content,
                    fileSize: file.size,
                    fileType: file.type || "text/plain",
                    uploadedAt: new Date().toISOString(),
                    selected: true,
                });
                processedEntryIds.push(entryId);
            } catch (err) {
                setUploadingFiles((prev) =>
                    prev.map((u) =>
                        u.id === entryId
                            ? { ...u, status: "error", error: err instanceof Error ? err.message : "Failed to process file" }
                            : u
                    )
                );
            }
        }

        if (newResumes.length > 0) {
            try {
                setResumes(await appendStoredResumes(newResumes));
                setUploadingFiles((prev) => prev.map((u) => processedEntryIds.includes(u.id)
                    ? { ...u, progress: 100, status: "done" }
                    : u));
                setTimeout(() => {
                    setUploadingFiles((prev) => prev.filter((u) => u.status !== "done"));
                }, 1500);
            } catch {
                setUploadingFiles((prev) => prev.map((u) => processedEntryIds.includes(u.id)
                    ? { ...u, status: "error", error: "Could not save this resume locally. Check extension storage and try again." }
                    : u));
            }
        }

        setShowUploadZone(false);
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(e.target.files);
            e.target.value = ""; // Reset so the same file can be re-uploaded
        }
    };

    // Drag & Drop handlers
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.types.includes("Files")) {
            setIsDragOver(true);
            if (activeTab !== 'resumes') setActiveTab('resumes');
            setShowUploadZone(true);
        }
    }, [activeTab]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setIsDragOver(false);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current = 0;
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processFiles(files);
        }
    }, [processFiles]);

    const deleteResume = (id: string) => {
        const updated = resumes.filter((r) => r.id !== id);
        setResumes(updated);
        chrome.storage?.local?.set({ resumes: updated });
        void chrome.storage.local.remove(applicationNameKey(id)).catch(error => console.error('Could not remove the saved application name:', error));
    };

    const toggleResumeSelect = (id: string) => {
        setResumes((prev) => {
            const updated = prev.map((r) =>
                r.id === id ? { ...r, selected: !r.selected } : r
            );
            chrome.storage?.local?.set({ resumes: updated });
            return updated;
        });
    };

    const selectAll = () => {
        setResumes((prev) => {
            const allSelected = prev.every((r) => r.selected);
            const updated = prev.map((r) => ({ ...r, selected: !allSelected }));
            chrome.storage?.local?.set({ resumes: updated });
            return updated;
        });
    };

    const selectedResumes = React.useMemo(() => resumes.filter((r) => r.selected), [resumes]);
    const primaryResumeContent = React.useMemo(() => 
        selectedResumes.length > 0 ? selectedResumes[0].content : '', 
        [selectedResumes]
    );

    const fetchPageJD = async () => {
        setScanError('');
        try {
            const tab = await getActiveBrowserTab();
            const response = await sendBrowserTabMessage(tab.id, { type: "GET_JD" });
            if (response?.data?.jd) {
                setJobData({ ...response.data, sourceUrl: tab.url });
                setIsManualMode(false);
            } else {
                setScanError('No job description found on this page. Open a job posting or enter it manually.');
            }
        } catch (error) {
            setScanError(error instanceof Error ? error.message : 'Could not read the job page.');
        }
    };

    const startAIScan = async () => {
        if (!jobData.jd || selectedResumes.length === 0 || scanning) return;
        setScanning(true);
        setScanError('');
        setResults([]);
        try {
            const currentSettings = await loadSettings();
            const configs = await fetchLLMConfigs();
            setLlmConfigs(configs);
            const activeConfigs = configs.filter(config => config.isActive);
            const selectedConfig = currentSettings.selectedLLMConfigId
                ? activeConfigs.find(config => config.id === currentSettings.selectedLLMConfigId)
                : activeConfigs.length === 1 ? activeConfigs[0] : undefined;
            if (!selectedConfig) {
                setScanError('Choose one enabled AI configuration in Settings before scanning. A disabled, deleted, or unavailable configuration cannot be used.');
                setShowSettings(true);
                return;
            }
            if (currentSettings.selectedLLMConfigId !== selectedConfig.id) {
                await saveSettings({ selectedLLMConfigId: selectedConfig.id });
            }
            setSettings({ ...currentSettings, selectedLLMConfigId: selectedConfig.id });
            const scanResults = await Promise.all(selectedResumes.map(async resume => {
                const result = await scanResumeATS(selectedConfig.id, resume.content, jobData.jd);
                if (!result.success || !result.data) throw new Error(result.error || 'The selected AI provider could not complete the scan.');
                const atsScore = result.data.ats_score || {};
                return {
                    resumeId: resume.id,
                    score: atsScore.score ?? atsScore.matchPercentage ?? 0,
                    matchedKeywords: atsScore.matchedKeywords || atsScore.matched_keywords || [],
                    missingKeywords: atsScore.missingKeywords || atsScore.missing_keywords || [],
                    suggestions: atsScore.suggestions || [],
                };
            }));
            setResults(scanResults);
        } catch (error) {
            setScanError(error instanceof Error ? error.message : 'AI scan failed. Try again or use ATS Keyword Match.');
        } finally {
            setScanning(false);
        }
    };

    const startLocalScan = () => {
        if (!jobData.jd || selectedResumes.length === 0) return;
        setScanError('');
        console.log('[ATS Keyword Match] Button clicked', {
            jobDescriptionLength: jobData.jd.length,
            selectedResumeCount: selectedResumes.length,
            resumes: selectedResumes.map(r => ({
                id: r.id,
                name: r.name,
                contentPreview: r.content.substring(0, 100) + '...'
            })),
            timestamp: new Date().toISOString()
        });
        setScanning(true);
        try {
            const scanResults = scanMultipleResumes(
                selectedResumes.map((r) => ({ id: r.id, content: r.content })),
                jobData.jd
            );
            setResults(scanResults);
        } catch (error) {
            console.error('Local scan failed:', error);
        } finally {
            setScanning(false);
        }
    };

    const isFloatingView = isContentScript || settings.displayMode === 'overlay';

    const mainContent = (
        <div
            className="jd-assistant flex flex-col h-full w-full min-w-0 mx-auto bg-background premium-scrollbar overflow-hidden relative"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Global Drag Overlay */}
            {isDragOver && (
                <div className="absolute inset-0 z-50 bg-brand-600/10 border-2 border-dashed border-brand-400 rounded-2xl flex flex-col items-center justify-center pointer-events-none animate-in">
                    <div className="w-20 h-20 bg-brand-100 dark:bg-brand-900/30 rounded-3xl flex items-center justify-center mb-4 shadow-lg">
                        <CloudUpload className="w-10 h-10 text-brand-600" />
                    </div>
                    <p className="text-lg font-bold text-brand-700 dark:text-brand-400 font-display">Drop your resumes here</p>
                    <p className="text-sm text-brand-500 mt-1">PDF, DOCX, DOC, TXT supported</p>
                </div>
            )}

            {/* The floating window already supplies its title and controls. */}
            {!isFloatingView && (
                <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-3">
                    <h1 className="flex items-center gap-2 text-sm font-bold text-foreground font-display">
                        <ScanLine aria-hidden="true" className="h-4 w-4 text-primary" />
                        JD Scan
                    </h1>
                    <button onClick={() => setShowSettings(true)} className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" title="Settings" aria-label="Open settings">
                        <Settings aria-hidden="true" className="h-4 w-4" />
                    </button>
                </header>
            )}
            {/* Tabs Navigation */}
            <nav aria-label="Workspace sections" className="dashboard-tabs grid grid-cols-[1fr_1fr_1.35fr_1fr] shrink-0 items-center gap-1 border-b border-border bg-card px-2 py-1">
                {[
                    { id: 'agent', label: 'Apply' },
                    { id: 'match', label: 'Match' },
                    { id: 'resumes', label: 'Resumes', badge: resumes.length || undefined },
                    { id: 'history', label: 'History' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        aria-current={activeTab === tab.id ? 'page' : undefined}
                        className={`flex-1 flex items-center justify-center min-w-0 gap-1.5 h-11 rounded-md text-xs font-semibold transition-colors duration-200 relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${activeTab === tab.id
                            ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 shadow-sm border border-brand-100 dark:border-brand-900'
                            : 'text-muted-foreground hover:bg-muted/50'
                            }`}
                    >
                        {tab.label}
                        {tab.badge && tab.badge > 0 && (
                            <span className="inline-flex shrink-0 items-center justify-center h-4 min-w-4 px-1 bg-brand-600 text-white text-xs font-bold rounded-full">
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </nav>

            {/* Main Content Areas */}
            <main className="workspace-content flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-6 premium-scrollbar animate-in">

                {activeTab === 'match' && (
                    <>
                        {/* JD Status Card */}
                        <section className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-foreground font-display">Target Job</h3>
                                    {!isManualMode && jobData.jd && (
                                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-bold rounded-md border border-green-100 dark:border-green-900 uppercase tracking-tighter">
                                            <Globe className="w-2.5 h-2.5" /> Auto-Synced
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={fetchPageJD}
                                        className="p-1.5 text-muted-foreground hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors group"
                                        aria-label="Re-scan current tab"
                                        title="Re-scan current tab"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5 group-active:rotate-180 transition-transform duration-500" />
                                    </button>
                                    <button
                                        onClick={() => setIsManualMode(!isManualMode)}
                                        className={`p-1.5 rounded-lg transition-colors ${isManualMode ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-600' : 'text-muted-foreground hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30'}`}
                                        aria-label="Toggle manual input"
                                        aria-pressed={isManualMode}
                                        title="Toggle manual input"
                                    >
                                        <PencilLine className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className={`glass-card overflow-hidden transition-colors duration-300 ${isManualMode ? 'p-2' : 'p-4'}`}>
                                {isManualMode ? (
                                    <div className="space-y-2">
                                        <textarea
                                            aria-label="Job description"
                                            value={jobData.jd}
                                            onChange={(e) => setJobData({ ...jobData, jd: e.target.value })}
                                            placeholder="Paste the job description here..."
                                            className="w-full h-40 p-3 text-xs text-foreground bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-brand-200 focus:border-brand-300 outline-none resize-none premium-scrollbar"
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                aria-label="Job title (optional)"
                                                placeholder="Job Title (Optional)"
                                                value={jobData.title}
                                                onChange={(e) => setJobData({ ...jobData, title: e.target.value })}
                                                className="min-w-0 flex-1 p-2 text-sm bg-muted/50 border border-border rounded-lg outline-none focus:border-brand-300 text-foreground"
                                            />
                                            <input
                                                type="text"
                                                aria-label="Company (optional)"
                                                placeholder="Company (Optional)"
                                                value={jobData.company}
                                                onChange={(e) => setJobData({ ...jobData, company: e.target.value })}
                                                className="min-w-0 flex-1 p-2 text-sm bg-muted/50 border border-border rounded-lg outline-none focus:border-brand-300 text-foreground"
                                            />
                                        </div>
                                    </div>
                                ) : jobData.jd ? (
                                    <>
                                        {(jobData.title || jobData.company) && (
                                            <div className="flex flex-col gap-1 mb-3 pb-3 border-b border-border/50">
                                                {jobData.title && (
                                                    <div className="flex items-center gap-2 text-foreground">
                                                        <Briefcase className="w-3.5 h-3.5 text-brand-500" />
                                                        <span className="text-sm font-bold truncate tracking-tight">{jobData.title}</span>
                                                    </div>
                                                )}
                                                {jobData.company && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Building2 className="w-3.5 h-3.5" />
                                                        <span className="text-xs font-semibold truncate tracking-tight">{jobData.company}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        
                                        {/* Highlighted Job Description */}
                                        <HighlightedJobDescription
                                            jobDescription={jobData.jd}
                                            resumeContent={primaryResumeContent}
                                            showToggle={true}
                                            showStats={true}
                                            maxHeight="200px"
                                            className="mt-3"
                                        />
                                        
                                        <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/50">
                                            <span className="text-xs text-muted-foreground font-medium">Character count: {jobData.jd.length}</span>
                                            <div className="flex items-center gap-2">
                                                {selectedResumes.length > 0 && (
                                                    <button
                                                        onClick={() => highlightOnPage(primaryResumeContent)}
                                                        className="text-xs font-bold text-blue-500 hover:text-blue-600 dark:text-blue-400 uppercase tracking-tight"
                                                    >
                                                        Highlight on Page
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setJobData({ jd: "", title: "", company: "" })}
                                                    className="text-xs font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 uppercase tracking-tight"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-6 text-center">
                                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Globe className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                        <p className="text-xs text-muted-foreground px-4 leading-relaxed">
                                            Open a job page to capture automatically or <button onClick={() => setIsManualMode(true)} className="text-brand-600 dark:text-brand-400 font-bold hover:underline">enter manually</button>.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Selected Resumes Indicator */}
                        {resumes.length > 0 && (
                            <section className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-sm font-bold text-foreground font-display">Selected Resumes</h3>
                                    <button
                                        onClick={() => setActiveTab('resumes')}
                                        className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 flex items-center gap-0.5"
                                    >
                                        Manage <ChevronRight className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {selectedResumes.length > 0 ? (
                                        selectedResumes.map((r) => {
                                            const ftConf = getFileTypeConfig(r.fileType);
                                            return (
                                                <div
                                                    key={r.id}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${ftConf.bg} ${ftConf.border} transition-colors`}
                                                >
                                                    <FileText className={`w-3.5 h-3.5 ${ftConf.color}`} />
                                                    <span className="text-xs font-medium text-foreground/80 max-w-[120px] truncate">{r.name}</span>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">No resumes selected. Go to Resumes tab to select.</p>
                                    )}
                                </div>
                            </section>
                        )}


                        {/* Scan Action */}
                        <section className="space-y-4 pt-2">
                            {scanError && <p role="alert" className="text-xs text-destructive">{scanError}</p>}
                            {/* LLM Config Indicator */}
                            {settings.selectedLLMConfigId && llmConfigs.length > 0 && (
                                <div className="flex items-center gap-2 px-4 py-3 bg-accent border border-brand-200 dark:border-brand-800 rounded-xl">
                                    <div className="p-1.5 bg-background rounded-lg shadow-sm">
                                        <Cpu className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-brand-600 dark:text-brand-400 font-bold uppercase tracking-tight">AI Model</p>
                                        <p className="text-xs font-semibold text-foreground truncate">
                                            {selectedLLMConfig?.name?.trim() || (selectedLLMConfig ? `${selectedLLMConfig.provider}/${selectedLLMConfig.model}` : 'Unknown')}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowSettings(true)}
                                        className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 px-2 py-1 hover:bg-background/50 rounded-lg transition-colors"
                                    >
                                        Change
                                    </button>
                                </div>
                            )}

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={startAIScan}
                                    disabled={!jobData.jd || selectedResumes.length === 0 || scanning}
                                    className="btn-primary w-full flex items-center justify-center gap-3 py-4"
                                >
                                    {scanning ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 dark:border-brand-800 dark:border-t-brand-300 rounded-full animate-spin" />
                                            <span>Analyzing Keywords...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5" />
                                            <span>AI Scan</span>
                                            {selectedResumes.length > 0 && (
                                                <span className="ml-1 px-2 py-0.5 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-full text-xs">
                                                    {selectedResumes.length} resume{selectedResumes.length > 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={startLocalScan}
                                    disabled={!jobData.jd || selectedResumes.length === 0 || scanning}
                                    className="btn-secondary w-full flex items-center justify-center gap-3 py-3 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/40 transition-colors rounded-xl"
                                >
                                    <ScanLine className="w-5 h-5" />
                                    <span>ATS Keyword Match</span>
                                </button>
                            </div>

                            {(!jobData.jd || selectedResumes.length === 0) && !scanning && (
                                <p className="text-xs text-center text-muted-foreground px-6">
                                    {!jobData.jd ? 'No job description found yet.' : 'Please select at least one resume to start.'}
                                </p>
                            )}
                        </section>

                        <AnalysisReport results={results} resumes={resumes} onHighlight={highlightOnPage} />
                    </>
                )}

                {activeTab === 'resumes' && (
                    <ResumeLibraryTab
                        resumes={resumes}
                        selectedCount={selectedResumes.length}
                        uploadingFiles={uploadingFiles}
                        showUploadZone={showUploadZone}
                        isDragOver={isDragOver}
                        fileInputRef={fileInputRef}
                        dropZoneRef={dropZoneRef}
                        onSelectAll={selectAll}
                        onFileUpload={handleFileUpload}
                        onToggleUploadZone={setShowUploadZone}
                        onToggleResumeSelect={toggleResumeSelect}
                        onDeleteResume={deleteResume}
                    />
                )}
                {activeTab === 'history' && <HistoryTab />}

                {activeTab === 'agent' && (
                    <ApplicationAgent
                        onJobPrepared={setJobData}
                        jobData={jobData}
                        selectedResumes={selectedResumes}
                        llmConfigs={llmConfigs}
                        llmConfigsLoading={llmConfigsLoading}
                        selectedLLMConfigId={settings.selectedLLMConfigId}
                        onSelectedLLMConfigChange={(id) => void handleSettingsChange({ selectedLLMConfigId: id })}
                        onConfigureProviders={() => setShowSettings(true)}
                    />
                )}

            </main>

            {/* Footer */}
            <footer className="px-4 py-3 bg-card border-t border-border/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                        Offline Storage Active
                    </div>
                    {resumes.length > 0 && (
                        <span className="text-xs text-muted-foreground font-medium">
                            {selectedResumes.length}/{resumes.length} selected
                        </span>
                    )}
                </div>
            </footer>

        </div>
    );

    // Render based on display mode
    if (isFloatingView) {
        return (
            <>
                <FloatingButton
                    onClick={() => setIsOverlayExpanded(true)}
                    isExpanded={isOverlayExpanded}
                />
                {isOverlayExpanded && (
                    <FloatingOverlay
                        onClose={() => setIsOverlayExpanded(false)}
                        onOpenSettings={() => setShowSettings(true)}
                    >
                        {mainContent}
                    </FloatingOverlay>
                )}
                <SettingsModal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                    settings={settings}
                    onSettingsChange={handleSettingsChange}
                    llmConfigs={llmConfigs}
                    onConfigsChange={() => fetchLLMConfigs().then(setLlmConfigs)}
                />
            </>
        );
    }

    // Sidebar mode (default)
    return (
        <>
            {mainContent}
            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                settings={settings}
                onSettingsChange={handleSettingsChange}
                llmConfigs={llmConfigs}
                onConfigsChange={() => {
                    // Reload configs when they change
                    fetchLLMConfigs().then(setLlmConfigs);
                }}
            />
        </>
    );
}
