// Documento original (comprovante, boleto, nota) pela URL temporária do backend (GET /admin/arquivos/{id}/url, 5 min).
import { FileText, ExternalLink, ImageOff } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { Dados, Vazio } from '../../ui/estados';

export function Documento({ arquivoId, altura = 420 }: { arquivoId: string | null; altura?: number }) {
  const url = useConsulta(arquivoId ? `financeiro/arquivo:${arquivoId}` : null, () => financeiro.urlArquivo(arquivoId!));
  if (!arquivoId) {
    return (
      <div class="documento" style={{ minHeight: '160px' }}>
        <Vazio compacto icone={<ImageOff aria-hidden="true" />} titulo="Sem documento anexado" />
      </div>
    );
  }
  return (
    <Dados consulta={url} recurso="O documento" compacto esqueleto={<div class="documento esqueleto" style={{ minHeight: `${altura}px` }} />}>
      {(u) => (
        <div class="pilha pilha--p">
          <div class="documento" style={{ minHeight: `${Math.min(altura, 320)}px`, maxHeight: `${altura + 200}px` }}>
            {u.mime.startsWith('image/') ? (
              <img src={u.url} alt="Documento original" loading="lazy" />
            ) : u.mime === 'application/pdf' ? (
              <iframe src={u.url} title="Documento original (PDF)" style={{ height: `${altura}px` }} />
            ) : (
              <Vazio compacto icone={<FileText aria-hidden="true" />} titulo="Documento sem visualização" />
            )}
          </div>
          <a class="btn btn--p btn--fantasma" style={{ alignSelf: 'flex-start' }} href={u.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" /> Abrir em outra aba
          </a>
        </div>
      )}
    </Dados>
  );
}
