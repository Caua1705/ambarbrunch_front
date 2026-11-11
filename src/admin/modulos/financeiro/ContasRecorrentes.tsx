// Contas recorrentes (aba própria): aluguel, internet, sistemas. Cadastradas uma vez; a obrigação de cada mês nasce
// sozinha em Contas a pagar (o backend não duplica a mesma competência) e, paga, sai de lá — a recorrente continua.
// Busca, "+ Conta recorrente" e uma tabela simples: Descrição, Valor previsto, Próximo vencimento e ações (editar,
// pausar/retomar, encerrar). Encerradas não aparecem. Rotas: GET/POST/PATCH /admin/financeiro/recorrencias.
import { useState } from 'preact/hooks';
import { Plus, Search, Pencil, Pause, Play, CalendarX } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta } from '../../lib/formato';
import { Botao, Cartao, Situacao } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { Recorrencia } from '../../lib/tipos/financeiro';
import { temPermissao, atualizarFinanceiro, avisar, avisarFalha } from './comum';
import { EditarRecorrencia, EncerrarRecorrencia } from './ContasFixas';

export function ContasRecorrentes({ contexto }: { contexto: ContextoPainel }) {
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  const [busca, setBusca] = useState('');
  const [editar, setEditar] = useState<Recorrencia | 'nova' | null>(null);
  const [encerrar, setEncerrar] = useState<Recorrencia | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const lista = useConsulta('financeiro/recorrencias:todas', () => financeiro.recorrencias(false));

  async function pausar(r: Recorrencia) {
    setOcupado(r.id);
    try {
      await financeiro.pausarRecorrencia(r.id, r.versao, r.ativo);
      atualizarFinanceiro();
      avisar(r.ativo ? 'Recorrência pausada.' : 'Recorrência retomada.', 'ok');
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
    {
      id: 'acoes', titulo: '',
      celula: (r) => (lancar ? (
        <span class="linha" style={{ gap: '2px', justifyContent: 'flex-end' }}>
          {r.ativo && <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Editar ${r.descricao}`} icone={<Pencil aria-hidden="true" />} onClick={() => setEditar(r)} />}
          <Botao tamanho="p" variante="fantasma" so_icone carregando={ocupado === r.id} aria-label={r.ativo ? `Pausar ${r.descricao}` : `Retomar ${r.descricao}`} icone={r.ativo ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} onClick={() => pausar(r)} />
          <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Encerrar ${r.descricao}`} icone={<CalendarX aria-hidden="true" />} onClick={() => setEncerrar(r)} />
        </span>
      ) : null),
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
              <Tabela rotulo="Contas recorrentes" colunas={colunas} linhas={linhas} chave={(r) => r.id} ordemInicial={{ coluna: 'proximo' }}
                vazio={termo ? <Vazio compacto titulo="Nenhuma conta com essa busca">Procure pela descrição ou pelo fornecedor.</Vazio>
                  : <Vazio compacto titulo="Nenhuma conta recorrente">Cadastre uma vez; a conta de cada mês aparece em Contas a pagar.</Vazio>} />
            );
          }}
        </Dados>
      </Cartao>
      <EditarRecorrencia alvo={editar} aoFechar={() => setEditar(null)} />
      <EncerrarRecorrencia alvo={encerrar} aoFechar={() => setEncerrar(null)} />
    </>
  );
}
