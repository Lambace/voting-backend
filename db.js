import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: "postgresql://postgres:rtoJ60l7emhtiHx5@db.hfebjulznbhhzwcjdspb.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false } // Supabase butuh SSL
});

export default pool;
