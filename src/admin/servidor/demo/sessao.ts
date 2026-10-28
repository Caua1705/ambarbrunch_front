// DEMONSTRAÇÃO — usuários e unidades fictícios para validar o desenho sem backend. Só existem com PAINEL_MODO=demo, que é
// recusado na Vercel (servidor/config.ts e integracao.mjs). Nenhum dado daqui é enviado a lugar nenhum.
import type { Papel, Unidade, Usuario } from '../../lib/sessao';

const NOMES: Record<Papel, string> = {
  admin: 'Ana Administradora (demo)',
  gerente: 'Gabriela Gerente (demo)',
  operador: 'Otávio Operação (demo)',
};

export function usuarioDemo(papel: Papel): Usuario {
  return { id: `00000000-0000-4000-8000-00000000000${papel === 'admin' ? 1 : papel === 'gerente' ? 2 : 3}`, nome: NOMES[papel], email: `${papel}@demo.invalid`, papel, unidades: papel === 'admin' ? [] : [1] };
}

export const UNIDADES_DEMO: Unidade[] = [
  { id: 1, codigo: 'ambar_cafe', nome: 'Âmbar Café (demo)', razao_social: null, cnpj: null, ativo: true },
];
