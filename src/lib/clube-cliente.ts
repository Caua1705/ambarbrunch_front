// Peças comuns às ilhas do Clube (acesso e área do membro): o cliente da API, os endereços do Clube, o destino de volta
// depois do login (lista fechada — nunca um endereço vindo da URL) e a passagem do desafio da landing para /clube/entrar.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { criarAcessoHttp, type AcessoClubeApi, type DesafioAcesso } from './api/clube-acesso';
import type { ModoClube } from './clube-modo';

/** endereços do Clube (com a barra final: o build estático gera pasta/index.html) */
export const ROTAS = {
  landing: '/clube/',
  entrar: '/clube/entrar/',
  cadastro: '/clube/cadastro/',
  ativar: '/clube/ativar/',
  conta: '/clube/conta/',
  historico: '/clube/historico/',
  recompensas: '/clube/recompensas/',
} as const;

/** destinos aceitos em `?volta=` — o login nunca redireciona para fora desta lista */
const VOLTAS = { conta: ROTAS.conta, historico: ROTAS.historico, recompensas: ROTAS.recompensas } as const;
export type Volta = keyof typeof VOLTAS;
export const destinoSeguro = (v: string | null | undefined): string => (v && v in VOLTAS ? VOLTAS[v as Volta] : ROTAS.conta);
/** /clube/entrar/ com o destino (e o motivo, quando a sessão venceu no meio do uso) */
export const urlEntrar = (volta?: Volta, motivo?: 'sessao') => {
  const q = new URLSearchParams();
  if (volta && volta !== 'conta') q.set('volta', volta);
  if (motivo) q.set('motivo', motivo);
  return `${ROTAS.entrar}${q.size ? `?${q}` : ''}`;
};

/** API do Clube conforme o modo: a real, a simulação local (só no `astro dev`, carregada sob demanda) ou nenhuma */
export function useApiClube(modo: ModoClube, apiUrl?: string, desligada = false): AcessoClubeApi | null {
  const real = useMemo(() => (!desligada && modo === 'api' && apiUrl ? criarAcessoHttp(apiUrl) : null), [modo, apiUrl]);
  const [api, setApi] = useState<AcessoClubeApi | null>(real);
  useEffect(() => {
    if (import.meta.env.DEV && !desligada && modo === 'simulado') import('./api/clube-simulado').then((m) => setApi(m.criarAcessoSimulado()));
  }, []);
  return api;
}

// Passagem da landing para /clube/entrar: a landing pede o código e leva o desafio (id, destino mascarado, prazos) para
// a tela do código — a pessoa não digita o número de novo. Fica na sessionStorage desta aba por instantes e é apagado
// ao ler. Não é credencial: sem o código que chegou no WhatsApp, o desafio não abre nada. O número digitado NÃO vai junto.
const CHAVE_DESAFIO = 'ambar:clube:desafio';
interface DesafioGuardado { desafio: DesafioAcesso; reenvioAte: number; envios: number }

export function levarDesafio(desafio: DesafioAcesso, envios: number) {
  try { sessionStorage.setItem(CHAVE_DESAFIO, JSON.stringify({ desafio, reenvioAte: Date.now() + desafio.reenvioEm * 1000, envios } satisfies DesafioGuardado)); }
  catch { /* sem armazenamento: /clube/entrar pede o número de novo */ }
}
/** o desafio trazido da landing, se ainda vale (lido uma vez só) */
export function trazerDesafio(): { desafio: DesafioAcesso; envios: number } | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_DESAFIO);
    sessionStorage.removeItem(CHAVE_DESAFIO);
    if (!bruto) return null;
    const g = JSON.parse(bruto) as DesafioGuardado;
    if (!g?.desafio?.desafioId || Date.parse(g.desafio.expiraEm) <= Date.now()) return null;
    return { desafio: { ...g.desafio, reenvioEm: Math.max(0, Math.ceil((g.reenvioAte - Date.now()) / 1000)) }, envios: g.envios };
  } catch { return null; }
}

export const primeiroNome = (n: string) => n.trim().split(/\s+/)[0];
