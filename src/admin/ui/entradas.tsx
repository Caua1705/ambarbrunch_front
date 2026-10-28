// Entradas especiais: dinheiro em pt-BR, autocomplete (combobox acessível) e envio de arquivo (arrastar ou escolher).
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { Upload, Search } from 'lucide-preact';

/** Valor em reais: aceita "1.234,50", "1234,5" ou "1234.50"; mostra formatado ao sair do campo. */
export function EntradaMoeda({ id, valor, aoMudar, invalido, descr, autofoco }: { id: string; valor: string; aoMudar: (v: string) => void; invalido?: boolean; descr?: string; autofoco?: boolean }) {
  return (
    <div class="entrada-grupo">
      <span class="entrada-grupo__prefixo" aria-hidden="true">R$</span>
      <input
        id={id}
        class="entrada num"
        inputMode="decimal"
        autocomplete="off"
        placeholder="0,00"
        value={valor}
        aria-invalid={invalido || undefined}
        aria-describedby={descr}
        data-autofoco={autofoco || undefined}
        onInput={(e) => aoMudar(e.currentTarget.value.replace(/[^\d,.]/g, ''))}
        onBlur={(e) => {
          const t = e.currentTarget.value.trim();
          if (!t) return;
          const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
          if (Number.isFinite(n)) aoMudar(n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }}
      />
    </div>
  );
}

export interface OpcaoAuto {
  valor: string;
  rotulo: string;
  detalhe?: string;
}

/**
 * Combobox (WAI-ARIA 1.2): digita, as opções aparecem; setas escolhem, Enter confirma, Esc fecha.
 * `buscar` pode ser síncrono (lista local) ou ir ao backend (com espera de 250 ms entre teclas).
 */
export function Autocompletar({ id, rotulo, valor, aoEscolher, buscar, placeholder, criar, descr }: {
  id?: string;
  rotulo: string;
  valor: OpcaoAuto | null;
  aoEscolher: (o: OpcaoAuto | null) => void;
  buscar: (texto: string) => OpcaoAuto[] | Promise<OpcaoAuto[]>;
  placeholder?: string;
  /** Opção extra "Criar …" no fim da lista. */
  criar?: { rotulo: (texto: string) => string; acao: (texto: string) => void };
  descr?: string;
}) {
  const gerado = useId();
  const cid = id ?? gerado;
  const [texto, setTexto] = useState(valor?.rotulo ?? '');
  const [aberto, setAberto] = useState(false);
  const [opcoes, setOpcoes] = useState<OpcaoAuto[]>([]);
  const [ativo, setAtivo] = useState(0);
  const seq = useRef(0);

  useEffect(() => setTexto(valor?.rotulo ?? ''), [valor?.valor]);

  useEffect(() => {
    if (!aberto) return;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await buscar(texto);
        if (n === seq.current) {
          setOpcoes(r.slice(0, 30));
          setAtivo(0);
        }
      } catch {
        if (n === seq.current) setOpcoes([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [texto, aberto]);

  const total = opcoes.length + (criar && texto.trim() ? 1 : 0);
  const escolher = (i: number) => {
    if (i < opcoes.length) {
      aoEscolher(opcoes[i]);
      setTexto(opcoes[i].rotulo);
    } else if (criar) criar.acao(texto.trim());
    setAberto(false);
  };

  return (
    <div class="auto">
      <div class="entrada-grupo">
        <Search aria-hidden="true" />
        <input
          id={cid}
          class="entrada"
          role="combobox"
          aria-label={rotulo}
          aria-expanded={aberto}
          aria-controls={`${cid}-lista`}
          aria-autocomplete="list"
          aria-activedescendant={aberto && total ? `${cid}-op-${ativo}` : undefined}
          aria-describedby={descr}
          autocomplete="off"
          placeholder={placeholder}
          value={texto}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onInput={(e) => {
            setTexto(e.currentTarget.value);
            setAberto(true);
            if (valor) aoEscolher(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAberto(true);
              setAtivo((a) => Math.min(a + 1, total - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setAtivo((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && aberto && total) {
              e.preventDefault();
              escolher(ativo);
            } else if (e.key === 'Escape') setAberto(false);
          }}
        />
      </div>
      {aberto && total > 0 && (
        <ul class="auto__lista" id={`${cid}-lista`} role="listbox" aria-label={rotulo}>
          {opcoes.map((o, i) => (
            <li key={o.valor} id={`${cid}-op-${i}`} role="option" class="auto__opcao" aria-selected={i === ativo} onMouseDown={(e) => { e.preventDefault(); escolher(i); }}>
              <span>{o.rotulo}</span>
              {o.detalhe && <small>{o.detalhe}</small>}
            </li>
          ))}
          {criar && texto.trim() && (
            <li id={`${cid}-op-${opcoes.length}`} role="option" class="auto__opcao" aria-selected={ativo === opcoes.length} onMouseDown={(e) => { e.preventDefault(); escolher(opcoes.length); }}>
              <span class="forte">{criar.rotulo(texto.trim())}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Área de envio de arquivo: clicar, arrastar ou (no celular) tirar foto. */
export function EnvioArquivo({ aceitar, aoEscolher, titulo, detalhe, desativado, captura }: { aceitar: string; aoEscolher: (f: File) => void; titulo: ComponentChildren; detalhe?: ComponentChildren; desativado?: boolean; captura?: boolean }) {
  const [arrastando, setArrastando] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label
      class="envio"
      data-arrastando={arrastando || undefined}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        const f = e.dataTransfer?.files?.[0];
        if (f && !desativado) aoEscolher(f);
      }}
    >
      <Upload aria-hidden="true" />
      <strong>{titulo}</strong>
      {detalhe && <span>{detalhe}</span>}
      <input
        ref={ref}
        type="file"
        accept={aceitar}
        class="sr"
        disabled={desativado}
        {...(captura ? { capture: 'environment' } : {})}
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (f) aoEscolher(f);
          e.currentTarget.value = '';
        }}
      />
    </label>
  );
}
