import { pendente, type Pendente } from '../lib/conteudo';

// Política de privacidade (LGPD) — ESTRUTURA. O texto jurídico é do controlador e passa por validação.
// Só entra aqui o que o sistema de fato faz (backend do Âmbar; revisto no go-live de 28/10/2026). Identificação do controlador,
// encarregado, bases legais, operadores e prazos de retenção: `pendente(...)` até a validação — nunca inventar.
// Enquanto `aprovada` for false, a página mostra este rascunho só no modo de revisão; no build de produção,
// continua o aviso de que a política está sendo preparada. A versão aprovada vai também para o backend
// (política de reservas → privacidade_texto_versao), que grava essa versão em cada aceite.

type Texto = string | Pendente;
export interface Secao { id: string; titulo: string; itens: Texto[] }

export const privacidade = {
  aprovada: false,
  versao: pendente('Versão e data do texto aprovado') as Texto,
  secoes: [
    {
      id: 'controlador', titulo: 'Quem é o responsável pelos seus dados',
      itens: [
        pendente('Controlador: razão social e CNPJ (decisões B2 e C1)'),
        pendente('Endereço do controlador'),
        pendente('Encarregado (DPO) ou canal de privacidade: nome e contato'),
      ],
    },
    {
      id: 'reserva-dados', titulo: 'Dados da reserva',
      itens: [
        'Para registrar uma reserva pelo site, pedimos nome, telefone (WhatsApp), e-mail e, se você quiser, observações. Também guardamos o ambiente, a data, o horário e o número de pessoas.',
        'Guardamos o registro do seu aceite: data e hora, a versão deste texto e códigos derivados do endereço IP e do navegador. O IP e o navegador não ficam guardados em claro.',
        'Escreva nas observações só o necessário para a sua visita (por exemplo, uma restrição alimentar ou cadeirinha).',
      ],
    },
    {
      id: 'reserva-uso', titulo: 'Para que usamos os dados da reserva',
      itens: [
        'Para registrar, confirmar, alterar ou cancelar a reserva e preparar o atendimento no café.',
        'Para falar com você sobre essa reserva.',
        'Pelo WhatsApp oficial do Âmbar, você recebe mensagens só sobre a sua reserva: o aviso de que ela foi registrada e lembretes antes do horário (o lembrete mais próximo leva a localização do café). Se responder a essas mensagens, a resposta fica registrada para a equipe atender.',
        'A equipe do café recebe, num grupo interno de WhatsApp, um aviso curto de cada reserva nova, alterada ou cancelada: primeiro nome, data, horário, ambiente, número de pessoas e, se houver, as observações. O telefone não vai nesse aviso, a não ser quando a mensagem para você não puder ser entregue e a equipe precisar falar com você diretamente.',
        pendente('Base legal de cada finalidade (validação jurídica)'),
      ],
    },
    {
      id: 'separados', titulo: 'O que a reserva não faz',
      itens: [
        'Reservar não inscreve você no Clube Âmbar e não autoriza o envio de promoções.',
        'Depois da reserva, o site pode mostrar um convite para conhecer o Clube Âmbar. Ele é opcional e só abre a página do Clube.',
      ],
    },
    {
      id: 'clube', titulo: 'Clube Âmbar',
      itens: [
        'A adesão ao Clube é separada da reserva: é feita por você, na página do Clube, com regras próprias.',
        pendente('Dados, finalidades e regras do Clube Âmbar (programa de pontos)'),
      ],
    },
    {
      id: 'marketing', titulo: 'Comunicações promocionais',
      itens: [
        'Promoções e novidades só são enviadas com uma autorização própria, separada da reserva e do Clube, que você pode retirar quando quiser.',
        pendente('Canais e forma de pedir e retirar a autorização de marketing'),
      ],
    },
    {
      id: 'compartilhamento', titulo: 'Com quem os dados são compartilhados',
      itens: [
        'Não vendemos nem cedemos seus dados. Eles são tratados, em nosso nome, por prestadores de serviço necessários para o sistema funcionar:',
        'Banco de dados: Supabase, com o banco hospedado em São Paulo (Brasil).',
        'Servidor do sistema de reservas e das automações (n8n): servidor virtual contratado pelo Âmbar.',
        'WhatsApp oficial para falar com você: WhatsApp Business Platform (Meta).',
        'Aviso interno à equipe: Z-API, ligada ao WhatsApp da equipe.',
        'Site: Vercel (hospedagem das páginas); o formulário de reserva envia os dados direto ao sistema do Âmbar.',
        pendente('Confirmação jurídica da lista de operadores, do provedor do servidor e da transferência internacional (Meta e Vercel)'),
      ],
    },
    {
      id: 'retencao', titulo: 'Por quanto tempo guardamos',
      itens: [pendente('Prazos de retenção dos dados de reserva e critério de eliminação ou anonimização')],
    },
    {
      id: 'direitos', titulo: 'Seus direitos',
      itens: [
        'Pela Lei Geral de Proteção de Dados (Lei 13.709/2018, art. 18), você pode pedir: confirmação de que tratamos seus dados e acesso a eles; correção de dados incompletos, inexatos ou desatualizados; anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos; portabilidade; informação sobre com quem os dados são compartilhados; e revogação do consentimento, quando ele for a base do tratamento. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).',
        pendente('Canal e prazo de resposta para pedidos dos titulares'),
      ],
    },
    {
      id: 'cookies', titulo: 'Cookies e armazenamento no navegador',
      itens: [
        'Este site não usa cookies de rastreamento nem ferramentas de publicidade.',
        'A única preferência guardada é a escolha “pausar animações”, que fica só no seu navegador.',
      ],
    },
  ] satisfies Secao[],
};
