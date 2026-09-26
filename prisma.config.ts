// Prisma 7 config — carga .env antes de leer DATABASE_URL
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // env() de Prisma + dotenv/config arriba
    url: env("DATABASE_URL"),
  },
});
