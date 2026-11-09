// Insumos: a tela principal do Estoque, numa tabela compacta para dezenas ou centenas de itens — nome, quantidade com a
// unidade, estoque mínimo, custo médio, situação e o botão de detalhes (gaveta DetalheInsumo, com o ideal, a última
// conferência, o histórico e o ajuste). Uma busca e duas ações ("Contar estoque" e "Novo insumo"). Item nunca conferido
// aparece "Não conferido", nunca com um zero que ninguém contou. Baixa pelas vendas desligada = os saldos não descontam o
// que foi vendido: uma nota discreta no rodapé enquanto for verdade.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Search, Plus, ClipboardList, Info, Undo2, ChevronRight } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { plural, custoBase } from '../../lib/formato';
import { Aviso, Botao, Cartao } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { Insumo } from '../../lib/tipos/estoque';
import { SITUACAO_ESTOQUE, SituacaoEstoque, situacaoEstoque, unidadeExibicao, numeroEm, type CodigoSituacao, type PermissoesEstoque } from './comum';

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

  const linhas = useMemo(() => {
    const t = busca.toLowerCase();
    return (fonte.dados?.itens ?? []).filter((i) => muitos || !t || i.nome.toLowerCase().includes(t) || i.codigo.toLowerCase().includes(t));
  }, [fonte.dados, busca]);

  // Tabela enxuta para dezenas ou centenas de insumos: o ideal, a última conferência e o histórico ficam no detalhe.
  const colunas: Coluna<Insumo>[] = [
    { id: 'nome', titulo: 'Nome', ordenar: (i) => i.nome, celula: (i) => <><span class="principal-celula">{i.nome}</span>{(i.categoria || i.tipo === 'preparo') && <span class="sub">{[i.categoria, i.tipo === 'preparo' ? 'preparo da casa' : null].filter(Boolean).join(' · ')}</span>}</> },
    { id: 'quantidade', titulo: 'Quantidade', numero: true, ordenar: (i) => (situacao(i) === 'nao_conferido' ? -Infinity : Number(i.saldo)), celula: (i) => <Quantidade i={i} s={situacao(i)} /> },
    { id: 'minimo', titulo: 'Estoque mínimo', numero: true, prioridade: 'media', ordenar: (i) => Number(i.estoque_minimo ?? -1), celula: (i) => <ComUnidade i={i} v={i.estoque_minimo} /> },
    { id: 'custo', titulo: 'Custo médio', numero: true, prioridade: 'media', ordenar: (i) => Number(i.custo_medio ?? -1), celula: (i) => (i.custo_medio === null ? <span class="fraco">—</span> : <span class="num">{custoBase(i.custo_medio, i.unidade_base)}</span>) },
    { id: 'situacao', titulo: 'Situação', ordenar: (i) => ['sem', 'baixo', 'nao_conferido', 'normal'].indexOf(situacao(i)), celula: (i) => <SituacaoEstoque codigo={situacao(i)} /> },
    {
      id: 'acoes',
      titulo: '',
      celula: (i) => <Botao tamanho="p" variante="fantasma" icone={<ChevronRight aria-hidden="true" />} aria-label={`Detalhes de ${i.nome}`} onClick={() => aoAbrir(i.id)}>Detalhes</Botao>,
    },
  ];

  const baixaDesligada = resumo.dados ? !resumo.dados.baixa_automatica : false;
  const cancelamentos = resumo.dados?.cancelamentos_pendentes ?? 0;

  return (
    <>
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
            {/* Lista vazia: o cadastro fica só no convite do meio da tela (um botão por vez). */}
            {perm.editar && itens.length > 0 && <Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={aoNovo}>Novo insumo</Botao>}
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
              {(d.total > d.itens.length || (baixaDesligada && itens.length > 0)) && (
                <div class="cartao__rodape estoque-rodape">
                  {baixaDesligada && itens.length > 0 && <span class="estoque-rodape__nota" data-teste="baixa-desligada"><Info size={14} aria-hidden="true" /> As vendas ainda não descontam do estoque.</span>}
                  {d.total > d.itens.length && <span>Mostrando {d.itens.length} de {plural(d.total, 'insumo', 'insumos')}: use a busca para achar os demais.</span>}
                </div>
              )}
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
