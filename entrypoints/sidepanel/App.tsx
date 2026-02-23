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
    Briefcase
} from "lucide-react";

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
    "application/pdf": { color: "text-red-600", bg: "bg-red-50", border: "border-red-100", label: "PDF" },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", label: "DOCX" },
    "application/msword": { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", label: "DOC" },
    "text/plain": { color: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200", label: "TXT" },
};

function getFileTypeConfig(type: string) {
    return FILE_TYPE_CONFIG[type] || { color: "text-slate-500", bg: "bg-slate-50", border: "border-slate-100", label: "FILE" };
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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const dragCounter = useRef(0);

    useEffect(() => {
        chrome.storage?.local?.get("resumes", (data) => {
            if (data?.resumes) setResumes(data.resumes);
        });

        const messageListener = (msg: any) => {
            if (msg.type === "JD_FOUND") {
                setJobData(msg.data);
                if (!isManualMode && msg.data.jd) setIsManualMode(false);
            }
            if (msg.type === "SCAN_COMPLETE") {
                setResults(msg.data);
                setScanning(false);
            }
        };

        chrome.runtime?.onMessage.addListener(messageListener);
        return () => chrome.runtime?.onMessage.removeListener(messageListener);
    }, []);

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

    const startScan = () => {
        if (!jobData.jd || selectedResumes.length === 0) return;
        setScanning(true);
        chrome.runtime?.sendMessage({
            type: "SCAN_REQUEST",
            data: {
                jd: jobData.jd,
                resumes: selectedResumes.map((r) => ({ id: r.id, content: r.content })),
            },
        });
    };

    return (
        <div
            className="flex flex-col h-screen max-w-[400px] mx-auto bg-slate-50 premium-scrollbar overflow-hidden relative"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Global Drag Overlay */}
            {isDragOver && (
                <div className="absolute inset-0 z-50 bg-brand-600/10 backdrop-blur-sm border-2 border-dashed border-brand-400 rounded-2xl flex flex-col items-center justify-center pointer-events-none animate-in">
                    <div className="w-20 h-20 bg-brand-100 rounded-3xl flex items-center justify-center mb-4 shadow-lg animate-bounce-gentle">
                        <CloudUpload className="w-10 h-10 text-brand-600" />
                    </div>
                    <p className="text-lg font-bold text-brand-700 font-display">Drop your resumes here</p>
                    <p className="text-sm text-brand-500 mt-1">PDF, DOCX, DOC, TXT supported</p>
                </div>
            )}

            {/* Header */}
            <header className="px-6 py-5 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-lg shadow-brand-200">
                        <ScanLine className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 font-display">JD Scan</h1>
                        <p className="text-[10px] text-brand-600 font-bold uppercase tracking-widest">Pro Edition</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {resumes.length > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-50 rounded-lg mr-1">
                            <Files className="w-3.5 h-3.5 text-brand-600" />
                            <span className="text-xs font-bold text-brand-700">{resumes.length}</span>
                        </div>
                    )}
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Tabs Navigation */}
            <nav className="flex px-4 pt-4 pb-2 bg-white gap-2">
                {[
                    { id: 'match', label: 'Match', icon: TrendingUp },
                    { id: 'resumes', label: 'Resumes', icon: FileText, badge: resumes.length || undefined },
                    { id: 'history', label: 'History', icon: History },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 relative ${activeTab === tab.id
                            ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-100'
                            : 'text-slate-500 hover:bg-slate-50'
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
                                    <h3 className="text-sm font-bold text-slate-900 font-display">Target Job</h3>
                                    {!isManualMode && jobData.jd && (
                                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold rounded-md border border-green-100 uppercase tracking-tighter">
                                            <Globe className="w-2.5 h-2.5" /> Auto-Synced
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={fetchPageJD}
                                        className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors group"
                                        title="Re-scan current tab"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5 group-active:rotate-180 transition-transform duration-500" />
                                    </button>
                                    <button
                                        onClick={() => setIsManualMode(!isManualMode)}
                                        className={`p-1.5 rounded-lg transition-colors ${isManualMode ? 'bg-brand-100 text-brand-600' : 'text-slate-400 hover:text-brand-600 hover:bg-brand-50'}`}
                                        title="Toggle manual input"
                                    >
                                        <PencilLine className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className={`glass-card overflow-hidden transition-all duration-300 border-brand-100 bg-white/80 ${isManualMode ? 'p-2' : 'p-4'}`}>
                                {isManualMode ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={jobData.jd}
                                            onChange={(e) => setJobData({ ...jobData, jd: e.target.value })}
                                            placeholder="Paste the job description here..."
                                            className="w-full h-40 p-3 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-200 focus:border-brand-300 outline-none resize-none premium-scrollbar"
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Job Title (Optional)"
                                                value={jobData.title}
                                                onChange={(e) => setJobData({ ...jobData, title: e.target.value })}
                                                className="flex-1 p-2 text-[10px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-brand-300"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Company (Optional)"
                                                value={jobData.company}
                                                onChange={(e) => setJobData({ ...jobData, company: e.target.value })}
                                                className="flex-1 p-2 text-[10px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-brand-300"
                                            />
                                        </div>
                                    </div>
                                ) : jobData.jd ? (
                                    <>
                                        {(jobData.title || jobData.company) && (
                                            <div className="flex flex-col gap-1 mb-3 pb-3 border-b border-slate-100">
                                                {jobData.title && (
                                                    <div className="flex items-center gap-2 text-slate-800">
                                                        <Briefcase className="w-3.5 h-3.5 text-brand-500" />
                                                        <span className="text-sm font-bold truncate tracking-tight">{jobData.title}</span>
                                                    </div>
                                                )}
                                                {jobData.company && (
                                                    <div className="flex items-center gap-2 text-slate-500">
                                                        <Building2 className="w-3.5 h-3.5" />
                                                        <span className="text-xs font-semibold truncate tracking-tight">{jobData.company}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="text-xs text-slate-600 line-clamp-4 leading-relaxed italic">
                                            "{jobData.jd}"
                                        </div>
                                        <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
                                            <span className="text-[10px] text-slate-400 font-medium">Character count: {jobData.jd.length}</span>
                                            <button
                                                onClick={() => setJobData({ jd: "", title: "", company: "" })}
                                                className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-tight"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-6 text-center">
                                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Globe className="w-6 h-6 text-slate-200" />
                                        </div>
                                        <p className="text-xs text-slate-500 px-4 leading-relaxed">
                                            Open a job page to capture automatically or <button onClick={() => setIsManualMode(true)} className="text-brand-600 font-bold hover:underline">enter manually</button>.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Selected Resumes Indicator */}
                        {resumes.length > 0 && (
                            <section className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-sm font-bold text-slate-900 font-display">Selected Resumes</h3>
                                    <button
                                        onClick={() => setActiveTab('resumes')}
                                        className="text-[10px] font-bold text-brand-600 hover:text-brand-700 flex items-center gap-0.5"
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
                                                    <span className="text-xs font-medium text-slate-700 max-w-[120px] truncate">{r.name}</span>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">No resumes selected. Go to Resumes tab to select.</p>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* Scan Action */}
                        <section className="space-y-4 pt-2">
                            <button
                                onClick={startScan}
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
                                        <span>Run Match Analysis</span>
                                        {selectedResumes.length > 0 && (
                                            <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                                                {selectedResumes.length} resume{selectedResumes.length > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>

                            {(!jobData.jd || selectedResumes.length === 0) && !scanning && (
                                <p className="text-[10px] text-center text-slate-400 px-6">
                                    {!jobData.jd ? 'No job description found yet.' : 'Please select at least one resume to start.'}
                                </p>
                            )}
                        </section>

                        {/* Results Preview */}
                        {results.length > 0 && (
                            <section className="space-y-4 animate-in">
                                <h3 className="text-sm font-bold text-slate-900 font-display">Analysis Report</h3>
                                {results.map((result, idx) => (
                                    <div
                                        key={result.resumeId}
                                        className="glass-card glass-card-hover p-4 border-l-4 border-l-brand-500"
                                        style={{ animationDelay: `${idx * 100}ms` }}
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2 max-w-[180px]">
                                                <FileText className="w-4 h-4 text-brand-500 shrink-0" />
                                                <span className="text-sm font-bold text-slate-800 truncate">
                                                    {resumes.find((r) => r.id === result.resumeId)?.name || 'Resume'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className={`text-xl font-bold font-display ${result.score >= 80 ? "text-green-600" :
                                                    result.score >= 60 ? "text-amber-600" : "text-rose-600"
                                                    }`}>
                                                    {result.score}%
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">Match Score</span>
                                            </div>
                                        </div>

                                        <div className="space-y-3 pt-2">
                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${result.score >= 80 ? "bg-gradient-to-r from-green-400 to-green-600" :
                                                        result.score >= 60 ? "bg-gradient-to-r from-amber-400 to-amber-600" : "bg-gradient-to-r from-rose-400 to-rose-600"
                                                        }`}
                                                    style={{ width: `${result.score}%` }}
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pt-2">
                                                <div className="bg-green-50/50 p-2.5 rounded-xl border border-green-100/50">
                                                    <span className="text-[9px] font-bold text-green-700 uppercase block mb-1">Matched</span>
                                                    <span className="text-sm font-bold text-green-800">{result.matchedKeywords.length}</span>
                                                </div>
                                                <div className="bg-rose-50/50 p-2.5 rounded-xl border border-rose-100/50">
                                                    <span className="text-[9px] font-bold text-rose-700 uppercase block mb-1">Missing</span>
                                                    <span className="text-sm font-bold text-rose-800">{result.missingKeywords.length}</span>
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
                                <h3 className="text-sm font-bold text-slate-900 font-display">Resume Library</h3>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    {resumes.length > 0
                                        ? `${selectedResumes.length} of ${resumes.length} selected for scanning`
                                        : "Upload resumes to get started"}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {resumes.length > 0 && (
                                    <button
                                        onClick={selectAll}
                                        className="text-[10px] font-bold text-brand-600 hover:text-brand-700 px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors"
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
                                    ? "border-brand-400 bg-brand-50/60 scale-[1.02]"
                                    : "border-slate-200 hover:border-brand-300 hover:bg-brand-50/30 bg-white/50"
                                    }`}
                            >
                                <div className="flex flex-col items-center gap-3">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${isDragOver
                                        ? "bg-brand-100 shadow-lg scale-110"
                                        : "bg-slate-100 group-hover:bg-brand-100 group-hover:shadow-md"
                                        }`}>
                                        <ArrowUpFromLine className={`w-8 h-8 transition-colors duration-300 ${isDragOver ? "text-brand-600" : "text-slate-300 group-hover:text-brand-500"
                                            }`} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800">
                                            {isDragOver ? "Drop files to upload" : "Drag & drop resumes here"}
                                        </h4>
                                        <p className="text-xs text-slate-400 mt-1">
                                            or <span className="text-brand-600 font-semibold">click to browse</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        {["PDF", "DOCX", "DOC", "TXT"].map((ext) => (
                                            <span
                                                key={ext}
                                                className="text-[9px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md"
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
                                            ? "bg-green-100"
                                            : uf.status === "error"
                                                ? "bg-red-100"
                                                : "bg-brand-50"
                                            }`}>
                                            {uf.status === "done" ? (
                                                <Check className="w-4.5 h-4.5 text-green-600" />
                                            ) : uf.status === "error" ? (
                                                <X className="w-4.5 h-4.5 text-red-500" />
                                            ) : (
                                                <div className="w-4.5 h-4.5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-slate-700 truncate">{uf.name}</p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-300 ${uf.status === "done"
                                                            ? "bg-green-500"
                                                            : uf.status === "error"
                                                                ? "bg-red-400"
                                                                : "bg-brand-500"
                                                            }`}
                                                        style={{ width: `${uf.progress}%` }}
                                                    />
                                                </div>
                                                <span className="text-[9px] font-medium text-slate-400 w-8 text-right">
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
                                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 hover:border-brand-300 rounded-xl text-xs font-semibold text-slate-400 hover:text-brand-600 transition-all duration-200 hover:bg-brand-50/30"
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
                                                ? "ring-2 ring-brand-200 border-brand-100 bg-brand-50/30"
                                                : "hover:shadow-premium-hover hover:-translate-y-0.5"
                                                }`}
                                            style={{ animationDelay: `${idx * 60}ms` }}
                                            onClick={() => toggleResumeSelect(resume.id)}
                                        >
                                            {/* Selection Checkbox */}
                                            <div
                                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${resume.selected
                                                    ? "bg-brand-600 border-brand-600"
                                                    : "border-slate-300 group-hover:border-brand-400"
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
                                                <h4 className="text-sm font-bold text-slate-800 truncate">{resume.name}</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${ftConf.bg} ${ftConf.color}`}>
                                                        {ftConf.label}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">{formatFileSize(resume.fileSize)}</span>
                                                    <span className="text-[10px] text-slate-300">·</span>
                                                    <span className="text-[10px] text-slate-400">{timeAgo(resume.uploadedAt)}</span>
                                                </div>
                                            </div>

                                            {/* Delete */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteResume(resume.id);
                                                }}
                                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
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
                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300">
                                <History className="w-8 h-8" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-900">No scan history</h4>
                                <p className="text-xs text-slate-500 px-8 mt-1">Your past scan results will appear here.</p>
                            </div>
                        </div>
                    </section>
                )}

            </main>

            {/* Footer */}
            <footer className="px-6 py-4 bg-white border-t border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse-soft" />
                        Offline Storage Active
                    </div>
                    {resumes.length > 0 && (
                        <span className="text-[10px] text-slate-400 font-medium">
                            {selectedResumes.length}/{resumes.length} selected
                        </span>
                    )}
                </div>
            </footer>
        </div>
    );
}
