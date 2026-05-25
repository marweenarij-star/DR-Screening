require('dotenv').config({ path: './.env' });
const { supabase } = require('./src/services/supabaseClient');

(async () => {
  try {
    const { data, error, status } = await supabase.from('centers').select('id,name,mode').limit(1);
    console.log('status=', status);
    console.log('error=', error ? error.message : null);
    console.log('data=', data);
  } catch (err) {
    console.error('test failed', err);
    process.exit(1);
  }
})();
