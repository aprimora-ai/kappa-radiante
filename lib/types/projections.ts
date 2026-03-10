/**
 * Projeções do espaço pentadimensional K(t) para visualização 3D
 * 
 * O Radiante opera em 5D, mas humanos visualizam em 3D.
 * Estas funções implementam projeções que preservam propriedades estruturais.
 */

import { StateVector, PhaseVector, RadiantPoint } from "./observables";

export type Vec3 = [number, number, number];
export type Vec5 = [number, number, number, number, number];

/**
 * Modo de projeção
 */
export type ProjectionMode =
  | "instrument_oh_phi_eta"     // Clássico: Oh, Φ, η
  | "instrument_oh_xi_def"      // Diversidade: Oh, Ξ, DEF
  | "instrument_phi_eta_xi"     // Dinâmico: Φ, η, Ξ
  | "phase_oh_dphi_eta"         // Fase: Oh, ΔΦ, η
  | "pca"                       // PCA: primeira 3 componentes
  | "custom";                   // Customizado pelo usuário

/**
 * Configuração de projeção customizada
 */
export interface CustomProjection {
  x: keyof StateVector;
  y: keyof StateVector;
  z: keyof StateVector;
}

/**
 * Resultado de projeção
 */
export interface ProjectedPoint {
  position: Vec3;
  original: StateVector;
  t: number | string;
}

/**
 * Converte StateVector para Vec5
 */
function stateToVec5(state: StateVector): Vec5 {
  return [state.oh, state.phi, state.eta, state.xi, state.def];
}

/**
 * Converte Vec5 para StateVector
 */
function vec5ToState(vec: Vec5): StateVector {
  return {
    oh: vec[0],
    phi: vec[1],
    eta: vec[2],
    xi: vec[3],
    def: vec[4],
  };
}

/**
 * Projeção baseada em seleção de eixos
 */
function projectByAxes(
  state: StateVector,
  axes: [keyof StateVector, keyof StateVector, keyof StateVector]
): Vec3 {
  return [state[axes[0]], state[axes[1]], state[axes[2]]];
}

/**
 * Projeção PCA (Análise de Componentes Principais)
 * Encontra as 3 direções de maior variância nos dados
 */
function projectPCA(states: StateVector[]): ProjectedPoint[] {
  if (states.length === 0) return [];

  // Converter para matriz (n x 5)
  const data = states.map(stateToVec5);

  // Calcular média
  const mean: Vec5 = [0, 0, 0, 0, 0];
  for (const row of data) {
    for (let i = 0; i < 5; i++) {
      mean[i] += row[i];
    }
  }
  for (let i = 0; i < 5; i++) {
    mean[i] /= data.length;
  }

  // Centralizar dados
  const centered = data.map((row) => row.map((val, i) => val - mean[i]) as Vec5);

  // Matriz de covariância (5x5)
  const cov: number[][] = Array(5)
    .fill(0)
    .map(() => Array(5).fill(0));
  for (const row of centered) {
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        cov[i][j] += row[i] * row[j];
      }
    }
  }
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      cov[i][j] /= centered.length;
    }
  }

  // Simplificação: usar apenas os primeiros 3 eixos com maior variância diagonal
  // (PCA completo requer eigendecomposition, que é complexo)
  const variances = cov.map((row, i) => ({ idx: i, var: row[i] }));
  variances.sort((a, b) => b.var - a.var);
  const topIndices = variances.slice(0, 3).map((v) => v.idx);

  // Projetar
  return centered.map((row, idx) => ({
    position: [row[topIndices[0]], row[topIndices[1]], row[topIndices[2]]] as Vec3,
    original: states[idx],
    t: idx,
  }));
}

/**
 * Projeção para modo Fase (derivadas temporais)
 */
function projectPhase(
  points: RadiantPoint[],
  axes: [keyof StateVector, "dphi" | "doh" | "deta" | "dxi" | "ddef", keyof StateVector]
): ProjectedPoint[] {
  return points.map((point, idx) => {
    const prev = idx > 0 ? points[idx - 1] : point;

    // Calcular derivada se não fornecida
    const dphi = point.phase?.dphi ?? Math.max(0, point.state.phi - prev.state.phi);
    const doh = point.phase?.doh ?? (point.state.oh - prev.state.oh);
    const deta = point.phase?.deta ?? (point.state.eta - prev.state.eta);
    const dxi = point.phase?.dxi ?? (point.state.xi - prev.state.xi);
    const ddef = point.phase?.ddef ?? (point.state.def - prev.state.def);

    const derivatives = { dphi, doh, deta, dxi, ddef };

    return {
      position: [
        point.state[axes[0]],
        derivatives[axes[1]],
        point.state[axes[2]],
      ] as Vec3,
      original: point.state,
      t: point.t,
    };
  });
}

/**
 * Função principal de projeção
 */
export function projectToVisualization(
  points: RadiantPoint[],
  mode: ProjectionMode,
  customAxes?: CustomProjection
): ProjectedPoint[] {
  if (points.length === 0) return [];

  const states = points.map((p) => p.state);

  switch (mode) {
    case "instrument_oh_phi_eta":
      return states.map((state, idx) => ({
        position: [state.oh, state.phi, state.eta],
        original: state,
        t: points[idx].t,
      }));

    case "instrument_oh_xi_def":
      return states.map((state, idx) => ({
        position: [state.oh, state.xi, state.def],
        original: state,
        t: points[idx].t,
      }));

    case "instrument_phi_eta_xi":
      return states.map((state, idx) => ({
        position: [state.phi, state.eta, state.xi],
        original: state,
        t: points[idx].t,
      }));

    case "phase_oh_dphi_eta":
      return projectPhase(points, ["oh", "dphi", "eta"]);

    case "pca":
      return projectPCA(states);

    case "custom":
      if (!customAxes) {
        throw new Error("Custom projection requires axes configuration");
      }
      return states.map((state, idx) => ({
        position: projectByAxes(state, [customAxes.x, customAxes.y, customAxes.z]),
        original: state,
        t: points[idx].t,
      }));

    default:
      throw new Error(`Unknown projection mode: ${mode}`);
  }
}

/**
 * Metadados da projeção (para UI)
 */
export interface ProjectionMetadata {
  mode: ProjectionMode;
  axes: {
    x: { label: string; key: string };
    y: { label: string; key: string };
    z: { label: string; key: string };
  };
  description: string;
}

export const PROJECTION_METADATA: Record<ProjectionMode, ProjectionMetadata> = {
  instrument_oh_phi_eta: {
    mode: "instrument_oh_phi_eta",
    axes: {
      x: { label: "Oh (Homologia)", key: "oh" },
      y: { label: "Φ (Memória)", key: "phi" },
      z: { label: "η (Rigidez)", key: "eta" },
    },
    description: "Projeção clássica: pressão estrutural, memória e rigidez",
  },
  instrument_oh_xi_def: {
    mode: "instrument_oh_xi_def",
    axes: {
      x: { label: "Oh (Homologia)", key: "oh" },
      y: { label: "Ξ (Diversidade)", key: "xi" },
      z: { label: "DEF (Déficit)", key: "def" },
    },
    description: "Foco em diversidade e déficit estrutural",
  },
  instrument_phi_eta_xi: {
    mode: "instrument_phi_eta_xi",
    axes: {
      x: { label: "Φ (Memória)", key: "phi" },
      y: { label: "η (Rigidez)", key: "eta" },
      z: { label: "Ξ (Diversidade)", key: "xi" },
    },
    description: "Dinâmica: memória, rigidez e diversidade",
  },
  phase_oh_dphi_eta: {
    mode: "phase_oh_dphi_eta",
    axes: {
      x: { label: "Oh (Homologia)", key: "oh" },
      y: { label: "ΔΦ (Taxa de Memória)", key: "dphi" },
      z: { label: "η (Rigidez)", key: "eta" },
    },
    description: "Espaço de fase: evidencia transições",
  },
  pca: {
    mode: "pca",
    axes: {
      x: { label: "PC1", key: "pc1" },
      y: { label: "PC2", key: "pc2" },
      z: { label: "PC3", key: "pc3" },
    },
    description: "Análise de Componentes Principais (máxima variância)",
  },
  custom: {
    mode: "custom",
    axes: {
      x: { label: "Custom X", key: "custom_x" },
      y: { label: "Custom Y", key: "custom_y" },
      z: { label: "Custom Z", key: "custom_z" },
    },
    description: "Projeção customizada pelo usuário",
  },
};
