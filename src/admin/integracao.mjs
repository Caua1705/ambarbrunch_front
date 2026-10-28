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

const SEM_DEMO = '\0ambar-painel-sem-demonstracao';

/** Troca `servidor/demo/roteador` e `servidor/demo/sessao` (os únicos importados de fora da pasta) por um módulo vazio. */
function semDemonstracao() {
  return {
    name: 'ambar:painel-sem-demonstracao',
    enforce: 'pre',
    resolveId(id) {
      return /servidor\/demo\/(roteador|sessao)(\.ts)?$/.test(id.replaceAll('\\', '/')) ? SEM_DEMO : null;
    },
    load(id) {
      if (id !== SEM_DEMO) return null;
      return [
        "const indisponivel = () => { throw new Error('Demonstração não existe neste build.'); };",
        'export const responderDemo = indisponivel;',
        'export const usuarioDemo = indisponivel;',
        'export const UNIDADES_DEMO = [];',
      ].join('\n');
    },
  };
}

export default function painel() {
  return {
    name: 'ambar:painel',
    hooks: {
      'astro:config:setup': ({ injectRoute, addMiddleware, updateConfig, logger }) => {
        // Demonstração: só existe em build feito fora da Vercel (computador e testes). No build da Vercel — preview ou
        // produção — o código e os dados de demonstração nem entram no pacote: `PAINEL_DEMO_PERMITIDO` vira `false` na
        // compilação e os `import()` da demo são removidos (servidor/config.ts também recusa o modo em execução).
        const demoPermitido = !process.env.VERCEL;
        if (!demoPermitido && process.env.PAINEL_MODO === 'demo') {
          throw new Error('PAINEL_MODO=demo não é permitido em build da Vercel.');
        }
        updateConfig({
          vite: {
            define: { 'import.meta.env.PAINEL_DEMO_PERMITIDO': JSON.stringify(demoPermitido) },
            // Na Vercel, os pontos de entrada da demonstração viram um módulo vazio: nenhum dado fictício é compilado.
            plugins: demoPermitido ? [] : [semDemonstracao()],
          },
        });
        for (const [pattern, arquivo] of ROTAS) {
          injectRoute({ pattern, entrypoint: new URL(`./rotas/${arquivo}`, import.meta.url), prerender: false });
        }
        addMiddleware({ entrypoint: new URL('./middleware.ts', import.meta.url), order: 'pre' });
        logger.info(`painel administrativo ligado em /admin${demoPermitido ? '' : ' (sem código de demonstração)'}`);
      },
    },
  };
}
