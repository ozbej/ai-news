import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase, type Post } from '../lib/supabase'
import { timeAgo } from '../lib/time'
import VoteButtons from '../components/VoteButtons'

const SORTS = { hot: 'hot_rank', new: 'published_at', top: 'score' } as const
type Sort = keyof typeof SORTS
const CATS = ['all', 'si', 'ai'] as const

export default function Feed() {
  const [params, setParams] = useSearchParams()
  const sort = (params.get('sort') as Sort) in SORTS ? (params.get('sort') as Sort) : 'hot'
  const cat = CATS.includes(params.get('cat') as never) ? (params.get('cat') as string) : 'all'
  const set = (k: string, v: string) => setParams({ sort, cat, [k]: v })
  const queryKey = ['posts', sort, cat]

  const { data: posts, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase.from('posts_ranked').select('*, sources(name)').order(SORTS[sort], { ascending: false }).limit(50)
      if (cat !== 'all') q = q.eq('category', cat)
      const { data, error } = await q
      if (error) throw error
      return data as unknown as Post[]
    },
  })

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm ${active ? 'bg-neutral-900 text-white' : 'bg-white hover:bg-neutral-200'}`

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {Object.keys(SORTS).map((s) => <button key={s} className={pill(s === sort)} onClick={() => set('sort', s)}>{s}</button>)}
        <span className="mx-1 border-l" />
        {CATS.map((c) => <button key={c} className={pill(c === cat)} onClick={() => set('cat', c)}>{c.toUpperCase()}</button>)}
      </div>
      {isLoading && <p>Loading…</p>}
      {error && <p className="text-red-600">Failed to load posts.</p>}
      <ul className="space-y-2">
        {posts?.map((p) => (
          <li key={p.id} className="flex gap-3 rounded bg-white p-3 shadow-sm">
            <VoteButtons target={{ post_id: p.id }} score={p.score} queryKey={queryKey} />
            <div className="min-w-0">
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{p.title}</a>
              <div className="mt-1 text-xs text-neutral-500">
                <span className={`mr-2 rounded px-1.5 py-0.5 font-semibold ${p.category === 'si' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{p.category.toUpperCase()}</span>
                {p.sources?.name} · {timeAgo(p.published_at)} ·{' '}
                <Link to={`/post/${p.id}`} className="hover:underline">{p.comment_count} comments</Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {posts?.length === 0 && <p className="text-neutral-500">No posts yet.</p>}
    </>
  )
}
