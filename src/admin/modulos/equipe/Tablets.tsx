// Tablets autorizados. A credencial aparece uma vez e nunca fica guardada aqui. Autorizar "este aparelho" entrega o código
// direto à página /ponto, que o troca por um cookie que o JavaScript não lê.
import { useState } from 'preact/hooks';
import { Copy, Plus, Tablet } from 'lucide-preact';
import { ErroApi } from '../../lib/api/cliente';
import { equipe } from '../../lib/api/equipe';
import { invalidar, useConsulta } from '../../lib/consulta';
import { dataHora } from '../../lib/formato';
import type { Dispositivo } from '../../lib/tipos/equipe';
import { Aviso, Botao, Campo, Cartao, Situacao } from '../../ui/base';
import { avisar, Dialogo, useConfirmacao } from '../../ui/camadas';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';

const CHAVE_PAREAMENTO = 'ambar_ponto_pareamento';

export function Tablets() {
  const consulta = useConsulta('equipe:dispositivos', () => equipe.dispositivos());
  const [novo, setNovo] = useState(false);
  const [credencial, setCredencial] = useState<Dispositivo | null>(null);
  const { confirmar, elemento } = useConfirmacao();
  const revogar = (d: Dispositivo) => confirmar({
    titulo: `Revogar ${d.nome}?`,
    texto: 'O tablet para de registrar ponto na hora. Um tablet revogado não volta: para usar de novo, cadastre outro.',
    confirmar: 'Revogar',
    perigo: true,
    motivo: { rotulo: 'Motivo', minimo: 3 },
    sucesso: 'Tablet revogado.',
    acao: async (motivo) => {
      await equipe.revogarDispositivo(d.id, motivo);
      invalidar('equipe:dispositivos');
    },
  });
  const trocar = (d: Dispositivo) => confirmar({
    titulo: `Trocar a credencial de ${d.nome}?`,
    texto: 'O tablet para de funcionar até receber a nova credencial.',
    confirmar: 'Trocar',
    acao: async () => {
      setCredencial(await equipe.trocarCredencial(d.id));
      invalidar('equipe:dispositivos');
    },
  });
  return (
    <Cartao titulo="Tablets autorizados" descricao="Só estes aparelhos conseguem abrir o registro de ponto." acoes={<Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setNovo(true)}>Cadastrar tablet</Botao>} justo>
      <Dados consulta={consulta} esqueleto={<EsqueletoTabela linhas={3} />}>
        {(lista) => lista.length ? (
          <ul class="lista" aria-label="Tablets">
            {lista.map((d) => (
              <li key={d.id}>
                <div class="lista__item equipe-marcacao">
                  <div class="pilha pilha--p">
                    <span class="linha"><strong>{d.nome}</strong><Situacao tom={d.ativo ? 'ok' : 'apagado'}>{d.ativo ? 'Ativo' : 'Revogado'}</Situacao></span>
                    <span class="fraco">{d.ativo ? (d.ultimo_uso_em ? `Último uso ${dataHora(d.ultimo_uso_em)}` : 'Ainda não usado') : `Revogado ${dataHora(d.revogado_em)}${d.revogacao_motivo ? `: ${d.revogacao_motivo}` : ''}`}</span>
                  </div>
                  {d.ativo && (
                    <div class="linha">
                      <Botao tamanho="p" onClick={() => trocar(d)}>Trocar credencial</Botao>
                      <Botao tamanho="p" variante="perigo" onClick={() => revogar(d)}>Revogar</Botao>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Vazio icone={<Tablet aria-hidden="true" />} titulo="Nenhum tablet autorizado" acao={<Botao variante="primario" onClick={() => setNovo(true)}>Cadastrar tablet</Botao>}>
            Cadastre o tablet do café para ele poder abrir o registro de ponto.
          </Vazio>
        )}
      </Dados>
      <NovoTablet aberto={novo} aoFechar={() => setNovo(false)} aoCriar={(d) => { setNovo(false); setCredencial(d); }} />
      {credencial?.token && <Credencial tablet={credencial} aoFechar={() => setCredencial(null)} />}
      {elemento}
    </Cartao>
  );
}

function NovoTablet({ aberto, aoFechar, aoCriar }: { aberto: boolean; aoFechar: () => void; aoCriar: (d: Dispositivo) => void }) {
  const [nome, setNome] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const criar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      aoCriar(await equipe.criarDispositivo(nome.trim()));
      setNome('');
      invalidar('equipe:dispositivos');
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível cadastrar.');
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Dialogo
      aberto={aberto}
      aoFechar={() => !enviando && aoFechar()}
      titulo="Cadastrar tablet"
      acoes={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Voltar</Botao>
          <Botao variante="primario" onClick={criar} carregando={enviando} disabled={nome.trim().length < 2}>Cadastrar</Botao>
        </>
      }
    >
      <p>O tablet fica ligado à unidade em uso neste painel.</p>
      <Campo rotulo="Nome do tablet" ajuda="Por exemplo, Tablet do balcão.">
        {(id, d) => <input id={id} class="entrada" maxLength={80} aria-describedby={d} value={nome} onInput={(e) => setNome(e.currentTarget.value)} data-autofoco />}
      </Campo>
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
    </Dialogo>
  );
}

function Credencial({ tablet, aoFechar }: { tablet: Dispositivo; aoFechar: () => void }) {
  const token = tablet.token!;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(token);
      avisar('Código copiado.', 'ok');
    } catch {
      avisar('Não foi possível copiar. Selecione o código e copie.', 'erro');
    }
  };
  const nesteAparelho = () => {
    try {
      sessionStorage.setItem(CHAVE_PAREAMENTO, token);
      location.assign('/ponto');
    } catch {
      avisar('Este navegador não permitiu. Abra /ponto no tablet e cole o código.', 'erro');
    }
  };
  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo={`Autorizar ${tablet.nome}`}
      acoes={
        <>
          <Botao onClick={aoFechar}>Fechar</Botao>
          <Botao variante="primario" onClick={nesteAparelho} data-autofoco>Autorizar este aparelho</Botao>
        </>
      }
    >
      <p>Se você está no próprio tablet, toque em Autorizar este aparelho. Em outro aparelho, abra <strong>/ponto</strong> no tablet e cole este código.</p>
      <Aviso tom="atencao">O código aparece só agora. Não envie por mensagem nem guarde em lugar nenhum.</Aviso>
      <div class="equipe-token">
        <code>{token}</code>
        <Botao so_icone aria-label="Copiar código" icone={<Copy aria-hidden="true" />} onClick={copiar} />
      </div>
    </Dialogo>
  );
}
