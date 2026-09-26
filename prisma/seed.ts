import { PrismaClient, ItemType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed de datos para VidaLoca MMORPG...');

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

  const vehiclesData = [
    { name: 'Seat Ibiza', brand: 'SEAT', speed: 140, handling: 80, durability: 65, capacity: 5, priceEuros: 15000 },
    { name: 'Volkswagen Golf', brand: 'Volkswagen', speed: 160, handling: 82, durability: 70, capacity: 5, priceEuros: 22000 },
    { name: 'Porsche 911 Carrera', brand: 'Porsche', speed: 295, handling: 95, durability: 80, capacity: 2, priceEuros: 120000 },
    { name: 'Ferrari 488 GTB', brand: 'Ferrari', speed: 330, handling: 97, durability: 75, capacity: 2, priceEuros: 250000, priceVida: 15000 },
    { name: 'Lamborghini Huracán', brand: 'Lamborghini', speed: 325, handling: 96, durability: 78, capacity: 2, priceEuros: 240000, priceVida: 14500 },
    { name: 'Range Rover Sport', brand: 'Land Rover', speed: 220, handling: 75, durability: 85, capacity: 5, priceEuros: 85000 },
    { name: 'BMW X5', brand: 'BMW', speed: 230, handling: 78, durability: 83, capacity: 5, priceEuros: 75000 },
    { name: 'Mercedes G-Class', brand: 'Mercedes', speed: 210, handling: 70, durability: 90, capacity: 5, priceEuros: 130000, priceVida: 8000 },
    { name: 'Honda CBR600RR', brand: 'Honda', speed: 260, handling: 90, durability: 75, capacity: 1, priceEuros: 12000 },
    { name: 'Yamaha YZF-R1', brand: 'Yamaha', speed: 280, handling: 93, durability: 78, capacity: 1, priceEuros: 18000 },
    { name: 'Ducati Panigale V4', brand: 'Ducati', speed: 300, handling: 95, durability: 72, capacity: 1, priceEuros: 25000, priceVida: 3500 },
    { name: 'Seat 600', brand: 'SEAT', speed: 95, handling: 55, durability: 60, capacity: 4, priceEuros: 8000 },
    { name: 'Ford Mustang 1967', brand: 'Ford', speed: 180, handling: 60, durability: 75, capacity: 4, priceEuros: 45000 },
    { name: 'Armored BMW 7 Series', brand: 'BMW', speed: 210, handling: 72, durability: 100, capacity: 4, priceEuros: 180000, priceVida: 12000 },
  ];

  for (const v of vehiclesData) {
    await prisma.vehicleTemplate.create({ data: v });
  }
  console.log(`✅ ${vehiclesData.length} vehículos creados`);

  const itemsData = [
    { name: 'Puños', description: 'Tus propias manos', type: ItemType.WEAPON, rarity: 'COMMON', priceEuros: 0 },
    { name: 'Navaja Española', description: 'Clásica navaja', type: ItemType.WEAPON, rarity: 'COMMON', priceEuros: 150 },
    { name: 'Bate de Béisbol', description: 'Bate de madera', type: ItemType.WEAPON, rarity: 'COMMON', priceEuros: 80 },
    { name: 'Katana', description: 'Espada japonesa', type: ItemType.WEAPON, rarity: 'RARE', priceEuros: 800 },
    { name: 'Glock 17', description: 'Pistola austriaca', type: ItemType.WEAPON, rarity: 'COMMON', priceEuros: 500 },
    { name: 'SIG Sauer P226', description: 'Pistola alemana', type: ItemType.WEAPON, rarity: 'COMMON', priceEuros: 650 },
    { name: 'Desert Eagle .50', description: 'Pistola gran calibre', type: ItemType.WEAPON, rarity: 'RARE', priceEuros: 1200 },
    { name: 'Golden Desert Eagle', description: 'Versión dorada', type: ItemType.WEAPON, rarity: 'LEGENDARY', priceVida: 2500 },
    { name: 'UMP45', description: 'Subfusil compacto', type: ItemType.WEAPON, rarity: 'COMMON', priceEuros: 1500 },
    { name: 'MP5', description: 'Subfusil legendario', type: ItemType.WEAPON, rarity: 'RARE', priceEuros: 1800 },
    { name: 'Vector .45', description: 'Subfusil alta cadencia', type: ItemType.WEAPON, rarity: 'EPIC', priceEuros: 2200 },
    { name: 'Remington 870', description: 'Escopeta bombeo', type: ItemType.WEAPON, rarity: 'COMMON', priceEuros: 800 },
    { name: 'AA-12 Automática', description: 'Escopeta automática', type: ItemType.WEAPON, rarity: 'EPIC', priceEuros: 3500 },
    { name: 'AK-47', description: 'Fusil soviético', type: ItemType.WEAPON, rarity: 'RARE', priceEuros: 2500 },
    { name: 'M4A1', description: 'Carabina americana', type: ItemType.WEAPON, rarity: 'RARE', priceEuros: 2800 },
    { name: 'SCAR-L', description: 'Fusil operaciones especiales', type: ItemType.WEAPON, rarity: 'EPIC', priceEuros: 3200 },
    { name: 'AWM', description: 'Rifle precisión británico', type: ItemType.WEAPON, rarity: 'EPIC', priceEuros: 5000 },
    { name: 'Barrett .50cal', description: 'Rifle antimaterial', type: ItemType.WEAPON, rarity: 'LEGENDARY', priceEuros: 8000 },
    { name: 'Minigun Portátil', description: 'Arma devastadora', type: ItemType.WEAPON, rarity: 'LEGENDARY', priceVida: 15000 },
    { name: 'Lanzagranadas RPG', description: 'Lanzador cohetes', type: ItemType.WEAPON, rarity: 'LEGENDARY', priceVida: 12000 },
  ];

  for (const item of itemsData) {
    await prisma.itemTemplate.create({ data: item as any });
  }
  console.log(`✅ ${itemsData.length} items/armas creados`);


  // ─── Property templates ───────────────────────────────────────────────
  const propertiesData = [
    { name: 'Piso en Malasaña', location: 'Madrid', type: 'APARTMENT', capacity: 2, security: 40, priceEuros: 180000, rentYield: 0.025 },
    { name: 'Ático en Salamanca', location: 'Madrid', type: 'APARTMENT', capacity: 3, security: 70, priceEuros: 650000, rentYield: 0.03 },
    { name: 'Chalet en La Moraleja', location: 'Madrid', type: 'MANSION', capacity: 8, security: 90, priceEuros: 2500000, priceVida: 20000, rentYield: 0.02 },
    { name: 'Loft en El Born', location: 'Barcelona', type: 'APARTMENT', capacity: 2, security: 55, priceEuros: 320000, rentYield: 0.028 },
    { name: 'Villa en Puerto Banús', location: 'Marbella', type: 'MANSION', capacity: 10, security: 95, priceEuros: 4500000, priceVida: 35000, rentYield: 0.015 },
    { name: 'Nave en Villaverde', location: 'Madrid', type: 'WAREHOUSE', capacity: 20, security: 60, priceEuros: 280000, rentYield: 0.04 },
    { name: 'Club en Chueca', location: 'Madrid', type: 'CLUB', capacity: 150, security: 50, priceEuros: 900000, rentYield: 0.05 },
    { name: 'Garaje en Chamberí', location: 'Madrid', type: 'GARAGE', capacity: 6, security: 45, priceEuros: 95000, rentYield: 0.035 },
  ];

  for (const p of propertiesData) {
    await prisma.propertyTemplate.create({ data: p as any });
  }
  console.log(`✅ ${propertiesData.length} propiedades creadas`);

  // ─── Mission templates ────────────────────────────────────────────────
  const missionsData = [
    { title: 'Primer contacto', description: 'Habla con el contacto en Sol y recoge el paquete.', difficulty: 'EASY', rewardEuros: 250, rewardXp: 100 },
    { title: 'Reparto exprés', description: 'Entrega 3 paquetes por Madrid Centro sin levantar sospechas.', difficulty: 'EASY', rewardEuros: 400, rewardXp: 150 },
    { title: 'Vigilancia en Malasaña', description: 'Observa el local durante 10 minutos y reporta.', difficulty: 'MEDIUM', rewardEuros: 800, rewardXp: 300 },
    { title: 'Cobro de deuda', description: 'Recupera el dinero que te deben en Lavapiés.', difficulty: 'MEDIUM', rewardEuros: 1200, rewardXp: 400 },
    { title: 'Noche en Puerto Banús', description: 'Consigue una invitación VIP y escucha una conversación comprometida.', difficulty: 'HARD', rewardEuros: 3500, rewardXp: 900 },
    { title: 'El paquete de Bilbao', description: 'Recoge mercancía en el Casco Viejo y llévala a Madrid sin ser interceptado.', difficulty: 'HARD', rewardEuros: 4200, rewardXp: 1100 },
    { title: 'Traición en el Gótico', description: 'Un contacto te ha vendido. Averigua quién y cierra el trato a tu favor.', difficulty: 'SUICIDE', rewardEuros: 9000, rewardXp: 2000 },

    { title: 'Infiltración en el club', description: 'Entra al club VIP de Salamanca y consigue información.', difficulty: 'HARD', rewardEuros: 3500, rewardXp: 800 },
    { title: 'Carrera ilegal', description: 'Gana la carrera callejera de la M-30.', difficulty: 'HARD', rewardEuros: 5000, rewardXp: 1000 },
    { title: 'Asalto al almacén', description: 'Roba el cargamento de un almacén en el polígono.', difficulty: 'SUICIDE', rewardEuros: 15000, rewardXp: 2500 },
    { title: 'El gran golpe', description: 'Planifica y ejecuta el robo a una joyería de lujo en Barcelona.', difficulty: 'SUICIDE', rewardEuros: 50000, rewardXp: 5000 },
    // Narrativas Fase 4 – más historia, menos grindeo
    { title: 'El favor de Chamberí', description: 'Un abogado necesita que desaparezca un sobre antes del juicio. Gris, rápido, bien pagado.', difficulty: 'EASY', rewardEuros: 1200, rewardXp: 200 },
    { title: 'Yate sin nombre', description: 'En Puerto Banús hay un yate que no figura en ningún registro. Ventana de 20 minutos.', difficulty: 'HARD', rewardEuros: 15000, rewardXp: 1800 },
    { title: 'Deuda en Triana', description: 'En Sevilla alguien debe mucho y habla de más. Cobra… o cierra el pico ajeno.', difficulty: 'MEDIUM', rewardEuros: 4000, rewardXp: 600 },
    { title: 'El chivato de Bilbao', description: 'Un soplo en el Casco Viejo puede tumbar a medio clan del norte. ¿Lo usas o lo vendes?', difficulty: 'MEDIUM', rewardEuros: 5500, rewardXp: 700 },
    { title: 'Ático en Salamanca', description: 'La llave de un ático vacío. Dentro hay algo que varios clanes quieren.', difficulty: 'SUICIDE', rewardEuros: 40000, rewardXp: 4000 },
    { title: 'Noche en las Artes', description: 'Valencia. Evento cultural, trajes caros y un maletín que no debería estar ahí.', difficulty: 'MEDIUM', rewardEuros: 6000, rewardXp: 800 },
    { title: 'Carrera a Marbella', description: 'Madrid → Marbella contra reloj. La policía ya tiene el aviso.', difficulty: 'HARD', rewardEuros: 10000, rewardXp: 1500 },
  ];

  for (const m of missionsData) {
    await prisma.missionTemplate.create({ data: m as any });
  }
  console.log(`✅ ${missionsData.length} misiones creadas`);

  // ─── Skills ───────────────────────────────────────────────────────────
  const skillsData = [
    { name: 'Combate cuerpo a cuerpo', description: 'Mejora el daño y la defensa en peleas cuerpo a cuerpo.', maxLevel: 20, category: 'COMBAT' },
    { name: 'Armas de fuego', description: 'Precisión y control de retroceso con armas de fuego.', maxLevel: 20, category: 'COMBAT' },
    { name: 'Conducción agresiva', description: 'Mejor manejo y velocidad en persecuciones.', maxLevel: 15, category: 'DRIVING' },
    { name: 'Sigilo', description: 'Reduce la probabilidad de ser detectado.', maxLevel: 15, category: 'STEALTH' },
    { name: 'Negociación', description: 'Mejores precios de compra/venta y sobornos.', maxLevel: 10, category: 'BUSINESS' },
    { name: 'Carisma callejero', description: 'Mejor reputación y acceso a contactos.', maxLevel: 10, category: 'SOCIAL' },
  ];

  for (const s of skillsData) {
    await prisma.skill.create({ data: s as any });
  }
  console.log(`✅ ${skillsData.length} skills creadas`);

  // ─── Achievements ─────────────────────────────────────────────────────
  const achievementsData = [
    { name: 'Primeros pasos', description: 'Alcanza el nivel 5', condition: { type: 'reach_level', value: 5 }, rewardVida: 50, rewardEuros: 500 },
    { name: 'Veterano de la calle', description: 'Alcanza el nivel 25', condition: { type: 'reach_level', value: 25 }, rewardVida: 200, rewardEuros: 5000 },
    { name: 'Leyenda viva', description: 'Alcanza el nivel 50', condition: { type: 'reach_level', value: 50 }, rewardVida: 1000, rewardEuros: 25000 },
    { name: 'Rico', description: 'Acumula 100.000 €', condition: { type: 'earn_euros', value: 100000 }, rewardVida: 300, rewardEuros: 0 },
    { name: 'Millonario', description: 'Acumula 1.000.000 €', condition: { type: 'earn_euros', value: 1000000 }, rewardVida: 2000, rewardEuros: 0 },
    { name: 'Respetado', description: 'Alcanza 500 de reputación', condition: { type: 'reputation', value: 500 }, rewardVida: 150, rewardEuros: 2000 },
  ];

  for (const a of achievementsData) {
    await prisma.achievement.create({ data: a as any });
  }
  console.log(`✅ ${achievementsData.length} logros creados`);

  // ─── Battle Pass Season ───────────────────────────────────────────────
  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 3);

  await prisma.battlePassSeason.create({
    data: {
      seasonNumber: 1,
      name: 'Temporada 1 – Calle y Lujo',
      startDate: now,
      endDate: end,
      isActive: true,
    },
  });
  console.log('✅ Battle Pass Season 1 creada');


  const hashedPassword = await bcrypt.hash('Admin123!', 10);
  
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@vidaloca.com',
      password: hashedPassword,
      username: 'AdminVidaLoca',
    },
  });

  const firstTerritory = await prisma.territory.findFirst();

  await prisma.player.create({
    data: {
      userId: adminUser.id,
      displayName: 'AdminVidaLoca',
      level: 100,
      xp: 500000,
      euros: 1000000,
      vidaCoins: 50000,
      locationId: firstTerritory?.id || null,
    },
  });

  console.log('✅ Usuario admin creado (email: admin@vidaloca.com, password: Admin123!)');
  console.log('\n🎉 ¡Seed completado exitosamente!');
  console.log('📊 Resumen:');
  console.log(`   - ${territoriesData.length} territorios`);
  console.log(`   - ${vehiclesData.length} vehículos`);
  console.log(`   - ${itemsData.length} armas/items`);
  console.log(`   - ${propertiesData.length} propiedades`);
  console.log(`   - ${missionsData.length} misiones`);
  console.log(`   - ${skillsData.length} skills`);
  console.log(`   - ${achievementsData.length} logros`);
  console.log('   - 1 Battle Pass season');
  console.log('   - 1 usuario administrador\n');
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
