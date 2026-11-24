// Lista de trabalho do Líder (ferramenta atualizar_lista), no painel direito.
import { useState } from 'react';
import { focar, nomeDoAgente, responderItem, useLoja, type EstadoItem, type ItemLista, type Vertice } from '../estado/loja';

const ESTADO: Record<EstadoItem, { nome: string; simbolo: string }> = {
  aberto: { nome: 'Aberto', simbolo: '○' },
  em_andamento: { nome: 'Em andamento', simbolo: '◐' },
  fechado: { nome: 'Fechado', simbolo: '●' },
  pergunta: { nome: 'Pergunta para você', simbolo: '◆' },
  parado: { nome: 'Parado', simbolo: '✕' },
};

export function ListaDoLider() {
  const e = useLoja();
  const lideres = e.vertices.filter((v) => v.sessaoId === e.sessaoAtivaId && v.papel === 'lider' && v.lista?.length);
  if (!lideres.length) return null;
  return (
    <>
      {lideres.map((l) => (
        <Lista key={l.id} lider={l} />
      ))}
    </>
  );
}

function Lista({ lider }: { lider: Vertice }) {
  const itens = lider.lista ?? [];
  const feitos = itens.filter((i) => i.estado === 'fechado').length;
  const perguntas = itens.filter((i) => i.estado === 'pergunta').length;
  return (
    <section className="ll" aria-label={`Lista de trabalho de ${nomeDoAgente(lider)}`}>
      <div className="ll-cabeca">
        <button className="ll-titulo" onClick={() => focar(lider.id)} title="Ir para o terminal do Líder">
          Lista do {nomeDoAgente(lider)}
        </button>
        <span className="ll-conta mono">
          {feitos}/{itens.length}
        </span>
      </div>
      {perguntas > 0 && (
        <p className="ll-aviso">
          {perguntas === 1 ? '1 item espera a sua resposta.' : `${perguntas} itens esperam a sua resposta.`} Os outros continuam andando.
        </p>
      )}
      <ol className="ll-itens">
        {itens.map((i) => (
          <Item key={i.n} lider={lider} item={i} />
        ))}
      </ol>
    </section>
  );
}

function Item({ lider, item }: { lider: Vertice; item: ItemLista }) {
  const [respondendo, setRespondendo] = useState(false);
  const [texto, setTexto] = useState('');
  const est = ESTADO[item.estado];
  const enviar = () => {
    if (!texto.trim()) return;
    responderItem(lider.id, item.n, texto);
    setTexto('');
    setRespondendo(false);
  };
  return (
    <li className={`ll-item ll-${item.estado}`}>
      <span className="ll-simbolo" title={est.nome} aria-label={est.nome}>
        {est.simbolo}
      </span>
      <div className="ll-corpo">
        <span className="ll-texto">
          <b className="mono">{item.n}.</b> {item.titulo}
        </span>
        <span className="ll-meta">
          {est.nome}
          {item.quem && ` · ${item.quem}`}
        </span>
        {item.pergunta && (item.estado === 'pergunta' || item.estado === 'parado') && <span className="ll-pergunta">{item.pergunta}</span>}
        {item.estado === 'pergunta' &&
          (respondendo ? (
            <form
              className="ll-resposta"
              onSubmit={(ev) => {
                ev.preventDefault();
                enviar();
              }}
            >
              <input
                autoFocus
                className="campo"
                value={texto}
                onChange={(ev) => setTexto(ev.target.value)}
                onKeyDown={(ev) => ev.key === 'Escape' && setRespondendo(false)}
                placeholder={`Resposta ao item ${item.n}`}
                aria-label={`Resposta ao item ${item.n}`}
              />
              <button className="botao primario pequeno" type="submit" disabled={!texto.trim()}>
                Mandar
              </button>
            </form>
          ) : (
            <button className="botao pequeno ll-responder" onClick={() => setRespondendo(true)}>
              Responder
            </button>
          ))}
      </div>
    </li>
  );
}
