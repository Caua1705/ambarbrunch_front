// Camadas sobre a página: gaveta (drawer), diálogo, confirmação de ação, menu suspenso e avisos rápidos (toast).
// Foco preso dentro da camada, Esc fecha, o foco volta para quem abriu e a página por trás não rola.
import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState, useId, useCallback } from 'preact/hooks';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-preact';
import { Botao, Campo } from './base';
import { ErroApi } from '../lib/api/cliente';

const FOCAVEIS = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let abertas = 0;

function useCamada(aberta: boolean, aoFechar: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const fecharRef = useRef(aoFechar);
  fecharRef.current = aoFechar;
  useEffect(() => {
    if (!aberta) return;
    const anterior = document.activeElement as HTMLElement | null;
    abertas++;
    document.documentElement.style.overflow = 'hidden';
    const el = ref.current;
    requestAnimationFrame(() => {
      const alvo = el?.querySelector<HTMLElement>('[data-autofoco]') ?? el?.querySelector<HTMLElement>(FOCAVEIS);
      (alvo ?? el)?.focus();
    });
    const tecla = (e: KeyboardEvent) => {
      if (!el || !el.contains(document.activeElement) && document.activeElement !== document.body) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        fecharRef.current();
      }
      if (e.key === 'Tab') {
        const f = [...el.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const primeiro = f[0];
        const ultimo = f[f.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    };
    document.addEventListener('keydown', tecla, true);
    return () => {
      document.removeEventListener('keydown', tecla, true);
      abertas--;
      if (!abertas) document.documentElement.style.overflow = '';
      anterior?.focus?.();
    };
  }, [aberta]);
  return ref;
}

export function Gaveta({ aberta, aoFechar, titulo, subtitulo, children, rodape, largura = 'normal', acoesTopo }: { aberta: boolean; aoFechar: () => void; titulo: ComponentChildren; subtitulo?: ComponentChildren; children: ComponentChildren; rodape?: ComponentChildren; largura?: 'normal' | 'media' | 'larga'; acoesTopo?: ComponentChildren }) {
  const ref = useCamada(aberta, aoFechar);
  const id = useId();
  if (!aberta) return null;
  return createPortal(
    <>
      <div class="veu" onClick={aoFechar} aria-hidden="true" />
      <div ref={ref} class={`gaveta${largura !== 'normal' ? ` gaveta--${largura}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <div class="gaveta__topo">
          <div style={{ minWidth: 0 }}>
            <h2 id={id}>{titulo}</h2>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          <div class="gaveta__fechar linha">
            {acoesTopo}
            <Botao variante="fantasma" so_icone onClick={aoFechar} aria-label="Fechar" icone={<X aria-hidden="true" />} />
          </div>
        </div>
        <div class="gaveta__corpo">{children}</div>
        {rodape && <div class="gaveta__rodape">{rodape}</div>}
      </div>
    </>,
    document.body,
  );
}

export function Dialogo({ aberto, aoFechar, titulo, children, acoes, alerta }: { aberto: boolean; aoFechar: () => void; titulo: string; children?: ComponentChildren; acoes: ComponentChildren; alerta?: boolean }) {
  const ref = useCamada(aberto, aoFechar);
  const id = useId();
  if (!aberto) return null;
  return createPortal(
    <>
      <div class="veu veu--dialogo" onClick={aoFechar} aria-hidden="true" />
      <div ref={ref} class="dialogo" role={alerta ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <div class="dialogo__corpo">
          <h2 id={id}>{titulo}</h2>
          {children}
        </div>
        <div class="dialogo__acoes">{acoes}</div>
      </div>
    </>,
    document.body,
  );
}

export interface PedidoConfirmacao {
  titulo: string;
  texto?: ComponentChildren;
  confirmar: string;
  perigo?: boolean;
  /** Pede uma justificativa (ex.: 5–300 caracteres, como o backend exige). */
  motivo?: { rotulo: string; minimo?: number; maximo?: number; ajuda?: string; obrigatorio?: boolean };
  acao: (motivo: string) => Promise<unknown>;
  /** Mensagem do aviso de sucesso. */
  sucesso?: string;
}

/** Confirmação de ação: botão fica ocupado durante o envio (sem duplo clique) e o erro aparece no próprio diálogo. */
export function useConfirmacao() {
  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const confirmar = useCallback((p: PedidoConfirmacao) => {
    setPedido(p);
    setMotivo('');
    setErro(null);
  }, []);
  const fechar = () => !enviando && setPedido(null);
  const m = pedido?.motivo;
  const minimo = m ? (m.obrigatorio === false ? 0 : m.minimo ?? 5) : 0;
  const invalido = !!m && motivo.trim().length < minimo;
  const executar = async () => {
    if (!pedido || invalido) return;
    setEnviando(true);
    setErro(null);
    try {
      await pedido.acao(motivo.trim());
      if (pedido.sucesso) avisar(pedido.sucesso, 'ok');
      setPedido(null);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível concluir.');
    } finally {
      setEnviando(false);
    }
  };
  const elemento = (
    <Dialogo
      aberto={!!pedido}
      aoFechar={fechar}
      titulo={pedido?.titulo ?? ''}
      alerta={pedido?.perigo}
      acoes={
        <>
          <Botao onClick={fechar} disabled={enviando}>Voltar</Botao>
          <Botao variante={pedido?.perigo ? 'perigo' : 'primario'} onClick={executar} carregando={enviando} disabled={invalido} data-autofoco={m ? undefined : true}>
            {pedido?.confirmar}
          </Botao>
        </>
      }
    >
      {pedido?.texto && <p>{pedido.texto}</p>}
      {m && (
        <Campo rotulo={m.rotulo} ajuda={m.ajuda ?? (minimo ? `Pelo menos ${minimo} caracteres. Fica registrado no histórico.` : undefined)}>
          {(id, descr) => (
            <textarea id={id} class="area" aria-describedby={descr} maxLength={m.maximo ?? 300} value={motivo} onInput={(e) => setMotivo(e.currentTarget.value)} data-autofoco />
          )}
        </Campo>
      )}
      {erro && (
        <div class="aviso aviso--perigo" role="alert">
          <AlertCircle aria-hidden="true" />
          <div>{erro}</div>
        </div>
      )}
    </Dialogo>
  );
  return { confirmar, elemento };
}

/** Menu suspenso de ações (⋯). */
export interface PropsGatilho {
  onClick: (e: MouseEvent) => void;
  'aria-expanded': boolean;
  'aria-haspopup': 'menu';
  'aria-label': string;
}

export function Suspenso({ rotulo, gatilho, children, lado = 'direita' }: { rotulo: string; gatilho: (p: PropsGatilho) => ComponentChildren; children: (fechar: () => void) => ComponentChildren; lado?: 'direita' | 'esquerda' }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: Event) => ref.current && !ref.current.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false);
        (ref.current?.querySelector('button') as HTMLButtonElement | null)?.focus();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const itens = [...(ref.current?.querySelectorAll<HTMLElement>('.suspenso__item') ?? [])];
        const i = itens.indexOf(document.activeElement as HTMLElement);
        itens[(i + (e.key === 'ArrowDown' ? 1 : itens.length - 1)) % itens.length]?.focus();
      }
    };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('.suspenso__item')?.focus());
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);
  return (
    <div class="suspenso" ref={ref}>
      {gatilho({ onClick: (e) => { e.stopPropagation(); setAberto((a) => !a); }, 'aria-expanded': aberto, 'aria-haspopup': 'menu', 'aria-label': rotulo })}
      {aberto && (
        <div class="suspenso__painel" role="menu" data-lado={lado} onClick={(e) => e.stopPropagation()}>
          {children(() => setAberto(false))}
        </div>
      )}
    </div>
  );
}

// Avisos rápidos -----------------------------------------------------------------------------------------------------

type TipoAviso = 'ok' | 'erro' | 'info';
interface AvisoRapido {
  id: number;
  texto: string;
  tipo: TipoAviso;
}
let fila: AvisoRapido[] = [];
const ouvintes = new Set<() => void>();
let seq = 0;

export function avisar(texto: string, tipo: TipoAviso = 'info') {
  const id = ++seq;
  fila = [...fila.slice(-2), { id, texto, tipo }];
  ouvintes.forEach((f) => f());
  setTimeout(() => remover(id), tipo === 'erro' ? 8000 : 4500);
}
function remover(id: number) {
  fila = fila.filter((a) => a.id !== id);
  ouvintes.forEach((f) => f());
}
export function avisarErro(e: unknown) {
  avisar(e instanceof ErroApi ? e.message : 'Não foi possível concluir.', 'erro');
}

export function AvisosRapidos() {
  const [, set] = useState(0);
  useEffect(() => {
    const f = () => set((n) => n + 1);
    ouvintes.add(f);
    return () => void ouvintes.delete(f);
  }, []);
  return (
    <div class="avisos-rapidos" role="status" aria-live="polite">
      {fila.map((a) => (
        <div key={a.id} class={`aviso-rapido aviso-rapido--${a.tipo}`}>
          {a.tipo === 'ok' ? <CheckCircle2 aria-hidden="true" /> : a.tipo === 'erro' ? <AlertCircle aria-hidden="true" /> : <Info aria-hidden="true" />}
          <span>{a.texto}</span>
          <button onClick={() => remover(a.id)} aria-label="Dispensar aviso">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Raiz de cada ilha de página: conteúdo + avisos rápidos. */
export function Raiz({ children }: { children: ComponentChildren }) {
  return (
    <>
      {children}
      <AvisosRapidos />
    </>
  );
}
