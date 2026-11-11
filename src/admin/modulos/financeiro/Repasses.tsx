// Repasses (0032): quanto a conta Conjunto (Master) ainda precisa repassar ao Âmbar e à Roll. Só dois cartões; o
// cálculo (receitas da operação recebidas pelo Conjunto − despesas dela pagas pelo Conjunto − parte nas despesas do
// Conjunto pela regra de rateio + ajustes − repasses feitos) vem pronto de GET /admin/financeiro/repasses e abre em
// "Ver cálculo". Sem operação nas receitas ou sem regra de rateio, o valor fica PENDENTE (nada é inventado).
// Repasse feito e ajuste são movimentos (POST /repasses/movimentos), nunca receita ou despesa nova.
import { useEffect, useState } from 'preact/hooks';
import { Plus, FileText } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta, hojeISO, paraDecimal, plural } from '../../lib/formato';
import { Dialogo, Gaveta } from '../../ui/camadas';
import { Botao, Cartao, Campo, Aviso } from '../../ui/base';
import { EntradaMoeda } from '../../ui/entradas';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { RepassesConjunto as DadosRepasses, ItemRepasse, PendenciaRepasse } from '../../lib/tipos/financeiro';
import { atualizarFinanceiro, avisar, avisarFalha } from './comum';
import { Documento } from './Documento';

type Lado = 'ambar' | 'roll';
const NOME: Record<Lado, string> = { ambar: 'Âmbar', roll: 'Roll' };
const PENDENCIA: Record<PendenciaRepasse, string> = {
  vendas_pdv_sem_operacao: 'Vendas do PDV sem operação definida',
  receitas_sem_operacao: 'Receitas sem operação',
  conjunto_sem_rateio: 'Despesas do Conjunto sem regra de rateio',
  sem_pagador: 'Pagamentos sem pagador',
};
const TIPO: Record<ItemRepasse['tipo'], string> = { venda_pdv: 'Venda PDV', receita: 'Receita', despesa: 'Despesa', repasse: 'Repasse', ajuste: 'Ajuste' };

export function Repasses({ configurar }: { configurar: boolean }) {
  const dados = useConsulta('financeiro/repasses-conjunto', () => financeiro.repassesConjunto());
  const [calculo, setCalculo] = useState<Lado | null>(null);
  const [registrar, setRegistrar] = useState<Lado | null>(null);
  return (
    <Dados consulta={dados} recurso="Os repasses" esqueleto={<Cartao><Esqueleto linhas={3} /></Cartao>}>
      {(r) => (
        <>
          <div class="fin-repasses">
            {(['ambar', 'roll'] as Lado[]).map((l) => (
              <Cartao key={l} titulo={`Conjunto → ${NOME[l]}`}>
                {r[l].pendente !== null ? (
                  <p class="fin-saldo"><strong class="num">{moeda(r[l].pendente)}</strong> <span class="fraco">pendente de repasse</span></p>
                ) : (
                  <p class="fin-saldo"><strong class="fin-falta">Pendente de identificação</strong></p>
                )}
                <div class="linha" style={{ gap: '8px' }}>
                  <Botao tamanho="p" onClick={() => setCalculo(l)}>Ver cálculo</Botao>
                  <Botao tamanho="p" variante="fantasma" icone={<Plus aria-hidden="true" />} onClick={() => setRegistrar(l)}>Registrar repasse</Botao>
                </div>
              </Cartao>
            ))}
          </div>
          <Calculo r={r} lado={calculo} aoFechar={() => setCalculo(null)} configurar={configurar} />
          <NovoRepasse lado={registrar} aoFechar={() => setRegistrar(null)} />
        </>
      )}
    </Dados>
  );
}

function Calculo({ r, lado, aoFechar, configurar }: { r: DadosRepasses; lado: Lado | null; aoFechar: () => void; configurar: boolean }) {
  const [doc, setDoc] = useState<string | null>(null);
  useEffect(() => setDoc(null), [lado]);
  if (!lado) return null;
  const x = r[lado];
  const pend = (Object.keys(PENDENCIA) as PendenciaRepasse[]).filter((k) => r.pendencias[k].quantidade > 0);
  const colunas: Coluna<ItemRepasse>[] = [
    { id: 'data', titulo: 'Data', largura: '86px', ordenar: (i) => i.data, celula: (i) => <span class="num">{dataCurta(i.data)}</span> },
    { id: 'descricao', titulo: 'Lançamento', ordenar: (i) => i.descricao, celula: (i) => <><span class="principal-celula">{i.descricao}</span><span class="sub">{TIPO[i.tipo]}{i.efeito !== i.valor && i.tipo === 'despesa' ? ` · ${moeda(i.valor)} no total` : ''}</span></> },
    { id: 'efeito', titulo: 'Valor', numero: true, ordenar: (i) => Number(i.efeito), celula: (i) => <span class="num forte">{Number(i.efeito) > 0 ? '+ ' : '− '}{moeda(String(Math.abs(Number(i.efeito))))}</span> },
    { id: 'doc', titulo: '', celula: (i) => (i.arquivo_id ? <Botao tamanho="p" variante="fantasma" so_icone aria-label="Ver comprovante" icone={<FileText aria-hidden="true" />} onClick={() => setDoc(i.arquivo_id)} /> : null) },
  ];
  return (
    <Gaveta aberta largura="larga" aoFechar={aoFechar} titulo={`Cálculo · Conjunto → ${NOME[lado]}`}>
      <div class="pilha">
        <dl class="definicoes">
          <dt>Receitas recebidas pelo Conjunto</dt><dd class="num">{moeda(x.receitas)}</dd>
          <dt>Despesas pagas pelo Conjunto</dt><dd class="num">− {moeda(x.despesas)}</dd>
          {Number(x.ajustes) !== 0 && <><dt>Ajustes autorizados</dt><dd class="num">{moeda(x.ajustes)}</dd></>}
          <dt>Repasses já feitos</dt><dd class="num">− {moeda(x.repassado)}</dd>
          <dt><strong>{r.completo ? 'Pendente de repasse' : 'Calculado até agora'}</strong></dt><dd class="num forte">{moeda(x.calculado)}</dd>
        </dl>
        {pend.length > 0 && (
          <Aviso tom="atencao">
            Fora da conta até identificar: {pend.map((k) => `${PENDENCIA[k]} (${plural(r.pendencias[k].quantidade, 'item', 'itens')}, ${moeda(r.pendencias[k].valor)})`).join(' · ')}.
          </Aviso>
        )}
        {configurar && <Regras r={r} />}
        <Tabela rotulo={`Lançamentos do repasse ao ${NOME[lado]}`} colunas={colunas} linhas={x.itens} chave={(i) => `${i.tipo}:${i.id ?? i.data}:${i.efeito}`} ordemInicial={{ coluna: 'data', desc: true }}
          vazio={<Vazio compacto titulo="Nenhum lançamento">Receitas da operação e despesas pagas pelo Conjunto aparecem aqui.</Vazio>} />
        {doc && <Documento arquivoId={doc} altura={360} />}
      </div>
    </Gaveta>
  );
}

/** Regras que tiram pendências: de qual operação são as vendas do PDV e o rateio das despesas do Conjunto. */
function Regras({ r }: { r: DadosRepasses }) {
  const config = useConsulta('financeiro/configuracao', () => financeiro.configuracao());
  const [pdv, setPdv] = useState(r.regras.operacao_vendas_pdv ?? '');
  const [rateio, setRateio] = useState(r.regras.rateio_conjunto_ambar === null ? '' : String(Number(r.regras.rateio_conjunto_ambar)));
  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    if (!config.dados) return;
    const n = rateio.trim() === '' ? null : Number(rateio.replace(',', '.'));
    if (n !== null && (Number.isNaN(n) || n < 0 || n > 100)) return avisar('Rateio entre 0 e 100%.', 'erro');
    setSalvando(true);
    try {
      await financeiro.alterarRegrasRepasse(config.dados.versao, { operacao_vendas_pdv: (pdv || null) as Lado | null, rateio_conjunto_ambar: n === null ? null : n.toFixed(2) });
      atualizarFinanceiro();
      avisar('Regras salvas.', 'ok');
    } catch (e) {
      avisarFalha(e);
    } finally {
      setSalvando(false);
    }
  }
  return (
    <details class="fin-detalhes">
      <summary>Regras</summary>
      <div class="grade-campos">
        <Campo rotulo="Vendas do PDV são de">
          {(id) => (
            <select id={id} class="selecao" value={pdv} onChange={(e) => setPdv(e.currentTarget.value)}>
              <option value="">Não definido</option><option value="ambar">Âmbar</option><option value="roll">Roll</option>
            </select>
          )}
        </Campo>
        <Campo rotulo="Despesas do Conjunto: % do Âmbar" ajuda="A Roll fica com o resto. Vazio = sem regra.">
          {(id, d) => <input id={id} aria-describedby={d} class="entrada" inputMode="decimal" value={rateio} onInput={(e) => setRateio(e.currentTarget.value)} />}
        </Campo>
      </div>
      <Botao tamanho="p" variante="primario" carregando={salvando} onClick={salvar}>Salvar regras</Botao>
    </details>
  );
}

function NovoRepasse({ lado, aoFechar }: { lado: Lado | null; aoFechar: () => void }) {
  const [ajuste, setAjuste] = useState(false);
  const [valor, setValor] = useState('');
  const [data, setData] = useState(hojeISO());
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (lado) { setAjuste(false); setValor(''); setDescricao(''); setErro(null); setData(hojeISO()); }
  }, [lado]);
  if (!lado) return null;
  const l: Lado = lado;
  async function salvar() {
    const v = paraDecimal(valor.replace(/^-/, ''));
    if (!v || Number(v) <= 0) return setErro('Informe o valor.');
    if (descricao.trim().length < 2) return setErro('Descreva o repasse.');
    setSalvando(true);
    setErro(null);
    try {
      const negativo = ajuste && valor.trim().startsWith('-');
      await financeiro.registrarRepasse({ sentido: ajuste ? `ajuste_${l}` as const : `conjunto_para_${l}` as const, valor: negativo ? `-${v}` : v, data, descricao: descricao.trim() });
      atualizarFinanceiro();
      avisar(ajuste ? 'Ajuste registrado.' : 'Repasse registrado.', 'ok');
      aoFechar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível registrar.');
    } finally {
      setSalvando(false);
    }
  }
  return (
    <Dialogo aberto aoFechar={aoFechar} titulo={`Conjunto → ${NOME[lado]}`} acoes={<><Botao onClick={aoFechar} disabled={salvando}>Cancelar</Botao><Botao variante="primario" carregando={salvando} onClick={salvar}>Registrar</Botao></>}>
      <div class="pilha">
        <Campo rotulo="Tipo">
          {(id) => (
            <select id={id} class="selecao" value={ajuste ? 'ajuste' : 'repasse'} onChange={(e) => setAjuste(e.currentTarget.value === 'ajuste')}>
              <option value="repasse">Repasse feito</option><option value="ajuste">Ajuste autorizado</option>
            </select>
          )}
        </Campo>
        <div class="grade-campos">
          <Campo rotulo="Valor" ajuda={ajuste ? 'Use “-” para reduzir o repasse.' : undefined}>
            {(id, d) => (ajuste ? <input id={id} aria-describedby={d} class="entrada" inputMode="decimal" value={valor} onInput={(e) => setValor(e.currentTarget.value)} /> : <EntradaMoeda id={id} descr={d} valor={valor} aoMudar={setValor} />)}
          </Campo>
          <Campo rotulo="Data">{(id) => <input id={id} type="date" class="entrada" max={hojeISO()} value={data} onChange={(e) => setData(e.currentTarget.value)} />}</Campo>
        </div>
        <Campo rotulo="Descrição">{(id) => <input id={id} class="entrada" maxLength={300} value={descricao} onInput={(e) => setDescricao(e.currentTarget.value)} />}</Campo>
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
      </div>
    </Dialogo>
  );
}
