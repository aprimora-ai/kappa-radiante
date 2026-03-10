# O Radiante Estrutural

**Camada de visualização e análise formal do Método Kappa**

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.18883639.svg)](https://doi.org/10.5281/zenodo.18883639)
[![License: CC BY 4.0](https://img.shields.io/badge/License-CC_BY_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)

> *"Na astronomia, o radiante é o ponto do céu do qual trajetórias de meteoros parecem convergir quando projetadas em 2D. O Radiante Estrutural opera a operação inversa — toma trajetórias de alta dimensão e as projeta em espaços interpretáveis, preservando as propriedades de regime que importam."*
>
> — David Ohio, 2026

---

## O que é

O Radiante Estrutural é um instrumento de navegação para o espaço pentadimensional do **Método Kappa**. Onde o Kappa detecta instabilidade estrutural em séries temporais, o Radiante responde às perguntas que a detecção levanta:

- **Em que regime está o sistema?** (Nagare / Utsuroi / Katashi)
- **Com que velocidade se move em direção à ruptura?**
- **Qual o custo energético de reorganização?** (sub-observável gravitacional Ψ)
- **Para onde vai depois?**

O instrumento introduz a **condição de análise de custo em formato de ação gravitacional** — a quantidade de trabalho que um sistema precisa realizar contra seu próprio campo gravitacional estrutural para sair de um regime cristalizado.

---

## Ecossistema Kappa

O Radiante é a camada visual de um ecossistema de ferramentas baseadas no Método Kappa:

| Publicação | DOI | Papel no ecossistema |
|---|---|---|
| **Kappa Method** (relatório técnico) | [10.5281/zenodo.18883639](https://doi.org/10.5281/zenodo.18883639) | Fundamento teórico — define Oh, Φ, η, Ξ, DEF e os três regimes |
| **Kappa-FIN v3** | [10.5281/zenodo.18917558](https://doi.org/10.5281/zenodo.18917558) | Aplicação financeira — 17 crises (1985–2023), GFC 2008 detectada com 10 meses de antecedência |
| **Kappa-LLM** | [10.5281/zenodo.18883790](https://doi.org/10.5281/zenodo.18883790) | Aplicação em LLMs — detecção de alucinações via dinâmica de atenção, AUC 94.2% |
| **Radiante Estrutural** ← *este repositório* | — | Visualização e análise formal. Schema radiante.v1. Sub-observável gravitacional Ψ. |
| **Kappa-GEO** *(em desenvolvimento)* | — | Aplicação geopolítica — redes GDELT, EII, Γ_ext = EII·g_eff |

---

## O Vetor de Estado K(t)

Todo sistema compatível com o Método Kappa produz o vetor:

```
K(t) = (Oh(t), Φ(t), η(t), Ξ(t), DEF(t))
```

| Observável | Nome | Interpretação |
|---|---|---|
| `Oh(t)` | Número de Ohio | Pressão topológica. Oh > 1 = regime supercrítico |
| `Φ(t)` | Memória Estrutural | Dano acumulado sem resolução |
| `η(t)` | Rigidez Dinâmica | Resistência à reorganização. η → 1 = travamento |
| `Ξ(t)` | Diversidade Estrutural | Graus de liberdade topológicos disponíveis |
| `DEF(t)` | Déficit Estado-Fase | Divergência entre estado corrente e espaço de fase esperado |

---

## Os Três Regimes

| Regime | Japonês | Critérios formais | Dinâmica |
|---|---|---|---|
| **Nagare** | 流れ | Ξ > 0.6, η < 0.4, DEF < 0.3 | Fluxo adaptativo — pressão distribuída |
| **Utsuroi** | 移ろい | Estado liminar | Máxima sensibilidade a intervenções |
| **Katashi** | 硬し | η > 0.6, Φ > 0.6, Ξ < 0.4 | Cristalização — precede ruptura SPS |

---

## Sub-observável Gravitacional Ψ

O Radiante introduz a análise de custo de reorganização como **ação gravitacional**:

```
g_eff(t) = g₀ + α_η·η + α_Φ·Φ + α_D·DEF + α_Oh·max(0, Oh - 1)
Ψ(t)     = g_eff(t) · z(t)
Γ_t      = max(0, Ψ(t+1) − Ψ(t))   # custo de reorganização
```

Quando Γ é alto mas o sistema não reorganiza, o sistema está **selado sob pressão** — análogo geopolítico ao travamento financeiro de 2007–2008.

---

## Schema radiante.v1

O schema de intercâmbio é agnóstico ao domínio. Qualquer saída do Método Kappa pode ser convertida para radiante.v1:

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
    "events":  [{ "type": "alert", "label": "IRREVERSIBILIDADE ATINGIDA", "severity": 1.0 }]
  }],
  "links": []
}
```

O campo `signals` é catch-all — aceita qualquer float sem quebrar o schema. O campo `links` é a infraestrutura para redes multi-entidade (Kappa-GEO).

---

## Demos incluídos

| Arquivo | Domínio | Evento chave |
|---|---|---|
| `finance_2008_gfc_demo.json` | Financeiro | GFC 2008 — onset Katashi nov/2007, Lehman set/2008. Dados reais Kappa-FIN v3. |
| `finance_demo.json` | Financeiro | BTC/USD — demonstração de regime volátil |
| `political_demo.json` | Político | Blogosfera 2004 (Adamic & Glance) — câmaras de eco em Katashi |
| `education_withdrawn_demo.json` | Educacional | OULAD 2014J — abandono detectado via Katashi precoce |
| `education_pass_demo.json` | Educacional | OULAD 2014J — trajetória de aprovação em Utsuroi |
| `llm_demo.json` | LLM | Mistral-7B HaluEval — alucinação como atrator obsessivo |
| `news_demo.json` | Mídia | Ciclo de notícias de tecnologia |

---

## Estrutura do Repositório

```
katashi-radiante-3d/
├── lib/
│   ├── pentadimensional.ts    # StateVector5D, classificação de regime, PNR, projeção 3D
│   ├── gravitational.ts       # Ψ(t), g_eff(t), Γ, travamento gravitacional
│   ├── radiante-schema.ts     # Schema radiante.v1 com Zod
│   └── data-adapter.ts        # Conversão radiante.v1 → StructuralTimePoint
├── components/
│   ├── RadiantScene.tsx        # Visualização 3D (modo instrumento/fase)
│   └── RadiantScene5D.tsx      # Visualização 5D com projeções configuráveis
├── sample_runs/               # Demos multi-domínio (schema radiante.v1)
├── CITATION.cff
└── README.md
```

---

## Instalação

```bash
npm install
npm run dev
```

Requer Node.js 18+.

---

## Citação

```bibtex
@software{ohio2026radiante,
  author    = {Ohio, David},
  title     = {O Radiante Estrutural: Um Instrumento Pentadimensional para
               Visualização e Análise de Trajetórias Estruturais em Sistemas Complexos},
  year      = {2026},
  publisher = {Zenodo},
  note      = {Implementação visual do Método Kappa. Introduz sub-observável
               gravitacional Ψ(t) e schema radiante.v1.}
}
```

Para citar o **Método Kappa** (fundamento teórico):
```
Ohio, D. (2026). Kappa: A Method for Informational Regime Detection via Geometry and Dynamics.
Zenodo. DOI: 10.5281/zenodo.18883639
```

Para citar o **Kappa-FIN** (aplicação financeira):
```
Ohio, D. (2026). Kappa-FIN: Topological Early Warning System for Financial Market Crises.
Zenodo. DOI: 10.5281/zenodo.18917558
```

Para citar o **Kappa-LLM** (aplicação em LLMs):
```
Ohio, D. (2026). Kappa-LLM: Multi-Observable Topological Detection of Hallucinations in LLMs.
Zenodo. DOI: 10.5281/zenodo.18883790
```

---

## Autor

**David Ohio** — Pesquisador Independente  
odavidohio@gmail.com  
GitHub: [aprimora-ai](https://github.com/aprimora-ai)

---

## Licença

[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
