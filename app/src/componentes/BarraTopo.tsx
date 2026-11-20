import { useEffect, useState } from 'react';
import { contar, useLoja, verticesDaSessao } from '../estado/loja';
import { nativo, type UsoDoPlano } from '../nativo';
import { SimboloEstado } from './Pecas';

export function BarraTopo({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: string; acoes?: React.ReactNode }) {
  const e = useLoja();
  const [uso, setUso] = useState<UsoDoPlano[]>([]);
  useEffect(() => {
    nativo.processos.usoDoPlano().then(setUso);
  }, []);
  const c = contar(e.sessaoAtivaId ? verticesDaSessao(e, e.sessaoAtivaId) : e.vertices);

  return (
    <header className="topo">
      <div className="topo-linha">
      <div className="topo-titulo">
        <h1>{titulo}</h1>
        {subtitulo && <span className="caminho">{subtitulo}</span>}
      </div>
      <div className="contadores" role="status" aria-label="Estado dos Vértices desta sessão">
        <span className="contador-item">
          <b>{c.agentes}</b> agentes
        </span>
        <span className="contador-item">
          <SimboloEstado estado="trabalhando" /> <b>{c.trabalhando}</b> trabalhando
        </span>
        <span className="contador-item">
          <SimboloEstado estado="esperando" /> <b>{c.esperando}</b> esperando
        </span>
        <span className="contador-item">
          <SimboloEstado estado="pronto" /> <b>{c.prontos}</b> prontos
        </span>
        {c.erros > 0 && (
          <span className="contador-item">
            <SimboloEstado estado="erro" /> <b>{c.erros}</b> com erro
          </span>
        )}
      </div>
      <div className="usos" aria-label="Uso do plano">
        {uso.map((u) => (
          <div key={u.provedor} className="uso" title={`${u.provedor}: renova em ${u.renovaEm}`}>
            <span className="uso-nome">{u.provedor}</span>
            <Barra rotulo="5 h" valor={u.cincoHoras} />
            <Barra rotulo="sem." valor={u.semana} />
          </div>
        ))}
      </div>
      </div>
      {acoes && <div className="topo-acoes">{acoes}</div>}
    </header>
  );
}

function Barra({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <span className="barra-uso">
      <span className="barra-rotulo">{rotulo}</span>
      <span className="barra-trilho">
        <span className="barra-cheia" style={{ width: `${valor}%`, background: valor > 80 ? '#F0646E' : valor > 60 ? '#E9A21B' : '#93A4FF' }} />
      </span>
      <span className="barra-valor">{valor}%</span>
    </span>
  );
}
