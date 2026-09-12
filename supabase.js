// ============================================
// ELIXIR HOUSE
// CONEXIÓN CON SUPABASE
// ============================================

const SUPABASE_URL =
    "https://vnmskoyetbcxkmgixbmj.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_MNIKhmFX2OsIQWxBXkd7lw_XM1pPKFo";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );