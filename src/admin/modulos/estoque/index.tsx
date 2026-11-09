// Estoque em três abas: Insumos (o que temos, quanto e o que está acabando — a primeira tela, com "Contar estoque" e o
// detalhe de cada insumo), Compras (o que chegou e precisa ser conferido, com "Registrar compra" para o que não passou pela
// Júlia) e Fichas técnicas (catálogo dos produtos da Eyemobile, com a seção "Custos e CMV"). Sem botão genérico de
// movimento: entradas nascem em Compras; conferência, correção e perda saem da gaveta do insumo. Vendas canceladas depois
// da baixa (só existem com a baixa automática ligada) abrem numa gaveta a partir de Insumos.
// A área vive na URL (?aba=insumos|compras|fichas, &vista=contagem, &secao=custos); ?aba=compras&compra=<id> abre direto a
// conferência. Endereços antigos (estoque, recebimentos, contagem, custos, analises, mais, cancelamentos…) continuam
// funcionando — o sino, o Financeiro e o backend ainda apontam para eles. Quem decide o que cada perfil pode é o backend:
// o painel só esconde o que daria 403.
import '../../estilos/estoque.css';
import { useEffect, useState } from 'preact/hooks';
import { ArrowLeft } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Raiz, Gaveta } from '../../ui/camadas';
import { Abas, Botao, Segmentado } from '../../ui/base';
import { Esqueleto } from '../../ui/estados';
import type { Insumo } from '../../lib/tipos/estoque';
import { permissoesEstoque, useResponsavel } from './comum';
import { Insumos } from './Insumos';
import { DetalheInsumo, NovoInsumo } from './DetalheInsumo';
import { MovimentoInsumo, type TipoMovimentoManual } from './Movimento';
import { Compras } from './Compras';
import { NovaCompra } from './EntradaCompra';
import { Contagem } from './Contagem';
import { Fichas, GavetaFicha, type AlvoFicha } from './Fichas';
import { CustosCmv } from './Custos';
import { Cancelamentos } from './Cancelamentos';

export type AreaEstoque = 'insumos' | 'compras' | 'fichas';
const AREAS: AreaEstoque[] = ['insumos', 'compras', 'fichas'];
type SecaoFichas = 'produtos' | 'custos';
// Nomes antigos (links já compartilhados, rotaPainel, sino, Financeiro) caem na área certa.
const APELIDOS: Record<string, { area: AreaEstoque; secao?: SecaoFichas; contagem?: boolean; cancelamentos?: boolean }> = {
  estoque: { area: 'insumos' },
  resumo: { area: 'insumos' },
  recebimentos: { area: 'compras' },
  contagem: { area: 'insumos', contagem: true },
  inventario: { area: 'insumos', contagem: true },
  inventarios: { area: 'insumos', contagem: true },
  custos: { area: 'fichas' },
  analises: { area: 'fichas', secao: 'custos' },
  mais: { area: 'fichas', secao: 'custos' },
  cancelamentos: { area: 'insumos', cancelamentos: true },
};

export default function Estoque({ contexto }: { contexto: ContextoPainel }) {
  const perm = permissoesEstoque(contexto.usuario);
  const eu = contexto.usuario;
  const unidade = contexto.unidade?.codigo ?? null;
  const responsavel = useResponsavel(eu);
  // A área e a compra vêm da URL, que o servidor não vê: lidas só depois de montar (a primeira pintura bate com o HTML
  // do servidor e não há erro de hidratação). Até lá, um esqueleto.
  const [area, setArea] = useState<AreaEstoque | null>(null);
  const [secao, setSecao] = useState<SecaoFichas>('produtos');
  const [contando, setContando] = useState(false);
  const [filtroFichas, setFiltroFichas] = useState<'sem' | undefined>(undefined);
  const [compra, setCompra] = useState<string | null>(null);
  const [insumo, setInsumo] = useState<string | null>(null);
  const [novoInsumo, setNovoInsumo] = useState(false);
  const [ficha, setFicha] = useState<AlvoFicha | null>(null);
  const [cancelamentos, setCancelamentos] = useState(false);
  const [movimento, setMovimento] = useState<{ tipo: TipoMovimentoManual; insumo: Insumo } | null>(null);
  const [novaCompra, setNovaCompra] = useState(false);

  useEffect(() => {
    const lida = lerParam('aba') ?? '';
    const apelido = APELIDOS[lida];
    setArea(apelido?.area ?? ((AREAS as string[]).includes(lida) ? (lida as AreaEstoque) : 'insumos'));
    const s = apelido?.secao ?? lerParam('secao');
    if (s === 'custos' || s === 'cmv') setSecao('custos');
    if (apelido?.contagem || lerParam('vista') === 'contagem') setContando(true);
    setCompra(lerParam('compra'));
    setInsumo(lerParam('insumo'));
    if (apelido?.cancelamentos || lerParam('cancelamentos')) setCancelamentos(true);
  }, []);
  useEffect(() => {
    if (area)
      gravarParams({
        aba: area === 'insumos' ? null : area,
        vista: area === 'insumos' && contando ? 'contagem' : null,
        compra: area === 'compras' ? compra : null,
        insumo: area === 'insumos' ? insumo : null,
        secao: area === 'fichas' && secao !== 'produtos' ? secao : null,
        cancelamentos: null,
      });
  }, [area, compra, insumo, secao, contando]);

  const resumo = useConsulta('estoque/resumo', () => estoque.resumo());
  const pendentes = useConsulta(perm.conferir ? 'estoque/compras?conferir' : null, () => estoque.compras({ etapa: 'aguardando_conferencia', limite: 20 }));
  const inicio = resumo.dados?.inicio_controle ?? null;

  const irCompras = (id: string | null = null) => {
    setCompra(id);
    setArea('compras');
  };
  const contar = () => {
    setMovimento(null);
    setInsumo(null);
    setArea('insumos');
    setContando(true);
  };

  return (
    <Raiz>
      <Abas
        atual={area ?? 'insumos'}
        aoMudar={(a) => { setArea(a); if (a !== 'compras') setCompra(null); if (a !== 'insumos') setContando(false); }}
        abas={[
          { id: 'insumos', rotulo: 'Insumos' },
          { id: 'compras', rotulo: 'Compras', contagem: pendentes.dados?.total ?? null },
          { id: 'fichas', rotulo: 'Fichas técnicas' },
        ]}
      />
      <div role="tabpanel" id={`painel-${area ?? 'insumos'}`} aria-labelledby={`aba-${area ?? 'insumos'}`} class="pilha" style={{ gap: '16px' }}>
        {!area && <Esqueleto linhas={6} altura={28} />}
        {area === 'insumos' && !contando && <Insumos perm={perm} aoAbrir={setInsumo} aoNovo={() => setNovoInsumo(true)} aoContar={contar} aoCancelamentos={() => setCancelamentos(true)} />}
        {area === 'insumos' && contando && (
          <>
            <div class="estoque-voltar">
              <Botao variante="fantasma" icone={<ArrowLeft aria-hidden="true" />} onClick={() => setContando(false)}>Insumos</Botao>
              <h2 class="estoque-voltar__titulo">Contar estoque</h2>
            </div>
            <Contagem perm={perm} inicioControle={inicio} responsavel={responsavel} aoConcluir={() => setContando(false)} />
          </>
        )}
        {area === 'compras' && <Compras perm={perm} aberta={compra} aoAbrir={setCompra} aoNova={() => setNovaCompra(true)} />}
        {area === 'fichas' && (
          <>
            {perm.editar && <Segmentado<SecaoFichas> rotulo="Fichas técnicas" valor={secao} aoMudar={setSecao} opcoes={[{ valor: 'produtos', rotulo: 'Produtos' }, { valor: 'custos', rotulo: 'Custos e CMV' }]} />}
            {secao === 'produtos' && perm.editar ? (
              <Fichas pode={perm.editar} filtroInicial={filtroFichas} responsavel={responsavel} />
            ) : (
              <CustosCmv
                perm={perm}
                pode={perm.editar}
                cobertura={resumo.dados?.cobertura_fichas_30d ?? null}
                baixa={!!resumo.dados?.baixa_automatica}
                responsavel={responsavel}
                aoVerSemFicha={() => { setFiltroFichas('sem'); setSecao('produtos'); }}
              />
            )}
          </>
        )}
      </div>

      <DetalheInsumo
        id={insumo}
        perm={perm}
        inicioControle={inicio}
        responsavel={responsavel}
        aoFechar={() => setInsumo(null)}
        aoMovimento={(tipo, i) => setMovimento({ tipo, insumo: i })}
        aoFicha={(i) => { setInsumo(null); setFicha({ alvo: 'preparo', id: i.id, nome: i.nome, unidade: i.unidade_base }); }}
      />
      <NovoInsumo aberto={novoInsumo} aoFechar={() => setNovoInsumo(false)} aoCriar={(id) => { setNovoInsumo(false); setArea('insumos'); setContando(false); setInsumo(id); }} />
      <GavetaFicha alvo={ficha} aoFechar={() => setFicha(null)} responsavel={responsavel} />
      <MovimentoInsumo
        tipo={movimento?.tipo ?? null}
        insumo={movimento?.insumo ?? null}
        perm={perm}
        eu={eu}
        inicioControle={inicio}
        responsavel={responsavel}
        aoFechar={() => setMovimento(null)}
        aoIrContagem={contar}
      />
      {perm.conferir && (
        <NovaCompra
          aberto={novaCompra}
          modo={null}
          insumo={null}
          unidade={unidade}
          aoFechar={() => setNovaCompra(false)}
          aoCriar={(id) => { setNovaCompra(false); irCompras(id); }}
        />
      )}
      <Gaveta aberta={cancelamentos} aoFechar={() => setCancelamentos(false)} titulo="Vendas canceladas" subtitulo="Canceladas na Eyemobile depois da baixa: o que aconteceu com o produto?" largura="media">
        <Cancelamentos perm={perm} />
      </Gaveta>
    </Raiz>
  );
}
