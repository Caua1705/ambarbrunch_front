// Dentro de Registros: o que precisa do gestor (revisão, tipo a conferir) e o histórico do que já foi corrigido, com quem e
// quando. A correção em si acontece no dia (DetalheDia), com justificativa, e as marcações originais ficam guardadas.
import { useState } from 'preact/hooks';
import { Download } from 'lucide-preact';
import { baixarRelatorio, equipe } from '../../lib/api/equipe';
import { useConsulta } from '../../lib/consulta';
import { dataCurta, dataHora, hojeISO, somarDias } from '../../lib/formato';
import type { LinhaEspelho } from '../../lib/tipos/equipe';
import { Botao, Cartao, Etiqueta } from '../../ui/base';
import { avisarErro } from '../../ui/camadas';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { ROTULO_AJUSTE, ROTULO_SINAL, useFuncionariosAtivos, type PermissoesEquipe } from './comum';
import { DetalheDia, textoAjuste } from './Registros';

export const DIAS_REVISAO = 30;

/** As duas filas, com a mesma chave de consulta usada pela contagem da aba. */
export function useFilasRevisao(ligado = true) {
  const ate = hojeISO();
  const de = somarDias(ate, -DIAS_REVISAO);
  const revisao = useConsulta(ligado ? `equipe:revisao?${de}` : null, () => equipe.espelho({ de, ate, status: 'pendente_revisao', limite: 200 }));
  const conferir = useConsulta(ligado ? `equipe:conferir?${de}` : null, () => equipe.espelho({ de, ate, somente_a_conferir: true, limite: 200 }));
  const total = revisao.dados && conferir.dados ? revisao.dados.total + conferir.dados.total : null;
  return { revisao, conferir, total };
}

function Fila({ titulo, descricao, linhas, vazio, aoAbrir, sinais }: { titulo: string; descricao: string; linhas: LinhaEspelho[]; vazio: string; aoAbrir: (l: LinhaEspelho) => void; sinais?: boolean }) {
  return (
    <Cartao titulo={titulo} descricao={descricao} justo>
      {linhas.length ? (
        <ul class="lista" aria-label={titulo}>
          {linhas.map((l) => (
            <li key={`${l.funcionario_id}-${l.data}`}>
              <div class="lista__item equipe-marcacao">
                <div class="pilha pilha--p">
                  <span><strong>{l.nome_exibicao}</strong> <span class="fraco">{dataCurta(l.data, { semana: true })}</span></span>
                  {sinais && <span class="linha">{l.sinalizacoes.map((s) => <Etiqueta key={s} tom="atencao">{ROTULO_SINAL[s] ?? s}</Etiqueta>)}</span>}
                </div>
                <Botao tamanho="p" onClick={() => aoAbrir(l)}>Abrir</Botao>
              </div>
            </li>
          ))}
        </ul>
      ) : <Vazio compacto titulo={vazio} />}
    </Cartao>
  );
}

export function ParaRevisar({ perm }: { perm: PermissoesEquipe }) {
  const { revisao, conferir } = useFilasRevisao();
  const [aberta, setAberta] = useState<LinhaEspelho | null>(null);
  return (
    <div class="pilha">
      <Dados consulta={revisao} esqueleto={<EsqueletoTabela linhas={2} />}>
        {(p) => <Fila titulo="Precisam de revisão" descricao={`Últimos ${DIAS_REVISAO} dias: batidas fora de sequência ou jornadas sem saída. Abra o dia para corrigir.`} linhas={p.itens} vazio="Nada para revisar" aoAbrir={setAberta} sinais />}
      </Dados>
      <Dados consulta={conferir} esqueleto={<EsqueletoTabela linhas={2} />}>
        {(p) => <Fila titulo="Tipo a conferir" descricao="A pessoa escolheu entre intervalo e saída. Para confirmar, abra e corrija mantendo o mesmo tipo." linhas={p.itens} vazio="Nada a conferir" aoAbrir={setAberta} />}
      </Dados>
      {aberta && <DetalheDia linha={aberta} perm={perm} aoFechar={() => setAberta(null)} />}
    </div>
  );
}

export function CorrecoesFeitas() {
  const ate = hojeISO();
  const de = somarDias(ate, -DIAS_REVISAO);
  const historico = useConsulta(`equipe:ajustes?${de}`, () => equipe.ajustes({ de, ate, limite: 200 }));
  const pessoas = useFuncionariosAtivos();
  const nomes = new Map(pessoas.dados?.itens.map((f) => [f.id, f.nome_exibicao]));
  const [baixando, setBaixando] = useState(false);
  const exportar = async () => {
    setBaixando(true);
    try {
      await baixarRelatorio('correcoes', de, ate);
    } catch (e) {
      avisarErro(e);
    } finally {
      setBaixando(false);
    }
  };
  return (
    <Cartao
      titulo="Histórico de correções"
      descricao={`Últimos ${DIAS_REVISAO} dias. As marcações originais continuam guardadas.`}
      acoes={<Botao icone={<Download aria-hidden="true" />} onClick={exportar} carregando={baixando}>Exportar CSV</Botao>}
      justo
    >
      <Dados consulta={historico} esqueleto={<EsqueletoTabela linhas={3} />}>
        {(p) => p.itens.length ? (
          <ul class="lista" aria-label="Histórico de correções">
            {p.itens.map((a) => (
              <li key={a.id}>
                <div class="lista__item">
                  <div class="pilha pilha--p">
                    <span><strong>{nomes.get(a.funcionario_id) ?? 'Pessoa inativa'}</strong> · {ROTULO_AJUSTE[a.tipo]} {textoAjuste(a.valor_anterior, a.valor_ajustado)}</span>
                    <span class="fraco">{a.responsavel_nome ?? 'Gestor'}, {dataHora(a.ocorreu_em)}</span>
                    <span class="fraco">{a.justificativa}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : <Vazio compacto titulo="Nenhuma correção no período" />}
      </Dados>
    </Cartao>
  );
}
