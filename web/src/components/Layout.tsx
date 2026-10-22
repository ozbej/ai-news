import { Link, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'

export default function Layout() {
  const session = useSession()
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold">AI·SI News</Link>
          {session ? (
            <button className="text-sm text-neutral-600 hover:underline" onClick={() => supabase.auth.signOut()}>
              Log out ({session.user.email?.split('@')[0]})
            </button>
          ) : (
            <Link to="/login" className="text-sm text-neutral-600 hover:underline">Log in / Register</Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4"><Outlet /></main>
    </div>
  )
}
