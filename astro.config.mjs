// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tudo em public/ é copiado para o build, referenciado ou não. Vídeos da Roll com autorização pendente
 * ficam fora das páginas de produção; este passo também os tira da PASTA do build, para que nenhum
 * arquivo não referenciado vá parar num deploy. Remove também os .gitkeep de estrutura.
 */
function podarMidiaNaoReferenciada() {
  return {
    name: 'ambar:podar-midia',
    hooks: {
      /** @param {{ dir: URL, logger: { info: (m: string) => void } }} opts */
      'astro:build:done': ({ dir, logger }) => {
        const raiz = fileURLToPath(dir);
        /** @type {string[]} */
        const htmls = [];
        const andar = (/** @type {string} */ d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) andar(p); else if (p.endsWith('.html')) htmls.push(fs.readFileSync(p, 'utf8')); } };
        andar(raiz);
        const todo = htmls.join('\n');
        // vídeos e legendas em qualquer pasta de media/ (inclusive media/revisao/, só de revisão local)
        const media = path.join(raiz, 'media');
        const podar = (/** @type {string} */ d) => {
          for (const f of fs.readdirSync(d)) {
            const p = path.join(d, f);
            if (fs.statSync(p).isDirectory()) { podar(p); if (!fs.readdirSync(p).length) fs.rmdirSync(p); continue; }
            const rel = path.relative(raiz, p).replaceAll('\\', '/');
            if (f === '.gitkeep' && rel.startsWith('media/video/')) { fs.rmSync(p); continue; }
            if (/\.(mp4|webm|vtt)$/.test(f) && !todo.includes(`/${rel}`)) { fs.rmSync(p); logger.info(`fora do build (não referenciado): ${rel}`); }
          }
        };
        if (fs.existsSync(media)) podar(media);
        for (const sub of ['brand', 'graphics', 'photography']) { const g = path.join(raiz, 'media', sub, '.gitkeep'); if (fs.existsSync(g)) fs.rmSync(g); }
        // Imagens emitidas pelo bundler e não usadas por nenhuma página, folha de estilo ou script
        // (ex.: originais importados pelo glob de mídia, inclusive os de autorização pendente).
        const assets = path.join(raiz, '_astro');
        if (fs.existsSync(assets)) {
          const textos = [todo, ...fs.readdirSync(assets).filter((f) => /\.(css|js)$/.test(f)).map((f) => fs.readFileSync(path.join(assets, f), 'utf8'))].join('\n');
          let n = 0;
          for (const f of fs.readdirSync(assets)) if (/\.(png|jpe?g|webp|avif|mp4)$/.test(f) && !textos.includes(f)) { fs.rmSync(path.join(assets, f)); n++; }
          if (n) logger.info(`${n} imagens não referenciadas removidas de _astro/`);
          // Scripts e folhas de estilo sem nenhuma página (ex.: os da página interna /design-system/, que não é gerada
          // em produção): alcançáveis = citados no HTML ou em outro arquivo alcançável.
          const codigo = fs.readdirSync(assets).filter((f) => /\.(css|js)$/.test(f));
          const vivos = new Set(codigo.filter((f) => todo.includes(f)));
          for (let novo = true; novo;) {
            novo = false;
            for (const f of [...vivos]) {
              const txt = fs.readFileSync(path.join(assets, f), 'utf8');
              for (const g of codigo) if (!vivos.has(g) && txt.includes(g)) { vivos.add(g); novo = true; }
            }
          }
          const mortos = codigo.filter((f) => !vivos.has(f));
          for (const f of mortos) fs.rmSync(path.join(assets, f));
          if (mortos.length) logger.info(`${mortos.length} scripts/estilos sem página removidos de _astro/`);
        }
      },
    },
  };
}

// Site estático. Preact só na ilha da reserva (src/islands).
export default defineConfig({
  site: 'https://ambarbrunch.com',
  output: 'static',
  // a carteira antiga (/clube/membro) virou a área do membro: o endereço velho continua funcionando
  redirects: { '/clube/membro': '/clube/conta/' },
  integrations: [preact(), podarMidiaNaoReferenciada()],
  build: { inlineStylesheets: 'auto', assets: '_astro' },
  image: { responsiveStyles: false },
  devToolbar: { enabled: false },
  vite: { build: { assetsInlineLimit: 0 } },
});
