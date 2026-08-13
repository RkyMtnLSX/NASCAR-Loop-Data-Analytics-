import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// Subscription state for the signed-in Supabase user (2026-08-09).
// isSubscriber = active monthly OR unexpired week pass / paid-through period.
export default function useSubscriber() {
  const [user, setUser] = useState(null)
  const [row, setRow] = useState(null)
  const [adminRow, setAdminRow] = useState(false)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession()
      const u = data && data.session ? data.session.user : null
      setUser(u)
      if (u) {
        const { data: rows } = await supabase.from('subscribers').select('*').eq('user_id', u.id).limit(1)
        setRow(rows && rows[0] ? rows[0] : null)
        // master admin = signed-in user present in the admins table (2026-08-12, #64)
        const { data: adm } = await supabase.from('admins').select('user_id').eq('user_id', u.id).limit(1)
        setAdminRow(!!(adm && adm.length))
      } else {
        setRow(null)
        setAdminRow(false)
      }
    } catch (e) { /* network hiccup: keep last state */ }
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
    const { data: sub } = supabase.auth.onAuthStateChange(() => load())
    return () => { if (sub && sub.subscription) sub.subscription.unsubscribe() }
  }, [load])
  const isSubscriber = !!row && (row.status === 'active' || (row.access_until && new Date(row.access_until) > new Date()))
  return { user, row, isSubscriber, isAdminUser: adminRow, loading, refresh: load }
}
