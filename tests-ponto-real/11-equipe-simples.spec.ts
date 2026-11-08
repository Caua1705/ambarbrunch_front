// Equipe em três abas, contra o backend real: cadastro com dias e horários na ficha (sobre as escalas e atribuições que já
// existem, sem duplicar), horário compartilhado, Registros com revisão e correções, Tablets e Auditoria em Configurações,
// endereços antigos e o formulário no tablet. Roda depois de 07 (projeto painel), no mesmo banco descartável.
import { test, expect, type APIRequestContext } from '@playwright/test';
import { API, entrar, hojeFortaleza, semRolagemHorizontal, tokenPainel } from './apoio';

const cab = (t: string) => ({ Authorization: `Bearer ${t}` });
const sufixo = String(Date.now()).slice(-6);
const amanha = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date(Date.now() + 86_400_000));

type Escala = { id: string; nome: string; funcionarios_ids: string[]; atribuicoes: { funcionario_id: string; vigente_de: string }[]; versoes: { vigente_de: string; dias: Record<string, { entrada: string; saida: string; intervalos: { inicio: string; fim: string }[] }> }[] };

async function api(request: APIRequestContext) {
  const token = await tokenPainel(request, 'gerente');
  return {
    // A API devolve horas como "HH:MM:SS"; a tela trabalha com "HH:MM". Normaliza para comparar o que a pessoa digitou.
    escalas: async () => {
      const lista = (await (await request.get(`${API}/admin/ponto/escalas`, { headers: cab(token) })).json()) as Escala[];
      const hm = (s: string) => (s ? s.slice(0, 5) : s);
      for (const e of lista) for (const v of e.versoes) for (const d of Object.values(v.dias)) {
        d.entrada = hm(d.entrada);
        d.saida = hm(d.saida);
        d.intervalos = (d.intervalos ?? []).map((i) => ({ inicio: hm(i.inicio), fim: hm(i.fim) }));
      }
      return lista;
    },
    pessoa: async (nome: string) => {
      const r = await request.get(`${API}/admin/ponto/funcionarios`, { headers: cab(token), params: { busca: nome } });
      return ((await r.json()).itens as { id: string; nome_completo: string; nome_exibicao: string; escala: { escala_id: string; vigente_de: string } | null }[]).find((f) => f.nome_completo === nome)!;
    },
    criarPessoa: async (nome: string) => {
      const r = await request.post(`${API}/admin/ponto/funcionarios`, { headers: cab(token), data: { nome_completo: nome, nome_exibicao: nome.split(' ')[0], cargo: 'Salão', data_admissao: hojeFortaleza() } });
      expect(r.ok(), await r.text()).toBeTruthy();
      return (await r.json()).id as string;
    },
    criarEscala: async (nome: string) => {
      const dias = Object.fromEntries([0, 1, 2, 3, 4].map((d) => [String(d), { entrada: '10:00', saida: '18:00', intervalos: [] }]));
      const r = await request.post(`${API}/admin/ponto/escalas`, { headers: cab(token), data: { nome, tipo: 'fixa', valida_de: hojeFortaleza(), versao: { vigente_de: hojeFortaleza(), dias, tolerancia_entrada_min: 10, tolerancia_saida_min: 10, tolerancia_intervalo_min: 0, intervalos_adicionais: false } } });
      expect(r.ok(), await r.text()).toBeTruthy();
      return (await r.json()).id as string;
    },
    atribuir: async (escala: string, pessoa: string) => {
      const r = await request.post(`${API}/admin/ponto/escalas/${escala}/atribuicoes`, { headers: cab(token), data: { funcionario_id: pessoa, vigente_de: hojeFortaleza() } });
      expect(r.ok(), await r.text()).toBeTruthy();
    },
    espelho: async (params: Record<string, string>) => (await (await request.get(`${API}/admin/ponto/relatorios/espelho`, { headers: cab(token), params })).json()) as { total: number },
  };
}

const GIL = `Gil Horário ${sufixo}`;

test.describe.serial('Equipe simplificada', () => {
  test('três abas: Hoje, Funcionários e Registros', async ({ page }) => {
    await entrar(page, 'dono');
    await page.goto('/admin/equipe');
    await expect(page.getByRole('tab')).toHaveText([/^Hoje/, /^Funcionários/, /^Registros/]);
    for (const antiga of ['Escalas', 'Correções', 'Tablets', 'Auditoria']) await expect(page.getByRole('tab', { name: antiga })).toHaveCount(0);
  });

  test('cadastro: nome, função, dias e horários; nome no tablet gerado e uma escala só da pessoa', async ({ page, request }) => {
    await entrar(page, 'gerente');
    await page.goto('/admin/equipe?aba=funcionarios');
    await page.getByRole('button', { name: 'Novo funcionário' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Novo funcionário' });
    await gaveta.getByLabel('Nome completo').fill(GIL);
    await gaveta.getByLabel('Função').fill('Cozinha');
    for (const dia of ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']) await gaveta.getByRole('button', { name: dia, exact: true }).click();
    await expect(gaveta.getByRole('button', { name: 'Sábado' })).toHaveAttribute('aria-pressed', 'false');
    await gaveta.getByLabel('Entrada', { exact: true }).fill('08:00');
    await gaveta.getByLabel('Saída', { exact: true }).fill('16:00');
    await expect(gaveta.getByLabel('Início do intervalo')).toHaveCount(0);
    await gaveta.getByText('Dados adicionais').click();
    await expect(gaveta.getByLabel('Nome no tablet')).toHaveValue('Gil');
    await expect(gaveta.getByLabel('Data de admissão')).toHaveValue(hojeFortaleza());
    await gaveta.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Funcionário cadastrado com os dias e horários.')).toBeVisible();
    const ficha = page.getByRole('dialog', { name: GIL });
    await expect(ficha).toContainText('Seg a Sex, 08:00–16:00');
    for (const acao of ['Editar', 'Dias e horários', 'Histórico']) await expect(ficha.getByRole('button', { name: acao })).toBeVisible();

    const a = await api(request);
    const gil = await a.pessoa(GIL);
    expect(gil.nome_exibicao).toBe('Gil');
    const minhas = (await a.escalas()).filter((e) => e.nome.startsWith(`Horário de ${GIL}`));
    expect(minhas).toHaveLength(1);
    expect(minhas[0].funcionarios_ids).toEqual([gil.id]);
    expect(Object.keys(minhas[0].versoes[0].dias).sort()).toEqual(['0', '1', '2', '3', '4']);
    expect(minhas[0].versoes[0].dias['0'].intervalos).toEqual([]);
  });

  test('dias e horários na ficha: horário diferente no sábado e intervalo, sem criar outra escala', async ({ page, request }) => {
    await entrar(page, 'gerente');
    const gil = await (await api(request)).pessoa(GIL);
    await page.goto(`/admin/equipe?aba=funcionarios&funcionario=${gil.id}`);
    await page.getByRole('dialog', { name: GIL }).getByRole('button', { name: 'Dias e horários' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Dias e horários' });
    await expect(gaveta).toContainText('Hoje: Seg a Sex, 08:00–16:00');
    await gaveta.getByRole('button', { name: 'Sábado' }).click();
    await gaveta.getByLabel('Mesmo horário em todos os dias').uncheck();
    await gaveta.getByLabel('Sábado: entrada').fill('09:00');
    await gaveta.getByLabel('Sábado: saída').fill('13:00');
    await gaveta.getByLabel('Tem intervalo previsto').check();
    await gaveta.getByLabel('Segunda: início do intervalo').fill('12:00');
    await gaveta.getByLabel('Segunda: fim do intervalo').fill('13:00');
    await gaveta.getByRole('button', { name: 'Salvar horário' }).click();
    await expect(page.getByText('Horário salvo.')).toBeVisible();
    await expect(page.getByRole('dialog', { name: GIL })).toContainText('Seg a Sex, 08:00–16:00 · Sáb, 09:00–13:00');

    const minhas = (await (await api(request)).escalas()).filter((e) => e.nome.startsWith(`Horário de ${GIL}`));
    expect(minhas, 'a mesma escala recebe nova versão, sem duplicar').toHaveLength(1);
    const dias = minhas[0].versoes[0].dias;
    expect(dias['5']).toMatchObject({ entrada: '09:00', saida: '13:00' });
    expect(dias['0'].intervalos).toEqual([{ inicio: '12:00', fim: '13:00' }]);
    expect(dias['1'].intervalos).toEqual([]);
  });

  test('horário pela metade não salva e diz o que falta', async ({ page, request }) => {
    await entrar(page, 'gerente');
    const gil = await (await api(request)).pessoa(GIL);
    await page.goto(`/admin/equipe?aba=funcionarios&funcionario=${gil.id}`);
    await page.getByRole('dialog', { name: GIL }).getByRole('button', { name: 'Dias e horários' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Dias e horários' });
    for (const dia of ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']) await gaveta.getByRole('button', { name: dia, exact: true }).click();
    await gaveta.getByRole('button', { name: 'Salvar horário' }).click();
    await expect(gaveta.getByText('Marque pelo menos um dia de trabalho.')).toBeVisible();
  });

  test('horário compartilhado: mudar na ficha cria um horário próprio e não mexe nos outros', async ({ page, request }) => {
    const a = await api(request);
    const compartilhada = `Salão ${sufixo}`;
    const escala = await a.criarEscala(compartilhada);
    const ivo = await a.criarPessoa(`Ivo Compartilha ${sufixo}`);
    const lia = await a.criarPessoa(`Lia Compartilha ${sufixo}`);
    await a.atribuir(escala, ivo);
    await a.atribuir(escala, lia);

    await entrar(page, 'gerente');
    await page.goto(`/admin/equipe?aba=funcionarios&funcionario=${ivo}`);
    await page.getByRole('dialog', { name: `Ivo Compartilha ${sufixo}` }).getByRole('button', { name: 'Dias e horários' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Dias e horários' });
    await expect(gaveta).toContainText(`horário compartilhado “${compartilhada}”, junto com Lia`);
    await gaveta.getByLabel('Saída', { exact: true }).fill('19:00');
    await gaveta.getByRole('button', { name: 'Salvar horário' }).click();
    // Ivo entrou na escala hoje: trocar no mesmo dia esbarraria na sobreposição, então vale de amanhã.
    await expect(page.getByText(/Horário salvo\. Vale a partir de/)).toBeVisible();

    const escalas = await a.escalas();
    const original = escalas.find((e) => e.nome === compartilhada)!;
    expect(original.versoes).toHaveLength(1);
    expect(original.versoes[0].dias['0'].saida).toBe('18:00');
    expect(original.funcionarios_ids).toContain(lia);
    const propria = escalas.find((e) => e.nome === `Horário de Ivo Compartilha ${sufixo}`)!;
    expect(propria.versoes[0].dias['0']).toMatchObject({ entrada: '10:00', saida: '19:00' });
    expect(propria.atribuicoes).toEqual([expect.objectContaining({ funcionario_id: ivo, vigente_de: amanha() })]);
  });

  test('opções avançadas: usar um horário compartilhado, sem criar escala', async ({ page, request }) => {
    const a = await api(request);
    const nome = `Mel Avançada ${sufixo}`;
    const mel = await a.criarPessoa(nome);
    const antes = (await a.escalas()).length;
    await entrar(page, 'gerente');
    await page.goto(`/admin/equipe?aba=funcionarios&funcionario=${mel}`);
    await page.getByRole('dialog', { name: nome }).getByRole('button', { name: 'Dias e horários' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Dias e horários' });
    await expect(gaveta.getByLabel('Vale a partir de')).toBeHidden();
    await gaveta.getByText('Opções avançadas').click();
    await expect(gaveta.getByLabel('Vale a partir de')).toHaveValue(hojeFortaleza());
    const opcao = await gaveta.locator('option', { hasText: `Salão ${sufixo} (` }).getAttribute('value');
    await gaveta.getByLabel('Usar um horário compartilhado').selectOption(opcao!);
    await expect(gaveta.getByRole('group', { name: 'Dias de trabalho' })).toHaveCount(0);
    await gaveta.getByRole('button', { name: 'Salvar horário' }).click();
    await expect(page.getByText('Horário salvo.')).toBeVisible();
    const escalas = await a.escalas();
    expect(escalas).toHaveLength(antes);
    expect(escalas.find((e) => e.nome === `Salão ${sufixo}`)!.funcionarios_ids).toContain(mel);
  });

  test('editar não pede horário; dados adicionais guardam o contato; histórico registra o horário', async ({ page, request }) => {
    const gil = await (await api(request)).pessoa(GIL);
    await entrar(page, 'gerente');
    await page.goto(`/admin/equipe?aba=funcionarios&funcionario=${gil.id}`);
    const ficha = page.getByRole('dialog', { name: GIL });
    await ficha.getByRole('button', { name: 'Editar' }).click();
    const form = page.getByRole('dialog', { name: 'Editar funcionário' });
    await expect(form.getByRole('group', { name: 'Dias de trabalho' })).toHaveCount(0);
    await form.getByText('Dados adicionais').click();
    await form.getByLabel('Telefone').fill('85999990000');
    await form.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Cadastro atualizado.')).toBeVisible();
    await expect(ficha).toContainText('85999990000');
    await ficha.getByRole('button', { name: 'Histórico' }).click();
    const historico = page.getByRole('list', { name: 'Histórico do cadastro' });
    await expect(historico).toContainText('Dias e horários definidos');
    await expect(historico).toContainText('Dados alterados');
  });

  test('Registros: batidas, o que precisa de revisão e as correções feitas, na mesma aba', async ({ page, request }) => {
    const a = await api(request);
    const ate = hojeFortaleza();
    const de = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date(Date.now() - 30 * 86_400_000));
    const total = (await a.espelho({ de, ate, status: 'pendente_revisao' })).total + (await a.espelho({ de, ate, somente_a_conferir: 'true' })).total;
    await entrar(page, 'gerente');
    await page.goto('/admin/equipe?aba=registros');
    await expect(page.getByRole('tab', { name: /^Registros/ })).toHaveText(total ? `Registros${total}` : 'Registros');
    const vistas = page.getByRole('group', { name: 'Vista dos registros' });
    await expect(vistas.getByRole('button')).toHaveText(['Batidas', total ? `Para revisar${total}` : 'Para revisar', 'Correções feitas']);
    await expect(page.getByRole('table', { name: 'Registros de ponto' })).toBeVisible();
    await vistas.getByRole('button', { name: /^Para revisar/ }).click();
    await expect(page).toHaveURL(/vista=revisar/);
    await expect(page.getByRole('region', { name: 'Precisam de revisão' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Tipo a conferir' })).toBeVisible();
    await vistas.getByRole('button', { name: 'Correções feitas' }).click();
    // 07 corrigiu e incluiu batidas: o histórico mostra quem fez e a justificativa.
    const historico = page.getByRole('list', { name: 'Histórico de correções' });
    await expect(historico).toContainText('Gerente');
    await expect(historico).toContainText('Horário anotado errado');
  });

  test('endereços antigos levam ao novo lugar', async ({ page }) => {
    await entrar(page, 'dono');
    await page.goto('/admin/equipe?aba=escalas');
    await expect(page.getByRole('tab', { name: 'Funcionários' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Escalas cadastradas' })).toBeVisible();
    await page.goto('/admin/equipe?aba=correcoes');
    await expect(page.getByRole('tab', { name: /^Registros/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: /^Para revisar/ })).toHaveAttribute('aria-pressed', 'true');
    await page.goto('/admin/equipe?aba=tablets');
    await expect(page).toHaveURL(/\/admin\/configuracoes\?secao=ponto/);
    await expect(page.getByText('Tablets autorizados')).toBeVisible();
    await page.goto('/admin/equipe?aba=auditoria');
    await expect(page).toHaveURL(/secao=ponto&item=auditoria/);
    await expect(page.getByRole('table', { name: 'Auditoria' })).toBeVisible();
    // Tocar na aba atual volta à vista principal.
    await page.goto('/admin/equipe?aba=funcionarios&vista=escalas');
    await page.getByRole('tab', { name: 'Funcionários' }).click();
    await expect(page.getByRole('table', { name: 'Funcionários' })).toBeVisible();
    await expect(page).not.toHaveURL(/vista=/);
  });

  test('tablet em pé: formulário em uma coluna, controles de toque e área visível com o teclado', async ({ browser, request }) => {
    const contexto = await browser.newContext({ viewport: { width: 800, height: 1280 }, hasTouch: true, isMobile: true });
    const page = await contexto.newPage();
    await entrar(page, 'gerente');
    await page.goto('/admin/equipe?aba=funcionarios');
    await page.getByRole('button', { name: 'Novo funcionário' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Novo funcionário' });
    await gaveta.getByRole('button', { name: 'Segunda' }).tap();
    for (const alvo of [gaveta.getByRole('button', { name: 'Segunda' }), gaveta.getByLabel('Entrada', { exact: true }), gaveta.getByLabel('Nome completo')]) {
      expect((await alvo.boundingBox())!.height, 'alvo de toque').toBeGreaterThanOrEqual(44);
    }
    expect(await semRolagemHorizontal(page)).toBe(true);
    const caixa = await page.locator('.gaveta').boundingBox();
    const visivel = await page.evaluate(() => window.visualViewport!.height);
    expect(Math.abs(caixa!.height - visivel)).toBeLessThanOrEqual(2);
    await gaveta.getByLabel('Nome completo').fill(`Tablet Teste ${sufixo}`);
    await gaveta.getByLabel('Função').fill('Salão');
    await gaveta.getByLabel('Entrada', { exact: true }).fill('07:30');
    await gaveta.getByLabel('Saída', { exact: true }).fill('15:30');
    await gaveta.getByRole('button', { name: 'Salvar' }).tap();
    await expect(page.getByRole('dialog', { name: `Tablet Teste ${sufixo}` })).toContainText('Seg, 07:30–15:30');
    expect((await (await api(request)).pessoa(`Tablet Teste ${sufixo}`)).escala).not.toBeNull();
    await contexto.close();
  });
});
