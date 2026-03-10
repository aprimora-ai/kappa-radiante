/**
 * Funções de classificação de regime estrutural
 * Implementação matemática conforme Seção 4.2 do paper
 */

import {
  StateVector,
  RegimeLabel,
  RegimeClassification,
  REGIME_THRESHOLDS,
} from "./observables";

/**
 * Classifica regime baseado na geometria pentadimensional completa
 * 
 * Regras (paper Seção 4.2):
 * - Nagare: Ξ alto, η baixo, DEF baixo
 * - Katashi: η alto, Φ alto, Ξ baixo
 * - Utsuroi: Estado transicional (não satisfaz Nagare nem Katashi)
 */
export function classifyRegime(state: StateVector): RegimeClassification {
  const { oh, phi, eta, xi, def } = state;

  // Critérios para Nagare (fluxo adaptativo)
  const isNagare =
    xi >= REGIME_THRESHOLDS.nagare.xi_min &&
    eta <= REGIME_THRESHOLDS.nagare.eta_max &&
    def <= REGIME_THRESHOLDS.nagare.def_max;

  // Critérios para Katashi (cristalização rígida)
  const isKatashi =
    eta >= REGIME_THRESHOLDS.katashi.eta_min &&
    phi >= REGIME_THRESHOLDS.katashi.phi_min &&
    xi <= REGIME_THRESHOLDS.katashi.xi_max;

  // Calcular confiança (score)
  let label: RegimeLabel;
  let score: number;

  if (isNagare) {
    label = "nagare";
    // Score baseado em quão "dentro" do regime está
    score = Math.min(
      1.0,
      (xi / REGIME_THRESHOLDS.nagare.xi_min +
        (1 - eta / REGIME_THRESHOLDS.nagare.eta_max) +
        (1 - def / REGIME_THRESHOLDS.nagare.def_max)) /
        3
    );
  } else if (isKatashi) {
    label = "katashi";
    score = Math.min(
      1.0,
      (eta / REGIME_THRESHOLDS.katashi.eta_min +
        phi / REGIME_THRESHOLDS.katashi.phi_min +
        (1 - xi / REGIME_THRESHOLDS.katashi.xi_max)) /
        3
    );
  } else {
    // Utsuroi (transicional)
    label = "utsuroi";
    // Score baseado na distância para os regimes estáveis
    const distToNagare = Math.abs(
      (xi - REGIME_THRESHOLDS.nagare.xi_min) +
        (eta - REGIME_THRESHOLDS.nagare.eta_max) +
        (def - REGIME_THRESHOLDS.nagare.def_max)
    );
    const distToKatashi = Math.abs(
      (eta - REGIME_THRESHOLDS.katashi.eta_min) +
        (phi - REGIME_THRESHOLDS.katashi.phi_min) +
        (xi - REGIME_THRESHOLDS.katashi.xi_max)
    );
    // Score é inverso da menor distância
    score = Math.min(1.0, 1.0 / (1 + Math.min(distToNagare, distToKatashi)));
  }

  return { label, score };
}

/**
 * Detecta proximidade ao Ponto de Não Retorno (PNR)
 * 
 * Critérios (paper Seção 4.3):
 * - DEF > threshold
 * - κ (curvatura) > threshold
 * - Tendência: ∂η/∂t > 0, ∂Ξ/∂t < 0
 */
export function detectPrePNR(
  state: StateVector,
  kappa?: number,
  deta?: number,
  dxi?: number
): boolean {
  const { def, eta, xi } = state;

  // Critério 1: DEF alto
  const highDEF = def >= REGIME_THRESHOLDS.pre_pnr.def_threshold;

  // Critério 2: Curvatura alta (se disponível)
  const highKappa = kappa
    ? kappa >= REGIME_THRESHOLDS.pre_pnr.kappa_threshold
    : false;

  // Critério 3: Tendência desfavorável (se derivadas disponíveis)
  const badTrend =
    deta !== undefined && dxi !== undefined ? deta > 0 && dxi < 0 : false;

  // Pré-PNR se qualquer critério crítico for satisfeito
  return highDEF || (highKappa && badTrend);
}

/**
 * Computa curvatura de regime κ(t)
 * Mede taxa de mudança da direção da trajetória
 * 
 * κ(t) = ||d²K/dt²|| / ||dK/dt||³
 */
export function computeRegimeCurvature(
  states: StateVector[],
  index: number
): number {
  if (index < 1 || index >= states.length - 1) {
    return 0; // Não há pontos suficientes
  }

  const prev = states[index - 1];
  const curr = states[index];
  const next = states[index + 1];

  // Primeira derivada (velocidade)
  const v1 = {
    oh: curr.oh - prev.oh,
    phi: curr.phi - prev.phi,
    eta: curr.eta - prev.eta,
    xi: curr.xi - prev.xi,
    def: curr.def - prev.def,
  };

  const v2 = {
    oh: next.oh - curr.oh,
    phi: next.phi - curr.phi,
    eta: next.eta - curr.eta,
    xi: next.xi - curr.xi,
    def: next.def - curr.def,
  };

  // Segunda derivada (aceleração)
  const a = {
    oh: v2.oh - v1.oh,
    phi: v2.phi - v1.phi,
    eta: v2.eta - v1.eta,
    xi: v2.xi - v1.xi,
    def: v2.def - v1.def,
  };

  // Normas
  const speedSq =
    v1.oh ** 2 + v1.phi ** 2 + v1.eta ** 2 + v1.xi ** 2 + v1.def ** 2;
  const accelSq =
    a.oh ** 2 + a.phi ** 2 + a.eta ** 2 + a.xi ** 2 + a.def ** 2;

  if (speedSq < 1e-8) return 0;

  const speed = Math.sqrt(speedSq);
  const accel = Math.sqrt(accelSq);

  // Curvatura: ||a|| / ||v||³
  const kappa = accel / (speed ** 3 + 1e-8);

  // Normalizar para [0,1] (κ típico < 10, saturation)
  return Math.min(1.0, kappa / 10);
}

/**
 * Cor para regime (visualização)
 */
export function colorForRegime(label: RegimeLabel): string {
  switch (label) {
    case "nagare":
      return "#22c55e"; // Verde (adaptativo)
    case "utsuroi":
      return "#eab308"; // Amarelo (transicional)
    case "katashi":
      return "#ef4444"; // Vermelho (rígido)
  }
}

/**
 * Descrição textual do regime
 */
export function describeRegime(
  classification: RegimeClassification
): string {
  const { label, score } = classification;
  const confidence =
    score > 0.8 ? "alto" : score > 0.5 ? "moderado" : "baixo";

  const descriptions = {
    nagare: `Fluxo adaptativo (confiança: ${confidence})`,
    utsuroi: `Estado transicional (confiança: ${confidence})`,
    katashi: `Cristalização rígida (confiança: ${confidence})`,
  };

  return descriptions[label];
}
