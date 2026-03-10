"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

export type RadiantMode = "instrument" | "phase";

// Vetor de observáveis pentadimensional completo
export type StateVector = {
  oh: number;   // Homologia - pressão estrutural
  phi: number;  // Memória - persistência temporal
  eta: number;  // Rigidez - resistência à perturbação
  xi: number;   // Diversidade - entropia de caminhos
  def: number;  // Déficit - divergência estado-fase
};

// Tipo legado para compatibilidade
export type RadiantStatePoint = {
  t: string;
  Oh: number;
  phi: number;
  eta: number;
  xi?: number;  // Opcional para compatibilidade
  def?: number; // Opcional para compatibilidade
};

// Ponto completo no formato Radiante v1
export type RadiantPoint = {
  t: number | string;
  state: StateVector;
  phase?: {
    dphi: number;
    doh: number;
    deta: number;
    dxi?: number;
    ddef?: number;
  };
  regime?: {
    label: "nagare" | "utsuroi" | "katashi";
    score: number;
  };
  signals?: {
    def?: number;
    calm?: number;
    lam?: number;
    turb?: number;
  };
  events?: Array<{
    type: string;
    label: string;
    severity?: number;
  }>;
};

// Eixos de visualização (projeção 5D→3D)
export type ProjectionAxes = {
  x: keyof StateVector;
  y: keyof StateVector;
  z: keyof StateVector;
};

export type RadiantSceneProps = {
  data: RadiantStatePoint[];
  mode: RadiantMode;
  timeIndex: number;
  calm: number; // 0..1
  showFlow: boolean;
  showParticles: boolean;
};

type Vec3 = [number, number, number];

type AxisStats = {
  min: number;
  max: number;
};

type FlowField = {
  positions: Vec3[];
  velocities: Vec3[];
  velocitiesSmooth: Vec3[];
  laminarity: number[];
  turbulence: number[];
};

const GEOID_RADIUS = 1.9;
const PARTICLE_COUNT = 220;

function normalizeScalar(value: number, stats: AxisStats): number {
  if (stats.max === stats.min) return 0;
  return (2 * (value - stats.min)) / (stats.max - stats.min) - 1;
}

function subtractVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function addVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scaleVec(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function lengthVec(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function normalizeVec(a: Vec3): Vec3 {
  const len = lengthVec(a);
  if (len === 0) return [0, 0, 0];
  return [a[0] / len, a[1] / len, a[2] / len];
}

function dotVec(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function lerpScalar(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

function lerpVec(a: Vec3, b: Vec3, alpha: number): Vec3 {
  return [
    lerpScalar(a[0], b[0], alpha),
    lerpScalar(a[1], b[1], alpha),
    lerpScalar(a[2], b[2], alpha)
  ];
}

/**
 * Constrói posições 3D a partir de dados pentadimensionais
 * Usa sistema de projeção configurável
 */
function buildBasePositions(
  data: RadiantStatePoint[],
  mode: RadiantMode,
  projection: ProjectionAxes = STANDARD_PROJECTIONS.instrument
): Vec3[] {
  if (data.length === 0) return [];

  const rawPositions: Vec3[] = [];
  const states: StateVector[] = [];

  // Converter para StateVector completo
  for (let i = 0; i < data.length; i += 1) {
    const point = data[i];
    const prev = i > 0 ? data[i - 1] : undefined;
    const state = toStateVector(point, prev);
    states.push(state);
  }

  // Projetar para 3D
  for (let i = 0; i < states.length; i += 1) {
    const state = states[i];
    const prevState = i > 0 ? states[i - 1] : undefined;
    const vec3 = projectToVec3(state, projection, mode, prevState);
    rawPositions.push(vec3);
  }

  // Normalizar para cubo [-1, 1]³
  const xs = rawPositions.map((p) => p[0]);
  const ys = rawPositions.map((p) => p[1]);
  const zs = rawPositions.map((p) => p[2]);

  const statsX: AxisStats = { min: Math.min(...xs), max: Math.max(...xs) };
  const statsY: AxisStats = { min: Math.min(...ys), max: Math.max(...ys) };
  const statsZ: AxisStats = { min: Math.min(...zs), max: Math.max(...zs) };

  return rawPositions.map((p) => [
    normalizeScalar(p[0], statsX),
    normalizeScalar(p[1], statsY),
    normalizeScalar(p[2], statsZ)
  ]);
}

function movingAverage(series: Vec3[], radius: number): Vec3[] {
  const n = series.length;
  if (n === 0) return [];

  const result: Vec3[] = new Array(n);

  for (let i = 0; i < n; i += 1) {
    let sum: Vec3 = [0, 0, 0];
    let count = 0;
    const start = Math.max(0, i - radius);
    const end = Math.min(n - 1, i + radius);

    for (let k = start; k <= end; k += 1) {
      sum = addVec(sum, series[k]);
      count += 1;
    }

    result[i] = scaleVec(sum, 1 / Math.max(count, 1));
  }

  return result;
}

function smoothSeries(series: Vec3[], calm: number, radius = 3): Vec3[] {
  if (series.length === 0 || calm <= 0) return series;
  const averaged = movingAverage(series, radius);
  return series.map((v, i) => lerpVec(v, averaged[i], calm));
}

function buildVelocities(positions: Vec3[]): Vec3[] {
  const n = positions.length;
  if (n === 0) return [];
  const velocities: Vec3[] = new Array(n);

  for (let i = 0; i < n; i += 1) {
    const current = positions[i];
    const next = positions[Math.min(i + 1, n - 1)];
    velocities[i] = subtractVec(next, current);
  }

  return velocities;
}

function computeLaminarity(velocities: Vec3[]): {
  laminarity: number[];
  turbulence: number[];
} {
  const n = velocities.length;
  if (n === 0) return { laminarity: [], turbulence: [] };

  const dirs = velocities.map((v) => normalizeVec(v));
  const laminarity: number[] = new Array(n);
  const turbulence: number[] = new Array(n);
  const windowRadius = 4;

  for (let i = 0; i < n; i += 1) {
    const ref = dirs[i];
    if (lengthVec(ref) === 0) {
      laminarity[i] = 1;
      turbulence[i] = 0;
      continue;
    }

    let acc = 0;
    let count = 0;
    const start = Math.max(0, i - windowRadius);
    const end = Math.min(n - 1, i + windowRadius);

    for (let k = start; k <= end; k += 1) {
      const dot = dotVec(ref, dirs[k]);
      acc += dot;
      count += 1;
    }

    const avgDot = acc / Math.max(count, 1);
    const L = Math.max(0, Math.min(1, (avgDot + 1) / 2));
    laminarity[i] = L;
    turbulence[i] = 1 - L;
  }

  return { laminarity, turbulence };
}

function computeFlowField(
  data: RadiantStatePoint[],
  mode: RadiantMode,
  calm: number
): FlowField {
  const basePositions = buildBasePositions(data, mode);

  if (basePositions.length === 0) {
    return {
      positions: [],
      velocities: [],
      velocitiesSmooth: [],
      laminarity: [],
      turbulence: []
    };
  }

  const positionsSmoothed = smoothSeries(basePositions, calm, 3);
  const velocitiesRaw = buildVelocities(positionsSmoothed);
  const velocitiesSmooth = smoothSeries(velocitiesRaw, calm, 2);
  const { laminarity, turbulence } = computeLaminarity(velocitiesSmooth);

  return {
    positions: positionsSmoothed,
    velocities: velocitiesRaw,
    velocitiesSmooth,
    laminarity,
    turbulence
  };
}

export function computeFlowMetrics(
  data: RadiantStatePoint[],
  mode: RadiantMode,
  calm: number
): { laminarity: number[]; turbulence: number[] } {
  const { laminarity, turbulence } = computeFlowField(data, mode, calm);
  return { laminarity, turbulence };
}

// ============================================================================
// CLASSIFICAÇÃO FORMAL DE REGIMES (Seção 4.2 do paper)
// ============================================================================

type RegimeLabel = "nagare" | "utsuroi" | "katashi";

interface RegimeClassification {
  label: RegimeLabel;
  score: number;
  color: string;
}

// Thresholds baseados no paper (Seção 2.1)
const REGIME_THRESHOLDS = {
  xi_high: 0.7,    // Ξ alto para Nagare
  xi_low: 0.3,     // Ξ baixo para Katashi
  eta_low: 0.3,    // η baixo para Nagare
  eta_high: 0.7,   // η alto para Katashi
  phi_high: 0.6,   // Φ alto para Katashi
  def_high: 0.5,   // DEF alto indica pré-PNR
  oh_critical: 1.0 // Oh crítico
};

/**
 * Classifica regime estrutural usando geometria pentadimensional
 * Implementa lógica formal da Seção 4.2 do paper
 */
function classifyRegime(state: Partial<StateVector>): RegimeClassification {
  const { oh = 0, phi = 0, eta = 0, xi = 0.5, def = 0 } = state;
  
  // NAGARE (流れ): Fluxo adaptativo
  // Critérios: Ξ alto, η baixo, DEF baixo
  const nagareScore = 
    (xi > REGIME_THRESHOLDS.xi_high ? 0.4 : 0) +
    (eta < REGIME_THRESHOLDS.eta_low ? 0.3 : 0) +
    (def < REGIME_THRESHOLDS.def_high ? 0.3 : 0);
  
  // KATASHI (硬し): Cristalização rígida
  // Critérios: η alto, Φ alto, Ξ baixo
  const katashiScore =
    (eta > REGIME_THRESHOLDS.eta_high ? 0.35 : 0) +
    (phi > REGIME_THRESHOLDS.phi_high ? 0.35 : 0) +
    (xi < REGIME_THRESHOLDS.xi_low ? 0.3 : 0);
  
  // UTSUROI (移ろい): Estado transicional
  // Critérios: entre Nagare e Katashi, ou pré-PNR
  const utsuriScore = 1 - Math.abs(nagareScore - katashiScore);
  
  // Boost para Utsuroi se em zona de transição crítica
  const inTransition = 
    (oh > 0.95 && oh < 1.05) ||
    (eta > REGIME_THRESHOLDS.eta_low && eta < REGIME_THRESHOLDS.eta_high);
  const utsuriAdjusted = utsuriScore + (inTransition ? 0.2 : 0);
  
  // Determinar regime dominante
  const scores = {
    nagare: nagareScore,
    utsuroi: utsuriAdjusted,
    katashi: katashiScore
  };
  
  const label = Object.entries(scores).reduce((a, b) => 
    scores[a[0] as RegimeLabel] > scores[b[0] as RegimeLabel] ? a : b
  )[0] as RegimeLabel;
  
  const score = scores[label];
  
  // Cores por regime
  const colors = {
    nagare: "#22c55e",   // verde
    utsuroi: "#eab308",  // amarelo
    katashi: "#ef4444"   // vermelho
  };
  
  return {
    label,
    score,
    color: colors[label]
  };
}

// Função legado para compatibilidade (usa apenas Oh)
function colorForOh(Oh: number): string {
  if (Oh < 0.95) return "#22c55e"; // verde - Nagare
  if (Oh < 1.0) return "#eab308";  // amarelo - Utsuroi
  return "#ef4444";                 // vermelho - Katashi
}

// ============================================================================
// CONVERSÃO E NORMALIZAÇÃO DE DADOS
// ============================================================================

/**
 * Converte RadiantStatePoint legado para StateVector completo
 * Estima Xi e DEF quando ausentes
 */
function toStateVector(point: RadiantStatePoint, prev?: RadiantStatePoint): StateVector {
  // Estimar Xi (diversidade) se ausente
  // Heurística: Xi inversamente proporcional a η
  const xi = point.xi ?? Math.max(0, 1 - point.eta);
  
  // Estimar DEF (déficit) se ausente
  // Heurística: DEF cresce com Oh acima do limiar e η alto
  const defEstimated = point.def ?? 
    Math.max(0, (point.Oh - 0.9) * point.eta);
  
  return {
    oh: point.Oh,
    phi: point.phi,
    eta: point.eta,
    xi: xi,
    def: Math.min(1, defEstimated) // clamp [0,1]
  };
}

/**
 * Projeções padrão 5D→3D
 */
const STANDARD_PROJECTIONS: Record<string, ProjectionAxes> = {
  instrument: { x: "oh", y: "phi", z: "eta" },
  phase: { x: "oh", y: "phi", z: "eta" }, // Δphi será calculado
  diversity: { x: "oh", y: "xi", z: "eta" },
  deficit: { x: "oh", y: "def", z: "eta" },
  complete: { x: "phi", y: "xi", z: "def" } // visualização alternativa
};

/**
 * Extrai coordenadas 3D de StateVector usando projeção
 */
function projectToVec3(
  state: StateVector,
  projection: ProjectionAxes,
  mode: RadiantMode,
  prevState?: StateVector
): Vec3 {
  let x = state[projection.x];
  let y = state[projection.y];
  let z = state[projection.z];
  
  // Modo Fase: calcular derivada temporal de Y
  if (mode === "phase" && prevState && projection.y === "phi") {
    const delta = Math.max(0, state.phi - prevState.phi);
    y = delta;
  }
  
  return [x, y, z];
}

function PointsAndTrajectory({
  data,
  positions,
  mode,
  timeIndex
}: {
  data: RadiantStatePoint[];
  positions: Vec3[];
  mode: RadiantMode;
  timeIndex: number;
}) {
  if (positions.length === 0) return null;

  const clampedIndex = Math.max(
    0,
    Math.min(positions.length - 1, timeIndex || 0)
  );

  return (
    <group>
      {/* Linha base do caminho */}
      <mesh>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length}
            array={new Float32Array(positions.flat())}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#4a5058" linewidth={1} opacity={0.6} transparent />
      </mesh>

      {/* Pontos */}
      {positions.map((pos, index) => {
        const point = data[index];
        const prevPoint = index > 0 ? data[index - 1] : undefined;
        
        // Converter para StateVector e classificar regime
        const state = toStateVector(point, prevPoint);
        const regime = classifyRegime(state);
        
        const isActive = index === clampedIndex;
        const scale = isActive ? 1.8 : 1;

        return (
          <mesh key={point.t} position={pos} scale={scale}>
            <sphereGeometry args={[0.025, 16, 16]} />
            <meshStandardMaterial
              color={regime.color}
              emissive={regime.color}
              emissiveIntensity={isActive ? 0.7 : 0.35}
            />
          </mesh>
        );
      })}
    </group>
  );
}

const GEOID_PARTICLE_COUNT = 800;

function GeoidParticles() {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const dummy = useRef(new THREE.Object3D());

  // Partículas distribuídas em linhas de latitude/longitude
  const particles = useRef<{
    theta: number;      // ângulo horizontal
    phi: number;        // ângulo vertical
    speed: number;      // velocidade de movimento
    lineType: 'lat' | 'lon';  // tipo de linha
    offset: number;     // offset na linha
  }[]>([]);

  useEffect(() => {
    const newParticles: typeof particles.current = [];

    // Linhas de latitude (horizontais)
    const latLines = 8;
    const particlesPerLatLine = 50;
    for (let lat = 0; lat < latLines; lat++) {
      const phi = (lat / latLines) * Math.PI; // 0 a PI
      for (let i = 0; i < particlesPerLatLine; i++) {
        newParticles.push({
          theta: (i / particlesPerLatLine) * Math.PI * 2,
          phi: phi,
          speed: 0.15 + Math.random() * 0.1,
          lineType: 'lat',
          offset: Math.random() * 0.02
        });
      }
    }

    // Linhas de longitude (verticais)
    const lonLines = 8;
    const particlesPerLonLine = 50;
    for (let lon = 0; lon < lonLines; lon++) {
      const theta = (lon / lonLines) * Math.PI * 2;
      for (let i = 0; i < particlesPerLonLine; i++) {
        newParticles.push({
          theta: theta,
          phi: (i / particlesPerLonLine) * Math.PI,
          speed: 0.12 + Math.random() * 0.08,
          lineType: 'lon',
          offset: Math.random() * 0.02
        });
      }
    }

    particles.current = newParticles;
  }, []);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || particles.current.length === 0) return;

    particles.current.forEach((p, index) => {
      // Movimento ao longo da linha
      if (p.lineType === 'lat') {
        p.theta += p.speed * delta;
        if (p.theta > Math.PI * 2) p.theta -= Math.PI * 2;
      } else {
        p.phi += p.speed * delta;
        if (p.phi > Math.PI) p.phi -= Math.PI;
      }

      // Converte coordenadas esféricas para cartesianas
      const r = GEOID_RADIUS + p.offset;
      const x = r * Math.sin(p.phi) * Math.cos(p.theta);
      const y = r * Math.cos(p.phi);
      const z = r * Math.sin(p.phi) * Math.sin(p.theta);

      const d = dummy.current;
      d.position.set(x, y, z);
      const scale = 0.012 + Math.sin(p.theta * 3 + p.phi * 2) * 0.004;
      d.scale.set(scale, scale, scale);
      d.updateMatrix();

      mesh.setMatrixAt(index, d.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined as any, undefined as any, GEOID_PARTICLE_COUNT]}
    >
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        color="#c9a227"
        emissive="#d4af37"
        emissiveIntensity={0.6}
        roughness={0.3}
        metalness={0.4}
      />
    </instancedMesh>
  );
}

function GeoidHelper() {
  return (
    <group>
      {/* Partículas douradas formando linhas esféricas */}
      <GeoidParticles />

      {/* Eixos principais sutis - tons de cinza */}
      <mesh>
        <cylinderGeometry args={[0.006, 0.006, GEOID_RADIUS * 2.3, 16]} />
        <meshBasicMaterial color="#4a4a4a" opacity={0.5} transparent />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.006, GEOID_RADIUS * 2.3, 16]} />
        <meshBasicMaterial color="#5a5a5a" opacity={0.5} transparent />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.006, 0.006, GEOID_RADIUS * 2.3, 16]} />
        <meshBasicMaterial color="#6a6a6a" opacity={0.5} transparent />
      </mesh>
    </group>
  );
}

function FlowRibbon({
  positions,
  visible
}: {
  positions: Vec3[];
  visible: boolean;
}) {
  const curve = useMemo(() => {
    if (positions.length < 2) return null;
    const pts = positions.map(
      (p) => new THREE.Vector3(p[0], p[1], p[2])
    );
    return new THREE.CatmullRomCurve3(pts);
  }, [positions]);

  if (!visible || !curve) return null;

  const segments = Math.max(positions.length * 4, 64);

  return (
    <mesh>
      <tubeGeometry args={[curve, segments, 0.03, 14, false]} />
      <meshStandardMaterial
        color="#0ea5e9"
        opacity={0.4}
        transparent
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
  );
}

// Gera vetor perpendicular a uma direção
function perpendicularVec(dir: Vec3, seed: number): Vec3 {
  const [dx, dy, dz] = dir;
  // Escolhe um vetor base que não seja paralelo
  let base: Vec3;
  if (Math.abs(dx) < 0.9) {
    base = [1, 0, 0];
  } else {
    base = [0, 1, 0];
  }
  // Cross product para obter perpendicular
  const cross: Vec3 = [
    dy * base[2] - dz * base[1],
    dz * base[0] - dx * base[2],
    dx * base[1] - dy * base[0]
  ];
  const len = lengthVec(cross);
  if (len === 0) return [0, 0, 0];

  // Rotaciona baseado no seed para variar a direção perpendicular
  const angle = seed * Math.PI * 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Segunda perpendicular (cross do cross com dir)
  const cross2: Vec3 = [
    dir[1] * cross[2] - dir[2] * cross[1],
    dir[2] * cross[0] - dir[0] * cross[2],
    dir[0] * cross[1] - dir[1] * cross[0]
  ];
  const len2 = lengthVec(cross2);

  const n1 = scaleVec(cross, 1 / len);
  const n2 = len2 > 0 ? scaleVec(cross2, 1 / len2) : n1;

  return addVec(scaleVec(n1, cos), scaleVec(n2, sin));
}

type FlowLinesProps = {
  positions: Vec3[];
  velocities: Vec3[];
  turbulence: number[];
  visible: boolean;
  lineCount?: number;
};

function FlowLines({
  positions,
  velocities,
  turbulence,
  visible,
  lineCount = 12
}: FlowLinesProps) {
  const lineGeometries = useMemo(() => {
    if (positions.length < 2) return [];

    const geometries: THREE.BufferGeometry[] = [];
    const baseSpread = 0.015; // Espaçamento base entre linhas
    const turbulenceMultiplier = 0.12; // Quanto turbulência aumenta o spread

    for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
      const seed = lineIdx / lineCount;
      const points: THREE.Vector3[] = [];

      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const vel = velocities[i] || [0, 0, 1];
        const turb = turbulence[i] || 0;

        // Direção normalizada do fluxo
        const dir = normalizeVec(vel);

        // Vetor perpendicular para offset
        const perp = perpendicularVec(dir, seed);

        // Offset varia: pequeno quando laminar, grande quando turbulento
        const lam = 1 - turb;
        const offsetMagnitude = baseSpread + turb * turbulenceMultiplier;

        // Distância do centro (algumas linhas mais próximas, outras mais longe)
        const radialDist = (lineIdx - lineCount / 2) / (lineCount / 2);
        const finalOffset = offsetMagnitude * radialDist;

        // Adiciona pequena ondulação baseada na posição
        const wave = Math.sin(i * 0.3 + seed * 10) * turb * 0.02;

        const offsetVec = scaleVec(perp, finalOffset + wave);
        const finalPos = addVec(pos, offsetVec);

        points.push(new THREE.Vector3(finalPos[0], finalPos[1], finalPos[2]));
      }

      // Cria curva suave
      if (points.length >= 2) {
        const curve = new THREE.CatmullRomCurve3(points);
        const curvePoints = curve.getPoints(positions.length * 3);
        const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
        geometries.push(geometry);
      }
    }

    return geometries;
  }, [positions, velocities, turbulence, lineCount]);

  if (!visible || lineGeometries.length === 0) return null;

  return (
    <group>
      {lineGeometries.map((geometry, idx) => {
        // Opacidade varia: linhas centrais mais opacas
        const centerDist = Math.abs(idx - lineCount / 2) / (lineCount / 2);
        const opacity = 0.7 - centerDist * 0.4;

        return (
          <line key={idx}>
            <primitive object={geometry} attach="geometry" />
            <lineBasicMaterial
              color="#3a3f45"
              opacity={opacity}
              transparent
              linewidth={1}
            />
          </line>
        );
      })}
    </group>
  );
}

type FlowParticlesProps = {
  positions: Vec3[];
  velocities: Vec3[];
  turbulence: number[];
  showParticles: boolean;
};

function sampleAlongField(
  positions: Vec3[],
  velocities: Vec3[],
  turbulence: number[],
  t: number
): { pos: Vec3; vel: Vec3; turb: number } {
  const maxIndex = positions.length - 1;
  if (maxIndex <= 0) {
    return { pos: [0, 0, 0], vel: [0, 0, 0], turb: 0 };
  }

  const clamped = Math.max(0, Math.min(maxIndex - 1, t));
  const i = Math.floor(clamped);
  const frac = clamped - i;

  const p0 = positions[i];
  const p1 = positions[Math.min(i + 1, maxIndex)];
  const v0 = velocities[i];
  const v1 = velocities[Math.min(i + 1, maxIndex)];
  const t0 = turbulence[i] ?? 0;
  const t1 = turbulence[Math.min(i + 1, maxIndex)] ?? t0;

  return {
    pos: lerpVec(p0, p1, frac),
    vel: lerpVec(v0, v1, frac),
    turb: lerpScalar(t0, t1, frac)
  };
}

function FlowParticles({
  positions,
  velocities,
  turbulence,
  showParticles
}: FlowParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const dummy = useRef(new THREE.Object3D());
  const particles = useRef<
    { t: number; speed: number; jitterSeed: number }[]
  >([]);

  useEffect(() => {
    if (positions.length < 2) return;
    const maxIndex = positions.length - 1;
    particles.current = new Array(PARTICLE_COUNT)
      .fill(null)
      .map(() => ({
        t: Math.random() * maxIndex,
        speed: 0.2 + Math.random() * 0.6,
        jitterSeed: Math.random() * 1000
      }));
  }, [positions.length]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || positions.length < 2 || particles.current.length === 0) {
      return;
    }

    const maxIndex = positions.length - 1;
    const jitterBase = 0.08;

    particles.current.forEach((p, index) => {
      p.t += p.speed * delta * maxIndex;
      if (p.t >= maxIndex) {
        p.t -= maxIndex;
      }

      const { pos, vel, turb } = sampleAlongField(
        positions,
        velocities,
        turbulence,
        p.t
      );

      const dir = normalizeVec(vel);
      const drift = scaleVec(dir, 0.1 + turb * 0.2);

      const jitterStrength = jitterBase * (0.2 + turb * 1.2);
      const jitter: Vec3 = [
        (Math.random() - 0.5) * 2 * jitterStrength,
        (Math.random() - 0.5) * 2 * jitterStrength,
        (Math.random() - 0.5) * 2 * jitterStrength
      ];

      const finalPos = addVec(addVec(pos, drift), jitter);

      const d = dummy.current;
      d.position.set(finalPos[0], finalPos[1], finalPos[2]);
      const scale = 0.045 + turb * 0.03;
      d.scale.set(scale, scale, scale);
      d.updateMatrix();

      mesh.setMatrixAt(index, d.matrix);
    });

    if (meshRef.current) {
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  if (!showParticles || positions.length < 2) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined as any, undefined as any, PARTICLE_COUNT]}
    >
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color="#c9a227"
        emissive="#d4af37"
        emissiveIntensity={0.5}
        roughness={0.3}
        metalness={0.3}
      />
    </instancedMesh>
  );
}

export default function RadiantScene({
  data,
  mode,
  timeIndex,
  calm,
  showFlow,
  showParticles
}: RadiantSceneProps) {
  const flowField = useMemo(
    () => computeFlowField(data, mode, calm),
    [data, mode, calm]
  );

  const { positions, velocitiesSmooth, turbulence } = flowField;

  return (
    <Canvas
      camera={{
        position: [GEOID_RADIUS * 2, GEOID_RADIUS * 2, GEOID_RADIUS * 2],
        fov: 45
      }}
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        inset: 0,
        display: "block"
      }}
    >
      <color attach="background" args={["#A0A5AB"]} />

      {/* Luz ambiente suave */}
      <ambientLight intensity={0.55} />
      {/* Luzes pontuais para relevo do geóide e fluxo */}
      <pointLight position={[5, 5, 5]} intensity={1.2} />
      <pointLight position={[-5, -5, -5]} intensity={0.5} color="#38bdf8" />

      <GeoidHelper />

      <PointsAndTrajectory
        data={data}
        positions={positions}
        mode={mode}
        timeIndex={timeIndex}
      />

      <FlowRibbon positions={positions} visible={false} />

      <FlowLines
        positions={positions}
        velocities={velocitiesSmooth}
        turbulence={turbulence}
        visible={showFlow}
        lineCount={16}
      />

      <FlowParticles
        positions={positions}
        velocities={velocitiesSmooth}
        turbulence={turbulence}
        showParticles={showParticles && showFlow}
      />

      <OrbitControls enableDamping dampingFactor={0.15} />
    </Canvas>
  );
}

