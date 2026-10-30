// SEO local (2026-10-30): o que os buscadores leem do Âmbar — nome, endereço, horário e links — num lugar só, a partir
// dos dados oficiais de visita (src/data/visita.ts). Nunca inventar: o que não foi confirmado (telefone público,
// coordenadas, faixa de preço, link do Perfil da Empresa no Google) fica de fora até existir.
// O NOME tem de ser escrito igual ao do Perfil da Empresa no Google (Maps): NAP igual em todo lugar.
// O horário é o divulgado no site (visita.horarios) e pela Júlia; mudou lá, muda aqui e no Perfil da Empresa.
import { getImage } from 'astro:assets';
import { visita } from './visita';
import { imagem } from '../lib/media';

export const SITE = `https://${visita.dominio}`;

export const seo = {
  // “Âmbar”: o nome pedido ao Google para o Perfil da Empresa (Maps) em 30/10/2026 — a identidade comercial
  nome: 'Âmbar',
  // o domínio, o Instagram e as páginas mais antigas usam “Âmbar Brunch”; o logo diz “âmbar café & brunch”
  nomesAlternativos: ['Âmbar Café', 'Âmbar Brunch', 'Âmbar Café & Brunch'],
  /** Título e descrição da home: o que aparece no resultado do Google (com “cafeteria” e “brunch”, o que se busca). */
  titulo: 'Âmbar — cafeteria e brunch no Meireles, Fortaleza',
  descricao: 'Cafeteria e brunch no Meireles, em Fortaleza: mesa cheia, café e os cinnamon rolls da Roll. Aberto todos os dias, das 07h às 19h. Reserve sua mesa pelo site.',
  endereco: {
    rua: visita.endereco,
    bairro: 'Meireles',
    cidade: 'Fortaleza',
    uf: 'CE',
    // CEP da Receita Federal (src/data/privacidade.ts, conferido em 29/10/2026)
    cep: '60160-130',
  },
  // mesmo horário de visita.horarios (“Todos os dias, 07h às 19h”)
  abre: '07:00',
  fecha: '19:00',
  cozinha: ['Brunch', 'Cafeteria', 'Café', 'Cinnamon rolls'],
  /** Página da reserva (uma ação do Google “Reservar” pode apontar para cá). */
  reservar: `${SITE}/reservar/`,
  // sameAs = o mesmo negócio em outro lugar: só o Instagram do Âmbar (a Roll é outra marca)
  perfis: [visita.instagram.url],
} as const;

const DIAS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Dados estruturados (schema.org, JSON-LD) da home: o café como negócio local (CafeOrCoffeeShop) e o site.
 * `capa` e `logo`: URLs absolutas geradas no build (imagensSeo).
 */
export function dadosEstruturados({ capa, logo }: { capa?: string; logo?: string }) {
  const e = seo.endereco;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CafeOrCoffeeShop',
        '@id': `${SITE}/#cafe`,
        name: seo.nome,
        alternateName: seo.nomesAlternativos,
        description: seo.descricao,
        url: `${SITE}/`,
        image: capa,
        logo,
        address: {
          '@type': 'PostalAddress',
          streetAddress: e.rua,
          addressLocality: e.cidade,
          addressRegion: e.uf,
          postalCode: e.cep,
          addressCountry: 'BR',
        },
        areaServed: { '@type': 'City', name: `${e.cidade} - ${e.uf}` },
        openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: DIAS, opens: seo.abre, closes: seo.fecha }],
        servesCuisine: seo.cozinha,
        acceptsReservations: true,
        potentialAction: {
          '@type': 'ReserveAction',
          target: { '@type': 'EntryPoint', urlTemplate: seo.reservar, inLanguage: 'pt-BR', actionPlatform: ['http://schema.org/DesktopWebPlatform', 'http://schema.org/MobileWebPlatform'] },
          result: { '@type': 'FoodEstablishmentReservation', name: 'Reserva de mesa' },
        },
        sameAs: seo.perfis,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#site`,
        name: seo.nome,
        alternateName: seo.nomesAlternativos,
        url: `${SITE}/`,
        inLanguage: 'pt-BR',
        publisher: { '@id': `${SITE}/#cafe` },
      },
    ],
  };
}

/** JSON-LD seguro dentro de <script>: “<” escapado, nada fecha a tag antes da hora. */
export const jsonLd = (dados: unknown) => JSON.stringify(dados).replace(/</g, '\\u003c');

/**
 * Imagens para buscadores e compartilhamento, geradas no build (URLs absolutas no domínio oficial): a capa (salão
 * principal recortado em 1200 × 630, para og:image e o JSON-LD) e o logo em 512 px. `undefined` se o arquivo faltar.
 */
export async function imagensSeo() {
  const salao = imagem('ambientes/salao-principal.webp');
  const logo = imagem('brand/logo-ambar.png');
  const abs = (src: string) => new URL(src, SITE).href;
  return {
    capa: salao && abs((await getImage({ src: salao, width: 1200, height: 630, fit: 'cover', position: 'center', format: 'jpg', quality: 80 })).src),
    logo: logo && abs((await getImage({ src: logo, width: 512, format: 'png' })).src),
  };
}
