// Custos e CMV (seção de Fichas técnicas): o essencial em linguagem simples — quanto custaram os ingredientes do que foi
// vendido (quando dá para saber), quanto da receita as fichas cobrem, o que falta cadastrar e o preço de venda ao lado do
// custo dos ingredientes. Tudo vem do backend (fichas, resumo e CMV do mês); sem dados, diz o próximo passo em vez de
// mostrar R$ 0,00. Os relatórios completos (CMV teórico × físico, fornecedores, Cardápio Inteligente, previsões) seguem
// em "Relatórios avançados".
import { useState } from 'preact/hooks';
import { FileText, ChevronRight } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { moeda, pct, decimal, hojeISO, inicioMes, mesAno, num } from '../../lib/formato';
import { Botao, Cartao, Situacao } from '../../ui/base';
import { Dados, Esqueleto, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { FichaLista } from '../../lib/tipos/estoque';
import type { PermissoesEstoque } from './comum';
import { GavetaFicha, SITUACAO_FICHA, alvoDoProduto, porVendas, situacaoFicha, useFichas, type AlvoFicha } from './Fichas';
import { Relatorios, teoricoConfiavel } from './Relatorios';

export function CustosCmv({ perm, pode, cobertura, baixa, responsavel, aoVerSemFicha }: {
  perm: PermissoesEstoque;
  pode: boolean;
  cobertura: string | null;
  baixa: boolean;
  responsavel: (r: string | null | undefined, nome?: string | null) => string | null;
  aoVerSemFicha: () => void;
}) {
  const fichas = useFichas(pode);
  const [aberta, setAberta] = useState<AlvoFicha | null>(null);
  // Os relatórios só montam (e só consultam a API) quando alguém abre a seção.
  const [relatorios, setRelatorios] = useState(false);
  const avancados = (
    <details class="mais-opcoes mais-opcoes--relatorios" onToggle={(e) => setRelatorios((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>Relatórios avançados</summary>
      {relatorios && <div class="pilha" style={{ gap: '16px' }}><Relatorios perm={perm} baixa={baixa} /></div>}
    </details>
  );
  // Sem as fichas (perfil sem estoque.editar), só os relatórios que o perfil pode ver.
  if (!pode) return <Relatorios perm={perm} baixa={baixa} />;

  return (
    <>
      <Dados consulta={fichas} recurso="Os custos" esqueleto={<Esqueleto linhas={6} />}>
        {(lista) => {
          const todos = [...lista].sort(porVendas);
          const comFicha = todos.filter((f) => f.ficha);
          const semFicha = todos.filter((f) => !f.ficha);
          const semCusto = todos.filter((f) => situacaoFicha(f) === 'incompleta');
          if (!comFicha.length)
            return (
              <Cartao>
                <Vazio
                  icone={<FileText aria-hidden="true" />}
                  titulo="Cadastre as fichas técnicas dos produtos para começar a calcular os custos."
                  acao={semFicha.length ? <Botao variante="primario" onClick={aoVerSemFicha}>Ver produtos sem ficha</Botao> : undefined}
                >
                  O custo de um produto vem da ficha (quanto leva de cada ingrediente) e do preço de compra de cada ingrediente. Só o preço de venda da Eyemobile não basta.
                </Vazio>
              </Cartao>
            );
          return (
            <>
              <Cartao titulo="Como estão os custos">
                <dl class="custos-resumo">
                  <CmvDoMes />
                  <div>
                    <dt>Cobertura das fichas</dt>
                    <dd>{cobertura !== null ? <><strong class="num">{pct(cobertura, { fracao: true, casas: 0 })}</strong> <span class="fraco">da receita dos últimos 30 dias</span></> : <span class="fraco">—</span>}</dd>
                  </div>
                  <div>
                    <dt>Produtos sem ficha</dt>
                    <dd>{semFicha.length ? <button type="button" class="link" onClick={aoVerSemFicha}><strong class="num">{semFicha.length}</strong> · ver quais</button> : <span class="fraco">Nenhum</span>}</dd>
                  </div>
                  <div>
                    <dt>Sem custo conhecido</dt>
                    <dd>{semCusto.length ? <><strong class="num">{semCusto.length}</strong> <span class="fraco">{semCusto.length === 1 ? 'ficha tem' : 'fichas têm'} ingrediente sem preço</span></> : <span class="fraco">Nenhum</span>}</dd>
                  </div>
                </dl>
                <p class="fraco custos-explica">
                  O custo dos ingredientes vendidos (CMV teórico) usa as fichas técnicas, os preços de compra e as quantidades vendidas. O CMV físico depende também de contagens e movimentações confiáveis.
                </p>
              </Cartao>
              <PrecoCusto linhas={comFicha} aoAbrir={(f) => setAberta(alvoDoProduto(f))} />
              {semFicha.length > 0 && (
                <Cartao titulo="Mais vendidos sem ficha" descricao="Os próximos a cadastrar" justo>
                  <ul class="lista">
                    {semFicha.slice(0, 5).map((f) => (
                      <li key={f.eye_product_id}>
                        <button type="button" class="lista__item lista__item--botao" onClick={() => setAberta(alvoDoProduto(f))}>
                          <span class="lista__texto"><strong>{f.produto}</strong><span class="num">{decimal(f.quantidade_periodo, 0)} vendidos · {moeda(f.preco_pdv)}</span></span>
                          <span class="lista__fim"><ChevronRight aria-hidden="true" size={16} /></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Cartao>
              )}
            </>
          );
        }}
      </Dados>
      {avancados}
      <GavetaFicha alvo={aberta} aoFechar={() => setAberta(null)} responsavel={responsavel} />
    </>
  );
}

/** CMV teórico do mês, só quando é um número de verdade (vendas, cobertura e nenhuma ficha faltando); senão, por quê. */
function CmvDoMes() {
  const mes = inicioMes(hojeISO()).slice(0, 7);
  const c = useConsulta(`estoque/analises/cmv:${mes}`, () => estoque.cmv(mes));
  return (
    <div>
      <dt>Custo dos ingredientes vendidos <span class="fraco">({mesAno(`${mes}-01`)})</span></dt>
      <dd>
        {c.dados ? (
          teoricoConfiavel(c.dados) ? (
            <><strong class="num">{moeda(c.dados.alternativas.teorico)}</strong>{c.dados.cmv_pct !== null && <span class="fraco"> · {pct(c.dados.cmv_pct)} da receita</span>}</>
          ) : (
            <span class="fraco">{c.dados.vendas_validas === 0 ? 'Ainda sem vendas no mês.' : 'Ainda não dá para calcular: faltam fichas ou preços de ingredientes.'}</span>
          )
        ) : c.erro ? (
          <span class="fraco">Indisponível agora.</span>
        ) : (
          <span class="esqueleto" style={{ height: '18px', width: '120px', display: 'inline-block' }} />
        )}
      </dd>
    </div>
  );
}

function PrecoCusto({ linhas, aoAbrir }: { linhas: FichaLista[]; aoAbrir: (f: FichaLista) => void }) {
  const colunas: Coluna<FichaLista>[] = [
    { id: 'produto', titulo: 'Produto', ordenar: (f) => f.produto, celula: (f) => <><span class="principal-celula">{f.produto}</span><span class="sub">{decimal(f.quantidade_periodo, 0)} vendidos em 30 dias</span></> },
    { id: 'preco', titulo: 'Preço', numero: true, ordenar: (f) => num(f.preco_pdv) ?? -1, celula: (f) => <span class="num">{moeda(f.preco_pdv)}</span> },
    { id: 'custo', titulo: 'Ingredientes', numero: true, ordenar: (f) => num(f.ficha?.custo_porcao_hoje) ?? -1, celula: (f) => (situacaoFicha(f) === 'completa' ? <span class="num">{moeda(f.ficha!.custo_porcao_hoje)}</span> : <span class="fraco">sem preço</span>) },
    { id: 'margem', titulo: 'Margem parcial', numero: true, prioridade: 'media', ordenar: (f) => num(f.ficha?.margem_hoje_pct) ?? -999, celula: (f) => (situacaoFicha(f) === 'completa' && f.ficha!.margem_hoje_pct !== null ? <span class="num">{pct(f.ficha!.margem_hoje_pct)}</span> : <span class="fraco">—</span>) },
    { id: 'situacao', titulo: 'Ficha', prioridade: 'baixa', celula: (f) => { const s = situacaoFicha(f); return <Situacao tom={SITUACAO_FICHA[s].tom}>{SITUACAO_FICHA[s].rotulo}</Situacao>; } },
  ];
  return (
    <Cartao titulo="Preço de venda × custo dos ingredientes" descricao="Margem parcial = preço − ingredientes, a preço de hoje. Não é lucro: faltam mão de obra, embalagens, taxas e despesas fixas." justo>
      {linhas.length ? <Tabela rotulo="Preço de venda e custo dos ingredientes" colunas={colunas} linhas={linhas} chave={(f) => f.eye_product_id} aoAbrir={aoAbrir} porPagina={15} /> : <EsqueletoTabela linhas={2} />}
    </Cartao>
  );
}

