import { createClient } from "@supabase/supabase-js";
const supabaseUrl = "https://akepioaeqghyxrzwtwej.supabase.co";
const supabaseKey = "sb_publishable_-IG7SX5FAIeMEQO1J0brCw_wJaXWHcC";
export const supabase = createClient(supabaseUrl, supabaseKey);