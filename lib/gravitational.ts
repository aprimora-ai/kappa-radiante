/**
 * SUB-OBSERVÁVEL GRAVITACIONAL (Ψ) PARA O RADIANTE PENTADIMENSIONAL
 *
 * Formalização matemática do potencial estrutural e custo de movimento.
 * Baseado na teoria de campos conservativos aplicada ao espaço de estados.
 *
 * Referência: Documento "Formalização Gravitacional" (03/02/2026)
 */

import { StateVector5D } from "./pentadimensional";

// ============================================================================
// TIPOS E CONFIGURAÇÃO
// ============================================================================

/**
 * Parâmetros do campo gravitacional
 */
export type GravitationalConfig = {
  /** Gravidade base (g₀) - sempre ativa */
  g0: number;

  /** Gravidade emergente - pesos para cada observável */
  emergent: {
    alpha_eta: number;   // Contribuição de rigidez
    alpha_phi: number;   // Contribuição de memória
    alpha_def: number;   // Contribuição de déficit
    alpha_oh: number;    // Contribuição de pressão
  };

  /** Escolha de altura gravitacional */
  heightAxis: "def" | "oh" | "combined";

  /** Modo de cálculo */
  mode: "external" | "emergent";
};

/**
 * Métricas gravitacionais computadas
 */
export type GravitationalMetrics = {
  /** Potencial gravitacional atual Ψ(r_t) */
  potential: number;

  /** Gravidade efetiva g_eff(t) */
  g_effective: number;

  /** Custo instantâneo Γ_t = max(0, ΔΨ) */
  cost_instantaneous: number;

  /** Trabalho acumulado contra gravidade */
  work_accumulated: number;

  /** Altura gravitacional normalizada */
  height_normalized: number;
};

/**
 * Resultado de análise gravitacional em trajetória
 */
export type TrajectoryGravitationalAnalysis = {
  /** Métricas por passo temporal */
  steps: GravitationalMetrics[];

  /** Trabalho total Γ₀:T */
  total_work: number;

  /** Altura máxima atingida */
  max_height: number;

  /** Número de "subidas" (Γ_t > 0) */
  ascent_count: number;

  /** Número de "descidas" (ΔΨ < 0) */
  descent_count: number;

  /** Potencial médio */
  mean_potential: number;
};

// ============================================================================
// CONFIGURAÇÃO PADRÃO
// ============================================================================

/**
 * Configuração padrão calibrada para educação
 *
 * Calibração:
 * - g₀ = 0.15: Base suficiente para criar assimetria sem travar sistema
 * - α_def = 0.30: DEF é o driver principal (déficit estrutural)
 * - α_oh = 0.25: Pressão contribui moderadamente
 * - α_eta = 0.10: Rigidez tem efeito menor (já tratada contextualmente)
 * - α_phi = 0.05: Memória tem efeito mínimo (pode ser inércia boa)
 */
export const DEFAULT_GRAVITATIONAL_CONFIG: GravitationalConfig = {
  g0: 0.15,
  emergent: {
    alpha_eta: 0.10,
    alpha_phi: 0.05,
    alpha_def: 0.30,
    alpha_oh: 0.25,
  },
  heightAxis: "combined",  // DEF + Oh/2
  mode: "emergent",
};

/**
 * Configuração alternativa: gravidade externa simples
 */
export const EXTERNAL_GRAVITY_CONFIG: GravitationalConfig = {
  g0: 0.20,
  emergent: {
    alpha_eta: 0,
    alpha_phi: 0,
    alpha_def: 0,
    alpha_oh: 0,
  },
  heightAxis: "def",
  mode: "external",
};

/**
 * Configuração para Finanças (mercados voláteis)
 */
export const FINANCE_GRAVITATIONAL_CONFIG: GravitationalConfig = {
  g0: 0.25,
  emergent: {
    alpha_eta: 0.15,
    alpha_phi: 0.20,
    alpha_def: 0.25,
    alpha_oh: 0.35,
  },
  heightAxis: "combined",
  mode: "emergent",
};

// ============================================================================
// FUNÇÕES CORE
// ============================================================================

/**
 * Computa gravidade efetiva g_eff(t) baseada no estado estrutural
 *
 * Fórmula:
 *   g_eff(t) = g₀ + α_η·η_t + α_Φ·Φ_t + α_D·DEF_t + α_Oh·max(0, Oh_t - 1)
 *
 * Interpretação:
 * - Em Nagare (baixo η, baixo DEF): gravidade fraca, fácil adaptar
 * - Em Katashi (alto η, alto DEF): gravidade forte, difícil escapar
 */
export function computeEffectiveGravity(
  state: StateVector5D,
  config: GravitationalConfig = DEFAULT_GRAVITATIONAL_CONFIG
): number {
  if (config.mode === "external") {
    return config.g0;
  }

  const { g0, emergent } = config;
  const { alpha_eta, alpha_phi, alpha_def, alpha_oh } = emergent;

  // Componentes
  const g_base = g0;
  const g_rigidity = alpha_eta * state.eta;
  const g_memory = alpha_phi * state.phi;
  const g_deficit = alpha_def * state.def;
  const g_pressure = alpha_oh * Math.max(0, state.oh - 1.0);

  // Gravidade efetiva (sempre não-negativa)
  const g_eff = Math.max(0, g_base + g_rigidity + g_memory + g_deficit + g_pressure);

  return g_eff;
}

/**
 * Extrai altura gravitacional do estado
 *
 * Opções:
 * - "def": Apenas déficit estrutural
 * - "oh": Apenas pressão (quando Oh > 1)
 * - "combined": DEF + (Oh - 1)/2 quando Oh > 1
 */
export function extractHeight(
  state: StateVector5D,
  axis: "def" | "oh" | "combined" = "combined"
): number {
  switch (axis) {
    case "def":
      return state.def;

    case "oh":
      return Math.max(0, state.oh - 1.0);

    case "combined":
      // DEF principal + contribuição de Oh quando excede 1
      return state.def + Math.max(0, state.oh - 1.0) * 0.5;

    default:
      return state.def;
  }
}

/**
 * Computa potencial gravitacional Ψ(r_t)
 *
 * Fórmula:
 *   Ψ(r_t) = g_eff(t) · z_t
 *
 * onde z_t é a altura gravitacional extraída
 */
export function computePotential(
  state: StateVector5D,
  config: GravitationalConfig = DEFAULT_GRAVITATIONAL_CONFIG
): number {
  const g_eff = computeEffectiveGravity(state, config);
  const height = extractHeight(state, config.heightAxis);

  return g_eff * height;
}

/**
 * Computa custo instantâneo Γ_t entre dois estados
 *
 * Fórmula:
 *   Γ_t = max(0, Ψ(r_{t+1}) - Ψ(r_t))
 *
 * Interpretação:
 * - Γ_t > 0: Subida (trabalho contra gravidade)
 * - Γ_t = 0: Descida ou lateral (sem custo)
 */
export function computeInstantaneousCost(
  stateCurrent: StateVector5D,
  stateNext: StateVector5D,
  config: GravitationalConfig = DEFAULT_GRAVITATIONAL_CONFIG
): number {
  const psi_current = computePotential(stateCurrent, config);
  const psi_next = computePotential(stateNext, config);

  const delta_psi = psi_next - psi_current;

  return Math.max(0, delta_psi);
}

/**
 * Computa métricas gravitacionais completas para um par de estados
 */
export function computeGravitationalStep(
  stateCurrent: StateVector5D,
  stateNext: StateVector5D,
  workAccumulated: number,
  config: GravitationalConfig = DEFAULT_GRAVITATIONAL_CONFIG
): GravitationalMetrics {
  const potential = computePotential(stateNext, config);
  const g_effective = computeEffectiveGravity(stateNext, config);
  const cost_instantaneous = computeInstantaneousCost(stateCurrent, stateNext, config);
  const height_normalized = extractHeight(stateNext, config.heightAxis);

  return {
    potential,
    g_effective,
    cost_instantaneous,
    work_accumulated: workAccumulated + cost_instantaneous,
    height_normalized,
  };
}

/**
 * Analisa trajetória completa computando sub-observável gravitacional
 *
 * Retorna análise detalhada incluindo trabalho total e padrões de movimento
 */
export function analyzeTrajectoryGravitational(
  trajectory: StateVector5D[],
  config: GravitationalConfig = DEFAULT_GRAVITATIONAL_CONFIG
): TrajectoryGravitationalAnalysis {
  if (trajectory.length < 2) {
    // Trajetória muito curta
    const pot = trajectory.length > 0 ? computePotential(trajectory[0], config) : 0;
    return {
      steps: [{
        potential: pot,
        g_effective: trajectory.length > 0 ? computeEffectiveGravity(trajectory[0], config) : 0,
        cost_instantaneous: 0,
        work_accumulated: 0,
        height_normalized: trajectory.length > 0 ? extractHeight(trajectory[0], config.heightAxis) : 0,
      }],
      total_work: 0,
      max_height: trajectory.length > 0 ? extractHeight(trajectory[0], config.heightAxis) : 0,
      ascent_count: 0,
      descent_count: 0,
      mean_potential: pot,
    };
  }

  const steps: GravitationalMetrics[] = [];
  let workAccumulated = 0;
  let maxHeight = 0;
  let ascentCount = 0;
  let descentCount = 0;
  let potentialSum = 0;

  // Primeiro estado (t=0)
  const initialPotential = computePotential(trajectory[0], config);
  const initialHeight = extractHeight(trajectory[0], config.heightAxis);

  steps.push({
    potential: initialPotential,
    g_effective: computeEffectiveGravity(trajectory[0], config),
    cost_instantaneous: 0,
    work_accumulated: 0,
    height_normalized: initialHeight,
  });

  potentialSum += initialPotential;
  maxHeight = initialHeight;

  // Estados subsequentes
  for (let t = 1; t < trajectory.length; t++) {
    const stateCurrent = trajectory[t - 1];
    const stateNext = trajectory[t];

    const metrics = computeGravitationalStep(stateCurrent, stateNext, workAccumulated, config);
    steps.push(metrics);

    workAccumulated = metrics.work_accumulated;
    potentialSum += metrics.potential;
    maxHeight = Math.max(maxHeight, metrics.height_normalized);

    // Contadores
    if (metrics.cost_instantaneous > 1e-6) {
      ascentCount++;
    }

    const deltaPsi = metrics.potential - steps[t - 1].potential;
    if (deltaPsi < -1e-6) {
      descentCount++;
    }
  }

  return {
    steps,
    total_work: workAccumulated,
    max_height: maxHeight,
    ascent_count: ascentCount,
    descent_count: descentCount,
    mean_potential: potentialSum / trajectory.length,
  };
}

// ============================================================================
// UTILITÁRIOS PARA CALIBRAÇÃO
// ============================================================================

/**
 * Sugestão de calibração baseada em distribuição de estados
 *
 * Analisa trajetórias históricas e sugere g₀ que resulta em
 * trabalho médio razoável (nem trava, nem ignora)
 */
export function suggestCalibration(
  trajectories: StateVector5D[][],
  targetWorkRatio: number = 0.3
): Partial<GravitationalConfig> {
  // Calcula altura média e variação
  let heightSum = 0;
  let heightCount = 0;

  for (const traj of trajectories) {
    for (const state of traj) {
      heightSum += extractHeight(state, "combined");
      heightCount++;
    }
  }

  const meanHeight = heightCount > 0 ? heightSum / heightCount : 0.5;

  // g₀ sugerido para atingir trabalho alvo
  // Heurística: g₀ ≈ targetWorkRatio / meanHeight
  const suggested_g0 = Math.max(0.05, Math.min(0.50, targetWorkRatio / (meanHeight + 0.01)));

  return {
    g0: suggested_g0,
    mode: "emergent",
  };
}

// ============================================================================
// INTEGRAÇÃO COM RIE
// ============================================================================

/**
 * Adiciona penalização gravitacional ao score de utility
 *
 * Uso no RIE:
 *   u_total = ... - w_gravity * (Γ_total / steps)
 *
 * onde w_gravity é um peso configurável (ex: 0.05-0.15)
 */
export function computeGravitationalPenalty(
  analysis: TrajectoryGravitationalAnalysis,
  weight: number = 0.10
): number {
  const steps = analysis.steps.length;
  const avgWorkPerStep = steps > 1 ? analysis.total_work / (steps - 1) : 0;

  return weight * avgWorkPerStep;
}

/**
 * Diagnóstico: verifica se gravidade está "travando" o sistema
 */
export function diagnoseGravitationalLock(
  analysis: TrajectoryGravitationalAnalysis,
  threshold: number = 0.8
): {
  isLocked: boolean;
  reason: string;
  suggestion: string;
} {
  const ascentRatio = analysis.steps.length > 1
    ? analysis.ascent_count / (analysis.steps.length - 1)
    : 0;

  const descentRatio = analysis.steps.length > 1
    ? analysis.descent_count / (analysis.steps.length - 1)
    : 0;

  // Sistema travado se quase não há descidas e trabalho é alto
  if (descentRatio < 0.1 && analysis.total_work > threshold) {
    return {
      isLocked: true,
      reason: `Sistema travado: ${(descentRatio * 100).toFixed(0)}% descidas, trabalho ${analysis.total_work.toFixed(2)}`,
      suggestion: "Reduza g₀ ou pesos emergentes (α_def, α_oh)"
    };
  }

  // Sistema sem resistência se trabalho muito baixo
  if (analysis.total_work < 0.01) {
    return {
      isLocked: false,
      reason: "Gravidade muito fraca, sem resistência",
      suggestion: "Aumente g₀ para criar assimetria estrutural"
    };
  }

  return {
    isLocked: false,
    reason: `Sistema equilibrado: ${(ascentRatio * 100).toFixed(0)}% subidas, ${(descentRatio * 100).toFixed(0)}% descidas`,
    suggestion: "Calibração adequada"
  };
}

// ============================================================================
// TIPOS PARA INTEGRAÇÃO COM RIE
// ============================================================================

/**
 * Métricas gravitacionais agregadas para o bundle RIE
 */
export type GravitationalBundle = {
  /** Trabalho total Γ₀:T */
  totalWork: number;

  /** Trabalho médio por passo */
  avgWorkPerStep: number;

  /** Altura máxima atingida */
  maxHeight: number;

  /** Razão de ascensos (subidas / total) */
  ascentRatio: number;

  /** Razão de descensos */
  descentRatio: number;

  /** Potencial médio */
  meanPotential: number;

  /** Gravidade efetiva média */
  meanGravity: number;

  /** Diagnóstico de lock */
  lockDiagnosis: {
    isLocked: boolean;
    reason: string;
  };
};

/**
 * Cria bundle gravitacional a partir de análise de trajetória
 */
export function createGravitationalBundle(
  analysis: TrajectoryGravitationalAnalysis
): GravitationalBundle {
  const steps = analysis.steps.length;
  const diagnosis = diagnoseGravitationalLock(analysis);

  // Gravidade média
  const meanGravity = steps > 0
    ? analysis.steps.reduce((sum, s) => sum + s.g_effective, 0) / steps
    : 0;

  return {
    totalWork: analysis.total_work,
    avgWorkPerStep: steps > 1 ? analysis.total_work / (steps - 1) : 0,
    maxHeight: analysis.max_height,
    ascentRatio: steps > 1 ? analysis.ascent_count / (steps - 1) : 0,
    descentRatio: steps > 1 ? analysis.descent_count / (steps - 1) : 0,
    meanPotential: analysis.mean_potential,
    meanGravity,
    lockDiagnosis: {
      isLocked: diagnosis.isLocked,
      reason: diagnosis.reason,
    },
  };
}
