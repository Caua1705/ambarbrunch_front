/** @jsxImportSource preact */
// Ícones de traço da área do membro — o mesmo desenho dos ícones do rodapé e dos marcos do Clube: 24 × 24, traço 1,7,
// pontas redondas, sem preenchimento. Decorativos (aria-hidden): o texto ao lado diz o que é.
const D = {
  cartao: 'M3.5 7.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zM3.5 10h17M7 15h4',
  historico: 'M4 12a8 8 0 1 0 2.4-5.7M4 4.5v3.2h3.2M12 8v4.3l2.8 1.8',
  presente: 'M4.5 10.5h15v9h-15zM3.5 7h17v3.5h-17zM12 7v12.5M12 7c-1.2-2.6-4.6-3.2-4.6-1 0 1.4 2.4 1 4.6 1zM12 7c1.2-2.6 4.6-3.2 4.6-1 0 1.4-2.4 1-4.6 1z',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 20h2M20 14v2',
  pessoa: 'M12 12a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6zM4.5 20c.9-3.6 3.9-5.6 7.5-5.6s6.6 2 7.5 5.6',
  sino: 'M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2H5zM10 20.5a2.2 2.2 0 0 0 4 0',
  sair: 'M14 5H6.5v14H14M10.5 12H20M17 8.8l3.2 3.2-3.2 3.2',
  seta: 'M9 5.5l6.5 6.5L9 18.5',
  espiral: 'M12 12.5a1.4 1.4 0 0 1 0-2.8 2.8 2.8 0 0 1 0 5.6 4.2 4.2 0 0 1 0-8.4 5.6 5.6 0 0 1 0 11.2 7 7 0 0 1-7-7',
  relogio: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 8v4.2l2.6 1.6',
  check: 'M5 12.5l4.3 4.3L19 7.2',
  x: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
} as const;
export type NomeIcone = keyof typeof D;

export function Icone({ nome, class: cls }: { nome: NomeIcone; class?: string }) {
  return (
    <svg class={`icone${cls ? ` ${cls}` : ''}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={D[nome]} />
    </svg>
  );
}
