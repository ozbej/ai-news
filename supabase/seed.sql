insert into public.sources (name, type, url, category_hint) values
  ('OpenAI Blog', 'rss', 'https://openai.com/news/rss.xml', 'ai'),
  ('Google DeepMind', 'rss', 'https://deepmind.google/blog/rss.xml', 'ai'),
  ('Anthropic News', 'rss', 'https://www.anthropic.com/news/rss.xml', 'ai'),
  ('arXiv cs.AI', 'rss', 'https://rss.arxiv.org/rss/cs.AI', 'ai'),
  ('Import AI', 'rss', 'https://importai.substack.com/feed', 'ai'),
  ('LessWrong', 'rss', 'https://www.lesswrong.com/feed.xml?view=curated-rss', 'si'),
  ('Alignment Forum', 'rss', 'https://www.alignmentforum.org/feed.xml', 'si'),
  ('r/singularity', 'reddit', 'https://www.reddit.com/r/singularity/top/.rss?t=day', 'si'),
  ('r/MachineLearning', 'reddit', 'https://www.reddit.com/r/MachineLearning/top/.rss?t=day', 'ai'),
  ('Hacker News (AI)', 'hn', 'https://hn.algolia.com/api/v1/search_by_date?tags=story&query=AI&hitsPerPage=50', 'ai')
on conflict (url) do nothing;
