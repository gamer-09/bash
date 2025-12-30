/**
 * Popup script for WiFi Auto-Login extension
 */

document.addEventListener('DOMContentLoaded', async () => {
    const statusDiv = document.getElementById('status');
    const toggleBtn = document.getElementById('toggleBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    
    // Load current status
    async function updateStatus() {
        const result = await chrome.storage.local.get(['enabled', 'username']);
        
        if (result.enabled) {
            statusDiv.textContent = '✓ Auto-login enabled';
            statusDiv.className = 'status enabled';
            toggleBtn.textContent = 'Disable Auto-Login';
        } else {
            statusDiv.textContent = '✗ Auto-login disabled';
            statusDiv.className = 'status disabled';
            toggleBtn.textContent = 'Enable Auto-Login';
        }
        
        if (!result.username) {
            statusDiv.textContent = '⚠ Credentials not set';
            statusDiv.className = 'status disabled';
        }
    }
    
    // Toggle enabled state
    toggleBtn.addEventListener('click', async () => {
        const result = await chrome.storage.local.get(['enabled']);
        const newState = !result.enabled;
        
        await chrome.storage.local.set({ enabled: newState });
        await updateStatus();
    });
    
    // Open settings
    settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
    
    // Initial status update
    await updateStatus();
});



