import { BaseAdapter } from './base';
import { SiteAdapter, JobData } from './types';
import { highlightInDOM } from '../keywordHighlighter';

export class GenericAdapter extends BaseAdapter implements SiteAdapter {
    isMatch(url: string): boolean {
        // Fallback for any other URL that might be a job page
        return true;
    }

    getJobData(): JobData {
        let jd = "";
        let jobElement: Element | null = null;
        let debug: any = { method: 'generic-heuristic', tried: [] };

        // Fallback: Look for job description by searching for common job description patterns
        const allSections = document.querySelectorAll('section, article, div[role="main"], .jobs-box, main, [data-ui], [data-testid], div, p');
        
        for (const section of Array.from(allSections)) {
            const text = this.getElementText(section);
            // Look for sections with job-related keywords and decent length
            if (text.length > 200 && text.length < 15000) {
                const hasJobKeywords = /(?:requirements?|responsibilities?|qualifications?|experience|skills?|about (?:the )?job|description|role overview|what you.ll do|what we.re looking for|about (?:the )?role|job summary|position|candidate|apply|responsibilities|duties)/i.test(text);
                
                if (hasJobKeywords && text.length > (jd?.length || 0)) {
                    jd = text;
                    jobElement = section;
                }
            }
        }

        // Last resort: Look at common main content areas
        if (!jd || jd.length < 100) {
            const lastResortSelectors = [
                'main', 
                '[role="main"]',
                '.main-content',
                '.content',
                'body'
            ];
            
            for (const selector of lastResortSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const text = this.getElementText(element);
                    if (text.length > 500 && text.length > jd.length) {
                        jd = text;
                        jobElement = element;
                        break;
                    }
                }
            }
        }

        const title = this.getElementText(document.querySelector("h1")) || 
                      this.getElementText(document.querySelector("title"));
        const company = ""; // Hard to guess generically

        return this.createJobData(jd, title, company, jobElement, debug);
    }

    highlight(element: Element, resumeContent: string): { matchedCount: number; unmatchedCount: number } | null {
        const result = highlightInDOM(element, resumeContent);
        return {
            matchedCount: result.stats.matchedCount,
            unmatchedCount: result.stats.unmatchedCount
        };
    }
}
