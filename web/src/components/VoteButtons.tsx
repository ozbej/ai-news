import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'

type Target = { post_id: number } | { comment_id: number }

export default function VoteButtons({ target, score, queryKey }: { target: Target; score: number; queryKey: unknown[] }) {
  const session = useSession()
  const nav = useNavigate()
  const qc = useQueryClient()
  const col = 'post_id' in target ? 'post_id' : 'comment_id'
  const id = 'post_id' in target ? target.post_id : target.comment_id
  const voteKey = ['vote', col, id, session?.user.id]

  const { data: mine = 0 } = useQuery({
    queryKey: voteKey,
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase.from('votes').select('value').eq(col, id).maybeSingle()
      return (data?.value ?? 0) as number
    },
  })

  const vote = useMutation({
    mutationFn: async (value: 1 | -1) => {
      if (mine === value) {
        const { error } = await supabase.from('votes').delete().eq(col, id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('votes').upsert(
          { ...target, value, user_id: session!.user.id },
          { onConflict: `user_id,${col}` },
        )
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: voteKey })
      qc.invalidateQueries({ queryKey })
    },
  })

  const click = (v: 1 | -1) => (session ? vote.mutate(v) : nav('/login'))
  const btn = (active: boolean) => `leading-none ${active ? 'text-orange-500' : 'text-neutral-400 hover:text-neutral-700'}`

  return (
    <div className="flex w-10 shrink-0 flex-col items-center text-sm">
      <button aria-label="Upvote" className={btn(mine === 1)} onClick={() => click(1)}>▲</button>
      <span className="font-semibold">{score}</span>
      <button aria-label="Downvote" className={btn(mine === -1)} onClick={() => click(-1)}>▼</button>
    </div>
  )
}
