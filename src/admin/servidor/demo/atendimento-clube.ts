// DEMONSTRAÇÃO — conversas do WhatsApp e Clube Âmbar fictícios (nomes, telefones, mensagens, mídias, campanhas e cadastros
// inventados; nada sai para a Meta). O Atendimento imita as regras de app/modulos/atendimento do backend: os quatro estados,
// assumir/transferir, responder só na janela de 24 h, assistente ligado/desligado por conversa, nova conversa com template,
// campanhas com bloqueios (teste, marketing sem autorização, pediu para parar), base de conhecimento e cadastros duplicados
// ligados sem fundir. Eventos como app/modulos/atendimento/eventos.py: uma oportunidade ABERTA por conversa (409), resumo e
// "faltando" gerados aqui, status comercial só com a gerência (403 sem_permissao), assunto "evento" na conversa. O Clube aparece como no backend antes do lançamento: inscrições fechadas e programa de pontos desligado.
import { deflateSync, crc32 } from 'node:zlib';
import type { Rota } from './roteador';
import { TODOS, GERENCIA, ADMIN, ErroDemo, agoraMenos, uuid, paginar, exigirMotivo, hojeFortaleza, instante, dia } from './roteador';
import type {
  AutorMensagem, ConversaDetalhe, MensagemPainel, EstadoConversa, CadastroContato, ReservaContato, FichaContato, TemplateWhatsapp,
  Campanha, CampanhaDetalhe, DestinatarioCampanha, ItemConhecimento, GrupoDuplicidade, MembroLista, MembroFicha, VendaClube, ConviteClube,
  EventoAtendimento, StatusEvento, TipoEvento, CanalEvento, CardapioItem, CardapioPdf,
} from '../../lib/tipos/atendimento-clube';
import { usuarioDemo } from './sessao';
import { NOMES_DEMO, telefoneDemo, reservasDosClientes, AMBIENTES } from './reservas';
import type { Papel } from '../../lib/sessao';

// Atendimento -----------------------------------------------------------------------------------------------------------
const JANELA_MS = 24 * 3600_000;
const CONFIGURACAO = { assistente_ativo: true, envio_configurado: true, followup_ativo: true };
/** Números de teste do servidor fictício (campanha de teste só sai para eles). */
const NUMEROS_TESTE = ['+5585991230001', '+5585991230003'];
/** Na demonstração, número terminado em 9999 "não tem WhatsApp": o envio volta com falha (para ver o erro na tela). */
const falhaDemo = (tel: string) => tel.endsWith('9999');
const ERRO_DEMO = 'Número sem WhatsApp ativo (131026) — demonstração';

const TEMPLATES: TemplateWhatsapp[] = [
  { nome: 'boas_vindas_ambar', idioma: 'pt_BR', categoria: 'utilidade', parametros: ['Nome'], texto: 'Olá, {{1}}! Aqui é o Âmbar Café. Podemos ajudar com a sua reserva ou com alguma dúvida?' },
  { nome: 'novidades_brunch', idioma: 'pt_BR', categoria: 'marketing', parametros: ['Nome', 'Novidade'], texto: 'Oi, {{1}}! Novidade no Âmbar: {{2}}. Para não receber mais, responda PARAR.' },
];
const previa = (t: TemplateWhatsapp, p: string[]) => t.texto.replace(/\{\{(\d+)\}\}/g, (x, n: string) => p[Number(n) - 1] ?? x);

let seqMsg = 1000;
function msg(direcao: 'entrada' | 'saida', autor: AutorMensagem, texto: string | null, minutos: number, extra: Partial<MensagemPainel> = {}): MensagemPainel {
  const quando = agoraMenos(minutos);
  const saida = direcao === 'saida';
  return {
    id: seqMsg++, direcao, autor, usuario_nome: null, tipo: 'texto', texto, transcricao: null, tem_midia: false, midia_mime: null, midia_nome: null,
    template_nome: null, campanha_id: null, followup: false, responde_a: null, status: saida ? 'lida' : 'recebida', erro: null, intencao: null,
    criado_em: quando, enviada_em: saida ? quando : null, entregue_em: saida ? quando : null, lida_em: saida ? quando : null, ...extra,
  };
}

// Cadastros fictícios (o "cadastro único" do backend): só para a ficha do contato, a busca da nova conversa e as duplicidades.
interface CadastroDemo extends Omit<CadastroContato, 'principal_id' | 'reservas'> {
  telefone_e164: string | null;
  /** Posição em NOMES_DEMO: liga às reservas fictícias do módulo Reservas. */
  reservasDe?: number;
  consentimentos?: FichaContato['consentimentos'];
}
const cad = (i: number, nome: string, tel: string | null, email: string | null, extra: Partial<CadastroDemo> = {}): CadastroDemo => ({
  id: `c1000000-0000-4000-8000-${String(i).padStart(12, '0')}`, nome, email, origem: 'site', origem_detalhe: null, legado: null, giardini: false,
  telefone_verificado: false, criado_em: agoraMenos(60 * 24 * (90 - i * 7)), telefone_e164: tel, ...extra,
});
const CADASTROS: CadastroDemo[] = [
  cad(1, NOMES_DEMO[0], telefoneDemo(0), 'mariana@exemplo.invalid', { reservasDe: 0, telefone_verificado: true, consentimentos: { privacidade_reserva: { situacao: 'concedido', canal: 'site', em: agoraMenos(60 * 24 * 40) }, marketing_whatsapp: { situacao: 'concedido', canal: 'site', em: agoraMenos(60 * 24 * 40) } } }),
  cad(2, 'Renata Holanda', '+5585991230001', 'renata.h@exemplo.invalid', { origem: 'importacao', legado: 'giardini_2024', giardini: true, consentimentos: { whatsapp_operacional: { situacao: 'concedido', canal: 'importacao', em: agoraMenos(60 * 24 * 300) } } }),
  cad(3, 'Paula Ximenes', '+5585991230003', null, { origem: 'whatsapp' }),
  cad(4, 'Carlos Teixeira', '+5585991230007', 'carlos.t@exemplo.invalid', { origem: 'balcao' }),
  cad(5, 'Carla Teixeira', '+5585991230007', null, { origem: 'site' }),
  cad(6, NOMES_DEMO[1], telefoneDemo(1), null, { reservasDe: 1 }),
  cad(7, NOMES_DEMO[2], telefoneDemo(2), 'camila.f@exemplo.invalid', { reservasDe: 2, origem: 'instagram' }),
  cad(8, 'Helena Cordeiro', '+5585998811111', 'helena.c@exemplo.invalid', { origem: 'site' }),
  cad(9, 'Helena  Cordeiro', '+5585998822222', 'Helena.C@exemplo.invalid', { origem: 'importacao', legado: 'giardini_2023', giardini: true }),
];
/** Vínculos cadastro → principal (como clientes_vinculos: nada é apagado nem fundido). */
const vinculos = new Map<string, string>();
const principalDe = (id: string) => vinculos.get(id) ?? id;
const ativosDoTelefone = (tel: string) => CADASTROS.filter((c) => c.telefone_e164 === tel);
/** Como contatos.identificar: telefone verificado único, ou um único principal entre os cadastros do número. */
function identificar(tel: string): string | null {
  const cs = ativosDoTelefone(tel);
  const verificados = cs.filter((c) => c.telefone_verificado);
  if (verificados.length === 1) return verificados[0].id;
  if (verificados.length > 1) return null;
  const principais = new Set(cs.map((c) => principalDe(c.id)));
  return principais.size === 1 ? [...principais][0] : null;
}
const reservasDoCadastro = (c: CadastroDemo) => (c.reservasDe !== undefined ? reservasDosClientes().get(c.reservasDe) ?? [] : []);
const mascarar = (e: string | null) => (e && e.includes('@') ? `${e.split('@')[0].slice(0, 2)}•••@${e.split('@')[1]}` : null);
function cadastroSaida(c: CadastroDemo, papel: Papel): CadastroContato {
  const { telefone_e164, reservasDe, consentimentos, ...resto } = c;
  void telefone_e164; void reservasDe; void consentimentos;
  const principal = principalDe(c.id);
  return { ...resto, email: papel === 'operador' ? mascarar(c.email) : c.email, reservas: reservasDoCadastro(c).length, principal_id: principal !== c.id ? principal : null };
}

interface ConversaDemo extends ConversaDetalhe {
  followup_motivo: string | null;
}
const conversas: ConversaDemo[] = [];

function estadoDe(c: Pick<ConversaDetalhe, 'modo' | 'atendente_id'>): EstadoConversa {
  if (c.modo === 'robo') return 'automatico';
  if (c.modo === 'encerrada') return 'encerrada';
  return c.atendente_id ? 'em_atendimento' : 'esperando';
}
/** Recalcula o que o backend deriva da conversa (estado, última mensagem, não respondidas, janela, cadastro). */
function atualizar(c: ConversaDemo): ConversaDemo {
  const visiveis = c.mensagens.filter((m) => m.status !== 'descartada');
  const ultima = visiveis[visiveis.length - 1];
  const entradas = c.mensagens.filter((m) => m.direcao === 'entrada');
  const ultEntrada = entradas[entradas.length - 1];
  const ultResposta = [...c.mensagens].reverse().find((m) => m.direcao === 'saida' && (m.autor === 'robo' || m.autor === 'equipe') && ['enviada', 'entregue', 'lida'].includes(m.status));
  c.estado = estadoDe(c);
  c.assistente_ligado = c.modo === 'robo';
  c.ultima_entrada_em = ultEntrada?.criado_em ?? null;
  if (ultima) {
    c.ultima_atividade_em = ultima.criado_em;
    c.ultima_mensagem = (ultima.texto ?? ultima.transcricao ?? `[${ultima.tipo}]`).slice(0, 160);
    c.ultima_origem = ultima.autor;
  }
  c.nao_respondidas = entradas.filter((m) => !ultResposta || m.id > ultResposta.id).length;
  c.aguardando_equipe = c.modo === 'humano' && ultima?.direcao === 'entrada';
  c.dentro_da_janela = !!ultEntrada && Date.now() - new Date(ultEntrada.criado_em).getTime() < JANELA_MS;
  c.cliente_id = identificar(c.telefone_e164);
  return c;
}
function novaConversaDemo(tel: string, nome: string | null, modo: ConversaDetalhe['modo'], mensagens: MensagemPainel[] = [], extra: Partial<ConversaDemo> = {}): ConversaDemo {
  const c: ConversaDemo = {
    id: uuid(), telefone_e164: tel, nome_contato: nome, cliente_id: null, modo, estado: 'automatico', assistente_ligado: modo === 'robo', atendente_id: null, atendente_nome: null,
    motivo_humano: null, ultima_entrada_em: null, ultima_atividade_em: new Date().toISOString(), ultima_mensagem: null, ultima_origem: null, nao_respondidas: 0,
    aguardando_equipe: false, inativa: false, dentro_da_janela: false, followup_desligado: false, followup_motivo: null, mensagens, externas: [], ...extra,
  };
  conversas.push(c);
  return atualizar(c);
}
function comAtendente(papel: Papel) {
  const u = usuarioDemo(papel);
  return { atendente_id: u.id, atendente_nome: u.nome };
}

// Uma campanha de teste já concluída (para a gaveta Campanhas e o balão "Campanha" na conversa).
const CAMPANHA_TESTE_ID = 1;
const msgCampanha = (tel: string, minutos: number) => msg('saida', 'campanha', previa(TEMPLATES[0], [tel.endsWith('0001') ? 'Renata' : 'Paula']), minutos, { tipo: 'template', template_nome: TEMPLATES[0].nome, campanha_id: CAMPANHA_TESTE_ID });

novaConversaDemo('+5585991230001', 'Renata Holanda', 'humano', [
  msgCampanha('+5585991230001', 60 * 30),
  msg('entrada', 'cliente', 'Oi! Vocês fazem bolo de aniversário por encomenda?', 42),
  msg('saida', 'robo', 'Olá, Renata! Encomendas são combinadas direto com a nossa equipe. Já avisei o pessoal e alguém responde por aqui em instantes.', 41),
  msg('entrada', 'cliente', 'Seria para sábado, umas 15 pessoas 🎂', 38),
  msg('entrada', 'cliente', null, 37, { tipo: 'imagem', tem_midia: true, midia_mime: 'image/png', midia_nome: 'referencia-bolo.png' }),
  msg('entrada', 'cliente', 'A lista de convidados está aqui', 36),
  msg('entrada', 'cliente', null, 36, { tipo: 'documento', tem_midia: true, midia_mime: 'text/plain', midia_nome: 'lista-de-convidados.txt' }),
], { motivo_humano: 'encomenda' });
novaConversaDemo('+5585991230002', 'Marcos Sales', 'robo', [
  msg('entrada', 'cliente', 'Bom dia, até que horas abre hoje?', 25),
  msg('saida', 'robo', 'Bom dia, Marcos! Hoje estamos abertos das 8h às 14h. Quer reservar uma mesa? É só usar o link: ambarbrunch.com/reservar', 24),
  msg('entrada', 'cliente', 'Perfeito, obrigado', 20),
  msg('saida', 'robo', 'Por nada! Até já ☕', 20),
], { externas: [{ chave: 'reserva:9001', origem: 'reserva', tipo: 'template', rotulo: 'Confirmação da reserva AMB-DEMO1', texto: null, status: 'lida', erro: null, criado_em: agoraMenos(60 * 26) }] });
novaConversaDemo('+5585991230003', 'Paula Ximenes', 'humano', [
  msgCampanha('+5585991230003', 60 * 30),
  msg('entrada', 'cliente', null, 180, { tipo: 'audio', tem_midia: true, midia_mime: 'audio/wav', transcricao: 'Oi, tudo bem? Queria saber se vocês têm opção sem glúten no brunch.' }),
  msg('saida', 'robo', 'Temos algumas opções, mas para restrições alimentares a equipe confirma com a cozinha. Vou chamar alguém.', 179),
  msg('saida', 'equipe', 'Oi Paula! Temos o bowl de frutas e a tapioca, preparados separados. Quer que eu reserve uma mesa?', 170, { usuario_nome: 'Gabriela Gerente (demo)' }),
  msg('entrada', 'cliente', 'Ótimo, vou reservar pelo site', 160),
], { ...comAtendente('gerente'), motivo_humano: 'atendimento_humano' });
novaConversaDemo('+5585991230004', null, 'robo', [
  msg('entrada', 'cliente', 'Vcs aceitam pet no jardim?', 300),
  msg('saida', 'robo', 'Aceitamos pets no Jardim, sim! 🐶', 299, { status: 'falhou', erro: 'Número sem WhatsApp ativo (131026)', entregue_em: null, lida_em: null }),
]);
novaConversaDemo('+5585991230005', 'Tiago Moura', 'encerrada', [
  msg('entrada', 'cliente', 'Consigo mudar minha reserva de amanhã?', 1500),
  msg('saida', 'equipe', 'Consegue sim! Passei para as 10h30.', 1490, { usuario_nome: 'Otávio Operação (demo)' }),
  msg('entrada', 'cliente', 'Valeu!', 1485),
]);
novaConversaDemo(telefoneDemo(0), NOMES_DEMO[0], 'robo', [
  msg('entrada', 'cliente', 'Oi! Queria confirmar minha reserva de amanhã', 60 * 20),
  msg('saida', 'robo', 'Oi, Mariana! Sua reserva está confirmada. Até amanhã! ☕', 60 * 20 - 1),
  msg('saida', 'automacao', 'Oi, Mariana! Ficou alguma dúvida sobre a sua visita? É só responder por aqui.', 60 * 4, { followup: true }),
  msg('entrada', 'cliente', 'Tudo certo, obrigada!', 60 * 3),
  msg('saida', 'robo', 'Que bom! Até amanhã 😊', 60 * 3 - 1),
], {
  externas: [
    { chave: 'reserva:9002', origem: 'reserva', tipo: 'template', rotulo: 'Confirmação da reserva AMB-DEMO2', texto: null, status: 'entregue', erro: null, criado_em: agoraMenos(60 * 22) },
    { chave: 'evento:9003', origem: 'automacao', tipo: 'texto', rotulo: 'Resposta automática', texto: 'Presença confirmada! Obrigado por avisar 💛', status: 'enviada', erro: null, criado_em: agoraMenos(60 * 19) },
  ],
});
novaConversaDemo('+5585991230007', 'Teixeira', 'humano', [
  msg('entrada', 'cliente', 'Quero reclamar do atendimento de domingo', 12),
  msg('saida', 'robo', 'Sinto muito pelo ocorrido. Vou passar agora para a nossa equipe, que responde por aqui.', 11),
  // documento HTML: a ponte do painel nunca deixa abrir como página (desce como download)
  msg('entrada', 'cliente', null, 10, { tipo: 'documento', tem_midia: true, midia_mime: 'text/html', midia_nome: 'comprovante.html' }),
], { motivo_humano: 'reclamacao' });

// Eventos ---------------------------------------------------------------------------------------------------------------
const TIPOS_EVENTO: Record<TipoEvento, string> = {
  aniversario: 'Aniversário', comemoracao: 'Comemoração', reuniao: 'Reunião', evento_intimista: 'Evento intimista',
  confraternizacao: 'Confraternização', grupo_grande: 'Grupo grande', outro: 'Outro',
};
const STATUS_EVENTO: Record<StatusEvento, string> = {
  novo_interesse: 'Novo interesse', aguardando_contato: 'Aguardando contato', em_negociacao: 'Em negociação',
  proposta_enviada: 'Proposta enviada', fechado: 'Fechado', perdido: 'Perdido',
};
const ABERTOS_EVENTO: StatusEvento[] = ['novo_interesse', 'aguardando_contato', 'em_negociacao', 'proposta_enviada'];
const CANAIS_EVENTO: CanalEvento[] = ['whatsapp', 'instagram', 'site', 'telefone', 'presencial', 'outro'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const EQUIPE_DEMO = (['admin', 'gerente', 'operador'] as Papel[]).map(usuarioDemo);
type OportunidadeDemo = Omit<EventoAtendimento, 'nome_contato' | 'telefone_e164' | 'estado_conversa' | 'tipo_rotulo' | 'ambiente_nome' | 'resumo' | 'faltando' | 'responsavel_nome' | 'status_rotulo' | 'aberta'>;
const oportunidades: OportunidadeDemo[] = [];
let seqOportunidade = 1;
const espacoDemo = (codigo: string | null) => (codigo ? AMBIENTES.find((a) => a.codigo === codigo && a.ativo) ?? null : null);
const faltandoDemo = (o: OportunidadeDemo) => ([['tipo', o.tipo], ['data', o.data_pretendida], ['pessoas', o.convidados], ['horário', o.horario]] as const).filter(([, v]) => !v).map(([r]) => r);
/** Como eventos.resumo do backend: só o que o cliente disse. */
function resumoEvento(o: OportunidadeDemo): string {
  const partes: string[] = [o.tipo ? TIPOS_EVENTO[o.tipo] : 'Evento (tipo a definir)'];
  if (o.data_pretendida) {
    const [a, m, d] = o.data_pretendida.split('-').map(Number);
    partes.push(`${DIAS_CURTOS[new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`);
  }
  if (o.horario) partes.push(o.horario);
  if (o.convidados) partes.push(`~${o.convidados} pessoas`);
  const espaco = espacoDemo(o.ambiente_codigo);
  if (espaco) partes.push(espaco.nome);
  let texto = `${partes.join(' · ')}.`;
  if (o.necessidades) texto += ` Necessidades: ${o.necessidades}.`;
  if (o.observacoes) texto += ` Obs.: ${o.observacoes}.`;
  const falta = faltandoDemo(o);
  if (o.cliente_desistiu_em) texto += ' Cliente disse que desistiu.';
  else if (falta.length) texto += ` Falta: ${falta.join(', ')}.`;
  return texto.replace(/\.\./g, '.').replace(/\s+/g, ' ').slice(0, 600);
}
function eventoSaida(o: OportunidadeDemo): EventoAtendimento {
  const c = conversas.find((x) => x.id === o.conversa_id)!;
  atualizar(c);
  return {
    ...o, nome_contato: c.nome_contato, telefone_e164: c.telefone_e164, estado_conversa: c.estado, tipo_rotulo: o.tipo ? TIPOS_EVENTO[o.tipo] : null,
    ambiente_nome: espacoDemo(o.ambiente_codigo)?.nome ?? null, resumo: resumoEvento(o), faltando: faltandoDemo(o),
    responsavel_nome: EQUIPE_DEMO.find((u) => u.id === o.responsavel_id)?.nome ?? null, status_rotulo: STATUS_EVENTO[o.status], aberta: ABERTOS_EVENTO.includes(o.status),
  };
}
const abertaDaConversa = (conversaId: string) => oportunidades.find((o) => o.conversa_id === conversaId && ABERTOS_EVENTO.includes(o.status));
/** A aberta, senão a mais recente (como eventos.da_conversa). */
function eventoDaConversa(conversaId: string): EventoAtendimento | null {
  const o = abertaDaConversa(conversaId) ?? [...oportunidades].reverse().find((x) => x.conversa_id === conversaId);
  return o ? eventoSaida(o) : null;
}
function rascunhoOportunidade(c: ConversaDemo, origem: OportunidadeDemo['origem'], dados: Partial<OportunidadeDemo> = {}, minutos = 0): OportunidadeDemo {
  const quando = agoraMenos(minutos);
  return {
    id: 0, conversa_id: c.id, cliente_id: c.cliente_id, unidade_id: 1, canal: 'whatsapp', origem, tipo: null, data_pretendida: null,
    horario: null, convidados: null, ambiente_codigo: null, necessidades: null, observacoes: null, responsavel_id: null, status: 'novo_interesse',
    motivo_perda: null, cliente_desistiu_em: null, encaminhada_em: null, concluida_em: null, criado_em: quando, atualizado_em: quando, ...dados,
  };
}
function guardarOportunidade(c: ConversaDemo, o: OportunidadeDemo): OportunidadeDemo {
  o.id = seqOportunidade++;
  oportunidades.push(o);
  c.assunto = 'evento';
  return o;
}
const CAMPOS_EVENTO = ['tipo', 'data_pretendida', 'horario', 'convidados', 'ambiente_codigo', 'necessidades', 'observacoes', 'canal'] as const;
const LIMITES_EVENTO: Record<string, number> = { horario: 80, ambiente_codigo: 40, necessidades: 500, observacoes: 1000, motivo_perda: 300 };
/** Valida como o EventoDados do backend (extra=forbid, limites, ambiente do cadastro) e aplica os campos da equipe. */
function aplicarCamposEvento(o: OportunidadeDemo, e: Record<string, unknown>, extras: string[]) {
  for (const k of Object.keys(e)) if (!([...CAMPOS_EVENTO, ...extras] as string[]).includes(k)) throw new ErroDemo(422, 'validacao', `Campo desconhecido: ${k}.`);
  for (const [k, max] of Object.entries(LIMITES_EVENTO)) if (typeof e[k] === 'string' && (e[k] as string).length > max) throw new ErroDemo(422, 'validacao', `Use no máximo ${max} caracteres.`);
  if (e.tipo != null && !(String(e.tipo) in TIPOS_EVENTO)) throw new ErroDemo(422, 'validacao', 'Tipo de evento inválido.');
  if (e.canal != null && !CANAIS_EVENTO.includes(e.canal as CanalEvento)) throw new ErroDemo(422, 'validacao', 'Canal inválido.');
  if (e.convidados != null && (!Number.isInteger(e.convidados) || (e.convidados as number) < 1 || (e.convidados as number) > 2000)) throw new ErroDemo(422, 'validacao', 'Convidados: de 1 a 2.000.');
  if (e.data_pretendida != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(e.data_pretendida))) throw new ErroDemo(422, 'validacao', 'Data inválida.');
  if (e.ambiente_codigo && !espacoDemo(String(e.ambiente_codigo))) throw new ErroDemo(422, 'ambiente_desconhecido', 'Ambiente desconhecido nesta unidade.');
  const alvo = o as unknown as Record<string, unknown>;
  for (const k of CAMPOS_EVENTO) {
    if (!(k in e)) continue;
    const v = e[k];
    if (k === 'canal' && v == null) continue;
    alvo[k] = typeof v === 'string' ? (k === 'observacoes' ? v.trim() : v.replace(/\s+/g, ' ').trim()) || null : v ?? null;
  }
}

// Conversas com evento: uma encaminhada (aguardando contato), uma ainda com o assistente e uma já fechada.
{
  const data = dia(18);
  const larissa = novaConversaDemo('+5585991230011', 'Larissa Pontes', 'humano', [
    msg('entrada', 'cliente', 'Oi! Vocês fazem aniversário? Queria comemorar meus 30 anos aí', 55),
    msg('saida', 'robo', 'Que legal, Larissa! Fazemos sim. Para quantas pessoas e qual data você pensou?', 54, { intencao: 'evento' }),
    msg('entrada', 'cliente', `Umas 20 pessoas, dia ${data.slice(8, 10)}/${data.slice(5, 7)} às 19h, se der no jardim. Vou levar o bolo`, 50),
    msg('saida', 'robo', 'Vou passar os detalhes do seu evento para a nossa equipe, que continua o atendimento por aqui.', 49, { intencao: 'evento' }),
  ], { motivo_humano: 'evento' });
  guardarOportunidade(larissa, rascunhoOportunidade(larissa, 'assistente', { tipo: 'aniversario', data_pretendida: data, horario: '19h', convidados: 20, ambiente_codigo: 'jardim', necessidades: 'bolo próprio', status: 'aguardando_contato', encaminhada_em: agoraMenos(49) }, 54));
  const bruno = novaConversaDemo('+5585991230012', 'Bruno Arrais', 'robo', [
    msg('entrada', 'cliente', 'Vocês fazem evento intimista? Seria uma reunião da empresa', 15),
    msg('saida', 'robo', 'Fazemos, sim! Quantas pessoas devem participar?', 14, { intencao: 'evento' }),
  ]);
  guardarOportunidade(bruno, rascunhoOportunidade(bruno, 'assistente', { tipo: 'reuniao' }, 14));
  const sofia = novaConversaDemo('+5585991230013', 'Sofia Lins', 'encerrada', [
    msg('entrada', 'cliente', 'Queria fechar a confraternização do escritório', 60 * 24 * 6),
    msg('saida', 'equipe', 'Combinado, Sofia! Está tudo certo para o dia.', 60 * 24 * 5, { usuario_nome: 'Gabriela Gerente (demo)' }),
  ]);
  guardarOportunidade(sofia, rascunhoOportunidade(sofia, 'equipe', { tipo: 'confraternizacao', data_pretendida: dia(-2), horario: 'à tarde', convidados: 18, ambiente_codigo: 'salao', status: 'fechado', responsavel_id: usuarioDemo('gerente').id, encaminhada_em: agoraMenos(60 * 24 * 6), concluida_em: agoraMenos(60 * 24 * 5) }, 60 * 24 * 6));
}

const achar = (id: string) => {
  const c = conversas.find((x) => x.id === id);
  if (!c) throw new ErroDemo(404, 'nao_encontrado', 'Conversa não encontrada.');
  return c;
};
const detalhe = (c: ConversaDemo): ConversaDetalhe => {
  const { followup_motivo, ...d } = atualizar(c);
  void followup_motivo;
  return { ...d, assunto: d.assunto ?? null, evento: eventoDaConversa(c.id) };
};
const resumoConversa = (c: ConversaDemo) => {
  const { mensagens, externas, evento, ...r } = detalhe(c);
  void mensagens; void externas; void evento;
  return r;
};
/** Regra de servico._assumir do backend: com outra pessoa atendendo, só com `transferir` (senão 409). */
function assumirDemo(c: ConversaDemo, papel: Papel, transferir: boolean) {
  const u = usuarioDemo(papel);
  if (c.modo === 'humano' && c.atendente_id === u.id) return;
  if (c.modo === 'humano' && c.atendente_id && !transferir) throw new ErroDemo(409, 'conversa_ja_assumida', 'Outra pessoa da equipe já está atendendo esta conversa.');
  Object.assign(c, { modo: 'humano', atendente_id: u.id, atendente_nome: u.nome });
  // como o backend: o que o robô ia mandar fica descartado
  for (const m of c.mensagens) if (m.autor === 'robo' && m.status === 'pendente') Object.assign(m, { status: 'descartada', erro: 'atendimento_humano' });
}
/** Telefone como o backend normaliza (E.164 do Brasil); inválido = 422 telefone_invalido. */
function normalizar(texto: string): string {
  let d = texto.replace(/\D/g, '');
  if (d.length === 12 || d.length === 13) d = d.startsWith('55') ? d.slice(2) : d;
  if (d.length !== 10 && d.length !== 11) throw new ErroDemo(422, 'telefone_invalido', 'Telefone inválido: informe DDD e número (10 ou 11 dígitos).', { campo: 'telefone' });
  return `+55${d}`;
}
function acharTemplate(nome: string) {
  const t = TEMPLATES.find((x) => x.nome === nome);
  if (!t) throw new ErroDemo(422, 'template_indisponivel', 'Template não está entre os aprovados configurados.');
  return t;
}
function conferirParametros(t: TemplateWhatsapp, p: unknown): string[] {
  const limpos = (Array.isArray(p) ? p : []).map((x) => String(x).trim().slice(0, 200));
  if (limpos.length !== t.parametros.length || limpos.some((x) => !x)) throw new ErroDemo(422, 'parametros_do_template', `O template ${t.nome} pede ${t.parametros.length} parâmetro(s): ${t.parametros.join(', ') || 'nenhum'}.`);
  return limpos;
}
/** Envio fictício: nada sai; a mensagem só muda de status (falha para os números terminados em 9999). */
function enviarDemo(c: ConversaDemo, m: MensagemPainel) {
  if (falhaDemo(c.telefone_e164)) Object.assign(m, { status: 'falhou', erro: ERRO_DEMO, enviada_em: null, entregue_em: null, lida_em: null });
  else Object.assign(m, { status: 'enviada', enviada_em: m.criado_em, entregue_em: null, lida_em: null });
  c.mensagens.push(m);
}

function fichaContato(c: ConversaDemo, papel: Papel): FichaContato {
  atualizar(c);
  const cadastros = ativosDoTelefone(c.telefone_e164);
  const hoje = hojeFortaleza();
  const reservas: ReservaContato[] = cadastros.flatMap(reservasDoCadastro).map((r) => ({ id: r.id, codigo: r.codigo, data: r.data, hora: r.hora.slice(0, 5), pessoas: r.pessoas, ambiente: r.ambiente, status: r.status, giardini: false }));
  const consentimentos = Object.assign({}, ...cadastros.map((x) => x.consentimentos ?? {})) as FichaContato['consentimentos'];
  return {
    conversa_id: c.id, telefone_e164: c.telefone_e164, nome_whatsapp: c.nome_contato, cliente_id: c.cliente_id,
    situacao_cadastro: c.cliente_id ? 'vinculado' : cadastros.length ? 'ambiguo' : 'sem_cadastro',
    cadastros: cadastros.map((x) => cadastroSaida(x, papel)),
    cadastros_distintos: new Set(cadastros.map((x) => principalDe(x.id))).size,
    giardini: cadastros.some((x) => x.giardini),
    reservas_futuras: reservas.filter((r) => r.data >= hoje).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora)).slice(0, 10),
    reservas_passadas: reservas.filter((r) => r.data < hoje).sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora)).slice(0, 10),
    reservas_total: reservas.length,
    consentimentos,
    primeira_mensagem_em: c.mensagens[0]?.criado_em ?? null,
    mensagens_recebidas: c.mensagens.filter((m) => m.direcao === 'entrada').length,
    mensagens_enviadas: c.mensagens.filter((m) => m.direcao === 'saida').length,
    followup_desligado: c.followup_desligado,
    followup_motivo: c.followup_motivo,
  };
}

/** Corpo binário da resposta (ArrayBuffer próprio, sem o resto do pool do Buffer). */
const corpoBinario = (b: Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

// Mídia fictícia: uma imagem PNG (degradê nas cores da marca), um áudio WAV curto (tom baixo) e um texto.
function pngDemo(): ArrayBuffer {
  const L = 240, A = 160;
  const bruto = Buffer.alloc((L * 3 + 1) * A);
  for (let y = 0; y < A; y++) {
    const o = y * (L * 3 + 1);
    for (let x = 0; x < L; x++) {
      const t = (x + y) / (L + A);
      bruto[o + 1 + x * 3] = Math.round(246 - 120 * t);
      bruto[o + 2 + x * 3] = Math.round(218 - 150 * t);
      bruto[o + 3 + x * 3] = Math.round(180 - 140 * t);
    }
  }
  const pedaco = (tipo: string, dados: Buffer) => {
    const tam = Buffer.alloc(4);
    tam.writeUInt32BE(dados.length);
    const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(corpo) >>> 0);
    return Buffer.concat([tam, corpo, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(L, 0);
  ihdr.writeUInt32BE(A, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return corpoBinario(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pedaco('IHDR', ihdr), pedaco('IDAT', deflateSync(bruto)), pedaco('IEND', Buffer.alloc(0))]));
}
function wavDemo(): ArrayBuffer {
  const taxa = 8000, n = taxa;
  const b = Buffer.alloc(44 + n);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + n, 4);
  b.write('WAVEfmt ', 8, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(taxa, 24);
  b.writeUInt32LE(taxa, 28);
  b.writeUInt16LE(1, 32);
  b.writeUInt16LE(8, 34);
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(n, 40);
  for (let i = 0; i < n; i++) b[44 + i] = 128 + Math.round(18 * Math.sin((2 * Math.PI * 440 * i) / taxa) * Math.min(1, (n - i) / 800));
  return corpoBinario(b);
}
function midiaDemo(id: number): Response {
  const m = conversas.flatMap((c) => c.mensagens).find((x) => x.id === id);
  if (!m?.tem_midia) throw new ErroDemo(404, 'nao_encontrado', 'Mensagem sem mídia.');
  const [corpo, tipo] =
    m.tipo === 'imagem' || m.tipo === 'figurinha' ? [pngDemo(), 'image/png']
    : m.tipo === 'audio' ? [wavDemo(), 'audio/wav']
    : m.midia_mime === 'text/html' ? [corpoBinario(Buffer.from('<!doctype html><p>Arquivo fictício</p><script>document.title = "executou"</script>', 'utf8')), 'text/html; charset=utf-8']
    : [corpoBinario(Buffer.from('DEMONSTRAÇÃO — arquivo fictício.\nAna, Bruno, Carla, Diego (lista de exemplo)\n', 'utf8')), 'text/plain; charset=utf-8'];
  return new Response(corpo, { headers: { 'Content-Type': tipo, 'Content-Disposition': `inline; filename="midia-${id}"` } });
}

// Campanhas fictícias.
interface CampanhaDemo extends Omit<Campanha, 'destinatarios' | 'entrega' | 'conversas_que_responderam'> {
  lista: (DestinatarioCampanha & { parametros: string[] })[];
}
const campanhas: CampanhaDemo[] = [];
let seqDest = 1;
function bloqueio(c: Pick<CampanhaDemo, 'teste' | 'categoria'>, tel: string, clienteId: string | null): string | null {
  if (c.teste && !NUMEROS_TESTE.includes(tel)) return 'nao_e_numero_de_teste';
  if (conversas.find((x) => x.telefone_e164 === tel)?.followup_motivo === 'pediu_para_parar') return 'pediu_para_parar';
  if (c.categoria === 'marketing' && !c.teste) {
    const k = CADASTROS.find((x) => x.id === clienteId)?.consentimentos?.marketing_whatsapp;
    if (k?.situacao !== 'concedido') return 'sem_consentimento_marketing';
  }
  return null;
}
function resumoCampanha(c: CampanhaDemo, comLista = false): CampanhaDetalhe | Campanha {
  const conta = <K extends string>(chaves: readonly K[], valores: string[]) => Object.fromEntries(chaves.map((k) => [k, valores.filter((v) => v === k).length])) as Record<K, number>;
  const msgs = conversas.flatMap((x) => x.mensagens).filter((m) => m.campanha_id === c.id);
  const inicio = c.iniciada_em ?? c.criada_em;
  const responderam = new Set(c.lista.filter((d) => d.conversa_id && conversas.find((x) => x.id === d.conversa_id)?.mensagens.some((m) => m.direcao === 'entrada' && m.criado_em >= inicio)).map((d) => d.conversa_id)).size;
  const base: Campanha = {
    id: c.id, nome: c.nome, template_nome: c.template_nome, template_idioma: c.template_idioma, categoria: c.categoria, teste: c.teste, situacao: c.situacao,
    criada_em: c.criada_em, iniciada_em: c.iniciada_em, concluida_em: c.concluida_em,
    destinatarios: conta(['pendente', 'enviada', 'falhou', 'bloqueada', 'cancelada'] as const, c.lista.map((d) => d.situacao)),
    entrega: conta(['pendente', 'enviada', 'entregue', 'lida', 'falhou'] as const, msgs.map((m) => m.status)),
    conversas_que_responderam: responderam,
  };
  return comLista ? { ...base, lista: c.lista.map(({ parametros, ...d }) => { void parametros; return d; }) } : base;
}
const acharCampanha = (id: number) => {
  const c = campanhas.find((x) => x.id === id);
  if (!c) throw new ErroDemo(404, 'nao_encontrado', 'Campanha não encontrada.');
  return c;
};
{
  // a campanha de teste concluída de antes (as mensagens dela estão nas conversas de Renata e Paula)
  const quando = agoraMenos(60 * 30 + 2);
  const lista = ['+5585991230001', '+5585991230003', '+5585991230002'].map((tel) => {
    const conversa = conversas.find((x) => x.telefone_e164 === tel)!;
    const m = conversa.mensagens.find((x) => x.campanha_id === CAMPANHA_TESTE_ID);
    return { id: seqDest++, telefone_e164: tel, cliente_id: conversa.cliente_id, situacao: (m ? 'enviada' : 'bloqueada') as DestinatarioCampanha['situacao'], motivo: m ? null : 'nao_e_numero_de_teste', conversa_id: m ? conversa.id : null, mensagem_id: m?.id ?? null, parametros: ['Cliente'] };
  });
  campanhas.push({ id: CAMPANHA_TESTE_ID, nome: 'Teste do template de boas-vindas', template_nome: TEMPLATES[0].nome, template_idioma: 'pt_BR', categoria: 'utilidade', teste: true, situacao: 'concluida', criada_em: quando, iniciada_em: quando, concluida_em: quando, lista });
}

// Cardápio (amostra do catálogo oficial de 3/11/2026) e capacidades oficiais dos ambientes.
const ITEM_DEMO = (chave: string, tipo: 'produto' | 'adicional', categoria: string, nome: string, reais: number, descricao: string | null, categoria_observacao: string | null = null): CardapioItem => ({
  chave, tipo, categoria, categoria_observacao, nome, preco_centavos: reais * 100, preco: `R$ ${reais}`, descricao, versao: '2026-11-03.1',
  fonte: 'Cardápio oficial provisório (PDF de 3 páginas) e duas imagens fornecidas pelo proprietário em 03/11/2026', atualizado_em: '2026-11-03T23:00:00Z',
});
const CARDAPIO_DEMO: CardapioItem[] = [
  ITEM_DEMO('croissants.classico', 'produto', 'Croissants', 'Clássico', 16, 'Massa folhada e amanteigada.'),
  ITEM_DEMO('croissants.brie_e_geleia', 'produto', 'Croissants', 'Brie e geleia', 30, 'Queijo brie e geleia artesanal.'),
  ITEM_DEMO('brunches.american_brunch', 'produto', 'Brunches', 'American Brunch', 40, 'Ovos mexidos cremosos, bacon crocante, pão de fermentação natural e maple syrup.', 'Pratos completos, servidos o dia todo.'),
  ITEM_DEMO('cafes.cappuccino', 'produto', 'Cafés', 'Cappuccino', 14, null),
  ITEM_DEMO('cafes_gelados.cinnamon_latte', 'produto', 'Cafés gelados', 'Cinnamon Latte', 26, 'Café, leite, caramelo e mini cinnamon roll.'),
  ITEM_DEMO('personalize_seu_pao.sem_gluten', 'adicional', 'Personalize seu pão', 'Sem glúten', 6, null, 'No cardápio, fica no quadro dos Brunches.'),
];
const PDF_DEMO: CardapioPdf = {
  id: 1, versao: '2026-11-03.1', nome_arquivo: 'Cardapio-Ambar-Cafe.pdf', tamanho: 2163951, paginas: 3,
  sha256: 'a66e4c7030f270d198c12da25be70fe5b2565c7fb59484de6cff710dd864e34e', fonte: 'Cardápio oficial provisório autorizado pelo proprietário',
  vigente: true, criado_por: 'sistema:cli', criado_em: '2026-11-03T23:00:00Z', midia_meta: { enviada_em: null, valida: false },
};
const CAPACIDADES_OFICIAIS = [
  { codigo: 'jardim', nome: 'Jardim externo', capacidade: 20, descricao: 'ao ar livre; é o ÚNICO espaço pet friendly' },
  { codigo: 'salao', nome: 'Salão principal', capacidade: 30, descricao: 'fechado, com ar-condicionado e tomadas' },
  { codigo: 'lounge', nome: 'Lounge', capacidade: 15, descricao: 'reservado, com sofás' },
  { codigo: 'privativa', nome: 'Sala privativa', capacidade: 20, descricao: 'no piso superior, com ar-condicionado e piano' },
];

// Base de conhecimento fictícia.
const TEMAS_SUGERIDOS: Record<string, string> = {
  animais: 'Animais de estimação', criancas: 'Crianças', acessibilidade: 'Acessibilidade', estacionamento: 'Estacionamento', wifi: 'Wi-Fi',
  notebook: 'Trabalhar com notebook', regras_espaco: 'Regras do espaço', eventos: 'Eventos', sala_privativa: 'Sala privativa',
  aniversarios: 'Aniversários', restricoes: 'Restrições alimentares (política geral)', pagamento: 'Formas de pagamento',
};
const conhecimento: ItemConhecimento[] = [
  { chave: 'animais', tema: 'Animais de estimação', conteudo: 'Pets são bem-vindos no Jardim, com coleira. No salão, só cães-guia.', fonte: 'Gerência (demonstração)', ativo: true, atualizado_por: 'usuario:demo', atualizado_em: agoraMenos(60 * 24 * 3) },
  { chave: 'wifi', tema: 'Wi-Fi', conteudo: 'Temos Wi-Fi gratuito; a senha fica no cardápio da mesa.', fonte: 'Gerência (demonstração)', ativo: false, atualizado_por: 'usuario:demo', atualizado_em: agoraMenos(60 * 24 * 9) },
];

const nomeNormal = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).join(' ');
function duplicidades(papel: Papel) {
  const grupos: GrupoDuplicidade[] = [];
  for (const [por, valorDe] of [['telefone', (c: CadastroDemo) => c.telefone_e164], ['email', (c: CadastroDemo) => c.email?.toLowerCase() ?? null]] as const) {
    const porValor = new Map<string, CadastroDemo[]>();
    for (const c of CADASTROS) {
      const v = valorDe(c);
      if (v) porValor.set(v, [...(porValor.get(v) ?? []), c]);
    }
    for (const [valor, cs] of porValor) {
      if (cs.length < 2) continue;
      const principais = new Set(cs.map((c) => principalDe(c.id)));
      const nomes = new Set(cs.map((c) => nomeNormal(c.nome)));
      grupos.push({ por, valor: por === 'telefone' ? valor : mascarar(valor)!, classificacao: principais.size === 1 ? 'resolvido' : nomes.size === 1 ? 'provavel_mesma_pessoa' : 'ambiguo', cadastros: cs.map((c) => cadastroSaida(c, papel)) });
    }
  }
  const resumo = { provavel_mesma_pessoa: 0, ambiguo: 0, resolvido: 0 };
  for (const g of grupos) resumo[g.classificacao]++;
  return { grupos, resumo, total_cadastros: CADASTROS.length };
}

const ROTAS_ATENDIMENTO: Rota[] = [
  ['GET', /^atendimento\/resumo$/, TODOS, () => {
    conversas.forEach(atualizar);
    const conta = (e: EstadoConversa) => conversas.filter((c) => c.estado === e).length;
    return {
      por_modo: { robo: conversas.filter((c) => c.modo === 'robo').length, humano: conversas.filter((c) => c.modo === 'humano').length, encerrada: conversas.filter((c) => c.modo === 'encerrada').length },
      por_estado: { automatico: conta('automatico'), esperando: conta('esperando'), em_atendimento: conta('em_atendimento'), encerrada: conta('encerrada') },
      aguardando_equipe: conversas.filter((c) => c.aguardando_equipe).length,
      inativas: 0,
      falhas_de_envio_24h: conversas.flatMap((c) => c.mensagens).filter((m) => m.direcao === 'saida' && m.status === 'falhou').length,
      configuracao: { ...CONFIGURACAO, templates: TEMPLATES.length, cardapio_pdf_vigente: true, cardapio_itens: CARDAPIO_DEMO.length },
      eventos: Object.fromEntries(ABERTOS_EVENTO.map((s) => [s, oportunidades.filter((o) => o.status === s).length])),
    };
  }],
  ['GET', /^atendimento\/falhas$/, TODOS, () => conversas.flatMap((c) => c.mensagens.filter((m) => m.direcao === 'saida' && m.status === 'falhou').map((m) => ({ ...m, conversa_id: c.id, nome_contato: c.nome_contato, telefone_e164: c.telefone_e164 }))).reverse()],
  ['GET', /^atendimento\/conversas$/, TODOS, ({ query }) => {
    const estado = query.get('estado');
    const modo = query.get('modo');
    const assunto = query.get('assunto');
    const busca = query.get('busca')?.toLowerCase();
    if (busca !== undefined && busca.trim().length < 2) throw new ErroDemo(422, 'validacao', 'A busca precisa de pelo menos 2 caracteres.');
    const digitos = busca?.replace(/\D/g, '') ?? '';
    conversas.forEach(atualizar);
    return conversas
      .filter((c) => (!estado || c.estado === estado) && (!modo || c.modo === modo) && (!assunto || c.assunto === assunto) && (!busca || (c.nome_contato ?? '').toLowerCase().includes(busca.trim()) || (digitos.length >= 4 && c.telefone_e164.includes(digitos))))
      .sort((a, b) => Number(b.estado === 'esperando') - Number(a.estado === 'esperando') || b.ultima_atividade_em.localeCompare(a.ultima_atividade_em))
      .map(resumoConversa);
  }],
  ['POST', /^atendimento\/conversas$/, TODOS, async ({ papel, corpo }) => {
    const e = await corpo<{ telefone?: string; cliente_id?: string; nome?: string; template?: string; parametros?: string[]; texto?: string }>();
    let tel: string;
    let nome = e.nome?.trim() || null;
    if (e.cliente_id) {
      const k = CADASTROS.find((x) => x.id === e.cliente_id);
      if (!k?.telefone_e164) throw new ErroDemo(404, 'nao_encontrado', 'Cadastro sem telefone para iniciar conversa.');
      tel = k.telefone_e164;
      nome = nome ?? k.nome;
    } else if (e.telefone) tel = normalizar(e.telefone);
    else throw new ErroDemo(422, 'regra_violada', 'Informe o telefone ou escolha um contato.');
    if (Boolean(e.template) === Boolean(e.texto?.trim())) throw new ErroDemo(422, 'template_ou_texto', 'Escolha um template OU escreva um texto.');
    const t = e.template ? acharTemplate(e.template) : null;
    const params = t ? conferirParametros(t, e.parametros) : [];
    const c = conversas.find((x) => x.telefone_e164 === tel) ?? novaConversaDemo(tel, nome, 'encerrada');
    if (nome && !c.nome_contato) c.nome_contato = nome;
    assumirDemo(c, papel, false);
    const u = usuarioDemo(papel);
    if (!t && !atualizar(c).dentro_da_janela) throw new ErroDemo(409, 'fora_da_janela_24h', 'Fora da janela de 24 h do cliente a Meta só aceita template aprovado.');
    // DEMONSTRAÇÃO: nada é enviado — a mensagem só entra na conversa local.
    enviarDemo(c, msg('saida', 'equipe', t ? previa(t, params) : e.texto!.trim().slice(0, 2000), 0, { usuario_nome: u.nome, ...(t ? { tipo: 'template' as const, template_nome: t.nome } : {}) }));
    return detalhe(c);
  }],
  ['GET', /^atendimento\/conversas\/([0-9a-f-]{36})\/mensagens$/, TODOS, () => []],
  ['GET', /^atendimento\/conversas\/([0-9a-f-]{36})\/contato$/, TODOS, ({ params, papel }) => fichaContato(achar(params[0]), papel)],
  ['GET', /^atendimento\/conversas\/([0-9a-f-]{36})$/, TODOS, ({ params }) => detalhe(achar(params[0]))],
  ['GET', /^atendimento\/mensagens\/(\d+)\/midia$/, TODOS, ({ params }) => midiaDemo(Number(params[0]))],
  ['POST', /^atendimento\/conversas\/([0-9a-f-]{36})\/assumir$/, TODOS, async ({ params, papel, corpo }) => {
    const c = achar(params[0]);
    assumirDemo(c, papel, Boolean((await corpo<{ transferir?: boolean } | null>())?.transferir));
    return detalhe(c);
  }],
  ['POST', /^atendimento\/conversas\/([0-9a-f-]{36})\/responder$/, TODOS, async ({ params, papel, corpo }) => {
    const c = achar(params[0]);
    const { texto } = await corpo<{ texto: string }>();
    if (!texto?.trim()) throw new ErroDemo(422, 'regra_violada', 'Escreva a resposta.');
    // como o backend: responder desliga o assistente e assume ANTES de conferir a janela de 24 h
    assumirDemo(c, papel, false);
    if (!atualizar(c).dentro_da_janela) throw new ErroDemo(409, 'fora_da_janela_24h', 'Passaram 24 h da última mensagem do cliente: a Meta só aceita template. Fale com o cliente por telefone.');
    enviarDemo(c, msg('saida', 'equipe', texto.trim().slice(0, 2000), 0, { usuario_nome: usuarioDemo(papel).nome }));
    return detalhe(c);
  }],
  ['POST', /^atendimento\/conversas\/([0-9a-f-]{36})\/assistente$/, TODOS, async ({ params, corpo }) => {
    const c = achar(params[0]);
    const { ligado } = await corpo<{ ligado: boolean }>();
    if (ligado) {
      if (!CONFIGURACAO.assistente_ativo) throw new ErroDemo(409, 'assistente_desligado', 'O assistente está desligado na configuração.');
      Object.assign(c, { modo: 'robo', atendente_id: null, atendente_nome: null, motivo_humano: null });
    } else Object.assign(c, { modo: 'humano', motivo_humano: 'assistente_desligado_no_painel' });
    return detalhe(c);
  }],
  ['POST', /^atendimento\/conversas\/([0-9a-f-]{36})\/devolver$/, TODOS, ({ params }) => detalhe(Object.assign(achar(params[0]), { modo: 'robo', atendente_id: null, atendente_nome: null, motivo_humano: null }))],
  ['POST', /^atendimento\/conversas\/([0-9a-f-]{36})\/encerrar$/, TODOS, ({ params }) => detalhe(Object.assign(achar(params[0]), { modo: 'encerrada', atendente_id: null, atendente_nome: null, motivo_humano: null }))],
  ['POST', /^atendimento\/conversas\/([0-9a-f-]{36})\/followup$/, TODOS, async ({ params, corpo }) => {
    const c = achar(params[0]);
    const { ligado } = await corpo<{ ligado: boolean }>();
    Object.assign(c, { followup_desligado: !ligado, followup_motivo: ligado ? null : 'desligado_pela_equipe' });
    return detalhe(c);
  }],
  ['GET', /^atendimento\/eventos$/, TODOS, ({ query }) => {
    const status = query.getAll('status');
    const abertas = query.get('abertas');
    const busca = query.get('busca')?.trim().toLowerCase();
    if (busca !== undefined && busca.length < 2) throw new ErroDemo(422, 'validacao', 'A busca precisa de pelo menos 2 caracteres.');
    const digitos = busca?.replace(/\D/g, '') ?? '';
    const responsavel = query.get('responsavel_id');
    const itens = oportunidades.map(eventoSaida)
      .filter((e) => (!status.length || status.includes(e.status)) && (abertas === null || e.aberta === (abertas === 'true')) && (!responsavel || e.responsavel_id === responsavel)
        && (!busca || (e.nome_contato ?? '').toLowerCase().includes(busca) || (digitos.length >= 4 && e.telefone_e164.includes(digitos))))
      .sort((a, b) => Number(b.status === 'aguardando_contato') - Number(a.status === 'aguardando_contato') || b.atualizado_em.localeCompare(a.atualizado_em) || b.id - a.id);
    const limite = Number(query.get('limite') ?? 50), deslocamento = Number(query.get('deslocamento') ?? 0);
    return {
      itens: itens.slice(deslocamento, deslocamento + limite), total: itens.length,
      por_status: Object.fromEntries((Object.keys(STATUS_EVENTO) as StatusEvento[]).map((s) => [s, oportunidades.filter((o) => o.status === s).length])),
    };
  }],
  ['GET', /^atendimento\/eventos\/opcoes$/, TODOS, ({ papel }) => ({
    unidade_id: 1,
    tipos: Object.entries(TIPOS_EVENTO).map(([codigo, rotulo]) => ({ codigo, rotulo })),
    status: Object.entries(STATUS_EVENTO).map(([codigo, rotulo]) => ({ codigo, rotulo, aberto: ABERTOS_EVENTO.includes(codigo as StatusEvento) })),
    canais: CANAIS_EVENTO,
    espacos: AMBIENTES.filter((a) => a.ativo).map((a) => ({ codigo: a.codigo, nome: a.nome, capacidade: a.limites_confirmados_em ? a.capacidade_max : null })),
    responsaveis: EQUIPE_DEMO.map((u) => ({ id: u.id, nome: u.nome })).sort((a, b) => a.nome.localeCompare(b.nome)),
    pode_mudar_status: papel !== 'operador',
  })],
  ['GET', /^atendimento\/eventos\/(\d+)$/, TODOS, ({ params }) => {
    const o = oportunidades.find((x) => x.id === Number(params[0]));
    if (!o) throw new ErroDemo(404, 'nao_encontrado', 'Oportunidade não encontrada.');
    return eventoSaida(o);
  }],
  ['PATCH', /^atendimento\/eventos\/(\d+)$/, TODOS, async ({ params, papel, corpo }) => {
    const e = await corpo<Record<string, unknown>>();
    if (['status', 'responsavel_id', 'motivo_perda'].some((k) => k in e) && papel === 'operador') throw new ErroDemo(403, 'sem_permissao', 'Só a gerência muda o status comercial e o responsável.');
    const o = oportunidades.find((x) => x.id === Number(params[0]));
    if (!o) throw new ErroDemo(404, 'nao_encontrado', 'Oportunidade não encontrada.');
    if (e.status != null && !(String(e.status) in STATUS_EVENTO)) throw new ErroDemo(422, 'validacao', 'Status inválido.');
    if (e.responsavel_id && !EQUIPE_DEMO.some((u) => u.id === e.responsavel_id)) throw new ErroDemo(422, 'responsavel_invalido', 'Responsável precisa ser alguém ativo da equipe desta unidade.');
    const novo = (e.status ?? null) as StatusEvento | null;
    if (novo && novo !== o.status && ABERTOS_EVENTO.includes(novo) && !ABERTOS_EVENTO.includes(o.status) && abertaDaConversa(o.conversa_id)) throw new ErroDemo(409, 'evento_aberto_na_conversa', 'Esta conversa já tem outro evento aberto.');
    aplicarCamposEvento(o, e, ['status', 'responsavel_id', 'motivo_perda']);
    if ('responsavel_id' in e) o.responsavel_id = (e.responsavel_id as string | null) ?? null;
    if ('motivo_perda' in e) o.motivo_perda = String(e.motivo_perda ?? '').trim() || null;
    if (novo && novo !== o.status) {
      o.status = novo;
      o.concluida_em = novo === 'fechado' || novo === 'perdido' ? new Date().toISOString() : null;
      if (novo !== 'novo_interesse' && !o.encaminhada_em) o.encaminhada_em = new Date().toISOString();
      if (novo !== 'perdido' && !('motivo_perda' in e)) o.motivo_perda = null;
    }
    o.atualizado_em = new Date().toISOString();
    if (ABERTOS_EVENTO.includes(o.status)) achar(o.conversa_id).assunto = 'evento';
    return eventoSaida(o);
  }],
  ['POST', /^atendimento\/conversas\/([0-9a-f-]{36})\/evento$/, TODOS, async ({ params, papel, corpo }) => {
    const c = achar(params[0]);
    const existente = abertaDaConversa(c.id);
    if (existente) throw new ErroDemo(409, 'evento_aberto_na_conversa', `Esta conversa já tem um evento aberto (#${existente.id}).`, { oportunidade_id: existente.id });
    const e = (await corpo<Record<string, unknown> | null>()) ?? {};
    const o = rascunhoOportunidade(c, 'equipe');
    aplicarCamposEvento(o, e, ['responsavel_id']);
    // como o backend: o Atendente pode mandar responsavel_id, mas só a gerência define (o resto é ignorado)
    if (e.responsavel_id && papel !== 'operador') o.responsavel_id = String(e.responsavel_id);
    return eventoSaida(guardarOportunidade(c, o));
  }],
  ['GET', /^atendimento\/templates$/, TODOS, () => TEMPLATES],
  ['GET', /^atendimento\/contatos$/, TODOS, ({ query }) => {
    const busca = (query.get('busca') ?? '').trim();
    if (busca.length < 2) throw new ErroDemo(422, 'validacao', 'A busca precisa de pelo menos 2 caracteres.');
    const digitos = busca.replace(/\D/g, '');
    const vistos = new Set<string>();
    return CADASTROS.filter((c) => c.telefone_e164 && (nomeNormal(c.nome).includes(nomeNormal(busca)) || (digitos.length >= 4 && c.telefone_e164.includes(digitos))))
      .filter((c) => !vistos.has(c.telefone_e164!) && vistos.add(c.telefone_e164!))
      .slice(0, 10)
      .map((c) => ({ cliente_id: c.id, nome: c.nome, telefone_e164: c.telefone_e164!, origem: c.origem, giardini: c.giardini, conversa_id: conversas.find((x) => x.telefone_e164 === c.telefone_e164)?.id ?? null }));
  }],

  ['GET', /^atendimento\/campanhas$/, GERENCIA, () => [...campanhas].reverse().map((c) => resumoCampanha(c))],
  ['GET', /^atendimento\/campanhas\/(\d+)$/, GERENCIA, ({ params }) => resumoCampanha(acharCampanha(Number(params[0])), true)],
  ['POST', /^atendimento\/campanhas$/, GERENCIA, async ({ corpo }) => {
    const e = await corpo<{ nome?: string; template?: string; teste?: boolean; destinatarios?: { telefone?: string; cliente_id?: string; parametros?: string[] }[] }>();
    if (!e.nome || e.nome.trim().length < 2) throw new ErroDemo(422, 'regra_violada', 'Dê um nome à campanha.');
    const t = acharTemplate(String(e.template ?? ''));
    const lista = e.destinatarios ?? [];
    if (!lista.length || lista.length > 500) throw new ErroDemo(422, 'regra_violada', 'A campanha precisa de 1 a 500 destinatários.');
    const nova: CampanhaDemo = { id: campanhas.length + 1, nome: e.nome.trim().slice(0, 120), template_nome: t.nome, template_idioma: t.idioma, categoria: t.categoria, teste: e.teste !== false, situacao: 'rascunho', criada_em: new Date().toISOString(), iniciada_em: null, concluida_em: null, lista: [] };
    const vistos = new Set<string>();
    for (const d of lista) {
      const k = d.cliente_id ? CADASTROS.find((x) => x.id === d.cliente_id) : null;
      const tel = k?.telefone_e164 ?? normalizar(String(d.telefone ?? ''));
      if (vistos.has(tel)) continue;
      vistos.add(tel);
      const parametros = conferirParametros(t, d.parametros);
      const clienteId = k?.id ?? identificar(tel);
      const motivo = bloqueio(nova, tel, clienteId);
      nova.lista.push({ id: seqDest++, telefone_e164: tel, cliente_id: clienteId, situacao: motivo ? 'bloqueada' : 'pendente', motivo, conversa_id: null, mensagem_id: null, parametros });
    }
    campanhas.push(nova);
    return resumoCampanha(nova, true);
  }],
  ['POST', /^atendimento\/campanhas\/(\d+)\/enviar$/, GERENCIA, ({ params }) => {
    const c = acharCampanha(Number(params[0]));
    if (c.situacao === 'concluida' || c.situacao === 'cancelada') throw new ErroDemo(409, 'campanha_fechada', `A campanha está ${c.situacao}.`);
    const t = acharTemplate(c.template_nome);
    if (c.situacao === 'rascunho') Object.assign(c, { situacao: 'enviando', iniciada_em: new Date().toISOString() });
    // lotes de 3 na demonstração (no backend, AMBAR_ATENDIMENTO_CAMPANHA_LOTE)
    for (const d of c.lista.filter((x) => x.situacao === 'pendente').slice(0, 3)) {
      const motivo = bloqueio(c, d.telefone_e164, d.cliente_id);
      if (motivo) {
        Object.assign(d, { situacao: 'bloqueada', motivo });
        continue;
      }
      // conversa nova só por causa da campanha nasce encerrada (reabre quando o cliente responder)
      const conversa = conversas.find((x) => x.telefone_e164 === d.telefone_e164) ?? novaConversaDemo(d.telefone_e164, null, 'encerrada');
      const m = msg('saida', 'campanha', previa(t, d.parametros), 0, { tipo: 'template', template_nome: t.nome, campanha_id: c.id });
      enviarDemo(conversa, m);
      atualizar(conversa);
      Object.assign(d, { conversa_id: conversa.id, mensagem_id: m.id, situacao: m.status === 'falhou' ? 'falhou' : 'enviada', motivo: m.status === 'falhou' ? m.erro : null });
    }
    if (!c.lista.some((x) => x.situacao === 'pendente')) Object.assign(c, { situacao: 'concluida', concluida_em: new Date().toISOString() });
    return resumoCampanha(c);
  }],
  ['POST', /^atendimento\/campanhas\/(\d+)\/cancelar$/, GERENCIA, ({ params }) => {
    const c = acharCampanha(Number(params[0]));
    if (c.situacao !== 'concluida' && c.situacao !== 'cancelada') {
      c.situacao = 'cancelada';
      for (const d of c.lista) if (d.situacao === 'pendente' && !d.mensagem_id) Object.assign(d, { situacao: 'cancelada', motivo: 'campanha_cancelada' });
    }
    return resumoCampanha(c);
  }],

  ['GET', /^atendimento\/conhecimento$/, TODOS, () => ({
    itens: [...conhecimento].sort((a, b) => a.tema.localeCompare(b.tema)),
    sugestoes: Object.entries(TEMAS_SUGERIDOS).filter(([k]) => !conhecimento.some((i) => i.chave === k)).map(([chave, tema]) => ({ chave, tema })),
  })],
  ['PUT', /^atendimento\/conhecimento\/([^/]+)$/, GERENCIA, async ({ params, corpo }) => {
    const chave = decodeURIComponent(params[0]).trim().toLowerCase();
    if (!/^[a-z0-9_]{2,40}$/.test(chave)) throw new ErroDemo(422, 'regra_violada', 'Chave: 2 a 40 letras minúsculas, números ou _.');
    const e = await corpo<{ tema?: string; conteudo?: string; fonte?: string; ativo?: boolean }>();
    const tema = (e.tema ?? '').trim(), conteudo = (e.conteudo ?? '').trim(), fonte = (e.fonte ?? '').trim();
    if (tema.length < 2 || tema.length > 80 || conteudo.length < 2 || conteudo.length > 800 || fonte.length < 2 || fonte.length > 200) throw new ErroDemo(422, 'regra_violada', 'Tema (até 80), conteúdo (até 800) e fonte (até 200) são obrigatórios.');
    const item: ItemConhecimento = { chave, tema, conteudo, fonte, ativo: e.ativo !== false, atualizado_por: 'usuario:demo', atualizado_em: new Date().toISOString() };
    const i = conhecimento.findIndex((x) => x.chave === chave);
    if (i >= 0) conhecimento[i] = item;
    else conhecimento.push(item);
    return item;
  }],
  ['DELETE', /^atendimento\/conhecimento\/([^/]+)$/, GERENCIA, ({ params }) => {
    const item = conhecimento.find((x) => x.chave === decodeURIComponent(params[0]));
    if (!item) throw new ErroDemo(404, 'nao_encontrado', 'Item não encontrado.');
    Object.assign(item, { ativo: false, atualizado_em: new Date().toISOString() });
    return item;
  }],

  ['GET', /^atendimento\/cardapio$/, TODOS, ({ query }) => {
    const sem = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    const termo = sem(query.get('busca') ?? '').trim();
    return {
      pdf: PDF_DEMO, versoes: [PDF_DEMO],
      itens: CARDAPIO_DEMO.filter((i) => !termo || sem(`${i.categoria} ${i.nome} ${i.descricao ?? ''}`).includes(termo)),
    };
  }],
  ['POST', /^atendimento\/cardapio\/pdf$/, GERENCIA, () => {
    throw new ErroDemo(422, 'regra_violada', 'Na demonstração o PDF não é trocado.');
  }],
  ['GET', /^atendimento\/capacidades$/, TODOS, () => ({
    oficiais: CAPACIDADES_OFICIAIS,
    conferencia: CAPACIDADES_OFICIAIS.map((o) => ({ ambiente: o.nome, oficial: o.capacidade, cadastro: { codigo: o.codigo, nome: o.nome, capacidade: o.capacidade, confirmado: true }, situacao: 'ok' as const })),
    tudo_certo: true,
  })],

  ['GET', /^atendimento\/duplicidades$/, GERENCIA, ({ papel }) => duplicidades(papel)],
  ['POST', /^atendimento\/vinculos$/, GERENCIA, async ({ corpo }) => {
    const e = await corpo<{ cliente_id?: string; principal_id?: string; motivo?: string }>();
    const cliente = CADASTROS.find((x) => x.id === e.cliente_id);
    const principal = CADASTROS.find((x) => x.id === e.principal_id);
    if (!cliente || !principal) throw new ErroDemo(404, 'nao_encontrado', 'Cadastro não encontrado.');
    if ((e.motivo ?? '').trim().length < 3) throw new ErroDemo(422, 'regra_violada', 'Informe o motivo (pelo menos 3 caracteres).');
    if (cliente.id === principal.id) throw new ErroDemo(422, 'regra_violada', 'Escolha dois cadastros diferentes.');
    const evidencia = (cliente.telefone_e164 && cliente.telefone_e164 === principal.telefone_e164) || (cliente.email && principal.email && cliente.email.toLowerCase() === principal.email.toLowerCase());
    if (!evidencia) throw new ErroDemo(422, 'sem_evidencia', 'Só cadastros com o mesmo telefone ou o mesmo e-mail podem ser ligados.');
    if (principalDe(principal.id) !== principal.id) throw new ErroDemo(422, 'principal_vinculado', 'O principal escolhido já está ligado a outro cadastro.');
    if ([...vinculos.values()].includes(cliente.id)) throw new ErroDemo(422, 'cadastro_e_principal', 'Este cadastro é principal de outros; desfaça esses vínculos antes.');
    const atual = vinculos.get(cliente.id);
    if (atual && atual !== principal.id) throw new ErroDemo(422, 'ja_vinculado', 'Este cadastro já está ligado a outro principal.');
    vinculos.set(cliente.id, principal.id);
    conversas.forEach(atualizar);
    return { id: vinculos.size, cliente_id: cliente.id, principal_id: principal.id, ativo: true };
  }],
];

// Clube -----------------------------------------------------------------------------------------------------------------
const membros: (MembroLista & { email: string | null; telefoneInteiro: string })[] = [
  ['Helena Cordeiro', 'ativo', 'site', '1111'], ['Otávio Lins', 'ativo', 'convite_caixa', '2222'], ['Sofia Macedo', 'pendente', 'site', '3333'],
  ['Arthur Fernandes', 'ativo', 'convite_caixa', '4444'], ['Lívia Bastos', 'suspenso', 'site', '5555'], ['Caio Rolim', 'ativo', 'site', '6666'],
].map(([nome, estado, origem, fim], i) => ({
  cliente_id: `c0000000-0000-4000-8000-00000000000${i + 1}`, nome, telefone: `(85) •••••-${fim}`, telefoneInteiro: `+55859988${fim}`.padEnd(14, '0'), email: null,
  estado: estado as MembroLista['estado'], origem, cadastro_iniciado_em: agoraMenos(60 * 24 * (20 - i)), ativado_em: estado === 'pendente' ? null : agoraMenos(60 * 24 * (19 - i)),
  suspenso_em: estado === 'suspenso' ? agoraMenos(60 * 24 * 2) : null, marketing_autorizado: i % 2 === 0, mensagens_autorizadas: true,
}));

const vendas: VendaClube[] = [
  { id: uuid(), eye_transaction_id: '880001', data_hora: instante(hojeFortaleza(), '09:42'), total: '87.50', comanda: '14', loja: 'Âmbar', unidade_id: 1, cancelada: false, telefone: '(85) •••••-9012', telefone_situacao: 'normalizado', telefone_motivo: null, aviso: null, cliente: null, vinculo: null, candidato_membro: false, convite: { pode: true, motivo: null } },
  { id: uuid(), eye_transaction_id: '880002', data_hora: instante(hojeFortaleza(), '10:15'), total: '142.00', comanda: '22', loja: 'Âmbar', unidade_id: 1, cancelada: false, telefone: '(85) ••••-4444', telefone_situacao: 'correcao_provavel', telefone_motivo: 'nono_digito_ausente', aviso: 'CONFERIR TELEFONE', cliente: null, vinculo: null, candidato_membro: true, convite: { pode: false, motivo: 'conferir_telefone' } },
  { id: uuid(), eye_transaction_id: '880003', data_hora: instante(hojeFortaleza(), '11:03'), total: '64.90', comanda: '31', loja: 'Âmbar', unidade_id: 1, cancelada: false, telefone: '(85) •••••-1111', telefone_situacao: 'normalizado', telefone_motivo: null, aviso: null, cliente: { id: membros[0].cliente_id, nome: 'Helena Cordeiro', estado_membro: 'ativo' }, vinculo: 'telefone', candidato_membro: false, convite: { pode: false, motivo: 'ja_membro' } },
];
const convites: ConviteClube[] = [
  { id: uuid(), telefone: '(85) •••••-7788', origem: 'painel', criado_em: agoraMenos(300), criado_por: 'Otávio Operação (demo)', unidade_id: 1, expira_em: agoraMenos(-60 * 24 * 6), aberto_em: null, usado_em: null, situacao: 'aguardando', mensagem: { status: 'entregue', tentativas: 1, enviada_em: agoraMenos(299), erro: null, motivo: null } },
  { id: uuid(), telefone: '(85) •••••-2222', origem: 'venda', criado_em: agoraMenos(60 * 24 * 3), criado_por: 'Gabriela Gerente (demo)', unidade_id: 1, expira_em: agoraMenos(60 * 24 * -4), aberto_em: agoraMenos(60 * 24 * 3 - 30), usado_em: agoraMenos(60 * 24 * 3 - 25), situacao: 'usado', mensagem: { status: 'lida', tentativas: 1, enviada_em: agoraMenos(60 * 24 * 3), erro: null, motivo: null } },
];

function ficha(id: string): MembroFicha {
  const m = membros.find((x) => x.cliente_id === id);
  if (!m) throw new ErroDemo(404, 'nao_encontrado', 'Membro não encontrado.');
  return {
    cliente: { id: m.cliente_id, nome: m.nome, telefone: m.telefoneInteiro, telefone_verificado_em: m.ativado_em, email: m.email },
    membro: { estado: m.estado, origem: m.origem, aniversario: '05-14', cadastro_iniciado_em: m.cadastro_iniciado_em, ativado_em: m.ativado_em, regulamento_versao: '2026-10', privacidade_versao: '2026-10', termos_aceitos_em: m.ativado_em, marketing_autorizado: m.marketing_autorizado, marketing_texto_versao: m.marketing_autorizado ? '2026-10' : null, marketing_atualizado_em: m.ativado_em, suspensao: m.estado === 'suspenso' ? { em: m.suspenso_em!, por: 'Gabriela Gerente (demo)', motivo: 'Cliente disse "não fui eu" pelo WhatsApp', estado_anterior: 'ativo' } : null },
    mensagens_de_servico: { autorizadas: true, origem: 'cadastro', texto_versao: '2026-10', em: m.ativado_em ?? m.cadastro_iniciado_em!, por: null, revogado_em: null, revogacao_origem: null },
    consentimentos: [{ finalidade: 'regulamento', acao: 'aceite', canal: 'site', texto_versao: '2026-10', em: m.ativado_em ?? m.cadastro_iniciado_em! }],
    pontos: { programa_ativo: false, pendente: 0, disponivel: 0, reservado: 0 },
    sessoes_ativas: m.estado === 'ativo' ? 1 : 0,
    compras: { total: vendas.filter((v) => v.cliente?.id === id).length, ultimas: vendas.filter((v) => v.cliente?.id === id) },
    convites: [],
    mensagens: [],
  };
}
const historicos = new Map<string, { em: string; acao: string; ator_tipo: string; ator: string | null; dados: unknown }[]>();

export const ROTAS_ATENDIMENTO_CLUBE: Rota[] = [
  ...ROTAS_ATENDIMENTO,

  ['GET', /^clube\/resumo$/, TODOS, () => ({
    inscricoes_abertas: false, programa_ativo: false, credito_automatico: false,
    membros: { pendente: membros.filter((m) => m.estado === 'pendente').length, ativo: membros.filter((m) => m.estado === 'ativo').length, suspenso: membros.filter((m) => m.estado === 'suspenso').length, encerrado: 0 },
    convites_aguardando: convites.filter((c) => c.situacao === 'aguardando').length, mensagens_falhas_7_dias: 0,
    pendencias: { vendas_com_telefone_sem_cliente_verificado: 1, vendas_com_telefone_correcao_provavel: 1, vendas_com_telefone_invalido: 0, vendas_so_com_documento: 0, eventos_de_venda_sem_processar: 0, membros_pendentes_com_pontos: 0 },
  })],
  ['GET', /^clube\/membros$/, TODOS, ({ query }) => {
    const estado = query.get('estado');
    const busca = query.get('busca')?.toLowerCase();
    return paginar(membros.filter((m) => (!estado || m.estado === estado) && (!busca || (m.nome ?? '').toLowerCase().includes(busca) || m.telefone.endsWith(busca))).map(({ email, telefoneInteiro, ...m }) => { void email; void telefoneInteiro; return m; }), query);
  }],
  ['GET', /^clube\/membros\/([0-9a-f-]{36})$/, TODOS, ({ params }) => ficha(params[0])],
  ['GET', /^clube\/membros\/([0-9a-f-]{36})\/historico$/, TODOS, ({ params }) => [...(historicos.get(params[0]) ?? []), { em: membros.find((m) => m.cliente_id === params[0])?.cadastro_iniciado_em ?? agoraMenos(1), acao: 'iniciar_cadastro', ator_tipo: 'cliente', ator: null, dados: null }]],
  ['POST', /^clube\/membros\/([0-9a-f-]{36})\/suspender$/, GERENCIA, async ({ params, corpo, papel }) => {
    const { motivo } = await corpo<{ motivo: string }>();
    exigirMotivo(motivo);
    const m = membros.find((x) => x.cliente_id === params[0]);
    if (!m) throw new ErroDemo(404, 'nao_encontrado', 'Membro não encontrado.');
    if (m.estado !== 'suspenso') {
      m.estado = 'suspenso';
      m.suspenso_em = new Date().toISOString();
      historicos.set(m.cliente_id, [{ em: m.suspenso_em, acao: 'suspender', ator_tipo: 'usuario', ator: usuarioDemo(papel).nome, dados: { motivo } }, ...(historicos.get(m.cliente_id) ?? [])]);
    }
    return { ok: true };
  }],
  ['POST', /^clube\/membros\/([0-9a-f-]{36})\/reativar$/, ADMIN, async ({ params, corpo, papel }) => {
    const { motivo } = await corpo<{ motivo: string }>();
    exigirMotivo(motivo);
    const m = membros.find((x) => x.cliente_id === params[0]);
    if (!m) throw new ErroDemo(404, 'nao_encontrado', 'Membro não encontrado.');
    m.estado = 'ativo';
    m.suspenso_em = null;
    historicos.set(m.cliente_id, [{ em: new Date().toISOString(), acao: 'reativar', ator_tipo: 'usuario', ator: usuarioDemo(papel).nome, dados: { motivo } }, ...(historicos.get(m.cliente_id) ?? [])]);
    return { ok: true };
  }],
  ['POST', /^clube\/membros\/([0-9a-f-]{36})\/sessoes\/revogar$/, GERENCIA, async ({ corpo }) => {
    exigirMotivo((await corpo<{ motivo: string }>()).motivo);
    return { revogadas: 1 };
  }],
  ['GET', /^clube\/vendas$/, TODOS, ({ query }) => {
    const s = query.get('situacao') ?? 'todas';
    return paginar(vendas.filter((v) => s === 'todas' || (s === 'sem_cliente' && !v.cliente && v.telefone_situacao === 'normalizado') || (s === 'conferir_telefone' && v.aviso) || (s === 'ligadas' && v.cliente)), query);
  }],
  ['POST', /^clube\/vendas\/([0-9a-f-]{36})\/confirmar-telefone$/, GERENCIA, async ({ params, corpo }) => {
    exigirMotivo((await corpo<{ motivo: string }>()).motivo);
    const v = vendas.find((x) => x.id === params[0]);
    if (!v) throw new ErroDemo(404, 'nao_encontrado', 'Venda não encontrada.');
    if (!v.candidato_membro) throw new ErroDemo(409, 'sem_candidato', 'O número corrigido não é de nenhum membro.');
    Object.assign(v, { cliente: { id: membros[3].cliente_id, nome: membros[3].nome, estado_membro: 'ativo' }, vinculo: 'telefone_conferido', aviso: null, convite: { pode: false, motivo: 'ja_membro' } });
    return { ok: true };
  }],
  ['GET', /^clube\/convites$/, TODOS, ({ query }) => paginar(convites.filter((c) => !query.get('situacao') || c.situacao === query.get('situacao')), query)],
  ['GET', /^clube\/mensagens$/, TODOS, ({ query }) => paginar([], query)],
];
