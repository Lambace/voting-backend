import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",        // isi kalau ada password
  database: "sekolah", // nama database
  waitForConnections: true,
  connectionLimit: 10,
});

export default pool;
