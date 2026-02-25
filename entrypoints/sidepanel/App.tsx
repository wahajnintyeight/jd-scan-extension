import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    FileText,
    ScanLine,
    Upload,
    X,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    TrendingUp,
    History,
    Settings,
    Plus,
    File,
    FileType2,
    Trash2,
    Check,
    CloudUpload,
    Sparkles,
    ArrowUpFromLine,
    Files,
    GripVertical,
    RefreshCw,
    PencilLine,
    Globe,
    Building2,
    Briefcase,
    Cpu
} from "lucide-react";
import { scanMultipleResumes } from "../../utils/atsScanner";
import { loadSettings, saveSettings, UserSettings, DEFAULT_SETTINGS, applyColorMode } from "../../utils/settings";
import { getSessionId } from "../../utils/session";
import { scanResumeATS, fetchLLMConfigs, LLMAPIConfig } from "../../utils/api";
import SettingsModal from "../../components/SettingsModal";
import FloatingOverlay from "../../components/FloatingOverlay";
import FloatingButton from "../../components/FloatingButton";

interface JobData {
    jd: string;
    title: string;
    company: string;
}

interface Resume {
    id: string;
    name: string;
    content: string;
    fileSize: number;
    fileType: string;
    uploadedAt: string;
    selected: boolean;
}

interface UploadingFile {
    id: string;
    name: string;
    progress: number;
    status: "uploading" | "processing" | "done" | "error";
    error?: string;
}

interface ScanResult {
    resumeId: string;
    score: number;
    matchedKeywords: string[];
    missingKeywords: string[];
    suggestions: string[];
}

const FILE_TYPE_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
    "application/pdf": { color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-100 dark:border-red-800", label: "PDF" },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-100 dark:border-blue-800", label: "DOCX" },
    "application/msword": { color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-100 dark:border-blue-800", label: "DOC" },
    "text/plain": { color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800/50", border: "border-slate-200 dark:border-slate-700", label: "TXT" },
};

function getFileTypeConfig(type: string) {
    return FILE_TYPE_CONFIG[type] || { color: "text-slate-500 dark:text-slate-300", bg: "bg-slate-50 dark:bg-slate-800/50", border: "border-slate-100 dark:border-slate-700", label: "FILE" };
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.txt";
const ACCEPTED_MIMES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
];

export default function App() {
    const [resumes, setResumes] = useState<Resume[]>([]);
    const [jobData, setJobData] = useState<JobData>({ jd: "", title: "", company: "" });
    const [isManualMode, setIsManualMode] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [results, setResults] = useState<ScanResult[]>([]);
    const [activeTab, setActiveTab] = useState<'match' | 'resumes' | 'history'>('match');
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [showUploadZone, setShowUploadZone] = useState(false);
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    const [isOverlayExpanded, setIsOverlayExpanded] = useState(false);
    const [llmConfigs, setLlmConfigs] = useState<LLMAPIConfig[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const dragCounter = useRef(0);

    // Load settings on mount
    useEffect(() => {
        (async () => {
            const loaded = await loadSettings();
            setSettings(loaded);
            applyColorMode(loaded.colorMode);

            const configs = await fetchLLMConfigs();
            setLlmConfigs(configs);

            if (!loaded.selectedLLMConfigId && configs.length > 0) {
                const activeConfigs = configs.filter((c) => c.isActive);
                const autoConfig = (activeConfigs.length === 1 ? activeConfigs[0] : (configs.find((c) => c.isActive) || configs[0]));
                if (autoConfig) {
                    await handleSettingsChange({ selectedLLMConfigId: autoConfig.id });
                }
            }
        })();

        // Initialize session
        getSessionId().then((sessionId) => {
            if (sessionId) {
                console.log('Session initialized:', sessionId);
            } else {
                console.error('Failed to initialize session');
            }
        });
    }, []);

    useEffect(() => {
        chrome.storage?.local?.get("resumes", (data) => {
            if (data?.resumes && Array.isArray(data.resumes)) {
                setResumes(data.resumes as Resume[]);
            }
        });

        // Check for any stored job data on mount
        chrome.storage?.local?.get("jdScan_lastJob", (data: any) => {
            if (data?.jdScan_lastJob?.data?.jd) {
                console.log("JD Scan Sidepanel: Loaded stored job data", data.jdScan_lastJob.data);
                setJobData(data.jdScan_lastJob.data);
                if (!isManualMode) setIsManualMode(false);
            }
        });

        const messageListener = (msg: any) => {
            console.log("JD Scan Sidepanel: Received message", msg.type, msg);
            if (msg.type === "JD_FOUND") {
                console.log("JD Scan Sidepanel: Setting job data from message", msg.data);
                setJobData(msg.data);
                if (!isManualMode && msg.data.jd) setIsManualMode(false);
            }
            if (msg.type === "SCAN_COMPLETE") {
                setResults(msg.data);
                setScanning(false);
            }
            if (msg.type === "SETTINGS_UPDATED") {
                setSettings(msg.settings);
                applyColorMode(msg.settings.colorMode);
            }
        };

        // Listen for storage changes (reliable fallback)
        const storageListener = (changes: any, namespace: string) => {
            if (namespace === 'local' && changes.jdScan_lastJob) {
                const newData = changes.jdScan_lastJob.newValue?.data;
                if (newData?.jd) {
                    console.log("JD Scan Sidepanel: Received job data via storage", newData);
                    setJobData(newData);
                    if (!isManualMode) setIsManualMode(false);
                }
            }
        };

        chrome.runtime?.onMessage.addListener(messageListener);
        chrome.storage?.onChanged?.addListener(storageListener);

        return () => {
            chrome.runtime?.onMessage.removeListener(messageListener);
            chrome.storage?.onChanged?.removeListener(storageListener);
        };
    }, []);

    const handleSettingsChange = async (newSettings: Partial<UserSettings>) => {
        setSettings((prev) => {
            const updated = { ...prev, ...newSettings };
            if (newSettings.colorMode) {
                applyColorMode(newSettings.colorMode);
            }
            return updated;
        });
        await saveSettings(newSettings);
    };

    const processFiles = useCallback(async (fileList: FileList | File[]) => {
        const files = Array.from(fileList).filter((f) =>
            ACCEPTED_MIMES.includes(f.type) || f.name.endsWith('.txt')
        );

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

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const entryId = uploadEntries[i].id;

            try {
                // Simulate upload progress
                for (let p = 0; p <= 70; p += 15) {
                    await new Promise((r) => setTimeout(r, 80));
                    setUploadingFiles((prev) =>
                        prev.map((u) => u.id === entryId ? { ...u, progress: p } : u)
                    );
                }

                // Processing phase
                setUploadingFiles((prev) =>
                    prev.map((u) => u.id === entryId ? { ...u, progress: 80, status: "processing" } : u)
                );

                let content = "";
                if (file.type === "text/plain" || file.name.endsWith('.txt')) {
                    content = await file.text();
                } else {
                    // For PDF/DOCX: read as text placeholder (real impl would use pdf-parse or mammoth)
                    content = `Parsed content of ${file.name}`;
                }

                await new Promise((r) => setTimeout(r, 200));

                setUploadingFiles((prev) =>
                    prev.map((u) => u.id === entryId ? { ...u, progress: 100, status: "done" } : u)
                );

                newResumes.push({
                    id: crypto.randomUUID(),
                    name: file.name,
                    content,
                    fileSize: file.size,
                    fileType: file.type || "text/plain",
                    uploadedAt: new Date().toISOString(),
                    selected: true,
                });
            } catch (err) {
                setUploadingFiles((prev) =>
                    prev.map((u) =>
                        u.id === entryId
                            ? { ...u, status: "error", error: "Failed to process file" }
                            : u
                    )
                );
            }
        }

        // Clear upload indicators after a short delay
        setTimeout(() => {
            setUploadingFiles((prev) => prev.filter((u) => u.status !== "done"));
        }, 1500);

        if (newResumes.length > 0) {
            setResumes((prev) => {
                const updated = [...prev, ...newResumes];
                chrome.storage?.local?.set({ resumes: updated });
                return updated;
            });
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

    const selectedResumes = resumes.filter((r) => r.selected);

    const fetchPageJD = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, { type: "GET_JD" }, (response: any) => {
                    if (response?.data?.jd) {
                        setJobData(response.data);
                        setIsManualMode(false);
                    }
                });
            }
        });
    };

    const startAIScan = async () => {
        if (!jobData.jd || selectedResumes.length === 0) return;

        // Ensure we have an LLM config selected. "Active" and "Selected" are different concepts;
        // if none is selected, auto-pick an active config (or fallback) and persist it.
        let llmConfigIdToUse = settings.selectedLLMConfigId;
        if (!llmConfigIdToUse) {
            const configsToPickFrom = llmConfigs.length > 0 ? llmConfigs : await fetchLLMConfigs();
            if (llmConfigs.length === 0 && configsToPickFrom.length > 0) {
                setLlmConfigs(configsToPickFrom);
            }

            const activeConfigs = configsToPickFrom.filter((c) => c.isActive);
            const autoConfig = (activeConfigs.length === 1
                ? activeConfigs[0]
                : (configsToPickFrom.find((c) => c.isActive) || configsToPickFrom[0]));

            if (autoConfig?.id) {
                llmConfigIdToUse = autoConfig.id;
                await handleSettingsChange({ selectedLLMConfigId: autoConfig.id });
            }
        }

        if (!llmConfigIdToUse) {
            alert('Please select an LLM configuration in Settings before scanning.');
            setShowSettings(true);
            return;
        }

        setScanning(true);

        try {
            // Scan each resume using the backend API
            const scanPromises = selectedResumes.map(async (resume) => {
                const result = await scanResumeATS(
                    llmConfigIdToUse!,
                    resume.content,
                    jobData.jd
                );

                if (result.success && result.data) {
                    // Extract ATS score from the response
                    const atsScore = result.data.ats_score || {};

                    return {
                        resumeId: resume.id,
                        score: atsScore.score || atsScore.matchPercentage || 0,
                        matchedKeywords: atsScore.matchedKeywords || atsScore.matched_keywords || [],
                        missingKeywords: atsScore.missingKeywords || atsScore.missing_keywords || [],
                        suggestions: atsScore.suggestions || [],
                    };
                } else {
                    // Fallback to local scanner if API fails
                    console.warn(`API scan failed for ${resume.name}, using local scanner:`, result.error);
                    const localResult = scanMultipleResumes(
                        [{ id: resume.id, content: resume.content }],
                        jobData.jd
                    );
                    return localResult[0];
                }
            });

            const scanResults = await Promise.all(scanPromises);
            setResults(scanResults);
        } catch (error) {
            console.error('Scan failed:', error);
            // Fallback to local scanner on error
            const scanResults = scanMultipleResumes(
                selectedResumes.map((r) => ({ id: r.id, content: r.content })),
                jobData.jd
            );
            setResults(scanResults);
        } finally {
            setScanning(false);
        }
    };

    const startLocalScan = () => {
        if (!jobData.jd || selectedResumes.length === 0) return;
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

    const mainContent = (
        <div
            className="flex flex-col h-full max-w-[400px] mx-auto bg-background premium-scrollbar overflow-hidden relative"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Global Drag Overlay */}
            {isDragOver && (
                <div className="absolute inset-0 z-50 bg-brand-600/10 backdrop-blur-sm border-2 border-dashed border-brand-400 rounded-2xl flex flex-col items-center justify-center pointer-events-none animate-in">
                    <div className="w-20 h-20 bg-brand-100 dark:bg-brand-900/30 rounded-3xl flex items-center justify-center mb-4 shadow-lg animate-bounce-gentle">
                        <CloudUpload className="w-10 h-10 text-brand-600" />
                    </div>
                    <p className="text-lg font-bold text-brand-700 dark:text-brand-400 font-display">Drop your resumes here</p>
                    <p className="text-sm text-brand-500 mt-1">PDF, DOCX, DOC, TXT supported</p>
                </div>
            )}

            {/* Header */}
            <header className="px-6 py-5 bg-card border-b border-border flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-lg shadow-brand-200/50">
                        <ScanLine className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-foreground font-display">JD Scan</h1>
                        <p className="text-[10px] text-brand-600 font-bold uppercase tracking-widest">Pro Edition</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {resumes.length > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-50 dark:bg-brand-900/30 rounded-lg mr-1">
                            <Files className="w-3.5 h-3.5 text-brand-600" />
                            <span className="text-xs font-bold text-brand-700 dark:text-brand-400">{resumes.length}</span>
                        </div>
                    )}
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        title="Settings"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Tabs Navigation */}
            <nav className="flex px-4 pt-4 pb-2 bg-card gap-2">
                {[
                    { id: 'match', label: 'Match', icon: TrendingUp },
                    { id: 'resumes', label: 'Resumes', icon: FileText, badge: resumes.length || undefined },
                    { id: 'history', label: 'History', icon: History },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 relative ${activeTab === tab.id
                            ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 shadow-sm border border-brand-100 dark:border-brand-900'
                            : 'text-muted-foreground hover:bg-muted/50'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        {tab.badge && tab.badge > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm">
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </nav>

            {/* Main Content Areas */}
            <main className="flex-1 overflow-y-auto px-6 py-4 space-y-6 premium-scrollbar animate-in">

                {activeTab === 'match' && (
                    <>
                        {/* JD Status Card */}
                        <section className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-foreground font-display">Target Job</h3>
                                    {!isManualMode && jobData.jd && (
                                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-bold rounded-md border border-green-100 dark:border-green-900 uppercase tracking-tighter">
                                            <Globe className="w-2.5 h-2.5" /> Auto-Synced
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={fetchPageJD}
                                        className="p-1.5 text-muted-foreground hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors group"
                                        title="Re-scan current tab"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5 group-active:rotate-180 transition-transform duration-500" />
                                    </button>
                                    <button
                                        onClick={() => setIsManualMode(!isManualMode)}
                                        className={`p-1.5 rounded-lg transition-colors ${isManualMode ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-600' : 'text-muted-foreground hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30'}`}
                                        title="Toggle manual input"
                                    >
                                        <PencilLine className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className={`glass-card overflow-hidden transition-all duration-300 ${isManualMode ? 'p-2' : 'p-4'}`}>
                                {isManualMode ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={jobData.jd}
                                            onChange={(e) => setJobData({ ...jobData, jd: e.target.value })}
                                            placeholder="Paste the job description here..."
                                            className="w-full h-40 p-3 text-xs text-foreground bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-brand-200 focus:border-brand-300 outline-none resize-none premium-scrollbar"
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Job Title (Optional)"
                                                value={jobData.title}
                                                onChange={(e) => setJobData({ ...jobData, title: e.target.value })}
                                                className="flex-1 p-2 text-[10px] bg-muted/50 border border-border rounded-lg outline-none focus:border-brand-300 text-foreground"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Company (Optional)"
                                                value={jobData.company}
                                                onChange={(e) => setJobData({ ...jobData, company: e.target.value })}
                                                className="flex-1 p-2 text-[10px] bg-muted/50 border border-border rounded-lg outline-none focus:border-brand-300 text-foreground"
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
                                        <div className="text-xs text-muted-foreground line-clamp-4 leading-relaxed italic">
                                            "{jobData.jd}"
                                        </div>
                                        <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/50">
                                            <span className="text-[10px] text-muted-foreground/60 font-medium">Character count: {jobData.jd.length}</span>
                                            <button
                                                onClick={() => setJobData({ jd: "", title: "", company: "" })}
                                                className="text-[10px] font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 uppercase tracking-tight"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-6 text-center">
                                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Globe className="w-6 h-6 text-muted-foreground/30" />
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
                                        className="text-[10px] font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 flex items-center gap-0.5"
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
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${ftConf.bg} ${ftConf.border} transition-all`}
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
                            {/* LLM Config Indicator */}
                            {settings.selectedLLMConfigId && llmConfigs.length > 0 && (
                                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-50 to-brand-50 dark:from-purple-900/20 dark:to-brand-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
                                    <div className="p-1.5 bg-background rounded-lg shadow-sm">
                                        <Cpu className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-tight">AI Model</p>
                                        <p className="text-xs font-semibold text-foreground truncate">
                                            {llmConfigs.find(c => c.id === settings.selectedLLMConfigId)?.name || 'Unknown'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowSettings(true)}
                                        className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 px-2 py-1 hover:bg-background/50 rounded-lg transition-colors"
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
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Analyzing Keywords...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5" />
                                            <span>AI Scan</span>
                                            {selectedResumes.length > 0 && (
                                                <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
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
                                <p className="text-[10px] text-center text-muted-foreground/60 px-6">
                                    {!jobData.jd ? 'No job description found yet.' : 'Please select at least one resume to start.'}
                                </p>
                            )}
                        </section>

                        {/* Results Preview */}
                        {results.length > 0 && (
                            <section className="space-y-4 animate-in">
                                <h3 className="text-sm font-bold text-foreground font-display">Analysis Report</h3>
                                {results.map((result, idx) => (
                                    <div
                                        key={result.resumeId}
                                        className="glass-card glass-card-hover p-4 border-l-4 border-l-brand-500"
                                        style={{ animationDelay: `${idx * 100}ms` }}
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2 max-w-[180px]">
                                                <FileText className="w-4 h-4 text-brand-500 shrink-0" />
                                                <span className="text-sm font-bold text-foreground truncate">
                                                    {resumes.find((r) => r.id === result.resumeId)?.name || 'Resume'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className={`text-xl font-bold font-display ${result.score >= 80 ? "text-green-600 dark:text-green-400" :
                                                    result.score >= 60 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
                                                    }`}>
                                                    {result.score}%
                                                </span>
                                                <span className="text-[9px] text-muted-foreground/60 font-medium uppercase tracking-tighter">Match Score</span>
                                            </div>
                                        </div>

                                        <div className="space-y-3 pt-2">
                                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${result.score >= 80 ? "bg-gradient-to-r from-green-400 to-green-600" :
                                                        result.score >= 60 ? "bg-gradient-to-r from-amber-400 to-amber-600" : "bg-gradient-to-r from-rose-400 to-rose-600"
                                                        }`}
                                                    style={{ width: `${result.score}%` }}
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pt-2">
                                                <div className="bg-green-50/50 dark:bg-green-900/20 p-2.5 rounded-xl border border-green-100/50 dark:border-green-900/50">
                                                    <span className="text-[9px] font-bold text-green-700 dark:text-green-400 uppercase block mb-1">Matched</span>
                                                    <span className="text-sm font-bold text-green-800 dark:text-green-300">{result.matchedKeywords.length}</span>
                                                </div>
                                                <div className="bg-rose-50/50 dark:bg-rose-900/20 p-2.5 rounded-xl border border-rose-100/50 dark:border-rose-900/50">
                                                    <span className="text-[9px] font-bold text-rose-700 dark:text-rose-400 uppercase block mb-1">Missing</span>
                                                    <span className="text-sm font-bold text-rose-800 dark:text-rose-300">{result.missingKeywords.length}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </section>
                        )}
                    </>
                )}

                {activeTab === 'resumes' && (
                    <section className="space-y-5 animate-in">
                        {/* Header Row */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-foreground font-display">Resume Library</h3>
                                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                    {resumes.length > 0
                                        ? `${selectedResumes.length} of ${resumes.length} selected for scanning`
                                        : "Upload resumes to get started"}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {resumes.length > 0 && (
                                    <button
                                        onClick={selectAll}
                                        className="text-[10px] font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 px-2 py-1 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors"
                                    >
                                        {resumes.every((r) => r.selected) ? "Deselect All" : "Select All"}
                                    </button>
                                )}
                                <label className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.97]">
                                    <Plus className="w-3.5 h-3.5" />
                                    Add
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept={ACCEPTED_TYPES}
                                        multiple
                                        onChange={handleFileUpload}
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Upload Zone */}
                        {(showUploadZone || resumes.length === 0) && (
                            <div
                                ref={dropZoneRef}
                                onClick={() => fileInputRef.current?.click()}
                                className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 group ${isDragOver
                                    ? "border-brand-400 bg-brand-50/60 dark:bg-brand-900/20 scale-[1.02]"
                                    : "border-border hover:border-brand-300 hover:bg-brand-50/30 dark:hover:bg-brand-900/10 bg-card/50"
                                    }`}
                            >
                                <div className="flex flex-col items-center gap-3">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${isDragOver
                                        ? "bg-brand-100 dark:bg-brand-900/40 shadow-lg scale-110"
                                        : "bg-muted group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 group-hover:shadow-md"
                                        }`}>
                                        <ArrowUpFromLine className={`w-8 h-8 transition-colors duration-300 ${isDragOver ? "text-brand-600" : "text-muted-foreground/30 group-hover:text-brand-500"
                                            }`} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-foreground">
                                            {isDragOver ? "Drop files to upload" : "Drag & drop resumes here"}
                                        </h4>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            or <span className="text-brand-600 dark:text-brand-400 font-semibold">click to browse</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        {["PDF", "DOCX", "DOC", "TXT"].map((ext) => (
                                            <span
                                                key={ext}
                                                className="text-[9px] font-bold uppercase bg-muted text-muted-foreground px-2 py-0.5 rounded-md"
                                            >
                                                {ext}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Upload Progress */}
                        {uploadingFiles.length > 0 && (
                            <div className="space-y-2">
                                {uploadingFiles.map((uf) => (
                                    <div
                                        key={uf.id}
                                        className="glass-card p-3 flex items-center gap-3 animate-in"
                                    >
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${uf.status === "done"
                                            ? "bg-green-100 dark:bg-green-900/40"
                                            : uf.status === "error"
                                                ? "bg-red-100 dark:bg-red-900/40"
                                                : "bg-brand-50 dark:bg-brand-900/40"
                                            }`}>
                                            {uf.status === "done" ? (
                                                <Check className="w-4.5 h-4.5 text-green-600 dark:text-green-400" />
                                            ) : uf.status === "error" ? (
                                                <X className="w-4.5 h-4.5 text-rose-500 dark:text-rose-400" />
                                            ) : (
                                                <div className="w-4.5 h-4.5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-foreground truncate">{uf.name}</p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-300 ${uf.status === "done"
                                                            ? "bg-green-500"
                                                            : uf.status === "error"
                                                                ? "bg-rose-400"
                                                                : "bg-brand-500"
                                                            }`}
                                                        style={{ width: `${uf.progress}%` }}
                                                    />
                                                </div>
                                                <span className="text-[9px] font-medium text-muted-foreground w-8 text-right">
                                                    {uf.status === "done"
                                                        ? "✓"
                                                        : uf.status === "error"
                                                            ? "✗"
                                                            : `${uf.progress}%`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Toggle upload zone button (when resumes exist and zone is hidden) */}
                        {resumes.length > 0 && !showUploadZone && (
                            <button
                                onClick={() => setShowUploadZone(true)}
                                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border hover:border-brand-300 rounded-xl text-xs font-semibold text-muted-foreground/60 hover:text-brand-600 transition-all duration-200 hover:bg-brand-50/30 dark:hover:bg-brand-900/10"
                            >
                                <Upload className="w-4 h-4" />
                                Upload more resumes
                            </button>
                        )}

                        {/* Resume List */}
                        {resumes.length > 0 && (
                            <div className="space-y-2.5">
                                {resumes.map((resume, idx) => {
                                    const ftConf = getFileTypeConfig(resume.fileType);
                                    return (
                                        <div
                                            key={resume.id}
                                            className={`glass-card p-4 flex items-center gap-3 group transition-all duration-200 cursor-pointer ${resume.selected
                                                ? "ring-2 ring-brand-200 border-brand-100 bg-brand-50/30 dark:bg-brand-900/20"
                                                : "hover:shadow-premium-hover hover:-translate-y-0.5"
                                                }`}
                                            style={{ animationDelay: `${idx * 60}ms` }}
                                            onClick={() => toggleResumeSelect(resume.id)}
                                        >
                                            {/* Selection Checkbox */}
                                            <div
                                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${resume.selected
                                                    ? "bg-brand-600 border-brand-600"
                                                    : "border-border group-hover:border-brand-400"
                                                    }`}
                                            >
                                                {resume.selected && <Check className="w-3 h-3 text-white" />}
                                            </div>

                                            {/* File Type Icon */}
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${ftConf.bg} ${ftConf.border}`}>
                                                <FileText className={`w-5 h-5 ${ftConf.color}`} />
                                            </div>

                                            {/* File Info */}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold text-foreground truncate">{resume.name}</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${ftConf.bg} ${ftConf.color}`}>
                                                        {ftConf.label}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground/60">{formatFileSize(resume.fileSize)}</span>
                                                    <span className="text-[10px] text-muted-foreground/30">·</span>
                                                    <span className="text-[10px] text-muted-foreground/60">{timeAgo(resume.uploadedAt)}</span>
                                                </div>
                                            </div>

                                            {/* Delete */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteResume(resume.id);
                                                }}
                                                className="p-2 text-muted-foreground/30 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                )}

                {activeTab === 'history' && (
                    <section className="animate-in">
                        <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center text-muted-foreground/30">
                                <History className="w-8 h-8" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-foreground">No scan history</h4>
                                <p className="text-xs text-muted-foreground px-8 mt-1">Your past scan results will appear here.</p>
                            </div>
                        </div>
                    </section>
                )}

            </main>

            {/* Footer */}
            <footer className="px-6 py-4 bg-card border-t border-border/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 font-medium">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse-soft" />
                        Offline Storage Active
                    </div>
                    {resumes.length > 0 && (
                        <span className="text-[10px] text-muted-foreground/60 font-medium">
                            {selectedResumes.length}/{resumes.length} selected
                        </span>
                    )}
                </div>
            </footer>

        </div>
    );

    // Render based on display mode
    if (settings.displayMode === 'overlay') {
        return (
            <>
                <FloatingButton
                    onClick={() => setIsOverlayExpanded(true)}
                    isExpanded={isOverlayExpanded}
                />
                {isOverlayExpanded && (
                    <FloatingOverlay
                        onClose={() => setIsOverlayExpanded(false)}
                    >
                        {mainContent}
                    </FloatingOverlay>
                )}
                <SettingsModal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                    settings={settings}
                    onSettingsChange={handleSettingsChange}
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
