// Painel do roteador de IA: agentes do nível "barato" vão para modelos gratuitos.
import { useEffect, useState } from 'react';
import { avisar } from '../estado/loja';
import { nativo, type EstadoRoteador } from '../nativo';
import { BarraTopo } from '../componentes/BarraTopo';
import { Icone } from '../componentes/Pecas';

const NOME_CADEIA: Record<string, string> = { barato: 'Nível barato', padrao: 'Nível padrão' };

export function Roteador() {
  const [r, setR] = useState<EstadoRoteador | null>(null);
  useEffect(() => {
    nativo.roteador.estado().then(setR);
  }, []);
  if (!r) return <div className="carregando">Carregando…</div>;

  const nomeProv = (id: string) => r.provedores.find((p) => p.id === id)?.nome ?? id;
  const mover = (nivel: string, i: number, d: -1 | 1) => {
    const c = [...r.cadeias[nivel]];
    const j = i + d;
    if (j < 0 || j >= c.length) return;
    [c[i], c[j]] = [c[j], c[i]];
    setR({ ...r, cadeias: { ...r.cadeias, [nivel]: c } });
    nativo.roteador.salvarCadeia(nivel, c);
  };
  const totalHoje = r.provedores.reduce((s, p) => s + p.chamadasHoje, 0);

  return (
    <div className="tela-roteador">
      <BarraTopo titulo="Roteador" subtitulo={`roteador-ia · ${r.endereco} · compatível com a API da OpenAI`} />
      <div className="rolagem">
        <div className="cartoes-linha">
          <section className="cartao">
            <h3>Estado</h3>
            <label className="interruptor">
              <input
                type="checkbox"
                checked={r.ligado}
                onChange={(ev) => {
                  setR({ ...r, ligado: ev.target.checked });
                  nativo.roteador.ligar(ev.target.checked);
                  avisar(ev.target.checked ? 'Roteador ligado.' : 'Roteador desligado: o nível barato usa o próprio agente.');
                }}
              />
              <span className="interruptor-trilho" />
              <span>{r.ligado ? 'Ligado' : 'Desligado'}</span>
            </label>
            <p className="numero mono">{totalHoje}</p>
            <p className="secundario">chamadas hoje, sem custo</p>
          </section>
          <section className="cartao largo2">
            <h3>Segurança</h3>
            <ul className="lista-seg">
              <li>Só responde em 127.0.0.1</li>
              <li>Pede token em toda chamada</li>
              <li>Recusa pedidos que vêm de páginas do navegador</li>
              <li>O registro guarda números, nunca o conteúdo</li>
            </ul>
          </section>
        </div>

        <section className="cartao">
          <h3>Provedores</h3>
          <table className="tabela">
            <thead>
              <tr>
                <th>Provedor</th>
                <th>Estado</th>
                <th className="num">Chamadas hoje</th>
                <th>Cota do dia</th>
                <th className="num">Latência</th>
              </tr>
            </thead>
            <tbody>
              {r.provedores.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>
                    <label className="interruptor pequeno">
                      <input
                        type="checkbox"
                        checked={p.ligado}
                        onChange={(ev) => setR({ ...r, provedores: r.provedores.map((x) => (x.id === p.id ? { ...x, ligado: ev.target.checked } : x)) })}
                      />
                      <span className="interruptor-trilho" />
                      <span>{p.ligado ? 'ligado' : 'desligado'}</span>
                    </label>
                  </td>
                  <td className="num mono">{p.chamadasHoje}</td>
                  <td>
                    <span className="barra-uso">
                      <span className="barra-trilho">
                        <span className="barra-cheia" style={{ width: `${(p.chamadasHoje / p.cotaDiaria) * 100}%`, background: '#93A4FF' }} />
                      </span>
                      <span className="barra-valor">
                        {p.chamadasHoje}/{p.cotaDiaria}
                      </span>
                    </span>
                  </td>
                  <td className="num mono">{p.latenciaMs ? `${p.latenciaMs} ms` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="cartoes-linha">
          {Object.entries(r.cadeias).map(([nivel, cadeia]) => (
            <section key={nivel} className="cartao">
              <h3>{NOME_CADEIA[nivel] ?? nivel}</h3>
              <p className="secundario">Tenta na ordem; se um falhar ou a cota acabar, passa para o próximo.</p>
              <ol className="cadeia">
                {cadeia.map((id, i) => (
                  <li key={id}>
                    <span className="mono cadeia-n">{i + 1}</span>
                    <span>{nomeProv(id)}</span>
                    <span className="cadeia-acoes">
                      <button className="icone-botao" onClick={() => mover(nivel, i, -1)} disabled={i === 0} aria-label="Subir">
                        <Icone nome="cima" tamanho={14} />
                      </button>
                      <button className="icone-botao" onClick={() => mover(nivel, i, 1)} disabled={i === cadeia.length - 1} aria-label="Descer">
                        <Icone nome="baixo" tamanho={14} />
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          <section className="cartao">
            <h3>Nível forte</h3>
            <p className="secundario">Não passa pelo roteador: usa direto o próprio agente (Claude Code, Codex…).</p>
          </section>
        </div>

        <section className="cartao">
          <h3>Últimas chamadas</h3>
          <table className="tabela">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Nível</th>
                <th>Provedor</th>
                <th>Modelo</th>
                <th className="num">Tokens</th>
                <th className="num">Tempo</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {r.chamadas.map((c, i) => (
                <tr key={i}>
                  <td className="mono">{new Date(c.momento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{c.nivel === 'padrao' ? 'padrão' : c.nivel}</td>
                  <td>{c.provedor}</td>
                  <td className="mono">{c.modelo}</td>
                  <td className="num mono">{c.tokens}</td>
                  <td className="num mono">{c.ms} ms</td>
                  <td>{c.ok ? <span style={{ color: '#4CC38A' }}>● ok</span> : <span style={{ color: '#F0646E' }}>✕ passou ao próximo</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
