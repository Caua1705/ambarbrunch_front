// Conciliação: a ferramenta de conferência — não um dashboard. Fica em Pendências, que escolhe a parte (?vista=banco,
// stone ou divergencias) no mesmo seletor da Revisão: aqui não há um segundo nível de navegação. Três partes:
//  - Banco: extrato importado (OFX ou CSV; o backend recusa PDF e imagem) contra o Financeiro, uma decisão humana por
//    movimentação. Data e valor iguais nunca bastam: o vínculo é sempre confirmado por alguém (Banco/Movimento).
//  - Stone e recebíveis: vendido por meio (Eyemobile) × o que caiu no banco e foi vinculado (GET /conciliacao/repasses),
//    com as taxas contratadas em vigor ao lado. A diferença é a do backend, para CONFERIR: taxa, prazo, antecipação,
//    cancelamento e estorno não são presumidos — e o painel não calcula "líquido esperado" (contrato ainda inexistente).
//  - Divergências: o que precisa de alguém — possíveis duplicidades, mais de uma opção, sem registro, a classificar — e
//    os meios com diferença de repasse.
// Sem conta bancária cadastrada, cada parte mostra o caminho para cadastrar (o mesmo "Importar extrato", que cadastra a
// conta antes do arquivo) em vez de uma tela vazia ou de um "recebido" que pareça zero.
import { useEffect, useState } from 'preact/hooks';
import { AlertTriangle, CircleCheck, Landmark, Info } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta, hojeISO, fimMes, num, pct, mesAno } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { useConfirmacao } from '../../ui/camadas';
import { Botao, Cartao, Situacao, Aviso } from '../../ui/base';
import { Dados, EsqueletoTabela, Esqueleto, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { MovimentoBancario, NivelConciliacao, TaxaPagamento } from '../../lib/tipos/financeiro';
import { NIVEL, MEIO, temPermissao } from './comum';
import { Banco } from './Banco';
import { ImportarExtrato } from './ImportarExtrato';
import { Movimento } from './Movimento';
import { Taxas } from './ContasFixas';

export type VistaConciliacao = 'banco' | 'stone' | 'divergencias';

/** Meio do relatório de repasses (cartão junta crédito e débito) → meios das taxas cadastradas. */
const MEIO_REPASSE: Record<string, { rotulo: string; taxas: string[] }> = {
  cartao: { rotulo: 'Cartão (crédito e débito)', taxas: ['credito', 'debito'] },
  pix: { rotulo: 'Pix', taxas: ['pix'] },
  dinheiro: { rotulo: 'Dinheiro', taxas: [] },
  outro: { rotulo: 'Outros', taxas: ['outro'] },
};

const DIVERGENTES: NivelConciliacao[] = ['conflito', 'ambigua', 'sem_correspondencia', 'classificacao_pendente'];

function intervaloDoMes(mes: string) {
  const de = `${mes}-01`;
  const ate = fimMes(de) > hojeISO() ? hojeISO() : fimMes(de);
  return { de, ate };
}

export function Conciliacao({ contexto, vista, aoMudarVista }: { contexto: ContextoPainel; vista: VistaConciliacao; aoMudarVista: (v: VistaConciliacao) => void }) {
  const [mes, setMes] = useState(() => (/^\d{4}-\d{2}$/.test(lerParam('mes') ?? '') ? lerParam('mes')! : hojeISO().slice(0, 7)));
  const [importar, setImportar] = useState(false);
  const [importacao, setImportacao] = useState<string | null>(null);
  const { confirmar, elemento: dialogo } = useConfirmacao();
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  useEffect(() => gravarParams({ mes: mes === hojeISO().slice(0, 7) ? null : mes }), [mes]);
  const aoImportar = () => setImportar(true);

  return (
    <>
      {vista !== 'banco' && (
        <div class="barra-ferramentas">
          <label class="campo-inline" for="mes-conciliacao">
            Mês
            <input id="mes-conciliacao" type="month" class="entrada entrada--data" value={mes} max={hojeISO().slice(0, 7)} onChange={(e) => e.currentTarget.value && setMes(e.currentTarget.value)} />
          </label>
        </div>
      )}

      {vista === 'banco' && <Banco importacao={importacao} aoLimparImportacao={() => setImportacao(null)} aoImportar={aoImportar} confirmar={confirmar} />}
      {vista === 'stone' && <Stone mes={mes} lancar={lancar} aoImportar={aoImportar} />}
      {vista === 'divergencias' && <Divergencias mes={mes} confirmar={confirmar} aoVerStone={() => aoMudarVista('stone')} aoImportar={aoImportar} />}

      <ImportarExtrato aberta={importar} aoFechar={() => setImportar(false)} aoVerDiferencas={(id) => { setImportar(false); setImportacao(id); aoMudarVista('banco'); }} />
      {dialogo}
    </>
  );
}

/** Taxa em vigor de um meio numa data: a vigência mais recente que já começou (a mesma regra do backend ao estimar). */
function taxaEmVigor(taxas: TaxaPagamento[], meio: string, em: string) {
  return taxas.filter((t) => t.meio === meio && t.vigente_de <= em).sort((a, b) => b.vigente_de.localeCompare(a.vigente_de))[0] ?? null;
}

/** A unidade ainda não tem conta bancária (mesmo estado que a parte Banco lê, da mesma consulta em cache). */
function useSemConta(mes: string) {
  const estado = useConsulta(`financeiro/conciliacao-mes:${mes}`, () => financeiro.conciliacaoMes(mes));
  return estado.dados?.estado === 'sem_contas';
}

/** Chamada para cadastrar a conta: o assistente de importação cadastra a conta antes do arquivo. */
function CadastrarConta({ aoImportar, children }: { aoImportar: () => void; children: string }) {
  return (
    <Vazio compacto icone={<Landmark aria-hidden="true" />} titulo="Nenhuma conta bancária cadastrada" acao={<Botao tamanho="p" variante="primario" onClick={aoImportar}>Cadastrar conta bancária</Botao>}>
      {children}
    </Vazio>
  );
}

function Stone({ mes, lancar, aoImportar }: { mes: string; lancar: boolean; aoImportar: () => void }) {
  const { de, ate } = intervaloDoMes(mes);
  const repasses = useConsulta(`financeiro/repasses:${de}:${ate}`, () => financeiro.repasses(de, ate));
  const taxas = useConsulta('financeiro/taxas', () => financeiro.taxas());
  const [verTaxas, setVerTaxas] = useState(false);
  const semConta = useSemConta(mes);
  return (
    <>
      {semConta && (
        <Cartao>
          <CadastrarConta aoImportar={aoImportar}>Sem a conta e o extrato, o “recebido no banco” fica vazio e a diferença não quer dizer nada. Cadastre a conta (banco, apelido e os últimos dígitos) e importe o OFX ou CSV do mês.</CadastrarConta>
        </Cartao>
      )}
      <Cartao
        titulo={`Vendido × recebido · ${mesAno(de)}`}
        descricao="Vendido no PDV (Eyemobile) por meio × créditos do banco já vinculados a essas vendas"
        justo
      >
        <Dados consulta={repasses} recurso="Os repasses" compacto esqueleto={<div class="cartao__corpo"><Esqueleto linhas={3} /></div>}>
          {(x) => (
            <>
              <div class="tabela-rolagem">
                <table class="tabela" aria-label="Repasses por meio">
                  <thead>
                    <tr>
                      <th>Modalidade</th>
                      <th class="num">Vendido (bruto)</th>
                      <th class="num" data-prioridade="media">Taxa contratada</th>
                      <th class="num">Recebido no banco</th>
                      <th class="num">Diferença a conferir</th>
                      <th data-prioridade="media">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {x.meios.map((m) => {
                      const info = MEIO_REPASSE[m.meio] ?? { rotulo: m.meio, taxas: [] };
                      const vigentes = info.taxas.map((t) => ({ meio: t, taxa: taxaEmVigor(taxas.dados ?? [], t, ate) }));
                      const dif = num(m.diferenca_a_conferir) ?? 0;
                      const vendido = num(m.vendido) ?? 0;
                      return (
                        <tr key={m.meio}>
                          <td>
                            <span class="principal-celula">{info.rotulo}</span>
                            {m.vendido_por_tipo && Object.keys(m.vendido_por_tipo).length > 1 && (
                              <span class="sub">{Object.entries(m.vendido_por_tipo).map(([t, v]) => `${MEIO[t as keyof typeof MEIO] ?? t} ${moeda(v)}`).join(' · ')}</span>
                            )}
                          </td>
                          <td class="num">{moeda(m.vendido)}</td>
                          <td class="num" data-prioridade="media">
                            {!info.taxas.length ? <span class="fraco">—</span> : taxas.dados ? vigentes.map((v) => <span key={v.meio} class="bloco-linha">{info.taxas.length > 1 ? `${MEIO[v.meio as keyof typeof MEIO] ?? v.meio} ` : ''}{v.taxa ? pct(v.taxa.taxa_percentual, { casas: 2 }) : <span class="fraco">sem taxa</span>}</span>) : '…'}
                          </td>
                          <td class="num">{moeda(m.liquidado_vinculado)}</td>
                          <td class={`num forte${Math.abs(dif) >= 0.01 ? ' a-conferir' : ''}`}>{moeda(m.diferenca_a_conferir)}</td>
                          <td data-prioridade="media">
                            {vendido === 0 ? <span class="fraco">Sem vendas</span> : Math.abs(dif) < 0.01 ? <Situacao tom="ok">Conferido</Situacao> : <Situacao tom="atencao">A conferir</Situacao>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div class="cartao__rodape pilha pilha--p">
                <span>{x.aviso}</span>
                <span>
                  A diferença inclui a taxa da adquirente, o prazo de repasse (crédito em D+1/D+30, antecipação) e cancelamentos: um dia
                  diferente não quer dizer cobrança indevida. As taxas contratadas da Stone já podem incluir a antecipação — não a desconte
                  de novo.
                </span>
              </div>
            </>
          )}
        </Dados>
      </Cartao>

      <Aviso tom="info" icone={<Info aria-hidden="true" />}>
        <strong>Líquido esperado por lote ainda não é calculado.</strong> O backend hoje compara vendido × recebido por meio no
        mês; a conta “bruto − taxa esperada = líquido esperado × recebido”, por data de venda, lote e parcelamento, precisa de um
        contrato novo do backend (registrado na documentação do painel). O painel não faz essa conta sozinho.
      </Aviso>

      <div>
        <Botao variante="fantasma" aria-expanded={verTaxas} aria-controls="taxas-contratadas" onClick={() => setVerTaxas(!verTaxas)}>
          {verTaxas ? 'Esconder as taxas contratadas' : 'Taxas contratadas (cadastro)'}
        </Botao>
      </div>
      {verTaxas && (
        <div id="taxas-contratadas">
          <Taxas lancar={lancar} />
        </div>
      )}
    </>
  );
}

async function divergentes(de: string, ate: string): Promise<MovimentoBancario[]> {
  const listas = await Promise.all(DIVERGENTES.map((nivel) => financeiro.movimentos({ de, ate, nivel, limite: 200 })));
  const vistos = new Map<string, MovimentoBancario>();
  for (const l of listas) for (const m of l.itens) vistos.set(m.id, m);
  return [...vistos.values()].sort((a, b) => NIVEL[a.nivel].ordem - NIVEL[b.nivel].ordem || b.data.localeCompare(a.data));
}

function Divergencias({ mes, confirmar, aoVerStone, aoImportar }: { mes: string; confirmar: ReturnType<typeof useConfirmacao>['confirmar']; aoVerStone: () => void; aoImportar: () => void }) {
  const { de, ate } = intervaloDoMes(mes);
  // O backend limita a conciliação a ~100 dias por consulta: um mês sempre cabe.
  const movs = useConsulta(`financeiro/movimentos?divergencias:${de}:${ate}`, () => divergentes(de, ate));
  const repasses = useConsulta(`financeiro/repasses:${de}:${ate}`, () => financeiro.repasses(de, ate));
  const [aberto, setAberto] = useState<string | null>(null);
  const semConta = useSemConta(mes);
  // Sem conta, todo o vendido "falta receber": não é divergência, é falta de extrato.
  const comDiferenca = semConta ? [] : (repasses.dados?.meios ?? []).filter((m) => Math.abs(num(m.diferenca_a_conferir) ?? 0) >= 0.01 && (num(m.vendido) ?? 0) > 0);

  if (semConta) {
    return (
      <Cartao>
        <CadastrarConta aoImportar={aoImportar}>As divergências vêm do extrato bancário. Cadastre a conta (banco, apelido e os últimos dígitos) e importe o OFX ou CSV do mês.</CadastrarConta>
      </Cartao>
    );
  }

  const colunas: Coluna<MovimentoBancario>[] = [
    { id: 'data', titulo: 'Data', prioridade: 'media', largura: '86px', ordenar: (m) => m.data, celula: (m) => <span class="num">{dataCurta(m.data)}</span> },
    { id: 'descricao', titulo: 'No extrato', celula: (m) => <><span class="principal-celula">{m.descricao}</span><span class="sub">{m.conta.apelido}</span></> },
    { id: 'valor', titulo: 'Valor', numero: true, ordenar: (m) => Number(m.valor) * (m.direcao === 'credito' ? 1 : -1), celula: (m) => <span class={`num forte${m.direcao === 'credito' ? ' positivo' : ''}`}>{m.direcao === 'credito' ? '+' : '−'} {moeda(m.valor)}</span> },
    { id: 'nivel', titulo: 'Divergência', ordenar: (m) => NIVEL[m.nivel].ordem, celula: (m) => <Situacao tom={NIVEL[m.nivel].tom} destaque={m.nivel === 'conflito'}>{NIVEL[m.nivel].rotulo}</Situacao> },
    { id: 'acoes', titulo: '', celula: (m) => <Botao tamanho="p" onClick={() => setAberto(m.id)}>Conferir</Botao> },
  ];

  return (
    <>
      {comDiferenca.length > 0 && (
        <Aviso tom="atencao" icone={<AlertTriangle aria-hidden="true" />}>
          <strong>Repasses com diferença em {mesAno(de).toLowerCase()}:</strong>{' '}
          {comDiferenca.map((m) => `${MEIO_REPASSE[m.meio]?.rotulo ?? m.meio} ${moeda(m.diferenca_a_conferir)}`).join(' · ')}.{' '}
          <button type="button" class="link" onClick={aoVerStone}>Conferir em Stone e recebíveis</button>
        </Aviso>
      )}
      <Cartao titulo="Movimentações que precisam de decisão" descricao={`Extrato de ${mesAno(de).toLowerCase()}: duplicidade possível, mais de uma opção, sem registro no Financeiro ou a classificar`} justo>
        <Dados consulta={movs} recurso="As divergências" esqueleto={<EsqueletoTabela />}>
          {(lista) => (
            <Tabela
              rotulo="Divergências do extrato"
              colunas={colunas}
              linhas={lista}
              chave={(m) => m.id}
              aoAbrir={(m) => setAberto(m.id)}
              destaque={(m) => m.nivel === 'conflito'}
              vazio={
                <Vazio compacto icone={lista.length ? <Landmark aria-hidden="true" /> : <CircleCheck aria-hidden="true" />} titulo="Nenhuma divergência no extrato deste mês">
                  Sem extrato importado, nada aparece aqui: importe o OFX ou CSV em Banco.
                </Vazio>
              }
            />
          )}
        </Dados>
      </Cartao>
      <Movimento id={aberto} aoFechar={() => setAberto(null)} confirmar={confirmar} />
    </>
  );
}
