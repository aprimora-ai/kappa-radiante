/**
 * Adaptador entre schema radiante.v1 (Zod) e tipos internos
 * Permite interoperabilidade entre formato de armazenamento e runtime
 */

import { z } from "zod";
import { RadianteV1, parseRadianteV1 } from "../radiante-schema";
import {
  RadiantDataset,
  RadiantPoint,
  StateVector,
  PhaseVector,
  RegimeClassification,
  StructuralSignals,
  StructuralEvent,
} from "./observables";

/**
 * Converte schema v1 (Zod) para tipos internos
 */
export function fromSchemaV1(data: RadianteV1): RadiantDataset {
  return {
    schema_version: "radiante.v1",
    domain: data.domain,
    run_id: data.run_id,
    entity: {
      id: data.entity.id,
      label: data.entity.label,
      meta: data.entity.meta,
    },
    axes: {
      mode_instrument: data.axes.mode_instrument,
      mode_phase: data.axes.mode_phase,
    },
    time: {
      index_name: data.time.index_name,
      start: data.time.start,
      step: data.time.step,
      units: data.time.units,
    },
    series: data.series.map((item): RadiantPoint => {
      // State (5 dimensões)
      const state: StateVector = {
        oh: item.state.oh,
        phi: item.state.phi,
        eta: item.state.eta,
        xi: item.state.xi ?? 0.5, // Default se ausente
        def: item.signals?.def ?? 0, // DEF pode vir de signals
      };

      // Phase (derivadas)
      const phase: PhaseVector | undefined = item.phase
        ? {
            dphi: item.phase.dphi,
            doh: (item.phase as any).doh,
            deta: (item.phase as any).deta,
            dxi: (item.phase as any).dxi,
            ddef: (item.phase as any).ddef,
          }
        : undefined;

      // Regime
      const regime: RegimeClassification | undefined = item.regime
        ? {
            label: item.regime.label as any,
            score: item.regime.score ?? 0.5,
          }
        : undefined;

      // Signals
      const signals: StructuralSignals | undefined = item.signals
        ? {
            def: item.signals.def ?? state.def,
            calm: item.signals.calm ?? 0.5,
            lam: item.signals.lam ?? 0.5,
            turb: item.signals.turb ?? 0.5,
          }
        : undefined;

      // Events
      const events: StructuralEvent[] | undefined = item.events?.map((e) => ({
        type: e.type as any,
        label: e.label,
        severity: e.severity ?? 0.5,
      }));

      return {
        t: item.t,
        state,
        phase,
        regime,
        signals,
        events,
        raw_ref: item.raw_ref,
      };
    }),
    links: data.links?.map((link) => ({
      type: link.type,
      from: {
        domain: link.from.domain,
        entity_id: link.from.entity_id,
      },
      to: {
        domain: link.to.domain,
        entity_id: link.to.entity_id,
      },
      rule: link.rule,
      weight: link.weight,
    })),
  };
}

/**
 * Converte tipos internos para schema v1 (para exportação)
 */
export function toSchemaV1(data: RadiantDataset): RadianteV1 {
  return {
    schema_version: "radiante.v1",
    domain: data.domain,
    run_id: data.run_id,
    entity: {
      id: data.entity.id,
      label: data.entity.label,
      meta: data.entity.meta,
    },
    axes: {
      mode_instrument: data.axes.mode_instrument,
      mode_phase: data.axes.mode_phase,
    },
    time: {
      index_name: data.time.index_name,
      start: data.time.start,
      step: data.time.step,
      units: data.time.units,
    },
    series: data.series.map((item) => ({
      t: typeof item.t === "number" ? item.t : parseFloat(item.t as string),
      state: {
        oh: item.state.oh,
        phi: item.state.phi,
        eta: item.state.eta,
        xi: item.state.xi,
        def: item.state.def ?? 0, // DEF agora é parte do StateVector5D
      },
      phase: item.phase
        ? {
            dphi: item.phase.dphi ?? 0,
            doh: item.phase.doh ?? 0,
            deta: item.phase.deta ?? 0,
            dxi: item.phase.dxi ?? 0,
            ddef: item.phase.ddef ?? 0,
          }
        : { dphi: 0, doh: 0, deta: 0, dxi: 0, ddef: 0 },
      regime: item.regime
        ? {
            label: item.regime.label,
            score: item.regime.score,
          }
        : undefined,
      signals: {
        def: item.state.def ?? 0, // DEF migrado para signals
        ...(item.signals?.calm !== undefined && { calm: item.signals.calm }),
        ...(item.signals?.lam !== undefined && { lam: item.signals.lam }),
        ...(item.signals?.turb !== undefined && { turb: item.signals.turb }),
      },
      events: item.events?.map((e) => ({
        type: e.type,
        label: e.label,
        severity: e.severity,
      })),
      raw_ref: item.raw_ref,
    })),
    links: data.links?.map((link) => ({
      type: link.type,
      from: {
        domain: link.from.domain,
        entity_id: link.from.entity_id,
      },
      to: {
        domain: link.to.domain,
        entity_id: link.to.entity_id,
      },
      rule: link.rule,
      weight: link.weight,
    })),
  };
}

/**
 * Carrega e valida dataset a partir de JSON
 */
export function loadRadiantDataset(jsonData: unknown): RadiantDataset {
  const validated = parseRadianteV1(jsonData);
  return fromSchemaV1(validated);
}

/**
 * Adaptador para formato legado (apenas 3 dimensões)
 * Usado para migrar dados antigos
 */
export interface LegacyStatePoint {
  t: string;
  Oh: number;
  phi: number;
  eta: number;
}

export function fromLegacyFormat(
  legacyData: LegacyStatePoint[]
): RadiantDataset {
  return {
    schema_version: "radiante.v1",
    domain: "legacy_import",
    run_id: `legacy_${Date.now()}`,
    entity: {
      id: "unknown",
      label: "Legacy Import",
    },
    axes: {
      mode_instrument: ["oh", "phi", "eta"],
      mode_phase: ["oh", "dphi", "eta"],
    },
    time: {
      index_name: "t",
    },
    series: legacyData.map((item, index) => {
      const prev = index > 0 ? legacyData[index - 1] : item;

      return {
        t: item.t,
        state: {
          oh: item.Oh,
          phi: item.phi,
          eta: item.eta,
          xi: 0.5, // Estimativa: médio
          def: 0.3, // Estimativa: baixo-médio
        },
        phase: {
          dphi: Math.max(0, item.phi - prev.phi),
        },
      };
    }),
  };
}
