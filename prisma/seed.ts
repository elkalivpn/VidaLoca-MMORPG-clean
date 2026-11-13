import 'dotenv/config';
import { PrismaClient, ItemType, Rarity, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Falta DATABASE_URL en .env (carga con dotenv falló)');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface VehicleSeed {
  name: string;
  brand: string;
  speed: number;
  handling: number;
  durability: number;
  capacity: number;
  priceEuros?: number;
  priceVida?: number;
}

interface ItemSeed {
  name: string;
  description: string;
  type: ItemType;
  rarity: Rarity;
  stats: Prisma.InputJsonValue;
  priceEuros?: number;
  priceVida?: number;
}

async function main() {
  console.log('🌱 Iniciando seed de datos para VidaLoca MMORPG...');
  console.log(
    '→ DB host:',
    connectionString!.replace(/:[^:@/]+@/, ':***@').split('@')[1]?.split('/')[0] || '?',
  );

  // ============================================
  // 1. TERRITORIOS (idempotente)
  // ============================================
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

  let territoriesCreated = 0;
  for (const t of territoriesData) {
    const existing = await prisma.territory.findFirst({
      where: { name: t.name, city: t.city },
    });
    if (!existing) {
      await prisma.territory.create({ data: t });
      territoriesCreated++;
    }
  }
  console.log(
    `✅ Territorios procesados: ${territoriesData.length} (${territoriesCreated} nuevos)`,
  );

  // ============================================
  // 2. CATÁLOGO DE VEHÍCULOS (VehicleTemplate)
  // ============================================
  const vehiclesData: VehicleSeed[] = [
    // Deportivos
    {
      name: 'Ibiza Cupra R',
      brand: 'SEAT',
      speed: 74,
      handling: 76,
      durability: 65,
      capacity: 4,
      priceEuros: 28000,
    },
    {
      name: 'M4 Competition',
      brand: 'BMW',
      speed: 84,
      handling: 82,
      durability: 70,
      capacity: 4,
      priceEuros: 85000,
    },
    {
      name: '911 Carrera GTS',
      brand: 'Porsche',
      speed: 88,
      handling: 88,
      durability: 72,
      capacity: 2,
      priceEuros: 135000,
      priceVida: 450,
    },

    // Superdeportivos
    {
      name: 'Huracán EVO',
      brand: 'Lamborghini',
      speed: 95,
      handling: 86,
      durability: 64,
      capacity: 2,
      priceEuros: 260000,
      priceVida: 900,
    },
    {
      name: 'SF90 Stradale',
      brand: 'Ferrari',
      speed: 98,
      handling: 90,
      durability: 62,
      capacity: 2,
      priceEuros: 420000,
      priceVida: 1400,
    },
    {
      name: 'Chiron Pur Sport',
      brand: 'Bugatti',
      speed: 100,
      handling: 85,
      durability: 68,
      capacity: 2,
      priceEuros: 850000,
      priceVida: 2800,
    },

    // Motos
    {
      name: 'MT-07 Street',
      brand: 'Yamaha',
      speed: 76,
      handling: 88,
      durability: 42,
      capacity: 2,
      priceEuros: 9500,
    },
    {
      name: 'Panigale V4 R',
      brand: 'Ducati',
      speed: 94,
      handling: 92,
      durability: 38,
      capacity: 1,
      priceEuros: 42000,
      priceVida: 180,
    },

    // Quads
    {
      name: 'Raptor 700R',
      brand: 'Yamaha',
      speed: 62,
      handling: 80,
      durability: 74,
      capacity: 1,
      priceEuros: 11500,
    },
    {
      name: 'Outlander X mr',
      brand: 'Can-Am',
      speed: 58,
      handling: 76,
      durability: 82,
      capacity: 2,
      priceEuros: 15500,
    },

    // 4x4
    {
      name: 'Defender 110',
      brand: 'Land Rover',
      speed: 66,
      handling: 72,
      durability: 90,
      capacity: 5,
      priceEuros: 68000,
    },
    {
      name: 'G 63 AMG',
      brand: 'Mercedes-Benz',
      speed: 78,
      handling: 70,
      durability: 92,
      capacity: 5,
      priceEuros: 165000,
      priceVida: 550,
    },

    // Camiones
    {
      name: 'Actros 1851',
      brand: 'Mercedes-Benz',
      speed: 52,
      handling: 45,
      durability: 98,
      capacity: 8,
      priceEuros: 110000,
    },
    {
      name: 'FH16 Heavy',
      brand: 'Volvo',
      speed: 55,
      handling: 48,
      durability: 100,
      capacity: 10,
      priceEuros: 140000,
      priceVida: 400,
    },

    // Ambulancias
    {
      name: 'Sprinter SAMUR',
      brand: 'Mercedes-Benz',
      speed: 68,
      handling: 64,
      durability: 86,
      capacity: 6,
      priceEuros: 75000,
    },
    {
      name: 'Crafter UVI Móvil',
      brand: 'Volkswagen',
      speed: 66,
      handling: 66,
      durability: 84,
      capacity: 6,
      priceEuros: 72000,
    },

    // Helicópteros
    {
      name: 'H125 Écureuil',
      brand: 'Airbus',
      speed: 90,
      handling: 78,
      durability: 74,
      capacity: 5,
      priceEuros: 650000,
      priceVida: 2200,
    },
    {
      name: 'AW139 Táctico',
      brand: 'Leonardo',
      speed: 95,
      handling: 82,
      durability: 85,
      capacity: 8,
      priceEuros: 1200000,
      priceVida: 3800,
    },

    // Aviones
    {
      name: 'Cessna 208 Caravan',
      brand: 'Cessna',
      speed: 92,
      handling: 72,
      durability: 78,
      capacity: 8,
      priceEuros: 950000,
      priceVida: 3000,
    },
    {
      name: 'Citation CJ4 Jet',
      brand: 'Cessna',
      speed: 100,
      handling: 80,
      durability: 75,
      capacity: 6,
      priceEuros: 2200000,
      priceVida: 6500,
    },
  ];

  let vehiclesCreated = 0;
  for (const v of vehiclesData) {
    const existing = await prisma.vehicleTemplate.findFirst({
      where: { name: v.name, brand: v.brand },
    });
    if (existing) {
      await prisma.vehicleTemplate.update({
        where: { id: existing.id },
        data: v,
      });
    } else {
      await prisma.vehicleTemplate.create({ data: v });
      vehiclesCreated++;
    }
  }
  console.log(
    `✅ VehicleTemplate procesados: ${vehiclesData.length} (${vehiclesCreated} nuevos)`,
  );

  // ============================================
  // 3. CATÁLOGO DE ARMAS E ÍTEMS (ItemTemplate)
  // ============================================
  const itemsData: ItemSeed[] = [
    // Pistolas tácticas
    {
      name: 'Glock 19 Táctica',
      description: 'Pistola semiautomática compacta de servicio policial en calibre 9mm.',
      type: ItemType.WEAPON,
      rarity: Rarity.COMMON,
      stats: {
        category: 'PISTOL',
        caliber: '9x19mm Parabellum',
        damage: 28,
        range: 35,
        accuracy: 78,
        magazineSize: 15,
      },
      priceEuros: 1800,
    },
    {
      name: 'SIG Sauer P226 Legion',
      description: 'Pistola táctica de precisión con gatillo mejorado y miras de tritio.',
      type: ItemType.WEAPON,
      rarity: Rarity.RARE,
      stats: {
        category: 'PISTOL',
        caliber: '9x19mm Parabellum',
        damage: 34,
        range: 40,
        accuracy: 84,
        magazineSize: 15,
      },
      priceEuros: 3200,
    },
    {
      name: 'Desert Eagle .50 AE',
      description: 'Pistola de gran calibre con enorme poder de parada a corta y media distancia.',
      type: ItemType.WEAPON,
      rarity: Rarity.EPIC,
      stats: {
        category: 'PISTOL',
        caliber: '.50 AE',
        damage: 52,
        range: 45,
        accuracy: 72,
        magazineSize: 7,
      },
      priceEuros: 6500,
      priceVida: 50,
    },

    // Subfusiles
    {
      name: 'HK MP5A3',
      description: 'Subfusil táctico clásico ideal para combate urbano y asaltos rápidos.',
      type: ItemType.WEAPON,
      rarity: Rarity.RARE,
      stats: {
        category: 'SMG',
        caliber: '9x19mm Parabellum',
        damage: 32,
        range: 55,
        accuracy: 80,
        fireRate: 800,
        magazineSize: 30,
      },
      priceEuros: 5800,
    },
    {
      name: 'FN P90 Táctico',
      description: 'Subfusil PDW de alta cadencia y cargador de 50 proyectiles perforantes.',
      type: ItemType.WEAPON,
      rarity: Rarity.EPIC,
      stats: {
        category: 'SMG',
        caliber: '5.7x28mm',
        damage: 38,
        range: 60,
        accuracy: 83,
        fireRate: 900,
        magazineSize: 50,
      },
      priceEuros: 9200,
      priceVida: 80,
    },

    // Escopetas
    {
      name: 'Remington 870 Policial',
      description: 'Escopeta de corredera calibre 12 muy fiable para defensa cercana.',
      type: ItemType.WEAPON,
      rarity: Rarity.COMMON,
      stats: {
        category: 'SHOTGUN',
        caliber: '12 Gauge',
        damage: 68,
        range: 20,
        accuracy: 65,
        magazineSize: 8,
      },
      priceEuros: 3400,
    },
    {
      name: 'Benelli M4 Super 90',
      description: 'Escopeta semiautomática de combate empleada por unidades especiales.',
      type: ItemType.WEAPON,
      rarity: Rarity.EPIC,
      stats: {
        category: 'SHOTGUN',
        caliber: '12 Gauge',
        damage: 76,
        range: 24,
        accuracy: 72,
        magazineSize: 7,
      },
      priceEuros: 8900,
      priceVida: 75,
    },

    // Rifles de asalto
    {
      name: 'AK-47 Kalashnikov',
      description: 'Fusil de asalto robusto calibre 7.62x39mm con gran pegada.',
      type: ItemType.WEAPON,
      rarity: Rarity.RARE,
      stats: {
        category: 'ASSAULT_RIFLE',
        caliber: '7.62x39mm',
        damage: 58,
        range: 78,
        accuracy: 70,
        fireRate: 600,
        magazineSize: 30,
      },
      priceEuros: 11500,
    },
    {
      name: 'HK416 D Táctico',
      description: 'Carabina de asalto modular de alta precisión en calibre 5.56mm NATO.',
      type: ItemType.WEAPON,
      rarity: Rarity.EPIC,
      stats: {
        category: 'ASSAULT_RIFLE',
        caliber: '5.56x45mm NATO',
        damage: 54,
        range: 84,
        accuracy: 86,
        fireRate: 850,
        magazineSize: 30,
      },
      priceEuros: 16500,
      priceVida: 140,
    },
    {
      name: 'SCAR-H CQC',
      description: 'Rifle de combate pesado calibre 7.62x51mm NATO para operaciones de élite.',
      type: ItemType.WEAPON,
      rarity: Rarity.LEGENDARY,
      stats: {
        category: 'ASSAULT_RIFLE',
        caliber: '7.62x51mm NATO',
        damage: 66,
        range: 90,
        accuracy: 88,
        fireRate: 625,
        magazineSize: 20,
      },
      priceEuros: 28000,
      priceVida: 260,
    },

    // Chalecos balísticos
    {
      name: 'Chaleco Balístico Nivel II',
      description: 'Protección ligera ocultable frente a calibres de pistola estándar.',
      type: ItemType.CONSUMABLE,
      rarity: Rarity.COMMON,
      stats: {
        category: 'BODY_ARMOR',
        armor: 50,
        durability: 100,
      },
      priceEuros: 1500,
    },
    {
      name: 'Chaleco Balístico Nivel IIIA',
      description: 'Chaleco táctico reforzado capaz de detener subfusiles y munición pesada.',
      type: ItemType.CONSUMABLE,
      rarity: Rarity.RARE,
      stats: {
        category: 'BODY_ARMOR',
        armor: 85,
        durability: 150,
      },
      priceEuros: 3800,
    },
    {
      name: 'Chaleco Táctico Pesado Nivel IV',
      description: 'Placa cerámica balística militar resistente a impactos de rifle de asalto.',
      type: ItemType.CONSUMABLE,
      rarity: Rarity.EPIC,
      stats: {
        category: 'BODY_ARMOR',
        armor: 120,
        durability: 220,
      },
      priceEuros: 8500,
      priceVida: 70,
    },

    // Kits de tuning, derrape y nitro
    {
      name: 'Kit de Derrape Pro',
      description: 'Diferencial autoblocante y neumáticos semi-slick para dominar cada curva.',
      type: ItemType.VEHICLE,
      rarity: Rarity.RARE,
      stats: {
        category: 'TUNING_DRIFT',
        handlingBonus: 12,
        driftAngleBonus: 20,
      },
      priceEuros: 4500,
    },
    {
      name: 'Kit Suspensión & Frenos Racing',
      description: 'Coilovers ajustables y discos carbocerámicos para máxima estabilidad.',
      type: ItemType.VEHICLE,
      rarity: Rarity.EPIC,
      stats: {
        category: 'TUNING_HANDLING',
        handlingBonus: 18,
        brakingBonus: 22,
      },
      priceEuros: 9500,
      priceVida: 80,
    },
    {
      name: 'Kit Nitro Óxido N2O',
      description: 'Botella presurizada de óxido nitroso para aceleración instantánea en persecuciones.',
      type: ItemType.CONSUMABLE,
      rarity: Rarity.RARE,
      stats: {
        category: 'NITRO_KIT',
        speedBoost: 25,
        durationSeconds: 8,
      },
      priceEuros: 2200,
    },
    {
      name: 'Kit Biturbo Competición',
      description: 'Reprogramación ECU y doble turbocompresor forjado de alto rendimiento.',
      type: ItemType.VEHICLE,
      rarity: Rarity.LEGENDARY,
      stats: {
        category: 'TUNING_ENGINE',
        speedBonus: 22,
        accelerationBonus: 25,
      },
      priceEuros: 18000,
      priceVida: 160,
    },
  ];

  let itemsCreated = 0;
  for (const item of itemsData) {
    const existing = await prisma.itemTemplate.findFirst({
      where: { name: item.name },
    });
    if (existing) {
      await prisma.itemTemplate.update({
        where: { id: existing.id },
        data: item,
      });
    } else {
      await prisma.itemTemplate.create({ data: item });
      itemsCreated++;
    }
  }
  console.log(
    `✅ ItemTemplate procesados: ${itemsData.length} (${itemsCreated} nuevos)`,
  );
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
