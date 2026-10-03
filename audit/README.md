# Legacy-site audit tooling

Read-only tooling used for the Phase 1 audit of https://islammalayalam.net.
Report: [`../docs/audit/01-AUDIT-REPORT.md`](../docs/audit/01-AUDIT-REPORT.md).

**The legacy site is compromised (ClickFix / EtherHiding).** Every script here follows these rules:

- Responses are sanitized in memory (`lib/sanitize.mjs`) and IOC-scanned before anything is written; writes fail closed.
- Payloads are never evaluated. IOCs in stored evidence are defanged.
- The browser audit (`lib/guard.mjs`) sanitizes same-site documents/scripts, default-denies executable resources from
  non-allowlisted hosts, hard-blocks IOC hosts, injects a CSP without `unsafe-eval`/`data:` scripts, and neuters the clipboard.
- Wayback captures are loaded with JavaScript disabled.

| Command | Output |
|---|---|
| `node scripts/dump-wp.mjs` | `data/wp/*.json` (sanitized REST data + infection stats) |
| `node scripts/check-media.mjs` | `data/media-check.json` |
| `node scripts/list-uploads.mjs` | `data/uploads-listing.json` |
| `node scripts/discover.mjs` | `data/discovery.json`, `data/html/*` |
| `node scripts/crawl.mjs [--only=key,…]` | `data/crawl.json`, `screens/{mobile,tablet,desktop}/` |
| `node scripts/summarize-crawl.mjs` | `data/crawl-summary.json` |
| `node scripts/archive-shots.mjs` | `data/original-ia.json`, `screens/original/` |

If a new malware variant appears, add a removal rule and an IOC pattern to `lib/sanitize.mjs` first, then re-run.
