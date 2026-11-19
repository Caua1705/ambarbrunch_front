// Contas recorrentes (aba própria): aluguel, internet, sistemas. Cadastradas uma vez; a obrigação de cada mês nasce
// sozinha em Contas a pagar (o backend não duplica a mesma competência) e, paga, sai de lá — a recorrente continua.
// Busca, "+ Conta recorrente" e uma tabela compacta: Descrição, Valor previsto, Próximo vencimento. A linha abre o
// detalhe, onde ficam Editar, Pausar/Retomar, Encerrar e Excluir (com prévia do que sai de Contas a pagar). Encerradas e
// excluídas não aparecem. Rotas: GET/POST/PATCH /admin/financeiro/recorrencias, GET …/{id}/exclusao, POST …/{id}/excluir.
import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Plus, Search, Pencil, Pause, Play, CalendarX, Trash2 } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta } from '../../lib/formato';
import { Botao, Cartao, Situacao } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import { Gaveta } from '../../ui/camadas';
import type { Recorrencia } from '../../lib/tipos/financeiro';
import { temPermissao, atualizarFinanceiro, avisar, avisarFalha, useNomeCategoria } from './comum';
import { EditarRecorrencia, EncerrarRecorrencia, ExcluirRecorrencia } from './ContasFixas';

export function ContasRecorrentes({ contexto }: { contexto: ContextoPainel }) {
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  const [busca, setBusca] = useState('');
  const [editar, setEditar] = useState<Recorrencia | 'nova' | null>(null);
  const [encerrar, setEncerrar] = useState<Recorrencia | null>(null);
  const [excluir, setExcluir] = useState<Recorrencia | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const lista = useConsulta('financeiro/recorrencias:todas', () => financeiro.recorrencias(false));

  async function pausar(r: Recorrencia) {
    setOcupado(r.id);
    try {
      await financeiro.pausarRecorrencia(r.id, r.versao, r.ativo);
      atualizarFinanceiro();
      avisar(r.ativo ? 'Recorrência pausada.' : 'Recorrência retomada.', 'ok');
      setAberta(null);
    } catch (e) {
      avisarFalha(e);
    } finally {
      setOcupado(null);
    }
  }

  const colunas: Coluna<Recorrencia>[] = [
    {
      id: 'descricao', titulo: 'Descrição', ordenar: (r) => r.descricao,
      celula: (r) => <><span class="principal-celula">{r.descricao}</span>{r.fornecedor && <span class="sub">{r.fornecedor.nome}</span>}</>,
    },
    { id: 'valor', titulo: 'Valor previsto', numero: true, ordenar: (r) => Number(r.valor_previsto), celula: (r) => <span class="num">{moeda(r.valor_previsto)}</span> },
    {
      id: 'proximo', titulo: 'Próximo vencimento', ordenar: (r) => r.proximas[0]?.vencimento ?? '9999',
      celula: (r) => (r.ativo ? <span class="num">{r.proximas[0] ? dataCurta(r.proximas[0].vencimento) : '—'}</span> : <Situacao tom="apagado">Pausada</Situacao>),
    },
  ];

  return (
    <>
      <div class="barra-ferramentas">
        <div class="entrada-grupo barra-ferramentas__busca">
          <Search aria-hidden="true" />
          <input class="entrada" type="search" placeholder="Buscar conta ou fornecedor" aria-label="Buscar conta recorrente" maxLength={80} value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
        </div>
        {lancar && (
          <div class="barra-ferramentas__acoes">
            <Botao tamanho="p" variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setEditar('nova')}>Conta recorrente</Botao>
          </div>
        )}
      </div>
      <Cartao justo>
        <Dados consulta={lista} recurso="As contas recorrentes" esqueleto={<EsqueletoTabela />}>
          {(rs) => {
            const termo = busca.trim().toLocaleLowerCase('pt-BR');
            const linhas = rs.filter((r) => !r.fim && (!termo || `${r.descricao} ${r.fornecedor?.nome ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo)));
            return (
              <Tabela rotulo="Contas recorrentes" colunas={colunas} linhas={linhas} chave={(r) => r.id} ordemInicial={{ coluna: 'proximo' }} aoAbrir={(r) => setAberta(r.id)}
                vazio={termo ? <Vazio compacto titulo="Nenhuma conta com essa busca">Procure pela descrição ou pelo fornecedor.</Vazio>
                  : <Vazio compacto titulo="Nenhuma conta recorrente">Cadastre uma vez; a conta de cada mês aparece em Contas a pagar.</Vazio>} />
            );
          }}
        </Dados>
      </Cartao>
      <DetalheRecorrencia r={aberta ? (lista.dados ?? []).find((x) => x.id === aberta) ?? null : null} lancar={lancar} ocupado={ocupado}
        aoFechar={() => setAberta(null)} aoEditar={(r) => { setAberta(null); setEditar(r); }} aoPausar={pausar}
        aoEncerrar={(r) => { setAberta(null); setEncerrar(r); }} aoExcluir={(r) => { setAberta(null); setExcluir(r); }} />
      <EditarRecorrencia alvo={editar} aoFechar={() => setEditar(null)} />
      <EncerrarRecorrencia alvo={encerrar} aoFechar={() => setEncerrar(null)} />
      <ExcluirRecorrencia alvo={excluir} aoFechar={() => setExcluir(null)} />
    </>
  );
}

/** Detalhe da recorrência: dados, próximos vencimentos, observações (0043), detalhamento-base (folha) e as ações. */
function DetalheRecorrencia({ r, lancar, ocupado, aoFechar, aoEditar, aoPausar, aoEncerrar, aoExcluir }: {
  r: Recorrencia | null; lancar: boolean; ocupado: string | null; aoFechar: () => void;
  aoEditar: (r: Recorrencia) => void; aoPausar: (r: Recorrencia) => void; aoEncerrar: (r: Recorrencia) => void;
  aoExcluir: (r: Recorrencia) => void;
}) {
  const nome = useNomeCategoria();
  if (!r) return null;
  return (
    <Gaveta aberta aoFechar={aoFechar} titulo={r.descricao} subtitulo={r.ativo ? 'Conta recorrente' : 'Conta recorrente · pausada'}
      rodape={lancar ? (
        <>
          <Botao variante="perigo" icone={<Trash2 aria-hidden="true" />} onClick={() => aoExcluir(r)}>Excluir</Botao>
          <Botao icone={<CalendarX aria-hidden="true" />} onClick={() => aoEncerrar(r)}>Encerrar</Botao>
          <Botao carregando={ocupado === r.id} icone={r.ativo ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} onClick={() => aoPausar(r)}>{r.ativo ? 'Pausar' : 'Retomar'}</Botao>
          {r.ativo && <Botao variante="primario" icone={<Pencil aria-hidden="true" />} onClick={() => aoEditar(r)}>Editar</Botao>}
        </>
      ) : undefined}>
      <div class="pilha">
        <dl class="definicoes">
          <dt>Valor previsto</dt>
          <dd class="num forte">{moeda(r.valor_previsto)}{r.valor_variavel ? <span class="fraco"> · variável</span> : null}</dd>
          <dt>Categoria</dt>
          <dd>{nome(r.categoria_codigo)}</dd>
          <dt>Fornecedor</dt>
          <dd>{r.fornecedor ? r.fornecedor.nome : <span class="fraco">Não informado</span>}</dd>
          <dt>Vencimento</dt>
          <dd>Dia {r.dia_vencimento}{r.intervalo_meses > 1 ? `, a cada ${r.intervalo_meses} meses` : ', todo mês'}</dd>
          <dt>Próximos</dt>
          <dd>{r.ativo && r.proximas.length ? r.proximas.slice(0, 3).map((p) => dataCurta(p.vencimento)).join(' · ') : <span class="fraco">—</span>}</dd>
        </dl>
        {r.observacoes && (
          <section class="pilha pilha--p">
            <h3 class="secao-titulo">Observações</h3>
            <p class="fin-observacoes">{r.observacoes}</p>
          </section>
        )}
        {r.itens && r.itens.length > 0 && (
          <section class="pilha pilha--p">
            <h3 class="secao-titulo">Detalhamento</h3>
            <dl class="definicoes">
              {r.itens.map((i, n) => (
                <Fragment key={n}>
                  <dt>{i.descricao}{i.observacao ? <span class="sub">{i.observacao}</span> : null}</dt>
                  <dd class="num">{moeda(i.total ?? i.valor_base)}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
        )}
      </div>
    </Gaveta>
  );
}
