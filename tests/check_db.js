const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  console.log('Checking database connection...');
  
  // Check users
  const { data: users, error } = await supabase.from('users').select('email, role').eq('role', 'admin');
  
  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('Users found:', users.length);
    users.forEach(u => console.log(`- ${u.email} (${u.role})`));
    
    const admin1 = users.find(u => u.email === 'admin@kashprime.com');
    const admin2 = users.find(u => u.email === 'admin@lumivox.com');
    
    if (admin1) console.log('admin@kashprime.com found.');
    if (admin2) console.log('admin@lumivox.com found.');
  }
}

check();
