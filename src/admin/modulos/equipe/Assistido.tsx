// Registro assistido: o gestor registra por quem não conseguiu pelo tablet. Fica só no painel, nunca no tablet compartilhado.
// O horário é o do servidor: não há campo de hora.
import { useEffect, useRef, useState } from 'preact/hooks';
import { ErroApi } from '../../lib/api/cliente';
import { equipe, novaChave } from '../../lib/api/equipe';
import { invalidar } from '../../lib/consulta';
import { ROTULO_BATIDA, type TipoBatida } from '../../../lib/ponto/contrato';
import { Aviso, Botao, Campo } from '../../ui/base';
import { avisar, Dialogo } from '../../ui/camadas';
import { JUSTIFICATIVA_MAX, JUSTIFICATIVA_MIN, useFuncionariosAtivos } from './comum';

export function RegistroAssistido({ aberto, aoFechar, funcionarioId }: { aberto: boolean; aoFechar: () => void; funcionarioId?: string }) {
  const lista = useFuncionariosAtivos();
  const [funcionario, setFuncionario] = useState(funcionarioId ?? '');
  const [justificativa, setJustificativa] = useState('');
  const [opcoes, setOpcoes] = useState<TipoBatida[] | null>(null);
  const [tipo, setTipo] = useState<TipoBatida | ''>('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const chave = useRef(novaChave());
  useEffect(() => {
    if (!aberto) return;
    setFuncionario(funcionarioId ?? '');
    setJustificativa('');
    setOpcoes(null);
    setTipo('');
    setErro(null);
    chave.current = novaChave();
  }, [aberto, funcionarioId]);
  const valido = !!funcionario && justificativa.trim().length >= JUSTIFICATIVA_MIN && (!opcoes || !!tipo);
  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      const m = await equipe.registrarAssistida({ funcionario_id: funcionario, justificativa: justificativa.trim(), tipo: tipo || null }, chave.current);
      avisar(`${ROTULO_BATIDA[m.tipo]} registrada às ${m.instante_local.slice(11, 16)}.`, 'ok');
      invalidar('equipe');
      aoFechar();
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'escolha_necessaria' && Array.isArray(e.dados?.opcoes)) {
        setOpcoes(e.dados.opcoes as TipoBatida[]);
        chave.current = novaChave();
        setErro('Escolha o tipo de batida para continuar.');
      } else setErro(e instanceof ErroApi ? e.message : 'Não foi possível registrar.');
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Dialogo
      aberto={aberto}
      aoFechar={() => !enviando && aoFechar()}
      titulo="Registro assistido"
      acoes={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Voltar</Botao>
          <Botao variante="primario" onClick={enviar} carregando={enviando} disabled={!valido}>Registrar agora</Botao>
        </>
      }
    >
      <p>Para quem não conseguiu registrar pelo tablet. Vale o horário do sistema, e seu nome fica registrado.</p>
      <Campo rotulo="Funcionário">
        {(id) => (
          <select id={id} class="selecao" value={funcionario} onChange={(e) => setFuncionario(e.currentTarget.value)} data-autofoco disabled={!!funcionarioId}>
            <option value="">Escolha…</option>
            {lista.dados?.itens.map((f) => <option key={f.id} value={f.id}>{f.nome_completo}</option>)}
          </select>
        )}
      </Campo>
      {opcoes && (
        <Campo rotulo="Tipo de batida">
          {(id) => (
            <select id={id} class="selecao" value={tipo} onChange={(e) => setTipo(e.currentTarget.value as TipoBatida)}>
              <option value="">Escolha…</option>
              {opcoes.map((o) => <option key={o} value={o}>{ROTULO_BATIDA[o]}</option>)}
            </select>
          )}
        </Campo>
      )}
      <Campo rotulo="Justificativa" ajuda={`Pelo menos ${JUSTIFICATIVA_MIN} caracteres. Fica registrada na auditoria.`}>
        {(id, descr) => <textarea id={id} class="area" aria-describedby={descr} maxLength={JUSTIFICATIVA_MAX} value={justificativa} onInput={(e) => setJustificativa(e.currentTarget.value)} />}
      </Campo>
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
    </Dialogo>
  );
}
