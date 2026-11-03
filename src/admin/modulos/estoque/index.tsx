// Estoque em quatro áreas: Estoque atual (o que temos, quanto e o que está acabando — a primeira tela), Recebimentos (o
// que chegou e precisa ser conferido), Contagem (inventário em três passos) e Fichas e custos (fichas técnicas e CMV).
// Uma ação principal em todas: "Registrar movimento" (entrada, saída ou ajuste, sempre com histórico). Vendas canceladas
// depois da baixa (só existem com a baixa automática ligada) abrem numa gaveta a partir do Estoque atual.
// A área vive na URL (?aba=); ?aba=recebimentos&compra=<id> abre direto a conferência. Nomes antigos (compras, insumos,
// fichas, inventario, mais) continuam funcionando. Quem decide o que cada perfil pode é o backend: o painel só esconde
// o que daria 403.
import '../../estilos/estoque.css';
import { useEffect, useState } from 'preact/hooks';
import { Plus } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Raiz, Gaveta } from '../../ui/camadas';
import { Abas, Botao, Segmentado } from '../../ui/base';
import { Esqueleto } from '../../ui/estados';
import type { Insumo } from '../../lib/tipos/estoque';
import { permissoesEstoque, useResponsavel } from './comum';
import { EstoqueAtual } from './EstoqueAtual';
import { DetalheInsumo, NovoInsumo, type TipoMovimentoManual } from './DetalheInsumo';
import { RegistrarMovimento, type ModoEntrada } from './Movimento';
import { Recebimentos } from './Recebimentos';
import { NovoRecebimento } from './EntradaCompra';
import { Contagem } from './Contagem';
import { Fichas, GavetaFicha, type AlvoFicha } from './Fichas';
import { Analises } from './Analises';
import { Cancelamentos } from './Cancelamentos';

export type AreaEstoque = 'estoque' | 'recebimentos' | 'contagem' | 'custos';
const AREAS: AreaEstoque[] = ['estoque', 'recebimentos', 'contagem', 'custos'];
type SecaoCustos = 'fichas' | 'cmv';
// Nomes antigos (links já compartilhados, rotaPainel, painel anterior) caem na área certa.
const APELIDOS: Record<string, { area: AreaEstoque; secao?: SecaoCustos; cancelamentos?: boolean }> = {
  insumos: { area: 'estoque' },
  resumo: { area: 'estoque' },
  compras: { area: 'recebimentos' },
  inventario: { area: 'contagem' },
  inventarios: { area: 'contagem' },
  fichas: { area: 'custos' },
  analises: { area: 'custos', secao: 'cmv' },
  mais: { area: 'custos', secao: 'cmv' },
  cancelamentos: { area: 'estoque', cancelamentos: true },
};

export default function Estoque({ contexto }: { contexto: ContextoPainel }) {
  const perm = permissoesEstoque(contexto.usuario);
  const eu = contexto.usuario;
  const unidade = contexto.unidade?.codigo ?? null;
  const responsavel = useResponsavel(eu);
  // A área e a compra vêm da URL, que o servidor não vê: lidas só depois de montar (a primeira pintura bate com o HTML
  // do servidor e não há erro de hidratação). Até lá, um esqueleto.
  const [area, setArea] = useState<AreaEstoque | null>(null);
  const [secao, setSecao] = useState<SecaoCustos>('fichas');
  const [compra, setCompra] = useState<string | null>(null);
  const [insumo, setInsumo] = useState<string | null>(null);
  const [novoInsumo, setNovoInsumo] = useState(false);
  const [ficha, setFicha] = useState<AlvoFicha | null>(null);
  const [cancelamentos, setCancelamentos] = useState(false);
  const [movimento, setMovimento] = useState<{ tipo: TipoMovimentoManual | null; insumo: Insumo | null } | null>(null);
  const [recebimento, setRecebimento] = useState<{ modo: ModoEntrada | null; insumo: Insumo | null } | null>(null);

  useEffect(() => {
    const lida = lerParam('aba') ?? '';
    const apelido = APELIDOS[lida];
    setArea(apelido?.area ?? ((AREAS as string[]).includes(lida) ? (lida as AreaEstoque) : 'estoque'));
    const s = apelido?.secao ?? lerParam('secao');
    if (s === 'fichas' || s === 'cmv') setSecao(s);
    setCompra(lerParam('compra'));
    setInsumo(lerParam('insumo'));
    if (apelido?.cancelamentos || lerParam('cancelamentos')) setCancelamentos(true);
  }, []);
  useEffect(() => {
    if (area)
      gravarParams({
        aba: area === 'estoque' ? null : area,
        compra: area === 'recebimentos' ? compra : null,
        insumo: area === 'estoque' ? insumo : null,
        secao: area === 'custos' && secao !== 'fichas' ? secao : null,
        cancelamentos: null,
      });
  }, [area, compra, insumo, secao]);

  const resumo = useConsulta('estoque/resumo', () => estoque.resumo());
  const pendentes = useConsulta(perm.conferir ? 'estoque/compras?conferir' : null, () => estoque.compras({ etapa: 'aguardando_conferencia', limite: 20 }));
  const inicio = resumo.dados?.inicio_controle ?? null;

  const irRecebimentos = (id: string | null = null) => {
    setCompra(id);
    setArea('recebimentos');
  };
  // Entrada pelo "Registrar movimento" ou pela gaveta do insumo: o mesmo recebimento de Recebimentos.
  const entrada = (modo: ModoEntrada, i: Insumo | null) => {
    setMovimento(null);
    setInsumo(null);
    setRecebimento({ modo, insumo: i });
  };

  return (
    <Raiz>
      <div class="estoque-topo">
        <Abas
          atual={area ?? 'estoque'}
          aoMudar={(a) => { setArea(a); if (a !== 'recebimentos') setCompra(null); }}
          abas={[
            { id: 'estoque', rotulo: 'Estoque atual' },
            { id: 'recebimentos', rotulo: 'Recebimentos', contagem: pendentes.dados?.total ?? null },
            { id: 'contagem', rotulo: 'Contagem' },
            { id: 'custos', rotulo: 'Fichas e custos' },
          ]}
        />
        <Botao variante="primario" icone={<Plus aria-hidden="true" />} class="estoque-topo__acao" onClick={() => setMovimento({ tipo: null, insumo: null })}>Registrar movimento</Botao>
      </div>
      <div role="tabpanel" id={`painel-${area ?? 'estoque'}`} aria-labelledby={`aba-${area ?? 'estoque'}`} class="pilha" style={{ gap: '16px' }}>
        {!area && <Esqueleto linhas={6} altura={28} />}
        {area === 'estoque' && (
          <EstoqueAtual perm={perm} aoAbrir={setInsumo} aoNovo={() => setNovoInsumo(true)} aoIrRecebimentos={() => irRecebimentos()} aoCancelamentos={() => setCancelamentos(true)} />
        )}
        {area === 'recebimentos' && <Recebimentos perm={perm} aberta={compra} aoAbrir={setCompra} aoNovo={() => setRecebimento({ modo: null, insumo: null })} />}
        {area === 'contagem' && <Contagem perm={perm} inicioControle={inicio} responsavel={responsavel} />}
        {area === 'custos' && (
          <>
            <Segmentado<SecaoCustos> rotulo="Fichas e custos" valor={secao} aoMudar={setSecao} opcoes={[{ valor: 'fichas', rotulo: 'Fichas técnicas' }, { valor: 'cmv', rotulo: 'CMV e custos' }]} />
            {secao === 'fichas' ? <Fichas pode={perm.editar} cobertura={resumo.dados?.cobertura_fichas_30d ?? null} responsavel={responsavel} /> : <Analises perm={perm} baixa={!!resumo.dados?.baixa_automatica} />}
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
      <NovoInsumo aberto={novoInsumo} aoFechar={() => setNovoInsumo(false)} aoCriar={(id) => { setNovoInsumo(false); setArea('estoque'); setInsumo(id); }} />
      <GavetaFicha alvo={ficha} aoFechar={() => setFicha(null)} responsavel={responsavel} />
      <RegistrarMovimento
        aberto={!!movimento}
        tipo={movimento?.tipo ?? null}
        insumo={movimento?.insumo ?? null}
        perm={perm}
        eu={eu}
        inicioControle={inicio}
        responsavel={responsavel}
        aoFechar={() => setMovimento(null)}
        aoEntrada={entrada}
        aoIrContagem={() => { setMovimento(null); setInsumo(null); setArea('contagem'); }}
        aoIrRecebimentos={() => { setMovimento(null); irRecebimentos(); }}
      />
      {perm.conferir && (
        <NovoRecebimento
          aberto={!!recebimento}
          modo={recebimento?.modo ?? null}
          insumo={recebimento?.insumo ? { id: recebimento.insumo.id, nome: recebimento.insumo.nome } : null}
          unidade={unidade}
          aoFechar={() => setRecebimento(null)}
          aoCriar={(id) => { setRecebimento(null); irRecebimentos(id); }}
        />
      )}
      <Gaveta aberta={cancelamentos} aoFechar={() => setCancelamentos(false)} titulo="Vendas canceladas" subtitulo="Canceladas na Eyemobile depois da baixa: o que aconteceu com o produto?" largura="media">
        <Cancelamentos perm={perm} />
      </Gaveta>
    </Raiz>
  );
}
