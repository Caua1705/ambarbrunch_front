// Clientes: o cadastro único de quem reservou (o mesmo de Reservas, Clube e vendas). Busca, lista paginada e a ficha em
// gaveta com histórico de reservas, canais, consentimentos e a correção de cadastro pela gerência. Rotas reais
// /admin/clientes* (no ar em produção): leitura com clientes.visualizar; correção com clientes.editar.
import { useEffect, useState } from 'preact/hooks';
import { Search, Users, BadgeCheck, ChevronLeft, ChevronRight } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { clientes, POR_PAGINA_CLIENTES } from '../../lib/api/clientes';
import { dataCurta, telefone, plural, inteiro } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { pode } from '../../lib/permissoes';
import { Raiz } from '../../ui/camadas';
import { Botao, Cabecalho, Cartao } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { ClientePainel } from '../../lib/tipos/clientes';
import { FichaCliente } from './Ficha';
import { ORIGEM, Frequencia } from './comum';

export default function Clientes({ contexto }: { contexto: ContextoPainel }) {
  const [busca, setBusca] = useState(lerParam('busca') ?? '');
  const [aplicada, setAplicada] = useState(busca.trim());
  const [pagina, setPagina] = useState(0);
  const [aberto, setAberto] = useState<string | null>(lerParam('cliente'));
  // A lista de permissões vem do backend (GET /admin/auth/me); sem ela, vale o espelho da matriz (lib/permissoes).
  const podeEditar = contexto.usuario.permissoes ? contexto.usuario.permissoes.includes('clientes.editar') : pode(contexto.usuario.papel, 'clientes.editar');

  useEffect(() => {
    const t = setTimeout(() => {
      setAplicada(busca.trim());
      setPagina(0);
    }, 300);
    return () => clearTimeout(t);
  }, [busca]);
  useEffect(() => gravarParams({ busca: aplicada || null, cliente: aberto }), [aplicada, aberto]);

  const deslocamento = pagina * POR_PAGINA_CLIENTES;
  const lista = useConsulta(`clientes?${aplicada}:${deslocamento}`, () => clientes.listar({ busca: aplicada || undefined, deslocamento }));
  const total = lista.dados?.total ?? 0;
  const ultima = Math.max(0, Math.ceil(total / POR_PAGINA_CLIENTES) - 1);

  const colunas: Coluna<ClientePainel>[] = [
    {
      id: 'nome', titulo: 'Cliente', ordenar: (c) => c.nome,
      celula: (c) => (
        <>
          <span class="principal-celula">{c.nome}</span>
          {c.email && <span class="sub">{c.email}</span>}
        </>
      ),
    },
    {
      id: 'telefone', titulo: 'Telefone', prioridade: 'media',
      celula: (c) => (
        <span class="linha" style={{ gap: '4px', flexWrap: 'nowrap' }}>
          <span class="num">{telefone(c.telefone_e164)}</span>
          {c.telefone_verificado && <BadgeCheck size={14} aria-label="Telefone verificado" style={{ color: 'var(--ok)', flex: 'none' }} />}
        </span>
      ),
    },
    { id: 'origem', titulo: 'Origem', prioridade: 'baixa', celula: (c) => <span class="fraco">{c.importado ? 'Giardini' : ORIGEM[c.origem_inicial] ?? c.origem_inicial}</span> },
    {
      id: 'reservas', titulo: 'Reservas', numero: true, ordenar: (c) => c.reservas_total, largura: '110px',
      celula: (c) => (
        <>
          <span class="num">{inteiro(c.reservas_total)}</span>
          {c.reservas_em_aberto > 0 && <span class="sub">{plural(c.reservas_em_aberto, 'em aberto', 'em aberto')}</span>}
        </>
      ),
    },
    { id: 'proxima', titulo: 'Próxima', ordenar: (c) => c.proxima_reserva, prioridade: 'media', largura: '110px', celula: (c) => <span class="num">{c.proxima_reserva ? dataCurta(c.proxima_reserva) : '—'}</span> },
    { id: 'ultima', titulo: 'Última', ordenar: (c) => c.ultima_reserva, prioridade: 'baixa', largura: '110px', celula: (c) => <span class="num">{c.ultima_reserva ? dataCurta(c.ultima_reserva, { ano: true }) : '—'}</span> },
    { id: 'perfil', titulo: 'Frequência', prioridade: 'media', celula: (c) => <Frequencia f={c.frequencia} /> },
  ];

  return (
    <Raiz>
      <Cabecalho titulo="Clientes" descricao="Quem reservou, por qual canal e o histórico de cada um. Um cadastro para reservas, Clube e vendas." />

      <Cartao justo>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--borda)' }} class="filtros">
          <div class="entrada-grupo">
            <Search aria-hidden="true" />
            <input class="entrada" type="search" placeholder="Nome, e-mail ou telefone" aria-label="Buscar cliente" maxLength={80} value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
          </div>
          {lista.dados && <span class="fraco" aria-live="polite">{plural(total, 'cliente', 'clientes')}</span>}
          {lista.atualizando && <span class="fraco">Atualizando…</span>}
        </div>
        <Dados consulta={lista} recurso="A lista de clientes" esqueleto={<EsqueletoTabela />}>
          {({ itens }) => (
            <>
              <Tabela
                rotulo="Clientes"
                colunas={colunas}
                linhas={itens}
                chave={(c) => c.id}
                aoAbrir={(c) => setAberto(c.id)}
                porPagina={POR_PAGINA_CLIENTES}
                movel={(c) => (
                  <span class="pilha" style={{ gap: '2px', flex: 1, minWidth: 0 }}>
                    <span class="principal-celula">{c.nome}</span>
                    <span class="fraco num">{telefone(c.telefone_e164)}{c.telefone_verificado ? ' · verificado' : ''}</span>
                    <span class="fraco">
                      {plural(c.reservas_total, 'reserva', 'reservas')}
                      {c.proxima_reserva ? ` · próxima ${dataCurta(c.proxima_reserva)}` : c.ultima_reserva ? ` · última ${dataCurta(c.ultima_reserva)}` : ''}
                    </span>
                  </span>
                )}
                vazio={
                  <Vazio icone={<Users aria-hidden="true" />} titulo={aplicada ? 'Ninguém encontrado com essa busca' : 'Nenhum cliente ainda'}>
                    {aplicada ? 'Confira o nome, o e-mail ou os 4 últimos dígitos do telefone.' : 'Cada reserva feita pelo site cria ou atualiza o cadastro do cliente.'}
                  </Vazio>
                }
              />
              {total > POR_PAGINA_CLIENTES && (
                <div class="paginacao">
                  <span class="fraco num">
                    {inteiro(deslocamento + 1)}–{inteiro(Math.min(deslocamento + itens.length, total))} de {inteiro(total)}
                  </span>
                  <div class="linha">
                    <Botao tamanho="p" so_icone aria-label="Página anterior de clientes" icone={<ChevronLeft aria-hidden="true" />} disabled={pagina === 0} onClick={() => setPagina((p) => Math.max(0, p - 1))} />
                    <Botao tamanho="p" so_icone aria-label="Próxima página de clientes" icone={<ChevronRight aria-hidden="true" />} disabled={pagina >= ultima} onClick={() => setPagina((p) => Math.min(ultima, p + 1))} />
                  </div>
                </div>
              )}
            </>
          )}
        </Dados>
      </Cartao>

      <FichaCliente id={aberto} aoFechar={() => setAberto(null)} podeEditar={podeEditar} />
    </Raiz>
  );
}

