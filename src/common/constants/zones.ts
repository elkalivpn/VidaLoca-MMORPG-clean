export type ZoneVibe = 'business' | 'nightlife' | 'luxury' | 'street';

export interface ZoneDef {
  id: string;
  name: string;
  city: string;
  description: string;
  vibe: ZoneVibe;
  lng: number;
  lat: number;
}

export interface HighwayRoute {
  id: string;
  highway: string;
  name: string;
  from: string;
  to: string;
  distanceKm: number;
  tollEuros: number;
}

export const ZONES: ZoneDef[] = [
  {
    id: 'madrid_centro',
    name: 'Sol / Gran Vía',
    city: 'Madrid',
    description:
      'El kilómetro cero de España. Oficinas, despachos discretos, tráfico constante y dinero rápido.',
    vibe: 'business',
    lng: -3.7038,
    lat: 40.4168,
  },
  {
    id: 'malasana',
    name: 'Malasaña',
    city: 'Madrid',
    description:
      'Garitos de madrugada, neones, trapicheos entre callejones y contactos de la noche madrileña.',
    vibe: 'nightlife',
    lng: -3.7058,
    lat: 40.426,
  },
  {
    id: 'salamanca',
    name: 'Barrio de Salamanca',
    city: 'Madrid',
    description:
      'Boutiques de lujo, coches de alta gama en doble fila y tratos de guante blanco.',
    vibe: 'luxury',
    lng: -3.6838,
    lat: 40.4295,
  },
  {
    id: 'toledo_alcazar',
    name: 'Casco Histórico / Alcázar',
    city: 'Toledo',
    description:
      'Murallas medievales sobre el Tajo, pasadizos discretos y puntos ciegos a un paso de Madrid.',
    vibe: 'street',
    lng: -4.0273,
    lat: 39.8628,
  },
  {
    id: 'valladolid_campo',
    name: 'Campo Grande / Pisuerga',
    city: 'Valladolid',
    description:
      'Nudo logístico del centro peninsular. Transporte pesado, despachos de logística y rutas al norte.',
    vibe: 'business',
    lng: -4.7245,
    lat: 41.6523,
  },
  {
    id: 'salamanca_plaza',
    name: 'Plaza Mayor / Campus',
    city: 'Salamanca',
    description:
      'Piedra dorada, noche universitaria interminable y enlaces rápidos hacia la frontera oeste.',
    vibe: 'nightlife',
    lng: -5.6635,
    lat: 40.9701,
  },
  {
    id: 'zaragoza_delicias',
    name: 'El Pilar / Delicias',
    city: 'Zaragoza',
    description:
      'Corredor estratégico entre Madrid, Barcelona y el norte. Almacenes, convoys y tráfico de paso.',
    vibe: 'street',
    lng: -0.8891,
    lat: 41.6488,
  },
  {
    id: 'barcelona_ramblas',
    name: 'Las Ramblas',
    city: 'Barcelona',
    description:
      'Bullir incesante de turistas, carteristas expertos y mercancía que entra por el puerto.',
    vibe: 'street',
    lng: 2.1734,
    lat: 41.3809,
  },
  {
    id: 'barcelona_gotico',
    name: 'Barrio Gótico',
    city: 'Barcelona',
    description:
      'Calles estrechas de piedra donde se pierden los perseguidores y se cierran pactos en la sombra.',
    vibe: 'street',
    lng: 2.1769,
    lat: 41.3833,
  },
  {
    id: 'marbella_centro',
    name: 'Marbella Centro',
    city: 'Marbella',
    description:
      'Sol de la Costa del Sol, capital discreto y villas vigiladas frente al Mediterráneo.',
    vibe: 'luxury',
    lng: -4.8856,
    lat: 36.5101,
  },
  {
    id: 'puerto_banus',
    name: 'Puerto Banús',
    city: 'Marbella',
    description:
      'Yates, superdeportivos, relojes de seis cifras y la élite más turbia de Europa.',
    vibe: 'luxury',
    lng: -4.9526,
    lat: 36.4879,
  },
  {
    id: 'sevilla_casco',
    name: 'Casco Antiguo',
    city: 'Sevilla',
    description:
      'Calor del sur, callejuelas del Arenal y Triana, y rutas clave hacia el Estrecho.',
    vibe: 'street',
    lng: -5.9845,
    lat: 37.3891,
  },
  {
    id: 'valencia_artes',
    name: 'Ciudad de las Artes',
    city: 'Valencia',
    description:
      'Avenidas amplias, puerto estratégico del Levante y negocios de importación y exportación.',
    vibe: 'business',
    lng: -0.3505,
    lat: 39.4549,
  },
  {
    id: 'bilbao_casco',
    name: 'Casco Viejo',
    city: 'Bilbao',
    description:
      'Las Siete Calles bajo la lluvia del norte. Lealtad de hierro y rutas hacia la frontera.',
    vibe: 'street',
    lng: -2.9234,
    lat: 43.257,
  },
  {
    id: 'bilbao_abando',
    name: 'Abando / Gran Vía',
    city: 'Bilbao',
    description:
      'El corazón financiero e industrial de la ría. Torres de cristal, banca vasca y contratos blindados.',
    vibe: 'business',
    lng: -2.9349,
    lat: 43.263,
  },
  {
    id: 'sansebastian_concha',
    name: 'La Concha / Parte Vieja',
    city: 'San Sebastián',
    description:
      'Bahía señorial, gastronomía de élite y dinero discreto a minutos de la frontera francesa.',
    vibe: 'luxury',
    lng: -1.9812,
    lat: 43.3183,
  },
  {
    id: 'vitoria_ensanche',
    name: 'Ensanche / Almendra',
    city: 'Vitoria-Gasteiz',
    description:
      'Encrucijada entre el Cantábrico y la meseta. Plataformas logísticas y peajes clave.',
    vibe: 'business',
    lng: -2.6714,
    lat: 42.8467,
  },
  {
    id: 'coruna_marina',
    name: 'La Marina / Riazor',
    city: 'A Coruña',
    description:
      'Galerías frente al Atlántico, puerto pesquero y sede de fortunas textiles y navieras.',
    vibe: 'business',
    lng: -8.4115,
    lat: 43.3623,
  },
  {
    id: 'vigo_puerto',
    name: 'Puerto de Vigo / Ría',
    city: 'Vigo',
    description:
      'El puerto más activo del Atlántico ibérico. Planeadoras en la ría, astilleros y mercancía sin declarar.',
    vibe: 'street',
    lng: -8.7207,
    lat: 42.2406,
  },
  {
    id: 'santiago_obradoiro',
    name: 'Obradoiro / Ensanche',
    city: 'Santiago de Compostela',
    description:
      'Lluvia constante sobre piedra milenaria, rutas de peregrinos y encuentros discretos bajo los soportales.',
    vibe: 'nightlife',
    lng: -8.5448,
    lat: 42.8782,
  },
  {
    id: 'palma_paseo',
    name: 'Paseo Marítimo / La Seu',
    city: 'Palma',
    description:
      'Megayates en la bahía de Mallorca, clubs VIP internacionales y capital offshore frente al mar.',
    vibe: 'luxury',
    lng: 2.6502,
    lat: 39.5696,
  },
  {
    id: 'ibiza_daltvila',
    name: 'Dalt Vila / Marina Botafoch',
    city: 'Ibiza',
    description:
      'Capital mundial de la noche electrónica, reservados imposibles y jet privado en la pista.',
    vibe: 'nightlife',
    lng: 1.432,
    lat: 38.9067,
  },
  {
    id: 'laspalmas_canteras',
    name: 'Las Canteras / Puerto La Luz',
    city: 'Las Palmas',
    description:
      'Puente tricontinental en el Atlántico. Zona franca portuaria, contenedores y ruta entre Europa, África y América.',
    vibe: 'business',
    lng: -15.4363,
    lat: 28.1235,
  },
  {
    id: 'tenerife_santacruz',
    name: 'Santa Cruz / Anaga',
    city: 'Tenerife',
    description:
      'Muelle atlántico bajo el Teide, carnavales eternos y carreteras volcánicas llenas de curvas.',
    vibe: 'nightlife',
    lng: -16.2518,
    lat: 28.4636,
  },
  {
    id: 'malaga_soho',
    name: 'Soho / Muelle Uno',
    city: 'Málaga',
    description:
      'Arte urbano, club náutico tecnológico, terrazas nocturnas y enlace rápido con la Costa del Sol.',
    vibe: 'nightlife',
    lng: -4.4214,
    lat: 36.7165,
  },
  {
    id: 'granada_albaicin',
    name: 'Albaicín / Centro',
    city: 'Granada',
    description:
      'Miradores laberínticos bajo la Alhambra, teterías discretas y rutas de sierra hacia la costa.',
    vibe: 'street',
    lng: -3.5936,
    lat: 37.1812,
  },
  {
    id: 'alicante_explanada',
    name: 'Explanada / Puerto',
    city: 'Alicante',
    description:
      'Palmeras frente al puerto deportivo, inversores extranjeros y ferris privados al Levante.',
    vibe: 'luxury',
    lng: -0.4815,
    lat: 38.3452,
  },
  {
    id: 'murcia_catedral',
    name: 'Catedral / Trapería',
    city: 'Murcia',
    description:
      'Capital agrícola y logística del sureste. Naves de exportación y tratos bajo el sol del Segura.',
    vibe: 'business',
    lng: -1.1307,
    lat: 37.9869,
  },
  {
    id: 'gijon_cimadevilla',
    name: 'Cimadevilla / El Muro',
    city: 'Gijón',
    description:
      'Acantilados cantábricos, sidrerías de puerto y descarga discreta entre el mar y Asturias.',
    vibe: 'street',
    lng: -5.6615,
    lat: 43.5453,
  },
  {
    id: 'santander_sardinero',
    name: 'El Sardinero / Bahía',
    city: 'Santander',
    description:
      'Casinos históricos, banca señorial frente a la bahía y ferris internacionales al norte.',
    vibe: 'luxury',
    lng: -3.788,
    lat: 43.4718,
  },
  {
    id: 'pamplona_casco',
    name: 'Estafeta / Casco Antiguo',
    city: 'Pamplona',
    description:
      'Calles amuralladas, peñas nocturnas y paso estratégico hacia los Pirineos y el Ebro.',
    vibe: 'nightlife',
    lng: -1.6432,
    lat: 42.8169,
  },
  {
    id: 'lanzarote_arrecife',
    name: 'Arrecife / Marina Lanzarote',
    city: 'Lanzarote',
    description:
      'Marinas volcánicas de lujo, capital discreto entre islas y yates transatlánticos.',
    vibe: 'luxury',
    lng: -13.5477,
    lat: 28.963,
  },
];

export const ZONES_BY_ID: Record<string, ZoneDef> = ZONES.reduce(
  (acc, zone) => {
    acc[zone.id] = zone;
    return acc;
  },
  {} as Record<string, ZoneDef>,
);

/**
 * Grafo bidireccional de autopistas, autovías, ferris y puentes aéreos reales de España.
 */
export const HIGHWAY_ROUTES: HighwayRoute[] = [
  {
    id: 'a1-madrid-bilbao',
    highway: 'A-1',
    name: 'Autovía del Norte (A-1)',
    from: 'madrid_centro',
    to: 'bilbao_casco',
    distanceKm: 395,
    tollEuros: 18,
  },
  {
    id: 'a2-madrid-barcelona',
    highway: 'A-2',
    name: 'Autovía del Nordeste (A-2 / AP-2)',
    from: 'madrid_centro',
    to: 'barcelona_ramblas',
    distanceKm: 620,
    tollEuros: 22,
  },
  {
    id: 'a3-madrid-valencia',
    highway: 'A-3',
    name: 'Autovía del Este (A-3)',
    from: 'madrid_centro',
    to: 'valencia_artes',
    distanceKm: 355,
    tollEuros: 0,
  },
  {
    id: 'a4-madrid-sevilla',
    highway: 'A-4',
    name: 'Autovía del Sur (A-4)',
    from: 'madrid_centro',
    to: 'sevilla_casco',
    distanceKm: 530,
    tollEuros: 0,
  },
  {
    id: 'ap7-barcelona-valencia',
    highway: 'AP-7',
    name: 'Autopista del Mediterráneo (AP-7)',
    from: 'barcelona_ramblas',
    to: 'valencia_artes',
    distanceKm: 350,
    tollEuros: 14,
  },
  {
    id: 'a7-valencia-marbella',
    highway: 'A-7',
    name: 'Autovía del Mediterráneo (A-7)',
    from: 'valencia_artes',
    to: 'marbella_centro',
    distanceKm: 630,
    tollEuros: 8,
  },
  {
    id: 'a92-sevilla-marbella',
    highway: 'A-92',
    name: 'Autovía de Andalucía / Costa del Sol (A-92 / AP-46)',
    from: 'sevilla_casco',
    to: 'marbella_centro',
    distanceKm: 255,
    tollEuros: 6,
  },
  {
    id: 'ap68-bilbao-barcelona',
    highway: 'AP-68',
    name: 'Autopista Vasco-Aragonesa (AP-68 / AP-2)',
    from: 'bilbao_casco',
    to: 'barcelona_ramblas',
    distanceKm: 610,
    tollEuros: 32,
  },
  // Centro de España
  {
    id: 'a42-madrid-toledo',
    highway: 'A-42',
    name: 'Autovía de Toledo (A-42)',
    from: 'madrid_centro',
    to: 'toledo_alcazar',
    distanceKm: 72,
    tollEuros: 0,
  },
  {
    id: 'a4-toledo-sevilla',
    highway: 'A-4 / N-401',
    name: 'Ruta La Mancha - Andalucía',
    from: 'toledo_alcazar',
    to: 'sevilla_casco',
    distanceKm: 465,
    tollEuros: 0,
  },
  {
    id: 'a6-madrid-valladolid',
    highway: 'A-6 / A-601',
    name: 'Autovía del Noroeste - Pinares',
    from: 'madrid_centro',
    to: 'valladolid_campo',
    distanceKm: 210,
    tollEuros: 9,
  },
  {
    id: 'a62-valladolid-salamanca',
    highway: 'A-62',
    name: 'Autovía de Castilla (A-62)',
    from: 'valladolid_campo',
    to: 'salamanca_plaza',
    distanceKm: 115,
    tollEuros: 0,
  },
  {
    id: 'a2-madrid-zaragoza',
    highway: 'A-2',
    name: 'Autovía del Nordeste (Madrid - Zaragoza)',
    from: 'madrid_centro',
    to: 'zaragoza_delicias',
    distanceKm: 320,
    tollEuros: 0,
  },
  {
    id: 'ap2-zaragoza-barcelona',
    highway: 'AP-2',
    name: 'Autopista del Nordeste (Zaragoza - Barcelona)',
    from: 'zaragoza_delicias',
    to: 'barcelona_ramblas',
    distanceKm: 310,
    tollEuros: 15,
  },
  {
    id: 'a23-zaragoza-valencia',
    highway: 'A-23',
    name: 'Autovía Mudéjar (A-23)',
    from: 'zaragoza_delicias',
    to: 'valencia_artes',
    distanceKm: 310,
    tollEuros: 0,
  },
  // País Vasco
  {
    id: 'ap68-bilbao-vitoria',
    highway: 'AP-68',
    name: 'Autopista Vasco-Aragonesa (Bilbao - Vitoria)',
    from: 'bilbao_casco',
    to: 'vitoria_ensanche',
    distanceKm: 65,
    tollEuros: 6,
  },
  {
    id: 'ap8-bilbao-sansebastian',
    highway: 'AP-8',
    name: 'Autopista del Cantábrico (AP-8)',
    from: 'bilbao_casco',
    to: 'sansebastian_concha',
    distanceKm: 100,
    tollEuros: 11,
  },
  {
    id: 'n1-vitoria-sansebastian',
    highway: 'A-1 / N-I',
    name: 'Eje Interior Vasco (Vitoria - Donostia)',
    from: 'vitoria_ensanche',
    to: 'sansebastian_concha',
    distanceKm: 102,
    tollEuros: 4,
  },
  {
    id: 'ap68-vitoria-zaragoza',
    highway: 'AP-68',
    name: 'Corredor del Ebro (Vitoria - Zaragoza)',
    from: 'vitoria_ensanche',
    to: 'zaragoza_delicias',
    distanceKm: 255,
    tollEuros: 20,
  },
  // Galicia
  {
    id: 'a6-madrid-coruna',
    highway: 'A-6',
    name: 'Autovía del Noroeste (Madrid - A Coruña)',
    from: 'madrid_centro',
    to: 'coruna_marina',
    distanceKm: 590,
    tollEuros: 14,
  },
  {
    id: 'ap9-coruna-santiago',
    highway: 'AP-9',
    name: 'Autopista del Atlántico (A Coruña - Santiago)',
    from: 'coruna_marina',
    to: 'santiago_obradoiro',
    distanceKm: 75,
    tollEuros: 8,
  },
  {
    id: 'ap9-santiago-vigo',
    highway: 'AP-9',
    name: 'Autopista del Atlántico (Santiago - Vigo)',
    from: 'santiago_obradoiro',
    to: 'vigo_puerto',
    distanceKm: 90,
    tollEuros: 10,
  },
  {
    id: 'a52-salamanca-vigo',
    highway: 'A-66 / A-52',
    name: 'Autovía de las Rías Baixas (A-52)',
    from: 'salamanca_plaza',
    to: 'vigo_puerto',
    distanceKm: 430,
    tollEuros: 0,
  },
  // Islas Baleares
  {
    id: 'mar-bcn-palma',
    highway: 'Ferry / Puente Aéreo',
    name: 'Conexión Marítimo-Aérea Barcelona - Palma',
    from: 'barcelona_ramblas',
    to: 'palma_paseo',
    distanceKm: 210,
    tollEuros: 45,
  },
  {
    id: 'mar-vlc-ibiza',
    highway: 'Ferry / Puente Aéreo',
    name: 'Conexión Marítimo-Aérea Valencia - Ibiza',
    from: 'valencia_artes',
    to: 'ibiza_daltvila',
    distanceKm: 165,
    tollEuros: 40,
  },
  {
    id: 'mar-ibiza-palma',
    highway: 'Ferry Interinsular',
    name: 'Ruta Balear Ibiza - Palma',
    from: 'ibiza_daltvila',
    to: 'palma_paseo',
    distanceKm: 130,
    tollEuros: 30,
  },
  // Islas Canarias
  {
    id: 'air-madrid-laspalmas',
    highway: 'Puente Aéreo Atlántico',
    name: 'Puente Aéreo Madrid - Gran Canaria',
    from: 'madrid_centro',
    to: 'laspalmas_canteras',
    distanceKm: 1760,
    tollEuros: 95,
  },
  {
    id: 'air-sevilla-tenerife',
    highway: 'Ruta Atlántica Sur',
    name: 'Conexión Aérea / Naviera Sevilla - Tenerife',
    from: 'sevilla_casco',
    to: 'tenerife_santacruz',
    distanceKm: 1410,
    tollEuros: 85,
  },
  {
    id: 'mar-gc-tf',
    highway: 'Ferry Canario',
    name: 'Puente Marítimo-Aéreo Gran Canaria - Tenerife',
    from: 'laspalmas_canteras',
    to: 'tenerife_santacruz',
    distanceKm: 85,
    tollEuros: 25,
  },
  // Andalucía Oriental & Levante
  {
    id: 'ap7-marbella-malaga',
    highway: 'AP-7 / A-7',
    name: 'Autopista de la Costa del Sol (Marbella - Málaga)',
    from: 'marbella_centro',
    to: 'malaga_soho',
    distanceKm: 58,
    tollEuros: 5,
  },
  {
    id: 'a92-malaga-granada',
    highway: 'A-92',
    name: 'Autovía de Andalucía (Málaga - Granada)',
    from: 'malaga_soho',
    to: 'granada_albaicin',
    distanceKm: 125,
    tollEuros: 0,
  },
  {
    id: 'a92-sevilla-granada',
    highway: 'A-92',
    name: 'Eje Transversal Andaluz (Sevilla - Granada)',
    from: 'sevilla_casco',
    to: 'granada_albaicin',
    distanceKm: 250,
    tollEuros: 0,
  },
  {
    id: 'a92-granada-murcia',
    highway: 'A-92N / A-7',
    name: 'Corredor Sureste (Granada - Murcia)',
    from: 'granada_albaicin',
    to: 'murcia_catedral',
    distanceKm: 278,
    tollEuros: 0,
  },
  {
    id: 'a7-murcia-alicante',
    highway: 'A-7',
    name: 'Autovía del Mediterráneo (Murcia - Alicante)',
    from: 'murcia_catedral',
    to: 'alicante_explanada',
    distanceKm: 82,
    tollEuros: 0,
  },
  {
    id: 'a31-madrid-alicante',
    highway: 'A-31 / A-3',
    name: 'Autovía de Alicante (Madrid - Alicante)',
    from: 'madrid_centro',
    to: 'alicante_explanada',
    distanceKm: 422,
    tollEuros: 0,
  },
  {
    id: 'ap7-alicante-valencia',
    highway: 'AP-7 / A-7',
    name: 'Corredor Levantino (Alicante - Valencia)',
    from: 'alicante_explanada',
    to: 'valencia_artes',
    distanceKm: 168,
    tollEuros: 0,
  },
  {
    id: 'mar-alicante-ibiza',
    highway: 'Ferry Balear Sur',
    name: 'Ferry Rápido Alicante / Dénia - Ibiza',
    from: 'alicante_explanada',
    to: 'ibiza_daltvila',
    distanceKm: 175,
    tollEuros: 38,
  },
  // Cornisa Cantábrica & Navarra
  {
    id: 'a8-bilbao-santander',
    highway: 'A-8',
    name: 'Autovía del Cantábrico (Bilbao - Santander)',
    from: 'bilbao_casco',
    to: 'santander_sardinero',
    distanceKm: 100,
    tollEuros: 0,
  },
  {
    id: 'a67-valladolid-santander',
    highway: 'A-62 / A-67',
    name: 'Autovía Cantabria-Meseta (Valladolid - Santander)',
    from: 'valladolid_campo',
    to: 'santander_sardinero',
    distanceKm: 245,
    tollEuros: 0,
  },
  {
    id: 'a8-santander-gijon',
    highway: 'A-8',
    name: 'Autovía del Cantábrico (Santander - Gijón)',
    from: 'santander_sardinero',
    to: 'gijon_cimadevilla',
    distanceKm: 175,
    tollEuros: 0,
  },
  {
    id: 'a66-valladolid-gijon',
    highway: 'A-66',
    name: 'Autovía Ruta de la Plata Norte (Valladolid - Gijón)',
    from: 'valladolid_campo',
    to: 'gijon_cimadevilla',
    distanceKm: 268,
    tollEuros: 14,
  },
  {
    id: 'a8-gijon-coruna',
    highway: 'A-8 / A-6',
    name: 'Ruta Galaico-Astur (Gijón - A Coruña)',
    from: 'gijon_cimadevilla',
    to: 'coruna_marina',
    distanceKm: 286,
    tollEuros: 0,
  },
  {
    id: 'a15-sansebastian-pamplona',
    highway: 'A-15',
    name: 'Autovía de Leitzaran (San Sebastián - Pamplona)',
    from: 'sansebastian_concha',
    to: 'pamplona_casco',
    distanceKm: 82,
    tollEuros: 0,
  },
  {
    id: 'ap15-pamplona-zaragoza',
    highway: 'AP-15 / AP-68',
    name: 'Autopista de Navarra (Pamplona - Zaragoza)',
    from: 'pamplona_casco',
    to: 'zaragoza_delicias',
    distanceKm: 178,
    tollEuros: 14,
  },
  // Lanzarote
  {
    id: 'mar-laspalmas-lanzarote',
    highway: 'Ferry / Binter Canarias',
    name: 'Conexión Insular Gran Canaria - Lanzarote',
    from: 'laspalmas_canteras',
    to: 'lanzarote_arrecife',
    distanceKm: 210,
    tollEuros: 35,
  },
  {
    id: 'air-madrid-lanzarote',
    highway: 'Puente Aéreo Atlántico',
    name: 'Puente Aéreo Madrid - Lanzarote',
    from: 'madrid_centro',
    to: 'lanzarote_arrecife',
    distanceKm: 1580,
    tollEuros: 90,
  },
];

export const ZONE_VIBES: Record<string, string> = ZONES.reduce(
  (acc, zone) => {
    acc[zone.id] = zone.vibe;
    return acc;
  },
  {} as Record<string, string>,
);

export const VALID_ZONE_IDS = ZONES.map((z) => z.id);

export function isValidZoneId(locationId: string): boolean {
  return Object.prototype.hasOwnProperty.call(ZONES_BY_ID, locationId);
}

export function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export interface RouteCalculation {
  distanceKm: number;
  highway: string;
  tollEuros: number;
  isIntercity: boolean;
}

function getCityHubZoneId(city: string): string | null {
  const hub = ZONES.find(
    (z) =>
      z.city === city &&
      HIGHWAY_ROUTES.some((r) => r.from === z.id || r.to === z.id),
  );
  return hub ? hub.id : null;
}

function dijkstraHighway(
  startId: string,
  endId: string,
): { distanceKm: number; highways: string[]; tollEuros: number } | null {
  if (startId === endId) {
    return { distanceKm: 0, highways: [], tollEuros: 0 };
  }

  const adj: Record<
    string,
    Array<{ to: string; distanceKm: number; highway: string; tollEuros: number }>
  > = {};

  for (const route of HIGHWAY_ROUTES) {
    if (!adj[route.from]) adj[route.from] = [];
    if (!adj[route.to]) adj[route.to] = [];
    adj[route.from].push({
      to: route.to,
      distanceKm: route.distanceKm,
      highway: route.highway,
      tollEuros: route.tollEuros,
    });
    adj[route.to].push({
      to: route.from,
      distanceKm: route.distanceKm,
      highway: route.highway,
      tollEuros: route.tollEuros,
    });
  }

  if (!adj[startId] || !adj[endId]) {
    return null;
  }

  const dist: Record<string, number> = { [startId]: 0 };
  const prev: Record<
    string,
    { node: string; highway: string; tollEuros: number } | undefined
  > = {};
  const visited = new Set<string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    queue.sort((a, b) => (dist[a] ?? Infinity) - (dist[b] ?? Infinity));
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    if (current === endId) break;

    for (const edge of adj[current] ?? []) {
      const alt = (dist[current] ?? Infinity) + edge.distanceKm;
      if (alt < (dist[edge.to] ?? Infinity)) {
        dist[edge.to] = alt;
        prev[edge.to] = {
          node: current,
          highway: edge.highway,
          tollEuros: edge.tollEuros,
        };
        queue.push(edge.to);
      }
    }
  }

  if (dist[endId] === undefined) {
    return null;
  }

  const highways: string[] = [];
  let tollEuros = 0;
  let curr: string | undefined = endId;
  while (curr && curr !== startId) {
    const step = prev[curr];
    if (!step) break;
    highways.unshift(step.highway);
    tollEuros += step.tollEuros;
    curr = step.node;
  }

  return {
    distanceKm: dist[endId],
    highways,
    tollEuros,
  };
}

export function calculateRouteBetweenZones(
  fromId: string,
  toId: string,
): RouteCalculation {
  const fromZone = ZONES_BY_ID[fromId];
  const toZone = ZONES_BY_ID[toId];

  if (!fromZone || !toZone) {
    throw new Error(`Invalid zone id(s): ${fromId} -> ${toId}`);
  }

  if (fromZone.city === toZone.city) {
    const km = Math.max(
      1,
      Math.round(haversineDistanceKm(fromZone, toZone) * 10) / 10,
    );
    return {
      distanceKm: km,
      highway: 'Urbano',
      tollEuros: 0,
      isIntercity: false,
    };
  }

  const direct = dijkstraHighway(fromId, toId);
  if (direct) {
    return {
      distanceKm: direct.distanceKm,
      highway: direct.highways.join(' + '),
      tollEuros: direct.tollEuros,
      isIntercity: true,
    };
  }

  const fromHubId = getCityHubZoneId(fromZone.city);
  const toHubId = getCityHubZoneId(toZone.city);

  if (fromHubId && toHubId) {
    const trunk = dijkstraHighway(fromHubId, toHubId);
    if (trunk) {
      const firstLeg =
        fromId === fromHubId
          ? 0
          : haversineDistanceKm(fromZone, ZONES_BY_ID[fromHubId]);
      const lastLeg =
        toId === toHubId
          ? 0
          : haversineDistanceKm(ZONES_BY_ID[toHubId], toZone);
      const totalKm = Math.round((firstLeg + trunk.distanceKm + lastLeg) * 10) / 10;
      return {
        distanceKm: totalKm,
        highway: trunk.highways.join(' + ') || 'Urbano',
        tollEuros: trunk.tollEuros,
        isIntercity: true,
      };
    }
  }

  // Fallback por carretera nacional si no hubiese conexión en el grafo
  const fallbackKm = Math.max(
    10,
    Math.round(haversineDistanceKm(fromZone, toZone) * 1.25 * 10) / 10,
  );
  return {
    distanceKm: fallbackKm,
    highway: 'Nacional',
    tollEuros: 0,
    isIntercity: true,
  };
}
