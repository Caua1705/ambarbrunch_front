// Recebimentos: tudo o que chega ao café passa pela MESMA conferência — comprovante enviado à Júlia (faltam os produtos),
// nota enviada pelo painel (lida no backend) e entrada sem nota (digitada). Duas listas só: Pendentes (para conferir,
// sendo lidos, com problema) e Histórico (conferidos e cancelados). O estoque só muda em "Confirmar recebimento", com os
// itens efetivamente recebidos; pagamento e nota sozinhos não mexem no saldo. Lista e conferência: estoque.conferir.
import { useMemo, useState } from 'preact/hooks';
import { PackageCheck, Plus } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { moeda, dataCurta, plural, relativo } from '../../lib/formato';
import { Botao, Cartao, Segmentado, Etiqueta } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { CompraLista } from '../../lib/tipos/estoque';
import { SituacaoCompra, LENDO, type PermissoesEstoque } from './comum';
import { Conferencia } from './Conferencia';

type Lista = 'pendentes' | 'historico';
const pendente = (c: CompraLista) => c.etapa === 'aguardando_conferencia' || c.etapa === 'falhou' || LENDO.includes(c.etapa);

/** De onde veio, em uma linha: quem mandou e que documento. */
export function origemRecebimento(c: Pick<CompraLista, 'origem' | 'fonte_leitura' | 'despesa_origem_id'>): { quem: string; doc: string } {
  const quem = c.origem === 'julia' ? 'Júlia' : 'Painel';
  if (c.fonte_leitura === 'comprovante' || (c.despesa_origem_id && c.fonte_leitura === 'manual')) return { quem: c.origem === 'julia' || c.despesa_origem_id ? 'Júlia' : quem, doc: 'comprovante de pagamento' };
  if (c.fonte_leitura === 'manual') return { quem, doc: 'sem nota' };
  if (!c.fonte_leitura) return { quem, doc: 'documento em leitura' };
  return { quem, doc: 'nota fiscal' };
}

export function Recebimentos({ perm, aberta, aoAbrir, aoNovo }: { perm: PermissoesEstoque; aberta: string | null; aoAbrir: (id: string | null) => void; aoNovo: () => void }) {
  const [lista, setLista] = useState<Lista>('pendentes');
  const todas = useConsulta(perm.conferir ? 'estoque/compras?todas' : null, () => estoque.compras({ limite: 200 }));
  const itens = todas.dados?.itens ?? [];
  // Enquanto alguma nota está sendo lida, a lista se atualiza sozinha (só nesse caso).
  useConsulta(itens.some((c) => LENDO.includes(c.etapa)) ? 'estoque/compras?todas' : null, () => estoque.compras({ limite: 200 }), { intervalo: 3000 });
  const pendentes = itens.filter(pendente);
  const linhas = useMemo(() => (lista === 'pendentes' ? pendentes : itens.filter((c) => !pendente(c))), [itens, lista]);
  // O contador é o mesmo da aba e do sino: o que espera conferência (lendo e falhou ficam na lista, sem contar).
const paraConferir = pendentes.filter((c) => c.etapa === 'aguardando_conferencia');
  const maisAntiga = paraConferir.map((c) => c.criado_em).sort()[0];

  const colunas: Coluna<CompraLista>[] = [
    { id: 'fornecedor', titulo: 'Fornecedor', ordenar: (c) => c.fornecedor ?? '', celula: (c) => <><span class="principal-celula">{c.fornecedor ?? (LENDO.includes(c.etapa) ? 'Lendo a nota…' : 'Não identificado')}</span>{c.numero && <span class="sub">Nota {c.numero}</span>}</> },
    { id: 'data', titulo: 'Data', ordenar: (c) => c.emitida_em ?? c.criado_em, prioridade: 'media', celula: (c) => <span class="num" style={{ whiteSpace: 'nowrap' }}>{dataCurta((c.emitida_em ?? c.criado_em).slice(0, 10))}</span> },
    { id: 'valor', titulo: 'Valor', numero: true, ordenar: (c) => Number(c.valor_total ?? 0), celula: (c) => <span class="num">{moeda(c.valor_total)}</span> },
    {
      id: 'origem',
      titulo: 'Origem',
      prioridade: 'media',
      celula: (c) => {
        const o = origemRecebimento(c);
        return <span class="linha" style={{ gap: '6px', flexWrap: 'nowrap' }}><Etiqueta tom={o.quem === 'Júlia' ? 'marca' : 'neutro'}>{o.quem}</Etiqueta><span class="fraco">{o.doc}</span></span>;
      },
    },
    { id: 'itens', titulo: 'Itens', prioridade: 'baixa', celula: (c) => (c.etapa === 'falhou' ? <span class="fraco">—</span> : c.sem_itens ? <span class="fraco">Faltam os produtos</span> : LENDO.includes(c.etapa) ? <span class="fraco">Lendo…</span> : <span>{plural(c.itens, 'item', 'itens')}{c.pendentes ? <span class="sub" style={{ color: 'var(--atencao)' }}>{plural(c.pendentes, 'a identificar', 'a identificar')}</span> : null}</span>) },
    { id: 'situacao', titulo: 'Situação', celula: (c) => <SituacaoCompra c={c} /> },
    { id: 'acoes', titulo: '', celula: (c) => (c.etapa === 'aguardando_conferencia' && perm.conferir ? <Botao tamanho="p" variante={c.etapa_painel === 'pronta' ? 'primario' : 'secundario'} onClick={() => aoAbrir(c.id)}>Conferir</Botao> : null) },
  ];

  if (!perm.conferir) return <Vazio titulo="Recebimentos são de quem confere">Seu perfil não confere mercadorias recebidas.</Vazio>;

  return (
    <>
      <div class="barra-ferramentas">
        <Segmentado
          rotulo="Quais recebimentos"
          valor={lista}
          aoMudar={setLista}
          opcoes={[
            { valor: 'pendentes', rotulo: <>Pendentes{paraConferir.length ? <span class="contador">{paraConferir.length}</span> : null}</> },
            { valor: 'historico', rotulo: 'Histórico' },
          ]}
        />
        {maisAntiga && lista === 'pendentes' && <span class="fraco">O mais antigo chegou {relativo(maisAntiga)}.</span>}
        <div class="barra-ferramentas__acoes">
          <Botao icone={<Plus aria-hidden="true" />} onClick={aoNovo}>Novo recebimento</Botao>
        </div>
      </div>
      <Cartao justo>
        <Dados consulta={todas} recurso="Os recebimentos" esqueleto={<EsqueletoTabela />}>
          {(d) => (
            <>
              <Tabela
                rotulo={lista === 'pendentes' ? 'Recebimentos pendentes' : 'Histórico de recebimentos'}
                colunas={colunas}
                linhas={linhas}
                chave={(c) => c.id}
                aoAbrir={(c) => aoAbrir(c.id)}
                destaque={(c) => c.etapa === 'aguardando_conferencia'}
                apagada={(c) => c.etapa === 'cancelada'}
                movel={(c) => <LinhaMovel c={c} />}
                vazio={
                  lista === 'pendentes' ? (
                    <Vazio icone={<PackageCheck aria-hidden="true" />} titulo="Nada para conferir">Comprovantes enviados à Júlia e notas enviadas pelo painel aparecem aqui.</Vazio>
                  ) : (
                    <Vazio compacto titulo="Nenhum recebimento conferido ainda" />
                  )
                }
              />
              {d.total > d.itens.length && <div class="cartao__rodape">Mostrando os {d.itens.length} mais recentes de {plural(d.total, 'recebimento', 'recebimentos')}.</div>}
            </>
          )}
        </Dados>
      </Cartao>
      <Conferencia id={aberta} perm={perm} aoFechar={() => aoAbrir(null)} aoAbrir={aoAbrir} />
    </>
  );
}

function LinhaMovel({ c }: { c: CompraLista }) {
  const o = origemRecebimento(c);
  return (
    <div class="estoque-movel">
      <span class="estoque-movel__nome">{c.fornecedor ?? 'Não identificado'}<span class="sub">{o.quem} · {o.doc} · {dataCurta((c.emitida_em ?? c.criado_em).slice(0, 10))}</span></span>
      <span class="estoque-movel__qtd"><strong class="num">{moeda(c.valor_total)}</strong>{c.sem_itens && c.etapa === 'aguardando_conferencia' ? <span class="sub">faltam os produtos</span> : c.itens ? <span class="sub">{plural(c.itens, 'item', 'itens')}</span> : null}</span>
      <span class="estoque-movel__sit"><SituacaoCompra c={c} /></span>
    </div>
  );
}
