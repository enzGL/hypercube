// Avisos curtos. Soltos no canto na maioria das telas; em Sessões ficam numa faixa acima do campo
// de tarefa, para nunca cobrir um pedido de permissão.
import { ESTADO_INFO, fecharAviso, focar, useLoja } from '../estado/loja';
import { Icone } from './Pecas';

export function Avisos({ emLinha }: { emLinha?: boolean }) {
  const e = useLoja();
  if (emLinha && e.avisos.length === 0) return null;
  return (
    <div className={emLinha ? 'avisos-linha' : 'avisos'} aria-live="polite">
      {e.avisos.map((a) => (
        <div key={a.id} className={`aviso aviso-${a.tipo}`}>
          {a.tipo !== 'info' && (
            <span className="estado-simbolo" style={{ color: ESTADO_INFO[a.tipo].cor }}>
              {ESTADO_INFO[a.tipo].simbolo}
            </span>
          )}
          <span className="aviso-texto">{a.texto}</span>
          {a.verticeId && (
            <button
              className="link"
              onClick={() => {
                focar(a.verticeId!);
                fecharAviso(a.id);
              }}
            >
              Ver
            </button>
          )}
          <button className="icone-botao" onClick={() => fecharAviso(a.id)} aria-label="Fechar aviso">
            <Icone nome="fechar" tamanho={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
