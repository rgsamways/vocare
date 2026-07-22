import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as appSchema from "./schema.js";
import * as authSchema from "./auth-schema.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const schema = { ...appSchema, ...authSchema };

export const db = drizzle(pool, { schema });
