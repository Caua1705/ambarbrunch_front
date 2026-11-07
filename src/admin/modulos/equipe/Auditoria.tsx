// Auditoria do módulo (só Proprietário): o que mudou, por quem e quando. Nunca traz template, imagem ou token.
import { useState } from 'preact/hooks';
import { equipe } from '../../lib/api/equipe';
import { useConsulta } from '../../lib/consulta';
import { dataHora } from '../../lib/formato';
import type { RegistroAuditoria } from '../../lib/tipos/equipe';
import { Cartao } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';

const AREAS: Record<string, string> = {
  equipe_funcionario: 'Funcionários',
  equipe_escala: 'Escalas',
  equipe_marcacao: 'Marcações',
  equipe_ajuste: 'Correções',
  equipe_biometria: 'Reconhecimento facial',
  equipe_dispositivo: 'Tablets',
  equipe_relatorio: 'Relatórios',
};

const autor = (r: RegistroAuditoria) => r.ator_nome ?? (r.ator_tipo === 'integracao' ? 'Tablet' : r.ator_tipo === 'sistema' ? 'Sistema' : 'Gestor');
const texto = (dados: Record<string, unknown>) => (dados.motivo ? String(dados.motivo) : dados.justificativa ? String(dados.justificativa) : '');

export function Auditoria() {
  const [entidade, setEntidade] = useState('');
  const q = { entidade: entidade || undefined, limite: 200 };
  const consulta = useConsulta(`equipe:auditoria?${entidade}`, () => equipe.auditoria(q));
  const colunas: Coluna<RegistroAuditoria>[] = [
    { id: 'quando', titulo: 'Quando', ordenar: (r) => r.ocorreu_em, celula: (r) => dataHora(r.ocorreu_em) },
    { id: 'quem', titulo: 'Quem', ordenar: autor, celula: autor },
    { id: 'area', titulo: 'Área', prioridade: 'media', celula: (r) => AREAS[r.entidade] ?? r.entidade },
    { id: 'acao', titulo: 'O que aconteceu', celula: (r) => r.acao.replaceAll('_', ' ') },
    { id: 'detalhe', titulo: 'Motivo', prioridade: 'baixa', celula: (r) => texto(r.dados) },
  ];
  return (
    <Cartao titulo="Auditoria" descricao="Registro permanente das ações de Equipe e Ponto." justo>
      <div class="filtros equipe-filtros">
        <select class="selecao" aria-label="Área" value={entidade} onChange={(e) => setEntidade(e.currentTarget.value)}>
          <option value="">Todas as áreas</option>
          {Object.entries(AREAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </div>
      <Dados consulta={consulta} esqueleto={<EsqueletoTabela />}>
        {(p) => (
          <Tabela
            rotulo="Auditoria"
            colunas={colunas}
            linhas={p.itens}
            chave={(r) => String(r.id)}
            ordemInicial={{ coluna: 'quando', desc: true }}
            movel={(r) => <div class="pilha pilha--p"><strong>{r.acao.replaceAll('_', ' ')}</strong><span class="fraco">{autor(r)}, {dataHora(r.ocorreu_em)}</span></div>}
            vazio={<Vazio titulo="Nenhum registro" />}
          />
        )}
      </Dados>
    </Cartao>
  );
}
