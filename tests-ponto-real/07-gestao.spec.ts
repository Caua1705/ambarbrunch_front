// Gestão com o backend real, depois da jornada de 01: assistido, correção, auditoria, permissões, tablets e telas.
import { test, expect } from '@playwright/test';
import { API, botaoPonto, diasAtras, entrar, hojeFortaleza, novoTablet, parearPorCodigo, semRolagemHorizontal, tokenPainel } from './apoio';

const cab = (t: string) => ({ Authorization: `Bearer ${t}` });

async function criarPessoa(request: Parameters<typeof tokenPainel>[0], nome: string): Promise<string> {
  const token = await tokenPainel(request, 'dono');
  const r = await request.post(`${API}/admin/ponto/funcionarios`, { headers: cab(token), data: { nome_completo: nome, nome_exibicao: nome.split(' ')[0], cargo: 'Atendente', data_admissao: diasAtras(3) } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()).id;
}

test.describe.serial('Gestão', () => {
  test('15. registro assistido exige gestor, justificativa e usa a hora do servidor', async ({ page, request }) => {
    await criarPessoa(request, 'Bia Assistida');
    await entrar(page, 'gerente');
    await page.goto('/admin/equipe');
    await page.getByRole('button', { name: 'Registro assistido' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Registro assistido' });
    await dialogo.getByLabel('Funcionário').selectOption({ label: 'Bia Assistida' });
    const registrar = dialogo.getByRole('button', { name: 'Registrar agora' });
    await expect(registrar).toBeDisabled();
    await dialogo.getByLabel('Justificativa').fill('Tablet com a câmera apagada.');
    await registrar.click();
    await expect(page.getByText(/Entrada registrada às/)).toBeVisible();
  });

  test('14 e 16. jornada incompleta aparece para revisão e a correção mantém a original', async ({ page, request }) => {
    const id = await criarPessoa(request, 'Caio Incompleto');
    const token = await tokenPainel(request, 'gerente');
    const ontem = diasAtras(2);
    const inclusao = await request.post(`${API}/admin/ponto/ajustes`, { headers: { ...cab(token), 'Idempotency-Key': `incl-${Date.now()}` }, data: { tipo: 'inclusao', funcionario_id: id, tipo_batida: 'ENTRADA', instante: `${ontem}T09:00:00-03:00`, justificativa: 'Preparando jornada sem saída.' } });
    expect(inclusao.ok(), await inclusao.text()).toBeTruthy();

    await entrar(page, 'gerente');
    await page.goto('/admin/equipe?aba=correcoes');
    const fila = page.getByRole('list', { name: 'Precisam de revisão' });
    await expect(fila).toContainText('Caio');
    await fila.getByRole('button', { name: 'Abrir' }).first().click();

    await page.getByRole('button', { name: 'Corrigir', exact: true }).click();
    const dialogo = page.getByRole('dialog', { name: 'Corrigir marcação' });
    await dialogo.getByLabel('Data e hora').fill(`${ontem}T09:10`);
    const confirmar = dialogo.getByRole('button', { name: 'Confirmar correção' });
    await expect(confirmar).toBeDisabled();
    await dialogo.getByLabel('Justificativa').fill('Horário anotado errado pela gerência.');
    await confirmar.click();
    await expect(page.getByText('Correção registrada.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Marcações' })).toContainText('substituída ou anulada');
    await expect(page.getByRole('list', { name: 'Correções feitas' })).toContainText('Gerente');
    await expect(page.getByRole('list', { name: 'Correções feitas' })).toContainText('Horário anotado errado');

    await page.getByRole('button', { name: 'Incluir batida' }).click();
    const incluir = page.getByRole('dialog', { name: 'Incluir batida esquecida' });
    await incluir.getByLabel('Tipo').selectOption('SAIDA');
    await incluir.getByLabel('Data e hora').fill(`${ontem}T17:00`);
    await incluir.getByLabel('Justificativa').fill('Esqueceu de registrar a saída.');
    await incluir.getByRole('button', { name: 'Confirmar correção' }).click();
    await expect(page.getByText('Correção registrada.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Marcações' })).toContainText('Saída');
  });

  test('17. auditoria mostra quem fez, só para o Proprietário', async ({ page }) => {
    await entrar(page, 'dono');
    await page.goto('/admin/equipe?aba=auditoria');
    const tabela = page.getByRole('table', { name: 'Auditoria' });
    await expect(tabela).toContainText('Gerente');
    await page.getByLabel('Área').selectOption('equipe_dispositivo');
    await expect(tabela).toContainText('Dono');
  });

  test('atribuição futura se desfaz pela tela e a pessoa volta à escala anterior', async ({ page, request }) => {
    const id = await criarPessoa(request, 'Fábio Escala');
    const token = await tokenPainel(request, 'gerente');
    const hoje = hojeFortaleza();
    const daqui = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date(Date.now() + 5 * 86_400_000));
    const versao = (entrada: string, saida: string) => ({
      vigente_de: hoje,
      dias: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), { entrada, saida, intervalos: [] }])),
      tolerancia_entrada_min: 10, tolerancia_saida_min: 10, tolerancia_intervalo_min: 0, intervalos_adicionais: false,
    });
    const escala = async (nome: string, entrada: string, saida: string) => {
      const r = await request.post(`${API}/admin/ponto/escalas`, { headers: cab(token), data: { nome, tipo: 'fixa', valida_de: hoje, versao: versao(entrada, saida) } });
      expect(r.ok(), await r.text()).toBeTruthy();
      return (await r.json()).id as string;
    };
    const manha = await escala(`Manhã ${Date.now()}`, '08:00', '16:00');
    const tarde = `Tarde ${Date.now()}`;
    const tardeId = await escala(tarde, '14:00', '22:00');
    for (const [e, de] of [[manha, hoje], [tardeId, daqui]]) {
      const r = await request.post(`${API}/admin/ponto/escalas/${e}/atribuicoes`, { headers: cab(token), data: { funcionario_id: id, vigente_de: de } });
      expect(r.ok(), await r.text()).toBeTruthy();
    }

    await entrar(page, 'gerente');
    await page.goto('/admin/equipe?aba=escalas');
    await page.getByText('Escalas cadastradas', { exact: true }).first().click();
    const item = page.getByRole('listitem').filter({ hasText: tarde });
    await expect(item).toContainText('Fábio entra a partir de');
    await item.getByRole('button', { name: 'Desfazer' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Desfazer a atribuição de Fábio' });
    await dialogo.getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.getByText('Atribuição desfeita.')).toBeVisible();
    await expect(item).not.toContainText('Fábio');
    const [turno] = await (await request.get(`${API}/admin/ponto/programacao`, { headers: cab(token), params: { de: daqui, ate: daqui, funcionario_id: id } })).json();
    expect(String(turno.entrada)).toContain('T08:00');
  });

  test('previsão errada de um dia trabalhado se corrige pela tela, com motivo', async ({ page, request }) => {
    const id = await criarPessoa(request, 'Eva Previsao');
    const token = await tokenPainel(request, 'gerente');
    const dia = diasAtras(2);
    for (const [tipo, hora] of [['ENTRADA', '09:00'], ['SAIDA', '17:00']]) {
      const r = await request.post(`${API}/admin/ponto/ajustes`, {
        headers: { ...cab(token), 'Idempotency-Key': `prev-${tipo}-${Date.now()}` },
        data: { tipo: 'inclusao', funcionario_id: id, tipo_batida: tipo, instante: `${dia}T${hora}:00-03:00`, justificativa: 'Preparando um dia trabalhado.' },
      });
      expect(r.ok(), await r.text()).toBeTruthy();
    }
    await entrar(page, 'gerente');
    await page.goto(`/admin/equipe?aba=registros&funcionario=${id}`);
    await page.getByRole('row').filter({ hasText: 'Eva' }).filter({ hasText: '17:00' }).click();
    await page.getByRole('button', { name: 'Corrigir previsão' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Corrigir previsão do dia' });
    await dialogo.getByLabel('Entrada').fill('09:00');
    await dialogo.getByLabel('Saída').fill('17:00');
    const confirmar = dialogo.getByRole('button', { name: 'Confirmar correção' });
    await expect(confirmar).toBeDisabled();
    await dialogo.getByLabel('Motivo').fill('Plantão combinado e não lançado na escala.');
    await confirmar.click();
    await expect(page.getByText('Previsão corrigida.')).toBeVisible();
    await expect(page.getByText('Previsto nesta jornada: 09:00 às 17:00')).toBeVisible();
  });

  test('3. inativar exige motivo e tira a pessoa da lista de ativos', async ({ page, request }) => {
    await criarPessoa(request, 'Davi Inativar');
    await entrar(page, 'gerente');
    await page.goto('/admin/equipe?aba=funcionarios');
    await page.getByRole('cell', { name: 'Davi Inativar' }).click();
    await page.getByRole('button', { name: 'Inativar' }).click();
    const dialogo = page.getByRole('alertdialog');
    await expect(dialogo.getByLabel('Data do desligamento')).toHaveValue(hojeFortaleza());
    await dialogo.getByLabel('Motivo').fill('Fim do contrato');
    await dialogo.getByRole('button', { name: 'Inativar' }).click();
    await expect(page.getByText('Funcionário inativado.')).toBeVisible();
    await page.getByRole('dialog', { name: 'Davi Inativar' }).getByRole('button', { name: 'Fechar' }).click();
    await expect(page.getByRole('cell', { name: 'Davi Inativar' })).toHaveCount(0);
  });

  test('23. gerente não vê rosto, tablets nem auditoria, e a API confirma', async ({ page, request }) => {
    await entrar(page, 'gerente');
    await page.goto('/admin/equipe?aba=funcionarios');
    await expect(page.getByRole('tab', { name: 'Funcionários' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Tablets' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Auditoria' })).toHaveCount(0);
    await page.getByRole('cell', { name: 'Ana Homolog' }).click();
    await expect(page.getByRole('link', { name: /rosto|Recadastrar/i })).toHaveCount(0);
    await page.goto('/admin/equipe/cadastro-facial?funcionario=x');
    await expect(page.getByRole('heading', { name: 'Sem acesso' }).or(page.getByText('não tem acesso'))).toBeVisible();
    const token = await tokenPainel(request, 'gerente');
    expect((await request.get(`${API}/admin/ponto/dispositivos`, { headers: cab(token) })).status()).toBe(403);
  });

  test('23. atendente não entra em Equipe', async ({ page, request }) => {
    await entrar(page, 'atendente');
    await page.goto('/admin/reservas');
    await expect(page.getByRole('link', { name: 'Equipe' })).toHaveCount(0);
    await page.goto('/admin/equipe');
    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveCount(0);
    const token = await tokenPainel(request, 'atendente');
    expect((await request.get(`${API}/admin/ponto/funcionarios`, { headers: cab(token) })).status()).toBe(403);
  });

  test('câmera liberada só no cadastro facial', async ({ page }) => {
    await entrar(page, 'dono');
    const pagina = await page.goto('/admin/equipe');
    expect(pagina!.headers()['permissions-policy']).toContain('camera=()');
    const cadastro = await page.goto('/admin/equipe/cadastro-facial');
    expect(cadastro!.headers()['permissions-policy']).toContain('camera=(self)');
    expect(cadastro!.headers()['content-security-policy']).toContain(new URL(API).origin);
    expect(pagina!.headers()['content-security-policy']).not.toContain(new URL(API).origin);
  });

  test('21. tablet sem autorização não vê o botão', async ({ page }) => {
    await page.goto('/ponto/');
    await expect(page.getByRole('heading', { name: 'Tablet não autorizado' })).toBeVisible();
    await expect(botaoPonto(page)).toHaveCount(0);
    await page.getByLabel('Código do tablet').fill('ambar_tablet_invalido');
    await page.getByRole('button', { name: 'Autorizar tablet' }).click();
    await expect(page.getByText('Código não reconhecido')).toBeVisible();
  });

  test('18. tablet revogado para na hora', async ({ page, request }) => {
    const tablet = await novoTablet(request, `Tablet revogar ${Date.now()}`);
    await parearPorCodigo(page, tablet.token);
    const token = await tokenPainel(request, 'dono');
    const r = await request.post(`${API}/admin/ponto/dispositivos/${tablet.id}/revogar`, { headers: cab(token), data: { motivo: 'Aparelho extraviado' } });
    expect(r.ok()).toBeTruthy();
    await botaoPonto(page).click();
    await expect(page.getByRole('heading', { name: 'Tablet não autorizado' })).toBeVisible();
  });

  test('20. sem internet, nada aparece como registrado', async ({ page, context, request }) => {
    await parearPorCodigo(page, (await novoTablet(request, `Tablet offline ${Date.now()}`)).token);
    await context.setOffline(true);
    await botaoPonto(page).click();
    await expect(page.locator('.ponto__cartao')).toContainText('Sem internet');
    await expect(page.locator('.ponto__cartao')).toContainText('não foi registrado');
    await expect(page.locator('.ponto__recibo')).toHaveCount(0);
    await context.setOffline(false);
  });

  test('25. /ponto cabe no tablet deitado e em pé', async ({ page, request }) => {
    await parearPorCodigo(page, (await novoTablet(request, `Tablet tela ${Date.now()}`)).token);
    for (const viewport of [{ width: 1280, height: 800 }, { width: 800, height: 1280 }, { width: 600, height: 960 }]) {
      await page.setViewportSize(viewport);
      await expect(botaoPonto(page)).toBeInViewport();
      expect(await semRolagemHorizontal(page)).toBe(true);
      const caixa = await botaoPonto(page).boundingBox();
      expect(caixa!.height).toBeGreaterThanOrEqual(80);
    }
  });

  test('24. navegação no celular, sem rolagem horizontal em nenhuma aba', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await entrar(page, 'dono');
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await page.getByRole('link', { name: 'Equipe' }).click();
    await expect(page.getByRole('tab', { name: 'Hoje' })).toBeVisible();
    for (const aba of ['hoje', 'funcionarios', 'escalas', 'registros', 'correcoes', 'tablets', 'auditoria']) {
      await page.goto(`/admin/equipe?aba=${aba}`);
      await expect(page.getByRole('tabpanel')).toBeVisible();
      await page.waitForTimeout(400);
      expect(await semRolagemHorizontal(page), aba).toBe(true);
    }
  });

  test('visão de hoje traz os números do backend', async ({ page, request }) => {
    const token = await tokenPainel(request, 'dono');
    const painel = await (await request.get(`${API}/admin/ponto/painel`, { headers: cab(token) })).json();
    await entrar(page, 'dono');
    await page.goto('/admin/equipe');
    const cartao = page.locator('.indicador', { hasText: 'Funcionários ativos' });
    await expect(cartao).toContainText(String(painel.indicadores.funcionarios_ativos));
    expect(painel.data).toBe(hojeFortaleza());
  });
});
