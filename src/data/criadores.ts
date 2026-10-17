// “Quem provou, conta” — vídeos de criadores sobre a Roll (NUNCA apresentados como avaliação do Âmbar Brunch).
// Cortes contínuos, falas originais, sem palavrão e sem quadros de outro story (docs/content/INFLUENCIADORES.md).
// Todos autorizados pelo responsável do projeto em 2026-10-17. Sem @ identificado: o card não mostra nome (nunca inventado).
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
    { id: 'IF-05a', arquivo: 'criadora-dailysocass-pistache', poster: 'criadores/criadora-dailysocass-pistache.webp', tag: 'pistache', descricao: 'criadora comendo um cinnamon roll de pistache', autor: '@dailysocass', formato: 'vertical', audio: true, autorizado: true },
    // horizontal: o vídeo do grupo estava dentro de um story vertical; recortado só na janela do vídeo, sem zoom
    { id: 'IF-04a', arquivo: 'criadores-grupo-expectativa', poster: 'criadores/criadores-grupo-expectativa.webp', tag: 'primeira caixa', descricao: 'quatro amigos abrindo a caixa da Roll numa cozinha', formato: 'horizontal', audio: true, legendaOriginal: ['@roll.ofc', 'a gente tava tão ansioso', 'pra issoooooo 😍😍😍😍'], autorizado: true },
    { id: 'IV-05', arquivo: 'roll-criadora-larizgomes', poster: 'roll/poster-criadora-larizgomes.webp', tag: 'provou a Roll', descricao: 'criadora provando um cinnamon roll de pistache da Roll', autor: '@larizgomes', quando: 'set/2026', formato: 'vertical', audio: true, autorizado: true },
    { id: 'IF-02a', arquivo: 'criador-elevador-abrindo', poster: 'criadores/criador-elevador-abrindo.webp', tag: 'taste test', descricao: 'criadora abrindo a caixa de cinnamon rolls no elevador', formato: 'vertical', audio: true, autorizado: true },
    { id: 'IF-06a', arquivo: 'criador-magall-sabores', poster: 'criadores/criador-magall-sabores.webp', tag: 'sabores', descricao: 'caixa aberta com quatro cinnamon rolls de sabores diferentes', autor: '@_magall', quando: 'set/2026', formato: 'vertical', audio: true, autorizado: true },
  ],
};
