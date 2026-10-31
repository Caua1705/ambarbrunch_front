// Rótulos e utilidades do Financeiro, comuns às abas.
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { useConsulta, invalidar } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { Situacao, Etiqueta, type Tom } from '../../ui/base';
import type { Categoria, NivelQualidade, Qualidade, SituacaoConta, EstadoConciliacao, FormaPagamento, NivelConciliacao, TipoDocumento } from '../../lib/tipos/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { avisar, avisarErro } from '../../ui/camadas';
import type { Papel, Usuario, Unidade } from '../../lib/sessao';

// Permissões do Financeiro como o backend decide (GET /admin/auth/me → usuario.permissoes). Sem a lista (demonstração,
// sessão antiga), vale o espelho da matriz do backend (app/modulos/usuarios/permissoes.py). Só esconde o que a pessoa
// não pode usar: quem decide é a rota (403).
export type PermissaoFinanceiro = 'financeiro.visualizar' | 'financeiro.lancar' | 'financeiro.conciliar' | 'financeiro.ver_societario' | 'financeiro.configurar';
const ESPELHO: Record<Papel, PermissaoFinanceiro[]> = {
  admin: ['financeiro.visualizar', 'financeiro.lancar', 'financeiro.conciliar', 'financeiro.ver_societario', 'financeiro.configurar'],
  gerente: ['financeiro.visualizar', 'financeiro.lancar', 'financeiro.conciliar'],
  operador: [],
};
export function temPermissao(usuario: Usuario, p: PermissaoFinanceiro): boolean {
  return usuario.permissoes ? usuario.permissoes.includes(p) : ESPELHO[usuario.papel].includes(p);
}

/** Usuário da sessão para as partes do módulo que não recebem o contexto (seletores, gavetas). */
export const UsuarioFinanceiro = createContext<Usuario | null>(null);
/** Permissão do Financeiro no componente (fora do provedor: nega). */
export function usePermissao(p: PermissaoFinanceiro): boolean {
  const u = useContext(UsuarioFinanceiro);
  return !!u && temPermissao(u, p);
}

export const atualizarFinanceiro = () => invalidar('financeiro');

/** Erro de ação: 409 conflito_versao recarrega os dados antes de avisar. */
export function avisarFalha(e: unknown) {
  if (e instanceof ErroApi && e.tipo === 'conflito') atualizarFinanceiro();
  avisarErro(e);
}
export { avisar };

export const ORIGEM: Record<string, string> = {
  painel: 'Painel',
  julia: 'Júlia',
  compra: 'Compra',
  recorrencia: 'Conta fixa',
  extrato: 'Extrato',
  eyemobile: 'PDV',
};

export const TIPO_LANCAMENTO: Record<string, string> = {
  venda_dia: 'Vendas do PDV',
  despesa: 'Despesa',
  pagamento: 'Pagamento',
  outra_receita: 'Outra receita',
};

export function SituacaoLancamento({ status, tipo }: { status: string; tipo: string }) {
  if (status === 'em_revisao') return <Situacao tom="atencao" destaque>Para revisar</Situacao>;
  if (status === 'cancelada') return <Situacao tom="apagado">Cancelada</Situacao>;
  if (status === 'estornado') return <Situacao tom="apagado">Estornado</Situacao>;
  if (tipo === 'pagamento') return <Situacao tom="ok">Pago</Situacao>;
  if (tipo === 'venda_dia') return <Situacao tom="ok">Sincronizada</Situacao>;
  return <Situacao tom="ok">Confirmada</Situacao>;
}

export const QUALIDADE: Record<NivelQualidade, { rotulo: string; tom: Tom; explicacao: string }> = {
  completo: { rotulo: 'Completo', tom: 'ok', explicacao: 'Todos os dados do período estão lançados e conferidos.' },
  parcial: { rotulo: 'Parcial', tom: 'atencao', explicacao: 'Faltam dados: o número pode mudar.' },
  estimado: { rotulo: 'Estimado', tom: 'atencao', explicacao: 'Parte do cálculo usa estimativas.' },
  indisponivel: { rotulo: 'Indisponível', tom: 'apagado', explicacao: 'Não há dados suficientes para calcular.' },
};

export function SeloQualidade({ q }: { q: NivelQualidade }) {
  const x = QUALIDADE[q] ?? QUALIDADE.indisponivel;
  return <Etiqueta tom={x.tom === 'apagado' ? 'neutro' : x.tom}>{x.rotulo}</Etiqueta>;
}

export function MotivosQualidade({ q }: { q: Qualidade }) {
  if (!q.motivos.length) return null;
  return (
    <ul class="fraco" style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
      {q.motivos.map((m) => (
        <li key={m.codigo}>{m.texto}</li>
      ))}
    </ul>
  );
}

export const SITUACAO_CONTA: Record<SituacaoConta, { rotulo: string; tom: Tom; destaque?: boolean }> = {
  vencida: { rotulo: 'Vencida', tom: 'perigo', destaque: true },
  vence_hoje: { rotulo: 'Vence hoje', tom: 'atencao', destaque: true },
  parcial: { rotulo: 'Paga em parte', tom: 'info' },
  a_vencer: { rotulo: 'A vencer', tom: 'neutro' },
  paga: { rotulo: 'Paga', tom: 'ok' },
};

export const ESTADO_CONCILIACAO: Record<EstadoConciliacao, { rotulo: string; tom: Tom }> = {
  sem_contas: { rotulo: 'Nenhuma conta bancária cadastrada', tom: 'apagado' },
  nao_conferido: { rotulo: 'Extrato não importado', tom: 'atencao' },
  parcial: { rotulo: 'Extrato incompleto', tom: 'atencao' },
  aguardando_revisao: { rotulo: 'Movimentos para conferir', tom: 'atencao' },
  integral_informado: { rotulo: 'Pronto para conciliar', tom: 'info' },
  conciliado: { rotulo: 'Conciliado', tom: 'ok' },
  reaberto: { rotulo: 'Reaberto', tom: 'atencao' },
};

export const FORMAS: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'cartao', rotulo: 'Cartão' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'debito_automatico', rotulo: 'Débito automático' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'outro', rotulo: 'Outro' },
];

export const NIVEL: Record<NivelConciliacao, { rotulo: string; tom: Tom; ordem: number }> = {
  conflito: { rotulo: 'Possível duplicidade', tom: 'perigo', ordem: 0 },
  forte: { rotulo: 'Sugestão forte', tom: 'ok', ordem: 1 },
  ambigua: { rotulo: 'Mais de uma opção', tom: 'atencao', ordem: 2 },
  possivel: { rotulo: 'Possível correspondência', tom: 'info', ordem: 3 },
  classificacao_pendente: { rotulo: 'Classificar', tom: 'atencao', ordem: 4 },
  sem_correspondencia: { rotulo: 'Sem registro', tom: 'atencao', ordem: 5 },
  vinculo_confirmado: { rotulo: 'Conciliada', tom: 'ok', ordem: 6 },
  duplicado: { rotulo: 'Duplicada', tom: 'apagado', ordem: 7 },
};

export const EVIDENCIA: Record<string, string> = {
  mesmo_beneficiario: 'Mesmo beneficiário (CNPJ/CPF)',
  valor_exato: 'Valor exato',
  identificador_da_transacao: 'Identificador da transação',
  mesma_linha_digitavel: 'Mesma linha digitável do boleto',
  sem_boleto_a_conferir: 'Sem boleto para conferir',
  obrigacao_definida: 'Conta com valor definido',
};

export const MOTIVO_REVISAO: Record<string, string> = {
  categoria_a_classificar: 'Sem categoria',
  acima_do_limite: 'Valor acima do limite',
  sem_data: 'Sem data',
  data_suspeita: 'Data suspeita',
  documento_ambiguo: 'Documento ambíguo',
  sem_valor: 'Valor ilegível',
  boleto_incompleto: 'Boleto incompleto',
  conta_compativel: 'Pode pagar uma conta',
  nota_sem_sinal_objetivo: 'Nota sem sinal claro',
  pode_ser_pagamento_lancado: 'Pode ser pagamento já lançado',
  nota_de_pagamento_lancado: 'Nota de pagamento já lançado',
  valor_a_confirmar: 'Conta de valor variável',
  identificador_repetido: 'Identificador já usado',
  // 0018 (documentos da Júlia)
  tipo_em_conflito: 'A legenda não combina com o documento',
  pode_ser_conta_lancada: 'Pode ser de uma conta já lançada',
  pode_ser_pagamento_registrado: 'Pode ser de um pagamento já lançado',
  movimentacao_nao_despesa: 'Troco, aporte, retirada ou transferência (não é despesa)',
  corrigido: 'Corrigido no painel',
};
// Comprovante sem data ou com data estranha: o mesmo aviso nos dois casos (a data fica à mão para corrigir).
MOTIVO_REVISAO.sem_data = MOTIVO_REVISAO.data_suspeita = 'Data do pagamento a conferir';

export const TIPO_DOC: Record<TipoDocumento, string> = {
  comprovante_pagamento: 'Comprovante de pagamento',
  boleto: 'Boleto',
  recibo: 'Recibo',
  nota_compra: 'Nota fiscal',
  ambiguo: 'Documento não identificado',
};

/** Como a Júlia chegou à categoria (classificacao.origem). */
export const ORIGEM_CLASSIFICACAO: Record<string, string> = {
  legenda: 'pela legenda',
  legenda_ia: 'pela legenda e pela IA',
  fornecedor: 'pelo fornecedor',
  ia: 'pela IA',
  sugestao_ia: 'sugestão da IA, a confirmar',
  conflito: 'a confirmar (legenda e IA discordam)',
  ambigua: 'a confirmar (mais de uma possível)',
  sem_evidencia: 'a confirmar (sem pista)',
  movimentacao: 'não é despesa',
  painel: 'corrigida no painel',
};

/** Em que papel um arquivo aparece numa despesa (GET …/despesas/{id}/documentos → papeis[]). */
export const PAPEL_ANEXO: Record<string, string> = {
  despesa: 'Documento do lançamento',
  pagamento: 'Comprovante do pagamento',
  compra: 'Nota da compra',
  comprovante_pagamento: 'Comprovante enviado à Júlia',
  recibo: 'Recibo enviado à Júlia',
  boleto: 'Boleto enviado à Júlia',
  nota_compra: 'Nota fiscal enviada à Júlia',
  ambiguo: 'Documento enviado à Júlia',
};

export const CLASSIFICACOES: { valor: string; rotulo: string; ajuda: string; direcao?: 'credito' | 'debito' }[] = [
  { valor: 'transferencia_propria', rotulo: 'Transferência entre contas próprias', ajuda: 'Dinheiro que só mudou de conta. Não é receita nem despesa.' },
  { valor: 'aporte_socio', rotulo: 'Aporte de sócio', ajuda: 'Dinheiro colocado pelos sócios. Não é receita.', direcao: 'credito' },
  { valor: 'emprestimo', rotulo: 'Empréstimo', ajuda: 'Entrada ou pagamento de empréstimo.' },
  { valor: 'reembolso', rotulo: 'Reembolso', ajuda: 'Devolução de valor pago antes.' },
  { valor: 'estorno', rotulo: 'Estorno', ajuda: 'Valor devolvido pelo banco ou pela maquininha.' },
  { valor: 'nao_operacional', rotulo: 'Não operacional (explique)', ajuda: 'Fora da operação. Exige observação.' },
];

// Categorias (§5.7): dados do banco, por unidade — nenhuma lista fixa aqui. Duas consultas:
//  - `useCategorias`: só as VÁLIDAS na unidade do topo (GET …/categorias?unidade=, sem `todas`) → todo seletor de
//    lançamento (Nova despesa, Revisão, Detalhe, Contas fixas, Banco). Categoria nova ou reativada aparece sozinha.
//  - `useCadastroCategorias`: o cadastro inteiro (todas=true&incluir_inativas=true) → tela Categorias e o NOME de
//    lançamentos antigos, que continuam com categorias que não valem mais na unidade (aluguel, energia…).

/** Categorias válidas na unidade (operador também lê): o que os seletores oferecem. */
export function useCategorias() {
  return useConsulta('financeiro/categorias', () => financeiro.categorias());
}

export function useCadastroCategorias() {
  return useConsulta('financeiro/categorias?todas', () => financeiro.cadastroCategorias());
}

/** Nome de qualquer categoria (inclusive fora de uso), pelo cadastro; sem ele, pelas válidas; sem nada, o código. */
export function useNomeCategoria() {
  const cadastro = useCadastroCategorias();
  const validas = useCategorias();
  return (codigo: string | null | undefined) => nomeCategoria([...(cadastro.dados ?? []), ...(validas.dados ?? [])], codigo);
}

export function nomeCategoria(cats: Categoria[] | undefined, codigo: string | null | undefined) {
  if (!codigo) return '—';
  if (codigo === 'a_classificar') return cats?.find((c) => c.codigo === codigo)?.nome ?? 'Não classificado';
  return cats?.find((c) => c.codigo === codigo)?.nome ?? codigo;
}

/** Categoria que pode ir num lançamento novo desta unidade. */
export const categoriaValida = (c: Categoria) => c.ativo && c.ativa_na_unidade !== false && !c.pendencia && c.grupo !== 'pendente';

export const GRUPO: Record<string, string> = {
  compras_estoque: 'Compra para estoque (CMV)',
  pessoal: 'Pessoal',
  ocupacao: 'Fixo / ocupação',
  operacional: 'Operacional',
  marketing: 'Marketing',
  impostos: 'Tributos',
  financeiro: 'Financeiro',
  investimento: 'Investimento',
  retirada: 'Retirada',
  repasse: 'Repasse',
  pendente: 'Não classificado',
};

/** O que cada grupo significa no resultado (tela Categorias e formulário). */
export const GRUPO_AJUDA: Record<string, string> = {
  compras_estoque: 'Entra no CMV pela compra para o estoque.',
  pessoal: 'Salários, encargos e benefícios.',
  ocupacao: 'Custos fixos do ponto: aluguel, energia, água, internet.',
  operacional: 'Despesas do dia a dia: limpeza, xerox, transporte, manutenção.',
  marketing: 'Divulgação e eventos de marketing.',
  impostos: 'Impostos e taxas do governo.',
  financeiro: 'Tarifas bancárias, juros e taxas de cartão.',
  investimento: 'Aquisição de bem (equipamento, obra): fica fora do resultado.',
  retirada: 'Retirada dos sócios: fica fora do resultado.',
  repasse: 'Dinheiro que só passa pelo caixa (ex.: taxa de serviço): fica fora do resultado.',
};

/** Select de categorias agrupadas: só as válidas na unidade ("Não classificado" fica de fora — é o que se está
 *  corrigindo). Retiradas de sócios só para quem tem financeiro.ver_societario: para os outros o backend recusa (403).
 *  `atual`: categoria que o registro já tem e que não vale mais aqui — aparece desabilitada para a tela não mentir. */
export function OpcoesCategoria({ cats, atual }: { cats: Categoria[]; atual?: { codigo: string; nome: string } | null }) {
  const societario = usePermissao('financeiro.ver_societario');
  const grupos = new Map<string, Categoria[]>();
  const validas = cats.filter((c) => categoriaValida(c) && (societario || c.grupo !== 'retirada'));
  for (const c of [...validas].sort((a, b) => (a.ordem ?? 100) - (b.ordem ?? 100))) {
    const g = grupos.get(c.grupo) ?? [];
    g.push(c);
    grupos.set(c.grupo, g);
  }
  const foraDeUso = atual && atual.codigo !== 'a_classificar' && !validas.some((c) => c.codigo === atual.codigo);
  return (
    <>
      {foraDeUso && <option value={atual.codigo} disabled>{atual.nome} (fora de uso nesta unidade)</option>}
      {[...grupos].map(([g, lista]) => (
        <optgroup key={g} label={GRUPO[g] ?? g}>
          {lista.map((c) => (
            <option key={c.codigo} value={c.codigo}>{c.nome}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

/** Unidades do topo para as partes do módulo que mudam a unidade de um documento ou lançamento. */
export const UnidadesFinanceiro = createContext<{ unidade: Unidade | null; unidades: Unidade[] }>({ unidade: null, unidades: [] });
export const useUnidades = () => useContext(UnidadesFinanceiro);

/** Meios de pagamento registrados no PDV (relatório de vendas e taxas do cartão/PIX). */
export const MEIO: Record<string, string> = {
  credito: 'Crédito',
  debito: 'Débito',
  pix: 'Pix',
  outro: 'Outros (dinheiro, voucher…)',
};

/** Bases possíveis da participação (apuracao.py BASES). */
export const BASE_PARTICIPACAO: Record<string, string> = {
  receita_liquida: 'Receita líquida',
  margem_bruta: 'Margem bruta',
  resultado_operacional: 'Resultado operacional',
  resultado_gerencial: 'Resultado gerencial',
};
