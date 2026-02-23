import { defineContentScript } from "wxt/utils/define-content-script";

function isLikelyJobPage(): boolean {
    const url = window.location.href;
    return url.includes("linkedin.com/jobs") ||
        url.includes("indeed.com") ||
        url.includes("glassdoor.com") ||
        url.includes("wellfound.com") || // angel.co
        url.includes("/job/");
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

export default defineContentScript({
    matches: ["<all_urls>"],
    main() {
        console.log("JD Scan content script loaded");

        chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
            if (request.type === "GET_JD") {
                const data = extractJobData();
                sendResponse({ type: "JD_RESULT", data });
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
