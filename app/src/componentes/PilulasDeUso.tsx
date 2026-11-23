// Uso do plano por agente e memória do app, em pílulas (ficam na lateral, acima da pessoa).
import { useEffect, useState } from 'react';
import { nativo, type UsoDoPlano } from '../nativo';
import { LogoAgente } from './LogoAgente';
import { IconeCasca } from './IconesCasca';

function usarMemoriaMB() {
  const [mb, setMb] = useState<number | null>(null);
  useEffect(() => {
    const medir = () => {
      const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      setMb(m ? Math.round(m.usedJSHeapSize / 1048576) : null);
    };
    medir();
    const t = window.setInterval(medir, 4000);
    return () => window.clearInterval(t);
  }, []);
  return mb;
}

function nivelUso(v: number) {
  return v >= 80 ? 'alto' : v >= 60 ? 'medio' : 'ok';
}

export function PilulasDeUso({ compacta }: { compacta?: boolean }) {
  const [uso, setUso] = useState<UsoDoPlano[]>([]);
  const mb = usarMemoriaMB();

  useEffect(() => {
    nativo.processos.usoDoPlano().then(setUso);
    const t = window.setInterval(() => nativo.processos.usoDoPlano().then(setUso), 60000);
    return () => window.clearInterval(t);
  }, []);

  if (!uso.length && mb === null) return null;
  return (
    <div className={`pilulas-uso ${compacta ? 'compacta' : ''}`} aria-label="Uso do plano por agente e memória">
      {uso.map((u) => (
        <span
          key={u.provedor}
          className={`bg-chip uso-${nivelUso(u.cincoHoras)}`}
          title={`${u.provedor}: ${u.cincoHoras}% das 5 h · ${u.semana}% da semana · renova em ${u.renovaEm}`}
        >
          <span className="bg-chip-ponto" aria-hidden="true" />
          <LogoAgente agente={u.provedor === 'Claude' ? 'claude' : 'codex'} tamanho={12} />
          {!compacta && u.provedor} <b>{u.cincoHoras}%</b>
        </span>
      ))}
      {mb !== null && (
        <span className="bg-chip bg-ram" title="Memória usada pelo app">
          <IconeCasca nome="memoria" tamanho={13} /> <b>{mb}</b> MB
        </span>
      )}
    </div>
  );
}
