export interface JobData {
    jd: string;
    title: string;
    company: string;
    element: Element | null;
    debug?: any;
}

export interface SiteAdapter {
    /**
     * Check if this adapter supports the current URL
     */
    isMatch(url: string): boolean;

    /**
     * Extract job data from the current page
     */
    getJobData(): JobData;

    /**
     * Optional: Perform custom highlighting. 
     * If not provided, the default DOM highlighter will be used.
     * Returns the highlight result (matched/unmatched counts).
     */
    highlight?(element: Element, resumeContent: string): { matchedCount: number; unmatchedCount: number } | null;
}
