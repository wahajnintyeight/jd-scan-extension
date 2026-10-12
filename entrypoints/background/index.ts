import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";
import { API_BASE_URL } from "../../utils/apiTransport";
import { PAGE_MESSAGE_TYPES } from "../../utils/browserTabs";
import { openAndPrepareJob, readSmartRecruitersPosting } from './jobLinks';
import { runApplication } from './applicationRun';
import { draftApplicationField } from './fieldAnswer';

export default defineBackground({
    type: "module",
    main() {
        console.log("JD Scan background script initialized");

        // Handle messages from sidepanel or content script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request?.type === 'JD_SCAN_DRAFT_APPLICATION_FIELD') {
                if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id) ||
                    typeof request.fieldId !== 'string' || typeof request.fieldLabel !== 'string' || request.fieldLabel.length > 300 ||
                    typeof request.fieldType !== 'string' || typeof request.expectedUrl !== 'string' || sender.tab.url !== request.expectedUrl) {
                    sendResponse({ success: false, error: 'Untrusted field-draft request.' });
                    return false;
                }
                draftApplicationField({ tabId: sender.tab.id, fieldId: request.fieldId, fieldLabel: request.fieldLabel,
                    fieldType: request.fieldType, expectedUrl: request.expectedUrl })
                    .then(result => sendResponse({ success: true, ...result }))
                    .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : 'Could not draft this answer.' }));
                return true;
            }
            if (request?.type === 'JD_SCAN_RUN_APPLICATION') {
                if (sender.id !== chrome.runtime.id || (sender.tab?.id !== undefined && sender.tab.id !== request.input?.tabId)) {
                    sendResponse({ success: false, error: 'Untrusted application run.' });
                    return false;
                }
                runApplication(request.input || {}).then(result => sendResponse({ success: true, ...result }))
                    .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : 'Could not start the application run.' }));
                return true;
            }
            if (request?.type === 'JD_SCAN_OPEN_JOB_LINK' || request?.type === 'JD_SCAN_READ_SMART_JOB') {
                if (sender.id !== chrome.runtime.id || typeof request.url !== 'string' ||
                    (request.type === 'JD_SCAN_READ_SMART_JOB' && sender.tab?.url !== request.url)) {
                    sendResponse({ success: false, error: 'Untrusted job-link request.' });
                    return false;
                }
                const task = request.type === 'JD_SCAN_OPEN_JOB_LINK'
                    ? openAndPrepareJob(request.url)
                    : readSmartRecruitersPosting(request.url).then(posting => ({ posting }));
                task.then(result => sendResponse({ success: true, ...result }))
                    .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : 'Could not prepare this job link.' }));
                return true;
            }
            if (request?.type === "JD_SCAN_GET_ACTIVE_TAB") {
                if (sender.id !== chrome.runtime.id) {
                    sendResponse({ success: false, error: "Untrusted tab request." });
                    return false;
                }
                const tabs = browser.tabs ?? chrome.tabs;
                const sourceTab = sender.tab;
                if (sourceTab?.active && Number.isInteger(sourceTab.id) && /^https?:\/\//i.test(sourceTab.url || '')) {
                    sendResponse({ success: true, tab: { id: sourceTab.id, url: sourceTab.url } });
                    return false;
                }
                if (typeof tabs?.query !== "function") {
                    sendResponse({ success: false, error: "JD Scan cannot access browser tabs in its background worker. Reload the extension from the production build and restart the browser if needed." });
                    return false;
                }
                tabs.query({ active: true, currentWindow: true })
                    .then(([tab]) => sendResponse(tab && Number.isInteger(tab.id) && /^https?:\/\//i.test(tab.url || '') &&
                        (sender.tab?.id === undefined || sender.tab.id === tab.id)
                        ? { success: true, tab: { id: tab.id, url: tab.url } }
                        : { success: false, error: "Open the job website in the active tab, then reopen the assistant." }))
                    .catch(() => sendResponse({ success: false, error: "Could not read the active browser tab." }));
                return true;
            }

            if (request?.type === "JD_SCAN_SEND_TAB_MESSAGE") {
                if (
                    sender.id !== chrome.runtime.id ||
                    !Number.isInteger(request.tabId) ||
                    request.tabId < 0 ||
                    !PAGE_MESSAGE_TYPES.has(request.message?.type) ||
                    (sender.tab?.id !== undefined && sender.tab.id !== request.tabId)
                ) {
                    sendResponse({ success: false, error: "Untrusted application action." });
                    return false;
                }
                const tabs = browser.tabs ?? chrome.tabs;
                if (typeof tabs?.sendMessage !== "function") {
                    sendResponse({ success: false, error: "JD Scan cannot communicate with browser tabs. Reload the extension and try again." });
                    return false;
                }
                const activeTab = sender.tab?.active && sender.tab.id === request.tabId
                    ? Promise.resolve(sender.tab)
                    : typeof tabs.query === "function"
                        ? tabs.query({ active: true, currentWindow: true }).then(([tab]) => tab)
                        : Promise.reject(new Error("JD Scan cannot verify the active tab. Open the application tab and try again."));
                activeTab
                    .then((tab) => {
                        if (tab?.id !== request.tabId || !/^https?:\/\//i.test(tab.url || '')) {
                            throw new Error("Switch back to the application website before continuing.");
                        }
                        return tabs.sendMessage(request.tabId, request.message);
                    })
                    .then((response) => sendResponse({ success: true, response }))
                    .catch((error: unknown) => sendResponse({
                        success: false,
                        error: error instanceof Error && /receiving end does not exist|message port closed/i.test(error.message)
                            ? "Refresh the website to load the updated JD Scan extension, then reopen the assistant."
                            : error instanceof Error ? error.message : "Could not reach the active page.",
                    }));
                return true;
            }

            if (request?.type === "JD_SCAN_API_REQUEST") {
                if (sender.id !== chrome.runtime.id || typeof request.url !== "string") {
                    sendResponse({ success: false, error: "Untrusted API request." });
                    return false;
                }

                const apiBase = new URL(API_BASE_URL);
                let target: URL;
                try {
                    target = new URL(request.url);
                } catch {
                    sendResponse({ success: false, error: "Invalid API URL." });
                    return false;
                }

                const apiPath = apiBase.pathname.replace(/\/+$/, "");
                const method = typeof request.method === "string" ? request.method.toUpperCase() : "GET";
                if (
                    target.origin !== apiBase.origin ||
                    target.username !== "" ||
                    target.password !== "" ||
                    target.hash !== "" ||
                    !(target.pathname === apiPath || target.pathname.startsWith(`${apiPath}/`)) ||
                    !["GET", "POST", "PUT", "DELETE"].includes(method)
                ) {
                    sendResponse({ success: false, error: "API request is outside the configured API." });
                    return false;
                }

                const headers = new Headers();
                for (const [name, value] of Object.entries(request.headers || {})) {
                    if (!["content-type", "sessionid"].includes(name.toLowerCase()) || typeof value !== "string") {
                        sendResponse({ success: false, error: "Unsupported API request header." });
                        return false;
                    }
                    headers.set(name, value);
                }

                if (request.body !== undefined && typeof request.body !== "string") {
                    sendResponse({ success: false, error: "Invalid API request body." });
                    return false;
                }

                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 90_000);
                fetch(target, {
                    method,
                    headers,
                    body: method === "GET" ? undefined : request.body,
                    signal: controller.signal,
                })
                    .then(async (response) => sendResponse({
                        success: true,
                        status: response.status,
                        statusText: response.statusText,
                        contentType: response.headers.get("Content-Type") || undefined,
                        body: await response.text(),
                    }))
                    .catch((error) => sendResponse({
                        success: false,
                        error: error instanceof Error ? error.message : "API request failed.",
                    }))
                    .finally(() => clearTimeout(timeout));
                return true;
            }

            if (request.type === "SCAN_REQUEST") {
                console.log("Scan request received in background", request.data);

                // Proxy to Go backend
                fetch("http://localhost:8080/api/scan", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(request.data),
                })
                    .then(res => {
                        if (!res.ok) throw new Error(`Backend error: ${res.statusText}`);
                        return res.json();
                    })
                    .then(data => {
                        console.log("Scan complete, sending results to UI");
                        chrome.runtime.sendMessage({ type: "SCAN_COMPLETE", data });
                    })
                    .catch(err => {
                        console.error("Scan failed:", err);
                        chrome.runtime.sendMessage({
                            type: "SCAN_COMPLETE",
                            error: err.message,
                            data: [] // Empty results on error
                        });
                    });
            }

            if (request.type === "JD_FOUND") {
                console.log("JD found via content script, broadcasting to sidepanel");
                // Re-broadcast to anyone listening (e.g., sidepanel)
                chrome.runtime.sendMessage(request).catch(() => {
                    // Ignore error if sidepanel isn't open
                });
            }
        });

        // Auto-extract JD when tab updates to a job page
        browser.tabs?.onUpdated?.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === "complete" && tab.url) {
                if (tab.url.includes("linkedin.com/jobs") || tab.url.includes("indeed.com")) {
                    console.log("Detected job page, triggering extraction");
                    chrome.tabs.sendMessage(tabId, { type: "GET_JD" }, (response) => {
                        if (response && response.data) {
                            chrome.runtime.sendMessage({ type: "JD_FOUND", data: response.data }).catch(() => { });
                        }
                    });
                }
            }
        });
    },
});
