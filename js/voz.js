// voz.js — ditado por voz com a Web Speech API do Chrome (gratuita, sem chave).
// No Chrome o áudio é transcrito pelo serviço de voz do Google (precisa de internet).

const Reconhecedor = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const suportaVoz = () => !!Reconhecedor;

/**
 * Inicia o ditado em português. `aoTexto(textoFinal, parcial)` é chamado a cada trecho; `aoFim(erro?)` ao terminar.
 * Devolve uma função para parar.
 */
export function ditar(aoTexto, aoFim) {
  const r = new Reconhecedor();
  r.lang = 'pt-BR';
  r.interimResults = true;
  r.continuous = true;
  let final = '';
  r.onresult = (e) => {
    let parcial = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
      else parcial += e.results[i][0].transcript;
    }
    aoTexto(final.trim(), parcial.trim());
  };
  let erro = null;
  r.onerror = (e) => {
    erro = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Permita o microfone para ditar.'
      : e.error === 'network' ? 'O ditado precisa de internet.'
      : e.error === 'no-speech' ? 'Não ouvi nada. Tente de novo.' : null;
  };
  r.onend = () => aoFim?.(erro);
  try { r.start(); } catch { aoFim?.('Não foi possível iniciar o microfone.'); }
  return () => { try { r.stop(); } catch {} };
}
