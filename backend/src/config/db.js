import sql from "mssql";
import dotenv from "dotenv";

dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

export const pool = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log("✅ DB conectada");
    return pool;
  })
  .catch(err => console.log("❌ Error DB:", err));