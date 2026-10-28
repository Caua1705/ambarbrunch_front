// Tabela de dados: ordenação por coluna (clique ou Enter), linha clicável que abre o detalhe, colunas com prioridade
// (as de prioridade baixa/média somem no celular) e paginação simples no cliente.
import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-preact';
import { Botao } from './base';

export interface Coluna<T> {
  id: string;
  titulo: string;
  celula: (l: T) => ComponentChildren;
  /** Valor para ordenar; sem ele a coluna não ordena. */
  ordenar?: (l: T) => string | number | null;
  numero?: boolean;
  prioridade?: 'alta' | 'media' | 'baixa';
  largura?: string;
  oculta?: boolean;
}

export function Tabela<T>({ colunas, linhas, chave, aoAbrir, destaque, apagada, rotulo, porPagina = 50, ordemInicial, vazio }: {
  colunas: Coluna<T>[];
  linhas: T[];
  chave: (l: T) => string;
  aoAbrir?: (l: T) => void;
  destaque?: (l: T) => boolean;
  apagada?: (l: T) => boolean;
  rotulo: string;
  porPagina?: number;
  ordemInicial?: { coluna: string; desc?: boolean };
  vazio?: ComponentChildren;
}) {
  const [ordem, setOrdem] = useState(ordemInicial ?? null);
  const [pagina, setPagina] = useState(0);
  const visiveis = colunas.filter((c) => !c.oculta);

  const ordenadas = useMemo(() => {
    const col = ordem && colunas.find((c) => c.id === ordem.coluna);
    if (!col?.ordenar) return linhas;
    const f = col.ordenar;
    return [...linhas].sort((a, b) => {
      const x = f(a);
      const y = f(b);
      if (x === y) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR');
      return ordem!.desc ? -r : r;
    });
  }, [linhas, ordem, colunas]);

  const paginas = Math.max(1, Math.ceil(ordenadas.length / porPagina));
  const p = Math.min(pagina, paginas - 1);
  const fatia = ordenadas.slice(p * porPagina, (p + 1) * porPagina);

  if (!linhas.length && vazio) return <>{vazio}</>;

  return (
    <>
      <div class="tabela-rolagem">
        <table class="tabela" aria-label={rotulo}>
          <thead>
            <tr>
              {visiveis.map((c) => {
                const ativa = ordem?.coluna === c.id;
                return (
                  <th key={c.id} scope="col" class={c.numero ? 'num' : undefined} data-prioridade={c.prioridade} style={c.largura ? { width: c.largura } : undefined} aria-sort={ativa ? (ordem!.desc ? 'descending' : 'ascending') : undefined}>
                    {c.ordenar ? (
                      <button onClick={() => setOrdem({ coluna: c.id, desc: ativa ? !ordem!.desc : false })}>
                        {c.titulo}
                        {ativa ? ordem!.desc ? <ArrowDown aria-hidden="true" /> : <ArrowUp aria-hidden="true" /> : <ChevronsUpDown aria-hidden="true" style={{ opacity: 0.5 }} />}
                      </button>
                    ) : (
                      c.titulo
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {fatia.map((l) => (
              <tr
                key={chave(l)}
                data-clicavel={aoAbrir ? '' : undefined}
                data-destaque={destaque?.(l) ? '' : undefined}
                data-apagado={apagada?.(l) ? '' : undefined}
                onClick={aoAbrir ? (e) => {
                  if ((e.target as HTMLElement).closest('button,a,input,select,label')) return;
                  aoAbrir(l);
                } : undefined}
                tabIndex={aoAbrir ? 0 : undefined}
                onKeyDown={aoAbrir ? (e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                    e.preventDefault();
                    aoAbrir(l);
                  }
                } : undefined}
              >
                {visiveis.map((c) => (
                  <td key={c.id} class={c.numero ? 'num' : c.id === 'acoes' ? 'celula-acoes' : undefined} data-prioridade={c.prioridade}>
                    {c.celula(l)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginas > 1 && (
        <div class="paginacao">
          <span>
            {p * porPagina + 1}–{Math.min((p + 1) * porPagina, ordenadas.length)} de {ordenadas.length}
          </span>
          <div class="linha">
            <Botao tamanho="p" so_icone aria-label="Página anterior" disabled={p === 0} onClick={() => setPagina(p - 1)} icone={<ChevronLeft aria-hidden="true" />} />
            <Botao tamanho="p" so_icone aria-label="Próxima página" disabled={p >= paginas - 1} onClick={() => setPagina(p + 1)} icone={<ChevronRight aria-hidden="true" />} />
          </div>
        </div>
      )}
    </>
  );
}
