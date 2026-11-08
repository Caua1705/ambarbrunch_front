// Funcionários: lista, cadastro, edição, escala, biometria, inativação e histórico. Tudo na tabela de funcionários da 0026.
import { useEffect, useState } from 'preact/hooks';
import { Plus, Search, ScanFace, ClipboardCheck, Pencil, UserX, UserCheck, ShieldOff } from 'lucide-preact';
import type { BiometriaEstado, Funcionario, FuncionarioEntrada } from '../../lib/tipos/equipe';
import { ErroApi } from '../../lib/api/cliente';
import { equipe } from '../../lib/api/equipe';
import { invalidar, useConsulta } from '../../lib/consulta';
import { dataCurta, dataHora, hojeISO, inteiro } from '../../lib/formato';
import { lerParam } from '../../lib/rotas';
import { Aviso, Botao, Campo, Cartao, Situacao } from '../../ui/base';
import { avisar, Dialogo, Gaveta, useConfirmacao } from '../../ui/camadas';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import { ROTULO_BIOMETRIA, TOM_BIOMETRIA, type PermissoesEquipe } from './comum';
import { RegistroAssistido } from './Assistido';
import { AtribuirEscala } from './Escalas';

const SITUACOES = [{ v: 'ativos', r: 'Ativos' }, { v: 'inativos', r: 'Inativos' }, { v: 'todos', r: 'Todos' }] as const;

export function Funcionarios({ perm }: { perm: PermissoesEquipe }) {
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<(typeof SITUACOES)[number]['v']>('ativos');
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const q = { busca: busca.trim() || undefined, ativo: situacao === 'todos' ? undefined : situacao === 'ativos', limite: 200 };
  const lista = useConsulta(`equipe:funcionarios?${JSON.stringify(q)}`, () => equipe.funcionarios(q));
  useEffect(() => setAberto(lerParam('funcionario')), []);

  const colunas: Coluna<Funcionario>[] = [
    { id: 'nome', titulo: 'Nome', ordenar: (f) => f.nome_completo, celula: (f) => <><strong>{f.nome_completo}</strong>{f.matricula && <span class="fraco"> · {f.matricula}</span>}</> },
    { id: 'cargo', titulo: 'Função', ordenar: (f) => f.cargo, celula: (f) => f.cargo },
    { id: 'escala', titulo: 'Escala', prioridade: 'media', celula: (f) => f.escala?.nome ?? <span class="fraco">Sem escala</span> },
    { id: 'biometria', titulo: 'Reconhecimento', prioridade: 'media', celula: (f) => <EstadoFacial f={f} /> },
    { id: 'situacao', titulo: 'Situação', celula: (f) => <Situacao tom={f.ativo ? 'ok' : 'apagado'}>{f.ativo ? 'Ativo' : 'Inativo'}</Situacao> },
  ];

  return (
    <Cartao
      titulo="Funcionários"
      acoes={perm.gerenciar && <Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setNovo(true)}>Novo funcionário</Botao>}
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
              <div class="linha linha--entre">
                <span><strong>{f.nome_completo}</strong><br /><span class="fraco">{f.cargo}</span></span>
                <EstadoFacial f={f} />
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

function Formulario({ aberto, aoFechar, aoSalvar, atual }: { aberto: boolean; aoFechar: () => void; aoSalvar: (f: Funcionario) => void; atual?: Funcionario | null }) {
  const [v, setV] = useState(dosCampos(atual));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  useEffect(() => {
    if (aberto) {
      setV(dosCampos(atual));
      setErro(null);
    }
  }, [aberto, atual?.id]);
  const muda = (campo: keyof CamposFuncionario) => (e: { currentTarget: HTMLInputElement }) => setV({ ...v, [campo]: e.currentTarget.value });
  const apagaTemplate = !!atual && v.registro_supervisionado && !atual.registro_supervisionado && (atual.biometria_estado === 'ativa' || atual.biometria_estado === 'pendente');

  const salvar = async (ev: Event) => {
    ev.preventDefault();
    setEnviando(true);
    setErro(null);
    const horas = Number(v.carga_horas.replace(',', '.'));
    const corpo: FuncionarioEntrada = {
      nome_completo: v.nome_completo.trim(),
      nome_exibicao: v.nome_exibicao.trim(),
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
    try {
      const salvo = atual ? await equipe.alterarFuncionario(atual.id, mudou) : await equipe.criarFuncionario(corpo);
      avisar(atual ? 'Cadastro atualizado.' : 'Funcionário cadastrado.', 'ok');
      invalidar('equipe');
      aoSalvar(salvo);
    } catch (e) {
      setErro(e instanceof ErroApi ? e : new ErroApi('servidor', 'Não foi possível salvar.'));
    } finally {
      setEnviando(false);
    }
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
      <form id="form-funcionario" class="grade-campos" onSubmit={salvar}>
        <Campo class="inteiro" rotulo="Nome completo" erro={erro?.campos.nome_completo}>
          {(id, d) => <input id={id} class="entrada" required minLength={2} maxLength={120} aria-describedby={d} value={v.nome_completo} onInput={muda('nome_completo')} data-autofoco />}
        </Campo>
        <Campo rotulo="Nome no tablet" ajuda="Aparece na confirmação do ponto." erro={erro?.campos.nome_exibicao}>
          {(id, d) => <input id={id} class="entrada" required maxLength={60} aria-describedby={d} value={v.nome_exibicao} onInput={muda('nome_exibicao')} />}
        </Campo>
        <Campo rotulo="Função" erro={erro?.campos.cargo}>
          {(id, d) => <input id={id} class="entrada" required minLength={2} maxLength={80} aria-describedby={d} value={v.cargo} onInput={muda('cargo')} />}
        </Campo>
        <Campo rotulo="Admissão" erro={erro?.campos.data_admissao}>
          {(id, d) => <input id={id} class="entrada" type="date" required aria-describedby={d} value={v.data_admissao} onInput={muda('data_admissao')} />}
        </Campo>
        <Campo rotulo="Matrícula" opcional erro={erro?.campos.matricula}>
          {(id, d) => <input id={id} class="entrada" maxLength={30} aria-describedby={d} value={v.matricula} onInput={muda('matricula')} />}
        </Campo>
        <Campo rotulo="Telefone" opcional erro={erro?.campos.telefone}>
          {(id, d) => <input id={id} class="entrada" type="tel" maxLength={30} aria-describedby={d} value={v.telefone} onInput={muda('telefone')} />}
        </Campo>
        <Campo rotulo="E-mail" opcional erro={erro?.campos.email}>
          {(id, d) => <input id={id} class="entrada" type="email" aria-describedby={d} value={v.email} onInput={muda('email')} />}
        </Campo>
        <Campo rotulo="Carga semanal (horas)" opcional erro={erro?.campos.carga_semanal_min}>
          {(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={v.carga_horas} onInput={muda('carga_horas')} />}
        </Campo>
        <Campo class="inteiro" rotulo="Horário contratual" opcional erro={erro?.campos.horario_contratual}>
          {(id, d) => <input id={id} class="entrada" maxLength={200} aria-describedby={d} value={v.horario_contratual} onInput={muda('horario_contratual')} />}
        </Campo>
        <label class="marcar inteiro">
          <input type="checkbox" checked={v.registro_supervisionado} onChange={(e) => setV({ ...v, registro_supervisionado: e.currentTarget.checked })} />
          <span>Registra o ponto com o gestor, sem reconhecimento facial</span>
        </label>
        {apagaTemplate && <div class="inteiro"><Aviso tom="atencao">Salvar assim apaga o cadastro facial desta pessoa.</Aviso></div>}
        {erro && !Object.keys(erro.campos).length && <div class="inteiro"><Aviso tom="perigo">{erro.message}</Aviso></div>}
      </form>
    </Gaveta>
  );
}

const ACOES_HISTORICO: Record<string, string> = {
  criado: 'Cadastrado', criada: 'Cadastrado', alterado: 'Dados alterados', alterada: 'Dados alterados', inativado: 'Inativado', ativado: 'Reativado', reativado: 'Reativado',
  escala_atribuida: 'Escala atribuída', excecao_de_escala: 'Exceção de escala', excecao_cancelada: 'Exceção cancelada',
};

function Ficha({ id, perm, aoFechar }: { id: string | null; perm: PermissoesEquipe; aoFechar: () => void }) {
  const consulta = useConsulta(id ? `equipe:funcionario/${id}` : null, () => equipe.funcionario(id!));
  const historico = useConsulta(id ? `equipe:funcionario/${id}/historico` : null, () => equipe.historico(id!));
  const [editar, setEditar] = useState(false);
  const [escala, setEscala] = useState(false);
  const [assistido, setAssistido] = useState(false);
  const [inativando, setInativando] = useState<Funcionario | null>(null);
  const { confirmar, elemento } = useConfirmacao();
  const f = consulta.dados?.id === id ? consulta.dados : undefined;
  const atualizar = () => invalidar('equipe');

  const inativar = (alvo: Funcionario) => setInativando(alvo);
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

  return (
    <Gaveta
      aberta={!!id}
      aoFechar={aoFechar}
      largura="media"
      titulo={f?.nome_completo ?? 'Funcionário'}
      subtitulo={f ? `${f.cargo}${f.ativo ? '' : ' · Inativo'}` : undefined}
      acoesTopo={f && perm.gerenciar && <Botao tamanho="p" icone={<Pencil aria-hidden="true" />} onClick={() => setEditar(true)}>Editar</Botao>}
    >
      <Dados consulta={consulta}>
        {() => f && (
          <div class="pilha">
            <dl class="definicoes">
              <dt>Nome no tablet</dt><dd>{f.nome_exibicao}</dd>
              <dt>Matrícula</dt><dd>{f.matricula ?? '—'}</dd>
              <dt>Admissão</dt><dd>{dataCurta(f.data_admissao, { ano: true })}</dd>
              {f.data_desligamento && <><dt>Desligamento</dt><dd>{dataCurta(f.data_desligamento, { ano: true })}</dd></>}
              <dt>Telefone</dt><dd>{f.telefone ?? '—'}</dd>
              <dt>E-mail</dt><dd>{f.email ?? '—'}</dd>
              <dt>Carga semanal</dt><dd>{f.carga_semanal_min ? `${inteiro(f.carga_semanal_min / 60)} h` : '—'}</dd>
              <dt>Horário contratual</dt><dd>{f.horario_contratual ?? '—'}</dd>
            </dl>

            <h3 class="secao-titulo">Escala</h3>
            <div class="linha linha--entre">
              <span>{f.escala ? `${f.escala.nome}, desde ${dataCurta(f.escala.vigente_de)}` : 'Sem escala'}</span>
              {perm.gerenciar && f.ativo && <Botao tamanho="p" onClick={() => setEscala(true)}>Atribuir escala</Botao>}
            </div>

            <h3 class="secao-titulo">Reconhecimento facial</h3>
            <div class="linha linha--entre">
              <EstadoFacial f={f} />
              {perm.biometria && f.ativo && !f.registro_supervisionado && (
                <span class="linha">
                  <a class="btn btn--p" href={`/admin/equipe/cadastro-facial?funcionario=${f.id}`}>
                    <ScanFace aria-hidden="true" /> {f.biometria_estado === 'ativa' ? 'Recadastrar' : f.biometria_estado === 'pendente' ? 'Continuar cadastro' : 'Cadastrar rosto'}
                  </a>
                  {(f.biometria_estado === 'ativa' || f.biometria_estado === 'pendente') && (
                    <Botao tamanho="p" variante="perigo" icone={<ShieldOff aria-hidden="true" />} onClick={() => revogar(f)}>Revogar</Botao>
                  )}
                </span>
              )}
            </div>

            <h3 class="secao-titulo">Ponto</h3>
            <div class="linha">
              {perm.ajustar && f.ativo && <Botao tamanho="p" icone={<ClipboardCheck aria-hidden="true" />} onClick={() => setAssistido(true)}>Registro assistido</Botao>}
              <a class="btn btn--p" href={`/admin/equipe?aba=registros&funcionario=${f.id}`}>Ver registros de ponto</a>
            </div>

            <h3 class="secao-titulo">Histórico do cadastro</h3>
            <Dados consulta={historico} compacto>
              {(h) => h.itens.length ? (
                <ul class="lista" aria-label="Histórico do cadastro">
                  {h.itens.slice(0, 20).map((r) => (
                    <li key={r.id}><div class="lista__item"><span class="linha linha--entre" style={{ width: '100%' }}><span>{ACOES_HISTORICO[r.acao] ?? r.acao.replaceAll('_', ' ')}</span><span class="fraco">{dataHora(r.ocorreu_em)}</span></span></div></li>
                  ))}
                </ul>
              ) : <span class="fraco">Sem registros.</span>}
            </Dados>

            {perm.gerenciar && (
              <div class="linha">
                {f.ativo
                  ? <Botao variante="perigo" icone={<UserX aria-hidden="true" />} onClick={() => inativar(f)}>Inativar</Botao>
                  : <Botao icone={<UserCheck aria-hidden="true" />} onClick={() => reativar(f)}>Reativar</Botao>}
              </div>
            )}
          </div>
        )}
      </Dados>
      <Formulario aberto={editar} atual={f} aoFechar={() => setEditar(false)} aoSalvar={() => setEditar(false)} />
      {f && <AtribuirEscala aberto={escala} aoFechar={() => setEscala(false)} funcionario={f} />}
      {f && <RegistroAssistido aberto={assistido} aoFechar={() => setAssistido(false)} funcionarioId={f.id} />}
      {inativando && <Inativar funcionario={inativando} aoFechar={() => setInativando(null)} aoConcluir={atualizar} />}
      {elemento}
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
