/**
 * Indicators of compromise from the legacy WordPress infection (see docs/audit/01-AUDIT-REPORT.md §1.2).
 * Shared by the migration gates and the CMS content guard. Detection only — nothing here executes input.
 *
 * NOTE: ids must never match any pattern themselves (they are stored in reports that get re-scanned).
 */
export const IOC_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: 'xdav_hook', re: /xdav_tracker/i },
  { id: 'pixel_stream', re: /Pixel\s*Stream/i },
  { id: 'xtracker_marker', re: /XTracker_[A-Z]{4}/ },
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
  // Generic markers that must never appear in stored content of this site
  { id: 'script_tag', re: /<\s*script\b/i },
  { id: 'php_tag', re: /<\?php\b/i },
  { id: 'js_url', re: /(?:^|["'\s(=])\s*javascript\s*:/i },
]

export function findIocs(text: string | null | undefined): string[] {
  if (!text) return []
  return IOC_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id)
}
