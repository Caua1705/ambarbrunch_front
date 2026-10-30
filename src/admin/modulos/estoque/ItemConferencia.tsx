// Um item da nota na conferência: o que foi lido, a qual insumo ele corresponde, a conversão para a unidade-base e as
// decisões possíveis (confirmar sugestão, trocar, informar conversão, "não é estoque", ignorar). Cada decisão é um PATCH
// com a `versao` lida do item; nada entra no estoque antes da confirmação da compra inteira.
import { useState } from 'preact/hooks';
import { ArrowRight, Check, MoreHorizontal, Replace, Ruler, Ban, EyeOff, Sparkles } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, quantidade, custoBase, decimal } from '../../lib/formato';
import { Suspenso, avisar, avisarErro } from '../../ui/camadas';
import { Botao, Etiqueta, Situacao } from '../../ui/base';
import { Autocompletar, type OpcaoAuto } from '../../ui/entradas';
import type { ItemCompra, ResolucaoItem, UnidadeBase } from '../../lib/tipos/estoque';
import { SITUACAO_ITEM, ALERTA, UNIDADE_CURTA, atualizarEstoque } from './comum';

const CONFIANCA = { alta: 'Confiança alta', media: 'Confiança média — confira', baixa: 'Confiança baixa — confira', nenhuma: 'Sem sugestão' } as const;

type Modo = 'ver' | 'trocar' | 'conversao' | 'nao_estoque' | 'novo';

export function ItemConferencia({ compraId, fornecedorId, it, editavel, podeCriarInsumo, aoMudar }: { compraId: string; fornecedorId: string | null; it: ItemCompra; editavel: boolean; podeCriarInsumo: boolean; aoMudar: () => void }) {
  const [modo, setModo] = useState<Modo>(editavel && it.situacao === 'pendente' && !it.sugestao?.insumo_id ? 'trocar' : 'ver');
  const [ocupado, setOcupado] = useState(false);
  const [pendente, setPendente] = useState<{ insumo_id?: string; novo?: { nome: string; unidade_base: UnidadeBase }; unidade: UnidadeBase | null; texto: string } | null>(null);
  const [fator, setFator] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaUnidade, setNovaUnidade] = useState<UnidadeBase>('g');
  const s = it.sugestao;

  async function resolver(r: Omit<ResolucaoItem, 'versao'>, ok?: string) {
    setOcupado(true);
    try {
      await estoque.resolverItem(compraId, it.id, { versao: it.versao, ...r });
      if (ok) avisar(ok, 'ok');
      setModo('ver');
      setPendente(null);
      setFator('');
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'conversao_ambigua') {
        // O backend não sabe quanto vem na embalagem: a pessoa informa e reenviamos com o fator.
        const unidade = (e.dados?.unidade_base as UnidadeBase | undefined) ?? null;
        setPendente({ insumo_id: r.insumo_id ?? undefined, novo: r.novo_insumo ?? undefined, unidade, texto: e.message });
        setModo('conversao');
      } else {
        avisarErro(e);
      }
    } finally {
      setOcupado(false);
      atualizarEstoque();
      aoMudar();
    }
  }

  // insumos-sugestoes devolve UM objeto (a melhor associação para o texto, ou insumo_id null): ele vai no topo, e a
  // busca no catálogo completa as opções.
  const buscar = async (texto: string): Promise<OpcaoAuto[]> => {
    const t = texto.trim();
    const [sug, cat] = await Promise.all([
      estoque.sugestaoInsumo((t || it.descricao).slice(0, 200), it.unidade, fornecedorId).catch(() => null),
      estoque.insumos({ busca: t || undefined, limite: 20 }),
    ]);
    const opcoes: OpcaoAuto[] = [];
    if (sug?.insumo_id && sug.insumo && (t.length >= 2 || !t)) opcoes.push({ valor: sug.insumo_id, rotulo: sug.insumo, detalhe: `sugestão · ${CONFIANCA[sug.confianca] ?? sug.confianca}${sug.unidade_base ? ` · em ${UNIDADE_CURTA[sug.unidade_base]}` : ''}` });
    for (const i of cat.itens) if (i.id !== sug?.insumo_id) opcoes.push({ valor: i.id, rotulo: i.nome, detalhe: `em ${UNIDADE_CURTA[i.unidade_base]}` });
    return opcoes;
  };

  const fatorN = Number(fator.replace(',', '.'));
  const unidadeConv = pendente?.unidade ?? pendente?.novo?.unidade_base ?? s?.unidade_base ?? null;

  return (
    <li class="item-compra" data-situacao={it.situacao}>
      <div class="item-compra__topo">
        <div style={{ minWidth: 0 }}>
          <div class="item-compra__nome">{it.descricao}</div>
          <div class="item-compra__meta num">
            {decimal(it.quantidade, 3)} {it.unidade} · {moeda(it.valor_liquido)}
            {it.valor_unitario && <span class="fraco"> ({moeda(it.valor_unitario)}/{it.unidade})</span>}
          </div>
        </div>
        <Situacao tom={SITUACAO_ITEM[it.situacao].tom} destaque={it.situacao === 'pendente'}>{SITUACAO_ITEM[it.situacao].rotulo}</Situacao>
      </div>

      {it.alertas.length > 0 && (
        <div class="linha" style={{ gap: '6px' }}>
          {it.alertas.map((a) => <Etiqueta key={a} tom="atencao">{ALERTA[a] ?? a}</Etiqueta>)}
        </div>
      )}

      {it.situacao === 'nao_estoque' && <div class="item-compra__assoc">Vira despesa, não estoque{it.categoria_despesa ? <> · categoria <strong>{it.categoria_despesa}</strong></> : null}</div>}
      {it.situacao === 'ignorado' && <div class="item-compra__assoc">Fora do estoque e da conta (ex.: linha repetida, brinde).</div>}

      {s?.insumo_id && it.situacao !== 'nao_estoque' && it.situacao !== 'ignorado' && modo !== 'trocar' && (
        <div class="item-compra__assoc">
          <ArrowRight size={14} aria-hidden="true" />
          <strong>{s.insumo}</strong>
          {s.quantidade_base && s.unidade_base && <span class="num">{quantidade(s.quantidade_base, s.unidade_base)}</span>}
          {s.fator && s.unidade_base && <span class="fraco num">1 {it.unidade} = {quantidade(s.fator, s.unidade_base)}</span>}
          {s.custo_unitario_base && s.unidade_base && <span class="num">{custoBase(s.custo_unitario_base, s.unidade_base)}</span>}
          {it.situacao === 'pendente' && s.confianca && s.confianca !== 'alta' && <Etiqueta tom="atencao">{CONFIANCA[s.confianca]}</Etiqueta>}
          {it.situacao === 'pendente' && !s.fator && <span class="fraco">Falta a conversão</span>}
        </div>
      )}

      {modo === 'trocar' && (
        <div class="item-compra__acoes">
          <Autocompletar
            rotulo={`Insumo para ${it.descricao}`}
            placeholder="Buscar o insumo (ex.: leite)"
            valor={null}
            buscar={buscar}
            aoEscolher={(o) => o && resolver({ insumo_id: o.valor }, `Item associado a ${o.rotulo}.`)}
            criar={podeCriarInsumo ? { rotulo: (t) => `Criar o insumo “${t}”`, acao: (t) => { setNovoNome(t); setModo('novo'); } } : undefined}
          />
          {s?.insumo_id ? (
            <Botao tamanho="p" variante="fantasma" onClick={() => setModo('ver')}>Voltar</Botao>
          ) : (
            <Suspenso rotulo={`Mais opções para ${it.descricao}`} gatilho={(p) => <Botao tamanho="p" variante="fantasma" so_icone {...p} icone={<MoreHorizontal aria-hidden="true" />} />}>
              {(fechar) => (
                <>
                  <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); setModo('nao_estoque'); }}><Ban aria-hidden="true" /> Não é estoque (vira despesa)</button>
                  <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); resolver({ ignorar: true }, 'Item ignorado.'); }}><EyeOff aria-hidden="true" /> Ignorar este item</button>
                </>
              )}
            </Suspenso>
          )}
        </div>
      )}

      {modo === 'novo' && (
        <div class="item-compra__acoes">
          <input class="entrada" aria-label="Nome do novo insumo" value={novoNome} onInput={(e) => setNovoNome(e.currentTarget.value)} style={{ flex: '1 1 200px' }} />
          <select class="selecao" aria-label="Unidade-base do novo insumo" value={novaUnidade} onChange={(e) => setNovaUnidade(e.currentTarget.value as UnidadeBase)} style={{ width: 'auto' }}>
            <option value="g">em gramas</option>
            <option value="ml">em mililitros</option>
            <option value="un">em unidades</option>
          </select>
          <Botao tamanho="p" variante="primario" carregando={ocupado} disabled={novoNome.trim().length < 2} onClick={() => resolver({ novo_insumo: { nome: novoNome.trim(), unidade_base: novaUnidade } }, `Insumo “${novoNome.trim()}” criado.`)}>Criar e associar</Botao>
          <Botao tamanho="p" variante="fantasma" onClick={() => setModo('trocar')}>Voltar</Botao>
        </div>
      )}

      {modo === 'conversao' && (
        <div class="pilha pilha--p">
          <span class="campo__rotulo">{pendente?.texto ?? `Quanto vem em 1 ${it.unidade}${unidadeConv ? ` (em ${UNIDADE_CURTA[unidadeConv]})` : ''}?`}</span>
          <div class="item-compra__acoes">
            <div class="entrada-grupo" style={{ flex: '0 1 200px' }}>
              <input class="entrada num" inputMode="decimal" aria-label={`Quantidade em 1 ${it.unidade}`} value={fator} onInput={(e) => setFator(e.currentTarget.value)} style={{ paddingRight: '44px' }} data-autofoco />
              <span class="fraco" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }}>{unidadeConv ? UNIDADE_CURTA[unidadeConv] : ''}</span>
            </div>
            {fatorN > 0 && unidadeConv && <span class="fraco num">Total: {quantidade(fatorN * Number(it.quantidade), unidadeConv)}</span>}
            <Botao tamanho="p" variante="primario" carregando={ocupado} disabled={!(fatorN > 0)} onClick={() => resolver({ insumo_id: pendente?.insumo_id ?? s?.insumo_id ?? undefined, novo_insumo: pendente?.novo, fator: String(fatorN) }, 'Conversão registrada.')}>Aplicar</Botao>
            <Botao tamanho="p" variante="fantasma" onClick={() => { setModo('ver'); setPendente(null); }}>Voltar</Botao>
          </div>
          {unidadeConv === 'g' && <span class="campo__ajuda">Ex.: caixa com 12 pacotes de 500 g → 6000.</span>}
          {unidadeConv === 'ml' && <span class="campo__ajuda">Ex.: caixa com 12 litros → 12000.</span>}
        </div>
      )}

      {modo === 'nao_estoque' && <NaoEstoque ocupado={ocupado} aoEscolher={(c, nome) => resolver({ nao_estoque: c }, `Marcado como despesa (${nome}).`)} aoVoltar={() => setModo(s?.insumo_id || it.situacao !== 'pendente' ? 'ver' : 'trocar')} />}

      {modo === 'ver' && editavel && (
        <div class="item-compra__acoes">
          {it.situacao === 'pendente' && s?.insumo_id && s.fator && (
            <Botao tamanho="p" variante="primario" icone={<Check aria-hidden="true" />} carregando={ocupado} onClick={() => resolver({ insumo_id: s.insumo_id! }, `Confirmado: ${s.insumo}.`)}>
              É {s.insumo}
            </Botao>
          )}
          {it.situacao === 'pendente' && s?.insumo_id && !s.fator && (
            <Botao tamanho="p" variante="primario" icone={<Ruler aria-hidden="true" />} onClick={() => { setPendente({ insumo_id: s.insumo_id!, unidade: s.unidade_base, texto: `Quanto vem em 1 ${it.unidade} (em ${s.unidade_base ? UNIDADE_CURTA[s.unidade_base] : 'unidade-base'})?` }); setModo('conversao'); }}>
              Informar conversão
            </Botao>
          )}
          {it.situacao === 'sugerido' && <span class="fraco linha" style={{ gap: '4px' }}><Sparkles size={14} aria-hidden="true" /> Entra assim ao confirmar a compra</span>}
          <Botao tamanho="p" icone={<Replace aria-hidden="true" />} onClick={() => setModo('trocar')}>{s?.insumo_id && it.situacao !== 'nao_estoque' && it.situacao !== 'ignorado' ? 'Trocar insumo' : 'Associar a um insumo'}</Botao>
          <Suspenso rotulo={`Mais opções para ${it.descricao}`} gatilho={(p) => <Botao tamanho="p" variante="fantasma" so_icone {...p} icone={<MoreHorizontal aria-hidden="true" />} />}>
            {(fechar) => (
              <>
                {s?.insumo_id && it.situacao !== 'nao_estoque' && it.situacao !== 'ignorado' && (
                  <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); setPendente({ insumo_id: s.insumo_id!, unidade: s.unidade_base, texto: `Quanto vem em 1 ${it.unidade} (em ${s.unidade_base ? UNIDADE_CURTA[s.unidade_base] : 'unidade-base'})?` }); setModo('conversao'); }}>
                    <Ruler aria-hidden="true" /> Corrigir a conversão
                  </button>
                )}
                {it.situacao !== 'nao_estoque' && <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); setModo('nao_estoque'); }}><Ban aria-hidden="true" /> Não é estoque (vira despesa)</button>}
                {it.situacao !== 'ignorado' && <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); resolver({ ignorar: true }, 'Item ignorado.'); }}><EyeOff aria-hidden="true" /> Ignorar este item</button>}
              </>
            )}
          </Suspenso>
        </div>
      )}
    </li>
  );
}

/** Categoria financeira para o item que não é estoque (limpeza, embalagem…): vem do plano de contas real. */
function NaoEstoque({ ocupado, aoEscolher, aoVoltar }: { ocupado: boolean; aoEscolher: (codigo: string, nome: string) => void; aoVoltar: () => void }) {
  const cats = useConsulta('financeiro/categorias', () => financeiro.categorias());
  const [cod, setCod] = useState('');
  const opcoes = (cats.dados ?? []).filter((c) => c.ativo && c.grupo !== 'compras_estoque' && c.grupo !== 'pendente' && c.grupo !== 'retirada' && c.grupo !== 'repasse');
  return (
    <div class="item-compra__acoes">
      {cats.erro ? (
        <span class="fraco">As categorias do Financeiro não estão disponíveis ({cats.erro.message}).</span>
      ) : (
        <select class="selecao" aria-label="Categoria da despesa" value={cod} onChange={(e) => setCod(e.currentTarget.value)} style={{ flex: '1 1 220px', width: 'auto' }} disabled={cats.carregando}>
          <option value="">{cats.carregando ? 'Carregando categorias…' : 'Escolha a categoria da despesa'}</option>
          {opcoes.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}
        </select>
      )}
      <Botao tamanho="p" variante="primario" carregando={ocupado} disabled={!cod} onClick={() => aoEscolher(cod, opcoes.find((c) => c.codigo === cod)?.nome ?? cod)}>Confirmar</Botao>
      <Botao tamanho="p" variante="fantasma" onClick={aoVoltar}>Voltar</Botao>
    </div>
  );
}
