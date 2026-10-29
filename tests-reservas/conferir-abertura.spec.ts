// O script de conferência da abertura (scripts/conferir-abertura-reservas.mjs) contra APIs locais mínimas:
// abertura em 03/11 (configuração incorreta), em 09/11 (pronto), versão da política, reservas fechadas, erro 500 e sem conexão.
import { test, expect } from '@playwright/test';
import http from 'node:http';
import { execFile } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const somar = (iso: string, n: number) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n, 12)).toISOString().slice(0, 10);
};

/** Política do site para o script: aprovada e na versão dada (a do repositório ainda está aprovada: false). */
function politica(versao: string, aprovada = true) {
  const arquivo = join(mkdtempSync(join(tmpdir(), 'politica-')), 'privacidade.ts');
  writeFileSync(arquivo, `export const privacidade = {
  aprovada: ${aprovada},
  versao: 'Versão ${versao}' as string,
};
`);
  return arquivo;
}

function servidor(tipo: 'abertura' | 'fechada' | 'erro500' | 'quebrada', abertura = '2026-11-09', versao = '2026-11-v1'): Promise<{ url: string; fechar: () => void }> {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
  const fechadas = Array.from({ length: 61 }, (_, i) => somar(hoje, i)).filter((d) => d < abertura);
  const s = http.createServer((q, r) => {
    const u = new URL(q.url!, 'http://x');
    r.setHeader('content-type', 'application/json');
    if (tipo === 'fechada') { r.statusCode = 503; return r.end(JSON.stringify({ detail: 'Reservas online indisponíveis no momento.', codigo: 'reservas_indisponiveis' })); }
    if (tipo === 'erro500') { r.statusCode = 500; return r.end(JSON.stringify({ detail: 'erro' })); }
    if (u.pathname === '/reservas/config') return r.end(JSON.stringify({ ambientes: ['jardim', 'salao'].map((id) => ({ id, nome: id, capacidadeMax: 20, pessoasMax: 20, datasFechadas: fechadas })), antecedencia: { diasMax: 60, horasMin: 2 }, fusoHorario: 'America/Fortaleza', privacidadeVersao: versao }));
    if (tipo === 'quebrada') { r.statusCode = 502; return r.end('<html>bad gateway</html>'); }
    const d = u.searchParams.get('data')!;
    r.end(JSON.stringify({ data: d, horarios: d < abertura ? [] : [{ hora: '07:00', disponivel: true }] }));
  });
  return new Promise((ok) => s.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, fechar: () => s.close() })));
}

/** Assíncrono: o servidor de teste roda neste mesmo processo e precisa continuar respondendo enquanto o script roda. */
const rodar = (api: string, arquivoPolitica = politica('2026-11-v1')) =>
  new Promise<{ status: number | null; stdout: string }>((ok) => {
    execFile(process.execPath, ['scripts/conferir-abertura-reservas.mjs', '--api', api, '--politica', arquivoPolitica], { encoding: 'utf8', timeout: 60_000 }, (erro, stdout) => {
      ok({ status: erro ? (typeof erro.code === 'number' ? erro.code : null) : 0, stdout });
    });
  });

test.describe.configure({ mode: 'serial' });
test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || !!isMobile, 'script de Node: roda uma vez só');

test('backend com abertura em 03/11: configuração incorreta (saída 1), aponta 03 a 08/11', async () => {
  const s = await servidor('abertura', '2026-11-03');
  const r = await rodar(s.url);
  s.fechar();
  expect(r.status).toBe(1);
  expect(r.stdout).toContain('CONFIGURAÇÃO INCORRETA');
  expect(r.stdout).toContain('2026-11-03, 2026-11-04, 2026-11-05, 2026-11-06, 2026-11-07, 2026-11-08');
});

test('backend com abertura em 06/11 (decisão antiga): configuração incorreta, aponta 06 a 08/11', async () => {
  const s = await servidor('abertura', '2026-11-06');
  const r = await rodar(s.url);
  s.fechar();
  expect(r.status).toBe(1);
  expect(r.stdout).toContain('2026-11-06, 2026-11-07, 2026-11-08');
});

test('backend com abertura em 09/11: pronto (saída 0)', async () => {
  const s = await servidor('abertura', '2026-11-09');
  const r = await rodar(s.url);
  s.fechar();
  expect(r.status).toBe(0);
  expect(r.stdout).toContain('primeira data aberta 2026-11-09');
});

test('política: versão do backend diferente da do site, ou site sem aprovar: configuração incorreta (saída 1)', async () => {
  const s = await servidor('abertura', '2026-11-09', '2026-10');
  const diferente = await rodar(s.url);
  expect(diferente.status).toBe(1);
  expect(diferente.stdout).toContain('versão da política diferente: backend "2026-10", site "2026-11-v1"');
  const semAprovar = await rodar(s.url, politica('2026-10', false));
  s.fechar();
  expect(semAprovar.status).toBe(1);
  expect(semAprovar.stdout).toContain('aprovada: false');
});

test('reservas fechadas na API: saída 2', async () => {
  const s = await servidor('fechada');
  const r = await rodar(s.url);
  s.fechar();
  expect(r.status).toBe(2);
  expect(r.stdout).toContain('FECHADA');
});

test('falha de comunicação: 500, resposta sem JSON e sem conexão dão saída 3 (nunca "pronto")', async () => {
  for (const tipo of ['erro500', 'quebrada'] as const) {
    const s = await servidor(tipo);
    const r = await rodar(s.url);
    s.fechar();
    expect(r.status, tipo).toBe(3);
    expect(r.stdout, tipo).toContain('FALHA DE COMUNICAÇÃO');
  }
  const semNinguem = await rodar('http://127.0.0.1:9');
  expect(semNinguem.status).toBe(3);
});
