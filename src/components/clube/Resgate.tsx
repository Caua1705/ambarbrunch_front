/** @jsxImportSource preact */
// Resgate por QR Code — só apresentação, para a experiência futura (sem rota pública: não há contrato de emissão,
// consumo nem validação de resgate para o site). O QR Code chega PRONTO do backend (`resgate.qr`, uma imagem): o
// navegador nunca o gera a partir do id. Situações: aguardando retirada, utilizado, expirado e cancelado.
import { Icone, type NomeIcone } from './icones';
import type { Resgate } from '../../lib/api/clube-futuro';

const fmt = new Intl.NumberFormat('pt-BR');
const dataHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });

const SITUACAO: Record<Resgate['situacao'], { selo: string; icone: NomeIcone; texto: string }> = {
  aguardando: { selo: 'aguardando retirada', icone: 'relogio', texto: 'Mostre este QR Code no caixa do Âmbar para retirar.' },
  utilizado: { selo: 'utilizado', icone: 'check', texto: 'Resgate retirado. Bom proveito!' },
  expirado: { selo: 'expirado', icone: 'relogio', texto: 'O prazo para retirar passou. Confira a situação dos seus pontos no histórico.' },
  cancelado: { selo: 'cancelado', icone: 'x', texto: 'Este resgate foi cancelado. Confira a situação dos seus pontos no histórico.' },
};

export function ResgateQr({ resgate: r }: { resgate: Resgate }) {
  const s = SITUACAO[r.situacao];
  const ativo = r.situacao === 'aguardando';
  return (
    <article class="resgate" data-situacao={r.situacao} aria-labelledby="rg-nome">
      <p class="resgate__selo"><Icone nome={s.icone} /> {s.selo}</p>
      <h2 class="resgate__nome" id="rg-nome">{r.recompensa.nome}</h2>
      <p class="resgate__pontos">{fmt.format(r.recompensa.pontos)} pontos</p>
      <div class="resgate__qr" data-ativo={ativo ? '' : undefined}>
        {ativo && r.qr
          ? <img src={r.qr} alt="QR Code do resgate para mostrar no caixa" width="220" height="220" />
          : <span class="resgate__qr-vazio" aria-hidden="true"><Icone nome="qr" /></span>}
      </div>
      {ativo && r.codigo && <p class="resgate__codigo">Se o leitor falhar, informe o código <strong>{r.codigo}</strong></p>}
      <p class="resgate__texto">{s.texto}</p>
      <dl class="resgate__datas">
        <div><dt>Pedido em</dt><dd>{dataHora.format(new Date(r.criadoEm))}</dd></div>
        {ativo && r.validoAte && <div><dt>Retire até</dt><dd>{dataHora.format(new Date(r.validoAte))}</dd></div>}
        {r.situacao === 'utilizado' && r.utilizadoEm && <div><dt>Retirado em</dt><dd>{dataHora.format(new Date(r.utilizadoEm))}</dd></div>}
      </dl>
    </article>
  );
}
