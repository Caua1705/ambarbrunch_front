// Vídeo da abertura guardado NO TABLET até o envio terminar: se a página recarregar, a internet cair ou a tela travar
// depois de gravar, o vídeo não se perde (volta como "vídeo gravado, ainda não enviado"). Fica só no IndexedDB deste
// navegador, uma entrada por checklist, e é apagado assim que o servidor confirma que salvou. Sem IndexedDB (navegação
// privada, armazenamento bloqueado), tudo segue funcionando, só sem essa recuperação.
const BANCO = 'ambar-operacao';
const LOJA = 'videos-abertura';

export interface VideoLocal {
  arquivo: Blob;
  duracao: number | null;
  gravado_em: number;
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA);
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => falha(pedido.error);
  });
}

async function comLoja<T>(modo: IDBTransactionMode, fazer: (loja: IDBObjectStore) => IDBRequest): Promise<T | null> {
  try {
    const banco = await abrir();
    return await new Promise<T | null>((ok) => {
      const pedido = fazer(banco.transaction(LOJA, modo).objectStore(LOJA));
      pedido.onsuccess = () => ok((pedido.result as T) ?? null);
      pedido.onerror = () => ok(null);
    }).finally(() => banco.close());
  } catch {
    return null;
  }
}

export const guardarVideoLocal = (checklistId: string, v: VideoLocal) => comLoja<void>('readwrite', (l) => l.put(v, checklistId));
export const lerVideoLocal = (checklistId: string) => comLoja<VideoLocal>('readonly', (l) => l.get(checklistId));
export const apagarVideoLocal = (checklistId: string) => comLoja<void>('readwrite', (l) => l.delete(checklistId));
