# JD Scan interface system

## Foundation

- Product family: browser extension with a compact quick-action popup, an application assistant dashboard, settings, and an in-page assistant.
- App pages use the Workbench macrostructure: a clear header, compact navigation, one primary work area, and supporting controls near the work they affect.
- Visual genre: modern minimal. Theme: Slate and Teal. Use the shared OKLCH values in `tokens.css` for every surface and accent.
- Light mode is the default; the existing Light, Dark, and System preference remains supported through the dark token set.
- Body type uses Inter with system fallbacks. Display type uses Space Grotesk with Inter fallbacks. Technical values may use JetBrains Mono with system fallbacks.
- Spacing follows Tailwind's 4px base. Surfaces use fine borders, restrained shadows, and 8px corner radii. Avoid decorative gradients, glass effects, and ambient blobs.
- Motion is limited to brief state feedback. Respect `prefers-reduced-motion`.

## Shared interaction rules

- Use the same teal primary action, neutral secondary action, focus ring, disabled treatment, and semantic error/success colors on every surface.
- Keep keyboard focus visible. Inputs and controls must inherit the active color mode.
- At narrow widths, preserve the action hierarchy, allow labels to wrap, and prevent horizontal overflow.

## Surface allowances

- Popup: use a content-sized 360px action panel with no fixed minimum height or pinned footer. Lead with one assistant action; place scanning and dashboard controls together as compact secondary buttons. Show the current display mode inline, avoid duplicate floating actions, and reveal scan feedback only when needed. Keep every click target at least 44px tall.
- Dashboard: preserve Apply, Match, Resumes, and History; make the job target, selected resume, and application progress easy to locate.
- Settings: preserve the General and LLM API sections, provider configuration, display mode, appearance, and preferences.
- Floating assistant: preserve drag, minimize, close, and existing page integration. Use the shared teal and surface colors without touching host page styles.
- Start application automation only after the user chooses it. Ground form answers in the selected resume and job posting, pause for unsupported or sensitive fields, and leave final review and submission to the user.

- Theme variables use the `--jd-` prefix and are declared on the injected `.jd-scan-theme` root, preventing host-page color variables from altering the assistant. Large surfaces stay neutral; teal is reserved for actions, selection, and focus.

