/** @jsxImportSource preact */
// Entrada do Clube Âmbar — ilha Preact, dentro da comanda da página /clube. 2026-10-23: ACESSO UNIFICADO — uma entrada
// só, pelo WhatsApp; ninguém precisa escolher entre “cadastrar” e “entrar”:
//   telefone → código no WhatsApp → o BACKEND diz a situação (lib/api/clube-acesso.ts, contrato real do backend):
//     · membro ativo → “que bom te ver de novo” (sem cadastro de novo e sem carteira de mentira);
//     · cadastro novo ou incompleto → pede SÓ o que falta (nome, aceite dos termos atuais) + aniversário e novidades,
//       opcionais, quando ainda não existem → conclui.
// Antes do código nada revela se o número já está no Clube (a resposta da API é sempre a mesma).
// Modos:
//  - "indisponivel" (padrão, pré-lançamento): bilhete “Inscrições em breve”, SEM campos — nada é pedido nem enviado.
//    O mesmo bilhete aparece com a API quando a configuração diz que as inscrições estão fechadas.
//  - "api": o fluxo acima contra a API real.
//  - "simulado": SÓ no `astro dev` — o mesmo fluxo contra lib/api/clube-simulado.ts, com aviso visível.
// Sessão: cookie HttpOnly da API (o site não vê nem guarda token). Ao abrir a página, GET /clube/me restaura a situação
// sem pedir código (caminho C); “Não é você? Sair” (POST /clube/sair) encerra a sessão deste aparelho.
// Caminho A — convite do caixa (prop `convite`, página /clube/ativar): o token do link chega por window.__ambarConvite
// (capturado e tirado da URL no <head> da página) e fica só em memória. NADA é chamado com ele ao abrir: só o toque em
// “Ativar meu Clube” faz POST /clube/convites/ativar → sessão de ATIVAÇÃO (30 min; nome e aniversário nunca vêm: pede só
// o que falta) ou “entrar” (já é membro: o link não dá acesso, vai para o login por código) · 410 → link vencido, entrar
// pelo WhatsApp. Concluído pelo convite → “ativado”: a sessão de ativação acaba e a conta se abre pelo login normal.
// Sem a origem da visita (mesa, UTM): o backend sabe pelo desafio se o acesso veio do link de ativação ou do site.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PassoCodigo } from './clube-partes';
import { ErroClube } from '../lib/api/clube-contrato';
import { criarAcessoHttp, type AcessoClubeApi, type CadastroPendente, type ConclusaoCadastro, type ConfigClube, type DesafioAcesso, type MembroClube, type SituacaoClube } from '../lib/api/clube-acesso';
import { mascaraTel, soDigitos, uuid } from '../lib/telefone';
import type { ModoClube } from '../lib/clube-modo';

export type EtapaFicha = 'carregando' | 'fechado' | 'falha' | 'convite' | 'ativando' | 'telefone' | 'enviando' | 'codigo' | 'verificando'
  | 'cadastro' | 'salvando' | 'membro' | 'ativado';
interface Dados { nome: string; aniversario: string; aceite: boolean; marketing: boolean }
/** Estado forçado — SÓ para a página interna de estados (/clube/estados/, build de revisão). Nada é enviado. */
export interface DemoFicha {
  etapa: EtapaFicha;
  telefone?: string;
  dados?: Partial<Dados>;
  erros?: Record<string, string>;
  falha?: string;
  desafio?: DesafioAcesso;
  cadastro?: CadastroPendente;
  membro?: MembroClube;
  novo?: boolean;
  /** cadastro pela sessão de ativação do convite */
  ativacao?: boolean;
  aviso?: string;
}
interface Props {
  modo: ModoClube;
  apiUrl?: string;
  privacidadeUrl: string;
  /** prefixo dos ids (várias fichas na mesma página) */
  ids?: string;
  demo?: DemoFicha;
  /** página /clube/ativar: começa pelo convite do caixa */
  convite?: boolean;
}

const DIGITOS_PADRAO = 6;
/** pedidos de código por número nesta visita (a API também limita, por IP e por telefone) */
const MAX_ENVIOS = 3;
const TEXTO_FALHA = 'Não foi possível concluir. Tente de novo em instantes.';

/** WhatsApp é celular: DDD + 9 + 8 dígitos (11 no total). */
const whatsappValido = (s: string) => /^[1-9]{2}9\d{8}$/.test(soDigitos(s));
/** Aniversário “DD/MM” enquanto digita (só dia e mês; o ano não é pedido). */
const mascaraDia = (s: string) => { const d = soDigitos(s).slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
/** “DD/MM” válido → “MM-DD” (como vai para a API); vazio → null; inválido → undefined. 29/02 vale. */
function aniversarioApi(s: string): string | null | undefined {
  if (!s.trim()) return null;
  const m = /^(\d{2})\/(\d{2})$/.exec(s.trim());
  if (!m) return undefined;
  const dia = Number(m[1]); const mes = Number(m[2]);
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
  return max && dia >= 1 && dia <= max ? `${m[2]}-${m[1]}` : undefined;
}
const primeiroNome = (n: string) => n.trim().split(/\s+/)[0];

export default function ClubeCadastro({ modo, apiUrl, privacidadeUrl, ids: px = 'cf', demo, convite = false }: Props) {
  const real = useMemo(() => (!demo && modo === 'api' && apiUrl ? criarAcessoHttp(apiUrl) : null), [modo, apiUrl]);
  const [api, setApi] = useState<AcessoClubeApi | null>(real);
  const simulado = !demo && modo === 'simulado';
  const [cfg, setCfg] = useState<ConfigClube | null>(null);
  const [etapa, setEtapa] = useState<EtapaFicha>(demo?.etapa ?? (real || simulado ? 'carregando' : 'fechado'));
  const [telefone, setTelefone] = useState(demo?.telefone ?? '');
  const [dados, setDados] = useState<Dados>({ nome: '', aniversario: '', aceite: false, marketing: false, ...demo?.dados });
  const [erros, setErros] = useState<Record<string, string>>(demo?.erros ?? {});
  const [falha, setFalha] = useState(demo?.falha ?? '');
  const [desafio, setDesafio] = useState<DesafioAcesso | null>(demo?.desafio ?? null);
  const [erroCodigo, setErroCodigo] = useState(demo?.erros?.codigo ?? '');
  const [envios, setEnvios] = useState(0);
  const [cadastro, setCadastro] = useState<CadastroPendente | null>(demo?.cadastro ?? null);
  const [membro, setMembro] = useState<MembroClube | null>(demo?.membro ?? null);
  const [novo, setNovo] = useState(demo?.novo ?? false);
  /** a sessão é a de ATIVAÇÃO do convite (limitada: só concluir o cadastro) */
  const [ativacao, setAtivacao] = useState(demo?.ativacao ?? false);
  /** aviso neutro na tela do WhatsApp (ex.: “este número já é do Clube, entre pelo código”) */
  const [aviso, setAviso] = useState(demo?.aviso ?? '');
  const [anuncio, setAnuncio] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const chave = useRef(uuid());
  const topo = useRef<HTMLParagraphElement>(null);
  /** o foco acompanha só as ações da pessoa — restaurar a sessão ao abrir a página não rola a tela até a comanda */
  const focoAuto = useRef(false);
  /** token do convite (caminho A): só em memória, usado uma vez no toque em “Ativar meu Clube” */
  const tokenConvite = useRef<string | null>(null);

  // simulação local: carregada só no `astro dev` (o bloco some de qualquer build)
  useEffect(() => {
    if (import.meta.env.DEV && simulado) import('../lib/api/clube-simulado').then((m) => setApi(m.criarAcessoSimulado()));
  }, []);
  // convite: pega o token que o <head> de /clube/ativar tirou da URL e apaga a cópia global (fica só aqui, em memória)
  useEffect(() => {
    if (!convite || demo) return;
    const w = window as unknown as { __ambarConvite?: string };
    tokenConvite.current = w.__ambarConvite ?? null;
    delete w.__ambarConvite;
  }, []);
  // Regras vigentes vindas da API: inscrições fechadas ou sem termos publicados → bilhete “em breve”. Abertas: a sessão
  // do cookie é restaurada (GET /clube/me) — 200 vai direto à situação, sem código; 401 mostra o telefone.
  useEffect(() => {
    if (!api) return;
    setEtapa('carregando');
    (async () => {
      let c: ConfigClube;
      try { c = await api.config(); } catch (e) { setFalha(comoErro(e).message); setEtapa('falha'); return; }
      setCfg(c);
      // sem as duas versões (regulamento e privacidade) não há como aceitar: a ficha continua fechada
      if (!(c.inscricoesAbertas && c.regulamento?.versao && c.privacidade?.versao)) { setEtapa('fechado'); return; }
      // sessão que já vale neste navegador (completa ou a de ativação de um toque anterior) vem antes do convite
      try { aplicar(await api.me(), false); return; }
      // 401 = sem sessão (o normal, e sempre fora de ambarbrunch.com); outro erro também segue: dá para entrar pelo código
      catch { /* segue */ }
      if (convite && tokenConvite.current) { setEtapa('convite'); return; }
      // /clube/ativar sem o token (recarregou depois de ele sair da URL, ou link incompleto): entrada normal
      if (convite) setAviso('Para ativar pelo convite, toque de novo no botão da mensagem do WhatsApp — ou entre com seu WhatsApp aqui.');
      setEtapa('telefone');
    })();
  }, [api, tentativa]);
  // Foco a cada troca de etapa feita pela pessoa: no título — no código, o próprio campo pega o foco; ao voltar ao
  // telefone, o campo do telefone.
  useEffect(() => {
    if (!focoAuto.current) return;
    if (etapa === 'telefone') document.getElementById(`${px}-telefone`)?.focus();
    else if (etapa === 'cadastro' || etapa === 'membro' || etapa === 'ativado' || etapa === 'falha') topo.current?.focus();
  }, [etapa]);

  const digitos = cfg?.codigo.digitos ?? DIGITOS_PADRAO;
  const limparErro = (campo: string) => { if (erros[campo]) setErros((e) => { const n = { ...e }; delete n[campo]; return n; }); };
  const mudar = (campo: keyof Dados) => (ev: Event) => {
    const alvo = ev.currentTarget as HTMLInputElement;
    const valor = campo === 'aceite' || campo === 'marketing' ? alvo.checked : campo === 'aniversario' ? mascaraDia(alvo.value) : alvo.value;
    setDados((d) => ({ ...d, [campo]: valor }));
    limparErro(campo);
  };
  const focar = (campo: string) => requestAnimationFrame(() => document.getElementById(`${px}-${campo}`)?.focus());
  const comoErro = (e: unknown) => (e instanceof ErroClube ? e : new ErroClube('servidor', TEXTO_FALHA));

  /** a situação vem SEMPRE do backend (sessão restaurada, convite, verificação ou conclusão) */
  const aplicar = (s: SituacaoClube, concluiuAgora: boolean) => {
    if (s.situacao === 'membro') {
      setMembro(s.membro); setCadastro(null); setNovo(concluiuAgora); setAtivacao(false); setEtapa('membro');
      setAnuncio(concluiuAgora ? 'Pronto! Você faz parte do Clube Âmbar.' : `Que bom te ver de novo, ${primeiroNome(s.membro.nome)}.`);
      return;
    }
    if (s.situacao === 'ativado') {
      // cadastro pelo convite concluído: a sessão de ativação acabou (o backend apagou o cookie)
      setCadastro(null); setAtivacao(false); setEtapa('ativado');
      setAnuncio('Cadastro concluído! Você vai receber a confirmação no WhatsApp.');
      return;
    }
    if (s.situacao === 'entrar') {
      // o convite é de quem já é membro: o link não abre a conta — login normal pelo código
      setCadastro(null); setAtivacao(false); setDesafio(null);
      setAviso('Este número já faz parte do Clube Âmbar. Para entrar, confirme seu WhatsApp.');
      setEtapa('telefone'); setAnuncio('Este número já faz parte do Clube. Confirme seu WhatsApp para entrar.');
      return;
    }
    const c = s.cadastro;
    setCadastro(c); setAtivacao(s.situacao === 'ativacao');
    // o que já existe não é pedido de novo; o que ainda falta continua preenchido com o que a pessoa digitou
    setDados((d) => ({ ...d, nome: c.faltam.includes('nome') ? d.nome : (c.nome ?? ''), aceite: c.faltam.includes('aceite') ? d.aceite : true }));
    setEtapa('cadastro');
    setAnuncio(concluiuAgora ? 'Ainda falta um dado.' : s.situacao === 'ativacao' ? 'Convite confirmado.' : 'WhatsApp confirmado.');
  };

  // A · convite do caixa: o token só é usado aqui, no toque (nunca ao abrir a página)
  const ativar = async () => {
    if (!api || etapa !== 'convite') return;
    focoAuto.current = true;
    const token = tokenConvite.current;
    if (!token) { setAviso('Para ativar pelo convite, toque de novo no botão da mensagem do WhatsApp — ou entre com seu WhatsApp aqui.'); setEtapa('telefone'); return; }
    setEtapa('ativando'); setFalha('');
    try {
      const s = await api.ativarConvite(token);
      tokenConvite.current = null;   // usado
      aplicar(s, false);
    } catch (e) {
      const erro = comoErro(e);
      if (erro.tipo === 'codigo') {
        // 410: vencido, já usado, substituído por um link mais novo ou inválido — a entrada pelo WhatsApp resolve
        tokenConvite.current = null;
        setFalha('Este link de ativação venceu ou já foi usado. Entre com seu WhatsApp aqui mesmo.');
        setAnuncio('Link de ativação vencido. Entre com seu WhatsApp.');
        setEtapa('telefone');
        return;
      }
      // 403, 429, 503, rede: o convite continua valendo; dá para tentar de novo
      setFalha(erro.message); setAnuncio(erro.message); setEtapa('convite');
    }
  };

  // 1 · telefone → código
  const pedirCodigo = async (reenvio = false) => {
    if (!api) return;
    if (envios >= MAX_ENVIOS) { setErroCodigo('Muitas tentativas. Aguarde alguns minutos e tente de novo.'); return; }
    if (!reenvio) setEtapa('enviando');
    setFalha('');
    try {
      const d = await api.pedirCodigo(soDigitos(telefone));
      setEnvios((n) => n + 1);
      setDesafio(d); setErroCodigo(''); setEtapa('codigo');
      setAnuncio(`Enviamos um código para ${d.destino}.`);
    } catch (e) {
      const erro = comoErro(e);
      setAnuncio(erro.message);
      if (reenvio) { setErroCodigo(erro.message); return; }
      if (erro.tipo === 'validacao') { setErros({ telefone: erro.campos.telefone ?? 'Confira o WhatsApp com DDD, ex.: (85) 99999-9999.' }); focar('telefone'); }
      else setFalha(erro.message);
      setEtapa('telefone');
    }
  };
  const enviarTelefone = (ev: Event) => {
    ev.preventDefault();
    if (etapa !== 'telefone') return;
    focoAuto.current = true;
    setAviso('');
    if (!whatsappValido(telefone)) {
      setErros({ telefone: 'Confira o WhatsApp com DDD, ex.: (85) 99999-9999.' });
      setAnuncio('Confira o WhatsApp.'); focar('telefone');
      return;
    }
    setErros({}); setEnvios(0);
    pedirCodigo();
  };

  // 2 · código → situação
  const confirmar = async (codigo: string) => {
    if (!api || !desafio) return;
    setEtapa('verificando'); setErroCodigo('');
    try {
      // a sessão chega como cookie HttpOnly (Set-Cookie): o site não vê nem guarda token
      aplicar(await api.verificar(desafio.desafioId, codigo), false);
    } catch (e) {
      const erro = comoErro(e);
      setEtapa('codigo');
      setErroCodigo(erro.tipo === 'validacao' ? (erro.campos.codigo ?? 'Código incorreto. Confira e tente de novo.') : erro.message);
      setAnuncio(erro.message);
    }
  };

  // 3 · cadastro → membro (só o que falta)
  const pedeNome = !!cadastro?.faltam.includes('nome');
  const pedeAceite = !!cadastro?.faltam.includes('aceite');
  // na sessão de ATIVAÇÃO o backend nunca mostra o que já existe (nome e aniversário vêm null, novidades vêm “não”):
  // aniversário e novidades só para quem ainda não tem cadastro (falta o nome) — para quem só falta o aceite, um campo
  // vazio ou uma caixa desmarcada poderia parecer que apagamos o que a pessoa já tinha
  const ehNovo = !!cadastro?.faltam.includes('nome');
  const pedeAniversario = !!cadastro && !cadastro.aniversario && (!ativacao || ehNovo);
  // novidades: só se a pessoa ainda não autorizou e a API oferece o texto de consentimento (na demo, sempre)
  const pedeMarketing = !!cadastro && !cadastro.marketing.autorizado && (!ativacao || ehNovo) && (!!demo || !!cfg?.marketing?.textoVersao);
  const concluir = async (ev: Event) => {
    ev.preventDefault();
    if (!api || !cadastro || etapa !== 'cadastro') return;
    focoAuto.current = true;
    const e: Record<string, string> = {};
    if (pedeNome && (dados.nome.trim().length < 2 || !/\p{L}/u.test(dados.nome))) e.nome = 'Diga como podemos chamar você.';
    const aniversario = pedeAniversario ? aniversarioApi(dados.aniversario) : null;
    if (aniversario === undefined) e.aniversario = 'Use dia e mês, ex.: 25/12 — ou deixe em branco.';
    if (pedeAceite && !dados.aceite) e.aceite = 'Para entrar no Clube, aceite a política de privacidade e o regulamento.';
    setErros(e); setFalha('');
    if (Object.keys(e).length) { setAnuncio('Confira os campos destacados.'); focar(Object.keys(e)[0]); return; }
    const c: ConclusaoCadastro = {
      ...(pedeNome ? { nome: dados.nome.trim() } : {}),
      ...(aniversario ? { aniversario } : {}),
      ...(pedeAceite && cfg?.regulamento?.versao && cfg.privacidade?.versao ? { aceiteRegulamento: true as const, regulamentoVersao: cfg.regulamento.versao, privacidadeVersao: cfg.privacidade.versao } : {}),
      ...(pedeMarketing && cfg?.marketing?.textoVersao ? { marketing: { autorizado: dados.marketing, textoVersao: cfg.marketing.textoVersao } } : {}),
      // sem `origem`: o backend sabe pelo desafio de onde veio o acesso (e só aceitaria texto, não este objeto)
    };
    chave.current = uuid();
    setEtapa('salvando'); setAnuncio('Salvando…');
    try {
      aplicar(await api.concluir(c, chave.current), true);
    } catch (err) {
      const erro = comoErro(err);
      setAnuncio(erro.message);
      if (erro.tipo === 'sessao') {
        // 401: sessão vencida — a de ativação dura 30 min — ou o cadastro já ficou ativo por outro caminho
        setFalha(ativacao ? 'O tempo para ativar pelo convite acabou. Entre com seu WhatsApp para concluir.' : erro.message);
        setAtivacao(false); setDesafio(null); setEtapa('telefone');
        return;
      }
      setEtapa('cadastro');
      if (erro.tipo === 'versao') {
        // termos novos: recarrega as versões e pede o aceite de novo (o resto do que foi digitado continua)
        api.config().then(setCfg).catch(() => {});
        setDados((d) => ({ ...d, aceite: false }));
        setCadastro((c0) => (c0 && !c0.faltam.includes('aceite') ? { ...c0, faltam: [...c0.faltam, 'aceite'] } : c0));
        setErros({ aceite: erro.message }); focar('aceite');
        return;
      }
      if (erro.tipo === 'validacao' && Object.keys(erro.campos).length) { setErros(erro.campos); focar(Object.keys(erro.campos)[0]); return; }
      setFalha(erro.message);
    }
  };

  // sair: o backend apaga o cookie (HttpOnly, o JavaScript não alcança) e responde 204 sempre; volta ao telefone
  const sair = async () => {
    focoAuto.current = true;
    try { await api?.sair(); } catch { /* sem rede: a sessão vence sozinha; o importante é a tela voltar ao início */ }
    setMembro(null); setCadastro(null); setDesafio(null); setNovo(false); setAtivacao(false); setAviso(''); setErros({}); setFalha('');
    setTelefone(''); setDados({ nome: '', aniversario: '', aceite: false, marketing: false });
    setEtapa('telefone'); setAnuncio('Você saiu do Clube neste aparelho.');
  };

  const carimbo = etapa === 'membro' || etapa === 'ativado' ? { estado: 'reservado', texto: 'membro' }
    : etapa === 'falha' ? { estado: 'erro', texto: 'tente de novo' }
    : etapa === 'convite' || etapa === 'ativando' ? { estado: undefined, texto: 'convite' }
    : etapa === 'codigo' || etapa === 'verificando' ? { estado: undefined, texto: 'quase lá' }
    : etapa === 'cadastro' || etapa === 'salvando' ? { estado: undefined, texto: 'ficha' }
    : { estado: undefined, texto: etapa === 'fechado' ? 'em breve' : 'entrada' };
  const titulo = etapa === 'fechado' ? 'Inscrições em breve'
    : etapa === 'convite' || etapa === 'ativando' ? 'Ative seu Clube Âmbar'
    : etapa === 'codigo' || etapa === 'verificando' ? 'Confirme seu WhatsApp'
    : etapa === 'cadastro' || etapa === 'salvando' ? (cadastro?.nome && !pedeNome ? `Falta pouco, ${primeiroNome(cadastro.nome)}` : ativacao && !pedeNome ? 'Falta pouco' : 'Quase lá')
    : etapa === 'membro' ? (novo ? 'Bem-vindo ao Clube' : 'Que bom te ver')
    : etapa === 'ativado' ? 'Bem-vindo ao Clube'
    : etapa === 'falha' ? 'Não deu certo agora'
    : 'Entre para o Clube Âmbar';
  const grupo = etapa === 'enviando' ? 'telefone' : etapa === 'verificando' ? 'codigo' : etapa === 'salvando' ? 'cadastro' : etapa === 'ativando' ? 'convite' : etapa;
  const leadCadastro = ativacao
    ? (pedeNome ? 'Convite confirmado. Agora, como podemos chamar você?' : 'Convite confirmado. Só falta aceitar os termos do Clube.')
    : (pedeNome ? 'WhatsApp confirmado. Agora, como podemos chamar você?' : 'WhatsApp confirmado. Só falta confirmar os termos do Clube.');
  const regulamento = cfg?.regulamento;
  const nota = `${px}-nota`;

  return (
    <div class="ticket ficha" data-etapa={etapa} data-modo={demo ? 'demo' : modo}
      aria-busy={etapa === 'carregando' || etapa === 'ativando' || etapa === 'enviando' || etapa === 'verificando' || etapa === 'salvando'}>
      <div class="stamp ticket__stamp" data-state={carimbo.estado} aria-hidden="true">{carimbo.texto}</div>
      <p class="ticket__title" ref={topo} tabIndex={-1}>{titulo}</p>
      {simulado && <p class="ficha__simulado" role="note">Simulação local — nada é enviado. Final 0001 = membro · 0002 = incompleto · código 123456 · convite: /clube/ativar?c=demo-novo.</p>}

      <div class="ficha__etapa" key={grupo}>
        {/* pré-lançamento ou inscrições fechadas: SEM campos — nenhum dado é pedido antes da abertura */}
        {etapa === 'fechado' && (
          <>
            <p class="ficha__breve">Estamos preparando os detalhes. Quando as inscrições abrirem, é aqui mesmo que você entra.</p>
            <a class="btn btn--wine btn--block" href="/">Voltar ao início</a>
          </>
        )}

        {etapa === 'carregando' && <p class="ficha__breve" role="status">Abrindo o Clube…</p>}

        {/* A · convite do caixa: o link só é usado neste toque */}
        {(etapa === 'convite' || etapa === 'ativando') && (
          <>
            <p class="ficha__lead">Você pediu no Âmbar o link do Clube. Toque abaixo para ativar seu cadastro.</p>
            {falha && <p class="ticket__status" data-tone="error" role="alert">{falha}</p>}
            <button class="btn btn--wine btn--block" type="button" disabled={etapa === 'ativando'} onClick={ativar}>
              {etapa === 'ativando' ? 'Ativando…' : 'Ativar meu Clube'}
            </button>
            <p class="ficha__sem-app">Sem aplicativo. Sem senha.</p>
          </>
        )}

        {/* 1 · a entrada única: só o WhatsApp */}
        {(etapa === 'telefone' || etapa === 'enviando') && (
          <form class="ficha__form" onSubmit={enviarTelefone} noValidate aria-describedby={nota}>
            <p class="ficha__lead">Seu WhatsApp é a chave para suas vantagens.</p>
            {aviso && <p class="ticket__status" role="status">{aviso}</p>}
            {falha && <p class="ticket__status" data-tone="error" role="alert">{falha}</p>}
            <label class="field" data-invalid={erros.telefone ? '' : undefined}>
              <span class="field__label">WhatsApp</span>
              <input id={`${px}-telefone`} class="field__input" type="tel" inputMode="tel" autocomplete="tel-national" placeholder="(85) 99999-9999"
                value={telefone} disabled={etapa === 'enviando'} aria-invalid={!!erros.telefone} aria-describedby={erros.telefone ? `${px}-telefone-erro` : undefined}
                onInput={(ev) => { setTelefone(mascaraTel((ev.currentTarget as HTMLInputElement).value)); limparErro('telefone'); }} />
              <span class="field__error" id={`${px}-telefone-erro`}>{erros.telefone}</span>
            </label>
            <button class="btn btn--wine btn--block" type="submit" disabled={etapa === 'enviando'}>{etapa === 'enviando' ? 'Enviando…' : 'Continuar'}</button>
            <p class="ficha__sem-app" id={nota}>Sem aplicativo. Sem senha.</p>
          </form>
        )}

        {/* 2 · o código que chegou no WhatsApp */}
        {(etapa === 'codigo' || etapa === 'verificando') && desafio && (
          <PassoCodigo px={px} desafio={desafio} digitos={digitos} ocupado={etapa === 'verificando'} erro={erroCodigo}
            dica="Não chegou? Confira se o número tem WhatsApp, ou troque o número."
            semReenvio={envios >= MAX_ENVIOS}
            aoConfirmar={confirmar}
            aoReenviar={() => pedirCodigo(true)}
            aoTrocarNumero={() => { setDesafio(null); setErroCodigo(''); setFalha(''); setEtapa('telefone'); }} />
        )}

        {/* 3 · cadastro: só o que falta */}
        {(etapa === 'cadastro' || etapa === 'salvando') && cadastro && (
          <form class="ficha__form" onSubmit={concluir} noValidate>
            <p class="ficha__lead">{leadCadastro}</p>
            {falha && <p class="ticket__status" data-tone="error" role="alert">{falha}</p>}
            <fieldset class="ficha__dados" disabled={etapa === 'salvando'}>
              <legend class="visually-hidden">Seus dados</legend>
              {pedeNome && (
                <label class="field" data-invalid={erros.nome ? '' : undefined}>
                  <span class="field__label">Nome</span>
                  <input id={`${px}-nome`} class="field__input" autocomplete="name" value={dados.nome} onInput={mudar('nome')}
                    aria-invalid={!!erros.nome} aria-describedby={erros.nome ? `${px}-nome-erro` : undefined} />
                  <span class="field__error" id={`${px}-nome-erro`}>{erros.nome}</span>
                </label>
              )}
              {pedeAniversario && (
                <label class="field" data-invalid={erros.aniversario ? '' : undefined}>
                  <span class="field__label">Aniversário <small class="ficha__opc">opcional</small></span>
                  <input id={`${px}-aniversario`} class="field__input" inputMode="numeric" autocomplete="off" placeholder="DD/MM" maxLength={5}
                    value={dados.aniversario} onInput={mudar('aniversario')} aria-invalid={!!erros.aniversario}
                    aria-describedby={erros.aniversario ? `${px}-aniversario-erro` : undefined} />
                  <span class="field__error" id={`${px}-aniversario-erro`}>{erros.aniversario}</span>
                </label>
              )}
            </fieldset>
            {(pedeAceite || pedeMarketing) && (
              <fieldset class="ficha__aceites" disabled={etapa === 'salvando'}>
                <legend class="visually-hidden">Termos e novidades</legend>
                {/* obrigatório: política de privacidade + regulamento (só quando a pessoa ainda não aceitou os atuais) */}
                {pedeAceite && (
                  <>
                    <label class="check" data-invalid={erros.aceite ? '' : undefined}>
                      <input id={`${px}-aceite`} type="checkbox" checked={dados.aceite} onChange={mudar('aceite')} aria-invalid={!!erros.aceite} aria-describedby={erros.aceite ? `${px}-aceite-erro` : undefined} />
                      <span>Li e aceito a <a href={cfg?.privacidade?.url ?? privacidadeUrl}>política de privacidade</a> e
                        o {regulamento?.url ? <a href={regulamento.url} target="_blank" rel="noopener">regulamento do Clube</a> : 'regulamento do Clube'}.</span>
                    </label>
                    {erros.aceite && <span class="field__error field__error--block" id={`${px}-aceite-erro`}>{erros.aceite}</span>}
                  </>
                )}
                {/* opcional e separado: novidades e ofertas pelo WhatsApp (revogável) */}
                {pedeMarketing && (
                  <label class="check">
                    <input id={`${px}-marketing`} type="checkbox" checked={dados.marketing} onChange={mudar('marketing')} />
                    <span>Quero receber novidades e ofertas pelo WhatsApp. <small class="ficha__opc ficha__opc--linha">opcional · dá para desligar quando quiser</small></span>
                  </label>
                )}
              </fieldset>
            )}
            <button class="btn btn--wine btn--block" type="submit" disabled={etapa === 'salvando'}>{etapa === 'salvando' ? 'Salvando…' : 'Concluir cadastro'}</button>
            <button class="ticket__link ficha__sair" type="button" disabled={etapa === 'salvando'} onClick={sair}>Não é você? Sair</button>
          </form>
        )}

        {/* membro: confirmação só com a resposta da API. Carteira e saldo ainda não existem — nada de cartão de mentira */}
        {etapa === 'membro' && membro && (
          <>
            <p class="ficha__boas-vindas" role="status">
              {novo ? `Pronto, ${primeiroNome(membro.nome)}!` : `Olá, ${primeiroNome(membro.nome)}!`}
              <span>{novo ? 'Agora você faz parte do Clube Âmbar.' : 'Você já faz parte do Clube Âmbar.'}</span>
            </p>
            <p class="ficha__breve">As vantagens do Clube começam em breve. Para entrar de novo, é só usar este mesmo WhatsApp.</p>
            <a class="btn btn--wine btn--block" href="/">Voltar ao início</a>
            <button class="ticket__link ficha__sair" type="button" onClick={sair}>Não é você? Sair</button>
          </>
        )}

        {/* A · cadastro concluído pelo convite: a sessão de ativação acabou; a conta se abre pelo login normal. Com o
            programa ligado, o botão fala de pontos; desligado, só “entrar” — nada de saldo ou recompensa de mentira */}
        {etapa === 'ativado' && (
          <>
            <p class="ficha__boas-vindas" role="status">Cadastro concluído! <span>Você vai receber a confirmação no WhatsApp.</span></p>
            <button class="btn btn--wine btn--block" type="button"
              onClick={() => { focoAuto.current = true; setFalha(''); setAviso(''); setEtapa('telefone'); }}>
              {cfg?.programaAtivo ? 'Ver meus pontos' : 'Entrar no Clube'}
            </button>
            <a class="ticket__link ficha__sair" href="/">Voltar ao início</a>
          </>
        )}

        {etapa === 'falha' && (
          <>
            <p class="ticket__status" data-tone="error" role="alert">{falha}</p>
            <button class="btn btn--wine btn--block" type="button" onClick={() => { setFalha(''); setTentativa((t) => t + 1); }}>Tentar de novo</button>
          </>
        )}
      </div>

      {etapa === 'fechado' && <p class="ticket__note">Nenhum dado é pedido antes da abertura.</p>}
      <p class="visually-hidden" aria-live="polite">{anuncio}</p>
    </div>
  );
}
