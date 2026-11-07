// Estados da tela /ponto difíceis de provocar com o backend real. A API é SIMULADA só nestes testes de componente, que por isso
// não contam como integração: servem para provar que a tela nunca mostra sucesso sem recibo e trata cada código do contrato.
import { test, expect, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, botaoPonto, ruidoDeSensor } from './apoio';

const BASE = `${API}/quiosque/ponto`;
const CONFIG = {
  dispositivo: 'Tablet teste', unidade: 'Âmbar Café', horario_servidor: new Date().toISOString(), fuso: 'America/Fortaleza', biometria_disponivel: true,
  quadros_min: 6, quadros_max: 12, quadro_max_kb: 400, quadro_lado_max: 1280, sessao_segundos: 30,
  poses: { frente: 'Olhe para a câmera', esquerda: 'Vire o rosto para a sua esquerda', direita: 'Vire o rosto para a sua direita' },
};
const SESSAO = { sessao_id: '11111111-1111-4111-8111-111111111111', nonce: 'n', desafio: ['frente'], expira_em: new Date(Date.now() + 30_000).toISOString(), quadros_min: 3, quadros_max: 3 };
const APROVADO = {
  sessao_id: SESSAO.sessao_id, resultado: 'aprovado', mensagem: 'Identificação concluída.', nova_tentativa: false, autorizacao: 'a', autorizacao_expira_em: new Date(Date.now() + 45_000).toISOString(),
  nome_exibicao: 'Ana', proxima_batida: { acao: 'registrar', tipo: 'ENTRADA', opcoes: [], motivo: 'inicio_de_jornada' },
};
const RECIBO = { marcacao_id: 'm', nome_exibicao: 'Ana', tipo: 'ENTRADA', instante_utc: '2026-11-09T11:00:03Z', data: '2026-11-09', hora: '08:00:03', fuso: 'America/Fortaleza', dispositivo: 'Tablet teste', repetida: false, sinalizacoes: [], natureza: 'comprovante_operacional' };

const json = (r: Route, status: number, corpo: unknown) =>
  r.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': new URL(r.request().headers().origin ?? 'http://127.0.0.1:4495').origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': '*' }, body: JSON.stringify(corpo) });

async function api(page: Page, respostas: { captura?: (r: Route) => unknown; marcacao?: (r: Route) => unknown; sessao?: (r: Route) => unknown; config?: (r: Route) => unknown }) {
  await ruidoDeSensor(page);
  await page.route(`${BASE}/**`, (r) => {
    if (r.request().method() === 'OPTIONS') return json(r, 200, {});
    const u = r.request().url();
    if (u.endsWith('/configuracao')) return respostas.config ? respostas.config(r) : json(r, 200, CONFIG);
    if (u.endsWith('/sessoes')) return respostas.sessao ? respostas.sessao(r) : json(r, 201, SESSAO);
    if (u.endsWith('/captura')) return respostas.captura ? respostas.captura(r) : json(r, 200, APROVADO);
    if (u.endsWith('/cancelar')) return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4495', 'Access-Control-Allow-Credentials': 'true' } });
    if (u.endsWith('/marcacoes')) return respostas.marcacao ? respostas.marcacao(r) : json(r, 201, RECIBO);
    return r.abort();
  });
  await page.goto('/ponto/');
}

const cartao = (page: Page) => page.locator('.ponto__cartao');

test('horário vem do recibo do backend, não do aparelho', async ({ page }) => {
  await api(page, {});
  await botaoPonto(page).click();
  await expect(page.locator('.ponto__recibo')).toContainText('08:00');
  await expect(page.locator('.ponto__recibo')).toContainText('09/11/2026');
});

test('serviço desativado', async ({ page }) => {
  await api(page, { config: (r) => json(r, 503, { detail: 'Controle de ponto desativado.', codigo: 'ponto_desativado' }) });
  await expect(cartao(page)).toContainText('Ponto indisponível');
  await expect(botaoPonto(page)).toHaveCount(0);
});

test('backend publicado sem CORS com cookie: distingue desativado de falta de internet', async ({ page }) => {
  let chamadas = 0;
  await api(page, { config: (r) => (++chamadas === 1 ? r.abort() : json(r, 503, { detail: 'Controle de ponto desativado.', codigo: 'ponto_desativado' })) });
  await expect(cartao(page)).toContainText('Ponto indisponível');
});

test('motor desligado: indisponibilidade verdadeira, sem aprovação automática', async ({ page }) => {
  await api(page, { config: (r) => json(r, 200, { ...CONFIG, biometria_disponivel: false }) });
  await expect(cartao(page)).toContainText('Reconhecimento indisponível');
  await expect(botaoPonto(page)).toHaveCount(0);
});

test('câmera sem permissão', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('negada', 'NotAllowedError'));
  });
  let cancelada = false;
  await api(page, {});
  page.on('request', (r) => { if (r.url().endsWith('/cancelar')) cancelada = true; });
  await botaoPonto(page).click();
  await expect(cartao(page)).toContainText('A câmera está bloqueada');
  expect(cancelada).toBe(true);
});

for (const [nome, resultado, gestor] of [
  ['identificação ambígua', 'identificacao_ambigua', true],
  ['sessão expirada', 'sessao_expirada', false],
  ['sem biometria cadastrada', 'sem_biometria_cadastrada', true],
] as const) {
  test(nome, async ({ page }) => {
    await api(page, { captura: (r) => json(r, 200, { sessao_id: SESSAO.sessao_id, resultado, mensagem: 'Mensagem do backend.', nova_tentativa: !gestor, encaminhar_gestor: gestor }) });
    await botaoPonto(page).click();
    await expect(cartao(page)).toContainText('Mensagem do backend.');
    await expect(page.locator('.ponto__recibo')).toHaveCount(0);
  });
}

test('sistema ocupado: reenvia a mesma captura', async ({ page }) => {
  let vezes = 0;
  await api(page, { captura: (r) => (++vezes === 1 ? json(r, 503, { detail: 'Ocupado', codigo: 'biometria_ocupada' }) : json(r, 200, APROVADO)) });
  await botaoPonto(page).click();
  await expect(page.locator('.ponto__recibo')).toBeVisible();
  expect(vezes).toBe(2);
});

test('rede cai depois do reconhecimento: repete com a mesma chave e só confirma com recibo', async ({ page }) => {
  const chaves: string[] = [];
  let chamadas = 0;
  await api(page, {
    marcacao: (r) => {
      chaves.push(r.request().headers()['idempotency-key']);
      return ++chamadas <= 2 ? r.abort() : json(r, 201, { ...RECIBO, repetida: true });
    },
  });
  await botaoPonto(page).click();
  await expect(cartao(page)).toContainText('Registro não confirmado');
  await expect(page.locator('.ponto__recibo')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.locator('.ponto__recibo')).toContainText('já estava registrada');
  expect(new Set(chaves).size).toBe(1);
  expect(chaves).toHaveLength(3);
});

test('supervisão necessária não grava batida', async ({ page }) => {
  let bateu = false;
  await api(page, {
    captura: (r) => json(r, 200, { ...APROVADO, proxima_batida: { acao: 'supervisao', tipo: null, opcoes: [], motivo: 'x' } }),
    marcacao: (r) => { bateu = true; return json(r, 201, RECIBO); },
  });
  await botaoPonto(page).click();
  await expect(cartao(page)).toContainText('Fale com o gestor');
  expect(bateu).toBe(false);
});

test('escolha mostra só as opções do backend', async ({ page }) => {
  await api(page, { captura: (r) => json(r, 200, { ...APROVADO, proxima_batida: { acao: 'escolher', tipo: null, opcoes: ['INICIO_INTERVALO', 'SAIDA'], motivo: 'x' } }), marcacao: (r) => json(r, 201, { ...RECIBO, tipo: JSON.parse(r.request().postData()!).tipo }) });
  await botaoPonto(page).click();
  await expect(page.locator('.ponto__opcoes button')).toHaveCount(2);
  await page.getByRole('button', { name: 'Saída' }).click();
  await expect(page.locator('.ponto__tipo')).toHaveText('Saída');
});

test('acessibilidade da tela inicial', async ({ page }) => {
  await api(page, {});
  await expect(botaoPonto(page)).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});
