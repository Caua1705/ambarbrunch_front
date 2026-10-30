// Importar extrato (OFX ou CSV), assistido: conta → arquivo → [colunas do CSV] → período coberto → resultado.
// O extrato só CONFERE o Financeiro: nada vira receita ou despesa sozinho; o resultado aponta as diferenças.
// Rotas: /admin/financeiro/contas-bancarias, /extratos, /extratos/{id}/mapeamento, /extratos/{id}/cobertura.
import { useEffect, useState } from 'preact/hooks';
import { Check, Info, ArrowRight, Landmark, AlertTriangle, CircleCheck } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta, inteiro } from '../../lib/formato';
import { Gaveta } from '../../ui/camadas';
import { Botao, Campo, Aviso } from '../../ui/base';
import { EnvioArquivo } from '../../ui/entradas';
import { Esqueleto } from '../../ui/estados';
import type { ContaBancaria, Importacao, MapeamentoCsv } from '../../lib/tipos/financeiro';
import { atualizarFinanceiro, avisar } from './comum';

type Passo = 'conta' | 'arquivo' | 'colunas' | 'periodo' | 'resultado';
const PASSOS: { id: Passo; rotulo: string }[] = [
  { id: 'conta', rotulo: 'Conta' },
  { id: 'arquivo', rotulo: 'Arquivo' },
  { id: 'colunas', rotulo: 'Colunas' },
  { id: 'periodo', rotulo: 'Período' },
  { id: 'resultado', rotulo: 'Resultado' },
];
type Papel = 'ignorar' | 'data' | 'descricao' | 'valor' | 'entrada' | 'saida' | 'tipo' | 'identificador' | 'saldo';
const PAPEIS: { valor: Papel; rotulo: string }[] = [
  { valor: 'ignorar', rotulo: 'Ignorar' },
  { valor: 'data', rotulo: 'Data' },
  { valor: 'descricao', rotulo: 'Descrição' },
  { valor: 'valor', rotulo: 'Valor (com sinal)' },
  { valor: 'entrada', rotulo: 'Entrada (crédito)' },
  { valor: 'saida', rotulo: 'Saída (débito)' },
  { valor: 'tipo', rotulo: 'Tipo (C/D)' },
  { valor: 'identificador', rotulo: 'Identificador' },
  { valor: 'saldo', rotulo: 'Saldo (ignorado)' },
];
const AVISO_CSV: Record<string, string> = {
  sem_cabecalho: 'O arquivo não tem linha de cabeçalho: confira as colunas pela amostra.',
  formato_data_ambiguo: 'Todas as datas têm dia até 12: confirme se é dia/mês ou mês/dia.',
  formato_data_desconhecido: 'Não reconhecemos o formato das datas: escolha abaixo.',
  decimal_presumido: 'O separador de centavos foi presumido: confira.',
  decimal_misturado: 'Há valores com vírgula e com ponto: confira o separador de centavos.',
  sem_sinal: 'Só há valores positivos e nenhuma coluna de tipo: indique a coluna de tipo (C/D) ou de entrada/saída.',
};

export function ImportarExtrato({ aberta, aoFechar, aoVerDiferencas }: { aberta: boolean; aoFechar: () => void; aoVerDiferencas: (importacaoId: string) => void }) {
  const contas = useConsulta(aberta ? 'financeiro/contas-bancarias' : null, () => financeiro.contasBancarias());
  const [passo, setPasso] = useState<Passo>('conta');
  const [contaId, setContaId] = useState('');
  const [nova, setNova] = useState(false);
  const [imp, setImp] = useState<Importacao | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberta) return;
    setPasso('conta');
    setImp(null);
    setErro(null);
    setNova(false);
  }, [aberta]);
  const ativas = (contas.dados ?? []).filter((c) => c.status === 'ativa');
  useEffect(() => {
    if (!contaId && ativas.length) setContaId(ativas[0].id);
    if (contas.dados && !ativas.length) setNova(true);
  }, [contas.dados]);

  const falhar = (e: unknown) => {
    const x = e instanceof ErroApi ? e : null;
    const MSG: Record<string, string> = {
      conta_divergente: 'Este OFX é de outra conta bancária. Escolha a conta certa.',
      extrato_cartao_nao_suportado: 'Extrato de cartão de crédito não é aceito aqui: use o extrato da conta corrente.',
      extrato_invalido: 'Não conseguimos ler o arquivo. Confira se é o OFX ou CSV exportado pelo banco.',
      csv_sem_colunas: 'Não encontramos data e valor nas colunas escolhidas.',
      csv_sem_movimentos: 'Com essas colunas, nenhuma movimentação foi lida.',
      tipo_de_arquivo_recusado: 'Envie o OFX ou o CSV do banco (PDF e imagem não são aceitos).',
      arquivo_grande_demais: 'O arquivo é grande demais (até 5 MB).',
      cobertura_menor_que_o_arquivo: 'O arquivo tem movimentações fora desse período. Amplie as datas.',
      conta_inativa: 'Esta conta está inativa.',
    };
    setErro((x?.codigo && MSG[x.codigo]) || x?.message || 'Não foi possível concluir.');
  };

  async function enviar(f: File) {
    if (!contaId) return;
    setOcupado(true);
    setErro(null);
    try {
      const r = await financeiro.importarExtrato(f, contaId);
      setImp(r);
      atualizarFinanceiro();
      setPasso(r.status === 'aguardando_mapeamento' ? 'colunas' : 'periodo');
    } catch (e) {
      falhar(e);
    } finally {
      setOcupado(false);
    }
  }

  const visiveis = PASSOS.filter((p) => p.id !== 'colunas' || imp?.formato !== 'ofx');
  const indice = visiveis.findIndex((p) => p.id === passo);

  return (
    <Gaveta aberta={aberta} aoFechar={aoFechar} largura="media" titulo="Importar extrato" subtitulo="OFX ou CSV exportado do banco">
      <ol class="passos" aria-label="Etapas">
        {visiveis.map((p, i) => (
          <li key={p.id} aria-current={p.id === passo ? 'step' : undefined} data-feito={i < indice || undefined}>
            <b>{i < indice ? <Check size={12} aria-hidden="true" /> : i + 1}</b>
            {p.rotulo}
          </li>
        ))}
      </ol>
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}

      {passo === 'conta' && (
        contas.carregando ? <Esqueleto linhas={3} /> : (
          <div class="pilha">
            {ativas.length > 0 && !nova && (
              <>
                <div role="radiogroup" aria-label="Conta bancária" class="pilha pilha--p">
                  {ativas.map((c) => (
                    <label key={c.id} class={`fin-candidata${contaId === c.id ? ' fin-candidata--sel' : ''}`}>
                      <input type="radio" name="conta-extrato" checked={contaId === c.id} onChange={() => setContaId(c.id)} />
                      <span class="pilha pilha--p">
                        <strong>{c.apelido}</strong>
                        <span class="fraco">{c.instituicao}{c.agencia ? ` · ag. ${c.agencia}` : ''}{c.conta ? ` · conta ${c.conta}` : ''}{c.reconhece_ofx ? ' · reconhece o OFX' : ''}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div class="linha linha--entre">
                  <Botao tamanho="p" variante="fantasma" onClick={() => setNova(true)}>Cadastrar outra conta</Botao>
                  <Botao variante="primario" disabled={!contaId} onClick={() => setPasso('arquivo')}>Continuar <ArrowRight aria-hidden="true" /></Botao>
                </div>
              </>
            )}
            {nova && <NovaConta aoCriar={(c) => { setContaId(c.id); setNova(false); setPasso('arquivo'); }} aoCancelar={ativas.length ? () => setNova(false) : undefined} />}
          </div>
        )
      )}

      {passo === 'arquivo' && (
        <div class="pilha">
          <p class="suave">Exporte do internet banking o extrato da conta <strong>{ativas.find((c) => c.id === contaId)?.apelido}</strong> em <strong>OFX</strong> (preferível) ou <strong>CSV</strong>. Mandar o mesmo arquivo de novo não duplica nada.</p>
          <EnvioArquivo aceitar=".ofx,.csv,.txt,application/x-ofx,text/csv" titulo={ocupado ? 'Lendo o extrato…' : 'Escolher arquivo do extrato'} detalhe="OFX ou CSV, até 5 MB" desativado={ocupado} aoEscolher={enviar} />
          <Botao tamanho="p" variante="fantasma" style={{ alignSelf: 'flex-start' }} onClick={() => setPasso('conta')}>Voltar</Botao>
        </div>
      )}

      {passo === 'colunas' && imp && <Colunas imp={imp} aoProcessar={(r) => { setImp(r); setPasso('periodo'); }} aoErro={falhar} />}

      {passo === 'periodo' && imp && <Periodo imp={imp} aoConfirmar={(r) => { setImp(r); setPasso('resultado'); }} aoErro={falhar} />}

      {passo === 'resultado' && imp && (
        <Resultado
          imp={imp}
          aoVer={() => { avisar('Extrato importado.', 'ok'); aoVerDiferencas(imp.id); }}
          aoFechar={aoFechar}
        />
      )}
    </Gaveta>
  );
}

function NovaConta({ aoCriar, aoCancelar }: { aoCriar: (c: ContaBancaria) => void; aoCancelar?: () => void }) {
  const [instituicao, setInstituicao] = useState('');
  const [apelido, setApelido] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const [escopo, setEscopo] = useState<ContaBancaria['escopo']>('operacional');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function criar(e: Event) {
    e.preventDefault();
    if (!instituicao.trim() || !apelido.trim()) return setErro('Informe o banco e um apelido.');
    setOcupado(true);
    setErro(null);
    try {
      const c = await financeiro.criarContaBancaria({ instituicao: instituicao.trim(), apelido: apelido.trim(), agencia: agencia.replace(/\D/g, '').slice(-4) || undefined, conta: conta.replace(/\D/g, '').slice(-4) || undefined, escopo });
      atualizarFinanceiro();
      aoCriar(c);
    } catch (err) {
      setErro(err instanceof ErroApi ? (err.codigo === 'apelido_repetido' ? 'Já existe uma conta com esse apelido.' : err.message) : 'Não foi possível cadastrar.');
    } finally {
      setOcupado(false);
    }
  }
  return (
    <form class="pilha" onSubmit={criar} noValidate>
      <Aviso tom="info" icone={<Landmark aria-hidden="true" />}>Guardamos só o banco, um apelido e os <strong>últimos 4 dígitos</strong> de agência e conta. Nunca senha, login ou token do banco.</Aviso>
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
      <div class="grade-campos">
        <Campo rotulo="Banco">{(id) => <input id={id} class="entrada" placeholder="Ex.: Itaú" value={instituicao} onInput={(e) => setInstituicao(e.currentTarget.value)} />}</Campo>
        <Campo rotulo="Apelido">{(id) => <input id={id} class="entrada" placeholder="Ex.: Itaú principal" value={apelido} onInput={(e) => setApelido(e.currentTarget.value)} />}</Campo>
        <Campo rotulo="Agência" opcional ajuda="Só os últimos 4 dígitos ficam guardados.">{(id, d) => <input id={id} class="entrada num" inputMode="numeric" aria-describedby={d} value={agencia} onInput={(e) => setAgencia(e.currentTarget.value)} />}</Campo>
        <Campo rotulo="Conta" opcional>{(id) => <input id={id} class="entrada num" inputMode="numeric" value={conta} onInput={(e) => setConta(e.currentTarget.value)} />}</Campo>
        <Campo rotulo="Uso da conta" class="inteiro">
          {(id) => (
            <select id={id} class="selecao" value={escopo} onChange={(e) => setEscopo(e.currentTarget.value as ContaBancaria['escopo'])}>
              <option value="operacional">Operação do Âmbar</option>
              <option value="reserva">Reserva</option>
              <option value="socio">De sócio</option>
              <option value="outra">Outra</option>
            </select>
          )}
        </Campo>
      </div>
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        {aoCancelar && <Botao onClick={aoCancelar}>Voltar</Botao>}
        <Botao variante="primario" type="submit" carregando={ocupado}>Cadastrar conta</Botao>
      </div>
    </form>
  );
}

function Colunas({ imp, aoProcessar, aoErro }: { imp: Importacao; aoProcessar: (r: Importacao) => void; aoErro: (e: unknown) => void }) {
  const rec = imp.reconhecimento;
  const base: MapeamentoCsv = imp.mapeamento ?? { separador: ';', codificacao: 'utf-8-sig', linha_cabecalho: 0, colunas: rec?.colunas ?? {}, formato_data: 'dd/mm/aaaa', decimal: ',' };
  const nCols = Math.max(rec?.cabecalho.length ?? 0, ...(rec?.amostra ?? []).map((l) => l.length));
  const inicial: Papel[] = Array.from({ length: nCols }, (_, i) => (Object.entries(base.colunas).find(([, v]) => v === i)?.[0] as Papel) ?? 'ignorar');
  const [papeis, setPapeis] = useState<Papel[]>(inicial);
  const [formato, setFormato] = useState(base.formato_data);
  const [decimal, setDecimal] = useState<',' | '.'>(base.decimal);
  const [modelo, setModelo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const tem = (p: Papel) => papeis.includes(p);
  const valido = tem('data') && (tem('valor') || tem('entrada') || tem('saida'));

  async function processar() {
    const colunas: MapeamentoCsv['colunas'] = {};
    papeis.forEach((p, i) => {
      if (p !== 'ignorar') colunas[p] = i;
    });
    setOcupado(true);
    try {
      const r = await financeiro.mapear(imp.id, { ...base, colunas, formato_data: formato, decimal }, modelo.trim() || undefined);
      atualizarFinanceiro();
      aoProcessar(r);
    } catch (e) {
      aoErro(e);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div class="pilha">
      <p class="suave">Confira o que cada coluna do CSV significa. A proposta veio do próprio arquivo.</p>
      {rec?.avisos.map((a) => <Aviso key={a} tom="atencao" icone={<AlertTriangle aria-hidden="true" />}>{AVISO_CSV[a] ?? a}</Aviso>)}
      <div class="tabela-rolagem fin-borda">
        <table class="tabela" aria-label="Amostra do CSV">
          <thead>
            <tr>
              {Array.from({ length: nCols }, (_, i) => (
                <th key={i} style={{ minWidth: '140px' }}>
                  <span class="sr">Coluna {i + 1}: {rec?.cabecalho[i]}</span>
                  <select class="selecao" style={{ minHeight: '32px' }} aria-label={`O que é a coluna ${rec?.cabecalho[i] ?? i + 1}`} value={papeis[i]} onChange={(e) => setPapeis(papeis.map((p, j) => (j === i ? (e.currentTarget.value as Papel) : p)))}>
                    {PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
                  </select>
                  <span style={{ display: 'block', marginTop: '4px' }}>{rec?.cabecalho[i] ?? `Coluna ${i + 1}`}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rec?.amostra ?? []).slice(0, 8).map((l, i) => (
              <tr key={i}>{Array.from({ length: nCols }, (_, j) => <td key={j} class="pequeno" style={{ whiteSpace: 'nowrap', opacity: papeis[j] === 'ignorar' ? 0.5 : 1 }}>{l[j]}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <div class="grade-campos">
        <Campo rotulo="Formato das datas">
          {(id) => (
            <select id={id} class="selecao" value={formato} onChange={(e) => setFormato(e.currentTarget.value)}>
              {['dd/mm/aaaa', 'dd/mm/aa', 'aaaa-mm-dd', 'dd-mm-aaaa', 'dd.mm.aaaa', 'mm/dd/aaaa', 'aaaammdd'].map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
        </Campo>
        <Campo rotulo="Centavos separados por">
          {(id) => (
            <select id={id} class="selecao" value={decimal} onChange={(e) => setDecimal(e.currentTarget.value as ',' | '.')}>
              <option value=",">Vírgula (1.234,56)</option>
              <option value=".">Ponto (1,234.56)</option>
            </select>
          )}
        </Campo>
        <Campo rotulo="Salvar como modelo" opcional class="inteiro" ajuda="Na próxima vez, um CSV com o mesmo layout é lido direto.">
          {(id, d) => <input id={id} class="entrada" aria-describedby={d} placeholder="Ex.: Itaú CSV" value={modelo} onInput={(e) => setModelo(e.currentTarget.value)} />}
        </Campo>
      </div>
      {!valido && <p class="campo__ajuda" style={{ color: 'var(--atencao)' }}>Indique pelo menos a coluna de data e a de valor (ou entrada/saída).</p>}
      <Botao variante="primario" style={{ alignSelf: 'flex-end' }} disabled={!valido} carregando={ocupado} onClick={processar}>Ler o extrato <ArrowRight aria-hidden="true" /></Botao>
    </div>
  );
}

function Periodo({ imp, aoConfirmar, aoErro }: { imp: Importacao; aoConfirmar: (r: Importacao) => void; aoErro: (e: unknown) => void }) {
  const declarado = imp.cobertura.origem === 'arquivo' || imp.cobertura.origem === 'confirmada';
  const [de, setDe] = useState(imp.cobertura.de ?? imp.periodo.de ?? '');
  const [ate, setAte] = useState(imp.cobertura.ate ?? imp.periodo.ate ?? '');
  const [ocupado, setOcupado] = useState(false);
  async function confirmar() {
    setOcupado(true);
    try {
      const r = await financeiro.cobertura(imp.id, de, ate);
      atualizarFinanceiro();
      aoConfirmar({ ...imp, ...r, resultado: r.resultado ?? imp.resultado });
    } catch (e) {
      aoErro(e);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div class="pilha">
      {imp.ja_existia && <Aviso tom="info" icone={<Info aria-hidden="true" />}>Este arquivo já tinha sido importado nesta conta. Nada foi duplicado.</Aviso>}
      <p class="suave">
        O arquivo tem movimentações de <strong>{dataCurta(imp.periodo.de, { ano: true })}</strong> a <strong>{dataCurta(imp.periodo.ate, { ano: true })}</strong>.
        {declarado ? ' O banco informou no arquivo o período completo que ele cobre:' : ' Diga qual período o arquivo cobre POR INTEIRO (do primeiro ao último dia exportado). Só assim o mês conta como conferido.'}
      </p>
      <div class="grade-campos">
        <Campo rotulo="Cobre de">{(id) => <input id={id} type="date" class="entrada" value={de} disabled={imp.cobertura.origem === 'arquivo'} onChange={(e) => setDe(e.currentTarget.value)} />}</Campo>
        <Campo rotulo="até">{(id) => <input id={id} type="date" class="entrada" value={ate} disabled={imp.cobertura.origem === 'arquivo'} onChange={(e) => setAte(e.currentTarget.value)} />}</Campo>
      </div>
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        {imp.cobertura.origem === 'arquivo' ? (
          <Botao variante="primario" onClick={() => aoConfirmar(imp)}>Continuar <ArrowRight aria-hidden="true" /></Botao>
        ) : (
          <>
            <Botao onClick={() => aoConfirmar(imp)}>Pular (o mês fica incompleto)</Botao>
            <Botao variante="primario" disabled={!de || !ate || de > ate} carregando={ocupado} onClick={confirmar}>Confirmar período</Botao>
          </>
        )}
      </div>
    </div>
  );
}

function Resultado({ imp, aoVer, aoFechar }: { imp: Importacao; aoVer: () => void; aoFechar: () => void }) {
  const r = imp.resultado;
  const c = imp.contagem;
  // Importação sem movimentações: o backend manda só {analisadas: 0, ...} (campos ausentes contam como zero).
  const n = (v: number | undefined) => v ?? 0;
  const pendentes = r ? n(r.correspondencias_fortes) + n(r.possiveis) + n(r.sem_registro) + n(r.conflitos) : 0;
  return (
    <div class="pilha">
      <Aviso tom="ok" icone={<CircleCheck aria-hidden="true" />}>
        <strong>{inteiro(c.novos)} movimentações novas</strong> lidas{c.ja_existentes ? `, ${inteiro(c.ja_existentes)} já conhecidas` : ''}{c.ignoradas ? `, ${inteiro(c.ignoradas)} linhas ignoradas (saldo, rodapé)` : ''}.
        {' '}Nada foi lançado no Financeiro: as movimentações só conferem o que já existe.
      </Aviso>
      {r && r.analisadas > 0 ? (
        <>
          <div class="fin-valores">
            <div><span>Entradas</span><strong class="num">{moeda(r.creditos.valor)}</strong><small>{inteiro(r.creditos.quantidade)} · {moeda(r.creditos.conciliado)} conciliado</small></div>
            <div><span>Saídas</span><strong class="num">{moeda(r.debitos.valor)}</strong><small>{inteiro(r.debitos.quantidade)} · {moeda(r.debitos.conciliado)} conciliado</small></div>
          </div>
          <ul class="lista fin-borda">
            {[
              { n: n(r.ja_conciliadas), t: 'Já conciliadas', d: 'Batem com o que já está no Financeiro.' },
              { n: n(r.correspondencias_fortes), t: 'Sugestão forte', d: 'Uma correspondência com prova (valor exato e identificador ou beneficiário). Falta só a sua confirmação.' },
              { n: n(r.possiveis), t: 'Possíveis correspondências', d: 'Há candidatos, mas sem prova suficiente.' },
              { n: n(r.sem_registro), t: 'Sem registro no Financeiro', d: 'Pode ser despesa não lançada, repasse de cartão, transferência entre contas, estorno ou aporte.' },
              { n: n(r.conflitos) + n(r.duplicadas), t: 'Possível duplicidade', d: 'Pode ser a mesma operação importada duas vezes: decida antes.' },
            ].filter((x) => x.n > 0).map((x) => (
              <li key={x.t} class="lista__item"><span class="lista__texto"><strong>{inteiro(x.n)} · {x.t}</strong><span>{x.d}</span></span></li>
            ))}
          </ul>
        </>
      ) : (
        <p class="fraco">Resumo do processamento indisponível.</p>
      )}
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao onClick={aoFechar}>Fechar</Botao>
        {pendentes > 0 && <Botao variante="primario" onClick={aoVer}>Conferir {inteiro(pendentes)} diferenças <ArrowRight aria-hidden="true" /></Botao>}
      </div>
    </div>
  );
}
