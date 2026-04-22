import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

export const pool = new sql.ConnectionPool(config).connect();

export const connectDB = async () => {
  try {
    await pool;
    console.log("✅ DB conectada");
  } catch (err) {
    console.error("❌ Error DB:", err);
    process.exit(1);
  }
};