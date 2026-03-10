/**
 * Adaptador para converter dados do schema radiante.v1 para formato de visualização
 */

import { RadianteV1 } from "./radiante-schema";
import {
  StateVector5D,
  PhaseVector5D,
  StructuralTimePoint,
  classifyRegime,
} from "./pentadimensional";

/**
 * Converte dados RadianteV1 para pontos estruturais temporais
 */
export function adaptRadianteV1ToTimeSeries(
  data: RadianteV1
): StructuralTimePoint[] {
  return data.series.map((item) => {
    // Construir StateVector5D
    const state: StateVector5D = {
      oh: item.state.oh,
      phi: item.state.phi,
      eta: item.state.eta,
      xi: item.state.xi,
      // DEF pode estar em state ou signals
      def: item.state.def ?? item.signals?.def ?? 0,
    };

    // Construir PhaseVector5D se disponível
    let phase: PhaseVector5D | undefined = undefined;
    if (item.phase) {
      phase = {
        doh: item.phase.doh ?? 0,
        dphi: item.phase.dphi,
        deta: item.phase.deta ?? 0,
        dxi: item.phase.dxi ?? 0,
        ddef: 0, // Não definido no schema atual
      };
    }

    // Usar regime do dado ou classificar
    const regime = item.regime
      ? {
          label: item.regime.label as "nagare" | "utsuroi" | "katashi",
          score: item.regime.score ?? 0.5,
          distances: {
            to_nagare: 0,
            to_utsuroi: 0,
            to_katashi: 0,
          },
        }
      : classifyRegime(state);

    return {
      t: item.t,
      state,
      phase,
      regime,
    };
  });
}

/**
 * Converte formato legado (Oh, phi, eta) para pentadimensional
 * Estima Ξ e DEF quando ausentes
 */
export function adaptLegacyData(
  legacyData: Array<{ t: string; Oh: number; phi: number; eta: number }>
): StructuralTimePoint[] {
  return legacyData.map((item, index) => {
    // Estimar Ξ (diversidade) baseado em variação de η
    const xi = estimateXiFromEta(legacyData, index);

    // Estimar DEF (déficit) baseado em acumulação de Oh
    const def = estimateDefFromOh(legacyData, index);

    const state: StateVector5D = {
      oh: item.Oh,
      phi: item.phi,
      eta: item.eta,
      xi,
      def,
    };

    const regime = classifyRegime(state);

    return {
      t: item.t,
      state,
      regime,
    };
  });
}

/**
 * Estima Ξ (diversidade) baseado em variabilidade local de η
 * Heurística: Alta variabilidade em η → sistema explorando múltiplos caminhos → Ξ alto
 */
function estimateXiFromEta(
  data: Array<{ eta: number }>,
  index: number
): number {
  const windowSize = 5;
  const start = Math.max(0, index - windowSize);
  const end = Math.min(data.length, index + windowSize + 1);

  const window = data.slice(start, end).map((d) => d.eta);

  // Variância normalizada
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  const variance =
    window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;

  // Mapear variância [0, 0.25] → Xi [0, 1]
  // Variância 0.25 é máxima teórica para valores em [0,1]
  return Math.min(variance / 0.25, 1);
}

/**
 * Estima DEF (déficit) baseado em acumulação histórica de Oh
 * Heurística: Oh consistentemente alto → déficit estrutural acumulado
 */
function estimateDefFromOh(
  data: Array<{ Oh: number }>,
  index: number
): number {
  if (index === 0) return 0;

  const windowSize = 10;
  const start = Math.max(0, index - windowSize);
  const window = data.slice(start, index + 1).map((d) => d.Oh);

  // DEF = integral de (Oh - baseline) positivo
  const baseline = 0.85;
  const accumulated = window
    .map((oh) => Math.max(0, oh - baseline))
    .reduce((a, b) => a + b, 0);

  // Normalizar pelo tamanho da janela
  return Math.min(accumulated / windowSize, 1);
}

/**
 * Calcula derivadas temporais para modo Fase
 */
export function computePhaseDerivatives(
  series: StructuralTimePoint[]
): StructuralTimePoint[] {
  return series.map((point, index) => {
    if (index === 0) {
      return {
        ...point,
        phase: {
          doh: 0,
          dphi: 0,
          deta: 0,
          dxi: 0,
          ddef: 0,
        },
      };
    }

    const prev = series[index - 1].state;
    const curr = point.state;

    const phase: PhaseVector5D = {
      doh: curr.oh - prev.oh,
      dphi: curr.phi - prev.phi,
      deta: curr.eta - prev.eta,
      dxi: curr.xi - prev.xi,
      ddef: curr.def - prev.def,
    };

    return {
      ...point,
      phase,
    };
  });
}

/**
 * Informações sobre dataset carregado
 */
export type DatasetInfo = {
  domain: string;
  entity: string;
  run_id: string;
  time_range: { start: number | string; end: number | string };
  n_points: number;
  regime_distribution: {
    nagare: number;
    utsuroi: number;
    katashi: number;
  };
  has_events: boolean;
};

/**
 * Extrai metadados do dataset
 */
export function extractDatasetInfo(
  data: RadianteV1,
  timeSeries: StructuralTimePoint[]
): DatasetInfo {
  const regimes = timeSeries.map((p) => p.regime?.label ?? "utsuroi");

  const distribution = {
    nagare: regimes.filter((r) => r === "nagare").length / timeSeries.length,
    utsuroi: regimes.filter((r) => r === "utsuroi").length / timeSeries.length,
    katashi: regimes.filter((r) => r === "katashi").length / timeSeries.length,
  };

  const hasEvents = data.series.some(
    (item) => item.events && item.events.length > 0
  );

  return {
    domain: data.domain,
    entity: data.entity.label,
    run_id: data.run_id,
    time_range: {
      start: timeSeries[0].t,
      end: timeSeries[timeSeries.length - 1].t,
    },
    n_points: timeSeries.length,
    regime_distribution: distribution,
    has_events: hasEvents,
  };
}
