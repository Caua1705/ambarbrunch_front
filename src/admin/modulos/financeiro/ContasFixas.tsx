// Contas fixas e taxas: as contas que se repetem (aluguel, internet, folha como valor variável) e as taxas do cartão/PIX
// do contrato da adquirente. Cada competência de uma conta fixa vira uma conta em Contas a pagar com antecedência; as
// taxas entram no resultado como ESTIMATIVA (a Eyemobile não informa a taxa cobrada) e cada registro é uma nova
// vigência — os meses anteriores não mudam. Rotas: GET/POST/PATCH /admin/financeiro/recorrencias e GET/POST
// /admin/financeiro/taxas-pagamento (as duas com financeiro.lancar no backend: gerente e proprietário).
import { useEffect, useState } from 'preact/hooks';
import { Plus, Pencil, CalendarX, Repeat, Info, Percent, Check } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta, mesAno, paraDecimal, hojeISO, pct, inteiro } from '../../lib/formato';
import { Gaveta } from '../../ui/camadas';
import { Botao, Cabecalho, Cartao, Segmentado, Etiqueta, Campo, Aviso, Situacao } from '../../ui/base';
import { EntradaMoeda } from '../../ui/entradas';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import type { MeioPdv, Recorrencia, TaxaPagamento } from '../../lib/tipos/financeiro';
import { useCategorias, useNomeCategoria, OpcoesCategoria, atualizarFinanceiro, avisar, temPermissao, MEIO } from './comum';

const brl = (v: string) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ContasFixas({ contexto }: { contexto: ContextoPainel }) {
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  return (
    <>
      <Cabecalho titulo="Contas fixas e taxas" descricao="O que se repete todo mês e as taxas do cartão e do Pix" />
      <Recorrencias lancar={lancar} />
      <Taxas lancar={lancar} />
    </>
  );
}

// Contas fixas ---------------------------------------------------------------------------------------------------------

function Recorrencias({ lancar }: { lancar: boolean }) {
  const [ver, setVer] = useState<'ativas' | 'todas'>('ativas');
  const consulta = useConsulta(`financeiro/recorrencias:${ver}`, () => financeiro.recorrencias(ver === 'ativas'));
  const nome = useNomeCategoria();
  const [editar, setEditar] = useState<Recorrencia | 'nova' | null>(null);
  const [encerrar, setEncerrar] = useState<Recorrencia | null>(null);
  return (
    <>
      <Cartao
        titulo={<span class="linha"><Repeat size={16} aria-hidden="true" /> Contas fixas</span>}
        descricao="Cadastradas uma vez; a conta de cada mês aparece sozinha em Contas a pagar"
        justo
        acoes={
          <>
            <Segmentado<'ativas' | 'todas'> rotulo="Mostrar contas fixas" valor={ver} aoMudar={setVer} opcoes={[{ valor: 'ativas', rotulo: 'Ativas' }, { valor: 'todas', rotulo: 'Todas' }]} />
            {lancar && <Botao tamanho="p" icone={<Plus aria-hidden="true" />} onClick={() => setEditar('nova')}>Nova conta fixa</Botao>}
          </>
        }
      >
        <Dados consulta={consulta} recurso="As contas fixas" compacto esqueleto={<EsqueletoTabela linhas={3} />}>
          {(rs) =>
            rs.length ? (
              <ul class="lista">
                {rs.map((r) => (
                  <li key={r.id} class="lista__item" style={{ flexWrap: 'wrap' }}>
                    <span class="lista__texto" style={{ minWidth: '200px' }}>
                      <strong>{r.descricao}{!r.ativo && <span class="fraco"> · encerrada</span>}</strong>
                      <span>
                        {[r.fornecedor?.nome, nome(r.categoria_codigo), `todo dia ${r.dia_vencimento}`, r.intervalo_meses > 1 ? `a cada ${r.intervalo_meses} meses` : null].filter(Boolean).join(' · ')}
                      </span>
                      <span class="fraco">
                        Desde {dataCurta(r.inicio, { ano: true })}{r.fim ? ` até ${dataCurta(r.fim, { ano: true })}` : ''}
                        {r.proximas.length ? ` · próximas: ${r.proximas.slice(0, 2).map((p) => dataCurta(p.vencimento)).join(', ')}` : ''}
                      </span>
                    </span>
                    <span class="lista__fim" style={{ color: 'var(--texto)' }}>
                      <span class="num forte">{moeda(r.valor_previsto)}</span>
                      {r.valor_variavel && <Etiqueta tom="info">varia</Etiqueta>}
                      {lancar && r.ativo && (
                        <>
                          <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Alterar ${r.descricao}`} icone={<Pencil aria-hidden="true" />} onClick={() => setEditar(r)} />
                          {!r.fim && <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Encerrar ${r.descricao}`} icone={<CalendarX aria-hidden="true" />} onClick={() => setEncerrar(r)} />}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio compacto icone={<Repeat aria-hidden="true" />} titulo={ver === 'ativas' ? 'Nenhuma conta fixa ativa' : 'Nenhuma conta fixa'}>Aluguel, internet, folha: cadastre uma vez e a conta de cada mês aparece em Contas a pagar.</Vazio>
            )
          }
        </Dados>
        <div class="cartao__rodape">
          Valor da conta do mês diferente do previsto (energia, vale-transporte)? Em Contas a pagar, pague pelo botão <strong>Pagar</strong> informando o valor real — a conta fixa não muda.
        </div>
      </Cartao>
      <EditarRecorrencia alvo={editar} aoFechar={() => setEditar(null)} />
      <EncerrarRecorrencia alvo={encerrar} aoFechar={() => setEncerrar(null)} />
    </>
  );
}

function EditarRecorrencia({ alvo, aoFechar }: { alvo: Recorrencia | 'nova' | null; aoFechar: () => void }) {
  const cats = useCategorias();
  const r = alvo && alvo !== 'nova' ? alvo : null;
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [valor, setValor] = useState('');
  const [variavel, setVariavel] = useState(false);
  const [dia, setDia] = useState(10);
  const [intervalo, setIntervalo] = useState(1);
  const [aPartir, setAPartir] = useState(hojeISO().slice(0, 7));
  const [fim, setFim] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (!alvo) return;
    setDescricao(r?.descricao ?? '');
    setCategoria(r?.categoria_codigo ?? '');
    setValor(r ? brl(r.valor_previsto) : '');
    setVariavel(r?.valor_variavel ?? false);
    setDia(r?.dia_vencimento ?? 10);
    setIntervalo(r?.intervalo_meses ?? 1);
    setAPartir((r?.proximas[0]?.competencia ?? hojeISO()).slice(0, 7));
    setFim('');
    setFornecedor('');
    setErro(null);
  }, [alvo]);

  async function salvar(e: Event) {
    e.preventDefault();
    const v = paraDecimal(valor);
    if (!descricao.trim() || !v || Number(v) <= 0 || !(dia >= 1 && dia <= 31) || (!r && !categoria)) return setErro('Preencha descrição, categoria, valor previsto e dia de vencimento (1 a 31).');
    if (!r && !(intervalo >= 1 && intervalo <= 12)) return setErro('O intervalo vai de 1 a 12 meses.');
    if (!r && fim && fim < `${aPartir}-01`) return setErro('O fim não pode ser antes do início.');
    setOcupado(true);
    setErro(null);
    try {
      if (r) {
        await financeiro.alterarRecorrencia(r.id, { versao: r.versao, aplicar_a_partir_de: `${aPartir}-01`, descricao: descricao.trim(), valor_previsto: v, dia_vencimento: dia, valor_variavel: variavel });
        avisar(`Conta fixa alterada a partir de ${mesAno(`${aPartir}-01`).toLowerCase()}.`, 'ok');
      } else {
        await financeiro.criarRecorrencia({
          descricao: descricao.trim(), categoria, valor_previsto: v, valor_variavel: variavel, dia_vencimento: dia, intervalo_meses: intervalo,
          inicio: `${aPartir}-01`, fim: fim || null, fornecedor: fornecedor.trim() ? { nome: fornecedor.trim() } : null,
        });
        avisar('Conta fixa cadastrada.', 'ok');
      }
      atualizarFinanceiro();
      aoFechar();
    } catch (err) {
      if (err instanceof ErroApi && err.tipo === 'conflito') atualizarFinanceiro();
      setErro(err instanceof ErroApi ? err.message : 'Não foi possível salvar.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Gaveta aberta={!!alvo} aoFechar={aoFechar} titulo={r ? 'Alterar conta fixa' : 'Nova conta fixa'} subtitulo={r?.descricao}
      rodape={<><Botao onClick={aoFechar} disabled={ocupado}>Cancelar</Botao><Botao variante="primario" type="submit" form="form-recorrencia" carregando={ocupado}>Salvar</Botao></>}>
      <form id="form-recorrencia" class="pilha" onSubmit={salvar} noValidate>
        {r && <Aviso tom="info" icone={<Info aria-hidden="true" />}>A mudança vale a partir do mês escolhido. Contas já pagas não mudam.</Aviso>}
        {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
        <Campo rotulo="Descrição">{(id) => <input id={id} class="entrada" maxLength={300} placeholder="Ex.: Aluguel da loja" value={descricao} onInput={(e) => setDescricao(e.currentTarget.value)} data-autofoco />}</Campo>
        {!r && (
          <Campo rotulo="Categoria">
            {(id) => (
              <select id={id} class="selecao" value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
                <option value="">Escolha…</option>
                <OpcoesCategoria cats={cats.dados ?? []} />
              </select>
            )}
          </Campo>
        )}
        <div class="grade-campos">
          <Campo rotulo="Valor previsto">{(id, d) => <EntradaMoeda id={id} descr={d} valor={valor} aoMudar={setValor} />}</Campo>
          <Campo rotulo="Dia do vencimento">{(id) => <input id={id} type="number" min={1} max={31} class="entrada num" value={dia} onInput={(e) => setDia(Number(e.currentTarget.value))} />}</Campo>
          <Campo rotulo={r ? 'Vale a partir de' : 'Primeiro mês'}>{(id) => <input id={id} type="month" class="entrada" value={aPartir} onChange={(e) => setAPartir(e.currentTarget.value)} />}</Campo>
          {!r && <Campo rotulo="A cada quantos meses">{(id) => <input id={id} type="number" min={1} max={12} class="entrada num" value={intervalo} onInput={(e) => setIntervalo(Number(e.currentTarget.value))} />}</Campo>}
          {!r && <Campo rotulo="Fim" opcional>{(id) => <input id={id} type="date" class="entrada" value={fim} onChange={(e) => setFim(e.currentTarget.value)} />}</Campo>}
          {!r && <Campo rotulo="Fornecedor" opcional>{(id) => <input id={id} class="entrada" maxLength={160} autocomplete="off" value={fornecedor} onInput={(e) => setFornecedor(e.currentTarget.value)} />}</Campo>}
        </div>
        <label class="marcar">
          <input type="checkbox" checked={variavel} onChange={(e) => setVariavel(e.currentTarget.checked)} />
          <span>O valor muda todo mês <span class="fraco">(energia, água, folha, vale-transporte): a conta do mês nasce “a confirmar” e o valor real é informado ao pagar.</span></span>
        </label>
      </form>
    </Gaveta>
  );
}

function EncerrarRecorrencia({ alvo, aoFechar }: { alvo: Recorrencia | null; aoFechar: () => void }) {
  const [quando, setQuando] = useState(hojeISO());
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (!alvo) return;
    setQuando(hojeISO());
    setErro(null);
  }, [alvo]);

  async function salvar(e: Event) {
    e.preventDefault();
    if (!alvo || !quando) return setErro('Informe a data.');
    setOcupado(true);
    setErro(null);
    try {
      await financeiro.alterarRecorrencia(alvo.id, { versao: alvo.versao, encerrar_em: quando });
      atualizarFinanceiro();
      avisar('Conta fixa encerrada.', 'ok');
      aoFechar();
    } catch (err) {
      if (err instanceof ErroApi && err.tipo === 'conflito') atualizarFinanceiro();
      setErro(err instanceof ErroApi ? err.message : 'Não foi possível encerrar.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Gaveta aberta={!!alvo} aoFechar={aoFechar} titulo="Encerrar conta fixa" subtitulo={alvo?.descricao}
      rodape={<><Botao onClick={aoFechar} disabled={ocupado}>Voltar</Botao><Botao variante="perigo" type="submit" form="form-encerrar-recorrencia" carregando={ocupado} icone={<CalendarX aria-hidden="true" />}>Encerrar</Botao></>}>
      <form id="form-encerrar-recorrencia" class="pilha" onSubmit={salvar} noValidate>
        <p>Depois desta data, nenhuma conta nova é gerada. As já geradas continuam em Contas a pagar.</p>
        {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
        <Campo rotulo="Encerrar em">{(id) => <input id={id} type="date" class="entrada" value={quando} onChange={(e) => setQuando(e.currentTarget.value)} data-autofoco />}</Campo>
      </form>
    </Gaveta>
  );
}

// Taxas do cartão e do Pix -------------------------------------------------------------------------------------------

const MEIOS: MeioPdv[] = ['credito', 'debito', 'pix', 'outro'];

function Taxas({ lancar }: { lancar: boolean }) {
  const consulta = useConsulta('financeiro/taxas', () => financeiro.taxas());
  const [nova, setNova] = useState(false);
  const hoje = hojeISO();
  return (
    <>
      <Cartao
        titulo={<span class="linha"><Percent size={16} aria-hidden="true" /> Taxas do cartão e do Pix</span>}
        descricao="Do contrato da adquirente (Getnet). Sem elas, o resultado sai “estimado, sem taxas”."
        justo
        acoes={lancar && <Botao tamanho="p" icone={<Plus aria-hidden="true" />} onClick={() => setNova(true)}>Registrar taxa</Botao>}
      >
        <Dados consulta={consulta} recurso="As taxas" compacto esqueleto={<EsqueletoTabela linhas={4} />}>
          {(ts: TaxaPagamento[]) => {
            if (!ts.length) return <Vazio compacto icone={<Percent aria-hidden="true" />} titulo="Nenhuma taxa registrada">A Eyemobile não informa a taxa cobrada: registre as do contrato para o resultado do mês contar com elas.</Vazio>;
            // Em vigor = a vigência mais recente que já começou (a mesma regra do backend ao estimar).
            const emVigor = new Set(MEIOS.map((m) => ts.filter((t) => t.meio === m && t.vigente_de <= hoje).sort((a, b) => b.vigente_de.localeCompare(a.vigente_de))[0]?.id).filter((x) => x !== undefined));
            const ordenadas = [...ts].sort((a, b) => MEIOS.indexOf(a.meio) - MEIOS.indexOf(b.meio) || b.vigente_de.localeCompare(a.vigente_de));
            return (
              <div class="tabela-rolagem">
                <table class="tabela" aria-label="Taxas por meio de pagamento">
                  <thead><tr><th>Meio</th><th class="num">Taxa</th><th class="num" data-prioridade="media">Prazo</th><th>Vigente desde</th></tr></thead>
                  <tbody>
                    {ordenadas.map((t) => (
                      <tr key={t.id} class={emVigor.has(t.id) ? undefined : 'fin-apagada'}>
                        <td>{MEIO[t.meio] ?? t.meio}</td>
                        <td class="num forte">{pct(t.taxa_percentual, { casas: 3 })}</td>
                        <td class="num" data-prioridade="media">{t.prazo_dias ? `${inteiro(t.prazo_dias)} dias` : 'no dia'}</td>
                        <td>
                          <span class="linha" style={{ gap: '6px' }}>
                            {dataCurta(t.vigente_de, { ano: true })}
                            {emVigor.has(t.id) ? <Situacao tom="ok">Em vigor</Situacao> : t.vigente_de > hoje ? <Situacao tom="info">Futura</Situacao> : <span class="fraco">anterior</span>}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }}
        </Dados>
        <div class="cartao__rodape">Cada registro é uma nova vigência: as taxas antigas continuam valendo para os meses anteriores. Mesma data e mesmo meio substituem o registro.</div>
      </Cartao>
      <NovaTaxa aberta={nova} aoFechar={() => setNova(false)} />
    </>
  );
}

/** "3,15" → "3.15" (até 3 casas, como o banco guarda); null se inválido. */
function percentual(texto: string): string | null {
  const t = texto.trim().replace('%', '').replace(',', '.');
  return /^\d{1,2}(\.\d{1,3})?$/.test(t) ? t : null;
}

function NovaTaxa({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const [meio, setMeio] = useState<MeioPdv>('credito');
  const [taxa, setTaxa] = useState('');
  const [prazo, setPrazo] = useState(0);
  const [vigente, setVigente] = useState(hojeISO());
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (!aberta) return;
    setMeio('credito');
    setTaxa('');
    setPrazo(0);
    setVigente(hojeISO());
    setErro(null);
  }, [aberta]);

  async function salvar(e: Event) {
    e.preventDefault();
    const t = percentual(taxa);
    if (t === null || Number(t) >= 30) return setErro('Informe a taxa em %, de 0 a 29,999 (ex.: 3,15).');
    if (!(prazo >= 0 && prazo <= 400)) return setErro('O prazo vai de 0 a 400 dias.');
    if (!vigente) return setErro('Informe desde quando vale.');
    setOcupado(true);
    setErro(null);
    try {
      await financeiro.registrarTaxa({ meio, taxa_percentual: t, prazo_dias: prazo, vigente_de: vigente });
      atualizarFinanceiro();
      avisar('Taxa registrada.', 'ok');
      aoFechar();
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Não foi possível registrar.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Gaveta aberta={aberta} aoFechar={aoFechar} titulo="Registrar taxa" subtitulo="Nova vigência"
      rodape={<><Botao onClick={aoFechar} disabled={ocupado}>Cancelar</Botao><Botao variante="primario" type="submit" form="form-taxa" carregando={ocupado} icone={<Check aria-hidden="true" />}>Registrar</Botao></>}>
      <form id="form-taxa" class="pilha" onSubmit={salvar} noValidate>
        <Aviso tom="info" icone={<Info aria-hidden="true" />}>Nova vigência: as taxas antigas continuam valendo para os meses anteriores. Use as taxas do contrato da adquirente.</Aviso>
        {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
        <div class="grade-campos">
          <Campo rotulo="Meio">
            {(id) => (
              <select id={id} class="selecao" value={meio} onChange={(e) => setMeio(e.currentTarget.value as MeioPdv)}>
                {MEIOS.map((m) => <option key={m} value={m}>{m === 'outro' ? 'Outro' : MEIO[m]}</option>)}
              </select>
            )}
          </Campo>
          <Campo rotulo="Taxa (%)">{(id) => <input id={id} class="entrada num" inputMode="decimal" autocomplete="off" placeholder="ex.: 3,15" value={taxa} onInput={(e) => setTaxa(e.currentTarget.value.replace(/[^\d,.%]/g, ''))} data-autofoco />}</Campo>
          <Campo rotulo="Prazo de recebimento (dias)">{(id) => <input id={id} type="number" min={0} max={400} class="entrada num" value={prazo} onInput={(e) => setPrazo(Number(e.currentTarget.value))} />}</Campo>
          <Campo rotulo="Vigente desde">{(id) => <input id={id} type="date" class="entrada" value={vigente} onChange={(e) => setVigente(e.currentTarget.value)} />}</Campo>
        </div>
      </form>
    </Gaveta>
  );
}
