import { useEffect, useState } from 'react';
import {
  abrirDialogo,
  criarSessao,
  criarVertice,
  DESCRICAO_NIVEL,
  DESCRICAO_PAPEL,
  NOME_NIVEL,
  NOME_PAPEL,
  useLoja,
  type Nivel,
  type Papel,
} from '../estado/loja';
import { nativo, NOME_AGENTE, type Agente, type AgenteDetectado } from '../nativo';
import { Icone, MiniVertice } from './Pecas';

function useAgentes() {
  const [a, setA] = useState<AgenteDetectado[]>([]);
  useEffect(() => {
    nativo.processos.detectarAgentes().then(setA);
  }, []);
  return a;
}

function Moldura({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  useEffect(() => {
    const k = (ev: KeyboardEvent) => ev.key === 'Escape' && abrirDialogo(null);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return (
    <div className="fundo-dialogo" onMouseDown={() => abrirDialogo(null)}>
      <div className="dialogo" role="dialog" aria-label={titulo} onMouseDown={(ev) => ev.stopPropagation()}>
        <header className="dialogo-cabeca">
          <h2>{titulo}</h2>
          <button className="icone-botao" onClick={() => abrirDialogo(null)} aria-label="Fechar">
            <Icone nome="fechar" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

const EQUIPE: Papel[] = ['lider', 'batedor', 'construtor', 'revisor'];
const AGENTE_PADRAO: Record<string, Agente> = { lider: 'claude', batedor: 'gemini', construtor: 'codex', revisor: 'claude' };
const NIVEL_PADRAO: Record<string, Nivel> = { lider: 'forte', batedor: 'barato', construtor: 'padrao', revisor: 'padrao' };

function NovaSessao() {
  const agentes = useAgentes();
  const [nome, setNome] = useState('');
  const [pasta, setPasta] = useState('C:\\Projetos\\loja-online');
  const [orquestracao, setOrquestracao] = useState(false);
  const [worktrees, setWorktrees] = useState(false);
  const [inicio, setInicio] = useState<'vazio' | 'agente' | 'equipe'>('agente');
  const [agente, setAgente] = useState<Agente>('claude');

  const criar = async () => {
    const s = criarSessao(nome.trim() || 'Nova sessão', pasta, worktrees, orquestracao);
    abrirDialogo(null);
    if (inicio === 'agente') await criarVertice(s.id, 'agente', agente, 'padrao');
    if (inicio === 'equipe') {
      const instalado = (a: Agente) => agentes.some((d) => d.agente === a && d.instalado);
      for (const p of EQUIPE) {
        const preferido = p === 'lider' ? agente : AGENTE_PADRAO[p];
        await criarVertice(s.id, p, instalado(preferido) ? preferido : agente, NIVEL_PADRAO[p]);
      }
    }
  };

  return (
    <Moldura titulo="Nova sessão">
      <label className="campo">
        <span>Nome</span>
        <input autoFocus value={nome} onChange={(ev) => setNome(ev.target.value)} placeholder="Ex.: Checkout novo" />
      </label>
      <div className="campo">
        <span>Pasta do projeto</span>
        <div className="linha-campo">
          <input className="mono" value={pasta} onChange={(ev) => setPasta(ev.target.value)} />
          <button className="botao" onClick={async () => setPasta((await nativo.arquivos.escolherPasta()) ?? pasta)}>
            <Icone nome="pasta" /> Escolher…
          </button>
        </div>
      </div>
      <div className="campo">
        <span>Como usar esta sessão</span>
        <div className="opcoes">
          {[
            { id: false, nome: 'Terminal padrão', desc: 'Os agentes lado a lado, cada um no seu terminal. Você manda em cada um.' },
            { id: true, nome: 'Orquestração', desc: 'Um painel mostra quem divide e quem faz, com limite de agentes ao mesmo tempo.' },
          ].map((o) => (
            <button
              key={String(o.id)}
              className={`opcao ${orquestracao === o.id ? 'ativo' : ''}`}
              onClick={() => {
                setOrquestracao(o.id);
                setWorktrees(o.id);
                if (!o.id && inicio === 'equipe') setInicio('agente');
              }}
            >
              <b>{o.nome}</b>
              <span>{o.desc}</span>
            </button>
          ))}
        </div>
      </div>
      <label className="interruptor">
        <input type="checkbox" checked={worktrees} onChange={(ev) => setWorktrees(ev.target.checked)} />
        <span className="interruptor-trilho" />
        <span>Cada agente trabalha numa cópia separada do projeto</span>
      </label>
      <span className="interruptor-dica">
        Usa o git worktree: cada agente ganha a sua pasta, ligada ao mesmo repositório. Assim um não mexe no arquivo do outro, e você junta o que der certo.
      </span>
      <div className="campo">
        <span>Começar com</span>
        <div className="opcoes">
          {[
            { id: 'vazio', nome: 'Nenhum agente', desc: 'Sessão vazia, você cria depois' },
            { id: 'agente', nome: 'Um agente', desc: 'Um agente comum, faz o que você pedir' },
            ...(orquestracao ? [{ id: 'equipe', nome: 'Equipe predefinida', desc: 'Líder, explorador, construtor e revisor, cada um com a sua skill' }] : []),
          ].map((o) => (
            <button key={o.id} className={`opcao ${inicio === o.id ? 'ativo' : ''}`} onClick={() => setInicio(o.id as typeof inicio)}>
              <b>{o.nome}</b>
              <span>{o.desc}</span>
            </button>
          ))}
        </div>
      </div>
      {inicio !== 'vazio' && (
        <label className="campo">
          <span>{inicio === 'equipe' ? 'Agente do Líder' : 'Agente'}</span>
          <select value={agente} onChange={(ev) => setAgente(ev.target.value as Agente)}>
            {agentes.filter((a) => a.instalado && a.agente !== 'terminal').map((a) => (
              <option key={a.agente} value={a.agente}>
                {NOME_AGENTE[a.agente]}
              </option>
            ))}
          </select>
        </label>
      )}
      <footer className="dialogo-rodape">
        <button className="botao" onClick={() => abrirDialogo(null)}>
          Cancelar
        </button>
        <button className="botao primario" onClick={criar} disabled={!pasta.trim()}>
          Criar sessão
        </button>
      </footer>
    </Moldura>
  );
}

function NovoVertice({ sessaoId, papelInicial }: { sessaoId: string; papelInicial?: Papel }) {
  const agentes = useAgentes();
  const [papel, setPapel] = useState<Papel>(papelInicial ?? 'agente');
  const [agente, setAgente] = useState<Agente>(AGENTE_PADRAO[papelInicial ?? 'agente'] ?? 'claude');
  const [nivel, setNivel] = useState<Nivel>(NIVEL_PADRAO[papelInicial ?? 'agente'] ?? 'padrao');
  const [tarefa, setTarefa] = useState('');
  const e = useLoja();
  // O agente sugerido para o papel pode não estar instalado: cai no primeiro que está.
  useEffect(() => {
    if (!agentes.length || agentes.some((a) => a.agente === agente && a.instalado)) return;
    const primeiro = agentes.find((a) => a.instalado && a.agente !== 'terminal') ?? agentes.find((a) => a.instalado);
    if (primeiro) setAgente(primeiro.agente);
  }, [agentes, agente]);
  const ativos = e.vertices.filter((v) => v.sessaoId === sessaoId && v.estado === 'trabalhando').length;

  return (
    <Moldura titulo="Novo agente">
      <button
        className={`opcao opcao-comum ${papel === 'agente' ? 'ativo' : ''}`}
        onClick={() => {
          setPapel('agente');
          setNivel('padrao');
        }}
      >
        <span className="opcao-topo">
          <MiniVertice papel="agente" tamanho={18} /> <b>Agente comum</b>
        </span>
        <span>Abre o agente como ele é, sem skill. Bom para orquestrar do seu jeito.</span>
      </button>
      <div className="campo">
        <span>
          Agentes predefinidos <span className="secundario">(opcional)</span>
        </span>
        <p className="dica-campo" style={{ marginTop: -2 }}>Cada um vem com uma skill do seu ofício e trabalha numa área do projeto.</p>
        <div className="opcoes papeis-grade">
          {(['lider', 'batedor', 'construtor', 'revisor', 'consertador'] as Papel[]).map((p) => (
            <button
              key={p}
              className={`opcao ${papel === p ? 'ativo' : ''}`}
              onClick={() => {
                setPapel(p);
                if (AGENTE_PADRAO[p]) setAgente(AGENTE_PADRAO[p]);
                if (NIVEL_PADRAO[p]) setNivel(NIVEL_PADRAO[p]);
              }}
            >
              <span className="opcao-topo">
                <MiniVertice papel={p} tamanho={18} /> <b>{NOME_PAPEL[p]}</b>
              </span>
              <span>{DESCRICAO_PAPEL[p]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="linha-dupla">
        <label className="campo">
          <span>Agente</span>
          <select value={agente} onChange={(ev) => setAgente(ev.target.value as Agente)}>
            {agentes.map((a) => (
              <option key={a.agente} value={a.agente} disabled={!a.instalado}>
                {NOME_AGENTE[a.agente]}
                {a.instalado ? '' : ' (não instalado)'}
              </option>
            ))}
          </select>
        </label>
        <div className="campo">
          <span>Nível</span>
          <div className="segmentos">
            {(['barato', 'padrao', 'forte'] as Nivel[]).map((n) => (
              <button key={n} className={nivel === n ? 'ativo' : ''} title={DESCRICAO_NIVEL[n]} onClick={() => setNivel(n)}>
                {NOME_NIVEL[n]}
              </button>
            ))}
          </div>
          <p className="dica-campo">{DESCRICAO_NIVEL[nivel]}</p>
        </div>
      </div>
      <label className="campo">
        <span>Primeira tarefa (opcional)</span>
        <textarea rows={2} value={tarefa} onChange={(ev) => setTarefa(ev.target.value)} placeholder="Ex.: Mapeie onde o pedido é cobrado" />
      </label>
      {ativos >= 8 && <p className="aviso-limite">Já há 8 agentes trabalhando nesta sessão (o limite).</p>}
      <footer className="dialogo-rodape">
        <button className="botao" onClick={() => abrirDialogo(null)}>
          Cancelar
        </button>
        <button
          className="botao primario"
          disabled={ativos >= 8}
          onClick={async () => {
            abrirDialogo(null);
            await criarVertice(sessaoId, papel, agente, nivel, tarefa.trim() || undefined);
          }}
        >
          Criar agente
        </button>
      </footer>
    </Moldura>
  );
}

export function Dialogos() {
  const { dialogo } = useLoja();
  if (!dialogo) return null;
  if (dialogo.tipo === 'novaSessao') return <NovaSessao />;
  return <NovoVertice sessaoId={dialogo.sessaoId} papelInicial={dialogo.papel} />;
}
