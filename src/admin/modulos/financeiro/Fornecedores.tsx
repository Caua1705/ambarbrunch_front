// Fornecedores: o cadastro que o backend já tem (GET/POST /fornecedores, PATCH e GET /fornecedores/{id}). Buscar antes
// de criar, criar só o que não existe (409 `fornecedor_existente` oferece o existente), corrigir nome ou completar o
// CNPJ/CPF, desativar sem apagar (o histórico continua apontando para ele) — tudo com motivo. O detalhe mostra as últimas
// despesas desta unidade e o que falta pagar.
// `EscolherFornecedor` é o campo dos formulários: busca no cadastro e envia `{ id }`; só cadastra um nome novo quando a
// pessoa escolhe "Cadastrar …", para não criar o mesmo fornecedor duas vezes com grafias diferentes.
import { useEffect, useState } from 'preact/hooks';
import { Plus, Search, Truck } from 'lucide-preact';
import { useConsulta, invalidar } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta, plural } from '../../lib/formato';
import { Gaveta, avisar, avisarErro } from '../../ui/camadas';
import { Botao, Cartao, Campo, Situacao, Aviso } from '../../ui/base';
import { Dados, EsqueletoTabela, Esqueleto, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import { Autocompletar, type OpcaoAuto } from '../../ui/entradas';
import type { FornecedorCadastro } from '../../lib/tipos/financeiro';
import { ORIGEM } from './comum';

export function Fornecedores({ lancar }: { lancar: boolean }) {
  const [busca, setBusca] = useState('');
  const [aplicada, setAplicada] = useState('');
  const [inativos, setInativos] = useState(false);
  const [aberto, setAberto] = useState<FornecedorCadastro | null>(null);
  const [novo, setNovo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAplicada(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);
  const lista = useConsulta(`financeiro/fornecedores?${aplicada}:${inativos}`, () => financeiro.fornecedores(aplicada || undefined, { limite: 100, incluirInativos: inativos }));

  const colunas: Coluna<FornecedorCadastro>[] = [
    { id: 'nome', titulo: 'Fornecedor', ordenar: (f) => f.nome, celula: (f) => <><span class="principal-celula">{f.nome}</span><span class="sub">{f.documento ?? 'Sem CNPJ/CPF'}</span></> },
    { id: 'origem', titulo: 'Cadastrado por', prioridade: 'baixa', celula: (f) => <span class="fraco">{f.origem ? ORIGEM[f.origem] ?? f.origem : '—'}</span> },
    { id: 'situacao', titulo: 'Situação', prioridade: 'media', celula: (f) => (f.ativo === false ? <Situacao tom="apagado">Inativo</Situacao> : <Situacao tom="ok">Ativo</Situacao>) },
  ];

  return (
    <>
      <div class="barra-ferramentas">
        <div class="entrada-grupo barra-ferramentas__busca">
          <Search aria-hidden="true" />
          <input class="entrada" type="search" placeholder="Buscar por nome" aria-label="Buscar fornecedor" maxLength={80} value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
        </div>
        <label class="marcar">
          <input type="checkbox" checked={inativos} onChange={(e) => setInativos(e.currentTarget.checked)} /> Mostrar inativos
        </label>
        {lancar && (
          <div class="barra-ferramentas__acoes">
            <Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setNovo(true)}>Novo fornecedor</Botao>
          </div>
        )}
      </div>
      <Cartao justo>
        <Dados consulta={lista} recurso="Os fornecedores" esqueleto={<EsqueletoTabela />}>
          {(itens) => (
            <Tabela
              rotulo="Fornecedores"
              colunas={colunas}
              linhas={itens}
              chave={(f) => f.id}
              aoAbrir={setAberto}
              apagada={(f) => f.ativo === false}
              vazio={<Vazio compacto icone={<Truck aria-hidden="true" />} titulo={aplicada ? 'Nenhum fornecedor com esse nome' : 'Nenhum fornecedor cadastrado'}>Fornecedores entram pelos lançamentos, pelas compras e pela Júlia — ou aqui, antes do primeiro lançamento.</Vazio>}
            />
          )}
        </Dados>
      </Cartao>
      <DetalheFornecedor alvo={aberto} lancar={lancar} aoFechar={() => setAberto(null)} />
      <NovoFornecedor aberta={novo} aoFechar={() => setNovo(false)} aoCriar={(f) => { setNovo(false); setAberto(f); }} />
    </>
  );
}

function DetalheFornecedor({ alvo, lancar, aoFechar }: { alvo: FornecedorCadastro | null; lancar: boolean; aoFechar: () => void }) {
  const detalhe = useConsulta(alvo ? `financeiro/fornecedores/${alvo.id}` : null, () => financeiro.fornecedor(alvo!.id));
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState('');
  const [doc, setDoc] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  useEffect(() => {
    setEditando(false);
    setNome(alvo?.nome ?? '');
    setDoc('');
    setMotivo('');
    setErro(null);
  }, [alvo?.id]);
  if (!alvo) return <Gaveta aberta={false} aoFechar={aoFechar} titulo=""><span /></Gaveta>;

  async function salvar(mudancas: { nome?: string; documento?: string; ativo?: boolean }, ok: string) {
    if (motivo.trim().length < 5) {
      setErro(new ErroApi('validacao', 'Explique o motivo (pelo menos 5 letras): fica no histórico.'));
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await financeiro.alterarFornecedor(alvo!.id, { motivo: motivo.trim(), ...mudancas });
      invalidar('financeiro/fornecedores');
      avisar(ok, 'ok');
      aoFechar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e : new ErroApi('servidor', 'Não foi possível salvar.'));
    } finally {
      setSalvando(false);
    }
  }

  const inativo = alvo.ativo === false;
  return (
    <Gaveta
      aberta
      aoFechar={aoFechar}
      titulo={alvo.nome}
      subtitulo={alvo.documento ?? 'Sem CNPJ/CPF'}
      rodape={
        lancar && (
          editando ? (
            <>
              <Botao onClick={() => setEditando(false)} disabled={salvando}>Voltar</Botao>
              <Botao variante="primario" carregando={salvando} onClick={() => salvar({ ...(nome.trim() && nome.trim() !== alvo.nome ? { nome: nome.trim() } : {}), ...(doc.replace(/\D/g, '') ? { documento: doc.replace(/\D/g, '') } : {}) }, 'Fornecedor atualizado.')}>Salvar</Botao>
            </>
          ) : (
            <>
              <Botao variante={inativo ? 'secundario' : 'fantasma'} onClick={() => setEditando(true)}>Editar ou {inativo ? 'reativar' : 'desativar'}</Botao>
            </>
          )
        )
      }
    >
      {editando ? (
        <div class="pilha">
          <Campo rotulo="Nome">{(id) => <input id={id} class="entrada" maxLength={160} value={nome} onInput={(e) => setNome(e.currentTarget.value)} />}</Campo>
          {!alvo.documento && <Campo rotulo="CNPJ ou CPF" opcional ajuda="Só completa quem ainda não tem documento.">{(id, d) => <input id={id} class="entrada num" inputMode="numeric" maxLength={20} aria-describedby={d} value={doc} onInput={(e) => setDoc(e.currentTarget.value)} />}</Campo>}
          <Campo rotulo="Motivo" ajuda="Obrigatório: fica no histórico do cadastro.">{(id, d) => <input id={id} class="entrada" maxLength={300} aria-describedby={d} value={motivo} onInput={(e) => setMotivo(e.currentTarget.value)} />}</Campo>
          {erro && <Aviso tom="perigo">{erro.message}</Aviso>}
          <Aviso tom={inativo ? 'info' : 'atencao'}>
            {inativo ? 'Reativado, ele volta a aparecer na busca e nos formulários.' : 'Desativado, ele some da busca e dos formulários. Lançamentos antigos continuam com ele.'}{' '}
            <button type="button" class="link" disabled={salvando} onClick={() => salvar({ ativo: inativo }, inativo ? 'Fornecedor reativado.' : 'Fornecedor desativado.')}>{inativo ? 'Reativar agora' : 'Desativar agora'}</button>
          </Aviso>
        </div>
      ) : (
        <Dados consulta={detalhe} recurso="O histórico do fornecedor" esqueleto={<Esqueleto linhas={6} />}>
          {(d) => (
            <div class="pilha">
              <section aria-label="A pagar" class="pilha pilha--p">
                <h3 class="secao-titulo">A pagar</h3>
                {d.a_pagar.itens.length ? (
                  <>
                    <ul class="lista fin-borda">
                      {d.a_pagar.itens.map((c) => (
                        <li key={c.parcela_id} class="lista__item">
                          <span class="lista__texto"><strong>{c.descricao}</strong><span>vence {dataCurta(c.vencimento, { ano: true })}</span></span>
                          <span class="lista__fim num forte">{moeda(c.saldo)}</span>
                        </li>
                      ))}
                    </ul>
                    <span class="fraco">Total em aberto: {moeda(d.a_pagar.totais.saldo)}</span>
                  </>
                ) : (
                  <span class="fraco">Nada em aberto com este fornecedor nesta unidade.</span>
                )}
              </section>
              <section aria-label="Últimas despesas" class="pilha pilha--p">
                <h3 class="secao-titulo">Últimas despesas</h3>
                {d.despesas.length ? (
                  <ul class="lista fin-borda">
                    {d.despesas.map((x) => (
                      <li key={x.id} class="lista__item">
                        <span class="lista__texto"><strong>{x.descricao}</strong><span>{dataCurta(x.competencia, { ano: true })}</span></span>
                        <span class="lista__fim num">{moeda(x.valor)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span class="fraco">Nenhuma despesa com ele nesta unidade.</span>
                )}
                {d.despesas.length >= 30 && <span class="fraco">Mostrando as 30 mais recentes ({plural(d.despesas.length, 'despesa', 'despesas')}).</span>}
              </section>
            </div>
          )}
        </Dados>
      )}
    </Gaveta>
  );
}

function NovoFornecedor({ aberta, aoFechar, aoCriar }: { aberta: boolean; aoFechar: () => void; aoCriar: (f: FornecedorCadastro) => void }) {
  const [nome, setNome] = useState('');
  const [doc, setDoc] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  useEffect(() => {
    if (!aberta) return;
    setNome('');
    setDoc('');
    setErro(null);
  }, [aberta]);

  async function criar(e: Event) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro(new ErroApi('validacao', 'Informe o nome.'));
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const f = await financeiro.criarFornecedor({ nome: nome.trim(), documento: doc.replace(/\D/g, '') || null });
      invalidar('financeiro/fornecedores');
      avisar('Fornecedor cadastrado.', 'ok');
      aoCriar(f);
    } catch (x) {
      setErro(x instanceof ErroApi ? x : new ErroApi('servidor', 'Não foi possível cadastrar.'));
    } finally {
      setSalvando(false);
    }
  }

  const existente = erro?.codigo === 'fornecedor_existente' ? (erro.dados?.id as string | undefined) : undefined;
  return (
    <Gaveta
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Novo fornecedor"
      subtitulo="Antes do primeiro lançamento. O sistema confere se ele já existe."
      rodape={<><Botao onClick={aoFechar} disabled={salvando}>Cancelar</Botao><Botao variante="primario" type="submit" form="form-fornecedor" carregando={salvando}>Cadastrar</Botao></>}
    >
      <form id="form-fornecedor" class="pilha" onSubmit={criar} noValidate>
        <Campo rotulo="Nome">{(id) => <input id={id} class="entrada" maxLength={160} autoFocus value={nome} onInput={(e) => setNome(e.currentTarget.value)} />}</Campo>
        <Campo rotulo="CNPJ ou CPF" opcional ajuda="Com o documento, o sistema reconhece o mesmo fornecedor escrito de outro jeito.">{(id, d) => <input id={id} class="entrada num" inputMode="numeric" maxLength={20} aria-describedby={d} value={doc} onInput={(e) => setDoc(e.currentTarget.value)} />}</Campo>
        {erro && (
          <Aviso tom={existente ? 'atencao' : 'perigo'}>
            {erro.message}
            {existente && (
              <>
                {' '}
                <button type="button" class="link" onClick={() => financeiro.fornecedor(existente).then((f) => aoCriar({ id: f.id, nome: f.nome, documento: f.documento, ativo: true })).catch(avisarErro)}>Abrir o existente</button>
              </>
            )}
          </Aviso>
        )}
      </form>
    </Gaveta>
  );
}

/**
 * Campo de fornecedor dos formulários: busca no cadastro (só ativos) e devolve o escolhido. "Cadastrar …" só aparece
 * para um nome que a busca não achou; aí o formulário manda nome (e documento, se houver) e o backend resolve ou cria.
 */
export type FornecedorEscolhido = { id: string; nome: string } | { novo: string };

export function EscolherFornecedor({ id, valor, aoEscolher, descr }: { id?: string; valor: FornecedorEscolhido | null; aoEscolher: (f: FornecedorEscolhido | null) => void; descr?: string }) {
  const opcao: OpcaoAuto | null = !valor ? null : 'id' in valor ? { valor: valor.id, rotulo: valor.nome } : { valor: `novo:${valor.novo}`, rotulo: `${valor.novo} (novo)` };
  return (
    <Autocompletar
      id={id}
      rotulo="Fornecedor"
      valor={opcao}
      descr={descr}
      placeholder="Buscar no cadastro…"
      buscar={async (t) => (await financeiro.fornecedores(t.trim() || undefined, { limite: 8 })).map((f) => ({ valor: f.id, rotulo: f.nome, detalhe: f.documento ?? undefined }))}
      aoEscolher={(o) => aoEscolher(o ? (o.valor.startsWith('novo:') ? { novo: o.valor.slice(5) } : { id: o.valor, nome: o.rotulo }) : null)}
      criar={{ rotulo: (t) => `Cadastrar “${t}”`, acao: (t) => aoEscolher({ novo: t }) }}
    />
  );
}
