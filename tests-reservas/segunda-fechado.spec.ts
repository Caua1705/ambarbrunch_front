// Segunda-feira fechado (08/11/2026): a regra de datas da comanda e a última trava do envio, sem navegador.
// O calendário, o aviso e o fluxo completo estão em reserva-api.spec.ts.
import { test, expect } from '@playwright/test';
import { dataPermitida, ehSegunda, MSG_SEGUNDA, primeiraDataAberta } from '../src/lib/reservas/datas';
import { criarApiHttp } from '../src/lib/reservas/http';
import { ErroReserva } from '../src/lib/reservas/contrato';

test.describe.configure({ mode: 'serial' });

test('ehSegunda conta pelo calendário da própria data, não pelo fuso de quem roda', () => {
  for (const d of ['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07', '2027-01-04']) expect(ehSegunda(d), d).toBe(true);
  for (const d of ['2026-11-08', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']) expect(ehSegunda(d), d).toBe(false);
});

test('dataPermitida: segunda nunca; terça a domingo seguem a janela de sempre', () => {
  const hoje = new Date(2026, 9, 28); // 28/10/2026 em Fortaleza
  expect(dataPermitida('2026-11-09', hoje, 60)).toBe(false); // abertura no backend, mas é segunda
  expect(dataPermitida('2026-11-16', hoje, 60)).toBe(false);
  for (const d of ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-17']) expect(dataPermitida(d, hoje, 60), d).toBe(true);
  expect(dataPermitida('2026-11-08', hoje, 60)).toBe(false); // antes da abertura (regra antiga, intacta)
  expect(dataPermitida('2026-12-28', hoje, 60)).toBe(false); // fora da janela de 60 dias (regra antiga, intacta)
  expect(dataPermitida('2026-11-14', hoje, 60, new Set(['2026-11-14']))).toBe(false); // dia fechado pela API (intacta)
});

test('primeira data aberta pula a segunda: 10/11 a partir de 28/10; hoje mesmo quando é terça a domingo', () => {
  expect(primeiraDataAberta(new Date(2026, 9, 28))).toBe('2026-11-10');
  expect(primeiraDataAberta(new Date(2026, 10, 9))).toBe('2026-11-10');
  expect(primeiraDataAberta(new Date(2026, 10, 15))).toBe('2026-11-15');
  expect(primeiraDataAberta(new Date(2026, 10, 16))).toBe('2026-11-17');
});

test('cliente da API: reserva numa segunda é recusada antes de qualquer pedido de rede', async () => {
  const original = globalThis.fetch;
  let pedidos = 0;
  globalThis.fetch = (async () => { pedidos++; throw new Error('não devia chamar a rede'); }) as typeof fetch;
  try {
    const api = criarApiHttp('http://reservas-api.teste.invalid');
    const pedido = { ambienteId: 'salao', pessoas: 2, data: '2026-11-16', hora: '09:00', nome: 'Maria Teste', telefone: '85987654321', consentimentoPrivacidade: true as const, origem: 'site' as const };
    const erro = await api.criar(pedido, 'chave-teste').then(() => null, (e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroReserva);
    expect((erro as ErroReserva).tipo).toBe('validacao');
    expect((erro as ErroReserva).message).toBe(MSG_SEGUNDA);
    expect((erro as ErroReserva).campos.data).toBe(MSG_SEGUNDA);
    expect(pedidos).toBe(0);
  } finally {
    globalThis.fetch = original;
  }
});
