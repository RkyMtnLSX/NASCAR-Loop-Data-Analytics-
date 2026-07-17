import { createClient } from '@supabase/supabase-js'

// Fallbacks added 2026-07-17: a Vercel build came out with the env vars missing and the whole site
// went down ("supabaseUrl is required"). These are PUBLIC values (present in every shipped bundle),
// so hardcoded fallbacks are safe and make builds immune to env-var loss.
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://dqexnylexbypjtiuctxd.supabase.co'
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'sb_publishable_pVrtVEoQD1i9LiIvaXhS4g_ZDaUUccj'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
