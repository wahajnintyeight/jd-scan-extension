import { defineBackground } from "wxt/utils/define-background";
import { API_BASE_URL } from "../../utils/apiTransport";

export default defineBackground({
    type: "module",
    main() {
        console.log("JD Scan background script initialized");

        // Handle messages from sidepanel or content script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
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
