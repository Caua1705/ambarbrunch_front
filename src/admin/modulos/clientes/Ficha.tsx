// Ficha do cliente em gaveta: frequência, contato (com correção de cadastro pela gerência), reservas nas unidades que o
// usuário enxerga, canais de contato e consentimentos. Telefone ou e-mail verificados pelo cliente não se trocam aqui
// (o backend recusa com 422 no campo); a correção não muda o contato já gravado em cada reserva.
import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Phone, MessageCircle, BadgeCheck, Info, Save, ExternalLink, ShieldCheck } from 'lucide-preact';
import { useConsulta, invalidar } from '../../lib/consulta';
import { clientes } from '../../lib/api/clientes';
import { ErroApi } from '../../lib/api/cliente';
import { dataCurta, dataHora, hora, plural, telefone as fmtTel, linkWhatsApp, inteiro } from '../../lib/formato';
import { Gaveta, avisar } from '../../ui/camadas';
import { Botao, Campo, Aviso } from '../../ui/base';
import { Dados, Esqueleto } from '../../ui/estados';
import type { ClienteAlteracao, ClienteDetalhe } from '../../lib/tipos/clientes';
import { SituacaoReserva } from '../reservas/comum';
import { Frequencia, FINALIDADE, ORIGEM } from './comum';

const digitos = (t: string) => {
  const d = t.replace(/\D/g, '');
  return d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
};

export function FichaCliente({ id, aoFechar, podeEditar }: { id: string | null; aoFechar: () => void; podeEditar: boolean }) {
  const consulta = useConsulta(id ? `clientes/${id}` : null, () => clientes.obter(id!));
  const c = consulta.dados;
  return (
    <Gaveta
      aberta={!!id}
      aoFechar={aoFechar}
      largura="media"
      titulo={c ? c.nome : 'Cliente'}
      subtitulo={c ? `${plural(c.reservas_total, 'reserva', 'reservas')} · cliente desde ${dataCurta(c.criado_em.slice(0, 10), { ano: true })}${c.importado ? ' · importado do Giardini' : ''}` : undefined}
    >
      <Dados consulta={consulta} recurso="A ficha do cliente" esqueleto={<Esqueleto linhas={10} />}>
        {(c: ClienteDetalhe) => <Conteudo key={c.id} c={c} podeEditar={podeEditar} />}
      </Dados>
    </Gaveta>
  );
}

function Conteudo({ c, podeEditar }: { c: ClienteDetalhe; podeEditar: boolean }) {
  const zap = linkWhatsApp(c.telefone_e164);
  const f = c.frequencia;
  // Reservas: as mais novas primeiro (o backend manda da mais antiga para a mais nova).
  const reservas = [...c.reservas].sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora));
  return (
    <>
      <div class="linha linha--entre">
        <Frequencia f={f} />
        <span class="fraco">Origem: {c.importado ? 'Giardini' : ORIGEM[c.origem_inicial] ?? c.origem_inicial}{c.origem_detalhe ? ` · ${c.origem_detalhe}` : ''}</span>
      </div>

      <section class="pilha pilha--p">
        <h3 class="secao-titulo">Frequência</h3>
        <dl class="definicoes">
          <dt>Visitas registradas</dt>
          <dd class="num">{inteiro(f.visitas)}{f.primeira_visita ? <span class="fraco"> · desde {dataCurta(f.primeira_visita, { ano: true })}</span> : null}</dd>
          <dt>Última visita</dt>
          <dd class="num">{f.ultima_visita ? dataCurta(f.ultima_visita, { ano: true }) : '—'}</dd>
          <dt>Faltas</dt>
          <dd class="num">{inteiro(f.faltas)}{f.ultima_falta ? <span class="fraco"> · última em {dataCurta(f.ultima_falta, { ano: true })}</span> : null}</dd>
          <dt>Reservas em aberto</dt>
          <dd class="num">{inteiro(c.reservas_em_aberto)}{c.proxima_reserva ? <span class="fraco"> · próxima {dataCurta(c.proxima_reserva, { semana: true })}</span> : null}</dd>
        </dl>
      </section>

      <section class="pilha pilha--p">
        <h3 class="secao-titulo">Contato</h3>
        {podeEditar ? (
          <Correcao c={c} />
        ) : (
          <dl class="definicoes">
            <dt>Nome</dt>
            <dd>{c.nome}</dd>
            <dt>Telefone</dt>
            <dd class="num">{fmtTel(c.telefone_e164)}{c.telefone_verificado && <span class="fraco"> · verificado</span>}</dd>
            <dt>E-mail</dt>
            <dd>{c.email || <span class="fraco">Não informado</span>}</dd>
          </dl>
        )}
        {c.telefone_e164 && (
          <div class="linha">
            <a class="btn btn--p" href={`tel:${c.telefone_e164}`}><Phone aria-hidden="true" /> Ligar</a>
            {zap && <a class="btn btn--p" href={zap} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> WhatsApp</a>}
          </div>
        )}
      </section>

      <section class="pilha pilha--p">
        <h3 class="secao-titulo">Reservas</h3>
        {reservas.length ? (
          <ul class="lista" style={{ border: '1px solid var(--borda)', borderRadius: '10px' }}>
            {reservas.map((r) => (
              <li key={r.id}>
                <a class="lista__item" href={`/admin/reservas?data=${r.data}&reserva=${r.id}`} style={{ gap: '10px' }}>
                  <span class="lista__texto">
                    <strong style={{ fontWeight: 600 }}>{dataCurta(r.data, { semana: true, ano: true })} · {hora(r.hora)}</strong>
                    <span>{r.ambiente} · {plural(r.pessoas, 'pessoa', 'pessoas')} · {r.codigo}</span>
                  </span>
                  <SituacaoReserva r={r} />
                  <ExternalLink size={14} aria-hidden="true" style={{ flex: 'none', color: 'var(--texto-3)' }} />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p class="fraco">Sem reservas nas suas unidades.</p>
        )}
      </section>

      <section class="pilha pilha--p">
        <h3 class="secao-titulo">Canais</h3>
        {c.canais.length ? (
          <dl class="definicoes">
            {c.canais.map((k) => (
              <Fragment key={`${k.canal}:${k.detalhe}`}>
                <dt>{ORIGEM[k.canal] ?? k.canal}{k.detalhe ? ` · ${k.detalhe}` : ''}</dt>
                <dd class="num">{k.ocorrencias}× · desde {dataCurta(k.primeiro_em.slice(0, 10), { ano: true })}{k.ultimo_em !== k.primeiro_em ? ` · último ${dataHora(k.ultimo_em)}` : ''}</dd>
              </Fragment>
            ))}
          </dl>
        ) : (
          <p class="fraco">Nenhum canal registrado.</p>
        )}
      </section>

      <section class="pilha pilha--p">
        <h3 class="secao-titulo">Consentimentos</h3>
        {c.consentimentos.length ? (
          <ul class="lista" style={{ border: '1px solid var(--borda)', borderRadius: '10px' }}>
            {c.consentimentos.map((k, i) => (
              <li key={i} style={{ padding: '10px 14px' }} class="linha linha--entre">
                <span class="linha" style={{ gap: '6px' }}><ShieldCheck size={14} aria-hidden="true" /> {FINALIDADE[k.finalidade] ?? k.finalidade}</span>
                <span class="fraco">{k.acao} em {dataHora(k.registrado_em)} · {ORIGEM[k.canal] ?? k.canal} · texto {k.texto_versao}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p class="fraco">Nenhum consentimento registrado. Sem consentimento de marketing, nada promocional é enviado.</p>
        )}
      </section>
    </>
  );
}

/** Correção de cadastro (PATCH /admin/clientes/{id}): só o que mudou vai ao backend. */
function Correcao({ c }: { c: ClienteDetalhe }) {
  const inicial = { nome: c.nome, telefone: fmtTel(c.telefone_e164) === '—' ? '' : fmtTel(c.telefone_e164), email: c.email ?? '' };
  const [f, setF] = useState(inicial);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => setF(inicial), [c.nome, c.telefone_e164, c.email]);
  const set = (m: Partial<typeof f>) => setF((x) => ({ ...x, ...m }));

  async function salvar(e: Event) {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (f.nome.trim().length < 2) v.nome = 'Informe o nome do cliente.';
    const d = digitos(f.telefone);
    if (!c.telefone_verificado && f.telefone.trim() && (d.length < 10 || d.length > 11)) v.telefone = 'Telefone com DDD, ex.: (85) 99999-1111.';
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) v.email = 'E-mail inválido.';
    setErros(v);
    if (Object.keys(v).length) return;
    const mud: ClienteAlteracao = {};
    if (f.nome.trim() !== c.nome) mud.nome = f.nome.trim();
    if (!c.telefone_verificado && d && d !== digitos(inicial.telefone)) mud.telefone = d;
    if (f.email.trim() !== (c.email ?? '')) mud.email = f.email.trim() || null;
    if (!Object.keys(mud).length) {
      avisar('Nada mudou.', 'info');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await clientes.alterar(c.id, mud);
      avisar('Cadastro corrigido.', 'ok');
    } catch (err) {
      const x = err instanceof ErroApi ? err : null;
      setErros(x?.campos ?? {});
      setErro(x ? (Object.keys(x.campos).length ? Object.values(x.campos)[0] : x.message) : 'Não foi possível salvar.');
    } finally {
      invalidar('clientes');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} noValidate class="pilha pilha--p">
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
      <div class="grade-campos">
        <Campo rotulo="Nome" erro={erros.nome} class="inteiro">
          {(id, dsc) => <input id={id} class="entrada" autocomplete="off" maxLength={120} aria-describedby={dsc} aria-invalid={!!erros.nome || undefined} value={f.nome} onInput={(e) => set({ nome: e.currentTarget.value })} />}
        </Campo>
        <Campo rotulo="Telefone" erro={erros.telefone} ajuda={c.telefone_verificado ? 'Verificado pelo cliente: não se troca pelo painel.' : 'Com DDD.'}>
          {(id, dsc) => (
            <div class="entrada-grupo">
              {c.telefone_verificado && <BadgeCheck aria-hidden="true" style={{ color: 'var(--ok)' }} />}
              <input id={id} class="entrada num" type="tel" inputMode="tel" autocomplete="off" readOnly={c.telefone_verificado} aria-describedby={dsc} aria-invalid={!!erros.telefone || undefined} value={f.telefone} onInput={(e) => set({ telefone: e.currentTarget.value })} />
            </div>
          )}
        </Campo>
        <Campo rotulo="E-mail" opcional erro={erros.email}>
          {(id, dsc) => <input id={id} class="entrada" type="email" inputMode="email" autocomplete="off" aria-describedby={dsc} aria-invalid={!!erros.email || undefined} value={f.email} onInput={(e) => set({ email: e.currentTarget.value })} />}
        </Campo>
      </div>
      <p class="campo__ajuda">A correção vale para o cadastro do cliente. O contato gravado em cada reserva continua como foi feito.</p>
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao type="submit" variante="primario" icone={<Save aria-hidden="true" />} carregando={enviando}>Salvar correções</Botao>
      </div>
    </form>
  );
}
