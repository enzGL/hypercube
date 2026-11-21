// Grade de cartões para escolher o tema, com uma mini prévia de cada um
// (lateral + cartão + texto). Usada em Sobre > Aparência e na introdução.
import { definirTema, TEMAS, useTema, type InfoTema } from '../estado/tema';

function Previa({ t }: { t: InfoTema }) {
  const [lateral, cartao, destaque] = t.amostra;
  // O fundo da área principal fica entre a lateral e o cartão.
  const fundo = `color-mix(in srgb, ${lateral} 50%, ${cartao})`;
  const borda = `color-mix(in srgb, ${t.textoAmostra} 14%, transparent)`;
  return (
    <span className="tema-previa" style={{ background: fundo, borderColor: borda }} aria-hidden="true">
      <span className="tema-previa-lateral" style={{ background: lateral, borderRight: `1px solid ${borda}` }}>
        <i style={{ background: destaque, opacity: 0.9, width: '70%' }} />
        <i style={{ background: t.textoAmostra, width: '85%' }} />
        <i style={{ background: t.textoAmostra, width: '60%' }} />
        <i style={{ background: t.textoAmostra, width: '75%' }} />
      </span>
      <span className="tema-previa-corpo">
        <i style={{ display: 'block', height: 5, width: '55%', borderRadius: 2, background: t.textoAmostra }} />
        <span className="tema-previa-cartao" style={{ background: cartao, border: `1px solid ${borda}` }}>
          <i style={{ background: t.textoAmostra, width: '80%', opacity: 0.8 }} />
          <i style={{ background: t.textoAmostra, width: '50%', opacity: 0.45 }} />
          <i style={{ background: destaque, width: '30%', marginTop: 'auto' }} />
        </span>
      </span>
    </span>
  );
}

export function EscolherTema({ aoEscolher }: { aoEscolher?: (id: InfoTema['id']) => void }) {
  const atual = useTema();
  return (
    <div className="temas-grade" role="group" aria-label="Tema do app">
      {TEMAS.map((t) => (
        <button
          key={t.id}
          type="button"
          className="tema-cartao"
          aria-pressed={atual === t.id}
          onClick={() => {
            definirTema(t.id);
            aoEscolher?.(t.id);
          }}
        >
          <Previa t={t} />
          <span className="tema-nome">
            {t.nome}
            {t.experimental && <span className="selo tema-selo">experimental</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
