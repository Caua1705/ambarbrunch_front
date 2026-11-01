// Apoio dos testes do painel contra o backend REAL local (playwright.painel-real.config.ts). As contas, a senha de teste e
// os ids dos cenários vêm do JSON do seed (PAINEL_REAL_CENARIOS), que fica FORA do repositório: nada disso vai para o git.
import fs from 'node:fs';
import type { Page } from '@playwright/test';

export const PAINEL = 'http://127.0.0.1:4494';

interface Cenarios {
  senha: string;
  contas: Record<'dono' | 'gerente' | 'tecnica' | 'atendente', string>;
  unidades: Record<string, number>;
  cenarios: {
    b1: { comprovante_id: string; pagamento_existente_id: string };
    b2: { arquivo: string; arquivo_id: string };
    sem_categoria: { despesa_id: string };
    b3: { compra_parecida_id: string; pix_despesa_id: string };
    pix_divergencia: { pix_despesa_id: string; pendencia_compra_id: string; valor_pago: string };
  };
  clube: { vendas_cafe: string[]; vendas_noite: string[] };
}

const caminho = process.env.PAINEL_REAL_CENARIOS;
if (!caminho) throw new Error('Defina PAINEL_REAL_CENARIOS (JSON do seed do backend local).');
export const SEED: Cenarios = JSON.parse(fs.readFileSync(caminho, 'utf8'));

export const escrever = { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: PAINEL };

/** Login real (o painel repassa ao backend em POST /admin/auth/login). */
export async function entrar(page: Page, conta: keyof Cenarios['contas']) {
  const r = await page.request.post(`${PAINEL}/admin/api/sessao`, { headers: escrever, data: { email: SEED.contas[conta], senha: SEED.senha } });
  if (!r.ok()) throw new Error(`login ${conta} falhou: ${r.status()}`);
}
