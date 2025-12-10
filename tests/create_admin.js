const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdmin() {
  const email = 'admin@kashprime.com';
  const password = 'AdminPassword123!';
  const username = 'admin_kashprime';
  
  console.log(`Checking for user ${email}...`);
  
  // Check if exists
  const { data: existing, error: findError } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  
  if (findError) {
    console.error('Error finding user:', findError);
    return;
  }
  
  if (existing) {
    console.log('Admin user already exists. Updating password/role...');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const { error } = await supabase.from('users').update({
      password: hashedPassword,
      role: 'admin',
      account_status: 'active'
    }).eq('id', existing.id);
    
    if (error) console.error('Error updating admin:', error);
    else console.log('Admin updated successfully.');
    
  } else {
    console.log('Creating new admin user...');
    const hashedPassword = await bcrypt.hash(password, 10);
    const referralCode = 'ADMIN' + Math.floor(Math.random() * 1000);
    
    const { data: newUser, error } = await supabase.from('users').insert({
      email,
      username,
      password: hashedPassword,
      original_password: 'encrypted_placeholder',
      full_name: 'Test Admin',
      phone_number: '0000000000',
      user_tier: 'Pro',
      referral_code: referralCode,
      role: 'admin',
      account_status: 'active',
      email_verified: true
    }).select().single();
    
    if (error) {
      console.error('Error creating admin:', error);
      return;
    }
    
    console.log('Admin user created:', newUser.id);
    
    // Create wallet
    const { error: walletError } = await supabase.from('wallets').insert({
      user_id: newUser.id,
      coins_balance: 0,
      games_balance: 0,
      referral_balance: 0,
      investment_balance: 0
    });
    
    if (walletError) console.error('Error creating wallet:', walletError);
    else console.log('Wallet created.');
  }
}

createAdmin();
