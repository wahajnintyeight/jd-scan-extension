import { defineContentScript } from "wxt/utils/define-content-script";
import ReactDOM from "react-dom/client";
import React from "react";
import FloatingButton from "../../components/FloatingButton";
import FloatingOverlay from "../../components/FloatingOverlay";
import SidepanelApp from "../sidepanel/App";
import { loadSettings } from "../../utils/settings";
import "../../entrypoints/sidepanel/style.css";

function getElementText(el: Element | null): string {
    if (!el) return "";
    const anyEl = el as any;
    const text = (typeof anyEl.innerText === 'string' ? anyEl.innerText : el.textContent) || "";
    return text.replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n").trim();
}

function isLikelyJobPage(): boolean {
    const url = window.location.href.toLowerCase();
    const isJob = url.includes("linkedin.com/jobs") ||
        url.includes("linkedin.com/jobs") ||
        (url.includes("linkedin.com") && (url.includes("/jobs") || url.includes("/job/"))) ||
        url.includes("indeed.com") ||
        url.includes("glassdoor.com") ||
        url.includes("wellfound.com") ||
        url.includes("career") ||
        url.includes("/job/") ||
        url.includes("/jobs/") ||
        url.includes("apply");

    console.log("JD Scan: Path check", { url, isJob });
    return isJob;
}

function extractJobData(): { jd: string; title: string; company: string; debug?: any } {
    let jd = "";
    let title = "";
    let company = "";
    const debug: any = { tried: [], found: null, textLength: 0 };

    // LinkedIn Specifics - Try multiple strategies
    const linkedInSelectors = [
        // Job description containers
        ".jobs-description__content",
        ".jobs-description-content__text",
        ".jobs-description-content",
        ".jobs-box__html-content",
        "#job-details",
        ".jobs-search__job-details",
        ".jobs-search__job-details--wrapper",
        ".jobs-search__job-details--container",
        ".jobs-details__main-content",
        ".jobs-details__container",
        ".job-view-layout",
        "section.jobs-description",
        "[class*='jobs-description']",
        // More aggressive - any section with job-related text
        ".jobs-unified-top-card~div",
        ".jobs-search__right-rail",
    ];

    for (const selector of linkedInSelectors) {
        const el = document.querySelector(selector);
        debug.tried.push({ selector, found: !!el });
        if (el) {
            const text = getElementText(el);
            debug.found = { selector, textLength: text.length, preview: text.slice(0, 100) };
            if (text.length > jd.length && text.length > 50) {
                jd = text;
            }
        }
    }

    // If we found something, try to get title/company
    if (jd) {
        title = getElementText(document.querySelector(".jobs-unified-top-card__job-title")) ||
            getElementText(document.querySelector("h1")) ||
            getElementText(document.querySelector(".t-24.t-bold")) ||
            getElementText(document.querySelector("[class*='job-title']")) || "";
        company = getElementText(document.querySelector(".jobs-unified-top-card__company-name")) ||
            getElementText(document.querySelector(".jobs-unified-top-card__primary-description")) ||
            getElementText(document.querySelector(".jobs-company__name")) ||
            getElementText(document.querySelector("[class*='company-name']")) || "";
    }

    // Fallback: Look for job description by searching for common job description patterns
    if (!jd || jd.length < 100) {
        const allSections = document.querySelectorAll('section, article, div[role="main"], .jobs-box');
        for (const section of Array.from(allSections)) {
            const text = getElementText(section);
            // Look for sections with job-related keywords and decent length
            if (text.length > 200 && text.length < 10000) {
                const hasJobKeywords = /(?:requirements?|responsibilities?|qualifications?|experience|skills?|about (?:the )?job|description)/i.test(text);
                if (hasJobKeywords && text.length > (jd?.length || 0)) {
                    jd = text;
                    debug.fallback = { type: 'keyword-search', selector: section.className || section.tagName, length: text.length };
                }
            }
        }
    }

    // Last resort: Look at the right rail specifically
    if (!jd || jd.length < 100) {
        const rightRail = document.querySelector('.jobs-search__right-rail, .jobs-details__main-content, [class*="job-details"]');
        if (rightRail) {
            const text = getElementText(rightRail);
            if (text.length > jd.length) {
                jd = text;
                debug.lastResort = { found: true, length: text.length };
            }
        }
    }

    debug.final = { jdLength: jd.length, title, company };
    console.log("JD Scan: Extraction debug", debug);

    return { jd, title, company, debug };
}

// Content script overlay — SidepanelApp manages its own overlay/button UI internally
const OverlayApp = () => {
    const [isJobPage, setIsJobPage] = React.useState(isLikelyJobPage());

    React.useEffect(() => {
        console.log("JD Scan: OverlayApp mounted, isJobPage=", isJobPage);

        // Monitor URL changes for SPAs (LinkedIn, etc.)
        let lastUrl = window.location.href;
        const urlObserver = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                const currentIsJob = isLikelyJobPage();
                console.log("JD Scan: URL changed", { from: lastUrl, to: window.location.href, isJob: currentIsJob });
                lastUrl = window.location.href;
                setIsJobPage(currentIsJob);
            }
        });
        urlObserver.observe(document, { subtree: true, childList: true });
        return () => urlObserver.disconnect();
    }, []);

    if (!isJobPage) {
        return null;
    }

    console.log("JD Scan: Rendering SidepanelApp in overlay mode");

    // SidepanelApp handles the FloatingButton + FloatingOverlay rendering internally
    // when displayMode === 'overlay' (which it reads from chrome.storage)
    return (
        <div style={{ pointerEvents: 'auto' }}>
            <SidepanelApp />
        </div>
    );
};

export default defineContentScript({
    matches: ["*://*.linkedin.com/*", "*://*.indeed.com/*", "*://*.glassdoor.com/*", "*://*.wellfound.com/*"],
    async main() {
        console.log("JD Scan content script loaded");

        // Wait for document.body to be available
        const initializeExtension = () => {
            if (!document.body) {
                console.log("JD Scan: Waiting for document.body...");
                setTimeout(initializeExtension, 100);
                return;
            }

            // Always create container if we're on a supported host
            const container = document.createElement('div');
            container.id = 'jd-scan-overlay-root';
            container.style.position = 'fixed';
            container.style.zIndex = '2147483647'; // Maximum possible z-index
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '0';
            container.style.height = '0';
            container.style.overflow = 'visible';
            container.style.pointerEvents = 'none';
            document.body.appendChild(container);

            // Render the overlay
            const root = ReactDOM.createRoot(container);
            root.render(
                <React.StrictMode>
                    <OverlayApp />
                </React.StrictMode>
            );
        };

        // Start initialization
        initializeExtension();

        // Message listener for commands
        chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
            if (request.type === "GET_JD") {
                const data = extractJobData();
                sendResponse({ type: "JD_RESULT", data });
                return true;
            }

            if (request.type === "SCAN_PAGE") {
                const data = extractJobData();
                if (data.jd) {
                    chrome.runtime.sendMessage({ type: "JD_FOUND", data }).catch(() => { });
                }
                return true;
            }
        });

        // Proactively send JD if we think we are on a job page
        if (isLikelyJobPage()) {
            console.log("JD Scan: Starting proactive JD detection on", window.location.href);
            let lastSentKey = "";
            let debounceTimer: number | null = null;
            let attempts = 0;
            const maxAttempts = 20;

            // Define pollJD first
            const pollJD = (attemptNum: number = 1) => {
                const data = extractJobData();
                const jdOk = data.jd.length >= 80;
                const key = `${data.title}::${data.company}::${data.jd.slice(0, 300)}`;

                console.log(`JD Scan: Poll attempt ${attemptNum}`, { jdOk, jdLength: data.jd.length, title: data.title, company: data.company, keyPreview: key.slice(0, 50) });

                if (jdOk && key !== lastSentKey) {
                    lastSentKey = key;
                    console.log("JD Scan: Sending JD_FOUND", { title: data.title, jdLength: data.jd.length });
                    
                    // Method 1: Try sendMessage (may fail if sidepanel not ready)
                    try {
                        chrome.runtime.sendMessage({ type: "JD_FOUND", data }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.error("JD Scan: Send failed (expected if sidepanel closed)", chrome.runtime.lastError.message);
                            } else {
                                console.log("JD Scan: Send succeeded", response);
                            }
                        });
                    } catch (e) {
                        console.error("JD Scan: Send error", e);
                    }
                    
                    // Method 2: Also write to storage (reliable fallback)
                    chrome.storage?.local?.set({ 
                        jdScan_lastJob: { 
                            data, 
                            timestamp: Date.now(),
                            url: window.location.href 
                        } 
                    }).then(() => {
                        console.log("JD Scan: Saved to storage");
                    }).catch((err) => {
                        console.error("JD Scan: Storage save failed", err);
                    });
                    
                    return true;
                }
                if (!jdOk) {
                    console.log("JD Scan: JD not ready yet (length < 80)");
                } else if (key === lastSentKey) {
                    console.log("JD Scan: JD unchanged, skipping send");
                }
                return false;
            };

            const schedulePoll = (delayMs: number) => {
                if (debounceTimer) window.clearTimeout(debounceTimer);
                debounceTimer = window.setTimeout(() => {
                    attempts++;
                    const success = pollJD(attempts);
                    if (!success && attempts < maxAttempts) {
                        console.log(`JD Scan: Will retry (${attempts}/${maxAttempts})`);
                        // Actually schedule the next retry!
                        schedulePoll(1000);
                    }
                }, delayMs);
            };

            // Start polling
            schedulePoll(500);
            schedulePoll(1500);
            schedulePoll(3000);

            // LinkedIn SPA mutation observer
            const domObserver = new MutationObserver((mutations) => {
                const hasMeaningfulChange = mutations.some(m => 
                    m.type === 'childList' && 
                    ((m.target as Element).className?.includes('jobs') || 
                    (m.target as Element).className?.includes('description'))
                );
                if (hasMeaningfulChange && isLikelyJobPage()) {
                    console.log("JD Scan: Detected DOM change in job area");
                    schedulePoll(600);
                }
            });
            domObserver.observe(document.documentElement, { subtree: true, childList: true });

            // Poll on clicks
            document.addEventListener('click', () => {
                console.log("JD Scan: Click detected, scheduling poll");
                attempts = 0;
                schedulePoll(800);
                schedulePoll(2000);
            });
        }
    },
});
