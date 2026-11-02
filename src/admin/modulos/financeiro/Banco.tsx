// Banco: movimentações do extrato com a proposta do sistema (nível, candidatos e evidências). Uma decisão humana por
// movimentação; nada é conciliado sozinho só por valor e data. Rotas /admin/financeiro/conciliacao/* e /contas-bancarias.
// Fica na aba Conciliação (parte Banco); os repasses por meio estão na parte Stone e recebíveis.
import { useState } from 'preact/hooks';
import { Upload, CircleCheck, Landmark } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta, hojeISO, fimMes, somarDias, plural } from '../../lib/formato';
import type { PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Cartao, Situacao, Segmentado } from '../../ui/base';
import { Dados, EsqueletoTabela, Esqueleto, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { MovimentoBancario } from '../../lib/tipos/financeiro';
import { NIVEL, ESTADO_CONCILIACAO } from './comum';
import { Movimento, TIPO_CANDIDATO } from './Movimento';

type Filtro = 'pendente' | 'parcial' | 'conciliado' | 'todas';

export function Banco({ importacao, aoLimparImportacao, aoImportar, confirmar }: { importacao: string | null; aoLimparImportacao: () => void; aoImportar: () => void; confirmar: (p: PedidoConfirmacao) => void }) {
  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const [conta, setConta] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('pendente');
  const [aberto, setAberto] = useState<string | null>(null);
  const contas = useConsulta('financeiro/contas-bancarias', () => financeiro.contasBancarias());
  const de = `${mes}-01`;
  const ate = fimMes(de) > hojeISO() ? hojeISO() : fimMes(de);
  // Vindo de uma importação: os últimos 100 dias (limite do backend), só daquele arquivo.
  const q = { de: importacao ? somarDias(ate, -99) : de, ate, conta_id: conta || undefined, situacao: filtro === 'todas' ? undefined : filtro, importacao_id: importacao ?? undefined };
  const movimentos = useConsulta(`financeiro/movimentos?${JSON.stringify(q)}`, () => financeiro.movimentos(q));
  const estadoMes = useConsulta(`financeiro/conciliacao-mes:${mes}`, () => financeiro.conciliacaoMes(mes));

  const colunas: Coluna<MovimentoBancario>[] = [
    { id: 'data', titulo: 'Data', prioridade: 'media', largura: '86px', ordenar: (m) => m.data, celula: (m) => <span class="num" style={{ whiteSpace: 'nowrap' }}>{dataCurta(m.data)}</span> },
    { id: 'descricao', titulo: 'No extrato', celula: (m) => <><span class="principal-celula">{m.descricao}</span><span class="sub"><span class="fin-so-celular">{dataCurta(m.data)} · <strong>{NIVEL[m.nivel].rotulo}</strong> · </span>{m.conta.apelido}{m.candidatos[0] ? ` · ${TIPO_CANDIDATO[m.candidatos[0].tipo]}` : ''}</span></> },
    { id: 'valor', titulo: 'Valor', numero: true, ordenar: (m) => Number(m.valor) * (m.direcao === 'credito' ? 1 : -1), celula: (m) => <span class="num forte" style={{ whiteSpace: 'nowrap', color: m.direcao === 'credito' ? 'var(--ok)' : undefined }}>{m.direcao === 'credito' ? '+' : '−'} {moeda(m.valor)}</span> },
    { id: 'nivel', titulo: 'Situação', prioridade: 'media', ordenar: (m) => NIVEL[m.nivel].ordem, celula: (m) => <Situacao tom={NIVEL[m.nivel].tom} destaque={m.nivel === 'forte' || m.nivel === 'conflito'}>{m.situacao === 'parcial' ? 'Parcial' : NIVEL[m.nivel].rotulo}</Situacao> },
    { id: 'acoes', titulo: '', prioridade: 'media', celula: (m) => (m.situacao === 'conciliado' || m.situacao === 'duplicado' ? null : <Botao tamanho="p" onClick={() => setAberto(m.id)}>Conferir</Botao>) },
  ];

  return (
    <>
      <Cartao titulo="Extrato do mês" descricao="O extrato confere o Financeiro: não cria receita nem despesa sozinho." acoes={<Botao tamanho="p" icone={<Upload aria-hidden="true" />} onClick={aoImportar}>Importar extrato</Botao>}>
        <div class="linha" style={{ marginBottom: '12px' }}>
          <label class="sr" for="mes-banco">Mês</label>
          <input id="mes-banco" type="month" class="entrada" style={{ width: 'auto' }} value={mes} max={hojeISO().slice(0, 7)} onChange={(e) => e.currentTarget.value && setMes(e.currentTarget.value)} />
          <select class="selecao" style={{ width: 'auto' }} aria-label="Conta bancária" value={conta} onChange={(e) => setConta(e.currentTarget.value)}>
            <option value="">Todas as contas</option>
            {(contas.dados ?? []).filter((c) => c.status === 'ativa').map((c) => <option key={c.id} value={c.id}>{c.apelido}</option>)}
          </select>
        </div>
        <Dados consulta={estadoMes} recurso="A conciliação bancária" compacto esqueleto={<Esqueleto linhas={2} />}>
          {(e) =>
            e.estado === 'sem_contas' ? (
              <Vazio compacto icone={<Landmark aria-hidden="true" />} titulo="Nenhuma conta bancária cadastrada" acao={<Botao tamanho="p" variante="primario" onClick={aoImportar}>Cadastrar e importar</Botao>}>
                Cadastre a conta (só banco, apelido e os últimos dígitos) e importe o OFX ou CSV do mês.
              </Vazio>
            ) : (
              <ul class="lista fin-borda">
                {e.contas.map((c) => (
                  <li key={c.conta.id} class="lista__item" style={{ flexWrap: 'wrap' }}>
                    <span class="lista__texto">
                      <strong>{c.conta.apelido}</strong>
                      <span>
                        {plural(c.movimentos, 'movimentação', 'movimentações')}
                        {c.pendentes ? ` · ${plural(c.pendentes, 'para conferir', 'para conferir')}` : ''}
                        {c.conflitos ? ` · ${plural(c.conflitos, 'possível duplicidade', 'possíveis duplicidades')}` : ''}
                        {c.lacunas.length ? ` · faltam ${c.lacunas.map((l) => `${dataCurta(l.de)}–${dataCurta(l.ate)}`).join(', ')}` : ''}
                      </span>
                    </span>
                    <span class="lista__fim"><Situacao tom={ESTADO_CONCILIACAO[c.estado].tom}>{ESTADO_CONCILIACAO[c.estado].rotulo}</Situacao></span>
                  </li>
                ))}
              </ul>
            )
          }
        </Dados>
      </Cartao>

      <Cartao justo>
        <div class="filtros" style={{ padding: '14px 20px', borderBottom: '1px solid var(--borda)' }}>
          <Segmentado<Filtro> rotulo="Movimentações" valor={filtro} aoMudar={setFiltro} opcoes={[{ valor: 'pendente', rotulo: 'Para conferir' }, { valor: 'parcial', rotulo: 'Parciais' }, { valor: 'conciliado', rotulo: 'Conciliadas' }, { valor: 'todas', rotulo: 'Todas' }]} />
          {importacao && <Botao tamanho="p" variante="fantasma" onClick={aoLimparImportacao}>Só desta importação ✕</Botao>}
        </div>
        <Dados consulta={movimentos} recurso="As movimentações" esqueleto={<EsqueletoTabela />}>
          {(r) => (
            <Tabela
              rotulo="Movimentações bancárias"
              colunas={colunas}
              linhas={[...r.itens].sort((a, b) => NIVEL[a.nivel].ordem - NIVEL[b.nivel].ordem || b.data.localeCompare(a.data))}
              chave={(m) => m.id}
              aoAbrir={(m) => setAberto(m.id)}
              destaque={(m) => m.nivel === 'conflito' || m.nivel === 'forte'}
              apagada={(m) => m.situacao === 'duplicado'}
              vazio={<Vazio compacto icone={<CircleCheck aria-hidden="true" />} titulo={filtro === 'pendente' ? 'Nada para conferir' : 'Nenhuma movimentação'}>{filtro === 'pendente' ? 'Todas as movimentações deste período estão resolvidas ou não há extrato importado.' : 'Importe o extrato do mês para ver as movimentações.'}</Vazio>}
            />
          )}
        </Dados>
      </Cartao>

      <Movimento id={aberto} aoFechar={() => setAberto(null)} confirmar={confirmar} />
    </>
  );
}

