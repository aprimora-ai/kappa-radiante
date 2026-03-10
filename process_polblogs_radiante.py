import networkx as nx
import numpy as np
import json
import os
import re
import gudhi

def parse_gml_manual(path):
    G = nx.DiGraph()
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    node_blocks = re.findall(r'node\s*\[(.*?)\]', content, re.DOTALL)
    for block in node_blocks:
        id_match = re.search(r'id\s+(\d+)', block)
        val_match = re.search(r'value\s+(\d+)', block)
        if id_match:
            node_id = int(id_match.group(1))
            val = int(val_match.group(1)) if val_match else 0
            G.add_node(node_id, value=val)
    edge_blocks = re.findall(r'edge\s*\[(.*?)\]', content, re.DOTALL)
    for block in edge_blocks:
        src_match = re.search(r'source\s+(\d+)', block)
        tgt_match = re.search(r'target\s+(\d+)', block)
        if src_match and tgt_match:
            u, v = int(src_match.group(1)), int(tgt_match.group(1))
            if u != v: G.add_edge(u, v)
    return G

def compute_rigidity_eta(G, drop_rate=0.05):
    """
    Implementa Definição 2.1 (η): Resistência à perturbação.
    Mede a estabilidade do tamanho do componente gigante sob dropout de arestas.
    """
    if G.number_of_edges() == 0: return 0.2
    
    def get_giant_size(graph):
        if len(graph) == 0: return 0
        comps = nx.weakly_connected_components(graph)
        return len(max(comps, key=len))

    base_size = get_giant_size(G)
    if base_size == 0: return 0.2
    
    # Simular perturbação (Definição 2.1: P_epsilon)
    perturbed_G = G.copy()
    edges = list(G.edges())
    n_drop = int(len(edges) * drop_rate)
    indices = np.random.choice(len(edges), n_drop, replace=False)
    for i in indices:
        perturbed_G.remove_edge(*edges[i])
    
    perturbed_size = get_giant_size(perturbed_G)
    
    # Rigidez = 1 - (delta_tamanho / base)
    # Se mudar pouco (delta pequeno), η é alto (rígido).
    stability = perturbed_size / base_size
    return stability

def compute_homology_oh(G):
    """
    Implementa Seção 2.1 (Oh): Homologia via Betti 0 e Betti 1.
    """
    n_nodes = G.number_of_nodes()
    if n_nodes == 0: return 0.1
    
    # Criar SimplexTree do GUDHI
    st = gudhi.SimplexTree()
    for node in G.nodes():
        st.insert([node], filtration=0.0)
    for u, v in G.edges():
        st.insert([u, v], filtration=0.0)
    
    st.compute_persistence()
    betti = st.betti_numbers()
    
    b0 = betti[0] if len(betti) > 0 else 0
    b1 = betti[1] if len(betti) > 1 else 0
    
    # Oh = (b0 + b1) normalizado
    # Em grafos, b1 = |E| - |V| + b0
    # Usamos uma normalização logística para manter em [0, 1.8]
    raw_oh = (b0 + b1) / n_nodes
    oh = 1.8 * (1 / (1 + np.exp(-5 * (raw_oh - 0.1)))) # Escalonamento Kappa
    return oh

def compute_diversity_xi(G):
    """
    Implementa Seção 2.1 (Ξ): Entropia de caminhos.
    Aproximada pela entropia da distribuição de graus.
    """
    degrees = [d for n, d in G.degree()]
    if not degrees: return 0.1
    counts = np.bincount(degrees)
    probs = counts[counts > 0] / len(degrees)
    entropy = -np.sum(probs * np.log2(probs))
    max_ent = np.log2(len(G)) if len(G) > 1 else 1
    return min(1.0, entropy / max_ent)

def main():
    print("Iniciando processamento Kappa de Alta Fidelidade...")
    path = os.path.join("political", "polblogs.gml")
    G_full = parse_gml_manual(path)
    
    # Separar arestas para simulação de polarização
    all_edges = list(G_full.edges())
    intra = [e for e in all_edges if G_full.nodes[e[0]]['value'] == G_full.nodes[e[1]]['value']]
    inter = [e for e in all_edges if G_full.nodes[e[0]]['value'] != G_full.nodes[e[1]]['value']]
    
    np.random.shuffle(intra)
    np.random.shuffle(inter)
    
    steps = 100
    series = []
    G_curr = nx.DiGraph()
    G_curr.add_nodes_from(G_full.nodes(data=True))
    
    # Acumuladores para DEF e Phi
    acc_def = 0.0
    phi_val = 0.0
    gamma_phi = 0.85 # Fator de vazamento conforme paper
    
    for t in range(steps):
        # Simulação: Crescimento de Echo Chambers (0-70) -> Invasão de Conflito (70-100)
        n_edges = len(all_edges) // steps
        if t < 70:
            # 90% intra-bolha (polarizando)
            n_intra = int(n_edges * 0.9)
            batch = [intra.pop() for _ in range(min(len(intra), n_intra))]
            batch += [inter.pop() for _ in range(min(len(inter), n_edges - len(batch)))]
        else:
            # Colapso de fronteiras (conflito)
            batch = [inter.pop() for _ in range(min(len(inter), n_edges))]
            
        G_curr.add_edges_from(batch)
        
        # 1. Medir Observáveis Reais
        oh = compute_homology_oh(G_curr)
        eta = compute_rigidity_eta(G_curr)
        xi = compute_diversity_xi(G_curr)
        
        # 2. Phi (Memória com Vazamento) - Def 2.1
        phi_val = gamma_phi * phi_val + max(0, oh - 0.85)
        phi_final = min(1.0, phi_val)
        
        # 3. DEF (Déficit Estrutural) - Eq 4.3
        if t > 0:
            prev = series[-1]['state']
            d_eta = max(0, eta - prev['eta'])
            d_xi = max(0, prev['xi'] - xi)
            # DEF cresce se a rigidez sobe e a diversidade cai
            acc_def += max(0, d_eta + d_xi) * 0.5
            
        point_state = {
            "oh": round(oh, 4),
            "phi": round(phi_final, 4),
            "eta": round(eta, 4),
            "xi": round(xi, 4),
            "def": round(min(1.0, acc_def), 4)
        }
        
        # Classificação de Regime baseada nos Thresholds da Seção 4.2
        regime = "utsuroi"
        if xi > 0.6 and eta < 0.4 and acc_def < 0.3: 
            regime = "nagare"
        elif eta > 0.6 or phi_final > 0.6 or xi < 0.3:
            regime = "katashi"
        series.append({
            "t": t,
            "state": point_state,
            "regime": {"label": regime, "score": 0.85}
        })
        
        if t % 10 == 0:
            print(f"[t={t}] Oh: {oh:.2f} | η: {eta:.2f} | Ξ: {xi:.2f} | DEF: {acc_def:.2f} | Regime: {regime}")

    output = {
        "domain": "political_blogosphere",
        "run_id": "polblogs_kappa_v3_scientific",
        "entity": {"id": "polblogs", "label": "Political Blogosphere (Fidelidade TDA)"},
        "series": series
    }
    
    with open("sample_runs/political_demo.json", "w") as f:
        json.dump(output, f, indent=2)
    print("\n[OK] Dataset atualizado para V3 Scientific em sample_runs/political_demo.json")

if __name__ == "__main__":
    main()
