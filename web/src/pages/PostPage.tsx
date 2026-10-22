import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, type Comment, type Post } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { timeAgo } from '../lib/time'
import VoteButtons from '../components/VoteButtons'

function CommentForm({ postId, parentId, onDone }: { postId: number; parentId?: number; onDone?: () => void }) {
  const session = useSession()
  const nav = useNavigate()
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('comments').insert({
        post_id: postId, parent_id: parentId ?? null, body: body.trim(), user_id: session!.user.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setBody('')
      qc.invalidateQueries({ queryKey: ['comments', postId] })
      qc.invalidateQueries({ queryKey: ['post', postId] })
      onDone?.()
    },
  })
  if (!session) return <p className="text-sm"><button className="underline" onClick={() => nav('/login')}>Log in</button> to comment.</p>
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate() }}>
      <textarea className="w-full rounded border p-2 text-sm" rows={3} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment…" />
      <div className="flex items-center gap-3">
        <button disabled={add.isPending} className="rounded bg-neutral-900 px-3 py-1 text-sm text-white disabled:opacity-50">Comment</button>
        {add.error && <span className="text-sm text-red-600">{(add.error as Error).message}</span>}
      </div>
    </form>
  )
}

function CommentNode({ c, all, postId }: { c: Comment; all: Comment[]; postId: number }) {
  const [replying, setReplying] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const kids = all.filter((k) => k.parent_id === c.id)
  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <VoteButtons target={{ comment_id: c.id }} score={c.score} queryKey={['comments', postId]} />
        <div className="min-w-0 flex-1">
          <div className="text-xs text-neutral-500">
            <button onClick={() => setCollapsed(!collapsed)} className="mr-1">[{collapsed ? '+' : '–'}]</button>
            <span className="font-semibold">{c.profiles?.username ?? 'unknown'}</span> · {timeAgo(c.created_at)}
          </div>
          {!collapsed && (
            <>
              <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
              <button className="text-xs text-neutral-500 hover:underline" onClick={() => setReplying(!replying)}>reply</button>
              {replying && <div className="mt-2"><CommentForm postId={postId} parentId={c.id} onDone={() => setReplying(false)} /></div>}
              <div className="ml-2 border-l pl-3">
                {kids.map((k) => <CommentNode key={k.id} c={k} all={all} postId={postId} />)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PostPage() {
  const postId = Number(useParams().id)
  const { data: post } = useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      const { data, error } = await supabase.from('posts').select('*, sources(name)').eq('id', postId).single()
      if (error) throw error
      return data as unknown as Post
    },
  })
  const { data: comments = [] } = useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => {
      const { data, error } = await supabase.from('comments').select('*, profiles(username)').eq('post_id', postId).order('created_at')
      if (error) throw error
      return data as unknown as Comment[]
    },
  })
  if (!post) return <p>Loading…</p>
  return (
    <>
      <Link to="/" className="text-sm text-neutral-500 hover:underline">← Back</Link>
      <div className="mt-2 flex gap-3 rounded bg-white p-4 shadow-sm">
        <VoteButtons target={{ post_id: post.id }} score={post.score} queryKey={['post', postId]} />
        <div>
          <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold hover:underline">{post.title}</a>
          <div className="mt-1 text-xs text-neutral-500">{post.sources?.name} · {timeAgo(post.published_at)}</div>
          {post.summary && <p className="mt-2 text-sm text-neutral-700">{post.summary}</p>}
        </div>
      </div>
      <div className="mt-4 rounded bg-white p-4 shadow-sm">
        <CommentForm postId={postId} />
        {comments.filter((c) => c.parent_id === null).map((c) => <CommentNode key={c.id} c={c} all={comments} postId={postId} />)}
      </div>
    </>
  )
}
