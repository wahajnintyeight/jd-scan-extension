import { FileText, Sparkles } from 'lucide-react';
import { Resume, ScanResult } from './types';

interface AnalysisReportProps {
  results: ScanResult[];
  resumes: Resume[];
  onHighlight: (resumeContent: string) => void;
}

export default function AnalysisReport({ results, resumes, onHighlight }: AnalysisReportProps) {
  if (results.length === 0) return null;

  return (
    <section className="space-y-4 animate-in">
      <h3 className="text-sm font-bold text-foreground font-display">Analysis Report</h3>
      {results.map((result) => {
        const resume = resumes.find((item) => item.id === result.resumeId);
        return (
          <div key={result.resumeId} className="glass-card p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex min-w-0 flex-1 items-center gap-2 pr-3">
                <FileText className="w-4 h-4 text-brand-500 shrink-0" />
                <span className="text-sm font-bold text-foreground truncate">{resume?.name || 'Resume'}</span>
              </div>
              <div className="flex shrink-0 flex-col items-end tabular-nums">
                <span className={`text-xl font-bold font-display ${result.score >= 80 ? 'text-green-600 dark:text-green-400' : result.score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {result.score}%
                </span>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-tighter">Match Score</span>
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${result.score >= 80 ? 'bg-green-500' : result.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${result.score}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="bg-green-50/50 dark:bg-green-900/20 p-2.5 rounded-xl border border-green-100/50 dark:border-green-900/50">
                  <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase block mb-1">Matched</span>
                  <span className="text-sm font-bold text-green-800 dark:text-green-300">{result.matchedKeywords.length}</span>
                </div>
                <div className="bg-rose-50/50 dark:bg-rose-900/20 p-2.5 rounded-xl border border-rose-100/50 dark:border-rose-900/50">
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase block mb-1">Missing</span>
                  <span className="text-sm font-bold text-rose-800 dark:text-rose-300">{result.missingKeywords.length}</span>
                </div>
              </div>
              {resume && (
                <div className="pt-3 border-t border-border/30">
                  <button onClick={() => onHighlight(resume.content)} className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors border border-brand-200 dark:border-brand-800">
                    <Sparkles className="w-3 h-3" /> Highlight on Page
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
