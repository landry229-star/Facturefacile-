import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const normalizedSupabaseUrl = supabaseUrl?.replace(/\/+$/, '')

export const supabaseConfigError = !supabaseUrl || !supabaseAnonKey
  ? 'VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être configurées dans .env.local ou .env.'
  : ''

export const supabase = createClient(
  normalizedSupabaseUrl ?? 'https://configuration-incomplete.invalid',
  supabaseAnonKey ?? 'configuration-incomplete',
  {
    global: {
      fetch: async (input, init) => {
        let lastError: unknown
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            return await fetch(input, init)
          } catch (error) {
            lastError = error
            if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
          }
        }
        throw lastError instanceof Error
          ? new Error(`Connexion Supabase impossible après 3 tentatives : ${lastError.message}`)
          : new Error('Connexion Supabase impossible après 3 tentatives.')
      },
    },
  },
)
