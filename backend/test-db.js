// test-db.js
import pkg from 'pg';
const { Pool } = pkg;

// Use your Neon connection string
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_kghw8Wf4tcSd@ep-wandering-darkness-adr4t2lb-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
});

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Connected to Neon PostgreSQL!');
    console.log('Current Time:', result.rows[0]);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();
