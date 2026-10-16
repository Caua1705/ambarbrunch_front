// SIMULAÇÃO do contrato, só para testes e demonstração interna. A interface sempre avisa “simulação”.
// Nenhum dado sai do navegador. Horários e regras aqui são FICTÍCIOS e não representam o funcionamento do Âmbar.
import { ErroReserva, type ReservasApi } from './contrato';

const espera = (ms: number, sinal?: AbortSignal) => new Promise<void>((ok, nao) => {
  const t = setTimeout(ok, ms);
  sinal?.addEventListener('abort', () => { clearTimeout(t); nao(new DOMException('cancelado', 'AbortError')); });
});

export function criarApiSimulada(atraso = 500): ReservasApi {
  return {
    modo: 'simulado',
    async config() {
      await espera(atraso / 2);
      return {
        ambientes: [{ id: 'jardim', nome: 'Jardim' }, { id: 'salao', nome: 'Salão' }, { id: 'lounge', nome: 'Lounge' }],
        pessoas: { min: 1, max: 12 }, antecedencia: { diasMax: 14 }, exigeEmail: false,
      };
    },
    async disponibilidade({ data, pessoas }, sinal) {
      await espera(atraso, sinal);
      const dia = new Date(`${data}T12:00:00`).getDay();
      if (dia === 1) return { data, horarios: [] };                      // simula “sem horários” às segundas
      const horas = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'];
      return { data, horarios: horas.map((hora, i) => ({ hora, disponivel: (i + pessoas + dia) % 4 !== 0 })) };
    },
    async criar(r) {
      await espera(atraso * 1.5);
      if (/erro/i.test(r.nome)) throw new ErroReserva('servidor', 'Não foi possível concluir. Tente de novo em instantes.');
      if (/ocupado/i.test(r.nome)) throw new ErroReserva('conflito', 'Este horário acabou de ser reservado. Escolha outro.');
      return { codigo: `SIM-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, status: 'confirmada', ambienteId: r.ambienteId, pessoas: r.pessoas, data: r.data, hora: r.hora };
    },
  };
}
