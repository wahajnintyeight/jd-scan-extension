# Workable Integration

## Overview

JD Scan now supports Workable job sites for keyword highlighting and job description extraction. This integration allows users to analyze job postings on Workable-powered career pages with the same functionality available on LinkedIn, Indeed, and other supported platforms.

## Supported Workable Features

### ✅ **Job Description Extraction**
- Automatic detection of job description content
- Support for various Workable page layouts
- Fallback mechanisms for different site configurations

### ✅ **Keyword Highlighting**
- Visual highlighting of matched/unmatched keywords
- Floating toggle button for show/hide functionality
- Integration with existing ATS scanning features

### ✅ **Job Metadata Extraction**
- Job title extraction from multiple selectors
- Company name detection
- Automatic content parsing

## Technical Implementation

### URL Detection
```typescript
// Detects Workable job pages
url.includes("workable.com") ||
(url.includes("workable") && url.includes("/j/")) ||
```

### Content Selectors
The integration uses a comprehensive set of selectors to find job descriptions:

```typescript
const workableSelectors = [
    // Main job description containers
    "[data-ui='job-description']",
    ".job-description",
    "[data-ui='description']", 
    ".description",
    
    // Content sections
    ".job-content",
    ".job-details",
    "[data-ui='job-content']",
    
    // Workable-specific patterns
    ".job-posting-description",
    ".job-posting-content",
    "[data-testid='job-description']",
    "[data-testid='description']",
    
    // Main content areas
    "main section",
    "main .content",
    "[role='main'] section",
    "[role='main'] .description"
];
```

### Title & Company Extraction
```typescript
// Job title selectors
"[data-ui='job-title']"
".job-title"
"[data-testid='job-title']"
"header h1"
"main h1"

// Company name selectors  
"[data-ui='company-name']"
".company-name"
"[data-testid='company-name']"
".employer-name"
```

## Usage

### Automatic Detection
1. Navigate to any Workable job posting
2. The extension automatically detects the job page
3. Job description content is extracted and analyzed

### Manual Highlighting
1. Open the JD Scan sidepanel
2. Select a resume from your library
3. Click "Highlight on Page" to apply keyword highlighting
4. Use the floating toggle button to show/hide highlights

### Supported Workable URLs
- `*.workable.com/*` - Main Workable domain
- `workable.com/*` - Direct Workable links
- `*workable*/*` - Workable-powered career pages

## Example Workable Sites

Many companies use Workable for their career pages:
- `company.workable.com/jobs/`
- `careers.company.com` (powered by Workable)
- Custom domains with Workable integration

## Fallback Mechanisms

The integration includes multiple fallback strategies:

1. **Primary Selectors**: Workable-specific data attributes
2. **Secondary Selectors**: Common class names and patterns
3. **Keyword Search**: Content-based detection using job-related terms
4. **Last Resort**: Main content area extraction

## Testing

To test Workable integration:

1. Visit any Workable job posting
2. Open browser developer tools
3. Check console for "JD Scan: Path check" messages
4. Verify job description extraction in the sidepanel
5. Test keyword highlighting functionality

## Troubleshooting

### Common Issues

**Job description not detected:**
- Check if the page uses non-standard Workable layout
- Verify the URL matches supported patterns
- Look for console error messages

**Highlighting not working:**
- Ensure a resume is selected in the sidepanel
- Check if the job description element was found
- Try refreshing the page and re-scanning

**Title/company not extracted:**
- Some Workable sites use custom layouts
- The extension will still extract job description content
- Manual entry is available as fallback

## Future Enhancements

- Support for additional Workable layouts
- Custom selector configuration
- Enhanced metadata extraction
- Multi-language support for international Workable sites

## Browser Compatibility

Workable integration works on all Chromium-based browsers:
- Chrome
- Edge  
- Brave
- Other Chromium variants

The integration follows the same security and privacy standards as other supported job sites.