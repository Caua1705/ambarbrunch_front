import { pendente, type Pendente } from '../lib/conteudo';

// “Quem provou, conta” — vídeos de criadores sobre a Roll (NUNCA apresentados como avaliação do Âmbar Brunch).
// Cortes contínuos, falas originais, sem palavrão e sem quadros de outro story (docs/content/INFLUENCIADORES.md).
// Só entram no site publicado com `autorizado: true` (imagem, voz, nome e corte reeditado autorizados pelo criador).
// Os arquivos `revisao/…` ficam fora do Git (public/media/revisao, src/assets/media/revisao): `npm run media:influenciadores`.
// Legendas: .vtt ao lado do vídeo, revisadas à mão a partir de três transcrições automáticas (falta ouvir e confirmar).

export interface VideoCriador {
  id: string;
  arquivo: string;                 // ver lib/media.ts → video()
  poster: string;                  // src/assets/media/…
  tag: string;
  descricao: string;               // rótulo acessível do vídeo
  autor: string | Pendente;        // @ visível no próprio vídeo ou nos metadados; sem identificação = pendente
  quando?: string;
  formato: 'vertical' | 'horizontal';
  audio: boolean;                  // tem a voz do criador (botão de som); falso = arquivo sem faixa de áudio
  /** texto que os criadores escreveram no story FORA da janela do vídeo (sai no recorte; volta como texto do card) */
  legendaOriginal?: string[];
  autorizado: boolean;
}

export const criadores: { videos: VideoCriador[] } = {
  videos: [
    { id: 'IF-06b', arquivo: 'revisao/criadores/criador-magall-viciado', poster: 'revisao/criadores/criador-magall-viciado.webp', tag: 'viciado', descricao: 'criador falando para a câmera ao lado da caixa da Roll', autor: '@_magall', quando: 'set/2026', formato: 'vertical', audio: true, autorizado: false },
    { id: 'IF-05a', arquivo: 'revisao/criadores/criadora-dailysocass-pistache', poster: 'revisao/criadores/criadora-dailysocass-pistache.webp', tag: 'pistache', descricao: 'criadora comendo um cinnamon roll de pistache', autor: '@dailysocass', formato: 'vertical', audio: true, autorizado: false },
    // horizontal: o vídeo do grupo estava dentro de um story vertical; recortado só na janela do vídeo, sem zoom
    { id: 'IF-04a', arquivo: 'revisao/criadores/criadores-grupo-expectativa', poster: 'revisao/criadores/criadores-grupo-expectativa.webp', tag: 'primeira caixa', descricao: 'quatro amigos abrindo a caixa da Roll numa cozinha', autor: pendente('Identificação dos criadores do vídeo do grupo'), formato: 'horizontal', audio: true, legendaOriginal: ['@roll.ofc', 'a gente tava tão ansioso', 'pra issoooooo 😍😍😍😍'], autorizado: false },
    // autorizado em 2026-10-17 pela autora, só o trecho de 9 s e sem áudio
    { id: 'IV-05', arquivo: 'roll-criadora-larizgomes', poster: 'roll/poster-criadora-larizgomes.webp', tag: 'provou a Roll', descricao: 'criadora provando um cinnamon roll de pistache da Roll', autor: '@larizgomes', quando: 'set/2026', formato: 'vertical', audio: false, autorizado: true },
    { id: 'IF-02a', arquivo: 'revisao/criadores/criador-elevador-abrindo', poster: 'revisao/criadores/criador-elevador-abrindo.webp', tag: 'taste test', descricao: 'criadora abrindo a caixa de cinnamon rolls no elevador', autor: pendente('Identificação da criadora do vídeo no elevador'), formato: 'vertical', audio: true, autorizado: false },
    { id: 'IF-06a', arquivo: 'revisao/criadores/criador-magall-sabores', poster: 'revisao/criadores/criador-magall-sabores.webp', tag: 'sabores', descricao: 'caixa aberta com quatro cinnamon rolls de sabores diferentes', autor: '@_magall', quando: 'set/2026', formato: 'vertical', audio: true, autorizado: false },
  ],
};
