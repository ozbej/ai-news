import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';
import { classify, isAiRelated } from './classify.js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'ai-news-scraper/0.1 (+https://github.com)' },
});

const strip = (s = '') => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeUrl = (u) => {
  try {
    const url = new URL(u);
    for (const k of [...url.searchParams.keys()]) if (k.startsWith('utm_')) url.searchParams.delete(k);
    url.hash = '';
    return url.toString();
  } catch { return null; }
};
const hash = (u) => createHash('sha256').update(u).digest('hex');
const validDate = (d) => { const t = new Date(d); return isNaN(t) ? new Date().toISOString() : t.toISOString(); };

async function fetchRss(source) {
  const feed = await parser.parseURL(source.url);
  return feed.items.map((i) => ({
    url: i.link, title: i.title, summary: strip(i.contentSnippet || i.content || i.summary).slice(0, 500),
    published_at: validDate(i.isoDate || i.pubDate),
  }));
}

async function fetchHn(source) {
  const res = await fetch(source.url);
  if (!res.ok) throw new Error(`HN ${res.status}`);
  const { hits } = await res.json();
  return hits.filter((h) => h.title).map((h) => ({
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    title: h.title, summary: null, published_at: validDate(h.created_at),
  }));
}

const FETCHERS = { rss: fetchRss, reddit: fetchRss, hn: fetchHn };

const { data: sources, error } = await db.from('sources').select('*').eq('enabled', true);
if (error) { console.error(error); process.exit(1); }

let inserted = 0, failures = 0;
for (const source of sources) {
  try {
    const items = await FETCHERS[source.type](source);
    const rows = [];
    for (const item of items) {
      const url = item.url && normalizeUrl(item.url);
      if (!url || !item.title) continue;
      const text = `${item.title} ${item.summary ?? ''}`;
      // Generic feeds (arXiv, HN) carry off-topic items; require AI relevance.
      if (!isAiRelated(text)) continue;
      rows.push({
        source_id: source.id, url, url_hash: hash(url), title: item.title.slice(0, 300),
        summary: item.summary, published_at: item.published_at,
        category: classify(text, source.category_hint),
      });
    }
    if (!rows.length) { console.log(`${source.name}: nothing relevant`); continue; }
    // ignoreDuplicates keeps existing rows (and their scores) untouched.
    const { data, error: upErr } = await db.from('posts')
      .upsert(rows, { onConflict: 'url_hash', ignoreDuplicates: true }).select('id');
    if (upErr) throw upErr;
    inserted += data.length;
    console.log(`${source.name}: ${data.length} new of ${rows.length}`);
  } catch (e) {
    failures++;
    console.error(`${source.name}: FAILED - ${e.message}`);
  }
}
console.log(`Done. ${inserted} new posts, ${failures}/${sources.length} sources failed.`);
if (failures === sources.length) process.exit(1);
