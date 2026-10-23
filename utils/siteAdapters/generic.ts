import { BaseAdapter } from './base';
import { SiteAdapter, JobData } from './types';
import { highlightInDOM } from '../keywordHighlighter';
import { getApplicationFormRoots } from '../applicationDom';

export class GenericAdapter extends BaseAdapter implements SiteAdapter {
    isMatch(url: string): boolean {
        // Fallback for any other URL that might be a job page
        return true;
    }

    getJobData(): JobData {
        if (window.location.hostname === 'jobs.ashbyhq.com' && /\/application\/?$/.test(window.location.pathname)) {
            return this.createJobData('', this.getElementText(document.querySelector('h1')), '', null);
        }
        let jd = "";
        let jobElement: Element | null = null;
        let debug: any = { method: 'generic-heuristic', tried: [] };
        const applicationForms = getApplicationFormRoots();
        const getPostingText = (section: Element) => {
            if (applicationForms.some(form => form === section || form.contains(section))) return '';
            if (!applicationForms.some(form => section.contains(form))) return this.getElementText(section);

            // Some ATS pages put the application form below the job description
            // in one large content container. Strip that subtree before scoring
            // the page so form labels and controls never become part of the JD.
            const copy = section.cloneNode(true) as Element;
            copy.querySelectorAll('form, [role="form"], .ashby-application-form-container, script, style, noscript').forEach(form => form.remove());
            return this.getElementText(copy);
        };

        // Fallback: Look for job description by searching for common job description patterns
        const allSections = document.querySelectorAll('section, article, div[role="main"], .jobs-box, main, [data-ui], [data-testid], div, p');
        
        for (const section of Array.from(allSections)) {
            const text = getPostingText(section);
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
                    const text = getPostingText(element);
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
        const host = window.location.hostname;
        const usesCompanySlug = host === 'jobs.ashbyhq.com' || host === 'job-boards.greenhouse.io' || host === 'boards.greenhouse.io';
        const companySlug = usesCompanySlug ? window.location.pathname.split('/').filter(Boolean)[0] : '';
        const company = companySlug
            ? companySlug.replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
            : '';

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
