// Contas a pagar (fase final, 0031): o que falta pagar, quanto, quando vence, o que atrasou e o que já foi pago. Os
// três tipos de obrigação ficam aqui, sem outra aba: AVULSA (despesa única), RECORRENTE (conta fixa: aluguel,
// internet, sistemas — a obrigação de cada mês nasce sozinha) e PARCELADA (compra em parcelas). O botão
// "+ Conta a pagar" usa a MESMA estrutura das despesas (avulsa e parcelada = despesa a pagar; recorrente = conta fixa
// que gera a despesa de cada mês): nunca uma obrigação e uma despesa separadas para o mesmo gasto. Sem filtros: uma
// lista só, com todas as contas em aberto (vencidas primeiro) e as pagas dos últimos meses; as contas recorrentes são
// administradas no bloco recolhível "Contas recorrentes". Paga, a conta é a mesma despesa de Movimentações →
// Despesas: nada é contado duas vezes.
// Rotas: GET /contas-a-pagar, POST /parcelas/{id}/pagamentos, POST /despesas, GET/POST/PATCH /recorrencias.
import { useEffect, useState } from 'preact/hooks';
import { Banknote, Search, Plus, Pencil } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta, plural } from '../../lib/formato';
import { gravarParams } from '../../lib/rotas';
import { Suspenso } from '../../ui/camadas';
import { Botao, Cartao, Situacao } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { ContaPagar, ListaContas } from '../../lib/tipos/financeiro';
import { useNomeCategoria, temPermissao } from './comum';
import { Pagar, type ContaParaPagar } from './Pagar';
import { EditarRecorrencia } from './ContasFixas';
import { NovaDespesa, EditarDespesa } from './NovaDespesa';

type TipoNova = 'avulsa' | 'parcelada' | 'recorrente';
export const TIPO_CONTA: Record<string, string> = { avulsa: 'Avulsa', recorrente: 'Recorrente', parcelada: 'Parcelada' };

/** Aba Contas a pagar: busca, "+ Conta a pagar" (avulsa, parcelada ou recorrente) e a lista. */
export function ContasAPagar({ contexto, abrirDespesa }: { contexto: ContextoPainel; abrirDespesa: (id: string) => void }) {
  const [busca, setBusca] = useState('');
  const [nova, setNova] = useState<TipoNova | null>(null);
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  return (
    <>
      <div class="barra-ferramentas">
        <div class="entrada-grupo barra-ferramentas__busca">
          <Search aria-hidden="true" />
          <input class="entrada" type="search" placeholder="Buscar conta ou fornecedor" aria-label="Buscar conta a pagar" maxLength={80} value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
        </div>
        {lancar && (
          <div class="barra-ferramentas__acoes">
            <Suspenso rotulo="Tipo da conta a pagar" gatilho={(g) => <Botao tamanho="p" variante="primario" icone={<Plus aria-hidden="true" />} {...g}>Conta a pagar</Botao>}>
              {(fechar) => (
                <>
                  <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); setNova('avulsa'); }}>Avulsa <span class="fraco">· uma vez</span></button>
                  <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); setNova('parcelada'); }}>Parcelada <span class="fraco">· em parcelas</span></button>
                  <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); setNova('recorrente'); }}>Recorrente <span class="fraco">· todo mês</span></button>
                </>
              )}
            </Suspenso>
          </div>
        )}
      </div>
      <ListaContasPagar contexto={contexto} busca={busca} abrirDespesa={abrirDespesa} />
      <NovaDespesa aberta={nova === 'avulsa' || nova === 'parcelada'} situacaoInicial={nova === 'parcelada' ? 'parcelada' : 'a_pagar'} aoFechar={() => setNova(null)} aoCriar={abrirDespesa} />
      <EditarRecorrencia alvo={nova === 'recorrente' ? 'nova' : null} aoFechar={() => setNova(null)} />
    </>
  );
}


function ListaContasPagar({ contexto, busca, abrirDespesa }: { contexto: ContextoPainel; busca: string; abrirDespesa: (id: string) => void }) {
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  const [pagar, setPagar] = useState<ContaParaPagar | null>(null);
  const [editar, setEditar] = useState<string | null>(null);
  const nome = useNomeCategoria();
  // Endereços antigos (?situacao=): os filtros saíram.
  useEffect(() => gravarParams({ situacao: null }), []);

  // SÓ o que falta pagar (em aberto e vencidas). Paga, a conta sai daqui e fica em Movimentações → Despesas.
  const lista = useConsulta('financeiro/contas:{"situacao":"abertas"}', () => financeiro.contas({ situacao: 'abertas' }));
  const situacao = (c: ContaPagar) => (c.situacao_painel === 'vencida' ? 'vencida' : 'aberta');

  const colunas: Coluna<ContaPagar>[] = [
    { id: 'vencimento', titulo: 'Vencimento', prioridade: 'media', ordenar: (c) => c.vencimento, largura: '108px', celula: (c) => <span class="num" style={{ whiteSpace: 'nowrap' }}>{dataCurta(c.vencimento)}</span> },
    {
      id: 'descricao', titulo: 'Descrição', ordenar: (c) => c.descricao,
      celula: (c) => (
        <>
          <span class="principal-celula">{c.descricao}</span>
          <span class="sub">
            <span class="fin-so-celular"><strong style={{ color: situacao(c) === 'vencida' ? 'var(--perigo)' : undefined }}>{situacao(c) === 'vencida' ? 'Vencida' : 'Em aberto'}</strong> · {dataCurta(c.vencimento)} · </span>
            {[c.fornecedor, nome(c.categoria)].filter(Boolean).join(' · ')}
          </span>
        </>
      ),
    },
    {
      // O que falta pagar desta conta (parcial: o saldo; valor variável: o previsto).
      id: 'valor', titulo: 'Valor', numero: true, ordenar: (c) => Number(c.saldo),
      celula: (c) => (c.valor_a_confirmar ? <><span class="num forte">{moeda(c.valor)}</span><span class="sub">previsto</span></> : <span class="num forte" style={{ whiteSpace: 'nowrap' }}>{moeda(c.saldo)}</span>),
    },
    {
      id: 'situacao', titulo: 'Situação', prioridade: 'media',
      celula: (c) => (situacao(c) === 'vencida' ? <Situacao tom="perigo" destaque>Vencida</Situacao> : <Situacao tom="neutro">Em aberto</Situacao>),
    },
    {
      id: 'acoes', titulo: '',
      celula: (c) => (!lancar ? null : (
        <span class="linha" style={{ gap: '4px', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
          <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Editar ${c.descricao}`} icone={<Pencil aria-hidden="true" />} onClick={() => setEditar(c.despesa_id)} />
          <Botao tamanho="p" variante={c.situacao_painel === 'vencida' || c.situacao_painel === 'vence_hoje' ? 'primario' : 'secundario'} icone={<Banknote aria-hidden="true" />} onClick={() => setPagar(c)}>
            Pagar
          </Botao>
        </span>
      )),
    },
  ];

  return (
    <>
      {(
        <Cartao justo>
          <Dados consulta={lista} recurso="As contas a pagar" esqueleto={<EsqueletoTabela />}>
            {(r: ListaContas) => {
              const termo = busca.trim().toLocaleLowerCase('pt-BR');
              const todas = r.itens.filter((c) => c.situacao !== 'paga');
              const linhas = termo ? todas.filter((c) => `${c.descricao} ${c.fornecedor ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo)) : todas;
              return (
                <>
                  {r.itens.length > 0 && (
                    <div class="fin-totais">
                      <div><span>{plural(r.total, 'conta em aberto', 'contas em aberto')}</span><strong class="num">{moeda(r.totais.valor)}</strong></div>
                      <div><span>Falta pagar</span><strong class="num">{moeda(r.totais.saldo)}</strong></div>
                    </div>
                  )}
                  <Tabela
                    rotulo="Contas a pagar"
                    colunas={colunas}
                    linhas={linhas}
                    chave={(c) => c.parcela_id}
                    aoAbrir={(c) => abrirDespesa(c.despesa_id)}
                    destaque={(c) => c.situacao_painel === 'vencida' || c.situacao_painel === 'vence_hoje'}
                    vazio={termo
                      ? <Vazio compacto titulo="Nenhuma conta com essa busca">Procure pela descrição ou pelo fornecedor.</Vazio>
                      : <Vazio compacto titulo="Nenhuma conta a pagar">Contas novas entram por “+ Conta a pagar”, pelas compras ou pelas recorrentes.</Vazio>}
                  />
                  {r.total > r.itens.length && <p class="fraco" style={{ padding: '10px 20px' }}>Mostrando {r.itens.length} de {r.total} em aberto.</p>}
                </>
              );
            }}
          </Dados>
        </Cartao>
      )}

      <Pagar conta={pagar} aoFechar={() => setPagar(null)} />
      <EditarDespesa id={editar} aoFechar={() => setEditar(null)} />
    </>
  );
}
