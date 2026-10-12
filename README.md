<div align="center">
  <img src="./public/icon/128.png" alt="JD Scan icon" width="88" height="88" />
  <h1>JD Scan</h1>
  <p><strong>A job-application workspace for your browser.</strong><br />Compare your resume with a job description, then work through the application with an AI-assisted copilot.</p>

  <p>
    <a href="https://github.com/wahajnintyeight/jd-scan-extension"><img alt="GitHub stars" src="https://img.shields.io/github/stars/wahajnintyeight/jd-scan-extension?style=for-the-badge&logo=github&label=Stars"></a>
    <a href="https://github.com/wahajnintyeight/jd-scan-extension/issues"><img alt="Open issues" src="https://img.shields.io/github/issues/wahajnintyeight/jd-scan-extension?style=for-the-badge&logo=github"></a>
    <a href="https://github.com/wahajnintyeight/jd-scan-extension/graphs/contributors"><img alt="Contributors" src="https://img.shields.io/github/contributors/wahajnintyeight/jd-scan-extension?style=for-the-badge&logo=github"></a>
    <a href="https://github.com/wahajnintyeight/jd-scan-extension/commits/master"><img alt="Last commit" src="https://img.shields.io/github/last-commit/wahajnintyeight/jd-scan-extension?style=for-the-badge&logo=github"></a>
  </p>
  <p>
    <img alt="Chrome Manifest V3" src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white">
    <img alt="Built with WXT" src="https://img.shields.io/badge/Built%20with-WXT-6C47FF?style=flat-square">
    <a href="https://github.com/wahajnintyeight"><img alt="Maintained by Wahaj" src="https://img.shields.io/badge/Maintained%20by-Wahaj-0A66C2?style=flat-square&logo=github"></a>
  </p>
</div>

JD Scan is a Chromium extension for reading job postings, comparing them with locally saved resumes, and assisting with supported application forms. It works in a popup, side panel, or floating page assistant.

## What it does

- **Finds job details:** built-in page adapters for LinkedIn, Indeed, Glassdoor, and Workable, with a generic page reader for other sites.
- **Compares resumes:** highlights matching and missing job-description keywords and provides an ATS-style match summary.
- **Keeps a resume library:** import PDF, DOCX, DOC, and TXT resumes. Resume records and extracted text are stored in the extension's local browser storage.
- **Drafts with your context:** use a configured language model to tailor a summary, suggest resume bullets, draft a cover letter, prepare for interviews, or answer a question using a selected resume and job posting.
- **Helps with application steps:** inspect supported form fields, draft resume-grounded answers, fill supported empty fields, and continue through clearly identified application steps.
- **Lets you stay in control:** the assistant stops for sensitive, unclear, unsupported, or missing information. It leaves final review and submission to you.
- **Fits your workflow:** choose the popup, side panel, or floating assistant; adjust the theme and auto-scan preferences.

## AI providers

Provider configurations are managed by the connected GoLLM API service. The extension currently offers:

| Provider | Provider ID |
| --- | --- |
| OpenAI | `openai` |
| Anthropic | `anthropic` |
| Groq | `groq` |
| Hugging Face Inference Providers | `huggingface` |
| xAI / Grok | `xai` |
| Mistral AI | `mistral` |
| DeepSeek | `deepseek` |
| Google Gemini | `gemini` |
| OpenRouter | `openrouter` |
| Ollama | `ollama` |

The configured backend must support the chosen provider and model. You can enter a model ID when the preset list is out of date. Configuration names are optional; when editing a saved configuration, leaving the API key blank keeps the stored key.

## Install for development

### Requirements

- Node.js and npm
- Chrome or another Chromium browser that supports Manifest V3
- A reachable JD Scan Go API service for AI configuration, model requests, and server-backed scans

### Build and load

```powershell
git clone https://github.com/wahajnintyeight/jd-scan-extension.git
cd jd-scan-extension
npm install
Copy-Item .env.example .env
```

Set `VITE_API_BASE_URL` in `.env` to your API service. `.env.example` points to a local development endpoint; the build otherwise defaults to the JD Scan production API.

For a development build with reload support:

```powershell
npm run dev
```

For a production build:

```powershell
npm run build
```

In Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `.output/chrome-mv3-dev` for the development build or `.output/chrome-mv3` for the production build. After a production rebuild, reload the extension, refresh the job website, and close and reopen the assistant. Reloading the extension does not replace code already injected into an open website.

If tab actions fail, check that the installed extension is **JD Scan 1.2.3**, loaded from the folder you just built. Refresh every job tab that had the floating assistant open. Keep the job website active while using the side panel; a standalone dashboard tab cannot operate on itself.

## Use JD Scan

1. Open the extension and add one or more resumes in the resume library.
2. In Settings, add a provider configuration, test it, and save it. Choose which active configuration to use for scans and drafting.
3. Open a job posting. JD Scan extracts supported job details automatically, or you can provide the description yourself.
   You can also paste a URL in **Open a job link**. The extension opens the page, captures its description, saves the job context, and displays the prepared role. SmartRecruiters OneClick application links retrieve the matching description through the [public Posting API](https://developers.smartrecruiters.com/docs/endpoints), even when the form page does not display the job description.
4. Review the match and missing keywords, then open the application workspace to draft content or work through the form.
5. Review every answer on the employer's site and submit the application yourself.

The application assistant works with the active browser tab. It can click a clearly identified Apply, Next, or Continue action when the page and form pass its safety checks. It does not submit the final application or upload files for you.

Run uses the selected resume and prepared job description to answer supported fields. The background worker continues the pass across document navigation and saves progress for the floating view. Switching to another tab stops it before the next page action. SmartRecruiters text fields inside open shadow roots are supported; its custom city picker and phone/country control require manual input.

## Data and permissions

- Resume records (including extracted text) and preferences are stored in the browser extension's local storage.
- AI actions send the selected resume text, job description, and relevant prompt or supported empty-field labels/options to the JD Scan API and the configured model provider. Do not use AI features with data you do not want sent to those services.
- Provider API keys are sent to the Go API service when saving a configuration; the extension does not persist them in its local browser storage.
- The extension reads supported page content and application fields on websites so it can identify job descriptions and assist with forms. It requests access to HTTP and HTTPS pages for this purpose.
- Form values that are already filled in are not included in the model prompt. Sensitive or unsupported fields are excluded from automatic filling and require your attention.

## Current boundaries

- Page extraction and form support vary by employer site. The generic reader is a fallback, not a guarantee that every page or form will work.
- The assistant only fills supported empty text, email, phone, URL, search, textarea, and select fields. It stops when it encounters sensitive questions, unanswered required details, or an unclear next step.
- File uploads, final review controls, and final submission remain manual.
- The extension does not inherit MCP servers configured in Codex; MCP tool invocation is not part of this extension build.
- This repository does not currently include a `LICENSE` file.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Chromium development build |
| `npm run build` | Build the Chromium extension |
| `npm run dev:firefox` | Start a Firefox-targeted development build |
| `npm run build:firefox` | Build for Firefox |
| `npm run zip` | Package the Chromium build |
| `npm run compile` | Run the TypeScript compiler without emitting files |
| `npm run test:browser-tabs` | Check UI-to-worker tab routing and target validation |
| `npm run test:job-flow` | Check link preparation, shadow-root fields, and navigation during an application run |

## Built with

- [WXT](https://wxt.dev/) for extension development
- [React](https://react.dev/) and [TypeScript](https://www.typescriptlang.org/) for the interface and application logic
- [Tailwind CSS](https://tailwindcss.com/) and [Lucide](https://lucide.dev/) for styling and icons
- [PDF.js](https://mozilla.github.io/pdf.js/) and `pdf-parse` for resume text extraction

## Credits

Created and maintained by [Wahaj](https://github.com/wahajnintyeight). Thanks to everyone who contributes through issues, feedback, and pull requests; the contributor badge above links to the repository's current credits.

Bug reports and focused pull requests are welcome. Please include the browser, the page or form step involved, and what you expected to happen. Do not include API keys or private resume/application data in an issue.
