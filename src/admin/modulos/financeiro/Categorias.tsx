// Categorias de despesa (CONTRATO-PAINEL-FINANCEIRO-ESTOQUE.md §5.7, 0019). O banco é a fonte da verdade: nada de lista
// fixa no painel. A Júlia e os seletores só oferecem as categorias ATIVAS na unidade; uma categoria nova (ou reativada)
// vale para a Júlia no próximo documento, sem mudar código, prompt ou workflow. Sem subcategorias.
//  - GET  /admin/financeiro/categorias?todas=true&incluir_inativas=true (a ponte manda ?unidade=)
//  - POST /admin/financeiro/categorias · PATCH …/{codigo} · PUT …/{codigo}/unidades/{unidade} {ativo}
//  - Excluir não existe (os lançamentos referenciam o código): desativa-se.
// Leitura com financeiro.visualizar; escrita com financeiro.lancar (Gerente e Proprietário).
import { useEffect, useState } from 'preact/hooks';
import { Plus, Pencil, Tags, Info, Power, PowerOff, RotateCcw } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { invalidar } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { plural } from '../../lib/formato';
import { Gaveta, useConfirmacao, type PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Cabecalho, Cartao, Campo, Aviso, Etiqueta } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import type { Categoria, CategoriaAlteracao, GrupoCategoria } from '../../lib/tipos/financeiro';
import { GRUPO, GRUPO_AJUDA, avisar, temPermissao, useCadastroCategorias } from './comum';

const GRUPOS = Object.keys(GRUPO_AJUDA) as Exclude<GrupoCategoria, 'pendente'>[];
const CODIGO = /^[a-z][a-z0-9_]{1,39}$/;
const atualizarCategorias = () => invalidar('financeiro/categorias');

/** Código estável a partir do nome: "Obras e equipamentos" → "obras_e_equipamentos". */
export function slug(nome: string) {
  const s = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 40)
    .replace(/_+$/, '');
  return s;
}

/** "xerox, papelaria; cópia" → ["xerox", "papelaria", "cópia"] (sem repetir, sem vazio). */
export function lerApelidos(texto: string) {
  return [...new Set(texto.split(/[,;\n]+/).map((a) => a.trim().toLowerCase()).filter(Boolean))];
}

export function Categorias({ contexto }: { contexto: ContextoPainel }) {
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  const consulta = useCadastroCategorias();
  const unidade = contexto.unidade;
  const [editar, setEditar] = useState<Categoria | 'nova' | null>(null);
  const { confirmar, elemento: dialogo } = useConfirmacao();
  const nomeUnidade = unidade?.nome ?? 'nesta unidade';

  return (
    <>
      <Cabecalho
        titulo="Categorias"
        descricao={`Categorias de despesa de ${nomeUnidade}. A Júlia e os formulários só oferecem as ativas nesta unidade.`}
        acoes={lancar && <Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setEditar('nova')}>Nova categoria</Botao>}
      />
      <Dados consulta={consulta} recurso="As categorias" esqueleto={<EsqueletoTabela linhas={7} />}>
        {(todas) => {
          const ordenadas = [...todas].sort((a, b) => (a.ordem ?? 100) - (b.ordem ?? 100) || a.nome.localeCompare(b.nome, 'pt-BR'));
          const pendencia = ordenadas.filter((c) => c.pendencia || c.grupo === 'pendente');
          const ativas = ordenadas.filter((c) => !pendencia.includes(c) && c.ativo && c.ativa_na_unidade !== false);
          const fora = ordenadas.filter((c) => !pendencia.includes(c) && !ativas.includes(c));
          return (
            <>
              <Cartao
                titulo={<span class="linha"><Tags size={16} aria-hidden="true" /> Ativas em {nomeUnidade} ({ativas.length})</span>}
                descricao="São estas que a Júlia escolhe e que aparecem em Nova despesa, Revisão e Contas fixas. Sem subcategorias."
                justo
              >
                {ativas.length ? (
                  <ul class="lista" aria-label="Categorias ativas">
                    {ativas.map((c) => <ItemCategoria key={c.codigo} c={c} lancar={lancar} unidade={unidade?.codigo ?? null} nomeUnidade={nomeUnidade} aoEditar={() => setEditar(c)} confirmar={confirmar} />)}
                  </ul>
                ) : (
                  <Vazio compacto icone={<Tags aria-hidden="true" />} titulo="Nenhuma categoria ativa nesta unidade">Sem categoria ativa, a Júlia manda tudo para a Revisão como “Não classificado”.</Vazio>
                )}
                {pendencia.length > 0 && (
                  <div class="cartao__rodape">
                    <strong>{pendencia[0].nome}</strong> é a pendência de classificação, não uma categoria de despesa: é onde fica o que ainda precisa de alguém escolher. Não se edita nem se desativa.
                  </div>
                )}
              </Cartao>
              {fora.length > 0 && (
                <Cartao titulo={`Fora de uso em ${nomeUnidade} (${fora.length})`} descricao="Ficam no cadastro porque lançamentos antigos as usam. Não são oferecidas em lançamentos novos desta unidade." justo>
                  <ul class="lista" aria-label="Categorias fora de uso">
                    {fora.map((c) => <ItemCategoria key={c.codigo} c={c} lancar={lancar} unidade={unidade?.codigo ?? null} nomeUnidade={nomeUnidade} aoEditar={() => setEditar(c)} confirmar={confirmar} />)}
                  </ul>
                </Cartao>
              )}
            </>
          );
        }}
      </Dados>
      <EditarCategoria alvo={editar} contexto={contexto} aoFechar={() => setEditar(null)} />
      {dialogo}
    </>
  );
}

function ItemCategoria({ c, lancar, unidade, nomeUnidade, aoEditar, confirmar }: { c: Categoria; lancar: boolean; unidade: string | null; nomeUnidade: string; aoEditar: () => void; confirmar: (p: PedidoConfirmacao) => void }) {
  const naUnidade = c.ativa_na_unidade !== false;
  const usos = c.em_uso ?? 0;
  const aliases = c.aliases ?? [];
  const alternar = (ativo: boolean) =>
    confirmar({
      titulo: ativo ? `Ativar “${c.nome}” em ${nomeUnidade}?` : `Desativar “${c.nome}” em ${nomeUnidade}?`,
      texto: ativo
        ? 'A categoria volta a ser oferecida nos formulários e a Júlia pode escolhê-la no próximo documento.'
        : 'Lançamentos antigos ficam como estão. A Júlia e os formulários deixam de oferecer esta categoria nesta unidade.',
      confirmar: ativo ? 'Ativar' : 'Desativar',
      perigo: !ativo,
      acao: async () => {
        await financeiro.categoriaNaUnidade(c.codigo, unidade!, ativo);
        atualizarCategorias();
      },
      sucesso: ativo ? `“${c.nome}” ativa em ${nomeUnidade}.` : `“${c.nome}” desativada em ${nomeUnidade}.`,
    });
  const reativar = () =>
    confirmar({
      titulo: `Reativar “${c.nome}” no cadastro?`,
      texto: 'Ela volta a valer nas unidades em que está ativa.',
      confirmar: 'Reativar',
      acao: async () => {
        await financeiro.alterarCategoria(c.codigo, { ativo: true });
        atualizarCategorias();
      },
      sucesso: `“${c.nome}” reativada.`,
    });

  return (
    <li class="lista__item fin-categoria-item" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }} data-categoria={c.codigo}>
      <span class="lista__texto" style={{ minWidth: '220px' }}>
        <strong>
          {c.nome} <code class="fraco pequeno">{c.codigo}</code>
        </strong>
        {c.descricao && <span>{c.descricao}</span>}
        <span class="fraco" title={GRUPO_AJUDA[c.grupo]}>{GRUPO[c.grupo] ?? c.grupo}{GRUPO_AJUDA[c.grupo] ? ` — ${GRUPO_AJUDA[c.grupo]}` : ''}</span>
        {aliases.length > 0 && (
          <span class="linha" aria-label="Apelidos que a Júlia reconhece">
            {aliases.slice(0, 12).map((a) => <Etiqueta key={a}>{a}</Etiqueta>)}
            {aliases.length > 12 && <span class="fraco">+{aliases.length - 12}</span>}
          </span>
        )}
        <span class="fraco">
          {usos ? `Em uso por ${plural(usos, 'lançamento', 'lançamentos')}` : 'Sem lançamentos'}
          {c.unidades?.length ? ` · ativa em ${c.unidades.length} ${c.unidades.length === 1 ? 'unidade' : 'unidades'}` : ' · nenhuma unidade'}
        </span>
      </span>
      <span class="lista__fim" style={{ color: 'var(--texto)', flexWrap: 'wrap' }}>
        {!c.ativo ? <Etiqueta tom="neutro">Desativada no cadastro</Etiqueta> : naUnidade ? <Etiqueta tom="ok">Ativa aqui</Etiqueta> : <Etiqueta tom="neutro">Inativa aqui</Etiqueta>}
        {c.padrao && <Etiqueta tom="info">Padrão</Etiqueta>}
        {lancar && (
          <>
            <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Editar ${c.nome}`} icone={<Pencil aria-hidden="true" />} onClick={aoEditar} />
            {!c.ativo ? (
              <Botao tamanho="p" icone={<RotateCcw aria-hidden="true" />} onClick={reativar}>Reativar</Botao>
            ) : unidade && naUnidade ? (
              <Botao tamanho="p" variante="fantasma" icone={<PowerOff aria-hidden="true" />} onClick={() => alternar(false)}>Desativar aqui</Botao>
            ) : unidade ? (
              <Botao tamanho="p" icone={<Power aria-hidden="true" />} onClick={() => alternar(true)}>Ativar aqui</Botao>
            ) : null}
          </>
        )}
      </span>
    </li>
  );
}

/** Criar ou editar. O código só se escolhe ao criar (é estável); excluir não existe. */
function EditarCategoria({ alvo, contexto, aoFechar }: { alvo: Categoria | 'nova' | null; contexto: ContextoPainel; aoFechar: () => void }) {
  const c = alvo && alvo !== 'nova' ? alvo : null;
  const nova = alvo === 'nova';
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoMexido, setCodigoMexido] = useState(false);
  const [grupo, setGrupo] = useState<Exclude<GrupoCategoria, 'pendente'>>('operacional');
  const [descricao, setDescricao] = useState('');
  const [apelidos, setApelidos] = useState('');
  const [padrao, setPadrao] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [unidades, setUnidades] = useState<string[]>([]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!alvo) return;
    setNome(c?.nome ?? '');
    setCodigo(c?.codigo ?? '');
    setCodigoMexido(false);
    setGrupo((c?.grupo && c.grupo !== 'pendente' ? c.grupo : 'operacional') as Exclude<GrupoCategoria, 'pendente'>);
    setDescricao(c?.descricao ?? '');
    setApelidos((c?.aliases ?? []).join(', '));
    setPadrao(c?.padrao ?? false);
    setAtivo(c?.ativo ?? true);
    setUnidades(contexto.unidade ? [contexto.unidade.codigo] : []);
    setErro(null);
  }, [alvo]);

  const mudarNome = (v: string) => {
    setNome(v);
    if (nova && !codigoMexido) setCodigo(slug(v));
  };

  async function salvar(e: Event) {
    e.preventDefault();
    const campos: Record<string, string> = {};
    if (!nome.trim()) campos.nome = 'Dê um nome.';
    if (nova && !CODIGO.test(codigo)) campos.codigo = 'Use de 2 a 40 letras minúsculas, números ou _, começando por letra.';
    if (Object.keys(campos).length) return setErro(new ErroApi('validacao', 'Confira os campos destacados.', 0, null, campos));
    const aliases = lerApelidos(apelidos);
    setOcupado(true);
    setErro(null);
    try {
      if (nova) {
        await financeiro.criarCategoria({ codigo, nome: nome.trim(), grupo, descricao: descricao.trim() || null, aliases, padrao, unidades });
        avisar(`Categoria “${nome.trim()}” criada.${unidades.length ? ' A Júlia já pode usá-la no próximo documento.' : ''}`, 'ok');
      } else if (c) {
        const m: CategoriaAlteracao = {};
        if (nome.trim() !== c.nome) m.nome = nome.trim();
        if ((descricao.trim() || null) !== (c.descricao ?? null)) m.descricao = descricao.trim() || null;
        if (aliases.join('|') !== (c.aliases ?? []).join('|')) m.aliases = aliases;
        if (padrao !== (c.padrao ?? false)) m.padrao = padrao;
        if (ativo !== c.ativo) m.ativo = ativo;
        if (Object.keys(m).length) {
          await financeiro.alterarCategoria(c.codigo, m);
          avisar('Categoria salva.', 'ok');
        }
      }
      atualizarCategorias();
      aoFechar();
    } catch (err) {
      const x = err instanceof ErroApi ? err : new ErroApi('servidor', 'Não foi possível salvar.');
      if (x.codigo === 'categoria_existe') {
        x.message = 'Escolha outro código.';
        x.campos = { ...x.campos, codigo: 'Já existe uma categoria com este código.' };
      }
      setErro(x);
    } finally {
      setOcupado(false);
    }
  }

  const previa = lerApelidos(apelidos);
  return (
    <Gaveta
      aberta={!!alvo}
      aoFechar={aoFechar}
      titulo={nova ? 'Nova categoria' : `Editar ${c?.nome ?? ''}`}
      subtitulo={nova ? 'Fica disponível para a Júlia e para os formulários nas unidades marcadas' : undefined}
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={ocupado}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-categoria" carregando={ocupado}>{nova ? 'Criar categoria' : 'Salvar'}</Botao>
        </>
      }
    >
      <form id="form-categoria" class="pilha" onSubmit={salvar} noValidate>
        {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro.message}</Aviso>}
        <Campo rotulo="Nome" erro={erro?.campos.nome}>
          {(id) => <input id={id} class="entrada" maxLength={80} value={nome} onInput={(e) => mudarNome(e.currentTarget.value)} placeholder="Ex.: Eventos" data-autofoco />}
        </Campo>
        {nova ? (
          <Campo rotulo="Código" erro={erro?.campos.codigo} ajuda="Identificador fixo: não muda depois. Letras minúsculas, números e _.">
            {(id, d) => (
              <input id={id} class="entrada num" maxLength={40} aria-describedby={d} value={codigo} onInput={(e) => { setCodigoMexido(true); setCodigo(e.currentTarget.value.toLowerCase()); }} placeholder="eventos" />
            )}
          </Campo>
        ) : (
          <p class="fraco">Código <code>{c?.codigo}</code> (não muda).</p>
        )}
        {nova ? (
          <Campo rotulo="Grupo" ajuda={GRUPO_AJUDA[grupo]} erro={erro?.campos.grupo}>
            {(id, d) => (
              <select id={id} class="selecao" aria-describedby={d} value={grupo} onChange={(e) => setGrupo(e.currentTarget.value as typeof grupo)}>
                {GRUPOS.map((g) => <option key={g} value={g}>{GRUPO[g]}</option>)}
              </select>
            )}
          </Campo>
        ) : (
          <p class="fraco">Grupo: <strong>{GRUPO[c?.grupo ?? ''] ?? c?.grupo}</strong>{GRUPO_AJUDA[c?.grupo ?? ''] ? ` — ${GRUPO_AJUDA[c!.grupo]}` : ''}</p>
        )}
        <Campo rotulo="Descrição" opcional erro={erro?.campos.descricao} ajuda="O que entra aqui. Ajuda a equipe e a Júlia a escolher.">
          {(id, d) => <textarea id={id} class="area" maxLength={300} aria-describedby={d} value={descricao} onInput={(e) => setDescricao(e.currentTarget.value)} placeholder="Ex.: Decoração, som e atrações de eventos." />}
        </Campo>
        <Campo rotulo="Apelidos que a Júlia reconhece" opcional erro={erro?.campos.aliases} ajuda="Separados por vírgula. Se a legenda do comprovante tiver uma destas palavras (ex.: “xerox”, “papelaria”), a Júlia usa esta categoria.">
          {(id, d) => <input id={id} class="entrada" aria-describedby={d} value={apelidos} onInput={(e) => setApelidos(e.currentTarget.value)} placeholder="decoracao, som, atracao" />}
        </Campo>
        {previa.length > 0 && <span class="linha" aria-hidden="true">{previa.map((a) => <Etiqueta key={a}>{a}</Etiqueta>)}</span>}
        <label class="linha" style={{ gap: '8px' }}>
          <input type="checkbox" checked={padrao} onChange={(e) => setPadrao(e.currentTarget.checked)} />
          <span>Padrão: já nasce ativa em unidade nova</span>
        </label>
        {nova && contexto.unidades.length > 0 && (
          <fieldset class="pilha pilha--p" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend class="campo__rotulo">Ativa nas unidades</legend>
            {contexto.unidades.map((u) => (
              <label key={u.codigo} class="linha" style={{ gap: '8px' }}>
                <input type="checkbox" checked={unidades.includes(u.codigo)} onChange={(e) => setUnidades(e.currentTarget.checked ? [...unidades, u.codigo] : unidades.filter((x) => x !== u.codigo))} />
                <span>{u.nome}</span>
              </label>
            ))}
            {!unidades.length && <span class="fraco">Sem unidade marcada, a categoria fica no cadastro mas não é oferecida em lugar nenhum.</span>}
          </fieldset>
        )}
        {c && (
          <>
            <label class="linha" style={{ gap: '8px' }}>
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.currentTarget.checked)} />
              <span>Ativa no cadastro (vale para todas as unidades)</span>
            </label>
            <Aviso tom="info" icone={<Info aria-hidden="true" />}>
              {c.em_uso ? `Em uso por ${plural(c.em_uso, 'lançamento', 'lançamentos')} — ` : ''}Categoria não se exclui: os lançamentos guardam o código. Para tirar de uso, desative (nesta unidade ou no cadastro).
            </Aviso>
          </>
        )}
      </form>
    </Gaveta>
  );
}
