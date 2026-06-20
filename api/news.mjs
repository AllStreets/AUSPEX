// ═══════════════════════════════════════════
// AUSPEX · SERVERLESS NEWS FUNCTION (Vercel)
// Reuses the worker's unified news fetch (GDELT keyless firehose + optional
// keyed NewsAPI) so the browser gets one CORS-clean, deduped feed. GDELT works
// with no key; NewsAPI is added only when NEWS_API_KEY is set in the env.
// ═══════════════════════════════════════════
import { fetchAllNews } from '../worker/news.js';

export default async function handler(req, res) {
  try {
    const articles = await fetchAllNews();
    // Cache a real feed at the edge for 10 min; never cache an EMPTY result
    // (a transient source hiccup must not be pinned for everyone) — let it
    // retry within 30s so the feed self-heals.
    if (articles.length) {
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    } else {
      res.setHeader('Cache-Control', 's-maxage=30');
    }
    res.status(200).json({
      generatedAt: new Date().toISOString(),
      count: articles.length,
      articles,
    });
  } catch (e) {
    // Never 500 the news rail — return an empty-but-valid payload, uncached.
    res.setHeader('Cache-Control', 's-maxage=30');
    res.status(200).json({ generatedAt: new Date().toISOString(), count: 0, articles: [] });
  }
}
