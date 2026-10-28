// DEMONSTRAÇÃO — Equipe e acessos (GET/PUT/POST /admin/usuarios*), com as mesmas recusas do backend: só o Proprietário,
// ninguém muda o próprio perfil nem se desativa. Dados fictícios em memória.
import type { Rota } from './roteador';
import { ADMIN, ErroDemo } from './roteador';
import type { Papel } from '../../lib/sessao';

const PERFIL: Record<Papel, string> = { admin: 'Proprietário', gerente: 'Gerente', operador: 'Atendente' };
const EU = '00000000-0000-4000-8000-000000000001';

const equipe = [
  { id: EU, nome: 'Ana Administradora (demo)', email: 'admin@demo.invalid', papel: 'admin' as Papel, ativo: true, ultimo_login_em: new Date().toISOString() },
  { id: '00000000-0000-4000-8000-000000000002', nome: 'Gabriela Gerente (demo)', email: 'gerente@demo.invalid', papel: 'gerente' as Papel, ativo: true, ultimo_login_em: null },
  { id: '00000000-0000-4000-8000-000000000003', nome: 'Atendimento (demo)', email: 'operador@demo.invalid', papel: 'operador' as Papel, ativo: true, ultimo_login_em: null },
];

const saida = (m: (typeof equipe)[number]) => ({ ...m, perfil: PERFIL[m.papel], unidades: [1] });
const alvo = (id: string) => {
  const m = equipe.find((x) => x.id === id);
  if (!m) throw new ErroDemo(404, 'nao_encontrado', 'Usuário não encontrado.');
  return m;
};
const naoEu = (id: string, texto: string, codigo: string) => {
  if (id === EU) throw new ErroDemo(422, codigo, texto);
};

export const ROTAS_EQUIPE: Rota[] = [
  ['GET', /^usuarios$/, ADMIN, () => equipe.map(saida)],
  ['PUT', /^usuarios\/([^/]+)\/perfil$/, ADMIN, async ({ params, corpo }) => {
    naoEu(params[0], 'Você não pode alterar o seu próprio perfil.', 'proprio_perfil');
    const { papel } = await corpo<{ papel: Papel }>();
    const u = alvo(params[0]);
    u.papel = papel;
    return saida(u);
  }],
  ['POST', /^usuarios\/([^/]+)\/desativar$/, ADMIN, ({ params }) => {
    naoEu(params[0], 'Você não pode desativar a própria conta.', 'propria_conta');
    const u = alvo(params[0]);
    u.ativo = false;
    return saida(u);
  }],
  ['POST', /^usuarios\/([^/]+)\/reativar$/, ADMIN, ({ params }) => {
    const u = alvo(params[0]);
    u.ativo = true;
    return saida(u);
  }],
  ['POST', /^usuarios\/([^/]+)\/revogar-sessoes$/, ADMIN, ({ params }) => saida(alvo(params[0]))],
];
