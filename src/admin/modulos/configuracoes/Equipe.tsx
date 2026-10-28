// Equipe e acessos (só Proprietário): a equipe real da unidade, vinda do backend (GET /admin/usuarios). Mudar perfil,
// desativar, reativar e encerrar sessões são rotas reais; o backend recusa mudar o próprio perfil, desativar a própria
// conta e tirar o último proprietário. Contas novas e senhas: só pela CLI do backend (provisionar-equipe, definir-senha),
// num terminal — nenhuma senha passa pelo painel.
import { Users } from 'lucide-preact';
import { useConsulta, invalidar } from '../../lib/consulta';
import { pedir } from '../../lib/api/cliente';
import { dataHora } from '../../lib/formato';
import { NOME_PAPEL, type Papel } from '../../lib/sessao';
import { useConfirmacao, Suspenso, avisar, avisarErro } from '../../ui/camadas';
import { Botao, Cartao, Situacao } from '../../ui/base';
import { Dados, EsqueletoTabela } from '../../ui/estados';
import { Tabela } from '../../ui/tabela';

interface Membro {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  perfil: string;
  ativo: boolean;
  unidades: number[];
  ultimo_login_em: string | null;
}

const PERFIS: Papel[] = ['admin', 'gerente', 'operador'];

export function Equipe({ eu }: { eu: string }) {
  const consulta = useConsulta('usuarios', () => pedir<Membro[]>('usuarios'));
  const { confirmar, elemento } = useConfirmacao();

  const agir = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      avisar(ok, 'ok');
    } catch (e) {
      avisarErro(e);
    } finally {
      invalidar('usuarios');
    }
  };
  const mudarPerfil = (m: Membro, papel: Papel) =>
    confirmar({
      titulo: `Mudar ${m.nome} para ${NOME_PAPEL[papel]}?`,
      texto: 'Vale na hora: a pessoa precisa entrar de novo e passa a ver só o que o novo perfil permite.',
      confirmar: 'Mudar perfil',
      acao: () => agir(() => pedir(`usuarios/${m.id}/perfil`, { metodo: 'PUT', corpo: { papel } }), 'Perfil alterado.'),
    });
  const desativar = (m: Membro) =>
    confirmar({
      titulo: `Desativar o acesso de ${m.nome}?`,
      texto: 'Ninguém consegue mais entrar com esta conta e as sessões abertas caem na hora. O histórico fica.',
      confirmar: 'Desativar',
      perigo: true,
      acao: () => agir(() => pedir(`usuarios/${m.id}/desativar`, { metodo: 'POST' }), 'Acesso desativado.'),
    });
  const encerrar = (m: Membro) =>
    confirmar({
      titulo: `Encerrar as sessões de ${m.nome}?`,
      texto: 'Todos os aparelhos com esta conta voltam para a tela de entrada. A senha não muda.',
      confirmar: 'Encerrar sessões',
      acao: () => agir(() => pedir(`usuarios/${m.id}/revogar-sessoes`, { metodo: 'POST' }), 'Sessões encerradas.'),
    });

  return (
    <Cartao
      titulo={<span class="linha"><Users size={16} aria-hidden="true" /> Equipe e acessos</span>}
      descricao="Quem entra no painel desta unidade"
      justo
      rodape={<span class="fraco">Contas novas e troca de senha: pelo terminal do sistema (provisionar-equipe e definir-senha). Nenhuma senha passa por esta tela.</span>}
    >
      <Dados consulta={consulta} recurso="A equipe" esqueleto={<EsqueletoTabela linhas={4} />}>
        {(lista) => (
          <Tabela<Membro>
            rotulo="Equipe e acessos"
            linhas={lista}
            chave={(m) => m.id}
            colunas={[
              { id: 'nome', titulo: 'Nome', celula: (m) => <span class="principal-celula">{m.nome}{m.id === eu && <span class="fraco"> (você)</span>}</span> },
              { id: 'email', titulo: 'E-mail', prioridade: 'media', celula: (m) => <span class="fraco">{m.email}</span> },
              { id: 'perfil', titulo: 'Perfil', celula: (m) => NOME_PAPEL[m.papel] ?? m.perfil },
              { id: 'sit', titulo: 'Situação', celula: (m) => <Situacao tom={m.ativo ? 'ok' : 'apagado'}>{m.ativo ? 'Ativa' : 'Desativada'}</Situacao> },
              { id: 'login', titulo: 'Último acesso', prioridade: 'baixa', celula: (m) => <span class="fraco">{m.ultimo_login_em ? dataHora(m.ultimo_login_em) : 'Nunca entrou'}</span> },
              {
                id: 'acoes', titulo: '',
                celula: (m) => m.id === eu ? null : (
                  <Suspenso rotulo={`Ações para ${m.nome}`} gatilho={(p) => <Botao tamanho="p" variante="fantasma" {...p}>Gerenciar</Botao>}>
                    {(fechar) => (
                      <>
                        {m.ativo && PERFIS.filter((x) => x !== m.papel).map((x) => (
                          <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); mudarPerfil(m, x); }}>Tornar {NOME_PAPEL[x]}</button>
                        ))}
                        {m.ativo && <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); encerrar(m); }}>Encerrar sessões</button>}
                        {m.ativo
                          ? <button class="suspenso__item suspenso__item--perigo" role="menuitem" onClick={() => { fechar(); desativar(m); }}>Desativar acesso</button>
                          : <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); void agir(() => pedir(`usuarios/${m.id}/reativar`, { metodo: 'POST' }), 'Acesso reativado.'); }}>Reativar acesso</button>}
                      </>
                    )}
                  </Suspenso>
                ),
              },
            ]}
          />
        )}
      </Dados>
      {elemento}
    </Cartao>
  );
}
