const { Client } = require('pg');

async function test() {
  const projectRef = 'wicdzqwjhahxixqkddqz';
  const password = 'Indonesi%40181945evev';
  const poolerUrl = 'postgresql://postgres.' + projectRef + ':' + password + '@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require';
  
  console.log('Testing pooler connection...');
  
  const c = new Client({
    connectionString: poolerUrl,
    connectionTimeoutMillis: 15000,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await c.connect();
    const r = await c.query('SELECT 1 as ok');
    console.log('SUCCESS:', r.rows[0]);
    
    const tables = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    console.log('Tables:', tables.rows.map(r => r.table_name).join(', '));
    await c.end();
  } catch (e) {
    console.log('FAIL:', e.message?.slice(0,300));
    await c.end().catch(()=>{});
  }
}
test();