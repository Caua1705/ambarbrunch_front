// Componentes básicos do design system do painel: botão, campos, situação, indicador, abas e segmentado.
import type { ComponentChildren, ButtonHTMLAttributes } from 'preact';
import { useId } from 'preact/hooks';
import { LoaderCircle, AlertCircle, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-preact';

type BotaoProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'icon'> & {
  variante?: 'primario' | 'secundario' | 'fantasma' | 'perigo';
  tamanho?: 'p' | 'm';
  icone?: ComponentChildren;
  so_icone?: boolean;
  carregando?: boolean;
  bloco?: boolean;
  type?: 'button' | 'submit';
  disabled?: boolean;
};

export function Botao({ variante = 'secundario', tamanho = 'm', icone, so_icone, carregando, bloco, children, class: cls, type = 'button', disabled, ...resto }: BotaoProps) {
  const classes = ['btn', variante !== 'secundario' && `btn--${variante}`, tamanho === 'p' && 'btn--p', so_icone && 'btn--icone', bloco && 'btn--bloco', cls].filter(Boolean).join(' ');
  return (
    <button type={type} class={classes} disabled={disabled || carregando} aria-busy={carregando || undefined} {...resto}>
      {carregando ? <LoaderCircle class="girando" aria-hidden="true" /> : icone}
      {children}
    </button>
  );
}

export function Campo({ rotulo, opcional, ajuda, erro, children, class: cls, id }: { rotulo: string; opcional?: boolean; ajuda?: string; erro?: string | null; children: (id: string, descr: string | undefined) => ComponentChildren; class?: string; id?: string }) {
  const gerado = useId();
  const cid = id ?? gerado;
  const descr = erro ? `${cid}-erro` : ajuda ? `${cid}-ajuda` : undefined;
  return (
    <div class={`campo ${cls ?? ''}`}>
      <label class="campo__rotulo" for={cid}>
        {rotulo} {opcional && <em>(opcional)</em>}
      </label>
      {children(cid, descr)}
      {erro ? (
        <span class="campo__erro" id={`${cid}-erro`} role="alert">
          <AlertCircle size={13} aria-hidden="true" /> {erro}
        </span>
      ) : ajuda ? (
        <span class="campo__ajuda" id={`${cid}-ajuda`}>
          {ajuda}
        </span>
      ) : null}
    </div>
  );
}

export type Tom = 'ok' | 'atencao' | 'perigo' | 'info' | 'marca' | 'apagado' | 'neutro';

export function Situacao({ tom = 'neutro', destaque, children }: { tom?: Tom; destaque?: boolean; children: ComponentChildren }) {
  return <span class={`situacao situacao--${tom}${destaque ? ' situacao--destaque' : ''}`}>{children}</span>;
}

export function Etiqueta({ tom = 'neutro', children, icone }: { tom?: Tom; children: ComponentChildren; icone?: ComponentChildren }) {
  return (
    <span class={`etiqueta${tom !== 'neutro' ? ` etiqueta--${tom}` : ''}`}>
      {icone}
      {children}
    </span>
  );
}

export function Variacao({ atual, anterior, inverter }: { atual: number | null; anterior: number | null; inverter?: boolean }) {
  if (atual === null || anterior === null || anterior === 0) return null;
  const v = ((atual - anterior) / Math.abs(anterior)) * 100;
  const sobe = v > 0.5;
  const desce = v < -0.5;
  const bom = inverter ? desce : sobe;
  const ruim = inverter ? sobe : desce;
  const Icone = sobe ? ArrowUpRight : desce ? ArrowDownRight : Minus;
  return (
    <span class={`variacao ${bom ? 'variacao--alta' : ruim ? 'variacao--baixa' : 'variacao--neutra'}`}>
      <Icone size={13} aria-hidden="true" />
      <span class="sr">{sobe ? 'alta de' : desce ? 'queda de' : 'estável,'}</span>
      {Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
    </span>
  );
}

export function Indicador({ rotulo, icone, valor, rodape, href, medio, carregando }: { rotulo: string; icone?: ComponentChildren; valor: ComponentChildren; rodape?: ComponentChildren; href?: string; medio?: boolean; carregando?: boolean }) {
  const corpo = (
    <>
      <span class="indicador__rotulo">
        {icone}
        {rotulo}
      </span>
      {carregando ? <span class="esqueleto" style={{ height: '34px', width: '60%' }} /> : <span class={`indicador__valor${medio ? ' indicador__valor--m' : ''}`}>{valor}</span>}
      {rodape && !carregando && <span class="indicador__rodape">{rodape}</span>}
    </>
  );
  return href ? (
    <a class="cartao indicador" href={href}>
      {corpo}
    </a>
  ) : (
    <div class="cartao indicador">{corpo}</div>
  );
}

export function Segmentado<T extends string>({ opcoes, valor, aoMudar, rotulo }: { opcoes: { valor: T; rotulo: ComponentChildren }[]; valor: T; aoMudar: (v: T) => void; rotulo: string }) {
  return (
    <div class="segmentado" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button type="button" aria-pressed={o.valor === valor} onClick={() => aoMudar(o.valor)} key={o.valor}>
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Abas do módulo (Financeiro e Estoque): o estado vive na URL (?aba=), então voltar/avançar e links funcionam. */
export function Abas<T extends string>({ abas, atual, aoMudar }: { abas: { id: T; rotulo: string; contagem?: number | null }[]; atual: T; aoMudar: (id: T) => void }) {
  return (
    <div class="abas" role="tablist" aria-label="Seções">
      {abas.map((a) => (
        <button
          key={a.id}
          role="tab"
          id={`aba-${a.id}`}
          aria-selected={a.id === atual}
          aria-controls={`painel-${a.id}`}
          onClick={() => aoMudar(a.id)}
          onKeyDown={(e) => {
            const i = abas.findIndex((x) => x.id === atual);
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              const prox = abas[(i + (e.key === 'ArrowRight' ? 1 : abas.length - 1)) % abas.length];
              aoMudar(prox.id);
              requestAnimationFrame(() => document.getElementById(`aba-${prox.id}`)?.focus());
            }
          }}
          tabIndex={a.id === atual ? 0 : -1}
        >
          {a.rotulo}
          {a.contagem ? <span class="nav__conta">{a.contagem}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Cartao({ titulo, descricao, acoes, children, justo, rodape, class: cls, id }: { titulo?: ComponentChildren; descricao?: ComponentChildren; acoes?: ComponentChildren; children: ComponentChildren; justo?: boolean; rodape?: ComponentChildren; class?: string; id?: string }) {
  return (
    <section class={`cartao ${cls ?? ''}`} id={id} aria-label={typeof titulo === 'string' ? titulo : undefined}>
      {(titulo || acoes) && (
        <div class="cartao__topo">
          <div>
            {titulo && <h2>{titulo}</h2>}
            {descricao && <p>{descricao}</p>}
          </div>
          {acoes && <div class="empurra linha">{acoes}</div>}
        </div>
      )}
      <div class={`cartao__corpo${justo ? ' cartao__corpo--justo' : ''}`}>{children}</div>
      {rodape && <div class="cartao__rodape">{rodape}</div>}
    </section>
  );
}

export function Cabecalho({ titulo, descricao, acoes }: { titulo: string; descricao?: ComponentChildren; acoes?: ComponentChildren }) {
  return (
    <header class="cabecalho">
      <div>
        <h2>{titulo}</h2>
        {descricao && <p>{descricao}</p>}
      </div>
      {acoes && <div class="cabecalho__acoes">{acoes}</div>}
    </header>
  );
}

export function Aviso({ tom = 'info', icone, children }: { tom?: 'info' | 'atencao' | 'perigo' | 'ok'; icone?: ComponentChildren; children: ComponentChildren }) {
  return (
    <div class={`aviso aviso--${tom}`} role={tom === 'perigo' ? 'alert' : undefined}>
      {icone}
      <div>{children}</div>
    </div>
  );
}
