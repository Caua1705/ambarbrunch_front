/** @jsxImportSource preact */
// Acesso ao Clube Âmbar — ilha Preact compartilhada pelas páginas de entrada (2026-10-23, experiência completa). Uma
// entrada só, pelo WhatsApp; ninguém escolhe entre “cadastrar” e “entrar”: telefone → código → o BACKEND diz a situação
// (lib/api/clube-acesso.ts, contrato real). A mesma lógica muda de papel conforme a página (`pagina`):
//  - landing (/clube): o cartão de acesso. Pede o código e leva o desafio para /clube/entrar (a pessoa não digita o
//    número de novo). Com a sessão aberta: “Olá, Maria — Abrir minha conta” (ou “Concluir cadastro”).
//  - entrar (/clube/entrar): telefone e código, com reenvio, troca de número, código incorreto ou vencido, sessão vencida
//    (`?motivo=sessao`) e indisponibilidade. Confirmado: membro → a conta (ou o destino de `?volta=`, lista fechada);
//    cadastro pendente → /clube/cadastro.
//  - cadastro (/clube/cadastro): conclui o cadastro (só o que falta). Sem sessão, pede o WhatsApp ali mesmo. Concluído:
//    “Você faz parte do Clube Âmbar!” e o caminho para a conta. Membro que chega aqui vai direto à conta.
//  - ativar (/clube/ativar): convite do WhatsApp. O token (capturado e tirado da URL no <head> da página) fica só em
//    memória e só é usado no toque em “Ativar meu Clube” → sessão de ATIVAÇÃO (30 min, só o que falta, sem dados da
//    conta) ou “entrar” (já é membro: login normal) · 410 link vencido → entrar pelo WhatsApp. Concluído → “ativado”: a
//    sessão de ativação acaba (o backend manda a confirmação no WhatsApp; o site não dispara mensagem).
// Conta suspensa pela gerência (403 `conta_suspensa`, b0b0553): ao restaurar a sessão, no código, no convite ou no
// cadastro, a ficha mostra “Conta suspensa” com o texto do backend — nunca o erro genérico, sem “tentar de novo” e sem
// abrir a conta. Pedir o código não revela nada (o backend responde igual para qualquer número).
// Telefone: máscara e validação de lib/telefone.ts (regras do backend; o nono dígito nunca é posto nem tirado).
// Modos (lib/clube-modo.ts): “indisponivel” (pré-lançamento: bilhete “em breve”, sem campos), “api” e “simulado” (só no
// `astro dev`). Sessão: cookie HttpOnly da API — o site não vê nem guarda token.
import { useEffect, useRef, useState } from 'preact/hooks';
import { PassoCodigo } from './clube-partes';
import { ErroClube } from '../lib/api/clube-erro';
import type { CadastroPendente, ConclusaoCadastro, ConfigClube, DesafioAcesso, MembroClube, SituacaoClube } from '../lib/api/clube-acesso';
import { ROTAS, destinoSeguro, levarDesafio, primeiroNome, trazerDesafio, urlEntrar, useApiClube } from '../lib/clube-cliente';
import { conferirTelefone, mascaraTel, soDigitos, telefoneNacional, uuid } from '../lib/telefone';
import { visita } from '../data/visita';
import type { ModoClube } from '../lib/clube-modo';

export type PaginaAcesso = 'landing' | 'entrar' | 'cadastro' | 'ativar';
export type EtapaFicha = 'carregando' | 'fechado' | 'falha' | 'convite' | 'ativando' | 'telefone' | 'enviando' | 'codigo' | 'verificando'
  | 'cadastro' | 'salvando' | 'pendente' | 'membro' | 'ativado' | 'abrindo' | 'suspensa';
interface Dados { nome: string; aniversario: string; aceite: boolean; marketing: boolean }
/** Estado forçado — SÓ para a prévia local (/clube/previa/, fora do build de produção). Nada é enviado. */
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
  /** reenvios já usados (mostra o limite) */
  envios?: number;
  cfg?: Partial<ConfigClube>;
}
interface Props {
  modo: ModoClube;
  apiUrl?: string;
  privacidadeUrl: string;
  pagina: PaginaAcesso;
  /** prefixo dos ids (várias fichas na mesma página) */
  ids?: string;
  demo?: DemoFicha;
}

const DIGITOS_PADRAO = 6;
/** pedidos de código por número nesta visita (a API também limita, por IP e por telefone) */
const MAX_ENVIOS = 3;
const TEXTO_FALHA = 'Não foi possível concluir. Tente de novo em instantes.';
const AVISO_CONVITE = 'Para ativar pelo convite, toque de novo no botão da mensagem do WhatsApp — ou entre com seu WhatsApp aqui.';

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
const ir = (url: string) => { window.location.assign(url); };

export default function ClubeAcesso({ modo, apiUrl, privacidadeUrl, pagina, ids: px = 'cf', demo }: Props) {
  const api = useApiClube(modo, apiUrl, !!demo);
  const aberto = !demo && ((modo === 'api' && !!apiUrl) || modo === 'simulado');
  const [cfg, setCfg] = useState<ConfigClube | null>((demo?.cfg as ConfigClube | undefined) ?? null);
  const [etapa, setEtapa] = useState<EtapaFicha>(demo?.etapa ?? (aberto ? 'carregando' : 'fechado'));
  const [telefone, setTelefone] = useState(demo?.telefone ?? '');
  const [dados, setDados] = useState<Dados>({ nome: '', aniversario: '', aceite: false, marketing: false, ...demo?.dados });
  const [erros, setErros] = useState<Record<string, string>>(demo?.erros ?? {});
  const [falha, setFalha] = useState(demo?.falha ?? '');
  const [desafio, setDesafio] = useState<DesafioAcesso | null>(demo?.desafio ?? null);
  const [erroCodigo, setErroCodigo] = useState(demo?.erros?.codigo ?? '');
  const [envios, setEnvios] = useState(demo?.envios ?? 0);
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
  /** o foco acompanha só as ações da pessoa — restaurar a sessão ao abrir a página não rola a tela até o cartão */
  const focoAuto = useRef(false);
  /** token do convite: só em memória, usado uma vez no toque em “Ativar meu Clube” */
  const tokenConvite = useRef<string | null>(null);
  /** há um convite ainda não usado, mas a página abriu numa sessão que já existia (talvez de outro número) */
  const [convitePendente, setConvitePendente] = useState(false);
  /** para onde ir depois do login (lista fechada) */
  const destino = useRef<string>(ROTAS.conta);

  // convite: pega o token que o <head> de /clube/ativar tirou da URL e apaga a cópia global (fica só aqui, em memória)
  useEffect(() => {
    if (pagina !== 'ativar' || demo) return;
    const w = window as unknown as { __ambarConvite?: string };
    tokenConvite.current = w.__ambarConvite ?? null;
    delete w.__ambarConvite;
  }, []);
  // Regras vigentes vindas da API: inscrições fechadas ou sem termos publicados → bilhete “em breve”. Abertas: a sessão
  // do cookie é restaurada (GET /clube/me) — 200 vai direto à situação, sem código; 401 mostra o telefone.
  useEffect(() => {
    if (!api) return;
    setEtapa('carregando');
    const q = new URLSearchParams(window.location.search);
    destino.current = destinoSeguro(q.get('volta'));
    (async () => {
      let c: ConfigClube;
      try { c = await api.config(); } catch (e) { setFalha(comoErro(e).message); setEtapa('falha'); return; }
      setCfg(c);
      // sem as duas versões (regulamento e privacidade) não há como aceitar: a ficha continua fechada
      if (!(c.inscricoesAbertas && c.regulamento?.versao && c.privacidade?.versao)) { setEtapa('fechado'); return; }
      // vindo da landing: o código já foi pedido — direto para ele, sem digitar o número de novo
      if (pagina === 'entrar') {
        const t = trazerDesafio();
        if (t) { setDesafio(t.desafio); setEnvios(t.envios); setEtapa('codigo'); return; }
      }
      // sessão que já vale neste navegador vem antes do convite — mas, com um convite em mãos, a opção de ativá-lo
      // continua à vista (a sessão aberta pode ser de outro número)
      try {
        aplicar(await api.me(), false);
        if (pagina === 'ativar' && tokenConvite.current) setConvitePendente(true);
        return;
      }
      // 401 = sem sessão (o normal, e sempre fora de ambarbrunch.com); outro erro também segue: dá para entrar pelo código.
      // Conta suspensa, não: o backend revogou a sessão e diz o porquê — a ficha mostra isso e para. Com um convite em
      // mãos, segue para ele: a sessão suspensa pode ser de OUTRO número (aparelho compartilhado); se o convite for do
      // mesmo número, o toque recebe o mesmo 403.
      catch (e) { if (!(pagina === 'ativar' && tokenConvite.current) && suspender(e)) return; }
      if (pagina === 'ativar' && tokenConvite.current) { setEtapa('convite'); return; }
      // /clube/ativar sem o token (recarregou depois de ele sair da URL, ou link incompleto): entrada normal
      if (pagina === 'ativar') setAviso(AVISO_CONVITE);
      if (pagina === 'cadastro') setAviso('Confirme seu WhatsApp para continuar o cadastro.');
      if (pagina === 'entrar' && q.get('motivo') === 'sessao') setAviso('Sua sessão terminou. Confirme seu WhatsApp para continuar.');
      setEtapa('telefone');
    })();
  }, [api, tentativa]);
  // Foco a cada troca de etapa feita pela pessoa: no título — no código, o próprio campo pega o foco; ao voltar ao
  // telefone, o campo do telefone.
  useEffect(() => {
    if (!focoAuto.current) return;
    if (etapa === 'telefone') document.getElementById(`${px}-telefone`)?.focus();
    else if (etapa === 'cadastro' || etapa === 'membro' || etapa === 'ativado' || etapa === 'falha' || etapa === 'suspensa') topo.current?.focus();
  }, [etapa]);

  const digitos = cfg?.codigo?.digitos ?? DIGITOS_PADRAO;
  const limparErro = (campo: string) => { if (erros[campo]) setErros((e) => { const n = { ...e }; delete n[campo]; return n; }); };
  const mudar = (campo: keyof Dados) => (ev: Event) => {
    const alvo = ev.currentTarget as HTMLInputElement;
    const valor = campo === 'aceite' || campo === 'marketing' ? alvo.checked : campo === 'aniversario' ? mascaraDia(alvo.value) : alvo.value;
    setDados((d) => ({ ...d, [campo]: valor }));
    limparErro(campo);
  };
  const focar = (campo: string) => requestAnimationFrame(() => document.getElementById(`${px}-${campo}`)?.focus());
  const comoErro = (e: unknown) => (e instanceof ErroClube ? e : new ErroClube('servidor', TEXTO_FALHA));
  const abrir = (url: string, texto: string) => { setEtapa('abrindo'); setAnuncio(texto); ir(url); };
  /** 403 conta_suspensa: nada da conta fica na tela, nenhum convite pendente; a mensagem é a do backend */
  const suspender = (e: unknown) => {
    if (!(e instanceof ErroClube) || e.tipo !== 'suspensa') return false;
    tokenConvite.current = null; setConvitePendente(false);
    setMembro(null); setCadastro(null); setDesafio(null); setAtivacao(false); setAviso(''); setErroCodigo('');
    setFalha(e.message); setAnuncio(e.message); setEtapa('suspensa');
    return true;
  };

  /** a situação vem SEMPRE do backend (sessão restaurada, convite, verificação ou conclusão) */
  const aplicar = (s: SituacaoClube, concluiuAgora: boolean) => {
    if (s.situacao === 'membro') {
      setMembro(s.membro); setCadastro(null); setAtivacao(false);
      // login confirmado (ou membro que abriu o cadastro): direto à conta
      if (pagina === 'entrar' || (pagina === 'cadastro' && !concluiuAgora)) { abrir(destino.current, 'Abrindo sua conta…'); return; }
      setNovo(concluiuAgora); setEtapa('membro');
      setAnuncio(concluiuAgora ? 'Cadastro concluído! Você faz parte do Clube Âmbar.' : `Olá, ${primeiroNome(s.membro.nome)}.`);
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
    // falta cadastro: a conclusão tem página própria (a landing só mostra o atalho; o login leva até lá)
    if (pagina === 'entrar') { abrir(ROTAS.cadastro, 'Falta pouco para concluir seu cadastro.'); return; }
    setCadastro(c); setAtivacao(s.situacao === 'ativacao');
    if (pagina === 'landing') { setEtapa('pendente'); return; }
    // o que já existe não é pedido de novo; o que ainda falta continua preenchido com o que a pessoa digitou
    setDados((d) => ({ ...d, nome: c.faltam.includes('nome') ? d.nome : (c.nome ?? ''), aceite: c.faltam.includes('aceite') ? d.aceite : true }));
    setEtapa('cadastro');
    setAnuncio(concluiuAgora ? 'Ainda falta um dado.' : s.situacao === 'ativacao' ? 'Convite confirmado.' : 'WhatsApp confirmado.');
  };

  // A · convite: o token só é usado aqui, no toque (nunca ao abrir a página). Também a partir de uma sessão que já
  // estava aberta neste navegador — num aparelho compartilhado ela pode ser de OUTRO número: “Ativar o convite recebido”
  // troca a sessão pela de ativação (o backend revoga a anterior; se o convite é de quem já é membro, vem “entrar” e
  // nada é revogado; um 410 também não revoga nada).
  const ativar = async () => {
    const origem = etapa;
    if (!api || !(origem === 'convite' || origem === 'membro' || origem === 'cadastro')) return;
    focoAuto.current = true;
    const token = tokenConvite.current;
    if (!token) { setAviso(AVISO_CONVITE); setEtapa('telefone'); return; }
    setEtapa('ativando'); setFalha('');
    try {
      const s = await api.ativarConvite(token);
      tokenConvite.current = null;   // usado
      setConvitePendente(false);
      aplicar(s, false);
    } catch (e) {
      if (suspender(e)) return;
      const erro = comoErro(e);
      if (erro.tipo === 'codigo') {
        // 410: vencido, já usado, substituído por um link mais novo ou inválido
        tokenConvite.current = null; setConvitePendente(false);
        setAnuncio('Link de ativação vencido.');
        // vindo de uma sessão já aberta, ela continua valendo: fica onde estava, com o aviso
        if (origem !== 'convite') { setFalha('Este link de ativação venceu ou já foi usado.'); setEtapa(origem); return; }
        setFalha('Este link de ativação venceu ou já foi usado. Entre com seu WhatsApp aqui mesmo.');
        setEtapa('telefone');
        return;
      }
      // 403, 429, 503, rede: o convite continua valendo; dá para tentar de novo
      setFalha(erro.message); setAnuncio(erro.message); setEtapa(origem);
    }
  };

  // 1 · telefone → código
  const pedirCodigo = async (reenvio = false) => {
    if (!api) return;
    if (envios >= MAX_ENVIOS) { setErroCodigo('Muitas tentativas. Aguarde alguns minutos e tente de novo.'); return; }
    if (!reenvio) setEtapa('enviando');
    setFalha('');
    try {
      const d = await api.pedirCodigo(telefoneNacional(telefone));
      // na landing, o código é digitado na tela própria de acesso
      if (pagina === 'landing' && !reenvio) { levarDesafio(d, envios + 1); abrir(ROTAS.entrar, `Enviamos um código para ${d.destino}.`); return; }
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
    // WhatsApp é celular: DDD + 9 dígitos. Sem o nono dígito, o site explica — não completa nem corta nada
    const conferido = conferirTelefone(telefone, { celular: true });
    if (!conferido.ok) {
      setErros({ telefone: conferido.mensagem });
      setAnuncio(conferido.mensagem); focar('telefone');
      return;
    }
    setErros({}); setEnvios(0);
    pedirCodigo();
  };

  // 2 · código → situação
  const confirmar = async (codigo: string) => {
    if (!api || !desafio) return;
    focoAuto.current = true;
    setEtapa('verificando'); setErroCodigo('');
    try {
      // a sessão chega como cookie HttpOnly (Set-Cookie): o site não vê nem guarda token
      const s = await api.verificar(desafio.desafioId, codigo);
      // no convite, quem entra pelo código já é membro: a conta abre direto
      if (s.situacao === 'membro' && pagina === 'ativar') { abrir(destino.current, 'Abrindo sua conta…'); return; }
      aplicar(s, false);
    } catch (e) {
      // código certo de conta suspensa: o backend gasta o código e não abre sessão
      if (suspender(e)) return;
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
  // novidades: só se a pessoa ainda não autorizou e a API oferece o texto de consentimento (na prévia, sempre)
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
      // sem `origem`: o backend sabe pelo desafio de onde veio o acesso (e só aceitaria texto, não um objeto)
    };
    chave.current = uuid();
    setEtapa('salvando'); setAnuncio('Salvando…');
    try {
      aplicar(await api.concluir(c, chave.current), true);
    } catch (err) {
      if (suspender(err)) return;
      const erro = comoErro(err);
      setAnuncio(erro.message);
      if (erro.tipo === 'sessao') {
        // 401: sessão vencida — a de ativação dura 30 min — ou o cadastro já ficou ativo por outro caminho. O que foi
        // digitado continua guardado: depois do código, o formulário volta preenchido.
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
    setTelefone(''); setDados({ nome: '', aniversario: '', aceite: false, marketing: false }); setConvitePendente(false);
    // com um convite ainda não usado (aparelho compartilhado), sair leva ao botão do convite
    setEtapa(tokenConvite.current ? 'convite' : 'telefone'); setAnuncio('Você saiu do Clube neste aparelho.');
  };

  const nome1 = membro ? primeiroNome(membro.nome) : '';
  const titulo = etapa === 'fechado' ? 'Inscrições em breve'
    : etapa === 'convite' || etapa === 'ativando' ? 'Ative seu Clube Âmbar'
    : etapa === 'codigo' || etapa === 'verificando' ? 'Confirme seu WhatsApp'
    : etapa === 'cadastro' || etapa === 'salvando' ? (cadastro?.nome && !pedeNome ? `Falta pouco, ${primeiroNome(cadastro.nome)}` : ativacao && !pedeNome ? 'Falta pouco' : 'Quase lá')
    : etapa === 'pendente' ? (cadastro?.nome ? `Falta pouco, ${primeiroNome(cadastro.nome)}` : 'Falta pouco')
    : etapa === 'membro' ? (novo ? 'Você faz parte do Clube Âmbar!' : `Olá, ${nome1}!`)
    : etapa === 'ativado' ? 'Você faz parte do Clube Âmbar!'
    : etapa === 'abrindo' ? 'Um instante…'
    : etapa === 'falha' ? 'Não deu certo agora'
    : etapa === 'suspensa' ? 'Conta suspensa'
    : pagina === 'landing' ? 'Seu lugar no Clube começa aqui.'
    : pagina === 'cadastro' ? 'Continue seu cadastro'
    : 'Acesse o Clube Âmbar';
  const grupo = etapa === 'enviando' ? 'telefone' : etapa === 'verificando' ? 'codigo' : etapa === 'salvando' ? 'cadastro' : etapa === 'ativando' ? 'convite' : etapa;
  const leadCadastro = ativacao
    ? (pedeNome ? 'Convite confirmado. Agora, como podemos chamar você?' : 'Convite confirmado. Só falta aceitar os termos do Clube.')
    : (pedeNome ? 'WhatsApp confirmado. Agora, como podemos chamar você?' : 'WhatsApp confirmado. Só falta confirmar os termos do Clube.');
  const leadTelefone = pagina === 'landing' ? 'Informe seu WhatsApp para entrar ou fazer parte.'
    : 'Informe seu WhatsApp para entrar ou fazer parte. Enviamos um código para confirmar que o número é seu.';
  const regulamento = cfg?.regulamento;
  const nota = `${px}-nota`;
  const contaLink = <a class="btn btn--wine btn--block" href={ROTAS.conta}>Abrir minha conta <span class="ficha__seta" aria-hidden="true">→</span></a>;

  // o cartão de acesso: título em frase, sem carimbo nem aviso técnico (a simulação local tem painel próprio, fora do
  // cartão). O carimbo fica só no bilhete “em breve” do pré-lançamento.
  return (
    <div class={etapa === 'fechado' ? 'ticket ficha' : 'ticket ficha ficha--acesso'} data-etapa={etapa} data-pagina={pagina} data-modo={demo ? 'demo' : modo}
      aria-busy={etapa === 'carregando' || etapa === 'ativando' || etapa === 'enviando' || etapa === 'verificando' || etapa === 'salvando' || etapa === 'abrindo'}>
      {etapa === 'fechado' && <div class="stamp ticket__stamp" aria-hidden="true">em breve</div>}
      <p class="ticket__title" ref={topo} tabIndex={-1}>{titulo}</p>

      <div class="ficha__etapa" key={grupo}>
        {/* pré-lançamento ou inscrições fechadas: SEM campos — nenhum dado é pedido antes da abertura */}
        {etapa === 'fechado' && (
          <>
            <p class="ficha__breve">Estamos preparando os detalhes. Quando as inscrições abrirem, é aqui mesmo que você entra.</p>
            <a class="btn btn--wine btn--block" href={pagina === 'landing' ? '/' : ROTAS.landing}>{pagina === 'landing' ? 'Voltar ao início' : 'Conhecer o Clube'}</a>
          </>
        )}

        {(etapa === 'carregando' || etapa === 'abrindo') && (
          <div class="ficha__espera" role="status">
            <span class="ficha__pulso" aria-hidden="true" />
            <span>{etapa === 'abrindo' ? anuncio || 'Abrindo…' : 'Abrindo o Clube…'}</span>
          </div>
        )}

        {/* A · convite do WhatsApp: o link só é usado neste toque */}
        {(etapa === 'convite' || etapa === 'ativando') && (
          <>
            <p class="ficha__lead">Você recebeu o convite do Clube no WhatsApp. Toque abaixo para ativar seu cadastro — sem senha e sem código.</p>
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
            <p class="ficha__lead">{leadTelefone}</p>
            {aviso && <p class="ticket__status" role="status">{aviso}</p>}
            {falha && <p class="ticket__status" data-tone="error" role="alert">{falha}</p>}
            <label class="field" data-invalid={erros.telefone ? '' : undefined}>
              <span class="field__label">WhatsApp</span>
              <input id={`${px}-telefone`} class="field__input" type="tel" inputMode="tel" autocomplete="tel-national" placeholder="(85) 99999-9999"
                value={telefone} disabled={etapa === 'enviando'} aria-invalid={!!erros.telefone} aria-describedby={erros.telefone ? `${px}-telefone-erro` : undefined}
                onInput={(ev) => { setTelefone(mascaraTel((ev.currentTarget as HTMLInputElement).value)); limparErro('telefone'); }} />
              <span class="field__error" id={`${px}-telefone-erro`}>{erros.telefone}</span>
            </label>
            <button class="btn btn--wine btn--block" type="submit" disabled={etapa === 'enviando'}>
              {etapa === 'enviando' ? 'Enviando…' : <>Continuar <span class="ficha__seta" aria-hidden="true">→</span></>}
            </button>
            <p class="ficha__sem-app" id={nota}>Um único acesso. Sem senha.</p>
          </form>
        )}

        {/* 2 · o código que chegou no WhatsApp */}
        {(etapa === 'codigo' || etapa === 'verificando') && desafio && (
          <PassoCodigo px={px} desafio={desafio} digitos={digitos} ocupado={etapa === 'verificando'} erro={erroCodigo}
            dica="Não chegou? Confira se o número tem WhatsApp, ou troque o número."
            semReenvio={envios >= MAX_ENVIOS}
            aoConfirmar={confirmar}
            aoReenviar={() => pedirCodigo(true)}
            aoTrocarNumero={() => { focoAuto.current = true; setDesafio(null); setErroCodigo(''); setFalha(''); setEtapa('telefone'); }} />
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
                {/* opcional e separado: novidades e ofertas pelo WhatsApp (revogável), desmarcado por padrão */}
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
            {convitePendente && <button class="ticket__link ficha__sair" type="button" disabled={etapa === 'salvando'} onClick={ativar}>Ativar o convite recebido</button>}
          </form>
        )}

        {/* landing com cadastro pela metade: o atalho para concluir */}
        {etapa === 'pendente' && (
          <>
            <p class="ficha__lead">Seu WhatsApp já está confirmado. Conclua o cadastro para fazer parte do Clube.</p>
            <a class="btn btn--wine btn--block" href={ROTAS.cadastro}>Concluir cadastro <span class="ficha__seta" aria-hidden="true">→</span></a>
            <button class="ticket__link ficha__sair" type="button" onClick={sair}>Não é você? Sair</button>
          </>
        )}

        {/* membro: só com a resposta da API. Na conclusão do cadastro, a celebração; na landing e no convite, o atalho */}
        {etapa === 'membro' && membro && (
          <>
            {novo
              ? <p class="ficha__boas-vindas" role="status">Pronto, {nome1}! <span>Cadastro concluído. Sua conta já está aberta neste aparelho.</span></p>
              : <p class="ficha__lead" role="status">Você já faz parte do Clube Âmbar. Sua conta está a um toque.</p>}
            {/* pelo site, a confirmação é só esta tela: o backend não manda WhatsApp nesse caminho (só no convite) */}
            {falha && <p class="ticket__status" data-tone="error" role="alert">{falha}</p>}
            {contaLink}
            {!novo && <button class="ticket__link ficha__sair" type="button" onClick={sair}>Não é você? Sair</button>}
            {convitePendente && <button class="ticket__link ficha__sair" type="button" onClick={ativar}>Ativar o convite recebido</button>}
          </>
        )}

        {/* A · cadastro concluído pelo convite: a sessão de ativação acabou; a conta se abre pelo login normal */}
        {etapa === 'ativado' && (
          <>
            <p class="ficha__boas-vindas" role="status">Cadastro concluído! <span>Você vai receber a confirmação no WhatsApp.</span></p>
            <a class="btn btn--wine btn--block" href={urlEntrar()}>{cfg?.programaAtivo ? 'Ver meus pontos' : 'Entrar na minha conta'} <span class="ficha__seta" aria-hidden="true">→</span></a>
            <a class="ticket__link ficha__sair" href="/">Voltar ao início</a>
          </>
        )}

        {/* conta suspensa: o texto do backend, o caminho para a equipe — sem “tentar de novo” e sem nada da conta */}
        {etapa === 'suspensa' && (
          <>
            <p class="ticket__status" data-tone="error" role="alert">{falha}</p>
            <a class="btn btn--wine btn--block" href={visita.whatsapp.url} target="_blank" rel="noopener">Falar com a equipe no WhatsApp</a>
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
