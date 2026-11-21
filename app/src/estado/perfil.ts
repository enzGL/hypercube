// Perfil local: nome, foto e (se a pessoa quiser) o perfil público do GitHub.
// Tudo fica neste computador, em localStorage['hypercube.perfil'] (sempre com try/catch).
// `hypercube.nome` continua em dia porque o Início e as boas-vindas leem dali (nomeUsuario()).
import { useSyncExternalStore } from 'react';

export interface PerfilGitHub {
  login: string;
  nome: string;
  avatarUrl: string;
}

export interface Perfil {
  nome: string;
  /** Data URL (JPEG 256x256). Nunca sai do computador. */
  foto: string | null;
  github?: PerfilGitHub;
}

const CHAVE = 'hypercube.perfil';
const CHAVE_NOME = 'hypercube.nome';

function lerInicial(): Perfil {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE) ?? 'null');
    if (bruto && typeof bruto === 'object') {
      const gh = bruto.github;
      return {
        nome: typeof bruto.nome === 'string' ? bruto.nome : '',
        foto: typeof bruto.foto === 'string' && bruto.foto ? bruto.foto : null,
        github:
          gh && typeof gh.login === 'string'
            ? { login: gh.login, nome: String(gh.nome ?? ''), avatarUrl: String(gh.avatarUrl ?? '') }
            : undefined,
      };
    }
  } catch {
    /* sem armazenamento ou JSON quebrado: começa vazio */
  }
  let nome = '';
  try {
    nome = (localStorage.getItem(CHAVE_NOME) ?? '').trim();
  } catch {
    /* ignorar */
  }
  return { nome, foto: null };
}

let perfil: Perfil = lerInicial();
const ouvintes = new Set<() => void>();

export function lerPerfil(): Perfil {
  return perfil;
}

export function usePerfil(): Perfil {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => perfil,
  );
}

/** Junta as mudanças ao perfil atual, grava e avisa quem está ouvindo. */
export function salvarPerfil(mudancas: Partial<Perfil>): Perfil {
  perfil = { ...perfil, ...mudancas, nome: (mudancas.nome ?? perfil.nome).trim() };
  if (!perfil.github) delete perfil.github;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(perfil));
    if (perfil.nome) localStorage.setItem(CHAVE_NOME, perfil.nome);
    else localStorage.removeItem(CHAVE_NOME);
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
  ouvintes.forEach((o) => o());
  return perfil;
}

export function inicialDoNome(nome: string): string {
  const c = nome.trim().charAt(0);
  return c ? c.toLocaleUpperCase('pt-BR') : 'V';
}

// ---------- foto ----------

const LADO_FOTO = 256;

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error('Não deu para abrir essa imagem.'));
    img.src = src;
  });
}

/** Recorta o quadrado do centro e reduz para 256px; devolve um JPEG em data URL. */
async function quadradoJpeg(src: string): Promise<string> {
  const img = await carregarImagem(src);
  const lado = Math.min(img.naturalWidth, img.naturalHeight);
  if (!lado) throw new Error('Imagem vazia.');
  const sx = (img.naturalWidth - lado) / 2;
  const sy = (img.naturalHeight - lado) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = LADO_FOTO;
  canvas.height = LADO_FOTO;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Sem canvas.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);
  return canvas.toDataURL('image/jpeg', 0.85);
}

/** Foto escolhida no computador: lida aqui mesmo, sem enviar para lugar nenhum. */
export async function fotoDeArquivo(arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  const url = URL.createObjectURL(arquivo);
  try {
    return await quadradoJpeg(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Baixa a foto do GitHub e guarda uma cópia local (256px). Se não der, usa o endereço. */
export async function fotoDoGitHub(avatarUrl: string): Promise<string> {
  try {
    const r = await fetch(avatarUrl);
    if (!r.ok) throw new Error(String(r.status));
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    try {
      return await quadradoJpeg(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return avatarUrl;
  }
}

// ---------- GitHub ----------

const LOGIN_VALIDO = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/**
 * Busca o perfil público (sem login). Só roda quando a pessoa clica em Buscar.
 * Usa a API pública: https://api.github.com/users/<login>.
 */
export async function buscarPerfilGitHub(login: string): Promise<PerfilGitHub> {
  const l = login.trim().replace(/^@/, '');
  if (!LOGIN_VALIDO.test(l)) throw new Error('Esse usuário não parece válido no GitHub.');
  let r: Response;
  try {
    r = await fetch(`https://api.github.com/users/${encodeURIComponent(l)}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
  } catch {
    throw new Error('Sem conexão com o GitHub agora.');
  }
  if (r.status === 404) throw new Error(`Não achei "${l}" no GitHub.`);
  if (r.status === 403 || r.status === 429) throw new Error('O GitHub pediu uma pausa. Tente de novo em alguns minutos.');
  if (!r.ok) throw new Error(`O GitHub respondeu ${r.status}.`);
  const d = await r.json();
  return { login: String(d.login ?? l), nome: String(d.name ?? '') || String(d.login ?? l), avatarUrl: String(d.avatar_url ?? '') };
}

/**
 * Login de verdade com o GitHub (fluxo de dispositivo do OAuth).
 * TODO: registrar o app OAuth do Hypercube, pedir o código em
 * https://github.com/login/device/code (client_id, scope "read:user"), mostrar o
 * user_code e o link https://github.com/login/device, e consultar
 * https://github.com/login/oauth/access_token até a pessoa autorizar. O token deve
 * ficar no cofre do sistema (lado Tauri), nunca no localStorage. Precisa liberar
 * github.com e api.github.com no connect-src do CSP do Tauri.
 */
export async function entrarComGitHub(): Promise<PerfilGitHub> {
  throw new Error('O login completo com o GitHub vem numa próxima versão.');
}
