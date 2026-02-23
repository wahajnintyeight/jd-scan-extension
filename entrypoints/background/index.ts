import { defineBackground } from "wxt/utils/define-background";

export default defineBackground({
    type: "module",
    main() {
        console.log("JD Scan background script initialized");

        // Handle messages from sidepanel or content script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
