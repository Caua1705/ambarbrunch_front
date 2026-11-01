// Entradas de compra pelo painel: enviar nota (foto/PDF/XML) e compra sem nota; e as linhas de produtos (seletor do
// cadastro de insumos e materiais, quantidade, unidade, valor unitário e subtotal), usadas também quando a compra veio
// só do comprovante do Pix.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Info, Plus, Trash2, Camera } from 'lucide-preact';
import { estoque } from '../../lib/api/estoque';
import { ErroApi, novaChave } from '../../lib/api/cliente';
import { moeda, hojeISO, paraDecimal } from '../../lib/formato';
import { Gaveta, avisar } from '../../ui/camadas';
import { Botao, Campo, Aviso } from '../../ui/base';
import { EnvioArquivo, EntradaMoeda, Autocompletar, type OpcaoAuto } from '../../ui/entradas';
import type { ItemManual } from '../../lib/tipos/estoque';
import { atualizarEstoque, UNIDADE_CURTA } from './comum';

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
      <p class="fraco">Já pagou pela Júlia? Não envie aqui: abra a compra pendente desse pagamento na lista e envie a nota dentro dela — ela confere o mesmo pagamento, sem criar outra despesa.</p>
    </Gaveta>
  );
}

export interface LinhaManual {
  /** Insumo do cadastro escolhido no seletor (null: nome novo, cadastrado na conferência). */
  insumo: OpcaoAuto | null;
  descricao: string;
  quantidade: string;
  unidade: string;
  /** Valor unitário (R$ por unidade de compra); o subtotal é quantidade × unitário. */
  unitario: string;
  /** Subtotal já gravado (rascunho reaberto): vale até a pessoa mudar quantidade ou valor, para o centavo do unitário
   *  arredondado não mudar a soma sozinho. */
  total?: string;
}
export const linhaVazia = (): LinhaManual => ({ insumo: null, descricao: '', quantidade: '', unidade: 'UN', unitario: '' });

const qtd = (t: string) => Number(t.replace(',', '.'));
/** Subtotal da linha em reais, arredondado ao centavo (0 se faltar quantidade ou valor). */
export const subtotal = (l: LinhaManual) => {
  if (l.total !== undefined) return Number(l.total);
  const q = qtd(l.quantidade);
  const u = Number(paraDecimal(l.unitario) ?? NaN);
  return q > 0 && u >= 0 ? Math.round(q * u * 100) / 100 : 0;
};
export const somaLinhas = (linhas: LinhaManual[]) => Math.round(linhas.reduce((s, l) => s + subtotal(l), 0) * 100) / 100;

/** Validação comum aos itens digitados (o backend valida de novo: quantidade > 0, valor ≥ 0). */
export function validarLinhas(linhas: LinhaManual[]): { itens: ItemManual[]; erro: string | null } {
  const usadas = linhas.filter((l) => l.descricao.trim() || l.quantidade || l.unitario);
  if (!usadas.length) return { itens: [], erro: 'Adicione pelo menos um produto.' };
  const itens: ItemManual[] = [];
  for (const [k, l] of usadas.entries()) {
    const q = qtd(l.quantidade);
    const u = paraDecimal(l.unitario);
    const nome = l.descricao.trim();
    if (!nome) return { itens, erro: `Produto ${k + 1}: escolha o produto no cadastro (ou digite o nome).` };
    if (!(q > 0) || !Number.isFinite(q)) return { itens, erro: `${nome}: informe uma quantidade maior que zero.` };
    if (u === null || !(Number(u) >= 0)) return { itens, erro: `${nome}: informe o valor unitário.` };
    itens.push({ descricao: nome, quantidade: String(q), unidade: l.unidade.trim().toUpperCase() || 'UN', valor_total: subtotal(l).toFixed(2), insumo_id: l.insumo?.valor ?? null });
  }
  return { itens, erro: null };
}

const UNIDADES_COMPRA = ['UN', 'KG', 'G', 'L', 'ML', 'CX', 'PCT', 'BDJ', 'DZ', 'SC'];

/** Busca no cadastro de insumos e materiais COMPRADOS (nunca os produtos do cardápio). */
async function buscarInsumo(texto: string): Promise<OpcaoAuto[]> {
  const r = await estoque.insumos({ busca: texto.trim() || undefined, tipo: 'comprado', limite: 20 });
  return r.itens.map((i) => ({ valor: i.id, rotulo: i.nome, detalhe: `em ${UNIDADE_CURTA[i.unidade_base]}` }));
}

/** Linhas editáveis de produtos: produto do cadastro (seletor pesquisável), quantidade, unidade, valor unitário e subtotal. */
export function LinhasItens({ linhas, aoMudar }: { linhas: LinhaManual[]; aoMudar: (l: LinhaManual[]) => void }) {
  // Mudou quantidade ou valor: o subtotal volta a ser quantidade × unitário.
  const set = (k: number, m: Partial<LinhaManual>) =>
    aoMudar(linhas.map((l, i) => (i === k ? { ...l, ...m, ...('quantidade' in m || 'unitario' in m ? { total: undefined } : {}) } : l)));
  return (
    <div class="linhas-edicao">
      {linhas.map((l, k) => (
        <div class="linha-edicao" key={k}>
          <Campo rotulo={`Produto ${k + 1}`} ajuda={!l.insumo && l.descricao.trim() ? 'Fora do cadastro: será cadastrado na conferência.' : undefined}>
            {(id, d) => (
              <Autocompletar
                id={id}
                descr={d}
                rotulo={`Produto ${k + 1}`}
                placeholder="Buscar no cadastro (ex.: leite)"
                valor={l.insumo ?? (l.descricao ? { valor: '', rotulo: l.descricao } : null)}
                buscar={buscarInsumo}
                aoEscolher={(o) => set(k, o ? { insumo: o, descricao: o.rotulo } : { insumo: null })}
                criar={{ rotulo: (t) => `Usar “${t}” (cadastrar na conferência)`, acao: (t) => set(k, { insumo: null, descricao: t }) }}
              />
            )}
          </Campo>
          <Campo rotulo="Qtd.">{(id) => <input id={id} class="entrada num" inputMode="decimal" value={l.quantidade} onInput={(e) => set(k, { quantidade: e.currentTarget.value })} />}</Campo>
          <Campo rotulo="Unid.">
            {(id) => (
              <select id={id} class="selecao" value={l.unidade} onChange={(e) => set(k, { unidade: e.currentTarget.value })}>
                {UNIDADES_COMPRA.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            )}
          </Campo>
          <Campo rotulo="Valor unit.">{(id) => <EntradaMoeda id={id} valor={l.unitario} aoMudar={(v) => set(k, { unitario: v })} />}</Campo>
          <Campo rotulo="Subtotal">{(id) => <output id={id} class="entrada num" style={{ display: 'flex', alignItems: 'center' }}>{moeda(subtotal(l))}</output>}</Campo>
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
  const soma = somaLinhas(linhas);
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
