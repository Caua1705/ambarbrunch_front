// CONTRATO DOS TOKENS (docs/design/PROPOSTA-TOKENS-CSS.md §6): o design system continua centralizado.
// Lê o CSS do site (sem navegador) e falha se aparecer valor solto onde deveria haver token.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve('src/styles');
const arquivos = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? arquivos(path.join(dir, e.name)) : e.name.endsWith('.css') ? [path.join(dir, e.name)] : []));
const rel = (f: string) => path.relative(RAIZ, f).replace(/\\/g, '/');
const TODOS = arquivos(RAIZ);
const TOKENS = TODOS.filter((f) => rel(f).startsWith('tokens/'));
// a página interna de documentação tem amostras tipográficas próprias (ex.: o “Aa” de 120 px); cores, só por token
const SITE = TODOS.filter((f) => !rel(f).startsWith('tokens/') && rel(f) !== 'tokens.css');
const semComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const declaracoes = (f: string) => semComentarios(fs.readFileSync(f, 'utf8')).split(/[;{}]/).map((d) => d.trim()).filter((d) => /^[a-z-]+\s*:/.test(d));

test('nenhuma cor HEX ou rgb() fora dos tokens', () => {
  const achados = SITE.flatMap((f) => declaracoes(f).filter((d) => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(d.replace(/#000 0 0|#0000/g, ''))).map((d) => `${rel(f)}: ${d}`));
  expect(achados).toEqual([]);
});

test('nenhum tamanho de fonte em px fora dos tokens (exceto fórmulas de palco em --u)', () => {
  const achados = SITE.filter((f) => !rel(f).startsWith('docs/')).flatMap((f) => declaracoes(f)
    .filter((d) => /^font(-size)?\s*:/.test(d) && /\d(px|rem)\b/.test(d) && !/var\(--u/.test(d))
    .map((d) => `${rel(f)}: ${d}`));
  expect(achados).toEqual([]);
});

test('nenhuma duração literal fora dos tokens', () => {
  const achados = SITE.filter((f) => !rel(f).startsWith('docs/')).flatMap((f) => declaracoes(f)
    .filter((d) => /^(transition|animation)(-duration|-delay)?\s*:/.test(d) && /(^|[\s,(])\.?\d+(\.\d+)?m?s\b/.test(d.split(':').slice(1).join(':')))
    .map((d) => `${rel(f)}: ${d}`));
  expect(achados).toEqual([]);
});

test('todo token declarado é usado', () => {
  const declarados = new Set(TOKENS.flatMap((f) => [...semComentarios(fs.readFileSync(f, 'utf8')).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])));
  const markup = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? markup(path.join(dir, e.name)) : /\.(astro|tsx?|js)$/.test(e.name) ? [fs.readFileSync(path.join(dir, e.name), 'utf8')] : []));
  const tudo = [...TODOS.map((f) => fs.readFileSync(f, 'utf8')), ...markup(path.resolve('src'))].join('\n');
  const semUso = [...declarados].filter((t) => !new RegExp(`var\\(${t}[,)]`).test(tudo));
  expect(semUso).toEqual([]);
});

test('espaçamentos fora da escala --s-* (aviso, não falha)', () => {
  const ESCALA = new Set([6, 8, 10, 12, 14, 16, 18, 22, 24, 26, 30, 34, 40, 44]);
  const fora = SITE.filter((f) => !rel(f).startsWith('docs/')).flatMap((f) => declaracoes(f)
    .filter((d) => /^(padding|margin|gap|row-gap|column-gap)(-[a-z]+)?\s*:/.test(d))
    .flatMap((d) => [...d.matchAll(/(?<![-\w.])(\d+)px/g)].filter((m) => !ESCALA.has(Number(m[1]))).map(() => `${rel(f)}: ${d}`)));
  test.info().annotations.push({ type: 'aviso', description: `${fora.length} espaçamentos de composição fora da escala (documentados como exceções de seção)` });
});
