// Conferência de compra, numa gaveta larga: documento original à esquerda, nota e itens à direita (no celular, em coluna,
// com o documento recolhível). Mesma tela para nota da Júlia, envio pelo painel, comprovante de Pix e compra sem nota.
// Abrir a conferência não movimenta nada: o estoque só muda em "Confirmar recebimento". Os botões do rodapé têm key
// própria: sem ela o Preact reaproveitaria o elemento de "Continuar" como o submit e o mesmo clique confirmaria a compra.
import { useEffect, useState } from 'preact/hooks';
import { FileText, ScanLine, RotateCw, ExternalLink, CheckCircle2, AlertTriangle, Info, PackageX, Bot, ArrowLeft, Check, FileCode } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta, dataHora, quantidade, hojeISO, paraDecimal, plural, num } from '../../lib/formato';
import { Gaveta, useConfirmacao, avisar, avisarErro } from '../../ui/camadas';
import { Botao, Aviso, Etiqueta, Campo } from '../../ui/base';
import { Dados, Esqueleto, Falha } from '../../ui/estados';
import { EntradaMoeda } from '../../ui/entradas';
import type { CompraDetalhe } from '../../lib/tipos/estoque';
import { ETAPA, LENDO, FONTE, ERRO_LEITURA, PENDENCIA, atualizarEstoque, textoProblemas, type PermissoesEstoque } from './comum';
import { ItemConferencia } from './ItemConferencia';
import { ConfirmarCompra, type Confirmado } from './ConfirmarCompra';
import { LinhasItens, linhaVazia, validarLinhas, type LinhaManual } from './EntradaCompra';

export function Conferencia({ id, perm, aoFechar, aoAbrir }: { id: string | null; perm: PermissoesEstoque; aoFechar: () => void; aoAbrir: (id: string) => void }) {
  const [lendo, setLendo] = useState(false);
  const consulta = useConsulta(id ? `estoque/compras/${id}` : null, () => estoque.compra(id!), { intervalo: lendo ? 1500 : undefined });
  const c = consulta.dados;
  const [passo, setPasso] = useState<'itens' | 'confirmar'>('itens');
  const [recibo, setRecibo] = useState<Confirmado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const { confirmar, elemento } = useConfirmacao();

  useEffect(() => {
    setPasso('itens');
    setRecibo(null);
  }, [id]);
  useEffect(() => setLendo(!!c && LENDO.includes(c.etapa)), [c?.etapa]);

  const titulo = c ? c.fornecedor?.nome ?? c.fornecedor_lido?.nome ?? (LENDO.includes(c.etapa) ? 'Lendo a nota…' : 'Fornecedor não identificado') : 'Compra';
  const sub = c ? [c.numero ? `Nota ${c.numero}` : null, c.emitida_em ? dataCurta(c.emitida_em.slice(0, 10), { ano: true }) : null, c.totais.total ? moeda(c.totais.total) : null].filter(Boolean).join(' · ') : undefined;
  const aguardando = c?.etapa === 'aguardando_conferencia';
  const semItens = aguardando && !c!.itens.length;
  // A gerência pode confirmar uma nota que não fecha, com motivo; os itens precisam estar resolvidos.
  const podeSeguir = !!c && aguardando && (c.pode_confirmar || (perm.editar && c.pendencias.every((p) => p === 'conferencia_aritmetica') && c.itens.length > 0));

  // Ler de novo cria uma compra NOVA a partir do mesmo arquivo (a antiga é cancelada): a gaveta passa para ela.
  const reprocessar = () =>
    confirmar({
      titulo: 'Ler o documento de novo?',
      texto: 'A leitura atual é substituída por uma nova, do mesmo arquivo. Nada entra no estoque até a conferência.',
      confirmar: 'Ler de novo',
      acao: async () => {
        setOcupado(true);
        try {
          const r = await estoque.reprocessar(c!.id);
          aoAbrir(r.id);
        } finally {
          setOcupado(false);
          atualizarEstoque();
        }
      },
      sucesso: 'Lendo o documento de novo…',
    });
  const cancelar = () =>
    confirmar({
      titulo: 'Cancelar esta compra?',
      texto: c?.etapa === 'confirmada' ? 'As entradas saem do estoque ao mesmo custo e a conta da compra é cancelada. Se a conta já foi paga, estorne o pagamento no Financeiro antes.' : 'A compra sai da lista de conferência. Nada foi lançado ainda.',
      confirmar: 'Cancelar compra',
      perigo: true,
      motivo: { rotulo: 'Motivo do cancelamento' },
      acao: async (m) => {
        try {
          await estoque.cancelarCompra(c!.id, m);
        } finally {
          atualizarEstoque();
        }
      },
      sucesso: 'Compra cancelada.',
    });

  // Conferir e confirmar: estoque.conferir. Cancelar (inclusive uma compra confirmada, que estorna): estoque.editar.
  let rodape = null;
  if (c && recibo) rodape = <Botao variante="primario" onClick={aoFechar}>Concluir</Botao>;
  else if (c && aguardando && !semItens && passo === 'itens' && perm.conferir)
    rodape = (
      <>
        <span class="fraco" style={{ marginRight: 'auto', alignSelf: 'center' }}>
          {c.pendencias.length ? c.pendencias.map(PENDENCIA).slice(0, 2).join(' · ') : 'Tudo conferido'}
        </span>
        {perm.editar && <Botao variante="fantasma" onClick={cancelar}>Cancelar compra</Botao>}
        <Botao key="continuar" variante="primario" icone={<Check aria-hidden="true" />} disabled={!podeSeguir} onClick={() => setPasso('confirmar')}>Continuar</Botao>
      </>
    );
  else if (c && aguardando && passo === 'confirmar' && perm.conferir)
    rodape = (
      <>
        <Botao key="voltar" icone={<ArrowLeft aria-hidden="true" />} onClick={() => setPasso('itens')} disabled={enviando}>Voltar aos itens</Botao>
        <Botao key="confirmar" variante="primario" type="submit" form="form-confirmar-compra" carregando={enviando} icone={<CheckCircle2 aria-hidden="true" />}>Confirmar recebimento</Botao>
      </>
    );
  else if (c && semItens && (perm.editar || (perm.conferir && c.arquivo_id)))
    rodape = (
      <>
        {perm.editar && <Botao variante="fantasma" onClick={cancelar}>Cancelar compra</Botao>}
        {perm.conferir && c.arquivo_id && <Botao icone={<RotateCw aria-hidden="true" />} carregando={ocupado} onClick={reprocessar}>Ler o documento de novo</Botao>}
      </>
    );
  else if (c?.etapa === 'confirmada' && perm.editar) rodape = <Botao variante="fantasma" onClick={cancelar}>Cancelar compra (estorna o estoque)</Botao>;
  else if (c?.etapa === 'falhou' && c.erro_codigo !== 'nota_ja_registrada' && (perm.conferir || perm.editar))
    rodape = (
      <>
        {perm.editar && <Botao variante="fantasma" onClick={cancelar}>Descartar</Botao>}
        {perm.conferir && c.arquivo_id && <Botao variante="primario" icone={<RotateCw aria-hidden="true" />} carregando={ocupado} onClick={reprocessar}>Ler de novo</Botao>}
      </>
    );

  return (
    <Gaveta aberta={!!id} aoFechar={aoFechar} titulo={titulo} subtitulo={sub} largura="larga" rodape={rodape} acoesTopo={c && <EtapaSelo c={c} />}>
      <Dados consulta={consulta} recurso="A compra" esqueleto={<Esqueleto linhas={10} />}>
        {(c: CompraDetalhe) => {
          if (recibo) return <Recibo c={c} r={recibo} />;
          if (LENDO.includes(c.etapa)) return <Leitura c={c} />;
          if (c.etapa === 'falhou') return <Falhou c={c} />;
          if (c.etapa === 'cancelada')
            return (
              <Aviso tom="atencao" icone={<PackageX aria-hidden="true" />}>
                <strong>Compra cancelada</strong> {c.cancelada_em ? `em ${dataHora(c.cancelada_em)}` : ''}. {c.cancelada_motivo ? `Motivo: ${c.cancelada_motivo}` : ''}
              </Aviso>
            );
          return (
            <div class="conferencia">
              <Documento c={c} />
              <div class="conferencia__dados">
                <Cabeca c={c} />
                {c.etapa === 'confirmada' ? (
                  <Confirmada c={c} />
                ) : semItens ? (
                  perm.conferir ? <PreencherItens c={c} /> : <Aviso tom="atencao" icone={<PackageX aria-hidden="true" />}>Faltam os produtos desta compra. Quem confere compras precisa informá-los.</Aviso>
                ) : passo === 'confirmar' ? (
                  <ConfirmarCompra c={c} perm={perm} form="form-confirmar-compra" aoEnviando={setEnviando} aoConfirmar={(r) => { setRecibo(r); avisar('Compra confirmada. Estoque atualizado.', 'ok'); }} />
                ) : (
                  <>
                    {c.fonte_leitura === 'foto_ia' && (
                      <Aviso tom="atencao" icone={<Bot aria-hidden="true" />}>
                        <strong>Lido por IA a partir da foto: confira cada item.</strong> Quantidades e unidades de foto erram mais que as do XML.
                      </Aviso>
                    )}
                    {c.aviso && <Aviso tom="info" icone={<Info aria-hidden="true" />}>{c.aviso}</Aviso>}
                    {c.conferencia && !c.conferencia.ok && (
                      <Aviso tom="atencao" icone={<AlertTriangle aria-hidden="true" />}>
                        <strong>A nota não fecha{c.divergencia_aceita ? ` (aceita: ${c.divergencia_aceita})` : ''}.</strong> {textoProblemas(c.conferencia.problemas)}
                      </Aviso>
                    )}
                    <section class="pilha pilha--p" aria-label="Itens da nota">
                      <div class="linha linha--entre">
                        <h3 class="secao-titulo">Itens ({c.itens.length})</h3>
                        <span class="fraco">{plural(c.itens.filter((i) => i.situacao === 'pendente').length, 'precisa de você', 'precisam de você')}</span>
                      </div>
                      <ul class="itens-compra">
                        {[...c.itens].sort((a, b) => Number(b.situacao === 'pendente') - Number(a.situacao === 'pendente') || a.ordem - b.ordem).map((it) => (
                          <ItemConferencia key={`${it.id}:${it.versao}`} compraId={c.id} fornecedorId={c.fornecedor?.id ?? null} it={it} editavel={perm.conferir} podeCriarInsumo={perm.editar} aoMudar={consulta.recarregar} />
                        ))}
                      </ul>
                    </section>
                  </>
                )}
              </div>
            </div>
          );
        }}
      </Dados>
      {elemento}
    </Gaveta>
  );
}

function EtapaSelo({ c }: { c: CompraDetalhe }) {
  if (c.etapa === 'aguardando_conferencia' && !c.itens.length) return <Etiqueta tom="atencao">Faltam os produtos</Etiqueta>;
  const e = ETAPA[c.etapa_painel] ?? ETAPA[c.etapa];
  const tom = e.tom === 'apagado' ? 'neutro' : e.tom;
  return <Etiqueta tom={tom}>{e.rotulo}</Etiqueta>;
}

function Cabeca({ c }: { c: CompraDetalhe }) {
  const t = c.totais;
  return (
    <dl class="nota-cabeca">
      <div>
        <dt>Fornecedor</dt>
        <dd>{c.fornecedor?.nome ?? c.fornecedor_lido?.nome ?? '—'}</dd>
        {c.fornecedor?.documento && <dd class="fraco num" style={{ fontWeight: 400 }}>{c.fornecedor.documento}</dd>}
      </div>
      <div>
        <dt>Documento</dt>
        <dd>{c.fonte_leitura ? FONTE[c.fonte_leitura] : '—'}</dd>
        <dd class="fraco" style={{ fontWeight: 400 }}>{c.origem === 'julia' ? 'Enviado pela Júlia' : 'Enviado pelo painel'}</dd>
      </div>
      <div>
        <dt>Nota e emissão</dt>
        <dd class="num">{c.numero ? `Nº ${c.numero}${c.serie ? ` · série ${c.serie}` : ''}` : 'Sem número'}</dd>
        <dd class="fraco" style={{ fontWeight: 400 }}>{c.emitida_em ? dataHora(c.emitida_em) : '—'}</dd>
      </div>
      <div>
        <dt>Total</dt>
        <dd class="num" style={{ fontSize: '18px', fontWeight: 650 }}>{moeda(t.total)}</dd>
        {(num(t.desconto) || num(t.frete)) ? <dd class="fraco num" style={{ fontWeight: 400 }}>{num(t.desconto) ? `desconto ${moeda(t.desconto)}` : ''}{num(t.desconto) && num(t.frete) ? ' · ' : ''}{num(t.frete) ? `frete ${moeda(t.frete)}` : ''}</dd> : null}
      </div>
    </dl>
  );
}

/** Documento original: imagem ou PDF por URL temporária do backend (5 min); XML não tem prévia (os dados vieram dele). */
function Documento({ c }: { c: CompraDetalhe }) {
  const largo = typeof matchMedia !== 'undefined' && matchMedia('(min-width: 901px)').matches;
  const [aberto, setAberto] = useState(largo);
  const url = useConsulta(c.arquivo_id && aberto ? `arquivos/${c.arquivo_id}/url` : null, () => financeiro.urlArquivo(c.arquivo_id!));
  return (
    <details class="conferencia__doc" open={aberto} onToggle={(e) => setAberto((e.currentTarget as HTMLDetailsElement).open)}>
      <summary><FileText size={16} aria-hidden="true" /> {aberto ? 'Esconder o documento' : 'Ver o documento original'}</summary>
      <div class="documento documento--nota">
        {!c.arquivo_id ? (
          <div class="estado estado--compacto"><span class="estado__icone"><FileText aria-hidden="true" /></span><h3>Sem documento</h3><p>Compra digitada no painel.</p></div>
        ) : url.erro ? (
          <Falha erro={url.erro} compacto recurso="O documento" aoTentar={url.recarregar} />
        ) : !url.dados ? (
          <div style={{ padding: '20px', width: '100%' }}><Esqueleto linhas={8} /></div>
        ) : url.dados.mime.startsWith('image/') ? (
          <a href={url.dados.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%' }} aria-label="Abrir o documento em tamanho real">
            <img src={url.dados.url} alt={`Documento da compra${c.fornecedor ? ` de ${c.fornecedor.nome}` : ''}`} />
          </a>
        ) : url.dados.mime.includes('pdf') ? (
          <iframe src={url.dados.url} title="Documento da compra (PDF)" />
        ) : url.dados.mime.includes('xml') ? (
          <div class="estado estado--compacto">
            <span class="estado__icone"><FileCode aria-hidden="true" /></span>
            <h3>Nota fiscal eletrônica (XML)</h3>
            <p>Os dados ao lado vieram direto do arquivo da nota, sem leitura de foto.</p>
            <a class="btn btn--p" href={url.dados.url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" /> Abrir o arquivo</a>
          </div>
        ) : (
          <a href={url.dados.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%' }} aria-label="Abrir o documento em tamanho real">
            <img src={url.dados.url} alt={`Documento da compra${c.fornecedor ? ` de ${c.fornecedor.nome}` : ''}`} />
          </a>
        )}
      </div>
    </details>
  );
}

const PASSOS: [string, string][] = [
  ['recebida', 'Documento recebido'],
  ['processando', 'Lendo o documento'],
  ['itens_extraidos', 'Itens lidos'],
  ['associacoes_sugeridas', 'Associando aos insumos'],
  ['aguardando_conferencia', 'Pronto para conferir'],
];

/** Leitura em andamento: animada pela etapa REAL gravada pelo backend (não há porcentagem inventada). */
function Leitura({ c }: { c: CompraDetalhe }) {
  const atual = PASSOS.findIndex(([e]) => e === c.etapa);
  return (
    <div class="leitura" role="status" aria-live="polite">
      <span class="estado__icone" style={{ width: '56px', height: '56px' }}><ScanLine aria-hidden="true" /></span>
      <div>
        <h3 style={{ fontSize: '17px' }}>{PASSOS[atual]?.[1] ?? 'Processando'}…</h3>
        <p class="suave">{c.etapa_detalhe ?? 'Isso costuma levar alguns segundos. Pode fechar e voltar depois: a leitura continua.'}</p>
      </div>
      <div class="leitura__barra" aria-hidden="true"><i style={{ width: `${((atual + 1) / PASSOS.length) * 100}%` }} /></div>
      <ol class="passos passos--vertical">
        {PASSOS.map(([e, r], k) => (
          <li key={e} aria-current={k === atual ? 'step' : undefined} data-feito={k < atual ? '' : undefined}>
            <b>{k < atual ? '✓' : k + 1}</b>
            {r}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Abre o documento original em outra aba (URL assinada do backend, vale 5 min). */
function DocumentoLink({ c }: { c: CompraDetalhe }) {
  const [abrindo, setAbrindo] = useState(false);
  async function abrir() {
    // A janela abre já no clique (senão o navegador bloqueia) e recebe a URL quando ela chega.
    const janela = window.open('', '_blank');
    if (janela) janela.opener = null;
    setAbrindo(true);
    try {
      const r = await financeiro.urlArquivo(c.arquivo_id!);
      if (janela) janela.location.href = r.url;
      else window.open(r.url, '_blank', 'noopener');
    } catch (e) {
      janela?.close();
      avisarErro(e);
    } finally {
      setAbrindo(false);
    }
  }
  return <Botao style={{ alignSelf: 'flex-start' }} icone={<ExternalLink aria-hidden="true" />} carregando={abrindo} onClick={abrir}>Ver o documento</Botao>;
}

function Falhou({ c }: { c: CompraDetalhe }) {
  const repetida = c.erro_codigo === 'nota_ja_registrada';
  return (
    <div class="pilha">
      <Aviso tom={repetida ? 'atencao' : 'perigo'} icone={<AlertTriangle aria-hidden="true" />}>
        <strong>{ERRO_LEITURA[c.erro_codigo ?? ''] ?? 'Não foi possível ler este documento.'}</strong>
        {c.etapa_detalhe && <div style={{ marginTop: '4px' }}>{c.etapa_detalhe}</div>}
        {repetida ? (
          <div style={{ marginTop: '6px' }}>Nada foi lançado em dobro. Procure a compra original na lista (mesmo fornecedor e número).</div>
        ) : (
          <div style={{ marginTop: '6px' }}>Tente ler de novo. Se não der, envie uma foto mais nítida, o PDF ou o XML — ou digite os itens em “Compra sem nota”.</div>
        )}
      </Aviso>
      {c.arquivo_id && <DocumentoLink c={c} />}
      {c.observacoes.length > 0 && <p class="fraco">Detalhes técnicos: {c.observacoes.join(', ')}</p>}
    </div>
  );
}

/** Compra que veio só do comprovante do pagamento: a pessoa digita os produtos aqui, sem reenviar o comprovante. */
function PreencherItens({ c }: { c: CompraDetalhe }) {
  const [linhas, setLinhas] = useState<LinhaManual[]>([linhaVazia(), linhaVazia()]);
  const [data, setData] = useState(c.emitida_em?.slice(0, 10) ?? hojeISO());
  const [total, setTotal] = useState(c.totais.total ? Number(c.totais.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const soma = linhas.reduce((s, l) => s + Number(paraDecimal(l.valor) ?? 0), 0);
  const t = Number(paraDecimal(total) ?? 0);
  async function salvar(e: Event) {
    e.preventDefault();
    const { itens, erro: er } = validarLinhas(linhas);
    if (er) return setErro(er);
    setEnviando(true);
    setErro(null);
    try {
      await estoque.preencherManual(c.id, { versao: c.versao, emitida_em: data, valor_total: paraDecimal(total) ?? soma.toFixed(2), itens });
      avisar('Produtos registrados. Agora confira cada item.', 'ok');
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível salvar.');
    } finally {
      setEnviando(false);
      atualizarEstoque();
    }
  }
  return (
    <form class="pilha" onSubmit={salvar} noValidate>
      <Aviso tom="atencao" icone={<PackageX aria-hidden="true" />}>
        <strong>Produtos e quantidades ainda não informados.</strong> Esta compra veio do comprovante do pagamento{c.origem === 'julia' ? ' enviado à Júlia' : ''}. Informe o que chegou para dar entrada no estoque — não precisa reenviar o comprovante.
      </Aviso>
      <LinhasItens linhas={linhas} aoMudar={setLinhas} />
      <div class="grade-campos">
        <Campo rotulo="Data da compra">{(id) => <input id={id} type="date" class="entrada" max={hojeISO()} value={data} onChange={(e) => setData(e.currentTarget.value)} />}</Campo>
        <Campo rotulo="Total pago" ajuda={soma ? `Soma dos produtos: ${moeda(soma)}${t && Math.abs(soma - t) > 0.05 ? ' — não bate com o total' : ''}` : undefined}>
          {(id, d) => <EntradaMoeda id={id} descr={d} valor={total} aoMudar={setTotal} />}
        </Campo>
      </div>
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
      <p class="fraco">Tem a nota fiscal? Envie a foto em “Enviar nota”: a leitura vira uma conferência própria e, na confirmação, sugere ligar a nota a este pagamento.</p>
      <Botao type="submit" variante="primario" carregando={enviando} style={{ alignSelf: 'flex-start' }}>Salvar produtos</Botao>
    </form>
  );
}

function ListaEntradas({ c }: { c: CompraDetalhe }) {
  const entraram = c.itens.filter((i) => (i.situacao === 'confirmado' || i.situacao === 'sugerido') && i.sugestao?.insumo_id);
  return (
    <ul class="lista" style={{ border: '1px solid var(--borda)', borderRadius: '12px' }}>
      {entraram.map((i) => (
        <li key={i.id} class="linha linha--entre" style={{ padding: '10px 14px' }}>
          <span><strong style={{ fontWeight: 500 }}>{i.sugestao!.insumo}</strong> <span class="fraco">· {i.descricao}</span></span>
          <span class="num">+{quantidade(i.sugestao!.quantidade_base, i.sugestao!.unidade_base)}</span>
        </li>
      ))}
      {c.itens.filter((i) => i.situacao === 'nao_estoque').map((i) => (
        <li key={i.id} class="linha linha--entre" style={{ padding: '10px 14px' }}>
          <span>{i.descricao}</span>
          <span class="fraco">despesa · {moeda(i.valor_liquido)}</span>
        </li>
      ))}
    </ul>
  );
}

function Confirmada({ c }: { c: CompraDetalhe }) {
  return (
    <div class="pilha">
      <Aviso tom="ok" icone={<CheckCircle2 aria-hidden="true" />}>
        <strong>Compra confirmada</strong>{c.confirmada_em ? ` em ${dataHora(c.confirmada_em)}` : ''}.{c.divergencia_aceita ? ` Diferença aceita: ${c.divergencia_aceita}.` : ''}
      </Aviso>
      <h3 class="secao-titulo">O que entrou</h3>
      <ListaEntradas c={c} />
      {c.despesa.despesa_id && <a class="btn btn--p" style={{ alignSelf: 'flex-start' }} href={`/admin/financeiro?aba=lancamentos&despesa=${c.despesa.despesa_id}`}>Ver a despesa no Financeiro</a>}
    </div>
  );
}

function Recibo({ c, r }: { c: CompraDetalhe; r: Confirmado }) {
  return (
    <div class="pilha" style={{ maxWidth: '720px' }}>
      <div class="estado" style={{ paddingBottom: '8px' }}>
        <span class="estado__icone" style={{ background: 'var(--ok-suave)', color: 'var(--ok)' }}><CheckCircle2 aria-hidden="true" /></span>
        <h3>{r.ja_estava_confirmada ? 'Esta compra já estava confirmada' : 'Compra confirmada'}</h3>
        <p>{plural(r.movimentos, 'entrada registrada', 'entradas registradas')} no estoque{r.despesa_id ? ' e a despesa ligada no Financeiro' : ''}.</p>
      </div>
      <ListaEntradas c={c} />
      {r.despesa_id && <a class="btn btn--p" style={{ alignSelf: 'flex-start' }} href={`/admin/financeiro?aba=lancamentos&despesa=${r.despesa_id}`}>Ver a despesa no Financeiro</a>}
    </div>
  );
}
