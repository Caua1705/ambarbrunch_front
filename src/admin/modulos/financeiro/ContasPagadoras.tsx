// Configurações → Financeiro → Contas e pagadores (0029), só o Proprietário (financeiro.configurar). As contas que a
// Júlia usa para reconhecer QUEM PAGOU cada comprovante: conta empresarial do Âmbar (a padrão de novos pagamentos) e as
// contas pessoais dos sócios do Âmbar e da Roll. Nada vem preenchido: o cadastro é feito aqui, com os dados reais.
// O backend nunca guarda o CPF inteiro (só os 6 dígitos do meio, a mesma máscara do comprovante Pix), nem a chave Pix
// nem o número inteiro da conta: depois de salvo, só aparece mascarado. Rotas: GET/POST/PATCH /contas-pagadoras.
import { useEffect, useState } from 'preact/hooks';
import { Plus, Info } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { Gaveta } from '../../ui/camadas';
import { Botao, Cartao, Campo, Aviso, Etiqueta } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { ContaPagadoraCadastro, ContaPagadoraEntrada, NaturezaConta, ParteConta } from '../../lib/tipos/financeiro';
import { PARTE, atualizarFinanceiro, avisar } from './comum';

export function ContasPagadoras() {
  const lista = useConsulta('financeiro/contas-pagadoras/cadastro', () => financeiro.cadastroContasPagadoras());
  const [editar, setEditar] = useState<ContaPagadoraCadastro | 'nova' | null>(null);
  const colunas: Coluna<ContaPagadoraCadastro>[] = [
    {
      id: 'apelido', titulo: 'Conta', ordenar: (c) => c.apelido,
      celula: (c) => (
        <>
          <span class="principal-celula">{c.apelido} {c.padrao && <Etiqueta tom="marca">padrão</Etiqueta>} {c.status === 'inativa' && <Etiqueta>inativa</Etiqueta>}</span>
          <span class="sub">{c.titular_nome} · {c.documento ?? 'sem documento'}</span>
        </>
      ),
    },
    { id: 'parte', titulo: 'Lado', celula: (c) => `${PARTE[c.parte]} · ${c.natureza === 'pessoal' ? 'pessoal' : 'empresarial'}` },
    { id: 'banco', titulo: 'Banco', prioridade: 'media', celula: (c) => <>{c.instituicao}<span class="sub">{[c.agencia ? `ag. ${c.agencia}` : null, c.conta].filter(Boolean).join(' · ') || '—'}</span></> },
    { id: 'pix', titulo: 'Pix', prioridade: 'baixa', celula: (c) => c.chave_pix ?? <span class="fraco">—</span> },
  ];
  return (
    <>
      <Cartao
        titulo="Contas e pagadores"
        descricao="Para a Júlia reconhecer quem pagou cada comprovante. Dados pessoais ficam mascarados."
        acoes={<Botao tamanho="p" variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setEditar('nova')}>Nova conta</Botao>}
        justo
      >
        <Dados consulta={lista} recurso="As contas" esqueleto={<EsqueletoTabela linhas={3} />}>
          {(itens) => (
            <Tabela rotulo="Contas pagadoras" colunas={colunas} linhas={itens} chave={(c) => c.id} aoAbrir={setEditar}
              vazio={<Vazio compacto titulo="Nenhuma conta cadastrada">Cadastre a conta empresarial do Âmbar (padrão) e as contas pessoais que já pagaram despesas.</Vazio>} />
          )}
        </Dados>
      </Cartao>
      <FormConta conta={editar} aoFechar={() => setEditar(null)} />
    </>
  );
}

const VAZIO: ContaPagadoraEntrada = { apelido: '', instituicao: '', parte: 'ambar', natureza: 'empresarial', titular_nome: '', documento: '', codigo_banco: '', agencia: '', conta: '', chave_pix: '', padrao: false };

function FormConta({ conta, aoFechar }: { conta: ContaPagadoraCadastro | 'nova' | null; aoFechar: () => void }) {
  const [f, setF] = useState<ContaPagadoraEntrada>(VAZIO);
  const [inativa, setInativa] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const existente = conta && conta !== 'nova' ? conta : null;
  useEffect(() => {
    setErro(null);
    if (existente) {
      // Documento, conta e Pix voltam vazios: o backend só tem a máscara; deixar vazio = não mudar.
      setF({ apelido: existente.apelido, instituicao: existente.instituicao, parte: existente.parte, natureza: existente.natureza, titular_nome: existente.titular_nome, documento: '', codigo_banco: existente.codigo_banco ?? '', agencia: existente.agencia ?? '', conta: '', chave_pix: '', padrao: existente.padrao });
      setInativa(existente.status === 'inativa');
    } else setF(VAZIO);
  }, [conta]);
  if (!conta) return null;
  const mudar = <K extends keyof ContaPagadoraEntrada>(k: K, v: ContaPagadoraEntrada[K]) => setF((x) => ({ ...x, [k]: v }));
  const podePadrao = f.parte === 'ambar' && f.natureza === 'empresarial';

  async function salvar(e: Event) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const limpo = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
    try {
      if (existente) {
        const corpo: Partial<ContaPagadoraEntrada> & { versao: number; status?: 'ativa' | 'inativa' } = {
          versao: existente.versao, apelido: f.apelido, instituicao: f.instituicao, parte: f.parte, natureza: f.natureza,
          titular_nome: f.titular_nome, codigo_banco: limpo(f.codigo_banco), agencia: limpo(f.agencia), padrao: podePadrao && !inativa ? !!f.padrao : false,
          status: inativa ? 'inativa' : 'ativa',
        };
        if (limpo(f.documento)) corpo.documento = limpo(f.documento);
        if (limpo(f.conta)) corpo.conta = limpo(f.conta);
        if (limpo(f.chave_pix)) corpo.chave_pix = limpo(f.chave_pix);
        await financeiro.alterarContaPagadora(existente.id, corpo);
      } else {
        await financeiro.criarContaPagadora({ ...f, documento: limpo(f.documento), codigo_banco: limpo(f.codigo_banco), agencia: limpo(f.agencia), conta: limpo(f.conta), chave_pix: limpo(f.chave_pix), padrao: podePadrao && !!f.padrao });
      }
      atualizarFinanceiro();
      avisar('Conta salva.', 'ok');
      aoFechar();
    } catch (x) {
      setErro(x instanceof ErroApi ? x : new ErroApi('servidor', 'Não foi possível salvar.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Gaveta aberta aoFechar={aoFechar} titulo={existente ? existente.apelido : 'Nova conta'} rodape={<><Botao onClick={aoFechar} disabled={salvando}>Cancelar</Botao><Botao variante="primario" type="submit" form="form-conta-pagadora" carregando={salvando}>Salvar</Botao></>}>
      <form id="form-conta-pagadora" class="pilha" onSubmit={salvar} noValidate>
        {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro.message}</Aviso>}
        <div class="grade-campos">
          <Campo rotulo="Apelido" erro={erro?.campos.apelido}>{(id) => <input id={id} class="entrada" maxLength={60} value={f.apelido} onInput={(e) => mudar('apelido', e.currentTarget.value)} />}</Campo>
          <Campo rotulo="Lado">
            {(id) => (
              <select id={id} class="selecao" value={f.parte} onChange={(e) => mudar('parte', e.currentTarget.value as ParteConta)}>
                <option value="ambar">Âmbar</option><option value="roll">Roll</option>
              </select>
            )}
          </Campo>
          <Campo rotulo="Tipo de conta">
            {(id) => (
              <select id={id} class="selecao" value={f.natureza} onChange={(e) => mudar('natureza', e.currentTarget.value as NaturezaConta)}>
                <option value="empresarial">Empresarial (CNPJ)</option><option value="pessoal">Pessoal (CPF)</option>
              </select>
            )}
          </Campo>
          <Campo rotulo="Titular" erro={erro?.campos.titular_nome}>{(id) => <input id={id} class="entrada" maxLength={120} autocomplete="off" value={f.titular_nome} onInput={(e) => mudar('titular_nome', e.currentTarget.value)} />}</Campo>
          <Campo rotulo={f.natureza === 'empresarial' ? 'CNPJ' : 'CPF'} opcional ajuda={existente?.documento ? `Atual: ${existente.documento}. Deixe vazio para manter.` : f.natureza === 'pessoal' ? 'Só os 6 dígitos do meio são guardados.' : undefined} erro={erro?.campos.documento}>
            {(id, d) => <input id={id} class="entrada" inputMode="numeric" autocomplete="off" maxLength={20} aria-describedby={d} value={f.documento ?? ''} onInput={(e) => mudar('documento', e.currentTarget.value)} />}
          </Campo>
          <Campo rotulo="Banco">{(id) => <input id={id} class="entrada" maxLength={80} value={f.instituicao} onInput={(e) => mudar('instituicao', e.currentTarget.value)} />}</Campo>
          <Campo rotulo="Código do banco" opcional>{(id) => <input id={id} class="entrada" inputMode="numeric" maxLength={3} value={f.codigo_banco ?? ''} onInput={(e) => mudar('codigo_banco', e.currentTarget.value)} />}</Campo>
          <Campo rotulo="Agência" opcional>{(id) => <input id={id} class="entrada" inputMode="numeric" maxLength={10} value={f.agencia ?? ''} onInput={(e) => mudar('agencia', e.currentTarget.value)} />}</Campo>
          <Campo rotulo="Conta" opcional ajuda={existente?.conta ? `Atual: ${existente.conta}. Só os 4 últimos dígitos são guardados.` : 'Só os 4 últimos dígitos são guardados.'}>
            {(id, d) => <input id={id} class="entrada" autocomplete="off" maxLength={20} aria-describedby={d} value={f.conta ?? ''} onInput={(e) => mudar('conta', e.currentTarget.value)} />}
          </Campo>
          <Campo rotulo="Chave Pix" opcional ajuda={existente?.chave_pix ? `Atual: ${existente.chave_pix}.` : 'Guardada só mascarada.'}>
            {(id, d) => <input id={id} class="entrada" autocomplete="off" maxLength={80} aria-describedby={d} value={f.chave_pix ?? ''} onInput={(e) => mudar('chave_pix', e.currentTarget.value)} />}
          </Campo>
        </div>
        {podePadrao && (
          <label class="linha" style={{ gap: '8px' }}>
            <input type="checkbox" checked={!!f.padrao} disabled={inativa} onChange={(e) => mudar('padrao', e.currentTarget.checked)} />
            Conta padrão de novos pagamentos
          </label>
        )}
        {existente && (
          <label class="linha" style={{ gap: '8px' }}>
            <input type="checkbox" checked={inativa} onChange={(e) => setInativa(e.currentTarget.checked)} />
            Conta inativa (continua nos lançamentos antigos)
          </label>
        )}
      </form>
    </Gaveta>
  );
}
