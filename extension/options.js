/**
 * Options page script for WiFi Auto-Login extension
 */

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('settingsForm');
    const messageDiv = document.getElementById('message');
    
    // Load saved settings
    const result = await chrome.storage.local.get(['username', 'password', 'enabled']);
    
    if (result.username) {
        document.getElementById('username').value = result.username;
    }
    if (result.password) {
        document.getElementById('password').value = result.password;
    }
    if (result.enabled !== undefined) {
        document.getElementById('enabled').checked = result.enabled;
    } else {
        document.getElementById('enabled').checked = true; // Default enabled
    }
    
    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const enabled = document.getElementById('enabled').checked;
        
        if (!username || !password) {
            showMessage('Please fill in both username and password', 'error');
            return;
        }
        
        try {
            await chrome.storage.local.set({
                username: username,
                password: password,
                enabled: enabled
            });
            
            showMessage('Settings saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            showMessage('Error saving settings. Please try again.', 'error');
        }
    });
    
    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
});



