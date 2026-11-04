// Cardápio oficial do atendimento (backend com a migração 0024): o PDF que o assistente manda como DOCUMENTO no WhatsApp
// (quando o cliente pede o cardápio completo) e o catálogo que ele usa para responder preço e ingredientes — só leitura para
// a IA. Todos veem; trocar o PDF exige atendimento.conhecimento (Gerente e Proprietário): a nova versão vira a vigente na
// hora, sem deploy, e a anterior fica guardada. Embaixo, as capacidades oficiais dos ambientes conferidas com o cadastro
// (só aponta divergência; quem corrige é a operação, na configuração de Reservas).
import { useEffect, useState } from 'preact/hooks';
import { UtensilsCrossed, FileText, FileUp, Search, Users } from 'lucide-preact';
import { useConsulta, invalidar } from '../../lib/consulta';
import { atendimento, urlCardapioPdf } from '../../lib/api/atendimento-clube';
import { ErroApi } from '../../lib/api/cliente';
import { dataHora } from '../../lib/formato';
import { Gaveta, avisar } from '../../ui/camadas';
import { Botao, Campo, Situacao, Aviso, type Tom } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type { CardapioItem, CardapioPainel, CapacidadesPainel, SituacaoCapacidade } from '../../lib/tipos/atendimento-clube';

const SITUACAO: Record<SituacaoCapacidade, [string, Tom]> = {
  ok: ['Confere', 'ok'],
  capacidade_diferente: ['Capacidade diferente', 'perigo'],
  limites_nao_confirmados: ['Limites não confirmados', 'atencao'],
  ausente_no_cadastro: ['Não cadastrado', 'atencao'],
};

export function Cardapio({ aberta, aoFechar, podeEditar }: { aberta: boolean; aoFechar: () => void; podeEditar: boolean }) {
  const [busca, setBusca] = useState('');
  const [trocando, setTrocando] = useState(false);
  const consulta = useConsulta(aberta ? `atendimento/cardapio:${busca.trim()}` : null, () => atendimento.cardapio(busca));
  const capacidades = useConsulta(aberta ? 'atendimento/capacidades' : null, () => atendimento.capacidades());
  useEffect(() => {
    if (!aberta) {
      setTrocando(false);
      setBusca('');
    }
  }, [aberta]);

  return (
    <Gaveta aberta={aberta} aoFechar={aoFechar} largura="media" titulo="Cardápio e capacidades" subtitulo="O que o assistente usa para preço, ingredientes e o PDF do cardápio">
      <div class="pilha">
        <Aviso tom="info" icone={<UtensilsCrossed aria-hidden="true" />}>
          O assistente responde preço e ingredientes só com o catálogo abaixo e manda o PDF quando o cliente pede o cardápio
          completo. Alergia e restrição alimentar vão sempre para a equipe.
        </Aviso>
        <Dados consulta={consulta} recurso="O cardápio" esqueleto={<Esqueleto linhas={6} />}>
          {(c: CardapioPainel) => (
            <>
              <section class="pilha pilha--p" aria-label="PDF do cardápio">
                <div class="linha linha--entre">
                  <h3 class="secao-titulo">PDF enviado aos clientes</h3>
                  {podeEditar && !trocando && (
                    <Botao tamanho="p" icone={<FileUp aria-hidden="true" />} onClick={() => setTrocando(true)}>Nova versão</Botao>
                  )}
                </div>
                {c.pdf ? (
                  <div class="pilha pilha--p">
                    <div class="linha" style={{ gap: '8px' }}>
                      <a class="msg__arquivo" href={urlCardapioPdf} target="_blank" rel="noopener">
                        <FileText size={14} aria-hidden="true" /> Abrir o PDF vigente
                      </a>
                      <Situacao tom="ok">Versão {c.pdf.versao}</Situacao>
                    </div>
                    <p class="fraco">
                      {c.pdf.paginas ? `${c.pdf.paginas} páginas · ` : ''}{Math.round(c.pdf.tamanho / 1024)} KB · fonte: {c.pdf.fonte}
                      {' · '}{c.pdf.midia_meta.valida ? `na Meta desde ${dataHora(c.pdf.midia_meta.enviada_em)}` : 'sobe para a Meta no próximo envio'}
                    </p>
                  </div>
                ) : (
                  <Aviso tom="atencao">Nenhum PDF vigente: o assistente manda o link do cardápio do site.</Aviso>
                )}
                {trocando && <TrocarPdf aoFechar={() => setTrocando(false)} />}
                {c.versoes.length > 1 && (
                  <details>
                    <summary class="fraco">Versões anteriores ({c.versoes.length - 1})</summary>
                    <ul class="lista">
                      {c.versoes.filter((v) => !v.vigente).map((v) => (
                        <li key={v.id} class="fraco">{v.versao} · {dataHora(v.criado_em)} · {v.fonte}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
              <section class="pilha pilha--p" aria-label="Catálogo">
                <h3 class="secao-titulo">Catálogo ({c.itens.length}{busca.trim() ? ' encontrados' : ' itens'})</h3>
                <div class="linha" style={{ gap: '6px', flexWrap: 'nowrap' }}>
                  <Search size={14} aria-hidden="true" />
                  <input class="entrada" type="search" placeholder="Buscar produto, categoria ou ingrediente" value={busca} maxLength={80} onInput={(e) => setBusca(e.currentTarget.value)} aria-label="Buscar no catálogo" />
                </div>
                {c.itens.length ? <Itens itens={c.itens} /> : (
                  <Vazio compacto icone={<UtensilsCrossed aria-hidden="true" />} titulo={busca.trim() ? 'Nada encontrado' : 'Catálogo vazio'}>
                    {busca.trim() ? 'Tente outro termo.' : 'Sem catálogo, o assistente não responde preço nem ingrediente: manda o cardápio ou chama a equipe.'}
                  </Vazio>
                )}
              </section>
            </>
          )}
        </Dados>
        <section class="pilha pilha--p" aria-label="Capacidades dos ambientes">
          <h3 class="secao-titulo">Capacidades oficiais × cadastro</h3>
          <Dados consulta={capacidades} recurso="As capacidades" esqueleto={<Esqueleto linhas={4} />}>
            {(k: CapacidadesPainel) => (
              <>
                {!k.tudo_certo && (
                  <Aviso tom="atencao" icone={<Users aria-hidden="true" />}>
                    O cadastro de ambientes não bate com as capacidades oficiais. Nada foi alterado: corrija na configuração de Reservas.
                  </Aviso>
                )}
                <ul class="lista lista--borda">
                  {k.conferencia.map((d, i) => {
                    const [rotulo, tom] = SITUACAO[d.situacao];
                    return (
                      <li key={`${d.ambiente}-${i}`} class="linha linha--entre" style={{ gap: '8px' }}>
                        <span>
                          <strong>{d.ambiente}</strong>: oficial {d.oficial}
                          {d.cadastro ? <span class="fraco"> · cadastro “{d.cadastro.nome}”: {d.cadastro.capacidade ?? '—'}</span> : null}
                        </span>
                        <Situacao tom={tom}>{rotulo}</Situacao>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Dados>
        </section>
      </div>
    </Gaveta>
  );
}

function Itens({ itens }: { itens: CardapioItem[] }) {
  const grupos: [string, CardapioItem[]][] = [];
  for (const item of itens) {
    const titulo = item.tipo === 'adicional' ? `Adicionais — ${item.categoria}` : item.categoria;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo[0] === titulo) ultimo[1].push(item);
    else grupos.push([titulo, [item]]);
  }
  return (
    <div class="pilha pilha--p">
      {grupos.map(([titulo, lista]) => (
        <div key={titulo}>
          <strong>{titulo}</strong>
          {lista[0].categoria_observacao && <span class="fraco"> · {lista[0].categoria_observacao}</span>}
          <ul class="lista">
            {lista.map((i) => (
              <li key={i.chave} class="linha linha--entre" style={{ gap: '8px', alignItems: 'flex-start' }}>
                <span>{i.nome}{i.descricao ? <span class="fraco"> — {i.descricao}</span> : null}</span>
                <span style={{ whiteSpace: 'nowrap' }}>{i.tipo === 'adicional' ? `+ ${i.preco}` : i.preco}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TrocarPdf({ aoFechar }: { aoFechar: () => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [versao, setVersao] = useState('');
  const [fonte, setFonte] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const faltando = !arquivo ? 'Escolha o PDF.' : arquivo.size > 15 * 1024 * 1024 ? 'PDF de até 15 MB.' : !versao.trim() ? 'Informe a versão.' : fonte.trim().length < 2 ? 'Informe a fonte.' : null;

  async function enviar(e: Event) {
    e.preventDefault();
    if (faltando || enviando || !arquivo) return;
    setEnviando(true);
    setErro(null);
    try {
      const novo = await atendimento.trocarCardapioPdf(arquivo, versao.trim(), fonte.trim());
      avisar(novo.nova ? `Versão ${novo.versao} em uso: o próximo pedido de cardápio já sai com ela.` : 'Este PDF já estava guardado; agora é o vigente.', 'ok');
      invalidar('atendimento/cardapio');
      aoFechar();
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Não foi possível enviar o PDF.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form class="pilha pilha--p" onSubmit={enviar}>
      <Campo rotulo="Arquivo PDF" ajuda="O cardápio completo, como o cliente vai receber.">
        {(id, descr) => <input id={id} type="file" accept="application/pdf,.pdf" aria-describedby={descr} onChange={(e) => setArquivo(e.currentTarget.files?.[0] ?? null)} />}
      </Campo>
      <Campo rotulo="Versão" ajuda="Ex.: 2026-12 ou “preços de dezembro”.">
        {(id, descr) => <input id={id} class="entrada" maxLength={40} aria-describedby={descr} value={versao} onInput={(e) => setVersao(e.currentTarget.value)} />}
      </Campo>
      <Campo rotulo="Fonte" ajuda="Quem aprovou (ex.: Dono, 03/12).">
        {(id, descr) => <input id={id} class="entrada" maxLength={300} aria-describedby={descr} value={fonte} onInput={(e) => setFonte(e.currentTarget.value)} />}
      </Campo>
      <Aviso tom="info">O catálogo de preços usado nas respostas é atualizado à parte (arquivo do catálogo): trocar só o PDF não muda os preços que o assistente responde.</Aviso>
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
      <div class="linha" style={{ justifyContent: 'flex-end', gap: '8px' }}>
        <Botao onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
        <Botao type="submit" variante="primario" carregando={enviando} disabled={!!faltando} title={faltando ?? undefined}>Usar esta versão</Botao>
      </div>
    </form>
  );
}
