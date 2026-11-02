// Cadastros duplicados (clientes.visualizar; ligar exige clientes.editar): telefones e e-mails com mais de um cadastro,
// classificados pelo backend — provável mesma pessoa (mesmo nome), ambíguo (família, empresa, número compartilhado) ou
// resolvido (já ligados a um principal). Ligar diz qual cadastro é o principal: NADA é apagado nem fundido, as reservas
// continuam no cadastro de origem e o vínculo é auditado. Desfazer um vínculo fica fora desta tela: a lista do backend não
// traz o id do vínculo (DELETE atendimento/vinculos/{id}).
import { useState } from 'preact/hooks';
import { UsersRound, Link2, BadgeCheck } from 'lucide-preact';
import { useConsulta, invalidar } from '../../lib/consulta';
import { atendimento } from '../../lib/api/atendimento-clube';
import { dataCurta, plural, telefone as fmtTel, inteiro } from '../../lib/formato';
import { Gaveta, type useConfirmacao } from '../../ui/camadas';
import { Botao, Etiqueta, Aviso, type Tom } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type { CadastroContato, Duplicidades as TipoDuplicidades, GrupoDuplicidade } from '../../lib/tipos/atendimento-clube';
import { ORIGEM, origemContato } from './comum';

type Confirmar = ReturnType<typeof useConfirmacao>['confirmar'];

const CLASSIFICACAO: Record<GrupoDuplicidade['classificacao'], { rotulo: string; tom: Tom }> = {
  provavel_mesma_pessoa: { rotulo: 'Provável mesma pessoa', tom: 'atencao' },
  ambiguo: { rotulo: 'Ambíguo', tom: 'perigo' },
  resolvido: { rotulo: 'Resolvido', tom: 'ok' },
};

export function Duplicidades({ aberta, aoFechar, podeVincular, confirmar }: { aberta: boolean; aoFechar: () => void; podeVincular: boolean; confirmar: Confirmar }) {
  const consulta = useConsulta(aberta ? 'atendimento/duplicidades' : null, () => atendimento.duplicidades());
  const [ver, setVer] = useState<'pendentes' | 'todos'>('pendentes');
  return (
    <Gaveta aberta={aberta} aoFechar={aoFechar} largura="larga" titulo="Cadastros duplicados" subtitulo="Mesmo telefone ou mesmo e-mail em mais de um cadastro">
      <div class="pilha">
        <Aviso tom="info" icone={<UsersRound aria-hidden="true" />}>
          Nada é apagado nem fundido. Ligar só indica qual cadastro é o principal: as reservas continuam onde estão e a conversa
          do WhatsApp passa a reconhecer o contato. Pessoas diferentes podem dividir um número — na dúvida, não ligue.
        </Aviso>
        <Dados consulta={consulta} recurso="O relatório de duplicidades" esqueleto={<Esqueleto linhas={8} />}>
          {(d: TipoDuplicidades) => {
            const grupos = ver === 'todos' ? d.grupos : d.grupos.filter((g) => g.classificacao !== 'resolvido');
            return (
              <>
                <div class="linha linha--entre">
                  <p class="fraco">
                    {plural(d.resumo.provavel_mesma_pessoa, 'provável mesma pessoa', 'prováveis mesmas pessoas')} · {plural(d.resumo.ambiguo, 'ambíguo', 'ambíguos')} · {plural(d.resumo.resolvido, 'resolvido', 'resolvidos')} · {inteiro(d.total_cadastros)} cadastros no total
                  </p>
                  <button type="button" class="link link--discreto" aria-pressed={ver === 'todos'} onClick={() => setVer(ver === 'todos' ? 'pendentes' : 'todos')}>
                    {ver === 'todos' ? 'Esconder resolvidos' : 'Mostrar resolvidos'}
                  </button>
                </div>
                {grupos.length ? (
                  <ul class="pilha" style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Grupos de cadastros duplicados">
                    {grupos.map((g) => (
                      <Grupo key={`${g.por}:${g.valor}`} g={g} podeVincular={podeVincular} confirmar={confirmar} />
                    ))}
                  </ul>
                ) : (
                  <Vazio compacto icone={<UsersRound aria-hidden="true" />} titulo="Nenhum duplicado pendente">Nenhum telefone ou e-mail com cadastros soltos.</Vazio>
                )}
              </>
            );
          }}
        </Dados>
      </div>
    </Gaveta>
  );
}

/** Principal sugerido: o que os outros já apontam, senão telefone verificado, senão o com mais reservas, senão o mais antigo. */
function sugerido(cadastros: CadastroContato[]): string {
  const apontado = cadastros.find((c) => c.principal_id)?.principal_id;
  if (apontado && cadastros.some((c) => c.id === apontado)) return apontado;
  const ordenados = [...cadastros].sort((a, b) => Number(b.telefone_verificado) - Number(a.telefone_verificado) || b.reservas - a.reservas || a.criado_em.localeCompare(b.criado_em));
  return ordenados[0].id;
}

function Grupo({ g, podeVincular, confirmar }: { g: GrupoDuplicidade; podeVincular: boolean; confirmar: Confirmar }) {
  const [principal, setPrincipal] = useState(() => sugerido(g.cadastros));
  const cls = CLASSIFICACAO[g.classificacao] ?? { rotulo: g.classificacao, tom: 'neutro' as Tom };
  const resolvido = g.classificacao === 'resolvido';
  const ligar = g.cadastros.filter((c) => c.id !== principal && c.principal_id !== principal);
  const escolhido = g.cadastros.find((c) => c.id === principal);
  const nomeRadio = `principal-${g.por}-${g.valor}`;

  const vincular = () =>
    confirmar({
      titulo: `Ligar ${plural(ligar.length, 'cadastro', 'cadastros')} a ${escolhido?.nome ?? 'o principal'}?`,
      texto: 'Nada é apagado: cada cadastro continua com as próprias reservas e o vínculo pode ser desfeito pela equipe técnica.',
      confirmar: 'Ligar',
      motivo: { rotulo: 'Por que são a mesma pessoa?', minimo: 3, maximo: 200, ajuda: 'Fica registrado no histórico (ex.: confirmado com o cliente pelo WhatsApp).' },
      acao: async (motivo) => {
        try {
          for (const c of ligar) await atendimento.vincular(c.id, principal, motivo);
        } finally {
          invalidar('atendimento');
        }
      },
      sucesso: 'Cadastros ligados ao principal.',
    });

  return (
    <li class="cartao grupo-duplicado">
      <div class="linha linha--entre" style={{ padding: '12px 16px', borderBottom: '1px solid var(--borda)' }}>
        <strong class="num">{g.por === 'telefone' ? `Telefone ${fmtTel(g.valor)}` : `E-mail ${g.valor}`}</strong>
        <Etiqueta tom={cls.tom}>{cls.rotulo}</Etiqueta>
      </div>
      <ul class="lista" aria-label={`Cadastros com ${g.por === 'telefone' ? 'este telefone' : 'este e-mail'}`}>
        {g.cadastros.map((c) => (
          <li key={c.id} class="grupo-duplicado__cadastro">
            {podeVincular && !resolvido && (
              <input type="radio" name={nomeRadio} checked={c.id === principal} onChange={() => setPrincipal(c.id)} aria-label={`Usar ${c.nome} como principal`} />
            )}
            <span class="lista__texto" style={{ flex: 1 }}>
              <strong>
                {c.nome}
                {c.principal_id ? <> <Etiqueta>Ligado a {g.cadastros.find((x) => x.id === c.principal_id)?.nome ?? 'outro cadastro'}</Etiqueta></> : null}
                {podeVincular && !resolvido && c.id === principal ? <> <Etiqueta tom="marca">Principal</Etiqueta></> : null}
              </strong>
              <span>
                {origemContato(c.giardini)} · {ORIGEM[c.origem] ?? c.origem} · desde {dataCurta(c.criado_em, { ano: true })} · {plural(c.reservas, 'reserva', 'reservas')}
                {c.email ? ` · ${c.email}` : ''}
              </span>
            </span>
            {c.telefone_verificado && <BadgeCheck size={16} aria-label="Telefone verificado" style={{ flex: 'none', color: 'var(--ok)' }} />}
          </li>
        ))}
      </ul>
      {podeVincular && !resolvido && (
        <div class="linha linha--entre" style={{ padding: '10px 16px', borderTop: '1px solid var(--borda)' }}>
          <span class="fraco">{g.classificacao === 'ambiguo' ? 'Nomes diferentes: confirme com o cliente antes de ligar.' : 'Escolha o principal e ligue os outros a ele.'}</span>
          <Botao tamanho="p" icone={<Link2 aria-hidden="true" />} disabled={!ligar.length} onClick={vincular}>
            Ligar {plural(ligar.length, 'cadastro', 'cadastros')} ao principal
          </Botao>
        </div>
      )}
    </li>
  );
}
