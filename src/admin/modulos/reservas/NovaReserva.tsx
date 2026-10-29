// Nova reserva pela equipe (ligação, WhatsApp, balcão) e alteração de reserva. Usa a MESMA lotação do backend
// (GET /admin/reservas/lotacao) — nada de agenda paralela; a lotação é reconferida pelo backend ao gravar.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Check, Info, Lock } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { ErroApi, novaChave } from '../../lib/api/cliente';
import { hojeISO, hora as fmtHora, telefone as fmtTel } from '../../lib/formato';
import { Gaveta, avisar } from '../../ui/camadas';
import { Botao, Campo, Aviso } from '../../ui/base';
import { Esqueleto } from '../../ui/estados';
import type { ReservaPainel, CanalEquipe } from '../../lib/tipos/reservas';
import { atualizarReservas } from './comum';

interface Form {
  ambiente_id: string;
  data: string;
  pessoas: string;
  hora: string;
  nome: string;
  telefone: string;
  email: string;
  observacoes: string;
  canal: CanalEquipe;
}

function digitosTelefone(t: string) {
  const d = t.replace(/\D/g, '');
  return d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
}

function validar(f: Form, novo: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.ambiente_id) e.ambiente_id = 'Escolha o ambiente.';
  if (!f.data) e.data = 'Escolha a data.';
  else if (novo && f.data < hojeISO()) e.data = 'A data já passou.';
  const p = Number(f.pessoas);
  if (!Number.isInteger(p) || p < 1) e.pessoas = 'Informe quantas pessoas.';
  if (!f.hora) e.hora = 'Escolha o horário.';
  if (f.nome.trim().length < 2) e.nome = 'Informe o nome do cliente.';
  const d = digitosTelefone(f.telefone);
  if (d.length < 10 || d.length > 11) e.telefone = 'Telefone com DDD, ex.: (85) 99999-1111.';
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'E-mail inválido.';
  return e;
}

/**
 * `soContato` (alteração): data, horário, ambiente e pessoas aparecem só para leitura — o backend recusa mudá-los
 * pelo painel (403 alteracao_desativada); o mesmo vale no painel do backend (app/painel).
 */
function CamposReserva({ f, set, erros, novo, soContato = false, ambienteNome = '' }: { f: Form; set: (m: Partial<Form>) => void; erros: Record<string, string>; novo: boolean; soContato?: boolean; ambienteNome?: string }) {
  const ambientes = useConsulta('reservas/ambientes', () => reservas.ambientes());
  const pessoas = Number(f.pessoas) || 1;
  const lotacao = useConsulta(!soContato && f.ambiente_id && f.data ? `reservas/lotacao:${f.ambiente_id}:${f.data}:${pessoas}` : null, () => reservas.lotacao(f.ambiente_id, f.data, pessoas));
  const ativos = (ambientes.dados ?? []).filter((a) => a.ativo);

  useEffect(() => {
    if (!f.ambiente_id && ativos.length === 1) set({ ambiente_id: ativos[0].id });
  }, [ativos.length]);

  const contato = (
    <>
      <Campo rotulo="Nome do cliente" erro={erros.nome} class="inteiro">
        {(id, d) => <input id={id} class="entrada" autocomplete="off" aria-describedby={d} aria-invalid={!!erros.nome || undefined} value={f.nome} onInput={(e) => set({ nome: e.currentTarget.value })} />}
      </Campo>
      <Campo rotulo="Telefone (WhatsApp)" erro={erros.telefone} ajuda="Com DDD.">
        {(id, d) => <input id={id} class="entrada num" type="tel" inputMode="tel" autocomplete="off" placeholder="(85) 99999-1111" aria-describedby={d} aria-invalid={!!erros.telefone || undefined} value={f.telefone} onInput={(e) => set({ telefone: e.currentTarget.value })} onBlur={() => set({ telefone: fmtTel(digitosTelefone(f.telefone)) === '—' ? f.telefone : fmtTel(digitosTelefone(f.telefone)) })} />}
      </Campo>
      <Campo rotulo="E-mail" opcional erro={erros.email}>
        {(id, d) => <input id={id} class="entrada" type="email" inputMode="email" autocomplete="off" aria-describedby={d} aria-invalid={!!erros.email || undefined} value={f.email} onInput={(e) => set({ email: e.currentTarget.value })} />}
      </Campo>
      <Campo rotulo="Observações" opcional class="inteiro">
        {(id) => <textarea id={id} class="area" maxLength={500} placeholder="Aniversário, cadeira de bebê, restrição alimentar…" value={f.observacoes} onInput={(e) => set({ observacoes: e.currentTarget.value })} />}
      </Campo>
    </>
  );

  if (soContato) {
    return (
      <div class="grade-campos">
        <dl class="inteiro" aria-label="Reserva (não muda pelo painel)">
          <div><dt>Ambiente</dt><dd>{ambienteNome}</dd></div>
          <div><dt>Data</dt><dd class="num">{f.data.split('-').reverse().join('/')}</dd></div>
          <div><dt>Horário</dt><dd class="num">{f.hora}</dd></div>
          <div><dt>Pessoas</dt><dd class="num">{f.pessoas}</dd></div>
        </dl>
        <p class="campo__ajuda inteiro">Data, horário, ambiente e pessoas não mudam pelo painel. Para mudar, cancele e peça ao cliente uma nova reserva pelo site.</p>
        {contato}
      </div>
    );
  }

  return (
    <div class="grade-campos">
      <Campo rotulo="Ambiente" erro={erros.ambiente_id} class="inteiro">
        {(id, d) => (
          <select id={id} class="selecao" aria-describedby={d} aria-invalid={!!erros.ambiente_id || undefined} value={f.ambiente_id} onChange={(e) => set({ ambiente_id: e.currentTarget.value, hora: '' })}>
            <option value="">Escolha…</option>
            {ativos.map((a) => (
              <option key={a.id} value={a.id}>{a.nome} — até {a.capacidade_max} pessoas</option>
            ))}
          </select>
        )}
      </Campo>
      <Campo rotulo="Data" erro={erros.data}>
        {(id, d) => <input id={id} type="date" class="entrada" min={novo ? hojeISO() : undefined} aria-describedby={d} aria-invalid={!!erros.data || undefined} value={f.data} onChange={(e) => set({ data: e.currentTarget.value, hora: '' })} />}
      </Campo>
      <Campo rotulo="Pessoas" erro={erros.pessoas}>
        {(id, d) => <input id={id} type="number" inputMode="numeric" min={1} max={60} class="entrada num" aria-describedby={d} aria-invalid={!!erros.pessoas || undefined} value={f.pessoas} onInput={(e) => set({ pessoas: e.currentTarget.value })} />}
      </Campo>
      <div class="campo inteiro">
        <span class="campo__rotulo" id="rotulo-horario">Horário</span>
        {!f.ambiente_id || !f.data ? (
          <span class="campo__ajuda">Escolha ambiente e data para ver os horários com lugar.</span>
        ) : lotacao.carregando ? (
          <Esqueleto linhas={2} />
        ) : lotacao.erro ? (
          <>
            <span class="campo__ajuda">Não foi possível consultar a lotação ({lotacao.erro.message}). Digite o horário; o sistema confere ao gravar.</span>
            <input type="time" class="entrada" style={{ maxWidth: '160px' }} aria-labelledby="rotulo-horario" value={f.hora} onChange={(e) => set({ hora: e.currentTarget.value })} />
          </>
        ) : (
          <div role="radiogroup" aria-labelledby="rotulo-horario" class="linha" style={{ gap: '6px' }}>
            {lotacao.dados!.horarios.map((h) => {
              const v = h.hora.slice(0, 5);
              const marcado = f.hora === v;
              return (
                <button
                  key={h.hora}
                  type="button"
                  role="radio"
                  aria-checked={marcado}
                  class={`btn btn--p${marcado ? ' btn--primario' : ''}`}
                  style={!h.cabe && !marcado ? { opacity: 0.55 } : undefined}
                  title={`${h.ocupadas} de ${lotacao.dados!.capacidade_max} lugares ocupados`}
                  onClick={() => set({ hora: v })}
                >
                  <span class="num">{v}</span>
                  {!h.cabe && <span class="sr">(lotado para {pessoas})</span>}
                </button>
              );
            })}
          </div>
        )}
        {lotacao.dados && f.hora && !lotacao.dados.horarios.find((h) => h.hora.startsWith(f.hora))?.cabe && (
          <span class="campo__ajuda" style={{ color: 'var(--atencao)' }}>Este horário passa da lotação para {pessoas} pessoas. O sistema pode recusar ao gravar.</span>
        )}
        {erros.hora && <span class="campo__erro" role="alert">{erros.hora}</span>}
      </div>
      {contato}
    </div>
  );
}

export function NovaReserva({ aberta, aoFechar, unidade, dataInicial, aoCriar }: { aberta: boolean; aoFechar: () => void; unidade: string | null; dataInicial: string; aoCriar: (r: ReservaPainel) => void }) {
  const vazio = (): Form => ({ ambiente_id: '', data: dataInicial < hojeISO() ? hojeISO() : dataInicial, pessoas: '2', hora: '', nome: '', telefone: '', email: '', observacoes: '', canal: 'telefone' });
  const [f, setF] = useState<Form>(vazio);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erroGeral, setErroGeral] = useState<ErroApi | null>(null);
  const chave = useRef(novaChave());
  useEffect(() => {
    if (aberta) {
      setF(vazio());
      setErros({});
      setErroGeral(null);
      chave.current = novaChave();
    }
  }, [aberta]);
  const set = (m: Partial<Form>) => setF((x) => ({ ...x, ...m }));

  async function enviar(e: Event) {
    e.preventDefault();
    const v = validar(f, true);
    setErros(v);
    if (Object.keys(v).length) return;
    if (!unidade) {
      setErroGeral(new ErroApi('permissao', 'Seu usuário não tem unidade atribuída.'));
      return;
    }
    setEnviando(true);
    setErroGeral(null);
    try {
      const r = await reservas.criar({ unidade, ambiente_id: f.ambiente_id, data: f.data, hora: f.hora, pessoas: Number(f.pessoas), nome: f.nome.trim(), telefone: digitosTelefone(f.telefone), email: f.email || null, observacoes: f.observacoes || null, canal: f.canal }, chave.current);
      atualizarReservas();
      avisar(`Reserva de ${r.contato_nome} criada.`, 'ok');
      aoCriar(r);
    } catch (err) {
      const x = err instanceof ErroApi ? err : new ErroApi('servidor', 'Não foi possível criar a reserva.');
      setErros(x.campos);
      setErroGeral(x);
      if (x.tipo === 'conflito') atualizarReservas();
    } finally {
      setEnviando(false);
    }
  }

  const desligada = erroGeral?.codigo === 'criacao_manual_desativada';
  return (
    <Gaveta
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Nova reserva"
      subtitulo="Para pedidos por telefone, WhatsApp ou balcão"
      largura="media"
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-nova-reserva" carregando={enviando} disabled={desligada} icone={<Check aria-hidden="true" />}>Criar reserva</Botao>
        </>
      }
    >
      <form id="form-nova-reserva" onSubmit={enviar} noValidate class="pilha">
        {desligada ? (
          <Aviso tom="atencao" icone={<Lock aria-hidden="true" />}>
            <strong>Nesta versão, reservas novas são feitas só pelo site.</strong> A criação pela equipe está desligada no sistema do Âmbar e pode ser ligada pelo administrador quando a operação decidir.
          </Aviso>
        ) : (
          erroGeral && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erroGeral.message}</Aviso>
        )}
        <Campo rotulo="Como o pedido chegou">
          {(id) => (
            <select id={id} class="selecao" value={f.canal} onChange={(e) => set({ canal: e.currentTarget.value as CanalEquipe })}>
              <option value="telefone">Telefone</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="balcao">Balcão</option>
              <option value="instagram">Instagram</option>
            </select>
          )}
        </Campo>
        <CamposReserva f={f} set={set} erros={erros} novo />
      </form>
    </Gaveta>
  );
}

/** Alteração dentro da gaveta de detalhe: só contato e observações; o que mudou vai ao backend (PATCH). */
export function EditarReserva({ reserva, aoTerminar }: { reserva: ReservaPainel; aoTerminar: () => void }) {
  const inicial: Form = { ambiente_id: reserva.ambiente_id, data: reserva.data, pessoas: String(reserva.pessoas), hora: fmtHora(reserva.hora), nome: reserva.contato_nome, telefone: fmtTel(reserva.contato_telefone_e164), email: reserva.contato_email ?? '', observacoes: reserva.observacoes ?? '', canal: 'painel' };
  const [f, setF] = useState<Form>(inicial);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const set = (m: Partial<Form>) => setF((x) => ({ ...x, ...m }));

  async function salvar(e: Event) {
    e.preventDefault();
    const v = validar(f, false);
    setErros(v);
    if (Object.keys(v).length) return;
    const mud: Record<string, unknown> = {};
    if (f.nome.trim() !== inicial.nome) mud.contato_nome = f.nome.trim();
    if (digitosTelefone(f.telefone) !== digitosTelefone(inicial.telefone)) mud.contato_telefone = digitosTelefone(f.telefone);
    if (f.email !== inicial.email) mud.contato_email = f.email || null;
    if (f.observacoes !== inicial.observacoes) mud.observacoes = f.observacoes;
    if (!Object.keys(mud).length) return aoTerminar();
    setEnviando(true);
    setErro(null);
    try {
      await reservas.alterar(reserva.id, mud);
      atualizarReservas();
      avisar('Contato e observações atualizados.', 'ok');
      aoTerminar();
    } catch (err) {
      const x = err instanceof ErroApi ? err : null;
      setErros(x?.campos ?? {});
      setErro(x?.message ?? 'Não foi possível alterar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} noValidate class="pilha">
      <h3 class="secao-titulo">Alterar contato e observações</h3>
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
      <CamposReserva f={f} set={set} erros={erros} novo={false} soContato ambienteNome={reserva.ambiente} />
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao onClick={aoTerminar} disabled={enviando}>Voltar</Botao>
        <Botao variante="primario" type="submit" carregando={enviando}>Salvar contato e observações</Botao>
      </div>
    </form>
  );
}
