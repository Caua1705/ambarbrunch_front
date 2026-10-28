// Contagem física (inventário): sugestão do que mais vale contar → abrir → contar item a item → fechar.
// Fechar ajusta o saldo pela diferença; a confirmação mostra quantas diferenças e quanto valem antes.
import { useEffect, useState } from 'preact/hooks';
import { ClipboardList, Check, Info } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { ErroApi } from '../../lib/api/cliente';
import { quantidade, moeda, relativo, plural } from '../../lib/formato';
import { Gaveta, useConfirmacao, avisarErro } from '../../ui/camadas';
import { Botao, Aviso, Etiqueta } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type { Inventario } from '../../lib/tipos/estoque';
import { UNIDADE_CURTA, atualizarEstoque } from './comum';

const CHAVE = 'painel-contagem-aberta';
const MOTIVO = { negativo: 'Saldo negativo', nunca_contado: 'Nunca contado', curva_a: 'Mais usado' } as const;

function lerAberta() {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}
function gravarAberta(id: string | null) {
  try {
    if (id) localStorage.setItem(CHAVE, id);
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: a contagem continua nesta página */
  }
}

export function Contagem({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const [id, setId] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const { confirmar, elemento } = useConfirmacao();
  useEffect(() => {
    if (aberta) setId(lerAberta());
  }, [aberta]);

  const sugestao = useConsulta(aberta && !id ? 'estoque/inventarios/sugestao' : null, () => estoque.sugestaoInventario());
  const inv = useConsulta(aberta && id ? `estoque/inventarios/${id}` : null, () => estoque.inventario(id!));

  // Contagem encerrada em outro aparelho, ou que não existe mais: volta para a sugestão.
  useEffect(() => {
    if (inv.dados && inv.dados.status !== 'aberto') {
      gravarAberta(null);
      setId(null);
    }
    if (inv.erro?.tipo === 'nao_encontrado') {
      gravarAberta(null);
      setId(null);
    }
  }, [inv.dados?.status, inv.erro?.tipo]);

  async function abrir(escopo: 'sugerido' | 'total') {
    setAbrindo(true);
    try {
      const r = await estoque.abrirInventario(escopo);
      gravarAberta(r.id);
      setId(r.id);
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'inventario_aberto' && typeof e.dados?.id === 'string') {
        gravarAberta(e.dados.id);
        setId(e.dados.id);
      } else avisarErro(e);
    } finally {
      setAbrindo(false);
    }
  }

  const d = inv.dados;
  const contados = d?.itens.filter((i) => i.quantidade_contada !== null) ?? [];
  const comDiferenca = contados.filter((i) => Number(i.diferenca ?? 0) !== 0);
  const valor = comDiferenca.reduce((s, i) => s + Number(i.valor_diferenca ?? 0), 0);

  const fechar = () =>
    confirmar({
      titulo: 'Fechar a contagem?',
      texto: (
        <>
          {plural(contados.length, 'item contado', 'itens contados')}, {plural(comDiferenca.length, 'com diferença', 'com diferença')} ({moeda(valor)} ao custo médio). O estoque é ajustado pela quantidade contada; itens não contados ficam como estão.
        </>
      ),
      confirmar: 'Fechar e ajustar',
      acao: async () => {
        await estoque.fecharInventario(id!);
        gravarAberta(null);
        setId(null);
        atualizarEstoque();
      },
      sucesso: 'Contagem fechada e estoque ajustado.',
    });
  const cancelar = () =>
    confirmar({
      titulo: 'Cancelar a contagem?',
      texto: 'Nada é ajustado. As quantidades digitadas se perdem.',
      confirmar: 'Cancelar contagem',
      perigo: true,
      acao: async () => {
        await estoque.cancelarInventario(id!);
        gravarAberta(null);
        setId(null);
        atualizarEstoque();
      },
    });

  return (
    <Gaveta
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Contagem de estoque"
      subtitulo={id ? 'Digite o que tem na prateleira, na unidade-base de cada insumo' : 'Conte o que mais vale a pena primeiro'}
      largura="media"
      rodape={
        id && d ? (
          <>
            <Botao variante="fantasma" onClick={cancelar}>Cancelar contagem</Botao>
            <Botao variante="primario" icone={<Check aria-hidden="true" />} disabled={!contados.length} onClick={fechar}>Fechar contagem</Botao>
          </>
        ) : !id ? (
          <>
            <Botao onClick={() => abrir('total')} disabled={abrindo}>Contar todos</Botao>
            <Botao variante="primario" icone={<ClipboardList aria-hidden="true" />} carregando={abrindo} onClick={() => abrir('sugerido')}>Contar os sugeridos</Botao>
          </>
        ) : undefined
      }
    >
      {!id ? (
        <Dados consulta={sugestao} recurso="A sugestão de contagem" esqueleto={<Esqueleto linhas={6} />}>
          {(lista) =>
            lista.length ? (
              <>
                <p class="suave">Os insumos que mais pesam no saldo: negativos, nunca contados e os mais usados.</p>
                <ul class="lista" style={{ border: '1px solid var(--borda)', borderRadius: '12px' }}>
                  {lista.map((s) => (
                    <li key={s.insumo_id} class="lista__item">
                      <span class="lista__texto">
                        <strong>{s.insumo}</strong>
                        <span>Sistema: {quantidade(s.saldo_sistema, s.unidade_base)} · {s.ultima_contagem_em ? `contado ${relativo(s.ultima_contagem_em)}` : 'nunca contado'}</span>
                      </span>
                      <span class="lista__fim"><Etiqueta tom={s.motivo === 'negativo' ? 'perigo' : s.motivo === 'nunca_contado' ? 'atencao' : 'neutro'}>{MOTIVO[s.motivo]}</Etiqueta></span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Vazio titulo="Nada sugerido agora">Se quiser, conte todos os insumos.</Vazio>
            )
          }
        </Dados>
      ) : (
        <Dados consulta={inv} recurso="A contagem" esqueleto={<Esqueleto linhas={8} />}>
          {(d: Inventario) => (
            <>
              <Aviso tom="info" icone={<Info aria-hidden="true" />}>
                Contagem aberta {relativo(d.aberto_em)}. Ela fica salva: pode fechar esta janela e continuar depois, inclusive em outro aparelho.
              </Aviso>
              <div>
                {d.itens.map((it) => (
                  <ItemContagem key={it.insumo_id} inventario={d.id} it={it} />
                ))}
              </div>
            </>
          )}
        </Dados>
      )}
      {elemento}
    </Gaveta>
  );
}

function ItemContagem({ inventario, it }: { inventario: string; it: Inventario['itens'][number] }) {
  const [valor, setValor] = useState(it.quantidade_contada === null ? '' : String(Number(it.quantidade_contada)));
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(it.quantidade_contada);
  async function salvar() {
    const n = Number(valor.replace(',', '.'));
    if (valor.trim() === '' || !(n >= 0) || String(n) === String(Number(salvo ?? NaN))) return;
    setSalvando(true);
    try {
      await estoque.contar(inventario, it.insumo_id, String(n));
      setSalvo(String(n));
      atualizarEstoque();
    } catch (e) {
      avisarErro(e);
    } finally {
      setSalvando(false);
    }
  }
  const dif = it.diferenca === null ? null : Number(it.diferenca);
  return (
    <div class="contagem-item">
      <div style={{ minWidth: 0 }}>
        <strong style={{ fontWeight: 500 }}>{it.insumo}</strong>
        <span class="fraco" style={{ display: 'block' }}>
          Sistema: {quantidade(it.quantidade_sistema, it.unidade_base)}
          {dif !== null && dif !== 0 && (
            <>
              {' · '}
              <span style={{ color: dif < 0 ? 'var(--perigo)' : 'var(--ok)', fontWeight: 600 }}>{dif > 0 ? '+' : ''}{quantidade(dif, it.unidade_base)}</span>
              {it.valor_diferenca !== null && ` (${moeda(it.valor_diferenca)})`}
            </>
          )}
          {dif === 0 && ' · bate com o sistema'}
        </span>
      </div>
      <div class="entrada-grupo">
        <input
          class="entrada num"
          inputMode="decimal"
          aria-label={`Quantidade contada de ${it.insumo} em ${UNIDADE_CURTA[it.unidade_base]}`}
          placeholder="Contado"
          value={valor}
          style={{ paddingRight: '40px' }}
          onInput={(e) => setValor(e.currentTarget.value)}
          onBlur={salvar}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        />
        <span class="fraco" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }}>{salvando ? '…' : UNIDADE_CURTA[it.unidade_base]}</span>
      </div>
    </div>
  );
}
