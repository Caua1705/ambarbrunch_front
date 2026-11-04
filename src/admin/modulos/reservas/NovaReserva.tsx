// Nova reserva pela equipe (ligação, WhatsApp, balcão) e alteração de contato. A equipe escolhe data e pessoas e vê, por
// ambiente, os horários que o MESMO serviço do site oferece (./disponibilidade.ts); nenhuma regra é repetida aqui. Quem
// decide é o backend: o horário é conferido de novo antes de gravar e a lotação é reconferida sob trava no POST. Sem resposta
// do serviço, não há horário nem como gravar.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Check, Info, Lock } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { ErroApi, novaChave } from '../../lib/api/cliente';
import { hojeISO, dataCurta, plural, hora as fmtHora, telefone as fmtTel } from '../../lib/formato';
import { Gaveta, avisar } from '../../ui/camadas';
import { Botao, Campo, Aviso } from '../../ui/base';
import { Esqueleto, Falha, Vazio } from '../../ui/estados';
import type { ReservaPainel, CanalEquipe } from '../../lib/tipos/reservas';
import { atualizarReservas, lembrarCriacaoDesligada } from './comum';
import { consultarDisponibilidade, horarioContinuaLivre, type DisponibilidadeManual, type OpcaoAmbiente, type OpcaoHorario } from './disponibilidade';

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
  if (!f.data) e.data = 'Escolha a data.';
  else if (novo && f.data < hojeISO()) e.data = 'A data já passou.';
  const p = Number(f.pessoas);
  if (!Number.isInteger(p) || p < 1) e.pessoas = 'Informe quantas pessoas.';
  if (!f.hora || !f.ambiente_id) e.hora = 'Escolha um horário disponível.';
  if (f.nome.trim().length < 2) e.nome = 'Informe o nome do cliente.';
  const d = digitosTelefone(f.telefone);
  if (d.length < 10 || d.length > 11) e.telefone = 'Telefone com DDD, ex.: (85) 99999-1111.';
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'E-mail inválido.';
  return e;
}

function CamposContato({ f, set, erros }: { f: Form; set: (m: Partial<Form>) => void; erros: Record<string, string> }) {
  return (
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
}

const MOTIVO = { lotado: 'lotado', fora_do_prazo: 'fora do prazo do site' } as const;

function resumoAmbiente(a: OpcaoAmbiente, pessoas: number) {
  if (a.aviso) return a.aviso;
  if (!a.horarios.length) return 'Sem horários nesta data';
  const livres = a.horarios.filter((h) => !h.indisponivel).length;
  if (livres) return plural(livres, 'horário livre', 'horários livres');
  return a.horarios.every((h) => h.indisponivel === 'lotado') ? `Sem lugar para ${plural(pessoas, 'pessoa', 'pessoas')}` : 'Sem horário dentro do prazo';
}

function fimDoHorario(hora: string, duracaoMin: number) {
  const [h, m] = hora.split(':').map(Number);
  const total = h * 60 + m + duracaoMin;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function Horarios({ dados, f, pessoas, aoEscolher, aoIrPara }: { dados: DisponibilidadeManual; f: Form; pessoas: number; aoEscolher: (a: OpcaoAmbiente, h: OpcaoHorario) => void; aoIrPara: (data: string) => void }) {
  if (!dados.ambientes.length) return <Vazio compacto titulo="Nenhum ambiente ativo">Os ambientes são cadastrados em Configurações.</Vazio>;
  const semHorario = !dados.ambientes.some((a) => a.horarios.length);
  const ambiente = dados.ambientes.find((a) => a.id === f.ambiente_id);
  const escolhido = ambiente?.horarios.find((h) => h.hora === f.hora);
  return (
    <>
      {semHorario && dados.proximaData && (
        <p class="campo__ajuda">
          Sem horários em {dataCurta(f.data)}. <button type="button" class="link" onClick={() => aoIrPara(dados.proximaData!)}>Ver {dataCurta(dados.proximaData)}</button>
        </p>
      )}
      <div class="disp" role="radiogroup" aria-labelledby="rotulo-horario">
        {dados.ambientes.map((a) => (
          <div key={a.id} class="disp__ambiente" role="group" aria-label={a.nome}>
            <div class="disp__topo">
              <strong>{a.nome}</strong>
              <span class="fraco">Até {a.capacidade} pessoas · {resumoAmbiente(a, pessoas)}</span>
            </div>
            {a.horarios.length > 0 && (
              <div class="disp__horarios">
                {a.horarios.map((h) => {
                  const marcado = f.ambiente_id === a.id && f.hora === h.hora;
                  return (
                    <button
                      key={h.hora}
                      type="button"
                      role="radio"
                      aria-checked={marcado}
                      disabled={!!h.indisponivel}
                      class={`btn btn--p${marcado ? ' btn--primario' : ''}`}
                      title={h.indisponivel ? MOTIVO[h.indisponivel] : h.ocupadas !== null ? `${h.ocupadas} de ${a.capacidade} lugares ocupados` : undefined}
                      onClick={() => aoEscolher(a, h)}
                    >
                      <span class="num">{h.hora}</span>
                      {h.indisponivel && <span class="sr"> ({MOTIVO[h.indisponivel]})</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      {dados.ambientes.some((a) => a.horarios.some((h) => h.indisponivel)) && <span class="campo__ajuda">Riscado: lotado ou fora do prazo do site.</span>}
      {ambiente && escolhido && (
        <p class="disp__escolha" role="status">
          <strong>{ambiente.nome}</strong> · <span class="num">{escolhido.hora} às {fimDoHorario(escolhido.hora, ambiente.duracaoMin)}</span> · {plural(pessoas, 'pessoa', 'pessoas')}
          {escolhido.ocupadas !== null && <span class="fraco"> · {escolhido.ocupadas} de {ambiente.capacidade} lugares já ocupados</span>}
        </p>
      )}
    </>
  );
}

export function NovaReserva({ aberta, aoFechar, unidade, dataInicial, aoCriar }: { aberta: boolean; aoFechar: () => void; unidade: string | null; dataInicial: string; aoCriar: (r: ReservaPainel) => void }) {
  const vazio = (): Form => ({ ambiente_id: '', data: dataInicial < hojeISO() ? hojeISO() : dataInicial, pessoas: '2', hora: '', nome: '', telefone: '', email: '', observacoes: '', canal: 'telefone' });
  const [f, setF] = useState<Form>(vazio);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erroGeral, setErroGeral] = useState<ErroApi | null>(null);
  const [perdeuHorario, setPerdeuHorario] = useState(false);
  const chave = useRef(novaChave());
  useEffect(() => {
    if (aberta) {
      setF(vazio());
      setErros({});
      setErroGeral(null);
      setPerdeuHorario(false);
      chave.current = novaChave();
    }
  }, [aberta]);
  const set = (m: Partial<Form>) => setF((x) => ({ ...x, ...m }));

  const pessoas = Number(f.pessoas);
  const pedidoValido = !!f.data && f.data >= hojeISO() && Number.isInteger(pessoas) && pessoas >= 1;
  const ambientes = useConsulta(aberta ? 'reservas/ambientes' : null, () => reservas.ambientes());
  const disponibilidade = useConsulta(
    aberta && ambientes.dados && pedidoValido ? `reservas/disponibilidade:${f.data}:${pessoas}` : null,
    () => consultarDisponibilidade(ambientes.dados!, f.data, pessoas),
    { intervalo: 30_000 },
  );

  /** O horário escolhido deixou de valer: a escolha cai e a pessoa vê o porquê; nada é gravado. */
  function perderHorario() {
    set({ ambiente_id: '', hora: '' });
    setPerdeuHorario(true);
    chave.current = novaChave();
    atualizarReservas();
  }

  useEffect(() => {
    if (!f.hora || !disponibilidade.dados) return;
    const h = disponibilidade.dados.ambientes.find((a) => a.id === f.ambiente_id)?.horarios.find((x) => x.hora === f.hora);
    if (!h || h.indisponivel) perderHorario();
  }, [disponibilidade.dados]);

  async function enviar(e: Event) {
    e.preventDefault();
    const v = validar(f, true);
    setErros(v);
    if (Object.keys(v).length) return;
    if (!unidade) {
      setErroGeral(new ErroApi('permissao', 'Seu usuário não tem unidade atribuída.'));
      return;
    }
    const ambiente = ambientes.dados?.find((a) => a.id === f.ambiente_id);
    if (!ambiente) return perderHorario();
    setEnviando(true);
    setErroGeral(null);
    setPerdeuHorario(false);
    try {
      if (!(await horarioContinuaLivre(ambiente, f.data, pessoas, f.hora))) return perderHorario();
      const r = await reservas.criar({ unidade, ambiente_id: f.ambiente_id, data: f.data, hora: f.hora, pessoas, nome: f.nome.trim(), telefone: digitosTelefone(f.telefone), email: f.email || null, observacoes: f.observacoes || null, canal: f.canal }, chave.current);
      atualizarReservas();
      avisar(`Reserva de ${r.contato_nome} criada.`, 'ok');
      aoCriar(r);
    } catch (err) {
      const x = err instanceof ErroApi ? err : new ErroApi('servidor', 'Não foi possível criar a reserva.');
      if (x.codigo === 'lotacao_excedida') return perderHorario();
      setErros(x.campos);
      setErroGeral(x);
      if (x.tipo === 'conflito') atualizarReservas();
    } finally {
      setEnviando(false);
    }
  }

  const desligada = erroGeral?.codigo === 'criacao_manual_desativada';
  useEffect(() => {
    if (desligada) lembrarCriacaoDesligada();
  }, [desligada]);
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
        <div class="grade-campos">
          <Campo rotulo="Data" erro={erros.data}>
            {(id, d) => <input id={id} type="date" class="entrada" min={hojeISO()} aria-describedby={d} aria-invalid={!!erros.data || undefined} value={f.data} onChange={(e) => { set({ data: e.currentTarget.value, ambiente_id: '', hora: '' }); setPerdeuHorario(false); }} />}
          </Campo>
          <Campo rotulo="Pessoas" erro={erros.pessoas}>
            {(id, d) => <input id={id} type="number" inputMode="numeric" min={1} max={60} class="entrada num" aria-describedby={d} aria-invalid={!!erros.pessoas || undefined} value={f.pessoas} onInput={(e) => set({ pessoas: e.currentTarget.value })} />}
          </Campo>
          <div class="campo inteiro">
            <span class="campo__rotulo" id="rotulo-horario">Ambiente e horário</span>
            {perdeuHorario && <Aviso tom="atencao">O horário escolhido não está mais disponível. Escolha outro.</Aviso>}
            {ambientes.erro && !ambientes.dados ? (
              <Falha erro={ambientes.erro} aoTentar={ambientes.recarregar} compacto recurso="A lista de ambientes" />
            ) : !pedidoValido ? (
              <span class="campo__ajuda">Informe a data e quantas pessoas para ver os horários.</span>
            ) : disponibilidade.erro ? (
              <Falha erro={disponibilidade.erro} aoTentar={disponibilidade.recarregar} compacto recurso="A disponibilidade" />
            ) : disponibilidade.dados ? (
              <Horarios dados={disponibilidade.dados} f={f} pessoas={pessoas} aoEscolher={(a, h) => { set({ ambiente_id: a.id, hora: h.hora }); setPerdeuHorario(false); }} aoIrPara={(data) => set({ data, ambiente_id: '', hora: '' })} />
            ) : (
              <Esqueleto linhas={4} altura={32} />
            )}
            {erros.hora && <span class="campo__erro" role="alert">{erros.hora}</span>}
          </div>
          <CamposContato f={f} set={set} erros={erros} />
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
        </div>
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
      <div class="grade-campos">
        <dl class="inteiro" aria-label="Reserva (não muda pelo painel)">
          <div><dt>Ambiente</dt><dd>{reserva.ambiente}</dd></div>
          <div><dt>Data</dt><dd class="num">{f.data.split('-').reverse().join('/')}</dd></div>
          <div><dt>Horário</dt><dd class="num">{f.hora}</dd></div>
          <div><dt>Pessoas</dt><dd class="num">{f.pessoas}</dd></div>
        </dl>
        <p class="campo__ajuda inteiro">Data, horário, ambiente e pessoas não mudam pelo painel. Para mudar, cancele e peça ao cliente uma nova reserva pelo site.</p>
        <CamposContato f={f} set={set} erros={erros} />
      </div>
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao onClick={aoTerminar} disabled={enviando}>Voltar</Botao>
        <Botao variante="primario" type="submit" carregando={enviando}>Salvar contato e observações</Botao>
      </div>
    </form>
  );
}
