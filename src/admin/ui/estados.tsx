// Estados de dados: carregando, vazio, erro, sem permissão, recurso ainda não publicado. Nunca "R$ 0,00" no lugar de erro.
import type { ComponentChildren } from 'preact';
import { CloudOff, Lock, WifiOff, Inbox, RotateCw, Construction, AlertTriangle } from 'lucide-preact';
import type { Consulta } from '../lib/consulta';
import type { ErroApi } from '../lib/api/cliente';
import { Botao } from './base';

export function Esqueleto({ linhas = 3, altura = 18 }: { linhas?: number; altura?: number }) {
  return (
    <div class="pilha pilha--p" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <span key={i} class="esqueleto" style={{ height: `${altura}px`, width: `${100 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

export function EsqueletoTabela({ linhas = 6 }: { linhas?: number }) {
  return (
    <div class="pilha" style={{ padding: '16px 20px' }} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <div class="linha" key={i} style={{ gap: '16px', flexWrap: 'nowrap' }}>
          <span class="esqueleto" style={{ height: '14px', width: '14%' }} />
          <span class="esqueleto" style={{ height: '14px', flex: 1 }} />
          <span class="esqueleto" style={{ height: '14px', width: '12%' }} />
          <span class="esqueleto" style={{ height: '14px', width: '16%' }} />
        </div>
      ))}
    </div>
  );
}

export function Vazio({ titulo, children, icone, acao, compacto }: { titulo: string; children?: ComponentChildren; icone?: ComponentChildren; acao?: ComponentChildren; compacto?: boolean }) {
  return (
    <div class={`estado${compacto ? ' estado--compacto' : ''}`}>
      <span class="estado__icone">{icone ?? <Inbox aria-hidden="true" />}</span>
      <h3>{titulo}</h3>
      {children && <p>{children}</p>}
      {acao}
    </div>
  );
}

/** Erro de uma consulta, com a explicação certa para cada caso. */
export function Falha({ erro, aoTentar, compacto, recurso }: { erro: ErroApi; aoTentar?: () => void; compacto?: boolean; recurso?: string }) {
  if (erro.tipo === 'nao_implantado') {
    return (
      <Vazio compacto={compacto} icone={<Construction aria-hidden="true" />} titulo={`${recurso ?? 'Este recurso'} ainda não está no ar`}>
        O sistema do Âmbar publicado ainda não tem esta parte. A tela já está pronta e passa a funcionar quando o backend for atualizado.
      </Vazio>
    );
  }
  if (erro.tipo === 'permissao') {
    return (
      <Vazio compacto={compacto} icone={<Lock aria-hidden="true" />} titulo="Sem acesso">
        Seu perfil não tem permissão para ver isto. Se precisar, fale com o administrador.
      </Vazio>
    );
  }
  const rede = erro.tipo === 'rede' || erro.tipo === 'tempo';
  return (
    <Vazio
      compacto={compacto}
      icone={rede ? <WifiOff aria-hidden="true" /> : erro.tipo === 'indisponivel' ? <CloudOff aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
      titulo={rede ? 'Sem conexão' : 'Não foi possível carregar'}
      acao={aoTentar && <Botao tamanho="p" icone={<RotateCw aria-hidden="true" />} onClick={aoTentar}>Tentar de novo</Botao>}
    >
      {erro.message}
    </Vazio>
  );
}

/**
 * Renderiza uma consulta: esqueleto na primeira carga, falha com "tentar de novo" e o conteúdo quando há dados.
 * Se a revalidação falhar com dado na tela, o dado continua e um aviso discreto aparece no topo.
 */
export function Dados<T>({ consulta, children, esqueleto, compacto, recurso }: { consulta: Consulta<T>; children: (dados: T) => ComponentChildren; esqueleto?: ComponentChildren; compacto?: boolean; recurso?: string }) {
  if (consulta.dados !== undefined) {
    return (
      <>
        {consulta.atualizando && <div class="atualizando" aria-hidden="true" />}
        {consulta.erro && consulta.erro.tipo !== 'nao_implantado' && (
          <div class="aviso aviso--atencao" role="status" style={{ margin: '0 0 12px' }}>
            <AlertTriangle aria-hidden="true" />
            <div>
              Mostrando os últimos dados carregados. {consulta.erro.message}{' '}
              <button class="btn btn--p btn--fantasma" onClick={consulta.recarregar}>Tentar de novo</button>
            </div>
          </div>
        )}
        {children(consulta.dados)}
      </>
    );
  }
  if (consulta.erro) return <Falha erro={consulta.erro} aoTentar={consulta.recarregar} compacto={compacto} recurso={recurso} />;
  return <>{esqueleto ?? <Esqueleto />}</>;
}
