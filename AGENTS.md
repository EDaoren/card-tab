# Repository Guidelines

## Project Structure & Module Organization
Card Tab is a Chrome new-tab extension delivered as static assets. Core logic lives in <code>js/</code>, split into feature-focused managers such as <code>main.js</code>, <code>shortcut.js</code>, and <code>storage-adapter.js</code>; keep new modules decoupled and expose globals intentionally. Styles sit in <code>styles/</code>, icons and fonts under <code>icons/</code> and <code>fonts/</code>, and HTML entry points (<code>index.html</code>, <code>privacy-policy.html</code>) stay at the root. Build outputs are written to <code>build/</code> (ignored until you run the packager), and release helpers such as <code>supabase-init.sql</code> and <code>store-assets/</code> remain unchanged to preserve publishing parity.

## Build, Test, and Development Commands
<code>node build.js</code> bundles everything into <code>build/card-tab.zip</code>; ensure PowerShell or 7-Zip is available for archiving. During development, load the unpacked folder via <code>chrome://extensions/</code> → <strong>Load unpacked</strong> and point to the repository root. Re-run the build whenever assets in <code>js/</code>, <code>styles/</code>, or <code>icons/</code> change.

## Coding Style & Naming Conventions
JavaScript uses ES6 globals loaded via <code>&lt;script&gt;</code> tags; follow the existing two-space indent, single quotes, trailing semicolons, and PascalCase managers (e.g., <code>ViewManager</code>). Keep browser globals on <code>window</code> and document public helpers with short JSDoc blocks when behaviour is not obvious. CSS favors custom properties and BEM-inspired class names—extend <code>styles/main.css</code> instead of inline styles.

## Testing Guidelines
Automated tests are not configured. Perform manual verification by loading the unpacked extension, exercising category CRUD, drag-and-drop ordering, search (the <code>/</code> shortcut), Supabase sync, and offline fallback (<code>offline-manager</code>). Before publishing, install from <code>build/card-tab.zip</code> in a clean Chrome profile to confirm manifest integrity.

## Commit & Pull Request Guidelines
Commits in history use a <code>fix：description</code> prefix; mirror that style or use equivalent concise tags (<code>feat：</code>, <code>chore：</code>) with a short summary. For pull requests, include: 1) purpose and scope, 2) highlights of user-visible changes, 3) screenshots or screen recordings for UI tweaks, and 4) test notes or manual checks performed. Link related issues and call out Supabase schema updates to keep reviewers aligned.

## Security & Configuration Tips
Never commit Supabase keys or personal data. When sharing debugging steps, redact URLs containing project IDs. Confirm that background scripts requesting new permissions list them explicitly in <code>manifest.json</code> and mention the rationale in the PR description.
