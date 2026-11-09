// Estoque em três abas: Insumos (o que temos, quanto e o que está acabando — a primeira tela, com "Contar estoque" e o
// detalhe de cada insumo), Compras (conferência do que foi lançado no Financeiro; o Estoque não cria compra nem despesa) e
// Fichas técnicas (catálogo dos produtos da Eyemobile, com a seção "Custos e CMV"). Sem botão genérico de movimento:
// entradas nascem na conferência de Compras; perda e correção de inventário saem de "Ajustar estoque", na gaveta do
// insumo. O cadastro rápido de insumo (aberto pelo seletor de insumos de Compras e Fichas) mora aqui, uma vez só, e devolve
// o insumo criado ao fluxo que pediu. Vendas canceladas depois da baixa (só existem com a baixa automática ligada) abrem
// numa gaveta a partir de Insumos.
// A área vive na URL (?aba=insumos|compras|fichas, &vista=contagem, &secao=custos); ?aba=compras&compra=<id> abre direto a
// conferência. Endereços antigos (estoque, recebimentos, contagem, custos, analises, mais, cancelamentos…) continuam
// funcionando — o sino, o Financeiro e o backend ainda apontam para eles. Quem decide o que cada perfil pode é o backend:
// o painel só esconde o que daria 403.
import '../../estilos/estoque.css';
import { useCallback, useEffect, useState } from 'preact/hooks';
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
import { DetalheInsumo, NovoInsumo, type PedidoCadastroRapido } from './DetalheInsumo';
import { AjusteEstoque } from './Movimento';
import { Compras } from './Compras';
import { CadastroRapido, type CadastrarInsumo } from './SeletorInsumo';
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
  const responsavel = useResponsavel(eu);
  // A área e a compra vêm da URL, que o servidor não vê: lidas só depois de montar (a primeira pintura bate com o HTML
  // do servidor e não há erro de hidratação). Até lá, um esqueleto.
  const [area, setArea] = useState<AreaEstoque | null>(null);
  const [secao, setSecao] = useState<SecaoFichas>('produtos');
  const [contando, setContando] = useState(false);
  const [compra, setCompra] = useState<string | null>(null);
  const [insumo, setInsumo] = useState<string | null>(null);
  const [novoInsumo, setNovoInsumo] = useState(false);
  const [ficha, setFicha] = useState<AlvoFicha | null>(null);
  const [cancelamentos, setCancelamentos] = useState(false);
  const [ajuste, setAjuste] = useState<Insumo | null>(null);
  const [rapido, setRapido] = useState<PedidoCadastroRapido | null>(null);
  // Cadastro rápido pedido pelo seletor de insumos: a promessa resolve com o insumo criado (ou null, se desistiu).
  const cadastrar = useCallback<CadastrarInsumo>((nome, unidade) => new Promise((resolver) => setRapido({ nome, unidade, aoConcluir: resolver })), []);

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
    setAjuste(null);
    setInsumo(null);
    setArea('insumos');
    setContando(true);
  };

  return (
    <CadastroRapido.Provider value={perm.editar ? cadastrar : null}>
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
        {area === 'compras' && <Compras perm={perm} aberta={compra} aoAbrir={setCompra} />}
        {area === 'fichas' && (
          <>
            {perm.editar && <Segmentado<SecaoFichas> rotulo="Fichas técnicas" valor={secao} aoMudar={setSecao} opcoes={[{ valor: 'produtos', rotulo: 'Produtos' }, { valor: 'custos', rotulo: 'Custos e CMV' }]} />}
            {secao === 'produtos' && perm.editar ? (
              <Fichas pode={perm.editar} responsavel={responsavel} />
            ) : (
              <CustosCmv
                perm={perm}
                pode={perm.editar}
                cobertura={resumo.dados?.cobertura_fichas_30d ?? null}
                baixa={!!resumo.dados?.baixa_automatica}
                responsavel={responsavel}
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
        aoAjustar={setAjuste}
        aoFicha={(i) => { setInsumo(null); setFicha({ alvo: 'preparo', id: i.id, nome: i.nome, unidade: i.unidade_base }); }}
      />
      <NovoInsumo aberto={novoInsumo} aoFechar={() => setNovoInsumo(false)} aoAbrir={(id) => { setNovoInsumo(false); setArea('insumos'); setContando(false); setInsumo(id); }} />
      <GavetaFicha alvo={ficha} aoFechar={() => setFicha(null)} responsavel={responsavel} />
      <AjusteEstoque
        insumo={ajuste}
        perm={perm}
        eu={eu}
        inicioControle={inicio}
        responsavel={responsavel}
        aoFechar={() => setAjuste(null)}
        aoIrContagem={contar}
        aoIrCompras={() => { setAjuste(null); setInsumo(null); irCompras(); }}
      />
      {perm.editar && <NovoInsumo aberto={!!rapido} rapido={rapido} aoFechar={() => setRapido(null)} aoAbrir={() => undefined} />}
      <Gaveta aberta={cancelamentos} aoFechar={() => setCancelamentos(false)} titulo="Vendas canceladas" subtitulo="Canceladas na Eyemobile depois da baixa: o que aconteceu com o produto?" largura="media">
        <Cancelamentos perm={perm} />
      </Gaveta>
    </Raiz>
    </CadastroRapido.Provider>
  );
}
