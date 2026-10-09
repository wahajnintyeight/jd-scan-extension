/**
 * HighlightedJobDescription Component
 * Displays job descriptions with keyword highlighting based on resume matching
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Eye, EyeOff, Info, TrendingUp, AlertCircle } from 'lucide-react';
import { highlightKeywords, removeHighlighting, HighlightConfig, HighlightResult } from '../utils/keywordHighlighter';

interface HighlightedJobDescriptionProps {
  jobDescription: string;
  resumeContent: string;
  className?: string;
  showToggle?: boolean;
  showStats?: boolean;
  config?: Partial<HighlightConfig>;
  maxHeight?: string;
}

const DEFAULT_CONFIG: HighlightConfig = {
  matchedColor: '#059669',
  unmatchedColor: '#dc2626', 
  matchedBgColor: '#d1fae5',
  unmatchedBgColor: '#fee2e2',
  className: 'jd-scan-highlight'
};

export default function HighlightedJobDescription({
  jobDescription,
  resumeContent,
  className = '',
  showToggle = true,
  showStats = true,
  config = {},
  maxHeight = '400px'
}: HighlightedJobDescriptionProps) {
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [highlightResult, setHighlightResult] = useState<HighlightResult | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Memoize the merged config to prevent infinite re-renders
  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [
    config?.matchedColor,
    config?.unmatchedColor, 
    config?.matchedBgColor,
    config?.unmatchedBgColor,
    config?.className
  ]);

  useEffect(() => {
    if (!jobDescription || !resumeContent) {
      setHighlightResult(null);
      return;
    }
    
    try {
      // Generate highlight result for stats
      const result = highlightKeywords(jobDescription, resumeContent, mergedConfig);
      setHighlightResult(result);
    } catch (error) {
      console.error('Error generating highlight result:', error);
      setHighlightResult(null);
    }
  }, [jobDescription, resumeContent, mergedConfig]);

  const toggleHighlighting = () => {
    if (!highlightResult) return;
    
    try {
      setIsHighlighted(!isHighlighted);
    } catch (error) {
      console.error('Error toggling highlights:', error);
    }
  };

  const matchPercentage = highlightResult 
    ? Math.round((highlightResult.stats.matchedCount / Math.max(highlightResult.stats.totalKeywords, 1)) * 100)
    : 0;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header with toggle and stats */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Job Description</h4>
          
          {showToggle && (
            <button
              onClick={toggleHighlighting}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted shrink-0"
              disabled={!highlightResult}
            >
              {isHighlighted ? (
                <>
                  <EyeOff className="w-3 h-3" />
                  <span className="hidden sm:inline">Hide</span>
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3" />
                  <span className="hidden sm:inline">Show</span>
                </>
              )}
            </button>
          )}
        </div>

        {showStats && highlightResult && (
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 dark:bg-green-900/20 rounded">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              <span className="text-[10px] font-medium text-green-700 dark:text-green-300">
                {highlightResult.stats.matchedCount}
              </span>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 rounded">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
              <span className="text-[10px] font-medium text-red-700 dark:text-red-300">
                {highlightResult.stats.unmatchedCount}
              </span>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 rounded">
              <TrendingUp className="w-2.5 h-2.5 text-blue-600" />
              <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300">
                {matchPercentage}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {isHighlighted && (
        <div className="flex items-center gap-2 p-1.5 bg-muted/30 rounded border border-border/50">
          <div className="flex items-center gap-1">
            <Info className="w-2.5 h-2.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Legend:</span>
          </div>
          <div className="flex items-center gap-1">
            <span 
              className="px-1.5 py-0.5 text-[10px] rounded"
              style={{ 
                backgroundColor: mergedConfig.matchedBgColor,
                border: `1px solid ${mergedConfig.matchedColor}40`
              }}
            >
              Matched
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span 
              className="px-1.5 py-0.5 text-[10px] rounded"
              style={{ 
                backgroundColor: mergedConfig.unmatchedBgColor,
                border: `1px solid ${mergedConfig.unmatchedColor}40`
              }}
            >
              Missing
            </span>
          </div>
        </div>
      )}

      {/* Job Description Content */}
      <div 
        ref={contentRef}
        className="p-3 bg-card border border-border rounded-lg text-xs sm:text-sm text-foreground leading-relaxed overflow-y-auto"
        style={{ maxHeight }}
      >
        {!isHighlighted ? (
          <div className="whitespace-pre-wrap">{jobDescription}</div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: highlightResult?.highlightedHtml || jobDescription }} />
        )}
      </div>

      {/* Warning for no resume content */}
      {!resumeContent && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded">
          <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
          <span className="text-[10px] text-amber-700 dark:text-amber-300">
            Select a resume to see keyword highlighting
          </span>
        </div>
      )}
    </div>
  );
}