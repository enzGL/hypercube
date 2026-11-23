// Galeria de modelos de bots: busca, categorias, lista agrupada e o detalhe do modelo escolhido.
import { useEffect, useMemo, useState } from 'react';
import { abrirDialogo, avisar, criarVertice, useLoja } from '../estado/loja';
import { CATEGORIAS_BOT, filtrarModelos, type CategoriaBot, type ItemVemCom, type ModeloBot } from '../estado/bots';
import { MascoteAgente } from './EditarAgente';
import { IconeCasca } from './IconesCasca';
import { Icone } from './Pecas';

const ICONE_VEM_COM: Record<ItemVemCom['tipo'], string> = { skill: 'arquivo', gatilho: 'corrida', integracao: 'navegador' };

export function ModelosBots() {
  const e = useLoja();
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<CategoriaBot | 'todos'>('todos');
  const lista = useMemo(() => filtrarModelos(busca, categoria), [busca, categoria]);
  const [escolhidoId, setEscolhidoId] = useState<string | null>(null);
  const escolhido = lista.find((m) => m.id === escolhidoId) ?? lista[0] ?? null;

  useEffect(() => {
    const k = (ev: KeyboardEvent) => ev.key === 'Escape' && abrirDialogo(null);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const usar = async (m: ModeloBot) => {
    const sessaoId = e.sessaoAtivaId;
    if (!sessaoId) {
      avisar('Abra um projeto primeiro: o bot nasce dentro dele.', 'erro');
      abrirDialogo({ tipo: 'novaSessao' });
      return;
    }
    abrirDialogo(null);
    await criarVertice(sessaoId, 'agente', 'claude', 'padrao', m.instrucao, { nome: m.nome, apelido: m.nome, cor: m.cor });
  };

  const grupos = CATEGORIAS_BOT.map((c) => ({ ...c, itens: lista.filter((m) => m.categoria === c.id) })).filter((g) => g.itens.length > 0);

  return (
    <div className="fundo-dialogo" onMouseDown={() => abrirDialogo(null)}>
      <div className="dialogo modelos-bots" role="dialog" aria-label="Modelos de bots" onMouseDown={(ev) => ev.stopPropagation()}>
        <header className="mb-topo">
          <h2>Modelos de bots</h2>
          <span className="mb-topo-acoes">
            <button className="botao pequeno" disabled title="Em breve">
              A partir de um link
            </button>
            <button
              className="botao pequeno"
              onClick={() => (e.sessaoAtivaId ? abrirDialogo({ tipo: 'novoVertice', sessaoId: e.sessaoAtivaId }) : abrirDialogo({ tipo: 'novaSessao' }))}
            >
              <IconeCasca nome="mais" tamanho={14} /> Bot em branco
            </button>
            <button className="icone-botao" onClick={() => abrirDialogo(null)} aria-label="Fechar">
              <IconeCasca nome="fechar" tamanho={16} />
            </button>
          </span>
        </header>

        <div className="mb-corpo">
          <div className="mb-esquerda">
            <label className="mb-busca">
              <IconeCasca nome="busca" tamanho={15} />
              <input autoFocus value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar modelos" aria-label="Buscar modelos" />
            </label>
            <div className="mb-abas" role="tablist" aria-label="Categorias">
              <button role="tab" aria-selected={categoria === 'todos'} className={categoria === 'todos' ? 'ativo' : ''} onClick={() => setCategoria('todos')}>
                Todos
              </button>
              {CATEGORIAS_BOT.map((c) => (
                <button key={c.id} role="tab" aria-selected={categoria === c.id} className={categoria === c.id ? 'ativo' : ''} onClick={() => setCategoria(c.id)}>
                  {c.nome}
                </button>
              ))}
            </div>
            <div className="mb-lista">
              {grupos.length === 0 && <p className="mb-vazio">Nenhum modelo com esse nome.</p>}
              {grupos.map((g) => (
                <section key={g.id}>
                  <h3 className="mb-grupo">{g.nome}</h3>
                  {g.itens.map((m) => (
                    <div
                      key={m.id}
                      role="button"
                      tabIndex={0}
                      className={`mb-item ${escolhido?.id === m.id ? 'ativo' : ''}`}
                      onClick={() => setEscolhidoId(m.id)}
                      onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), setEscolhidoId(m.id))}
                    >
                      <MascoteAgente cor={m.cor} papel={m.acessorio} tamanho={34} />
                      <span className="mb-item-texto">
                        <b>
                          {m.nome}
                          {m.precisaConfigurar && <span className="mb-etiqueta">Precisa configurar</span>}
                        </b>
                        <span>{m.resumo}</span>
                      </span>
                      <button
                        className="botao pequeno mb-usar"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          void usar(m);
                        }}
                      >
                        Usar
                      </button>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </div>

          {escolhido && (
            <aside className="mb-direita" aria-label={`Detalhe de ${escolhido.nome}`}>
              <MascoteAgente cor={escolhido.cor} papel={escolhido.acessorio} tamanho={72} />
              <h3 className="mb-nome">{escolhido.nome}</h3>
              <div className="mb-categoria">{CATEGORIAS_BOT.find((c) => c.id === escolhido.categoria)?.nome} · modelo do Hypercube</div>
              <p className="mb-desc">{escolhido.descricao}</p>
              <button className="botao primario largo" onClick={() => void usar(escolhido)}>
                Usar modelo…
              </button>

              <div className="mb-previa">
                <div className="mb-previa-cabeca">
                  <MascoteAgente cor={escolhido.cor} papel={escolhido.acessorio} tamanho={18} />
                  <b>{escolhido.nome}</b> <span>na conversa dele</span>
                </div>
                {escolhido.previa.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>

              <h4>O que faz primeiro</h4>
              <p className="mb-desc">{escolhido.primeiro}</p>

              {escolhido.vemCom.length > 0 && (
                <>
                  <h4>Vem com</h4>
                  <ul className="mb-vemcom">
                    {escolhido.vemCom.map((v) => (
                      <li key={v.nome}>
                        <Icone nome={ICONE_VEM_COM[v.tipo]} tamanho={16} />
                        <span>
                          <b>{v.nome}</b>
                          {v.desc && <span>{v.desc}</span>}
                        </span>
                        {v.estado && <em>{v.estado}</em>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
