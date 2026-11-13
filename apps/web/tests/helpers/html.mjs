import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REPO_ROOT = path.resolve(WEB_ROOT, '..', '..');
export const PAGES = { home: 'out/index.html', sample: 'out/sample-run.html', notFound: 'out/404.html' };

export function readPage(key) {
  const p = path.join(WEB_ROOT, PAGES[key]);
  if (!existsSync(p)) throw new Error(`${PAGES[key]} is missing. Run "npm run build" first.`);
  return readFileSync(p, 'utf8');
}
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
export function bodyHtml(html) { return html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, ''); }
export function visibleText(html) { return decode(bodyHtml(html).replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); }
export function count(html, re) { return (bodyHtml(html).match(re) ?? []).length; }
export function links(html) { return [...bodyHtml(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ attrs: m[1], href: /href="([^"]*)"/.exec(m[1])?.[1] ?? '', text: visibleText(m[2]) })); }
export function sectionHtml(html, id) {
  const m = new RegExp(`<section[^>]*id="${id}"[\\s\\S]*?</section>`).exec(bodyHtml(html));
  return m ? m[0] : '';
}