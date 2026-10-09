# Workable Integration Troubleshooting

## Issue: Floating Button Not Appearing on Workable Sites

### Quick Debugging Steps

1. **Check Console Logs**
   - Open Developer Tools (F12)
   - Go to Console tab
   - Look for messages starting with "JD Scan:"
   - You should see: "JD Scan content script loaded on: [URL]"

2. **Verify Extension Permissions**
   - Go to `chrome://extensions/`
   - Find "JD Scan" extension
   - Click "Details"
   - Check if Workable sites are in the permissions list

3. **Check for Debug Indicator**
   - A green "JD Scan: Content Script Loaded" message should appear briefly in the top-left corner
   - If you don't see this, the content script isn't loading

### Common Issues & Solutions

#### 1. Content Script Not Loading
**Symptoms:** No console messages, no debug indicator
**Solutions:**
- Reload the extension: Go to `chrome://extensions/` → Click reload button
- Refresh the Workable page
- Check if the URL matches supported patterns

#### 2. Job Page Not Detected
**Symptoms:** Console shows "Not a job page, OverlayApp not rendering"
**Solutions:**
- Check the URL detection logic in console
- Verify the URL contains "workable.com" or "/j/" pattern
- Some career pages might use custom domains

#### 3. Floating Button Not Visible
**Symptoms:** Content script loads but no floating button
**Solutions:**
- Check if display mode is set to 'overlay' in settings
- Open the sidepanel and verify settings
- Try switching display modes in settings

#### 4. Permission Issues
**Symptoms:** Extension works on other sites but not Workable
**Solutions:**
- Reinstall the extension to get updated permissions
- Check browser console for permission errors
- Verify host_permissions include Workable domains

### Supported Workable URL Patterns

The extension should work on these URL patterns:
- `*.workable.com/*` - Main Workable domain
- `workable.com/*` - Direct Workable links  
- `*.workable.io/*` - Alternative Workable domain
- `workable.io/*` - Direct Workable.io links

### Manual Testing Steps

1. **Visit a Workable Job Page**
   ```
   Example: https://company.workable.com/j/ABC123DEF
   ```

2. **Open Developer Console**
   - Press F12
   - Go to Console tab
   - Look for JD Scan messages

3. **Expected Console Output**
   ```
   JD Scan content script loaded on: https://company.workable.com/j/ABC123DEF
   JD Scan: Document ready state: loading
   JD Scan: Checking URL: https://company.workable.com/j/abc123def
   JD Scan: URL checks: {linkedin: false, indeed: false, glassdoor: false, wellfound: false, workable: true, generic: false}
   JD Scan: Path check result {url: "...", isJob: true, checks: {...}}
   JD Scan: OverlayApp mounted, isJobPage=true URL=https://company.workable.com/j/ABC123DEF
   ```

4. **Check for Floating Button**
   - Should appear in bottom-right corner (default)
   - Green circular button with scan icon
   - Click to expand the overlay

### Advanced Debugging

#### Check Extension Manifest
```javascript
// In console, check if content script is registered
chrome.runtime.getManifest().content_scripts
```

#### Verify Settings
```javascript
// Check current display mode
chrome.storage.local.get('userSettings', console.log)
```

#### Force Job Detection
```javascript
// Manually trigger job detection
window.postMessage({type: 'JD_SCAN_DEBUG'}, '*')
```

### Known Limitations

1. **Custom Workable Domains**
   - Some companies use custom domains that might not match our patterns
   - Solution: Add specific domain support or use manual mode

2. **Single Page Applications**
   - Some Workable sites use SPA navigation
   - The extension monitors URL changes but might need page refresh

3. **Content Security Policy**
   - Some sites have strict CSP that might block the extension
   - Usually shows console errors about blocked scripts

### Reporting Issues

If the floating button still doesn't appear:

1. **Collect Debug Information**
   - Current URL
   - Console log output
   - Extension version
   - Browser version

2. **Check Extension Status**
   - Is the extension enabled?
   - Are there any error badges on the extension icon?
   - Try disabling/enabling the extension

3. **Test on Other Sites**
   - Verify the extension works on LinkedIn/Indeed
   - This helps isolate if it's a Workable-specific issue

### Temporary Workarounds

1. **Use Manual Mode**
   - Copy job description text
   - Open extension sidepanel
   - Paste into manual input field

2. **Use Popup Mode**
   - Click extension icon in toolbar
   - Use "Quick Scan" feature
   - This bypasses the floating button

3. **Switch Display Mode**
   - Go to extension settings
   - Change from 'overlay' to 'sidebar'
   - This uses the browser's side panel instead