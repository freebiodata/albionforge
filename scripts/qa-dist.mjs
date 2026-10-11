/**
 * Post-build QA sweep for the built dist/ directory.
 * Checks: internal links resolve, titles/metas within limits, single H1,
 * canonical/OG present, JSON-LD parses, 404 noindex, sitemap completeness.
 */
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const pages = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.html')) pages.push(p);
  }
}
walk(dist);

const urlToFile = (href) => {
  let p = href.split('#')[0].split('?')[0];
  if (!p.startsWith('/')) return null; // external or relative-with-domain handled below
  if (!p.endsWith('.html') && !path.extname(p)) {
    p = p === '/' ? '/index.html' : `${p.replace(/\/+$/, '')}/index.html`;
  }
  return path.join(dist, p);
};

const problems = [];
const sitemapUrls = fs.readFileSync(path.join(dist, 'sitemap-0.xml'), 'utf8');

for (const page of pages) {
  const rel = '/' + path.relative(dist, page).replace(/\\/g, '/');
  const html = fs.readFileSync(page, 'utf8');

  // title & meta description
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  if (title.length > 68) problems.push(`${rel}: title too long (${title.length}): ${title}`);
  if (desc.length > 165) problems.push(`${rel}: meta description too long (${desc.length})`);
  if (!desc) problems.push(`${rel}: missing meta description`);

  // exactly one H1
  const h1s = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1s !== 1) problems.push(`${rel}: ${h1s} H1 tags (expected 1)`);

  // canonical + og:image
  if (!html.includes('rel="canonical"')) problems.push(`${rel}: missing canonical`);
  if (!html.includes('property="og:image"')) problems.push(`${rel}: missing og:image meta`);

  // noindex only on 404
  const noindex = html.includes('noindex');
  if (rel !== '/404.html' && noindex) problems.push(`${rel}: unexpected noindex`);
  if (rel === '/404.html' && !noindex) problems.push('404.html: missing noindex');

  // JSON-LD parses
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch (e) {
      problems.push(`${rel}: invalid JSON-LD: ${e.message}`);
    }
  }

  // internal links resolve to built files
  for (const m of html.matchAll(/href="([^"]*)"/g)) {
    const href = m[1];
    if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) continue;
    const target = urlToFile(href);
    if (!target) continue;
    if (!fs.existsSync(target)) problems.push(`${rel}: broken link ${href}`);
  }

  // sitemap listing for indexable pages
  if (rel !== '/404.html') {
    const url = `https://albionforge.top${rel === '/index.html' ? '/' : rel.replace('/index.html', '/')}`;
    if (!sitemapUrls.includes(url)) problems.push(`${rel}: not in sitemap (${url})`);
  }
}

// og.png and favicon exist
for (const asset of ['og.png', 'favicon.svg', 'robots.txt', '_headers', '404.html']) {
  if (!fs.existsSync(path.join(dist, asset))) problems.push(`missing dist asset: ${asset}`);
}

console.log(`Checked ${pages.length} HTML pages.`);
if (problems.length === 0) console.log('ALL QA CHECKS PASSED');
else {
  console.log(`PROBLEMS (${problems.length}):`);
  for (const p of problems) console.log(' - ' + p);
  process.exitCode = 1;
}
