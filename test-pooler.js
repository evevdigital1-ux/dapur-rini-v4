'use strict';
const { Client } = require('pg');
const pw = encodeURIComponent('Indonesi@181945evev');

const tests = [
  ['pooler5432 host', `postgresql://postgres.wicdzqwjhahxixqkddqz:${pw}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`],
  ['pooler6543 host', `postgresql://postgres.wicdzqwjhahxixqkddqz:${pw}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`],
  ['pooler5432 ip', `postgresql://postgres.wicdzqwjhahxixqkddqz:${pw}@54.255.219.82:5432/postgres`],
  ['pooler6543 ip', `postgresql://postgres.wicdzqwjhahxixqkddqz:${pw}@52.74.252.201:6543/postgres?pgbouncer=true`],
];

(async () => {
  for (const [label, url] of tests) {
    try {
      console.log('Testing:', label);
      const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
      await client.connect();
      const res = await client.query('SELECT 1 as ok');
      console.log('SUCCESS:', label, '-', JSON.stringify(res.rows[0]));
      await client.end();
      process.exit(0);
    } catch (e) {
      console.log('FAIL:', label, '-', e.message?.slice(0,150));
    }
  }
  console.log('All pooler attempts failed.');
  
  // Try direct via IPv6
  try {
    console.log('Trying direct IPv6...');
    const client = new Client({ 
      connectionString: 'postgresql://postgres:' + pw + '@db.wicdzqwjhahxixqkddqz.supabase.co:5432/postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000 
    });
    await client.connect();
    const res = await client.query('SELECT 1 as ok');
    console.log('SUCCESS direct:', JSON.stringify(res.rows[0]));
    await client.end();
  } catch(e) {
    console.log('FAIL direct:', e.message?.slice(0,200));
  }
})();