// Peças do perfil: avatar, campo de foto, campo do GitHub e o cartão "Editar perfil".
// Usadas na introdução (PrimeiraAbertura) e no cartão do usuário na lateral.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  buscarPerfilGitHub,
  fotoDeArquivo,
  fotoDoGitHub,
  inicialDoNome,
  salvarPerfil,
  usePerfil,
  type Perfil,
  type PerfilGitHub,
} from '../estado/perfil';
import { Icone } from './Pecas';
import '../perfil.css';

export function AvatarPerfil({ nome, foto, tamanho = 28 }: { nome: string; foto: string | null; tamanho?: number }) {
  const [quebrou, setQuebrou] = useState(false);
  useEffect(() => setQuebrou(false), [foto]);
  const estilo = { width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.44) };
  if (foto && !quebrou) {
    return <img className="pf-avatar" src={foto} alt="" style={estilo} onError={() => setQuebrou(true)} draggable={false} />;
  }
  return (
    <span className="pf-avatar pf-avatar-inicial" style={estilo} aria-hidden="true">
      {inicialDoNome(nome)}
    </span>
  );
}

// ---------- foto ----------

interface CampoFotoProps {
  nome: string;
  foto: string | null;
  github?: PerfilGitHub;
  aoMudar: (foto: string | null) => void;
  /** Quando ainda não há GitHub: o que fazer em "Usar a do GitHub" (ex.: abrir a busca). */
  aoPedirGitHub?: () => void;
}

export function CampoFoto({ nome, foto, github, aoMudar, aoPedirGitHub }: CampoFotoProps) {
  const entrada = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const escolher = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErro('');
    setOcupado(true);
    try {
      aoMudar(await fotoDeArquivo(arquivo));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para usar essa imagem.');
    } finally {
      setOcupado(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  const usarGitHub = async () => {
    if (!github) return aoPedirGitHub?.();
    setOcupado(true);
    aoMudar(await fotoDoGitHub(github.avatarUrl));
    setOcupado(false);
  };

  return (
    <div className="pf-foto">
      <AvatarPerfil nome={nome} foto={foto} tamanho={96} />
      <div className="pf-foto-acoes">
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          hidden
          onChange={(ev) => escolher(ev.target.files?.[0])}
        />
        <button className="botao" onClick={() => entrada.current?.click()} disabled={ocupado}>
          <Icone nome="arquivo" tamanho={14} /> {foto ? 'Trocar a foto' : 'Enviar uma imagem'}
        </button>
        {(github || aoPedirGitHub) && (
          <button className="botao" onClick={usarGitHub} disabled={ocupado}>
            Usar a do GitHub
          </button>
        )}
        {foto && (
          <button className="botao pequeno pf-link" onClick={() => aoMudar(null)} disabled={ocupado}>
            Remover a foto
          </button>
        )}
        <p className="pf-nota">
          {ocupado ? 'Preparando a foto…' : 'A foto fica só neste computador. Sem foto, aparece a inicial do seu nome.'}
        </p>
        {erro && <p className="pf-erro" role="alert">{erro}</p>}
      </div>
    </div>
  );
}

// ---------- GitHub ----------

interface CampoGitHubProps {
  github?: PerfilGitHub;
  aoConfirmar: (gh: PerfilGitHub) => void;
  aoRemover: () => void;
  focar?: boolean;
}

export function CampoGitHub({ github, aoConfirmar, aoRemover, focar }: CampoGitHubProps) {
  const [login, setLogin] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');
  const [achado, setAchado] = useState<PerfilGitHub | null>(null);

  if (github && !achado) {
    return (
      <div className="pf-gh-ligado">
        <AvatarPerfil nome={github.nome || github.login} foto={github.avatarUrl} tamanho={40} />
        <span className="pf-gh-quem">
          <b>{github.nome || github.login}</b>
          <span className="mono">@{github.login} · GitHub</span>
        </span>
        <button className="botao pequeno" onClick={aoRemover}>
          Desligar
        </button>
      </div>
    );
  }

  const buscar = async () => {
    if (!login.trim()) return;
    setErro('');
    setAchado(null);
    setBuscando(true);
    try {
      setAchado(await buscarPerfilGitHub(login));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para buscar agora.');
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="pf-gh">
      <form
        className="pf-gh-busca"
        onSubmit={(ev) => {
          ev.preventDefault();
          buscar();
        }}
      >
        <span className="pf-gh-arroba mono" aria-hidden="true">@</span>
        <input
          className="pf-campo mono"
          value={login}
          onChange={(ev) => setLogin(ev.target.value)}
          placeholder="seu-usuario"
          aria-label="Usuário do GitHub"
          autoComplete="off"
          spellCheck={false}
          autoFocus={focar}
        />
        <button className="botao" type="submit" disabled={buscando || !login.trim()}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>
      {erro && <p className="pf-erro" role="alert">{erro}</p>}
      {achado && (
        <div className="pf-gh-achado">
          <AvatarPerfil nome={achado.nome} foto={achado.avatarUrl} tamanho={48} />
          <span className="pf-gh-quem">
            <b>{achado.nome}</b>
            <span className="mono">@{achado.login}</span>
          </span>
          <button
            className="botao primario pequeno"
            onClick={() => {
              aoConfirmar(achado);
              setAchado(null);
              setLogin('');
            }}
          >
            É você? Usar
          </button>
        </div>
      )}
      <p className="pf-nota">
        Só usamos o seu perfil público.
      </p>
    </div>
  );
}

// ---------- cartão do usuário na lateral ----------

export function CartaoUsuario({ recolhida, children }: { recolhida: boolean; children?: ReactNode }) {
  const p = usePerfil();
  const [editando, setEditando] = useState(false);
  const nome = p.nome || 'Você';
  const linha = p.github ? `@${p.github.login} · GitHub` : 'conta local';
  return (
    <div className="usuario">
      <button
        className="pf-usuario-botao"
        onClick={() => setEditando(true)}
        title="Editar perfil"
        aria-label={`Editar perfil de ${nome}`}
      >
        <AvatarPerfil nome={nome} foto={p.foto} tamanho={28} />
        {!recolhida && (
          <span className="usuario-texto">
            <b>{nome}</b>
            <span className={p.github ? 'mono' : ''}>{linha}</span>
          </span>
        )}
      </button>
      {children}
      {editando && createPortal(<EditarPerfil aoFechar={() => setEditando(false)} />, document.body)}
    </div>
  );
}

// ---------- cartão "Editar perfil" ----------

export function EditarPerfil({ aoFechar }: { aoFechar: () => void }) {
  const atual = usePerfil();
  const [rascunho, setRascunho] = useState<Perfil>(atual);
  const [verGitHub, setVerGitHub] = useState(false);
  const muda = (m: Partial<Perfil>) => setRascunho((r) => ({ ...r, ...m }));

  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') aoFechar();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [aoFechar]);

  const salvar = () => {
    if (!rascunho.nome.trim()) return;
    salvarPerfil(rascunho);
    aoFechar();
  };

  return (
    <div className="pf-fundo" onMouseDown={(ev) => ev.target === ev.currentTarget && aoFechar()}>
      <div className="pf-cartao" role="dialog" aria-labelledby="pf-editar-titulo">
        <div className="pf-cabeca">
          <h2 id="pf-editar-titulo">Editar perfil</h2>
          <button className="icone-botao" onClick={aoFechar} aria-label="Fechar">
            <Icone nome="fechar" tamanho={14} />
          </button>
        </div>

        <label className="pf-rotulo" htmlFor="pf-nome">Como você quer ser chamado</label>
        <input
          id="pf-nome"
          className="pf-campo"
          value={rascunho.nome}
          maxLength={40}
          onChange={(ev) => muda({ nome: ev.target.value })}
          onKeyDown={(ev) => ev.key === 'Enter' && salvar()}
        />
        {!rascunho.nome.trim() && <p className="pf-erro">O nome não pode ficar vazio.</p>}

        <span className="pf-rotulo">Foto</span>
        <CampoFoto
          nome={rascunho.nome}
          foto={rascunho.foto}
          github={rascunho.github}
          aoMudar={(foto) => muda({ foto })}
          aoPedirGitHub={() => setVerGitHub(true)}
        />

        <span className="pf-rotulo">GitHub</span>
        <CampoGitHub
          github={rascunho.github}
          focar={verGitHub}
          aoConfirmar={async (gh) => {
            muda({ github: gh });
            if (!rascunho.foto || verGitHub) muda({ foto: await fotoDoGitHub(gh.avatarUrl) });
            setVerGitHub(false);
          }}
          aoRemover={() => muda({ github: undefined })}
        />

        <div className="pf-rodape">
          <button className="botao" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao primario" onClick={salvar} disabled={!rascunho.nome.trim()}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
