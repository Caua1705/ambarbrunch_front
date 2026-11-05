// Lê o catálogo oficial no build: a API pública do backend é a única fonte de produtos e preços do site. Nada de produto fica no front.
// Se a API falhar ou responder fora do contrato, o build falha e a Vercel mantém no ar a versão anterior: o cliente nunca vê um cardápio
// incompleto. Se o catálogo mudou e o PDF ainda não foi refeito, o build também falha (npm run cardapio:pdf), para o site e o PDF
// nunca mostrarem preços diferentes. Ver docs/technical/CARDAPIO.md.
import { assinaturaCatalogo, validarCatalogo, type Catalogo } from './contrato';
import { lerFonte } from './fonte';
import pdf from '../../data/cardapio-pdf.json';

let carga: Promise<Catalogo> | undefined;
/** Uma leitura por build: todas as páginas usam a mesma resposta. */
export function carregarCatalogo(): Promise<Catalogo> {
  carga ??= lerFonte().then((bruto) => {
    const catalogo = validarCatalogo(bruto);
    if (!import.meta.env.DEV && assinaturaCatalogo(catalogo) !== pdf.assinatura) {
      throw new Error(`O catálogo ${catalogo.versao} não é o do PDF publicado (${pdf.versao}). Rode npm run cardapio:pdf e publique o PDF novo.`);
    }
    return catalogo;
  });
  return carga;
}
