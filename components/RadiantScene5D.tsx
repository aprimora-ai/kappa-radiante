"use client";

import { useMemo, useRef, useEffect, useLayoutEffect, forwardRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import {
  StructuralTimePoint,
  ProjectionConfig,
  project5Dto3D,
  getRegimeColor,
  detectPrePNR,
  PRESET_PROJECTIONS,
  StateVector5D,
} from "../lib/pentadimensional";
import {
  GravitationalConfig,
  GravitationalBundle,
  DEFAULT_GRAVITATIONAL_CONFIG,
  analyzeTrajectoryGravitational,
  computeGravitationalPenalty,
  createGravitationalBundle,
} from "../lib/gravitational";

// Perturbações definidas pelo usuário para exploração de futuros
export type UserPerturbation = {
  oh: { enabled: boolean; delta: number };
  phi: { enabled: boolean; delta: number };
  eta: { enabled: boolean; delta: number };
  xi: { enabled: boolean; delta: number };
};

export type RadiantSceneProps = {
  data: StructuralTimePoint[];
  projection: ProjectionConfig;
  timeIndex: number;
  calm: number; // 0..1
  showFlow: boolean;
  showParticles: boolean;
  showEvents: boolean;
  showFutures?: boolean; // Linhas de trajetórias futuras alternativas
  showCone?: boolean;    // Exibir o cone de incerteza volumétrico
  userPerturbation?: UserPerturbation; // Perturbação interativa do usuário
  showGeoid?: boolean; // Exibição do geóide
  onFlowProgress?: (progress: number) => void; // Callback de progresso da animação
};

type Vec3 = [number, number, number];

const GEOID_RADIUS = 1.9;
const PARTICLE_COUNT = 220;
const GEOID_PARTICLE_COUNT = 1200; // Mais partículas para o geóide

// ============================================================================
// FUNÇÕES DE PROJEÇÃO E NORMALIZAÇÃO
// ============================================================================

type AxisStats = {
  min: number;
  max: number;
};

function normalizeScalar(value: number, stats: AxisStats): number {
  if (stats.max === stats.min) return 0;
  return (2 * (value - stats.min)) / (stats.max - stats.min) - 1;
}

function buildPositions3D(
  data: StructuralTimePoint[],
  projection: ProjectionConfig
): Vec3[] {
  if (data.length === 0) return [];

  // Projetar 5D → 3D
  const raw3D = data.map((point) =>
    project5Dto3D(point.state, point.phase, projection)
  );

  // Normalizar para cubo [-1, 1]³
  const xs = raw3D.map((p) => p[0]);
  const ys = raw3D.map((p) => p[1]);
  const zs = raw3D.map((p) => p[2]);

  const statsX: AxisStats = { min: Math.min(...xs), max: Math.max(...xs) };
  const statsY: AxisStats = { min: Math.min(...ys), max: Math.max(...ys) };
  const statsZ: AxisStats = { min: Math.min(...zs), max: Math.max(...zs) };

  return raw3D.map((p) => [
    normalizeScalar(p[0], statsX),
    normalizeScalar(p[1], statsY),
    normalizeScalar(p[2], statsZ),
  ]);
}

// ============================================================================
// SUAVIZAÇÃO E VELOCIDADES
// ============================================================================

function addVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scaleVec(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function subtractVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
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
    lerpScalar(a[2], b[2], alpha),
  ];
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

// ============================================================================
// COMPONENTES 3D
// ============================================================================

function PointsAndTrajectory({
  data,
  positions,
  timeIndex,
  showEvents,
}: {
  data: StructuralTimePoint[];
  positions: Vec3[];
  timeIndex: number;
  showEvents: boolean;
}) {
  if (positions.length === 0) return null;

  const clampedIndex = Math.max(0, Math.min(positions.length - 1, timeIndex));
  
  // Detectar pré-PNR
  const isPrePNR = detectPrePNR(data, clampedIndex);

  return (
    <group>
      {/* Linha do caminho */}
      <mesh>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length}
            array={new Float32Array(positions.flat())}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#60a5fa" linewidth={1} />
      </mesh>

      {/* Pontos */}
      {positions.map((pos, index) => {
        const point = data[index];
        const regime = point.regime?.label ?? "utsuroi";
        const color = getRegimeColor(regime);
        const isActive = index === clampedIndex;
        const scale = isActive ? 1.8 : 1;

        return (
          <mesh key={index} position={pos} scale={scale}>
            <sphereGeometry args={[0.012, 12, 12]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={isActive ? 0.7 : 0.35}
            />
          </mesh>
        );
      })}
      
      {/* Alerta visual de pré-PNR */}
      {isPrePNR && (
        <mesh position={positions[clampedIndex]}>
          <sphereGeometry args={[0.15, 32, 32]} />
          <meshBasicMaterial
            color="#ff0000"
            transparent
            opacity={0.3}
            wireframe
          />
        </mesh>
      )}
    </group>
  );
}

// Partículas douradas formando o geóide
function GeoidParticles() {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const dummy = useRef(new THREE.Object3D());

  const particles = useRef<{
    theta: number;
    phi: number;
    speed: number;
    lineType: 'lat' | 'lon';
    offset: number;
  }[]>([]);

  useEffect(() => {
    const newParticles: typeof particles.current = [];

    // Linhas de latitude (horizontais) - mais densas
    const latLines = 12;
    const particlesPerLatLine = 60;
    for (let lat = 0; lat < latLines; lat++) {
      const phi = (lat / latLines) * Math.PI;
      for (let i = 0; i < particlesPerLatLine; i++) {
        newParticles.push({
          theta: (i / particlesPerLatLine) * Math.PI * 2 + Math.random() * 0.1,
          phi: phi + (Math.random() - 0.5) * 0.05,
          speed: 0.08 + Math.random() * 0.12,
          lineType: 'lat',
          offset: (Math.random() - 0.5) * 0.03
        });
      }
    }

    // Linhas de longitude (verticais)
    const lonLines = 10;
    const particlesPerLonLine = 60;
    for (let lon = 0; lon < lonLines; lon++) {
      const theta = (lon / lonLines) * Math.PI * 2;
      for (let i = 0; i < particlesPerLonLine; i++) {
        newParticles.push({
          theta: theta + (Math.random() - 0.5) * 0.05,
          phi: (i / particlesPerLonLine) * Math.PI,
          speed: 0.06 + Math.random() * 0.1,
          lineType: 'lon',
          offset: (Math.random() - 0.5) * 0.03
        });
      }
    }

    particles.current = newParticles;
  }, []);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || particles.current.length === 0) return;

    particles.current.forEach((p, index) => {
      if (p.lineType === 'lat') {
        p.theta += p.speed * delta;
        if (p.theta > Math.PI * 2) p.theta -= Math.PI * 2;
      } else {
        p.phi += p.speed * delta;
        if (p.phi > Math.PI) p.phi -= Math.PI;
      }

      const r = GEOID_RADIUS + p.offset;
      const x = r * Math.sin(p.phi) * Math.cos(p.theta);
      const y = r * Math.cos(p.phi);
      const z = r * Math.sin(p.phi) * Math.sin(p.theta);

      const d = dummy.current;
      d.position.set(x, y, z);
      // Tamanho varia sutilmente (-68% do original)
      const scale = 0.0048 + Math.sin(p.theta * 2 + p.phi) * 0.0016;
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
        emissiveIntensity={0.7}
        roughness={0.25}
        metalness={0.5}
      />
    </instancedMesh>
  );
}

// Eixos com labels e planos sutis
function AxesHelper() {
  const axisLength = GEOID_RADIUS * 1.15;
  const planeSize = GEOID_RADIUS * 2.2;

  return (
    <group>
      {/* Plano XY (sutil, horizontal) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[planeSize, planeSize]} />
        <meshBasicMaterial
          color="#3b82f6"
          transparent
          opacity={0.04}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Grid sutil no plano XY */}
      <gridHelper
        args={[planeSize, 12, "#3b82f6", "#1e3a5f"]}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
      />

      {/* Plano XZ (vertical frontal, ainda mais sutil) */}
      <mesh rotation={[0, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[planeSize, planeSize]} />
        <meshBasicMaterial
          color="#8b5cf6"
          transparent
          opacity={0.025}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Eixo Y (vertical) - linha */}
      <mesh>
        <cylinderGeometry args={[0.008, 0.008, axisLength * 2, 16]} />
        <meshBasicMaterial color="#22c55e" opacity={0.7} transparent />
      </mesh>

      {/* Eixo X (horizontal) - linha */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, axisLength * 2, 16]} />
        <meshBasicMaterial color="#ef4444" opacity={0.7} transparent />
      </mesh>

      {/* Eixo Z (profundidade) - linha */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, axisLength * 2, 16]} />
        <meshBasicMaterial color="#3b82f6" opacity={0.7} transparent />
      </mesh>

      {/* Setas nas pontas dos eixos */}
      {/* Y+ */}
      <mesh position={[0, axisLength, 0]}>
        <coneGeometry args={[0.03, 0.08, 8]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
      {/* X+ */}
      <mesh position={[axisLength, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.03, 0.08, 8]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      {/* Z+ */}
      <mesh position={[0, 0, axisLength]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.03, 0.08, 8]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>

      {/* Labels dos eixos */}
      <Text
        position={[axisLength + 0.15, 0, 0]}
        fontSize={0.15}
        color="#ef4444"
        anchorX="left"
        anchorY="middle"
      >
        X
      </Text>
      <Text
        position={[0, axisLength + 0.15, 0]}
        fontSize={0.15}
        color="#22c55e"
        anchorX="center"
        anchorY="bottom"
      >
        Y
      </Text>
      <Text
        position={[0, 0, axisLength + 0.15]}
        fontSize={0.15}
        color="#3b82f6"
        anchorX="center"
        anchorY="middle"
      >
        Z
      </Text>

      {/* Labels negativos (menores e mais sutis) */}
      <Text
        position={[-axisLength - 0.1, 0, 0]}
        fontSize={0.1}
        color="#ef4444"
        anchorX="right"
        anchorY="middle"
        fillOpacity={0.5}
      >
        -X
      </Text>
      <Text
        position={[0, -axisLength - 0.1, 0]}
        fontSize={0.1}
        color="#22c55e"
        anchorX="center"
        anchorY="top"
        fillOpacity={0.5}
      >
        -Y
      </Text>
      <Text
        position={[0, 0, -axisLength - 0.1]}
        fontSize={0.1}
        color="#3b82f6"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0.5}
      >
        -Z
      </Text>
    </group>
  );
}

function GeoidHelper({ showParticles = true }: { showParticles?: boolean }) {
  return (
    <group>
      {/* Partículas douradas formando linhas esféricas */}
      {showParticles && <GeoidParticles />}

      {/* Eixos com labels e planos */}
      <AxesHelper />
    </group>
  );
}

// Gera vetor perpendicular a uma direção
function perpendicularVec(dir: Vec3, seed: number): Vec3 {
  const [dx, dy, dz] = dir;
  let base: Vec3 = Math.abs(dx) < 0.9 ? [1, 0, 0] : [0, 1, 0];

  // Cross product
  const cross: Vec3 = [
    dy * base[2] - dz * base[1],
    dz * base[0] - dx * base[2],
    dx * base[1] - dy * base[0]
  ];
  const len = lengthVec(cross);
  if (len === 0) return [0, 0, 0];

  const angle = seed * Math.PI * 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

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

// Linhas de fluxo ondulantes que divergem com turbulência
function FlowWaveLines({
  positions,
  velocities,
  turbulence,
  visible,
  lineCount = 16,
  onProgress,
}: {
  positions: Vec3[];
  velocities: Vec3[];
  turbulence: number[];
  visible: boolean;
  lineCount?: number;
  onProgress?: (p: number) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);

  const lineGeometries = useMemo(() => {
    if (positions.length < 2) return [];

    const geometries: THREE.BufferGeometry[] = [];
    const baseSpread = 0.02;
    const turbulenceMultiplier = 0.15;

    for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
      const seed = lineIdx / lineCount;
      const points: THREE.Vector3[] = [];

      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const vel = velocities[i] || [0, 0, 1];
        const turb = turbulence[i] || 0;

        const dir = normalizeVec(vel);
        const perp = perpendicularVec(dir, seed);

        // Laminar = linhas juntas, Turbulento = linhas divergem
        const offsetMagnitude = baseSpread + turb * turbulenceMultiplier;
        const radialDist = (lineIdx - lineCount / 2) / (lineCount / 2);
        const finalOffset = offsetMagnitude * radialDist;

        // Ondulação sutil
        const wave = Math.sin(i * 0.4 + seed * 12) * turb * 0.025;

        const offsetVec = scaleVec(perp, finalOffset + wave);
        const finalPos = addVec(pos, offsetVec);

        points.push(new THREE.Vector3(finalPos[0], finalPos[1], finalPos[2]));
      }

      if (points.length >= 2) {
        const curve = new THREE.CatmullRomCurve3(points);
        const curvePoints = curve.getPoints(positions.length * 3);
        const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
        geometry.setDrawRange(0, 0); // Inicia explicitamente vazia
        geometries.push(geometry);
      }
    }

    return geometries;
  }, [positions, velocities, turbulence, lineCount]);

  // Prepara as geometrias (zera o desenho) antes do paint
  useLayoutEffect(() => {
    progressRef.current = 0;
    lineGeometries.forEach((geo) => {
      geo.setDrawRange(0, 0);
    });
  }, [lineGeometries, visible]);

  // Animação de desenho progressivo
  useFrame((_, delta) => {
    if (!visible) return;

    // Velocidade do desenho (0.008 é extremamente lento)
    const drawSpeed = 0.008; 
    
    if (progressRef.current < 1) {
      progressRef.current = Math.min(1, progressRef.current + delta * drawSpeed);
      
      // Notifica o pai sobre o progresso
      if (onProgress) {
        onProgress(progressRef.current);
      }
      
      lineGeometries.forEach((geo) => {
        const count = geo.attributes.position.count;
        const drawCount = Math.floor(count * progressRef.current);
        geo.setDrawRange(0, drawCount);
      });
    }
  });

  return (
    <group ref={groupRef}>
      {lineGeometries.map((geometry, idx) => {
        const centerDist = Math.abs(idx - lineCount / 2) / (lineCount / 2);
        const opacity = 0.95 - centerDist * 0.3; // Mais visível

        return (
          <line key={idx}>
            <primitive object={geometry} attach="geometry" />
            <lineBasicMaterial
              color="#60a5fa"
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

function FlowRibbon({
  positions,
  visible,
}: {
  positions: Vec3[];
  visible: boolean;
}) {
  const curve = useMemo(() => {
    if (positions.length < 2) return null;
    const pts = positions.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.CatmullRomCurve3(pts);
  }, [positions]);

  // Desativado - usando FlowWaveLines agora
  if (!visible || !curve) return null;

  return null;
}

// Pulsos de luz que VIAJAM ao longo das linhas de fluxo
function FlowPulses({
  positions,
  velocities,
  turbulence,
  visible,
  pulseCount = 3,
}: {
  positions: Vec3[];
  velocities: Vec3[];
  turbulence: number[];
  visible: boolean;
  pulseCount?: number;
}) {
  const linesRef = useRef<THREE.Line[]>([]);
  const lineCount = 14;
  const pointsPerLine = useRef(0);
  const progressRef = useRef(0);

  // Armazena dados base para animação
  const baseData = useRef<{
    positions: Vec3[];
    velocities: Vec3[];
    seeds: number[];
    perpVectors: Vec3[][];
  } | null>(null);

  // Prepara dados base (executado uma vez quando positions mudam)
  useMemo(() => {
    if (positions.length < 2) {
      baseData.current = null;
      return;
    }

    const seeds: number[] = [];
    const perpVectors: Vec3[][] = [];

    for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
      const seed = lineIdx / lineCount;
      seeds.push(seed);

      const linePerps: Vec3[] = [];
      for (let i = 0; i < positions.length; i++) {
        const vel = velocities[i] || [0, 0, 1];
        const dir = normalizeVec(vel);
        const perp = perpendicularVec(dir, seed);
        linePerps.push(perp);
      }
      perpVectors.push(linePerps);
    }

    baseData.current = { positions, velocities, seeds, perpVectors };
  }, [positions, velocities]);

  // Cria curvas iniciais das linhas
  const curves = useMemo(() => {
    if (positions.length < 2) return [];

    const result: THREE.Vector3[][] = [];
    const baseSpread = 0.018;

    for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
      const seed = lineIdx / lineCount;
      const points: THREE.Vector3[] = [];

      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const vel = velocities[i] || [0, 0, 1];
        const turb = turbulence[i] || 0;

        const dir = normalizeVec(vel);
        const perp = perpendicularVec(dir, seed);

        const offsetMagnitude = baseSpread + turb * 0.1;
        const radialDist = (lineIdx - lineCount / 2) / (lineCount / 2);
        const finalOffset = offsetMagnitude * radialDist;
        const wave = Math.sin(i * 0.35 + seed * 10) * turb * 0.025;

        const offsetVec = scaleVec(perp, finalOffset + wave);
        const finalPos = addVec(pos, offsetVec);

        points.push(new THREE.Vector3(finalPos[0], finalPos[1], finalPos[2]));
      }

      if (points.length >= 2) {
        const curve = new THREE.CatmullRomCurve3(points);
        const curvePoints = curve.getPoints(positions.length * 3);
        result.push(curvePoints);
        pointsPerLine.current = curvePoints.length;
      }
    }

    return result;
  }, [positions, velocities, turbulence]);

  // Reset da animação
  useLayoutEffect(() => {
    progressRef.current = 0;
    linesRef.current.forEach((line) => {
      if (line && line.geometry) {
        line.geometry.setDrawRange(0, 0);
      }
    });
  }, [visible, curves]);

  // Anima as cores E posições dos vértices + DRAW RANGE
  useFrame((state, delta) => {
    if (!visible || curves.length === 0) return;

    // 1. Atualiza progresso do desenho (LENTO)
    const drawSpeed = 0.008;
    if (progressRef.current < 1) {
      progressRef.current = Math.min(1, progressRef.current + delta * drawSpeed);
    }

    const time = state.clock.elapsedTime;
    const pulseSpeed = 0.12; // Velocidade do pulso
    const pulseWidth = 0.12; // Largura do pulso (0-1)

    // Parâmetros de movimento sutil das linhas
    const waveAmplitude = 0.008; // Amplitude muito sutil
    const waveFrequency = 0.4;   // Frequência da onda
    const waveSpeed = 0.3;       // Velocidade do movimento

    linesRef.current.forEach((line, lineIdx) => {
      if (!line) return;

      const geometry = line.geometry as THREE.BufferGeometry;
      
      // APLICA O DRAW RANGE
      const totalPoints = geometry.attributes.position.count;
      const drawCount = Math.floor(totalPoints * progressRef.current);
      geometry.setDrawRange(0, drawCount);

      const colors = geometry.getAttribute('color');
      const positions = geometry.getAttribute('position');
      if (!colors || !positions) return;

      const numPoints = colors.count;
      const centerDist = Math.abs(lineIdx - lineCount / 2) / (lineCount / 2);
      const baseIntensity = 0.25 + (1 - centerDist) * 0.15;

      // Seed única para cada linha
      const lineSeed = lineIdx * 1.7;

      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1); // Posição normalizada ao longo da linha (0-1)

        // === MOVIMENTO SUTIL DAS LINHAS ===
        // Ondulação baseada na posição e tempo
        const waveOffset = Math.sin(t * Math.PI * 2 * waveFrequency + time * waveSpeed + lineSeed) * waveAmplitude;
        const waveOffset2 = Math.cos(t * Math.PI * 1.5 * waveFrequency + time * waveSpeed * 0.7 + lineSeed * 0.5) * waveAmplitude * 0.5;

        // Pega posição original da curva
        const baseX = curves[lineIdx]?.[i]?.x ?? 0;
        const baseY = curves[lineIdx]?.[i]?.y ?? 0;
        const baseZ = curves[lineIdx]?.[i]?.z ?? 0;

        // Aplica movimento sutil (perpendicular à direção geral)
        positions.setXYZ(
          i,
          baseX + waveOffset,
          baseY + waveOffset2,
          baseZ + waveOffset * 0.5
        );

        // === PULSO DE COR ===
        let pulseIntensity = 0;

        for (let p = 0; p < pulseCount; p++) {
          const pulsePhase = ((time * pulseSpeed + p / pulseCount) % 1);
          const dist = Math.abs(t - pulsePhase);
          const wrappedDist = Math.min(dist, 1 - dist);

          if (wrappedDist < pulseWidth) {
            const falloff = 1 - (wrappedDist / pulseWidth);
            pulseIntensity += falloff * falloff * 0.7;
          }
        }

        const intensity = Math.min(1, baseIntensity + pulseIntensity);
        const r = 0.2 + pulseIntensity * 0.7;
        const g = 0.4 + intensity * 0.5;
        const b = 0.7 + (1 - pulseIntensity) * 0.3;

        colors.setXYZ(i, r, g, b);
      }

      positions.needsUpdate = true;
      colors.needsUpdate = true;
    });
  });

  if (!visible || curves.length === 0) return null;

  return (
    <group>
      {curves.map((curvePoints, idx) => (
        <TravelingPulseLine
          key={idx}
          points={curvePoints}
          lineIndex={idx}
          totalLines={lineCount}
          ref={(el) => { if (el) linesRef.current[idx] = el; }}
        />
      ))}
    </group>
  );
}

// Linha com vertex colors para pulso viajante
const TravelingPulseLine = forwardRef<THREE.Line, {
  points: THREE.Vector3[];
  lineIndex: number;
  totalLines: number;
}>(({ points, lineIndex, totalLines }, ref) => {
  const lineObject = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    geo.setDrawRange(0, 0); // Nasce vazia!

    // Inicializa vertex colors
    const colors = new Float32Array(points.length * 3);
    const centerDist = Math.abs(lineIndex - totalLines / 2) / (totalLines / 2);
    const baseColor = 0.3 + (1 - centerDist) * 0.2;

    for (let i = 0; i < points.length; i++) {
      colors[i * 3] = 0.3;     // R
      colors[i * 3 + 1] = 0.5; // G
      colors[i * 3 + 2] = 0.8; // B
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    });

    return new THREE.Line(geo, mat);
  }, [points, lineIndex, totalLines]);

  // Atribui a ref ao objeto THREE.Line criado
  useLayoutEffect(() => {
    if (ref && typeof ref === 'function') {
      ref(lineObject);
    } else if (ref && 'current' in ref) {
      (ref as React.MutableRefObject<THREE.Line | null>).current = lineObject;
    }
  }, [ref, lineObject]);

  return <primitive object={lineObject} />;
});

TravelingPulseLine.displayName = 'TravelingPulseLine';

// ============================================================================
// RIE - RADIANTE INTERVENTION EVALUATION v0.2 (Baseado em radiante_pt_v3.md)
// ============================================================================

// Definições de Primitivos Estruturais (Seção 5.5)
export type PrimitiveSensitivity = {
  oh: number; phi: number; eta: number; xi: number; def: number;
};

const DOMAIN_PRIMITIVES: Record<string, PrimitiveSensitivity> = {
  P1: { oh: 0.2, phi: 0.3, eta: 0.8, xi: 0.2, def: 0.9 }, // Acoplamento Difuso
  P2: { oh: 0.5, phi: 0.4, eta: 0.7, xi: 0.9, def: 0.6 }, // Otimização Convergente
  P3: { oh: 0.2, phi: 0.9, eta: 0.5, xi: 0.3, def: 0.5 }, // Memória Dominante
  P4: { oh: 0.1, phi: 0.2, eta: 0.95, xi: 0.1, def: 0.1 }, // Crítico Rápido
  P5: { oh: 0.4, phi: 0.5, eta: 0.6, xi: 0.7, def: 0.8 }, // Multi-Regime
};

// Vetores de Interação Esparsa (Tabela 2)
const PRIMITIVE_INTERACTIONS: Record<string, Partial<PrimitiveSensitivity>> = {
  "P2_P3": { phi: 0.3, eta: 0.2, xi: -0.1, def: 0.4 },
  "P1_P2": { phi: 0.1, eta: 0.2, xi: -0.3, def: 0.1 },
  "P3_P4": { phi: 0.2, eta: 0.1, def: 0.3 },
};

/**
 * Mixer de Interação Bilinear (Definição 5.5)
 * Computa sensibilidade herdada α(D)
 */
function computeInheritedSensitivity(lambdas: Record<string, number>): PrimitiveSensitivity {
  const keys = Object.keys(DOMAIN_PRIMITIVES);
  const result: PrimitiveSensitivity = { oh: 0, phi: 0, eta: 0, xi: 0, def: 0 };

  // 1. Soma linear: Σ λ_k * α^(k)
  keys.forEach(k => {
    const L = lambdas[k] || 0;
    const P = DOMAIN_PRIMITIVES[k];
    result.oh += L * P.oh;
    result.phi += L * P.phi;
    result.eta += L * P.eta;
    result.xi += L * P.xi;
    result.def += L * P.def;
  });

  // 2. Interações bilineares: Σ λ_i * λ_j * Γ_ij
  Object.entries(PRIMITIVE_INTERACTIONS).forEach(([pair, gamma]) => {
    const [p1, p2] = pair.split("_");
    const L1 = lambdas[p1] || 0;
    const L2 = lambdas[p2] || 0;
    const interaction = L1 * L2;

    if (interaction > 0) {
      if (gamma.oh) result.oh += interaction * gamma.oh;
      if (gamma.phi) result.phi += interaction * gamma.phi;
      if (gamma.eta) result.eta += interaction * gamma.eta;
      if (gamma.xi) result.xi += interaction * gamma.xi;
      if (gamma.def) result.def += interaction * gamma.def;
    }
  });

  // 3. Sigmoide de ativação (β=2)
  const sigma = (x: number) => 1 / (1 + Math.exp(-2 * x));
  
  return {
    oh: sigma(result.oh),
    phi: sigma(result.phi),
    eta: sigma(result.eta),
    xi: sigma(result.xi),
    def: sigma(result.def),
  };
}

// Tipos para o sistema RIE
export type RIEConfig = {
  nRollouts: number;
  horizonSteps: number;
  stochasticity: {
    enabled: boolean;
    paramSigma: number;
    noiseOh: number;
    noisePhi: number;
    noiseEta: number;
    noiseSigma: number;
    noiseDef: number;
  };
  objective: {
    profile: 'pre_pnr_escape' | 'stabilize' | 'explore';
    weights: {
      Sigma: number;
      Eta: number;
      DEF: number;
      KatashiRisk: number;
      Cone: number;
      Gravity: number; // Peso da penalização gravitacional
    };
    guardrails: {
      maxDEFIncrease: number;
      maxEtaIncrease: number;
      minConeOpening: number;
      maxPnrRisk: number;
      maxGravityWork: number; // Trabalho gravitacional máximo permitido
    };
  };
  gravitational?: GravitationalConfig; // Configuração gravitacional opcional
};

export type RIEMetricsBundle = {
  delta: { oh: number; phi: number; eta: number; xi: number };
  aggregate: {
    riskKatashi: number;
    riskPnr: number;
    stability: number;
    reversibility: number;
    coneOpening: number;
    dSigma: number;
    dEta: number;
    dDEF: number;
    dOh: number;
    dPhi: number;
    driskPnr: number;
    driskKatashi: number;
  };
  gravitational?: GravitationalBundle; // Métricas gravitacionais agregadas
  uTotal: number;
  feasible: boolean;
  violations: string[];
  reasons: string[];
  etaInterpretation?: string;  // Interpretação contextual de rigidez
  etaHealthScore?: number;     // Score de saúde estrutural (0-1)
};

// Configuração padrão do RIE
const DEFAULT_RIE_CONFIG: RIEConfig = {
  nRollouts: 32,
  horizonSteps: 16,
  stochasticity: {
    enabled: true,
    paramSigma: 0.03,
    noiseOh: 0.008,
    noisePhi: 0.003,
    noiseEta: 0.004,
    noiseSigma: 0.006,
    noiseDef: 0.005,
  },
  objective: {
    profile: 'pre_pnr_escape',
    weights: {
      Sigma: 0.35,
      Eta: 0.20,
      DEF: 0.15,
      KatashiRisk: 0.10,
      Cone: 0.10,
      Gravity: 0.10, // Penalização pelo trabalho contra gravidade estrutural
    },
    guardrails: {
      maxDEFIncrease: 0.10,
      maxEtaIncrease: 0.05,
      minConeOpening: 0.03,
      maxPnrRisk: 0.75,
      maxGravityWork: 0.80, // Trabalho gravitacional acumulado máximo
    },
  },
  gravitational: DEFAULT_GRAVITATIONAL_CONFIG, // Usa configuração padrão para educação
};

// Estatísticas baseline por observável (fallback)
const BASELINE_STATS = {
  oh: { mean: 1.0, std: 0.15 },
  phi: { mean: 0.1, std: 0.05 },
  eta: { mean: 0.35, std: 0.05 },
  sigma: { mean: 0.9, std: 0.15 },
  def: { mean: 0.15, std: 0.10 },
};

// Z-score normalizado
function zScore(value: number, obs: keyof typeof BASELINE_STATS): number {
  const stats = BASELINE_STATS[obs];
  return (value - stats.mean) / Math.max(stats.std, 0.01);
}

// Clamp utilitário
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// Sigmoid
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Logística saturante (0..1) deslocada por threshold.
 * x = (oh - thr) / width → controla quão rápido satura.
 */
function satLogistic(oh: number, thr: number, width: number): number {
  const x = (oh - thr) / Math.max(width, 1e-9);
  return sigmoid(x);
}

// Parâmetros de dinâmica não-linear (saturação + lag)
const NONLIN_PARAMS = {
  ohThr: 1.0,
  ohWidth: 0.06,        // menor = mais abrupto
  ohMaxBoost: 0.22,     // teto do auto-reforço por step
  ohGain: 1.0,          // multiplicador extra
};

const COUPLING_PARAMS = {
  ohEtaThr: 1.1,
  etaStrength: 0.008,   // coef original
  tauSteps: 6,          // lag: quantos steps para acoplar
  etaMaxPerStep: 0.012, // clamp de quanto η pode aumentar por step
};

// Risk proxies
function riskPnrProxy(oh: number, phi: number, eta: number, sigma: number, def: number): number {
  // Rigidez + déficit + pressão aumentam risco; diversidade reduz
  const x = 0.8 * zScore(eta, 'eta') + 0.7 * zScore(def, 'def') + 0.5 * zScore(oh, 'oh') - 0.6 * zScore(sigma, 'sigma');
  return sigmoid(x);
}

function riskKatashiProxy(oh: number, phi: number, eta: number, sigma: number, def: number): number {
  // Mais sensível à rigidez e déficit
  const x = 1.0 * zScore(eta, 'eta') + 0.9 * zScore(def, 'def') + 0.6 * Math.max(0, zScore(oh, 'oh')) - 0.5 * zScore(sigma, 'sigma');
  return sigmoid(x);
}

// Gerador de números pseudo-aleatórios (seeded)
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  normal(mean: number, std: number): number {
    // Box-Muller transform
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1 + 0.0001)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z;
  }
}

// Rollout estocástico com jitter
type RolloutState = { oh: number; phi: number; eta: number; sigma: number; def: number };

function simulateRolloutStochastic(
  baseState: RolloutState,
  delta: { oh: number; phi: number; eta: number; sigma: number },
  momentum: { dOh: number; dPhi: number; dEta: number; dSigma: number },
  seed: number,
  steps: number,
  stochCfg: RIEConfig['stochasticity']
): RolloutState[] {
  const rng = new SeededRandom(seed);
  const trajectory: RolloutState[] = [];

  // 1) Aplica delta inicial
  let oh = baseState.oh + delta.oh;
  let phi = baseState.phi + delta.phi;
  let eta = baseState.eta + delta.eta;
  let sigma = baseState.sigma + delta.sigma;
  let def = Math.max(0, oh - 1);

  // 2) Jitter nos parâmetros da dinâmica
  let rigidityDamping = 1 - Math.max(0, (eta - 0.35)) * 0.4;
  let memoryInertia = 1 + phi * 0.3;

  // Parâmetros com jitter
  let ohGainJittered = NONLIN_PARAMS.ohGain;
  let ohWidthJittered = NONLIN_PARAMS.ohWidth;
  let etaStrengthJittered = COUPLING_PARAMS.etaStrength;

  if (stochCfg.enabled) {
    rigidityDamping *= (1 + rng.normal(0, stochCfg.paramSigma));
    memoryInertia *= (1 + rng.normal(0, stochCfg.paramSigma));
    ohGainJittered *= (1 + rng.normal(0, stochCfg.paramSigma));
    ohWidthJittered *= (1 + rng.normal(0, stochCfg.paramSigma * 0.5));
    etaStrengthJittered *= (1 + rng.normal(0, stochCfg.paramSigma));
  }

  // Estado de lag para acoplamento Oh→η (reservatório)
  let etaCouplingLag = 0;

  // Velocidades iniciais
  let vOh = momentum.dOh * 0.7;
  let vPhi = momentum.dPhi * 0.7;
  let vEta = momentum.dEta * 0.7;
  let vSigma = momentum.dSigma * 0.7;

  for (let t = 0; t < steps; t++) {
    // 3) Auto-reforço SATURANTE de Oh (substitui linear)
    if (oh > NONLIN_PARAMS.ohThr) {
      // "quanto acima do limiar" vira 0..1, saturando
      const s = satLogistic(oh, NONLIN_PARAMS.ohThr, ohWidthJittered);
      const boost = NONLIN_PARAMS.ohMaxBoost * s * ohGainJittered;
      vOh += boost;
    } else if (oh < 0.85) {
      // Retorno ao equilíbrio quando abaixo
      vOh += (0.9 - oh) * 0.02;
    }

    // Rigidez amortece mudanças
    rigidityDamping = 1 - Math.max(0, (eta - 0.35)) * 0.4;
    vOh *= rigidityDamping;
    vSigma *= rigidityDamping;

    // Memória cria inércia
    memoryInertia = 1 + phi * 0.3;
    vOh *= (1 / memoryInertia) * 0.98 + 0.02;

    // 4) Ruído nos incrementos (process noise)
    if (stochCfg.enabled) {
      vOh += rng.normal(0, stochCfg.noiseOh);
      vPhi += rng.normal(0, stochCfg.noisePhi);
      vEta += rng.normal(0, stochCfg.noiseEta);
      vSigma += rng.normal(0, stochCfg.noiseSigma);
    }

    // Decaimento natural
    vOh *= 0.94;
    vPhi *= 0.96;
    vEta *= 0.97;
    vSigma *= 0.95;

    // 5) Integra
    oh += vOh;
    phi += vPhi;
    eta += vEta;
    sigma += vSigma;

    // 6) Acoplamento Oh→η COM LAG (substitui instantâneo)
    const alpha = 1 / Math.max(COUPLING_PARAMS.tauSteps, 1);

    if (oh > COUPLING_PARAMS.ohEtaThr) {
      // "força bruta" do acoplamento (alvo)
      const drive = (oh - COUPLING_PARAMS.ohEtaThr) * etaStrengthJittered;
      // Reservatório tende a "drive" aos poucos
      etaCouplingLag = etaCouplingLag + alpha * (drive - etaCouplingLag);
    } else {
      // Quando sai da zona de acoplamento, decai suavemente
      etaCouplingLag = etaCouplingLag + alpha * (0 - etaCouplingLag);
    }

    // Aplica acoplamento lagado em η (clamp por step)
    const dEtaFromCoupling = clamp(etaCouplingLag, 0, COUPLING_PARAMS.etaMaxPerStep);
    eta += dEtaFromCoupling;

    // Acoplamento Σ baixo → Oh sobe (mantido)
    if (sigma < 0.8) {
      oh += (0.8 - sigma) * 0.01;
    }

    // DEF derivado
    def = Math.max(0, oh - 1);

    // 7) Clamps físicos
    oh = clamp(oh, 0.5, 1.8);
    phi = clamp(phi, 0, 0.5);
    eta = clamp(eta, 0.2, 0.6);
    sigma = clamp(sigma, 0.5, 1.5);
    def = clamp(def, 0, 0.8);

    trajectory.push({ oh, phi, eta, sigma, def });
  }

  return trajectory;
}

// Stability: menor jerk = mais estável
function computeStability(trajectory: RolloutState[]): number {
  if (trajectory.length < 4) return 0.5;

  const jerks: number[] = [];
  for (let t = 2; t < trajectory.length; t++) {
    const dx1_oh = trajectory[t].oh - trajectory[t - 1].oh;
    const dx0_oh = trajectory[t - 1].oh - trajectory[t - 2].oh;
    const dx1_eta = trajectory[t].eta - trajectory[t - 1].eta;
    const dx0_eta = trajectory[t - 1].eta - trajectory[t - 2].eta;

    const jerk = Math.sqrt((dx1_oh - dx0_oh) ** 2 + (dx1_eta - dx0_eta) ** 2);
    jerks.push(jerk);
  }

  const medianJerk = jerks.sort((a, b) => a - b)[Math.floor(jerks.length / 2)] || 0;
  return 1 / (1 + medianJerk * 10);
}

// Reversibility: capacidade de reduzir risco
function computeReversibility(trajectory: RolloutState[]): number {
  if (trajectory.length < 2) return 0.5;

  const risks = trajectory.map(s => riskPnrProxy(s.oh, s.phi, s.eta, s.sigma, s.def));
  const r0 = risks[0];
  const rMin = Math.min(...risks);
  const rT = risks[risks.length - 1];

  const improvement = Math.max(0, r0 - rT);
  const depth = Math.max(0, r0 - rMin);

  return Math.min(1, Math.max(0, 0.6 * improvement + 0.4 * depth + 0.3));
}

// Cone opening: dispersão temporal + endpoints
function computeConeOpening(rollouts: RolloutState[][]): number {
  if (rollouts.length < 2) return 0;

  const T = rollouts[0].length;
  const spreads: number[] = [];

  // Dispersão temporal
  for (let t = 0; t < T; t++) {
    const points = rollouts.map(r => [r[t].oh, r[t].eta, r[t].sigma]);
    const center = [
      points.reduce((s, p) => s + p[0], 0) / points.length,
      points.reduce((s, p) => s + p[1], 0) / points.length,
      points.reduce((s, p) => s + p[2], 0) / points.length,
    ];

    const dists = points.map(p =>
      Math.sqrt((p[0] - center[0]) ** 2 + (p[1] - center[1]) ** 2 + (p[2] - center[2]) ** 2)
    );
    dists.sort((a, b) => a - b);
    spreads.push(dists[Math.floor(dists.length / 2)] || 0);
  }

  const temporalSpread = spreads.reduce((s, x) => s + x, 0) / spreads.length;

  // Dispersão dos endpoints
  const endpoints = rollouts.map(r => {
    const e = r[r.length - 1];
    return [e.oh, e.eta, e.sigma];
  });
  const endCenter = [
    endpoints.reduce((s, p) => s + p[0], 0) / endpoints.length,
    endpoints.reduce((s, p) => s + p[1], 0) / endpoints.length,
    endpoints.reduce((s, p) => s + p[2], 0) / endpoints.length,
  ];
  const endDists = endpoints.map(p =>
    Math.sqrt((p[0] - endCenter[0]) ** 2 + (p[1] - endCenter[1]) ** 2 + (p[2] - endCenter[2]) ** 2)
  );
  endDists.sort((a, b) => a - b);
  const endpointSpread = endDists[Math.floor(endDists.length / 2)] || 0;

  return 0.7 * temporalSpread + 0.3 * endpointSpread;
}

// ============================================================================
// AVALIAÇÃO CONTEXTUAL DE RIGIDEZ (η)
// ============================================================================

/**
 * Avalia mudança em η (rigidez) considerando contexto estrutural completo.
 * 
 * DISTINÇÃO CRÍTICA:
 * - η↓ pode ser adaptação saudável (com Ξ↑, cone↑, DEF↓)
 * - OU condicionamento patológico (com Ξ↓, cone↓, DEF↑)
 * 
 * Retorna score ajustado e interpretação diagnóstica.
 */
function evaluateEtaChange(
  dEta: number,
  dSigma: number,
  dDEF: number,
  coneOpening: number,
  reversibility: number,
  weight: number
): { score: number; interpretation: string; healthScore: number } {
  
  if (dEta < -0.005) {  // η diminuiu significativamente
    
    // Indicadores de adaptação saudável vs condicionamento
    const indicators = {
      diversityMaintained: dSigma >= -0.02,      // Ξ não colapsou
      deficitReduced: dDEF <= 0,                 // DEF diminuiu ou estável
      coneOpen: coneOpening > 0.03,              // Futuros permanecem abertos
      reversible: reversibility > 0.4,           // Sistema pode reverter
    };
    
    // Score de saúde estrutural (0 a 1)
    const healthScore = Object.values(indicators).filter(x => x).length / 4;
    
    if (healthScore >= 0.75) {
      // 🟢 Plasticidade com autonomia (3+ indicadores positivos)
      return {
        score: weight * Math.abs(dEta) * 1.0,
        interpretation: "plasticidade_saudável",
        healthScore
      };
    } else if (healthScore >= 0.5) {
      // 🟡 Adaptação parcial (2 indicadores positivos)
      return {
        score: weight * Math.abs(dEta) * 0.4,
        interpretation: "adaptação_parcial",
        healthScore
      };
    } else if (healthScore >= 0.25) {
      // 🟠 Suspeita de condicionamento (1 indicador positivo)
      return {
        score: -weight * Math.abs(dEta) * 0.3,
        interpretation: "suspeita_condicionamento",
        healthScore
      };
    } else {
      // 🔴 Condicionamento confirmado (0 indicadores positivos)
      return {
        score: -weight * Math.abs(dEta) * 0.6,
        interpretation: "condicionamento_patológico",
        healthScore
      };
    }
    
  } else if (dEta > 0.005) {  // η aumentou significativamente
    
    // Aumento de rigidez pode ser consolidação estrutural OU cristalização
    const structuralIndicators = {
      diversityPreserved: dSigma >= -0.01,       // Ξ não colapsou
      deficitReduced: dDEF < 0,                  // DEF está diminuindo
      coneOpen: coneOpening > 0.03,              // Cone não fechou
      stillReversible: reversibility > 0.3,      // Ainda pode voltar
    };
    
    const structuralScore = Object.values(structuralIndicators).filter(x => x).length / 4;
    
    if (structuralScore >= 0.75) {
      // 🟢 Consolidação estrutural saudável (integração de princípios)
      return {
        score: 0,  // Neutro - não penaliza nem bonifica
        interpretation: "consolidação_estrutural",
        healthScore: structuralScore
      };
    } else if (structuralScore >= 0.5) {
      // 🟡 Rigidificação moderada
      return {
        score: -weight * Math.abs(dEta) * 0.3,
        interpretation: "rigidificação_moderada",
        healthScore: structuralScore
      };
    } else {
      // 🔴 Cristalização patológica (perda de plasticidade sem ganho estrutural)
      return {
        score: -weight * Math.abs(dEta) * 0.8,
        interpretation: "cristalização_patológica",
        healthScore: structuralScore
      };
    }
    
  } else {  // η estável (|dEta| < 0.005)
    return {
      score: 0,
      interpretation: "rigidez_estável",
      healthScore: 0.5
    };
  }
}

/**
 * Estima a decomposição primitiva do domínio baseada no estado atual K(t)
 * (Heurística simplificada para tempo real)
 */
function estimateDomainDecomposition(state: { oh: number; phi: number; eta: number; sigma: number; def: number }): Record<string, number> {
  const scores: Record<string, number> = {
    P1: 0, P2: 0, P3: 0, P4: 0, P5: 0
  };

  // P1: Acoplamento Difuso (Nagare nativo)
  if (state.sigma > 0.7 && state.eta < 0.4) scores.P1 = 1.0;
  
  // P2: Otimização Convergente (Trade-off Xi/Eta)
  if (state.eta > 0.4 && state.sigma < 0.6) scores.P2 = 0.8;
  
  // P3: Memória Dominante (Phi alto)
  if (state.phi > 0.5) scores.P3 = 0.9;
  
  // P4: Crítico Rápido (Oh e Eta muito altos)
  if (state.oh > 1.1 && state.eta > 0.7) scores.P4 = 1.0;
  
  // P5: Multi-Regime (Déficit alto)
  if (state.def > 0.4) scores.P5 = 0.7;

  // Normaliza para o simplex (soma = 1)
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v / total]));
}

// Função principal: evaluate_candidate_delta
export function evaluateCandidateDelta(
  baseState: { oh: number; phi: number; eta: number; sigma: number; def: number },
  delta: { oh: number; phi: number; eta: number; sigma: number },
  momentum: { dOh: number; dPhi: number; dEta: number; dSigma: number },
  config: RIEConfig = DEFAULT_RIE_CONFIG
): RIEMetricsBundle {
  // 0) Estima sensibilidade herdada do domínio (NOVO v0.2)
  const lambdas = estimateDomainDecomposition(baseState);
  const alphaD = computeInheritedSensitivity(lambdas);

  // 1) Gera N rollouts
  const rollouts: RolloutState[][] = [];
  const baseSeed = Math.floor(baseState.oh * 10000 + baseState.eta * 1000);

  for (let i = 0; i < config.nRollouts; i++) {
    const seed = baseSeed + i * 10007;
    const traj = simulateRolloutStochastic(
      baseState,
      delta,
      momentum,
      seed,
      config.horizonSteps,
      config.stochasticity
    );
    rollouts.push(traj);
  }

  // 2) Métricas por rollout
  const perRollout = rollouts.map(traj => {
    const sEnd = traj[traj.length - 1];
    return {
      riskKatashi: riskKatashiProxy(sEnd.oh, sEnd.phi, sEnd.eta, sEnd.sigma, sEnd.def),
      riskPnr: riskPnrProxy(sEnd.oh, sEnd.phi, sEnd.eta, sEnd.sigma, sEnd.def),
      stability: computeStability(traj),
      reversibility: computeReversibility(traj),
      end: sEnd,
    };
  });

  // 3) Agrega (mediana)
  const median = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] || 0;
  };

  const aggRiskKatashi = median(perRollout.map(p => p.riskKatashi));
  const aggRiskPnr = median(perRollout.map(p => p.riskPnr));
  const aggStability = median(perRollout.map(p => p.stability));
  const aggReversibility = median(perRollout.map(p => p.reversibility));

  // 4) Cone opening
  const coneOpening = computeConeOpening(rollouts);

  // 4.5) Análise Gravitacional - Ψ(r_t) sub-observável
  const gravConfig = config.gravitational || DEFAULT_GRAVITATIONAL_CONFIG;

  // Converte trajetórias RolloutState[] para StateVector5D[]
  const trajectoriesAs5D = rollouts.map(traj =>
    traj.map(s => ({
      oh: s.oh,
      phi: s.phi,
      eta: s.eta,
      xi: s.sigma,
      def: s.def,
    } as StateVector5D))
  );

  // Analisa cada trajetória gravitacionalmente
  const gravAnalyses = trajectoriesAs5D.map(traj =>
    analyzeTrajectoryGravitational(traj, gravConfig)
  );

  // Cria bundles para agregação
  const gravBundles = gravAnalyses.map(a => createGravitationalBundle(a));

  // Agrega métricas gravitacionais (mediana)
  const aggGravitational: GravitationalBundle = {
    totalWork: median(gravBundles.map(b => b.totalWork)),
    avgWorkPerStep: median(gravBundles.map(b => b.avgWorkPerStep)),
    maxHeight: median(gravBundles.map(b => b.maxHeight)),
    ascentRatio: median(gravBundles.map(b => b.ascentRatio)),
    descentRatio: median(gravBundles.map(b => b.descentRatio)),
    meanPotential: median(gravBundles.map(b => b.meanPotential)),
    meanGravity: median(gravBundles.map(b => b.meanGravity)),
    lockDiagnosis: {
      isLocked: gravBundles.filter(b => b.lockDiagnosis.isLocked).length > gravBundles.length / 2,
      reason: gravBundles[0]?.lockDiagnosis.reason || 'Sistema equilibrado',
    },
  };

  // 5) Deltas esperados
  const ends = perRollout.map(p => p.end);
  const dSigma = median(ends.map(e => e.sigma - baseState.sigma));
  const dEta = median(ends.map(e => e.eta - baseState.eta));
  const dDEF = median(ends.map(e => e.def - baseState.def));
  const dOh = median(ends.map(e => e.oh - baseState.oh));
  const dPhi = median(ends.map(e => e.phi - baseState.phi));

  // 6) Baseline risks
  const baseRiskPnr = riskPnrProxy(baseState.oh, baseState.phi, baseState.eta, baseState.sigma, baseState.def);
  const baseRiskKatashi = riskKatashiProxy(baseState.oh, baseState.phi, baseState.eta, baseState.sigma, baseState.def);

  const driskPnr = aggRiskPnr - baseRiskPnr;
  const driskKatashi = aggRiskKatashi - baseRiskKatashi;

  // 7) Check guardrails
  const violations: string[] = [];
  const { guardrails } = config.objective;

  if (dDEF > guardrails.maxDEFIncrease) {
    violations.push(`DEF↑ ${(dDEF * 100).toFixed(0)}% > limite`);
  }
  if (dEta > guardrails.maxEtaIncrease) {
    violations.push(`η↑ ${(dEta * 100).toFixed(0)}% > limite`);
  }
  if (coneOpening < guardrails.minConeOpening) {
    violations.push(`Cone fechado`);
  }
  if (aggRiskPnr > guardrails.maxPnrRisk) {
    violations.push(`Risk PNR ${(aggRiskPnr * 100).toFixed(0)}% > teto`);
  }

  // Guardrail gravitacional: trabalho excessivo contra gravidade
  if (aggGravitational.totalWork > guardrails.maxGravityWork) {
    violations.push(`Trabalho Ψ ${aggGravitational.totalWork.toFixed(2)} > limite`);
  }

  // Alerta se sistema está travado gravitacionalmente
  if (aggGravitational.lockDiagnosis.isLocked) {
    violations.push(`Sistema travado: ${aggGravitational.lockDiagnosis.reason}`);
  }

  const feasible = violations.length === 0;

  // 8) Utility score (pre_pnr_escape) - AGORA USANDO SENSIBILIDADE HERDADA α(D)
  // G(u | D, t) = Σ |delta| * alphaD
  const sigmaGain = alphaD.xi * Math.max(0, dSigma);
  const phiGain = alphaD.phi * Math.max(0, -dPhi); // Ganho se diminuir memória
  const ohGain = alphaD.oh * Math.max(0, -dOh);   // Ganho se diminuir homologia
  
  // Avaliação CONTEXTUAL de η (rigidez) - distingue adaptação de condicionamento
  const etaEval = evaluateEtaChange(
    dEta,
    dSigma,
    dDEF,
    coneOpening,
    aggReversibility,
    alphaD.eta
  );
  const etaScore = etaEval.score;
  const etaInterpretation = etaEval.interpretation;
  
  const defPenalty = -alphaD.def * Math.max(0, dDEF);
  const katPenalty = -config.objective.weights.KatashiRisk * Math.max(0, driskKatashi);
  const coneBonus = config.objective.weights.Cone * Math.max(0, coneOpening);

  // Penalização gravitacional: trabalho médio por passo
  // Ψ cria assimetria - subir (aumentar DEF/Oh) custa mais que descer
  const gravityPenalty = -config.objective.weights.Gravity * aggGravitational.avgWorkPerStep;

  // Score consolidado conforme Seção 5.7 + Gravitacional
  const uTotal = feasible
    ? (sigmaGain + phiGain + ohGain + etaScore + defPenalty + katPenalty + coneBonus + gravityPenalty)
    : -999;

  // 9) Top reasons (inclui interpretação de η)
  const reasons: string[] = [];
  if (dSigma > 0.01) reasons.push('Σ↑');
  if (dSigma < -0.01) reasons.push('Σ↓');
  
  // Adiciona interpretação contextual de η
  if (Math.abs(dEta) > 0.005) {
    const etaLabels: Record<string, string> = {
      'plasticidade_saudável': '🟢 η↓ adaptativo',
      'adaptação_parcial': '🟡 η↓ parcial',
      'suspeita_condicionamento': '🟠 η↓ suspeito',
      'condicionamento_patológico': '🔴 η↓ patológico',
      'consolidação_estrutural': '🟢 η↑ consolidação',
      'rigidificação_moderada': '🟡 η↑ moderado',
      'cristalização_patológica': '🔴 η↑ cristalização',
      'rigidez_estável': 'η estável',
    };
    const label = etaLabels[etaInterpretation] || (dEta < 0 ? 'η↓' : 'η↑');
    reasons.push(label);
  }
  
  if (Math.abs(dDEF) < 0.02) reasons.push('DEF estável');
  if (dDEF < -0.01) reasons.push('DEF↓');
  if (dDEF > 0.02) reasons.push('DEF↑');
  if (driskPnr < -0.05) reasons.push('risk_pnr↓');
  if (driskPnr > 0.05) reasons.push('risk_pnr↑');
  if (coneOpening > 0.05) reasons.push('cone aberto');

  // Razões gravitacionais
  if (aggGravitational.avgWorkPerStep > 0.15) reasons.push('Ψ alto (subida difícil)');
  if (aggGravitational.descentRatio > 0.6) reasons.push('Ψ favorável (descida)');
  if (aggGravitational.lockDiagnosis.isLocked) reasons.push('⚠️ travamento gravitacional');

  return {
    delta: { oh: delta.oh, phi: delta.phi, eta: delta.eta, xi: delta.sigma },
    aggregate: {
      riskKatashi: aggRiskKatashi,
      riskPnr: aggRiskPnr,
      stability: aggStability,
      reversibility: aggReversibility,
      coneOpening,
      dSigma,
      dEta,
      dDEF,
      dOh,
      dPhi,
      driskPnr,
      driskKatashi,
    },
    gravitational: aggGravitational, // Métricas gravitacionais agregadas
    uTotal,
    feasible,
    violations,
    reasons: reasons.slice(0, 4),
    etaInterpretation,     // Interpretação contextual de η
    etaHealthScore: etaEval.healthScore,  // Score de saúde (0-1)
  };
}


// ============================================================================
// TRAJETÓRIAS FUTURAS ALTERNATIVAS (O QUE SE?)
// ============================================================================

// Classifica regime baseado nos observáveis
function classifyRegime(oh: number, phi: number, eta: number, xi: number): {
  label: string;
  color: string;
} {
  const DEF = Math.max(0, oh - 1);

  if (oh > 1.15 || DEF > 0.15 || xi > 1.1) {
    return { label: "katashi", color: "#ef4444" };
  } else if (oh < 0.95 && DEF < 0.05 && xi < 0.9) {
    return { label: "nagare", color: "#22c55e" };
  } else {
    return { label: "utsuroi", color: "#eab308" };
  }
}

// Calcula momentum recente dos observáveis (tendência)
function computeMomentum(
  data: StructuralTimePoint[],
  currentIndex: number,
  lookback: number = 3
): { dOh: number; dPhi: number; dEta: number; dXi: number } {
  if (currentIndex < 1) {
    return { dOh: 0, dPhi: 0, dEta: 0, dXi: 0 };
  }

  const start = Math.max(0, currentIndex - lookback);
  const startPoint = data[start];
  const endPoint = data[currentIndex];
  const steps = currentIndex - start;

  if (steps === 0) {
    return { dOh: 0, dPhi: 0, dEta: 0, dXi: 0 };
  }

  return {
    dOh: (endPoint.state.oh - startPoint.state.oh) / steps,
    dPhi: (endPoint.state.phi - startPoint.state.phi) / steps,
    dEta: (endPoint.state.eta - startPoint.state.eta) / steps,
    dXi: ((endPoint.state.xi ?? 0.9) - (startPoint.state.xi ?? 0.9)) / steps,
  };
}

// Gera cenários dinâmicos baseados no estado atual e momentum
function generateDynamicScenarios(
  oh: number,
  phi: number,
  eta: number,
  xi: number,
  momentum: { dOh: number; dPhi: number; dEta: number; dXi: number },
  currentRegime: string
): { label: string; ohDelta: number; phiDelta: number; etaDelta: number; xiDelta: number; difficulty: number }[] {
  const scenarios: { label: string; ohDelta: number; phiDelta: number; etaDelta: number; xiDelta: number; difficulty: number }[] = [];

  // Fator de inércia baseado no momentum
  const inertiaOh = momentum.dOh * 2;
  const inertiaPhi = momentum.dPhi * 2;
  const inertiaEta = momentum.dEta * 2;
  const inertiaXi = momentum.dXi * 2;

  // Distância do equilíbrio (Oh = 1.0 é neutro)
  const pressureLevel = oh - 1.0;
  const rigidityLevel = eta - 0.35;

  // Dificuldade de recuperação baseada no regime
  let recoveryDifficulty = 1.0;
  let worseningEase = 1.0;
  if (currentRegime === "katashi") {
    recoveryDifficulty = 2.5; // Muito mais difícil sair de Katashi
    worseningEase = 0.5; // Já está ruim, piora menos dramática
  } else if (currentRegime === "nagare") {
    recoveryDifficulty = 0.5; // Fácil manter-se bem
    worseningEase = 1.5; // Mais vulnerável a perturbações
  }

  // === CENÁRIO 1: Continuação da tendência atual (inércia) ===
  scenarios.push({
    label: "inertia",
    ohDelta: inertiaOh * 1.5,
    phiDelta: inertiaPhi * 1.5,
    etaDelta: inertiaEta * 1.2,
    xiDelta: inertiaXi * 1.3,
    difficulty: 1.0,
  });

  // === CENÁRIO 2: Amplificação da tendência ===
  scenarios.push({
    label: "amplified",
    ohDelta: inertiaOh * 3.0 + Math.sign(inertiaOh) * 0.05,
    phiDelta: inertiaPhi * 2.5,
    etaDelta: inertiaEta * 2.0,
    xiDelta: inertiaXi * 2.5,
    difficulty: 1.2,
  });

  // === CENÁRIO 3: Reversão suave (contra tendência) ===
  scenarios.push({
    label: "soft_reversal",
    ohDelta: -inertiaOh * 0.8 - pressureLevel * 0.1 / recoveryDifficulty,
    phiDelta: -inertiaPhi * 0.5,
    etaDelta: -inertiaEta * 0.6,
    xiDelta: -inertiaXi * 0.7,
    difficulty: recoveryDifficulty,
  });

  // === CENÁRIO 4: Recuperação forte (busca equilíbrio) ===
  scenarios.push({
    label: "recovery",
    ohDelta: -pressureLevel * 0.3 / recoveryDifficulty - 0.08 / recoveryDifficulty,
    phiDelta: -phi * 0.15 / recoveryDifficulty,
    etaDelta: -rigidityLevel * 0.2 / recoveryDifficulty,
    xiDelta: (0.85 - xi) * 0.2 / recoveryDifficulty,
    difficulty: recoveryDifficulty * 1.5,
  });

  // === CENÁRIO 5: Choque externo positivo ===
  scenarios.push({
    label: "positive_shock",
    ohDelta: -0.15 / recoveryDifficulty,
    phiDelta: -0.02,
    etaDelta: -0.03 / recoveryDifficulty,
    xiDelta: -0.08 / recoveryDifficulty,
    difficulty: recoveryDifficulty,
  });

  // === CENÁRIO 6: Choque externo negativo ===
  scenarios.push({
    label: "negative_shock",
    ohDelta: 0.12 * worseningEase + Math.abs(inertiaOh) * 0.5,
    phiDelta: 0.025 * worseningEase,
    etaDelta: 0.02 * worseningEase,
    xiDelta: 0.1 * worseningEase,
    difficulty: worseningEase,
  });

  // === CENÁRIO 7: Estresse crescente ===
  scenarios.push({
    label: "growing_stress",
    ohDelta: 0.18 * worseningEase + pressureLevel * 0.3,
    phiDelta: 0.03 * worseningEase,
    etaDelta: 0.025 * worseningEase + rigidityLevel * 0.2,
    xiDelta: 0.12 * worseningEase,
    difficulty: worseningEase * 0.8,
  });

  // === CENÁRIO 8: Oscilação (instabilidade) ===
  const oscillationAmplitude = Math.abs(pressureLevel) * 0.5 + 0.05;
  scenarios.push({
    label: "oscillation",
    ohDelta: Math.sin(phi * 10) * oscillationAmplitude,
    phiDelta: 0.02 * Math.cos(oh * 5),
    etaDelta: rigidityLevel * 0.15 * Math.sin(xi * 8),
    xiDelta: 0.05 * Math.cos(eta * 6),
    difficulty: 1.0,
  });

  return scenarios;
}

// Simula evolução temporal dos observáveis com dinâmica adaptativa
function simulateFutureAdaptive(
  baseOh: number,
  basePhi: number,
  baseEta: number,
  baseXi: number,
  scenario: { ohDelta: number; phiDelta: number; etaDelta: number; xiDelta: number; difficulty: number },
  momentum: { dOh: number; dPhi: number; dEta: number; dXi: number },
  steps: number
): { oh: number; phi: number; eta: number; xi: number; def: number }[] {
  const trajectory: { oh: number; phi: number; eta: number; xi: number; def: number }[] = [];

  let oh = baseOh;
  let phi = basePhi;
  let eta = baseEta;
  let xi = baseXi;

  // Velocidades iniciais (combinação de momentum e cenário)
  let vOh = momentum.dOh * 0.5 + scenario.ohDelta * 0.3;
  let vPhi = momentum.dPhi * 0.5 + scenario.phiDelta * 0.3;
  let vEta = momentum.dEta * 0.5 + scenario.etaDelta * 0.3;
  let vXi = momentum.dXi * 0.5 + scenario.xiDelta * 0.3;

  for (let i = 0; i < steps; i++) {
    const t = i / steps;

    // Decaimento adaptativo baseado na dificuldade do cenário
    const decay = Math.exp(-t * 0.4 * scenario.difficulty);

    // Aceleração do cenário
    const accelOh = scenario.ohDelta * decay * 0.12;
    const accelPhi = scenario.phiDelta * decay * 0.08;
    const accelEta = scenario.etaDelta * decay * 0.06;
    const accelXi = scenario.xiDelta * decay * 0.1;

    // Atualiza velocidades
    vOh = vOh * 0.92 + accelOh;
    vPhi = vPhi * 0.94 + accelPhi;
    vEta = vEta * 0.95 + accelEta;
    vXi = vXi * 0.93 + accelXi;

    // Feedback não-linear
    // Alta pressão (Oh > 1) tende a auto-reforçar
    if (oh > 1.0) {
      vOh += (oh - 1) * 0.025 * (vOh > 0 ? 1.2 : 0.6);
    }
    // Baixa pressão tende a estabilizar
    if (oh < 0.9) {
      vOh += (0.95 - oh) * 0.015;
    }
    // Alta rigidez dificulta mudanças
    const rigidityFactor = 1 - (eta - 0.3) * 0.3;
    vOh *= rigidityFactor;
    vXi *= rigidityFactor;

    // Atualiza posições
    oh += vOh;
    phi += vPhi;
    eta += vEta;
    xi += vXi;

    // Ruído sutil para variação
    const noise = Math.sin(i * 1.7 + baseOh * 10) * 0.008;
    oh += noise;
    xi += noise * 0.5;

    // Limites físicos com suavização
    oh = Math.max(0.5, Math.min(1.8, oh));
    phi = Math.max(0, Math.min(0.5, phi));
    eta = Math.max(0.2, Math.min(0.6, eta));
    xi = Math.max(0.5, Math.min(1.5, xi));

    // DEF é déficit estrutural derivado de Oh
    const def = Math.max(0, oh - 1);

    trajectory.push({ oh, phi, eta, xi, def });
  }

  return trajectory;
}

// Simula trajetória com perturbação do usuário
function simulateUserPerturbation(
  baseOh: number,
  basePhi: number,
  baseEta: number,
  baseXi: number,
  perturbation: UserPerturbation,
  momentum: { dOh: number; dPhi: number; dEta: number; dXi: number },
  steps: number
): { oh: number; phi: number; eta: number; xi: number; def: number }[] {
  const trajectory: { oh: number; phi: number; eta: number; xi: number; def: number }[] = [];

  // Aplica perturbação inicial do usuário
  let oh = baseOh + (perturbation.oh.enabled ? perturbation.oh.delta : 0);
  let phi = basePhi + (perturbation.phi.enabled ? perturbation.phi.delta : 0);
  let eta = baseEta + (perturbation.eta.enabled ? perturbation.eta.delta : 0);
  let xi = baseXi + (perturbation.xi.enabled ? perturbation.xi.delta : 0);

  // Velocidades iniciais (momentum natural + efeito da perturbação)
  let vOh = momentum.dOh * 0.7;
  let vPhi = momentum.dPhi * 0.7;
  let vEta = momentum.dEta * 0.7;
  let vXi = momentum.dXi * 0.7;

  for (let i = 0; i < steps; i++) {
    const t = i / steps;

    // Feedback não-linear do sistema
    // Alta pressão tende a crescer mais (ciclo de estresse)
    if (oh > 1.0) {
      vOh += (oh - 1) * 0.035;
    } else if (oh < 0.85) {
      // Sistema saudável tende a se manter
      vOh += (0.9 - oh) * 0.02;
    }

    // Rigidez alta dificulta mudanças
    const rigidityDamping = 1 - Math.max(0, (eta - 0.35)) * 0.4;
    vOh *= rigidityDamping;
    vXi *= rigidityDamping;

    // Memória alta cria inércia
    const memoryInertia = 1 + phi * 0.3;
    vOh *= (1 / memoryInertia) * 0.98 + 0.02;

    // Decaimento natural das velocidades
    vOh *= 0.94;
    vPhi *= 0.96;
    vEta *= 0.97;
    vXi *= 0.95;

    // Atualiza posições
    oh += vOh;
    phi += vPhi;
    eta += vEta;
    xi += vXi;

    // Acoplamento entre observáveis
    // Pressão alta aumenta rigidez
    if (oh > 1.1) {
      eta += (oh - 1.1) * 0.008;
    }
    // Diversidade baixa aumenta pressão
    if (xi < 0.8) {
      oh += (0.8 - xi) * 0.01;
    }

    // Limites físicos
    oh = Math.max(0.5, Math.min(1.8, oh));
    phi = Math.max(0, Math.min(0.5, phi));
    eta = Math.max(0.2, Math.min(0.6, eta));
    xi = Math.max(0.5, Math.min(1.5, xi));

    // DEF é déficit estrutural derivado de Oh
    const def = Math.max(0, oh - 1);

    trajectory.push({ oh, phi, eta, xi, def });
  }

  return trajectory;
}

// Componente de trajetórias futuras
// Cone de incerteza translúcido que envolve as trajetórias possíveis
function UncertaintyCone({
  trajectories,
}: {
  trajectories: { points: Vec3[] }[];
}) {
  const geometry = useMemo(() => {
    if (trajectories.length === 0) return null;
    
    const steps = trajectories[0].points.length;
    if (steps < 2) return null;

    // 1. Calcular centróide (média) e raio (dispersão) para cada passo t
    const centroids: Vec3[] = [];
    const radii: number[] = [];

    for (let t = 0; t < steps; t++) {
      let sumX = 0, sumY = 0, sumZ = 0;
      
      // Média
      trajectories.forEach(traj => {
        const p = traj.points[t];
        sumX += p[0];
        sumY += p[1];
        sumZ += p[2];
      });
      
      const cx = sumX / trajectories.length;
      const cy = sumY / trajectories.length;
      const cz = sumZ / trajectories.length;
      centroids.push([cx, cy, cz]);

      // Raio (máxima distância do centro ou desvio padrão escalado)
      let maxDistSq = 0;
      trajectories.forEach(traj => {
        const p = traj.points[t];
        const distSq = (p[0]-cx)**2 + (p[1]-cy)**2 + (p[2]-cz)**2;
        if (distSq > maxDistSq) maxDistSq = distSq;
      });
      
      // Raio mínimo visual para não sumir no início + dispersão
      radii.push(Math.sqrt(maxDistSq) + 0.02); 
    }

    // 2. Construir malha do tubo (manualmente)
    const radialSegments = 16;
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    for (let t = 0; t < steps; t++) {
      const center = centroids[t];
      const radius = radii[t];
      
      // Calcular frame de referência (tangente, normal, binormal) para o anel
      // Tangente aproximada
      const prev = centroids[Math.max(0, t - 1)];
      const next = centroids[Math.min(steps - 1, t + 1)];
      const tx = next[0] - prev[0];
      const ty = next[1] - prev[1];
      const tz = next[2] - prev[2];
      
      // Normalização segura
      const len = Math.sqrt(tx*tx + ty*ty + tz*tz) || 1;
      const T = new THREE.Vector3(tx/len, ty/len, tz/len);
      
      // Vetor arbitrário para cruzar (Up ou Right)
      let U = new THREE.Vector3(0, 1, 0);
      if (Math.abs(T.y) > 0.99) U = new THREE.Vector3(1, 0, 0);
      
      const R = new THREE.Vector3().crossVectors(T, U).normalize();
      const S = new THREE.Vector3().crossVectors(R, T).normalize(); // Binormal real

      // Gerar anel de vértices
      for (let j = 0; j <= radialSegments; j++) {
        const theta = (j / radialSegments) * Math.PI * 2;
        const sin = Math.sin(theta);
        const cos = Math.cos(theta);
        
        // Posição no anel: Center + Radius * (R*cos + S*sin)
        const px = center[0] + radius * (R.x * cos + S.x * sin);
        const py = center[1] + radius * (R.y * cos + S.y * sin);
        const pz = center[2] + radius * (R.z * cos + S.z * sin);
        
        vertices.push(px, py, pz);
        
        // Normal (aprox: apenas radial)
        const nx = R.x * cos + S.x * sin;
        const ny = R.y * cos + S.y * sin;
        const nz = R.z * cos + S.z * sin;
        normals.push(nx, ny, nz);
        
        uvs.push(j / radialSegments, t / (steps - 1));
      }
    }

    // Gerar índices (triângulos entre anéis)
    for (let t = 0; t < steps - 1; t++) {
      const rowSize = radialSegments + 1;
      const currentRingStart = t * rowSize;
      const nextRingStart = (t + 1) * rowSize;
      
      for (let j = 0; j < radialSegments; j++) {
        const v0 = currentRingStart + j;
        const v1 = currentRingStart + j + 1;
        const v2 = nextRingStart + j;
        const v3 = nextRingStart + j + 1;
        
        // Triângulo 1
        indices.push(v0, v2, v1);
        // Triângulo 2
        indices.push(v1, v2, v3);
      }
    }

    const bufGeo = new THREE.BufferGeometry();
    bufGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    bufGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    bufGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    bufGeo.setIndex(indices);
    
    return bufGeo;
  }, [trajectories]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial 
        color="#06b6d4" // Cyan
        transparent 
        opacity={0.25} 
        side={THREE.DoubleSide} 
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function FutureTrajectories({
  data,
  timeIndex,
  projection,
  visible,
  showCone = true,
  stepsAhead = 12,
  userPerturbation,
}: {
  data: StructuralTimePoint[];
  timeIndex: number;
  projection: ProjectionConfig;
  visible: boolean;
  showCone?: boolean;
  stepsAhead?: number;
  userPerturbation?: UserPerturbation;
}) {
  const linesRef = useRef<THREE.Line[]>([]);

  // Verifica se há perturbação ativa do usuário
  const hasUserPerturbation = userPerturbation && (
    (userPerturbation.oh.enabled && userPerturbation.oh.delta !== 0) ||
    (userPerturbation.phi.enabled && userPerturbation.phi.delta !== 0) ||
    (userPerturbation.eta.enabled && userPerturbation.eta.delta !== 0) ||
    (userPerturbation.xi.enabled && userPerturbation.xi.delta !== 0)
  );

  // Calcula posições das trajetórias futuras
  const futureData = useMemo(() => {
    if (!visible || data.length === 0) return [];

    const clampedIndex = Math.max(0, Math.min(data.length - 1, timeIndex));
    const currentPoint = data[clampedIndex];

    // Estado atual
    const baseOh = currentPoint.state.oh;
    const basePhi = currentPoint.state.phi;
    const baseEta = currentPoint.state.eta;
    const baseXi = currentPoint.state.xi ?? 0.9;

    // Calcula momentum (tendência recente)
    const momentum = computeMomentum(data, clampedIndex, 4);

    // Regime atual
    const currentRegimeInfo = classifyRegime(baseOh, basePhi, baseEta, baseXi);
    const currentRegime = currentPoint.regime?.label ?? currentRegimeInfo.label;

    // Posição atual em 3D
    const currentPos3D = project5Dto3D(currentPoint.state, currentPoint.phase, projection);

    // Para normalização, precisamos das estatísticas do dataset original
    const allRaw3D = data.map((p) => project5Dto3D(p.state, p.phase, projection));
    const xs = allRaw3D.map((p) => p[0]);
    const ys = allRaw3D.map((p) => p[1]);
    const zs = allRaw3D.map((p) => p[2]);

    const statsX: AxisStats = { min: Math.min(...xs), max: Math.max(...xs) };
    const statsY: AxisStats = { min: Math.min(...ys), max: Math.max(...ys) };
    const statsZ: AxisStats = { min: Math.min(...zs), max: Math.max(...zs) };

    // Normaliza posição atual
    const normalizedCurrent: Vec3 = [
      normalizeScalar(currentPos3D[0], statsX),
      normalizeScalar(currentPos3D[1], statsY),
      normalizeScalar(currentPos3D[2], statsZ),
    ];

    // Gera trajetórias
    const trajectories: {
      points: Vec3[];
      colors: string[];
      finalRegime: string;
      scenarioLabel: string;
      isUserDefined: boolean;
    }[] = [];

    // Se há perturbação do usuário, mostra apenas essa trajetória (destacada)
    if (hasUserPerturbation && userPerturbation) {
      const futureStates = simulateUserPerturbation(
        baseOh, basePhi, baseEta, baseXi,
        userPerturbation,
        momentum,
        stepsAhead
      );

      const points: Vec3[] = [normalizedCurrent];
      const colors: string[] = [];
      colors.push(currentRegimeInfo.color);

      futureStates.forEach((state, i) => {
        const fakePoint: StructuralTimePoint = {
          t: timeIndex + i + 1,
          state: { oh: state.oh, phi: state.phi, eta: state.eta, xi: state.xi, def: state.def },
          phase: { doh: 0, dphi: (state.phi - basePhi) / (i + 1), deta: 0, dxi: 0, ddef: 0 },
        };

        const raw3D = project5Dto3D(fakePoint.state, fakePoint.phase, projection);
        const normalized: Vec3 = [
          normalizeScalar(raw3D[0], { ...statsX, min: statsX.min * 0.6, max: statsX.max * 1.4 }),
          normalizeScalar(raw3D[1], { ...statsY, min: statsY.min * 0.6, max: statsY.max * 1.4 }),
          normalizeScalar(raw3D[2], { ...statsZ, min: statsZ.min * 0.6, max: statsZ.max * 1.4 }),
        ];
        points.push(normalized);

        const regime = classifyRegime(state.oh, state.phi, state.eta, state.xi);
        colors.push(regime.color);
      });

      const lastState = futureStates[futureStates.length - 1];
      const finalRegime = classifyRegime(lastState.oh, lastState.phi, lastState.eta, lastState.xi);

      trajectories.push({
        points,
        colors,
        finalRegime: finalRegime.label,
        scenarioLabel: "user_defined",
        isUserDefined: true,
      });

      // Também mostra a trajetória "natural" (sem perturbação) para comparação
      const naturalPerturbation: UserPerturbation = {
        oh: { enabled: false, delta: 0 },
        phi: { enabled: false, delta: 0 },
        eta: { enabled: false, delta: 0 },
        xi: { enabled: false, delta: 0 },
      };
      const naturalStates = simulateUserPerturbation(
        baseOh, basePhi, baseEta, baseXi,
        naturalPerturbation,
        momentum,
        stepsAhead
      );

      const naturalPoints: Vec3[] = [normalizedCurrent];
      const naturalColors: string[] = [];
      naturalColors.push(currentRegimeInfo.color);

      naturalStates.forEach((state, i) => {
        const fakePoint: StructuralTimePoint = {
          t: timeIndex + i + 1,
          state: { oh: state.oh, phi: state.phi, eta: state.eta, xi: state.xi, def: state.def },
          phase: { doh: 0, dphi: (state.phi - basePhi) / (i + 1), deta: 0, dxi: 0, ddef: 0 },
        };

        const raw3D = project5Dto3D(fakePoint.state, fakePoint.phase, projection);
        const normalized: Vec3 = [
          normalizeScalar(raw3D[0], { ...statsX, min: statsX.min * 0.6, max: statsX.max * 1.4 }),
          normalizeScalar(raw3D[1], { ...statsY, min: statsY.min * 0.6, max: statsY.max * 1.4 }),
          normalizeScalar(raw3D[2], { ...statsZ, min: statsZ.min * 0.6, max: statsZ.max * 1.4 }),
        ];
        naturalPoints.push(normalized);

        const regime = classifyRegime(state.oh, state.phi, state.eta, state.xi);
        naturalColors.push(regime.color);
      });

      const naturalLastState = naturalStates[naturalStates.length - 1];
      const naturalFinalRegime = classifyRegime(naturalLastState.oh, naturalLastState.phi, naturalLastState.eta, naturalLastState.xi);

      trajectories.push({
        points: naturalPoints,
        colors: naturalColors,
        finalRegime: naturalFinalRegime.label,
        scenarioLabel: "natural",
        isUserDefined: false,
      });

    } else {
      // Sem perturbação do usuário: mostra cenários dinâmicos automáticos
      const dynamicScenarios = generateDynamicScenarios(
        baseOh, basePhi, baseEta, baseXi,
        momentum,
        currentRegime
      );

      dynamicScenarios.forEach((scenario) => {
        const futureStates = simulateFutureAdaptive(
          baseOh, basePhi, baseEta, baseXi,
          scenario,
          momentum,
          stepsAhead
        );

        const points: Vec3[] = [normalizedCurrent];
        const colors: string[] = [];
        colors.push(currentRegimeInfo.color);

        futureStates.forEach((state, i) => {
          const fakePoint: StructuralTimePoint = {
            t: timeIndex + i + 1,
            state: { oh: state.oh, phi: state.phi, eta: state.eta, xi: state.xi, def: state.def },
            phase: { doh: 0, dphi: (state.phi - basePhi) / (i + 1), deta: 0, dxi: 0, ddef: 0 },
          };

          const raw3D = project5Dto3D(fakePoint.state, fakePoint.phase, projection);
          const normalized: Vec3 = [
            normalizeScalar(raw3D[0], { ...statsX, min: statsX.min * 0.7, max: statsX.max * 1.3 }),
            normalizeScalar(raw3D[1], { ...statsY, min: statsY.min * 0.7, max: statsY.max * 1.3 }),
            normalizeScalar(raw3D[2], { ...statsZ, min: statsZ.min * 0.7, max: statsZ.max * 1.3 }),
          ];
          points.push(normalized);

          const regime = classifyRegime(state.oh, state.phi, state.eta, state.xi);
          colors.push(regime.color);
        });

        const lastState = futureStates[futureStates.length - 1];
        const finalRegime = classifyRegime(lastState.oh, lastState.phi, lastState.eta, lastState.xi);

        trajectories.push({
          points,
          colors,
          finalRegime: finalRegime.label,
          scenarioLabel: scenario.label,
          isUserDefined: false,
        });
      });
    }

    return trajectories;
  }, [data, timeIndex, projection, visible, stepsAhead, userPerturbation, hasUserPerturbation]);

  // Anima opacidade pulsante
  useFrame((state) => {
    if (!visible) return;

    const time = state.clock.elapsedTime;

    linesRef.current.forEach((line, idx) => {
      if (!line) return;

      const material = line.material as THREE.LineBasicMaterial;
      if (material) {
        // Pulso sutil de opacidade
        const pulse = 0.3 + Math.sin(time * 1.5 + idx * 0.5) * 0.15;
        material.opacity = pulse;
      }
    });
  });

  if (!visible || futureData.length === 0) return null;

  return (
    <group>
      {/* 1. O Cone de Incerteza (Tubo Envolvente) */}
      {showCone && <UncertaintyCone trajectories={futureData} />}

      {/* 2. Linhas finas internas para detalhe (opcional, mantendo sutis) */}
      {futureData.map((traj, idx) => {
        const lineGeo = new THREE.BufferGeometry().setFromPoints(
          traj.points.map(p => new THREE.Vector3(p[0], p[1], p[2]))
        );
        
        const isUserLine = traj.isUserDefined && traj.scenarioLabel === "user_defined";
        // Se for linha do usuário, destaca. Se for automática, deixa muito sutil dentro do cone.
        const opacity = isUserLine ? 0.9 : 0.1;
        const color = isUserLine ? "#ffffff" : "#06b6d4";
        const lineWidth = isUserLine ? 2 : 1;

        return (
          <line key={idx}>
            <primitive object={lineGeo} attach="geometry" />
            <lineBasicMaterial 
              color={color} 
              transparent 
              opacity={opacity} 
              linewidth={lineWidth}
            />
          </line>
        );
      })}
      
      {/* Ponto final da média (apenas para referência visual) */}
      {futureData.length > 0 && futureData[0].points.length > 0 && (
        <mesh position={futureData[0].points[futureData[0].points.length - 1]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshBasicMaterial color="#06b6d4" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function RadiantScene5D({
  data,
  projection,
  timeIndex,
  calm,
  showFlow,
  showParticles,
  showEvents,
  showFutures = false,
  showCone = true,
  userPerturbation,
  showGeoid = true,
  onFlowProgress,
}: RadiantSceneProps) {
  const { positions, velocities, turbulence } = useMemo(() => {
    const basePositions = buildPositions3D(data, projection);
    const smoothed = smoothSeries(basePositions, calm, 3);
    const vels = buildVelocities(smoothed);
    const velsSmooth = smoothSeries(vels, calm, 2);
    const { turbulence: turb } = computeLaminarity(velsSmooth);

    return {
      positions: smoothed,
      velocities: velsSmooth,
      turbulence: turb,
    };
  }, [data, projection, calm]);

  return (
    <Canvas
      camera={{
        position: [GEOID_RADIUS * 2, GEOID_RADIUS * 2, GEOID_RADIUS * 2],
        fov: 45,
      }}
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        inset: 0,
        display: "block",
      }}
    >
      <color attach="background" args={["#020617"]} />

      <ambientLight intensity={0.55} />
      <pointLight position={[5, 5, 5]} intensity={1.2} />
      <pointLight position={[-5, -5, -5]} intensity={0.5} color="#38bdf8" />

      <GeoidHelper showParticles={showGeoid} />

      <PointsAndTrajectory
        data={data}
        positions={positions}
        timeIndex={timeIndex}
        showEvents={showEvents}
      />

      <FlowRibbon positions={positions} visible={false} />

      <FlowPulses
        positions={positions}
        velocities={velocities}
        turbulence={turbulence}
        visible={showFlow}
        pulseCount={4}
      />

      <FlowWaveLines
        positions={positions}
        velocities={velocities}
        turbulence={turbulence}
        visible={showFlow}
        onProgress={onFlowProgress}
      />

      <FutureTrajectories
        data={data}
        timeIndex={timeIndex}
        projection={projection}
        visible={!!showFutures}
        showCone={showCone}
        userPerturbation={showFutures ? userPerturbation : undefined}
      />

      <OrbitControls enableDamping dampingFactor={0.15} />
    </Canvas>
  );
}

// Exportar projeções preset para uso na UI
export { PRESET_PROJECTIONS };
