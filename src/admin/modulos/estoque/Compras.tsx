// Compras: a tela inicial do Estoque. Tudo o que chega (nota pela Júlia, foto/PDF/XML pelo painel, pagamento de insumos,
// compra de feira) cai na MESMA lista e passa pela MESMA conferência (B1/B2/B3 no backend; o bloqueio aparece com o
// motivo na conferência). Pendências primeiro; uma linha discreta diz o que mais pede atenção (GET /estoque/resumo) e se a
// baixa automática está ligada — hoje desligada, e o painel nunca a mostra como ativa. Lista e conferência:
// estoque.conferir.
import { useMemo, useState } from 'preact/hooks';
import { PencilLine, PackageCheck, Upload, Info } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { moeda, dataCurta, plural, relativo } from '../../lib/formato';
import { Botao, Cartao, Segmentado } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { CompraLista } from '../../lib/tipos/estoque';
import { SituacaoCompra, OrigemCompra, LENDO, type PermissoesEstoque } from './comum';
import { Conferencia } from './Conferencia';
import { EnviarNota, CompraManual } from './EntradaCompra';

type Filtro = 'conferir' | 'problemas' | 'confirmadas' | 'todas';

export function Compras({ perm, unidade, aberta, aoAbrir, aoIrCancelamentos }: { perm: PermissoesEstoque; unidade: string | null; aberta: string | null; aoAbrir: (id: string | null) => void; aoIrCancelamentos: () => void }) {
  const [filtro, setFiltro] = useState<Filtro>('conferir');
  const [manual, setManual] = useState(false);
  const [enviar, setEnviar] = useState(false);
  const resumo = useConsulta('estoque/resumo', () => estoque.resumo());
  const lista = useConsulta(perm.conferir ? 'estoque/compras?todas' : null, () => estoque.compras({ limite: 200 }));
  const todas = lista.dados?.itens ?? [];
  const lendo = todas.some((c) => LENDO.includes(c.etapa));
  // Enquanto alguma nota está sendo lida, a lista se atualiza sozinha (só nesse caso).
  useConsulta(lendo ? 'estoque/compras?todas' : null, () => estoque.compras({ limite: 200 }), { intervalo: 3000 });

  const conferir = todas.filter((c) => c.etapa === 'aguardando_conferencia' || LENDO.includes(c.etapa));
  const problemas = todas.filter((c) => c.etapa === 'falhou' || (c.etapa === 'aguardando_conferencia' && c.sem_itens)).length;
  const filtradas = useMemo(() => {
    if (filtro === 'conferir') return conferir;
    if (filtro === 'confirmadas') return todas.filter((c) => c.etapa === 'confirmada');
    // Com problema: a leitura falhou ou chegou só o pagamento, sem os produtos (não entra no estoque assim).
    if (filtro === 'problemas') return todas.filter((c) => c.etapa === 'falhou' || (c.etapa === 'aguardando_conferencia' && c.sem_itens));
    return todas;
  }, [todas, filtro]);

  const colunas: Coluna<CompraLista>[] = [
    { id: 'fornecedor', titulo: 'Fornecedor', ordenar: (c) => c.fornecedor ?? '', celula: (c) => <><span class="principal-celula">{c.fornecedor ?? (LENDO.includes(c.etapa) ? 'Lendo a nota…' : 'Não identificado')}</span><span class="sub">{c.numero ? `Nota ${c.numero}` : c.fonte_leitura === 'comprovante' ? 'Só o comprovante do pagamento' : 'Sem número'}</span></> },
    { id: 'data', titulo: 'Data', ordenar: (c) => c.emitida_em ?? c.criado_em, prioridade: 'media', celula: (c) => <span class="num">{dataCurta((c.emitida_em ?? c.criado_em).slice(0, 10))}</span> },
    { id: 'valor', titulo: 'Valor', numero: true, ordenar: (c) => Number(c.valor_total ?? 0), celula: (c) => <span class="num">{moeda(c.valor_total)}</span> },
    { id: 'origem', titulo: 'Origem', prioridade: 'baixa', celula: (c) => <OrigemCompra c={c} /> },
    { id: 'itens', titulo: 'Itens', prioridade: 'baixa', celula: (c) => (c.sem_itens ? <span class="fraco">Sem produtos</span> : LENDO.includes(c.etapa) ? <span class="fraco">Lendo…</span> : <span>{plural(c.itens, 'item', 'itens')}{c.pendentes ? <span class="sub" style={{ color: 'var(--atencao)' }}>{plural(c.pendentes, 'pendente', 'pendentes')}</span> : null}</span>) },
    { id: 'situacao', titulo: 'Situação', prioridade: 'media', celula: (c) => <SituacaoCompra c={c} /> },
    { id: 'acoes', titulo: '', celula: (c) => (c.etapa === 'aguardando_conferencia' && perm.conferir ? <Botao tamanho="p" variante={c.etapa_painel === 'pronta' ? 'primario' : 'secundario'} onClick={() => aoAbrir(c.id)}>Conferir</Botao> : null) },
  ];

  return (
    <>
      <div class="barra-ferramentas">
        <Segmentado
          rotulo="Quais compras"
          valor={filtro}
          aoMudar={setFiltro}
          opcoes={[
            { valor: 'conferir', rotulo: <>Para conferir{conferir.length ? <span class="contador">{conferir.length}</span> : null}</> },
            { valor: 'problemas', rotulo: `Com problema${problemas ? ` (${problemas})` : ''}` },
            { valor: 'confirmadas', rotulo: 'Conferidas' },
            { valor: 'todas', rotulo: 'Todas' },
          ]}
        />
        {perm.conferir && (
          <div class="barra-ferramentas__acoes">
            <Botao icone={<PencilLine aria-hidden="true" />} onClick={() => setManual(true)}>Compra sem nota</Botao>
            <Botao variante="primario" icone={<Upload aria-hidden="true" />} onClick={() => setEnviar(true)}>Enviar nota</Botao>
          </div>
        )}
      </div>
      {resumo.dados && (
        <p class="estoque-status">
          {resumo.dados.compras_em_conferencia.mais_antiga_em && <span>A compra mais antiga para conferir chegou {relativo(resumo.dados.compras_em_conferencia.mais_antiga_em)}.</span>}
          {resumo.dados.cancelamentos_pendentes > 0 && (
            <button type="button" class="link" onClick={aoIrCancelamentos}>{plural(resumo.dados.cancelamentos_pendentes, 'venda cancelada a responder', 'vendas canceladas a responder')}</button>
          )}
          <span class="estoque-status__baixa" title="Os saldos somam compras e contagens, mas não descontam as vendas. Ela só é ligada depois do inventário inicial, das fichas cobrindo a receita e da autorização da gestão.">
            <Info aria-hidden="true" /> Baixa automática pelas vendas: <strong>{resumo.dados.baixa_automatica ? 'ligada' : 'desligada'}</strong>
          </span>
        </p>
      )}
      {!perm.conferir ? (
        <Vazio titulo="Compras são de quem confere">Seu perfil não confere compras recebidas.</Vazio>
      ) : (
      <Cartao justo>
        <Dados consulta={lista} recurso="As compras" esqueleto={<EsqueletoTabela />}>
          {(d) => (
            <>
            <Tabela
              rotulo="Compras"
              colunas={colunas}
              linhas={filtradas}
              chave={(c) => c.id}
              aoAbrir={(c) => aoAbrir(c.id)}
              destaque={(c) => c.etapa === 'aguardando_conferencia'}
              apagada={(c) => c.etapa === 'cancelada'}
              vazio={
                filtro === 'conferir' ? (
                  <Vazio icone={<PackageCheck aria-hidden="true" />} titulo="Nenhuma compra para conferir">Quando a Júlia receber uma nota ou alguém enviar pelo painel, ela aparece aqui.</Vazio>
                ) : (
                  <Vazio compacto titulo="Nenhuma compra nesta lista" />
                )
              }
            />
            {d.total > d.itens.length && <div class="cartao__rodape">Mostrando as {d.itens.length} mais recentes de {plural(d.total, 'compra', 'compras')}.</div>}
            </>
          )}
        </Dados>
      </Cartao>
      )}
      <Conferencia id={aberta} perm={perm} aoFechar={() => aoAbrir(null)} aoAbrir={aoAbrir} />
      <EnviarNota unidade={unidade} aberta={enviar && perm.conferir} aoFechar={() => setEnviar(false)} aoEnviar={(id) => { setEnviar(false); aoAbrir(id); }} />
      <CompraManual aberta={manual} aoFechar={() => setManual(false)} aoCriar={(id) => { setManual(false); aoAbrir(id); }} />
    </>
  );
}
