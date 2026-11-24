// Painel direito: Notas do projeto, Tarefas com Pomodoro, Plugins e Git.
import { useEffect, useRef, useState } from 'react';
import { useLoja } from '../estado/loja';
import {
  abrirAba,
  adicionarTarefa,
  alternarPainel,
  alternarTarefa,
  apagarTarefa,
  definirFiltro,
  definirNota,
  focarTarefa,
  formatarTempo,
  iniciarPomodoro,
  limparConcluidas,
  nomeDaPasta,
  pausarPomodoro,
  POMODORO_MS,
  projetoAtivo,
  restantePomodoro,
  useCasca,
  zerarPomodoro,
  type AbaPainel,
  type FiltroTarefas,
} from '../estado/casca';
import { IconeCasca } from './IconesCasca';
import { ListaDoLider } from './ListaDoLider';

const ABAS: { id: AbaPainel; nome: string; icone: string }[] = [
  { id: 'notas', nome: 'Notas', icone: 'notas' },
  { id: 'tarefas', nome: 'Minhas tarefas', icone: 'tarefas' },
];

export function PainelDireito() {
  const casca = useCasca();
  const aba = ABAS.find((a) => a.id === casca.aba) ?? ABAS[1];
  return (
    <aside className="painel-direito" aria-label="Painel direito">
      <div className="pd-abas" role="tablist">
        {ABAS.map((a) => (
          <button key={a.id} role="tab" aria-selected={casca.aba === a.id} className={`pd-aba ${casca.aba === a.id ? 'ativa' : ''}`} onClick={() => abrirAba(a.id)} title={a.nome} aria-label={a.nome}>
            <IconeCasca nome={a.icone} />
          </button>
        ))}
        <button className="pd-aba pd-recolher" onClick={alternarPainel} title="Esconder o painel" aria-label="Esconder o painel">
          <IconeCasca nome="painelDireito" />
        </button>
      </div>
      <div className="pd-titulo">
        <IconeCasca nome={aba.icone} tamanho={15} />
        <span>{aba.nome}</span>
      </div>
      <div className="pd-corpo" role="tabpanel">
        {casca.aba === 'notas' && <Notas />}
        {casca.aba === 'tarefas' && (
          <>
            <ListaDoLider />
            <Tarefas />
          </>
        )}
        {casca.aba === 'plugins' && <Vazio icone="plugins" titulo="Nenhum plugin ainda" texto="Plugins vão somar ferramentas aos agentes. Eles chegam numa próxima versão." />}
        {casca.aba === 'git' && <Vazio icone="git" titulo="Nada para mostrar" texto="As mudanças do projeto aberto vão aparecer aqui quando o app nativo estiver ligado." />}
      </div>
    </aside>
  );
}

function Vazio({ icone, titulo, texto }: { icone: string; titulo: string; texto: string }) {
  return (
    <div className="pd-vazio">
      <span className="pd-vazio-icone">
        <IconeCasca nome={icone} tamanho={20} />
      </span>
      <b>{titulo}</b>
      <p>{texto}</p>
    </div>
  );
}

// ---------- notas ----------

function Notas() {
  const e = useLoja();
  const casca = useCasca();
  const pasta = projetoAtivo(e);
  if (!pasta) return <Vazio icone="notas" titulo="Nenhum projeto aberto" texto="Abra um projeto para escrever as notas dele." />;
  return (
    <div className="pd-notas">
      <span className="pd-rotulo">{nomeDaPasta(pasta)}</span>
      <textarea
        value={casca.notas[pasta] ?? ''}
        onChange={(ev) => definirNota(pasta, ev.target.value)}
        placeholder="Anote o que não pode esquecer neste projeto: decisões, comandos, links…"
        aria-label={`Notas do projeto ${nomeDaPasta(pasta)}`}
        spellCheck
      />
      <span className="pd-dica">Fica salvo neste computador.</span>
    </div>
  );
}

// ---------- tarefas ----------

const FILTROS: { id: FiltroTarefas; nome: string }[] = [
  { id: 'tudo', nome: 'Tudo' },
  { id: 'ativas', nome: 'Ativas' },
  { id: 'concluidas', nome: 'Concluídas' },
];

function Tarefas() {
  const casca = useCasca();
  const [texto, setTexto] = useState('');
  const campo = useRef<HTMLInputElement>(null);
  const feitas = casca.tarefas.filter((t) => t.feita).length;
  const total = casca.tarefas.length;
  const lista = casca.tarefas.filter((t) => (casca.filtro === 'ativas' ? !t.feita : casca.filtro === 'concluidas' ? t.feita : true));

  useEffect(() => {
    if (casca.pedidoNovaTarefa) campo.current?.focus();
  }, [casca.pedidoNovaTarefa]);

  const enviar = () => {
    adicionarTarefa(texto);
    setTexto('');
  };

  return (
    <div className="pd-tarefas">
      <div className="pd-progresso" aria-label={`${feitas} de ${total} tarefas concluídas`}>
        <span className="pd-trilho">
          <span className="pd-cheio" style={{ width: total ? `${(feitas / total) * 100}%` : 0 }} />
        </span>
        <span className="mono">
          {feitas} / {total}
        </span>
      </div>

      <div className="pd-filtros" role="radiogroup" aria-label="Filtrar tarefas">
        {FILTROS.map((f) => (
          <button key={f.id} role="radio" aria-checked={casca.filtro === f.id} className={casca.filtro === f.id ? 'ativo' : ''} onClick={() => definirFiltro(f.id)}>
            {f.nome}
          </button>
        ))}
        {feitas > 0 && (
          <button className="pd-limpar" onClick={limparConcluidas} title="Apagar as concluídas">
            Limpar
          </button>
        )}
      </div>

      <form
        className="pd-adicionar"
        onSubmit={(ev) => {
          ev.preventDefault();
          enviar();
        }}
      >
        <IconeCasca nome="mais" tamanho={14} />
        <input ref={campo} value={texto} onChange={(ev) => setTexto(ev.target.value)} placeholder="Adicionar uma tarefa…" aria-label="Adicionar uma tarefa" />
        <kbd>Ctrl+N</kbd>
      </form>

      {total === 0 ? (
        <Vazio icone="tarefas" titulo="Nada na sua lista" texto="Adicione uma tarefa e deixe ela à vista enquanto os agentes trabalham." />
      ) : lista.length === 0 ? (
        <p className="pd-dica centro">{casca.filtro === 'ativas' ? 'Tudo concluído. Bom trabalho!' : 'Nenhuma tarefa concluída ainda.'}</p>
      ) : (
        <ul className="pd-lista">
          {lista.map((t) => (
            <li key={t.id} className={`pd-tarefa ${t.feita ? 'feita' : ''} ${casca.focoTarefaId === t.id ? 'em-foco' : ''}`}>
              <button className="pd-caixa" onClick={() => alternarTarefa(t.id)} role="checkbox" aria-checked={t.feita} aria-label={t.feita ? 'Marcar como ativa' : 'Marcar como concluída'}>
                {t.feita && (
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5.5 12.5 4 4 9-9" />
                  </svg>
                )}
              </button>
              <span className="pd-tarefa-texto">{t.texto}</span>
              {!t.feita && (
                <button className="pd-icone" onClick={() => focarTarefa(t.id)} title={casca.focoTarefaId === t.id ? 'Tirar o foco' : 'Focar nesta tarefa'} aria-label="Focar nesta tarefa" aria-pressed={casca.focoTarefaId === t.id}>
                  <IconeCasca nome="alvo" tamanho={14} />
                </button>
              )}
              <button className="pd-icone" onClick={() => apagarTarefa(t.id)} title="Apagar" aria-label="Apagar a tarefa">
                <IconeCasca nome="lixeira" tamanho={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Pomodoro />
    </div>
  );
}

// ---------- Pomodoro ----------

const CHAVE_POMODORO = 'hypercube.pomodoroRecolhido';

function Pomodoro() {
  const casca = useCasca();
  const p = casca.pomodoro;
  const [, setTique] = useState(0);
  const [recolhido, setRecolhido] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_POMODORO) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!p.rodando) return;
    const t = window.setInterval(() => setTique((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, [p.rodando]);

  const restante = restantePomodoro(p);
  const foco = casca.tarefas.find((t) => t.id === casca.focoTarefaId);
  const ativas = casca.tarefas.filter((t) => !t.feita);
  const fracao = 1 - restante / POMODORO_MS;
  const estado = p.rodando ? 'Focando' : p.iniciado ? 'Pausado' : 'Pronto pra focar';

  const alternar = () =>
    setRecolhido((r) => {
      try {
        localStorage.setItem(CHAVE_POMODORO, r ? '0' : '1');
      } catch {
        /* sem armazenamento */
      }
      return !r;
    });

  if (recolhido) {
    return (
      <section className={`pomodoro pomodoro-recolhido ${p.rodando ? 'rodando' : ''}`} aria-label="Pomodoro">
        <button className="pomodoro-cabeca pomodoro-alternar" onClick={alternar} aria-expanded={false} title="Mostrar o Pomodoro">
          <IconeCasca nome="relogio" tamanho={14} />
          <span>Pomodoro</span>
          <span className="pomodoro-duracao mono">{p.iniciado ? formatarTempo(restante) : '25 min'}</span>
        </button>
      </section>
    );
  }

  return (
    <section className={`pomodoro ${p.rodando ? 'rodando' : ''}`} aria-label="Pomodoro">
      <button className="pomodoro-cabeca pomodoro-alternar" onClick={alternar} aria-expanded title="Recolher o Pomodoro">
        <IconeCasca nome="relogio" tamanho={14} />
        <span>Pomodoro</span>
        <span className="pomodoro-duracao">25 min</span>
      </button>
      <div className="pomodoro-linha">
        <span className="pomodoro-estado">{estado}</span>
        <span className="pomodoro-tempo mono" role="timer" aria-live="off">
          {formatarTempo(restante)}
        </span>
      </div>
      <span className="pomodoro-trilho" aria-hidden="true">
        <span style={{ width: `${fracao * 100}%` }} />
      </span>
      <div className="pomodoro-acoes">
        {p.rodando ? (
          <button className="botao" onClick={pausarPomodoro}>
            <IconeCasca nome="pausar" tamanho={14} /> Pausar
          </button>
        ) : (
          <button className="botao primario" onClick={iniciarPomodoro}>
            <IconeCasca nome="tocar" tamanho={14} /> {p.iniciado ? 'Continuar' : 'Iniciar'}
          </button>
        )}
        {p.iniciado && (
          <button className="pd-icone" onClick={zerarPomodoro} title="Zerar" aria-label="Zerar o Pomodoro">
            <IconeCasca nome="zerar" tamanho={15} />
          </button>
        )}
      </div>
      <label className="pomodoro-foco">
        <span>Foco em</span>
        <select value={foco?.id ?? ''} onChange={(ev) => focarTarefa(ev.target.value || null)} aria-label="Tarefa em foco">
          <option value="">Nenhuma tarefa selecionada</option>
          {ativas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.texto}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
