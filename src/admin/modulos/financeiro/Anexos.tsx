// Anexos de uma despesa (GET /admin/financeiro/despesas/{id}/documentos, §5.5): o documento do lançamento, os
// comprovantes dos pagamentos, a nota da compra e os documentos do grupo vinculados — um por arquivo, com o papel de
// cada. Cada um abre pela URL temporária (GET /admin/arquivos/{id}/url). Backend sem a rota (antes da 0018): mostra o
// documento do próprio lançamento, como antes.
import { useState } from 'preact/hooks';
import { FileText, Eye } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { dataHora } from '../../lib/formato';
import { Botao, Etiqueta } from '../../ui/base';
import { Esqueleto, Falha } from '../../ui/estados';
import { PAPEL_ANEXO } from './comum';
import { Documento } from './Documento';

export function Anexos({ despesaId, arquivoId }: { despesaId: string; arquivoId: string | null }) {
  const consulta = useConsulta(`financeiro/despesa:${despesaId}:anexos`, () => financeiro.anexosDespesa(despesaId));
  const [aberto, setAberto] = useState<string | null>(null);
  const antigo = consulta.erro?.tipo === 'nao_implantado';
  const anexos = consulta.dados ?? [];
  const visivel = aberto ?? anexos[0]?.arquivo_id ?? null;

  return (
    <section class="pilha pilha--p" aria-label="Anexos">
      <h3 class="secao-titulo">{anexos.length > 1 ? `Anexos (${anexos.length})` : 'Documento'}</h3>
      {antigo ? (
        <Documento arquivoId={arquivoId} altura={360} />
      ) : consulta.carregando ? (
        <Esqueleto linhas={2} />
      ) : consulta.erro && !consulta.dados ? (
        <>
          <Falha erro={consulta.erro} aoTentar={consulta.recarregar} compacto recurso="Os anexos" />
          {arquivoId && <Documento arquivoId={arquivoId} altura={360} />}
        </>
      ) : (
        <>
          {anexos.length > 1 && (
            <ul class="lista">
              {anexos.map((a) => (
                <li key={a.arquivo_id} class="lista__item" style={{ flexWrap: 'wrap' }}>
                  <span class="lista__icone" aria-hidden="true"><FileText /></span>
                  <span class="lista__texto">
                    <strong>{a.nome ?? 'Documento'}</strong>
                    <span class="linha">{a.papeis.map((p) => <Etiqueta key={p}>{PAPEL_ANEXO[p] ?? p.replace(/_/g, ' ')}</Etiqueta>)}</span>
                    {a.criado_em && <span class="fraco">{dataHora(a.criado_em)}</span>}
                  </span>
                  <span class="lista__fim">
                    <Botao tamanho="p" variante={visivel === a.arquivo_id ? 'primario' : 'fantasma'} icone={<Eye aria-hidden="true" />} aria-pressed={visivel === a.arquivo_id} onClick={() => setAberto(a.arquivo_id)}>
                      Ver
                    </Botao>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {anexos.length === 1 && <span class="linha">{anexos[0].papeis.map((p) => <Etiqueta key={p}>{PAPEL_ANEXO[p] ?? p.replace(/_/g, ' ')}</Etiqueta>)}</span>}
          <Documento key={visivel ?? 'nenhum'} arquivoId={visivel} altura={360} />
        </>
      )}
    </section>
  );
}
