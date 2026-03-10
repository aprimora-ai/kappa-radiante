/**
 * Tipos base para o Radiante Estrutural Pentadimensional
 * Conforme especificação do paper v3.0
 */

/**
 * Vetor de Observáveis Canônicos K(t) ∈ [0,1]^5
 * 
 * Seção 2.1 do paper:
 * - Oh: Homologia (pressão estrutural)
 * - Phi: Memória (persistência temporal)
 * - Eta: Rigidez (resistência à perturbação)
 * - Xi: Diversidade (multiplicidade de caminhos)
 * - DEF: Déficit Estrutural (divergência estado-fase)
 */
export interface StateVector {
  oh: number;   // Oh ∈ [0,1]
  phi: number;  // Φ ∈ [0,1]
  eta: number;  // η ∈ [0,1]
  xi: number;   // Ξ ∈ [0,1]
  def: number;  // DEF ∈ [0,1]
}

/**
 * Derivadas temporais (espaço de fase)
 * Usado no modo "Fase" para evidenciar transições
 */
export interface PhaseVector {
  doh?: number;   // ∂Oh/∂t
  dphi: number;   // ∂Φ/∂t
  deta?: number;  // ∂η/∂t
  dxi?: number;   // ∂Ξ/∂t
  ddef?: number;  // ∂DEF/∂t
}

/**
 * Regime estrutural (Seção 4.2 do paper)
 */
export type RegimeLabel = "nagare" | "utsuroi" | "katashi";

export interface RegimeClassification {
  label: RegimeLabel;
  score: number; // Confiança ∈ [0,1]
}

/**
 * Sinais calculados (métricas auxiliares)
 */
export interface StructuralSignals {
  def: number;         // Déficit estrutural
  calm: number;        // Parâmetro de suavização
  lam: number;         // Laminaridade
  turb: number;        // Turbulência
  kappa?: number;      // Curvatura de regime κ(t)
  governability?: number; // Governabilidade G(t)
}

/**
 * Evento estrutural (transição, alerta, etc)
 */
export interface StructuralEvent {
  type: "note" | "warning" | "alert" | "transition";
  label: string;
  severity: number; // ∈ [0,1]
  timestamp?: string;
}

/**
 * Ponto na série temporal do Radiante
 */
export interface RadiantPoint {
  t: number | string;          // Índice temporal
  state: StateVector;          // K(t) no espaço de observáveis
  phase?: PhaseVector;         // ∂K/∂t no espaço de fase
  regime?: RegimeClassification;
  signals?: StructuralSignals;
  events?: StructuralEvent[];
  raw_ref?: {
    id?: string;
    source?: string;
    [key: string]: any;
  };
}

/**
 * Metadados da entidade sendo analisada
 */
export interface EntityMetadata {
  id: string;
  label: string;
  meta?: Record<string, unknown>;
}

/**
 * Configuração temporal
 */
export interface TimeConfiguration {
  index_name: string;
  start?: string;
  step?: string;
  units?: string;
}

/**
 * Eixos de visualização para modos Instrumento/Fase
 */
export interface VisualizationAxes {
  mode_instrument: [string, string, string]; // 3 dos 5 observáveis
  mode_phase: [string, string, string];      // Derivadas temporais
}

/**
 * Link entre domínios (para primitivos estruturais)
 */
export interface DomainLink {
  type: string;
  from: {
    domain: string;
    entity_id: string;
  };
  to: {
    domain: string;
    entity_id: string;
  };
  rule?: string;
  weight?: number;
}

/**
 * Dataset completo do Radiante (schema v1)
 */
export interface RadiantDataset {
  schema_version: "radiante.v1";
  domain: string;
  run_id: string;
  entity: EntityMetadata;
  axes: VisualizationAxes;
  time: TimeConfiguration;
  series: RadiantPoint[];
  links?: DomainLink[];
}

/**
 * Constantes de regime (thresholds)
 */
export const REGIME_THRESHOLDS = {
  // Nagare (fluxo adaptativo)
  nagare: {
    xi_min: 0.6,      // Ξ alto
    eta_max: 0.4,     // η baixo
    def_max: 0.3,     // DEF baixo
  },
  // Katashi (cristalização rígida)
  katashi: {
    eta_min: 0.6,     // η alto
    phi_min: 0.5,     // Φ alto
    xi_max: 0.4,      // Ξ baixo
  },
  // Utsuroi (transicional)
  utsuroi: {
    kappa_min: 0.5,   // κ crescente
    kappa_max: 1.0,
  },
  // Pré-PNR (zona crítica)
  pre_pnr: {
    kappa_threshold: 0.8,
    def_threshold: 0.6,
  },
} as const;
