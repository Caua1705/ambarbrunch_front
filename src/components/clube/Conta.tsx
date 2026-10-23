/** @jsxImportSource preact */
// Peças da tela principal do membro (/clube/conta) — só apresentação: recebem os dados por props (da API, na ilha
// islands/ClubeArea; de exemplo, só na prévia local). Nada aqui chama a API nem calcula pontos.
import Carteira from '../Carteira';
import { Icone, type NomeIcone } from './icones';
import type { MembroClube, SaldoPontos } from '../../lib/api/clube-acesso';

const fmt = new Intl.NumberFormat('pt-BR');
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** “2026-10-23” → “10/2026” (sem fuso: a data vem como dia do calendário) */
export const desdeCurto = (iso: string) => { const [a, m] = iso.split('-'); return a && m ? `${m}/${a}` : ''; };
/** “2026-10-23” → “outubro de 2026” */
export const desdeLongo = (iso: string) => { const [a, m] = iso.split('-').map(Number); return a && m ? `${MESES[m - 1]} de ${a}` : ''; };
/** “03-14” → “14 de março” */
export const aniversarioLongo = (mmdd: string | null) => { if (!mmdd) return null; const [m, d] = mmdd.split('-').map(Number); return m && d ? `${d} de ${MESES[m - 1]}` : null; };

/** saudação e cartão: o topo da conta */
export function TopoConta({ membro }: { membro: MembroClube }) {
  const saldo = membro.programa.ativo ? membro.programa.saldo : null;
  return (
    <header class="conta-topo">
      <p class="conta-topo__ola">Olá, <strong>{membro.nome.trim().split(/\s+/)[0]}</strong></p>
      <p class="conta-topo__desde">Membro do Clube Âmbar desde {desdeLongo(membro.membroDesde)}</p>
      <Carteira estado="membro" nome={membro.nome} desde={desdeCurto(membro.membroDesde)} pontos={saldo ? saldo.disponivel : null} class="conta-topo__cartao" />
    </header>
  );
}

/** o programa: “em preparação” (hoje) ou o saldo real, quando o backend ligar — sem redesenhar a página */
export function PainelPrograma({ ativo, saldo }: { ativo: boolean; saldo: SaldoPontos | null }) {
  if (!ativo || !saldo) {
    return (
      <section class="conta-programa conta-programa--preparo" aria-labelledby="programa-t">
        <Icone nome="espiral" class="conta-programa__icone" />
        <div>
          <h2 class="conta-programa__titulo" id="programa-t">Suas vantagens estão sendo preparadas</h2>
          <p class="conta-programa__texto">Seu cadastro está ativo. Quando o programa começar, seus pontos, o histórico e as recompensas aparecem aqui — e avisamos você.</p>
        </div>
      </section>
    );
  }
  return (
    <section class="conta-programa" aria-labelledby="programa-t">
      <h2 class="conta-programa__rotulo" id="programa-t">Seus pontos</h2>
      <p class="conta-programa__saldo"><strong>{fmt.format(saldo.disponivel)}</strong> <span>disponíveis</span></p>
      <dl class="conta-programa__partes">
        <div><dt>em liberação</dt><dd>{fmt.format(saldo.pendente)}</dd></div>
        <div><dt>reservados</dt><dd>{fmt.format(saldo.reservado)}</dd></div>
      </dl>
    </section>
  );
}

export interface Atalho { href: string; icone: NomeIcone; titulo: string; texto: string; pronto: boolean }
/** histórico, recompensas e resgates: linhas diretas (poucos toques), com “em breve” enquanto não existem */
export function AtalhosConta({ itens }: { itens: Atalho[] }) {
  return (
    <nav class="conta-atalhos" aria-label="Seu Clube">
      <ul>
        {itens.map((a) => (
          <li>
            <a class="conta-atalho" href={a.href} data-pronto={a.pronto ? '' : undefined}>
              <Icone nome={a.icone} class="conta-atalho__icone" />
              <span class="conta-atalho__texto"><strong>{a.titulo}</strong><small>{a.texto}</small></span>
              {a.pronto ? <Icone nome="seta" class="conta-atalho__seta" /> : <span class="conta-atalho__breve">em breve</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** dados da conta: só leitura (o backend não tem rota de edição para o site) */
export function DadosConta({ membro }: { membro: MembroClube }) {
  const aniv = aniversarioLongo(membro.aniversario);
  return (
    <section class="conta-bloco" aria-labelledby="dados-t">
      <h2 class="conta-bloco__titulo" id="dados-t"><Icone nome="pessoa" /> Seus dados</h2>
      <dl class="conta-dados">
        <div><dt>Nome</dt><dd>{membro.nome}</dd></div>
        <div><dt>WhatsApp</dt><dd>{membro.telefone}</dd></div>
        <div><dt>Aniversário</dt><dd>{aniv ?? <span class="conta-dados__vazio">não informado</span>}</dd></div>
        <div><dt>Membro desde</dt><dd>{desdeLongo(membro.membroDesde)}</dd></div>
      </dl>
    </section>
  );
}

interface PrefsProps {
  membro: MembroClube;
  /** texto de consentimento vigente (/clube/config); sem ele, o interruptor fica desligado */
  textoVersao: string | null;
  ocupado?: 'marketing' | 'mensagens' | null;
  /** o valor escolhido enquanto o backend salva (o interruptor não volta atrás no meio) */
  marketingPendente?: boolean | null;
  erro?: string;
  aviso?: string;
  aoMarketing?: (autorizado: boolean) => void;
}
/** comunicação: novidades (marketing — preferência comum, liga e desliga quando quiser) e, só como informação, a situação
 *  dos avisos de serviço. Parar os avisos NÃO fica aqui: não tem volta pelo site (ver PararAvisos). */
export function PreferenciasConta({ membro, textoVersao, ocupado, marketingPendente, erro, aviso, aoMarketing }: PrefsProps) {
  return (
    <section class="conta-bloco" aria-labelledby="prefs-t">
      <h2 class="conta-bloco__titulo" id="prefs-t"><Icone nome="sino" /> Comunicação</h2>
      {erro && <p class="ticket__status" data-tone="error" role="alert">{erro}</p>}
      {aviso && <p class="ticket__status" role="status">{aviso}</p>}
      <label class="interruptor">
        <input type="checkbox" role="switch" checked={ocupado === 'marketing' && typeof marketingPendente === 'boolean' ? marketingPendente : membro.marketing.autorizado} disabled={!textoVersao || !!ocupado}
          onChange={(ev) => aoMarketing?.((ev.currentTarget as HTMLInputElement).checked)} />
        <span>Novidades e ofertas pelo WhatsApp<small class="conta-bloco__nota">{ocupado === 'marketing' ? 'Salvando…' : 'Opcional. Dá para desligar quando quiser.'}</small></span>
      </label>
      <p class="conta-mensagens"><strong>Avisos da conta pelo WhatsApp</strong>
        <small class="conta-bloco__nota">{membro.mensagens.autorizado
          ? 'Ligados: confirmações do seu cadastro, dos pontos e dos resgates.'
          : 'Desligados. O código de acesso continua chegando quando você pedir.'}</small></p>
    </section>
  );
}

/** Parar os avisos de serviço (DELETE /clube/me/mensagens): um direito real, mas SEM volta pelo site (o backend não tem
 *  rota para religar). Por isso não é um interruptor nem fica entre as preferências: fica recolhido, no fim da conta, e
 *  diz claramente o que acontece antes do botão. Só aparece com os avisos ligados. */
export function PararAvisos({ ocupado, aoParar }: { ocupado?: boolean; aoParar?: () => void }) {
  return (
    <details class="conta-parar">
      <summary>Parar os avisos da conta pelo WhatsApp</summary>
      <div class="conta-parar__corpo">
        <p>Você deixa de receber as confirmações do cadastro, dos pontos e dos resgates. <strong>Depois, não dá para
          religar por aqui.</strong> O código de acesso continua chegando quando você pedir, e as novidades e ofertas
          seguem a sua escolha acima.</p>
        <button class="btn btn--block conta-parar__btn" type="button" disabled={ocupado} onClick={aoParar}>{ocupado ? 'Parando…' : 'Parar os avisos'}</button>
      </div>
    </details>
  );
}

/** carregando: o lugar das coisas, sem nada pessoal */
export function ContaEsqueleto() {
  return (
    <div class="conta-esqueleto" role="status" aria-label="Abrindo sua conta">
      <span class="conta-esqueleto__linha conta-esqueleto__linha--l" />
      <span class="conta-esqueleto__linha" />
      <Carteira estado="vazia" class="conta-topo__cartao" />
      <span class="conta-esqueleto__bloco" />
    </div>
  );
}
