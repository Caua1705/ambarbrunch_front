// Estoque: exatamente cinco abas (Resumo, Insumos, Compras, Fichas Técnicas, Análises). A aba vive na URL (?aba=);
// ?aba=compras&compra=<id> abre direto a conferência daquela compra (links da Visão Geral e do Radar).
import '../../estilos/estoque.css';
import { useEffect, useState } from 'preact/hooks';
import { Upload } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { pode } from '../../lib/permissoes';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Raiz } from '../../ui/camadas';
import { Abas, Botao, Cabecalho } from '../../ui/base';
import { Esqueleto } from '../../ui/estados';
import { Resumo } from './Resumo';
import { Insumos } from './Insumos';
import { Compras } from './Compras';
import { Fichas } from './Fichas';
import { Analises } from './Analises';

type Aba = 'resumo' | 'insumos' | 'compras' | 'fichas' | 'analises';
const ABAS: Aba[] = ['resumo', 'insumos', 'compras', 'fichas', 'analises'];

export default function Estoque({ contexto }: { contexto: ContextoPainel }) {
  const papel = contexto.usuario.papel;
  // A aba e a compra vêm da URL, que o servidor não vê: lidas só depois de montar (a primeira pintura bate com o HTML do
  // servidor e não há erro de hidratação). Até lá, um esqueleto.
  const [aba, setAba] = useState<Aba | null>(null);
  const [compra, setCompra] = useState<string | null>(null);
  const [enviar, setEnviar] = useState(false);

  useEffect(() => {
    const inicial = lerParam('aba') as Aba | null;
    setAba(inicial && ABAS.includes(inicial) ? inicial : 'resumo');
    setCompra(lerParam('compra'));
  }, []);
  useEffect(() => {
    if (aba) gravarParams({ aba: aba === 'resumo' ? null : aba, compra: aba === 'compras' ? compra : null });
  }, [aba, compra]);

  const conferir = useConsulta('estoque/compras?conferir', () => estoque.compras({ etapa: 'aguardando_conferencia', limite: 20 }));
  const abrirCompra = (id: string) => {
    setAba('compras');
    setCompra(id);
  };

  return (
    <Raiz>
      <Cabecalho
        titulo="Estoque"
        descricao="Insumos, compras recebidas, fichas técnicas e custos"
        acoes={<Botao variante="primario" icone={<Upload aria-hidden="true" />} onClick={() => { setAba('compras'); setEnviar(true); }}>Enviar nota</Botao>}
      />
      <Abas
        atual={aba ?? 'resumo'}
        aoMudar={(a) => { setAba(a); if (a !== 'compras') setCompra(null); }}
        abas={[
          { id: 'resumo', rotulo: 'Resumo' },
          { id: 'insumos', rotulo: 'Insumos' },
          { id: 'compras', rotulo: 'Compras', contagem: conferir.dados?.total ?? null },
          { id: 'fichas', rotulo: 'Fichas Técnicas' },
          { id: 'analises', rotulo: 'Análises' },
        ]}
      />
      <div role="tabpanel" id={`painel-${aba ?? 'resumo'}`} aria-labelledby={`aba-${aba ?? 'resumo'}`} class="pilha" style={{ gap: '20px' }}>
        {!aba && <Esqueleto linhas={6} altura={28} />}
        {aba === 'resumo' && <Resumo papel={papel} aoAbrirCompra={abrirCompra} aoIr={(a) => setAba(a)} />}
        {aba === 'insumos' && <Insumos papel={papel} />}
        {aba === 'compras' && <Compras papel={papel} aberta={compra} aoAbrir={setCompra} enviar={enviar} aoFecharEnvio={() => setEnviar(false)} />}
        {aba === 'fichas' && <Fichas pode={pode(papel, 'estoque.fichas')} />}
        {aba === 'analises' && <Analises custos={pode(papel, 'estoque.analises_custo')} />}
      </div>
    </Raiz>
  );
}
