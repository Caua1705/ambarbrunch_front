// Correções: o que precisa do gestor (revisão, tipo a conferir) e o histórico do que já foi corrigido, com quem e quando.
import { useState } from 'preact/hooks';
import { equipe } from '../../lib/api/equipe';
import { useConsulta } from '../../lib/consulta';
import { dataCurta, dataHora, hojeISO, somarDias } from '../../lib/formato';
import type { LinhaEspelho } from '../../lib/tipos/equipe';
import { Botao, Cartao, Etiqueta } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { ROTULO_AJUSTE, ROTULO_SINAL, useFuncionariosAtivos, type PermissoesEquipe } from './comum';
import { DetalheDia, textoAjuste } from './Registros';

const DIAS = 30;

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

export function Correcoes({ perm }: { perm: PermissoesEquipe }) {
  const ate = hojeISO();
  const de = somarDias(ate, -DIAS);
  const revisao = useConsulta(`equipe:revisao?${de}`, () => equipe.espelho({ de, ate, status: 'pendente_revisao', limite: 200 }));
  const conferir = useConsulta(`equipe:conferir?${de}`, () => equipe.espelho({ de, ate, somente_a_conferir: true, limite: 200 }));
  const historico = useConsulta(`equipe:ajustes?${de}`, () => equipe.ajustes({ de, ate, limite: 200 }));
  const pessoas = useFuncionariosAtivos();
  const nomes = new Map(pessoas.dados?.itens.map((f) => [f.id, f.nome_exibicao]));
  const [aberta, setAberta] = useState<LinhaEspelho | null>(null);
  return (
    <div class="pilha">
      <Dados consulta={revisao} esqueleto={<EsqueletoTabela linhas={2} />}>
        {(p) => <Fila titulo="Precisam de revisão" descricao="Batidas fora de sequência ou jornadas sem saída." linhas={p.itens} vazio="Nada para revisar" aoAbrir={setAberta} sinais />}
      </Dados>
      <Dados consulta={conferir} esqueleto={<EsqueletoTabela linhas={2} />}>
        {(p) => <Fila titulo="Tipo a conferir" descricao="A pessoa escolheu entre intervalo e saída. Para confirmar, abra e corrija mantendo o mesmo tipo." linhas={p.itens} vazio="Nada a conferir" aoAbrir={setAberta} />}
      </Dados>
      <Cartao titulo="Histórico de correções" descricao={`Últimos ${DIAS} dias. As marcações originais continuam guardadas.`} justo>
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
      {aberta && <DetalheDia linha={aberta} perm={perm} aoFechar={() => setAberta(null)} />}
    </div>
  );
}
