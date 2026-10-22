/** @jsxImportSource preact */
// Ficha de inscrição do Clube Âmbar — ilha Preact.
// Modos:
//  - "indisponivel" (padrão): a ficha aparece com os campos DESLIGADOS (ninguém digita dado que não vai a lugar nenhum),
//    o botão diz “Inscrições em breve” e nada é enviado nem guardado.
//  - "api": dados → código no telefone → bem-vindo. A adesão só existe quando a API confirma o código; o navegador não
//    calcula, não guarda e não presume nada (sem localStorage, sem sessão própria).
// Só dois dados: nome e telefone. O aceite do regulamento é obrigatório; a autorização de novidades é OPCIONAL, desmarcada
// e separada — entrar no Clube não depende dela.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Carteira from '../components/Carteira';
import { PassoCodigo } from './clube-partes';
import { ErroClube, type ClubeApi, type ClubeConfig, type DesafioCodigo, type Membro, type OrigemCadastro } from '../lib/api/clube-contrato';
import { criarClubeHttp } from '../lib/api/clube-http';
import { origemDaVisita } from '../lib/clube-origem';
import { mascaraTel, soDigitos, telefoneValido, uuid } from '../lib/telefone';
import type { ModoClube } from '../lib/clube-modo';

export type EtapaFicha = 'carregando' | 'fechado' | 'dados' | 'enviando' | 'codigo' | 'verificando' | 'bem-vindo' | 'falha';
interface Dados { nome: string; telefone: string; aceite: boolean; marketing: boolean }
/** Estado forçado — SÓ para a página interna de estados (/clube/estados/, build de revisão). Nada é enviado. */
export interface DemoFicha {
  etapa: EtapaFicha;
  dados?: Partial<Dados>;
  erros?: Record<string, string>;
  falha?: string;
  desafio?: DesafioCodigo;
  membro?: Membro;
  origem?: OrigemCadastro;
}
interface Props {
  modo: ModoClube;
  apiUrl?: string;
  privacidadeUrl: string;
  /** prefixo dos ids (várias fichas na mesma página) */
  ids?: string;
  demo?: DemoFicha;
}

const DIGITOS_PADRAO = 6;

function validar(d: Dados): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.nome.trim().length < 2) e.nome = 'Diga como podemos chamar você.';
  if (!telefoneValido(d.telefone)) e.telefone = 'Confira o número com DDD (10 ou 11 dígitos).';
  if (!d.aceite) e.aceite = 'Para entrar no Clube, é preciso aceitar o regulamento.';
  return e;
}

/** Linha discreta sobre a origem (transparência da atribuição): só para quem chegou pela mesa ou pelo convite da reserva. */
function textoOrigem(o: OrigemCadastro | null) {
  if (!o) return '';
  if ((o.canal === 'nfc' || o.canal === 'qr') && o.mesa) return `inscrição pela mesa ${o.mesa}`;
  if (o.canal === 'nfc' || o.canal === 'qr') return 'inscrição pela plaquinha da mesa';
  if (o.canal === 'reserva') return 'convite da sua reserva';
  return '';
}

export default function ClubeCadastro({ modo, apiUrl, privacidadeUrl, ids: px = 'cf', demo }: Props) {
  const api: ClubeApi | null = useMemo(() => (!demo && modo === 'api' && apiUrl ? criarClubeHttp(apiUrl) : null), [modo, apiUrl]);
  const [cfg, setCfg] = useState<ClubeConfig | null>(null);
  const [etapa, setEtapa] = useState<EtapaFicha>(demo?.etapa ?? (api ? 'carregando' : 'fechado'));
  const [dados, setDados] = useState<Dados>({ nome: '', telefone: '', aceite: false, marketing: false, ...demo?.dados });
  const [erros, setErros] = useState<Record<string, string>>(demo?.erros ?? {});
  const [falha, setFalha] = useState(demo?.falha ?? '');
  const [jaMembro, setJaMembro] = useState(false);
  const [desafio, setDesafio] = useState<DesafioCodigo | null>(demo?.desafio ?? null);
  const [erroCodigo, setErroCodigo] = useState(demo?.erros?.codigo ?? '');
  const [membro, setMembro] = useState<Membro | null>(demo?.membro ?? null);
  const [origem, setOrigem] = useState<OrigemCadastro | null>(demo?.origem ?? null);
  const [anuncio, setAnuncio] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const chave = useRef(uuid());
  const topo = useRef<HTMLParagraphElement>(null);

  // Origem (NFC/QR da mesa, convite da reserva, UTM): só no navegador.
  useEffect(() => { if (!demo) setOrigem(origemDaVisita()); }, []);
  // Regras vigentes vindas da API: sem inscrições abertas ou sem regulamento publicado, a ficha continua fechada.
  useEffect(() => {
    if (!api) return;
    setEtapa('carregando');
    api.config()
      .then((c) => { setCfg(c); setEtapa(c.inscricoesAbertas && c.regulamento ? 'dados' : 'fechado'); })
      .catch((e) => { setFalha(e instanceof ErroClube ? e.message : 'Não foi possível abrir a ficha.'); setEtapa('falha'); });
  }, [api, tentativa]);
  // Foco no título a cada troca de etapa (leitor de tela e teclado); não na montagem.
  const montou = useRef(false);
  useEffect(() => { if (!montou.current) { montou.current = true; return; } if (etapa === 'codigo' || etapa === 'bem-vindo' || etapa === 'falha') topo.current?.focus(); }, [etapa]);

  const digitos = cfg?.codigo.digitos ?? DIGITOS_PADRAO;
  const aberta = etapa === 'dados';
  const mudar = (campo: keyof Dados) => (ev: Event) => {
    const alvo = ev.currentTarget as HTMLInputElement;
    const valor = campo === 'aceite' || campo === 'marketing' ? alvo.checked : campo === 'telefone' ? mascaraTel(alvo.value) : alvo.value;
    setDados((d) => ({ ...d, [campo]: valor }));
    if (erros[campo]) setErros((e) => { const n = { ...e }; delete n[campo]; return n; });
    if (campo === 'telefone') setJaMembro(false);
  };

  const pedirAdesao = async () => {
    if (!api || !cfg?.regulamento) return;
    try {
      const d = await api.aderir({
        nome: dados.nome.trim(), telefone: soDigitos(dados.telefone),
        aceiteRegulamento: true, regulamentoVersao: cfg.regulamento.versao,
        marketing: { autorizado: dados.marketing }, origem: origem ?? { canal: 'site' },
      }, chave.current);
      setDesafio(d); setErroCodigo(''); setEtapa('codigo');
      setAnuncio(`Código enviado para ${d.destino}.`);
    } catch (e) {
      const erro = e instanceof ErroClube ? e : new ErroClube('servidor', 'Não foi possível concluir. Tente de novo em instantes.');
      if (erro.tipo === 'ja-membro') { setJaMembro(true); setFalha(erro.message); setEtapa('dados'); setAnuncio(erro.message); return; }
      if (erro.tipo === 'validacao') { setErros(erro.campos); setFalha(Object.keys(erro.campos).length ? '' : erro.message); setEtapa('dados'); setAnuncio('Confira os campos destacados.'); return; }
      if (erro.tipo === 'fechado') { setEtapa('fechado'); setAnuncio(erro.message); return; }
      setFalha(erro.message); setEtapa(desafio ? 'codigo' : 'falha'); setAnuncio(erro.message);
    }
  };

  const enviar = (ev: Event) => {
    ev.preventDefault();
    if (!api || etapa !== 'dados') return;
    const e = validar(dados);
    setErros(e); setFalha(''); setJaMembro(false);
    if (Object.keys(e).length) {
      setAnuncio('Confira os campos destacados.');
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`#${px}-${Object.keys(e)[0]}`)?.focus());
      return;
    }
    chave.current = uuid();
    setEtapa('enviando'); setAnuncio('Enviando…');
    pedirAdesao();
  };

  const confirmar = async (codigo: string) => {
    if (!api || !desafio) return;
    setEtapa('verificando'); setErroCodigo('');
    try {
      const m = await api.verificar(desafio.desafioId, codigo);
      setMembro(m); setEtapa('bem-vindo'); setAnuncio('Pronto! Você entrou no Clube Âmbar.');
    } catch (e) {
      const erro = e instanceof ErroClube ? e : new ErroClube('servidor', 'Não foi possível confirmar. Tente de novo.');
      setEtapa('codigo');
      setErroCodigo(erro.tipo === 'validacao' ? (erro.campos.codigo ?? 'Código incorreto. Confira e tente de novo.') : erro.message);
      setAnuncio(erro.message);
    }
  };

  const carimbo = etapa === 'bem-vindo' ? { estado: 'reservado', texto: 'membro' }
    : etapa === 'falha' ? { estado: 'erro', texto: 'tente de novo' }
    : etapa === 'codigo' || etapa === 'verificando' ? { estado: undefined, texto: 'quase lá' }
    : { estado: undefined, texto: etapa === 'fechado' ? 'em breve' : 'ficha' };
  const titulo = etapa === 'bem-vindo' ? 'Bem-vindo ao Clube' : etapa === 'codigo' || etapa === 'verificando' ? 'Confirme seu telefone' : 'Ficha de inscrição';
  const regulamento = cfg?.regulamento;
  const origemTexto = textoOrigem(origem);
  /** canais de novidades vêm da API (nenhum canal presumido): “no WhatsApp”, “por e-mail”… */
  const canais = cfg?.marketing.canais.map((c) => (c === 'whatsapp' ? 'no WhatsApp' : 'por e-mail')).join(' e ');
  const nota = `${px}-nota`;

  return (
    <form class="ticket ficha" data-etapa={etapa} data-modo={api ? 'api' : demo ? 'demo' : 'indisponivel'} onSubmit={enviar} noValidate aria-describedby={nota} aria-busy={etapa === 'enviando' || etapa === 'verificando' || etapa === 'carregando'}>
      <div class="stamp ticket__stamp" data-state={carimbo.estado} aria-hidden="true">{carimbo.texto}</div>
      <p class="ticket__title" ref={topo} tabIndex={-1}>{titulo}</p>
      {origemTexto && etapa !== 'bem-vindo' && <p class="ficha__origem">{origemTexto}</p>}

      {(etapa === 'fechado' || etapa === 'carregando' || etapa === 'dados' || etapa === 'enviando') && (
        <>
          {falha && <p class="ticket__status" data-tone="error" role="alert">
            {falha}{jaMembro && <> <a class="ticket__link" href="/clube/membro/">Entrar na carteira</a></>}
          </p>}
          <fieldset class="ficha__dados" disabled={!aberta}>
            <legend>01 · seus dados</legend>
            <div class="ticket__fields">
              <label class="field" data-invalid={erros.nome ? '' : undefined}>
                <span class="field__label">Nome</span>
                <input id={`${px}-nome`} class="field__input" autocomplete="name" value={dados.nome} onInput={mudar('nome')}
                  placeholder={aberta ? undefined : 'Como podemos chamar você'} aria-invalid={!!erros.nome} aria-describedby={erros.nome ? `${px}-nome-erro` : undefined} />
                <span class="field__error" id={`${px}-nome-erro`}>{erros.nome}</span>
              </label>
              <label class="field" data-invalid={erros.telefone ? '' : undefined}>
                <span class="field__label">Celular</span>
                <input id={`${px}-telefone`} class="field__input" type="tel" inputMode="tel" autocomplete="tel-national" placeholder="(00) 00000-0000"
                  value={dados.telefone} onInput={mudar('telefone')} aria-invalid={!!erros.telefone}
                  aria-describedby={`${px}-telefone-dica${erros.telefone ? ` ${px}-telefone-erro` : ''}`} />
                <span class="field__hint" id={`${px}-telefone-dica`}>É o seu número de membro: com ele você entra na carteira, sem senha.</span>
                <span class="field__error" id={`${px}-telefone-erro`}>{erros.telefone}</span>
              </label>
            </div>
          </fieldset>
          <fieldset class="ficha__aceites" disabled={!aberta}>
            <legend>02 · regulamento</legend>
            <label class="check" data-invalid={erros.aceite ? '' : undefined}>
              <input id={`${px}-aceite`} type="checkbox" checked={dados.aceite} onChange={mudar('aceite')} aria-invalid={!!erros.aceite} aria-describedby={`${px}-aceite-erro`} />
              <span>Li e aceito o {regulamento ? <a href={regulamento.url} target="_blank" rel="noopener">regulamento do Clube</a> : 'regulamento do Clube'} e
                a <a href={privacidadeUrl}>política de privacidade</a>.</span>
            </label>
            {erros.aceite && <span class="field__error field__error--block" id={`${px}-aceite-erro`}>{erros.aceite}</span>}
          </fieldset>
          <fieldset class="ficha__opcional" disabled={!aberta}>
            <legend>03 · novidades <small>(opcional)</small></legend>
            <label class="check">
              <input id={`${px}-marketing`} type="checkbox" checked={dados.marketing} onChange={mudar('marketing')} aria-describedby={`${px}-marketing-dica`} />
              <span>Quero receber novidades e promoções do Âmbar{canais && ` ${canais}`}.</span>
            </label>
            <p class="ticket__slots" id={`${px}-marketing-dica`}>Separado do Clube: você entra com ou sem esta opção e pode desligar quando quiser.</p>
          </fieldset>
          {etapa === 'dados'
            ? <button class="btn btn--wine btn--block" type="submit">Entrar no Clube</button>
            : <button class="btn btn--wine btn--block" type="button" disabled>
                {etapa === 'enviando' ? 'Enviando…' : etapa === 'carregando' ? 'Abrindo a ficha…' : 'Inscrições em breve'}
              </button>}
        </>
      )}

      {(etapa === 'codigo' || etapa === 'verificando') && desafio && (
        <>
          {falha && <p class="ticket__status" data-tone="error" role="alert">{falha}</p>}
          <PassoCodigo px={px} desafio={desafio} digitos={digitos} ocupado={etapa === 'verificando'} erro={erroCodigo}
            aoConfirmar={confirmar}
            aoReenviar={() => { setFalha(''); chave.current = uuid(); pedirAdesao(); }}
            aoTrocarNumero={() => { setDesafio(null); setErroCodigo(''); setFalha(''); setEtapa('dados'); }} />
        </>
      )}

      {etapa === 'bem-vindo' && membro && (
        <>
          <p class="ticket__status" role="status">Pronto, {membro.nome.split(' ')[0]}! Você já é do Clube Âmbar.</p>
          <Carteira estado="membro" nome={membro.nome} numero={membro.numero} pontos={membro.saldo?.pontos ?? null} class="ficha__carteira" />
          <div class="ticket__actions">
            <a class="btn btn--wine btn--block" href="/clube/membro/">Abrir minha carteira</a>
          </div>
          {membro.marketing.autorizado && <p class="ticket__slots">Você autorizou receber novidades. Dá para desligar na carteira.</p>}
        </>
      )}

      {etapa === 'falha' && (
        <>
          <p class="ticket__status" data-tone="error" role="alert">{falha}</p>
          <button class="btn btn--wine btn--block" type="button" onClick={() => { setFalha(''); setTentativa((t) => t + 1); }}>Tentar de novo</button>
        </>
      )}

      <p class="ticket__note" id={nota}>
        {etapa === 'fechado' && (api ? 'As inscrições abrem quando o regulamento do Clube for publicado.' : 'As inscrições no Clube ainda não estão abertas. Nada é enviado.')}
        {etapa === 'dados' && 'Antes de entrar, você confirma o telefone com um código.'}
        {etapa === 'bem-vindo' && 'Sua carteira abre no navegador, quando você quiser.'}
      </p>
      <p class="visually-hidden" aria-live="polite">{anuncio}</p>
    </form>
  );
}
