// Entradas de compra pelo painel: enviar nota (foto/PDF/XML) e compra sem nota; e as linhas de produtos digitados,
// usadas também quando a compra veio só do comprovante do Pix.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Info, Plus, Trash2, Camera } from 'lucide-preact';
import { estoque } from '../../lib/api/estoque';
import { ErroApi, novaChave } from '../../lib/api/cliente';
import { moeda, hojeISO, paraDecimal } from '../../lib/formato';
import { Gaveta, avisar } from '../../ui/camadas';
import { Botao, Campo, Aviso } from '../../ui/base';
import { EnvioArquivo, EntradaMoeda } from '../../ui/entradas';
import type { ItemManual } from '../../lib/tipos/estoque';
import { atualizarEstoque } from './comum';

/** Envio de nota: foto (câmera no celular), PDF ou XML. A leitura acontece no backend; a conferência abre em seguida.
 *  A unidade vai no próprio formulário: no multipart o backend lê `unidade` do Form, não da query. */
export function EnviarNota({ aberta, aoFechar, aoEnviar, unidade }: { aberta: boolean; aoFechar: () => void; aoEnviar: (id: string) => void; unidade: string | null }) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (aberta) setErro(null);
  }, [aberta]);
  async function enviar(f: File) {
    if (f.size > 15 * 1024 * 1024) return setErro('O arquivo passa de 15 MB. Tire a foto de novo ou envie o PDF/XML.');
    setEnviando(f.name);
    setErro(null);
    try {
      const r = await estoque.enviarNota(f, unidade);
      atualizarEstoque();
      avisar(r.ja_existia ? 'Esta nota já tinha sido enviada: abrindo a mesma compra.' : 'Nota recebida. Lendo o documento…', r.ja_existia ? 'info' : 'ok');
      aoEnviar(r.id);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível enviar.');
    } finally {
      setEnviando(null);
    }
  }
  return (
    <Gaveta aberta={aberta} aoFechar={aoFechar} titulo="Enviar nota de compra" subtitulo="Foto da nota, PDF ou o XML que o fornecedor mandou">
      <EnvioArquivo
        aceitar="image/jpeg,image/png,image/webp,image/heic,application/pdf,.xml,text/xml,application/xml"
        captura
        desativado={!!enviando}
        titulo={enviando ? `Enviando ${enviando}…` : 'Toque para tirar a foto ou escolher o arquivo'}
        detalhe="JPG, PNG, HEIC, PDF ou XML, até 15 MB. No computador, pode arrastar o arquivo para cá."
        aoEscolher={enviar}
      />
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
      <Aviso icone={<Camera aria-hidden="true" />}>
        <strong>Dica:</strong> o XML da nota é o mais preciso. Na foto, enquadre a nota inteira, com o QR Code visível e sem reflexo. Nada entra no estoque até alguém conferir.
      </Aviso>
      <p class="fraco">Já pagou pela Júlia? Não precisa reenviar o comprovante: o pagamento já está na lista de compras. Envie só a nota; na confirmação, o painel sugere ligar a nota ao pagamento.</p>
    </Gaveta>
  );
}

export interface LinhaManual {
  descricao: string;
  quantidade: string;
  unidade: string;
  valor: string;
}
export const linhaVazia = (): LinhaManual => ({ descricao: '', quantidade: '', unidade: 'UN', valor: '' });

/** Validação comum aos itens digitados. */
export function validarLinhas(linhas: LinhaManual[]): { itens: ItemManual[]; erro: string | null } {
  const usadas = linhas.filter((l) => l.descricao.trim() || l.quantidade || l.valor);
  if (!usadas.length) return { itens: [], erro: 'Adicione pelo menos um produto.' };
  const itens: ItemManual[] = [];
  for (const [k, l] of usadas.entries()) {
    const q = Number(l.quantidade.replace(',', '.'));
    const v = paraDecimal(l.valor);
    if (!l.descricao.trim()) return { itens, erro: `Produto ${k + 1}: informe o nome.` };
    if (!(q > 0)) return { itens, erro: `${l.descricao}: informe a quantidade.` };
    if (v === null || Number(v) < 0) return { itens, erro: `${l.descricao}: informe o valor pago.` };
    itens.push({ descricao: l.descricao.trim(), quantidade: String(q), unidade: l.unidade.trim().toUpperCase() || 'UN', valor_total: v });
  }
  return { itens, erro: null };
}

const UNIDADES_COMPRA = ['UN', 'KG', 'G', 'L', 'ML', 'CX', 'PCT', 'BDJ', 'DZ', 'SC'];

/** Linhas editáveis de produtos: descrição, quantidade, unidade de compra e valor total pago. */
export function LinhasItens({ linhas, aoMudar }: { linhas: LinhaManual[]; aoMudar: (l: LinhaManual[]) => void }) {
  const set = (k: number, m: Partial<LinhaManual>) => aoMudar(linhas.map((l, i) => (i === k ? { ...l, ...m } : l)));
  return (
    <div class="linhas-edicao">
      {linhas.map((l, k) => (
        <div class="linha-edicao" key={k}>
          <Campo rotulo={`Produto ${k + 1}`}>{(id) => <input id={id} class="entrada" placeholder="Ex.: Morango bandeja" value={l.descricao} onInput={(e) => set(k, { descricao: e.currentTarget.value })} />}</Campo>
          <Campo rotulo="Qtd.">{(id) => <input id={id} class="entrada num" inputMode="decimal" value={l.quantidade} onInput={(e) => set(k, { quantidade: e.currentTarget.value })} />}</Campo>
          <Campo rotulo="Unid.">
            {(id) => (
              <select id={id} class="selecao" value={l.unidade} onChange={(e) => set(k, { unidade: e.currentTarget.value })}>
                {UNIDADES_COMPRA.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            )}
          </Campo>
          <Campo rotulo="Valor total">{(id) => <EntradaMoeda id={id} valor={l.valor} aoMudar={(v) => set(k, { valor: v })} />}</Campo>
          <Botao so_icone variante="fantasma" aria-label={`Remover o produto ${k + 1}`} icone={<Trash2 aria-hidden="true" />} disabled={linhas.length === 1} onClick={() => aoMudar(linhas.filter((_, i) => i !== k))} />
        </div>
      ))}
      <Botao tamanho="p" icone={<Plus aria-hidden="true" />} onClick={() => aoMudar([...linhas, linhaVazia()])} style={{ alignSelf: 'flex-start' }}>Adicionar produto</Botao>
    </div>
  );
}

/** Compra sem documento (feira, mercado sem cupom). Segue a mesma conferência. */
export function CompraManual({ aberta, aoFechar, aoCriar }: { aberta: boolean; aoFechar: () => void; aoCriar: (id: string) => void }) {
  const [fornecedor, setFornecedor] = useState('');
  const [documento, setDocumento] = useState('');
  const [desconto, setDesconto] = useState('');
  const [data, setData] = useState(hojeISO());
  const [total, setTotal] = useState('');
  const [linhas, setLinhas] = useState<LinhaManual[]>([linhaVazia()]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const chave = useRef(novaChave());
  useEffect(() => {
    if (aberta) {
      setFornecedor('');
      setDocumento('');
      setDesconto('');
      setData(hojeISO());
      setTotal('');
      setLinhas([linhaVazia()]);
      setErro(null);
      chave.current = novaChave();
    }
  }, [aberta]);
  const soma = linhas.reduce((s, l) => s + Number(paraDecimal(l.valor) ?? 0), 0);
  async function criar(e: Event) {
    e.preventDefault();
    const { itens, erro: er } = validarLinhas(linhas);
    if (er) return setErro(er);
    const t = paraDecimal(total) ?? soma.toFixed(2);
    const d = desconto.trim() ? paraDecimal(desconto) : '0';
    if (d === null) return setErro('Desconto inválido.');
    const doc = documento.replace(/\D/g, '');
    setEnviando(true);
    setErro(null);
    try {
      const r = await estoque.compraManual({ fornecedor_nome: fornecedor.trim() || null, fornecedor_documento: doc || null, emitida_em: data, valor_total: t, desconto: d, itens }, chave.current);
      atualizarEstoque();
      avisar('Compra registrada. Confira os itens para dar entrada.', 'ok');
      aoCriar(r.id);
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível registrar.');
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Gaveta
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Compra sem nota"
      subtitulo="Feira, mercado sem cupom: digite o essencial"
      largura="media"
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-compra-manual" carregando={enviando}>Continuar para a conferência</Botao>
        </>
      }
    >
      <form id="form-compra-manual" class="pilha" onSubmit={criar} noValidate>
        {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
        <div class="grade-campos">
          <Campo rotulo="Onde comprou" opcional>{(id) => <input id={id} class="entrada" placeholder="Ex.: Feira do Mucuripe" value={fornecedor} onInput={(e) => setFornecedor(e.currentTarget.value)} />}</Campo>
          <Campo rotulo="CNPJ ou CPF" opcional ajuda="Ajuda a ligar a compra ao fornecedor certo.">{(id, d) => <input id={id} class="entrada num" inputMode="numeric" maxLength={20} aria-describedby={d} value={documento} onInput={(e) => setDocumento(e.currentTarget.value)} />}</Campo>
          <Campo rotulo="Data da compra">{(id) => <input id={id} type="date" class="entrada" max={hojeISO()} value={data} onChange={(e) => setData(e.currentTarget.value)} />}</Campo>
        </div>
        <LinhasItens linhas={linhas} aoMudar={setLinhas} />
        <Campo rotulo="Total pago" opcional ajuda={soma ? `Soma dos produtos: ${moeda(soma)}. Em branco, vale a soma.` : 'Em branco, vale a soma dos produtos.'}>
          {(id, d) => <EntradaMoeda id={id} descr={d} valor={total} aoMudar={setTotal} />}
        </Campo>
        <Campo rotulo="Desconto" opcional>{(id) => <EntradaMoeda id={id} valor={desconto} aoMudar={setDesconto} />}</Campo>
      </form>
    </Gaveta>
  );
}
