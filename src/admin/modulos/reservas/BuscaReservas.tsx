// Gaveta "Buscar reserva": procura em todas as datas, no backend (GET /admin/reservas?busca=), por nome, telefone ou código.
// Quem decide o que cada perfil acha é o backend: o Atendente busca por nome ou código, sem telefone, de hoje até 14 dias à
// frente. Próximas reservas primeiro, depois as antigas. O termo fica guardado ao fechar, para voltar ao resultado.
import { useEffect, useState } from 'preact/hooks';
import { CalendarSearch, Search } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { dataCurta, hora, plural, telefone } from '../../lib/formato';
import { pode } from '../../lib/permissoes';
import type { Papel } from '../../lib/sessao';
import { Gaveta } from '../../ui/camadas';
import { Botao } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { SituacaoReserva } from './comum';

const POR_VEZ = 30;
const LIMITE_BACKEND = 200;
const TERMO_MINIMO = 2;
const ESPERA_MS = 300;

export function BuscaReservas({ aberta, aoFechar, papel, aoAbrir }: { aberta: boolean; aoFechar: () => void; papel: Papel; aoAbrir: (id: string) => void }) {
  const verContato = pode(papel, 'reservas.ver_contato');
  const [texto, setTexto] = useState('');
  const [termo, setTermo] = useState('');
  const [limite, setLimite] = useState(POR_VEZ);
  useEffect(() => {
    const espera = setTimeout(() => {
      setTermo(texto.trim());
      setLimite(POR_VEZ);
    }, ESPERA_MS);
    return () => clearTimeout(espera);
  }, [texto]);

  const buscando = aberta && termo.length >= TERMO_MINIMO;
  const consulta = useConsulta(buscando ? `reservas?busca:${termo}:${limite}` : null, () => reservas.listar({ busca: termo, limite }));
  const itens = consulta.dados?.itens ?? [];
  const total = consulta.dados?.total ?? 0;

  return (
    <Gaveta aberta={aberta} aoFechar={aoFechar} titulo="Buscar reserva" subtitulo={verContato ? 'Em todas as datas' : 'De hoje até 14 dias à frente'} largura="media">
      <div class="pilha">
        <div class="entrada-grupo">
          <Search aria-hidden="true" />
          <input class="entrada" type="search" autofocus placeholder={verContato ? 'Nome, telefone ou código' : 'Nome ou código'} aria-label="Buscar em todas as reservas" maxLength={80} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />
        </div>
        {!buscando ? (
          <Vazio compacto icone={<CalendarSearch aria-hidden="true" />} titulo="Digite ao menos 2 letras ou números" />
        ) : (
          <Dados consulta={consulta} recurso="A busca de reservas" esqueleto={<EsqueletoTabela />}>
            {() =>
              itens.length ? (
                <>
                  <p class="fraco" aria-live="polite">{plural(total, 'reserva encontrada', 'reservas encontradas')}</p>
                  <ul class="busca-reservas" aria-label="Resultado da busca">
                    {itens.map((r) => (
                      <li key={r.id}>
                        <button type="button" class="busca-reservas__item" onClick={() => aoAbrir(r.id)}>
                          <span class="busca-reservas__quando">
                            <span class="forte">{dataCurta(r.data, { ano: true })}</span>
                            <span class="num fraco">{hora(r.hora)}</span>
                          </span>
                          <span class="busca-reservas__quem">
                            <span class="principal-celula">{r.contato_nome}</span>
                            <span class="fraco">{plural(r.pessoas, 'pessoa', 'pessoas')} · {r.ambiente}{verContato ? ` · ${telefone(r.contato_telefone_e164)}` : ''}</span>
                          </span>
                          <SituacaoReserva r={r} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {total > itens.length && (limite < LIMITE_BACKEND
                    ? <Botao tamanho="p" onClick={() => setLimite(Math.min(limite + POR_VEZ, LIMITE_BACKEND))}>Mostrar mais</Botao>
                    : <p class="fraco">Mostrando {itens.length} de {total}. Refine a busca para ver as demais.</p>)}
                </>
              ) : (
                <Vazio compacto icone={<CalendarSearch aria-hidden="true" />} titulo="Nenhuma reserva encontrada">{verContato ? 'Confira a grafia do nome ou os dígitos do telefone.' : 'A busca vai de hoje até 14 dias à frente.'}</Vazio>
              )
            }
          </Dados>
        )}
      </div>
    </Gaveta>
  );
}
