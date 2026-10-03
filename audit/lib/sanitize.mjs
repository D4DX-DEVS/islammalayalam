// Strips the known WordPress malware injections (ClickFix / EtherHiding loader)
// from text IN MEMORY, before anything is written to disk or handed to a browser.
// Never evaluates payloads. Fails closed: if an IOC survives, the caller must not persist it.

export const IOC_PATTERNS = [
  // NOTE: ids must never match any pattern — they are stored in evidence files that get IOC-scanned.
  { id: 'xdav_hook', re: /xdav_tracker/i },
  { id: 'pixel_stream', re: /Pixel\s*Stream/i },
  { id: 'xtracker_marker', re: /XTracker_[A-Z]{4}/ }, // JS identifier: case-sensitive
  { id: 'long_atob', re: /atob\s*\(\s*['"`][A-Za-z0-9+/=]{120,}/ },
  { id: 'obf_atob_var', re: /var\s+_0x[0-9a-f]{3,}\s*=\s*atob\b/i },
  { id: 'obf_identifier', re: /\b_0x[0-9a-f]{4,}\b/i },
  { id: 'fn_textdecoder', re: /new\s+Function\s*\(\s*new\s+TextDecoder/ },
  { id: 'interseq', re: /interseq\.at/i },
  { id: 'captcha_c2', re: /securityalertcaptchacheck\.com/i },
  { id: 'polygon_contract', re: /0x0C7Cb01C83203aC0a50Abc3a9AFF3c9Ca727eF55/i },
  { id: 'rpc_call', re: /eth_call/i },
  { id: 'data_uri_js', re: /data:(?:text|application)\/(?:javascript|ecmascript)/i },
  { id: 'eval_atob', re: /eval\s*(?:\/\*[\s\S]*?\*\/\s*)?\(\s*atob\b/i },
  { id: 'bsc_rpc', re: /bsc-testnet-rpc\.publicnode|bsc-dataseed\d*\.binance/i },
  { id: 'bsc_contract', re: /0xA1decFB75C8C0CA28C10517ce56B710baf727d2e/i },
  { id: 'ea_s_script', re: /<script\b[^>]*\bid\s*=\s*["']?_ea_s\b/i },
];

// "Any char, but never across <script / </script" — keeps each match inside ONE script element,
// so a malformed payload can never swallow legitimate article text between two scripts.
const IN_SCRIPT = '(?:(?!<\\/?script\\b)[\\s\\S])*?';
const OPEN = '<script\\b[^>]*>';
const rx = (src) => new RegExp(src, 'gi');

const REMOVALS = [
  // Output-buffer trailer appended to every PHP response (HTML, JSON, robots.txt).
  // Body may contain several scripts but never another BEGIN marker.
  { id: 'trailer_block', re: /<!--\s*BEGIN:\s*X[^>]*?Pixel\s*Stream\s*-->(?:(?!<!--\s*BEGIN:)[\s\S]){0,200000}?<!--\s*END:\s*X[^>]*?Pixel\s*Stream\s*-->/gi },
  // PHP hook source leaked into post_content. It NESTS an inner <script>…</script> before add_action,
  // so it is bounded by length and by never crossing another xdav_tracker( occurrence instead.
  { id: 'xdav_block', re: /<script\b[^>]*>\s*function\s+xdav_tracker\s*\(\)(?:(?!xdav_tracker\s*\()[\s\S]){0,600000}?add_action\s*\([^;]{0,200}?\);\s*<\/script\s*>/gi },
  // Remote loader stubs: <script>;const script = document.createElement('script'); …</script>
  { id: 'loader_stub', re: rx(`${OPEN}\\s*;?\\s*(?:const|let|var)\\s+\\w+\\s*=\\s*document\\.createElement\\(\\s*['"]script['"]\\s*\\)${IN_SCRIPT}<\\/script\\s*>`) },
  // XOR/atob obfuscated IIFE
  { id: 'obfuscated_iife', re: rx(`${OPEN}\\s*;?\\s*!function\\s*\\(\\)\\s*\\{\\s*var\\s+_0x${IN_SCRIPT}<\\/script\\s*>`) },
  // javascript-obfuscator style: <script>; (function (_0x42cc1) { var _0xa05d3 = …</script>
  { id: 'obfuscated_fn', re: rx(`${OPEN}\\s*;?\\s*\\(\\s*function\\s*\\(\\s*_0x[0-9a-f]+${IN_SCRIPT}<\\/script\\s*>`) },
  { id: 'xtracker_stub', re: rx(`${OPEN}\\s*window\\.XTracker_[A-Z]{4}\\s*=${IN_SCRIPT}<\\/script\\s*>`) },
  // Enqueued data-URI script (EtherHiding BSC variant: eth_call -> eval(atob(result)))
  { id: 'data_uri_script', re: /<script\b[^>]*\bsrc\s*=\s*["']?data:(?:text|application)\/(?:javascript|ecmascript)[^>]*>\s*<\/script\s*>/gi },
];

export function findIocs(text) {
  if (!text) return [];
  return IOC_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id);
}

/** Remove known injections. Returns { clean, removed: {id: count}, bytesRemoved, residualIocs }. */
export function sanitize(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { clean: text ?? '', removed: {}, bytesRemoved: 0, residualIocs: [] };
  }
  const removed = {};
  let clean = text;
  for (const { id, re } of REMOVALS) {
    clean = clean.replace(re, () => {
      removed[id] = (removed[id] || 0) + 1;
      return '';
    });
  }
  return {
    clean,
    removed,
    bytesRemoved: text.length - clean.length,
    residualIocs: findIocs(clean),
  };
}

/** For post/page bodies: also drop every remaining <script> (content must never carry scripts). */
export function sanitizeContent(html) {
  const base = sanitize(html);
  let other = 0;
  const unknownScriptHeads = [];
  const clean = base.clean
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, (m) => {
      other += 1;
      if (unknownScriptHeads.length < 3) {
        unknownScriptHeads.push(
          m.slice(0, 80).replace(/\s+/g, ' ').replace(/[A-Za-z0-9+/=]{20,}/g, '<b64>').replace(/_0x[0-9a-f]+/gi, '_0x…'),
        );
      }
      return '';
    })
    // An unclosed <script would swallow the rest of the document when rendered — drop it to the end.
    .replace(/<script\b[\s\S]*$/i, () => {
      other += 1;
      return '';
    });
  if (other) base.removed.other_script = other;
  return {
    ...base,
    clean,
    bytesRemoved: html ? html.length - clean.length : 0,
    residualIocs: findIocs(clean),
    unknownScriptHeads,
  };
}

/** Defang IOC hostnames/addresses so evidence can be stored and reported without being live. */
export function defang(text) {
  return text
    .replace(/\b(interseq|securityalertcaptchacheck)\.(at|com)\b/gi, '$1[.]$2')
    .replace(/0x0C7Cb01C83203aC0a50Abc3a9AFF3c9Ca727eF55/gi, '0x0C7C…eF55 (defanged)')
    .replace(/0xA1decFB75C8C0CA28C10517ce56B710baf727d2e/gi, '0xA1de…7d2e (defanged)')
    .replace(/\bbsc-testnet-rpc\.publicnode\.com\b/gi, 'bsc-testnet-rpc[.]publicnode[.]com')
    .replace(/eth_call/gi, 'eth-call(defanged)');
}

/** Strip the trailer that corrupts WP REST JSON, then parse. */
export function parseWpJson(text) {
  const { clean } = sanitize(text);
  return JSON.parse(clean.trim());
}

/** Guard: throws if text still carries an IOC. Use right before any disk write. */
export function assertClean(text, label = 'payload') {
  const iocs = findIocs(text);
  if (iocs.length) throw new Error(`Refusing to persist ${label}: residual IOCs ${iocs.join(',')}`);
  return text;
}
