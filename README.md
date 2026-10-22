# AI·SI News

Reddit-style aggregator for AI and Superintelligence news. React SPA on GitHub Pages, Supabase (Postgres + Auth + RLS) as the backend, scraper as a GitHub Actions cron.

## Setup
1. **Supabase**: create a project, then run `supabase/migrations/0001_init.sql` and `supabase/seed.sql` in the SQL editor (or via the Supabase CLI).
2. **Auth**: Authentication → Providers → enable Google (create an OAuth client in Google Cloud; redirect URI is `https://<ref>.supabase.co/auth/v1/callback`). Under URL Configuration, set Site URL to your domain and add `http://localhost:5173` to Redirect URLs. Configure custom SMTP (e.g. Resend) before launch.
3. **GitHub secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (scraper only, never in the frontend), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. **Pages**: Settings → Pages → Source: GitHub Actions. For the custom domain, add `web/public/CNAME` containing your domain, point DNS at GitHub Pages, enable Enforce HTTPS.
5. Run the `Scrape news` workflow manually once to fill the feed.

## Local dev
```bash
cd web && cp .env.example .env   # fill in Supabase URL + anon key
npm install && npm run dev

cd scraper && cp .env.example .env
export $(cat .env | xargs) && npm install && npm start
```

Note: the Actions cron is disabled by GitHub after 60 days of repo inactivity in public repos; re-enable it or push a commit.
