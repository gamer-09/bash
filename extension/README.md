# Westerfield WiFi Auto-Login Chrome Extension

Automatically logs you into the Westerfield College WiFi portal when you connect. No more manual login steps!

## Features

- ✅ **Automatic Login**: Detects the captive portal page and logs you in automatically
- ✅ **Smart Form Detection**: Automatically detects and fills login forms
- ✅ **MD5 Challenge Support**: Handles MikroTik hotspot MD5 challenge-response authentication
- ✅ **Secure Storage**: Credentials stored securely in Chrome's local storage
- ✅ **Easy Configuration**: Simple options page for setting credentials

## Installation

### Method 1: Load Unpacked Extension (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the `extension` folder from this project
5. The extension will be installed

### Method 2: Create Extension Package

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Pack extension**
4. Select the `extension` folder
5. Install the generated `.crx` file

## Setup

1. After installation, click the extension icon in Chrome's toolbar
2. Click **"Open Settings"** or right-click the extension → **Options**
3. Enter your WiFi portal username and password
4. Ensure **"Enable auto-login"** is checked
5. Click **Save Settings**

## How It Works

### High-Level Flow (Executive Summary)
When you connect to the WiFi, the captive portal redirects your browser to the login page. The extension detects this page, fills in your credentials, and submits the form automatically - eliminating the need to manually type or click anything.

**Business Value**: Saves time and reduces friction in the daily workflow. What used to take 30 seconds of manual interaction now happens instantly in the background.

### Medium-Level Architecture (Technical Details)

The extension uses three main components:

1. **Content Script** (`content.js`): Runs on pages matching the portal domain. It:
   - Detects when a login page loads
   - Extracts form field names automatically
   - Handles MD5 challenge-response (for MikroTik hotspots)
   - Fills credentials and submits the form

2. **Options Page** (`options.html/js`): Provides a UI for users to:
   - Enter and save credentials securely
   - Enable/disable auto-login
   - View extension status

3. **Background Service Worker** (`background.js`): Manages:
   - Extension initialization
   - Default settings on first install
   - Communication between components

**Data Flow**:
```
WiFi Connection → Captive Portal Redirect → Login Page Loads
  ↓
Content Script Detects Page
  ↓
Retrieves Credentials from Chrome Storage
  ↓
Fills Form Fields
  ↓
Handles MD5 Challenge (if present)
  ↓
Submits Form → Login Complete
```

### Low-Level Implementation Details

**MD5 Challenge Handling**: MikroTik hotspots use a challenge-response authentication. The portal page contains JavaScript like:
```javascript
hexMD5('\257' + password + '\224\030\161\134\340\263\255\214\331\101\365\114\004\250\102\054')
```

The extension:
1. Extracts the prefix and suffix from the JavaScript
2. Either uses the page's existing `doLogin()` function (if available)
3. Or uses the page's `hexMD5()` function from `/md5.js` to hash the password
4. Submits the hashed password instead of plain text

**Form Detection**: The script looks for:
- Forms named "login" containing username/password inputs
- Hidden forms named "sendin" (MikroTik pattern)
- Checks URL patterns and page text to confirm it's a login page

## Icons

The extension needs icon files (16x16, 48x48, 128x128 pixels) in the `icons/` folder. If icons are missing, Chrome will use default extension icons.

To create icons:
1. Design a simple icon (WiFi symbol, lock, or custom logo)
2. Export as PNG at 128x128 pixels
3. Resize to 48x48 and 16x16 versions
4. Save as `icon128.png`, `icon48.png`, `icon16.png` in the `icons/` folder

Or use an online tool like:
- https://www.favicon-generator.org/
- https://www.iconsgenerator.com/

## Troubleshooting

### Extension doesn't auto-login
- Check that auto-login is enabled in settings
- Verify credentials are saved correctly
- Check browser console (F12) for error messages
- Ensure you're on the correct portal URL

### Login fails
- Verify username and password are correct
- Try logging in manually once to confirm credentials work
- Check if the portal URL has changed (update in manifest.json if needed)

### Form not detected
- The portal page structure may have changed
- Check browser console for detection logs
- Verify the portal URL matches `portal.modieltswesterfield.com`

## Security Notes

- Credentials are stored in Chrome's local storage (encrypted by Chrome)
- Credentials never leave your device
- The extension only runs on the portal domain
- No data is sent to external servers

## Development

### File Structure
```
extension/
├── manifest.json          # Extension configuration
├── content.js            # Main auto-login logic
├── background.js         # Service worker
├── options.html/js       # Settings page
├── popup.html/js         # Extension popup
├── icons/                # Extension icons
└── README.md            # This file
```

### Testing
1. Load the extension in developer mode
2. Connect to the WiFi network
3. The captive portal should open automatically
4. Watch the browser console (F12) for extension logs
5. The form should be filled and submitted automatically

## License

This extension is provided as-is for personal use.

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify the portal page hasn't changed
3. Ensure all files are present and manifest.json is valid



