// Outra receita (fora do PDV): locação do espaço, evento faturado à parte, serviço. Venda de balcão entra sozinha pela
// Eyemobile. Também abre uma receita lançada para CORRIGIR (com motivo e versão) ou marcar como recebida.
// POST /admin/financeiro/outras-receitas com Idempotency-Key (reenviar o mesmo formulário não lança em dobro);
// PATCH /admin/financeiro/outras-receitas/{id}. Valor igual a uma venda do PDV no mesmo dia, ou a uma receita já
// lançada, volta 409 (possivel_venda_pdv / receita_parecida): a tela mostra o aviso e só grava se a pessoa confirmar
// que é outro dinheiro. Empréstimo, aporte e transferência ficam registrados, mas fora do faturamento.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Check, Info, AlertTriangle } from 'lucide-preact';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi, novaChave } from '../../lib/api/cliente';
import { useConsulta } from '../../lib/consulta';
import { hojeISO, paraDecimal, moeda } from '../../lib/formato';
import type { OutraReceitaSaida } from '../../lib/tipos/financeiro';
import { Gaveta } from '../../ui/camadas';
import { Botao, Campo, Aviso, Segmentado } from '../../ui/base';
import { EntradaMoeda } from '../../ui/entradas';
import { atualizarFinanceiro, avisar } from './comum';

const DUPLICIDADE = ['possivel_venda_pdv', 'receita_parecida'];

export function NovaReceita({ aberta, aoFechar, editar }: { aberta: boolean; aoFechar: () => void; editar?: OutraReceitaSaida | null }) {
  const opcoes = useConsulta(aberta ? 'financeiro/outras-receitas/opcoes' : null, () => financeiro.opcoesReceita());
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [competencia, setCompetencia] = useState(''); // 0033: opcional
  const [categoria, setCategoria] = useState('outra_operacional');
  const [operacao, setOperacao] = useState<'' | 'ambar' | 'roll'>('');
  const [recebida, setRecebida] = useState<'sim' | 'nao'>('sim');
  const [recebidoEm, setRecebidoEm] = useState(hojeISO());
  const [forma, setForma] = useState('');
  const [origem, setOrigem] = useState('');
  const [observacao, setObservacao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ciente, setCiente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const chave = useRef(novaChave());

  // Antes de a gaveta aparecer (layout effect): com useEffect, o que se digitasse logo ao abrir era apagado em seguida.
  useLayoutEffect(() => {
    if (!aberta) return;
    const r = editar;
    setDescricao(r?.descricao ?? '');
    setValor(r ? r.valor : '');
    setCompetencia(r?.competencia ?? '');
    setCategoria(r?.categoria ?? 'outra_operacional');
    setOperacao(r?.operacao ?? '');
    setRecebida(r && !r.recebido_em ? 'nao' : 'sim');
    setRecebidoEm(r?.recebido_em ?? r?.competencia ?? hojeISO());
    setForma(r?.forma_recebimento ?? '');
    setOrigem(r?.origem ?? '');
    setObservacao(r?.observacao ?? '');
    setMotivo('');
    setCiente(false);
    setErro(null);
    setErros({});
    chave.current = novaChave();
  }, [aberta, editar]);

  const cat = opcoes.dados?.categorias.find((c) => c.codigo === categoria);
  const duplicidade = !!erro?.codigo && DUPLICIDADE.includes(erro.codigo);

  async function enviar(e: Event) {
    e.preventDefault();
    const v = paraDecimal(valor);
    const es: Record<string, string> = {};
    if (!descricao.trim()) es.descricao = 'Descreva a receita (ex.: Locação do salão em 12/11).';
    if (!v || Number(v) <= 0) es.valor = 'Informe o valor.';
    if (recebida === 'sim' && !recebidoEm) es.recebido_em = 'Informe quando foi recebida.';
    if (editar && motivo.trim().length < 3) es.motivo = 'Diga por que está corrigindo.';
    if (duplicidade && !ciente) es.ciente = 'Confirme que é outro dinheiro, ou cancele.';
    setErros(es);
    if (Object.keys(es).length) return;
    setEnviando(true);
    try {
      const campos = {
        descricao: descricao.trim(), valor: v!, competencia: competencia || null, categoria, operacao: operacao || null,
        recebido_em: recebida === 'sim' ? recebidoEm : null,
        forma_recebimento: forma || null, origem: origem.trim() || null, observacao: observacao.trim() || null,
        ciente_duplicidade: duplicidade && ciente,
      };
      if (editar) {
        const { recebido_em, ...resto } = campos;
        await financeiro.alterarOutraReceita(editar.id, {
          ...resto, versao: editar.versao ?? 1, motivo: motivo.trim(),
          ...(recebido_em ? { recebido_em } : { marcar_pendente: true }),
        });
        avisar('Receita corrigida.', 'ok');
      } else {
        await financeiro.criarOutraReceita(campos, chave.current);
        avisar(recebida === 'sim' ? 'Receita lançada.' : 'Receita lançada como a receber.', 'ok');
      }
      atualizarFinanceiro();
      aoFechar();
    } catch (err) {
      const x = err instanceof ErroApi ? err : new ErroApi('servidor', 'Não foi possível salvar.');
      setErros(x.campos);
      setErro(x);
      setCiente(false);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Gaveta
      aberta={aberta}
      aoFechar={aoFechar}
      titulo={editar ? 'Corrigir receita' : 'Outra receita'}
      subtitulo={editar ? `${moeda(editar.valor)} · lançada por ${editar.criado_por ?? '—'}` : 'Fora do PDV'}
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-nova-receita" carregando={enviando} icone={<Check aria-hidden="true" />}>{editar ? 'Salvar correção' : 'Lançar receita'}</Botao>
        </>
      }
    >
      <form id="form-nova-receita" class="pilha" onSubmit={enviar} noValidate>
        {!editar && <Aviso tom="info" icone={<Info aria-hidden="true" />}>Só o que não passa pela Eyemobile (ex.: locação do espaço, evento faturado à parte). Venda do PDV entra sozinha: não lance aqui.</Aviso>}
        {erro && (
          <Aviso tom={duplicidade ? 'atencao' : 'perigo'} icone={<AlertTriangle aria-hidden="true" />}>
            {erro.message}
            {duplicidade && (
              <label style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                <input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.currentTarget.checked)} />
                <span>É outro dinheiro: registrar mesmo assim</span>
              </label>
            )}
          </Aviso>
        )}
        {erros.ciente && <p class="campo__erro" role="alert">{erros.ciente}</p>}
        <Campo rotulo="Descrição" erro={erros.descricao}>
          {(id, d) => <input id={id} class="entrada" maxLength={300} aria-describedby={d} aria-invalid={!!erros.descricao || undefined} value={descricao} onInput={(e) => setDescricao(e.currentTarget.value)} data-autofoco />}
        </Campo>
        <div class="grade-campos">
          <Campo rotulo="Valor" erro={erros.valor}>
            {(id, d) => <EntradaMoeda id={id} descr={d} valor={valor} aoMudar={setValor} invalido={!!erros.valor} />}
          </Campo>
          <Campo rotulo="Data (opcional)" erro={erros.competencia} ajuda="Dia a que a receita pertence (competência). Pode ser informada depois.">
            {(id, d) => <input id={id} type="date" class="entrada" aria-describedby={d} value={competencia} onChange={(e) => setCompetencia(e.currentTarget.value)} />}
          </Campo>
          <Campo rotulo="Operação" ajuda="De quem é a receita (repasses do ÂmbarxRoll).">
            {(id, d) => (
              <select id={id} class="selecao" aria-describedby={d} value={operacao} onChange={(e) => setOperacao(e.currentTarget.value as '' | 'ambar' | 'roll')}>
                <option value="">Não identificada</option><option value="ambar">Âmbar</option><option value="roll">Roll</option>
              </select>
            )}
          </Campo>
          <Campo rotulo="Categoria" class="inteiro" erro={erros.categoria} ajuda={cat && !cat.operacional ? 'Fica registrada, mas não entra no faturamento nem no resultado.' : 'Entra na receita do mês.'}>
            {(id, d) => (
              <select id={id} class="selecao" aria-describedby={d} value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
                {!opcoes.dados && <option value={categoria}>Carregando…</option>}
                <optgroup label="Receita (entra no faturamento)">
                  {(opcoes.dados?.categorias ?? []).filter((c) => c.operacional).map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}
                </optgroup>
                <optgroup label="Fora do faturamento">
                  {(opcoes.dados?.categorias ?? []).filter((c) => !c.operacional).map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}
                </optgroup>
              </select>
            )}
          </Campo>
        </div>
        <Segmentado<'sim' | 'nao'>
          rotulo="Situação do recebimento"
          valor={recebida}
          aoMudar={setRecebida}
          opcoes={[{ valor: 'sim', rotulo: 'Recebida' }, { valor: 'nao', rotulo: 'A receber' }]}
        />
        <div class="grade-campos">
          {recebida === 'sim' && (
            <Campo rotulo="Recebida em" erro={erros.recebido_em}>
              {(id, d) => <input id={id} type="date" class="entrada" aria-describedby={d} value={recebidoEm} onChange={(e) => setRecebidoEm(e.currentTarget.value)} />}
            </Campo>
          )}
          <Campo rotulo="Forma de recebimento" opcional erro={erros.forma_recebimento}>
            {(id, d) => (
              <select id={id} class="selecao" aria-describedby={d} value={forma} onChange={(e) => setForma(e.currentTarget.value)}>
                <option value="">—</option>
                {(opcoes.dados?.formas ?? []).map((f) => <option key={f.codigo} value={f.codigo}>{f.nome}</option>)}
              </select>
            )}
          </Campo>
          <Campo rotulo="Origem" opcional class="inteiro" ajuda="De quem ou de onde veio (ex.: empresa do evento)." erro={erros.origem}>
            {(id, d) => <input id={id} class="entrada" maxLength={120} aria-describedby={d} value={origem} onInput={(e) => setOrigem(e.currentTarget.value)} />}
          </Campo>
          <Campo rotulo="Observação" opcional class="inteiro" erro={erros.observacao}>
            {(id, d) => <textarea id={id} class="entrada" rows={2} maxLength={500} aria-describedby={d} value={observacao} onInput={(e) => setObservacao(e.currentTarget.value)} />}
          </Campo>
          {editar && (
            <Campo rotulo="Motivo da correção" class="inteiro" erro={erros.motivo} ajuda="Fica no histórico, com quem corrigiu.">
              {(id, d) => <input id={id} class="entrada" maxLength={300} aria-describedby={d} aria-invalid={!!erros.motivo || undefined} value={motivo} onInput={(e) => setMotivo(e.currentTarget.value)} />}
            </Campo>
          )}
        </div>
      </form>
    </Gaveta>
  );
}
