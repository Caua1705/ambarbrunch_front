// Configurações: conta e aparência para todos; regras de reserva (política e ambientes) para a gerência.
// Usuários do painel não têm rota no backend (só a CLI): a tela explica, sem formulário de mentira.
import { useEffect, useState } from 'preact/hooks';
import { Sun, Moon, Monitor, LogOut, ShieldCheck, Pencil, CalendarCog } from 'lucide-preact';
import type { ContextoPainel, Papel } from '../../lib/sessao';
import { NOME_PAPEL } from '../../lib/sessao';
import { pode } from '../../lib/permissoes';
import { useConsulta, invalidar } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { ErroApi } from '../../lib/api/cliente';
import { Raiz, Gaveta, avisar, avisarErro } from '../../ui/camadas';
import { Botao, Cabecalho, Cartao, Segmentado, Campo, Aviso, Situacao } from '../../ui/base';
import { Dados, EsqueletoTabela } from '../../ui/estados';
import { Tabela } from '../../ui/tabela';
import type { AmbienteConfig, PoliticaReserva } from '../../lib/tipos/reservas';

type Tema = 'claro' | 'escuro' | 'sistema';

export default function Configuracoes({ contexto }: { contexto: ContextoPainel }) {
  const { usuario, unidade, unidades } = contexto;
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
  const sair = async () => {
    await fetch('/admin/api/sessao', { method: 'DELETE', headers: { 'X-Painel': '1' } }).catch(() => null);
    location.assign('/admin/login');
  };

  return (
    <Raiz>
      <Cabecalho titulo="Configurações" />
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
              <dd>{usuario.papel === 'admin' ? 'Todas' : unidades.map((u) => u.nome).join(', ') || '—'}</dd>
            </dl>
            <p class="fraco">Para trocar a senha ou o perfil, fale com o administrador do sistema.</p>
            <Botao icone={<LogOut aria-hidden="true" />} onClick={sair} style={{ alignSelf: 'flex-start' }}>Sair do painel</Botao>
          </div>
        </Cartao>
        <Cartao titulo="Aparência" descricao="Vale para este aparelho">
          <Segmentado rotulo="Tema" valor={tema} aoMudar={mudarTema} opcoes={[{ valor: 'claro', rotulo: <><Sun size={14} aria-hidden="true" /> Claro</> }, { valor: 'escuro', rotulo: <><Moon size={14} aria-hidden="true" /> Escuro</> }, { valor: 'sistema', rotulo: <><Monitor size={14} aria-hidden="true" /> Igual ao aparelho</> }]} />
        </Cartao>
      </div>

      {pode(usuario.papel, 'reservas.configurar') && unidade && <RegrasReserva unidade={unidade.codigo} />}

      <Cartao titulo={<span class="linha"><ShieldCheck size={16} aria-hidden="true" /> Perfis de acesso</span>} descricao="Quem vê o quê. O sistema do Âmbar confere o perfil a cada ação." justo>
        <Tabela<{ papel: Papel; ve: string; nao: string }>
          rotulo="Perfis de acesso"
          chave={(l) => l.papel}
          linhas={[
            { papel: 'operador', ve: 'Visão Geral (sem financeiro), Reservas, Atendimento, Clube (consulta), Estoque: compras, conferência, perdas e contagem', nao: 'Financeiro, custos, margens e fichas técnicas' },
            { papel: 'gerente', ve: 'Tudo da operação + Financeiro, custos, fichas técnicas, análises, regras de reserva, suspensão no Clube', nao: 'Fechar/reabrir apuração e reativar membro suspenso' },
            { papel: 'admin', ve: 'Tudo, em todas as unidades', nao: '—' },
          ]}
          colunas={[
            { id: 'papel', titulo: 'Perfil', celula: (l) => <span class="principal-celula">{NOME_PAPEL[l.papel]}</span> },
            { id: 've', titulo: 'Acessa', celula: (l) => l.ve },
            { id: 'nao', titulo: 'Não acessa', prioridade: 'media', celula: (l) => <span class="fraco">{l.nao}</span> },
          ]}
        />
        <div class="cartao__rodape">Usuários da equipe são criados e desativados pelo administrador do sistema (ainda não há tela para isso). Desativar alguém vale na hora.</div>
      </Cartao>
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
