/** @jsxImportSource preact */
// Peças comuns às ilhas do Clube (ficha de inscrição e área de membro): confirmação do telefone por código.
// O código é conferido SÓ pela API; o navegador não valida nada além do formato (dígitos e tamanho).
import { useEffect, useRef, useState } from 'preact/hooks';
import type { DesafioAcesso } from '../lib/api/clube-acesso';

interface CodigoProps {
  px: string;
  desafio: DesafioAcesso;
  digitos: number;
  ocupado: boolean;
  erro?: string;
  aoConfirmar: (codigo: string) => void;
  aoReenviar: () => void;
  aoTrocarNumero: () => void;
  /** linha de ajuda abaixo do campo (ex.: “não recebeu?”) */
  dica?: string;
  /** limite de reenvios atingido: o botão de reenviar sai (a API também limita) */
  semReenvio?: boolean;
}

/** Passo “confirme seu telefone”: um campo só (autocomplete one-time-code), contagem para reenviar e troca de número. */
export function PassoCodigo({ px, desafio, digitos, ocupado, erro, aoConfirmar, aoReenviar, aoTrocarNumero, dica, semReenvio = false }: CodigoProps) {
  const [codigo, setCodigo] = useState('');
  const [espera, setEspera] = useState(desafio.reenvioEm);
  const campo = useRef<HTMLInputElement>(null);
  // código novo (reenvio): zera o campo e a contagem. Na montagem só foca — zerar ali apagava um código colado ou
  // preenchido pelo celular antes do efeito rodar (o botão “Confirmar” ficava desligado).
  const primeiro = useRef(desafio.desafioId);
  useEffect(() => {
    if (primeiro.current !== desafio.desafioId) { primeiro.current = desafio.desafioId; setEspera(desafio.reenvioEm); setCodigo(''); }
    campo.current?.focus();
  }, [desafio.desafioId]);
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);
  const completo = codigo.length === digitos;
  return (
    <fieldset class="ficha__codigo">
      <legend>código de confirmação</legend>
      <p class="ticket__slots">Enviamos um código de {digitos} dígitos no WhatsApp para <strong class="ficha__destino">{desafio.destino}</strong>.</p>
      <label class="field" data-invalid={erro ? '' : undefined}>
        <span class="field__label">Código</span>
        <input ref={campo} id={`${px}-codigo`} class="field__input ficha__digitos" inputMode="numeric" autocomplete="one-time-code"
          maxLength={digitos} pattern={`\\d{${digitos}}`} value={codigo} disabled={ocupado} style={`--n:${digitos}`}
          onInput={(ev) => setCodigo((ev.currentTarget as HTMLInputElement).value.replace(/\D/g, '').slice(0, digitos))}
          aria-invalid={!!erro} aria-describedby={erro ? `${px}-codigo-erro` : undefined} />
        <span class="field__error" id={`${px}-codigo-erro`} role={erro ? 'alert' : undefined}>{erro}</span>
        {dica && <span class="field__hint">{dica}</span>}
      </label>
      <button class="btn btn--wine btn--block" type="button" disabled={!completo || ocupado} onClick={() => aoConfirmar(codigo)}>
        {ocupado ? 'Confirmando…' : 'Confirmar'}
      </button>
      <div class="ficha__links">
        {!semReenvio && <button class="ticket__link" type="button" disabled={espera > 0 || ocupado} onClick={aoReenviar}>
          {espera > 0 ? `Reenviar em ${Math.floor(espera / 60)}:${String(espera % 60).padStart(2, '0')}` : 'Reenviar código'}
        </button>}
        <button class="ticket__link" type="button" disabled={ocupado} onClick={aoTrocarNumero}>Trocar número</button>
      </div>
    </fieldset>
  );
}
