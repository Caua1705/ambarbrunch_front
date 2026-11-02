// Base de conhecimento do assistente: o que ele pode afirmar além dos fatos fixos (horário, endereço…). Só entra o que o
// Âmbar confirmou, sempre com a FONTE (quem confirmou e onde); sem a informação aqui, o assistente passa para a equipe.
// Todos veem; editar exige atendimento.conhecimento (Gerente e Proprietário). Nada se apaga: desativar tira do assistente e
// mantém o registro (o backend guarda o conteúdo anterior na auditoria).
import { useEffect, useState } from 'preact/hooks';
import { BookOpen, Plus, Pencil, EyeOff, Eye } from 'lucide-preact';
import { useConsulta, invalidar } from '../../lib/consulta';
import { atendimento } from '../../lib/api/atendimento-clube';
import { ErroApi } from '../../lib/api/cliente';
import { dataHora } from '../../lib/formato';
import { Gaveta, avisar, type useConfirmacao } from '../../ui/camadas';
import { Botao, Campo, Situacao, Aviso } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type { BaseConhecimento, ItemConhecimento } from '../../lib/tipos/atendimento-clube';
import { chaveDoTema } from './comum';

type Confirmar = ReturnType<typeof useConfirmacao>['confirmar'];
interface Rascunho {
  chave: string;
  /** Item que já existe (a chave não muda). */
  existente: boolean;
  tema: string;
  conteudo: string;
  fonte: string;
  ativo: boolean;
}

export function Conhecimento({ aberta, aoFechar, podeEditar, confirmar }: { aberta: boolean; aoFechar: () => void; podeEditar: boolean; confirmar: Confirmar }) {
  const consulta = useConsulta(aberta ? 'atendimento/conhecimento' : null, () => atendimento.conhecimento());
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  useEffect(() => {
    if (!aberta) setRascunho(null);
  }, [aberta]);
  const novo = (chave = '', tema = '') => setRascunho({ chave, existente: false, tema, conteudo: '', fonte: '', ativo: true });

  return (
    <Gaveta aberta={aberta} aoFechar={aoFechar} largura="media" titulo="Base de conhecimento" subtitulo="O que o assistente virtual pode responder sozinho">
      <div class="pilha">
        <Aviso tom="info" icone={<BookOpen aria-hidden="true" />}>
          Só o que o Âmbar confirmou. Sem a informação aqui, o assistente passa para a equipe.
          {!podeEditar && ' Só a gerência altera esta base.'}
        </Aviso>
        {rascunho ? (
          <Formulario r={rascunho} aoMudar={setRascunho} aoFechar={() => setRascunho(null)} />
        ) : (
          <Dados consulta={consulta} recurso="A base de conhecimento" esqueleto={<Esqueleto linhas={6} />}>
            {(b: BaseConhecimento) => (
              <>
                {podeEditar && (
                  <div class="pilha pilha--p">
                    <div class="linha linha--entre">
                      <h3 class="secao-titulo">Temas que costumam faltar</h3>
                      <Botao tamanho="p" icone={<Plus aria-hidden="true" />} onClick={() => novo()}>Outro tema</Botao>
                    </div>
                    {b.sugestoes.length ? (
                      <div class="linha" style={{ gap: '6px' }}>
                        {b.sugestoes.map((s) => (
                          <button key={s.chave} type="button" class="pilula pilula--neutra" onClick={() => novo(s.chave, s.tema)}>
                            <Plus aria-hidden="true" /> {s.tema}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p class="fraco">Todos os temas sugeridos já têm resposta.</p>
                    )}
                  </div>
                )}
                {b.itens.length ? (
                  <ul class="lista lista--borda" aria-label="Itens da base de conhecimento">
                    {b.itens.map((i) => (
                      <Item key={i.chave} i={i} podeEditar={podeEditar} aoEditar={() => setRascunho({ chave: i.chave, existente: true, tema: i.tema, conteudo: i.conteudo, fonte: i.fonte, ativo: i.ativo })} confirmar={confirmar} />
                    ))}
                  </ul>
                ) : (
                  <Vazio compacto icone={<BookOpen aria-hidden="true" />} titulo="Nada cadastrado ainda">
                    Por enquanto o assistente só responde o básico (horário, endereço, reservas) e encaminha o resto para a equipe.
                  </Vazio>
                )}
              </>
            )}
          </Dados>
        )}
      </div>
    </Gaveta>
  );
}

function Item({ i, podeEditar, aoEditar, confirmar }: { i: ItemConhecimento; podeEditar: boolean; aoEditar: () => void; confirmar: Confirmar }) {
  const reativar = async () => {
    try {
      await atendimento.salvarConhecimento(i.chave, { tema: i.tema, conteudo: i.conteudo, fonte: i.fonte, ativo: true });
      avisar('Item reativado: o assistente volta a usar.', 'ok');
    } catch (e) {
      avisar(e instanceof ErroApi ? e.message : 'Não foi possível reativar.', 'erro');
    } finally {
      invalidar('atendimento/conhecimento');
    }
  };
  return (
    <li class="conhecimento-item" data-apagado={!i.ativo || undefined}>
      <div class="linha linha--entre" style={{ gap: '8px', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <strong>{i.tema}</strong>
        <Situacao tom={i.ativo ? 'ok' : 'apagado'}>{i.ativo ? 'Em uso' : 'Desativado'}</Situacao>
      </div>
      <p style={{ whiteSpace: 'pre-wrap' }}>{i.conteudo}</p>
      <p class="fraco">Fonte: {i.fonte}{i.atualizado_em ? ` · atualizado ${dataHora(i.atualizado_em)}` : ''}</p>
      {podeEditar && (
        <div class="linha" style={{ gap: '6px' }}>
          <Botao tamanho="p" variante="fantasma" icone={<Pencil aria-hidden="true" />} onClick={aoEditar} aria-label={`Editar ${i.tema}`}>Editar</Botao>
          {i.ativo ? (
            <Botao
              tamanho="p"
              variante="fantasma"
              icone={<EyeOff aria-hidden="true" />}
              aria-label={`Desativar ${i.tema}`}
              onClick={() => confirmar({ titulo: `Desativar “${i.tema}”?`, texto: 'O assistente deixa de usar esta informação e passa a encaminhar o assunto para a equipe. O registro fica guardado.', confirmar: 'Desativar', acao: async () => { try { await atendimento.desativarConhecimento(i.chave); } finally { invalidar('atendimento/conhecimento'); } }, sucesso: 'Item desativado.' })}
            >
              Desativar
            </Botao>
          ) : (
            <Botao tamanho="p" variante="fantasma" icone={<Eye aria-hidden="true" />} onClick={reativar} aria-label={`Reativar ${i.tema}`}>Reativar</Botao>
          )}
        </div>
      )}
    </li>
  );
}

function Formulario({ r, aoMudar, aoFechar }: { r: Rascunho; aoMudar: (r: Rascunho) => void; aoFechar: () => void }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const chave = r.chave || chaveDoTema(r.tema);
  const faltando = r.tema.trim().length < 2 ? 'Informe o tema.' : chave.length < 2 ? 'Use letras no tema.' : r.conteudo.trim().length < 2 ? 'Escreva a resposta.' : r.fonte.trim().length < 2 ? 'Informe a fonte.' : null;

  async function salvar(e: Event) {
    e.preventDefault();
    if (faltando || salvando) return;
    setSalvando(true);
    setErro(null);
    setCampos({});
    try {
      await atendimento.salvarConhecimento(chave, { tema: r.tema.trim(), conteudo: r.conteudo.trim(), fonte: r.fonte.trim(), ativo: r.ativo });
      avisar(r.ativo ? 'Salvo: o assistente já pode usar.' : 'Salvo (desativado).', 'ok');
      invalidar('atendimento/conhecimento');
      aoFechar();
    } catch (err) {
      if (err instanceof ErroApi) {
        setErro(err.message);
        setCampos(err.campos);
      } else setErro('Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form class="pilha" onSubmit={salvar}>
      <h3 style={{ fontSize: '15px' }}>{r.existente ? `Editar “${r.tema}”` : 'Novo item'}</h3>
      <Campo rotulo="Tema" erro={campos.tema} ajuda={r.existente ? undefined : 'Assunto que o cliente pergunta (ex.: Estacionamento).'}>
        {(id, descr) => <input id={id} class="entrada" maxLength={80} aria-describedby={descr} value={r.tema} onInput={(e) => aoMudar({ ...r, tema: e.currentTarget.value })} data-autofoco />}
      </Campo>
      <Campo rotulo="O que o assistente pode dizer" erro={campos.conteudo} ajuda={`${r.conteudo.length}/800. Escreva só o que foi confirmado, do jeito que pode ser dito ao cliente.`}>
        {(id, descr) => <textarea id={id} class="area" rows={5} maxLength={800} aria-describedby={descr} value={r.conteudo} onInput={(e) => aoMudar({ ...r, conteudo: e.currentTarget.value })} />}
      </Campo>
      <Campo rotulo="Fonte" erro={campos.fonte} ajuda="Obrigatório: quem confirmou e onde (ex.: Gerência, reunião de 02/11).">
        {(id, descr) => <input id={id} class="entrada" maxLength={200} required aria-describedby={descr} value={r.fonte} onInput={(e) => aoMudar({ ...r, fonte: e.currentTarget.value })} />}
      </Campo>
      <label class="marcar">
        <input type="checkbox" checked={r.ativo} onChange={(e) => aoMudar({ ...r, ativo: e.currentTarget.checked })} />
        <span>Em uso pelo assistente</span>
      </label>
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
      <div class="linha" style={{ justifyContent: 'flex-end', gap: '8px' }}>
        <Botao onClick={aoFechar} disabled={salvando}>Voltar</Botao>
        <Botao type="submit" variante="primario" carregando={salvando} disabled={!!faltando} title={faltando ?? undefined}>Salvar</Botao>
      </div>
    </form>
  );
}
