/** @jsxImportSource preact */
import { useRef } from 'preact/hooks';
import type { JSX } from 'preact';

/** Grupo de chips com papel de radiogroup e setas do teclado. `ocupado`: a lista está sendo atualizada — fica à vista,
 *  apagada e inerte (sem toque, teclado nem foco), no lugar de sumir. */
export function Escolha<T extends string>(p: { rotulo: string; id: string; opcoes: { valor: T; texto: JSX.Element | string; desabilitado?: boolean }[]; valor: T | null; aoEscolher: (v: T) => void; datas?: boolean; ocupado?: boolean }) {
  const grupo = useRef<HTMLDivElement>(null);
  const ativos = p.opcoes.filter((o) => !o.desabilitado);
  const aoTeclar = (ev: KeyboardEvent) => {
    const passo = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
    if (!passo || !ativos.length || p.ocupado) return;
    ev.preventDefault();
    const i = Math.max(0, ativos.findIndex((o) => o.valor === p.valor));
    const prox = ativos[(i + passo + ativos.length) % ativos.length];
    p.aoEscolher(prox.valor);
    requestAnimationFrame(() => grupo.current?.querySelector<HTMLElement>(`[data-valor="${prox.valor}"]`)?.focus());
  };
  return (
    <div ref={grupo} class={`chips${p.datas ? ' chips--dates' : ''}`} role="radiogroup" aria-labelledby={p.id} onKeyDown={aoTeclar}
      aria-busy={p.ocupado || undefined} inert={p.ocupado || undefined}>
      {p.opcoes.map((o) => {
        const marcado = o.valor === p.valor;
        const foco = marcado || (!p.valor && o === ativos[0]);
        return (
          <button type="button" class="chip" role="radio" aria-checked={marcado} data-valor={o.valor}
            tabIndex={foco ? 0 : -1} disabled={o.desabilitado} onClick={() => { if (!p.ocupado) p.aoEscolher(o.valor); }}>{o.texto}</button>
        );
      })}
    </div>
  );
}
