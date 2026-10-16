import { pendente, type Pendente } from '../lib/conteudo';

// TUDO pendente: nada aqui pode ser inventado. Preencher com os dados oficiais dos proprietários.
// (Fortaleza-CE aparece só como indício numa hashtag: não usar até confirmar.)
type Valor<T> = T | Pendente;
export const visita: {
  endereco: Valor<string>;
  cidade: Valor<string>;
  mapaUrl: Valor<string>;
  horarios: Valor<{ dias: string; horas: string }[]>;
  whatsapp: Valor<{ numero: string; url: string }>;
  instagram: Valor<{ handle: string; url: string }>;
  extras: Valor<string>;
} = {
  endereco: pendente('Endereço completo (rua, número, bairro)'),
  cidade: pendente('Cidade e estado'),
  mapaUrl: pendente('Link do app de mapas'),
  horarios: pendente('Dias e horários de funcionamento'),
  whatsapp: pendente('WhatsApp do Âmbar'),
  instagram: pendente('Instagram do Âmbar'),
  extras: pendente('Estacionamento e acessibilidade (se houver)'),
};
