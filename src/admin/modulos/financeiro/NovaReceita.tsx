// Outra receita (fora do PDV): evento faturado à parte, por exemplo. Venda de balcão entra sozinha pela Eyemobile.
// POST /admin/financeiro/outras-receitas com Idempotency-Key (reenviar o mesmo formulário não lança em dobro).
import { useEffect, useRef, useState } from 'preact/hooks';
import { Check, Info } from 'lucide-preact';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi, novaChave } from '../../lib/api/cliente';
import { hojeISO, paraDecimal } from '../../lib/formato';
import { Gaveta } from '../../ui/camadas';
import { Botao, Campo, Aviso } from '../../ui/base';
import { EntradaMoeda } from '../../ui/entradas';
import { atualizarFinanceiro, avisar } from './comum';

export function NovaReceita({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [competencia, setCompetencia] = useState(hojeISO());
  const [recebidoEm, setRecebidoEm] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const chave = useRef(novaChave());

  useEffect(() => {
    if (!aberta) return;
    setDescricao('');
    setValor('');
    setCompetencia(hojeISO());
    setRecebidoEm('');
    setErro(null);
    setErros({});
    chave.current = novaChave();
  }, [aberta]);

  async function enviar(e: Event) {
    e.preventDefault();
    const v = paraDecimal(valor);
    const es: Record<string, string> = {};
    if (!descricao.trim()) es.descricao = 'Descreva a receita (ex.: Evento corporativo de 12/11).';
    if (!v || Number(v) <= 0) es.valor = 'Informe o valor.';
    if (!competencia) es.competencia = 'Informe a data.';
    setErros(es);
    if (Object.keys(es).length) return;
    setEnviando(true);
    setErro(null);
    try {
      await financeiro.criarOutraReceita({ descricao: descricao.trim(), valor: v!, competencia, recebido_em: recebidoEm || null }, chave.current);
      atualizarFinanceiro();
      avisar('Receita lançada.', 'ok');
      aoFechar();
    } catch (err) {
      const x = err instanceof ErroApi ? err : new ErroApi('servidor', 'Não foi possível lançar.');
      setErros(x.campos);
      setErro(x);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Gaveta
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Outra receita"
      subtitulo="Fora do PDV"
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-nova-receita" carregando={enviando} icone={<Check aria-hidden="true" />}>Lançar receita</Botao>
        </>
      }
    >
      <form id="form-nova-receita" class="pilha" onSubmit={enviar} noValidate>
        <Aviso tom="info" icone={<Info aria-hidden="true" />}>Só o que não passa pela Eyemobile (ex.: evento faturado à parte). Venda do PDV entra sozinha: não lance aqui.</Aviso>
        {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro.message}</Aviso>}
        <Campo rotulo="Descrição" erro={erros.descricao}>
          {(id, d) => <input id={id} class="entrada" maxLength={300} aria-describedby={d} aria-invalid={!!erros.descricao || undefined} value={descricao} onInput={(e) => setDescricao(e.currentTarget.value)} data-autofoco />}
        </Campo>
        <div class="grade-campos">
          <Campo rotulo="Valor" erro={erros.valor}>
            {(id, d) => <EntradaMoeda id={id} descr={d} valor={valor} aoMudar={setValor} invalido={!!erros.valor} />}
          </Campo>
          <Campo rotulo="Competência" erro={erros.competencia} ajuda="Dia a que a receita pertence.">
            {(id, d) => <input id={id} type="date" class="entrada" aria-describedby={d} value={competencia} onChange={(e) => setCompetencia(e.currentTarget.value)} />}
          </Campo>
          <Campo rotulo="Recebida em" opcional class="inteiro" erro={erros.recebido_em}>
            {(id, d) => <input id={id} type="date" class="entrada" aria-describedby={d} value={recebidoEm} onChange={(e) => setRecebidoEm(e.currentTarget.value)} />}
          </Campo>
        </div>
      </form>
    </Gaveta>
  );
}
