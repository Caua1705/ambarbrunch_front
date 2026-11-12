// Configurações → Ponto → Checklist de abertura: as tarefas que aparecem no tablet todo dia (só o Proprietário,
// `abertura.configurar`; o backend confere de novo). Mudar aqui vale a partir do próximo checklist assumido: o de hoje, já
// começado, continua com as tarefas que tinha. Tarefa nunca é apagada, só desativada (o histórico continua legível).
import { useState } from 'preact/hooks';
import { ArrowDown, ArrowUp, Plus } from 'lucide-preact';
import { abertura } from '../../lib/api/operacao';
import { invalidar, useConsulta } from '../../lib/consulta';
import type { TarefaModelo } from '../../lib/tipos/abertura';
import { Botao, Cartao, Situacao } from '../../ui/base';
import { avisar, avisarErro } from '../../ui/camadas';
import { Dados, EsqueletoTabela } from '../../ui/estados';

const CHAVE = 'abertura:modelo';

export function ModeloAbertura() {
  const consulta = useConsulta(CHAVE, () => abertura.modelo());
  const [nova, setNova] = useState('');
  const [editando, setEditando] = useState<{ id: string; titulo: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const agir = async (fazer: () => Promise<unknown>, ok: string) => {
    setOcupado(true);
    try {
      await fazer();
      avisar(ok, 'ok');
      invalidar(CHAVE);
    } catch (e) {
      avisarErro(e);
    } finally {
      setOcupado(false);
    }
  };

  const mover = (ativas: TarefaModelo[], i: number, passo: -1 | 1) => {
    const ids = ativas.map((t) => t.id);
    const j = i + passo;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void agir(() => abertura.ordenar(ids), 'Ordem atualizada.');
  };

  return (
    <Cartao titulo="Checklist de abertura" descricao="As tarefas do checklist que a equipe preenche no tablet ao abrir o café. Vale a partir do próximo checklist.">
      <Dados consulta={consulta} recurso="O modelo do checklist" esqueleto={<EsqueletoTabela linhas={8} />}>
        {(tarefas) => {
          const ativas = tarefas.filter((t) => t.ativo);
          const inativas = tarefas.filter((t) => !t.ativo);
          return (
            <div class="pilha">
              <ol class="lista modelo-abertura">
                {ativas.map((t, i) => (
                  <li key={t.id} class="lista__item modelo-abertura__item">
                    <span class="num fraco">{i + 1}.</span>
                    {editando?.id === t.id ? (
                      <form class="linha" style={{ flex: 1 }} onSubmit={(e) => { e.preventDefault(); void agir(() => abertura.alterarTarefa(t.id, { titulo: editando.titulo }), 'Tarefa renomeada.').then(() => setEditando(null)); }}>
                        <input class="entrada" aria-label="Nome da tarefa" value={editando.titulo} minLength={2} maxLength={160} onInput={(e) => setEditando({ id: t.id, titulo: e.currentTarget.value })} />
                        <Botao tamanho="p" variante="primario" type="submit" carregando={ocupado}>Salvar</Botao>
                        <Botao tamanho="p" variante="fantasma" onClick={() => setEditando(null)}>Cancelar</Botao>
                      </form>
                    ) : (
                      <>
                        <span style={{ flex: 1 }}>{t.titulo}</span>
                        <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Subir ${t.titulo}`} icone={<ArrowUp aria-hidden="true" />} disabled={i === 0 || ocupado} onClick={() => mover(ativas, i, -1)} />
                        <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Descer ${t.titulo}`} icone={<ArrowDown aria-hidden="true" />} disabled={i === ativas.length - 1 || ocupado} onClick={() => mover(ativas, i, 1)} />
                        <Botao tamanho="p" variante="fantasma" onClick={() => setEditando({ id: t.id, titulo: t.titulo })}>Renomear</Botao>
                        <Botao tamanho="p" variante="fantasma" disabled={ocupado} onClick={() => agir(() => abertura.alterarTarefa(t.id, { ativo: false }), 'Tarefa desativada.')}>Desativar</Botao>
                      </>
                    )}
                  </li>
                ))}
              </ol>
              <form class="linha" onSubmit={(e) => { e.preventDefault(); const titulo = nova.trim(); if (titulo.length >= 2) void agir(() => abertura.criarTarefa(titulo), 'Tarefa incluída.').then(() => setNova('')); }}>
                <input class="entrada" style={{ flex: 1 }} aria-label="Nova tarefa" placeholder="Nova tarefa (ex.: Ligar a música ambiente)" value={nova} maxLength={160} onInput={(e) => setNova(e.currentTarget.value)} />
                <Botao type="submit" icone={<Plus aria-hidden="true" />} disabled={nova.trim().length < 2} carregando={ocupado}>Incluir</Botao>
              </form>
              {!!inativas.length && (
                <details>
                  <summary class="fraco">Desativadas ({inativas.length})</summary>
                  <ul class="lista">
                    {inativas.map((t) => (
                      <li key={t.id} class="lista__item modelo-abertura__item">
                        <span style={{ flex: 1 }}>{t.titulo}</span>
                        <Situacao tom="apagado">desativada</Situacao>
                        <Botao tamanho="p" variante="fantasma" disabled={ocupado} onClick={() => agir(() => abertura.alterarTarefa(t.id, { ativo: true }), 'Tarefa reativada.')}>Reativar</Botao>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        }}
      </Dados>
    </Cartao>
  );
}
