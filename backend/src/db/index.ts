import "dotenv/config";
import { Pool } from "pg";

export const db = new Pool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "iot_dashboard",
  user: process.env.DB_USER ?? process.env.USER,
  password: process.env.DB_PASSWORD ?? "",
});

db.on("connect", () => console.log("✅ Connected to PostgreSQL"));
db.on("error", (err: unknown) => console.error("❌ PostgreSQL error:", err));
