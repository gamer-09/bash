/**
 * Background service worker for WiFi Auto-Login extension
 */

// Initialize default settings on installation
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        // Set default enabled state
        const result = await chrome.storage.local.get(['enabled']);
        if (result.enabled === undefined) {
            await chrome.storage.local.set({ enabled: true });
        }
        
        // Open options page on first install
        chrome.runtime.openOptionsPage();
    }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getStatus') {
        chrome.storage.local.get(['enabled', 'username'], (result) => {
            sendResponse({
                enabled: result.enabled !== false,
                hasCredentials: !!(result.username)
            });
        });
        return true; // Indicates we will send a response asynchronously
    }
});



