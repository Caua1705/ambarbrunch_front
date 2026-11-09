// Seletor único de insumos do Estoque (combobox pesquisável), usado na conferência de Compras e nas Fichas técnicas.
// A lista vem da base real (GET /admin/estoque/insumos, o mesmo cache da tabela de Insumos): busca por nome, escolha
// sempre pelo id do cadastro — nunca texto livre — e a unidade cadastrada ao lado. Se o insumo não existe, quem pode
// cadastrar abre o cadastro rápido (NovoInsumo em modo rápido, montado uma vez em index.tsx) e volta ao fluxo com o item
// novo já escolhido. Carregando, erro e busca vazia aparecem dentro da própria lista.
import { createContext } from 'preact';
import { useContext, useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { Search, Plus, RotateCw } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { custoBase } from '../../lib/formato';
import type { Dec } from '../../lib/tipos/comum';
import type { Insumo, UnidadeBase } from '../../lib/tipos/estoque';
import { UNIDADE_CURTA } from './comum';

/** O que o fluxo guarda do insumo escolhido: o id real, o nome e a unidade cadastrada. */
export interface InsumoEscolhido {
  id: string;
  nome: string;
  unidade_base: UnidadeBase;
  tipo?: 'comprado' | 'preparo';
  custo_medio?: Dec | null;
}

export const escolhidoDe = (i: Pick<Insumo, 'id' | 'nome' | 'unidade_base' | 'tipo' | 'custo_medio'>): InsumoEscolhido => ({
  id: i.id, nome: i.nome, unidade_base: i.unidade_base, tipo: i.tipo, custo_medio: i.custo_medio,
});

/** Cadastro rápido: abre a gaveta de cadastro com o nome digitado e resolve com o insumo criado (null = desistiu). */
export type CadastrarInsumo = (nome: string, unidade?: UnidadeBase | null) => Promise<InsumoEscolhido | null>;
export const CadastroRapido = createContext<CadastrarInsumo | null>(null);
export const useCadastroRapido = () => useContext(CadastroRapido);

/** Sem acento e sem caixa, para "acucar" achar "Açúcar". */
const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const ESPERA_MS = 200;
const MAXIMO = 40;

export function SeletorInsumo({ id, rotulo, valor, aoEscolher, tipo, excluir, placeholder = 'Buscar insumo', descr, mostrarCusto, invalido, unidadeSugerida, desativado }: {
  id?: string;
  /** Nome acessível do campo (ex.: "Insumo 1"). */
  rotulo: string;
  valor: InsumoEscolhido | null;
  aoEscolher: (i: InsumoEscolhido | null) => void;
  /** Só comprados (compras) ou todos (fichas). */
  tipo?: 'comprado';
  /** Id que não pode ser escolhido (o próprio preparo na ficha dele). */
  excluir?: string;
  placeholder?: string;
  descr?: string;
  /** Preço médio ao lado da unidade (fichas). */
  mostrarCusto?: boolean;
  invalido?: boolean;
  /** Unidade que o cadastro rápido já traz marcada (a da linha da compra). */
  unidadeSugerida?: UnidadeBase | null;
  desativado?: boolean;
}) {
  const gerado = useId();
  const cid = id ?? gerado;
  const cadastrar = useCadastroRapido();
  const [texto, setTexto] = useState(valor?.nome ?? '');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [busca, setBusca] = useState('');
  const entrada = useRef<HTMLInputElement>(null);
  const valorRef = useRef(valor);
  valorRef.current = valor;
  useEffect(() => setTexto(valor?.nome ?? ''), [valor?.id, valor?.nome]);
  useEffect(() => {
    const t = setTimeout(() => setBusca(texto.trim()), ESPERA_MS);
    return () => clearTimeout(t);
  }, [texto]);

  // Mesmo cache da tabela de Insumos: abrir o seletor não busca de novo o que já está na tela. Com mais insumos do que a
  // página traz, a busca vai ao backend.
  const catalogo = useConsulta('estoque/insumos?catalogo', () => estoque.insumos({ limite: 200 }));
  const incompleto = (catalogo.dados?.total ?? 0) > (catalogo.dados?.itens.length ?? 0);
  const remoto = useConsulta(aberto && incompleto && busca ? `estoque/insumos?seletor:${busca}` : null, () => estoque.insumos({ busca, limite: 50 }));
  const fonte = incompleto && busca ? remoto : catalogo;
  // "Tentar de novo": o cache mantém o erro anterior até a resposta chegar; enquanto isso, a lista diz que está carregando.
  const [tentando, setTentando] = useState(false);
  useEffect(() => setTentando(false), [fonte.dados, fonte.erro]);

  const opcoes = useMemo(() => {
    // Com o campo mostrando o insumo escolhido, abrir a lista mostra todos (não só o que tem o mesmo nome).
    const t = valor && texto === valor.nome ? '' : normal(busca);
    return (fonte.dados?.itens ?? [])
      .filter((i) => i.ativo && (!tipo || i.tipo === tipo) && i.id !== excluir && (!t || normal(i.nome).includes(t) || normal(i.codigo).includes(t)))
      .sort((a, b) => Number(!normal(a.nome).startsWith(t)) - Number(!normal(b.nome).startsWith(t)) || a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, MAXIMO);
  }, [fonte.dados, busca, tipo, excluir, valor?.id, texto]);

  const digitado = texto.trim();
  // Cadastrar só quando não há um insumo com o mesmo nome (sem duplicar o cadastro).
  const existeIgual = (fonte.dados?.itens ?? []).some((i) => normal(i.nome) === normal(digitado));
  const podeCriar = !!cadastrar && !!digitado && !existeIgual && !(valor && texto === valor.nome);
  const total = opcoes.length + (podeCriar ? 1 : 0);
  useEffect(() => setAtivo(0), [busca]);

  async function criar() {
    setAberto(false);
    const novo = await cadastrar!(digitado, unidadeSugerida);
    if (novo) {
      aoEscolher(novo);
      setTexto(novo.nome);
    }
    entrada.current?.focus();
  }
  function escolher(k: number) {
    if (k < opcoes.length) {
      const i = opcoes[k];
      aoEscolher(escolhidoDe(i));
      setTexto(i.nome);
      setAberto(false);
    } else if (podeCriar) void criar();
  }

  const carregando = tentando || fonte.carregando || (fonte.atualizando && !opcoes.length);
  const erro = fonte.erro && !fonte.dados && !tentando ? fonte.erro : null;
  const detalhe = (i: Insumo) => [UNIDADE_CURTA[i.unidade_base], i.tipo === 'preparo' ? 'preparo' : null, mostrarCusto ? (i.custo_medio !== null ? custoBase(i.custo_medio, i.unidade_base) : 'sem preço') : null].filter(Boolean).join(' · ');

  return (
    <div class="auto seletor-insumo" data-escolhido={valor ? '' : undefined}>
      <div class="entrada-grupo">
        <Search aria-hidden="true" />
        <input
          ref={entrada}
          id={cid}
          class="entrada"
          role="combobox"
          aria-label={rotulo}
          aria-expanded={aberto}
          aria-controls={`${cid}-lista`}
          aria-autocomplete="list"
          aria-activedescendant={aberto && total ? `${cid}-op-${ativo}` : undefined}
          aria-describedby={descr}
          aria-invalid={invalido || undefined}
          autocomplete="off"
          placeholder={placeholder}
          disabled={desativado}
          value={texto}
          onFocus={() => setAberto(true)}
          onBlur={() =>
            setTimeout(() => {
              setAberto(false);
              // Quem usa o seletor manteve o insumo escolhido (não aceitou trocar por texto): o campo volta a mostrá-lo.
              if (valorRef.current) setTexto(valorRef.current.nome);
            }, 150)
          }
          onInput={(e) => {
            setTexto(e.currentTarget.value);
            setAberto(true);
            // Mudou o texto: deixa de valer o insumo escolhido (nada de texto livre no lugar do id).
            if (valor) aoEscolher(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAberto(true);
              setAtivo((a) => Math.min(a + 1, Math.max(total - 1, 0)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setAtivo((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && aberto && total) {
              e.preventDefault();
              escolher(ativo);
            } else if (e.key === 'Escape' && aberto) {
              e.stopPropagation();
              setAberto(false);
            }
          }}
        />
        {valor && <span class="seletor-insumo__unidade" title="Unidade cadastrada">{UNIDADE_CURTA[valor.unidade_base]}</span>}
      </div>
      {aberto && (
        <ul class="auto__lista" id={`${cid}-lista`} role="listbox" aria-label={rotulo} aria-busy={carregando || undefined}>
          {erro ? (
            <li class="auto__estado" role="presentation">
              <span>Não foi possível carregar os insumos.</span>
              <button type="button" class="link" onMouseDown={(e) => { e.preventDefault(); setTentando(true); fonte.recarregar(); }}><RotateCw size={13} aria-hidden="true" /> Tentar de novo</button>
            </li>
          ) : carregando ? (
            <li class="auto__estado" role="presentation">Carregando insumos…</li>
          ) : !opcoes.length ? (
            <li class="auto__estado" role="presentation">{digitado ? `Nenhum insumo com “${digitado}”.` : 'Nenhum insumo cadastrado.'}</li>
          ) : null}
          {!erro && !carregando && opcoes.map((i, k) => (
            <li key={i.id} id={`${cid}-op-${k}`} role="option" class="auto__opcao" aria-selected={k === ativo} onMouseDown={(e) => { e.preventDefault(); escolher(k); }}>
              <span>{i.nome}</span>
              <small>{detalhe(i)}</small>
            </li>
          ))}
          {!erro && !carregando && podeCriar && (
            <li id={`${cid}-op-${opcoes.length}`} role="option" class="auto__opcao auto__opcao--criar" aria-selected={ativo === opcoes.length} onMouseDown={(e) => { e.preventDefault(); escolher(opcoes.length); }}>
              <span class="forte"><Plus size={14} aria-hidden="true" /> Cadastrar “{digitado}”</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Unidade da linha da compra → unidade-base que o cadastro rápido sugere (KG → g, L → ml, UN → un). */
export function baseDaUnidadeCompra(u: string | null | undefined): UnidadeBase | null {
  const t = (u ?? '').trim().toUpperCase();
  if (t === 'KG' || t === 'G') return 'g';
  if (t === 'L' || t === 'ML') return 'ml';
  if (t === 'UN' || t === 'UND' || t === 'DZ') return 'un';
  return null;
}
