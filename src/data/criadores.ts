// “Reações reais” (antes “Provou, conta”) — vídeos de criadores sobre a Roll (NUNCA apresentados como avaliação do Âmbar Brunch).
// Cortes contínuos, falas originais, sem palavrão e sem quadros de outro story (docs/content/INFLUENCIADORES.md).
// Todos autorizados pelo responsável do projeto em 2026-10-17. O card não mostra @ nem nome (o que o criador gravou no
// vídeo fica). Ordem pensada para o carrossel abrir no 2º card, com um vizinho de cada lado, e para os dois cards de
// @_magall (mesmo homem, blusa branca) NUNCA ficarem lado a lado — nem na volta do laço (último → primeiro): eles ficam
// nas posições 1 e 4 de 5, separados por outros criadores dos dois lados (tests/e2e/carrossel.spec.ts confere).
// Legendas: .vtt ao lado do vídeo (public/media/video), revisadas a partir de três transcrições automáticas.

export interface VideoCriador {
  id: string;
  arquivo: string;                 // public/media/video/<arquivo>.web.mp4 (ver lib/media.ts → video())
  poster: string;                  // src/assets/media/…
  tag: string;
  descricao: string;               // rótulo acessível do vídeo
  autor?: string;                  // @ visível no próprio vídeo ou nos metadados
  quando?: string;
  formato: 'vertical' | 'horizontal';
  audio: boolean;                  // tem a voz do criador (botão de som); falso = arquivo sem faixa de áudio
  /** texto que os criadores escreveram no story FORA da janela do vídeo (sai no recorte; volta como texto do card) */
  legendaOriginal?: string[];
  autorizado: boolean;
}

export const criadores: { videos: VideoCriador[] } = {
  videos: [
    { id: 'IF-06b', arquivo: 'criador-magall-viciado', poster: 'criadores/criador-magall-viciado.webp', tag: 'viciado', descricao: 'criador falando para a câmera ao lado da caixa da Roll', autor: '@_magall', quando: 'set/2026', formato: 'vertical', audio: true, autorizado: true },
    { id: 'IV-05', arquivo: 'roll-criadora-larizgomes', poster: 'roll/poster-criadora-larizgomes.webp', tag: 'provou a Roll', descricao: 'criadora provando um cinnamon roll de pistache da Roll', autor: '@larizgomes', quando: 'set/2026', formato: 'vertical', audio: true, autorizado: true },
    { id: 'IF-02a', arquivo: 'criador-elevador-abrindo', poster: 'criadores/criador-elevador-abrindo.webp', tag: 'taste test', descricao: 'criadora abrindo a caixa de cinnamon rolls no elevador', formato: 'vertical', audio: true, autorizado: true },
    // IF-05a (@dailysocass, pistache) saiu do carrossel na rodada final: o “@roll.ofc” e a legenda que a criadora gravou no
    // story ficam sobre a cabeça dela — recortar tira os olhos do quadro e apagar borra o rosto. O pistache segue no IV-05.
    { id: 'IF-06a', arquivo: 'criador-magall-sabores', poster: 'criadores/criador-magall-sabores.webp', tag: 'sabores', descricao: 'caixa aberta com quatro cinnamon rolls de sabores diferentes', autor: '@_magall', quando: 'set/2026', formato: 'vertical', audio: true, autorizado: true },
    // horizontal: o vídeo do grupo estava dentro de um story vertical; recortado só na janela do vídeo, sem zoom
    { id: 'IF-04a', arquivo: 'criadores-grupo-expectativa', poster: 'criadores/criadores-grupo-expectativa.webp', tag: 'primeira caixa', descricao: 'quatro amigos abrindo a caixa da Roll numa cozinha', formato: 'horizontal', audio: true, legendaOriginal: ['@roll.ofc', 'a gente tava tão ansioso', 'pra issoooooo 😍😍😍😍'], autorizado: true },
  ],
};
