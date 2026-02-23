# JD Scan - Resume ATS Matcher

A Chrome extension that helps job seekers optimize their resumes by matching them against job descriptions using keyword-based ATS analysis.

## Features

✨ **Dual Display Modes**
- Sidebar mode for persistent access
- Floating overlay mode for on-page convenience

🎯 **Smart ATS Matching**
- Offline keyword-based analysis
- Match scoring with detailed insights
- Identifies missing keywords and provides suggestions

📄 **Resume Management**
- Drag & drop upload (PDF, DOCX, DOC, TXT)
- Bulk selection for multi-resume comparison
- Persistent local storage

🔍 **Auto Job Detection**
- Supports LinkedIn, Indeed, Glassdoor, Wellfound
- Manual input option for any job description
- Real-time sync on job page navigation

⚙️ **Customizable Settings**
- Light/Dark/Auto theme
- Overlay position control
- Auto-scan preferences
- Notification settings

## Installation

### Development
```bash
npm install
npm run dev
```

Load the extension from `.output/chrome-mv3-dev` in Chrome's extension manager.

### Production Build
```bash
npm run build
```

Load the extension from `.output/chrome-mv3` in Chrome's extension manager.

## Usage

1. **Upload Resumes**: Go to the Resumes tab and upload your resume files
2. **Find a Job**: Navigate to a job posting or paste the description manually
3. **Run Analysis**: Click "Run Match Analysis" to see your match score
4. **Optimize**: Review missing keywords and suggestions to improve your resume

## Tech Stack

- **Framework**: WXT (Web Extension Framework)
- **UI**: React 19 + TypeScript
- **Styling**: Tailwind CSS v3
- **Icons**: Lucide React
- **Build**: Vite

## Privacy

- 100% offline processing
- No external API calls
- All data stored locally
- No tracking or analytics

## Documentation

See [FEATURES.md](./FEATURES.md) for detailed feature documentation.

## License

MIT
