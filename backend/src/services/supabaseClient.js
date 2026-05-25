// Supabase client configuration for backend
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), override: true });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables. Use the Supabase service_role key (from Settings → API) — not a publishable/anon key.');
}

// Detect common publishable/anon key prefixes to avoid accidental misuse
const _supKey = supabaseKey || '';
console.log('DEBUG: SUPABASE key prefixes -> sb_publishable:', _supKey.startsWith('sb_publishable'), ' sb_:', _supKey.startsWith('sb_'), ' anon_:', _supKey.startsWith('anon_'), ' pk_:', _supKey.startsWith('pk_'));
if (typeof _supKey === 'string' && (_supKey.startsWith('sb_publishable') || _supKey.startsWith('sb_') || _supKey.startsWith('anon_') || _supKey.startsWith('pk_'))) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY appears to be a publishable/anon key. Replace it with the Service Role key (Settings → API → Service Role).');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
