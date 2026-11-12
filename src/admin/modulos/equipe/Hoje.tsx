// Visão de hoje: quem está previsto, a que horas entrou e saiu e a situação, numa lista só (dados reais do GET /painel).
// Cada pessoa aparece uma vez: o status vem do backend, que respeita escala, tolerância e a hora atual (ausente só depois
// do fim do turno; antes disso, "aguardando" ou "atrasado"). O que espera revisão leva aos registros de correção.
import { UserPlus } from 'lucide-preact';
import type { Consulta } from '../../lib/consulta';
import type { LinhaEspelho, PainelEquipe, StatusDia } from '../../lib/tipos/equipe';
import { horaDe } from '../../lib/formato';
import { Aviso, Botao, Cartao, Situacao } from '../../ui/base';
import { Dados, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import { ROTULO_STATUS, TOM_STATUS, type PermissoesEquipe } from './comum';

/** Ordem na lista: quem pede atenção primeiro, depois quem está na casa, quem ainda vem e quem já saiu. */
const ORDEM: StatusDia[] = ['pendente_revisao', 'ausente', 'atrasado', 'trabalhando', 'em_intervalo', 'aguardando', 'previsto', 'encerrada'];

function pessoasDoDia(p: PainelEquipe): LinhaEspelho[] {
  const vistas = new Map<string, LinhaEspelho>();
  // `atrasados` repete quem já está em outra lista (chegou atrasado ou ainda não chegou): não entra de novo.
  for (const l of [...p.pendencias, ...p.ausentes, ...p.presentes, ...p.em_intervalo, ...p.ainda_nao_chegaram, ...p.jornada_encerrada]) {
    if (!vistas.has(l.funcionario_id)) vistas.set(l.funcionario_id, l);
  }
  const pos = (s: StatusDia) => { const i = ORDEM.indexOf(s); return i < 0 ? ORDEM.length : i; };
  return [...vistas.values()].sort((a, b) => pos(a.status) - pos(b.status)
    || String(a.previsto.entrada ?? '').localeCompare(String(b.previsto.entrada ?? '')) || a.nome_exibicao.localeCompare(b.nome_exibicao, 'pt-BR'));
}

const previsto = (l: LinhaEspelho) => (l.previsto.entrada ? `${horaDe(l.previsto.entrada)}–${horaDe(l.previsto.saida)}` : '—');

export function Hoje({ consulta, perm, aoCadastrar, aoRevisar, aRevisar }: { consulta: Consulta<PainelEquipe>; perm: PermissoesEquipe; aoCadastrar: () => void; aoRevisar: () => void; aRevisar: number | null }) {
  const colunas: Coluna<LinhaEspelho>[] = [
    { id: 'nome', titulo: 'Funcionário', celula: (l) => <><span class="principal-celula">{l.nome_exibicao}</span><span class="sub">{l.cargo}</span></> },
    { id: 'previsto', titulo: 'Previsto', prioridade: 'media', celula: (l) => <span class="num">{previsto(l)}</span> },
    { id: 'entrada', titulo: 'Entrada', celula: (l) => <span class="num">{horaDe(l.entrada)}</span> },
    { id: 'saida', titulo: 'Saída', celula: (l) => <span class="num">{horaDe(l.saida)}</span> },
    { id: 'situacao', titulo: 'Situação', celula: (l) => <Situacao tom={TOM_STATUS[l.status]}>{ROTULO_STATUS[l.status]}</Situacao> },
  ];
  return (
    <Dados consulta={consulta} recurso="O módulo Equipe">
      {(p) => {
        const i = p.indicadores;
        if (!i.funcionarios_ativos) {
          return (
            <Cartao>
              <Vazio
                icone={<UserPlus aria-hidden="true" />}
                titulo="Nenhum funcionário cadastrado"
                acao={perm.gerenciar && <Botao variante="primario" onClick={aoCadastrar}>Cadastrar funcionário</Botao>}
              >
                Cadastre a equipe para acompanhar presença e registros de ponto.
              </Vazio>
            </Cartao>
          );
        }
        const linhas = pessoasDoDia(p);
        const resumo = [
          `${i.presentes + i.em_intervalo} na casa`,
          i.ainda_nao_chegaram ? `${i.ainda_nao_chegaram} por chegar` : '',
          i.ausentes ? `${i.ausentes} sem marcação` : '',
          i.jornada_encerrada ? `${i.jornada_encerrada} já ${i.jornada_encerrada === 1 ? 'saiu' : 'saíram'}` : '',
        ].filter(Boolean).join(' · ');
        return (
          <div class="pilha">
            {!!aRevisar && (
              <Aviso tom="atencao">
                <span class="linha linha--entre" style={{ width: '100%' }}>
                  <span>{aRevisar === 1 ? '1 registro de ponto precisa de revisão.' : `${aRevisar} registros de ponto precisam de revisão.`}</span>
                  <Botao tamanho="p" onClick={aoRevisar}>Revisar</Botao>
                </span>
              </Aviso>
            )}
            <Cartao titulo="Equipe de hoje" descricao={resumo} justo>
              <Tabela
                rotulo="Equipe de hoje"
                colunas={colunas}
                linhas={linhas}
                chave={(l) => l.funcionario_id}
                movel={(l) => (
                  <div class="pilha pilha--p">
                    <div class="linha linha--entre"><strong>{l.nome_exibicao}</strong><Situacao tom={TOM_STATUS[l.status]}>{ROTULO_STATUS[l.status]}</Situacao></div>
                    <span class="fraco num">Previsto {previsto(l)} · entrou {horaDe(l.entrada)} · saiu {horaDe(l.saida)}</span>
                  </div>
                )}
                vazio={<Vazio compacto titulo="Ninguém previsto para hoje" />}
              />
            </Cartao>
          </div>
        );
      }}
    </Dados>
  );
}
