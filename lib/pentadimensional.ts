/**
 * Tipos e utilidades matemáticas para o Radiante Estrutural Pentadimensional
 * Baseado em: "O Radiante Estrutural: Navegando Transições de Regime via Observáveis Topológicos"
 */

// ============================================================================
// TIPOS FUNDAMENTAIS
// ============================================================================

/**
 * Vetor pentadimensional de observáveis canônicos K(t)
 * Conforme Definição 2.1 do paper
 */
export type StateVector5D = {
  oh: number;   // Oh - Homologia (pressão estrutural)
  phi: number;  // Φ - Memória (persistência temporal)
  eta: number;  // η - Rigidez (resistência à perturbação)
  xi: number;   // Ξ - Diversidade (entropia de caminhos)
  def: number;  // DEF - Déficit estrutural (divergência estado-fase)
};

/**
 * Derivadas temporais (modo Fase)
 */
export type PhaseVector5D = {
  doh: number;
  dphi: number;
  deta: number;
  dxi: number;
  ddef: number;
};

/**
 * Regimes estruturais conforme Seção 4.2 do paper
 */
export type RegimeLabel = "nagare" | "utsuroi" | "katashi";

export type RegimeClassification = {
  label: RegimeLabel;
  score: number;  // 0-1, confiança da classificação
  distances: {
    to_nagare: number;
    to_utsuroi: number;
    to_katashi: number;
  };
};

/**
 * Ponto no espaço-tempo estrutural
 */
export type StructuralTimePoint = {
  t: number | string;  // timestamp
  state: StateVector5D;
  phase?: PhaseVector5D;
  regime?: RegimeClassification;
};

/**
 * Eixos disponíveis para visualização
 */
export type AxisName = "oh" | "phi" | "eta" | "xi" | "def";

/**
 * Configuração de projeção 5D → 3D
 */
export type ProjectionConfig = {
  x_axis: AxisName;
  y_axis: AxisName;
  z_axis: AxisName;
  mode: "instrument" | "phase";  // usa state ou phase
};

// ============================================================================
// THRESHOLDS DE REGIME (Seção 4.2)
// ============================================================================

export const REGIME_THRESHOLDS = {
  // Nagare (流れ): Fluxo adaptativo
  nagare: {
    xi_min: 0.6,      // Alta diversidade
    eta_max: 0.4,     // Baixa rigidez
    def_max: 0.3,     // Baixo déficit
  },
  // Katashi (硬し): Cristalização rígida
  katashi: {
    eta_min: 0.6,     // Alta rigidez
    phi_min: 0.6,     // Alta memória
    xi_max: 0.4,      // Baixa diversidade
  },
  // Utsuroi (移ろい): Transicional
  // (definido implicitamente por não ser nem Nagare nem Katashi)
  
  // Pré-PNR (Seção 4.3)
  pre_pnr: {
    kappa_threshold: 0.8,  // Curvatura de regime
    oh_threshold: 0.85,    // Pressão estrutural crescente
  }
} as const;

// ============================================================================
// FUNÇÕES DE CLASSIFICAÇÃO
// ============================================================================

/**
 * Classifica regime baseado em geometria pentadimensional
 * Implementa critérios da Seção 4.2 do paper
 */
export function classifyRegime(state: StateVector5D): RegimeClassification {
  const { oh, phi, eta, xi, def } = state;
  
  // Distâncias aos centróides de regime (simplificado)
  const nagare_score = computeNagareScore(state);
  const katashi_score = computeKatashiScore(state);
  const utsuroi_score = 1 - Math.max(nagare_score, katashi_score);
  
  // Determinar regime dominante
  let label: RegimeLabel;
  let score: number;
  
  if (nagare_score > katashi_score && nagare_score > utsuroi_score) {
    label = "nagare";
    score = nagare_score;
  } else if (katashi_score > nagare_score && katashi_score > utsuroi_score) {
    label = "katashi";
    score = katashi_score;
  } else {
    label = "utsuroi";
    score = utsuroi_score;
  }
  
  return {
    label,
    score,
    distances: {
      to_nagare: 1 - nagare_score,
      to_utsuroi: 1 - utsuroi_score,
      to_katashi: 1 - katashi_score,
    }
  };
}

/**
 * Computa score de Nagare (0-1)
 * Alto quando: Ξ alto, η baixo, DEF baixo
 */
function computeNagareScore(state: StateVector5D): number {
  const { xi, eta, def } = state;
  const thresh = REGIME_THRESHOLDS.nagare;
  
  let score = 0;
  
  // Diversidade alta
  if (xi > thresh.xi_min) {
    score += (xi - thresh.xi_min) / (1 - thresh.xi_min);
  }
  
  // Rigidez baixa
  if (eta < thresh.eta_max) {
    score += (thresh.eta_max - eta) / thresh.eta_max;
  }
  
  // Déficit baixo
  if (def < thresh.def_max) {
    score += (thresh.def_max - def) / thresh.def_max;
  }
  
  return Math.min(score / 3, 1);
}

/**
 * Computa score de Katashi (0-1)
 * Alto quando: η alto, Φ alto, Ξ baixo
 */
function computeKatashiScore(state: StateVector5D): number {
  const { phi, eta, xi } = state;
  const thresh = REGIME_THRESHOLDS.katashi;
  
  let score = 0;
  
  // Rigidez alta
  if (eta > thresh.eta_min) {
    score += (eta - thresh.eta_min) / (1 - thresh.eta_min);
  }
  
  // Memória alta
  if (phi > thresh.phi_min) {
    score += (phi - thresh.phi_min) / (1 - thresh.phi_min);
  }
  
  // Diversidade baixa
  if (xi < thresh.xi_max) {
    score += (thresh.xi_max - xi) / thresh.xi_max;
  }
  
  return Math.min(score / 3, 1);
}

/**
 * Detecta proximidade ao Ponto de Não Retorno (PNR)
 * Retorna true se em estado pré-crítico
 */
export function detectPrePNR(
  trajectory: StructuralTimePoint[],
  currentIndex: number
): boolean {
  if (currentIndex < 3) return false;
  
  const current = trajectory[currentIndex].state;
  
  // Condição 1: Oh crescente e alto
  const oh_high = current.oh > REGIME_THRESHOLDS.pre_pnr.oh_threshold;
  
  // Condição 2: Curvatura de regime alta (simplificado aqui)
  const recent = trajectory.slice(Math.max(0, currentIndex - 3), currentIndex + 1);
  const kappa = estimateRegimeCurvature(recent);
  const kappa_high = kappa > REGIME_THRESHOLDS.pre_pnr.kappa_threshold;
  
  // Condição 3: Em Katashi ou Utsuroi (não Nagare)
  const regime = classifyRegime(current);
  const not_nagare = regime.label !== "nagare";
  
  return oh_high && kappa_high && not_nagare;
}

/**
 * Estima curvatura de regime κ(t) baseado em trajetória recente
 * Simplificação: variação angular no espaço (η, Ξ)
 */
function estimateRegimeCurvature(trajectory: StructuralTimePoint[]): number {
  if (trajectory.length < 3) return 0;
  
  // Usar subespaço (η, Ξ) como proxy
  const points = trajectory.map(p => ({
    x: p.state.eta,
    y: p.state.xi
  }));
  
  let totalCurvature = 0;
  
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    // Vetores
    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    
    // Produto escalar normalizado → ângulo
    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
    
    if (len1 === 0 || len2 === 0) continue;
    
    const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    
    totalCurvature += angle;
  }
  
  return Math.min(totalCurvature / (points.length - 2), 1);
}

// ============================================================================
// PROJEÇÃO 5D → 3D
// ============================================================================

/**
 * Projeta vetor 5D em 3D conforme configuração
 */
export function project5Dto3D(
  state: StateVector5D,
  phase: PhaseVector5D | undefined,
  config: ProjectionConfig
): [number, number, number] {
  const source = config.mode === "phase" && phase ? phase : state;
  
  // Mapear nomes de eixo para valores
  const getValue = (axis: AxisName): number => {
    if (config.mode === "phase" && phase) {
      const phaseMap: Record<AxisName, keyof PhaseVector5D> = {
        oh: "doh",
        phi: "dphi",
        eta: "deta",
        xi: "dxi",
        def: "ddef"
      };
      return phase[phaseMap[axis]] || 0;
    }
    return state[axis] || 0;
  };
  
  return [
    getValue(config.x_axis),
    getValue(config.y_axis),
    getValue(config.z_axis)
  ];
}

/**
 * Projeções pré-definidas úteis
 */
export const PRESET_PROJECTIONS: Record<string, ProjectionConfig> = {
  // Clássico (Oh, Φ, η) - compatibilidade com v1
  classic: {
    x_axis: "oh",
    y_axis: "phi",
    z_axis: "eta",
    mode: "instrument"
  },
  
  // Diagnóstico de Regime (η, Ξ, DEF)
  regime_diagnostic: {
    x_axis: "eta",
    y_axis: "xi",
    z_axis: "def",
    mode: "instrument"
  },
  
  // Memória vs Diversidade (Φ, Ξ, η)
  memory_diversity: {
    x_axis: "phi",
    y_axis: "xi",
    z_axis: "eta",
    mode: "instrument"
  },
  
  // Déficit vs Rigidez (DEF, η, Oh)
  deficit_rigidity: {
    x_axis: "def",
    y_axis: "eta",
    z_axis: "oh",
    mode: "instrument"
  },
  
  // Fase Clássica
  phase_classic: {
    x_axis: "oh",
    y_axis: "phi",
    z_axis: "eta",
    mode: "phase"
  }
} as const;

// ============================================================================
// CORES E VISUALIZAÇÃO
// ============================================================================

/**
 * Retorna cor baseada em regime
 */
export function getRegimeColor(regime: RegimeLabel): string {
  const colors = {
    nagare: "#22c55e",    // Verde - fluxo adaptativo
    utsuroi: "#eab308",   // Amarelo - transicional
    katashi: "#ef4444"    // Vermelho - rígido
  };
  return colors[regime];
}

/**
 * Retorna cor por interpolação de score
 */
export function getRegimeColorInterpolated(classification: RegimeClassification): string {
  const { label, score } = classification;
  const baseColor = getRegimeColor(label);
  
  // Interpolar opacidade baseado em score
  // Score alto = cor saturada, score baixo = mais transparente
  return baseColor;  // Simplificado por ora
}

// ============================================================================
// NORMALIZAÇÃO
// ============================================================================

/**
 * Normaliza vetor 5D para [0,1]^5
 * Conforme Definição 2.1 do paper
 */
export function normalizeState(state: StateVector5D): StateVector5D {
  return {
    oh: clamp01(state.oh),
    phi: clamp01(state.phi),
    eta: clamp01(state.eta),
    xi: clamp01(state.xi),
    def: clamp01(state.def)
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Computa estatísticas de série para normalização
 */
export function computeAxisStats(
  series: StructuralTimePoint[],
  axis: AxisName
): { min: number; max: number; mean: number; std: number } {
  const values = series.map(p => p.state[axis]);
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  
  return { min, max, mean, std };
}
