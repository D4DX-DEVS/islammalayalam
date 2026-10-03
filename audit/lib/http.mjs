// Minimal fetch helpers for auditing. All bodies stay in memory; callers sanitize before persisting.
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { assertClean } from './sanitize.mjs';

export const SITE = 'https://islammalayalam.net';
export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchText(url, { retries = 3, timeoutMs = 120_000, method = 'GET' } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'user-agent': UA, accept: '*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = method === 'HEAD' ? '' : await res.text();
      return { status: res.status, headers: Object.fromEntries(res.headers), url: res.url, text };
    } catch (err) {
      lastErr = err;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw new Error(`fetch failed ${url}: ${lastErr?.message}`);
}

/** Probe a resource without following redirects, recording the chain. */
export async function probe(url, { maxHops = 6, timeoutMs = 30_000 } = {}) {
  const chain = [];
  let current = url;
  for (let hop = 0; hop < maxHops; hop++) {
    let res;
    try {
      res = await fetch(current, {
        method: 'GET',
        headers: { 'user-agent': UA, accept: 'image/avif,image/webp,image/*,*/*;q=0.8', range: 'bytes=0-1023' },
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      chain.push({ url: current, error: err.message });
      return { ok: false, chain, final: chain.at(-1) };
    }
    const h = Object.fromEntries(res.headers);
    const buf = new Uint8Array(await res.arrayBuffer());
    const entry = {
      url: current,
      status: res.status,
      contentType: h['content-type'] || null,
      contentLength: h['content-range']?.split('/')[1] || h['content-length'] || null,
      cache: h['cf-cache-status'] || null,
      location: h.location || null,
      magic: sniff(buf),
    };
    chain.push(entry);
    if (res.status >= 300 && res.status < 400 && h.location) {
      current = new URL(h.location, current).toString();
      continue;
    }
    const ok = res.status >= 200 && res.status < 300 && (entry.magic !== 'html' || !/\.(jpe?g|png|gif|webp|svg|avif)$/i.test(url));
    return { ok, chain, final: entry };
  }
  return { ok: false, chain, final: chain.at(-1), error: 'too many redirects' };
}

function sniff(b) {
  if (!b.length) return 'empty';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50) return 'png';
  if (b[0] === 0x47 && b[1] === 0x49) return 'gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) return 'webp';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'isobmff'; // avif/mp4/m4a
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'mp3';
  if (b[0] === 0x25 && b[1] === 0x50) return 'pdf';
  const head = new TextDecoder().decode(b.slice(0, 64)).trimStart().toLowerCase();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return 'svg/xml';
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return 'html';
  if (head.startsWith('{') || head.startsWith('[')) return 'json';
  return 'unknown';
}

/** Write JSON only after verifying no IOC survives serialization. */
export async function writeJsonSafe(path, data) {
  const text = JSON.stringify(data, null, 2);
  assertClean(text, path);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, 'utf8');
}

export async function pool(items, concurrency, worker) {
  const out = new Array(items.length);
  let i = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return out;
}
