# Quick Installation Guide

## Step 1: Prepare Icons (Optional but Recommended)

If you have Python with Pillow installed:
```bash
cd extension
pip install Pillow
python create_icons.py
```

Or create icons manually:
- Create 16x16, 48x48, and 128x128 pixel PNG images
- Name them `icon16.png`, `icon48.png`, `icon128.png`
- Place them in the `icons/` folder

**Note**: The extension will work without icons (Chrome uses defaults), but custom icons look better.

## Step 2: Load Extension in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `extension` folder

## Step 3: Configure Credentials

1. Click the extension icon in Chrome toolbar
2. Click **"Open Settings"**
3. Enter your WiFi username and password
4. Ensure auto-login is enabled
5. Click **Save Settings**

## Step 4: Test

1. Connect to the WiFi network
2. The captive portal should open automatically
3. The extension should auto-login within 1-2 seconds
4. You should be redirected to the status page

## Troubleshooting

- If auto-login doesn't work, check the browser console (F12) for error messages
- Make sure credentials are saved in the extension settings
- Verify you're on the correct portal domain: `portal.modieltswesterfield.com`



