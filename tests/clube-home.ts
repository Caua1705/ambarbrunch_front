// O Clube só aparece na home e no menu com PUBLIC_CLUBE_HOME=1 no build (src/lib/clube-modo.ts). Desligado é o padrão
// até o lançamento do Clube (decisão de 2026-10-27, commit d7e78d3). Rode os testes com o MESMO valor usado no build:
// sem a variável, a suíte confere que o Clube está oculto; com PUBLIC_CLUBE_HOME=1, confere a seção e o item do menu.
export const CLUBE_NA_HOME = process.env.PUBLIC_CLUBE_HOME === '1';
export const MOTIVO_CLUBE_OCULTO = 'Clube fora da home até o lançamento (PUBLIC_CLUBE_HOME desligado)';
