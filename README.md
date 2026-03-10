# Kappa-Radiante

**Visualization and formal analysis layer of the Kappa Method**

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.18932379.svg)](https://doi.org/10.5281/zenodo.18932379)
[![License: CC BY 4.0](https://img.shields.io/badge/License-CC_BY_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)

**Paper:** [`paper/radiante_structural_v1_ohio2026.pdf`](paper/radiante_structural_v1_ohio2026.pdf)

> **Canonical version:** DOI [10.5281/zenodo.18932379](https://doi.org/10.5281/zenodo.18932379) (immutable, timestamped)  
> **SHA-256:** `df5f3b831d80d970efecad47d58a1262550bf22f55eca64ad634e1d35f8cf657`  
> To verify: `certutil -hashfile radiante_structural_v1_ohio2026.pdf SHA256` (Windows) or `sha256sum radiante_structural_v1_ohio2026.pdf` (Linux/Mac)

> *"In astronomy, the radiant is the point in the sky from which meteor trajectories appear to converge when projected onto 2D. The Structural Radiante operates the inverse — it takes high-dimensional trajectories and projects them into interpretable spaces, preserving the regime properties that matter."*
>
> — David Ohio, 2026

---

## What it is

The Structural Radiante (*Radiante Estrutural*) is a navigation instrument for the pentadimensional state space of the **Kappa Method**. Where the Kappa Method detects structural instability in time series, the Radiante answers the questions that detection raises:

- **What regime is the system in?** (Nagare / Utsuroi / Katashi)
- **How fast is it moving toward rupture?**
- **What is the energetic cost of reorganization?** (gravitational sub-observable Ψ)
- **Where does it go next?**

The instrument introduces **cost analysis as gravitational action** — the amount of work a system must perform against its own structural gravitational field to exit a crystallized regime.

---

## The Kappa Ecosystem

The Radiante is the visualization layer of a family of tools built on the Kappa Method:

| Publication | DOI | Role |
|---|---|---|
| **Kappa Method** (technical report) | [10.5281/zenodo.18883639](https://doi.org/10.5281/zenodo.18883639) | Theoretical foundation — defines Oh, Φ, η, Ξ, DEF and the three regimes |
| **Kappa-FIN v3** | [10.5281/zenodo.18917558](https://doi.org/10.5281/zenodo.18917558) | Financial application — 17 historical crises (1985–2023), GFC 2008 detected 10 months before Lehman |
| **Kappa-LLM** | [10.5281/zenodo.18883790](https://doi.org/10.5281/zenodo.18883790) | LLM application — hallucination detection via attention dynamics, AUC 94.2% |
| **Kappa-Radiante** ← *this repository* | [10.5281/zenodo.18932379](https://doi.org/10.5281/zenodo.18932379) | Visualization and formal analysis. Schema radiante.v1. Gravitational sub-observable Ψ. |
| **Kappa-GEO** *(in development)* | — | Geopolitical application — GDELT networks, EII, Γ_ext = EII·g_eff |

---

## The State Vector K(t)

Every system compatible with the Kappa Method produces the vector:

```
K(t) = (Oh(t), Φ(t), η(t), Ξ(t), DEF(t))
```

| Observable | Name | Interpretation |
|---|---|---|
| `Oh(t)` | Ohio Number | Topological pressure. Oh > 1 = supercritical regime |
| `Φ(t)` | Structural Memory | Accumulated unresolved damage |
| `η(t)` | Dynamic Rigidity | Resistance to reorganization. η → 1 = gravitational locking |
| `Ξ(t)` | Structural Diversity | Available topological degrees of freedom |
| `DEF(t)` | State-Phase Deficit | Divergence between current state and expected phase space |

---

## The Three Regimes

| Regime | Japanese | Formal criteria | Dynamics |
|---|---|---|---|
| **Nagare** | 流れ | Ξ > 0.6, η < 0.4, DEF < 0.3 | Adaptive flow — pressure distributed across topology |
| **Utsuroi** | 移ろい | Liminal state | Maximum sensitivity to interventions |
| **Katashi** | 硬し | η > 0.6, Φ > 0.6, Ξ < 0.4 | Crystallization — locked correlations, precedes SPS rupture |

---

## Gravitational Sub-observable Ψ

The Radiante introduces reorganization cost analysis as **gravitational action**:

```
g_eff(t) = g₀ + α_η·η + α_Φ·Φ + α_D·DEF + α_Oh·max(0, Oh - 1)
Ψ(t)     = g_eff(t) · z(t)
Γ_t      = max(0, Ψ(t+1) − Ψ(t))   # reorganization cost
```

When Γ is high but the system does not reorganize, it is **sealed under pressure** — the geopolitical analogue of the financial gravitational locking of 2007–2008.

---

## Schema radiante.v1

The exchange schema is domain-agnostic. Any Kappa Method output can be converted to radiante.v1:

```json
{
  "schema_version": "radiante.v1",
  "domain": "finance",
  "entity": { "id": "SP500_GFC2008" },
  "series": [{
    "t": 4,
    "state":   { "oh": 1.302, "phi": 0.241, "eta": 0.247, "xi": 0.667, "def": 0.722 },
    "regime":  { "label": "katashi", "score": 0.94 },
    "signals": { "nu_s": 386.0 },
    "events":  [{ "type": "alert", "label": "IRREVERSIBILITY REACHED", "severity": 1.0 }]
  }],
  "links": []
}
```

The `signals` field is catch-all — accepts any float without schema changes. The `links` field is the infrastructure for multi-entity networks (Kappa-GEO).

---

## Included Demos

| File | Domain | Key event |
|---|---|---|
| `finance_2008_gfc_demo.json` | Financial | GFC 2008 — Katashi onset Nov/2007, Lehman Sep/2008. Real data from Kappa-FIN v3. |
| `finance_demo.json` | Financial | BTC/USD — volatile regime demonstration |
| `political_demo.json` | Political | 2004 blogosphere (Adamic & Glance) — echo chambers in Katashi |
| `education_withdrawn_demo.json` | Educational | OULAD 2014J — dropout detected via early Katashi |
| `education_pass_demo.json` | Educational | OULAD 2014J — passing trajectory in Utsuroi |
| `llm_demo.json` | LLM | Mistral-7B HaluEval — hallucination as obsessive attractor |
| `news_demo.json` | Media | Technology news cycle |

---

## Repository Structure

```
kappa-radiante/
├── lib/
│   ├── pentadimensional.ts    # StateVector5D, regime classification, PNR, 3D projection
│   ├── gravitational.ts       # Ψ(t), g_eff(t), Γ, gravitational locking
│   ├── radiante-schema.ts     # Schema radiante.v1 with Zod
│   └── data-adapter.ts        # radiante.v1 → StructuralTimePoint conversion
├── components/
│   ├── RadiantScene.tsx        # Interactive 3D scene (instrument/phase mode)
│   └── RadiantScene5D.tsx      # Interactive 3D scene with configurable 5D projections
├── sample_runs/               # Multi-domain demos (schema radiante.v1)
├── political/                 # Political validation scripts + polblogs dataset
├── CITATION.cff
└── README.md
```

---

## Installation

```bash
npm install
npm run dev
```

Requires Node.js 18+.

---

## Citation

```bibtex
@software{ohio2026radiante,
  author    = {Ohio, David},
  title     = {Kappa-Radiante: Visualization and Formal Analysis Layer
               of the Kappa Method},
  year      = {2026},
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.18932379},
  url       = {https://doi.org/10.5281/zenodo.18932379},
  note      = {Introduces gravitational sub-observable Ψ(t) and schema radiante.v1.}
}
```

To cite the **Kappa Method** (theoretical foundation):
```
Ohio, D. (2026). Kappa: A Method for Informational Regime Detection via Geometry and Dynamics.
Zenodo. DOI: 10.5281/zenodo.18883639
```

To cite **Kappa-FIN** (financial application):
```
Ohio, D. (2026). Kappa-FIN: Topological Early Warning System for Financial Market Crises.
Zenodo. DOI: 10.5281/zenodo.18917558
```

To cite **Kappa-LLM** (LLM application):
```
Ohio, D. (2026). Kappa-LLM: Multi-Observable Topological Detection of Hallucinations in LLMs.
Zenodo. DOI: 10.5281/zenodo.18883790
```

---

## Author

**David Ohio** — Independent Researcher  
odavidohio@gmail.com  
GitHub: [aprimora-ai](https://github.com/aprimora-ai)

---

## License

[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
