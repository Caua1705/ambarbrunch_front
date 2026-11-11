// Equipe e acessos (só Proprietário): a equipe real da unidade, vinda do backend (GET /admin/usuarios). Mudar perfil,
// desativar, reativar e encerrar sessões são rotas reais; o backend recusa mudar o próprio perfil, desativar a própria
// conta e tirar o último proprietário. Contas novas (ex.: a do Atendente do tablet) e senhas também saem daqui
// (POST /admin/usuarios e /admin/usuarios/{id}/senha): a senha vai só no envio, por HTTPS, vira hash (bcrypt) no
// servidor e nunca volta nem aparece de novo. Trocar a senha derruba as sessões abertas da conta.
import { useEffect, useState } from 'preact/hooks';
import { Users, Plus } from 'lucide-preact';
import { useConsulta, invalidar } from '../../lib/consulta';
import { pedir, ErroApi } from '../../lib/api/cliente';
import { dataHora } from '../../lib/formato';
import { NOME_PAPEL, type Papel } from '../../lib/sessao';
import { useConfirmacao, Suspenso, Gaveta, avisar, avisarErro } from '../../ui/camadas';
import { Botao, Campo, Cartao, Situacao, Aviso } from '../../ui/base';
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
const SENHA_MINIMA = 10;  // a mesma regra do backend (app/nucleo/seguranca.py)

export function Equipe({ eu }: { eu: string }) {
  const consulta = useConsulta('usuarios', () => pedir<Membro[]>('usuarios'));
  const { confirmar, elemento } = useConfirmacao();
  const [nova, setNova] = useState(false);
  const [senhaDe, setSenhaDe] = useState<Membro | null>(null);

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
      acoes={<Botao tamanho="p" variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setNova(true)}>Nova conta</Botao>}
      justo
      rodape={<span class="fraco">A senha só é enviada ao criar a conta ou definir uma nova; ela não fica visível em lugar nenhum. A conta do Atendente abre Conversas, Reservas e o Ponto do tablet.</span>}
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
                        {m.ativo && <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); setSenhaDe(m); }}>Definir nova senha</button>}
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
      <NovaConta aberta={nova} aoFechar={() => setNova(false)} />
      <DefinirSenha membro={senhaDe} aoFechar={() => setSenhaDe(null)} />
      {elemento}
    </Cartao>
  );
}

/** Campos de senha + confirmação; a senha fica só no estado desta gaveta e some ao fechar. */
function CamposSenha({ senha, setSenha, repetir, setRepetir, rotulo }: { senha: string; setSenha: (v: string) => void; repetir: string; setRepetir: (v: string) => void; rotulo: string }) {
  return (
    <>
      <Campo rotulo={rotulo} ajuda={`Pelo menos ${SENHA_MINIMA} caracteres. Combine com a pessoa por um canal seguro; não envie no grupo.`}>
        {(id, d) => <input id={id} type="password" class="entrada" autocomplete="new-password" aria-describedby={d} value={senha} onInput={(e) => setSenha(e.currentTarget.value)} />}
      </Campo>
      <Campo rotulo="Repita a senha">
        {(id) => <input id={id} type="password" class="entrada" autocomplete="new-password" value={repetir} onInput={(e) => setRepetir(e.currentTarget.value)} />}
      </Campo>
    </>
  );
}

function validarSenha(senha: string, repetir: string): string | null {
  if (senha.length < SENHA_MINIMA) return `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`;
  if (senha !== repetir) return 'As duas senhas não são iguais.';
  return null;
}

function NovaConta({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<Papel>('operador');
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (!aberta) return;
    setNome(''); setEmail(''); setPapel('operador'); setSenha(''); setRepetir(''); setErro(null);
  }, [aberta]);

  async function criar(e: Event) {
    e.preventDefault();
    if (nome.trim().length < 2 || !email.includes('@')) return setErro('Informe o nome e um e-mail válido.');
    const problema = validarSenha(senha, repetir);
    if (problema) return setErro(problema);
    setEnviando(true);
    setErro(null);
    try {
      await pedir('usuarios', { metodo: 'POST', corpo: { nome: nome.trim(), email: email.trim(), papel, senha } });
      avisar(`Conta criada. ${NOME_PAPEL[papel]} já pode entrar com o e-mail e a senha.`, 'ok');
      invalidar('usuarios');
      aoFechar();
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível criar a conta.');
    } finally {
      setEnviando(false);
      setSenha('');
      setRepetir('');
    }
  }

  return (
    <Gaveta aberta={aberta} aoFechar={aoFechar} titulo="Nova conta" subtitulo="Acesso ao painel desta unidade"
      rodape={<><Botao onClick={aoFechar} disabled={enviando}>Cancelar</Botao><Botao variante="primario" type="submit" form="form-nova-conta" carregando={enviando}>Criar conta</Botao></>}>
      <form id="form-nova-conta" class="pilha" onSubmit={criar} noValidate>
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
        <Campo rotulo="Nome">{(id) => <input id={id} class="entrada" maxLength={120} autocomplete="off" value={nome} onInput={(e) => setNome(e.currentTarget.value)} />}</Campo>
        <Campo rotulo="E-mail">{(id) => <input id={id} type="email" class="entrada" maxLength={200} autocomplete="off" value={email} onInput={(e) => setEmail(e.currentTarget.value)} />}</Campo>
        <Campo rotulo="Perfil" ajuda={papel === 'operador' ? 'Atendente: Conversas, Reservas e o Ponto do tablet. Sem Financeiro, Estoque ou configurações.' : undefined}>
          {(id, d) => (
            <select id={id} class="selecao" aria-describedby={d} value={papel} onChange={(e) => setPapel(e.currentTarget.value as Papel)}>
              <option value="operador">{NOME_PAPEL.operador}</option>
              <option value="gerente">{NOME_PAPEL.gerente}</option>
              <option value="admin">{NOME_PAPEL.admin}</option>
            </select>
          )}
        </Campo>
        <CamposSenha rotulo="Senha inicial" senha={senha} setSenha={setSenha} repetir={repetir} setRepetir={setRepetir} />
      </form>
    </Gaveta>
  );
}

function DefinirSenha({ membro, aoFechar }: { membro: Membro | null; aoFechar: () => void }) {
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { setSenha(''); setRepetir(''); setErro(null); }, [membro?.id]);
  if (!membro) return null;

  async function salvar(e: Event) {
    e.preventDefault();
    const problema = validarSenha(senha, repetir);
    if (problema) return setErro(problema);
    setEnviando(true);
    setErro(null);
    try {
      await pedir(`usuarios/${membro!.id}/senha`, { metodo: 'POST', corpo: { senha } });
      avisar('Senha definida. As sessões abertas desta conta foram encerradas.', 'ok');
      invalidar('usuarios');
      aoFechar();
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível definir a senha.');
    } finally {
      setEnviando(false);
      setSenha('');
      setRepetir('');
    }
  }

  return (
    <Gaveta aberta aoFechar={aoFechar} titulo="Definir nova senha" subtitulo={`${membro.nome} · ${membro.email}`}
      rodape={<><Botao onClick={aoFechar} disabled={enviando}>Cancelar</Botao><Botao variante="primario" type="submit" form="form-senha" carregando={enviando}>Salvar senha</Botao></>}>
      <form id="form-senha" class="pilha" onSubmit={salvar} noValidate>
        <Aviso tom="info">Todos os aparelhos com esta conta (inclusive o tablet) saem e entram de novo com a senha nova.</Aviso>
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
        <CamposSenha rotulo="Nova senha" senha={senha} setSenha={setSenha} repetir={repetir} setRepetir={setRepetir} />
      </form>
    </Gaveta>
  );
}
