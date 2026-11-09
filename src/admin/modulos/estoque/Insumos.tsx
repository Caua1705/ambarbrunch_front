// Insumos: a tela principal do Estoque. O que temos, quanto (estimado pelo backend em GET /admin/estoque/insumos), o
// mínimo, o ideal, o preço médio de compra, a situação e a última conferência. Uma busca, duas ações ("Contar estoque" e
// "Novo insumo") e o detalhe numa gaveta (DetalheInsumo). Item nunca conferido aparece "Não conferido", nunca com um zero
// que ninguém contou. Baixa pelas vendas desligada = os saldos não descontam o que foi vendido: um aviso discreto enquanto
// for verdade; ligada, nada a destacar.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Search, Plus, ClipboardList, Info, Undo2 } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { plural, custoBase, dataCurta } from '../../lib/formato';
import { Aviso, Botao, Cartao } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { Insumo } from '../../lib/tipos/estoque';
import { SITUACAO_ESTOQUE, SituacaoEstoque, situacaoEstoque, unidadeExibicao, numeroEm, aceitaEstoqueIdeal, type CodigoSituacao, type PermissoesEstoque } from './comum';

const ESPERA_BUSCA_MS = 250;

export function Insumos({ perm, aoAbrir, aoNovo, aoContar, aoCancelamentos }: {
  perm: PermissoesEstoque;
  aoAbrir: (id: string) => void;
  aoNovo: () => void;
  aoContar: () => void;
  aoCancelamentos: () => void;
}) {
  const [digitado, setDigitado] = useState('');
  const [busca, setBusca] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setBusca(digitado.trim()), ESPERA_BUSCA_MS);
    return () => clearTimeout(t);
  }, [digitado]);

  const resumo = useConsulta('estoque/resumo', () => estoque.resumo());
  // A lista inteira (até 200) vem de uma vez e a busca filtra aqui; com mais insumos do que cabem, a busca vai ao backend.
  const todos = useConsulta('estoque/insumos?catalogo', () => estoque.insumos({ limite: 200 }));
  const muitos = (todos.dados?.total ?? 0) > (todos.dados?.itens.length ?? 0);
  const buscados = useConsulta(muitos && busca ? `estoque/insumos?busca:${busca}` : null, () => estoque.insumos({ busca, limite: 200 }));
  const fonte = muitos && busca ? buscados : todos;

  const inicio = resumo.dados?.inicio_controle ?? null;
  const situacao = (i: Insumo): CodigoSituacao => situacaoEstoque(i, inicio);
  const itens = todos.dados?.itens ?? [];
  const comIdeal = aceitaEstoqueIdeal(itens[0]);

  const linhas = useMemo(() => {
    const t = busca.toLowerCase();
    return (fonte.dados?.itens ?? []).filter((i) => muitos || !t || i.nome.toLowerCase().includes(t) || i.codigo.toLowerCase().includes(t));
  }, [fonte.dados, busca]);

  const colunas: Coluna<Insumo>[] = [
    { id: 'nome', titulo: 'Insumo', ordenar: (i) => i.nome, celula: (i) => <><span class="principal-celula">{i.nome}</span>{(i.categoria || i.tipo === 'preparo') && <span class="sub">{[i.categoria, i.tipo === 'preparo' ? 'preparo da casa' : null].filter(Boolean).join(' · ')}</span>}</> },
    { id: 'quantidade', titulo: 'Quantidade', numero: true, ordenar: (i) => (situacao(i) === 'nao_conferido' ? -Infinity : Number(i.saldo)), celula: (i) => <Quantidade i={i} s={situacao(i)} /> },
    { id: 'minimo', titulo: 'Mínimo', numero: true, prioridade: 'media', ordenar: (i) => Number(i.estoque_minimo ?? -1), celula: (i) => <ComUnidade i={i} v={i.estoque_minimo} /> },
    ...(comIdeal ? [{ id: 'ideal', titulo: 'Ideal', numero: true, prioridade: 'media', ordenar: (i: Insumo) => Number(i.estoque_ideal ?? -1), celula: (i: Insumo) => <ComUnidade i={i} v={i.estoque_ideal} /> } satisfies Coluna<Insumo>] : []),
    { id: 'preco', titulo: 'Preço médio', numero: true, prioridade: 'media', ordenar: (i) => Number(i.custo_medio ?? -1), celula: (i) => (i.custo_medio === null ? <span class="fraco">—</span> : <span class="num">{custoBase(i.custo_medio, i.unidade_base)}</span>) },
    { id: 'situacao', titulo: 'Situação', ordenar: (i) => ['sem', 'baixo', 'nao_conferido', 'normal'].indexOf(situacao(i)), celula: (i) => <SituacaoEstoque codigo={situacao(i)} /> },
    { id: 'conferido', titulo: 'Conferido em', prioridade: 'media', ordenar: (i) => i.ultima_contagem_em ?? '', celula: (i) => (i.ultima_contagem_em ? <span class="num" style={{ whiteSpace: 'nowrap' }}>{dataCurta(i.ultima_contagem_em.slice(0, 10))}</span> : <span class="fraco">Nunca</span>) },
  ];

  const baixaDesligada = resumo.dados ? !resumo.dados.baixa_automatica : false;
  const cancelamentos = resumo.dados?.cancelamentos_pendentes ?? 0;

  return (
    <>
      {baixaDesligada && itens.length > 0 && (
        <Aviso tom="atencao" icone={<Info aria-hidden="true" />}>
          <strong>As vendas ainda não descontam do estoque.</strong> As quantidades somam contagens, compras e saídas registradas: confira com “Contar estoque” antes de confiar nelas.
        </Aviso>
      )}
      {cancelamentos > 0 && (
        <Aviso tom="atencao" icone={<Undo2 aria-hidden="true" />}>
          <button type="button" class="link" onClick={aoCancelamentos}>{plural(cancelamentos, 'venda cancelada espera resposta', 'vendas canceladas esperam resposta')}</button>: o produto chegou a ser preparado?
        </Aviso>
      )}

      <Cartao justo>
        <div class="estoque-filtros">
          <div class="entrada-grupo estoque-filtros__busca">
            <Search aria-hidden="true" />
            <input class="entrada" type="search" placeholder="Buscar insumo" aria-label="Buscar insumo" value={digitado} onInput={(e) => setDigitado(e.currentTarget.value)} />
          </div>
          <div class="estoque-filtros__acao">
            {perm.visualizar && itens.length > 0 && <Botao icone={<ClipboardList aria-hidden="true" />} onClick={aoContar}>Contar estoque</Botao>}
            {perm.editar && <Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={aoNovo}>Novo insumo</Botao>}
          </div>
        </div>
        <Dados consulta={fonte} recurso="Os insumos" esqueleto={<EsqueletoTabela linhas={8} />}>
          {(d) => (
            <>
              <Tabela
                rotulo="Insumos"
                colunas={colunas}
                linhas={linhas}
                chave={(i) => i.id}
                aoAbrir={(i) => aoAbrir(i.id)}
                apagada={(i) => !i.ativo}
                porPagina={100}
                movel={(i) => <LinhaMovel i={i} s={situacao(i)} />}
                vazio={
                  itens.length === 0 && !busca ? (
                    <Vazio
                      titulo="Nenhum insumo cadastrado"
                      acao={perm.editar ? <Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={aoNovo}>Cadastrar o primeiro insumo</Botao> : undefined}
                    >
                      {perm.editar ? 'Cadastre cada ingrediente uma vez. Depois, “Contar estoque” registra o que há na prateleira.' : 'A gerência cadastra os insumos.'}
                    </Vazio>
                  ) : (
                    <Vazio compacto titulo="Nenhum insumo com essa busca" />
                  )
                }
              />
              {d.total > d.itens.length && <div class="cartao__rodape">Mostrando {d.itens.length} de {plural(d.total, 'insumo', 'insumos')}: use a busca para achar os demais.</div>}
            </>
          )}
        </Dados>
      </Cartao>
    </>
  );
}

/** Mínimo ou ideal na mesma unidade da quantidade ("5 kg"); sem valor, um traço. */
function ComUnidade({ i, v }: { i: Insumo; v: string | null | undefined }) {
  if (v === null || v === undefined) return <span class="fraco">—</span>;
  const u = unidadeExibicao(i.unidade_base, i.saldo, i.estoque_minimo, i.estoque_ideal);
  return <span class="num fraco" style={{ whiteSpace: 'nowrap' }}>{numeroEm(v, u.fator)} {u.rotulo}</span>;
}

/** Quantidade estimada. Sem contagem: "—" quando nada foi registrado, ou o registrado esmaecido (entradas sem saldo de
 *  partida), nunca um zero apresentado como real. */
function Quantidade({ i, s }: { i: Insumo; s: CodigoSituacao }) {
  const u = unidadeExibicao(i.unidade_base, i.saldo, i.estoque_minimo, i.estoque_ideal);
  if (s === 'nao_conferido') {
    if (i.motivo_nao_confiavel === 'sem_movimento' || Number(i.saldo) === 0) return <span class="num fraco" aria-label="Quantidade não conferida">—</span>;
    return <><span class="num fraco">{numeroEm(i.saldo, u.fator)} {u.rotulo}</span><span class="sub">só compras, sem contagem</span></>;
  }
  return (
    <>
      <span class={`num estoque-qtd${s === 'sem' || s === 'baixo' ? ' estoque-qtd--alerta' : ''}`} data-situacao={s}>{numeroEm(i.saldo, u.fator)}</span> <span class="estoque-qtd__un">{u.rotulo}</span>
      {Number(i.saldo) < 0 && <span class="sub">negativo: conte de novo</span>}
    </>
  );
}

function LinhaMovel({ i, s }: { i: Insumo; s: CodigoSituacao }) {
  const u = unidadeExibicao(i.unidade_base, i.saldo, i.estoque_minimo, i.estoque_ideal);
  const semNumero = s === 'nao_conferido' && (i.motivo_nao_confiavel === 'sem_movimento' || Number(i.saldo) === 0);
  return (
    <div class="estoque-movel">
      <span class="estoque-movel__nome">{i.nome}<span class="sub">{[i.categoria, i.custo_medio !== null ? custoBase(i.custo_medio, i.unidade_base) : null].filter(Boolean).join(' · ')}</span></span>
      <span class="estoque-movel__qtd">
        <strong class={`num${s === 'nao_conferido' ? ' fraco' : ''}`}>{semNumero ? '—' : `${numeroEm(i.saldo, u.fator)} ${u.rotulo}`}</strong>
        {i.estoque_minimo !== null && <span class="sub">mín. {numeroEm(i.estoque_minimo, u.fator)} {u.rotulo}</span>}
      </span>
      <span class="estoque-movel__sit" aria-label={`Situação: ${SITUACAO_ESTOQUE[s].rotulo}`}><SituacaoEstoque codigo={s} /></span>
    </div>
  );
}
