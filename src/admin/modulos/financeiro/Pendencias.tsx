// Pendências (0029): só DOIS motivos — despesa sem categoria e/ou sem pagador identificado. Uma lista compacta, uma
// linha por despesa (Descrição, Data, Valor, Categoria, Pagador), só o que falta destacado. Clicar abre um modal simples
// que corrige a MESMA despesa (POST /admin/financeiro/pendencias/{id}); com os dois campos certos, ela sai da lista.
//
// O que não é pendência operacional continua bloqueado no fluxo próprio, FORA desta lista (fase final): documentos da
// Júlia que não viraram lançamento, Banco, Stone e recebíveis e Acertos continuam no backend e abrem por endereço
// (?vista=revisao|banco|stone|acertos) e pelos atalhos administrativos de Configurações → Financeiro. O responsável
// aparece no modal para ajuste, mas nunca é motivo de pendência.
import { useEffect, useState } from 'preact/hooks';
import { ArrowLeft, CircleCheck, Check } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Dialogo } from '../../ui/camadas';
import { Botao, Cartao, Campo, Aviso } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { Pendencia, ResponsavelNovo } from '../../lib/tipos/financeiro';
import { Revisao } from './Revisao';
import { Conciliacao, type VistaConciliacao } from './Conciliacao';
import { Acertos } from './Acertos';
import { temPermissao, useCategorias, OpcoesCategoria, useContasPagadoras, rotuloConta, atualizarFinanceiro, avisar, PARTE, LADOS, RESPONSAVEL, RESPONSAVEIS_NOVOS } from './comum';

export type VistaPendencias = 'lista' | 'revisao' | 'acertos' | VistaConciliacao;
const VISTAS: VistaPendencias[] = ['lista', 'revisao', 'acertos', 'banco', 'stone', 'divergencias'];
const NOME_VISTA: Record<Exclude<VistaPendencias, 'lista'>, string> = {
  revisao: 'Documentos para conferir', acertos: 'Acertos Âmbar × Roll', banco: 'Banco', stone: 'Stone e recebíveis', divergencias: 'Divergências do extrato',
};

export function Pendencias({ contexto }: { contexto: ContextoPainel; revisar?: number | null }) {
  const conciliar = temPermissao(contexto.usuario, 'financeiro.conciliar');
  const societario = temPermissao(contexto.usuario, 'financeiro.ver_societario');
  const permitida = (v: VistaPendencias) => v === 'lista' || v === 'revisao' || (v === 'acertos' ? societario : conciliar);
  const [vista, setVista] = useState<VistaPendencias>(() => {
    const v = lerParam('vista') as VistaPendencias | null;
    return v && VISTAS.includes(v) && permitida(v) ? v : 'lista';
  });
  useEffect(() => gravarParams({ vista: vista === 'lista' ? null : vista }), [vista]);
  const ir = (v: VistaPendencias) => {
    gravarParams({ filtro: null, mes: null });
    setVista(v);
    window.scrollTo({ top: 0 });
  };

  if (vista !== 'lista') {
    return (
      <>
        <div class="barra-ferramentas">
          <Botao tamanho="p" variante="fantasma" icone={<ArrowLeft aria-hidden="true" />} onClick={() => ir('lista')}>Pendências</Botao>
          <strong>{NOME_VISTA[vista]}</strong>
        </div>
        {vista === 'revisao' && <Revisao contexto={contexto} />}
        {vista === 'acertos' && <Acertos />}
        {(vista === 'banco' || vista === 'stone' || vista === 'divergencias') && <Conciliacao contexto={contexto} vista={vista} aoMudarVista={ir} />}
      </>
    );
  }
  return <ListaPendencias />;
}

function ListaPendencias() {
  const lista = useConsulta('financeiro/pendencias', () => financeiro.pendencias());
  const [aberta, setAberta] = useState<Pendencia | null>(null);

  const colunas: Coluna<Pendencia>[] = [
    {
      id: 'descricao', titulo: 'Descrição', ordenar: (p) => p.descricao,
      celula: (p) => (
        <>
          <span class="principal-celula">{p.descricao}</span>
          <span class="sub fin-so-celular">{dataCurta(p.data)} · {moeda(p.valor)}</span>
        </>
      ),
    },
    { id: 'data', titulo: 'Data', prioridade: 'media', largura: '86px', ordenar: (p) => p.data, celula: (p) => <span class="num">{dataCurta(p.data)}</span> },
    { id: 'valor', titulo: 'Valor', numero: true, prioridade: 'media', ordenar: (p) => Number(p.valor), celula: (p) => <span class="num forte">{moeda(p.valor)}</span> },
    { id: 'categoria', titulo: 'Categoria', celula: (p) => (p.categoria ? <span>{p.categoria.nome}</span> : <span class="fin-falta">Sem categoria</span>) },
    {
      id: 'pagador', titulo: 'Pagador',
      celula: (p) => (p.falta.includes('pagador')
        ? <span class="fin-falta">Não identificado</span>
        : <span>{p.pagador?.apelido ?? '—'}{p.pagador && <span class="sub">{PARTE[p.pagador.parte]}</span>}</span>),
    },
  ];

  return (
    <>
      <Dados consulta={lista} recurso="As pendências" esqueleto={<Cartao justo><EsqueletoTabela linhas={4} /></Cartao>}>
        {(r) => (
          <>
            <Cartao justo>
              <Tabela
                rotulo="Pendências: sem categoria ou sem pagador"
                colunas={colunas}
                linhas={r.itens}
                chave={(p) => p.despesa_id}
                aoAbrir={setAberta}
                ordemInicial={{ coluna: 'data', desc: true }}
                vazio={<Vazio compacto icone={<CircleCheck aria-hidden="true" />} titulo="Nenhuma pendência">Toda despesa tem categoria e pagador.</Vazio>}
              />
            </Cartao>
          </>
        )}
      </Dados>
      <CorrigirPendencia item={aberta} aoFechar={() => setAberta(null)} />
    </>
  );
}

function CorrigirPendencia({ item, aoFechar }: { item: Pendencia | null; aoFechar: () => void }) {
  const cats = useCategorias();
  const contas = useContasPagadoras();
  const [categoria, setCategoria] = useState('');
  const [conta, setConta] = useState('');
  const [responsavel, setResponsavel] = useState<ResponsavelNovo | ''>('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setCategoria(item.categoria?.codigo ?? '');
    // Sugestão (nome parecido) vem pré-selecionada, mas só vale quando a pessoa salva.
    setConta(item.pagador?.id ?? item.sugestao_pagador?.id ?? '');
    setResponsavel(item.responsavel && item.responsavel !== 'compartilhada' ? item.responsavel : '');
    setErro(null);
  }, [item?.despesa_id, item?.versao]);

  if (!item) return null;
  const faltaCategoria = item.falta.includes('categoria');
  const faltaPagador = item.falta.includes('pagador');
  const semContas = contas.dados && contas.dados.itens.length === 0;

  async function salvar() {
    if (!item) return;
    const corpo: { versao: number; categoria?: string; conta_id?: string; responsavel?: ResponsavelNovo } = { versao: item.versao };
    if (faltaCategoria && categoria) corpo.categoria = categoria;
    if (faltaPagador && conta) corpo.conta_id = conta;
    if (responsavel && responsavel !== item.responsavel) corpo.responsavel = responsavel;
    if (!corpo.categoria && !corpo.conta_id && !corpo.responsavel) return setErro('Escolha a categoria ou o pagador.');
    setSalvando(true);
    setErro(null);
    try {
      const r = await financeiro.resolverPendencia(item.despesa_id, corpo);
      atualizarFinanceiro();
      avisar(r.resolvida ? 'Pendência resolvida.' : 'Salvo. Ainda falta um campo.', 'ok');
      aoFechar();
    } catch (e) {
      const x = e instanceof ErroApi ? e : null;
      if (x?.tipo === 'conflito') atualizarFinanceiro();
      setErro(x?.codigo === 'conflito_versao' ? 'Outra pessoa mudou esta despesa. Feche e abra de novo.' : x?.message ?? 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo={item.descricao}
      acoes={
        <>
          <Botao onClick={aoFechar} disabled={salvando}>Cancelar</Botao>
          <Botao variante="primario" carregando={salvando} icone={<Check aria-hidden="true" />} onClick={salvar}>Salvar</Botao>
        </>
      }
    >
      <p class="fraco" style={{ margin: '0 0 12px' }}>{dataCurta(item.data, { ano: true })} · <strong class="num">{moeda(item.valor)}</strong>{item.fornecedor ? ` · ${item.fornecedor}` : ''}</p>
      <div class="pilha">
        <Campo rotulo="Categoria">
          {(id) => (faltaCategoria
            ? (
              <select id={id} class="selecao" value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
                <option value="">Escolha a categoria</option>
                <OpcoesCategoria cats={cats.dados ?? []} />
              </select>
            )
            : <p id={id} class="campo__valor">{item.categoria?.nome}</p>)}
        </Campo>
        <Campo rotulo="Pagador" ajuda={faltaPagador && item.sugestao_pagador ? 'Sugestão pelo nome no comprovante: confira antes de salvar.' : undefined}>
          {(id, d) => (faltaPagador
            ? (
              <select id={id} class="selecao" aria-describedby={d} value={conta} onChange={(e) => setConta(e.currentTarget.value)} disabled={!!semContas}>
                <option value="">Não identificado</option>
                {LADOS.map((l) => {
                  const doLado = (contas.dados?.itens ?? []).filter((c) => c.parte === l);
                  return doLado.length ? <optgroup key={l} label={PARTE[l]}>{doLado.map((c) => <option key={c.id} value={c.id}>{rotuloConta(c)}{c.conta ? ` ${c.conta}` : ''}</option>)}</optgroup> : null;
                })}
              </select>
            )
            : <p id={id} class="campo__valor">{rotuloConta(item.pagador)}</p>)}
        </Campo>
        <Campo rotulo="Responsável" ajuda="A quem pertence a despesa. Não é pendência: só ajuste se precisar.">
          {(id, d) => (
            <select id={id} class="selecao" aria-describedby={d} value={responsavel} onChange={(e) => setResponsavel(e.currentTarget.value as ResponsavelNovo)}>
              {!responsavel && <option value="">{item.responsavel ? RESPONSAVEL[item.responsavel] : '—'}</option>}
              {RESPONSAVEIS_NOVOS.map((k) => <option key={k} value={k}>{RESPONSAVEL[k]}</option>)}
            </select>
          )}
        </Campo>
        {semContas && <Aviso tom="info">Nenhuma conta pagadora cadastrada. O Proprietário cadastra em Configurações → Financeiro → Contas e pagadores.</Aviso>}
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
      </div>
    </Dialogo>
  );
}
