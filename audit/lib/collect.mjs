// In-page collectors (run inside the sanitized page). Pure DOM reads, no network.

/** Init script: record LCP / CLS as the page loads. */
export function perfObserversInit() {
  window.__audit = { lcp: 0, lcpEl: null, cls: 0 };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__audit.lcp = e.startTime;
        const el = e.element;
        window.__audit.lcpEl = el ? `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(' ')[0]}` : ''} ${e.url || ''}`.trim() : e.url;
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__audit.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  } catch { /* unsupported */ }
}

/** Main collector: SEO, images, layout, a11y smoke, perf. */
export function collectPage() {
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const meta = (sel) => q(sel)?.getAttribute('content') ?? null;
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

  const imgs = qa('img').map((img) => {
    const r = img.getBoundingClientRect();
    return {
      src: img.currentSrc || img.src,
      attrSrc: img.getAttribute('src'),
      dataSrc: img.dataset.src || img.dataset.lazySrc || null,
      complete: img.complete,
      nw: img.naturalWidth,
      w: Math.round(r.width),
      h: Math.round(r.height),
      loading: img.loading || null,
      alt: img.getAttribute('alt'),
      hasDims: img.hasAttribute('width') && img.hasAttribute('height'),
    };
  });
  const bgUrls = qa('[style*="background"]')
    .map((el) => (el.getAttribute('style').match(/url\(["']?([^"')]+)["']?\)/) || [])[1])
    .filter(Boolean);

  const jsonLd = qa('script[type="application/ld+json"]').map((s) => {
    try {
      const j = JSON.parse(s.textContent);
      const g = Array.isArray(j) ? j : j['@graph'] || [j];
      return g.map((x) => x['@type']).flat();
    } catch { return ['INVALID_JSON']; }
  }).flat();

  const vw = window.innerWidth;
  const smallTargets = qa('a[href], button, input, select, [role="button"]').filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24);
  }).length;
  const overflowing = qa('body *').filter((el) => el.getBoundingClientRect().right > vw + 2).slice(0, 5)
    .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);

  const nav = performance.getEntriesByType('navigation')[0];
  const res = performance.getEntriesByType('resource');
  const byType = {};
  for (const r of res) {
    const k = r.initiatorType;
    byType[k] = byType[k] || { n: 0, kb: 0 };
    byType[k].n += 1;
    byType[k].kb += Math.round((r.transferSize || 0) / 1024);
  }

  return {
    url: location.href,
    title: document.title,
    lang: document.documentElement.lang || null,
    seo: {
      description: meta('meta[name="description"]'),
      robots: meta('meta[name="robots"]'),
      canonical: q('link[rel="canonical"]')?.href ?? null,
      prev: q('link[rel="prev"]')?.href ?? null,
      next: q('link[rel="next"]')?.href ?? null,
      og: Object.fromEntries(qa('meta[property^="og:"]').map((m) => [m.getAttribute('property'), m.getAttribute('content')])),
      twitter: Object.fromEntries(qa('meta[name^="twitter:"]').map((m) => [m.getAttribute('name'), m.getAttribute('content')])),
      jsonLd,
      h1: qa('h1').map(text).slice(0, 5),
      headings: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((h) => qa(h).length),
      breadcrumbs: !!q('nav[aria-label*="readcrumb"], .breadcrumb, .breadcrumbs, [itemtype*="BreadcrumbList"]'),
      hreflang: qa('link[rel="alternate"][hreflang]').length,
    },
    images: {
      total: imgs.length,
      broken: imgs.filter((i) => i.complete && i.nw === 0 && (i.attrSrc || i.dataSrc)),
      notLoaded: imgs.filter((i) => !i.complete).map((i) => i.src).slice(0, 10),
      noAlt: imgs.filter((i) => i.alt === null).length,
      emptyAlt: imgs.filter((i) => i.alt === '').length,
      noDims: imgs.filter((i) => !i.hasDims).length,
      lazy: imgs.filter((i) => i.loading === 'lazy').length,
      oversized: imgs.filter((i) => i.nw > 0 && i.w > 0 && i.nw > i.w * 3).map((i) => `${i.src} natural=${i.nw} shown=${i.w}`).slice(0, 5),
      bgUrls: bgUrls.slice(0, 20),
      sample: imgs.slice(0, 40),
    },
    links: {
      total: qa('a[href]').length,
      hashOnly: qa('a[href="#"]').length,
      emptyText: qa('a[href]').filter((a) => !text(a) && !a.querySelector('img[alt]:not([alt=""])') && !a.getAttribute('aria-label')).length,
      external: qa('a[href^="http"]').filter((a) => !a.href.includes(location.host)).map((a) => a.href).slice(0, 30),
    },
    layout: { vw, scrollWidth: document.documentElement.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > vw + 2, overflowing, smallTargets, bodyFontPx: parseFloat(getComputedStyle(document.body).fontSize) },
    a11y: {
      skipLink: !!q('a[href^="#"][class*="skip"], .skip-link'),
      unlabeledInputs: qa('input:not([type="hidden"]), textarea, select').filter((el) => !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('placeholder')).length,
      unnamedButtons: qa('button, [role="button"]').filter((b) => !text(b) && !b.getAttribute('aria-label') && !b.getAttribute('title')).length,
      landmarks: { header: qa('header').length, nav: qa('nav').length, main: qa('main').length, footer: qa('footer').length },
    },
    rawShortcodes: (document.body.innerText.match(/\[(vc_|td_|accordion|featured_cat|wpfd_)[^\]]{0,40}\]/g) || []).slice(0, 5),
    perf: {
      ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
      dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      load: nav ? Math.round(nav.loadEventEnd) : null,
      domNodes: document.getElementsByTagName('*').length,
      htmlKB: nav ? Math.round((nav.decodedBodySize || 0) / 1024) : null,
      resources: res.length,
      byType,
      lcp: Math.round(window.__audit?.lcp || 0),
      lcpEl: window.__audit?.lcpEl || null,
      cls: Number((window.__audit?.cls || 0).toFixed(3)),
    },
  };
}
