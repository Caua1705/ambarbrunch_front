// Integração do painel administrativo (/admin). Só é registrada com PAINEL_ADMIN=1 (astro.config.mjs): sem ela, o build
// público não tem nenhuma rota /admin, nenhum middleware e nenhum adaptador.
//
// As páginas ficam em src/admin/rotas/ (fora de src/pages/) e são injetadas aqui. Todas rodam no servidor
// (prerender = false): a sessão é conferida a cada requisição, no middleware, antes de qualquer HTML sair.

const ROTAS = [
  ['/admin', 'index.astro'],
  ['/admin/login', 'login.astro'],
  ['/admin/reservas', 'reservas.astro'],
  ['/admin/atendimento', 'atendimento.astro'],
  ['/admin/clube', 'clube.astro'],
  ['/admin/financeiro', 'financeiro.astro'],
  ['/admin/estoque', 'estoque.astro'],
  ['/admin/configuracoes', 'configuracoes.astro'],
  ['/admin/api/sessao', 'api/sessao.ts'],
  ['/admin/api/[...caminho]', 'api/[...caminho].ts'],
];

export default function painel() {
  return {
    name: 'ambar:painel',
    hooks: {
      'astro:config:setup': ({ injectRoute, addMiddleware, logger }) => {
        // Demonstração nunca vai para a produção da Vercel (ver também servidor/config.ts, que confere de novo em execução).
        if (process.env.PAINEL_MODO === 'demo' && process.env.VERCEL_ENV === 'production') {
          throw new Error('PAINEL_MODO=demo não é permitido no build de produção.');
        }
        for (const [pattern, arquivo] of ROTAS) {
          injectRoute({ pattern, entrypoint: new URL(`./rotas/${arquivo}`, import.meta.url), prerender: false });
        }
        addMiddleware({ entrypoint: new URL('./middleware.ts', import.meta.url), order: 'pre' });
        logger.info('painel administrativo ligado em /admin');
      },
    },
  };
}
