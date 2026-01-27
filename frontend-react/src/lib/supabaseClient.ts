import { createClient } from '@supabase/supabase-js'

// These variables must match your .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
console.log("Supabase URL Check:", import.meta.env.VITE_SUPABASE_URL);
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing in .env file");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)