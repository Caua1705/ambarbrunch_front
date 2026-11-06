// Publica um PDF do cardápio entregue pronto pelo dono: npm run cardapio:assinar -- <arquivo.pdf>
// O arquivo vai para o site byte a byte e fica preso ao catálogo atual da API pela assinatura e pelo sha256 gravados em
// src/data/cardapio-pdf.json. PDF em imagem não tem texto para conferir por programa: antes de assinar, confira item a item. Ver docs/technical/CARDAPIO.md.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { assinaturaCatalogo, validarCatalogo } from '../src/lib/cardapio/contrato.ts';
import { lerFonte } from '../src/lib/cardapio/fonte.ts';

const origem = process.argv[2];
if (!origem) throw new Error('Informe o arquivo: npm run cardapio:assinar -- <arquivo.pdf>');
const pdf = fs.readFileSync(origem);
if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error(`${origem} não é um PDF.`);

const catalogo = validarCatalogo(await lerFonte());
const manifesto = { versao: catalogo.versao, assinatura: assinaturaCatalogo(catalogo), pdf_sha256: createHash('sha256').update(pdf).digest('hex') };
fs.writeFileSync('public/cardapio/cardapio-ambar.pdf', pdf);
fs.writeFileSync('src/data/cardapio-pdf.json', `${JSON.stringify(manifesto, null, 2)}\n`);
console.log(`PDF oficial (${Math.round(pdf.length / 1024)} KB) preso ao catálogo ${catalogo.versao}, sha256 ${manifesto.pdf_sha256}.`);
