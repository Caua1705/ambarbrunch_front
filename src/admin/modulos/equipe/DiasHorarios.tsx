// Dias e horários na ficha do funcionário: o gestor marca os dias, a entrada e a saída e salva. Por baixo, as escalas e
// atribuições do backend (horario.ts explica o mapeamento). Tolerância, data de início e horário compartilhado ficam em
// "Opções avançadas"; a semana com folgas de um dia e as escalas compartilhadas, em Funcionários → Semana e escalas.
import { useEffect, useState } from 'preact/hooks';
import { CalendarClock } from 'lucide-preact';
import { ErroApi } from '../../lib/api/cliente';
import { equipe } from '../../lib/api/equipe';
import { invalidar, useConsulta } from '../../lib/consulta';
import { dataCurta, hojeISO, somarDias } from '../../lib/formato';
import type { Escala, Funcionario, VersaoEntrada, VersaoEscala } from '../../lib/tipos/equipe';
import { Aviso, Botao, Campo } from '../../ui/base';
import { avisar, Gaveta } from '../../ui/camadas';
import { Dados } from '../../ui/estados';
import { ROTULO_DIA, useFuncionariosAtivos } from './comum';
import { DIA_CURTO, mesmoPlano, paraDias, planoDe, planoVazio, problemaDoPlano, resumoDias, resumoIntervalos, versaoAtual, versaoFutura, type HorarioDia, type PlanoSemana } from './horario';

type Pessoa = Pick<Funcionario, 'id' | 'nome_completo' | 'nome_exibicao' | 'escala'>;

/** Onde a pessoa está hoje nas escalas e o que dá para mudar sem esbarrar nas regras do backend. */
export function situacaoHorario(escalas: Escala[], f: Pick<Funcionario, 'id' | 'escala'>, hoje: string) {
  const atual = f.escala ? escalas.find((e) => e.id === f.escala!.escala_id) ?? null : null;
  const outros = atual ? atual.funcionarios_ids.filter((id) => id !== f.id) : [];
  const propria = !!atual && atual.ativa && atual.tipo === 'fixa' && !outros.length;
  const marcada = escalas
    .flatMap((e) => (e.atribuicoes ?? []).filter((a) => a.funcionario_id === f.id && a.vigente_de > hoje).map((a) => ({ escala: e, atribuicao: a })))
    .sort((a, b) => a.atribuicao.vigente_de.localeCompare(b.atribuicao.vigente_de))[0] ?? null;
  // Trocar de escala no mesmo dia em que a atual começou esbarra na sobreposição: a troca fica para amanhã.
  const inicioTroca = f.escala?.vigente_de === hoje ? somarDias(hoje, 1) : hoje;
  return { atual, outros, propria, marcada, inicioTroca };
}

export function explicarHorario(e: unknown): string {
  if (!(e instanceof ErroApi)) return 'Não foi possível salvar o horário.';
  if (e.codigo === 'vigencia_retroativa') return 'O horário só muda de hoje em diante. Para um dia que passou, corrija a previsão do dia em Registros.';
  if (e.codigo === 'atribuicao_sobreposta') return 'Já há outro horário marcado nesse período. Desfaça a mudança marcada ou escolha outra data em Opções avançadas.';
  if (e.codigo === 'escala_inativa') return 'Esse horário compartilhado foi desativado. Escolha outro.';
  if (e.codigo === 'sem_escala_anterior') return 'Não há horário anterior para voltar. Escolha o horário certo em Funcionários → Semana e escalas.';
  if (e.codigo === 'atribuicao_iniciada') return 'Essa mudança já começou e não se desfaz. Salve o horário certo a partir de amanhã.';
  return e.message;
}

const nomeLivre = (base: string, usados: Set<string>) => {
  if (!usados.has(base)) return base;
  for (let n = 2; ; n++) if (!usados.has(`${base} (${n})`)) return `${base} (${n})`;
};

/**
 * Salva os dias e horários da pessoa. Escala só dela → nova versão a partir de `vigente`. Senão, uma escala própria
 * ("Horário de <nome>": reaproveita a que ficou sem ninguém, nunca duplica) e a atribuição. Devolve a frase do aviso.
 */
export async function salvarHorario(o: { funcionario: Pessoa; escalas: Escala[]; hoje: string; vigente: string; plano: PlanoSemana | null; compartilhada: string | null; tolerancia: number }): Promise<string> {
  const s = situacaoHorario(o.escalas, o.funcionario, o.hoje);
  const fid = o.funcionario.id;
  if (o.compartilhada) {
    if (o.compartilhada === s.atual?.id) return 'Nada mudou.';
    await equipe.atribuir(o.compartilhada, fid, o.vigente);
    return 'Horário salvo.';
  }
  const dias = paraDias(o.plano!);
  const versao = (base?: VersaoEscala): VersaoEntrada => ({
    vigente_de: o.vigente,
    dias,
    tolerancia_entrada_min: o.tolerancia,
    tolerancia_saida_min: o.tolerancia,
    tolerancia_intervalo_min: base?.tolerancia_intervalo_min ?? 0,
    intervalos_adicionais: base?.intervalos_adicionais ?? false,
  });
  if (s.propria && s.atual) {
    const v = versaoAtual(s.atual, o.hoje);
    if (v && mesmoPlano(v.dias, dias) && v.tolerancia_entrada_min === o.tolerancia && !versaoFutura(s.atual, o.hoje)) return 'Nada mudou.';
    await equipe.novaVersao(s.atual.id, versao(v));
    return 'Horário salvo.';
  }
  const base = `Horário de ${o.funcionario.nome_completo}`.slice(0, 80);
  const sobra = o.escalas.find((e) => e.nome === base && e.ativa && e.tipo === 'fixa' && !e.funcionarios_ids.length);
  let alvo: string;
  if (sobra) {
    await equipe.novaVersao(sobra.id, versao(versaoAtual(sobra, o.hoje)));
    alvo = sobra.id;
  } else {
    const criada = await equipe.criarEscala({ nome: nomeLivre(base, new Set(o.escalas.map((e) => e.nome))), tipo: 'fixa', valida_de: o.vigente, versao: versao() });
    alvo = criada.id;
  }
  await equipe.atribuir(alvo, fid, o.vigente);
  return 'Horário salvo.';
}

/** Dias da semana, entrada, saída e intervalo opcional. Controles grandes, pensados para o tablet. */
export function EditorSemana({ plano, aoMudar }: { plano: PlanoSemana; aoMudar: (p: PlanoSemana) => void }) {
  const marcados = plano.dias.flatMap((m, i) => (m ? [i] : []));
  const marcar = (i: number) => {
    const dias = plano.dias.map((m, x) => (x === i ? !m : m));
    const porDia = dias[i] && !plano.porDia[i].entrada ? plano.porDia.map((h, x) => (x === i ? { ...plano.geral, tipo: undefined } : h)) : plano.porDia;
    aoMudar({ ...plano, dias, porDia });
  };
  const mudarIgual = (igual: boolean) => {
    if (igual) {
      const primeiro = marcados.length ? plano.porDia[marcados[0]] : plano.geral;
      aoMudar({ ...plano, igual, geral: { ...primeiro, tipo: undefined } });
    } else {
      aoMudar({ ...plano, igual, porDia: plano.porDia.map((h, i) => (plano.dias[i] ? { ...plano.geral, tipo: h.tipo } : h)) });
    }
  };
  const geral = (campo: keyof HorarioDia) => (e: { currentTarget: HTMLInputElement }) => aoMudar({ ...plano, geral: { ...plano.geral, [campo]: e.currentTarget.value } });
  const doDia = (i: number, campo: keyof HorarioDia) => (e: { currentTarget: HTMLInputElement }) => aoMudar({ ...plano, porDia: plano.porDia.map((h, x) => (x === i ? { ...h, [campo]: e.currentTarget.value } : h)) });
  const virada = marcados.some((i) => {
    const h = plano.igual ? plano.geral : plano.porDia[i];
    return h.entrada && h.saida && h.saida < h.entrada;
  });
  const hora = (rotulo: string, valor: string, aoMudar: (e: { currentTarget: HTMLInputElement }) => void, rotuloVisivel = true) =>
    rotuloVisivel ? (
      <Campo rotulo={rotulo}>{(id) => <input id={id} class="entrada equipe-hora" type="time" step={300} required value={valor} onInput={aoMudar} />}</Campo>
    ) : (
      <input class="entrada equipe-hora" type="time" step={300} aria-label={rotulo} value={valor} onInput={aoMudar} />
    );

  return (
    <fieldset class="equipe-horario">
      <legend class="secao-titulo">Dias de trabalho</legend>
      <div class="equipe-dias" role="group" aria-label="Dias de trabalho">
        {DIA_CURTO.map((d, i) => (
          <button key={d} type="button" class="equipe-dias__dia" aria-pressed={plano.dias[i]} aria-label={ROTULO_DIA[i]} onClick={() => marcar(i)}>
            {d}
          </button>
        ))}
      </div>
      {marcados.length > 0 && (
        <>
          {marcados.length > 1 && (
            <label class="marcar">
              <input type="checkbox" checked={plano.igual} onChange={(e) => mudarIgual(e.currentTarget.checked)} />
              <span>Mesmo horário em todos os dias</span>
            </label>
          )}
          {plano.igual || marcados.length === 1 ? (
            <div class="equipe-horas">
              {hora('Entrada', plano.igual ? plano.geral.entrada : plano.porDia[marcados[0]].entrada, plano.igual ? geral('entrada') : doDia(marcados[0], 'entrada'))}
              {hora('Saída', plano.igual ? plano.geral.saida : plano.porDia[marcados[0]].saida, plano.igual ? geral('saida') : doDia(marcados[0], 'saida'))}
              {plano.intervalo && hora('Início do intervalo', plano.igual ? plano.geral.pausa_inicio : plano.porDia[marcados[0]].pausa_inicio, plano.igual ? geral('pausa_inicio') : doDia(marcados[0], 'pausa_inicio'))}
              {plano.intervalo && hora('Fim do intervalo', plano.igual ? plano.geral.pausa_fim : plano.porDia[marcados[0]].pausa_fim, plano.igual ? geral('pausa_fim') : doDia(marcados[0], 'pausa_fim'))}
            </div>
          ) : (
            <div class="equipe-horario__dias">
              {marcados.map((i) => (
                <div key={i} class="equipe-horario__dia" data-intervalo={plano.intervalo ? '' : undefined}>
                  <span class="equipe-horario__nome">{ROTULO_DIA[i]}</span>
                  {hora(`${ROTULO_DIA[i]}: entrada`, plano.porDia[i].entrada, doDia(i, 'entrada'), false)}
                  {hora(`${ROTULO_DIA[i]}: saída`, plano.porDia[i].saida, doDia(i, 'saida'), false)}
                  {plano.intervalo && hora(`${ROTULO_DIA[i]}: início do intervalo`, plano.porDia[i].pausa_inicio, doDia(i, 'pausa_inicio'), false)}
                  {plano.intervalo && hora(`${ROTULO_DIA[i]}: fim do intervalo`, plano.porDia[i].pausa_fim, doDia(i, 'pausa_fim'), false)}
                </div>
              ))}
            </div>
          )}
          <label class="marcar">
            <input type="checkbox" checked={plano.intervalo} onChange={(e) => aoMudar({ ...plano, intervalo: e.currentTarget.checked })} />
            <span>Tem intervalo previsto</span>
          </label>
          {virada && <p class="fraco pequeno">Saída antes da entrada: o turno termina no dia seguinte.</p>}
        </>
      )}
    </fieldset>
  );
}

const nomesDe = (ids: string[], nomes: Map<string, string>) => ids.map((id) => nomes.get(id) ?? 'Pessoa inativa').join(', ');

export function DiasHorarios({ funcionario, aberto, aoFechar }: { funcionario: Funcionario; aberto: boolean; aoFechar: () => void }) {
  const consulta = useConsulta(aberto ? 'equipe:escalas' : null, () => equipe.escalas());
  const pessoas = useFuncionariosAtivos();
  const hoje = hojeISO();
  const [plano, setPlano] = useState<PlanoSemana>(planoVazio());
  const [vigente, setVigente] = useState(hoje);
  const [tolerancia, setTolerancia] = useState('10');
  const [compartilhada, setCompartilhada] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const escalas = consulta.dados;
  const s = escalas ? situacaoHorario(escalas, funcionario, hoje) : null;

  useEffect(() => {
    if (!aberto || !escalas) return;
    const x = situacaoHorario(escalas, funcionario, hoje);
    const v = x.atual ? versaoAtual(x.atual, hoje) : undefined;
    setPlano(planoDe(x.atual?.tipo === 'fixa' ? v?.dias : null));
    setVigente(x.propria ? hoje : x.inicioTroca);
    setTolerancia(String(v?.tolerancia_entrada_min ?? 10));
    setCompartilhada('');
    setErro(null);
  }, [aberto, !!escalas, funcionario.id]);

  const nomes = new Map(pessoas.dados?.itens.map((f) => [f.id, f.nome_exibicao]));
  const precisaAtribuir = !!compartilhada || !s?.propria;
  const bloqueio = precisaAtribuir && s?.marcada ? s.marcada : null;
  const minimo = s && precisaAtribuir ? s.inicioTroca : hoje;
  const escolhida = compartilhada ? escalas?.find((e) => e.id === compartilhada) : undefined;

  const salvar = async (ev: Event) => {
    ev.preventDefault();
    if (!escalas) return;
    const problema = compartilhada ? null : problemaDoPlano(plano);
    if (problema) return setErro(problema);
    if (vigente < minimo) return setErro(`O horário novo pode valer a partir de ${dataCurta(minimo)}.`);
    setEnviando(true);
    setErro(null);
    try {
      const texto = await salvarHorario({ funcionario, escalas, hoje, vigente, plano, compartilhada: compartilhada || null, tolerancia: Math.max(0, Math.min(240, Number(tolerancia) || 0)) });
      avisar(vigente > hoje && texto !== 'Nada mudou.' ? `${texto} Vale a partir de ${dataCurta(vigente)}.` : texto, texto === 'Nada mudou.' ? 'info' : 'ok');
      invalidar('equipe');
      aoFechar();
    } catch (e) {
      setErro(explicarHorario(e));
      invalidar('equipe:escalas');
    } finally {
      setEnviando(false);
    }
  };

  const desfazerMarcada = async () => {
    if (!s?.marcada) return;
    setDesfazendo(true);
    setErro(null);
    try {
      await equipe.cancelarAtribuicao(s.marcada.escala.id, s.marcada.atribuicao.id);
      avisar('Mudança marcada desfeita.', 'ok');
      invalidar('equipe');
    } catch (e) {
      setErro(explicarHorario(e));
    } finally {
      setDesfazendo(false);
    }
  };

  const atual = s?.atual;
  const vAtual = atual ? versaoAtual(atual, hoje) : undefined;
  const vFutura = atual ? versaoFutura(atual, hoje) : undefined;
  const compartilhaveis = (escalas ?? []).filter((e) => e.ativa && e.tipo === 'fixa' && e.id !== atual?.id);

  return (
    <Gaveta
      aberta={aberto}
      aoFechar={aoFechar}
      titulo="Dias e horários"
      subtitulo={funcionario.nome_completo}
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Voltar</Botao>
          <Botao variante="primario" type="submit" form="form-horario" carregando={enviando} disabled={!escalas || !!bloqueio}>Salvar horário</Botao>
        </>
      }
    >
      <Dados consulta={consulta} recurso="Os horários">
        {() => s && (
          <form id="form-horario" class="pilha" onSubmit={salvar}>
            <div class="equipe-horario-atual">
              <CalendarClock aria-hidden="true" />
              <div class="pilha pilha--p">
                <span><strong>Hoje:</strong> {atual ? (atual.tipo === 'variavel' ? 'escala variável, com turnos lançados dia a dia' : resumoDias(vAtual?.dias)) : 'sem horário definido'}</span>
                {atual && atual.tipo === 'fixa' && resumoIntervalos(vAtual?.dias) && <span class="fraco">Intervalo: {resumoIntervalos(vAtual?.dias)}</span>}
                {vFutura && <span class="fraco">A partir de {dataCurta(vFutura.vigente_de)}: {resumoDias(vFutura.dias)}</span>}
                {s.marcada && <span class="fraco">A partir de {dataCurta(s.marcada.atribuicao.vigente_de)}: {s.marcada.escala.nome}</span>}
              </div>
            </div>
            {atual && s.outros.length > 0 && !compartilhada && (
              <Aviso>
                {funcionario.nome_exibicao} segue hoje o horário compartilhado “{atual.nome}”, junto com {nomesDe(s.outros, nomes)}. Ao salvar, {funcionario.nome_exibicao} passa a ter um horário próprio; os outros não mudam.
              </Aviso>
            )}
            {atual?.tipo === 'variavel' && !compartilhada && <Aviso>Ao salvar, {funcionario.nome_exibicao} passa a ter dias e horários fixos.</Aviso>}
            {bloqueio && (
              <Aviso tom="atencao">
                Já há uma mudança marcada para {dataCurta(bloqueio.atribuicao.vigente_de)} (“{bloqueio.escala.nome}”). Desfaça essa mudança para salvar um horário novo.
                <span class="linha equipe-aviso-acao">
                  <Botao tamanho="p" onClick={desfazerMarcada} carregando={desfazendo}>Desfazer mudança marcada</Botao>
                </span>
              </Aviso>
            )}

            {escolhida ? (
              <div class="pilha pilha--p">
                <span><strong>{escolhida.nome}:</strong> {resumoDias(versaoAtual(escolhida, hoje)?.dias)}</span>
                <span class="fraco">Horário compartilhado{escolhida.funcionarios_ids.length ? ` com ${nomesDe(escolhida.funcionarios_ids, nomes)}` : ''}. Se ele mudar, muda para todos.</span>
              </div>
            ) : (
              <EditorSemana plano={plano} aoMudar={(p) => { setPlano(p); setErro(null); }} />
            )}

            <details class="equipe-mais" open={vigente !== (s.propria ? hoje : s.inicioTroca) || !!compartilhada}>
              <summary>Opções avançadas</summary>
              <div class="pilha">
                <Campo rotulo="Vale a partir de" ajuda="Os dias anteriores não mudam. Para mudar só um dia (folga, troca de turno), use Semana e escalas.">
                  {(id, d) => <input id={id} class="entrada" type="date" required min={minimo} aria-describedby={d} value={vigente} onInput={(e) => setVigente(e.currentTarget.value)} />}
                </Campo>
                {!compartilhada && (
                  <Campo rotulo="Tolerância de atraso (minutos)" ajuda="Vale para a entrada e a saída.">
                    {(id, d) => <input id={id} class="entrada num" type="number" inputMode="numeric" min={0} max={240} aria-describedby={d} value={tolerancia} onInput={(e) => setTolerancia(e.currentTarget.value)} />}
                  </Campo>
                )}
                {compartilhaveis.length > 0 && (
                  <Campo rotulo="Usar um horário compartilhado" ajuda="Para quem trabalha exatamente no mesmo horário de outras pessoas.">
                    {(id, d) => (
                      <select id={id} class="selecao" aria-describedby={d} value={compartilhada} onChange={(e) => { setCompartilhada(e.currentTarget.value); setErro(null); }}>
                        <option value="">Não: horário próprio, definido acima</option>
                        {compartilhaveis.map((e) => <option key={e.id} value={e.id}>{e.nome} ({resumoDias(versaoAtual(e, hoje)?.dias)})</option>)}
                      </select>
                    )}
                  </Campo>
                )}
                <a class="btn btn--p equipe-voltar" href="/admin/equipe?aba=funcionarios&vista=escalas">Semana e escalas</a>
              </div>
            </details>
            {erro && <Aviso tom="perigo">{erro}</Aviso>}
          </form>
        )}
      </Dados>
    </Gaveta>
  );
}

/** Resumo de uma linha para a lista e a ficha. */
export function textoHorario(f: Pick<Funcionario, 'escala'>, escalas: Escala[] | undefined, hoje: string): string | null {
  if (!f.escala) return null;
  const e = escalas?.find((x) => x.id === f.escala!.escala_id);
  if (!e) return f.escala.nome;
  if (e.tipo === 'variavel') return `${e.nome} (turnos dia a dia)`;
  return resumoDias(versaoAtual(e, hoje)?.dias);
}
