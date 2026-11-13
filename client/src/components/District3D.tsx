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

function createAvatarRig(bodyColor: number, accentColor: number): AvatarRig {
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

  return {
    group,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    walkPhase: 0,
  };
}

function animateAvatarRig(
  rig: AvatarRig,
  isMoving: boolean,
  isSprinting: boolean,
  dt: number,
) {
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

  const [webglError, setWebglError] = useState<string | null>(null);
  const [nearbyPoi, setNearbyPoi] = useState<DistrictPoi | null>(null);
  const [activePoi, setActivePoi] = useState<DistrictPoi | null>(null);
  const [remoteCount, setRemoteCount] = useState(0);
  const [sprintTouch, setSprintTouch] = useState(false);

  // Input refs (no React re-render per key press)
  const keysRef = useRef<Record<string, boolean>>({});
  const touchDirRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const sprintTouchRef = useRef(false);
  const nearbyPoiRef = useRef<DistrictPoi | null>(null);
  const activePoiRef = useRef<DistrictPoi | null>(null);
  const emitMoveRef = useRef(emitMove);
  const locationIdRef = useRef(player.locationId);
  const localIdRef = useRef(localPlayerId || player.id || '');

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

  const toggleSprintTouch = useCallback(() => {
    setSprintTouch((prev) => {
      const next = !prev;
      sprintTouchRef.current = next;
      return next;
    });
  }, []);

  const handleInteract = useCallback(() => {
    if (nearbyPoiRef.current) {
      setActivePoi(nearbyPoiRef.current);
    }
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

    // Local Player Avatar
    const localRig = createAvatarRig(0x27272a, theme.accent);
    localRig.group.position.set(0, 0, 2);
    scene.add(localRig.group);

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
      keysRef.current[k] = true;
      if (k === 'e' && nearbyPoiRef.current) {
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

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

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

      // 1. Local movement
      const keys = keysRef.current;
      let moveX = touchDirRef.current.x;
      let moveZ = touchDirRef.current.z;

      if (keys['w'] || keys['arrowup']) moveZ -= 1;
      if (keys['s'] || keys['arrowdown']) moveZ += 1;
      if (keys['a'] || keys['arrowleft']) moveX -= 1;
      if (keys['d'] || keys['arrowright']) moveX += 1;

      const mag = Math.hypot(moveX, moveZ);
      const isMoving = mag > 0.05;
      const isSprinting = Boolean(keys['shift'] || sprintTouchRef.current);
      const speed = isSprinting ? 12.5 : 7.2;

      if (isMoving) {
        const nx = moveX / mag;
        const nz = moveZ / mag;
        const stepX = nx * speed * dt;
        const stepZ = nz * speed * dt;

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

      // 2. Emit player:move throttled (~16 Hz)
      if ((isMoving && now - lastEmitTime > 60) || (!isMoving && wasMoving)) {
        lastEmitTime = now;
        emitMoveRef.current({
          x: Number(localRig.group.position.x.toFixed(2)),
          y: 0,
          z: Number(localRig.group.position.z.toFixed(2)),
          rotationY: Number(localRig.group.rotation.y.toFixed(3)),
          speed: isMoving ? speed : 0,
          isMoving,
          locationId: locationIdRef.current,
        });
      }
      wasMoving = isMoving;

      // 3. Smooth 3rd-person follow camera
      desiredCamPos.set(
        localRig.group.position.x,
        localRig.group.position.y + 6.8,
        localRig.group.position.z + 10.5,
      );
      camera.position.lerp(desiredCamPos, Math.min(1, dt * 6));
      camTarget.set(
        localRig.group.position.x,
        localRig.group.position.y + 1.4,
        localRig.group.position.z,
      );
      lookAtPos.lerp(camTarget, Math.min(1, dt * 10));
      camera.lookAt(lookAtPos);

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
        let entry = remoteAvatars.get(id);
        if (!entry) {
          const rig = createAvatarRig(0x1e293b, 0x38bdf8);
          rig.group.position.set(remote.x || 0, remote.y || 0, remote.z || 0);
          rig.group.rotation.y = remote.rotationY || 0;
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
            targetRotY: remote.rotationY || 0,
            isMoving: Boolean(remote.isMoving),
            displayName: remote.displayName,
            labelSprite,
          };
          remoteAvatars.set(id, entry);
        } else {
          entry.targetPos.set(remote.x || 0, remote.y || 0, remote.z || 0);
          entry.targetRotY = remote.rotationY || 0;
          entry.isMoving = Boolean(remote.isMoving);
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

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      windowTex.dispose();
      renderer.dispose();
    };
  }, [vibe, remotePlayersRef]);

  const heatStars = Math.min(5, Math.ceil((player.heat || 0) / 20));

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
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 max-w-[270px] pointer-events-auto">
        <div className="rounded-xl bg-zinc-950/80 backdrop-blur-md border border-zinc-800/90 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold">
              {zoneName}
            </span>
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

      {/* Mobile Touch Controls (Bottom-Left D-Pad & Bottom-Right Sprint/Interact) */}
      <div className="absolute bottom-3 left-3 z-10 md:hidden grid grid-cols-3 gap-1 w-28 h-28">
        <div />
        <button
          type="button"
          onTouchStart={() => {
            touchDirRef.current.z = -1;
          }}
          onTouchEnd={() => {
            touchDirRef.current.z = 0;
          }}
          onMouseDown={() => {
            touchDirRef.current.z = -1;
          }}
          onMouseUp={() => {
            touchDirRef.current.z = 0;
          }}
          className="rounded-lg bg-zinc-900/80 border border-zinc-700 text-zinc-200 text-xs font-bold active:bg-amber-500/30"
        >
          ▲
        </button>
        <div />
        <button
          type="button"
          onTouchStart={() => {
            touchDirRef.current.x = -1;
          }}
          onTouchEnd={() => {
            touchDirRef.current.x = 0;
          }}
          onMouseDown={() => {
            touchDirRef.current.x = -1;
          }}
          onMouseUp={() => {
            touchDirRef.current.x = 0;
          }}
          className="rounded-lg bg-zinc-900/80 border border-zinc-700 text-zinc-200 text-xs font-bold active:bg-amber-500/30"
        >
          ◀
        </button>
        <div />
        <button
          type="button"
          onTouchStart={() => {
            touchDirRef.current.x = 1;
          }}
          onTouchEnd={() => {
            touchDirRef.current.x = 0;
          }}
          onMouseDown={() => {
            touchDirRef.current.x = 1;
          }}
          onMouseUp={() => {
            touchDirRef.current.x = 0;
          }}
          className="rounded-lg bg-zinc-900/80 border border-zinc-700 text-zinc-200 text-xs font-bold active:bg-amber-500/30"
        >
          ▶
        </button>
        <div />
        <button
          type="button"
          onTouchStart={() => {
            touchDirRef.current.z = 1;
          }}
          onTouchEnd={() => {
            touchDirRef.current.z = 0;
          }}
          onMouseDown={() => {
            touchDirRef.current.z = 1;
          }}
          onMouseUp={() => {
            touchDirRef.current.z = 0;
          }}
          className="rounded-lg bg-zinc-900/80 border border-zinc-700 text-zinc-200 text-xs font-bold active:bg-amber-500/30"
        >
          ▼
        </button>
        <div />
      </div>

      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleSprintTouch}
          className={`md:hidden px-3 py-2 rounded-xl text-xs font-bold border ${
            sprintTouch
              ? 'bg-amber-500/25 border-amber-500 text-amber-300'
              : 'bg-zinc-900/80 border-zinc-700 text-zinc-300'
          }`}
        >
          Correr
        </button>
        {nearbyPoi && (
          <button
            type="button"
            onClick={handleInteract}
            className="md:hidden px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 text-zinc-950"
          >
            [E] Usar
          </button>
        )}
      </div>

      {/* Desktop Controls Hint */}
      <div className="hidden md:flex absolute bottom-3 left-3 z-10 items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950/75 border border-zinc-800 text-[11px] text-zinc-400 backdrop-blur-md">
        <span>WASD / Flechas: Mover</span>
        <span>·</span>
        <span>Shift: Correr</span>
        <span>·</span>
        <span>E: Interactuar POI</span>
      </div>

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
