// Mexer no saldo de UM insumo à mão, sempre a partir da gaveta dele e sempre com histórico no backend:
//  - Conferir quantidade: contei e informo quanto há → POST /admin/estoque/ajustes (motivo contagem_fisica). A primeira
//    conferência do insumo vira a quantidade inicial (abertura); sem diferença, fica só a data da conferência.
//  - Corrigir saldo: o número está errado por outro motivo → o mesmo ajuste, com justificativa obrigatória.
//  - Perda ou uso interno: vencido, quebra, sobra de preparo, café da equipe… → POST /admin/estoque/perdas (sai ao custo
//    médio; uso interno não conta como perda).
// Ninguém digita um saldo direto: tudo vira movimento, e nada é lançado sem a confirmação de quem registra. Entradas vêm de
// Compras (conferência da nota ou compra registrada), nunca daqui.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Info, CheckCircle2, ClipboardList } from 'lucide-preact';
import { estoque } from '../../lib/api/estoque';
import { ErroApi, novaChave } from '../../lib/api/cliente';
import { hojeISO, dataHora } from '../../lib/formato';
import type { Usuario } from '../../lib/sessao';
import { Gaveta, avisar, useConfirmacao } from '../../ui/camadas';
import { Botao, Campo, Aviso } from '../../ui/base';
import type { AjusteSaldo, Insumo, MotivoAjuste } from '../../lib/tipos/estoque';
import { atualizarEstoque, conferido, numeroEm, paraBase, textoMotivo, unidadeExibicao, unidadesDaBase, MOTIVO_SAIDA, type PermissoesEstoque } from './comum';

export type TipoMovimentoManual = 'conferir' | 'corrigir' | 'saida';
const TITULO: Record<TipoMovimentoManual, string> = { conferir: 'Conferir quantidade', corrigir: 'Corrigir saldo', saida: 'Perda ou uso interno' };

export function MovimentoInsumo({ tipo, insumo, perm, eu, inicioControle, responsavel, aoFechar, aoIrContagem }: {
  tipo: TipoMovimentoManual | null;
  insumo: Insumo | null;
  perm: PermissoesEstoque;
  eu: Usuario;
  inicioControle: string | null;
  responsavel: (r: string | null | undefined, nome?: string | null) => string | null;
  aoFechar: () => void;
  aoIrContagem: () => void;
}) {
  const aberto = !!tipo && !!insumo && perm.visualizar;
  return (
    <Gaveta aberta={aberto} aoFechar={aoFechar} titulo={tipo ? TITULO[tipo] : 'Insumo'} subtitulo={insumo?.nome}>
      {aberto && tipo === 'saida' && <Saida key={insumo!.id} alvo={insumo!} eu={eu} aoTerminar={aoFechar} />}
      {aberto && tipo !== 'saida' && (
        <Ajuste key={`${tipo}:${insumo!.id}`} corrigir={tipo === 'corrigir'} alvo={insumo!} inicioControle={inicioControle} responsavel={responsavel} aoTerminar={aoFechar} aoIrContagem={aoIrContagem} />
      )}
    </Gaveta>
  );
}

const rotuloUnidade = (alvo: Insumo, fator: 1 | 1000) => unidadesDaBase(alvo.unidade_base).find((u) => u.fator === fator)?.valor ?? alvo.unidade_base;

/** Quantidade com a unidade que as pessoas usam: kg/L ou g/ml (o backend recebe a unidade-base). */
function CampoQuantidade({ rotulo, alvo, valor, aoMudar, fator, aoFator, ajuda }: { rotulo: string; alvo: Insumo; valor: string; aoMudar: (v: string) => void; fator: 1 | 1000; aoFator: (f: 1 | 1000) => void; ajuda?: string }) {
  const opcoes = unidadesDaBase(alvo.unidade_base);
  return (
    <div class="campo-quantidade">
      <Campo rotulo={rotulo} ajuda={ajuda}>
        {(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={valor} onInput={(e) => aoMudar(e.currentTarget.value)} data-autofoco />}
      </Campo>
      {opcoes.length === 1 ? (
        <span class="campo-quantidade__unidade">{opcoes[0].valor}</span>
      ) : (
        <Campo rotulo="Unidade">
          {(id) => (
            <select id={id} class="selecao" value={String(fator)} onChange={(e) => aoFator(Number(e.currentTarget.value) as 1 | 1000)}>
              {opcoes.map((u) => <option key={u.valor} value={String(u.fator)}>{u.valor}</option>)}
            </select>
          )}
        </Campo>
      )}
    </div>
  );
}

const MOTIVOS_SAIDA = [
  ['vencido', 'Venceu'],
  ['quebra', 'Quebrou ou estragou'],
  ['preparo', 'Sobra de preparo descartada'],
  ['uso_interno', 'Uso interno (café da equipe, degustação)'],
  ['outro', 'Outro motivo'],
] as const;
type MotivoSaida = (typeof MOTIVOS_SAIDA)[number][0];

function Saida({ alvo, eu, aoTerminar }: { alvo: Insumo; eu: Usuario; aoTerminar: () => void }) {
  const [qtd, setQtd] = useState('');
  const [fator, setFator] = useState<1 | 1000>(() => unidadeExibicao(alvo.unidade_base, alvo.saldo, alvo.estoque_minimo).fator);
  const [motivo, setMotivo] = useState<MotivoSaida>('vencido');
  const [obs, setObs] = useState('');
  const [data, setData] = useState(hojeISO());
  const [erro, setErro] = useState<string | null>(null);
  const { confirmar, elemento } = useConfirmacao();
  // Uma chave por formulário: reenviar depois de uma falha de rede não lança a saída duas vezes.
  const chave = useRef(novaChave());

  function revisar(e: Event) {
    e.preventDefault();
    const q = paraBase(qtd, fator);
    if (!q || !(Number(q) > 0)) return setErro('Informe a quantidade que saiu.');
    const texto = obs.trim();
    if (motivo === 'outro' && texto.length < 3) return setErro('Conte rapidamente o que aconteceu.');
    setErro(null);
    confirmar({
      titulo: 'Registrar a saída?',
      texto: `${qtd.trim()} ${rotuloUnidade(alvo, fator)} de ${alvo.nome} · ${MOTIVO_SAIDA[motivo]}${texto ? ` (${texto})` : ''}. Sai do estoque agora e fica no histórico com o seu nome.`,
      confirmar: 'Registrar saída',
      acao: async () => {
        try {
          await estoque.registrarPerda(
            { insumo_id: alvo.id, quantidade: q, motivo, observacao: texto ? texto.slice(0, 200) : undefined, ...(data !== hojeISO() ? { ocorreu_em: `${data}T12:00:00-03:00` } : {}) },
            chave.current,
          );
        } catch (x) {
          // Backend anterior a 02/11 não conhece "uso_interno": nada foi lançado, e o painel não troca o motivo sozinho.
          if (x instanceof ErroApi && motivo === 'uso_interno' && x.tipo === 'validacao' && x.campos.motivo)
            throw new ErroApi('validacao', 'O sistema publicado ainda não registra "Uso interno" separado das perdas. Nada foi lançado.');
          throw x;
        }
        atualizarEstoque();
        avisar(`Saída registrada: ${alvo.nome}.`, 'ok');
        aoTerminar();
      },
    });
  }
  return (
    <form class="pilha" onSubmit={revisar} noValidate>
      <CampoQuantidade rotulo="Quantidade que saiu" alvo={alvo} valor={qtd} aoMudar={setQtd} fator={fator} aoFator={setFator} />
      <div class="grade-campos">
        <Campo rotulo="Motivo">
          {(id) => (
            <select id={id} class="selecao" value={motivo} onChange={(e) => setMotivo(e.currentTarget.value as MotivoSaida)}>
              {MOTIVOS_SAIDA.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          )}
        </Campo>
        <Campo rotulo="Data">{(id) => <input id={id} type="date" class="entrada" max={hojeISO()} value={data} onChange={(e) => setData(e.currentTarget.value || hojeISO())} />}</Campo>
        <Campo rotulo="Observação" opcional={motivo !== 'outro'} class="inteiro">{(id) => <textarea id={id} class="area" maxLength={180} value={obs} placeholder={motivo === 'uso_interno' ? 'Ex.: café da equipe' : undefined} onInput={(e) => setObs(e.currentTarget.value)} />}</Campo>
      </div>
      <p class="fraco">Registrado por {eu.nome}.</p>
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao onClick={aoTerminar}>Cancelar</Botao>
        <Botao type="submit" variante="primario">Revisar saída</Botao>
      </div>
      {elemento}
    </form>
  );
}

const MOTIVOS_CORRECAO: [MotivoAjuste, string][] = [
  ['erro_de_registro', 'Um registro estava errado'],
  ['outro', 'Outro motivo'],
];

/** Conferir (contei: motivo contagem_fisica) ou corrigir (justificativa obrigatória) pelo POST /estoque/ajustes: o
 *  backend lança a diferença e devolve saldo anterior, novo, responsável e data. O painel só converte a unidade. Sem a
 *  rota (backend anterior a 02/11), nada é lançado e a pessoa é levada à contagem — o motivo não é simulado. */
function Ajuste({ corrigir, alvo, inicioControle, responsavel, aoTerminar, aoIrContagem }: {
  corrigir: boolean;
  alvo: Insumo;
  inicioControle: string | null;
  responsavel: (r: string | null | undefined, nome?: string | null) => string | null;
  aoTerminar: () => void;
  aoIrContagem: () => void;
}) {
  const [qtd, setQtd] = useState('');
  const [fator, setFator] = useState<1 | 1000>(() => unidadeExibicao(alvo.unidade_base, alvo.saldo, alvo.estoque_minimo).fator);
  const [motivo, setMotivo] = useState<MotivoAjuste>(corrigir ? 'erro_de_registro' : 'contagem_fisica');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [feito, setFeito] = useState<AjusteSaldo | null>(null);
  const { confirmar, elemento } = useConfirmacao();
  const chave = useRef(novaChave());
  useEffect(() => setErro(null), [qtd]);

  const abertura = !conferido(alvo, inicioControle);
  const contado = paraBase(qtd, fator);
  const rotuloU = rotuloUnidade(alvo, fator);
  // Prévia: o ajuste oficial é calculado pelo backend no instante de confirmar (o saldo pode mudar até lá).
  const previa = contado !== null && !abertura ? Number(contado) - Number(alvo.saldo) : null;
  const textoPrevia = previa === null ? '' : previa === 0 ? 'sem diferença' : `${previa > 0 ? '+' : ''}${numeroEm(previa, fator)} ${rotuloU}`;

  function revisar(e: Event) {
    e.preventDefault();
    if (contado === null) return setErro(new ErroApi('validacao', 'Informe quanto há de verdade agora (pode ser 0).'));
    const texto = obs.trim();
    if (corrigir && texto.length < 5) return setErro(new ErroApi('validacao', 'Explique a correção (pelo menos 5 caracteres).'));
    setErro(null);
    confirmar({
      titulo: abertura ? 'Registrar a quantidade inicial?' : corrigir ? 'Corrigir o saldo?' : 'Registrar a conferência?',
      texto: abertura
        ? `${alvo.nome}: ${qtd.trim()} ${rotuloU} passa a ser o ponto de partida do estoque.`
        : `${alvo.nome}: de ${numeroEm(alvo.saldo, fator)} para ${qtd.trim()} ${rotuloU} (${textoPrevia}). Fica no histórico com o seu nome.`,
      confirmar: abertura ? 'Registrar' : corrigir ? 'Corrigir saldo' : 'Registrar conferência',
      acao: async () => {
        try {
          const r = await estoque.ajustar({ insumo_id: alvo.id, quantidade: contado, motivo, observacao: texto || undefined }, chave.current);
          setFeito(r);
          atualizarEstoque();
        } catch (x) {
          // Sem a rota: o aviso abaixo leva à contagem; o diálogo fecha sem erro (nada foi lançado).
          if (x instanceof ErroApi && x.tipo === 'nao_implantado') return void setErro(x);
          throw x;
        }
      },
    });
  }

  if (feito) {
    const u = unidadeExibicao(alvo.unidade_base, feito.saldo_anterior, feito.saldo_novo);
    const dif = Number(feito.diferenca);
    return (
      <div class="pilha">
        <div class="estado" style={{ paddingBottom: '4px' }}>
          <span class="estado__icone" style={{ background: 'var(--ok-suave)', color: 'var(--ok)' }}><CheckCircle2 aria-hidden="true" /></span>
          <h3>{dif !== 0 ? (feito.motivo.startsWith('abertura') ? 'Quantidade inicial registrada' : 'Saldo ajustado') : 'Conferido, sem diferença'}</h3>
        </div>
        <dl class="definicoes" data-teste="ajuste-registrado">
          <dt>Antes</dt><dd class="num">{numeroEm(feito.saldo_anterior, u.fator)} {u.rotulo}</dd>
          <dt>Agora</dt><dd class="num">{numeroEm(feito.saldo_novo, u.fator)} {u.rotulo}</dd>
          <dt>Diferença</dt><dd class="num"><strong data-sinal={dif < 0 ? '-' : '+'}>{dif > 0 ? '+' : ''}{numeroEm(feito.diferenca, u.fator)} {u.rotulo}</strong></dd>
          <dt>Motivo</dt><dd>{textoMotivo(feito.motivo)}</dd>
          <dt>Responsável</dt><dd>{responsavel(feito.registrado_por, feito.registrado_por_nome)}</dd>
          <dt>Data</dt><dd>{dataHora(feito.ocorreu_em)}</dd>
        </dl>
        {dif === 0 && <p class="fraco">Sem diferença não há lançamento: fica registrada a data da conferência.</p>}
        <Botao variante="primario" onClick={aoTerminar} style={{ alignSelf: 'flex-end' }}>Concluir</Botao>
      </div>
    );
  }

  const semRota = erro?.tipo === 'nao_implantado';
  return (
    <form class="pilha" onSubmit={revisar} noValidate>
      <dl class="definicoes">
        <dt>No sistema</dt>
        <dd class="num">{abertura ? <span class="fraco">Ainda não conferido</span> : `${numeroEm(alvo.saldo, fator)} ${rotuloU}`}</dd>
      </dl>
      <CampoQuantidade
        rotulo={corrigir ? 'Saldo correto' : 'Quantidade que há agora'}
        alvo={alvo}
        valor={qtd}
        aoMudar={setQtd}
        fator={fator}
        aoFator={setFator}
        ajuda={abertura ? 'Primeira conferência: vira a quantidade inicial deste insumo.' : undefined}
      />
      {previa !== null && (
        <p class="ajuste-previa" role="status">
          Diferença prevista: <strong class="num" data-sinal={previa < 0 ? '-' : '+'}>{textoPrevia}</strong>
        </p>
      )}
      {corrigir ? (
        <div class="grade-campos">
          <Campo rotulo="Motivo">
            {(id) => (
              <select id={id} class="selecao" value={motivo} onChange={(e) => setMotivo(e.currentTarget.value as MotivoAjuste)}>
                {MOTIVOS_CORRECAO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            )}
          </Campo>
          <Campo rotulo="Justificativa" class="inteiro">{(id) => <textarea id={id} class="area" maxLength={200} value={obs} placeholder="Ex.: entrada lançada em dobro" onInput={(e) => setObs(e.currentTarget.value)} />}</Campo>
        </div>
      ) : (
        <Campo rotulo="Observação" opcional>{(id) => <textarea id={id} class="area" maxLength={200} value={obs} onInput={(e) => setObs(e.currentTarget.value)} />}</Campo>
      )}
      {erro && (
        <Aviso tom={semRota ? 'atencao' : 'perigo'} icone={<Info aria-hidden="true" />}>
          {semRota ? 'O sistema publicado ainda não registra ajuste com motivo. Nada foi lançado: use a contagem (registra o antes, o contado e o responsável).' : erro.message}
          {semRota && <div style={{ marginTop: '6px' }}><Botao tamanho="p" icone={<ClipboardList aria-hidden="true" />} onClick={aoIrContagem}>Contar estoque</Botao></div>}
        </Aviso>
      )}
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao onClick={aoTerminar}>Cancelar</Botao>
        <Botao type="submit" variante="primario">{corrigir ? 'Revisar correção' : 'Revisar conferência'}</Botao>
      </div>
      {elemento}
    </form>
  );
}
