-- Core schema for AI/SI news aggregator

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 30),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.sources (
  id serial primary key,
  name text not null,
  type text not null check (type in ('rss', 'hn', 'reddit')),
  url text not null unique,
  category_hint text check (category_hint in ('si', 'ai')),
  enabled boolean not null default true
);

create table public.posts (
  id bigint generated always as identity primary key,
  source_id int references public.sources(id) on delete set null,
  url text not null,
  url_hash text not null unique,
  title text not null,
  summary text,
  image_url text,
  category text not null default 'ai' check (category in ('si', 'ai')),
  published_at timestamptz not null default now(),
  score int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now()
);
create index posts_published_idx on public.posts (published_at desc);
create index posts_score_idx on public.posts (score desc);

create table public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id bigint references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  score int not null default 0,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

create table public.votes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  post_id bigint references public.posts(id) on delete cascade,
  comment_id bigint references public.comments(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  check ((post_id is null) <> (comment_id is null))
);
-- Plain (non-partial) unique constraints so PostgREST upsert onConflict works; NULLs are distinct.
alter table public.votes add constraint votes_user_post_uq unique (user_id, post_id);
alter table public.votes add constraint votes_user_comment_uq unique (user_id, comment_id);

-- Hot ranking: score / (age_hours + 2)^1.5
create view public.posts_ranked with (security_invoker = true) as
select p.*,
  (p.score + 1)::float / power(extract(epoch from (now() - p.published_at)) / 3600 + 2, 1.5) as hot_rank
from public.posts p;

-- Auto-create profile on signup
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text := coalesce(
    nullif(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'), ''),
    'user');
  uname text := left(base, 22);
begin
  if char_length(uname) < 3 then uname := uname || 'usr'; end if;
  uname := uname || '_' || substr(replace(new.id::text, '-', ''), 1, 6);
  insert into public.profiles (id, username, avatar_url)
  values (new.id, uname, new.raw_user_meta_data ->> 'avatar_url');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep denormalized vote scores in sync
create function public.apply_vote_delta() returns trigger
language plpgsql security definer set search_path = public as $$
declare v record; delta int;
begin
  v := case when tg_op = 'DELETE' then old else new end;
  delta := case tg_op
    when 'INSERT' then new.value
    when 'DELETE' then -old.value
    else new.value - old.value end;
  if v.post_id is not null then
    update public.posts set score = score + delta where id = v.post_id;
  else
    update public.comments set score = score + delta where id = v.comment_id;
  end if;
  return null;
end $$;
create trigger votes_score after insert or update or delete on public.votes
  for each row execute function public.apply_vote_delta();

-- Keep comment_count in sync
create function public.apply_comment_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  else
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.apply_comment_count();

-- Rate limit comments: max 10 per minute per user
create function public.comment_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.comments
      where user_id = new.user_id and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Rate limit exceeded, slow down';
  end if;
  return new;
end $$;
create trigger comments_rate_limit before insert on public.comments
  for each row execute function public.comment_rate_limit();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.sources enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.votes enable row level security;

create policy "profiles readable" on public.profiles for select using (true);
create policy "profiles update own" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "sources readable" on public.sources for select using (true);
create policy "posts readable" on public.posts for select using (true);

create policy "comments readable" on public.comments for select using (true);
create policy "comments insert own" on public.comments for insert
  with check (auth.uid() = user_id);
create policy "comments update own" on public.comments for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "comments delete own" on public.comments for delete
  using (auth.uid() = user_id);

create policy "votes read own" on public.votes for select using (auth.uid() = user_id);
create policy "votes insert own" on public.votes for insert with check (auth.uid() = user_id);
create policy "votes update own" on public.votes for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "votes delete own" on public.votes for delete using (auth.uid() = user_id);

-- Posts/sources have no write policies: only the service role (bypasses RLS) can write.
-- Prevent users from tampering with denormalized counters on comments.
create function public.comments_lock_columns() returns trigger
language plpgsql as $$
begin
  if auth.role() <> 'service_role' then
    new.score := old.score;
    new.post_id := old.post_id;
    new.user_id := old.user_id;
    new.parent_id := old.parent_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
create trigger comments_lock before update on public.comments
  for each row execute function public.comments_lock_columns();
