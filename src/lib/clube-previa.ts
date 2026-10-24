// DADOS DE EXEMPLO da prévia local do Clube (/clube/previa/) — SÓ para ver as telas. Importado apenas por
// pages/clube/previa, que não é gerada nos builds de produção e de revisão (lib/clube-modo.ts → CLUBE_PREVIA). Nomes,
// pontos e situações são marcações de exemplo: NÃO são recompensas, valores ou regras do Clube.
import type { CadastroPendente, ConfigClube, DesafioAcesso, MembroClube, MovimentoClube } from './api/clube-acesso';
import type { Recompensa, Resgate } from './api/clube-futuro';
import { TEXTO_SUSPENSA } from './api/clube-erro';

export const cfgExemplo: ConfigClube = {
  inscricoesAbertas: true, programaAtivo: false,
  regulamento: { versao: 'exemplo', url: null }, privacidade: { versao: 'exemplo', url: '/privacidade/' },
  marketing: { textoVersao: 'exemplo' }, codigo: { digitos: 6, validadeS: 600 },
};
export const desafioExemplo: DesafioAcesso = { desafioId: 'exemplo', canal: 'whatsapp', destino: '(85) •••••-0000', reenvioEm: 0, expiraEm: '2030-01-01T00:00:00Z' };

export const membroExemplo: MembroClube = {
  nome: 'Marina Exemplo', telefone: '(85) •••••-0000', aniversario: '03-14', membroDesde: '2026-10-23',
  marketing: { autorizado: false }, mensagens: { autorizado: true }, programa: { ativo: false, saldo: null },
};
export const membroComPontos: MembroClube = { ...membroExemplo, marketing: { autorizado: true }, programa: { ativo: true, saldo: { pendente: 120, disponivel: 340, reservado: 0 } } };

export const cadastroNovo: CadastroPendente = { nome: null, aniversario: null, faltam: ['nome', 'aceite'], marketing: { autorizado: false } };
export const cadastroIncompleto: CadastroPendente = { nome: 'Marina Exemplo', aniversario: '03-14', faltam: ['aceite'], marketing: { autorizado: true } };

/** no formato real de GET /clube/me/movimentos (mais novo primeiro) */
export const movimentosExemplo: MovimentoClube[] = [
  { id: 5, tipo: 'compra', em: '2026-11-21T19:20:00Z', pontos: 42, situacao: 'pendente', liberarEm: '2026-11-28T19:20:00Z', expiraEm: null, compra: { data: '2026-11-21', valor: '42.90' } },
  { id: 4, tipo: 'resgate_reservado', em: '2026-11-14T12:05:00Z', pontos: -150, situacao: null, liberarEm: null, expiraEm: null, compra: null },
  { id: 3, tipo: 'compra', em: '2026-11-09T10:40:00Z', pontos: 78, situacao: 'disponivel', liberarEm: null, expiraEm: '2027-11-09T10:40:00Z', compra: { data: '2026-11-09', valor: '78.50' } },
  { id: 2, tipo: 'estorno', em: '2026-11-02T16:10:00Z', pontos: -18, situacao: null, liberarEm: null, expiraEm: null, compra: { data: '2026-10-30', valor: '18.00' } },
  { id: 1, tipo: 'compra', em: '2026-10-28T09:30:00Z', pontos: 56, situacao: 'disponivel', liberarEm: null, expiraEm: '2027-10-28T09:30:00Z', compra: { data: '2026-10-28', valor: '56.20' } },
];

/** o texto que o backend manda no 403 conta_suspensa */
export const suspensaExemplo = TEXTO_SUSPENSA;

/** fotos: arquivos do próprio site, resolvidos pela página da prévia */
export const recompensasExemplo = (foto: (arquivo: string) => string | null): Recompensa[] => [
  { id: 'r1', nome: 'Recompensa de exemplo A', descricao: 'Texto de exemplo: a descrição vem do backend.', pontos: 150, foto: foto('cardapio/cappuccino.webp'), disponivel: true },
  { id: 'r2', nome: 'Recompensa de exemplo B', descricao: null, pontos: 300, foto: foto('cardapio/roll-tradicional.webp'), disponivel: true },
  { id: 'r3', nome: 'Recompensa de exemplo C', descricao: null, pontos: 600, foto: foto('cardapio/brownies.webp'), disponivel: true },
  { id: 'r4', nome: 'Recompensa de exemplo D', descricao: null, pontos: 200, foto: null, disponivel: false },
];

/** “QR Code” de exemplo: um desenho que NÃO é um QR Code legível, só ocupa o lugar da imagem que o backend vai mandar */
export const qrExemplo = (() => {
  const n = 21; let quadros = '';
  const marca = (x: number, y: number) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#24150F"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#FFFBF4"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#24150F"/>`;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const canto = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
    if (!canto && ((x * 7 + y * 13 + x * y) % 5 < 2)) quadros += `<rect x="${x}" y="${y}" width="1" height="1" fill="#24150F"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 25 25" shape-rendering="crispEdges"><rect x="-2" y="-2" width="25" height="25" fill="#FFFBF4"/>${quadros}${marca(0, 0)}${marca(14, 0)}${marca(0, 14)}<rect x="3.5" y="9" width="14" height="3.6" rx=".6" fill="#FFFBF4"/><text x="10.5" y="11.6" font-size="2.6" text-anchor="middle" font-family="sans-serif" font-weight="700" fill="#681029">EXEMPLO</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
})();

export const resgateExemplo = (foto: string | null, situacao: Resgate['situacao']): Resgate => ({
  id: 'exemplo', recompensa: { nome: 'Recompensa de exemplo A', pontos: 150, foto }, situacao,
  qr: situacao === 'aguardando' ? qrExemplo : null, codigo: situacao === 'aguardando' ? 'EX-0000' : null,
  criadoEm: '2026-11-21T19:20:00Z', validoAte: situacao === 'aguardando' ? '2026-11-28T23:59:00Z' : null,
  utilizadoEm: situacao === 'utilizado' ? '2026-11-22T10:15:00Z' : null,
});

/** as telas da prévia (o id vira o endereço /clube/previa/<id>/) */
export type TelaPrevia = { id: string; grupo: string; titulo: string };
export const TELAS_PREVIA: TelaPrevia[] = [
  { id: 'entrar-telefone', grupo: 'Acesso', titulo: 'WhatsApp' },
  { id: 'entrar-codigo', grupo: 'Acesso', titulo: 'Código de seis dígitos' },
  { id: 'entrar-codigo-incorreto', grupo: 'Acesso', titulo: 'Código incorreto' },
  { id: 'entrar-codigo-expirado', grupo: 'Acesso', titulo: 'Código expirado' },
  { id: 'entrar-reenvio', grupo: 'Acesso', titulo: 'Reenvio com contagem' },
  { id: 'entrar-limite', grupo: 'Acesso', titulo: 'Limite de reenvios' },
  { id: 'entrar-trocar', grupo: 'Acesso', titulo: 'Trocar número' },
  { id: 'entrar-sessao', grupo: 'Acesso', titulo: 'Sessão expirada' },
  { id: 'entrar-carregando', grupo: 'Acesso', titulo: 'Carregando' },
  { id: 'entrar-indisponivel', grupo: 'Acesso', titulo: 'Indisponível' },
  { id: 'entrar-suspensa', grupo: 'Acesso', titulo: 'Conta suspensa' },
  { id: 'entrar-fechado', grupo: 'Acesso', titulo: 'Pré-lançamento (produção hoje)' },
  { id: 'cadastro-novo', grupo: 'Cadastro', titulo: 'Cliente novo' },
  { id: 'cadastro-incompleto', grupo: 'Cadastro', titulo: 'Cadastro incompleto' },
  { id: 'cadastro-erros', grupo: 'Cadastro', titulo: 'Campos com erro' },
  { id: 'cadastro-concluido', grupo: 'Cadastro', titulo: 'Cadastro concluído' },
  { id: 'ativar-convite', grupo: 'Convite', titulo: 'Ativar pelo convite' },
  { id: 'ativar-cadastro', grupo: 'Convite', titulo: 'Cadastro pelo convite' },
  { id: 'ativar-concluido', grupo: 'Convite', titulo: 'Ativado' },
  { id: 'ativar-vencido', grupo: 'Convite', titulo: 'Convite vencido ou usado' },
  { id: 'conta', grupo: 'Conta', titulo: 'Conta (programa em preparação — hoje)' },
  { id: 'conta-pontos', grupo: 'Conta', titulo: 'Conta com pontos (futuro)' },
  { id: 'conta-carregando', grupo: 'Conta', titulo: 'Carregando' },
  { id: 'conta-suspensa', grupo: 'Conta', titulo: 'Conta suspensa' },
  { id: 'historico', grupo: 'Histórico', titulo: 'Em preparação (hoje)' },
  { id: 'historico-lista', grupo: 'Histórico', titulo: 'Movimentações (programa ativo)' },
  { id: 'historico-vazio', grupo: 'Histórico', titulo: 'Vazio' },
  { id: 'historico-carregando', grupo: 'Histórico', titulo: 'Carregando' },
  { id: 'historico-erro', grupo: 'Histórico', titulo: 'Erro' },
  { id: 'recompensas', grupo: 'Recompensas', titulo: 'Em preparação (hoje)' },
  { id: 'recompensas-catalogo', grupo: 'Recompensas', titulo: 'Catálogo (futuro)' },
  { id: 'recompensa-detalhe', grupo: 'Recompensas', titulo: 'Detalhe' },
  { id: 'recompensa-insuficiente', grupo: 'Recompensas', titulo: 'Pontos insuficientes' },
  { id: 'resgate-confirmacao', grupo: 'Recompensas', titulo: 'Confirmação de resgate' },
  { id: 'resgate-aguardando', grupo: 'Resgate', titulo: 'QR Code · aguardando retirada' },
  { id: 'resgate-utilizado', grupo: 'Resgate', titulo: 'Utilizado' },
  { id: 'resgate-expirado', grupo: 'Resgate', titulo: 'Expirado' },
  { id: 'resgate-cancelado', grupo: 'Resgate', titulo: 'Cancelado' },
];
