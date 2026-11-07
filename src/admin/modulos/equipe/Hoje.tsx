// Visão de hoje: números e nomes reais do backend (GET /painel). Sem gráficos: quem está, quem falta, o que revisar.
import { useState } from 'preact/hooks';
import { AlertTriangle, Clock, Coffee, UserCheck, UserPlus, UserX, Users, ClipboardCheck } from 'lucide-preact';
import type { Consulta } from '../../lib/consulta';
import type { LinhaEspelho, PainelEquipe } from '../../lib/tipos/equipe';
import { horaDe } from '../../lib/formato';
import { Botao, Cartao, Indicador, Situacao } from '../../ui/base';
import { Dados, Vazio } from '../../ui/estados';
import { ROTULO_STATUS, TOM_STATUS, type PermissoesEquipe } from './comum';
import { RegistroAssistido } from './Assistido';

function Pessoas({ titulo, linhas, vazio, hora }: { titulo: string; linhas: LinhaEspelho[]; vazio: string; hora?: (l: LinhaEspelho) => string }) {
  return (
    <Cartao titulo={titulo} justo>
      {linhas.length ? (
        <ul class="lista" aria-label={titulo}>
          {linhas.map((l) => (
            <li key={l.funcionario_id}>
              <div class="lista__item">
                <span class="linha linha--entre" style={{ width: '100%' }}>
                  <span>
                    <strong>{l.nome_exibicao}</strong> <span class="fraco">{l.cargo}</span>
                  </span>
                  <span class="linha">
                    {hora && <span class="fraco num">{hora(l)}</span>}
                    <Situacao tom={TOM_STATUS[l.status]}>{ROTULO_STATUS[l.status]}</Situacao>
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Vazio compacto titulo={vazio} />
      )}
    </Cartao>
  );
}

export function Hoje({ consulta, perm, aoCadastrar }: { consulta: Consulta<PainelEquipe>; perm: PermissoesEquipe; aoCadastrar: () => void }) {
  const [assistido, setAssistido] = useState(false);
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
                Cadastre a equipe para acompanhar presença, atrasos e registros de ponto.
              </Vazio>
            </Cartao>
          );
        }
        return (
          <div class="pilha">
            <div class="indicadores equipe-indicadores">
              <Indicador rotulo="Funcionários ativos" icone={<Users aria-hidden="true" />} valor={i.funcionarios_ativos} />
              <Indicador rotulo="Presentes agora" icone={<UserCheck aria-hidden="true" />} valor={i.presentes} />
              <Indicador rotulo="Em intervalo" icone={<Coffee aria-hidden="true" />} valor={i.em_intervalo} />
              <Indicador rotulo="Atrasados" icone={<Clock aria-hidden="true" />} valor={i.atrasados} />
              <Indicador rotulo="Ausentes" icone={<UserX aria-hidden="true" />} valor={i.ausentes} rodape="Conforme a escala" />
              <Indicador rotulo="Precisam de revisão" icone={<AlertTriangle aria-hidden="true" />} valor={i.pendencias + i.a_conferir} rodape={i.a_conferir ? `${i.a_conferir} a conferir` : undefined} />
            </div>
            {perm.ajustar && (
              <div class="linha">
                <Botao icone={<ClipboardCheck aria-hidden="true" />} onClick={() => setAssistido(true)}>Registro assistido</Botao>
              </div>
            )}
            <div class="equipe-colunas">
              <Pessoas titulo="Presentes" linhas={[...p.presentes, ...p.em_intervalo]} vazio="Ninguém presente agora" hora={(l) => `desde ${horaDe(l.entrada)}`} />
              <Pessoas titulo="Atrasados e ausentes" linhas={[...p.atrasados, ...p.ausentes]} vazio="Nenhum atraso ou ausência" hora={(l) => (l.previsto.entrada ? `previsto ${horaDe(l.previsto.entrada)}` : '')} />
              <Pessoas titulo="Ainda não chegaram" linhas={p.ainda_nao_chegaram} vazio="Ninguém por chegar" hora={(l) => (l.previsto.entrada ? `previsto ${horaDe(l.previsto.entrada)}` : '')} />
              <Pessoas titulo="Encerraram o dia" linhas={p.jornada_encerrada} vazio="Nenhuma jornada encerrada" hora={(l) => (l.saida ? `saiu ${horaDe(l.saida)}` : '')} />
            </div>
            <RegistroAssistido aberto={assistido} aoFechar={() => setAssistido(false)} />
          </div>
        );
      }}
    </Dados>
  );
}
