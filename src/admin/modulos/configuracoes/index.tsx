// Configurações (Proprietário e Gerente), em grupos numa lista ao lado: Conta e aparência; Agenda e ambientes (política
// e ambientes das reservas, só Proprietário); Equipe e acessos (a equipe só para o Proprietário; os perfis para todos);
// Atendimento (base de conhecimento da IA e cadastros duplicados, cada um na própria gaveta); Financeiro (os cadastros
// Categorias e Fornecedores, mais atalhos para contas fixas, taxas e contas bancárias: CadastrosFinanceiro.tsx); Ponto (tablets
// autorizados e auditoria do ponto, só para quem tem ponto.dispositivos ou auditoria.visualizar: Ponto.tsx). Só o que tem
// contrato no backend: contas novas e senhas só pela CLI, integrações sem rota de configuração — sem formulário de mentira.
import { useEffect, useState } from 'preact/hooks';
import { Sun, Moon, Monitor, LogOut, ShieldCheck, Pencil, CalendarCog, UserRound, Users, Wallet, ChevronRight, MessagesSquare, BookOpen, UsersRound, Tablet } from 'lucide-preact';
import type { ContextoPainel, Papel } from '../../lib/sessao';
import { NOME_PAPEL } from '../../lib/sessao';
import { pode, podeVer } from '../../lib/permissoes';
import { lerParam, gravarParams } from '../../lib/rotas';
import { useConsulta, invalidar } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { ErroApi } from '../../lib/api/cliente';
import { Raiz, Gaveta, avisar, avisarErro, useConfirmacao } from '../../ui/camadas';
import { sair } from '../../layout/sair';
import { Botao, Cartao, Segmentado, Campo, Aviso, Situacao } from '../../ui/base';
import { Dados, EsqueletoTabela } from '../../ui/estados';
import { Equipe } from './Equipe';
import { CadastrosFinanceiro } from './CadastrosFinanceiro';
import { ConfiguracoesPonto, vePonto } from './Ponto';
import { Conhecimento } from '../atendimento/Conhecimento';
import { Duplicidades } from '../atendimento/Duplicidades';
import { Tabela } from '../../ui/tabela';
import type { AmbienteConfig, PoliticaReserva } from '../../lib/tipos/reservas';

type Tema = 'claro' | 'escuro' | 'sistema';
type Secao = 'conta' | 'agenda' | 'equipe' | 'atendimento' | 'financeiro' | 'ponto';

export default function Configuracoes({ contexto }: { contexto: ContextoPainel }) {
  const { usuario, unidade, unidades } = contexto;
  const veAgenda = pode(usuario.papel, 'reservas.configurar') && contexto.modulos.includes('reservas') && !!unidade;
  const veFinanceiro = podeVer(usuario.papel, 'financeiro') && contexto.modulos.includes('financeiro');
  const veAtendimento = podeVer(usuario.papel, 'atendimento') && contexto.modulos.includes('atendimento');
  const veDuplicidades = pode(usuario.papel, 'clientes.visualizar');
  const vePontoAqui = podeVer(usuario.papel, 'equipe') && contexto.modulos.includes('equipe') && vePonto(usuario.papel);
  const [gaveta, setGaveta] = useState<'conhecimento' | 'duplicidades' | null>(null);
  const { confirmar, elemento: dialogo } = useConfirmacao();
  const secoes: { id: Secao; rotulo: string; icone: typeof UserRound }[] = [
    { id: 'conta', rotulo: 'Conta e aparência', icone: UserRound },
    ...(veAgenda ? [{ id: 'agenda' as const, rotulo: 'Agenda e ambientes', icone: CalendarCog }] : []),
    { id: 'equipe', rotulo: 'Equipe e acessos', icone: Users },
    ...(veAtendimento ? [{ id: 'atendimento' as const, rotulo: 'Atendimento', icone: MessagesSquare }] : []),
    ...(veFinanceiro ? [{ id: 'financeiro' as const, rotulo: 'Financeiro', icone: Wallet }] : []),
    ...(vePontoAqui ? [{ id: 'ponto' as const, rotulo: 'Ponto: tablets e auditoria', icone: Tablet }] : []),
  ];
  const [secao, setSecao] = useState<Secao>(() => {
    const s = lerParam('secao');
    return secoes.some((x) => x.id === s) ? (s as Secao) : 'conta';
  });
  useEffect(() => gravarParams({ secao: secao === 'conta' ? null : secao }), [secao]);
  const atual = secoes.find((x) => x.id === secao) ?? secoes[0];
  const [tema, setTema] = useState<Tema>('sistema');
  useEffect(() => {
    try {
      const t = localStorage.getItem('painel-tema');
      setTema(t === 'claro' || t === 'escuro' ? t : 'sistema');
    } catch {
      /* sem armazenamento */
    }
  }, []);
  const mudarTema = (t: Tema) => {
    setTema(t);
    const efetivo = t === 'sistema' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro') : t;
    document.documentElement.setAttribute('data-tema', efetivo);
    try {
      if (t === 'sistema') localStorage.removeItem('painel-tema');
      else localStorage.setItem('painel-tema', t);
    } catch {
      /* vale só nesta página */
    }
  };

  return (
    <Raiz>
      <div class="sub-navegacao">
      <nav class="sub-navegacao__menu" aria-label="Grupos de configuração">
        <ul>
          {secoes.map((x) => (
            <li key={x.id}>
              <button type="button" aria-current={x.id === secao ? 'page' : undefined} onClick={() => setSecao(x.id)}>
                <x.icone aria-hidden="true" />
                {x.rotulo}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <section class="sub-navegacao__conteudo pilha" aria-labelledby="config-titulo">
      <h2 class="sub-navegacao__h2" id="config-titulo">{atual.rotulo}</h2>
      {secao === 'conta' && (
      <div class="colunas-iguais">
        <Cartao titulo="Sua conta">
          <div class="pilha">
            <dl class="definicoes">
              <dt>Nome</dt>
              <dd>{usuario.nome}</dd>
              <dt>E-mail</dt>
              <dd>{usuario.email}</dd>
              <dt>Perfil</dt>
              <dd>{NOME_PAPEL[usuario.papel]}</dd>
              <dt>Unidades</dt>
              <dd>{unidades.map((u) => u.nome).join(', ') || '—'}</dd>
            </dl>
            <p class="fraco">Para trocar a senha ou o perfil, fale com um proprietário.</p>
            <p class="fraco">Sair encerra esta conta em todos os aparelhos. Em computador compartilhado, sempre saia ao terminar. Se achar que alguém usou o seu acesso, peça a um proprietário para encerrar as suas sessões.</p>
            <Botao icone={<LogOut aria-hidden="true" />} onClick={() => void sair()} style={{ alignSelf: 'flex-start' }}>Sair do painel</Botao>
          </div>
        </Cartao>
        <div class="pilha">
          <Cartao titulo="Aparência" descricao="Vale para este aparelho">
            <Segmentado rotulo="Tema" valor={tema} aoMudar={mudarTema} opcoes={[{ valor: 'claro', rotulo: <><Sun size={14} aria-hidden="true" /> Claro</> }, { valor: 'escuro', rotulo: <><Moon size={14} aria-hidden="true" /> Escuro</> }, { valor: 'sistema', rotulo: <><Monitor size={14} aria-hidden="true" /> Igual ao aparelho</> }]} />
          </Cartao>
          {unidades.length > 1 && (
            <Cartao titulo="Unidade de trabalho" descricao="Café, Roll e operação da noite têm finanças separadas">
              <p class="suave pequeno">
                Esta aba está em <strong>{unidade?.nome ?? '—'}</strong>. Para trabalhar em outra unidade, abra o menu da sua conta (no topo, à direita) e
                escolha em “Unidade de trabalho”: vale só para a aba em que você escolheu, e o topo mostra a unidade sempre que não for a padrão.
              </p>
            </Cartao>
          )}
        </div>
      </div>
      )}

      {secao === 'agenda' && veAgenda && <RegrasReserva unidade={unidade!.codigo} />}

      {secao === 'equipe' && pode(usuario.papel, 'usuarios.gerenciar') && <Equipe eu={usuario.id} />}

      {secao === 'equipe' && (
      <Cartao titulo={<span class="linha"><ShieldCheck size={16} aria-hidden="true" /> Perfis de acesso</span>} descricao="Quem vê o quê. O sistema do Âmbar confere o perfil a cada ação." justo>
        <Tabela<{ papel: Papel; ve: string; nao: string }>
          rotulo="Perfis de acesso"
          chave={(l) => l.papel}
          linhas={[
            { papel: 'operador', ve: 'Reservas de hoje e dos próximos dias (sem telefone e e-mail do cliente), registrar a chegada, Atendimento', nao: 'Criar, alterar ou cancelar reservas, clientes, Financeiro, Estoque, Clube, Configurações' },
            { papel: 'gerente', ve: 'Toda a operação: Visão Geral, Reservas (aprovar, alterar, cancelar, dias fechados e eventos), Atendimento, Clube, Financeiro operacional, Estoque', nao: 'Retiradas e distribuição aos sócios, capacidade e regras da casa, usuários, integrações' },
            { papel: 'admin', ve: 'Tudo na unidade, inclusive equipe, regras da casa e dados societários', nao: '—' },
          ]}
          colunas={[
            { id: 'papel', titulo: 'Perfil', celula: (l) => <span class="principal-celula">{NOME_PAPEL[l.papel]}</span> },
            { id: 've', titulo: 'Acessa', celula: (l) => l.ve },
            { id: 'nao', titulo: 'Não acessa', prioridade: 'media', celula: (l) => <span class="fraco">{l.nao}</span> },
          ]}
        />
        <div class="cartao__rodape">O sistema do Âmbar confere o perfil em toda ação: esconder um botão nunca é a única proteção.</div>
      </Cartao>
      )}

      {secao === 'atendimento' && veAtendimento && (
        <Cartao titulo="Cadastros do Atendimento" justo>
          <ul class="lista">
            <li>
              <button type="button" class="lista__item" onClick={() => setGaveta('conhecimento')}>
                <span class="lista__icone"><BookOpen aria-hidden="true" /></span>
                <span class="lista__texto"><strong>Base de conhecimento da IA</strong><span>O que o assistente pode afirmar, sempre com a fonte</span></span>
                <span class="lista__fim"><ChevronRight aria-hidden="true" /></span>
              </button>
            </li>
            {veDuplicidades && (
              <li>
                <button type="button" class="lista__item" onClick={() => setGaveta('duplicidades')}>
                  <span class="lista__icone"><UsersRound aria-hidden="true" /></span>
                  <span class="lista__texto"><strong>Cadastros duplicados</strong><span>Telefones e e-mails com mais de um cadastro, sem apagar nada</span></span>
                  <span class="lista__fim"><ChevronRight aria-hidden="true" /></span>
                </button>
              </li>
            )}
          </ul>
        </Cartao>
      )}

      {secao === 'financeiro' && veFinanceiro && <CadastrosFinanceiro contexto={contexto} />}

      {secao === 'ponto' && vePontoAqui && <ConfiguracoesPonto papel={usuario.papel} />}
      </section>
      </div>
      {dialogo}
      {veAtendimento && (
        <>
          <Conhecimento aberta={gaveta === 'conhecimento'} aoFechar={() => setGaveta(null)} podeEditar={pode(usuario.papel, 'atendimento.conhecimento')} confirmar={confirmar} />
          {veDuplicidades && <Duplicidades aberta={gaveta === 'duplicidades'} aoFechar={() => setGaveta(null)} podeVincular={pode(usuario.papel, 'clientes.editar')} confirmar={confirmar} />}
        </>
      )}
    </Raiz>
  );
}

function RegrasReserva({ unidade }: { unidade: string }) {
  const consulta = useConsulta(`reservas/configuracao/${unidade}`, () => reservas.configuracao(unidade));
  const [editando, setEditando] = useState<AmbienteConfig | null>(null);
  return (
    <Cartao titulo={<span class="linha"><CalendarCog size={16} aria-hidden="true" /> Reservas</span>} descricao="Regras que o site e a equipe seguem" justo>
      <Dados consulta={consulta} recurso="As regras de reserva" esqueleto={<EsqueletoTabela linhas={4} />}>
        {(c) => (
          <>
            {c.politica ? <Politica unidade={unidade} p={c.politica} /> : <div class="cartao__corpo"><Aviso tom="atencao">Nenhuma política cadastrada para esta unidade.</Aviso></div>}
            <Tabela<AmbienteConfig>
              rotulo="Ambientes"
              linhas={[...c.ambientes].sort((a, b) => a.ordem - b.ordem)}
              chave={(a) => a.id}
              aoAbrir={setEditando}
              colunas={[
                { id: 'nome', titulo: 'Ambiente', celula: (a) => <span class="principal-celula">{a.nome}</span> },
                { id: 'cap', titulo: 'Capacidade', numero: true, celula: (a) => <span class="num">{a.capacidade_max}</span> },
                { id: 'pessoas', titulo: 'Por reserva', prioridade: 'media', celula: (a) => <span class="num">{a.pessoas_min}–{a.pessoas_max_por_reserva}</span> },
                { id: 'dur', titulo: 'Duração', prioridade: 'baixa', celula: (a) => `${a.duracao_min} min` },
                { id: 'aprov', titulo: 'Aprovação', prioridade: 'media', celula: (a) => (a.exige_aprovacao ? 'Pela equipe' : 'Automática') },
                { id: 'sit', titulo: 'Situação', celula: (a) => <Situacao tom={a.ativo ? 'ok' : 'apagado'}>{a.ativo ? (a.aceita_reserva_online ? 'Ativo no site' : 'Só pela equipe') : 'Inativo'}</Situacao> },
                { id: 'acoes', titulo: '', celula: (a) => <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Editar ${a.nome}`} icone={<Pencil aria-hidden="true" />} onClick={() => setEditando(a)} /> },
              ]}
            />
          </>
        )}
      </Dados>
      <EditarAmbiente ambiente={editando} aoFechar={() => setEditando(null)} unidade={unidade} />
    </Cartao>
  );
}

function Politica({ unidade, p }: { unidade: string; p: PoliticaReserva }) {
  const [f, setF] = useState(p);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => setF(p), [p]);
  const mudou = JSON.stringify(f) !== JSON.stringify(p);
  async function salvar() {
    setSalvando(true);
    try {
      const { privacidade_aprovada_em, ...corpo } = f;
      void privacidade_aprovada_em;
      await reservas.salvarPolitica(unidade, corpo);
      invalidar('reservas/configuracao');
      avisar('Regras de reserva salvas.', 'ok');
    } catch (e) {
      avisarErro(e);
    } finally {
      setSalvando(false);
    }
  }
  const num = (k: keyof PoliticaReserva, rotulo: string, ajuda: string) => (
    <Campo rotulo={rotulo} ajuda={ajuda}>
      {(id, d) => <input id={id} aria-describedby={d} type="number" min={0} class="entrada num" value={String(f[k] ?? '')} onInput={(e) => setF({ ...f, [k]: Number(e.currentTarget.value) })} />}
    </Campo>
  );
  return (
    <div class="cartao__corpo pilha" style={{ borderBottom: '1px solid var(--borda)' }}>
      <label class="marcar">
        <input type="checkbox" checked={f.aceita_reservas} onChange={(e) => setF({ ...f, aceita_reservas: e.currentTarget.checked })} />
        <span><strong>Aceitar reservas</strong><br /><span class="fraco">Desligado, o site para de oferecer horários.</span></span>
      </label>
      <div class="grade-campos" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {num('antecedencia_min_horas', 'Antecedência mínima (horas)', 'Até quanto antes dá para reservar')}
        {num('antecedencia_max_dias', 'Antecedência máxima (dias)', 'Até quantos dias à frente')}
        {num('tolerancia_atraso_min', 'Tolerância de atraso (min)', 'Depois disso, “Não veio” é liberado')}
      </div>
      <label class="marcar">
        <input type="checkbox" checked={f.exige_email} onChange={(e) => setF({ ...f, exige_email: e.currentTarget.checked })} />
        <span>Pedir e-mail no site</span>
      </label>
      <label class="marcar">
        <input type="checkbox" checked={!!f.lembrete_1h_ativo} onChange={(e) => setF({ ...f, lembrete_1h_ativo: e.currentTarget.checked })} />
        <span>Lembrete por WhatsApp 1 hora antes</span>
      </label>
      <div class="linha">
        <Botao variante="primario" disabled={!mudou} carregando={salvando} onClick={salvar}>Salvar regras</Botao>
        {mudou && <Botao variante="fantasma" onClick={() => setF(p)}>Desfazer</Botao>}
      </div>
    </div>
  );
}

function EditarAmbiente({ ambiente, aoFechar, unidade }: { ambiente: AmbienteConfig | null; aoFechar: () => void; unidade: string }) {
  const [f, setF] = useState<AmbienteConfig | null>(ambiente);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    setF(ambiente);
    setErros({});
  }, [ambiente]);
  if (!ambiente || !f) return <Gaveta aberta={false} aoFechar={aoFechar} titulo=""><span /></Gaveta>;
  async function salvar(e: Event) {
    e.preventDefault();
    if (!f || !ambiente) return;
    const mud: Partial<AmbienteConfig> = {};
    for (const k of ['nome', 'capacidade_max', 'pessoas_min', 'pessoas_max_por_reserva', 'duracao_min', 'exige_aprovacao', 'aceita_reserva_online', 'ativo'] as const) if (f[k] !== ambiente[k]) (mud as Record<string, unknown>)[k] = f[k];
    if (!Object.keys(mud).length) return aoFechar();
    setSalvando(true);
    try {
      await reservas.alterarAmbiente(ambiente.id, mud);
      invalidar(`reservas/configuracao/${unidade}`, 'reservas/ambientes');
      avisar(`${f.nome} atualizado.`, 'ok');
      aoFechar();
    } catch (err) {
      setErros(err instanceof ErroApi ? err.campos : {});
      avisarErro(err);
    } finally {
      setSalvando(false);
    }
  }
  const n = (k: 'capacidade_max' | 'pessoas_min' | 'pessoas_max_por_reserva' | 'duracao_min', rotulo: string, ajuda?: string) => (
    <Campo rotulo={rotulo} ajuda={ajuda} erro={erros[k]}>
      {(id, d) => <input id={id} aria-describedby={d} type="number" min={1} class="entrada num" value={f[k]} onInput={(e) => setF({ ...f, [k]: Number(e.currentTarget.value) })} />}
    </Campo>
  );
  return (
    <Gaveta aberta aoFechar={aoFechar} titulo={`Editar ${ambiente.nome}`} rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" type="submit" form="form-ambiente" carregando={salvando}>Salvar</Botao></>}>
      <form id="form-ambiente" class="pilha" onSubmit={salvar} noValidate>
        <Aviso tom="atencao">Mudanças valem para novas reservas. O sistema confere a lotação a cada reserva gravada.</Aviso>
        <Campo rotulo="Nome" erro={erros.nome}>{(id) => <input id={id} class="entrada" value={f.nome} onInput={(e) => setF({ ...f, nome: e.currentTarget.value })} />}</Campo>
        <div class="grade-campos">
          {n('capacidade_max', 'Capacidade (pessoas ao mesmo tempo)')}
          {n('duracao_min', 'Duração da reserva (min)')}
          {n('pessoas_min', 'Mínimo por reserva')}
          {n('pessoas_max_por_reserva', 'Máximo por reserva')}
        </div>
        <label class="marcar"><input type="checkbox" checked={f.exige_aprovacao} onChange={(e) => setF({ ...f, exige_aprovacao: e.currentTarget.checked })} /><span>Reservas pedem aprovação da equipe</span></label>
        <label class="marcar"><input type="checkbox" checked={f.aceita_reserva_online} onChange={(e) => setF({ ...f, aceita_reserva_online: e.currentTarget.checked })} /><span>Aparece no site para reserva</span></label>
        <label class="marcar"><input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.currentTarget.checked })} /><span>Ambiente ativo</span></label>
        {!f.limites_confirmados_em && <p class="fraco">Os limites deste ambiente ainda não foram confirmados pela gerência no sistema.</p>}
      </form>
    </Gaveta>
  );
}
