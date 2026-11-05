// De onde vem o catálogo: a API pública do backend. O build do site e o gerador do PDF leem pelo mesmo caminho.
import fs from 'node:fs';

export const API_CARDAPIO = 'https://api.ambarbrunch.com/cardapio';

export async function lerFonte(): Promise<unknown> {
  // CARDAPIO_FONTE: outra URL ou um arquivo local (testes e homologação)
  const fonte = process.env.CARDAPIO_FONTE || API_CARDAPIO;
  if (!/^https?:/.test(fonte)) return JSON.parse(fs.readFileSync(fonte, 'utf8'));
  let erro: unknown;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const r = await fetch(fonte, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { erro = e; }
  }
  throw new Error(`Não foi possível ler o catálogo em ${fonte}: ${erro instanceof Error ? erro.message : String(erro)}`);
}
