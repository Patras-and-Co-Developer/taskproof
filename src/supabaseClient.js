import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase environment variables. Check your .env file (locally) " +
    "or your Vercel project's Environment Variables (when deployed)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
