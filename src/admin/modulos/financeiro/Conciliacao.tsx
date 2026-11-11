// Conciliação: a ferramenta de conferência — não um dashboard. Fica em Pendências, que escolhe a parte (?vista=banco,
// stone ou divergencias) no mesmo seletor da Revisão: aqui não há um segundo nível de navegação. Três partes:
//  - Banco: extrato importado (OFX ou CSV; o backend recusa PDF e imagem) contra o Financeiro, uma decisão humana por
//    movimentação. Data e valor iguais nunca bastam: o vínculo é sempre confirmado por alguém (Banco/Movimento).
//  - Stone e recebíveis (0029): quatro números do backend (GET /conciliacao/repasses → resumo): vendido, líquido
//    ESTIMADO pela taxa contratada, recebido e confirmado, diferença a conferir (o que ainda está no prazo não conta).
//    Estimativa sempre marcada; sem taxa cadastrada, nada é estimado.
//  - Divergências: o que precisa de alguém — possíveis duplicidades, mais de uma opção, sem registro, a classificar — e
//    os meios com diferença de repasse.
// Sem conta bancária cadastrada, cada parte mostra o caminho para cadastrar (o mesmo "Importar extrato", que cadastra a
// conta antes do arquivo) em vez de uma tela vazia ou de um "recebido" que pareça zero.
import { useEffect, useState } from 'preact/hooks';
import { AlertTriangle, CircleCheck, Landmark } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta, hojeISO, fimMes, num, mesAno } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { useConfirmacao } from '../../ui/camadas';
import { Botao, Cartao, Situacao, Aviso } from '../../ui/base';
import { Dados, EsqueletoTabela, Esqueleto, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { MovimentoBancario, NivelConciliacao } from '../../lib/tipos/financeiro';
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
  const [verTaxas, setVerTaxas] = useState(false);
  const semConta = useSemConta(mes);
  return (
    <>
      <Cartao titulo={`Cartão e Pix · ${mesAno(de)}`} justo>
        <Dados consulta={repasses} recurso="Os recebíveis" compacto esqueleto={<div class="cartao__corpo"><Esqueleto linhas={2} /></div>}>
          {(x) => {
            const r = x.resumo;
            if (!r) return <p class="cartao__corpo fraco">Backend sem o resumo de recebíveis (0029).</p>;
            const dif = r.diferenca_a_conferir === null ? null : num(r.diferenca_a_conferir) ?? 0;
            return (
              <>
                <div class="fin-valores fin-valores--4">
                  <div><span>Vendido (Eyemobile)</span><strong class="num">{moeda(r.vendido)}</strong></div>
                  <div><span>Líquido estimado</span><strong class="num">{r.liquido_estimado === null ? '—' : moeda(r.liquido_estimado)}</strong><small>estimativa</small></div>
                  <div><span>Recebido e confirmado</span><strong class="num">{semConta ? '—' : moeda(r.recebido_confirmado)}</strong>{semConta && <small>sem conta bancária</small>}</div>
                  <div>
                    <span>Diferença a conferir</span>
                    <strong class={`num${dif !== null && Math.abs(dif) >= 0.01 ? ' a-conferir' : ''}`}>{dif === null || semConta ? '—' : moeda(r.diferenca_a_conferir)}</strong>
                    {Number(r.ainda_no_prazo) > 0 && <small>{moeda(r.ainda_no_prazo)} ainda no prazo</small>}
                  </div>
                </div>
                {r.meios_sem_taxa.length > 0 && (
                  <p class="cartao__rodape">Sem taxa cadastrada para {r.meios_sem_taxa.map((m) => MEIO[m as keyof typeof MEIO] ?? m).join(', ')}: o líquido não é estimado.</p>
                )}
                <details class="fin-detalhes cartao__rodape">
                  <summary>Por modalidade</summary>
                  <ul class="fin-lista-simples">
                    {(['credito', 'debito', 'pix'] as const).map((m) => (
                      <li key={m}>{MEIO[m] ?? m}: vendido <strong class="num">{moeda(r.por_meio[m].vendido)}</strong> · líquido estimado <strong class="num">{r.por_meio[m].liquido_estimado === null ? '—' : moeda(r.por_meio[m].liquido_estimado)}</strong></li>
                    ))}
                  </ul>
                  <p class="fraco">{r.aviso}</p>
                </details>
              </>
            );
          }}
        </Dados>
      </Cartao>
      {semConta && <CadastrarConta aoImportar={aoImportar}>O “recebido” vem do extrato (opcional). Cadastre a conta e importe o OFX ou CSV quando quiser conferir.</CadastrarConta>}
      <div>
        <Botao tamanho="p" variante="fantasma" aria-expanded={verTaxas} aria-controls="taxas-contratadas" onClick={() => setVerTaxas(!verTaxas)}>
          {verTaxas ? 'Esconder as taxas contratadas' : 'Taxas contratadas'}
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
