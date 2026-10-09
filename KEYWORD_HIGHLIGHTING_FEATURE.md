# Keyword Highlighting Feature

## Overview

The JD Scan extension now includes advanced keyword highlighting functionality that visually highlights matched and unmatched keywords directly on job description pages. This feature uses a DRY (Don't Repeat Yourself) software pattern for maintainable and reusable code.

## Features

### 🎯 Visual Keyword Highlighting
- **Matched Keywords**: Highlighted in green to show skills/terms found in your resume
- **Missing Keywords**: Highlighted in red to show important terms you should consider adding
- **Real-time Analysis**: Instant highlighting based on selected resume content

### 🔧 Interactive Controls
- **Toggle Button**: Floating button on job pages to show/hide highlights
- **Sidepanel Integration**: Highlight controls within the extension sidepanel
- **Per-Resume Highlighting**: Different highlighting based on selected resume

### 📊 Smart Analysis
- **ATS-Optimized**: Uses the same keyword extraction logic as the ATS scanner
- **Synonym Support**: Recognizes related terms and variations
- **Section Weighting**: Prioritizes important keywords based on context

## How It Works

### 1. Automatic Detection
The extension automatically detects job description content on supported sites:
- LinkedIn Jobs
- Indeed
- Glassdoor
- Workable
- Other job sites

### 2. Keyword Extraction
Uses advanced algorithms to extract relevant keywords from:
- Job descriptions
- Resume content
- Skill requirements
- Experience descriptions

### 3. Visual Highlighting
Applies color-coded highlighting:
- 🟢 **Green**: Keywords found in your resume (matched)
- 🔴 **Red**: Important keywords missing from your resume
- **Hover Effects**: Interactive tooltips and scaling

## Usage

### From the Sidepanel
1. Open the JD Scan sidepanel
2. Select a resume from your library
3. Click "Highlight on Page" button in the job description section
4. Or click "Highlight on Page" in the analysis results

### From the Job Page
1. Look for the floating highlight toggle button (top-right)
2. Click to show/hide keyword highlights
3. Hover over highlighted terms for details

### In the Extension
- View highlighted job descriptions within the sidepanel
- Toggle highlighting on/off
- See match statistics and percentages

## Technical Implementation

### DRY Architecture
The highlighting system follows DRY principles with reusable components:

```typescript
// Core highlighting utility
utils/keywordHighlighter.ts

// React component for sidepanel
components/HighlightedJobDescription.tsx

// Content script integration
entrypoints/content/index.tsx
```

### Key Functions
- `highlightKeywords()`: Core highlighting logic
- `highlightInDOM()`: Apply highlights to DOM elements
- `toggleHighlighting()`: Show/hide highlights
- `createHighlightToggleButton()`: Floating UI controls

### Styling
- CSS-in-JS for dynamic styling
- Dark mode support
- Smooth animations and transitions
- Responsive design

## Benefits

### For Job Seekers
- **Visual Feedback**: Instantly see which keywords you're missing
- **ATS Optimization**: Improve resume keyword matching
- **Time Saving**: Quick identification of important terms
- **Strategic Editing**: Know exactly what to add to your resume

### For Developers
- **Maintainable Code**: DRY pattern reduces duplication
- **Extensible**: Easy to add new highlighting features
- **Type Safe**: Full TypeScript support
- **Testable**: Modular functions for easy testing

## Browser Compatibility
- Chrome/Chromium-based browsers
- Edge
- Brave
- Other Chromium variants

## Privacy & Security
- All processing happens locally
- No keyword data sent to external servers
- Respects user privacy settings
- Secure content script implementation

## Future Enhancements
- Custom highlight colors
- Keyword importance scoring
- Export highlighted job descriptions
- Integration with resume builders
- Multi-language support