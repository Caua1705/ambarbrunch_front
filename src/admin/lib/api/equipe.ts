// Equipe e Ponto: /admin/api/ponto/* → /admin/ponto/* do backend.
import { converterErro, ErroApi, novaChave, pedir, unidadeDaPagina, montarQuery } from './cliente';
import type {
  AjusteEntrada,
  Ajuste,
  Dispositivo,
  Escala,
  EscalaEntrada,
  EstadoBiometria,
  ExcecaoEntrada,
  Funcionario,
  FuncionarioEntrada,
  Jornada,
  JornadaDetalhe,
  LinhaEspelho,
  LinhaProgramacao,
  Marcacao,
  Pagina,
  PainelEquipe,
  RegistroAuditoria,
  ResultadoFacial,
  SessaoFacial,
  StatusDia,
  TipoBatida,
  VersaoEntrada,
} from '../tipos/equipe';

const P = 'ponto';
const TEMPO_ENVIO = 30_000;

export const equipe = {
  painel: (data?: string) => pedir<PainelEquipe>(`${P}/painel`, { query: { data } }),

  funcionarios: (q: { ativo?: boolean; busca?: string; limite?: number; deslocamento?: number } = {}) => pedir<Pagina<Funcionario>>(`${P}/funcionarios`, { query: q }),
  funcionario: (id: string) => pedir<Funcionario>(`${P}/funcionarios/${id}`),
  criarFuncionario: (corpo: FuncionarioEntrada) => pedir<Funcionario>(`${P}/funcionarios`, { metodo: 'POST', corpo }),
  alterarFuncionario: (id: string, corpo: FuncionarioEntrada) => pedir<Funcionario>(`${P}/funcionarios/${id}`, { metodo: 'PATCH', corpo }),
  inativar: (id: string, motivo: string) => pedir<Funcionario>(`${P}/funcionarios/${id}/inativar`, { metodo: 'POST', corpo: { motivo } }),
  ativar: (id: string) => pedir<Funcionario>(`${P}/funcionarios/${id}/ativar`, { metodo: 'POST' }),
  historico: (id: string) => pedir<Pagina<RegistroAuditoria>>(`${P}/funcionarios/${id}/historico`),

  escalas: () => pedir<Escala[]>(`${P}/escalas`),
  criarEscala: (corpo: EscalaEntrada) => pedir<Escala>(`${P}/escalas`, { metodo: 'POST', corpo }),
  alterarEscala: (id: string, corpo: Partial<Pick<Escala, 'nome' | 'descricao' | 'valida_ate' | 'ativa'>>) => pedir<Escala>(`${P}/escalas/${id}`, { metodo: 'PATCH', corpo }),
  novaVersao: (id: string, corpo: VersaoEntrada) => pedir<Escala>(`${P}/escalas/${id}/versoes`, { metodo: 'POST', corpo }),
  atribuir: (escalaId: string, funcionario_id: string, vigente_de: string) => pedir(`${P}/escalas/${escalaId}/atribuicoes`, { metodo: 'POST', corpo: { funcionario_id, vigente_de } }),
  criarExcecao: (funcionarioId: string, corpo: ExcecaoEntrada) => pedir(`${P}/funcionarios/${funcionarioId}/excecoes`, { metodo: 'POST', corpo }),
  cancelarExcecao: (funcionarioId: string, excecaoId: string) => pedir<void>(`${P}/funcionarios/${funcionarioId}/excecoes/${excecaoId}/cancelar`, { metodo: 'POST' }),
  programacao: (de: string, ate: string) => pedir<LinhaProgramacao[]>(`${P}/programacao`, { query: { de, ate } }),

  dispositivos: () => pedir<Dispositivo[]>(`${P}/dispositivos`),
  criarDispositivo: (nome: string) => pedir<Dispositivo>(`${P}/dispositivos`, { metodo: 'POST', corpo: { nome } }),
  trocarCredencial: (id: string) => pedir<Dispositivo>(`${P}/dispositivos/${id}/trocar-credencial`, { metodo: 'POST' }),
  revogarDispositivo: (id: string, motivo: string) => pedir<Dispositivo>(`${P}/dispositivos/${id}/revogar`, { metodo: 'POST', corpo: { motivo } }),

  biometria: (id: string) => pedir<EstadoBiometria>(`${P}/funcionarios/${id}/biometria`),
  iniciarCadastroFacial: (id: string) => pedir<SessaoFacial>(`${P}/funcionarios/${id}/biometria/cadastro`, { metodo: 'POST' }),
  iniciarTesteFacial: (id: string) => pedir<SessaoFacial>(`${P}/funcionarios/${id}/biometria/teste`, { metodo: 'POST' }),
  confirmarBiometria: (id: string) => pedir<EstadoBiometria>(`${P}/funcionarios/${id}/biometria/confirmar`, { metodo: 'POST' }),
  revogarBiometria: (id: string, motivo: string) => pedir<EstadoBiometria>(`${P}/funcionarios/${id}/biometria/revogar`, { metodo: 'POST', corpo: { motivo } }),

  marcacoes: (q: { de: string; ate: string; funcionario_id?: string; limite?: number }) => pedir<Pagina<Marcacao>>(`${P}/marcacoes`, { query: q }),
  jornadas: (q: { de: string; ate: string; funcionario_id?: string }) => pedir<Pagina<Jornada>>(`${P}/jornadas`, { query: q }),
  jornada: (id: string) => pedir<JornadaDetalhe>(`${P}/jornadas/${id}`),
  espelho: (q: { de: string; ate: string; funcionario_id?: string; status?: StatusDia; somente_a_conferir?: boolean; somente_atrasos?: boolean; limite?: number; deslocamento?: number }) => pedir<Pagina<LinhaEspelho>>(`${P}/relatorios/espelho`, { query: q }),
  ajustes: (q: { de: string; ate: string; funcionario_id?: string; limite?: number }) => pedir<Pagina<Ajuste>>(`${P}/ajustes`, { query: q }),
  auditoria: (q: { entidade?: string; funcionario_id?: string; limite?: number; deslocamento?: number }) => pedir<Pagina<RegistroAuditoria>>(`${P}/auditoria`, { query: q }),

  registrarAssistida: (corpo: { funcionario_id: string; justificativa: string; tipo?: TipoBatida | null }, chave: string) => pedir<Marcacao>(`${P}/marcacoes/assistidas`, { metodo: 'POST', corpo, idempotencia: chave }),
  ajustar: (corpo: AjusteEntrada, chave: string) => pedir<{ ajuste: Ajuste; jornada: Jornada; repetido: boolean }>(`${P}/ajustes`, { metodo: 'POST', corpo, idempotencia: chave }),
};

/**
 * Envio dos quadros do cadastro facial. Com `captura_token`, vão direto à API: não passam pelo servidor do painel nem têm o
 * limite de 4,5 MB da Vercel. Esse token vale só para esta sessão. Sem ele, vão pela ponte.
 */
export async function enviarCapturaFacial(sessao: SessaoFacial, formulario: FormData, apiUrl: string | null): Promise<ResultadoFacial> {
  if (!sessao.captura_token || !apiUrl) return pedir<ResultadoFacial>(`${P}/biometria/sessoes/${sessao.sessao_id}/captura`, { metodo: 'POST', formulario });
  let res: Response;
  try {
    res = await fetch(`${apiUrl}/admin/ponto/biometria/sessoes/${sessao.sessao_id}/captura-direta`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessao.captura_token}` },
      body: formulario,
      credentials: 'omit',
      signal: AbortSignal.timeout(TEMPO_ENVIO),
    });
  } catch {
    throw new ErroApi('rede', 'Sem conexão. Confira a internet e tente de novo.');
  }
  if (res.ok) return (await res.json()) as ResultadoFacial;
  throw await converterErro(res);
}

/** CSV do relatório: baixado pela ponte e salvo pelo navegador. */
export async function baixarRelatorio(relatorio: 'espelho' | 'resumo' | 'correcoes', de: string, ate: string, funcionario_id?: string) {
  const unidade = unidadeDaPagina();
  const res = await fetch(`/admin/api/${P}/relatorios/exportar${montarQuery({ relatorio, de, ate, funcionario_id })}`, {
    headers: unidade ? { 'X-Painel-Unidade': unidade } : {},
    credentials: 'same-origin',
  }).catch(() => {
    throw new ErroApi('rede', 'Sem conexão. Confira a internet e tente de novo.');
  });
  if (!res.ok) throw await converterErro(res);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `ponto-${relatorio}-${de}-${ate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export { novaChave };
