// Funcionários: lista, cadastro (nome, função, dias e horários; o resto em "Dados adicionais"), ficha com Editar, Dias e
// horários, Cadastro facial e Histórico, inativação. As escalas compartilhadas e a semana com folgas de um dia ficam numa
// vista secundária (?vista=escalas), sem aba própria. Tudo na tabela de funcionários da 0026 e nas escalas que já existem.
import { useEffect, useState } from 'preact/hooks';
import { ArrowLeft, CalendarClock, CalendarDays, ClipboardCheck, History, Pencil, Plus, ScanFace, Search, ShieldOff, UserCheck, UserX } from 'lucide-preact';
import type { BiometriaEstado, Funcionario, FuncionarioEntrada } from '../../lib/tipos/equipe';
import { ErroApi } from '../../lib/api/cliente';
import { equipe } from '../../lib/api/equipe';
import { invalidar, useConsulta } from '../../lib/consulta';
import { dataCurta, dataHora, hojeISO, inteiro } from '../../lib/formato';
import { gravarParams, lerParam } from '../../lib/rotas';
import { Aviso, Botao, Campo, Cartao, Situacao } from '../../ui/base';
import { avisar, Dialogo, Gaveta, useConfirmacao } from '../../ui/camadas';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import { ROTULO_BIOMETRIA, TOM_BIOMETRIA, useFuncionariosAtivos, type PermissoesEquipe } from './comum';
import { RegistroAssistido } from './Assistido';
import { Escalas } from './Escalas';
import { DiasHorarios, EditorSemana, explicarHorario, salvarHorario, textoHorario } from './DiasHorarios';
import { nomeNoTablet, planoVazio, problemaDoPlano, resumoIntervalos, versaoAtual, type PlanoSemana } from './horario';

const SITUACOES = [{ v: 'ativos', r: 'Ativos' }, { v: 'inativos', r: 'Inativos' }, { v: 'todos', r: 'Todos' }] as const;
const useEscalas = (ligado = true) => useConsulta(ligado ? 'equipe:escalas' : null, () => equipe.escalas());

export function Funcionarios({ perm }: { perm: PermissoesEquipe }) {
  const [vista, setVista] = useState<'lista' | 'escalas'>(() => (lerParam('vista') === 'escalas' ? 'escalas' : 'lista'));
  useEffect(() => gravarParams({ vista: vista === 'escalas' ? 'escalas' : null }), [vista]);
  if (vista === 'escalas') {
    return (
      <div class="pilha">
        <Botao class="equipe-voltar" icone={<ArrowLeft aria-hidden="true" />} onClick={() => setVista('lista')}>Voltar aos funcionários</Botao>
        <p class="fraco">Os dias e horários de cada pessoa ficam na ficha dela. Aqui ficam a semana de todos, com folga ou troca de um dia, e os horários compartilhados por mais de uma pessoa.</p>
        <Escalas perm={perm} />
      </div>
    );
  }
  return <Lista perm={perm} aoVerEscalas={() => setVista('escalas')} />;
}

function Lista({ perm, aoVerEscalas }: { perm: PermissoesEquipe; aoVerEscalas: () => void }) {
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<(typeof SITUACOES)[number]['v']>('ativos');
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const q = { busca: busca.trim() || undefined, ativo: situacao === 'todos' ? undefined : situacao === 'ativos', limite: 200 };
  const lista = useConsulta(`equipe:funcionarios?${JSON.stringify(q)}`, () => equipe.funcionarios(q));
  const escalas = useEscalas();
  const hoje = hojeISO();
  useEffect(() => setAberto(lerParam('funcionario')), []);

  const horario = (f: Funcionario) => textoHorario(f, escalas.dados, hoje) ?? <span class="fraco">Sem horário</span>;
  const colunas: Coluna<Funcionario>[] = [
    { id: 'nome', titulo: 'Nome', ordenar: (f) => f.nome_completo, celula: (f) => <strong>{f.nome_completo}</strong> },
    { id: 'cargo', titulo: 'Função', ordenar: (f) => f.cargo, celula: (f) => f.cargo },
    { id: 'horario', titulo: 'Dias e horários', prioridade: 'media', celula: horario },
    { id: 'biometria', titulo: 'Reconhecimento', prioridade: 'baixa', celula: (f) => <EstadoFacial f={f} /> },
    { id: 'situacao', titulo: 'Situação', celula: (f) => <Situacao tom={f.ativo ? 'ok' : 'apagado'}>{f.ativo ? 'Ativo' : 'Inativo'}</Situacao> },
  ];

  return (
    <Cartao
      titulo="Funcionários"
      acoes={
        <>
          <Botao icone={<CalendarDays aria-hidden="true" />} onClick={aoVerEscalas}>Semana e escalas</Botao>
          {perm.gerenciar && <Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setNovo(true)}>Novo funcionário</Botao>}
        </>
      }
      justo
    >
      <div class="filtros equipe-filtros">
        <div class="entrada-grupo">
          <Search aria-hidden="true" />
          <input class="entrada" type="search" aria-label="Buscar por nome" placeholder="Buscar por nome" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
        </div>
        <select class="selecao" aria-label="Situação" value={situacao} onChange={(e) => setSituacao(e.currentTarget.value as typeof situacao)}>
          {SITUACOES.map((s) => <option key={s.v} value={s.v}>{s.r}</option>)}
        </select>
      </div>
      <Dados consulta={lista} esqueleto={<EsqueletoTabela />}>
        {(p) => (
          <Tabela
            rotulo="Funcionários"
            colunas={colunas}
            linhas={p.itens}
            chave={(f) => f.id}
            aoAbrir={(f) => setAberto(f.id)}
            ordemInicial={{ coluna: 'nome' }}
            apagada={(f) => !f.ativo}
            movel={(f) => (
              <div class="pilha pilha--p">
                <div class="linha linha--entre">
                  <span><strong>{f.nome_completo}</strong> <span class="fraco">{f.cargo}</span></span>
                  {!f.ativo && <Situacao tom="apagado">Inativo</Situacao>}
                </div>
                <span class="fraco">{horario(f)}</span>
              </div>
            )}
            vazio={
              <Vazio
                titulo={busca ? 'Ninguém encontrado' : 'Nenhum funcionário por aqui'}
                acao={perm.gerenciar && !busca && <Botao variante="primario" onClick={() => setNovo(true)}>Cadastrar funcionário</Botao>}
              >
                {busca ? 'Tente outro nome.' : 'Cadastre a equipe para começar.'}
              </Vazio>
            }
          />
        )}
      </Dados>
      <Formulario aberto={novo} aoFechar={() => setNovo(false)} aoSalvar={(f) => { setNovo(false); setAberto(f.id); }} />
      <Ficha id={aberto} perm={perm} aoFechar={() => setAberto(null)} />
    </Cartao>
  );
}

function EstadoFacial({ f }: { f: Pick<Funcionario, 'registro_supervisionado' | 'biometria_estado'> }) {
  if (f.registro_supervisionado) return <Situacao tom="info">Registro com gestor</Situacao>;
  return <Situacao tom={TOM_BIOMETRIA[f.biometria_estado as BiometriaEstado]}>{ROTULO_BIOMETRIA[f.biometria_estado as BiometriaEstado]}</Situacao>;
}

interface CamposFuncionario {
  nome_completo: string;
  nome_exibicao: string;
  matricula: string;
  cargo: string;
  data_admissao: string;
  telefone: string;
  email: string;
  carga_horas: string;
  horario_contratual: string;
  registro_supervisionado: boolean;
}

const dosCampos = (f?: Funcionario | null): CamposFuncionario => ({
  nome_completo: f?.nome_completo ?? '',
  nome_exibicao: f?.nome_exibicao ?? '',
  matricula: f?.matricula ?? '',
  cargo: f?.cargo ?? '',
  data_admissao: f?.data_admissao ?? hojeISO(),
  telefone: f?.telefone ?? '',
  email: f?.email ?? '',
  carga_horas: f?.carga_semanal_min ? String(f.carga_semanal_min / 60).replace('.', ',') : '',
  horario_contratual: f?.horario_contratual ?? '',
  registro_supervisionado: f?.registro_supervisionado ?? false,
});

const CAMPOS_ADICIONAIS = ['nome_exibicao', 'data_admissao', 'matricula', 'telefone', 'email', 'carga_semanal_min', 'horario_contratual'];

/** Novo: nome, função e dias e horários; o resto em "Dados adicionais". Editar: os dados da pessoa (o horário tem ação própria). */
function Formulario({ aberto, aoFechar, aoSalvar, atual }: { aberto: boolean; aoFechar: () => void; aoSalvar: (f: Funcionario) => void; atual?: Funcionario | null }) {
  const novo = !atual;
  const pessoas = useFuncionariosAtivos();
  const escalas = useEscalas(aberto && novo);
  const [v, setV] = useState(dosCampos(atual));
  const [exibicaoManual, setExibicaoManual] = useState(!novo);
  const [plano, setPlano] = useState<PlanoSemana>(planoVazio());
  const [mais, setMais] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [erroHorario, setErroHorario] = useState<string | null>(null);
  useEffect(() => {
    if (!aberto) return;
    setV(dosCampos(atual));
    setExibicaoManual(!!atual);
    setPlano(planoVazio());
    setMais(false);
    setErro(null);
    setErroHorario(null);
  }, [aberto, atual?.id]);

  const outros = pessoas.dados?.itens.filter((f) => f.id !== atual?.id) ?? [];
  const cargos = [...new Set(outros.map((f) => f.cargo))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const muda = (campo: keyof CamposFuncionario) => (e: { currentTarget: HTMLInputElement }) => setV({ ...v, [campo]: e.currentTarget.value });
  const mudaNome = (e: { currentTarget: HTMLInputElement }) => {
    const nome = e.currentTarget.value;
    setV({ ...v, nome_completo: nome, ...(exibicaoManual ? {} : { nome_exibicao: nomeNoTablet(nome, outros.map((f) => f.nome_exibicao)) }) });
  };
  const apagaTemplate = !!atual && v.registro_supervisionado && !atual.registro_supervisionado && (atual.biometria_estado === 'ativa' || atual.biometria_estado === 'pendente');
  const comHorario = novo && plano.dias.some(Boolean);
  const mostraCarga = !novo && (!!atual?.carga_semanal_min || !!atual?.horario_contratual);

  const salvar = async (ev: Event) => {
    ev.preventDefault();
    setErro(null);
    setErroHorario(null);
    if (comHorario) {
      const problema = problemaDoPlano(plano);
      if (problema) return setErroHorario(problema);
    }
    if (!v.data_admissao) {
      setMais(true);
      return setErro(new ErroApi('validacao', 'Informe a data de admissão.', 422, null, { data_admissao: 'Informe a data de admissão.' }));
    }
    setEnviando(true);
    const horas = Number(v.carga_horas.replace(',', '.'));
    const corpo: FuncionarioEntrada = {
      nome_completo: v.nome_completo.trim(),
      nome_exibicao: v.nome_exibicao.trim() || nomeNoTablet(v.nome_completo, outros.map((f) => f.nome_exibicao)),
      matricula: v.matricula.trim() || null,
      cargo: v.cargo.trim(),
      data_admissao: v.data_admissao,
      telefone: v.telefone.trim() || null,
      email: v.email.trim() || null,
      carga_semanal_min: v.carga_horas.trim() && Number.isFinite(horas) ? Math.round(horas * 60) : null,
      horario_contratual: v.horario_contratual.trim() || null,
      registro_supervisionado: v.registro_supervisionado,
    };
    // Na edição, só o que mudou: o backend registra exatamente isso na auditoria.
    const mudou = atual ? Object.fromEntries(Object.entries(corpo).filter(([c, valor]) => (atual as unknown as Record<string, unknown>)[c] !== valor)) : corpo;
    let salvo: Funcionario;
    try {
      salvo = atual ? await equipe.alterarFuncionario(atual.id, mudou) : await equipe.criarFuncionario(corpo);
    } catch (e) {
      const erroApi = e instanceof ErroApi ? e : new ErroApi('servidor', 'Não foi possível salvar.');
      if (Object.keys(erroApi.campos).some((c) => CAMPOS_ADICIONAIS.includes(c))) setMais(true);
      setErro(erroApi);
      setEnviando(false);
      return;
    }
    if (comHorario) {
      try {
        const lista = escalas.dados ?? (await equipe.escalas());
        await salvarHorario({ funcionario: salvo, escalas: lista, hoje: hojeISO(), vigente: hojeISO(), plano, compartilhada: null, tolerancia: 10 });
        avisar('Funcionário cadastrado com os dias e horários.', 'ok');
      } catch (e) {
        avisar(`Funcionário cadastrado, mas o horário não foi salvo: ${explicarHorario(e)} Tente de novo em Dias e horários, na ficha.`, 'erro');
      }
    } else {
      avisar(atual ? 'Cadastro atualizado.' : 'Funcionário cadastrado.', 'ok');
    }
    invalidar('equipe');
    setEnviando(false);
    aoSalvar(salvo);
  };

  return (
    <Gaveta
      aberta={aberto}
      aoFechar={aoFechar}
      titulo={atual ? 'Editar funcionário' : 'Novo funcionário'}
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Voltar</Botao>
          <Botao variante="primario" type="submit" form="form-funcionario" carregando={enviando}>Salvar</Botao>
        </>
      }
    >
      <form id="form-funcionario" class="pilha" onSubmit={salvar}>
        <Campo rotulo="Nome completo" erro={erro?.campos.nome_completo}>
          {(id, d) => <input id={id} class="entrada" required minLength={2} maxLength={120} autoComplete="off" autoCapitalize="words" aria-describedby={d} value={v.nome_completo} onInput={mudaNome} data-autofoco />}
        </Campo>
        <Campo rotulo="Função" erro={erro?.campos.cargo}>
          {(id, d) => <input id={id} class="entrada" required minLength={2} maxLength={80} autoComplete="off" autoCapitalize="sentences" list="equipe-cargos" aria-describedby={d} value={v.cargo} onInput={muda('cargo')} />}
        </Campo>
        <datalist id="equipe-cargos">{cargos.map((c) => <option key={c} value={c} />)}</datalist>

        {novo && (
          <>
            <EditorSemana plano={plano} aoMudar={(p) => { setPlano(p); setErroHorario(null); }} />
            {!comHorario && <p class="fraco pequeno">Sem dias marcados, a pessoa registra o ponto, mas não há como saber atraso ou falta. Dá para definir depois, na ficha.</p>}
            {erroHorario && <Aviso tom="perigo">{erroHorario}</Aviso>}
          </>
        )}

        <details class="equipe-mais" open={mais} onToggle={(e) => setMais((e.currentTarget as HTMLDetailsElement).open)}>
          <summary>Dados adicionais</summary>
          <div class="grade-campos">
            <Campo rotulo="Nome no tablet" ajuda="Aparece na confirmação do ponto. Gerado a partir do nome." erro={erro?.campos.nome_exibicao}>
              {(id, d) => <input id={id} class="entrada" maxLength={60} autoComplete="off" aria-describedby={d} value={v.nome_exibicao} onInput={(e) => { setExibicaoManual(true); muda('nome_exibicao')(e); }} />}
            </Campo>
            <Campo rotulo="Data de admissão" erro={erro?.campos.data_admissao}>
              {(id, d) => <input id={id} class="entrada" type="date" aria-describedby={d} value={v.data_admissao} onInput={muda('data_admissao')} />}
            </Campo>
            <Campo rotulo="Telefone" opcional erro={erro?.campos.telefone}>
              {(id, d) => <input id={id} class="entrada" type="tel" inputMode="tel" maxLength={30} aria-describedby={d} value={v.telefone} onInput={muda('telefone')} />}
            </Campo>
            <Campo rotulo="E-mail" opcional erro={erro?.campos.email}>
              {(id, d) => <input id={id} class="entrada" type="email" inputMode="email" aria-describedby={d} value={v.email} onInput={muda('email')} />}
            </Campo>
            <Campo rotulo="Matrícula" opcional erro={erro?.campos.matricula}>
              {(id, d) => <input id={id} class="entrada" maxLength={30} aria-describedby={d} value={v.matricula} onInput={muda('matricula')} />}
            </Campo>
            {mostraCarga && (
              <>
                <Campo rotulo="Carga semanal (horas)" opcional erro={erro?.campos.carga_semanal_min}>
                  {(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={v.carga_horas} onInput={muda('carga_horas')} />}
                </Campo>
                <Campo class="inteiro" rotulo="Horário contratual" opcional erro={erro?.campos.horario_contratual}>
                  {(id, d) => <input id={id} class="entrada" maxLength={200} aria-describedby={d} value={v.horario_contratual} onInput={muda('horario_contratual')} />}
                </Campo>
              </>
            )}
            <label class="marcar inteiro">
              <input type="checkbox" checked={v.registro_supervisionado} onChange={(e) => setV({ ...v, registro_supervisionado: e.currentTarget.checked })} />
              <span>Registra o ponto com o gestor, sem reconhecimento facial</span>
            </label>
            {apagaTemplate && <div class="inteiro"><Aviso tom="atencao">Salvar assim apaga o cadastro facial desta pessoa.</Aviso></div>}
          </div>
        </details>
        {erro && !Object.keys(erro.campos).length && <Aviso tom="perigo">{erro.message}</Aviso>}
      </form>
    </Gaveta>
  );
}

const ACOES_HISTORICO: Record<string, string> = {
  criado: 'Cadastrado', criada: 'Cadastrado', alterado: 'Dados alterados', alterada: 'Dados alterados', inativado: 'Inativado', ativado: 'Reativado', reativado: 'Reativado',
  escala_atribuida: 'Dias e horários definidos', atribuicao_trocada: 'Mudança de horário marcada desfeita', excecao_de_escala: 'Mudança de um dia', excecao_cancelada: 'Mudança de um dia cancelada',
};

function Ficha({ id, perm, aoFechar }: { id: string | null; perm: PermissoesEquipe; aoFechar: () => void }) {
  const consulta = useConsulta(id ? `equipe:funcionario/${id}` : null, () => equipe.funcionario(id!));
  const escalas = useEscalas(!!id);
  const [editar, setEditar] = useState(false);
  const [horario, setHorario] = useState(false);
  const [historico, setHistorico] = useState(false);
  const [assistido, setAssistido] = useState(false);
  const [inativando, setInativando] = useState<Funcionario | null>(null);
  const { confirmar, elemento } = useConfirmacao();
  const f = consulta.dados?.id === id ? consulta.dados : undefined;
  const hoje = hojeISO();
  const atualizar = () => invalidar('equipe');

  const reativar = (alvo: Funcionario) => confirmar({
    titulo: `Reativar ${alvo.nome_exibicao}?`,
    texto: 'O reconhecimento facial precisa de novo cadastro.',
    confirmar: 'Reativar',
    sucesso: 'Funcionário reativado.',
    acao: async () => { await equipe.ativar(alvo.id); atualizar(); },
  });
  const revogar = (alvo: Funcionario) => confirmar({
    titulo: 'Revogar reconhecimento facial?',
    texto: `Apaga o cadastro facial de ${alvo.nome_exibicao}. Voltar a usar exige novo cadastro supervisionado.`,
    confirmar: 'Revogar e apagar',
    perigo: true,
    motivo: { rotulo: 'Motivo', minimo: 3 },
    sucesso: 'Cadastro facial apagado.',
    acao: async (motivo) => { await equipe.revogarBiometria(alvo.id, motivo); atualizar(); },
  });

  const escalaAtual = f?.escala ? escalas.dados?.find((e) => e.id === f.escala!.escala_id) : undefined;
  const intervalo = escalaAtual?.tipo === 'fixa' ? resumoIntervalos(versaoAtual(escalaAtual, hoje)?.dias) : null;

  return (
    <Gaveta
      aberta={!!id}
      aoFechar={aoFechar}
      largura="media"
      titulo={f?.nome_completo ?? 'Funcionário'}
      subtitulo={f ? `${f.cargo}${f.ativo ? '' : ' · Inativo'}` : undefined}
    >
      <Dados consulta={consulta}>
        {() => f && (
          <div class="pilha">
            <div class="equipe-acoes" role="group" aria-label="Ações do funcionário">
              {perm.gerenciar && <Botao icone={<Pencil aria-hidden="true" />} onClick={() => setEditar(true)}>Editar</Botao>}
              {perm.gerenciar && f.ativo && <Botao icone={<CalendarClock aria-hidden="true" />} onClick={() => setHorario(true)}>Dias e horários</Botao>}
              {perm.biometria && f.ativo && !f.registro_supervisionado && (
                <a class="btn" href={`/admin/equipe/cadastro-facial?funcionario=${f.id}`}><ScanFace aria-hidden="true" /> Cadastro facial</a>
              )}
              <Botao icone={<History aria-hidden="true" />} onClick={() => setHistorico(true)}>Histórico</Botao>
            </div>

            <dl class="definicoes">
              <dt>Dias e horários</dt>
              <dd>{textoHorario(f, escalas.dados, hoje) ?? 'Sem horário definido'}{intervalo && <><br /><span class="fraco">Intervalo: {intervalo}</span></>}</dd>
              <dt>Nome no tablet</dt><dd>{f.nome_exibicao}</dd>
              <dt>Admissão</dt><dd>{dataCurta(f.data_admissao, { ano: true })}</dd>
              {f.data_desligamento && <><dt>Desligamento</dt><dd>{dataCurta(f.data_desligamento, { ano: true })}</dd></>}
              {f.matricula && <><dt>Matrícula</dt><dd>{f.matricula}</dd></>}
              {f.telefone && <><dt>Telefone</dt><dd>{f.telefone}</dd></>}
              {f.email && <><dt>E-mail</dt><dd>{f.email}</dd></>}
              {f.carga_semanal_min ? <><dt>Carga semanal</dt><dd>{inteiro(f.carga_semanal_min / 60)} h</dd></> : null}
              {f.horario_contratual && <><dt>Horário contratual</dt><dd>{f.horario_contratual}</dd></>}
            </dl>

            <h3 class="secao-titulo">Reconhecimento facial</h3>
            <div class="linha linha--entre">
              <EstadoFacial f={f} />
              {perm.biometria && f.ativo && (f.biometria_estado === 'ativa' || f.biometria_estado === 'pendente') && !f.registro_supervisionado && (
                <Botao tamanho="p" variante="perigo" icone={<ShieldOff aria-hidden="true" />} onClick={() => revogar(f)}>Revogar</Botao>
              )}
            </div>

            <h3 class="secao-titulo">Ponto</h3>
            <div class="linha">
              {perm.ajustar && f.ativo && <Botao icone={<ClipboardCheck aria-hidden="true" />} onClick={() => setAssistido(true)}>Registro assistido</Botao>}
              <a class="btn" href={`/admin/equipe?aba=registros&funcionario=${f.id}`}>Ver registros de ponto</a>
            </div>

            {perm.gerenciar && (
              <div class="linha">
                {f.ativo
                  ? <Botao variante="perigo" icone={<UserX aria-hidden="true" />} onClick={() => setInativando(f)}>Inativar</Botao>
                  : <Botao icone={<UserCheck aria-hidden="true" />} onClick={() => reativar(f)}>Reativar</Botao>}
              </div>
            )}
          </div>
        )}
      </Dados>
      <Formulario aberto={editar} atual={f} aoFechar={() => setEditar(false)} aoSalvar={() => setEditar(false)} />
      {f && <DiasHorarios aberto={horario} funcionario={f} aoFechar={() => setHorario(false)} />}
      {f && historico && <Historico funcionario={f} aoFechar={() => setHistorico(false)} />}
      {f && <RegistroAssistido aberto={assistido} aoFechar={() => setAssistido(false)} funcionarioId={f.id} />}
      {inativando && <Inativar funcionario={inativando} aoFechar={() => setInativando(null)} aoConcluir={atualizar} />}
      {elemento}
    </Gaveta>
  );
}

function Historico({ funcionario, aoFechar }: { funcionario: Funcionario; aoFechar: () => void }) {
  const consulta = useConsulta(`equipe:funcionario/${funcionario.id}/historico`, () => equipe.historico(funcionario.id));
  return (
    <Gaveta aberta aoFechar={aoFechar} titulo="Histórico do cadastro" subtitulo={funcionario.nome_completo}>
      <Dados consulta={consulta} compacto>
        {(h) => h.itens.length ? (
          <ul class="lista" aria-label="Histórico do cadastro">
            {h.itens.slice(0, 50).map((r) => (
              <li key={r.id}>
                <div class="lista__item">
                  <span class="linha linha--entre" style={{ width: '100%' }}>
                    <span>{ACOES_HISTORICO[r.acao] ?? r.acao.replaceAll('_', ' ')}{r.ator_nome && <span class="fraco"> · {r.ator_nome}</span>}</span>
                    <span class="fraco">{dataHora(r.ocorreu_em)}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : <Vazio compacto titulo="Sem registros" />}
      </Dados>
    </Gaveta>
  );
}

/** Inativar com a data do desligamento (padrão: hoje). O histórico fica; o cadastro facial é apagado. */
function Inativar({ funcionario, aoFechar, aoConcluir }: { funcionario: Funcionario; aoFechar: () => void; aoConcluir: () => void }) {
  const [data, setData] = useState(hojeISO());
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await equipe.inativar(funcionario.id, motivo.trim(), data || undefined);
      avisar('Funcionário inativado.', 'ok');
      aoConcluir();
      aoFechar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível inativar.');
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Dialogo
      aberto
      alerta
      aoFechar={() => !enviando && aoFechar()}
      titulo={`Inativar ${funcionario.nome_exibicao}?`}
      acoes={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Voltar</Botao>
          <Botao variante="perigo" onClick={enviar} carregando={enviando} disabled={motivo.trim().length < 3 || !data}>Inativar</Botao>
        </>
      }
    >
      <p>O histórico fica guardado. O cadastro facial é apagado, e reativar exige novo cadastro.</p>
      <Campo rotulo="Data do desligamento">{(id) => <input id={id} class="entrada" type="date" required min={funcionario.data_admissao} value={data} onInput={(e) => setData(e.currentTarget.value)} />}</Campo>
      <Campo rotulo="Motivo">{(id) => <input id={id} class="entrada" maxLength={300} value={motivo} onInput={(e) => setMotivo(e.currentTarget.value)} data-autofoco />}</Campo>
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
    </Dialogo>
  );
}
