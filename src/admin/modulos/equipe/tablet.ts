// Equipe no tablet do café (o gestor cadastra e corrige ali, na frente do funcionário). No Android, o teclado cobre a parte de
// baixo da tela sem encolher a página: a gaveta e os diálogos passam a ocupar só a área visível, e o campo tocado rola para o
// meio. Vale só enquanto a área Equipe (ou Configurações → Ponto) está aberta: marca <html data-equipe> e desfaz ao sair.
import { useEffect } from 'preact/hooks';

export function useTecladoNaTela() {
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.setAttribute('data-equipe', '');
    const vv = window.visualViewport;
    const ajustar = () => {
      if (!vv) return;
      raiz.style.setProperty('--equipe-vv-altura', `${Math.round(vv.height)}px`);
      raiz.style.setProperty('--equipe-vv-topo', `${Math.round(vv.offsetTop)}px`);
    };
    let espera: ReturnType<typeof setTimeout> | undefined;
    const aoFocar = (e: FocusEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (!alvo?.matches?.('input, select, textarea') || !alvo.closest('.gaveta, .dialogo')) return;
      clearTimeout(espera);
      // O teclado leva alguns centésimos para subir; só então dá para saber onde o campo ficou.
      espera = setTimeout(() => alvo.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320);
    };
    ajustar();
    vv?.addEventListener('resize', ajustar);
    vv?.addEventListener('scroll', ajustar);
    document.addEventListener('focusin', aoFocar);
    return () => {
      clearTimeout(espera);
      vv?.removeEventListener('resize', ajustar);
      vv?.removeEventListener('scroll', ajustar);
      document.removeEventListener('focusin', aoFocar);
      raiz.removeAttribute('data-equipe');
      raiz.style.removeProperty('--equipe-vv-altura');
      raiz.style.removeProperty('--equipe-vv-topo');
    };
  }, []);
}
