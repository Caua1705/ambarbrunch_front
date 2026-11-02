// Estoque: operação primeiro. Abre em Compras — o que precisa ser conferido, o que deu problema e "Enviar nota" — e o
// resto em quatro áreas: Insumos (saldos, mínimo, movimentações), Fichas técnicas, Inventário (contagem) e Mais
// (cancelamentos depois da baixa e as análises de custo/CMV). Sem painel de indicadores: os números aparecem discretos,
// junto da tarefa. A aba vive na URL (?aba=); ?aba=compras&compra=<id> abre direto a conferência daquela compra.
// Quem decide o que cada perfil pode é o backend: o painel só esconde o que daria 403.
import '../../estilos/estoque.css';
import { useEffect, useState } from 'preact/hooks';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Raiz } from '../../ui/camadas';
import { Abas, Segmentado } from '../../ui/base';
import { Esqueleto } from '../../ui/estados';
import { permissoesEstoque, type PermissoesEstoque } from './comum';
import { Insumos } from './Insumos';
import { Compras } from './Compras';
import { Fichas } from './Fichas';
import { Contagem } from './Contagem';
import { Cancelamentos } from './Cancelamentos';
import { Analises } from './Analises';

export type AbaEstoque = 'compras' | 'insumos' | 'fichas' | 'contagem' | 'mais';
const ABAS: AbaEstoque[] = ['compras', 'insumos', 'fichas', 'contagem', 'mais'];
type SecaoMais = 'cancelamentos' | 'analises';
// Nomes antigos (painel antigo, links já compartilhados, rotaPainel) caem na área certa.
const APELIDOS: Record<string, { aba: AbaEstoque; secao?: SecaoMais }> = {
  resumo: { aba: 'compras' },
  inventario: { aba: 'contagem' },
  inventarios: { aba: 'contagem' },
  cancelamentos: { aba: 'mais', secao: 'cancelamentos' },
  analises: { aba: 'mais', secao: 'analises' },
};

export default function Estoque({ contexto }: { contexto: ContextoPainel }) {
  const perm = permissoesEstoque(contexto.usuario);
  const unidade = contexto.unidade?.codigo ?? null;
  // A aba e a compra vêm da URL, que o servidor não vê: lidas só depois de montar (a primeira pintura bate com o HTML do
  // servidor e não há erro de hidratação). Até lá, um esqueleto.
  const [aba, setAba] = useState<AbaEstoque | null>(null);
  const [secao, setSecao] = useState<SecaoMais>('cancelamentos');
  const [compra, setCompra] = useState<string | null>(null);

  useEffect(() => {
    const lida = lerParam('aba') ?? '';
    const apelido = APELIDOS[lida];
    const inicial = apelido?.aba ?? ((ABAS as string[]).includes(lida) ? (lida as AbaEstoque) : 'compras');
    setAba(inicial);
    const s = apelido?.secao ?? lerParam('secao');
    if (s === 'cancelamentos' || s === 'analises') setSecao(s);
    setCompra(lerParam('compra'));
  }, []);
  useEffect(() => {
    if (aba) gravarParams({ aba: aba === 'compras' ? null : aba, compra: aba === 'compras' ? compra : null, secao: aba === 'mais' && secao !== 'cancelamentos' ? secao : null });
  }, [aba, compra, secao]);

  const conferir = useConsulta(perm.conferir ? 'estoque/compras?conferir' : null, () => estoque.compras({ etapa: 'aguardando_conferencia', limite: 20 }));
  const pendentes = useConsulta('estoque/cancelamentos?pendente', () => estoque.cancelamentos('pendente'));

  return (
    <Raiz>
      <Abas
        atual={aba ?? 'compras'}
        aoMudar={(a) => { setAba(a); if (a !== 'compras') setCompra(null); }}
        abas={[
          { id: 'compras', rotulo: 'Compras', contagem: conferir.dados?.total ?? null },
          { id: 'insumos', rotulo: 'Insumos' },
          { id: 'fichas', rotulo: 'Fichas técnicas' },
          { id: 'contagem', rotulo: 'Inventário' },
          { id: 'mais', rotulo: 'Mais', contagem: pendentes.dados?.total || null },
        ]}
      />
      <div role="tabpanel" id={`painel-${aba ?? 'compras'}`} aria-labelledby={`aba-${aba ?? 'compras'}`} class="pilha" style={{ gap: '20px' }}>
        {!aba && <Esqueleto linhas={6} altura={28} />}
        {aba === 'compras' && <Compras perm={perm} unidade={unidade} aberta={compra} aoAbrir={setCompra} aoIrCancelamentos={() => { setSecao('cancelamentos'); setAba('mais'); }} />}
        {aba === 'insumos' && <Insumos perm={perm} aoIr={(a) => setAba(a)} />}
        {aba === 'fichas' && <Fichas pode={perm.editar} />}
        {aba === 'contagem' && <Contagem perm={perm} />}
        {aba === 'mais' && <Mais perm={perm} secao={secao} aoMudar={setSecao} pendentes={pendentes.dados?.total ?? null} />}
      </div>
    </Raiz>
  );
}

/** O que se usa de vez em quando: responder vendas canceladas depois da baixa e as análises de custo, consumo e CMV. */
function Mais({ perm, secao, aoMudar, pendentes }: { perm: PermissoesEstoque; secao: SecaoMais; aoMudar: (s: SecaoMais) => void; pendentes: number | null }) {
  return (
    <>
      <Segmentado<SecaoMais>
        rotulo="Mais do Estoque"
        valor={secao}
        aoMudar={aoMudar}
        opcoes={[
          { valor: 'cancelamentos', rotulo: <>Cancelamentos{pendentes ? <span class="contador">{pendentes}</span> : null}</> },
          { valor: 'analises', rotulo: 'Análises e CMV' },
        ]}
      />
      {secao === 'cancelamentos' ? <Cancelamentos perm={perm} /> : <Analises perm={perm} />}
    </>
  );
}
