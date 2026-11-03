// Estoque atual: a primeira tela do módulo. O que temos, quanto, o que está acabando e o que nunca foi conferido — com
// os saldos que o backend calcula (GET /admin/estoque/insumos). Item sem contagem aparece "Não conferido", nunca com um
// zero que ninguém contou. Três números discretos no topo, uma busca, dois filtros que só aparecem quando ajudam, e o
// detalhe numa gaveta (DetalheInsumo). Baixa automática pelas vendas: só uma linha, com o estado real.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Search, Plus, Info, Undo2 } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { plural, inteiro } from '../../lib/formato';
import { Botao, Cartao } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { Insumo } from '../../lib/tipos/estoque';
import { SITUACAO_ESTOQUE, SituacaoEstoque, situacaoEstoque, unidadeExibicao, numeroEm, type CodigoSituacao, type PermissoesEstoque } from './comum';

const ESPERA_BUSCA_MS = 250;
type Filtro = 'todos' | 'baixo' | 'nao_conferido';

export function EstoqueAtual({ perm, aoAbrir, aoNovo, aoIrRecebimentos, aoCancelamentos }: {
  perm: PermissoesEstoque;
  aoAbrir: (id: string) => void;
  aoNovo: () => void;
  aoIrRecebimentos: () => void;
  aoCancelamentos: () => void;
}) {
  const [digitado, setDigitado] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [categoria, setCategoria] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setBusca(digitado.trim()), ESPERA_BUSCA_MS);
    return () => clearTimeout(t);
  }, [digitado]);

  const resumo = useConsulta('estoque/resumo', () => estoque.resumo());
  // A lista inteira (até 200) vem de uma vez: situação e categoria filtram aqui, sem nova consulta. A busca vai ao
  // backend (nome e código) só quando há mais insumos do que cabem numa página.
  const todos = useConsulta('estoque/insumos?catalogo', () => estoque.insumos({ limite: 200 }));
  const muitos = (todos.dados?.total ?? 0) > (todos.dados?.itens.length ?? 0);
  const buscados = useConsulta(muitos && busca ? `estoque/insumos?busca:${busca}` : null, () => estoque.insumos({ busca, limite: 200 }));
  const fonte = muitos && busca ? buscados : todos;
  const recebimentos = useConsulta(perm.conferir ? 'estoque/compras?conferir' : null, () => estoque.compras({ etapa: 'aguardando_conferencia', limite: 20 }));

  const inicio = resumo.dados?.inicio_controle ?? null;
  const situacao = (i: Insumo): CodigoSituacao => situacaoEstoque(i, inicio);
  const itens = todos.dados?.itens ?? [];
  const categorias = useMemo(() => [...new Set(itens.map((i) => i.categoria).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [itens]);
  const abaixo = itens.filter((i) => situacao(i) === 'baixo' || situacao(i) === 'sem').length;

  const linhas = useMemo(() => {
    const t = busca.toLowerCase();
    return (fonte.dados?.itens ?? []).filter((i) => {
      const s = situacao(i);
      if (filtro === 'baixo' && s !== 'baixo' && s !== 'sem') return false;
      if (filtro === 'nao_conferido' && s !== 'nao_conferido') return false;
      if (categoria && i.categoria !== categoria) return false;
      return muitos || !t || i.nome.toLowerCase().includes(t) || i.codigo.toLowerCase().includes(t);
    });
  }, [fonte.dados, filtro, categoria, busca, inicio]);

  const colunas: Coluna<Insumo>[] = [
    { id: 'nome', titulo: 'Insumo', ordenar: (i) => i.nome, celula: (i) => <><span class="principal-celula">{i.nome}</span>{i.tipo === 'preparo' && <span class="sub">Preparo da casa</span>}</> },
    { id: 'categoria', titulo: 'Categoria', prioridade: 'baixa', ordenar: (i) => i.categoria ?? '', celula: (i) => <span class="fraco">{i.categoria ?? '—'}</span> },
    { id: 'quantidade', titulo: 'Disponível', numero: true, ordenar: (i) => (situacao(i) === 'nao_conferido' ? -Infinity : Number(i.saldo)), celula: (i) => <Quantidade i={i} s={situacao(i)} /> },
    { id: 'unidade', titulo: 'Unidade', celula: (i) => <span class="fraco">{unidadeExibicao(i.unidade_base, i.saldo, i.estoque_minimo).rotulo}</span> },
    { id: 'minimo', titulo: 'Mínimo', numero: true, prioridade: 'media', ordenar: (i) => Number(i.estoque_minimo ?? -1), celula: (i) => <span class="num fraco">{numeroEm(i.estoque_minimo, unidadeExibicao(i.unidade_base, i.saldo, i.estoque_minimo).fator)}</span> },
    { id: 'situacao', titulo: 'Situação', ordenar: (i) => ['sem', 'baixo', 'nao_conferido', 'normal'].indexOf(situacao(i)), celula: (i) => <SituacaoEstoque codigo={situacao(i)} /> },
  ];

  return (
    <>
      <section class="estoque-numeros" aria-label="Resumo do estoque">
        <Numero rotulo="Insumos cadastrados" valor={todos.dados ? inteiro(todos.dados.total) : null} />
        <Numero rotulo="Abaixo do mínimo" valor={todos.dados && resumo.dados ? inteiro(abaixo) : null} tom={abaixo ? 'atencao' : undefined} acao={abaixo ? () => setFiltro('baixo') : undefined} />
        {perm.conferir && <Numero rotulo="Recebimentos pendentes" valor={recebimentos.dados ? inteiro(recebimentos.dados.total) : null} tom={recebimentos.dados?.total ? 'atencao' : undefined} acao={recebimentos.dados?.total ? aoIrRecebimentos : undefined} />}
      </section>

      <Cartao justo>
        <div class="estoque-filtros">
          <div class="entrada-grupo estoque-filtros__busca">
            <Search aria-hidden="true" />
            <input class="entrada" type="search" placeholder="Buscar insumo" aria-label="Buscar insumo" value={digitado} onInput={(e) => setDigitado(e.currentTarget.value)} />
          </div>
          <select class="selecao selecao--auto" aria-label="Situação" value={filtro} onChange={(e) => setFiltro(e.currentTarget.value as Filtro)}>
            <option value="todos">Todas as situações</option>
            <option value="baixo">Estoque baixo ou sem estoque</option>
            <option value="nao_conferido">Não conferidos</option>
          </select>
          {categorias.length > 1 && (
            <select class="selecao selecao--auto" aria-label="Categoria" value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
              <option value="">Todas as categorias</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {perm.editar && <Botao class="estoque-filtros__acao" icone={<Plus aria-hidden="true" />} onClick={aoNovo}>Novo insumo</Botao>}
        </div>
        <Dados consulta={fonte} recurso="O estoque" esqueleto={<EsqueletoTabela linhas={8} />}>
          {(d) => (
            <>
              <Tabela
                rotulo="Estoque atual"
                colunas={colunas}
                linhas={linhas}
                chave={(i) => i.id}
                aoAbrir={(i) => aoAbrir(i.id)}
                apagada={(i) => !i.ativo}
                porPagina={100}
                movel={(i) => <LinhaMovel i={i} s={situacao(i)} />}
                vazio={
                  itens.length === 0 && !busca ? (
                    <Vazio titulo="Nenhum insumo cadastrado">{perm.editar ? 'Cadastre cada ingrediente uma vez; recebimentos e contagens passam a formar o saldo.' : 'A gerência cadastra os insumos.'}</Vazio>
                  ) : (
                    <Vazio compacto titulo={busca ? 'Nenhum insumo com essa busca' : 'Nenhum insumo nesta situação'} />
                  )
                }
              />
              {d.total > d.itens.length && <div class="cartao__rodape">Mostrando {d.itens.length} de {plural(d.total, 'insumo', 'insumos')}: use a busca para achar os demais.</div>}
            </>
          )}
        </Dados>
      </Cartao>

      {resumo.dados && (
        <p class="estoque-status">
          <span>Saldo = contagens + entradas − saídas registradas.</span>
          {resumo.dados.cancelamentos_pendentes > 0 && (
            <button type="button" class="link estoque-status__link" onClick={aoCancelamentos}><Undo2 size={14} aria-hidden="true" /> {plural(resumo.dados.cancelamentos_pendentes, 'venda cancelada a responder', 'vendas canceladas a responder')}</button>
          )}
          <span class="estoque-status__baixa" title="Ligada só depois dos saldos iniciais conferidos, das fichas completas e dos produtos vinculados à Eyemobile, com homologação.">
            <Info aria-hidden="true" /> Baixa automática pelas vendas: <strong>{resumo.dados.baixa_automatica ? 'ligada' : 'desligada'}</strong>
          </span>
        </p>
      )}
    </>
  );
}

function Numero({ rotulo, valor, tom, acao }: { rotulo: string; valor: string | null; tom?: 'atencao'; acao?: () => void }) {
  const corpo = (
    <>
      <span class="estoque-numero__rotulo">{rotulo}</span>
      {valor === null ? <span class="esqueleto" style={{ height: '24px', width: '48px' }} /> : <span class="estoque-numero__valor num" data-tom={tom}>{valor}</span>}
    </>
  );
  return acao ? <button type="button" class="estoque-numero" onClick={acao}>{corpo}</button> : <div class="estoque-numero">{corpo}</div>;
}

/** Quantidade disponível. Sem contagem: "—" quando nada foi registrado, ou o registrado esmaecido (entradas sem saldo
 *  de partida), nunca um zero apresentado como real. */
function Quantidade({ i, s }: { i: Insumo; s: CodigoSituacao }) {
  const u = unidadeExibicao(i.unidade_base, i.saldo, i.estoque_minimo);
  if (s === 'nao_conferido') {
    if (i.motivo_nao_confiavel === 'sem_movimento' || Number(i.saldo) === 0) return <span class="num fraco" aria-label="Quantidade não conferida">—</span>;
    return <><span class="num fraco">{numeroEm(i.saldo, u.fator)}</span><span class="sub">só entradas, sem contagem</span></>;
  }
  return (
    <>
      <span class={`num estoque-qtd${s === 'sem' || s === 'baixo' ? ' estoque-qtd--alerta' : ''}`} data-situacao={s}>{numeroEm(i.saldo, u.fator)}</span>
      {Number(i.saldo) < 0 && <span class="sub">negativo: falta registrar entrada ou contar</span>}
    </>
  );
}

function LinhaMovel({ i, s }: { i: Insumo; s: CodigoSituacao }) {
  const u = unidadeExibicao(i.unidade_base, i.saldo, i.estoque_minimo);
  const semNumero = s === 'nao_conferido' && (i.motivo_nao_confiavel === 'sem_movimento' || Number(i.saldo) === 0);
  return (
    <div class="estoque-movel">
      <span class="estoque-movel__nome">{i.nome}{i.categoria && <span class="sub">{i.categoria}</span>}</span>
      <span class="estoque-movel__qtd">
        <strong class={`num${s === 'nao_conferido' ? ' fraco' : ''}`}>{semNumero ? '—' : `${numeroEm(i.saldo, u.fator)} ${u.rotulo}`}</strong>
        {i.estoque_minimo !== null && <span class="sub">mín. {numeroEm(i.estoque_minimo, u.fator)} {u.rotulo}</span>}
      </span>
      <span class="estoque-movel__sit" aria-label={`Situação: ${SITUACAO_ESTOQUE[s].rotulo}`}><SituacaoEstoque codigo={s} /></span>
    </div>
  );
}
