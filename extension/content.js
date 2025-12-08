/**
 * WiFi Portal Auto-Login Content Script
 * Automatically detects and fills login form when portal page loads
 */

(function() {
    'use strict';

    // Configuration
    const PORTAL_DOMAIN = 'portal.modieltswesterfield.com';
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    /**
     * Check if we're on a login page
     */
    function isLoginPage() {
        const url = window.location.href.toLowerCase();
        const pageText = document.body.innerText.toLowerCase();
        
        // Check for login indicators
        return url.includes('/login') || 
               pageText.includes('login') && 
               (document.querySelector('input[type="password"]') !== null ||
                document.querySelector('form[name="login"]') !== null);
    }

    /**
     * Extract MD5 challenge from JavaScript code
     * Looks for hexMD5(prefix + password + suffix) pattern
     */
    function extractMD5Challenge() {
        const scripts = document.querySelectorAll('script');
        
        for (let script of scripts) {
            const scriptText = script.textContent || script.innerHTML;
            
            if (!scriptText || !scriptText.includes('hexMD5')) {
                continue;
            }

            // Match hexMD5('prefix' + document.login.password.value + 'suffix')
            const regex = /hexMD5\(['"]\\([^'"]+)['"]\s*\+\s*document\.login\.password\.value\s*\+\s*['"]\\([^'"]+)['"]\)/;
            const match = scriptText.match(regex);
            
            if (match) {
                // Decode JavaScript escape sequences
                const prefix = decodeJSEscapes(match[1]);
                const suffix = decodeJSEscapes(match[2]);
                return { prefix, suffix };
            }

            // Also try with escaped sequences like '\257'
            const regex2 = /hexMD5\(['"]\\([0-9]+)['"]\s*\+\s*document\.login\.password\.value\s*\+\s*['"]\\([^'"]+)['"]\)/;
            const match2 = scriptText.match(regex2);
            
            if (match2) {
                const prefix = String.fromCharCode(parseInt(match2[1], 8)); // Octal
                const suffix = decodeJSEscapes(match2[2]);
                return { prefix, suffix };
            }
        }
        
        return null;
    }

    /**
     * Decode JavaScript escape sequences
     */
    function decodeJSEscapes(str) {
        if (!str) return '';
        
        // Handle octal escapes like \257, \224
        let decoded = str.replace(/\\(\d{1,3})/g, (match, octal) => {
            try {
                return String.fromCharCode(parseInt(octal, 8));
            } catch (e) {
                return match;
            }
        });
        
        // Handle standard escapes like \n, \t
        try {
            decoded = decoded.replace(/\\(.)/g, (match, char) => {
                const escapes = { 'n': '\n', 't': '\t', 'r': '\r', '\\': '\\', "'": "'", '"': '"' };
                return escapes[char] || match;
            });
        } catch (e) {
            // Ignore
        }
        
        return decoded;
    }

    /**
     * Check if the page has hexMD5 function available (from /md5.js)
     */
    function hasMD5Function() {
        return typeof window.hexMD5 === 'function';
    }

    /**
     * Perform auto-login
     */
    async function performAutoLogin() {
        // Check if we should auto-login
        const result = await chrome.storage.local.get(['username', 'password', 'enabled']);
        
        if (!result.enabled) {
            console.log('[WiFi Auto-Login] Extension is disabled');
            return;
        }

        if (!result.username || !result.password) {
            console.log('[WiFi Auto-Login] Credentials not configured. Please set them in extension options.');
            showNotification('Please configure your credentials in extension settings', 'warning');
            return;
        }

        // Check if already logged in
        const pageText = document.body.innerText.toLowerCase();
        if (pageText.includes('you are logged in') || 
            pageText.includes('logged in') ||
            window.location.href.includes('/status')) {
            console.log('[WiFi Auto-Login] Already logged in');
            return;
        }

        // Wait for form to be ready
        let loginForm = document.querySelector('form[name="login"]');
        if (!loginForm) {
            console.log('[WiFi Auto-Login] Login form not found, retrying...');
            setTimeout(performAutoLogin, RETRY_DELAY);
            return;
        }

        try {
            // Find form fields
            const usernameInput = loginForm.querySelector('input[name="username"]');
            const passwordInput = loginForm.querySelector('input[type="password"]');
            
            if (!usernameInput || !passwordInput) {
                console.log('[WiFi Auto-Login] Form fields not found');
                return;
            }

            // Extract MD5 challenge
            const md5Challenge = extractMD5Challenge();
            
            // Fill username
            usernameInput.value = result.username;
            
            // Fill form fields
            usernameInput.value = result.username;
            
            // Check if page has MikroTik-style login pattern (doLogin function + sendin form)
            const sendinForm = document.querySelector('form[name="sendin"]');
            
            if (sendinForm && typeof window.doLogin === 'function') {
                // MikroTik pattern: use page's doLogin() function
                // Set plain password - doLogin() will hash it using hexMD5
                passwordInput.value = result.password;
                console.log('[WiFi Auto-Login] Using page\'s doLogin() function (MikroTik pattern)');
                
                // Trigger login after a short delay to ensure form is ready
                setTimeout(() => {
                    try {
                        // Try to trigger the submit event which calls doLogin()
                        const submitBtn = loginForm.querySelector('input[type="submit"], button[type="submit"]');
                        if (submitBtn) {
                            submitBtn.click();
                        } else {
                            // Fallback: call doLogin() directly
                            window.doLogin();
                        }
                    } catch (error) {
                        console.error('[WiFi Auto-Login] Error calling doLogin():', error);
                        // Fallback to direct form submission
                        loginForm.submit();
                    }
                }, 800);
            } else if (md5Challenge && hasMD5Function()) {
                // MD5 challenge detected and hexMD5 is available
                console.log('[WiFi Auto-Login] Using hexMD5 for password hashing');
                const combined = md5Challenge.prefix + result.password + md5Challenge.suffix;
                try {
                    passwordInput.value = window.hexMD5(combined);
                } catch (error) {
                    console.error('[WiFi Auto-Login] Error hashing password:', error);
                    passwordInput.value = result.password; // Fallback to plain password
                }
                
                setTimeout(() => {
                    loginForm.submit();
                }, 500);
            } else {
                // Simple form submission (no MD5 challenge)
                passwordInput.value = result.password;
                console.log('[WiFi Auto-Login] Direct form submission (no MD5 challenge)');
                
                setTimeout(() => {
                    loginForm.submit();
                }, 500);
            }

            console.log('[WiFi Auto-Login] Login attempt initiated');
            showNotification('Logging in...', 'info');
            
        } catch (error) {
            console.error('[WiFi Auto-Login] Error during auto-login:', error);
            showNotification('Auto-login failed. Please login manually.', 'error');
        }
    }

    /**
     * Show a notification to the user
     */
    function showNotification(message, type = 'info') {
        // Create a simple notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#4caf50'};
            color: white;
            padding: 12px 24px;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 300px;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    /**
     * Initialize auto-login when page is ready
     */
    function init() {
        // Check if we're on a login page
        if (!isLoginPage()) {
            console.log('[WiFi Auto-Login] Not a login page');
            return;
        }

        console.log('[WiFi Auto-Login] Login page detected, initializing...');
        
        // Wait for page to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(performAutoLogin, 1000);
            });
        } else {
            setTimeout(performAutoLogin, 1000);
        }
    }

    // Start initialization
    init();
})();
