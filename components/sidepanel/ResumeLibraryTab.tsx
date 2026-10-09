import { ChangeEvent, RefObject } from 'react';
import { ArrowUpFromLine, Check, FileText, Plus, Trash2, Upload, X } from 'lucide-react';
import { ACCEPTED_TYPES, formatFileSize, getFileTypeConfig, timeAgo } from './resumeHelpers';
import { Resume, UploadingFile } from './types';

interface ResumeLibraryTabProps {
  resumes: Resume[];
  selectedCount: number;
  uploadingFiles: UploadingFile[];
  showUploadZone: boolean;
  isDragOver: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  dropZoneRef: RefObject<HTMLDivElement | null>;
  onSelectAll: () => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggleUploadZone: (visible: boolean) => void;
  onToggleResumeSelect: (id: string) => void;
  onDeleteResume: (id: string) => void;
}

export default function ResumeLibraryTab({
  resumes,
  selectedCount,
  uploadingFiles,
  showUploadZone,
  isDragOver,
  fileInputRef,
  dropZoneRef,
  onSelectAll,
  onFileUpload,
  onToggleUploadZone,
  onToggleResumeSelect,
  onDeleteResume,
}: ResumeLibraryTabProps) {
  const allSelected = resumes.length > 0 && resumes.every((resume) => resume.selected);

  return (
    <section className="space-y-5 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground font-display">Resume Library</h3>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {resumes.length > 0 ? `${selectedCount} of ${resumes.length} selected for scanning` : 'Upload resumes to get started'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {resumes.length > 0 && (
            <button onClick={onSelectAll} className="text-[10px] font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 px-2 py-1 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors">
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          )}
          <label className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors duration-200 shadow-md ">
            <Plus className="w-3.5 h-3.5" /> Add
            <input ref={fileInputRef} type="file" className="hidden" accept={ACCEPTED_TYPES} multiple onChange={onFileUpload} />
          </label>
        </div>
      </div>

      {(showUploadZone || resumes.length === 0) && (
        <div ref={dropZoneRef} onClick={() => fileInputRef.current?.click()} className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors duration-300 group ${isDragOver ? 'border-brand-400 bg-brand-50/60 dark:bg-brand-900/20 ' : 'border-border hover:border-brand-300 hover:bg-brand-50/30 dark:hover:bg-brand-900/10 bg-card/50'}`}>
          <div className="flex flex-col items-center gap-3">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300 ${isDragOver ? 'bg-brand-100 dark:bg-brand-900/40 shadow-lg ' : 'bg-muted group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 group-hover:shadow-md'}`}>
              <ArrowUpFromLine className={`w-8 h-8 transition-colors duration-300 ${isDragOver ? 'text-brand-600' : 'text-muted-foreground/30 group-hover:text-brand-500'}`} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">{isDragOver ? 'Drop files to upload' : 'Drag & drop resumes here'}</h4>
              <p className="text-xs text-muted-foreground mt-1">or <span className="text-brand-600 dark:text-brand-400 font-semibold">click to browse</span></p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {['PDF', 'DOCX', 'DOC', 'TXT'].map((ext) => <span key={ext} className="text-[9px] font-bold uppercase bg-muted text-muted-foreground px-2 py-0.5 rounded-md">{ext}</span>)}
            </div>
          </div>
        </div>
      )}

      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((file) => (
            <div key={file.id} className="glass-card p-3 flex items-center gap-3 animate-in">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${file.status === 'done' ? 'bg-green-100 dark:bg-green-900/40' : file.status === 'error' ? 'bg-red-100 dark:bg-red-900/40' : 'bg-brand-50 dark:bg-brand-900/40'}`}>
                {file.status === 'done' ? <Check className="w-4.5 h-4.5 text-green-600 dark:text-green-400" /> : file.status === 'error' ? <X className="w-4.5 h-4.5 text-rose-500 dark:text-rose-400" /> : <div className="w-4.5 h-4.5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{file.name}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${file.status === 'done' ? 'bg-green-500' : file.status === 'error' ? 'bg-rose-400' : 'bg-brand-500'}`} style={{ width: `${file.progress}%` }} />
                  </div>
                  <span className="text-[9px] font-medium text-muted-foreground w-8 text-right">{file.status === 'done' ? '✓' : file.status === 'error' ? '×' : `${file.progress}%`}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {resumes.length > 0 && !showUploadZone && (
        <button onClick={() => onToggleUploadZone(true)} className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border hover:border-brand-300 rounded-xl text-xs font-semibold text-muted-foreground/60 hover:text-brand-600 transition-colors duration-200 hover:bg-brand-50/30 dark:hover:bg-brand-900/10">
          <Upload className="w-4 h-4" /> Upload more resumes
        </button>
      )}

      {resumes.length > 0 && (
        <div className="space-y-2.5">
          {resumes.map((resume, idx) => {
            const fileType = getFileTypeConfig(resume.fileType);
            return (
              <div key={resume.id} className={`glass-card p-4 flex items-center gap-3 group transition-colors duration-200 cursor-pointer ${resume.selected ? 'ring-2 ring-brand-200 border-brand-100 bg-brand-50/30 dark:bg-brand-900/20' : 'hover:shadow-premium-hover '}`} style={{ animationDelay: `${idx * 60}ms` }} onClick={() => onToggleResumeSelect(resume.id)}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors duration-200 ${resume.selected ? 'bg-brand-600 border-brand-600' : 'border-border group-hover:border-brand-400'}`}>
                  {resume.selected && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${fileType.bg} ${fileType.border}`}>
                  <FileText className={`w-5 h-5 ${fileType.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-foreground truncate">{resume.name}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${fileType.bg} ${fileType.color}`}>{fileType.label}</span>
                    <span className="text-[10px] text-muted-foreground/60">{formatFileSize(resume.fileSize)}</span>
                    <span className="text-[10px] text-muted-foreground/30">·</span>
                    <span className="text-[10px] text-muted-foreground/60">{timeAgo(resume.uploadedAt)}</span>
                  </div>
                </div>
                <button onClick={(event) => { event.stopPropagation(); onDeleteResume(resume.id); }} className="p-2 text-muted-foreground/30 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100" aria-label={`Delete ${resume.name}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
