# KiteMC documentation

- This repository publishes the KiteMC website and bilingual documentation with Mintlify. `docs.json` controls navigation and redirects; pages are MDX.
- Keep Chinese and English pages paired. Chinese is the default language. VerifyMC belongs in the historical archive and carries a discontinued notice.
- Describe public capabilities and verified compatibility. Keep internal decisions, local paths, credentials, project memory and temporary evidence outside public Git.
- Runtime JARs, SDKs, examples and configuration packs are hosted on GitHub. Purchases link to the license platform. Download components read public Releases without browser credentials and match exact asset names.
- Preserve published URLs through the redirect map and preserve existing heading IDs when editing headings. Update both language links together.
- Use native Mintlify components and shared snippets. Keep code, commands and configuration semantics unchanged during formatting changes. Preserve real screenshots; leave missing screenshots as labeled placeholders.
- Before changing navigation or shared components, run `mint validate`, the repository static checker and `mint broken-links --check-anchors --check-redirects`. Check affected pages in the local browser.
- `main` deploys automatically. Use a branch and pull request for changes. Keep `CODEX_PROJECT_MEMORY.md` and `codex-work/` local.
- For Mintlify configuration and MDX component syntax, consult the official Mintlify documentation or installed Mintlify skill.
