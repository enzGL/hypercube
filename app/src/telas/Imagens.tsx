// Canvas de imagens: quadro infinito (arrastar, aproximar) com tudo o que os agentes geram
// na pasta `.hypercube/saidas/`. HTML abre isolado (sandbox, sem rede).
import { useEffect, useRef, useState } from 'react';
import { avisar, mandar, useLoja } from '../estado/loja';
import { nativo, type SaidaGerada } from '../nativo';
import { BarraTopo } from '../componentes/BarraTopo';
import { Icone } from '../componentes/Pecas';

interface Comentario {
  id: string;
  x: number; // 0..1
  y: number;
  texto: string;
  enviado: boolean;
}

interface Item {
  saida: SaidaGerada;
  x: number;
  y: number;
  w: number;
  h: number;
  comentarios: Comentario[];
}

type Modo = 'mover' | 'comentar';

const LARG = 420;

function posicaoInicial(s: SaidaGerada, existentes: Item[]): Pick<Item, 'x' | 'y' | 'w' | 'h'> {
  const versao = /-v(\d+)\./.exec(s.nome);
  if (versao) {
    const n = Number(versao[1]) - 1;
    return { x: 40 + n * (LARG + 40), y: 70, w: LARG, h: Math.round((LARG * 340) / 480) };
  }
  const soltos = existentes.filter((i) => !/-v\d+\./.test(i.saida.nome)).length;
  return { x: 40 + soltos * 360, y: 470, w: s.tipo === 'html' ? 320 : 300, h: s.tipo === 'html' ? 240 : 300 };
}

// Mantém o quadro ao trocar de tela.
const memoria: { itens: Item[]; vista: { x: number; y: number; z: number } } = { itens: [], vista: { x: 20, y: 10, z: 0.72 } };

export function Imagens() {
  const e = useLoja();
  const sessao = e.sessoes.find((s) => s.id === e.sessaoAtivaId);
  const [itens, setItens] = useState<Item[]>(memoria.itens);
  const [vista, setVista] = useState(memoria.vista);
  const [modo, setModo] = useState<Modo>('mover');
  const [selecao, setSelecao] = useState<string[]>([]);
  const [rascunho, setRascunho] = useState<{ itemId: string; x: number; y: number; texto: string } | null>(null);
  const [comparando, setComparando] = useState<[Item, Item] | null>(null);
  const [porta, setPorta] = useState(0);
  const [agora, setAgora] = useState(Date.now());
  const area = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ tipo: 'vista' | 'item'; id?: string; x0: number; y0: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    memoria.itens = itens;
    memoria.vista = vista;
  }, [itens, vista]);

  useEffect(() => {
    nativo.sistema.portaCanvas().then(setPorta);
    const t = window.setInterval(() => setAgora(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!sessao) return;
    return nativo.arquivos.observarSaidas(sessao.pasta, (s) => {
      setItens((atual) => {
        if (atual.some((i) => i.saida.id === s.id)) return atual;
        if (Date.now() - s.criadoEm < 4000) avisar(`Nova saída no canvas: ${s.nome}`, 'pronto');
        return [...atual, { saida: s, ...posicaoInicial(s, atual), comentarios: [] }];
      });
    });
  }, [sessao?.pasta]);

  const paraMundo = (cx: number, cy: number) => {
    const r = area.current!.getBoundingClientRect();
    return { x: (cx - r.left - vista.x) / vista.z, y: (cy - r.top - vista.y) / vista.z };
  };

  const aoRolar = (ev: React.WheelEvent) => {
    const r = area.current!.getBoundingClientRect();
    const px = ev.clientX - r.left;
    const py = ev.clientY - r.top;
    const z = Math.max(0.2, Math.min(3, vista.z * (ev.deltaY < 0 ? 1.1 : 1 / 1.1)));
    setVista({ z, x: px - ((px - vista.x) * z) / vista.z, y: py - ((py - vista.y) * z) / vista.z });
  };

  const aoMover = (ev: React.PointerEvent) => {
    const a = arrasto.current;
    if (!a) return;
    const dx = ev.clientX - a.x0;
    const dy = ev.clientY - a.y0;
    if (a.tipo === 'vista') setVista((v) => ({ ...v, x: a.ox + dx, y: a.oy + dy }));
    else setItens((is) => is.map((i) => (i.saida.id === a.id ? { ...i, x: a.ox + dx / vista.z, y: a.oy + dy / vista.z } : i)));
  };

  const vertice = e.vertices.find((v) => v.sessaoId === sessao?.id && v.papel === 'construtor' && v.terminalId) ?? e.vertices.find((v) => v.sessaoId === sessao?.id && v.terminalId);

  const enviarComentario = (itemId: string, c: Comentario) => {
    const item = itens.find((i) => i.saida.id === itemId)!;
    if (!vertice) {
      avisar('Nenhum agente nesta sessão para receber o comentário.', 'erro');
      return;
    }
    mandar(vertice.id, `Comentário em ${item.saida.nome} (ponto ${Math.round(c.x * 100)}%, ${Math.round(c.y * 100)}%): ${c.texto}`);
    setItens((is) => is.map((i) => (i.saida.id === itemId ? { ...i, comentarios: i.comentarios.map((k) => (k.id === c.id ? { ...k, enviado: true } : k)) } : i)));
    avisar(`Comentário enviado ao ${vertice.nome}.`, 'pronto');
  };

  const versoes = itens.filter((i) => /-v\d+\./.test(i.saida.nome));
  const quadro =
    versoes.length > 0
      ? {
          x: Math.min(...versoes.map((i) => i.x)) - 20,
          y: Math.min(...versoes.map((i) => i.y)) - 44,
          w: Math.max(...versoes.map((i) => i.x + i.w)) - Math.min(...versoes.map((i) => i.x)) + 40,
          h: Math.max(...versoes.map((i) => i.y + i.h)) - Math.min(...versoes.map((i) => i.y)) + 64,
        }
      : null;

  const selecionados = itens.filter((i) => selecao.includes(i.saida.id));
  const podeComparar = selecionados.length === 2 && selecionados.every((i) => i.saida.tipo !== 'html');
  const url = `http://127.0.0.1:${porta}/canvas`;

  const acoes = (
    <>
      <div className="segmentos" role="radiogroup" aria-label="Ferramenta">
        <button role="radio" aria-checked={modo === 'mover'} className={modo === 'mover' ? 'ativo' : ''} onClick={() => setModo('mover')}>
          Mover
        </button>
        <button role="radio" aria-checked={modo === 'comentar'} className={modo === 'comentar' ? 'ativo' : ''} onClick={() => setModo('comentar')}>
          <Icone nome="comentario" tamanho={14} /> Comentar
        </button>
      </div>
      <button className="botao" disabled={!podeComparar} onClick={() => podeComparar && setComparando([selecionados[0], selecionados[1]])} title="Selecione duas imagens com Shift + clique">
        <Icone nome="comparar" /> Comparar
      </button>
      <button
        className="botao"
        onClick={() => {
          nativo.sistema.abrirLink(url);
          if (nativo.modo === 'simulado') avisar(`No app instalado o canvas também abre em ${url}`);
        }}
      >
        <Icone nome="navegador" /> Abrir no navegador
      </button>
    </>
  );

  return (
    <div className="tela-imagens">
      <BarraTopo titulo="Imagens" subtitulo={sessao ? `${sessao.pasta}\\.hypercube\\saidas  ·  ${url}` : 'Nenhuma sessão'} acoes={acoes} />
      <div
        ref={area}
        className={`quadro modo-${modo}`}
        onWheel={aoRolar}
        onPointerDown={(ev) => {
          if ((ev.target as HTMLElement).closest('.item, .rascunho, .pino')) return;
          arrasto.current = { tipo: 'vista', x0: ev.clientX, y0: ev.clientY, ox: vista.x, oy: vista.y };
          (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
          setSelecao([]);
        }}
        onPointerMove={aoMover}
        onPointerUp={() => (arrasto.current = null)}
        style={{ backgroundPosition: `${vista.x}px ${vista.y}px`, backgroundSize: `${24 * vista.z}px ${24 * vista.z}px` }}
      >
        <div className="mundo" style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.z})` }}>
          {quadro && (
            <div className="artboard" style={{ left: quadro.x, top: quadro.y, width: quadro.w, height: quadro.h }}>
              <span className="artboard-nome">Checkout · {versoes.length} versões lado a lado</span>
              <button
                className="artboard-acao"
                onClick={() => {
                  if (vertice) {
                    mandar(vertice.id, `Faça a sugestão combinada das versões ${versoes.map((v) => v.saida.nome).join(', ')}`);
                    avisar(`Pedido de sugestão combinada enviado ao ${vertice.nome}.`, 'trabalhando');
                  }
                }}
              >
                Pedir sugestão combinada
              </button>
            </div>
          )}

          {itens.map((i) => {
            const nova = agora - i.saida.criadoEm < 20000;
            const sel = selecao.includes(i.saida.id);
            return (
              <figure
                key={i.saida.id}
                className={`item ${sel ? 'selecionado' : ''}`}
                style={{ left: i.x, top: i.y, width: i.w }}
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  setSelecao((s) => (ev.shiftKey ? (s.includes(i.saida.id) ? s.filter((x) => x !== i.saida.id) : [...s, i.saida.id].slice(-2)) : [i.saida.id]));
                  if (modo === 'mover') {
                    arrasto.current = { tipo: 'item', id: i.saida.id, x0: ev.clientX, y0: ev.clientY, ox: i.x, oy: i.y };
                    area.current?.setPointerCapture(ev.pointerId);
                  }
                }}
              >
                <figcaption>
                  <span className="mono">{i.saida.nome}</span>
                  {nova && <span className="selo selo-novo">nova</span>}
                  {i.comentarios.length > 0 && <span className="selo">{i.comentarios.length} coment.</span>}
                </figcaption>
                <div
                  className="item-corpo"
                  style={{ height: i.h }}
                  onClick={(ev) => {
                    if (modo !== 'comentar') return;
                    const m = paraMundo(ev.clientX, ev.clientY);
                    setRascunho({ itemId: i.saida.id, x: (m.x - i.x) / i.w, y: (m.y - i.y - 30) / i.h, texto: '' });
                  }}
                >
                  {i.saida.tipo === 'html' ? (
                    <iframe title={i.saida.nome} sandbox="" srcDoc={i.saida.conteudo} />
                  ) : (
                    <img src={i.saida.conteudo} alt={i.saida.nome} draggable={false} />
                  )}
                  <div className="item-capa" />
                  {i.comentarios.map((c, k) => (
                    <span key={c.id} className={`pino ${c.enviado ? 'enviado' : ''}`} style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }} title={c.texto}>
                      {k + 1}
                    </span>
                  ))}
                  {rascunho?.itemId === i.saida.id && (
                    <div className="rascunho" style={{ left: `${rascunho.x * 100}%`, top: `${rascunho.y * 100}%` }} onClick={(ev) => ev.stopPropagation()} onPointerDown={(ev) => ev.stopPropagation()}>
                      <textarea
                        autoFocus
                        rows={2}
                        placeholder="O que mudar aqui?"
                        value={rascunho.texto}
                        onChange={(ev) => setRascunho({ ...rascunho, texto: ev.target.value })}
                      />
                      <div>
                        <button
                          className="botao primario pequeno"
                          disabled={!rascunho.texto.trim()}
                          onClick={() => {
                            const c: Comentario = { id: `c${Date.now()}`, x: rascunho.x, y: rascunho.y, texto: rascunho.texto.trim(), enviado: false };
                            setItens((is) => is.map((x) => (x.saida.id === i.saida.id ? { ...x, comentarios: [...x.comentarios, c] } : x)));
                            setRascunho(null);
                            enviarComentario(i.saida.id, c);
                          }}
                        >
                          Mandar ao agente
                        </button>
                        <button className="botao pequeno" onClick={() => setRascunho(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </figure>
            );
          })}
        </div>

        {itens.length === 0 && (
          <div className="quadro-vazio">
            <p>Nada por aqui ainda. Tudo o que os agentes salvarem em <span className="mono">.hypercube/saidas/</span> aparece neste quadro.</p>
          </div>
        )}

        <div className="zoom">
          <button onClick={() => setVista((v) => ({ ...v, z: Math.max(0.2, v.z / 1.2) }))} aria-label="Afastar">
            <Icone nome="menos" tamanho={14} />
          </button>
          <span className="mono">{Math.round(vista.z * 100)}%</span>
          <button onClick={() => setVista((v) => ({ ...v, z: Math.min(3, v.z * 1.2) }))} aria-label="Aproximar">
            <Icone nome="mais" tamanho={14} />
          </button>
          <button onClick={() => setVista({ x: 20, y: 10, z: 0.72 })} aria-label="Centralizar">
            <Icone nome="alvo" tamanho={14} />
          </button>
        </div>
        <div className="quadro-dica">
          {modo === 'comentar' ? 'Clique num ponto da imagem para comentar.' : 'Arraste o fundo para andar · roda do mouse aproxima · Shift + clique seleciona duas para comparar'}
        </div>
      </div>

      {comparando && <Comparacao a={comparando[0]} b={comparando[1]} fechar={() => setComparando(null)} />}
    </div>
  );
}

function Comparacao({ a, b, fechar }: { a: Item; b: Item; fechar: () => void }) {
  const [corte, setCorte] = useState(50);
  return (
    <div className="fundo-dialogo" onClick={fechar}>
      <div className="dialogo largo" onClick={(ev) => ev.stopPropagation()} role="dialog" aria-label="Comparar versões">
        <header className="dialogo-cabeca">
          <h2>Comparar versões</h2>
          <button className="icone-botao" onClick={fechar} aria-label="Fechar">
            <Icone nome="fechar" />
          </button>
        </header>
        <div className="comparar">
          <img src={a.saida.conteudo} alt={a.saida.nome} />
          <img src={b.saida.conteudo} alt={b.saida.nome} style={{ clipPath: `inset(0 0 0 ${corte}%)` }} />
          <span className="comparar-linha" style={{ left: `${corte}%` }} />
        </div>
        <input type="range" min={0} max={100} value={corte} onChange={(ev) => setCorte(Number(ev.target.value))} aria-label="Divisão" className="largo" />
        <div className="comparar-nomes mono">
          <span>{a.saida.nome}</span>
          <span>{b.saida.nome}</span>
        </div>
      </div>
    </div>
  );
}
