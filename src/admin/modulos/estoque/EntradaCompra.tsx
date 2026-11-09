// Compras registradas pelo painel: "Registrar compra" (com nota: foto/PDF/XML; sem nota: digitada) e as linhas de produtos
// (seletor do cadastro de insumos e materiais, quantidade, unidade, valor unitário e subtotal), usadas também quando a
// compra veio só do comprovante do Pix.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Info, Plus, Trash2, Camera, FileText, PencilLine } from 'lucide-preact';
import { estoque } from '../../lib/api/estoque';
import { ErroApi, novaChave } from '../../lib/api/cliente';
import { moeda, hojeISO, paraDecimal } from '../../lib/formato';
import { Gaveta, avisar } from '../../ui/camadas';
import { Botao, Campo, Aviso } from '../../ui/base';
import { EnvioArquivo, EntradaMoeda, Autocompletar, type OpcaoAuto } from '../../ui/entradas';
import type { ItemManual } from '../../lib/tipos/estoque';
import { atualizarEstoque, UNIDADE_CURTA } from './comum';

/** Registrar compra: uma porta só para o que chegou com nota (foto/PDF/XML, lida no backend) e sem nota (digitado). Os
 *  dois caem na MESMA conferência de Compras, e nada entra no estoque antes do "Confirmar recebimento". O envio da
 *  nota manda a unidade no próprio formulário: no multipart o backend lê `unidade` do Form, não da query. */
export function NovaCompra({ aberto, modo: modoInicial, insumo, unidade, aoFechar, aoCriar }: {
  aberto: boolean;
  modo: 'nota' | 'manual' | null;
  /** Insumo que já vem na primeira linha (entrada aberta pela gaveta do insumo). */
  insumo: { id: string; nome: string } | null;
  unidade: string | null;
  aoFechar: () => void;
  aoCriar: (compraId: string) => void;
}) {
  const [modo, setModo] = useState<'nota' | 'manual' | null>(modoInicial);
  useEffect(() => {
    if (aberto) setModo(modoInicial);
  }, [aberto, modoInicial]);
  const [enviando, setEnviando] = useState(false);
  const titulo = modo === 'nota' ? 'Compra com nota fiscal' : modo === 'manual' ? 'Compra sem nota' : 'Registrar compra';
  return (
    <Gaveta
      aberta={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      subtitulo={modo === 'nota' ? 'Foto da nota, PDF ou o XML do fornecedor' : modo === 'manual' ? 'Fornecedor, itens, quantidades e valores' : 'O que chegou ao café?'}
      largura={modo === 'manual' ? 'media' : 'normal'}
      rodape={
        modo === 'manual' ? (
          <>
            <Botao onClick={() => (modoInicial ? aoFechar() : setModo(null))} disabled={enviando}>{modoInicial ? 'Cancelar' : 'Voltar'}</Botao>
            <Botao variante="primario" type="submit" form="form-recebimento-manual" carregando={enviando}>Continuar para a conferência</Botao>
          </>
        ) : undefined
      }
    >
      {modo === null && (
        <div class="escolha-movimento" role="group" aria-label="Escolha uma opção">
          <button type="button" class="escolha-movimento__opcao" onClick={() => setModo('nota')}>
            <span class="escolha-movimento__icone"><FileText aria-hidden="true" /></span>
            <span class="escolha-movimento__texto"><strong>Com nota fiscal</strong><span>Foto, PDF ou XML. Os itens são lidos e você confere.</span></span>
          </button>
          <button type="button" class="escolha-movimento__opcao" onClick={() => setModo('manual')}>
            <span class="escolha-movimento__icone"><PencilLine aria-hidden="true" /></span>
            <span class="escolha-movimento__texto"><strong>Sem nota</strong><span>Feira, mercado sem cupom: informe fornecedor, itens e valores.</span></span>
          </button>
          <p class="fraco">Mandou o comprovante para a Júlia? A compra já está em Pendentes: confira por lá, sem registrar de novo.</p>
        </div>
      )}
      {modo === 'nota' && <EnvioNota unidade={unidade} aoEnviar={aoCriar} aoVoltar={modoInicial ? null : () => setModo(null)} />}
      {modo === 'manual' && <FormManual aberto={aberto} insumo={insumo} aoEnviando={setEnviando} aoCriar={aoCriar} />}
    </Gaveta>
  );
}

function EnvioNota({ unidade, aoEnviar, aoVoltar }: { unidade: string | null; aoEnviar: (id: string) => void; aoVoltar: (() => void) | null }) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
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
    <div class="pilha">
      <EnvioArquivo
        aceitar="image/jpeg,image/png,image/webp,image/heic,application/pdf,.xml,text/xml,application/xml"
        captura
        desativado={!!enviando}
        titulo={enviando ? `Enviando ${enviando}…` : 'Toque para tirar a foto ou escolher o arquivo'}
        detalhe="JPG, PNG, HEIC, PDF ou XML, até 15 MB. O XML é o mais preciso."
        aoEscolher={enviar}
      />
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
      <Aviso icone={<Camera aria-hidden="true" />}>Nada entra no estoque até alguém conferir. Se o pagamento já foi para a Júlia, envie a nota dentro da compra pendente dele: ela confere o mesmo pagamento, sem criar outra despesa.</Aviso>
      {aoVoltar && <Botao variante="fantasma" onClick={aoVoltar} style={{ alignSelf: 'flex-start' }}>Voltar</Botao>}
    </div>
  );
}

/** Recebimento sem documento (feira, mercado sem cupom). Segue a mesma conferência. */
function FormManual({ aberto, insumo, aoEnviando, aoCriar }: { aberto: boolean; insumo: { id: string; nome: string } | null; aoEnviando: (v: boolean) => void; aoCriar: (id: string) => void }) {
  const inicial = (): LinhaManual[] => [insumo ? { ...linhaVazia(), insumo: { valor: insumo.id, rotulo: insumo.nome }, descricao: insumo.nome } : linhaVazia()];
  const [fornecedor, setFornecedor] = useState('');
  const [documento, setDocumento] = useState('');
  const [desconto, setDesconto] = useState('');
  const [data, setData] = useState(hojeISO());
  const [total, setTotal] = useState('');
  const [linhas, setLinhas] = useState<LinhaManual[]>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const chave = useRef(novaChave());
  const enviandoRef = useRef(false);
  useEffect(() => {
    if (aberto) {
      setFornecedor('');
      setDocumento('');
      setDesconto('');
      setData(hojeISO());
      setTotal('');
      setLinhas(inicial());
      setErro(null);
      chave.current = novaChave();
    }
  }, [aberto, insumo?.id]);
  const soma = somaLinhas(linhas);
  async function criar(e: Event) {
    e.preventDefault();
    if (enviandoRef.current) return;
    const { itens, erro: er } = validarLinhas(linhas);
    if (er) return setErro(er);
    const t = paraDecimal(total) ?? soma.toFixed(2);
    if (!(Number(t) > 0)) return setErro('Informe o valor dos produtos (o total precisa ser maior que zero).');
    const d = desconto.trim() ? paraDecimal(desconto) : '0';
    if (d === null) return setErro('Desconto inválido.');
    const doc = documento.replace(/\D/g, '');
    enviandoRef.current = true;
    aoEnviando(true);
    setErro(null);
    try {
      const r = await estoque.compraManual({ fornecedor_nome: fornecedor.trim() || null, fornecedor_documento: doc || null, emitida_em: data, valor_total: t, desconto: d, itens }, chave.current);
      atualizarEstoque();
      avisar('Compra registrada. Confira os itens para dar entrada.', 'ok');
      aoCriar(r.id);
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível registrar.');
    } finally {
      enviandoRef.current = false;
      aoEnviando(false);
    }
  }
  return (
    <form id="form-recebimento-manual" class="pilha" onSubmit={criar} noValidate>
      <div class="grade-campos">
        <Campo rotulo="Fornecedor" opcional>{(id) => <input id={id} class="entrada" placeholder="Ex.: Feira do Mucuripe" value={fornecedor} onInput={(e) => setFornecedor(e.currentTarget.value)} />}</Campo>
        <Campo rotulo="CNPJ ou CPF" opcional>{(id) => <input id={id} class="entrada num" inputMode="numeric" maxLength={20} value={documento} onInput={(e) => setDocumento(e.currentTarget.value)} />}</Campo>
        <Campo rotulo="Data da compra">{(id) => <input id={id} type="date" class="entrada" max={hojeISO()} value={data} onChange={(e) => setData(e.currentTarget.value)} />}</Campo>
      </div>
      <LinhasItens linhas={linhas} aoMudar={setLinhas} />
      <div class="grade-campos">
        <Campo rotulo="Total pago" opcional ajuda={soma ? `Soma dos produtos: ${moeda(soma)}. Em branco, vale a soma.` : 'Em branco, vale a soma dos produtos.'}>
          {(id, d) => <EntradaMoeda id={id} descr={d} valor={total} aoMudar={setTotal} />}
        </Campo>
        <Campo rotulo="Desconto" opcional>{(id) => <EntradaMoeda id={id} valor={desconto} aoMudar={setDesconto} />}</Campo>
      </div>
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
      <p class="fraco">Sem nota fiscal, a compra fica identificada como digitada. Na conferência você escolhe como ela aparece no Financeiro: ligada a uma despesa que já existe, conta a pagar ou já paga — nunca duas vezes.</p>
    </form>
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

