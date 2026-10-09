import { BaseAdapter } from './base';
import { SiteAdapter, JobData } from './types';
import { highlightInDOM, HighlightResult } from '../keywordHighlighter';

export class LinkedInAdapter extends BaseAdapter implements SiteAdapter {
    isMatch(url: string): boolean {
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes("linkedin.com/jobs") || 
               (lowerUrl.includes("linkedin.com") && (lowerUrl.includes("/jobs") || lowerUrl.includes("/job/")));
    }

    getJobData(): JobData {
        const selectors = [
            // Primary job description containers (most specific first)
            ".jobs-description__content .jobs-description-content__text",
            ".jobs-description__content",
            ".jobs-description-content__text", 
            ".jobs-description-content",
            ".jobs-box__html-content",
            ".jobs-box__group",
            
            // Job details containers
            "#job-details",
            ".jobs-search__job-details--container",
            ".jobs-search__job-details--wrapper",
            ".jobs-search__job-details",
            ".jobs-details__main-content",
            ".jobs-details__container",
            
            // Layout containers
            ".job-view-layout",
            ".jobs-unified-top-card__content--two-pane",
            
            // Section-based selectors
            "section.jobs-description",
            "section[class*='jobs-description']",
            
            // Attribute-based selectors (more flexible)
            "[class*='jobs-description-content']",
            "[class*='jobs-description']",
            
            // Right rail (fallback)
            ".jobs-search__right-rail .jobs-description",
            ".jobs-search__right-rail"
        ];

        let jd = "";
        let jobElement: Element | null = null;
        let debug: any = { method: 'linkedin-selectors', tried: [] };

        for (const selector of selectors) {
            const el = document.querySelector(selector);
            debug.tried.push({ selector, found: !!el, length: el ? this.getElementText(el).length : 0 });
            
            if (el) {
                const text = this.getElementText(el);
                // Prioritize elements with substantial content
                if (text.length > jd.length && text.length > 100) {
                    jd = text;
                    jobElement = el;
                    debug.selected = { selector, length: text.length };
                }
            }
        }

        // If we still don't have good content, try finding by looking for "About the job" or similar headers
        if (!jd || jd.length < 200) {
            const headers = document.querySelectorAll('h2, h3, .jobs-box__title');
            for (const header of Array.from(headers)) {
                const headerText = this.getElementText(header).toLowerCase();
                if (headerText.includes('about') || headerText.includes('description') || headerText.includes('job')) {
                    // Look for the next sibling or parent container
                    let container = header.parentElement;
                    while (container && container !== document.body) {
                        const text = this.getElementText(container);
                        if (text.length > 200 && text.length > jd.length) {
                            jd = text;
                            jobElement = container;
                            debug.fallback = { method: 'header-search', headerText, length: text.length };
                            break;
                        }
                        container = container.parentElement;
                    }
                }
            }
        }

        const title = this.getElementText(document.querySelector(".jobs-unified-top-card__job-title")) ||
                      this.getElementText(document.querySelector("h1")) ||
                      this.getElementText(document.querySelector(".t-24.t-bold")) ||
                      this.getElementText(document.querySelector("[class*='job-title']"));

        const company = this.getElementText(document.querySelector(".jobs-unified-top-card__company-name")) ||
                        this.getElementText(document.querySelector(".jobs-unified-top-card__primary-description")) ||
                        this.getElementText(document.querySelector(".jobs-company__name")) ||
                        this.getElementText(document.querySelector("[class*='company-name']"));

        console.log('LinkedIn adapter debug:', debug);
        return this.createJobData(jd, title, company, jobElement, debug);
    }

    highlight(element: Element, resumeContent: string): { matchedCount: number; unmatchedCount: number } | null {
        // Use generic highlight for now
        const result = highlightInDOM(element, resumeContent);
        return {
            matchedCount: result.stats.matchedCount,
            unmatchedCount: result.stats.unmatchedCount
        };
    }
}
