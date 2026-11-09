// Um item lido da nota na conferência, numa linha compacta: o texto da nota, o insumo (seletor único do cadastro, pelo
// id), quantidade, unidade, valor unitário e subtotal como vieram no documento, e as decisões — confirmar a sugestão,
// trocar o insumo, informar a conversão, "não é estoque" ou "não chegou". Cada decisão é um PATCH com a `versao` lida do
// item; nada entra no estoque antes da confirmação da compra inteira. Sugestão da leitura (mesmo com confiança alta) só
// vale depois que uma pessoa clica em "Confirmar": a conferência não segue com sugestão sem confirmação.
import { useState } from 'preact/hooks';
import { Check, MoreHorizontal, Ruler, Ban, EyeOff, Undo2 } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, quantidade, custoBase, decimal } from '../../lib/formato';
import { Suspenso, avisar, avisarErro } from '../../ui/camadas';
import { Botao, Etiqueta } from '../../ui/base';
import type { ItemCompra, ResolucaoItem, UnidadeBase } from '../../lib/tipos/estoque';
import { ALERTA, UNIDADE_CURTA, atualizarEstoque } from './comum';
import { SeletorInsumo, baseDaUnidadeCompra, type InsumoEscolhido } from './SeletorInsumo';

const CONFIANCA = { alta: 'confiança alta', media: 'confiança média', baixa: 'confiança baixa', nenhuma: 'sem sugestão' } as const;
/** Como o motor achou o candidato (nível da cascata), em português. */
const MOTIVO_CANDIDATO: Record<string, string> = {
  gtin: 'Mesmo código de barras (GTIN)',
  codigo: 'Mesmo código do produto neste fornecedor',
  codigo_fornecedor: 'Mesmo código do produto neste fornecedor',
  alias_fornecedor: 'Texto já confirmado com este fornecedor',
  alias: 'Texto já confirmado em outra compra',
  texto: 'Nome parecido',
};

type Modo = 'ver' | 'trocar' | 'conversao' | 'nao_estoque';

export function ItemConferencia({ compraId, it, editavel, aoMudar }: { compraId: string; it: ItemCompra; editavel: boolean; aoMudar: () => void }) {
  const [modo, setModo] = useState<Modo>('ver');
  const [ocupado, setOcupado] = useState(false);
  const [pendente, setPendente] = useState<{ insumo_id: string; unidade: UnidadeBase | null; texto: string } | null>(null);
  const [fator, setFator] = useState('');
  const s = it.sugestao;
  const fora = it.situacao === 'nao_estoque' || it.situacao === 'ignorado';
  const escolhido: InsumoEscolhido | null = s?.insumo_id && s.insumo && s.unidade_base && !fora ? { id: s.insumo_id, nome: s.insumo, unidade_base: s.unidade_base } : null;

  async function resolver(r: Omit<ResolucaoItem, 'versao'>, ok?: string) {
    setOcupado(true);
    try {
      await estoque.resolverItem(compraId, it.id, { versao: it.versao, ...r });
      if (ok) avisar(ok, 'ok');
      setModo('ver');
      setPendente(null);
      setFator('');
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'conversao_ambigua' && r.insumo_id) {
        // O backend não sabe quanto vem na embalagem: a pessoa informa e reenviamos com o fator.
        const unidade = (e.dados?.unidade_base as UnidadeBase | undefined) ?? null;
        setPendente({ insumo_id: r.insumo_id, unidade, texto: e.message });
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
  const pedirConversao = (insumoId: string, unidade: UnidadeBase | null) => {
    setPendente({ insumo_id: insumoId, unidade, texto: `Quanto vem em 1 ${it.unidade}${unidade ? ` (em ${UNIDADE_CURTA[unidade]})` : ''}?` });
    setModo('conversao');
  };

  const fatorN = Number(fator.replace(',', '.'));
  const unidadeConv = pendente?.unidade ?? s?.unidade_base ?? null;
  const mostraSeletor = editavel && (!fora || modo === 'trocar');
  // Motor de correspondência (0028): candidatos para o item que ainda precisa de alguém (GTIN, código, texto já
  // confirmado, nome parecido). Cada um é só uma opção — escolher é um clique da pessoa, como no seletor. Backend
  // anterior (404) ou falha: a lista some, o seletor continua.
  const candidatos = useConsulta(editavel && it.situacao === 'pendente' ? `estoque/compras/${compraId}/itens/${it.id}/candidatos:${it.versao}` : null, () => estoque.candidatosItem(compraId, it.id));
  const opcoesMotor = (candidatos.dados?.candidatos ?? []).filter((c) => c.insumo_id !== escolhido?.id).slice(0, 3);

  return (
    <li class="itens-tabela__linha item-lido" data-situacao={it.situacao}>
      <div class="itens-tabela__insumo">
        <span class="item-lido__nota" title="Como veio no documento">{it.descricao}</span>
        {mostraSeletor ? (
          <SeletorInsumo
            rotulo={`Insumo para ${it.descricao}`}
            tipo="comprado"
            valor={escolhido}
            unidadeSugerida={baseDaUnidadeCompra(it.unidade)}
            desativado={ocupado}
            aoEscolher={(i) => i && i.id !== escolhido?.id && resolver({ insumo_id: i.id }, `Item associado a ${i.nome}.`)}
          />
        ) : fora ? (
          <span class="item-lido__fora">{it.situacao === 'nao_estoque' ? <>Despesa, não estoque{it.categoria_despesa ? <> · {it.categoria_despesa}</> : null}</> : 'Não chegou · fora do estoque'}</span>
        ) : (
          <span>{s?.insumo ?? <span class="fraco">Sem insumo</span>}</span>
        )}
        {escolhido && s?.fator && s.quantidade_base && s.unidade_base && (
          <span class="item-lido__conv num">
            1 {it.unidade} = {quantidade(s.fator, s.unidade_base)} · entra {quantidade(s.quantidade_base, s.unidade_base)}
            {s.custo_unitario_base ? ` · ${custoBase(s.custo_unitario_base, s.unidade_base)}` : ''}
          </span>
        )}
        {escolhido && !s?.fator && it.situacao === 'pendente' && <span class="item-lido__conv item-lido__conv--falta">Falta a conversão</span>}
        {it.situacao === 'sugerido' && s?.confianca && <span class="item-lido__conv">Sugestão da leitura ({CONFIANCA[s.confianca]}): confirme</span>}
        {opcoesMotor.length > 0 && (
          <span class="item-lido__candidatos" role="group" aria-label={`Correspondências para ${it.descricao}`} data-teste="candidatos">
            <span class="item-lido__conv">{escolhido ? 'Ou é:' : 'Pode ser:'}</span>
            {opcoesMotor.map((c) => (
              <button
                key={c.insumo_id}
                type="button"
                class="item-lido__candidato"
                disabled={ocupado}
                title={[MOTIVO_CANDIDATO[c.nivel] ?? c.motivo, c.alertas.map((a) => ALERTA[a] ?? a).join(' · ')].filter(Boolean).join(' — ')}
                onClick={() => resolver({ insumo_id: c.insumo_id, ...(c.fator ? { fator: c.fator } : {}) }, `Item associado a ${c.nome}.`)}
              >
                {c.nome}
                <small>{[c.status === 'confirmado' ? 'já confirmado antes' : c.status === 'revisar' ? 'revisar' : null, c.score != null ? `${Math.round(c.score)}%` : null].filter(Boolean).join(' · ')}</small>
              </button>
            ))}
          </span>
        )}
        {it.alertas.length > 0 && (
          <span class="linha" style={{ gap: '4px' }}>
            {it.alertas.map((a) => <Etiqueta key={a} tom="atencao">{ALERTA[a] ?? a}</Etiqueta>)}
          </span>
        )}
      </div>
      <div class="itens-tabela__celula"><span class="itens-tabela__rotulo">Quantidade</span><span class="num">{decimal(it.quantidade, 3)}</span></div>
      <div class="itens-tabela__celula"><span class="itens-tabela__rotulo">Unidade</span><span>{it.unidade}</span></div>
      <div class="itens-tabela__celula"><span class="itens-tabela__rotulo">Valor unitário</span><span class="num">{it.valor_unitario ? moeda(it.valor_unitario) : '—'}</span></div>
      <div class="itens-tabela__celula"><span class="itens-tabela__rotulo">Subtotal</span><span class="num">{moeda(it.valor_liquido)}</span></div>
      <div class="item-lido__acoes">
        {it.situacao === 'confirmado' && <span class="item-lido__ok" title="Conferido"><Check aria-hidden="true" /><span class="sr">Conferido</span></span>}
        {/* Sugestão da leitura, ou item já com insumo e conversão que ainda espera alguém dizer que é ele. */}
        {editavel && (it.situacao === 'sugerido' || (it.situacao === 'pendente' && !!s?.fator)) && escolhido && (
          <Botao tamanho="p" variante="primario" icone={<Check aria-hidden="true" />} carregando={ocupado} aria-label={`Confirmar ${escolhido.nome} para ${it.descricao}`} onClick={() => resolver({ insumo_id: escolhido.id }, `Confirmado: ${escolhido.nome}.`)}>
            Confirmar
          </Botao>
        )}
        {editavel && it.situacao === 'pendente' && escolhido && !s?.fator && (
          <Botao tamanho="p" variante="primario" icone={<Ruler aria-hidden="true" />} onClick={() => pedirConversao(escolhido.id, escolhido.unidade_base)}>Conversão</Botao>
        )}
        {editavel && (
          <Suspenso rotulo={`Mais opções para ${it.descricao}`} gatilho={(p) => <Botao tamanho="p" variante="fantasma" so_icone {...p} icone={<MoreHorizontal aria-hidden="true" />} />}>
            {(fechar) => (
              <>
                {escolhido && s?.fator && (
                  <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); pedirConversao(escolhido.id, escolhido.unidade_base); }}>
                    <Ruler aria-hidden="true" /> Corrigir a conversão
                  </button>
                )}
                {fora && <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); setModo('trocar'); }}><Undo2 aria-hidden="true" /> Associar a um insumo</button>}
                {it.situacao !== 'nao_estoque' && <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); setModo('nao_estoque'); }}><Ban aria-hidden="true" /> Não é estoque (vira despesa)</button>}
                {it.situacao !== 'ignorado' && <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); resolver({ ignorar: true }, 'Item fora deste recebimento: não entra no estoque.'); }}><EyeOff aria-hidden="true" /> Não chegou / ignorar</button>}
              </>
            )}
          </Suspenso>
        )}
      </div>

      {modo === 'conversao' && pendente && (
        <div class="item-lido__extra">
          <span class="campo__rotulo">{pendente.texto}</span>
          <div class="item-compra__acoes">
            <div class="entrada-grupo" style={{ flex: '0 1 200px' }}>
              <input class="entrada num" inputMode="decimal" aria-label={`Quantidade em 1 ${it.unidade}`} value={fator} onInput={(e) => setFator(e.currentTarget.value)} style={{ paddingRight: '44px' }} />
              <span class="fraco" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }}>{unidadeConv ? UNIDADE_CURTA[unidadeConv] : ''}</span>
            </div>
            {fatorN > 0 && unidadeConv && <span class="fraco num">Total: {quantidade(fatorN * Number(it.quantidade), unidadeConv)}</span>}
            <Botao tamanho="p" variante="primario" carregando={ocupado} disabled={!(fatorN > 0)} onClick={() => resolver({ insumo_id: pendente.insumo_id, fator: String(fatorN) }, 'Conversão registrada.')}>Aplicar</Botao>
            <Botao tamanho="p" variante="fantasma" onClick={() => { setModo('ver'); setPendente(null); }}>Voltar</Botao>
          </div>
        </div>
      )}
      {modo === 'nao_estoque' && (
        <div class="item-lido__extra">
          <NaoEstoque ocupado={ocupado} aoEscolher={(c, nome) => resolver({ nao_estoque: c }, `Marcado como despesa (${nome}).`)} aoVoltar={() => setModo('ver')} />
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
