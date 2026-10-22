import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost:54321',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'missing-key',
)

export type Post = {
  id: number
  url: string
  title: string
  summary: string | null
  category: 'si' | 'ai'
  published_at: string
  score: number
  comment_count: number
  hot_rank: number
  sources: { name: string } | null
}

export type Comment = {
  id: number
  post_id: number
  user_id: string
  parent_id: number | null
  body: string
  score: number
  created_at: string
  profiles: { username: string } | null
}
