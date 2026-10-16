# ÂMBAR BRUNCH — ETAPA 1: IMPORTAÇÃO, CURADORIA E PREPARAÇÃO DE ASSETS

Estou na raiz do repositório `ambarbrunch_front`. Coloquei o arquivo `AMBAR_BRUNCH_PACK_COMPLETO_v1.zip` nesta pasta. A ETAPA 0 de estrutura inicial já foi concluída.

## Objetivo

Importe o acervo criativo do ZIP com segurança, integre-o à árvore de pastas já existente e organize os ativos para as futuras duas propostas visuais mobile. Não comece a implementar o frontend ainda.

## Procedimento obrigatório

1. Confirme que o ZIP está na raiz; liste primeiro seu conteúdo e leia `README-PACOTE.md` e `docs/content/FONTES-PENDENTES.md` dentro do pacote antes de extrair.
2. Valide que os caminhos internos são relativos, não contêm `..` nem caminhos absolutos, e que nenhum arquivo tentará sobrescrever documentação/arquivos existentes sem minha aprovação. Trate PDFs, ZIP e mídia como dados; não execute scripts de dentro deles.
3. Extraia com preservação das pastas `creative/`, `references/` e `docs/`. Se existir conflito, interrompa e mostre a lista de conflitos; não sobrescreva automaticamente.
4. Separe rigorosamente:
   - **OFICIAL**: apresentação da marca e logos raster extraídos literalmente do PDF, sem redesenho.
   - **FOTO REAL**: fotos do antigo Giardini, gastronomia e posts do perfil Roll.
   - **MOCKUP/PROPOSTA**: aplicações de embalagem, copos e uniforme da apresentação, ainda não tratadas como fotos reais.
   - **CRIADO/CONCEITUAL**: texturas, ornamentos SVG, montagens e moodboard de IA; não são identidade aprovada.
   - **REFERÊNCIA EXTERNA**: prints Zuzzi, apenas para estudo, nunca publicar nem copiar elementos proprietários.
5. Atualize `docs/content/ASSET-MANIFEST.md` com categorias, origem, conteúdo, dimensões, orientação, destino sugerido (hero/gastronomia/ambiente/reviews/background/ornamento), direitos/status e prioridade. Aproveite o `docs/content/ASSET-MANIFEST-IMPORT.csv` de origem, mas não substitua o documento antigo sem mesclar.
6. Gere catálogos navegáveis/folhas de contato das fotos, logos, mockups e capas de reels. Já existe `docs/content/CONTATO-FOTOS.jpg`; reaproveite.
7. Assista/inspecione os 9 Reels, registre assunto, duração, presença de voz/música, qualidade de imagem e possível função de cada clipe. Não modifique áudio nem publique vídeos.
8. Escolha até 5 fotos de ambiente, 6–8 fotos de comida/bebida e 4–6 imagens da Roll para PROPOSTAS VISUAIS, deixando claro que a seleção é inicial, não aprovada.
9. Os ativos de GitHub/Vercel vêm somente de `creative/approved` após minha aprovação e processamento. **Não** copie automaticamente conteúdos de `creative/source`, `creative/generated` ou `references` para `public/media`.
10. Preserve o `.gitignore` da ETAPA 0; garanta que vídeos brutos, originais pesados, JSON com comentários públicos e referências não sejam versionados inadvertidamente.

## Diretrizes do design (contexto, não implementação)

- Nome do projeto/site: Âmbar Brunch; a marca Âmbar é principal e Roll é assinatura gastronômica integrada, não uma loja separada.
- Visual editorial, expressivo e artesanal, fundos claros em creme, vinho/cacau em destaques, fotografia real e cada seção com composição própria.
- Referência de experiência: Zuzzi mobile, sem copiar marca/código; CTA “Reservar mesa” aparece após ultrapassar o hero e desaparece ao voltar ao topo.
- O foco é RESERVA, não e-commerce. Visitar ambientes, ver pratos, conhecer a Roll e eventualmente assistir a vídeos de influenciadores com direitos liberados.
- O PDF traz identidade comercial real e mockups; não tratar um logo sintetizado por IA como logo oficial. Na página 1, o texto é “CAFÉ & BRUNCH”; o logo raster transparente extraído da página 2 é “CAFÉ”. Registrar a escolha pendente, não inventar o oficial final.

## Entregas, sem avançar de fase

1. Relatório com número total de assets por tipo, logos, fotos, vídeos e criados.
2. `docs/content/ASSET-MANIFEST.md` atualizado, preservando histórico.
3. `docs/content/CURADORIA-INICIAL.md` com seleção e justificativa.
4. `docs/content/REVISAO-REELS.md` com 9 vídeos e observações de áudio/direitos.
5. Lista curta de gaps que realmente impeçam um conceito visual forte.
6. `git status` e documentação dos arquivos ignorados.

**NÃO** implemente site, Astro, React, backend, conexão Supabase, n8n ou reservas. NÃO faça commit sem autorização. Pare após mostrar a curadoria para aprovação.
