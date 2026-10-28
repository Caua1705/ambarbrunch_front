// Consultas com cache compartilhado entre componentes da mesma página: mostra o último dado na hora e revalida em segundo
// plano; depois de uma ação, `invalidar('reservas')` recarrega tudo o que começa com esse prefixo. Sem polling global:
// só quem pede `intervalo` (ex.: compra sendo lida) consulta de novo sozinho.
import { useEffect, useReducer, useRef, useCallback } from 'preact/hooks';
import { ErroApi } from './api/cliente';

interface Entrada {
  dados?: unknown;
  erro?: ErroApi;
  em: number;
  promessa?: Promise<void>;
}

const cache = new Map<string, Entrada>();
const ouvintes = new Map<string, Set<() => void>>();
const VELHO_MS = 30_000;

function avisar(chave: string) {
  ouvintes.get(chave)?.forEach((f) => f());
}

function buscar(chave: string, fn: () => Promise<unknown>) {
  const atual = cache.get(chave) ?? { em: 0 };
  if (atual.promessa) return atual.promessa;
  const promessa = fn()
    .then((dados) => {
      cache.set(chave, { dados, em: Date.now() });
    })
    .catch((e: unknown) => {
      const erro = e instanceof ErroApi ? e : new ErroApi('servidor', 'Erro inesperado ao carregar.');
      // mantém o dado anterior visível; o erro aparece junto
      cache.set(chave, { dados: atual.dados, erro, em: Date.now() });
    })
    .finally(() => avisar(chave));
  cache.set(chave, { ...atual, promessa });
  avisar(chave);
  return promessa;
}

export function invalidar(...prefixos: string[]) {
  for (const chave of [...cache.keys()]) {
    if (prefixos.some((p) => chave === p || chave.startsWith(`${p}:`) || chave.startsWith(`${p}?`) || chave.startsWith(`${p}/`))) {
      const e = cache.get(chave)!;
      cache.set(chave, { ...e, em: 0 });
      avisar(chave);
    }
  }
}

export interface Consulta<T> {
  dados: T | undefined;
  erro: ErroApi | undefined;
  /** Primeira carga, sem nada para mostrar ainda. */
  carregando: boolean;
  /** Revalidando com dado já na tela. */
  atualizando: boolean;
  recarregar: () => void;
}

/** `chave` null = não consultar (ex.: drawer fechado, ou sem permissão). */
export function useConsulta<T>(chave: string | null, fn: () => Promise<T>, opcoes: { intervalo?: number } = {}): Consulta<T> {
  const [, forcar] = useReducer((n: number) => n + 1, 0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!chave) return;
    let set = ouvintes.get(chave);
    if (!set) ouvintes.set(chave, (set = new Set()));
    const ouvir = () => {
      const e = cache.get(chave);
      if (e && e.em === 0 && !e.promessa) buscar(chave, () => fnRef.current());
      forcar(0);
    };
    set.add(ouvir);
    const e = cache.get(chave);
    if (!e || Date.now() - e.em > VELHO_MS) buscar(chave, () => fnRef.current());
    else forcar(0);
    const aoFocar = () => {
      const x = cache.get(chave);
      if (document.visibilityState === 'visible' && x && Date.now() - x.em > VELHO_MS * 2) buscar(chave, () => fnRef.current());
    };
    document.addEventListener('visibilitychange', aoFocar);
    let timer: number | undefined;
    if (opcoes.intervalo) timer = window.setInterval(() => document.visibilityState === 'visible' && buscar(chave, () => fnRef.current()), opcoes.intervalo);
    return () => {
      set!.delete(ouvir);
      document.removeEventListener('visibilitychange', aoFocar);
      if (timer) clearInterval(timer);
    };
  }, [chave, opcoes.intervalo]);

  const recarregar = useCallback(() => {
    if (chave) buscar(chave, () => fnRef.current());
  }, [chave]);

  const e = chave ? cache.get(chave) : undefined;
  return {
    dados: e?.dados as T | undefined,
    erro: e?.erro,
    carregando: !!chave && e?.dados === undefined && !e?.erro,
    atualizando: !!e?.promessa && e.dados !== undefined,
    recarregar,
  };
}
