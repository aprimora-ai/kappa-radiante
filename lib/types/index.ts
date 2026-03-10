/**
 * Exports centralizados do sistema de tipos do Radiante Pentadimensional
 */

// Tipos base
export type {
  StateVector,
  PhaseVector,
  RegimeLabel,
  RegimeClassification,
  StructuralSignals,
  StructuralEvent,
  RadiantPoint,
  EntityMetadata,
  TimeConfiguration,
  VisualizationAxes,
  DomainLink,
  RadiantDataset,
} from "./observables";

export { REGIME_THRESHOLDS } from "./observables";

// Classificação de regime
export {
  classifyRegime,
  detectPrePNR,
  computeRegimeCurvature,
  colorForRegime,
  describeRegime,
} from "./regimes";

// Adaptadores de schema
export type { LegacyStatePoint } from "./adapters";
export {
  fromSchemaV1,
  toSchemaV1,
  loadRadiantDataset,
  fromLegacyFormat,
} from "./adapters";

// Projeções 5D→3D
export type {
  Vec3,
  Vec5,
  ProjectionMode,
  CustomProjection,
  ProjectedPoint,
  ProjectionMetadata,
} from "./projections";

export {
  projectToVisualization,
  PROJECTION_METADATA,
} from "./projections";
