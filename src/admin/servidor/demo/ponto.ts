// Ponto na demonstração: responde como o módulo desligado. De propósito não há dados fictícios de jornada nem identificação
// simulada: as telas são exercitadas contra o backend real (tests-ponto-real/).
import { ErroDemo, type Rota } from './roteador';

const desligado = () => {
  throw new ErroDemo(503, 'ponto_desativado', 'Controle de ponto desativado.');
};

export const ROTAS_PONTO: Rota[] = (['GET', 'POST', 'PATCH'] as const).map((metodo) => [metodo, /^ponto(\/.*)?$/, null, desligado]);
