import { Pool } from "pg";

export const db = new Pool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5433),
  database: process.env.DB_NAME ?? "iot_dashboard",
  user: process.env.DB_USER ?? process.env.USER,
});

db.on("connect", () => console.log("✅ Connected to PostgreSQL"));
db.on("error", (err) => console.error("❌ PostgreSQL error:", err));
