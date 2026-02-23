import { defineContentScript } from "wxt/utils/define-content-script";
import ReactDOM from "react-dom/client";
import React from "react";
import FloatingButton from "../../components/FloatingButton";
import FloatingOverlay from "../../components/FloatingOverlay";
import SidepanelApp from "../sidepanel/App";
import { loadSettings } from "../../utils/settings";
import "../../entrypoints/sidepanel/style.css";

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

function extractJobData(): { jd: string; title: string; company: string } {
    let jd = "";
    let title = "";
    let company = "";

    // LinkedIn Specifics
    const linkedInJD = document.querySelector(".jobs-description__content") ||
        document.querySelector(".jobs-box__html-content") ||
        document.querySelector("#job-details") ||
        document.querySelector(".jobs-search__job-details") || // Search view right pane
        document.querySelector(".job-view-layout");

    if (linkedInJD) {
        jd = linkedInJD.textContent?.trim() || "";
        // Try to find title/company in the details pane
        title = document.querySelector(".jobs-unified-top-card__job-title")?.textContent?.trim() ||
            document.querySelector(".t-24.t-bold")?.textContent?.trim() || "";
        company = document.querySelector(".jobs-unified-top-card__company-name")?.textContent?.trim() ||
            document.querySelector(".jobs-unified-top-card__primary-description")?.textContent?.trim() || "";
    }

    // Indeed Specifics
    if (!jd) {
        const indeedJD = document.querySelector("#jobDescriptionText") ||
            document.querySelector(".jobsearch-JobComponent-description");
        if (indeedJD) {
            jd = indeedJD.textContent?.trim() || "";
            title = document.querySelector(".jobsearch-JobInfoHeader-title")?.textContent?.trim() || "";
            company = document.querySelector('[data-company-name="true"]')?.textContent?.trim() || "";
        }
    }

    // Generic fallback
    if (!jd) {
        const selectors = [
            '[data-testid="jobDescription"]',
            '.job-description',
            '#job-description',
            '.description',
            'article',
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent && element.textContent.length > 200) {
                jd = element.textContent.trim();
                break;
            }
        }
    }

    // Last resort generic page scan
    if (!jd && isLikelyJobPage()) {
        jd = document.body.innerText.substring(0, 10000).trim();
    }

    return { jd, title, company };
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
            const pollJD = () => {
                const data = extractJobData();
                if (data.jd.length > 200) {
                    chrome.runtime.sendMessage({ type: "JD_FOUND", data }).catch(() => { });
                }
            };

            setTimeout(pollJD, 2000);
            // Also poll on clicks since LinkedIn is a SPA and might change view
            document.addEventListener('click', () => setTimeout(pollJD, 1000));
        }
    },
});
