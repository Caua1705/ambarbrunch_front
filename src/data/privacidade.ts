import { type Pendente } from '../lib/conteudo';

// Política de privacidade (LGPD) das RESERVAS do Âmbar Café. O texto é do controlador, que o aprova como responsável
// pela empresa (decisão de 29/10/2026: sem parecer jurídico; o site não afirma validação jurídica).
// Só entra aqui o que o sistema de fato faz (backend do Âmbar conferido em 29/10/2026: avisos ao grupo da regra f41d12f —
// cancelamento não vai ao grupo —, tabelas, n8n e fornecedores). O Clube Âmbar não entra nesta política.
// - texto simples: fato do sistema ou dado conferido;
// - `revisar(texto, nota)`: proposta que já aparece no texto, com a nota “Validar: …” só no modo de revisão
//   (bases legais, dispensa de encarregado, transferência internacional);
// - `pendente(...)`: decisão que ainda não existe — nunca inventar.
// Decisões do controlador em 29/10/2026: canal de privacidade = WhatsApp oficial do Âmbar; nenhuma exclusão ou
// anonimização automática e nenhum prazo fixo — a guarda é descrita como o sistema realmente funciona.
// Enquanto `aprovada` for false, a página não se diz aprovada (ver src/pages/privacidade.astro). A `versao` é a mesma
// que o backend registra com `app.cli aprovar-privacidade --versao` e grava em cada aceite. Análise completa e o que
// o backend precisa implementar: docs/technical/PRIVACIDADE-REVISAO.md.

export interface Revisar { revisar: string; texto: string }
const revisar = (texto: string, nota: string): Revisar => ({ texto, revisar: nota });
export const isRevisar = (v: unknown): v is Revisar => typeof v === 'object' && v !== null && 'revisar' in v;

type Texto = string | Revisar | Pendente;
export interface Secao { id: string; titulo: string; itens: Texto[] }

export const privacidade = {
  // aprovada pelo responsável pela GIARDIN CAFE BISTRO E BAR LTDA em 29/10/2026 (registro dele, não parecer jurídico)
  aprovada: true,
  versao: 'Versão 2026-11-v1' as string | Pendente,
  secoes: [
    {
      id: 'controlador', titulo: 'Quem é o responsável pelos seus dados',
      itens: [
        revisar('O responsável (controlador) pelos dados das reservas é a GIARDIN CAFE BISTRO E BAR LTDA, CNPJ 58.527.734/0001-03, que opera o Âmbar Café, na Rua Tavares Coutinho, 1580, Meireles, Fortaleza - CE, CEP 60160-130.',
          'razão social, CNPJ e endereço conferidos na base da Receita Federal (via BrasilAPI, 29/10/2026): a grafia registrada é GIARDIN, sem o I final, e o nome fantasia lá é GIARDIN CAFE — conferir com o contrato social'),
        'Esta política trata das reservas do Âmbar Café feitas por este site e das mensagens sobre essas reservas.',
        revisar('Por ser agente de tratamento de pequeno porte, o Âmbar Café não indicou encarregado pelo tratamento de dados (Resolução CD/ANPD nº 2/2022, art. 11). Pedidos e dúvidas sobre os seus dados vão pelo canal de privacidade abaixo.',
          'a dispensa vale para microempresa (a Receita registra MICRO EMPRESA, optante do Simples) que não faça tratamento de alto risco e não integre grupo econômico com receita global acima do limite da LC 123/2006 (art. 3º, II e III)'),
        'Canal de privacidade: o WhatsApp oficial do Âmbar, (85) 95855-0369. Escreva ali seus pedidos e dúvidas sobre os seus dados; a mensagem chega à equipe e você recebe uma resposta automática confirmando o recebimento.',
      ],
    },
    {
      id: 'reserva-dados', titulo: 'Dados da reserva',
      itens: [
        'Para registrar uma reserva pelo site, pedimos nome e telefone (WhatsApp); o e-mail, quando você informa; e, se você quiser, observações. Também guardamos o ambiente, a data, o horário e o número de pessoas.',
        'Guardamos o registro do seu aceite: data e hora, a versão deste texto e códigos derivados do endereço IP e do navegador. O IP e o navegador não ficam guardados em claro.',
        'Escreva nas observações só o necessário para a sua visita (por exemplo, uma restrição alimentar ou cadeirinha).',
      ],
    },
    {
      id: 'reserva-uso', titulo: 'Para que usamos os dados da reserva',
      itens: [
        'Para registrar, confirmar, alterar ou cancelar a reserva e preparar o atendimento no café.',
        'Para falar com você sobre essa reserva.',
        'Pelo WhatsApp oficial do Âmbar, você recebe mensagens só sobre a sua reserva: o aviso de que ela foi registrada e lembretes antes do horário. O lembrete da véspera traz os botões “confirmar presença” e “cancelar reserva”; o lembrete mais próximo leva a localização do café. Se responder a essas mensagens, a resposta fica registrada para a equipe atender.',
        'A equipe do café recebe, num grupo interno de WhatsApp, um aviso curto de cada reserva nova e, todo dia às 6h, a agenda das reservas do dia. Esses avisos levam primeiro nome, data, horário, ambiente, número de pessoas e, se houver, o começo das observações. Alterações e cancelamentos de reservas não geram aviso no grupo.',
        'O telefone não vai nesses avisos. A equipe só o vê no grupo quando a mensagem para você não puder ser entregue e for preciso falar com você diretamente, ou quando você escrever para o WhatsApp oficial do Âmbar: aí o aviso leva seu primeiro nome, seu telefone e o começo da sua mensagem, para a equipe responder.',
      ],
    },
    {
      id: 'bases', titulo: 'Por que podemos usar esses dados',
      itens: [
        revisar('Registrar e gerir a reserva, preparar o atendimento, enviar as mensagens e os lembretes da reserva e avisar a equipe: são etapas do serviço que você pediu (Lei 13.709/2018, art. 7º, V).',
          'base proposta: procedimentos preliminares e execução de contrato a pedido do titular'),
        revisar('Se você informar uma alergia, uma restrição alimentar ou outra informação de saúde, ela é usada só para atender você com segurança (art. 11, II, “e”).',
          'dado sensível; base proposta: proteção da vida e da incolumidade física. Alternativa: consentimento específico e destacado (art. 11, I), que exigiria mudar o formulário'),
        revisar('O registro do seu aceite e as proteções contra uso abusivo do sistema servem para comprovar o aceite e manter o serviço seguro (art. 7º, VI e IX).',
          'bases propostas: exercício regular de direitos (prova do aceite) e legítimo interesse (segurança)'),
        revisar('Quando você escreve para o WhatsApp oficial do Âmbar, usamos a mensagem para responder ao seu pedido (art. 7º, V, quando é sobre uma reserva; art. 7º, IX, nos demais casos).',
          'bases propostas: execução de contrato ou legítimo interesse, conforme o assunto'),
        revisar('A caixa marcada no formulário registra que você conhece esta política. Ela não é uma autorização para promoções.',
          'o formulário diz “Concordo com o uso dos meus dados para esta reserva”; vale como ciência. Outra redação seria mudança no formulário, fora desta etapa'),
      ],
    },
    {
      id: 'separados', titulo: 'O que a reserva não faz',
      itens: [
        'Os dados da reserva não são usados para enviar promoções ou novidades. Se o Âmbar passar a enviá-las, isso dependerá de uma autorização própria, separada da reserva (art. 7º, I), que você poderá retirar quando quiser.',
        'Reservar não inscreve você no Clube Âmbar. Depois da reserva, o site pode mostrar um convite para conhecer o Clube; ele é opcional e só abre a página do Clube, que não faz parte desta política.',
      ],
    },
    {
      id: 'compartilhamento', titulo: 'Com quem os dados são compartilhados',
      itens: [
        'Não vendemos nem cedemos seus dados. Eles são tratados, em nosso nome, por prestadores de serviço necessários para o sistema funcionar:',
        'Banco de dados: Supabase, com os dados guardados em São Paulo (Brasil).',
        revisar('Servidor do sistema de reservas e das automações (n8n): servidor virtual da Hostinger no Brasil.',
          'o bloco de IP do servidor está registrado no Brasil (RIPE, 29/10/2026); confirmar no painel da Hostinger a localização do datacenter'),
        'WhatsApp oficial para falar com você: WhatsApp Business Platform (Meta).',
        'Aviso interno à equipe: Z-API, que envia os avisos ao grupo pelo WhatsApp da equipe.',
        'Site: Vercel, que hospeda as páginas e registra dados técnicos de acesso, como o endereço IP. O formulário de reserva envia os dados direto ao sistema do Âmbar, sem passar pela Vercel.',
        revisar('A Meta e a Vercel são empresas estrangeiras e podem tratar esses dados fora do Brasil (transferência internacional, art. 33 da lei).',
          'confirmar nos termos da Meta (WhatsApp Business) e da Vercel o mecanismo do art. 33 (cláusulas-padrão da ANPD, Res. CD/ANPD nº 19/2024); Supabase e Hostinger são estrangeiras com dados no Brasil — conferir acesso remoto e subprocessadores'),
        'Também podemos fornecer dados quando a lei ou uma autoridade competente exigir.',
      ],
    },
    {
      id: 'retencao', titulo: 'Por quanto tempo guardamos',
      itens: [
        'O sistema não apaga nem anonimiza dados automaticamente, e não há um prazo fixo de exclusão.',
        'Guardamos o histórico das reservas e os dados de contato de quem reservou (nome, telefone, e-mail e observações) enquanto forem necessários para as finalidades descritas nesta política — registrar e atender as reservas e falar com você sobre elas — ou para cumprir uma obrigação legal.',
        'O registro do seu aceite fica guardado junto da reserva, para comprovar que você conheceu esta política.',
        'As mensagens trocadas pelo WhatsApp sobre a reserva ficam registradas no sistema para a equipe atender, e os avisos ao grupo da equipe ficam no histórico desse grupo.',
        revisar('Você pode pedir a eliminação dos seus dados pelo canal de privacidade. Atendemos o pedido nos casos previstos na lei, guardando apenas o que for necessário para cumprir uma obrigação legal ou exercer direitos (Lei 13.709/2018, arts. 16 e 18).',
          'decisão do controlador (29/10/2026): sem exclusão automática; eliminação a pedido do titular, quando a lei exigir'),
      ],
    },
    {
      id: 'direitos', titulo: 'Seus direitos',
      itens: [
        'Pela Lei Geral de Proteção de Dados (Lei 13.709/2018, art. 18), você pode pedir: confirmação de que tratamos seus dados e acesso a eles; correção de dados incompletos, inexatos ou desatualizados; anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos; portabilidade; informação sobre com quem os dados são compartilhados; e revogação do consentimento, quando ele for a base do tratamento. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).',
        revisar('Faça o pedido pelo canal de privacidade indicado acima. Para proteger seus dados, podemos confirmar que o pedido é seu pelo telefone usado na reserva. Respondemos em até 15 dias.',
          'LGPD art. 19: resposta simplificada imediata e declaração completa em até 15 dias; o pequeno porte teria prazo em dobro (Res. 2/2022, art. 14), mas 15 dias é o compromisso mais simples e protetivo'),
      ],
    },
    {
      id: 'cookies', titulo: 'Cookies e armazenamento no navegador',
      itens: [
        'Este site não usa cookies de rastreamento nem ferramentas de publicidade.',
        'A única preferência guardada é a escolha “pausar animações”, que fica só no seu navegador. O que você digita na reserva não fica guardado no navegador.',
      ],
    },
  ] satisfies Secao[],
};
