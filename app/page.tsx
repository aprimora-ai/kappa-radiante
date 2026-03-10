"use client";

import { useState, useMemo } from "react";
import RadiantScene5D, {
  PRESET_PROJECTIONS,
  UserPerturbation,
  evaluateCandidateDelta,
  RIEMetricsBundle
} from "../components/RadiantScene5D";
import {
  StructuralTimePoint,
  ProjectionConfig,
  AxisName,
  detectPrePNR,
} from "../lib/pentadimensional";
import {
  adaptLegacyData,
  adaptRadianteV1ToTimeSeries,
  computePhaseDerivatives,
  extractDatasetInfo,
  DatasetInfo,
} from "../lib/data-adapter";
import { RadianteV1, parseRadianteV1 } from "../lib/radiante-schema";

// Importar datasets
import legacyData from "../public/data/state.json";
import financeDemo from "../sample_runs/finance_demo.json";
import llmDemo from "../sample_runs/llm_demo.json";
import newsDemo from "../sample_runs/news_demo.json";
import educationPassDemo from "../sample_runs/education_pass_demo.json";
import educationWithdrawnDemo from "../sample_runs/education_withdrawn_demo.json";
import politicalDemo from "../sample_runs/political_demo.json";

type DatasetKey =
  | "legacy"
  | "finance"
  | "llm"
  | "news"
  | "education_pass"
  | "education_withdrawn"
  | "political";

type LoadedDataset = {
  key: DatasetKey;
  label: string;
  data: StructuralTimePoint[];
  info?: DatasetInfo;
};

const DATASET_LABELS: Record<DatasetKey, string> = {
  legacy: "Demo Legado (2007-2011)",
  finance: "Finanças: BTC/USD",
  llm: "LLM: Mistral-7B HaluEval",
  news: "News: Análise de Notícias",
  education_pass: "Educação: Aprovados (OULAD)",
  education_withdrawn: "Educação: Desistentes (OULAD)",
  political: "Política: Blogosfera (2004)",
};

// Preparar datasets
const DATASETS: Record<DatasetKey, () => LoadedDataset> = {
  legacy: () => {
    const data = adaptLegacyData(legacyData as any);
    const withPhase = computePhaseDerivatives(data);
    return {
      key: "legacy",
      label: DATASET_LABELS.legacy,
      data: withPhase,
    };
  },
  finance: () => {
    const parsed = parseRadianteV1(financeDemo);
    const data = adaptRadianteV1ToTimeSeries(parsed);
    const withPhase = computePhaseDerivatives(data);
    const info = extractDatasetInfo(parsed, withPhase);
    return {
      key: "finance",
      label: DATASET_LABELS.finance,
      data: withPhase,
      info,
    };
  },
  llm: () => {
    const parsed = parseRadianteV1(llmDemo);
    const data = adaptRadianteV1ToTimeSeries(parsed);
    const withPhase = computePhaseDerivatives(data);
    const info = extractDatasetInfo(parsed, withPhase);
    return {
      key: "llm",
      label: DATASET_LABELS.llm,
      data: withPhase,
      info,
    };
  },
  news: () => {
    const parsed = parseRadianteV1(newsDemo);
    const data = adaptRadianteV1ToTimeSeries(parsed);
    const withPhase = computePhaseDerivatives(data);
    const info = extractDatasetInfo(parsed, withPhase);
    return {
      key: "news",
      label: DATASET_LABELS.news,
      data: withPhase,
      info,
    };
  },
  education_pass: () => {
    const parsed = parseRadianteV1(educationPassDemo);
    const data = adaptRadianteV1ToTimeSeries(parsed);
    const withPhase = computePhaseDerivatives(data);
    const info = extractDatasetInfo(parsed, withPhase);
    return {
      key: "education_pass",
      label: DATASET_LABELS.education_pass,
      data: withPhase,
      info,
    };
  },
  education_withdrawn: () => {
    const parsed = parseRadianteV1(educationWithdrawnDemo);
    const data = adaptRadianteV1ToTimeSeries(parsed);
    const withPhase = computePhaseDerivatives(data);
    const info = extractDatasetInfo(parsed, withPhase);
    return {
      key: "education_withdrawn",
      label: DATASET_LABELS.education_withdrawn,
      data: withPhase,
      info,
    };
  },
  political: () => {
    const parsed = parseRadianteV1(politicalDemo);
    const data = adaptRadianteV1ToTimeSeries(parsed);
    const withPhase = computePhaseDerivatives(data);
    const info = extractDatasetInfo(parsed, withPhase);
    return {
      key: "political",
      label: DATASET_LABELS.political,
      data: withPhase,
      info,
    };
  },
};

const AXIS_LABELS: Record<AxisName, string> = {
  oh: "Oh (Homologia)",
  phi: "Φ (Memória)",
  eta: "η (Rigidez)",
  xi: "Ξ (Diversidade)",
  def: "DEF (Déficit)",
};

export default function HomePage() {
  const [datasetKey, setDatasetKey] = useState<DatasetKey>("legacy");
  const [projectionName, setProjectionName] = useState("regime_diagnostic");
  const [timeIndex, setTimeIndex] = useState(0);
  const [calm, setCalm] = useState(0.35);
  const [showFlow, setShowFlow] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showFutures, setShowFutures] = useState(false);
  const [showCone, setShowCone] = useState(true);
  const [showGeoid, setShowGeoid] = useState(true);

  // Perturbação interativa do usuário
  const [userPerturbation, setUserPerturbation] = useState<UserPerturbation>({
    oh: { enabled: false, delta: 0 },
    phi: { enabled: false, delta: 0 },
    eta: { enabled: false, delta: 0 },
    xi: { enabled: false, delta: 0 },
  });

  // Verifica se há alguma perturbação ativa
  const hasActivePerturbation =
    (userPerturbation.oh.enabled && userPerturbation.oh.delta !== 0) ||
    (userPerturbation.phi.enabled && userPerturbation.phi.delta !== 0) ||
    (userPerturbation.eta.enabled && userPerturbation.eta.delta !== 0) ||
    (userPerturbation.xi.enabled && userPerturbation.xi.delta !== 0);

  // Funções para atualizar perturbação
  const toggleObservable = (key: keyof UserPerturbation) => {
    setUserPerturbation(prev => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled }
    }));
  };

  const setObservableDelta = (key: keyof UserPerturbation, delta: number) => {
    setUserPerturbation(prev => ({
      ...prev,
      [key]: { ...prev[key], delta }
    }));
  };

  const resetPerturbations = () => {
    setUserPerturbation({
      oh: { enabled: false, delta: 0 },
      phi: { enabled: false, delta: 0 },
      eta: { enabled: false, delta: 0 },
      xi: { enabled: false, delta: 0 },
    });
  };

  // Carregar dataset (precisa vir antes do rieMetrics)
  const dataset = useMemo(() => DATASETS[datasetKey](), [datasetKey]);

  const projection: ProjectionConfig =
    PRESET_PROJECTIONS[projectionName as keyof typeof PRESET_PROJECTIONS] ||
    PRESET_PROJECTIONS.classic;

  const maxIndex = Math.max(dataset.data.length - 1, 0);
  const clampedIndex = Math.max(0, Math.min(maxIndex, timeIndex));

  const currentPoint = dataset.data[clampedIndex];
  const state = currentPoint.state;
  const regime = currentPoint.regime;
  const isPrePNR = detectPrePNR(dataset.data, clampedIndex);

  // Estatísticas do dataset
  const regimeStats = useMemo(() => {
    const counts = { nagare: 0, utsuroi: 0, katashi: 0 };
    dataset.data.forEach((p) => {
      const label = p.regime?.label ?? "utsuroi";
      counts[label]++;
    });
    return counts;
  }, [dataset.data]);

  // Calcula avaliação RIE quando há perturbação ativa
  const rieMetrics = useMemo<RIEMetricsBundle | null>(() => {
    if (!showFutures || !hasActivePerturbation) return null;

    const point = dataset.data[clampedIndex];
    if (!point) return null;

    // Estado base atual
    const baseState = {
      oh: point.state.oh,
      phi: point.state.phi,
      eta: point.state.eta,
      sigma: point.state.xi ?? 0.9,
      def: point.state.def ?? Math.max(0, point.state.oh - 1),
    };

    // Delta do usuário
    const delta = {
      oh: userPerturbation.oh.enabled ? userPerturbation.oh.delta : 0,
      phi: userPerturbation.phi.enabled ? userPerturbation.phi.delta : 0,
      eta: userPerturbation.eta.enabled ? userPerturbation.eta.delta : 0,
      sigma: userPerturbation.xi.enabled ? userPerturbation.xi.delta : 0,
    };

    // Calcula momentum (últimos 4 pontos)
    const lookback = 4;
    const startIdx = Math.max(0, clampedIndex - lookback);
    const startPoint = dataset.data[startIdx];
    const steps = clampedIndex - startIdx || 1;

    const momentum = {
      dOh: (point.state.oh - startPoint.state.oh) / steps,
      dPhi: (point.state.phi - startPoint.state.phi) / steps,
      dEta: (point.state.eta - startPoint.state.eta) / steps,
      dSigma: ((point.state.xi ?? 0.9) - (startPoint.state.xi ?? 0.9)) / steps,
    };

    return evaluateCandidateDelta(baseState, delta, momentum);
  }, [showFutures, hasActivePerturbation, dataset.data, clampedIndex, userPerturbation]);

  // Handler para sincronizar tempo com o progresso do fluxo
  const handleFlowProgress = (progress: number) => {
    if (!dataset.data.length) return;
    const maxIdx = dataset.data.length - 1;
    const newIndex = Math.floor(progress * maxIdx);
    
    // Só atualiza se mudou o índice inteiro (evita re-renders desnecessários)
    if (newIndex !== timeIndex) {
      setTimeIndex(newIndex);
    }
  };

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        padding: "1.5rem",
        boxSizing: "border-box",
        gap: "1.5rem",
      }}
    >
      <header>
        <h1
          style={{ fontSize: "2rem", fontWeight: 600, marginBottom: "0.5rem" }}
        >
          Radiante Estrutural Pentadimensional
        </h1>
        <p style={{ maxWidth: 720, fontSize: "0.95rem", opacity: 0.85 }}>
          Instrumento de navegação estrutural via <strong>Projeção Feynman</strong>. 
          Mapeamento 5D do espaço de regimes (Nagare, Utsuroi, Katashi) baseado no 
          <strong> Método Kappa v3.0</strong>. Identifica janelas de alavancagem em estados pré-críticos.
        </p>
      </header>

      {/* Controles Principais */}
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {/* Linha 1: Dataset e Projeção */}
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "0.9rem", opacity: 0.85 }}>Dataset:</span>
            <select
              value={datasetKey}
              onChange={(e) => {
                setDatasetKey(e.target.value as DatasetKey);
                setTimeIndex(0);
              }}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "0.5rem",
                border: "1px solid #4b5563",
                backgroundColor: "#1f2937",
                color: "#e5e7eb",
                fontSize: "0.9rem",
              }}
            >
              {Object.entries(DATASET_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "0.9rem", opacity: 0.85 }}>
              Projeção:
            </span>
            <select
              value={projectionName}
              onChange={(e) => setProjectionName(e.target.value)}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "0.5rem",
                border: "1px solid #4b5563",
                backgroundColor: "#1f2937",
                color: "#e5e7eb",
                fontSize: "0.9rem",
              }}
            >
              <option value="classic">Clássico (Oh, Φ, η)</option>
              <option value="regime_diagnostic">
                Diagnóstico (η, Ξ, DEF)
              </option>
              <option value="memory_diversity">
                Memória-Diversidade (Φ, Ξ, η)
              </option>
              <option value="deficit_rigidity">
                Déficit-Rigidez (DEF, η, Oh)
              </option>
              <option value="phase_classic">Fase Clássica (∂Oh, ∂Φ, ∂η)</option>
            </select>
          </div>
        </div>

        {/* Linha 2: Toggles e Sliders */}
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setShowFlow((v) => !v)}
            style={{
              padding: "0.35rem 0.8rem",
              borderRadius: "999px",
              border: "1px solid",
              borderColor: showFlow ? "#38bdf8" : "#4b5563",
              backgroundColor: showFlow ? "#022c37" : "transparent",
              color: "#e5e7eb",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Fluxo: {showFlow ? "On" : "Off"}
          </button>

          <button
            type="button"
            onClick={() => setShowParticles((v) => !v)}
            style={{
              padding: "0.35rem 0.8rem",
              borderRadius: "999px",
              border: "1px solid",
              borderColor: showParticles ? "#a855f7" : "#4b5563",
              backgroundColor: showParticles ? "#2e1065" : "transparent",
              color: "#e5e7eb",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Partículas: {showParticles ? "On" : "Off"}
          </button>

          <button
            type="button"
            onClick={() => setShowEvents((v) => !v)}
            style={{
              padding: "0.35rem 0.8rem",
              borderRadius: "999px",
              border: "1px solid",
              borderColor: showEvents ? "#f59e0b" : "#4b5563",
              backgroundColor: showEvents ? "#422006" : "transparent",
              color: "#e5e7eb",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Eventos: {showEvents ? "On" : "Off"}
          </button>

          <button
            type="button"
            onClick={() => setShowFutures((v) => !v)}
            style={{
              padding: "0.35rem 0.8rem",
              borderRadius: "999px",
              border: "1px solid",
              borderColor: showFutures ? "#10b981" : "#4b5563",
              backgroundColor: showFutures ? "#064e3b" : "transparent",
              color: "#e5e7eb",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Futuros: {showFutures ? "On" : "Off"}
          </button>

          {showFutures && (
            <button
              type="button"
              onClick={() => setShowCone((v) => !v)}
              style={{
                padding: "0.35rem 0.8rem",
                borderRadius: "999px",
                border: "1px solid",
                borderColor: showCone ? "#06b6d4" : "#4b5563",
                backgroundColor: showCone ? "rgba(6,182,212,0.2)" : "transparent",
                color: "#e5e7eb",
                cursor: "pointer",
                fontSize: "0.85rem",
                marginLeft: "-0.5rem" // Agrupar visualmente com Futuros
              }}
            >
              Cone: {showCone ? "On" : "Off"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowGeoid((v) => !v)}
            style={{
              padding: "0.35rem 0.8rem",
              borderRadius: "999px",
              border: "1px solid",
              borderColor: showGeoid ? "#d4af37" : "#4b5563",
              backgroundColor: showGeoid ? "#422006" : "transparent",
              color: "#e5e7eb",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Geóide: {showGeoid ? "On" : "Off"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>CALM</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={calm}
              onChange={(e) => setCalm(Number(e.target.value))}
              style={{ width: "140px" }}
            />
            <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>
              {calm.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Linha 3: Slider de Tempo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.8rem",
            width: "100%",
          }}
        >
          <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>Tempo</span>
          <input
            type="range"
            min={0}
            max={maxIndex}
            step={1}
            value={clampedIndex}
            onChange={(e) => setTimeIndex(Number(e.target.value))}
            style={{ flex: 1, maxWidth: "600px" }}
          />
          <span
            style={{
              fontSize: "0.8rem",
              opacity: 0.8,
              minWidth: "80px",
            }}
          >
            {clampedIndex + 1} / {dataset.data.length}
          </span>
        </div>
      </section>

      {/* Visualização 3D */}
      <section
        style={{
          flex: 1,
          minHeight: "60vh",
          position: "relative",
          borderRadius: "0.75rem",
          border: "1px solid #1f2937",
          overflow: "hidden",
          background:
            "radial-gradient(circle at top, rgba(96,165,250,0.12), transparent 55%), #020617",
        }}
      >
        <RadiantScene5D
          data={dataset.data}
          projection={projection}
          timeIndex={clampedIndex}
          calm={calm}
          showFlow={showFlow}
          showParticles={showParticles}
          showEvents={showEvents}
          showFutures={showFutures}
          showCone={showCone}
          userPerturbation={showFutures ? userPerturbation : undefined}
          showGeoid={showGeoid}
          onFlowProgress={handleFlowProgress}
        />

        {/* Painel de Estado Atual (F3: Estado Clínico Estrutural) */}
        <div
          style={{
            position: "absolute",
            right: "1.1rem",
            top: "1rem",
            padding: "0.7rem 1rem",
            borderRadius: "0.6rem",
            backgroundColor: isPrePNR
              ? "rgba(127,29,29,0.9)"
              : "rgba(15,23,42,0.85)",
            border: isPrePNR
              ? "2px solid rgba(239,68,68,0.8)"
              : "1px solid rgba(148,163,184,0.45)",
            fontSize: "0.78rem",
            color: "#e5e7eb",
            pointerEvents: "none",
            maxWidth: "280px",
          }}
        >
          <div style={{ fontSize: "0.65rem", opacity: 0.5, marginBottom: "0.3rem", fontWeight: 600 }}>F3: ESTADO CLÍNICO</div>
          {isPrePNR && (
            <div
              style={{
                color: "#fca5a5",
                fontWeight: 600,
                marginBottom: "0.5rem",
                fontSize: "0.85rem",
              }}
            >
              ⚠️ PRÉ-PNR DETECTADO
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "0.15rem",
            }}
          >
            <span style={{ opacity: 0.7 }}>t</span>
            <span>{String(currentPoint.t)}</span>
          </div>

          <div style={{ height: "1px", backgroundColor: "#374151", margin: "0.4rem 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ opacity: 0.7 }}>Oh</span>
            <span>{state.oh.toFixed(3)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ opacity: 0.7 }}>Φ</span>
            <span>{state.phi.toFixed(3)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ opacity: 0.7 }}>η</span>
            <span>{state.eta.toFixed(3)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ opacity: 0.7 }}>Ξ</span>
            <span>{state.xi.toFixed(3)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ opacity: 0.7 }}>DEF</span>
            <span>{state.def.toFixed(3)}</span>
          </div>

          <div style={{ height: "1px", backgroundColor: "#374151", margin: "0.4rem 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ opacity: 0.7 }}>Regime</span>
            <span
              style={{
                color:
                  regime?.label === "nagare"
                    ? "#22c55e"
                    : regime?.label === "katashi"
                    ? "#ef4444"
                    : "#eab308",
                fontWeight: 600,
                textTransform: "uppercase",
                fontSize: "0.75rem",
              }}
            >
              {regime?.label ?? "?"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ opacity: 0.7 }}>Score</span>
            <span>{(regime?.score ?? 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Painel de Eixos Atuais */}
        <div
          style={{
            position: "absolute",
            left: "1.1rem",
            bottom: "1rem",
            padding: "0.6rem 0.9rem",
            borderRadius: "0.6rem",
            backgroundColor: "rgba(15,23,42,0.85)",
            border: "1px solid rgba(148,163,184,0.45)",
            fontSize: "0.75rem",
            color: "#e5e7eb",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.3rem", opacity: 0.7 }}>
            Eixos Projetados:
          </div>
          <div>X: {AXIS_LABELS[projection.x_axis]}</div>
          <div>Y: {AXIS_LABELS[projection.y_axis]}</div>
          <div>Z: {AXIS_LABELS[projection.z_axis]}</div>
        </div>

        {/* Painel de Exploração de Futuros (F2: Leque de Ação) */}
        {showFutures && (
          <div
            style={{
              position: "absolute",
              left: "1.1rem",
              top: "1rem",
              padding: "0.8rem 1rem",
              borderRadius: "0.6rem",
              backgroundColor: hasActivePerturbation
                ? "rgba(5,46,22,0.92)"
                : "rgba(15,23,42,0.9)",
              border: hasActivePerturbation
                ? "2px solid rgba(34,197,94,0.6)"
                : "1px solid rgba(148,163,184,0.45)",
              fontSize: "0.78rem",
              color: "#e5e7eb",
              minWidth: "220px",
            }}
          >
            <div style={{ fontSize: "0.65rem", opacity: 0.5, marginBottom: "0.3rem", fontWeight: 600 }}>F2: LEQUE DE AÇÃO</div>
            <div style={{ fontWeight: 600, marginBottom: "0.6rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Explorar Futuros</span>
              {hasActivePerturbation && (
                <button
                  type="button"
                  onClick={resetPerturbations}
                  style={{
                    padding: "0.15rem 0.4rem",
                    borderRadius: "4px",
                    border: "1px solid rgba(239,68,68,0.5)",
                    backgroundColor: "rgba(127,29,29,0.5)",
                    color: "#fca5a5",
                    cursor: "pointer",
                    fontSize: "0.7rem",
                  }}
                >
                  Reset
                </button>
              )}
            </div>

            <div style={{ fontSize: "0.7rem", opacity: 0.7, marginBottom: "0.6rem" }}>
              Selecione observáveis e ajuste os deltas para ver trajetórias alternativas
            </div>

            {/* Oh */}
            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                <input
                  type="checkbox"
                  checked={userPerturbation.oh.enabled}
                  onChange={() => toggleObservable("oh")}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontWeight: 500, color: userPerturbation.oh.enabled ? "#60a5fa" : "#9ca3af" }}>
                  Oh (Homologia)
                </span>
                <span style={{ marginLeft: "auto", fontSize: "0.7rem", opacity: 0.8 }}>
                  {userPerturbation.oh.delta > 0 ? "+" : ""}{userPerturbation.oh.delta.toFixed(2)}
                </span>
              </div>
              {userPerturbation.oh.enabled && (
                <input
                  type="range"
                  min={-0.3}
                  max={0.3}
                  step={0.01}
                  value={userPerturbation.oh.delta}
                  onChange={(e) => setObservableDelta("oh", Number(e.target.value))}
                  style={{ width: "100%", cursor: "pointer" }}
                />
              )}
            </div>

            {/* Phi */}
            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                <input
                  type="checkbox"
                  checked={userPerturbation.phi.enabled}
                  onChange={() => toggleObservable("phi")}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontWeight: 500, color: userPerturbation.phi.enabled ? "#a855f7" : "#9ca3af" }}>
                  Φ (Memória)
                </span>
                <span style={{ marginLeft: "auto", fontSize: "0.7rem", opacity: 0.8 }}>
                  {userPerturbation.phi.delta > 0 ? "+" : ""}{userPerturbation.phi.delta.toFixed(3)}
                </span>
              </div>
              {userPerturbation.phi.enabled && (
                <input
                  type="range"
                  min={-0.1}
                  max={0.1}
                  step={0.005}
                  value={userPerturbation.phi.delta}
                  onChange={(e) => setObservableDelta("phi", Number(e.target.value))}
                  style={{ width: "100%", cursor: "pointer" }}
                />
              )}
            </div>

            {/* Eta */}
            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                <input
                  type="checkbox"
                  checked={userPerturbation.eta.enabled}
                  onChange={() => toggleObservable("eta")}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontWeight: 500, color: userPerturbation.eta.enabled ? "#f59e0b" : "#9ca3af" }}>
                  η (Rigidez)
                </span>
                <span style={{ marginLeft: "auto", fontSize: "0.7rem", opacity: 0.8 }}>
                  {userPerturbation.eta.delta > 0 ? "+" : ""}{userPerturbation.eta.delta.toFixed(3)}
                </span>
              </div>
              {userPerturbation.eta.enabled && (
                <input
                  type="range"
                  min={-0.1}
                  max={0.1}
                  step={0.005}
                  value={userPerturbation.eta.delta}
                  onChange={(e) => setObservableDelta("eta", Number(e.target.value))}
                  style={{ width: "100%", cursor: "pointer" }}
                />
              )}
            </div>

            {/* Xi */}
            <div style={{ marginBottom: "0.4rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                <input
                  type="checkbox"
                  checked={userPerturbation.xi.enabled}
                  onChange={() => toggleObservable("xi")}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontWeight: 500, color: userPerturbation.xi.enabled ? "#22c55e" : "#9ca3af" }}>
                  Ξ (Diversidade)
                </span>
                <span style={{ marginLeft: "auto", fontSize: "0.7rem", opacity: 0.8 }}>
                  {userPerturbation.xi.delta > 0 ? "+" : ""}{userPerturbation.xi.delta.toFixed(2)}
                </span>
              </div>
              {userPerturbation.xi.enabled && (
                <input
                  type="range"
                  min={-0.2}
                  max={0.2}
                  step={0.01}
                  value={userPerturbation.xi.delta}
                  onChange={(e) => setObservableDelta("xi", Number(e.target.value))}
                  style={{ width: "100%", cursor: "pointer" }}
                />
              )}
            </div>

            {/* Legenda */}
            <div style={{ height: "1px", backgroundColor: "#374151", margin: "0.5rem 0" }} />
            <div style={{ fontSize: "0.68rem", opacity: 0.7 }}>
              <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
                <span><span style={{ color: "#60a5fa" }}>●</span> Perturbado</span>
                <span><span style={{ color: "#9ca3af" }}>●</span> Natural</span>
              </div>
              <div style={{ marginTop: "0.3rem", display: "flex", gap: "0.6rem" }}>
                <span><span style={{ color: "#22c55e" }}>●</span> Nagare</span>
                <span><span style={{ color: "#eab308" }}>●</span> Utsuroi</span>
                <span><span style={{ color: "#ef4444" }}>●</span> Katashi</span>
              </div>
            </div>

            {/* Painel RIE - Avaliação da Intervenção */}
            {rieMetrics && (
              <>
                <div style={{ height: "1px", backgroundColor: "#374151", margin: "0.6rem 0" }} />
                <div style={{ fontWeight: 600, marginBottom: "0.4rem", fontSize: "0.75rem" }}>
                  Avaliação RIE
                </div>

                {/* Score Bar */}
                <div style={{ marginBottom: "0.4rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.15rem" }}>
                    <span style={{ fontSize: "0.68rem", opacity: 0.8 }}>Score U</span>
                    <span style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: rieMetrics.uTotal > 0.1 ? "#22c55e" : rieMetrics.uTotal > 0 ? "#eab308" : "#ef4444"
                    }}>
                      {rieMetrics.uTotal > -100 ? rieMetrics.uTotal.toFixed(3) : "N/A"}
                    </span>
                  </div>
                  <div style={{
                    height: "6px",
                    backgroundColor: "#1f2937",
                    borderRadius: "3px",
                    overflow: "hidden"
                  }}>
                    <div style={{
                      width: `${Math.min(100, Math.max(0, (rieMetrics.uTotal + 0.2) / 0.5 * 100))}%`,
                      height: "100%",
                      backgroundColor: rieMetrics.uTotal > 0.1 ? "#22c55e" : rieMetrics.uTotal > 0 ? "#eab308" : "#ef4444",
                      transition: "width 0.2s, background-color 0.2s"
                    }} />
                  </div>
                </div>

                {/* Guardrail Violations */}
                {rieMetrics.violations.length > 0 && (
                  <div style={{
                    backgroundColor: "rgba(127,29,29,0.4)",
                    border: "1px solid rgba(239,68,68,0.5)",
                    borderRadius: "4px",
                    padding: "0.3rem 0.4rem",
                    marginBottom: "0.4rem"
                  }}>
                    <div style={{ fontSize: "0.68rem", color: "#fca5a5", fontWeight: 600 }}>
                      ⚠️ Guardrails violados:
                    </div>
                    {rieMetrics.violations.map((v, i) => (
                      <div key={i} style={{ fontSize: "0.65rem", color: "#fca5a5", marginLeft: "0.5rem" }}>
                        • {v}
                      </div>
                    ))}
                  </div>
                )}

                {/* Reason Chips */}
                {rieMetrics.reasons.length > 0 && (
                  <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
                    {rieMetrics.reasons.map((r, i) => (
                      <span key={i} style={{
                        fontSize: "0.62rem",
                        padding: "0.15rem 0.35rem",
                        borderRadius: "4px",
                        backgroundColor: r.includes("↑") && !r.includes("Σ") && !r.includes("reversibility")
                          ? "rgba(239,68,68,0.3)"
                          : r.includes("↓") && (r.includes("η") || r.includes("DEF") || r.includes("risk"))
                          ? "rgba(34,197,94,0.3)"
                          : "rgba(59,130,246,0.3)",
                        color: "#e5e7eb"
                      }}>
                        {r}
                      </span>
                    ))}
                  </div>
                )}

                {/* Métricas detalhadas */}
                <div style={{ fontSize: "0.65rem", opacity: 0.8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Risk PNR</span>
                    <span style={{ color: rieMetrics.aggregate.riskPnr > 0.6 ? "#ef4444" : "#9ca3af" }}>
                      {(rieMetrics.aggregate.riskPnr * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Cone Opening</span>
                    <span style={{ color: rieMetrics.aggregate.coneOpening > 0.05 ? "#22c55e" : "#9ca3af" }}>
                      {rieMetrics.aggregate.coneOpening.toFixed(3)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Stability</span>
                    <span>{(rieMetrics.aggregate.stability * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Reversibility</span>
                    <span style={{ color: rieMetrics.aggregate.reversibility > 0.4 ? "#22c55e" : "#eab308" }}>
                      {(rieMetrics.aggregate.reversibility * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* Informações do Dataset */}
      {dataset.info && (
        <section
          style={{
            padding: "1rem",
            borderRadius: "0.5rem",
            backgroundColor: "#1f2937",
            border: "1px solid #374151",
          }}
        >
          <h3
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            Informações do Dataset
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "0.8rem",
              fontSize: "0.85rem",
            }}
          >
            <div>
              <span style={{ opacity: 0.7 }}>Domínio:</span>{" "}
              <strong>{dataset.info.domain}</strong>
            </div>
            <div>
              <span style={{ opacity: 0.7 }}>Entidade:</span>{" "}
              <strong>{dataset.info.entity}</strong>
            </div>
            <div>
              <span style={{ opacity: 0.7 }}>Pontos:</span>{" "}
              <strong>{dataset.info.n_points}</strong>
            </div>
            <div>
              <span style={{ opacity: 0.7 }}>Nagare:</span>{" "}
              <strong style={{ color: "#22c55e" }}>
                {(dataset.info.regime_distribution.nagare * 100).toFixed(1)}%
              </strong>
            </div>
            <div>
              <span style={{ opacity: 0.7 }}>Utsuroi:</span>{" "}
              <strong style={{ color: "#eab308" }}>
                {(dataset.info.regime_distribution.utsuroi * 100).toFixed(1)}%
              </strong>
            </div>
            <div>
              <span style={{ opacity: 0.7 }}>Katashi:</span>{" "}
              <strong style={{ color: "#ef4444" }}>
                {(dataset.info.regime_distribution.katashi * 100).toFixed(1)}%
              </strong>
            </div>
          </div>
        </section>
      )}

      {/* Documentação */}
      <section style={{ fontSize: "0.85rem", opacity: 0.9 }}>
        <h3
          style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}
        >
          Sobre o Radiante Pentadimensional
        </h3>
        <p style={{ marginBottom: "0.5rem" }}>
          O Radiante opera sobre <strong>cinco observáveis estruturais</strong>:
        </p>
        <ul style={{ marginLeft: "1.5rem", marginBottom: "0.5rem" }}>
          <li>
            <strong>Oh</strong> — Homologia (pressão estrutural)
          </li>
          <li>
            <strong>Φ</strong> — Memória (persistência temporal)
          </li>
          <li>
            <strong>η</strong> — Rigidez (resistência à perturbação)
          </li>
          <li>
            <strong>Ξ</strong> — Diversidade (entropia de caminhos)
          </li>
          <li>
            <strong>DEF</strong> — Déficit (divergência estado-fase)
          </li>
        </ul>
        <p>
          Escolha diferentes <strong>projeções 3D</strong> para explorar
          aspectos específicos do espaço pentadimensional. A detecção de{" "}
          <strong>pré-PNR</strong> identifica estados pré-críticos onde
          intervenções ainda são efetivas.
        </p>
      </section>
    </main>
  );
}
