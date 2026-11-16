'use client';

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type MutableRefObject,
} from 'react';
import * as THREE from 'three';
import type { PlayerMovePayload, SpatialPlayer } from '@/lib/socket';
import type { PlayerAppearance3D, VehicleClass3D } from '@/lib/appearance3d';

export type DistrictAction = {
  id: string;
  label: string;
  description: string;
  lifestyle: string;
  minLevel: number;
  risk: number;
};

export type DistrictPlayerInfo = {
  id?: string;
  displayName?: string;
  level: number;
  euros: number;
  reputation: number;
  heat: number;
  lifestyle: string;
  locationId: string;
  appearance?: PlayerAppearance3D;
};

export interface DistrictPoi {
  id: 'movidas' | 'garaje' | 'piso_franco' | 'comisaria';
  title: string;
  subtitle: string;
  x: number;
  z: number;
  color: string;
  hex: number;
}

export interface District3DProps {
  zoneName: string;
  vibe: string;
  player: DistrictPlayerInfo;
  localPlayerId?: string | null;
  actions: DistrictAction[];
  remotePlayersRef: MutableRefObject<Map<string, SpatialPlayer>>;
  emitMove: (payload: PlayerMovePayload) => void;
  connected?: boolean;
  busy?: boolean;
  lastNarrative?: string;
  onAction: (actionId: string) => Promise<void> | void;
  onSetLifestyle: (lifestyle: string) => Promise<void> | void;
  onSwitchClassic?: () => void;
  onNavigateTab?: (tab: 'vehiculos' | 'propiedades' | 'misiones') => void;
}

type VibeTheme = {
  sky: number;
  fogDensity: number;
  ground: number;
  asphalt: number;
  sidewalk: number;
  buildingBase: number;
  windowLit: string;
  windowDim: string;
  accent: number;
  accentSecondary: number;
  lampColor: number;
  ambientIntensity: number;
};

const VIBE_THEMES: Record<string, VibeTheme> = {
  business: {
    sky: 0x0b1628,
    fogDensity: 0.015,
    ground: 0x101827,
    asphalt: 0x1a2232,
    sidewalk: 0x2d3748,
    buildingBase: 0x162238,
    windowLit: '#38bdf8',
    windowDim: '#1e3a5f',
    accent: 0x0ea5e9,
    accentSecondary: 0x38bdf8,
    lampColor: 0xbae6fd,
    ambientIntensity: 0.85,
  },
  nightlife: {
    sky: 0x130924,
    fogDensity: 0.017,
    ground: 0x120a1f,
    asphalt: 0x171124,
    sidewalk: 0x2a1f3d,
    buildingBase: 0x1b102e,
    windowLit: '#e879f9',
    windowDim: '#3b1c54',
    accent: 0xa855f7,
    accentSecondary: 0xec4899,
    lampColor: 0xf0abfc,
    ambientIntensity: 0.78,
  },
  luxury: {
    sky: 0x171108,
    fogDensity: 0.013,
    ground: 0x1c160d,
    asphalt: 0x1f1b16,
    sidewalk: 0x3b3326,
    buildingBase: 0x261f15,
    windowLit: '#fbbf24',
    windowDim: '#4a3b1f',
    accent: 0xf59e0b,
    accentSecondary: 0xfde68a,
    lampColor: 0xfef3c7,
    ambientIntensity: 0.9,
  },
  street: {
    sky: 0x1a0d0d,
    fogDensity: 0.016,
    ground: 0x181111,
    asphalt: 0x1e1919,
    sidewalk: 0x332929,
    buildingBase: 0x261a1a,
    windowLit: '#fb923c',
    windowDim: '#45241e',
    accent: 0xef4444,
    accentSecondary: 0xf97316,
    lampColor: 0xfdba74,
    ambientIntensity: 0.8,
  },
  industrial: {
    sky: 0x11161b,
    fogDensity: 0.018,
    ground: 0x14181c,
    asphalt: 0x1d2126,
    sidewalk: 0x2f363d,
    buildingBase: 0x20272e,
    windowLit: '#facc15',
    windowDim: '#374151',
    accent: 0xeab308,
    accentSecondary: 0x94a3b8,
    lampColor: 0xfef08a,
    ambientIntensity: 0.82,
  },
};

const POIS: DistrictPoi[] = [
  {
    id: 'movidas',
    title: 'Tablón de Movidas',
    subtitle: 'Encargos y golpes del barrio',
    x: 11,
    z: -11,
    color: '#f59e0b',
    hex: 0xf59e0b,
  },
  {
    id: 'garaje',
    title: 'Garaje Clandestino',
    subtitle: 'Vehículos, tuneo y escape',
    x: -11,
    z: -11,
    color: '#38bdf8',
    hex: 0x38bdf8,
  },
  {
    id: 'piso_franco',
    title: 'Piso Franco',
    subtitle: 'Camino, refugio y propiedades',
    x: -11,
    z: 11,
    color: '#a855f7',
    hex: 0xa855f7,
  },
  {
    id: 'comisaria',
    title: 'Comisaría / Enfriar Calor',
    subtitle: 'Baja el radar policial',
    x: 11,
    z: 11,
    color: '#ef4444',
    hex: 0xef4444,
  },
];

type AABB = { minX: number; maxX: number; minZ: number; maxZ: number };

type AvatarRig = {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  crownMesh?: THREE.Group;
  walkPhase: number;
};

type RemoteAvatarEntry = {
  rig: AvatarRig;
  targetPos: THREE.Vector3;
  targetRotY: number;
  isMoving: boolean;
  displayName: string;
  labelSprite: THREE.Sprite;
};

type VehicleRig = {
  group: THREE.Group;
  chassis: THREE.Group;
  frontWheels: THREE.Mesh[];
  rearWheels: THREE.Mesh[];
  brakeMat: THREE.MeshStandardMaterial;
  headlightGlow: THREE.PointLight;
  rotors: Array<{ obj: THREE.Object3D; axis: 'x' | 'y' | 'z' }>;
  vehicleClass: VehicleClass3D;
};

type SmokeParticle = {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
};

type CombatPulseEffect = {
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  beam: THREE.Mesh;
  beamMat: THREE.MeshBasicMaterial;
  light: THREE.PointLight;
  life: number;
  maxLife: number;
};

const WORLD_LIMIT = 41;

const LIFE_LABEL: Record<string, string> = {
  LEGAL: 'Legal',
  GREY: 'Gris',
  STREET: 'Calle',
};

function createWindowTexture(
  litColor: string,
  dimColor: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#090b10';
    ctx.fillRect(0, 0, 128, 256);
    const cols = 4;
    const rows = 8;
    const padX = 8;
    const padY = 8;
    const w = (128 - padX * (cols + 1)) / cols;
    const h = (256 - padY * (rows + 1)) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isLit =
          (r * 7 + c * 13) % 5 !== 0 &&
          ((r + c * 3) % 2 === 0 || (r * c) % 3 === 1);
        ctx.fillStyle = isLit ? litColor : dimColor;
        ctx.globalAlpha = isLit ? 0.85 : 0.4;
        ctx.fillRect(padX + c * (w + padX), padY + r * (h + padY), w, h);
      }
    }
    ctx.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createNameLabelSprite(name: string, accent = '#f59e0b'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(9, 9, 11, 0.78)';
    ctx.beginPath();
    ctx.roundRect(16, 12, 224, 38, 12);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fafafa';
    ctx.font = 'bold 21px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.slice(0, 16), 128, 32);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.8, 0.7, 1);
  sprite.position.set(0, 2.45, 0);
  return sprite;
}

function createAvatarRig(
  bodyColor: number,
  accentColor: number,
  hasCrown = false,
): AvatarRig {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xe5b899,
    roughness: 0.7,
  });
  const torsoMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.5,
    metalness: 0.15,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.8,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.45,
    roughness: 0.3,
  });

  // Ground ring
  const ringGeo = new THREE.RingGeometry(0.45, 0.58, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: accentColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.65,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  group.add(ring);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.24, 0.72, 0.24);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.15, 0.36, 0);
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.15, 0.36, 0);
  group.add(leftLeg, rightLeg);

  // Torso
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.76, 0.34),
    torsoMat,
  );
  torso.position.set(0, 1.08, 0);
  group.add(torso);

  // Jacket stripe
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.12, 0.36),
    accentMat,
  );
  stripe.position.set(0, 1.24, 0);
  group.add(stripe);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.18, 0.66, 0.18);
  const leftArm = new THREE.Mesh(armGeo, torsoMat);
  leftArm.position.set(-0.42, 1.06, 0);
  const rightArm = new THREE.Mesh(armGeo, torsoMat);
  rightArm.position.set(0.42, 1.06, 0);
  group.add(leftArm, rightArm);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
  head.position.set(0, 1.72, 0);
  group.add(head);

  // Visor / shades facing +Z
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.11, 0.08),
    accentMat,
  );
  visor.position.set(0, 1.75, 0.21);
  group.add(visor);

  let crownMesh: THREE.Group | undefined;
  if (hasCrown) {
    crownMesh = new THREE.Group();
    crownMesh.position.set(0, 2.22, 0);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.7,
      metalness: 0.8,
      roughness: 0.2,
    });
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), goldMat);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.035, 8, 24),
      goldMat,
    );
    halo.rotation.x = Math.PI / 2;
    crownMesh.add(gem, halo);
    group.add(crownMesh);
  }

  return {
    group,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    crownMesh,
    walkPhase: 0,
  };
}

function animateAvatarRig(
  rig: AvatarRig,
  isMoving: boolean,
  isSprinting: boolean,
  dt: number,
) {
  if (rig.crownMesh) {
    rig.crownMesh.rotation.y += dt * 2.2;
  }
  if (isMoving) {
    rig.walkPhase += dt * (isSprinting ? 14 : 9);
    const swing = Math.sin(rig.walkPhase) * (isSprinting ? 0.65 : 0.42);
    rig.leftLeg.rotation.x = swing;
    rig.rightLeg.rotation.x = -swing;
    rig.leftArm.rotation.x = -swing * 0.85;
    rig.rightArm.rotation.x = swing * 0.85;
  } else {
    rig.leftLeg.rotation.x *= 0.8;
    rig.rightLeg.rotation.x *= 0.8;
    rig.leftArm.rotation.x *= 0.8;
    rig.rightArm.rotation.x *= 0.8;
  }
}

function disposeObject3D(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      geometries.add(mesh.geometry);
    }
    const rawMat = (mesh as { material?: THREE.Material | THREE.Material[] })
      .material;
    if (Array.isArray(rawMat)) {
      for (const m of rawMat) materials.add(m);
    } else if (rawMat) {
      materials.add(rawMat);
    }
  });

  for (const mat of materials) {
    for (const val of Object.values(mat) as unknown[]) {
      if (val instanceof THREE.Texture) {
        textures.add(val);
      }
    }
    mat.dispose();
  }
  for (const geo of geometries) geo.dispose();
  for (const tex of textures) tex.dispose();
}

function detectGamepadBadge(id: string): string {
  const lower = id.toLowerCase();
  if (/dualsense|dualshock|playstation|wireless controller|054c/.test(lower)) {
    return 'PS5 / PlayStation';
  }
  if (/xbox|xinput|045e/.test(lower)) {
    return 'Xbox';
  }
  if (/nintendo|switch|pro controller|joy-con|057e/.test(lower)) {
    return 'Switch Pro';
  }
  return 'Mando';
}

function createVehicleRig(
  accentColor: number,
  options?: {
    bodyColor?: number;
    underglowColor?: number;
    underglowOpacity?: number;
    hasBlueNeon?: boolean;
    hasGoldPlate?: boolean;
    vehicleClass?: VehicleClass3D;
  },
): VehicleRig {
  const vehicleClass: VehicleClass3D = options?.vehicleClass ?? 'SUPERCAR';
  const group = new THREE.Group();
  const chassis = new THREE.Group();
  group.add(chassis);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: options?.bodyColor ?? 0x18181b,
    metalness: 0.78,
    roughness: 0.22,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.45,
    metalness: 0.5,
    roughness: 0.3,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.85,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    metalness: 0.7,
    roughness: 0.35,
  });
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.85,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: options?.hasGoldPlate ? 0xfbbf24 : 0xd4d4d8,
    metalness: 0.85,
    roughness: 0.2,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xe0f2fe,
    emissiveIntensity: 2.6,
  });
  const brakeMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 0.9,
  });

  const glowSize: [number, number] =
    vehicleClass === 'MOTO'
      ? [0.9, 2.3]
      : vehicleClass === 'QUAD'
        ? [1.45, 2.3]
        : vehicleClass === 'TRUCK'
          ? [2.4, 5.6]
          : vehicleClass === 'PLANE'
            ? [3.6, 5.2]
            : [2.05, 4.25];

  const glowColor = options?.underglowColor ?? accentColor;
  const underglow = new THREE.Mesh(
    new THREE.PlaneGeometry(glowSize[0], glowSize[1]),
    new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: options?.underglowOpacity ?? 0.22,
      side: THREE.DoubleSide,
    }),
  );
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = 0.04;
  group.add(underglow);

  if (options?.hasBlueNeon) {
    const neonLight = new THREE.PointLight(0x00d4ff, 6, 9, 1.8);
    neonLight.position.set(0, 0.25, 0);
    group.add(neonLight);
  }

  const headlightGlow = new THREE.PointLight(0xe0f2fe, 0, 18, 1.6);
  headlightGlow.position.set(0, 0.8, 2.6);
  chassis.add(headlightGlow);

  const frontWheels: THREE.Mesh[] = [];
  const rearWheels: THREE.Mesh[] = [];
  const rotors: Array<{ obj: THREE.Object3D; axis: 'x' | 'y' | 'z' }> = [];

  const makeWheel = (
    x: number,
    y: number,
    z: number,
    radius = 0.34,
    width = 0.26,
  ) => {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, width, 16),
      wheelMat,
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(
        radius * 0.58,
        radius * 0.58,
        width + 0.01,
        10,
      ),
      rimMat,
    );
    wheel.add(rim);
    group.add(wheel);
    return wheel;
  };

  const addGoldPlate = (y: number, z: number) => {
    if (!options?.hasGoldPlate) return;
    const goldPlateMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.65,
      metalness: 0.9,
      roughness: 0.15,
    });
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.13, 0.05),
      goldPlateMat,
    );
    plate.position.set(0, y, z);
    chassis.add(plate);
  };

  if (vehicleClass === 'MOTO') {
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.42, 1.75),
      bodyMat,
    );
    frame.position.set(0, 0.62, 0);
    chassis.add(frame);

    const tank = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.24, 0.68),
      accentMat,
    );
    tank.position.set(0, 0.88, 0.22);
    chassis.add(tank);

    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.12, 0.68),
      darkMetalMat,
    );
    seat.position.set(0, 0.82, -0.38);
    chassis.add(seat);

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.32, 0.08),
      glassMat,
    );
    windshield.position.set(0, 1.02, 0.68);
    windshield.rotation.x = -0.35;
    chassis.add(windshield);

    const handleBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.06, 0.08),
      darkMetalMat,
    );
    handleBar.position.set(0, 1.02, 0.56);
    chassis.add(handleBar);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.14, 0.08),
      headlightMat,
    );
    head.position.set(0, 0.78, 0.92);
    chassis.add(head);

    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.1, 0.08),
      brakeMat,
    );
    tail.position.set(0, 0.76, -0.92);
    chassis.add(tail);

    addGoldPlate(0.56, -0.94);
    frontWheels.push(makeWheel(0, 0.33, 0.82, 0.33, 0.16));
    rearWheels.push(makeWheel(0, 0.33, -0.82, 0.33, 0.2));
  } else if (vehicleClass === 'QUAD') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.42, 1.85),
      bodyMat,
    );
    body.position.set(0, 0.62, 0);
    chassis.add(body);

    const rack = new THREE.Mesh(
      new THREE.BoxGeometry(1.06, 0.08, 0.56),
      accentMat,
    );
    rack.position.set(0, 0.86, -0.62);
    chassis.add(rack);

    const bars = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.07, 0.08),
      darkMetalMat,
    );
    bars.position.set(0, 1.06, 0.52);
    chassis.add(bars);

    const headL = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.12, 0.08),
      headlightMat,
    );
    headL.position.set(-0.3, 0.74, 0.96);
    const headR = headL.clone();
    headR.position.x = 0.3;
    chassis.add(headL, headR);

    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.1, 0.08),
      brakeMat,
    );
    tail.position.set(0, 0.7, -0.96);
    chassis.add(tail);

    addGoldPlate(0.5, -0.98);
    frontWheels.push(makeWheel(-0.62, 0.34, 0.72, 0.34, 0.28));
    frontWheels.push(makeWheel(0.62, 0.34, 0.72, 0.34, 0.28));
    rearWheels.push(makeWheel(-0.62, 0.34, -0.72, 0.34, 0.3));
    rearWheels.push(makeWheel(0.62, 0.34, -0.72, 0.34, 0.3));
  } else if (vehicleClass === 'SUV' || vehicleClass === 'VAN') {
    const isVan = vehicleClass === 'VAN';
    const lower = new THREE.Mesh(
      new THREE.BoxGeometry(1.96, 0.68, 4.35),
      bodyMat,
    );
    lower.position.set(0, 0.68, 0);
    chassis.add(lower);

    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(1.82, 0.64, isVan ? 3.5 : 2.65),
      glassMat,
    );
    cab.position.set(0, 1.32, isVan ? -0.1 : -0.35);
    chassis.add(cab);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(1.78, 0.1, isVan ? 3.55 : 2.6),
      bodyMat,
    );
    roof.position.set(0, 1.68, isVan ? -0.1 : -0.35);
    chassis.add(roof);

    const roofRailL = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 2.2),
      accentMat,
    );
    roofRailL.position.set(-0.72, 1.76, -0.3);
    const roofRailR = roofRailL.clone();
    roofRailR.position.x = 0.72;
    chassis.add(roofRailL, roofRailR);

    const bumper = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.18, 0.18),
      accentMat,
    );
    bumper.position.set(0, 0.42, 2.2);
    chassis.add(bumper);

    const headL = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.16, 0.08),
      headlightMat,
    );
    headL.position.set(-0.64, 0.78, 2.19);
    const headR = headL.clone();
    headR.position.x = 0.64;
    chassis.add(headL, headR);

    const tailL = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.28, 0.08),
      brakeMat,
    );
    tailL.position.set(-0.78, 0.8, -2.19);
    const tailR = tailL.clone();
    tailR.position.x = 0.78;
    chassis.add(tailL, tailR);

    addGoldPlate(0.54, -2.21);
    frontWheels.push(makeWheel(-0.98, 0.42, 1.38, 0.42, 0.3));
    frontWheels.push(makeWheel(0.98, 0.42, 1.38, 0.42, 0.3));
    rearWheels.push(makeWheel(-0.98, 0.42, -1.38, 0.42, 0.3));
    rearWheels.push(makeWheel(0.98, 0.42, -1.38, 0.42, 0.3));
  } else if (vehicleClass === 'TRUCK') {
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 1.45, 1.65),
      bodyMat,
    );
    cab.position.set(0, 1.15, 1.65);
    chassis.add(cab);

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.56, 0.1),
      glassMat,
    );
    windshield.position.set(0, 1.44, 2.46);
    chassis.add(windshield);

    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(2.22, 1.62, 3.45),
      darkMetalMat,
    );
    cargo.position.set(0, 1.32, -1.05);
    chassis.add(cargo);

    const cargoStripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.26, 0.16, 3.48),
      accentMat,
    );
    cargoStripe.position.set(0, 1.15, -1.05);
    chassis.add(cargoStripe);

    const headL = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.18, 0.08),
      headlightMat,
    );
    headL.position.set(-0.7, 0.68, 2.49);
    const headR = headL.clone();
    headR.position.x = 0.7;
    chassis.add(headL, headR);

    const tailL = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.16, 0.08),
      brakeMat,
    );
    tailL.position.set(-0.72, 0.62, -2.79);
    const tailR = tailL.clone();
    tailR.position.x = 0.72;
    chassis.add(tailL, tailR);

    addGoldPlate(0.42, -2.81);
    frontWheels.push(makeWheel(-1.06, 0.46, 1.75, 0.46, 0.32));
    frontWheels.push(makeWheel(1.06, 0.46, 1.75, 0.46, 0.32));
    rearWheels.push(makeWheel(-1.06, 0.46, -0.75, 0.46, 0.32));
    rearWheels.push(makeWheel(1.06, 0.46, -0.75, 0.46, 0.32));
    rearWheels.push(makeWheel(-1.06, 0.46, -1.95, 0.46, 0.32));
    rearWheels.push(makeWheel(1.06, 0.46, -1.95, 0.46, 0.32));
  } else if (vehicleClass === 'BOAT') {
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(1.88, 0.56, 4.4),
      bodyMat,
    );
    hull.position.set(0, 0.42, -0.1);
    chassis.add(hull);

    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.35, 4), bodyMat);
    bow.rotation.y = Math.PI / 4;
    bow.rotation.x = Math.PI / 2;
    bow.scale.set(1.35, 1, 0.42);
    bow.position.set(0, 0.46, 2.55);
    chassis.add(bow);

    const deckStripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.94, 0.1, 4.46),
      accentMat,
    );
    deckStripe.position.set(0, 0.66, -0.1);
    chassis.add(deckStripe);

    const cockpit = new THREE.Mesh(
      new THREE.BoxGeometry(1.36, 0.42, 1.55),
      glassMat,
    );
    cockpit.position.set(0, 0.92, 0.25);
    chassis.add(cockpit);

    const engineL = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.44, 0.42),
      darkMetalMat,
    );
    engineL.position.set(-0.42, 0.66, -2.35);
    const engineR = engineL.clone();
    engineR.position.x = 0.42;
    chassis.add(engineL, engineR);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.12),
      headlightMat,
    );
    head.position.set(0, 0.78, 2.25);
    chassis.add(head);

    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.1, 0.08),
      brakeMat,
    );
    tail.position.set(0, 0.7, -2.32);
    chassis.add(tail);

    addGoldPlate(0.45, -2.34);
  } else if (vehicleClass === 'HELI') {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.15, 2.6), bodyMat);
    pod.position.set(0, 1.05, 0.1);
    chassis.add(pod);

    const noseGlass = new THREE.Mesh(
      new THREE.BoxGeometry(1.52, 0.85, 0.95),
      glassMat,
    );
    noseGlass.position.set(0, 1.05, 1.42);
    chassis.add(noseGlass);

    const tailBoom = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.4, 2.4),
      bodyMat,
    );
    tailBoom.position.set(0, 1.25, -2.15);
    chassis.add(tailBoom);

    const tailFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.78, 0.55),
      accentMat,
    );
    tailFin.position.set(0, 1.55, -3.2);
    chassis.add(tailFin);

    const skidL = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.1, 2.8),
      darkMetalMat,
    );
    skidL.position.set(-0.85, 0.14, 0.1);
    const skidR = skidL.clone();
    skidR.position.x = 0.85;
    chassis.add(skidL, skidR);

    const strutPos: [number, number][] = [
      [-0.78, 0.85],
      [0.78, 0.85],
      [-0.78, -0.65],
      [0.78, -0.65],
    ];
    for (const [sx, sz] of skidStrutsOrCoords(strutPos)) {
      const s = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.5, 0.08),
        darkMetalMat,
      );
      s.position.set(sx, 0.38, sz);
      chassis.add(s);
    }

    const rotorHub = new THREE.Group();
    rotorHub.position.set(0, 1.78, 0.1);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 0.34, 10),
      darkMetalMat,
    );
    const blade1 = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.04, 0.22),
      accentMat,
    );
    const blade2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.04, 4.8),
      darkMetalMat,
    );
    blade1.position.y = 0.15;
    blade2.position.y = 0.16;
    rotorHub.add(mast, blade1, blade2);
    chassis.add(rotorHub);
    rotors.push({ obj: rotorHub, axis: 'y' });

    const tailRotor = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.85, 0.12),
      accentMat,
    );
    tailRotor.position.set(0.16, 1.58, -3.22);
    chassis.add(tailRotor);
    rotors.push({ obj: tailRotor, axis: 'x' });

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.14, 0.08),
      headlightMat,
    );
    head.position.set(0, 0.72, 1.9);
    chassis.add(head);

    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.16, 0.08),
      brakeMat,
    );
    tail.position.set(0, 1.25, -3.38);
    chassis.add(tail);

    addGoldPlate(0.62, -1.22);
  } else if (vehicleClass === 'PLANE') {
    const fuselage = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.95, 4.6),
      bodyMat,
    );
    fuselage.position.set(0, 0.96, 0);
    chassis.add(fuselage);

    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.45, 1.65),
      glassMat,
    );
    canopy.position.set(0, 1.54, 0.45);
    chassis.add(canopy);

    const wings = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.12, 1.25),
      bodyMat,
    );
    wings.position.set(0, 0.98, 0.15);
    chassis.add(wings);

    const wingAccent = new THREE.Mesh(
      new THREE.BoxGeometry(5.64, 0.06, 0.24),
      accentMat,
    );
    wingAccent.position.set(0, 1.02, -0.35);
    chassis.add(wingAccent);

    const tailWing = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.1, 0.65),
      bodyMat,
    );
    tailWing.position.set(0, 1.18, -2.0);
    chassis.add(tailWing);

    const vFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.95, 0.75),
      accentMat,
    );
    vFin.position.set(0, 1.65, -1.95);
    chassis.add(vFin);

    const prop = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.14, 0.08),
      accentMat,
    );
    prop.position.set(0, 0.96, 2.38);
    chassis.add(prop);
    rotors.push({ obj: prop, axis: 'z' });

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.14, 0.08),
      headlightMat,
    );
    head.position.set(0, 0.78, 2.31);
    chassis.add(head);

    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.12, 0.08),
      brakeMat,
    );
    tail.position.set(0, 0.96, -2.31);
    chassis.add(tail);

    addGoldPlate(0.68, -2.32);
    frontWheels.push(makeWheel(0, 0.26, 1.65, 0.26, 0.18));
    rearWheels.push(makeWheel(-0.92, 0.26, -0.55, 0.26, 0.2));
    rearWheels.push(makeWheel(0.92, 0.26, -0.55, 0.26, 0.2));
  } else {
    // SUPERCAR (default sleek sports coupe)
    const lowerBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.88, 0.46, 4.15),
      bodyMat,
    );
    lowerBody.position.set(0, 0.48, 0);
    chassis.add(lowerBody);

    const splitter = new THREE.Mesh(
      new THREE.BoxGeometry(1.94, 0.1, 4.24),
      accentMat,
    );
    splitter.position.set(0, 0.28, 0);
    chassis.add(splitter);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.48, 0.42, 1.95),
      glassMat,
    );
    cabin.position.set(0, 0.86, -0.15);
    chassis.add(cabin);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(1.36, 0.08, 1.45),
      bodyMat,
    );
    roof.position.set(0, 1.08, -0.2);
    chassis.add(roof);

    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(1.84, 0.08, 0.34),
      accentMat,
    );
    wing.position.set(0, 0.96, -1.92);
    chassis.add(wing);

    const strutL = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.26, 0.16),
      bodyMat,
    );
    strutL.position.set(-0.62, 0.8, -1.88);
    const strutR = strutL.clone();
    strutR.position.x = 0.62;
    chassis.add(strutL, strutR);

    const headL = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.12, 0.08),
      headlightMat,
    );
    headL.position.set(-0.6, 0.5, 2.08);
    const headR = headL.clone();
    headR.position.x = 0.6;
    chassis.add(headL, headR);

    const tailL = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.08),
      brakeMat,
    );
    tailL.position.set(-0.56, 0.54, -2.08);
    const tailR = tailL.clone();
    tailR.position.x = 0.56;
    chassis.add(tailL, tailR);

    addGoldPlate(0.36, -2.09);
    frontWheels.push(makeWheel(-0.92, 0.34, 1.32));
    frontWheels.push(makeWheel(0.92, 0.34, 1.32));
    rearWheels.push(makeWheel(-0.92, 0.34, -1.32));
    rearWheels.push(makeWheel(0.92, 0.34, -1.32));
  }

  return {
    group,
    chassis,
    frontWheels,
    rearWheels,
    brakeMat,
    headlightGlow,
    rotors,
    vehicleClass,
  };
}

function skidStrutsOrCoords(coords: [number, number][]): [number, number][] {
  return coords;
}

export default function District3D({
  zoneName,
  vibe,
  player,
  localPlayerId,
  actions,
  remotePlayersRef,
  emitMove,
  connected = false,
  busy = false,
  lastNarrative,
  onAction,
  onSetLifestyle,
  onSwitchClassic,
  onNavigateTab,
}: District3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stickBaseRef = useRef<HTMLDivElement | null>(null);

  const [webglError, setWebglError] = useState<string | null>(null);
  const [nearbyPoi, setNearbyPoi] = useState<DistrictPoi | null>(null);
  const [activePoi, setActivePoi] = useState<DistrictPoi | null>(null);
  const [remoteCount, setRemoteCount] = useState(0);
  const [sprintTouch, setSprintTouch] = useState(false);
  const [inVehicle, setInVehicle] = useState(false);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [isDrifting, setIsDrifting] = useState(false);
  const [driftTouch, setDriftTouch] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [gamepadName, setGamepadName] = useState<string | null>(null);
  const [stickOffset, setStickOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  // Input refs (no React re-render per key press)
  const keysRef = useRef<Record<string, boolean>>({});
  const touchDirRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const touchThrottleRef = useRef(false);
  const touchBrakeRef = useRef(false);
  const stickPointerIdRef = useRef<number | null>(null);
  const sprintTouchRef = useRef(false);
  const driftTouchRef = useRef(false);
  const inVehicleRef = useRef(false);
  const toggleVehicleFnRef = useRef<(() => void) | null>(null);
  const triggerPulseFnRef = useRef<(() => void) | null>(null);
  const rebuildLocalRigsFnRef = useRef<(() => void) | null>(null);
  const nearbyPoiRef = useRef<DistrictPoi | null>(null);
  const activePoiRef = useRef<DistrictPoi | null>(null);
  const emitMoveRef = useRef(emitMove);
  const locationIdRef = useRef(player.locationId);
  const localIdRef = useRef(localPlayerId || player.id || '');
  const appearanceRef = useRef<PlayerAppearance3D | undefined>(
    player.appearance,
  );
  const poseRef = useRef({
    px: 0,
    pz: 2,
    pRotY: 0,
    cx: 3.5,
    cz: 4.5,
    cHeading: 0,
    inVehicle: false,
  });
  const camOrbitYawRef = useRef(0);
  const camOrbitPitchRef = useRef(0.18);
  const camZoomRef = useRef(1);

  useEffect(() => {
    emitMoveRef.current = emitMove;
  }, [emitMove]);

  useEffect(() => {
    locationIdRef.current = player.locationId;
  }, [player.locationId]);

  useEffect(() => {
    localIdRef.current = localPlayerId || player.id || '';
  }, [localPlayerId, player.id]);

  useEffect(() => {
    activePoiRef.current = activePoi;
  }, [activePoi]);

  const lastBuiltKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    appearanceRef.current = player.appearance;
    const nextKey = player.appearance?.appearanceKey;
    if (
      lastBuiltKeyRef.current !== undefined &&
      lastBuiltKeyRef.current !== nextKey
    ) {
      rebuildLocalRigsFnRef.current?.();
    }
    lastBuiltKeyRef.current = nextKey;
  }, [player.appearance]);

  // Detect coarse pointer / touch capability (phones, tablets, iPad, Switch Touch)
  useEffect(() => {
    const detectTouch = () => {
      const coarse =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(pointer: coarse)')?.matches;
      const touchPoints =
        typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0;
      const hasTouch =
        Boolean(coarse) ||
        Boolean(touchPoints) ||
        (typeof window !== 'undefined' && 'ontouchstart' in window);
      if (hasTouch) setIsTouchDevice(true);
    };
    detectTouch();
    window.addEventListener('touchstart', detectTouch, {
      once: true,
      passive: true,
    });
    return () => window.removeEventListener('touchstart', detectTouch);
  }, []);

  // Detect connected gamepads (PS5 DualSense, Xbox, Switch Pro)
  useEffect(() => {
    const syncGamepads = () => {
      const pads = navigator.getGamepads?.() ?? [];
      const active = Array.from(pads).find((p) => p && p.connected);
      setGamepadName(active ? detectGamepadBadge(active.id) : null);
    };
    syncGamepads();
    window.addEventListener('gamepadconnected', syncGamepads);
    window.addEventListener('gamepaddisconnected', syncGamepads);
    return () => {
      window.removeEventListener('gamepadconnected', syncGamepads);
      window.removeEventListener('gamepaddisconnected', syncGamepads);
    };
  }, []);

  const toggleSprintTouch = useCallback(() => {
    setSprintTouch((prev) => {
      const next = !prev;
      sprintTouchRef.current = next;
      return next;
    });
  }, []);

  const toggleDriftTouch = useCallback(() => {
    setDriftTouch((prev) => {
      const next = !prev;
      driftTouchRef.current = next;
      return next;
    });
  }, []);

  const handleToggleVehicle = useCallback(() => {
    toggleVehicleFnRef.current?.();
  }, []);

  const handleCombatPulse = useCallback(() => {
    triggerPulseFnRef.current?.();
  }, []);

  const handleInteract = useCallback(() => {
    if (nearbyPoiRef.current) {
      setActivePoi(nearbyPoiRef.current);
    }
  }, []);

  const updateStickFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const el = stickBaseRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const maxR = Math.max(24, rect.width * 0.38);
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      setStickOffset({ x: Math.round(dx), y: Math.round(dy) });
      touchDirRef.current = { x: dx / maxR, z: dy / maxR };
    },
    [],
  );

  const resetStick = useCallback(() => {
    stickPointerIdRef.current = null;
    setStickOffset({ x: 0, y: 0 });
    touchDirRef.current = { x: 0, z: 0 };
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const theme = VIBE_THEMES[vibe] || VIBE_THEMES.street;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(
        'Tu navegador o dispositivo no tiene WebGL disponible para el modo 3D.',
      );
      return;
    }

    setWebglError(null);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme.sky);
    scene.fog = new THREE.FogExp2(theme.sky, theme.fogDensity);

    const camera = new THREE.PerspectiveCamera(
      58,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      180,
    );
    camera.position.set(0, 7.5, 11);

    // Lights
    const hemi = new THREE.HemisphereLight(
      theme.accentSecondary,
      theme.ground,
      theme.ambientIntensity,
    );
    scene.add(hemi);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
    dirLight.position.set(18, 32, 16);
    scene.add(dirLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(110, 110);
    const groundMat = new THREE.MeshStandardMaterial({
      color: theme.ground,
      roughness: 0.95,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Streets (crossroads + perimeter ring)
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: theme.asphalt,
      roughness: 0.85,
    });
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(11, 92), asphaltMat);
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.y = 0.01;
    scene.add(roadNS);

    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(92, 11), asphaltMat);
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.position.y = 0.012;
    scene.add(roadEW);

    // Dashed road markings
    const dashMat = new THREE.MeshBasicMaterial({
      color: 0xe4e4e7,
      transparent: true,
      opacity: 0.45,
    });
    const dashGeoNS = new THREE.PlaneGeometry(0.24, 2.2);
    const dashGeoEW = new THREE.PlaneGeometry(2.2, 0.24);
    for (let i = -40; i <= 40; i += 6) {
      if (Math.abs(i) < 7) continue;
      const d1 = new THREE.Mesh(dashGeoNS, dashMat);
      d1.rotation.x = -Math.PI / 2;
      d1.position.set(0, 0.02, i);
      scene.add(d1);

      const d2 = new THREE.Mesh(dashGeoEW, dashMat);
      d2.rotation.x = -Math.PI / 2;
      d2.position.set(i, 0.02, 0);
      scene.add(d2);
    }

    // Sidewalks (4 city quadrants)
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: theme.sidewalk,
      roughness: 0.9,
    });
    const quadrantCenters = [
      [-23, -23],
      [23, -23],
      [-23, 23],
      [23, 23],
    ];
    for (const [qx, qz] of quadrantCenters) {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(33, 0.16, 33),
        sidewalkMat,
      );
      pad.position.set(qx, 0.08, qz);
      scene.add(pad);
    }

    // Procedural Buildings with collision AABBs
    const windowTex = createWindowTexture(theme.windowLit, theme.windowDim);
    const buildingMat = new THREE.MeshStandardMaterial({
      color: theme.buildingBase,
      map: windowTex,
      roughness: 0.65,
      metalness: 0.2,
    });
    const neonStripMat = new THREE.MeshBasicMaterial({
      color: theme.accent,
    });
    const neonAltMat = new THREE.MeshBasicMaterial({
      color: theme.accentSecondary,
    });

    const buildingAABBs: AABB[] = [];
    const buildingSpecs: Array<{
      x: number;
      z: number;
      w: number;
      d: number;
      h: number;
      neon: boolean;
    }> = [
      // NW block
      { x: -21, z: -21, w: 9, d: 9, h: 16, neon: true },
      { x: -33, z: -18, w: 8, d: 11, h: 12, neon: false },
      { x: -19, z: -33, w: 11, d: 8, h: 20, neon: true },
      // NE block
      { x: 21, z: -21, w: 10, d: 9, h: 22, neon: true },
      { x: 33, z: -19, w: 8, d: 10, h: 14, neon: false },
      { x: 19, z: -33, w: 10, d: 8, h: 17, neon: true },
      // SW block
      { x: -21, z: 21, w: 9, d: 10, h: 15, neon: true },
      { x: -33, z: 20, w: 8, d: 10, h: 19, neon: false },
      { x: -19, z: 33, w: 11, d: 8, h: 13, neon: true },
      // SE block
      { x: 21, z: 21, w: 10, d: 9, h: 18, neon: true },
      { x: 33, z: 20, w: 8, d: 11, h: 24, neon: false },
      { x: 19, z: 33, w: 10, d: 8, h: 14, neon: true },
    ];

    for (let i = 0; i < buildingSpecs.length; i++) {
      const b = buildingSpecs[i];
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(b.w, b.h, b.d),
        buildingMat,
      );
      mesh.position.set(b.x, b.h / 2 + 0.16, b.z);
      scene.add(mesh);

      if (b.neon) {
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(b.w + 0.2, 0.25, b.d + 0.2),
          i % 2 === 0 ? neonStripMat : neonAltMat,
        );
        strip.position.set(b.x, b.h - 0.5, b.z);
        scene.add(strip);
      }

      buildingAABBs.push({
        minX: b.x - b.w / 2 - 0.65,
        maxX: b.x + b.w / 2 + 0.65,
        minZ: b.z - b.d / 2 - 0.65,
        maxZ: b.z + b.d / 2 + 0.65,
      });
    }

    // Streetlamps along main avenues
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      metalness: 0.7,
      roughness: 0.4,
    });
    const bulbMat = new THREE.MeshBasicMaterial({ color: theme.lampColor });
    const lampPositions: [number, number, boolean][] = [
      [-6.5, -16, true],
      [6.5, -16, false],
      [-6.5, 16, false],
      [6.5, 16, true],
      [-16, -6.5, false],
      [16, 6.5, false],
    ];
    for (const [lx, lz, addLight] of lampPositions) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.14, 4.8, 8),
        poleMat,
      );
      pole.position.set(lx, 2.4, lz);
      scene.add(pole);

      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 10, 10),
        bulbMat,
      );
      bulb.position.set(lx, 4.9, lz);
      scene.add(bulb);

      if (addLight) {
        const pt = new THREE.PointLight(theme.lampColor, 18, 22, 1.5);
        pt.position.set(lx, 4.6, lz);
        scene.add(pt);
      }
    }

    // Interactive POIs
    const poiMeshes: Array<{
      poi: DistrictPoi;
      beacon: THREE.Mesh;
      ring: THREE.Mesh;
    }> = [];

    for (const poi of POIS) {
      const ringGeo = new THREE.RingGeometry(1.4, 1.85, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: poi.hex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(poi.x, 0.2, poi.z);
      scene.add(ring);

      const beaconGeo = new THREE.OctahedronGeometry(0.65, 0);
      const beaconMat = new THREE.MeshStandardMaterial({
        color: poi.hex,
        emissive: poi.hex,
        emissiveIntensity: 0.75,
        roughness: 0.2,
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(poi.x, 2.2, poi.z);
      scene.add(beacon);

      const label = createNameLabelSprite(poi.title, poi.color);
      label.position.set(poi.x, 3.4, poi.z);
      scene.add(label);

      poiMeshes.push({ poi, beacon, ring });
    }

    // Local Player Avatar & Vehicle (supports in-place hot-swap without resetting WebGL)
    const buildLocalAvatar = (nextApp?: PlayerAppearance3D) =>
      createAvatarRig(
        nextApp?.avatarBodyColor ?? 0x27272a,
        nextApp?.avatarAccentColor ?? theme.accent,
        Boolean(nextApp?.hasVipCrown),
      );

    const buildLocalVehicle = (nextApp?: PlayerAppearance3D) =>
      createVehicleRig(nextApp?.carAccentColor ?? theme.accent, {
        bodyColor: nextApp?.carBodyColor,
        underglowColor: nextApp?.carUnderglowColor,
        underglowOpacity: nextApp?.carUnderglowOpacity,
        hasBlueNeon: nextApp?.hasBlueNeon,
        hasGoldPlate: nextApp?.hasGoldPlate,
        vehicleClass: nextApp?.vehicleClass ?? 'SUPERCAR',
      });

    const initialPose = poseRef.current;
    const initialApp = appearanceRef.current;
    lastBuiltKeyRef.current = initialApp?.appearanceKey;

    let localRig = buildLocalAvatar(initialApp);
    localRig.group.position.set(initialPose.px, 0, initialPose.pz);
    localRig.group.rotation.y = initialPose.pRotY;
    localRig.group.visible = !initialPose.inVehicle;
    scene.add(localRig.group);

    let carRig = buildLocalVehicle(initialApp);
    carRig.group.position.set(initialPose.cx, 0, initialPose.cz);
    carRig.group.rotation.y = initialPose.cHeading;
    carRig.headlightGlow.intensity = initialPose.inVehicle ? 10 : 0;
    scene.add(carRig.group);

    inVehicleRef.current = initialPose.inVehicle;

    // Driving & Drift State
    let carVx = 0;
    let carVz = 0;
    let carHeading = initialPose.cHeading;
    let carRoll = 0;
    let carPitch = 0;
    let lastHudSync = 0;

    rebuildLocalRigsFnRef.current = () => {
      const nextApp = appearanceRef.current;
      const pPos = localRig.group.position.clone();
      const pRotY = localRig.group.rotation.y;
      const cPos = carRig.group.position.clone();
      const cRotY = carRig.group.rotation.y;
      const wasInCar = inVehicleRef.current;

      scene.remove(localRig.group);
      disposeObject3D(localRig.group);
      localRig = buildLocalAvatar(nextApp);
      localRig.group.position.copy(pPos);
      localRig.group.rotation.y = pRotY;
      localRig.group.visible = !wasInCar;
      scene.add(localRig.group);

      scene.remove(carRig.group);
      disposeObject3D(carRig.group);
      carRig = buildLocalVehicle(nextApp);
      carRig.group.position.copy(cPos);
      carRig.group.rotation.y = cRotY;
      carRig.headlightGlow.intensity = wasInCar ? 10 : 0;
      scene.add(carRig.group);
    };

    // Tire Smoke Pool
    const smokeGeo = new THREE.SphereGeometry(0.28, 6, 6);
    const smokePool: SmokeParticle[] = [];
    for (let i = 0; i < 36; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xd4d4d8,
        transparent: true,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(smokeGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      smokePool.push({
        mesh,
        mat,
        life: 0,
        maxLife: 0.7,
        vx: 0,
        vy: 0,
        vz: 0,
      });
    }
    let smokeCursor = 0;
    const spawnSmoke = (wx: number, wz: number, vx: number, vz: number) => {
      const p = smokePool[smokeCursor];
      smokeCursor = (smokeCursor + 1) % smokePool.length;
      p.mesh.visible = true;
      p.mesh.position.set(wx, 0.22, wz);
      p.mesh.scale.setScalar(0.75);
      p.life = 0.65;
      p.maxLife = 0.65;
      p.vx = vx * 0.15 + (Math.random() - 0.5) * 1.4;
      p.vy = 1.2 + Math.random() * 0.8;
      p.vz = vz * 0.15 + (Math.random() - 0.5) * 1.4;
      p.mat.opacity = 0.52;
    };

    // Combat Pulse Effects [Q]
    const pulseEffects: CombatPulseEffect[] = [];
    let lastPulseTime = 0;
    const triggerCombatPulse = () => {
      const nowMs = performance.now();
      if (nowMs - lastPulseTime < 550) return;
      lastPulseTime = nowMs;

      const origin = inVehicleRef.current
        ? carRig.group.position
        : localRig.group.position;
      const rot = inVehicleRef.current
        ? carRig.group.rotation.y
        : localRig.group.rotation.y;

      const ringMat = new THREE.MeshBasicMaterial({
        color: theme.accent,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      });
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.85, 32),
        ringMat,
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(origin.x, 0.25, origin.z);
      scene.add(ring);

      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.95,
      });
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.14, 5.5),
        beamMat,
      );
      const fx = Math.sin(rot);
      const fz = Math.cos(rot);
      beam.position.set(origin.x + fx * 3.1, 1.15, origin.z + fz * 3.1);
      beam.rotation.y = rot;
      scene.add(beam);

      const light = new THREE.PointLight(theme.accent, 22, 16, 1.5);
      light.position.set(origin.x + fx * 1.5, 1.4, origin.z + fz * 1.5);
      scene.add(light);

      pulseEffects.push({
        ring,
        ringMat,
        beam,
        beamMat,
        light,
        life: 0.42,
        maxLife: 0.42,
      });
    };

    const toggleVehicleMode = () => {
      if (inVehicleRef.current) {
        // Exit vehicle
        inVehicleRef.current = false;
        setInVehicle(false);
        setSpeedKmh(0);
        setIsDrifting(false);
        carRig.headlightGlow.intensity = 0;
        carRig.group.position.y = 0;
        const exitX = THREE.MathUtils.clamp(
          carRig.group.position.x - Math.cos(carHeading) * 1.9,
          -WORLD_LIMIT,
          WORLD_LIMIT,
        );
        const exitZ = THREE.MathUtils.clamp(
          carRig.group.position.z + Math.sin(carHeading) * 1.9,
          -WORLD_LIMIT,
          WORLD_LIMIT,
        );
        localRig.group.position.set(exitX, 0, exitZ);
        localRig.group.visible = true;
      } else {
        // Enter vehicle (if far, summon smoothly near player)
        const dist = Math.hypot(
          localRig.group.position.x - carRig.group.position.x,
          localRig.group.position.z - carRig.group.position.z,
        );
        if (dist > 6) {
          carRig.group.position.set(
            localRig.group.position.x,
            0,
            localRig.group.position.z,
          );
          carHeading = localRig.group.rotation.y;
          carRig.group.rotation.y = carHeading;
          carVx = 0;
          carVz = 0;
        }
        inVehicleRef.current = true;
        setInVehicle(true);
        localRig.group.visible = false;
        carRig.headlightGlow.intensity = 10;
      }
    };

    toggleVehicleFnRef.current = toggleVehicleMode;
    triggerPulseFnRef.current = triggerCombatPulse;

    // Remote Players Map managed by Three.js loop
    const remoteAvatars = new Map<string, RemoteAvatarEntry>();

    // Keyboard listeners
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const k = e.key.toLowerCase();
      if (
        k === 'arrowup' ||
        k === 'arrowdown' ||
        k === 'arrowleft' ||
        k === 'arrowright' ||
        k === ' '
      ) {
        e.preventDefault();
      }
      keysRef.current[k] = true;
      if (k === 'f' && !e.repeat) {
        toggleVehicleMode();
      } else if (k === 'q' && !e.repeat) {
        triggerCombatPulse();
      } else if (k === 'e' && nearbyPoiRef.current) {
        if (activePoiRef.current?.id === nearbyPoiRef.current.id) {
          setActivePoi(null);
        } else {
          setActivePoi(nearbyPoiRef.current);
        }
      } else if (k === 'escape' && activePoiRef.current) {
        setActivePoi(null);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    const onWindowBlur = () => {
      keysRef.current = {};
      touchDirRef.current = { x: 0, z: 0 };
      touchThrottleRef.current = false;
      touchBrakeRef.current = false;
      sprintTouchRef.current = false;
      driftTouchRef.current = false;
    };

    // Mouse / Pointer camera orbit + wheel zoom on WebGL canvas
    let isOrbitDragging = false;
    let lastOrbitX = 0;
    let lastOrbitY = 0;
    const canvasEl = renderer.domElement;
    canvasEl.style.touchAction = 'none';

    const onCanvasPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
      isOrbitDragging = true;
      lastOrbitX = e.clientX;
      lastOrbitY = e.clientY;
    };
    const onCanvasPointerMove = (e: PointerEvent) => {
      if (!isOrbitDragging) return;
      const dx = e.clientX - lastOrbitX;
      const dy = e.clientY - lastOrbitY;
      lastOrbitX = e.clientX;
      lastOrbitY = e.clientY;
      camOrbitYawRef.current -= dx * 0.0065;
      camOrbitPitchRef.current = THREE.MathUtils.clamp(
        camOrbitPitchRef.current + dy * 0.0045,
        -0.3,
        0.65,
      );
    };
    const onCanvasPointerUp = () => {
      isOrbitDragging = false;
    };
    const onCanvasWheel = (e: WheelEvent) => {
      e.preventDefault();
      camZoomRef.current = THREE.MathUtils.clamp(
        camZoomRef.current + e.deltaY * 0.0008,
        0.65,
        1.75,
      );
    };
    const onCanvasDblClick = () => {
      camOrbitYawRef.current = 0;
      camOrbitPitchRef.current = 0.18;
      camZoomRef.current = 1;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    canvasEl.addEventListener('pointerdown', onCanvasPointerDown);
    window.addEventListener('pointermove', onCanvasPointerMove);
    window.addEventListener('pointerup', onCanvasPointerUp);
    window.addEventListener('pointercancel', onCanvasPointerUp);
    canvasEl.addEventListener('wheel', onCanvasWheel, { passive: false });
    canvasEl.addEventListener('dblclick', onCanvasDblClick);

    // ResizeObserver
    const handleResize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Animation loop
    let animId = 0;
    let lastTime = performance.now();
    let lastEmitTime = 0;
    let wasMoving = false;
    let lastRadarDraw = 0;
    let lastCountSync = 0;
    let prevGpVehicle = false;
    let prevGpPulse = false;
    let prevGpInteract = false;
    let prevGpCancel = false;

    const camTarget = new THREE.Vector3();
    const desiredCamPos = new THREE.Vector3();
    const lookAtPos = new THREE.Vector3();

    const collidesWithBuilding = (nx: number, nz: number) => {
      for (const b of buildingAABBs) {
        if (nx >= b.minX && nx <= b.maxX && nz >= b.minZ && nz <= b.maxZ) {
          return true;
        }
      }
      return false;
    };

    const drawRadar = (px: number, pz: number, rotY: number) => {
      const canvas = radarCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = canvas.width;
      const half = size / 2;
      const scale = size / 92;

      ctx.clearRect(0, 0, size, size);

      // Background
      ctx.fillStyle = 'rgba(9, 9, 11, 0.85)';
      ctx.beginPath();
      ctx.arc(half, half, half - 2, 0, Math.PI * 2);
      ctx.fill();

      // Clip to circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(half, half, half - 3, 0, Math.PI * 2);
      ctx.clip();

      // Streets
      ctx.fillStyle = 'rgba(63, 63, 70, 0.55)';
      ctx.fillRect(half - 5 * scale, 0, 10 * scale, size);
      ctx.fillRect(0, half - 5 * scale, size, 10 * scale);

      // POIs
      for (const poi of POIS) {
        const rx = half + poi.x * scale;
        const ry = half + poi.z * scale;
        ctx.fillStyle = poi.color;
        ctx.beginPath();
        ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Remote players
      ctx.fillStyle = '#38bdf8';
      for (const entry of remoteAvatars.values()) {
        const rx = half + entry.rig.group.position.x * scale;
        const ry = half + entry.rig.group.position.z * scale;
        ctx.beginPath();
        ctx.arc(rx, ry, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Local player
      const lx = half + px * scale;
      const ly = half + pz * scale;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(-rotY);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 14, Math.PI * 0.3, Math.PI * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Outer ring
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(half, half, half - 2, 0, Math.PI * 2);
      ctx.stroke();
    };

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Poll active Gamepad (PS5 DualSense, Xbox, Switch Pro)
      const pads = navigator.getGamepads?.() ?? [];
      const gp = Array.from(pads).find((p) => p && p.connected) ?? null;
      const deadzone = (val: number) =>
        Math.abs(val) < 0.16 ? 0 : (val - Math.sign(val) * 0.16) / 0.84;

      let gpMoveX = 0;
      let gpMoveZ = 0;
      let gpThrottle = 0;
      let gpBoost = false;
      let gpDrift = false;
      if (gp) {
        const lx = deadzone(gp.axes[0] ?? 0);
        const ly = deadzone(gp.axes[1] ?? 0);
        const rx = deadzone(gp.axes[2] ?? 0);
        const ry = deadzone(gp.axes[3] ?? 0);
        if (Math.abs(rx) > 0 || Math.abs(ry) > 0) {
          camOrbitYawRef.current -= rx * dt * 2.4;
          camOrbitPitchRef.current = THREE.MathUtils.clamp(
            camOrbitPitchRef.current + ry * dt * 1.6,
            -0.3,
            0.65,
          );
        }

        const dpadUp = gp.buttons[12]?.pressed ? 1 : 0;
        const dpadDown = gp.buttons[13]?.pressed ? 1 : 0;
        const dpadLeft = gp.buttons[14]?.pressed ? 1 : 0;
        const dpadRight = gp.buttons[15]?.pressed ? 1 : 0;

        gpMoveX = THREE.MathUtils.clamp(lx + dpadRight - dpadLeft, -1, 1);
        gpMoveZ = THREE.MathUtils.clamp(ly + dpadDown - dpadUp, -1, 1);

        const r2 = gp.buttons[7]?.value ?? 0;
        const l2 = gp.buttons[6]?.value ?? 0;
        gpThrottle = (r2 > 0.08 ? r2 : 0) - (l2 > 0.08 ? l2 : 0);
        gpBoost = Boolean(gp.buttons[5]?.pressed);

        const btnCross = Boolean(gp.buttons[0]?.pressed);
        const btnCircle = Boolean(gp.buttons[1]?.pressed);
        const btnSquare = Boolean(gp.buttons[2]?.pressed);
        const btnTriangle = Boolean(gp.buttons[3]?.pressed);

        if (btnTriangle && !prevGpVehicle) toggleVehicleMode();
        if (btnSquare && !prevGpPulse) triggerCombatPulse();
        if (btnCross && !prevGpInteract && nearbyPoiRef.current) {
          if (activePoiRef.current?.id === nearbyPoiRef.current.id) {
            setActivePoi(null);
          } else {
            setActivePoi(nearbyPoiRef.current);
          }
        }
        if (btnCircle && !prevGpCancel && activePoiRef.current) {
          setActivePoi(null);
        }

        gpDrift = btnCircle || (btnCross && !nearbyPoiRef.current);
        prevGpVehicle = btnTriangle;
        prevGpPulse = btnSquare;
        prevGpInteract = btnCross;
        prevGpCancel = btnCircle;
      } else {
        prevGpVehicle = false;
        prevGpPulse = false;
        prevGpInteract = false;
        prevGpCancel = false;
      }

      // Spin rotors / propellers on HELI and PLANE rigs
      for (const rotor of carRig.rotors) {
        const spinRate = inVehicleRef.current ? 22 : 2.8;
        rotor.obj.rotation[rotor.axis] += dt * spinRate;
      }

      // 1. Local movement (On-foot OR Vehicle + Drift Physics scaled by vehicle stats)
      const keys = keysRef.current;
      let isMoving = false;
      let currentSpeed = 0;

      if (inVehicleRef.current) {
        const appNow = appearanceRef.current;
        const speedStat = appNow?.vehicleSpeed ?? 75;
        const handlingStat = appNow?.vehicleHandling ?? 75;
        const condStat = appNow?.vehicleCondition ?? 100;
        const speedFactor = 0.72 + (speedStat / 100) * 0.58;
        const handlingFactor = 0.75 + (handlingStat / 100) * 0.5;
        const condFactor =
          0.65 + (THREE.MathUtils.clamp(condStat, 10, 100) / 100) * 0.35;

        const kbThrottle =
          (keys['w'] || keys['arrowup'] || touchThrottleRef.current ? 1 : 0) -
          (keys['s'] || keys['arrowdown'] || touchBrakeRef.current ? 1 : 0);
        const stickThrottle =
          Math.abs(touchDirRef.current.z) > 0.2 ? -touchDirRef.current.z : 0;
        const throttleInput = THREE.MathUtils.clamp(
          kbThrottle + stickThrottle + gpThrottle,
          -1,
          1,
        );

        const kbSteer =
          (keys['a'] || keys['arrowleft'] ? 1 : 0) -
          (keys['d'] || keys['arrowright'] ? 1 : 0);
        const stickSteer =
          Math.abs(touchDirRef.current.x) > 0.14 ? -touchDirRef.current.x : 0;
        const steerInput = THREE.MathUtils.clamp(
          kbSteer + stickSteer - gpMoveX,
          -1,
          1,
        );

        const handbrake = Boolean(
          keys[' '] || driftTouchRef.current || gpDrift,
        );
        const boost = Boolean(
          keys['shift'] || sprintTouchRef.current || gpBoost,
        );

        const fx = Math.sin(carHeading);
        const fz = Math.cos(carHeading);
        const rx = Math.cos(carHeading);
        const rz = -Math.sin(carHeading);

        let forwardSpeed = carVx * fx + carVz * fz;
        let lateralSpeed = carVx * rx + carVz * rz;

        const maxForward = (boost ? 34 : 27) * speedFactor * condFactor;
        const accel = (boost ? 30 : 22) * speedFactor * condFactor;

        if (throttleInput > 0.05) {
          forwardSpeed += accel * throttleInput * dt;
        } else if (throttleInput < -0.05) {
          forwardSpeed += (forwardSpeed > 1 ? 36 : 16) * throttleInput * dt;
        } else {
          forwardSpeed *= Math.max(0, 1 - 1.5 * dt);
        }

        if (handbrake) {
          forwardSpeed *= Math.max(0, 1 - 1.15 * dt);
        }

        forwardSpeed = THREE.MathUtils.clamp(forwardSpeed, -14, maxForward);

        // Steering depends on speed & increases responsiveness during drift
        const speedAbs = Math.abs(forwardSpeed);
        const steerAuthority =
          carRig.vehicleClass === 'HELI'
            ? 1
            : THREE.MathUtils.clamp(speedAbs / 5.5, 0, 1);
        const reverseSign = forwardSpeed >= -0.2 ? 1 : -1;
        const steerRate = (handbrake ? 3.1 : 2.2) * handlingFactor;
        carHeading +=
          steerInput * steerRate * steerAuthority * reverseSign * dt;

        // Lateral grip: low grip when handbrake/drift is active => real oversteer slide
        const lateralGrip = handbrake ? 1.75 : 6.5 + (handlingStat / 100) * 3.5;
        lateralSpeed *= Math.max(0, 1 - lateralGrip * dt);

        const nfx = Math.sin(carHeading);
        const nfz = Math.cos(carHeading);
        const nrx = Math.cos(carHeading);
        const nrz = -Math.sin(carHeading);

        carVx = nfx * forwardSpeed + nrx * lateralSpeed;
        carVz = nfz * forwardSpeed + nrz * lateralSpeed;

        const curX = carRig.group.position.x;
        const curZ = carRig.group.position.z;
        const candX = THREE.MathUtils.clamp(
          curX + carVx * dt,
          -WORLD_LIMIT,
          WORLD_LIMIT,
        );
        if (!collidesWithBuilding(candX, curZ)) {
          carRig.group.position.x = candX;
        } else {
          carVx *= -0.35;
        }

        const candZ = THREE.MathUtils.clamp(
          curZ + carVz * dt,
          -WORLD_LIMIT,
          WORLD_LIMIT,
        );
        if (!collidesWithBuilding(carRig.group.position.x, candZ)) {
          carRig.group.position.z = candZ;
        } else {
          carVz *= -0.35;
        }

        const targetAlt =
          carRig.vehicleClass === 'HELI'
            ? 2.4 + Math.sin(now * 0.004) * 0.14
            : carRig.vehicleClass === 'PLANE'
              ? Math.min(3.4, speedAbs * 0.11)
              : 0;
        carRig.group.position.y +=
          (targetAlt - carRig.group.position.y) * Math.min(1, dt * 5);

        carRig.group.rotation.y = carHeading;
        localRig.group.position.set(
          carRig.group.position.x,
          0,
          carRig.group.position.z,
        );
        localRig.group.rotation.y = carHeading;

        // Chassis roll & pitch (extra lean for MOTO / HELI / PLANE)
        const leanMult =
          carRig.vehicleClass === 'MOTO' ||
          carRig.vehicleClass === 'HELI' ||
          carRig.vehicleClass === 'PLANE'
            ? 2.1
            : 1;
        const targetRoll = THREE.MathUtils.clamp(
          (-lateralSpeed * 0.018 + steerInput * 0.06) * leanMult,
          -0.28,
          0.28,
        );
        const targetPitch = THREE.MathUtils.clamp(
          -throttleInput * 0.04 + (handbrake ? 0.03 : 0),
          -0.08,
          0.08,
        );
        carRoll += (targetRoll - carRoll) * Math.min(1, dt * 10);
        carPitch += (targetPitch - carPitch) * Math.min(1, dt * 10);
        carRig.chassis.rotation.z = carRoll;
        carRig.chassis.rotation.x = carPitch;

        // Wheel spin & front wheel steering visual
        const wheelSpin = forwardSpeed * dt * 2.2;
        for (const fw of carRig.frontWheels) {
          fw.rotation.x += wheelSpin;
          fw.rotation.y = steerInput * 0.38;
        }
        for (const rw of carRig.rearWheels) {
          rw.rotation.x += wheelSpin;
        }

        // Brake / drift taillights
        const brakingOrDrifting =
          throttleInput < -0.1 || handbrake || Math.abs(lateralSpeed) > 3.2;
        carRig.brakeMat.emissiveIntensity = brakingOrDrifting ? 4.0 : 0.9;

        const driftingNow =
          carRig.vehicleClass !== 'HELI' &&
          carRig.vehicleClass !== 'PLANE' &&
          ((handbrake && speedAbs > 4.5) || Math.abs(lateralSpeed) > 3.8);

        if (driftingNow && Math.random() < 0.75) {
          const rearCx = carRig.group.position.x - nfx * 1.35;
          const rearCz = carRig.group.position.z - nfz * 1.35;
          spawnSmoke(rearCx - nrx * 0.85, rearCz - nrz * 0.85, carVx, carVz);
          spawnSmoke(rearCx + nrx * 0.85, rearCz + nrz * 0.85, carVx, carVz);
        }

        currentSpeed = Math.hypot(carVx, carVz);
        isMoving = currentSpeed > 0.35;

        if (now - lastHudSync > 70) {
          lastHudSync = now;
          setSpeedKmh(Math.round(currentSpeed * 5.2));
          setIsDrifting(driftingNow);
        }
      } else {
        if (carRig.group.position.y > 0.01) {
          carRig.group.position.y *= Math.max(0, 1 - dt * 6);
        }
        let moveX = touchDirRef.current.x + gpMoveX;
        let moveZ = touchDirRef.current.z + gpMoveZ;

        if (keys['w'] || keys['arrowup']) moveZ -= 1;
        if (keys['s'] || keys['arrowdown']) moveZ += 1;
        if (keys['a'] || keys['arrowleft']) moveX -= 1;
        if (keys['d'] || keys['arrowright']) moveX += 1;

        const mag = Math.hypot(moveX, moveZ);
        isMoving = mag > 0.08;
        const isSprinting = Boolean(
          keys['shift'] || sprintTouchRef.current || gpBoost,
        );
        currentSpeed = isSprinting ? 12.5 : 7.2;

        if (isMoving) {
          const inputMag = Math.min(1, mag);
          const localNx = moveX / mag;
          const localNz = moveZ / mag;
          const camYaw = camOrbitYawRef.current;
          const cosY = Math.cos(camYaw);
          const sinY = Math.sin(camYaw);
          const nx = localNx * cosY + localNz * sinY;
          const nz = -localNx * sinY + localNz * cosY;

          const stepX = nx * currentSpeed * inputMag * dt;
          const stepZ = nz * currentSpeed * inputMag * dt;

          const curX = localRig.group.position.x;
          const curZ = localRig.group.position.z;

          const candX = THREE.MathUtils.clamp(
            curX + stepX,
            -WORLD_LIMIT,
            WORLD_LIMIT,
          );
          if (!collidesWithBuilding(candX, curZ)) {
            localRig.group.position.x = candX;
          }

          const candZ = THREE.MathUtils.clamp(
            curZ + stepZ,
            -WORLD_LIMIT,
            WORLD_LIMIT,
          );
          if (!collidesWithBuilding(localRig.group.position.x, candZ)) {
            localRig.group.position.z = candZ;
          }

          const targetRot = Math.atan2(nx, nz);
          let diff = targetRot - localRig.group.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          localRig.group.rotation.y += diff * Math.min(1, dt * 12);
        }

        animateAvatarRig(localRig, isMoving, isSprinting, dt);
      }

      // Update Smoke Particles
      for (const p of smokePool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.mesh.visible = false;
          p.mat.opacity = 0;
        } else {
          const t = 1 - p.life / p.maxLife;
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.mesh.scale.setScalar(0.75 + t * 2.1);
          p.mat.opacity = (1 - t) * 0.48;
        }
      }

      // Update Combat Pulse Effects [Q]
      for (let i = pulseEffects.length - 1; i >= 0; i--) {
        const fxItem = pulseEffects[i];
        fxItem.life -= dt;
        if (fxItem.life <= 0) {
          scene.remove(fxItem.ring);
          scene.remove(fxItem.beam);
          scene.remove(fxItem.light);
          fxItem.ring.geometry.dispose();
          fxItem.beam.geometry.dispose();
          fxItem.ringMat.dispose();
          fxItem.beamMat.dispose();
          pulseEffects.splice(i, 1);
        } else {
          const progress = 1 - fxItem.life / fxItem.maxLife;
          const scale = 1 + progress * 7.5;
          fxItem.ring.scale.set(scale, scale, 1);
          fxItem.ringMat.opacity = (1 - progress) * 0.85;
          fxItem.beamMat.opacity = (1 - progress) * 0.95;
          fxItem.light.intensity = (1 - progress) * 20;
        }
      }

      // 2. Emit player:move throttled (~16 Hz)
      if ((isMoving && now - lastEmitTime > 60) || (!isMoving && wasMoving)) {
        lastEmitTime = now;
        const sprinting = Boolean(
          keys['shift'] || sprintTouchRef.current || gpBoost,
        );
        emitMoveRef.current({
          x: Number(localRig.group.position.x.toFixed(2)),
          y: 0,
          z: Number(localRig.group.position.z.toFixed(2)),
          rotY: Number(localRig.group.rotation.y.toFixed(3)),
          anim: !isMoving
            ? 'idle'
            : inVehicleRef.current
              ? 'drive'
              : sprinting
                ? 'run'
                : 'walk',
        });
      }
      wasMoving = isMoving;

      // 3. Smooth Dynamic Camera (Orbit + Zoom + Speed-reactive Chase Cam)
      if (inVehicleRef.current) {
        const speedRatio = THREE.MathUtils.clamp(currentSpeed / 34, 0, 1);
        const fx = Math.sin(carHeading);
        const fz = Math.cos(carHeading);
        const orbitHeading = carHeading + camOrbitYawRef.current;
        const camDist = (9.2 + speedRatio * 2.4) * camZoomRef.current;
        const camHeight =
          carRig.group.position.y +
          (3.6 + camOrbitPitchRef.current * 4.5 + speedRatio * 0.7) *
            camZoomRef.current;
        desiredCamPos.set(
          carRig.group.position.x - Math.sin(orbitHeading) * camDist,
          camHeight,
          carRig.group.position.z - Math.cos(orbitHeading) * camDist,
        );
        camera.position.lerp(desiredCamPos, Math.min(1, dt * 8));
        camTarget.set(
          carRig.group.position.x + fx * (2.5 + speedRatio * 2),
          carRig.group.position.y + 1.25,
          carRig.group.position.z + fz * (2.5 + speedRatio * 2),
        );
        lookAtPos.lerp(camTarget, Math.min(1, dt * 12));
        camera.lookAt(lookAtPos);

        const targetFov = 60 + speedRatio * 16;
        if (Math.abs(camera.fov - targetFov) > 0.05) {
          camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 6);
          camera.updateProjectionMatrix();
        }
      } else {
        const yaw = camOrbitYawRef.current;
        const camDist = 10.5 * camZoomRef.current;
        const camHeight =
          (5.8 + camOrbitPitchRef.current * 5.0) * camZoomRef.current;
        desiredCamPos.set(
          localRig.group.position.x + Math.sin(yaw) * camDist,
          localRig.group.position.y + camHeight,
          localRig.group.position.z + Math.cos(yaw) * camDist,
        );
        camera.position.lerp(desiredCamPos, Math.min(1, dt * 6));
        camTarget.set(
          localRig.group.position.x,
          localRig.group.position.y + 1.4,
          localRig.group.position.z,
        );
        lookAtPos.lerp(camTarget, Math.min(1, dt * 10));
        camera.lookAt(lookAtPos);

        if (Math.abs(camera.fov - 58) > 0.05) {
          camera.fov += (58 - camera.fov) * Math.min(1, dt * 6);
          camera.updateProjectionMatrix();
        }
      }

      // 4. POI animations & proximity check
      let closestPoi: DistrictPoi | null = null;
      let closestDist = 4.6;
      for (const item of poiMeshes) {
        item.beacon.rotation.y += dt * 1.6;
        item.beacon.position.y =
          2.1 + Math.sin(now * 0.003 + item.poi.x) * 0.25;
        const d = Math.hypot(
          localRig.group.position.x - item.poi.x,
          localRig.group.position.z - item.poi.z,
        );
        if (d < closestDist) {
          closestDist = d;
          closestPoi = item.poi;
        }
      }
      if (nearbyPoiRef.current?.id !== closestPoi?.id) {
        nearbyPoiRef.current = closestPoi;
        setNearbyPoi(closestPoi);
      }

      // 5. Remote players sync & smooth lerp (zero React re-renders)
      const snapshotMap = remotePlayersRef.current;
      for (const [id, remote] of snapshotMap.entries()) {
        if (id === localIdRef.current) continue;
        if (remote.locationId && remote.locationId !== locationIdRef.current) {
          continue;
        }
        const remoteRotY = remote.rotY ?? remote.rotationY ?? 0;
        const remoteMoving = remote.anim
          ? remote.anim !== 'idle'
          : Boolean(remote.isMoving);
        let entry = remoteAvatars.get(id);
        if (!entry) {
          const rig = createAvatarRig(0x1e293b, 0x38bdf8);
          rig.group.position.set(remote.x || 0, remote.y || 0, remote.z || 0);
          rig.group.rotation.y = remoteRotY;
          const labelSprite = createNameLabelSprite(
            remote.displayName || 'Jugador',
            '#38bdf8',
          );
          rig.group.add(labelSprite);
          scene.add(rig.group);
          entry = {
            rig,
            targetPos: new THREE.Vector3(
              remote.x || 0,
              remote.y || 0,
              remote.z || 0,
            ),
            targetRotY: remoteRotY,
            isMoving: remoteMoving,
            displayName: remote.displayName,
            labelSprite,
          };
          remoteAvatars.set(id, entry);
        } else {
          entry.targetPos.set(remote.x || 0, remote.y || 0, remote.z || 0);
          entry.targetRotY = remoteRotY;
          entry.isMoving = remoteMoving;
        }
      }

      // Remove disconnected / left remote players
      for (const [id, entry] of remoteAvatars.entries()) {
        const snap = snapshotMap.get(id);
        if (
          !snap ||
          (snap.locationId && snap.locationId !== locationIdRef.current)
        ) {
          scene.remove(entry.rig.group);
          disposeObject3D(entry.rig.group);
          remoteAvatars.delete(id);
          continue;
        }
        entry.rig.group.position.lerp(entry.targetPos, Math.min(1, dt * 10));
        let rDiff = entry.targetRotY - entry.rig.group.rotation.y;
        while (rDiff > Math.PI) rDiff -= Math.PI * 2;
        while (rDiff < -Math.PI) rDiff += Math.PI * 2;
        entry.rig.group.rotation.y += rDiff * Math.min(1, dt * 10);
        const movingDist = entry.rig.group.position.distanceTo(entry.targetPos);
        animateAvatarRig(
          entry.rig,
          entry.isMoving || movingDist > 0.08,
          false,
          dt,
        );
      }

      if (now - lastCountSync > 1000) {
        lastCountSync = now;
        setRemoteCount(remoteAvatars.size);
      }

      if (now - lastRadarDraw > 65) {
        lastRadarDraw = now;
        drawRadar(
          localRig.group.position.x,
          localRig.group.position.z,
          localRig.group.rotation.y,
        );
      }

      renderer.render(scene, camera);
    };

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
      cancelAnimationFrame(animId);
      setWebglError(
        'Se perdió el contexto gráfico 3D. Puedes recargar o usar Vista Clásica.',
      );
    };
    const onContextRestored = () => {
      setWebglError(null);
      lastTime = performance.now();
      animId = requestAnimationFrame(animate);
    };
    canvasEl.addEventListener('webglcontextlost', onContextLost);
    canvasEl.addEventListener('webglcontextrestored', onContextRestored);

    animId = requestAnimationFrame(animate);

    return () => {
      poseRef.current = {
        px: localRig.group.position.x,
        pz: localRig.group.position.z,
        pRotY: localRig.group.rotation.y,
        cx: carRig.group.position.x,
        cz: carRig.group.position.z,
        cHeading: carHeading,
        inVehicle: inVehicleRef.current,
      };
      rebuildLocalRigsFnRef.current = null;
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      canvasEl.removeEventListener('pointerdown', onCanvasPointerDown);
      window.removeEventListener('pointermove', onCanvasPointerMove);
      window.removeEventListener('pointerup', onCanvasPointerUp);
      window.removeEventListener('pointercancel', onCanvasPointerUp);
      canvasEl.removeEventListener('wheel', onCanvasWheel);
      canvasEl.removeEventListener('dblclick', onCanvasDblClick);
      canvasEl.removeEventListener('webglcontextlost', onContextLost);
      canvasEl.removeEventListener('webglcontextrestored', onContextRestored);
      disposeObject3D(scene);
      windowTex.dispose();
      renderer.dispose();
    };
  }, [vibe, remotePlayersRef]);

  const heatStars = Math.min(5, Math.ceil((player.heat || 0) / 20));
  const app = player.appearance;

  if (webglError) {
    return (
      <div className="rounded-xl border border-amber-900/40 bg-zinc-900/80 p-6 text-center space-y-3">
        <p className="text-amber-400 font-semibold">Modo 3D no disponible</p>
        <p className="text-sm text-zinc-400">{webglError}</p>
        {onSwitchClassic && (
          <button
            type="button"
            onClick={onSwitchClassic}
            className="px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 font-semibold text-xs hover:bg-amber-400"
          >
            Ir a Vista Clásica / Movidas
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-[540px] md:h-[620px] rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 select-none">
      {/* Three.js Canvas Mount */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Top-Left HUD: District, Heat Stars & Lifestyle */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 max-w-[285px] pointer-events-auto">
        <div className="rounded-xl bg-zinc-950/80 backdrop-blur-md border border-zinc-800/90 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold">
              {zoneName}
            </span>
            <div className="flex items-center gap-1">
              {gamepadName && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-400/40 text-violet-200 font-semibold">
                  🎮 {gamepadName}
                </span>
              )}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  connected
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {connected ? `En vivo · ${remoteCount + 1}` : 'Offline'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-200">
            <span className="font-bold">Nv.{player.level}</span>
            <span className="text-amber-300 font-semibold">
              {Math.floor(player.euros).toLocaleString('es-ES')} €
            </span>
            <span className="text-zinc-400">Rep {player.reputation}</span>
          </div>

          {/* Police Heat Stars */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400">
              Calor
            </span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`text-xs ${
                    star <= heatStars ? 'text-red-500' : 'text-zinc-700'
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
            <span className="text-[10px] text-zinc-400 ml-auto">
              {player.heat}/100
            </span>
          </div>

          {(app?.isVip ||
            app?.characterName ||
            app?.clothingName ||
            app?.cosmeticName ||
            app?.vehicleName) && (
            <div className="mt-1.5 flex flex-wrap gap-1 border-t border-zinc-800/80 pt-1.5 text-[10px]">
              {app.isVip && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-bold text-amber-300">
                  👑 VIP
                </span>
              )}
              {app.characterName && (
                <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-fuchsia-200">
                  🎭 {app.characterName}
                </span>
              )}
              {app.clothingName && (
                <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-cyan-200">
                  👔 {app.clothingName}
                </span>
              )}
              {app.cosmeticName && (
                <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-200">
                  ✨ {app.cosmeticName}
                </span>
              )}
              {app.vehicleName && (
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
                  🏎️ {app.vehicleName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quick Lifestyle Selector */}
        <div className="flex gap-1 rounded-xl bg-zinc-950/80 backdrop-blur-md border border-zinc-800/90 p-1">
          {(['LEGAL', 'GREY', 'STREET'] as const).map((l) => (
            <button
              key={l}
              type="button"
              disabled={busy || player.lifestyle === l}
              onClick={() => {
                void onSetLifestyle(l);
              }}
              className={`flex-1 text-[11px] py-1 px-2 rounded-lg font-medium transition ${
                player.lifestyle === l
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {LIFE_LABEL[l]}
            </button>
          ))}
        </div>
      </div>

      {/* Top-Right HUD: Live Radar Minimap */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
        <canvas
          ref={radarCanvasRef}
          width={128}
          height={128}
          className="rounded-full shadow-lg shadow-black/60"
        />
        {onSwitchClassic && (
          <button
            type="button"
            onClick={onSwitchClassic}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-950/85 border border-zinc-700 text-zinc-200 hover:border-amber-500/60 backdrop-blur-md"
          >
            Vista Clásica
          </button>
        )}
      </div>

      {/* Proximity [E] Prompt */}
      {nearbyPoi && !activePoi && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20">
          <button
            type="button"
            onClick={handleInteract}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-950/90 border border-amber-500/70 text-zinc-100 shadow-lg shadow-amber-500/10 hover:bg-zinc-900 transition"
          >
            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950 font-black text-xs">
              E
            </span>
            <span className="text-xs font-semibold">
              Interactuar · {nearbyPoi.title}
            </span>
          </button>
        </div>
      )}

      {/* Last Narrative Toast */}
      {lastNarrative && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 hidden md:block max-w-md">
          <div className="px-3 py-1.5 rounded-lg bg-zinc-950/85 border border-zinc-800 text-[11px] text-zinc-300 backdrop-blur-md truncate">
            {lastNarrative}
          </div>
        </div>
      )}

      {/* Universal Virtual Analog Thumbstick (Mobile, Tablets, iPad, Switch Touch) */}
      <div
        className={`absolute bottom-3 left-3 z-10 ${
          isTouchDevice ? 'flex' : 'flex md:hidden'
        } items-center`}
      >
        <div
          ref={stickBaseRef}
          role="application"
          aria-label="Joystick analógico virtual"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            stickPointerIdRef.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateStickFromClient(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (stickPointerIdRef.current === e.pointerId) {
              updateStickFromClient(e.clientX, e.clientY);
            }
          }}
          onPointerUp={(e) => {
            if (stickPointerIdRef.current === e.pointerId) {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
              resetStick();
            }
          }}
          onPointerCancel={resetStick}
          className="relative w-28 h-28 rounded-full bg-zinc-950/70 border border-zinc-700/80 backdrop-blur-md flex items-center justify-center shadow-lg"
        >
          <div className="w-16 h-16 rounded-full border border-zinc-800/90 pointer-events-none" />
          <div
            className="absolute w-11 h-11 rounded-full bg-amber-500/80 border-2 border-amber-200/80 shadow-md pointer-events-none transition-transform duration-75"
            style={{
              transform: `translate(${stickOffset.x}px, ${stickOffset.y}px)`,
            }}
          />
        </div>
      </div>

      {/* Speedometer & Drift HUD when in Vehicle */}
      {inVehicle && (
        <div className="absolute bottom-14 md:bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-2xl border border-zinc-700/80 bg-zinc-950/85 px-4 py-2 backdrop-blur-md shadow-xl">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black tabular-nums tracking-tight text-white">
              {speedKmh}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              km/h
            </span>
          </div>
          <div className="h-2 w-24 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full transition-all duration-75 ${
                isDrifting ? 'bg-rose-500' : 'bg-amber-400'
              }`}
              style={{
                width: `${Math.min(100, Math.round((speedKmh / 190) * 100))}%`,
              }}
            />
          </div>
          {isDrifting && (
            <span className="animate-pulse rounded-md bg-rose-500/20 border border-rose-500/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-rose-300">
              DRIFT
            </span>
          )}
        </div>
      )}

      <div className="absolute bottom-3 right-3 z-10 flex flex-wrap items-center justify-end gap-2 max-w-[260px]">
        <button
          type="button"
          onClick={handleCombatPulse}
          className="px-3 py-2 rounded-xl text-xs font-bold border bg-zinc-900/85 border-rose-500/50 text-rose-300 hover:bg-rose-500/20 backdrop-blur-md"
        >
          [Q] Pulso
        </button>
        <button
          type="button"
          onClick={handleToggleVehicle}
          className={`px-3 py-2 rounded-xl text-xs font-bold border backdrop-blur-md ${
            inVehicle
              ? 'bg-sky-500/25 border-sky-400 text-sky-200'
              : 'bg-zinc-900/85 border-zinc-700 text-zinc-200 hover:border-amber-500/60'
          }`}
        >
          {inVehicle ? '[F] Bajar' : '[F] Vehículo'}
        </button>
        {inVehicle && (
          <>
            <button
              type="button"
              style={{ touchAction: 'none' }}
              onPointerDown={() => {
                touchBrakeRef.current = true;
              }}
              onPointerUp={() => {
                touchBrakeRef.current = false;
              }}
              onPointerCancel={() => {
                touchBrakeRef.current = false;
              }}
              className={`${
                isTouchDevice ? 'inline-flex' : 'md:hidden inline-flex'
              } px-3 py-2 rounded-xl text-xs font-bold border bg-zinc-900/85 border-zinc-700 text-zinc-200 active:bg-red-500/30`}
            >
              Freno
            </button>
            <button
              type="button"
              style={{ touchAction: 'none' }}
              onPointerDown={() => {
                touchThrottleRef.current = true;
              }}
              onPointerUp={() => {
                touchThrottleRef.current = false;
              }}
              onPointerCancel={() => {
                touchThrottleRef.current = false;
              }}
              className={`${
                isTouchDevice ? 'inline-flex' : 'md:hidden inline-flex'
              } px-3 py-2 rounded-xl text-xs font-bold border bg-emerald-500/20 border-emerald-500/60 text-emerald-200 active:bg-emerald-500/40`}
            >
              Acel
            </button>
            <button
              type="button"
              onClick={toggleDriftTouch}
              className={`${
                isTouchDevice ? 'inline-flex' : 'md:hidden inline-flex'
              } px-3 py-2 rounded-xl text-xs font-bold border ${
                driftTouch
                  ? 'bg-rose-500/30 border-rose-400 text-rose-200'
                  : 'bg-zinc-900/80 border-zinc-700 text-zinc-300'
              }`}
            >
              Drift
            </button>
          </>
        )}
        <button
          type="button"
          onClick={toggleSprintTouch}
          className={`${
            isTouchDevice ? 'inline-flex' : 'md:hidden inline-flex'
          } px-3 py-2 rounded-xl text-xs font-bold border ${
            sprintTouch
              ? 'bg-amber-500/25 border-amber-500 text-amber-300'
              : 'bg-zinc-900/80 border-zinc-700 text-zinc-300'
          }`}
        >
          {inVehicle ? 'Turbo' : 'Correr'}
        </button>
        {nearbyPoi && (
          <button
            type="button"
            onClick={handleInteract}
            className={`${
              isTouchDevice ? 'inline-flex' : 'md:hidden inline-flex'
            } px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 text-zinc-950`}
          >
            [E] Usar
          </button>
        )}
      </div>

      {/* Desktop / Controller Hint */}
      {!isTouchDevice && (
        <div className="hidden md:flex absolute bottom-3 left-3 z-10 items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950/75 border border-zinc-800 text-[11px] text-zinc-400 backdrop-blur-md">
          <span>WASD / Stick: Mover</span>
          <span>·</span>
          <span>Arrastrar/Rueda: Cámara</span>
          <span>·</span>
          <span>F / △: Vehículo</span>
          <span>·</span>
          <span>Espacio: Drift</span>
          <span>·</span>
          <span>Q / □: Pulso</span>
          <span>·</span>
          <span>E / ✕: POI</span>
        </div>
      )}

      {/* Active POI Interaction Modal */}
      {activePoi && (
        <div className="absolute inset-0 z-30 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className="text-[10px] uppercase tracking-widest font-bold"
                  style={{ color: activePoi.color }}
                >
                  Punto de interés · {zoneName}
                </p>
                <h3 className="text-lg font-black text-zinc-100">
                  {activePoi.title}
                </h3>
                <p className="text-xs text-zinc-400">{activePoi.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setActivePoi(null)}
                className="text-xs px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              >
                Cerrar [Esc]
              </button>
            </div>

            {activePoi.id === 'movidas' && (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {actions.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={busy || player.level < a.minLevel}
                    onClick={() => {
                      void onAction(a.id);
                    }}
                    className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 hover:border-amber-500/50 disabled:opacity-40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-100">
                        {a.label}
                      </span>
                      <span className="text-[10px] uppercase text-zinc-400">
                        {LIFE_LABEL[a.lifestyle] || a.lifestyle} · Riesgo{' '}
                        {Math.round(a.risk * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      {a.description}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {activePoi.id === 'garaje' && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-300">
                  Revisa tus coches, cambia tu vehículo principal o repáralo
                  antes de salir a rodar por el distrito.
                </p>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => {
                      setActivePoi(null);
                      onNavigateTab('vehiculos');
                    }}
                    className="w-full py-2.5 rounded-xl bg-sky-500 text-zinc-950 font-bold text-xs hover:bg-sky-400"
                  >
                    Abrir Garaje y Vehículos
                  </button>
                )}
              </div>
            )}

            {activePoi.id === 'piso_franco' && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-300">
                  Cambia tu estilo de vida en la calle o gestiona tus
                  propiedades e ingresos pasivos.
                </p>
                <div className="flex gap-2">
                  {(['LEGAL', 'GREY', 'STREET'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      disabled={busy || player.lifestyle === l}
                      onClick={() => {
                        void onSetLifestyle(l);
                      }}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${
                        player.lifestyle === l
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                          : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
                      }`}
                    >
                      {LIFE_LABEL[l]}
                    </button>
                  ))}
                </div>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => {
                      setActivePoi(null);
                      onNavigateTab('propiedades');
                    }}
                    className="w-full py-2.5 rounded-xl bg-purple-500 text-white font-bold text-xs hover:bg-purple-400"
                  >
                    Gestionar Propiedades
                  </button>
                )}
              </div>
            )}

            {activePoi.id === 'comisaria' && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-300">
                  Calor policial actual:{' '}
                  <span className="font-bold text-red-400">
                    {player.heat}/100
                  </span>
                  . Mantener un perfil Legal o realizar trabajos limpios ayuda a
                  enfriar el radar.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy || player.lifestyle === 'LEGAL'}
                    onClick={() => {
                      void onSetLifestyle('LEGAL');
                    }}
                    className="flex-1 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-semibold disabled:opacity-40"
                  >
                    Pasar a perfil Legal
                  </button>
                  {actions.find((a) => a.lifestyle === 'LEGAL') && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const legalAct = actions.find(
                          (a) => a.lifestyle === 'LEGAL',
                        );
                        if (legalAct) void onAction(legalAct.id);
                      }}
                      className="flex-1 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold hover:border-amber-500/40"
                    >
                      Hacer encargo limpio
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
