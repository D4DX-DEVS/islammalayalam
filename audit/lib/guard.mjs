// Browser safety guard for auditing a COMPROMISED site.
// Layer 1: every same-site document/script/xhr/stylesheet is fetched by Playwright, sanitized in memory,
//          and only then handed to Chromium. Residual IOC => response replaced (fail closed).
// Layer 2: default-deny network for executable resource types; only allowlisted hosts may serve them.
// Layer 3: known malware / blockchain-RPC hosts are hard-blocked for every resource type.
// Layer 4: clipboard, execCommand('copy'), copy/cut events and window.open neutered at prototype level
//          (ClickFix pushes a command onto the clipboard).
import { sanitize } from './sanitize.mjs';

export const SITE_HOSTS = new Set(['islammalayalam.net', 'www.islammalayalam.net']);
// Exact hosts only (no user-content subdomains); googlevideo.com is the one suffix (random edge hostnames).
const TRUSTED_HOSTS = new Set([
  'fonts.googleapis.com', 'fonts.gstatic.com', 'www.youtube.com', 'www.youtube-nocookie.com', 'i.ytimg.com',
  's.ytimg.com', 'yt3.ggpht.com', 'www.gstatic.com', 'docs.google.com', 's.w.org', 'secure.gravatar.com',
]);
const TRUSTED_SUFFIXES = ['googlevideo.com'];
const IOC_HOSTS = [
  'interseq.at', 'securityalertcaptchacheck.com', 'nodies.app', 'tenderly.co', 'ankr.com', '1rpc.io',
  'quiknode.pro', 'drpc.org', 'blastapi.io', 'publicnode.com',
];
// Passive types cannot execute code; allowed from any non-IOC host so real 3rd-party breakage is observable.
const PASSIVE_TYPES = new Set(['image', 'media', 'font']);
const SANITIZE_TYPES = new Set(['document', 'script', 'xhr', 'fetch', 'stylesheet', 'other']);
// Layer 5: CSP injected into every sanitized document. No 'unsafe-eval' (kills eval/new Function payloads),
// no data: scripts, connect-src limited to the site (kills blockchain RPC lookups from any surviving variant).
const AUDIT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com https://www.gstatic.com",
  "connect-src 'self'",
  'img-src * data: blob:',
  'media-src * data: blob:',
  'font-src * data:',
  "style-src * 'unsafe-inline'",
  'frame-src https://www.youtube.com https://www.youtube-nocookie.com https://docs.google.com',
  "worker-src 'self' blob:", // WP core emoji loader uses a blob worker; workers inherit connect-src 'self'
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const matchesHost = (host, list) => list.some((h) => host === h || host.endsWith(`.${h}`));

export function newGuardLog() {
  return { blocked: [], sanitized: [], guardErrors: [] };
}

export async function installGuard(context, log) {
  await context.addInitScript(() => {
    const lock = (obj, key, value) => {
      try { Object.defineProperty(obj, key, { value, configurable: false, writable: false }); } catch { /* ignore */ }
    };
    const noop = () => Promise.resolve();
    if (typeof Clipboard !== 'undefined') {
      for (const k of ['writeText', 'write', 'readText', 'read']) lock(Clipboard.prototype, k, noop);
    }
    const origExec = Document.prototype.execCommand;
    lock(Document.prototype, 'execCommand', function execCommand(cmd, ...rest) {
      return /^(copy|cut|paste)$/i.test(String(cmd)) ? false : origExec.call(this, cmd, ...rest);
    });
    document.addEventListener('copy', (e) => e.preventDefault(), true);
    document.addEventListener('cut', (e) => e.preventDefault(), true);
    lock(window, 'open', () => null); // no popups
  });

  await context.route('**/*', async (route) => {
    const req = route.request();
    const type = req.resourceType();
    let url;
    try { url = new URL(req.url()); } catch { return route.abort('blockedbyclient'); }
    // data: only for passive resources; blob: never as a document (both would bypass the sanitizer + CSP).
    if (url.protocol === 'data:') return PASSIVE_TYPES.has(type) ? route.continue() : route.abort('blockedbyclient');
    if (url.protocol === 'blob:') return type === 'document' ? route.abort('blockedbyclient') : route.continue();
    const host = url.hostname;

    if (matchesHost(host, IOC_HOSTS)) {
      log.blocked.push({ url: req.url(), type, reason: 'ioc-host', frame: safeFrameUrl(req) });
      return route.abort('blockedbyclient');
    }
    const isSite = SITE_HOSTS.has(host);
    const trusted = isSite || TRUSTED_HOSTS.has(host) || matchesHost(host, TRUSTED_SUFFIXES);
    if (!trusted) {
      if (PASSIVE_TYPES.has(type)) return route.continue();
      log.blocked.push({ url: req.url(), type, reason: 'not-allowlisted', frame: safeFrameUrl(req) });
      return route.abort('blockedbyclient');
    }
    if (!isSite || !SANITIZE_TYPES.has(type)) return route.continue();

    let resp;
    try {
      resp = await route.fetch({ maxRedirects: 0, timeout: 90_000 });
    } catch (err) {
      log.guardErrors.push({ url: req.url(), type, error: err.message });
      return route.abort('failed');
    }
    const status = resp.status();
    const headers = { ...resp.headers() };
    if (status >= 300 && status < 400) return route.fulfill({ status, headers });

    const ct = headers['content-type'] || '';
    const textual = /text|json|javascript|xml|ecmascript/i.test(ct) || type === 'document' || type === 'script';
    if (!textual) return route.fulfill({ response: resp });

    const raw = await resp.text();
    const s = sanitize(raw);
    if (s.bytesRemoved) {
      log.sanitized.push({ url: req.url(), type, status, removed: s.removed, rawBytes: raw.length, cleanBytes: s.clean.length });
    }
    delete headers['content-length'];
    delete headers['content-encoding'];
    if (type === 'document' || /html|svg/i.test(ct)) headers['content-security-policy'] = AUDIT_CSP;
    if (s.residualIocs.length) {
      log.blocked.push({ url: req.url(), type, reason: `residual-ioc:${s.residualIocs.join(',')}`, frame: safeFrameUrl(req) });
      const body = type === 'document' ? '<!doctype html><title>blocked</title><p>Blocked by audit guard (residual IOC)</p>' : '';
      return route.fulfill({ status: 451, headers: { 'content-type': type === 'document' ? 'text/html' : 'text/plain' }, body });
    }
    return route.fulfill({ status, headers, body: s.clean });
  });
}

function safeFrameUrl(req) {
  try { return req.frame()?.url() ?? null; } catch { return null; }
}
