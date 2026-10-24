/** @jsxImportSource preact */
// Área do membro do Clube Âmbar — ilha Preact de /clube/conta, /clube/historico e /clube/recompensas (`secao`).
// Contrato real (lib/api/clube-acesso.ts): GET /clube/config + GET /clube/me ao abrir.
//  - 401 (sem sessão ou vencida) → /clube/entrar/?volta=<seção> (lista fechada de destinos, lib/clube-cliente.ts);
//  - cadastro pela metade ou sessão de ativação do convite → /clube/cadastro/ (a sessão de ativação nunca vê a conta);
//  - membro → a conta: cartão, programa, atalhos, dados, comunicação (PUT /clube/me/marketing, DELETE
//    /clube/me/mensagens) e sair (POST /clube/sair).
// Pontos: só os que /clube/me traz (`membro.programa.saldo`, com o programa ativo). Histórico: GET /clube/me/movimentos
// (rota real, b0b0553), só com o programa ativo — desligado, “em preparação”. Recompensas e resgates não têm rota pública
// ainda (lib/api/clube-futuro.ts): a seção mostra “em preparação”, sem dado nem ação.
// Conta suspensa (403 `conta_suspensa` em qualquer chamada): a tela troca por “Conta suspensa” com o texto do backend —
// sem cartão, pontos, histórico nem preferências, e sem “tentar de novo” (o backend já revogou a sessão).
// Modo “indisponivel” (pré-lançamento): nenhum dado é pedido; a página diz que o Clube abre em breve.
import { useEffect, useState } from 'preact/hooks';
import { AtalhosConta, ContaEsqueleto, DadosConta, PainelPrograma, PararAvisos, PreferenciasConta, TopoConta, type Atalho } from '../components/clube/Conta';
import { EmPreparo, ListaMovimentos, type EstadoLista } from '../components/clube/Historico';
import { Icone } from '../components/clube/icones';
import { ErroClube } from '../lib/api/clube-erro';
import { RECURSOS } from '../lib/api/clube-futuro';
import type { ConfigClube, MembroClube, MovimentoClube, SituacaoClube } from '../lib/api/clube-acesso';
import { ROTAS, urlEntrar, useApiClube, type Volta } from '../lib/clube-cliente';
import type { ModoClube } from '../lib/clube-modo';
import { visita } from '../data/visita';

export type SecaoArea = 'conta' | 'historico' | 'recompensas';
type Estado = 'carregando' | 'fechado' | 'falha' | 'suspensa' | 'pronto' | 'saindo';
interface Lista { estado: EstadoLista; itens: MovimentoClube[]; proximo: number | null; erro?: string; mais?: boolean; erroMais?: string }
interface Props {
  modo: ModoClube;
  apiUrl?: string;
  secao: SecaoArea;
  /** SÓ para a prévia local: dados de exemplo, nada é chamado */
  demo?: { membro: MembroClube; cfg?: Partial<ConfigClube>; recursosLigados?: boolean; /** texto da conta suspensa */ suspensa?: string };
}

const ir = (url: string, trocar = false) => { if (trocar) window.location.replace(url); else window.location.assign(url); };

/** os atalhos da conta: prontos só com o recurso ligado E o programa ativo */
export function atalhosDaConta(programaAtivo: boolean, recursos: Record<keyof typeof RECURSOS, boolean> = RECURSOS): Atalho[] {
  return [
    { href: ROTAS.historico, icone: 'historico', titulo: 'Histórico de pontos', texto: 'Ganhos, usos e pontos em liberação', pronto: programaAtivo && recursos.historico },
    { href: ROTAS.recompensas, icone: 'presente', titulo: 'Recompensas', texto: 'O que dá para trocar com seus pontos', pronto: programaAtivo && recursos.recompensas },
    { href: `${ROTAS.recompensas}#resgates`, icone: 'qr', titulo: 'Meus resgates', texto: 'QR Codes para retirar no caixa', pronto: programaAtivo && recursos.resgates },
  ];
}

export default function ClubeArea({ modo, apiUrl, secao, demo }: Props) {
  const api = useApiClube(modo, apiUrl, !!demo);
  const aberto = !demo && ((modo === 'api' && !!apiUrl) || modo === 'simulado');
  const [estado, setEstado] = useState<Estado>(demo ? (demo.suspensa ? 'suspensa' : 'pronto') : aberto ? 'carregando' : 'fechado');
  const [cfg, setCfg] = useState<Partial<ConfigClube> | null>(demo?.cfg ?? null);
  const [membro, setMembro] = useState<MembroClube | null>(demo?.membro ?? null);
  const [falha, setFalha] = useState(demo?.suspensa ?? '');
  const [tentativa, setTentativa] = useState(0);
  const [ocupado, setOcupado] = useState<'marketing' | 'mensagens' | null>(null);
  const [marketingPendente, setMarketingPendente] = useState<boolean | null>(null);
  const [erroPref, setErroPref] = useState('');
  const [avisoPref, setAvisoPref] = useState('');
  const [lista, setLista] = useState<Lista>({ estado: 'carregando', itens: [], proximo: null });
  const volta: Volta = secao;

  /** a situação vem do backend: só “membro” abre a área; o resto vai para a tela certa */
  const aplicar = (s: SituacaoClube) => {
    if (s.situacao === 'membro') { setMembro(s.membro); setEstado('pronto'); return; }
    if (s.situacao === 'cadastro' || s.situacao === 'ativacao') { ir(ROTAS.cadastro, true); return; }
    ir(urlEntrar(volta), true);
  };
  /** 401 no meio do uso: a sessão venceu — entrar de novo e voltar para cá. 403 conta_suspensa: a conta sai da tela. */
  const tratar = (e: unknown, alvo: 'pref' | 'tela') => {
    const erro = e instanceof ErroClube ? e : new ErroClube('servidor', 'Não foi possível concluir. Tente de novo em instantes.');
    if (erro.tipo === 'sessao') { ir(urlEntrar(volta, 'sessao')); return; }
    if (erro.tipo === 'suspensa') { setMembro(null); setFalha(erro.message); setEstado('suspensa'); return; }
    if (alvo === 'pref') setErroPref(erro.message); else { setFalha(erro.message); setEstado('falha'); }
  };

  useEffect(() => {
    if (!api) return;
    setEstado('carregando');
    (async () => {
      try { setCfg(await api.config()); } catch { /* sem as regras, a conta ainda abre (o consentimento fica travado) */ }
      try { aplicar(await api.me()); }
      catch (e) {
        // sem sessão: entrar e voltar para esta seção (sem o aviso de “sessão terminou”: talvez nunca tenha entrado)
        if (e instanceof ErroClube && e.tipo === 'sessao') { ir(urlEntrar(volta), true); return; }
        tratar(e, 'tela');
      }
    })();
  }, [api, tentativa]);

  const marketing = async (autorizado: boolean) => {
    if (!api || !membro || !cfg?.marketing?.textoVersao) return;
    setOcupado('marketing'); setMarketingPendente(autorizado); setErroPref(''); setAvisoPref('');
    try {
      aplicar(await api.marketing(autorizado, cfg.marketing.textoVersao));
      setAvisoPref(autorizado ? 'Pronto: você vai receber novidades e ofertas.' : 'Pronto: as novidades e ofertas foram desligadas.');
    } catch (e) {
      if (e instanceof ErroClube && e.tipo === 'versao') {
        // o texto do consentimento mudou: recarrega e pede para confirmar de novo
        api.config().then(setCfg).catch(() => {});
        setErroPref('O texto das novidades foi atualizado. Confira e toque de novo para confirmar.');
      } else tratar(e, 'pref');
    } finally { setOcupado(null); setMarketingPendente(null); }
  };
  const pararMensagens = async () => {
    if (!api) return;
    setOcupado('mensagens'); setErroPref(''); setAvisoPref('');
    try {
      await api.pararMensagens();
      aplicar(await api.me());
      setAvisoPref('Pronto: os avisos da conta foram desligados.');
    } catch (e) { tratar(e, 'pref'); } finally { setOcupado(null); }
  };
  // histórico: só com o recurso ligado e o programa ativo (a resposta também diz; desligado no meio, volta ao “em preparação”)
  const historicoLigado = secao === 'historico' && RECURSOS.historico && !!membro?.programa.ativo;
  const carregarMovimentos = async (antesDe?: number) => {
    if (!api) return;
    setLista((l) => (antesDe ? { ...l, mais: true, erroMais: undefined } : { estado: 'carregando', itens: [], proximo: null }));
    try {
      const r = await api.movimentos(antesDe);
      if (!r.programaAtivo) { setMembro((m) => m && { ...m, programa: { ativo: false, saldo: null } }); return; }
      setLista((l) => { const itens = antesDe ? [...l.itens, ...r.itens] : r.itens; return { estado: itens.length ? 'ok' : 'vazio', itens, proximo: r.proximo }; });
    } catch (e) {
      if (e instanceof ErroClube && (e.tipo === 'sessao' || e.tipo === 'suspensa')) { tratar(e, 'tela'); return; }
      const msg = e instanceof ErroClube ? e.message : 'Tente de novo em instantes.';
      // falhou a página seguinte: o que já apareceu continua na tela
      setLista((l) => (antesDe ? { ...l, mais: false, erroMais: msg } : { estado: 'erro', itens: [], proximo: null, erro: msg }));
    }
  };
  useEffect(() => { if (historicoLigado && !demo) carregarMovimentos(); }, [historicoLigado]);

  const sair = async () => {
    setEstado('saindo');
    try { await api?.sair(); } catch { /* sem rede: a sessão vence sozinha */ }
    ir(ROTAS.landing);
  };

  if (estado === 'fechado') {
    return (
      <div class="area-vazio area-vazio--preparo" data-estado="fechado">
        <Icone nome="espiral" class="area-vazio__icone" />
        <p class="area-vazio__titulo">O Clube Âmbar abre em breve</p>
        <p class="area-vazio__texto">Quando as inscrições abrirem, sua conta fica aqui: cartão, vantagens e preferências.</p>
        <a class="btn btn--wine" href={ROTAS.landing}>Conhecer o Clube</a>
      </div>
    );
  }
  if (estado === 'suspensa') {
    // sem nada da conta e sem “tentar de novo”: só o texto do backend e o caminho para falar com a equipe
    return (
      <div class="area-vazio" role="alert" data-estado="suspensa">
        <Icone nome="pessoa" class="area-vazio__icone" />
        <p class="area-vazio__titulo">Conta suspensa</p>
        <p class="area-vazio__texto">{falha}</p>
        <a class="btn btn--wine" href={visita.whatsapp.url} target="_blank" rel="noopener">Falar com a equipe no WhatsApp</a>
        <a class="ticket__link" href="/">Voltar ao início</a>
      </div>
    );
  }
  if (estado === 'falha') {
    return (
      <div class="area-vazio" role="alert" data-estado="falha">
        <p class="area-vazio__titulo">Não deu para abrir sua conta</p>
        <p class="area-vazio__texto">{falha}</p>
        <button class="btn btn--wine" type="button" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button>
      </div>
    );
  }
  if (estado === 'carregando' || !membro) return <ContaEsqueleto />;

  // o saldo vem de /clube/me: com o programa ativo lá, a conta mostra os pontos (sem redesenhar a página)
  const programaAtivo = membro.programa.ativo;
  if (secao === 'historico') {
    if (historicoLigado) {
      return (
        <div class="area-secao" data-estado="pronto">
          <ListaMovimentos estado={lista.estado} itens={lista.itens} erro={lista.erro} aoTentar={() => carregarMovimentos()}
            aoVerMais={lista.proximo ? () => carregarMovimentos(lista.proximo!) : undefined} carregandoMais={lista.mais} erroMais={lista.erroMais} />
        </div>
      );
    }
    return (
      <div class="area-secao" data-estado="pronto">
        <EmPreparo titulo="Seu histórico começa com o programa"
          texto="Quando o programa de pontos começar, cada compra identificada e cada resgate aparecem aqui, em ordem, com a data e os pontos." />
      </div>
    );
  }
  if (secao === 'recompensas') {
    return (
      <div class="area-secao" data-estado="pronto" id="resgates">
        <EmPreparo titulo="As recompensas estão sendo escolhidas"
          texto="O catálogo do Clube aparece aqui quando o programa começar — com o que dá para trocar e quantos pontos cada item pede." />
      </div>
    );
  }
  return (
    <div class="conta" data-estado={estado}>
      <TopoConta membro={membro} />
      <div class="conta__colunas">
        <div class="conta__principal">
          <PainelPrograma ativo={programaAtivo} saldo={membro.programa.saldo} />
          <AtalhosConta itens={atalhosDaConta(programaAtivo, demo?.recursosLigados ? { historico: true, recompensas: true, resgates: true } : RECURSOS)} />
        </div>
        <div class="conta__lateral">
          <DadosConta membro={membro} />
          <PreferenciasConta membro={membro} textoVersao={cfg?.marketing?.textoVersao ?? null} ocupado={ocupado} marketingPendente={marketingPendente}
            erro={erroPref} aviso={avisoPref} aoMarketing={marketing} />
          <button class="conta-sair" type="button" disabled={estado === 'saindo'} onClick={sair}>
            <Icone nome="sair" /> {estado === 'saindo' ? 'Saindo…' : 'Sair deste aparelho'}
          </button>
          {membro.mensagens.autorizado && <PararAvisos ocupado={ocupado === 'mensagens'} aoParar={pararMensagens} />}
        </div>
      </div>
    </div>
  );
}
