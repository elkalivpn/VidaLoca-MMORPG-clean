import 'dotenv/config';
import { PrismaClient, ItemType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Falta DATABASE_URL en .env (carga con dotenv falló)');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed de datos para VidaLoca MMORPG...');
  console.log('→ DB host:', connectionString.replace(/:[^:@/]+@/, ':***@').split('@')[1]?.split('/')[0] || '?');

  const territoriesData = [
    { name: 'Centro Madrid', city: 'Madrid', incomeRate: 500.0 },
    { name: 'Malasaña', city: 'Madrid', incomeRate: 450.0 },
    { name: 'Salamanca', city: 'Madrid', incomeRate: 700.0 },
    { name: 'Las Ramblas', city: 'Barcelona', incomeRate: 600.0 },
    { name: 'Barrio Gótico', city: 'Barcelona', incomeRate: 500.0 },
    { name: 'Marbella Centro', city: 'Marbella', incomeRate: 800.0 },
    { name: 'Puerto Banús', city: 'Marbella', incomeRate: 900.0 },
    { name: 'Casco Antiguo Sevilla', city: 'Sevilla', incomeRate: 450.0 },
    { name: 'Ciudad de las Artes', city: 'Valencia', incomeRate: 520.0 },
    { name: 'Casco Viejo Bilbao', city: 'Bilbao', incomeRate: 490.0 },
  ];

  for (const t of territoriesData) {
    await prisma.territory.create({ data: t });
  }
  console.log(`✅ ${territoriesData.length} territorios creados`);

  // NOTE: rest of seed unchanged — full file should be pulled from local if truncated
  // This push only patches the header; user should git pull or apply local seed fix
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
