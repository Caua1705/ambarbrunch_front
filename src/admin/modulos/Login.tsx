// Formulário de entrada. Recuperação de senha não existe no backend (usuários são criados pela CLI): a tela diz isso.
import { useState } from 'preact/hooks';
import { LogIn, AlertCircle, Eye, EyeOff, PlugZap } from 'lucide-preact';
import { Botao, Campo, Aviso } from '../ui/base';
import { NOME_PAPEL, type ModoPainel, type Papel } from '../lib/sessao';

export default function Login({ modo, volta }: { modo: ModoPainel; volta: string }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ajuda, setAjuda] = useState(false);

  async function entrar(corpo: Record<string, string>, quem: string) {
    setEnviando(quem);
    setErro(null);
    try {
      const r = await fetch('/admin/api/sessao', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Painel': '1' }, body: JSON.stringify(corpo), credentials: 'same-origin' });
      if (r.ok) {
        location.assign(volta);
        return;
      }
      const j = (await r.json().catch(() => ({}))) as { detail?: string };
      setErro(j.detail ?? 'Não foi possível entrar.');
    } catch {
      setErro('Sem conexão. Confira a internet e tente de novo.');
    }
    setEnviando(null);
  }

  if (modo === 'indisponivel') {
    return (
      <div class="cartao">
        <div class="cartao__corpo">
          <Aviso tom="atencao" icone={<PlugZap aria-hidden="true" />}>
            <strong>O painel ainda não está conectado ao sistema do Âmbar.</strong>
            <br />
            Ninguém consegue entrar até a configuração do servidor ser concluída (PAINEL_MODO=api e PAINEL_API_URL).
          </Aviso>
        </div>
      </div>
    );
  }

  if (modo === 'demo') {
    return (
      <div class="cartao">
        <div class="cartao__corpo">
          <div>
            <h1 style={{ fontSize: '18px' }}>Entrar na demonstração</h1>
            <p class="suave pequeno" style={{ marginTop: '4px' }}>Escolha um perfil para ver o que cada um enxerga. Os dados são fictícios.</p>
          </div>
          {(['gerente', 'operador', 'admin'] as Papel[]).map((p) => (
            <Botao key={p} variante={p === 'gerente' ? 'primario' : 'secundario'} bloco carregando={enviando === p} disabled={!!enviando} onClick={() => entrar({ demo: p }, p)}>
              Entrar como {NOME_PAPEL[p]}
            </Botao>
          ))}
          {erro && <Aviso tom="perigo" icone={<AlertCircle aria-hidden="true" />}>{erro}</Aviso>}
        </div>
      </div>
    );
  }

  return (
    <form
      class="cartao"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim() || !senha) {
          setErro('Informe e-mail e senha.');
          return;
        }
        entrar({ email: email.trim(), senha }, 'login');
      }}
    >
      <div class="cartao__corpo">
        <h1 style={{ fontSize: '18px' }}>Entrar</h1>
        <Campo rotulo="E-mail">
          {(id) => <input id={id} class="entrada" type="email" autocomplete="username" inputMode="email" required value={email} onInput={(e) => setEmail(e.currentTarget.value)} autoFocus />}
        </Campo>
        <Campo rotulo="Senha">
          {(id) => (
            <div class="entrada-grupo">
              <input id={id} class="entrada" type={(ver ? 'text' : 'password') as 'text'} autocomplete="current-password" required value={senha} onInput={(e) => setSenha(e.currentTarget.value)} style={{ paddingRight: '44px' }} />
              <button type="button" class="btn btn--fantasma btn--p btn--icone" style={{ position: 'absolute', right: '4px' }} onClick={() => setVer(!ver)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'} aria-pressed={ver}>
                {ver ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
          )}
        </Campo>
        {erro && <Aviso tom="perigo" icone={<AlertCircle aria-hidden="true" />}>{erro}</Aviso>}
        <Botao type="submit" variante="primario" bloco carregando={enviando === 'login'} icone={<LogIn aria-hidden="true" />}>
          Entrar
        </Botao>
        <button type="button" class="btn btn--fantasma btn--p" onClick={() => setAjuda(!ajuda)} aria-expanded={ajuda}>
          Esqueci minha senha
        </button>
        {ajuda && (
          <p class="fraco">
            Por segurança, as senhas da equipe são definidas pelo administrador do sistema. Peça a ele uma nova senha — o painel não envia redefinição por e-mail.
          </p>
        )}
      </div>
    </form>
  );
}
