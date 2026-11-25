import { useEffect, useState } from 'react';
import {
  abrirDialogo,
  criarSessao,
  criarVertice,
  novoTerminal,
  DESCRICAO_NIVEL,
  DESCRICAO_PAPEL,
  NOME_NIVEL,
  NOME_PAPEL,
  renomearSessao,
  useLoja,
  type Nivel,
  type Papel,
} from '../estado/loja';
import { nativo, NOME_AGENTE, type Agente } from '../nativo';
import { Icone, MiniVertice } from './Pecas';
import { AgentesQueFaltam, useAgentesDetectados } from './InstalarAgente';
import { EscolhaJeito, lerJeito, type Jeito } from './EscolhaJeito';
import { ModelosBots } from './ModelosBots';

/** Agentes do computador; a lista se atualiza quando uma instalação termina. */
const useAgentes = useAgentesDetectados;

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

const AGENTE_PADRAO: Record<string, Agente> = { lider: 'claude', batedor: 'gemini', construtor: 'codex', revisor: 'claude' };
const NIVEL_PADRAO: Record<string, Nivel> = { lider: 'forte', batedor: 'barato', construtor: 'padrao', revisor: 'padrao' };

/** Vagas da equipe predefinida: o Líder chama cada papel quando precisar. */
const VAGAS: Papel[] = ['batedor', 'construtor', 'revisor'];

function RenomearSessao({ sessaoId }: { sessaoId: string }) {
  const e = useLoja();
  const s = e.sessoes.find((x) => x.id === sessaoId);
  const [nome, setNome] = useState(s?.nome ?? '');
  const salvar = () => {
    renomearSessao(sessaoId, nome);
    abrirDialogo(null);
  };
  return (
    <Moldura titulo="Renomear sessão">
      <label className="campo">
        <span>Nome</span>
        <input autoFocus value={nome} onChange={(ev) => setNome(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && salvar()} />
      </label>
      <footer className="dialogo-rodape">
        <button className="botao" onClick={() => abrirDialogo(null)}>
          Cancelar
        </button>
        <button className="botao primario" onClick={salvar} disabled={!nome.trim()}>
          Salvar
        </button>
      </footer>
    </Moldura>
  );
}

function NovaSessao({ pastaInicial }: { pastaInicial?: string }) {
  const agentes = useAgentes();
  const [nome, setNome] = useState('');
  const e = useLoja();
  const [pasta, setPasta] = useState(() => pastaInicial ?? e.sessoes.find((s) => s.id === e.sessaoAtivaId)?.pasta ?? '');
  const [jeito, setJeito] = useState<Jeito>(lerJeito);
  const comAgentes = jeito === 'agentes';
  // Com agentes já liga as cópias separadas; em Normal a pessoa escolhe.
  const [worktrees, setWorktrees] = useState(comAgentes);
  const [inicio, setInicio] = useState<'vazio' | 'terminal' | 'agente' | 'equipe'>(comAgentes ? 'equipe' : 'terminal');
  const [agente, setAgente] = useState<Agente>('claude');

  const mudarJeito = (j: Jeito) => {
    setJeito(j);
    setWorktrees(j === 'agentes');
    setInicio(j === 'agentes' ? 'equipe' : 'terminal');
  };

  const criar = async () => {
    const s = criarSessao(nome.trim() || 'Nova sessão', pasta, worktrees, comAgentes);
    abrirDialogo(null);
    if (inicio === 'terminal') await novoTerminal(s.id);
    if (inicio === 'agente') await criarVertice(s.id, 'agente', agente, 'padrao');
    if (inicio === 'equipe') await criarVertice(s.id, 'lider', agente, 'forte', undefined, { vagas: VAGAS });
  };

  return (
    <Moldura titulo="Nova sessão">
      <EscolhaJeito valor={jeito} aoMudar={mudarJeito} />
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
      <label className="interruptor">
        <input type="checkbox" checked={worktrees} onChange={(ev) => setWorktrees(ev.target.checked)} />
        <span className="interruptor-trilho" />
        <span>Cada agente trabalha numa cópia separada do projeto</span>
      </label>
      <span className="interruptor-dica">
        Um não mexe no arquivo do outro.
      </span>
      <div className="campo">
        <span>Começar com</span>
        <div className="opcoes">
          {(comAgentes
            ? [
                { id: 'equipe', nome: 'Equipe predefinida', desc: 'O Líder, com vagas para Explorador, Construtor e Revisor' },
                { id: 'vazio', nome: 'Nenhum agente', desc: 'Sessão vazia, você cria depois' },
              ]
            : [
                { id: 'terminal', nome: 'Terminal', desc: 'Um terminal comum na pasta do projeto' },
                { id: 'agente', nome: 'Um agente', desc: 'Um agente comum, faz o que você pedir' },
                { id: 'vazio', nome: 'Nada', desc: 'Sessão vazia, você abre depois' },
              ]
          ).map((o) => (
            <button key={o.id} className={`opcao ${inicio === o.id ? 'ativo' : ''}`} onClick={() => setInicio(o.id as typeof inicio)}>
              <b>{o.nome}</b>
              <span>{o.desc}</span>
            </button>
          ))}
        </div>
        {inicio === 'equipe' && (
          <div className="vagas-previa" aria-label="Vagas da equipe">
            {VAGAS.map((p) => (
              <span key={p} className="vaga-chip">
                <MiniVertice papel={p} tamanho={16} /> {NOME_PAPEL[p]}
              </span>
            ))}
            <span className="dica-campo">O Líder chama cada um quando precisar.</span>
          </div>
        )}
      </div>
      {(inicio === 'agente' || inicio === 'equipe') && (
        <label className="campo">
          <span>{inicio === 'equipe' ? 'Agente do Líder' : 'Agente'}</span>
          <select value={agente} onChange={(ev) => setAgente(ev.target.value as Agente)}>
            {agentes.length === 0 && <option value={agente}>{NOME_AGENTE[agente]} (procurando os outros…)</option>}
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
        <span>Sem skill, do jeito que ele é.</span>
      </button>
      <div className="campo">
        <span>
          Agentes predefinidos <span className="secundario">(opcional)</span>
        </span>
        <div className="opcoes papeis-grade">
          {(['lider', 'batedor', 'construtor', 'revisor', 'consertador'] as Papel[]).map((p) => (
            <button
              key={p}
              title={DESCRICAO_PAPEL[p]}
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
            </button>
          ))}
        </div>
      </div>
      <div className="linha-dupla">
        <label className="campo">
          <span>Agente</span>
          <select value={agente} onChange={(ev) => setAgente(ev.target.value as Agente)}>
            {agentes.length === 0 && <option value={agente}>{NOME_AGENTE[agente]} (procurando os outros…)</option>}
            {agentes.map((a) => (
              <option key={a.agente} value={a.agente} disabled={!a.instalado}>
                {NOME_AGENTE[a.agente]}
                {a.instalado ? '' : ' (não instalado)'}
              </option>
            ))}
            <option value="terminal">Terminal (sem IA)</option>
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
      <AgentesQueFaltam agentes={agentes} />
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
  if (dialogo.tipo === 'novaSessao') return <NovaSessao pastaInicial={dialogo.pasta} />;
  if (dialogo.tipo === 'modelosBots') return <ModelosBots />;
  if (dialogo.tipo === 'renomearSessao') return <RenomearSessao sessaoId={dialogo.sessaoId} />;
  return <NovoVertice sessaoId={dialogo.sessaoId} papelInicial={dialogo.papel} />;
}
