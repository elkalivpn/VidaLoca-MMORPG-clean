import type { CityLocation } from '@/types/game';

/** Interactive map locations – Real Spanish cities & districts */
export const CITIES: CityLocation[] = [
  {
    id: 'madrid_centro',
    name: 'Centro Madrid',
    city: 'Madrid',
    lng: -3.7038,
    lat: 40.4168,
    x: 48,
    y: 42,
    description:
      'El corazón de la capital. Negocios, turistas y oportunidades.',
    vibe: 'business',
  },
  {
    id: 'malasana',
    name: 'Malasaña',
    city: 'Madrid',
    lng: -3.7065,
    lat: 40.426,
    x: 46,
    y: 40,
    description: 'Barrio alternativo. Vida nocturna, arte y negocios grises.',
    vibe: 'nightlife',
  },
  {
    id: 'salamanca',
    name: 'Salamanca',
    city: 'Madrid',
    lng: -3.682,
    lat: 40.4295,
    x: 50,
    y: 38,
    description: 'Lujo puro. Boutiques, áticos y gente con dinero.',
    vibe: 'luxury',
  },
  {
    id: 'barcelona_ramblas',
    name: 'Las Ramblas',
    city: 'Barcelona',
    lng: 2.1734,
    lat: 41.3809,
    x: 72,
    y: 28,
    description: 'El paseo más famoso. Turistas, carteristas y contactos.',
    vibe: 'street',
  },
  {
    id: 'barcelona_gotico',
    name: 'Barrio Gótico',
    city: 'Barcelona',
    lng: 2.1769,
    lat: 41.3833,
    x: 74,
    y: 30,
    description: 'Callejones históricos. Secretos antiguos y nuevos tratos.',
    vibe: 'street',
  },
  {
    id: 'marbella_centro',
    name: 'Marbella Centro',
    city: 'Marbella',
    lng: -4.8824,
    lat: 36.5101,
    x: 38,
    y: 78,
    description:
      'Sol, playa y ostentación. El lugar donde se hacen los grandes tratos.',
    vibe: 'luxury',
  },
  {
    id: 'puerto_banus',
    name: 'Puerto Banús',
    city: 'Marbella',
    lng: -4.9524,
    lat: 36.4883,
    x: 36,
    y: 80,
    description:
      'Yates, supercoches y VIP. El sueño de muchos, la realidad de pocos.',
    vibe: 'luxury',
  },
  {
    id: 'sevilla_casco',
    name: 'Casco Antiguo',
    city: 'Sevilla',
    lng: -5.9845,
    lat: 37.3891,
    x: 32,
    y: 68,
    description: 'Historia, tapas y negocios familiares con peso.',
    vibe: 'street',
  },
  {
    id: 'valencia_artes',
    name: 'Ciudad de las Artes',
    city: 'Valencia',
    lng: -0.3522,
    lat: 39.4549,
    x: 62,
    y: 52,
    description: 'Arquitectura futurista y oportunidades modernas.',
    vibe: 'business',
  },
  {
    id: 'bilbao_casco',
    name: 'Casco Viejo',
    city: 'Bilbao',
    lng: -2.9235,
    lat: 43.257,
    x: 42,
    y: 18,
    description: 'Norte industrial reconvertido. Duro, leal y con carácter.',
    vibe: 'industrial',
  },
];

export const VIBE_COLORS: Record<CityLocation['vibe'], string> = {
  luxury: 'bg-amber-500 shadow-amber-500/50',
  street: 'bg-red-500 shadow-red-500/40',
  business: 'bg-sky-500 shadow-sky-500/40',
  nightlife: 'bg-purple-500 shadow-purple-500/40',
  industrial: 'bg-zinc-400 shadow-zinc-400/30',
};

export const VIBE_HEX_COLORS: Record<CityLocation['vibe'], string> = {
  luxury: '#f59e0b',
  street: '#ef4444',
  business: '#0ea5e9',
  nightlife: '#a855f7',
  industrial: '#a1a1aa',
};

export const VIBE_LABELS: Record<CityLocation['vibe'], string> = {
  luxury: 'Lujo',
  street: 'Calle',
  business: 'Negocios',
  nightlife: 'Noche',
  industrial: 'Industrial',
};

export interface HighwayCorridor {
  id: string;
  name: string;
  from: string;
  to: string;
  coordinates: [number, number][];
}

/** Real Spanish highway network connecting the playable cities */
export const SPAIN_HIGHWAYS: HighwayCorridor[] = [
  {
    id: 'a1-norte',
    name: 'Autovía A-1 / AP-68',
    from: 'madrid_centro',
    to: 'bilbao_casco',
    coordinates: [
      [-3.7038, 40.4168],
      [-3.7026, 42.3439], // Burgos
      [-2.6714, 42.8467], // Vitoria
      [-2.9235, 43.257], // Bilbao
    ],
  },
  {
    id: 'a2-nordeste',
    name: 'Autovía A-2 / AP-2',
    from: 'madrid_centro',
    to: 'barcelona_ramblas',
    coordinates: [
      [-3.7038, 40.4168],
      [-0.8891, 41.6488], // Zaragoza
      [0.62, 41.6176], // Lleida
      [2.1734, 41.3809], // Barcelona
    ],
  },
  {
    id: 'a3-levante',
    name: 'Autovía A-3',
    from: 'madrid_centro',
    to: 'valencia_artes',
    coordinates: [
      [-3.7038, 40.4168],
      [-2.1374, 40.0704], // Cuenca
      [-0.3522, 39.4549], // Valencia
    ],
  },
  {
    id: 'a4-sur',
    name: 'Autovía A-4',
    from: 'madrid_centro',
    to: 'sevilla_casco',
    coordinates: [
      [-3.7038, 40.4168],
      [-4.7794, 37.8882], // Córdoba
      [-5.9845, 37.3891], // Sevilla
    ],
  },
  {
    id: 'ap7-mediterraneo',
    name: 'Autopista AP-7',
    from: 'barcelona_ramblas',
    to: 'valencia_artes',
    coordinates: [
      [2.1734, 41.3809],
      [1.2445, 41.1189], // Tarragona
      [-0.0513, 39.9864], // Castellón
      [-0.3522, 39.4549], // Valencia
    ],
  },
  {
    id: 'a7-costa',
    name: 'Autovía A-7 / AP-7',
    from: 'valencia_artes',
    to: 'marbella_centro',
    coordinates: [
      [-0.3522, 39.4549],
      [-1.1307, 37.9922], // Murcia
      [-3.5986, 37.1773], // Granada
      [-4.4214, 36.7213], // Málaga
      [-4.8824, 36.5101], // Marbella
    ],
  },
  {
    id: 'a4-ap4-andalucia',
    name: 'Autovía A-92 / AP-7',
    from: 'sevilla_casco',
    to: 'marbella_centro',
    coordinates: [
      [-5.9845, 37.3891],
      [-5.1604, 36.7423], // Ronda
      [-4.8824, 36.5101], // Marbella
    ],
  },
];
