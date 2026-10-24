// API DE MENTIRA do acesso ao Clube — SÓ para testar o fluxo no `astro dev` com PUBLIC_CLUBE_MODO=simulado. Nunca entra
// num build: islands/ClubeCadastro.tsx só a importa dentro de `if (import.meta.env.DEV)`. Nada sai do navegador. Segue o
// contrato real de clube-acesso.ts. Para a prévia imitar o cookie do backend (recarregar a página volta direto à
// situação, pelo GET /clube/me), a sessão de MENTIRA e os cadastros de mentira ficam no sessionStorage desta aba
// (chave “ambar:clube:simulacao”; somem ao fechar a aba). Isso é só da simulação: o site real nunca guarda sessão.
// Roteiro pelo final do número (qualquer DDD, celular com 9):
//   …0001 → membro ativo · …0002 → cadastro incompleto (já tem nome; falta aceitar os termos atuais) · …0003 → conta
//   suspensa pela gerência (o código certo gasta o desafio e responde 403 conta_suspensa) · outros → novo
// Código: 123456 confere · 000000 = vencido · outro = incorreto (5 erros travam o código). Até 3 envios por número.
// Convite do caixa (caminho A): /clube/ativar?c=demo-novo · demo-incompleto · demo-ativo · demo-suspenso · demo-vencido.
// Histórico (GET /clube/me/movimentos): o programa está desligado na simulação — lista vazia, como o backend.
import { ErroClube, TEXTO_SUSPENSA } from './clube-erro';
import type { AcessoClubeApi, CadastroPendente, ConfigClube, MembroClube, SituacaoClube } from './clube-acesso';

const espera = (ms = 450) => new Promise((r) => setTimeout(r, ms));
const mascara = (t: string) => `(${t.slice(0, 2)}) •••••-${t.slice(-4)}`;
/** número de mentira de cada convite de demonstração */
const CONVITES: Record<string, string> = { 'demo-novo': '85977770011', 'demo-incompleto': '85988880002', 'demo-ativo': '85988880001', 'demo-suspenso': '85988880003' };
/** a gerência suspendeu este número: código, link e sessão respondem 403 conta_suspensa */
const suspenso = (telefone: string) => telefone.endsWith('0003');
const contaSuspensa = () => new ErroClube('suspensa', TEXTO_SUSPENSA);

type Escopo = 'completa' | 'ativacao';
/** preferências de comunicação de cada número (final de 4 dígitos) */
type Prefs = { marketing: boolean; mensagens: boolean };
interface Guardado { sessao: string | null; escopo: Escopo; cadastros: [string, CadastroPendente][]; usados: string[]; prefs?: [string, Prefs][]; desafios?: [string, { telefone: string; erros: number }][]; envios?: [string, number][] }

export function criarAcessoSimulado(): AcessoClubeApi {
  // estado de mentira na aba: o telefone da sessão (o “cookie”), o escopo dela e os cadastros feitos na prévia
  const CHAVE = 'ambar:clube:simulacao';
  const lido = (() => { try { return JSON.parse(sessionStorage.getItem(CHAVE) ?? 'null') as Guardado | null; } catch { return null; } })();
  let sessao: string | null = lido?.sessao ?? null;
  let escopo: Escopo = lido?.escopo ?? 'completa';
  const usados = new Set<string>(lido?.usados ?? []);
  const cadastros = new Map<string, CadastroPendente>(lido?.cadastros ?? [
    ['0002', { nome: 'João Pedro', aniversario: '03-14', faltam: ['aceite'], marketing: { autorizado: false } }],
  ]);
  const prefs = new Map<string, Prefs>(lido?.prefs ?? []);
  // desafios e envios também ficam na aba: o código pedido na landing é digitado em /clube/entrar (outra página)
  const desafios = new Map<string, { telefone: string; erros: number }>(lido?.desafios ?? []);
  const envios = new Map<string, number>(lido?.envios ?? []);
  const guardar = () => {
    try { sessionStorage.setItem(CHAVE, JSON.stringify({ sessao, escopo, cadastros: [...cadastros], usados: [...usados], prefs: [...prefs], desafios: [...desafios], envios: [...envios] } satisfies Guardado)); }
    catch { /* aba sem armazenamento: vale só a memória */ }
  };
  const semSessao = () => new ErroClube('sessao', 'Sua confirmação expirou. Confirme o WhatsApp de novo.');
  const membro = (telefone: string, nome: string, aniversario: string | null, autorizado: boolean): MembroClube => {
    const p = prefs.get(telefone.slice(-4)) ?? { marketing: autorizado, mensagens: true };
    return { nome, telefone: mascara(telefone), aniversario, membroDesde: '2026-10-23', marketing: { autorizado: p.marketing }, mensagens: { autorizado: p.mensagens }, programa: { ativo: false, saldo: null } };
  };
  const pendente = (telefone: string): CadastroPendente | null => {
    if (telefone.endsWith('0001')) return null;
    const c = cadastros.get(telefone.slice(-4)) ?? { nome: null, aniversario: null, faltam: ['nome', 'aceite'], marketing: { autorizado: false } };
    return c.faltam.length ? c : null;
  };
  const situacao = (telefone: string): SituacaoClube => {
    const c = pendente(telefone);
    if (c) return { situacao: 'cadastro', cadastro: c, membro: null };
    if (telefone.endsWith('0001')) return { situacao: 'membro', membro: membro(telefone, 'Maria Clara', '07-02', true), cadastro: null };
    const feito = cadastros.get(telefone.slice(-4))!;
    return { situacao: 'membro', membro: membro(telefone, feito.nome!, feito.aniversario, feito.marketing.autorizado), cadastro: null };
  };
  /** a sessão de ativação nunca mostra o que já existe: nome e aniversário null, novidades “não” */
  const vistaAtivacao = (c: CadastroPendente): SituacaoClube => ({ situacao: 'ativacao', cadastro: { nome: null, aniversario: null, faltam: c.faltam, marketing: { autorizado: false } }, membro: null });

  return {
    config: async (): Promise<ConfigClube> => {
      await espera(250);
      return { inscricoesAbertas: true, programaAtivo: false, regulamento: { versao: 'sim-1', url: null }, privacidade: { versao: 'sim-1', url: null }, marketing: { textoVersao: 'sim-1' }, codigo: { digitos: 6, validadeS: 600 } };
    },
    pedirCodigo: async (telefone) => {
      await espera();
      const n = (envios.get(telefone) ?? 0) + 1;
      envios.set(telefone, n);
      if (n > 3) throw new ErroClube('limite', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
      const desafioId = `sim-${Date.now()}`;
      desafios.set(desafioId, { telefone, erros: 0 }); guardar();
      return { desafioId, canal: 'whatsapp', destino: mascara(telefone), reenvioEm: 20, expiraEm: new Date(Date.now() + 600_000).toISOString() };
    },
    verificar: async (desafioId, codigo) => {
      await espera();
      const d = desafios.get(desafioId);
      if (!d || codigo === '000000') throw new ErroClube('codigo', 'Este código venceu ou já foi usado. Peça um novo.');
      if (codigo !== '123456') {
        d.erros += 1; guardar();
        if (d.erros >= 5) { desafios.delete(desafioId); throw new ErroClube('limite', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'); }
        throw new ErroClube('validacao', 'Confira o código.', { codigo: 'Código incorreto. Confira e tente de novo.' });
      }
      desafios.delete(desafioId);
      if (suspenso(d.telefone)) { guardar(); throw contaSuspensa(); }   // o código vale uma vez, mesmo assim
      sessao = d.telefone; escopo = 'completa'; guardar();
      const s = situacao(d.telefone);
      return { ...(s as Extract<SituacaoClube, { situacao: 'membro' | 'cadastro' }>), sessao: { expiraEm: new Date(Date.now() + 3_600_000).toISOString() } };
    },
    me: async () => {
      await espera(200);
      if (!sessao) throw semSessao();
      if (escopo === 'ativacao') {
        const c = pendente(sessao);
        if (!c) { sessao = null; guardar(); throw new ErroClube('sessao', 'Entre com seu WhatsApp.'); }
        return vistaAtivacao(c);
      }
      return situacao(sessao);
    },
    movimentos: async () => {
      await espera(250);
      if (!sessao || escopo !== 'completa') throw semSessao();
      return { programaAtivo: false, saldo: null, itens: [], proximo: null };
    },
    sair: async () => { await espera(200); sessao = null; guardar(); },
    ativarConvite: async (token) => {
      await espera();
      const telefone = CONVITES[token];
      if (!telefone || usados.has(token)) throw new ErroClube('codigo', 'Este link venceu ou já foi usado.');
      usados.add(token);
      if (suspenso(telefone)) { guardar(); throw contaSuspensa(); }
      const c = pendente(telefone);
      if (!c) { guardar(); return { situacao: 'entrar', membro: null, cadastro: null }; }   // já é membro: sem sessão
      sessao = telefone; escopo = 'ativacao'; guardar();
      return vistaAtivacao(c);
    },
    marketing: async (autorizado) => {
      await espera(300);
      if (!sessao || escopo !== 'completa') throw semSessao();
      const s = situacao(sessao);
      if (s.situacao !== 'membro') throw new ErroClube('validacao', 'Conclua o cadastro primeiro.');
      prefs.set(sessao.slice(-4), { marketing: autorizado, mensagens: s.membro.mensagens.autorizado }); guardar();
      return situacao(sessao);
    },
    pararMensagens: async () => {
      await espera(300);
      if (!sessao || escopo !== 'completa') throw semSessao();
      const s = situacao(sessao);
      if (s.situacao === 'membro') { prefs.set(sessao.slice(-4), { marketing: s.membro.marketing.autorizado, mensagens: false }); guardar(); }
    },
    concluir: async (c) => {
      await espera();
      const telefone = sessao;
      if (!telefone) throw semSessao();
      const p = pendente(telefone);
      if (!p) return situacao(telefone);
      // como o backend: no primeiro envio o nome é obrigatório (é ele que cria o cadastro)
      if (!p.nome && !c.nome?.trim()) throw new ErroClube('validacao', 'Confira os dados.', { nome: 'Informe seu nome.' });
      const nome = p.nome ?? c.nome!.trim();   // nome já gravado não muda
      const faltam = p.faltam.includes('aceite') && !c.aceiteRegulamento ? (['aceite'] as const) : ([] as const);
      cadastros.set(telefone.slice(-4), { nome, aniversario: p.aniversario ?? c.aniversario ?? null, faltam: [...faltam], marketing: { autorizado: c.marketing?.autorizado ?? p.marketing.autorizado } });
      if (escopo === 'ativacao') {
        // concluído pelo convite: a sessão de ativação acaba
        if (!faltam.length) { sessao = null; guardar(); return { situacao: 'ativado', membro: null, cadastro: null }; }
        guardar();
        return vistaAtivacao(pendente(telefone)!);
      }
      guardar();
      return situacao(telefone);
    },
  };
}
