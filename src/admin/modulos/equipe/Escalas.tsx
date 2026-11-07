// Escalas: criar, novo horário a partir de uma data, atribuir pessoas, folgas e consulta da semana. Mudança de escala vale de
// hoje em diante (regra do backend): dia passado só muda por exceção daquele dia, com motivo.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-preact';
import { ErroApi } from '../../lib/api/cliente';
import { equipe } from '../../lib/api/equipe';
import { invalidar, useConsulta } from '../../lib/consulta';
import { dataCurta, hojeISO, horaDe, somarDias } from '../../lib/formato';
import type { DiaPlano, Escala, Funcionario, LinhaProgramacao, VersaoEntrada } from '../../lib/tipos/equipe';
import { Aviso, Botao, Campo, Cartao, Segmentado, Situacao } from '../../ui/base';
import { avisar, avisarErro, Dialogo, Gaveta, useConfirmacao } from '../../ui/camadas';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { ROTULO_DIA, useFuncionariosAtivos, type PermissoesEquipe } from './comum';

const segundaDe = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return somarDias(iso, -((new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7));
};

/** Mensagem da regra, com a saída possível para quem está na tela. */
function explicar(e: unknown): string {
  if (!(e instanceof ErroApi)) return 'Não foi possível salvar.';
  if (e.codigo === 'vigencia_retroativa') return 'A escala só muda de hoje em diante. Para corrigir um dia que passou, use uma exceção na semana.';
  return e.message;
}

export function Escalas({ perm }: { perm: PermissoesEquipe }) {
  const [vista, setVista] = useState<'semana' | 'cadastro'>('semana');
  return (
    <div class="pilha">
      <Segmentado rotulo="Vista das escalas" valor={vista} aoMudar={setVista} opcoes={[{ valor: 'semana', rotulo: 'Semana' }, { valor: 'cadastro', rotulo: 'Escalas cadastradas' }]} />
      {vista === 'semana' ? <Semana perm={perm} /> : <Cadastro perm={perm} />}
    </div>
  );
}

function Semana({ perm }: { perm: PermissoesEquipe }) {
  const [inicio, setInicio] = useState(() => segundaDe(hojeISO()));
  const fim = somarDias(inicio, 6);
  const consulta = useConsulta(`equipe:programacao?${inicio}`, () => equipe.programacao(inicio, fim));
  const [celula, setCelula] = useState<LinhaProgramacao | null>(null);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => somarDias(inicio, i)), [inicio]);
  return (
    <Cartao
      titulo={`Semana de ${dataCurta(inicio)} a ${dataCurta(fim)}`}
      acoes={
        <>
          <Botao so_icone aria-label="Semana anterior" icone={<ChevronLeft aria-hidden="true" />} onClick={() => setInicio(somarDias(inicio, -7))} />
          <Botao tamanho="p" onClick={() => setInicio(segundaDe(hojeISO()))}>Hoje</Botao>
          <Botao so_icone aria-label="Próxima semana" icone={<ChevronRight aria-hidden="true" />} onClick={() => setInicio(somarDias(inicio, 7))} />
        </>
      }
      justo
    >
      <Dados consulta={consulta} esqueleto={<EsqueletoTabela />}>
        {(linhas) => {
          const pessoas = [...new Map(linhas.map((l) => [l.funcionario_id, l.nome_exibicao])).entries()];
          if (!pessoas.length) return <Vazio titulo="Ninguém na semana">Cadastre funcionários e atribua uma escala.</Vazio>;
          return (
            <div class="tabela-rolagem">
              <table class="tabela equipe-semana" aria-label="Escala da semana">
                <thead>
                  <tr>
                    <th scope="col">Pessoa</th>
                    {dias.map((d, i) => <th scope="col" key={d}>{ROTULO_DIA[i].slice(0, 3)} {d.slice(8)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {pessoas.map(([id, nome]) => (
                    <tr key={id}>
                      <th scope="row">{nome}</th>
                      {dias.map((d) => {
                        const l = linhas.find((x) => x.funcionario_id === id && x.data === d);
                        return (
                          <td key={d}>
                            {l && (
                              <button type="button" class="equipe-dia" data-tipo={l.tipo} data-excecao={l.excecao_id ? '' : undefined} disabled={!perm.gerenciar} onClick={() => setCelula(l)} aria-label={`${nome}, ${dataCurta(d)}: ${textoDia(l)}`}>
                                {textoDia(l)}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }}
      </Dados>
      <ExcecaoDoDia celula={celula} aoFechar={() => setCelula(null)} />
    </Cartao>
  );
}

function textoDia(l: LinhaProgramacao): string {
  if (l.tipo === 'folga') return 'Folga';
  if (l.tipo === 'sem_escala') return '—';
  return `${horaDe(l.entrada)}–${horaDe(l.saida)}`;
}

function ExcecaoDoDia({ celula, aoFechar }: { celula: LinhaProgramacao | null; aoFechar: () => void }) {
  const [tipo, setTipo] = useState<'folga' | 'plantao' | 'turno'>('folga');
  const [entrada, setEntrada] = useState('08:00');
  const [saida, setSaida] = useState('17:00');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    setTipo('folga');
    setMotivo('');
    setErro(null);
  }, [celula?.funcionario_id, celula?.data]);
  if (!celula) return null;
  const passado = celula.data < hojeISO();
  const invalido = passado && !motivo.trim();
  const executar = async (fn: () => Promise<unknown>, texto: string) => {
    setEnviando(true);
    setErro(null);
    try {
      await fn();
      avisar(texto, 'ok');
      invalidar('equipe');
      aoFechar();
    } catch (e) {
      setErro(e instanceof ErroApi && e.codigo === 'dia_com_jornada' ? 'Este dia já tem batidas. Corrija pelo registro de ponto, em Registros.' : explicar(e));
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Dialogo
      aberto
      aoFechar={() => !enviando && aoFechar()}
      titulo={`${celula.nome_exibicao}, ${dataCurta(celula.data, { semana: true })}`}
      acoes={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Voltar</Botao>
          {celula.excecao_id
            ? <Botao variante="perigo" carregando={enviando} onClick={() => executar(() => equipe.cancelarExcecao(celula.funcionario_id, celula.excecao_id!), 'Exceção cancelada.')}>Cancelar exceção</Botao>
            : <Botao variante="primario" carregando={enviando} disabled={invalido} onClick={() => executar(() => equipe.criarExcecao(celula.funcionario_id, { data: celula.data, tipo, ...(tipo !== 'folga' ? { entrada, saida } : {}), ...(motivo.trim() ? { motivo: motivo.trim() } : {}) }), 'Dia atualizado.')}>Salvar</Botao>}
        </>
      }
    >
      {celula.excecao_id ? <p>Este dia tem uma exceção: {textoDia(celula)}.</p> : (
        <>
          <p>Previsto hoje na escala: {textoDia(celula)}. A exceção vale só para este dia.</p>
          <Campo rotulo="O que muda">
            {(id) => (
              <select id={id} class="selecao" value={tipo} onChange={(e) => setTipo(e.currentTarget.value as typeof tipo)} data-autofoco>
                <option value="folga">Folga</option>
                <option value="turno">Turno diferente</option>
                <option value="plantao">Plantão</option>
              </select>
            )}
          </Campo>
          {tipo !== 'folga' && (
            <div class="grade-campos">
              <Campo rotulo="Entrada">{(id) => <input id={id} class="entrada" type="time" value={entrada} onInput={(e) => setEntrada(e.currentTarget.value)} />}</Campo>
              <Campo rotulo="Saída">{(id) => <input id={id} class="entrada" type="time" value={saida} onInput={(e) => setSaida(e.currentTarget.value)} />}</Campo>
            </div>
          )}
          <Campo rotulo="Motivo" opcional={!passado} ajuda={passado ? 'Obrigatório: este dia já passou.' : undefined}>
            {(id, d) => <input id={id} class="entrada" maxLength={300} aria-describedby={d} value={motivo} onInput={(e) => setMotivo(e.currentTarget.value)} />}
          </Campo>
        </>
      )}
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
    </Dialogo>
  );
}

function Cadastro({ perm }: { perm: PermissoesEquipe }) {
  const consulta = useConsulta('equipe:escalas', () => equipe.escalas());
  const pessoas = useFuncionariosAtivos();
  const [nova, setNova] = useState(false);
  const [horario, setHorario] = useState<Escala | null>(null);
  const [atribuir, setAtribuir] = useState<Escala | null>(null);
  const [editar, setEditar] = useState<Escala | null>(null);
  const { confirmar, elemento } = useConfirmacao();
  const desligar = (e: Escala) => confirmar({
    titulo: `Desativar ${e.nome}?`,
    texto: 'Vale de hoje em diante: os dias anteriores continuam nesta escala. Depois de virar o dia, ela não pode ser religada.',
    confirmar: 'Desativar',
    perigo: true,
    sucesso: 'Escala desativada.',
    acao: async () => {
      await equipe.alterarEscala(e.id, { ativa: false });
      invalidar('equipe');
    },
  });
  const religar = async (e: Escala) => {
    try {
      await equipe.alterarEscala(e.id, { ativa: true });
      avisar('Escala religada.', 'ok');
      invalidar('equipe');
    } catch (erro) {
      avisar(explicar(erro), 'erro');
    }
  };
  const nomes = new Map(pessoas.dados?.itens.map((f) => [f.id, f.nome_exibicao]));
  return (
    <Cartao titulo="Escalas cadastradas" acoes={perm.gerenciar && <Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setNova(true)}>Nova escala</Botao>} justo>
      <Dados consulta={consulta} esqueleto={<EsqueletoTabela />}>
        {(lista) => lista.length ? (
          <ul class="lista" aria-label="Escalas">
            {lista.map((e) => {
              const v = e.versoes[0];
              return (
                <li key={e.id}>
                  <div class="lista__item equipe-escala">
                    <div class="pilha pilha--p">
                      <span class="linha"><strong>{e.nome}</strong>{!e.ativa && <Situacao tom="apagado">Desativada</Situacao>}{e.tipo === 'variavel' && <Situacao tom="info">Variável</Situacao>}</span>
                      <span class="fraco">{v ? resumirSemana(v.dias) : 'Sem horário'}{v ? ` · vigente desde ${dataCurta(v.vigente_de)}` : ''}</span>
                      <span class="fraco">{e.funcionarios_ids.length ? e.funcionarios_ids.map((id) => nomes.get(id) ?? 'Pessoa inativa').join(', ') : 'Ninguém nesta escala'}</span>
                    </div>
                    {perm.gerenciar && (
                      <div class="linha">
                        {e.ativa && <Botao tamanho="p" onClick={() => setAtribuir(e)}>Atribuir</Botao>}
                        {e.ativa && e.tipo === 'fixa' && <Botao tamanho="p" onClick={() => setHorario(e)}>Mudar horário</Botao>}
                        <Botao tamanho="p" onClick={() => setEditar(e)}>Editar</Botao>
                        {e.ativa ? <Botao tamanho="p" variante="fantasma" onClick={() => desligar(e)}>Desativar</Botao> : <Botao tamanho="p" variante="fantasma" onClick={() => religar(e)}>Religar</Botao>}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Vazio icone={<CalendarDays aria-hidden="true" />} titulo="Nenhuma escala cadastrada" acao={perm.gerenciar && <Botao variante="primario" onClick={() => setNova(true)}>Criar escala</Botao>}>
            Sem escala, a pessoa pode registrar ponto, mas não há como saber atraso ou falta.
          </Vazio>
        )}
      </Dados>
      <FormEscala aberto={nova} aoFechar={() => setNova(false)} />
      <FormEscala aberto={!!horario} escala={horario} aoFechar={() => setHorario(null)} />
      <AtribuirEscala aberto={!!atribuir} aoFechar={() => setAtribuir(null)} escala={atribuir} />
      <EditarEscala escala={editar} aoFechar={() => setEditar(null)} />
      {elemento}
    </Cartao>
  );
}

function resumirSemana(dias: Record<string, DiaPlano>): string {
  const chaves = Object.keys(dias).map(Number).sort((a, b) => a - b);
  if (!chaves.length) return 'Sem semana fixa';
  const primeiro = dias[chaves[0]];
  const iguais = chaves.every((c) => dias[c].entrada === primeiro.entrada && dias[c].saida === primeiro.saida);
  const nomes = chaves.map((c) => ROTULO_DIA[c].slice(0, 3)).join(', ');
  return iguais ? `${nomes}, ${primeiro.entrada.slice(0, 5)} às ${primeiro.saida.slice(0, 5)}` : `${chaves.length} dias por semana`;
}

interface LinhaDia {
  trabalha: boolean;
  entrada: string;
  saida: string;
  pausa_inicio: string;
  pausa_fim: string;
}

const linhaVazia = (trabalha: boolean): LinhaDia => ({ trabalha, entrada: '08:00', saida: '17:00', pausa_inicio: '12:00', pausa_fim: '13:00' });
const semanaPadrao = () => Array.from({ length: 7 }, (_, i) => linhaVazia(i < 5));

function daVersao(dias: Record<string, DiaPlano>): LinhaDia[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = dias[String(i)];
    if (!d) return linhaVazia(false);
    return { trabalha: true, entrada: d.entrada.slice(0, 5), saida: d.saida.slice(0, 5), pausa_inicio: d.intervalos?.[0]?.inicio.slice(0, 5) ?? '', pausa_fim: d.intervalos?.[0]?.fim.slice(0, 5) ?? '' };
  });
}

/** Sem `escala`: nova escala. Com ela: novo horário a partir de uma data, sem tocar no passado. */
function FormEscala({ aberto, escala, aoFechar }: { aberto: boolean; escala?: Escala | null; aoFechar: () => void }) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'fixa' | 'variavel'>('fixa');
  const [vigente, setVigente] = useState(hojeISO());
  const [tolerancia, setTolerancia] = useState('10');
  const [semana, setSemana] = useState(semanaPadrao());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (!aberto) return;
    const v = escala?.versoes[0];
    setNome('');
    setTipo('fixa');
    setVigente(hojeISO());
    setTolerancia(String(v?.tolerancia_entrada_min ?? 10));
    setSemana(v ? daVersao(v.dias) : semanaPadrao());
    setErro(null);
  }, [aberto, escala?.id]);
  const muda = (i: number, campo: keyof LinhaDia, valor: string | boolean) => setSemana(semana.map((l, x) => (x === i ? { ...l, [campo]: valor } : l)));

  const salvar = async (ev: Event) => {
    ev.preventDefault();
    setEnviando(true);
    setErro(null);
    const dias: Record<string, DiaPlano> = {};
    if (tipo === 'fixa') {
      semana.forEach((l, i) => {
        if (l.trabalha) dias[String(i)] = { entrada: l.entrada, saida: l.saida, intervalos: l.pausa_inicio && l.pausa_fim ? [{ inicio: l.pausa_inicio, fim: l.pausa_fim }] : [] };
      });
    }
    const tol = Number(tolerancia) || 0;
    const versao: VersaoEntrada = { vigente_de: vigente, dias, tolerancia_entrada_min: tol, tolerancia_saida_min: tol, tolerancia_intervalo_min: 0, intervalos_adicionais: false };
    try {
      if (escala) await equipe.novaVersao(escala.id, versao);
      else await equipe.criarEscala({ nome: nome.trim(), tipo, valida_de: vigente, versao });
      avisar(escala ? 'Novo horário salvo.' : 'Escala criada.', 'ok');
      invalidar('equipe');
      aoFechar();
    } catch (e) {
      setErro(explicar(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Gaveta
      aberta={aberto}
      aoFechar={aoFechar}
      largura="media"
      titulo={escala ? `Novo horário de ${escala.nome}` : 'Nova escala'}
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Voltar</Botao>
          <Botao variante="primario" type="submit" form="form-escala" carregando={enviando}>Salvar</Botao>
        </>
      }
    >
      <form id="form-escala" class="pilha" onSubmit={salvar}>
        {escala && <Aviso>O horário atual continua valendo até o dia anterior a esta data. Jornadas já registradas não mudam.</Aviso>}
        <div class="grade-campos">
          {!escala && (
            <>
              <Campo rotulo="Nome da escala">{(id) => <input id={id} class="entrada" required minLength={2} maxLength={80} value={nome} onInput={(e) => setNome(e.currentTarget.value)} data-autofoco />}</Campo>
              <Campo rotulo="Tipo" ajuda={tipo === 'variavel' ? 'Os turnos entram dia a dia, na Semana.' : 'Mesma semana sempre. Dia sem marcação é folga.'}>
                {(id, d) => (
                  <select id={id} class="selecao" aria-describedby={d} value={tipo} onChange={(e) => setTipo(e.currentTarget.value as typeof tipo)}>
                    <option value="fixa">Fixa</option>
                    <option value="variavel">Variável</option>
                  </select>
                )}
              </Campo>
            </>
          )}
          <Campo rotulo="Vale a partir de">{(id) => <input id={id} class="entrada" type="date" required min={hojeISO()} value={vigente} onInput={(e) => setVigente(e.currentTarget.value)} />}</Campo>
          <Campo rotulo="Tolerância (minutos)" ajuda="Vale para entrada e saída.">{(id, d) => <input id={id} class="entrada num" type="number" min={0} max={240} aria-describedby={d} value={tolerancia} onInput={(e) => setTolerancia(e.currentTarget.value)} />}</Campo>
        </div>
        {tipo === 'fixa' && (
          <fieldset class="equipe-semana-form">
            <legend class="secao-titulo">Dias de trabalho</legend>
            <div class="equipe-semana-form__topo" aria-hidden="true"><span></span><span>Entrada</span><span>Saída</span><span>Intervalo</span><span>Volta</span></div>
            {semana.map((l, i) => (
              <div class="equipe-semana-form__dia" key={i}>
                <label class="marcar"><input type="checkbox" checked={l.trabalha} onChange={(e) => muda(i, 'trabalha', e.currentTarget.checked)} /><span>{ROTULO_DIA[i]}</span></label>
                {l.trabalha ? (
                  <>
                    <input class="entrada" type="time" aria-label={`${ROTULO_DIA[i]}: entrada`} required value={l.entrada} onInput={(e) => muda(i, 'entrada', e.currentTarget.value)} />
                    <input class="entrada" type="time" aria-label={`${ROTULO_DIA[i]}: saída`} required value={l.saida} onInput={(e) => muda(i, 'saida', e.currentTarget.value)} />
                    <input class="entrada" type="time" aria-label={`${ROTULO_DIA[i]}: início do intervalo`} value={l.pausa_inicio} onInput={(e) => muda(i, 'pausa_inicio', e.currentTarget.value)} />
                    <input class="entrada" type="time" aria-label={`${ROTULO_DIA[i]}: fim do intervalo`} value={l.pausa_fim} onInput={(e) => muda(i, 'pausa_fim', e.currentTarget.value)} />
                  </>
                ) : <span class="fraco equipe-semana-form__folga">Folga</span>}
              </div>
            ))}
          </fieldset>
        )}
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
      </form>
    </Gaveta>
  );
}

function EditarEscala({ escala, aoFechar }: { escala: Escala | null; aoFechar: () => void }) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [validaAte, setValidaAte] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (!escala) return;
    setNome(escala.nome);
    setDescricao(escala.descricao ?? '');
    setValidaAte(escala.valida_ate ?? '');
    setErro(null);
  }, [escala?.id]);
  if (!escala) return null;
  const salvar = async () => {
    setEnviando(true);
    setErro(null);
    const mudou: Parameters<typeof equipe.alterarEscala>[1] = {};
    if (nome.trim() !== escala.nome) mudou.nome = nome.trim();
    if ((descricao.trim() || null) !== escala.descricao) mudou.descricao = descricao.trim() || null;
    if ((validaAte || null) !== escala.valida_ate) mudou.valida_ate = validaAte || null;
    try {
      await equipe.alterarEscala(escala.id, mudou);
      avisar('Escala atualizada.', 'ok');
      invalidar('equipe');
      aoFechar();
    } catch (e) {
      setErro(explicar(e));
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Dialogo
      aberto
      aoFechar={() => !enviando && aoFechar()}
      titulo={`Editar ${escala.nome}`}
      acoes={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Voltar</Botao>
          <Botao variante="primario" onClick={salvar} carregando={enviando} disabled={nome.trim().length < 2}>Salvar</Botao>
        </>
      }
    >
      <Campo rotulo="Nome">{(id) => <input id={id} class="entrada" maxLength={80} value={nome} onInput={(e) => setNome(e.currentTarget.value)} data-autofoco />}</Campo>
      <Campo rotulo="Descrição" opcional>{(id) => <input id={id} class="entrada" maxLength={400} value={descricao} onInput={(e) => setDescricao(e.currentTarget.value)} />}</Campo>
      <Campo rotulo="Válida até" opcional ajuda="Depois desta data, a escala não vale para ninguém.">{(id, d) => <input id={id} class="entrada" type="date" aria-describedby={d} value={validaAte} min={escala.valida_de} onInput={(e) => setValidaAte(e.currentTarget.value)} />}</Campo>
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
    </Dialogo>
  );
}

/** Pela escala (escolhe a pessoa) ou pela ficha da pessoa (escolhe a escala). */
export function AtribuirEscala({ aberto, aoFechar, escala, funcionario }: { aberto: boolean; aoFechar: () => void; escala?: Escala | null; funcionario?: Funcionario }) {
  const pessoas = useFuncionariosAtivos();
  const lista = useConsulta(aberto && !escala ? 'equipe:escalas' : null, () => equipe.escalas());
  const [pessoa, setPessoa] = useState('');
  const [alvo, setAlvo] = useState('');
  const [vigente, setVigente] = useState(hojeISO());
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (aberto) {
      setPessoa(funcionario?.id ?? '');
      setAlvo(escala?.id ?? '');
      setVigente(hojeISO());
    }
  }, [aberto]);
  const enviar = async () => {
    setEnviando(true);
    try {
      await equipe.atribuir(alvo, pessoa, vigente);
      avisar('Escala atribuída.', 'ok');
      invalidar('equipe');
      aoFechar();
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'vigencia_retroativa') avisar(explicar(e), 'erro');
      else avisarErro(e);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Dialogo
      aberto={aberto}
      aoFechar={() => !enviando && aoFechar()}
      titulo="Atribuir escala"
      acoes={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Voltar</Botao>
          <Botao variante="primario" onClick={enviar} carregando={enviando} disabled={!pessoa || !alvo || !vigente}>Atribuir</Botao>
        </>
      }
    >
      <p>A atribuição não pode ser apagada depois. Se estiver errada, troque por outra a partir do dia seguinte.</p>
      {funcionario ? (
        <Campo rotulo="Escala">
          {(id) => (
            <select id={id} class="selecao" value={alvo} onChange={(e) => setAlvo(e.currentTarget.value)} data-autofoco>
              <option value="">Escolha…</option>
              {lista.dados?.filter((e) => e.ativa).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          )}
        </Campo>
      ) : (
        <Campo rotulo="Funcionário">
          {(id) => (
            <select id={id} class="selecao" value={pessoa} onChange={(e) => setPessoa(e.currentTarget.value)} data-autofoco>
              <option value="">Escolha…</option>
              {pessoas.dados?.itens.map((f) => <option key={f.id} value={f.id}>{f.nome_completo}</option>)}
            </select>
          )}
        </Campo>
      )}
      <Campo rotulo="Vale a partir de">{(id) => <input id={id} class="entrada" type="date" min={hojeISO()} value={vigente} onInput={(e) => setVigente(e.currentTarget.value)} />}</Campo>
    </Dialogo>
  );
}
