// Gráficos em SVG puro (linhas e barras), sem biblioteca: leves, com as cores do tema e dica ao passar o mouse/tocar.
// Só para responder perguntas operacionais (evolução, comparação). Valores nulos não viram zero: a linha é interrompida.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/** Largura real do gráfico: o desenho usa pixels de verdade, então o texto dos eixos fica legível no celular. */
function useLargura() {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(280, Math.round(el.clientWidth)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura] as const;
}

export interface Serie {
  nome: string;
  cor: string;
  valores: (number | null)[];
  tracejada?: boolean;
}

function escala(max: number) {
  if (max <= 0) return { max: 1, passos: [0, 1] };
  const bruto = max / 4;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? bruto;
  const topo = Math.ceil(max / passo) * passo;
  const passos: number[] = [];
  for (let v = 0; v <= topo + 1e-9; v += passo) passos.push(v);
  return { max: topo, passos };
}

const curta = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }));

export function GraficoLinhas({ rotulos, series, formatar, altura = 240, rotulo }: { rotulos: string[]; series: Serie[]; formatar: (v: number) => string; altura?: number; rotulo: string }) {
  const [caixa, L] = useLargura();
  const M = { e: 52, d: 12, t: 12, b: 28 };
  const [foco, setFoco] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const todos = series.flatMap((s) => s.valores.filter((v): v is number => v !== null));
  const { max, passos } = useMemo(() => escala(Math.max(0, ...todos)), [todos.join(',')]);
  const n = rotulos.length;
  const x = (i: number) => M.e + (n <= 1 ? (L - M.e - M.d) / 2 : (i * (L - M.e - M.d)) / (n - 1));
  const y = (v: number) => M.t + (altura - M.t - M.b) * (1 - v / max);

  const caminho = (vals: (number | null)[]) => {
    let d = '';
    let solto = true;
    vals.forEach((v, i) => {
      if (v === null) {
        solto = true;
        return;
      }
      d += `${solto ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      solto = false;
    });
    return d;
  };

  const mover = (e: PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((e.clientX - r.left) / r.width) * L;
    const i = Math.round(((px - M.e) / (L - M.e - M.d)) * (n - 1));
    setFoco(Math.max(0, Math.min(n - 1, i)));
  };
  const passoRotulo = Math.ceil(n / Math.max(3, Math.floor(L / 80)));

  return (
    <div class="grafico" ref={caixa}>
      <svg ref={ref} viewBox={`0 0 ${L} ${altura}`} role="img" aria-label={rotulo} onPointerMove={mover} onPointerLeave={() => setFoco(null)}>
        {passos.map((p) => (
          <g key={p}>
            <line class="grade" x1={M.e} x2={L - M.d} y1={y(p)} y2={y(p)} />
            <text x={M.e - 8} y={y(p) + 4} text-anchor="end">{curta(p)}</text>
          </g>
        ))}
        {rotulos.map((r, i) => (i % passoRotulo === 0 || i === n - 1 ? <text key={i} x={x(i)} y={altura - 8} text-anchor="middle">{r}</text> : null))}
        {series.map((s) => (
          <path key={s.nome} d={caminho(s.valores)} fill="none" stroke={s.cor} stroke-width={s.tracejada ? 1.75 : 2.25} stroke-dasharray={s.tracejada ? '5 4' : undefined} stroke-linejoin="round" stroke-linecap="round" />
        ))}
        {foco !== null && (
          <>
            <line x1={x(foco)} x2={x(foco)} y1={M.t} y2={altura - M.b} stroke="var(--borda-forte)" />
            {series.map((s) => (s.valores[foco] !== null ? <circle key={s.nome} cx={x(foco)} cy={y(s.valores[foco]!)} r={4} fill="var(--superficie)" stroke={s.cor} stroke-width={2} /> : null))}
          </>
        )}
      </svg>
      {foco !== null && (
        <div class="grafico__dica" style={{ left: `${(x(foco) / L) * 100}%`, top: '18%' }}>
          <strong>{rotulos[foco]}</strong>
          {series.map((s) => (
            <div key={s.nome} class="linha" style={{ justifyContent: 'space-between', gap: '12px' }}>
              <span class="fraco">{s.nome}</span>
              <span class="num forte">{s.valores[foco] === null ? '—' : formatar(s.valores[foco]!)}</span>
            </div>
          ))}
        </div>
      )}
      {/* Mesmos números em tabela para leitores de tela */}
      <div class="sr">
      <table>
        <caption>{rotulo}</caption>
        <thead>
          <tr>
            <th>Período</th>
            {series.map((s) => <th key={s.nome}>{s.nome}</th>)}
          </tr>
        </thead>
        <tbody>
          {rotulos.map((r, i) => (
            <tr key={i}>
              <th>{r}</th>
              {series.map((s) => <td key={s.nome}>{s.valores[i] === null ? 'sem dado' : formatar(s.valores[i]!)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

/** Barras agrupadas (ex.: receitas × despesas por mês). */
export function GraficoBarras({ rotulos, series, formatar, altura = 240, rotulo }: { rotulos: string[]; series: Serie[]; formatar: (v: number) => string; altura?: number; rotulo: string }) {
  const [caixa, L] = useLargura();
  const M = { e: 52, d: 8, t: 12, b: 28 };
  const [foco, setFoco] = useState<number | null>(null);
  const todos = series.flatMap((s) => s.valores.filter((v): v is number => v !== null));
  const { max, passos } = escala(Math.max(0, ...todos));
  const n = rotulos.length;
  const grupo = (L - M.e - M.d) / Math.max(1, n);
  const largura = Math.min(28, (grupo * 0.7) / series.length);
  const y = (v: number) => M.t + (altura - M.t - M.b) * (1 - v / max);
  const passoRotulo = Math.ceil(n / Math.max(3, Math.floor(L / 56)));
  return (
    <div class="grafico" ref={caixa}>
      <svg viewBox={`0 0 ${L} ${altura}`} role="img" aria-label={rotulo} onPointerLeave={() => setFoco(null)}>
        {passos.map((p) => (
          <g key={p}>
            <line class="grade" x1={M.e} x2={L - M.d} y1={y(p)} y2={y(p)} />
            <text x={M.e - 8} y={y(p) + 4} text-anchor="end">{curta(p)}</text>
          </g>
        ))}
        {rotulos.map((r, i) => {
          const cx = M.e + grupo * i + grupo / 2;
          return (
            <g key={i} onPointerEnter={() => setFoco(i)}>
              <rect x={M.e + grupo * i} y={M.t} width={grupo} height={altura - M.t - M.b} fill={foco === i ? 'var(--sobre-hover)' : 'transparent'} />
              {series.map((s, j) => {
                const v = s.valores[i];
                if (v === null) return null;
                const bx = cx - (largura * series.length) / 2 + j * largura + 1;
                return <rect key={s.nome} x={bx} y={y(v)} width={largura - 2} height={Math.max(0, y(0) - y(v))} rx={3} fill={s.cor} />;
              })}
              {(i % passoRotulo === 0 || i === n - 1) && <text x={cx} y={altura - 8} text-anchor="middle">{r}</text>}
            </g>
          );
        })}
      </svg>
      {foco !== null && (
        <div class="grafico__dica" style={{ left: `${((M.e + grupo * foco + grupo / 2) / L) * 100}%`, top: '18%' }}>
          <strong>{rotulos[foco]}</strong>
          {series.map((s) => (
            <div key={s.nome} class="linha" style={{ justifyContent: 'space-between', gap: '12px' }}>
              <span class="fraco">{s.nome}</span>
              <span class="num forte">{s.valores[foco] === null ? '—' : formatar(s.valores[foco]!)}</span>
            </div>
          ))}
        </div>
      )}
      <div class="sr">
      <table>
        <caption>{rotulo}</caption>
        <tbody>
          {rotulos.map((r, i) => (
            <tr key={i}>
              <th>{r}</th>
              {series.map((s) => <td key={s.nome}>{s.nome}: {s.valores[i] === null ? 'sem dado' : formatar(s.valores[i]!)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export function Legenda({ series }: { series: Pick<Serie, 'nome' | 'cor' | 'tracejada'>[] }) {
  return (
    <div class="legenda">
      {series.map((s) => (
        <span key={s.nome}>
          <i class={s.tracejada ? 'tracejado' : undefined} style={{ '--c': s.cor }} aria-hidden="true" />
          {s.nome}
        </span>
      ))}
    </div>
  );
}

/** Barra horizontal de participação (ex.: despesas por categoria). */
export function BarraParte({ valor, total, cor }: { valor: number; total: number; cor?: string }) {
  const p = total > 0 ? Math.max(0, Math.min(100, (valor / total) * 100)) : 0;
  return (
    <div class="barra-progresso" role="presentation">
      <i style={{ width: `${p}%`, '--c': cor ?? 'var(--grafico-1)' }} />
    </div>
  );
}
