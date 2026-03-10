"use client";

import { useMemo, useState } from "react";
import RadiantScene, {
  RadiantMode,
  RadiantStatePoint,
  computeFlowMetrics
} from "../components/RadiantScene";
import data from "../public/data/state.json";

const typedData = data as RadiantStatePoint[];

export default function HomePage() {
  const [mode, setMode] = useState<RadiantMode>("instrument");
  const [timeIndex, setTimeIndex] = useState(0);
  const [calm, setCalm] = useState(0.35);
  const [showFlow, setShowFlow] = useState(true);
  const [showParticles, setShowParticles] = useState(true);

  const maxIndex = Math.max(typedData.length - 1, 0);
  const clampedIndex = Math.max(0, Math.min(maxIndex, timeIndex));

  const { laminarity, turbulence } = useMemo(
    () => computeFlowMetrics(typedData, mode, calm),
    [mode, calm]
  );

  const current = typedData[clampedIndex];
  const prev = typedData[Math.max(0, clampedIndex - 1)];
  const isPhase = mode === "phase";
  const phiDelta = current ? current.phi - prev.phi : 0;

  const L = laminarity[clampedIndex] ?? 1;
  const T = turbulence[clampedIndex] ?? 0;

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        padding: "1.5rem",
        boxSizing: "border-box",
        gap: "1.5rem"
      }}
    >
      <header>
        <h1 style={{ fontSize: "2rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          Radiante · Espaço de Estados 3D
        </h1>
        <p style={{ maxWidth: 640, fontSize: "0.95rem", opacity: 0.85 }}>
          Visualização 3D dinâmica dos estados temporais de um sistema
          informacional. Explore o espaço de estados em modos de Instrumento e
          Fase, com fluxo laminar vs caótico em torno da trajetória.
        </p>
      </header>

      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          alignItems: "flex-start",
          flexWrap: "wrap"
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "1rem",
            alignItems: "center",
            flexWrap: "wrap"
          }}
        >
          <span style={{ fontSize: "0.9rem", opacity: 0.85 }}>Modo:</span>
          <button
            type="button"
            onClick={() => setMode("instrument")}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: "999px",
              border: "1px solid",
              borderColor: mode === "instrument" ? "#22c55e" : "#4b5563",
              backgroundColor:
                mode === "instrument" ? "#022c22" : "transparent",
              color: "#e5e7eb",
              cursor: "pointer",
              fontSize: "0.9rem"
            }}
          >
            Instrumento
          </button>
          <button
            type="button"
            onClick={() => setMode("phase")}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: "999px",
              border: "1px solid",
              borderColor: mode === "phase" ? "#facc15" : "#4b5563",
              backgroundColor: mode === "phase" ? "#422006" : "transparent",
              color: "#e5e7eb",
              cursor: "pointer",
              fontSize: "0.9rem"
            }}
          >
            Fase
          </button>

          <span
            style={{
              marginLeft: "1.5rem",
              fontSize: "0.9rem",
              opacity: 0.85
            }}
          >
            Fluxo:
          </span>
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
              fontSize: "0.85rem"
            }}
          >
            {showFlow ? "On" : "Off"}
          </button>

          <span
            style={{
              marginLeft: "0.75rem",
              fontSize: "0.9rem",
              opacity: 0.85
            }}
          >
            Partículas:
          </span>
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
              fontSize: "0.85rem"
            }}
          >
            {showParticles ? "On" : "Off"}
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1.5rem",
            alignItems: "center"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>Tempo</span>
            <input
              type="range"
              min={0}
              max={maxIndex}
              step={1}
              value={clampedIndex}
              onChange={(e) => setTimeIndex(Number(e.target.value))}
              style={{ width: "220px" }}
            />
            <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>
              {current?.t ?? "-"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>CALM</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={calm}
              onChange={(e) => setCalm(Number(e.target.value))}
              style={{ width: "180px" }}
            />
            <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>
              {calm.toFixed(2)}
            </span>
          </div>
        </div>
      </section>

      <section
        style={{
          flex: 1,
          minHeight: "60vh",
          position: "relative",
          borderRadius: "0.75rem",
          border: "1px solid #1f2937",
          overflow: "hidden",
          background:
            "radial-gradient(circle at top, rgba(96,165,250,0.12), transparent 55%), #020617"
        }}
      >
        <RadiantScene
          data={typedData}
          mode={mode}
          timeIndex={clampedIndex}
          calm={calm}
          showFlow={showFlow}
          showParticles={showParticles}
        />

        {current && (
          <div
            style={{
              position: "absolute",
              right: "1.1rem",
              top: "1rem",
              padding: "0.6rem 0.9rem",
              borderRadius: "0.6rem",
              backgroundColor: "rgba(15,23,42,0.85)",
              border: "1px solid rgba(148,163,184,0.45)",
              fontSize: "0.78rem",
              color: "#e5e7eb",
              pointerEvents: "none",
              maxWidth: "260px"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.15rem"
              }}
            >
              <span style={{ opacity: 0.7 }}>t</span>
              <span>{current.t}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between"
              }}
            >
              <span style={{ opacity: 0.7 }}>Oh</span>
              <span>{current.Oh.toFixed(3)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between"
              }}
            >
              <span style={{ opacity: 0.7 }}>{isPhase ? "Δφ" : "φ"}</span>
              <span>
                {(isPhase ? phiDelta : current.phi).toFixed(3)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between"
              }}
            >
              <span style={{ opacity: 0.7 }}>η</span>
              <span>{current.eta.toFixed(3)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "0.35rem"
              }}
            >
              <span style={{ opacity: 0.7 }}>L (laminaridade)</span>
              <span>{L.toFixed(3)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between"
              }}
            >
              <span style={{ opacity: 0.7 }}>T (turbulência)</span>
              <span>{T.toFixed(3)}</span>
            </div>
          </div>
        )}
      </section>

      <section style={{ fontSize: "0.85rem", opacity: 0.9 }}>
        <p>
          <strong>Instrumento:</strong> mapeia diretamente Oh, φ e η em X, Y e
          Z, mostrando o espaço de estados medido.
        </p>
        <p>
          <strong>Fase:</strong> substitui φ por Δφ, evidenciando transições e
          variações entre estados consecutivos.
        </p>
      </section>
    </main>
  );
}

