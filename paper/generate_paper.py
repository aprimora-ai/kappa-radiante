from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_LEFT
from reportlab.lib.colors import HexColor, black
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
import os

W, H = A4
BLUE_DARK  = HexColor('#1F3864')
BLUE_MED   = HexColor('#2E5C99')
BLUE_LIGHT = HexColor('#E0E8F4')
GREY_LINE  = HexColor('#CCCCCC')
GREY_TXT   = HexColor('#555555')
CODE_BG    = HexColor('#F5F5F5')
CODE_BLUE  = HexColor('#1a3a5c')

def S():
    s = {}
    s['title'] = ParagraphStyle('title', fontName='Times-Bold', fontSize=20, leading=26,
        textColor=BLUE_DARK, alignment=TA_CENTER, spaceAfter=6)
    s['subtitle'] = ParagraphStyle('subtitle', fontName='Times-Italic', fontSize=12, leading=16,
        textColor=HexColor('#444444'), alignment=TA_CENTER, spaceAfter=4)
    s['author'] = ParagraphStyle('author', fontName='Times-Bold', fontSize=11,
        textColor=black, alignment=TA_CENTER, spaceAfter=2)
    s['affil'] = ParagraphStyle('affil', fontName='Times-Roman', fontSize=10,
        textColor=GREY_TXT, alignment=TA_CENTER, spaceAfter=2)
    s['abstract'] = ParagraphStyle('abstract', fontName='Times-Roman', fontSize=10, leading=14,
        textColor=black, alignment=TA_JUSTIFY,
        leftIndent=1*cm, rightIndent=1*cm, spaceAfter=4)
    s['kw'] = ParagraphStyle('kw', fontName='Times-Roman', fontSize=9.5, leading=13,
        textColor=GREY_TXT, alignment=TA_JUSTIFY,
        leftIndent=1*cm, rightIndent=1*cm, spaceAfter=10)
    s['h1'] = ParagraphStyle('h1', fontName='Times-Bold', fontSize=13, leading=16,
        textColor=BLUE_DARK, spaceBefore=14, spaceAfter=4)
    s['h2'] = ParagraphStyle('h2', fontName='Times-Bold', fontSize=11, leading=14,
        textColor=BLUE_MED, spaceBefore=10, spaceAfter=3)
    s['body'] = ParagraphStyle('body', fontName='Times-Roman', fontSize=10.5, leading=15,
        textColor=black, alignment=TA_JUSTIFY, spaceAfter=5)
    s['code'] = ParagraphStyle('code', fontName='Courier', fontSize=8.5, leading=12,
        textColor=CODE_BLUE, leftIndent=1*cm, rightIndent=0.5*cm,
        spaceBefore=4, spaceAfter=4, backColor=CODE_BG)
    s['ref'] = ParagraphStyle('ref', fontName='Times-Roman', fontSize=9.5, leading=13,
        textColor=black, alignment=TA_JUSTIFY,
        leftIndent=1.2*cm, firstLineIndent=-1.2*cm, spaceAfter=5)
    s['tbl_hdr'] = ParagraphStyle('tbl_hdr', fontName='Times-Bold', fontSize=9, leading=12)
    s['tbl_cell'] = ParagraphStyle('tbl_cell', fontName='Times-Roman', fontSize=9, leading=12,
        alignment=TA_LEFT)
    s['caption'] = ParagraphStyle('caption', fontName='Times-Italic', fontSize=9,
        textColor=GREY_TXT, alignment=TA_CENTER, spaceAfter=6)
    return s

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Times-Italic', 8)
    canvas.setFillColor(GREY_TXT)
    if doc.page > 1:
        canvas.drawRightString(W - 2.2*cm, 1.2*cm,
            f'Ohio, D. (2026). The Structural Radiante — DOI: 10.5281/zenodo.18932379    p. {doc.page}')
        canvas.setStrokeColor(GREY_LINE)
        canvas.setLineWidth(0.5)
        canvas.line(2.2*cm, 1.6*cm, W - 2.2*cm, 1.6*cm)
    canvas.restoreState()

def sp(n=1): return Spacer(1, n*5)
def hr(): return HRFlowable(width='100%', thickness=0.8, color=BLUE_DARK, spaceAfter=6, spaceBefore=6)
def hrl(): return HRFlowable(width='100%', thickness=0.4, color=GREY_LINE, spaceAfter=4, spaceBefore=4)

def tbl(headers, rows, widths, s):
    data = [[Paragraph(h, s['tbl_hdr']) for h in headers]]
    for row in rows:
        data.append([Paragraph(c, s['tbl_cell']) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BLUE_LIGHT),
        ('GRID', (0,0), (-1,-1), 0.4, GREY_LINE),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    return t

def code(lines, s):
    return Paragraph('<br/>'.join(lines), s['code'])

def build():
    out = os.path.join(os.path.dirname(__file__), 'radiante_structural_v1_ohio2026.pdf')
    doc = SimpleDocTemplate(out, pagesize=A4,
        leftMargin=2.2*cm, rightMargin=2.2*cm,
        topMargin=2.2*cm, bottomMargin=2.4*cm,
        title='The Structural Radiante',
        author='David Ohio',
        subject='Kappa Method — Visualization and Formal Analysis Layer')
    s = S()
    story = []

    # TITLE
    story += [
        sp(2),
        Paragraph('The Structural Radiante', s['title']),
        Paragraph('A Pentadimensional Instrument for Visualization and Analysis of '
                  'Structural Trajectories in Complex Systems', s['subtitle']),
        sp(1), hr(),
        Paragraph('David Ohio', s['author']),
        Paragraph('Independent Researcher — odavidohio@gmail.com', s['affil']),
        Paragraph('March 2026', s['affil']),
        hr(), sp(1),
    ]

    # ABSTRACT
    story.append(Paragraph('<b>Abstract</b>', ParagraphStyle('abl', fontName='Times-Bold',
        fontSize=10, leftIndent=1*cm, spaceAfter=2)))
    story.append(Paragraph(
        'The Structural Radiante is the visualization and formal analysis layer of the Kappa Method '
        '(Ohio, 2026a). The Kappa Method detects structural instability in time series via five '
        'topological observables: the Ohio Number <i>Oh(t)</i>, structural memory <i>&Phi;(t)</i>, '
        'dynamic rigidity <i>&eta;(t)</i>, structural diversity <i>&Xi;(t)</i>, and state-phase '
        'deficit <i>DEF(t)</i>. The Radiante transforms these observables into a dimensional '
        'navigation instrument that answers the questions the Kappa raises but does not directly '
        'resolve: what regime is the system in? How fast is it moving toward rupture? What is the '
        'energetic cost of reorganization? Where does it go next? '
        'This paper presents: (i) the geometry of the pentadimensional space K(t) and the three '
        'archetypal regimes — Nagare (JP: <i>nagare</i>, flow), Utsuroi (JP: <i>utsuroi</i>, '
        'transition), and Katashi (JP: <i>katashi</i>, crystallization); (ii) the gravitational '
        'sub-observable &Psi;(t), which quantifies the cost of structural reorganization as '
        'gravitational action; (iii) the domain-agnostic exchange schema radiante.v1; and '
        '(iv) empirical validations across four domains: the 2008 Global Financial Crisis via '
        'Kappa-FIN v3 (DOI: 10.5281/zenodo.18917558), the polarized political blogosphere '
        '(Adamic &amp; Glance, 2005), educational dropout (OULAD dataset), and LLM hallucination '
        'detection via Kappa-LLM (DOI: 10.5281/zenodo.18883790). The GFC 2008 analysis demonstrates '
        'that the Katashi onset detected in November 2007 — ten months before the Lehman Brothers '
        'bankruptcy — constitutes the first retrospective validation case of the framework. '
        'Section 7 presents the multi-entity network extension that constitutes the architectural '
        'gateway for Kappa-GEO, an ongoing geopolitical application.',
        s['abstract']))
    story.append(Paragraph(
        '<b>Keywords:</b> topological data analysis; Kappa Method; regime transitions; complex '
        'systems; gravitational sub-observable; gravitational action; Kappa-FIN; Kappa-LLM; '
        'Kappa-GEO; Law of Ohio; persistent homology; Forman-Ricci curvature.',
        s['kw']))
    story.append(hrl())

    # 1. INTRODUCTION
    story.append(Paragraph('1. Introduction', s['h1']))
    story.append(Paragraph(
        'The Kappa Method (Ohio, 2026a) is a mathematical framework for detecting structural '
        'instability in any system representable as an interaction network. Published under DOI '
        '10.5281/zenodo.18883639, the Kappa Method has been validated in financial markets, '
        'large language models, and educational dropout prediction. The method delivers a '
        'five-component state vector for each temporal window: '
        'K(t) = (Oh, &Phi;, &eta;, &Xi;, DEF). The question the Radiante answers is: '
        '<i>how does one navigate this five-dimensional space?</i>', s['body']))
    story.append(Paragraph(
        'The etymology of the name is precise. In astronomy, the <i>radiant</i> is the point in '
        'the sky from which meteor trajectories appear to converge when projected onto 2D. The '
        'Structural Radiante performs the inverse operation — it takes high-dimensional trajectories '
        'and projects them into interpretable spaces, preserving the regime properties that matter '
        'for analysis. The instrument renders K(t) as an interactive 3D trajectory with '
        'configurable projection modes.', s['body']))
    story.append(Paragraph(
        'This paper also introduces the <b>gravitational sub-observable &Psi;(t)</b> — the first '
        'formalization of the energetic cost of regime transitions in the Kappa ecosystem — and '
        'the <b>radiante.v1 schema</b>, a domain-agnostic exchange format. Section 7 formalizes '
        'the multi-entity extension that serves as the architectural gateway for Kappa-GEO, the '
        'geopolitical extension of the Kappa Method currently in development.', s['body']))
    story.append(Paragraph(
        'The publication sequence — Kappa-FIN &rarr; Radiante &rarr; Kappa-GEO — is not merely '
        'chronological: it is <b>architectural</b>. Each layer presupposes the previous one. '
        'Kappa-GEO requires the gravitational formalism of &Psi; and the multi-entity '
        'infrastructure of the <font face="Courier" size="9">links</font> field, both of which '
        'are formally established here.', s['body']))

    # 2. STATE VECTOR
    story.append(Paragraph('2. The Pentadimensional State Vector K(t)', s['h1']))
    story.append(Paragraph('2.1 Formal Definition', s['h2']))
    story.append(Paragraph('The pentadimensional state vector is defined as:', s['body']))
    story.append(code([
        'K(t) = (Oh(t), &Phi;(t), &eta;(t), &Xi;(t), DEF(t))',
        '     &isin; [0,&infin;) x [0,&infin;) x [0,1] x [0,1] x [0,1]'
    ], s))
    story += [sp(), tbl(
        ['Observable', 'Symbol', 'Interpretation in the Radiante'],
        [
            ['Ohio Number', 'Oh(t)', 'H1 homological pressure. Oh > 1 = supercritical regime — system above the irreversibility threshold'],
            ['Structural Memory', '&Phi;(t)', 'Integral of correlation anomalies. Accumulated topological damage without resolution'],
            ['Dynamic Rigidity', '&eta;(t)', 'System resistance to reorganization. &eta; &rarr; 1 = imminent gravitational locking'],
            ['Structural Diversity', '&Xi;(t)', 'Entropy of topological paths. &Xi; &rarr; 0 = channeling, loss of degrees of freedom'],
            ['State-Phase Deficit', 'DEF(t)', 'Divergence between current state and expected phase space. Dynamic disconnection'],
        ],
        [3.2*cm, 2.0*cm, 9.3*cm], s), sp()]

    story.append(Paragraph(
        'The <b>structural viscosity</b> &nu;<sub>s</sub>(t) = &tau;<sub>Katashi</sub> &times; '
        '&eta;<sub>Katashi</sub> / (&Xi;<sub>Katashi</sub> + &epsilon;) is a derived observable '
        'that quantifies resistance to reorganization. In the GFC 2008 case: '
        '&nu;<sub>s</sub> = 386 &times; 1.123 / (0.286 + &epsilon;) = 1517.6 — corresponding '
        'to complete gravitational locking before the September 2008 collapse.', s['body']))

    story.append(Paragraph('2.2 Relationship with Kappa-FIN', s['h2']))
    story.append(Paragraph(
        'Kappa-FIN v3 (Ohio, 2026b) delivers as output the file '
        '<font face="Courier" size="9">kappa_v3_state.csv</font> with columns '
        '<font face="Courier" size="9">Oh, phi, eta, Xi, DEF, regime</font> for each date. '
        'The Radiante data-adapter converts this CSV directly to radiante.v1 format, adding '
        'derived phases, regime classification, and the gravitational sub-observable. The demo '
        '<font face="Courier" size="9">finance_2008_gfc_demo.json</font> in this repository '
        'is the Radiante visualization of real Kappa-FIN v3 results for the GFC 2008.',
        s['body']))

    # 3. STRUCTURAL REGIMES
    story.append(Paragraph('3. Structural Regimes', s['h1']))
    story.append(Paragraph('3.1 The Three Regimes', s['h2']))
    story += [tbl(
        ['Regime', 'Japanese', 'Formal Criteria', 'Dynamics'],
        [
            ['Nagare', 'Nagare (JP: nagare, flow)', '&Xi; > 0.6, &eta; < 0.4, DEF < 0.3', 'Adaptive flow — system distributes pressure across diverse topological paths'],
            ['Utsuroi', 'Utsuroi (JP: utsuroi, transition)', 'Liminal state', 'Transition — maximum sensitivity to interventions; system left stability but not yet locked'],
            ['Katashi', 'Katashi (JP: katashi, crystallization)', '&eta; > 0.6, &Phi; > 0.6, &Xi; < 0.4', 'Crystallization — locked correlations, accumulated memory; precedes SPS rupture'],
        ],
        [2.0*cm, 2.8*cm, 4.0*cm, 5.7*cm], s), sp()]

    story.append(Paragraph('3.2 Point of No Return (PNR)', s['h2']))
    story.append(Paragraph(
        'The PNR is signaled when simultaneously: (i) Oh(t) > 0.85; (ii) regime curvature '
        '&kappa;(t) > 0.80; and (iii) regime &ne; Nagare. In the GFC 2008, the formal '
        'irreversibility condition — &Phi; > &Phi;* = 0.184 — was reached on 2007-11-13 '
        'with &Phi; = 0.241. From this point, the system had no endogenous reorganization '
        'capacity. The Lehman Brothers bankruptcy was the exogenous event that dissipated '
        'the accumulated potential barrier.', s['body']))

    # 4. GRAVITATIONAL SUB-OBSERVABLE
    story.append(Paragraph('4. The Gravitational Sub-Observable &Psi;', s['h1']))
    story.append(Paragraph('4.1 Emergent Gravitational Field', s['h2']))
    story.append(Paragraph(
        'The gravitational field answers: given the current structural state K(t), what is the '
        'cost of moving the system one step forward? The effective gravity is:', s['body']))
    story.append(code([
        'g_eff(t) = g0 + alpha_eta*eta + alpha_Phi*Phi + alpha_D*DEF + alpha_Oh*max(0, Oh(t) - 1)',
        'z(t)     = DEF(t) + max(0, Oh(t) - 1.0) * 0.5',
        'Psi(t)   = g_eff(t) * z(t)',
        'Gamma_t  = max(0, Psi(t+1) - Psi(t))      # reorganization cost'
    ], s))
    story.append(Paragraph(
        'Default parameters: g<sub>0</sub> = 0.15; &alpha;<sub>&eta;</sub> = 0.10; '
        '&alpha;<sub>&Phi;</sub> = 0.05; &alpha;<sub>D</sub> = 0.30; '
        '&alpha;<sub>Oh</sub> = 0.25. For the financial domain, &alpha;<sub>Oh</sub> = 0.35 '
        '(higher weight for supercritical pressure). In the GFC 2008, &Psi; reached its absolute '
        'maximum in November 2007 (Oh = 1.302, DEF = 0.722, &eta; = 0.247). The descent rate '
        'was below 5% — confirmed gravitational locking. Lehman Brothers was not the cause '
        'of the crisis; it was the event that released the accumulated potential energy.',
        s['body']))

    story.append(Paragraph('4.2 Foundation for Kappa-GEO', s['h2']))
    story.append(Paragraph(
        'The gravitational sub-observable has a direct consequence for Kappa-GEO: when multiple '
        'entities (countries) each have their own K(t) vector and are connected by links in the '
        'radiante.v1 schema, the interaction between external pressure EII(t) and the internal '
        'resistance of the system is formalized as:', s['body']))
    story.append(code(['Gamma_ext(t) = EII(t) * g_eff(t)'], s))
    story.append(Paragraph(
        'The work that external pressure must perform against the internal gravitational field. '
        'When &Gamma;<sub>ext</sub> is high but the system does not reorganize — i.e., internal '
        '&Delta;&Psi; remains positive — we have the critical quadrant of Kappa-GEO: a system '
        '<b>sealed under pressure</b>, the geopolitical analogue of the 2007-2008 financial '
        'gravitational locking.', s['body']))

    # 5. SCHEMA
    story.append(Paragraph('5. The radiante.v1 Schema', s['h1']))
    story.append(Paragraph('5.1 Structure', s['h2']))
    story.append(code([
        '{',
        '  "schema_version": "radiante.v1",',
        '  "domain": "finance",        // finance | political | education | llm | geo',
        '  "entity": { "id": "SP500_GFC2008" },',
        '  "axes": {',
        '    "mode_instrument": ["oh", "phi", "eta"],   // default 3D projection',
        '    "mode_phase":      ["oh", "dphi", "eta"]   // transition dynamics',
        '  },',
        '  "series": [{',
        '    "t": 4,',
        '    "state":   { "oh": 1.302, "phi": 0.241, "eta": 0.247, "xi": 0.667, "def": 0.722 },',
        '    "phase":   { "doh": 0.322, "dphi": 0.241, "deta": -0.081 },',
        '    "regime":  { "label": "katashi", "score": 0.94 },',
        '    "signals": { "nu_s": 386.0, "calm": 0.05 },',
        '    "events":  [{ "type": "alert", "label": "IRREVERSIBILITY REACHED", "severity": 1.0 }],',
        '    "raw_ref": { "source": "kappa_fin_v3", "date": "2007-11-13" }',
        '  }],',
        '  "links": []    // multi-entity infrastructure for Kappa-GEO',
        '}',
    ], s))
    story.append(Paragraph(
        'The <font face="Courier" size="9">signals</font> field is catch-all: accepts any float '
        'without modifying the schema. Kappa-FIN injects '
        '<font face="Courier" size="9">nu_s</font> and '
        '<font face="Courier" size="9">calm</font>; Kappa-GEO will inject '
        '<font face="Courier" size="9">EII_soft</font>, '
        '<font face="Courier" size="9">EII_hard</font>, '
        '<font face="Courier" size="9">EII_kinetic</font>, '
        '<font face="Courier" size="9">gamma_ext</font>. The '
        '<font face="Courier" size="9">links</font> field is the network infrastructure that '
        'connects the structural states of multiple entities — countries, blocs, organizations '
        '— into a single regime graph.', s['body']))

    story.append(Paragraph('5.2 Visualization Modes', s['h2']))
    story += [tbl(
        ['Mode', 'Axes', 'When to Use'],
        [
            ['Instrument (default)', 'Oh x Phi x eta', 'Regime diagnosis; PNR detection; pressure analysis'],
            ['Phase', 'Oh x dPhi x eta', 'Transition speed; accelerations and trajectory reversals'],
            ['Regime', 'eta x Xi x DEF', 'Precise regime classification; rigidity-diversity analysis'],
            ['Memory', 'Phi x Xi x eta', 'Accumulated memory vs. available topological diversity'],
        ],
        [3.0*cm, 3.5*cm, 8.0*cm], s), sp()]

    # 6. EMPIRICAL VALIDATIONS
    story.append(Paragraph('6. Empirical Validations', s['h1']))
    story.append(Paragraph('6.1 Global Financial Crisis 2008 — Kappa-FIN v3 (Primary Case)', s['h2']))
    story.append(Paragraph(
        '<b>Dataset and configuration.</b> S&amp;P 500 with 13 assets, 22-day window, k-NN k=5, '
        'angular distance d<sub>ij</sub> = sqrt(2*(1-C<sub>ij</sub>)). '
        'Period: 2004–2010. CALM calibration: 2004-12-21 to 2006-02-10. '
        'Source: Yahoo Finance via yfinance. Kappa-FIN v3, DOI: 10.5281/zenodo.18917558.',
        s['body']))
    story += [sp(0.5), tbl(
        ['Date', 'Oh', 'Phi', 'eta', 'Radiante Regime', 'Event'],
        [
            ['2006-01-03', '0.338', '0.000001', '0.952', 'Utsuroi', 'Reference period — relaxed system'],
            ['2007-01-03', '0.659', '0.000001', '0.488', 'Utsuroi', 'Silent structural concentration begins'],
            ['2007-06-01', '0.659', '0.000001', '0.488', 'Utsuroi', 'Xi starts falling — topological channels closing'],
            ['2007-11-12', '0.980', '0.000001', '0.328', 'KATASHI onset', 'Onset confirmed — Phi > Phi_c'],
            ['2007-11-13', '1.302', '0.241', '0.247', 'KATASHI', 'Oh supercritical + Phi=0.241 > Phi* — IRREVERSIBILITY. 10 months before Lehman'],
            ['2008-03-14', '0.338', '0.019', '0.952', 'Katashi', 'Bear Stearns — external intervention; system does not reorganize'],
            ['2008-09-15', '0.980', '0.0004', '0.328', 'Katashi', 'LEHMAN BROTHERS bankruptcy. System in Katashi for 386 consecutive days'],
            ['2009-06-01', '0.338', '0.000002', '0.952', 'Utsuroi (recovery)', 'Recovery begins — Katashi to Utsuroi transition'],
            ['2010-01-04', '0.659', '0.000001', '0.488', 'Utsuroi', 'Return to structural normality'],
        ],
        [1.8*cm, 0.9*cm, 0.9*cm, 0.9*cm, 2.2*cm, 7.8*cm], s), sp()]

    story.append(Paragraph(
        'The Radiante reveals what the Kappa-FIN dashboard does not show directly: the fall of '
        'Oh from 1.302 to 0.338 between November 2007 and January 2008 is not recovery — it is '
        'pressure redistribution in Katashi with &eta; = 0.952 (maximum rigidity). The '
        'gravitational potential &Psi; reached its absolute maximum in November 2007; thereafter, '
        'any movement was <b>against the gravitational field</b>, accumulating &Gamma; until '
        'the dissipation of September 2008.', s['body']))

    story.append(Paragraph('6.2 Political Blogosphere — Adamic &amp; Glance (2005)', s['h2']))
    story.append(Paragraph(
        'The script <font face="Courier" size="9">ohio_social_validation.py</font> applies '
        'information viscosity to the polblogs graph (1,491 nodes, 19,025 edges). Local viscosity '
        '&eta;<sub>i</sub> = 1/(1+CC<sub>i</sub>) creates real variation in H1 lifetimes, '
        'avoiding the ceiling R = ln(2). Result: intra-community subgraphs (echo chambers) '
        'persist in Katashi; inter-community subgraphs (bridges) oscillate in Nagare/Utsuroi. '
        't-test: p &lt; 0.05 between H1 lifetimes. Confirmation of the Law of Ohio: systems '
        'that suppress external validation optimize internal coherence at the expense of '
        'reality correspondence — recorded in the Radiante as increasing &eta; with '
        'decreasing &Xi;.', s['body']))

    story.append(Paragraph('6.3 Educational Dropout — OULAD Dataset', s['h2']))
    story.append(Paragraph(
        'Course AAA, semester 2014J, Open University. Students with <i>withdrawn</i> outcome '
        'show: (i) early entry into Katashi in weeks 4–8; (ii) accumulated &Phi; without '
        'resolution; (iii) engagement decline that the Phase mode reveals as cognitive '
        'disinvestment — negative &Delta;&Phi; from desensitization, not recovery. '
        'Pre-PNR criterion satisfied in approximately 70% of dropouts between weeks 7–12. '
        'Intervention window: 3–5 weeks.', s['body']))

    story.append(Paragraph('6.4 LLM Hallucination — Kappa-LLM', s['h2']))
    story.append(Paragraph(
        'Kappa-LLM (Ohio, 2026c) applies the Kappa Method to attention dynamics in large '
        'language models. Hallucinations exhibit an "obsessive attractor" pattern — premature '
        'collapse onto spurious attractors with high &eta;, low &Xi;, and low Oh: a Katashi-like '
        'state in the attention topology. The Radiante demo '
        '<font face="Courier" size="9">llm_demo.json</font> visualizes this trajectory for '
        'Mistral-7B on HaluEval (AUC 94.2%). This represents the fastest-evolving validation '
        'domain: the Katashi onset in attention space typically precedes the hallucinated token '
        'by only a few generation steps.', s['body']))

    # 7. MULTI-ENTITY EXTENSION
    story.append(Paragraph('7. Multi-Entity Extension: Gateway to Kappa-GEO', s['h1']))
    story.append(Paragraph(
        'The <font face="Courier" size="9">links</font> field of the radiante.v1 schema is the '
        'architectural inflection point. In single-entity domains (financial, educational, LLM), '
        '<font face="Courier" size="9">links</font> is empty. In multi-entity networks, each '
        'entity carries its own K(t) vector, and links transport interaction weights:', s['body']))
    story.append(code([
        '"links": [{',
        '  "type": "influence",',
        '  "from": { "domain": "geo", "entity_id": "IRN" },',
        '  "to":   { "domain": "geo", "entity_id": "ISR" },',
        '  "rule": "EII hard + kinetic from GDELT",',
        '  "weight": 0.84',
        '}]',
    ], s))
    story.append(Paragraph(
        'This structure represents a <b>network of structural states</b> — not merely '
        'individual trajectories. Kappa-GEO, currently in development, will compute K(t) '
        'for each geopolitical actor from GDELT data (bilateral events weighted by the '
        'Goldstein scale), with links carrying the <b>External Influence Index (EII)</b> — '
        'soft (cooperation), hard (coercion), and kinetic (conflict) components. '
        'The interaction with the internal gravitational field via '
        'Gamma_ext = EII * g_eff provides the formal foundation for '
        'diagnosing systems trapped in Katashi under external pressure.', s['body']))
    story.append(Paragraph(
        'Kappa-GEO does not need to redefine the state space: it inherits K(t) directly. '
        'It does not need a new schema: it uses radiante.v1 with '
        '<font face="Courier" size="9">signals</font> for EII and '
        '<font face="Courier" size="9">links</font> for the network. '
        'It does not need to justify the gravitational sub-observable: &Psi; is already '
        'formally established here. This is why the publication sequence '
        'Kappa-FIN &rarr; Radiante &rarr; Kappa-GEO is <b>architectural</b>, '
        'not merely chronological.', s['body']))

    # 8. CONCLUSION
    story.append(Paragraph('8. Conclusion', s['h1']))
    story.append(Paragraph(
        'The Structural Radiante is the navigation instrument of the Kappa Method. Its '
        'technical contributions — regime geometry, gravitational sub-observable &Psi;, '
        'radiante.v1 schema — were developed from the real case of the 2008 Global Financial '
        'Crisis, where Kappa-FIN detected the critical regime onset in November 2007 with '
        'irreversibility confirmed on 2007-11-13. The Radiante renders this result '
        '<i>navigable</i>: it transforms a five-number vector into a trajectory with direction, '
        'speed, and reorganization cost.', s['body']))
    story.append(Paragraph(
        'The schema architecture — particularly the '
        '<font face="Courier" size="9">links</font> field for multi-entity networks — is the '
        'necessary infrastructure for Kappa-GEO. The Radiante is not merely a visualization '
        'of Kappa-FIN outputs; it is the <b>interface contract</b> between the Kappa Method '
        'and all its future application domains.', s['body']))
    story.append(Paragraph(
        'Code and data: <font face="Courier" size="9">github.com/aprimora-ai/kappa-radiante</font> '
        '(DOI: 10.5281/zenodo.18932379). Schema radiante.v1 in '
        '<font face="Courier" size="9">lib/radiante-schema.ts</font>. GFC 2008 demo in '
        '<font face="Courier" size="9">sample_runs/finance_2008_gfc_demo.json</font>.',
        s['body']))

    # REFERENCES
    story.append(Paragraph('References', s['h1']))
    story.append(hrl())
    refs = [
        'Adamic, L. A., &amp; Glance, N. (2005). The political blogosphere and the 2004 US election: Divided they blog. <i>Proceedings of the 3rd International Workshop on Link Discovery</i>, pp. 36–43. ACM.',
        'Ohio, D. (2026a). Kappa: A Method for Informational Regime Detection via Geometry and Dynamics. Zenodo. DOI: 10.5281/zenodo.18883639.',
        'Ohio, D. (2026b). Kappa-FIN: Topological Early Warning System for Financial Market Crises (v3). Zenodo. DOI: 10.5281/zenodo.18917558.',
        'Ohio, D. (2026c). Kappa-LLM: Multi-Observable Topological Detection of Hallucinations in Large Language Models. Zenodo. DOI: 10.5281/zenodo.18883790.',
        'Ohio, D. (2026d). Kappa-Radiante: Visualization and Formal Analysis Layer of the Kappa Method (v1.0.0). Zenodo. DOI: 10.5281/zenodo.18932379.',
        'Romero, C., &amp; Ventura, S. (2010). Educational data mining: A review of the state of the art. <i>IEEE Transactions on Systems, Man, and Cybernetics, Part C</i>, 40(6), 601–618.',
        'Zomorodian, A., &amp; Carlsson, G. (2005). Computing persistent homology. <i>Discrete &amp; Computational Geometry</i>, 33(2), 249–274.',
    ]
    for r in refs:
        story.append(Paragraph(r, s['ref']))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f'OK -> {out}')

build()
