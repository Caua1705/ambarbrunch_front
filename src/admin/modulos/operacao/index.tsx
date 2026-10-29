// Modo Operação: a tela do tablet fixo do café. Cabeçalho com hora de Fortaleza, quem está logado e sair; abaixo, a seção
// em uso (hoje só Reservas). Mesma sessão, mesmas permissões e mesmas rotas reais do painel — nada paralelo.
import { useEffect, useState } from 'preact/hooks';
import { Sun, Moon, LogOut, LayoutDashboard, ChevronDown, CalendarCheck, MessagesSquare, ExternalLink } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { NOME_PAPEL } from '../../lib/sessao';
import { inicioDo } from '../../lib/permissoes';
import { sair } from '../../layout/sair';
import { Raiz, Suspenso } from '../../ui/camadas';
import { Vazio } from '../../ui/estados';
import { secoesDe, type IdSecao } from './secoes';
import { Agenda } from './Agenda';

const FUSO = 'America/Fortaleza';
const horaFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
const dataFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'long' });
const ICONES: Record<IdSecao, typeof CalendarCheck> = { reservas: CalendarCheck, atendimento: MessagesSquare, ponto: CalendarCheck };

/** Relógio da tela: acorda a cada virada de minuto (e ao voltar para a aba). */
function useAgora() {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    let t: number;
    const agendar = () => {
      t = window.setTimeout(() => {
        setAgora(Date.now());
        agendar();
      }, 60_000 - (Date.now() % 60_000) + 50);
    };
    agendar();
    const voltar = () => document.visibilityState === 'visible' && setAgora(Date.now());
    document.addEventListener('visibilitychange', voltar);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', voltar);
    };
  }, []);
  return agora;
}

function alternarTema() {
  const raiz = document.documentElement;
  const novo = raiz.getAttribute('data-tema') === 'escuro' ? 'claro' : 'escuro';
  raiz.setAttribute('data-tema', novo);
  try {
    localStorage.setItem('painel-tema', novo);
  } catch {
    /* navegação privada: vale só nesta página */
  }
}

export default function Operacao({ contexto }: { contexto: ContextoPainel }) {
  const agora = useAgora();
  const secoes = secoesDe(contexto);
  const [secao] = useState<IdSecao>('reservas');
  const [saindo, setSaindo] = useState(false);
  const { usuario, unidade } = contexto;
  const iniciais = usuario.nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
  const dataHoje = dataFmt.format(agora);
  const sairAgora = () => {
    setSaindo(true);
    void sair('/admin/operacao');
  };

  return (
    <Raiz>
      <header class="op-topo">
        <div class="op-topo__marca">
          <span class="marca-logo" role="img" aria-label="Âmbar Café & Brunch" />
          <span class="op-topo__unidade">{unidade?.nome ?? 'Sem unidade'}</span>
        </div>
        <div class="op-relogio" role="timer" aria-live="off">
          <strong class="num">{horaFmt.format(agora)}</strong>
          <span>{dataHoje.charAt(0).toUpperCase() + dataHoje.slice(1)}</span>
        </div>
        <div class="op-topo__acoes">
          <button type="button" class="btn btn--fantasma btn--icone op-tema" onClick={alternarTema} aria-label="Alternar tema claro/escuro" title="Tema claro/escuro">
            <Sun aria-hidden="true" data-icone-claro />
            <Moon aria-hidden="true" data-icone-escuro />
          </button>
          <Suspenso
            rotulo={`${usuario.nome} ${usuario.perfil ?? NOME_PAPEL[usuario.papel]}: conta`}
            gatilho={(p) => (
              // nome acessível = o texto visível (nome e perfil), sem rótulo à parte
              <button type="button" class="perfil op-conta" {...p} aria-label={undefined}>
                <span class="avatar" aria-hidden="true">{iniciais}</span>
                <span class="op-conta__texto">
                  <strong>{usuario.nome}</strong>
                  <span>{usuario.perfil ?? NOME_PAPEL[usuario.papel]}</span>
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            )}
          >
            {(fechar) => (
              <>
                <div class="suspenso__cabeca">
                  <strong>{usuario.nome}</strong>
                  <span>{usuario.perfil ?? NOME_PAPEL[usuario.papel]} · {unidade?.nome ?? 'sem unidade'}</span>
                </div>
                <div class="suspenso__sep" />
                <a class="suspenso__item" role="menuitem" href={inicioDo(usuario.papel)} onClick={fechar}>
                  <LayoutDashboard aria-hidden="true" /> Abrir o painel completo
                </a>
                <button type="button" class="suspenso__item suspenso__item--perigo" role="menuitem" onClick={() => { fechar(); sairAgora(); }}>
                  <LogOut aria-hidden="true" /> Sair desta conta
                </button>
              </>
            )}
          </Suspenso>
          <button type="button" class="btn op-sair" onClick={sairAgora} disabled={saindo} aria-label="Sair: encerra a sessão neste tablet" title="Encerra a sessão. A próxima pessoa entra com a própria conta.">
            <LogOut aria-hidden="true" />
            <span class="op-sair__rotulo">Sair</span>
          </button>
        </div>
      </header>

      {secoes.length > 1 && (
        <nav class="op-secoes" aria-label="Seções do Modo Operação">
          {secoes.map((s) => {
            const Icone = ICONES[s.id];
            return s.href ? (
              <a key={s.id} class="op-secoes__item" href={s.href}>
                <Icone aria-hidden="true" /> {s.rotulo} <ExternalLink class="op-secoes__fora" aria-hidden="true" />
              </a>
            ) : (
              <span key={s.id} class="op-secoes__item" aria-current={s.id === secao ? 'page' : undefined}>
                <Icone aria-hidden="true" /> {s.rotulo}
              </span>
            );
          })}
        </nav>
      )}

      <main class="op-conteudo" id="conteudo" tabIndex={-1}>
        {!unidade ? (
          <Vazio titulo="Sua conta não tem unidade atribuída">Peça ao Proprietário para ligar sua conta ao Âmbar Café no painel.</Vazio>
        ) : secao === 'reservas' && secoes.some((s) => s.id === 'reservas') ? (
          <Agenda contexto={contexto} agora={agora} />
        ) : (
          <Vazio titulo="Nada para operar por aqui">Seu perfil não tem nenhuma área do Modo Operação liberada.</Vazio>
        )}
      </main>
    </Raiz>
  );
}
