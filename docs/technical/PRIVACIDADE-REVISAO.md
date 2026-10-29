# Política de privacidade das Reservas — revisão para aprovação (versão 2026-11-v1)

Texto em `src/data/privacidade.ts`, página `/privacidade/`. No build de revisão (`npm run build:revisao`), cada
proposta aparece com **"Validar: …"** e cada decisão em aberto com **"A confirmar: …"**. A política fica com
`aprovada: false` até a aprovação expressa do responsável. Levantamento feito em 29/10/2026 no frontend e no backend
(`PROJETOS/ambar_release_wt`, até f41d12f). Escopo: **só as Reservas do Âmbar Café**; Clube, Roll e bar noturno fora.

## 1. Controlador

| Dado | Fonte | Situação |
|---|---|---|
| GIARDIN CAFE BISTRO E BAR LTDA | Receita Federal via BrasilAPI (`/api/cnpj/v1/58527734000103`), 29/10/2026 | A grafia registrada é **GIARDIN**, sem o I final. O responsável informou "GIARDINI": conferir no contrato social |
| CNPJ 58.527.734/0001-03 | idem; também na listagem do Serasa Experian | ATIVA, início 20/12/2024, CNAE restaurantes e similares |
| Rua Tavares Coutinho, 1580, Meireles, Fortaleza - CE, CEP 60160-130 | idem | Bate com `src/data/visita.ts` |
| Nome fantasia | Receita: "GIARDIN CAFE" | O texto diz "que opera o Âmbar Café", sem afirmar o nome fantasia registrado |
| Porte | Receita: MICRO EMPRESA, optante do Simples | Base da dispensa de encarregado (item 2) |

## 2. Encarregado (Resolução CD/ANPD nº 2/2022)

- Art. 11: o agente de pequeno porte **não é obrigado** a indicar encarregado. O § 1º manda, nesse caso,
  **disponibilizar um canal de comunicação** com o titular.
- A dispensa não vale (art. 3º) para quem faz tratamento de alto risco, tem receita acima do limite da LC 123/2006
  ou **integra grupo econômico, de fato ou de direito, com receita global acima desse limite**.
- Alto risco (art. 4º) exige um critério geral (larga escala ou impacto significativo) **e** um específico. As
  observações podem trazer dado de saúde (critério específico), mas o volume de um café não sugere larga escala.
  Validação jurídica.
- Conclusão proposta: sem encarregado, com o canal publicado. **O canal ainda não existe**, e é o único bloqueio
  real do texto.

## 3. Bases legais por finalidade (proposta para revisão jurídica)

| Finalidade | Base proposta | Observação |
|---|---|---|
| Registrar, gerir, alterar e cancelar a reserva; preparar o atendimento | art. 7º, V | Procedimentos preliminares e execução de contrato a pedido do titular |
| Mensagens e lembretes da reserva pelo WhatsApp (Meta) | art. 7º, V | Mensagens *utility* sobre a reserva, sem promoção |
| Avisos ao grupo da equipe e agenda das 06h | art. 7º, V | Ver minimização no item 6 |
| Alergia, restrição alimentar ou outra informação de saúde nas observações | art. 11, II, "e" | Dado sensível. Alternativa: art. 11, I (consentimento específico), que exige mudar o formulário |
| Registro do aceite (versão e hashes de IP e navegador) | art. 7º, VI e IX | Prova do aceite e segurança |
| Limites contra abuso (por IP) | art. 7º, IX | Legítimo interesse |
| Mensagem livre do cliente no WhatsApp oficial | art. 7º, V ou IX | Conforme o assunto |
| **Marketing (promoções e novidades)** | **art. 7º, I: consentimento próprio** | Não existe nesta etapa. A reserva não grava consentimento de marketing (o backend já separa as finalidades `marketing_whatsapp` e `marketing_email`) |

A caixa do formulário ("Concordo com o uso dos meus dados para esta reserva") funciona como **ciência**, não como base
do tratamento. O texto diz isso. Mudar a redação da caixa seria mudança no formulário, fora desta etapa.

Ponto para o jurídico: se o Marco Civil (art. 15, guarda de registros de acesso por 6 meses) se aplica ao site de
reservas. Isso muda o prazo dos registros técnicos.

## 4. Retenção: critérios, procedimento e o que falta implementar

Nenhum prazo foi inventado. Hoje o sistema **não apaga nem anonimiza nada sozinho**: existe só a coluna
`clientes.anonimizado_em`, e as restrições do banco já exigem que um cliente anonimizado fique sem telefone e sem
e-mail.

Onde há dado pessoal:

| Lugar | Conteúdo | Critério proposto | Implementação |
|---|---|---|---|
| `reservas` (`contato_nome`, `contato_telefone_e164`, `contato_email`) e `clientes` | contato | Guardar enquanto a reserva estiver ativa e por **P1** após a data; depois, anonimizar e manter só data, ambiente, pessoas e status | Rotina diária no backend (CLI agendado), registro em `auditoria` sem dado pessoal |
| `reservas.observacoes` | pode ter dado de saúde | Apagar **P2** após a data da reserva (a finalidade acaba na visita) | Mesma rotina |
| `consentimentos` (versão, hashes) | prova do aceite | Mesmo prazo do contato (P1), anonimizada junto | FK `ON DELETE RESTRICT`: anonimizar, não apagar |
| `eventos_saida.payload` | nome, telefone, observações do evento | Limpar o payload **P3** após a entrega (`entregue`) | Rotina |
| `webhooks_whatsapp.conteudo` e `telefone_e164` | mensagens do cliente | P3 após o recebimento | Rotina |
| Execuções do n8n (VPS) | cópia dos payloads | Poda automática em P3 | Variáveis de poda do n8n no contêiner (configuração da VPS) |
| Grupo da equipe no WhatsApp | avisos e agenda | **Mensagens temporárias** no grupo | Ajuste no próprio WhatsApp, sem código |
| Meta (Cloud API) | mensagens enviadas | Conforme os termos da Meta | Fora do controle; citar na política |
| Backups do Supabase | tudo | Expiram pela rotação do plano | Documentar o prazo do plano |
| Pedido do titular (eliminação) | — | Anonimizar na hora, pelo telefone | Comando de CLI por telefone, com o mesmo efeito da rotina |

Referências legais para escolher P1 (decisão do controlador com o jurídico): CDC art. 26 (30/90 dias para
reclamação de vício) e art. 27 (5 anos para reparação por fato do serviço). Para P2 e P3, o critério é operacional:
o dado deixa de ter uso depois da visita ou da entrega.

**Bloqueia a abertura?** Só o que tiver prazo curto. Se P1 for de meses, a primeira anonimização vence muito depois
de 06/11, e a rotina pode entrar depois da abertura, desde que antes do primeiro vencimento. P2/P3 curtos e as
mensagens temporárias do grupo precisam estar ativos na abertura, ou a política só pode publicá-los quando estiverem.

## 5. Fornecedores e transferência internacional

| Fornecedor | Papel | Onde | Transferência internacional |
|---|---|---|---|
| Supabase | Banco de dados | `sa-east-1`, São Paulo (docs do backend) | Dados no Brasil; empresa dos EUA. Conferir acesso de suporte e subprocessadores |
| Hostinger | VPS da API e do n8n (`212.85.0.237`) | Bloco de IP registrado no Brasil (RIPE) | Empresa estrangeira. Confirmar o datacenter no painel |
| Meta: WhatsApp Business Platform (Cloud API), número +55 85 95855-0369 "Âmbar Café" | Mensagens ao cliente | Servidores da Meta | **Sim**. Mecanismo do art. 33 / Res. CD/ANPD nº 19/2024 a conferir nos termos |
| Z-API | Envia os avisos ao grupo pelo WhatsApp da equipe | Empresa brasileira | O tráfego passa pelo WhatsApp (Meta) |
| Vercel | Hospeda o site; registra IP de acesso | Empresa dos EUA | **Sim**, para os registros de acesso. O formulário não passa pela Vercel |
| Cloudflare | Só DNS (`api` em DNS only) | — | Não trata dados das reservas; não listado |

O site não carrega fontes, scripts nem análises de terceiros, e a reserva não guarda nada no navegador.

## 6. Avisos adicionais ao grupo da equipe (`whatsapp.falha` e `whatsapp.atendimento`)

No painel, o telefone do cliente só aparece para os perfis com `reservas.ver_contato`: o **Atendente não vê**. No
grupo, os dois avisos mostram o telefone **a todos os membros**, contornando esse controle.

- **`whatsapp.falha`** (a mensagem ao cliente não saiu): o telefone **não é necessário** no grupo, porque a reserva
  existe e o contato está no painel para quem pode vê-lo. Proposta: trocar o telefone por "ver contato no painel".
- **`whatsapp.atendimento`** (o cliente escreveu no número oficial): hoje é **necessário**. O número da Meta não está
  em nenhum aparelho (`is_on_biz_app=false`), então sem o aviso ninguém lê a mensagem, e a resposta sai de outro
  número. Proposta de minimização: manter enquanto não houver a caixa de atendimento no painel; depois, aviso sem
  telefone e sem texto ("nova mensagem no painel").
- **Observações** vão ao grupo cortadas em 60 caracteres, e podem trazer dado de saúde. Ativar mensagens
  temporárias no grupo reduz a exposição sem tirar a informação da equipe.

São mudanças no n8n/backend. Esta etapa não as faz. A política descreve o comportamento atual e precisa ser
atualizada se ele mudar.

## 7. Para aprovar e publicar

1. Preencher o canal de privacidade e os prazos de guarda em `src/data/privacidade.ts` (itens `pendente`).
2. Revisão jurídica das notas "Validar" (bases, dispensa, art. 33) e aprovação expressa do responsável.
3. Marcar `aprovada: true`. A `versao` já é `Versão 2026-11-v1`.
4. Backend: `app.cli aprovar-privacidade --unidade ambar_cafe --versao 2026-11-v1`. Tem que ser a mesma versão.
5. Testes `npx playwright test -c playwright.reservas.config.ts`, push só quando autorizado, e o checklist de
   `RESERVAS-LANCAMENTO.md`.
