// Estoque: sete abas, as mesmas do painel antigo (Resumo, Compras, Insumos, Fichas técnicas, Contagem, Cancelamentos,
// Análises). A aba vive na URL (?aba=); ?aba=compras&compra=<id> abre direto a conferência daquela compra (links da
// Visão Geral e do Radar). Quem decide o que cada perfil pode é o backend: o painel só esconde o que daria 403.
import '../../estilos/estoque.css';
import { useEffect, useState } from 'preact/hooks';
import { Upload } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Raiz } from '../../ui/camadas';
import { Abas, Botao, Cabecalho } from '../../ui/base';
import { Esqueleto } from '../../ui/estados';
import { permissoesEstoque } from './comum';
import { Resumo } from './Resumo';
import { Insumos } from './Insumos';
import { Compras } from './Compras';
import { Fichas } from './Fichas';
import { Contagem } from './Contagem';
import { Cancelamentos } from './Cancelamentos';
import { Analises } from './Analises';

export type AbaEstoque = 'resumo' | 'compras' | 'insumos' | 'fichas' | 'contagem' | 'cancelamentos' | 'analises';
const ABAS: AbaEstoque[] = ['resumo', 'compras', 'insumos', 'fichas', 'contagem', 'cancelamentos', 'analises'];
// Nomes antigos (hash do painel antigo, links já compartilhados) caem na aba certa.
const APELIDOS: Record<string, AbaEstoque> = { inventario: 'contagem', inventarios: 'contagem' };

export default function Estoque({ contexto }: { contexto: ContextoPainel }) {
  const perm = permissoesEstoque(contexto.usuario);
  const unidade = contexto.unidade?.codigo ?? null;
  // A aba e a compra vêm da URL, que o servidor não vê: lidas só depois de montar (a primeira pintura bate com o HTML do
  // servidor e não há erro de hidratação). Até lá, um esqueleto.
  const [aba, setAba] = useState<AbaEstoque | null>(null);
  const [compra, setCompra] = useState<string | null>(null);
  const [enviar, setEnviar] = useState(false);

  useEffect(() => {
    const lida = lerParam('aba');
    const inicial = lida ? APELIDOS[lida] ?? (lida as AbaEstoque) : null;
    setAba(inicial && ABAS.includes(inicial) ? inicial : 'resumo');
    setCompra(lerParam('compra'));
  }, []);
  useEffect(() => {
    if (aba) gravarParams({ aba: aba === 'resumo' ? null : aba, compra: aba === 'compras' ? compra : null });
  }, [aba, compra]);

  const conferir = useConsulta(perm.conferir ? 'estoque/compras?conferir' : null, () => estoque.compras({ etapa: 'aguardando_conferencia', limite: 20 }));
  const pendentes = useConsulta('estoque/cancelamentos?pendente', () => estoque.cancelamentos('pendente'));
  const abrirCompra = (id: string) => {
    setAba('compras');
    setCompra(id);
  };

  return (
    <Raiz>
      <Cabecalho
        titulo="Estoque"
        descricao="Compras recebidas, insumos, fichas técnicas, contagem e custos"
        acoes={perm.conferir ? <Botao variante="primario" icone={<Upload aria-hidden="true" />} onClick={() => { setAba('compras'); setEnviar(true); }}>Enviar nota</Botao> : undefined}
      />
      <Abas
        atual={aba ?? 'resumo'}
        aoMudar={(a) => { setAba(a); if (a !== 'compras') setCompra(null); }}
        abas={[
          { id: 'resumo', rotulo: 'Resumo' },
          { id: 'compras', rotulo: 'Compras', contagem: conferir.dados?.total ?? null },
          { id: 'insumos', rotulo: 'Insumos' },
          { id: 'fichas', rotulo: 'Fichas técnicas' },
          { id: 'contagem', rotulo: 'Contagem' },
          { id: 'cancelamentos', rotulo: 'Cancelamentos', contagem: pendentes.dados?.total || null },
          { id: 'analises', rotulo: 'Análises' },
        ]}
      />
      <div role="tabpanel" id={`painel-${aba ?? 'resumo'}`} aria-labelledby={`aba-${aba ?? 'resumo'}`} class="pilha" style={{ gap: '20px' }}>
        {!aba && <Esqueleto linhas={6} altura={28} />}
        {aba === 'resumo' && <Resumo perm={perm} aoAbrirCompra={abrirCompra} aoIr={(a) => setAba(a)} />}
        {aba === 'compras' && <Compras perm={perm} unidade={unidade} aberta={compra} aoAbrir={setCompra} enviar={enviar} aoFecharEnvio={() => setEnviar(false)} />}
        {aba === 'insumos' && <Insumos perm={perm} aoIr={(a) => setAba(a)} />}
        {aba === 'fichas' && <Fichas pode={perm.editar} />}
        {aba === 'contagem' && <Contagem perm={perm} />}
        {aba === 'cancelamentos' && <Cancelamentos perm={perm} />}
        {aba === 'analises' && <Analises perm={perm} />}
      </div>
    </Raiz>
  );
}
