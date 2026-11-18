// A câmera falsa do Chromium repete quadros idênticos (byte a byte), o que o backend recusa como reenvio
// (captura_repetida). Uma câmera de verdade nunca repete: aqui, um pixel aleatório faz o papel do ruído do sensor, em
// qualquer codificação do quadro (toBlob, de antes de 18/11/2026, e toDataURL, de depois).
export function ruidoDeSensor() {
  const sujar = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`;
    ctx.fillRect(Math.floor(Math.random() * canvas.width), Math.floor(Math.random() * canvas.height), 2, 2);
  };
  const toBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function (this: HTMLCanvasElement, ...args: Parameters<HTMLCanvasElement['toBlob']>) {
    sujar(this);
    return toBlob.apply(this, args);
  };
  const toDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (this: HTMLCanvasElement, ...args: Parameters<HTMLCanvasElement['toDataURL']>) {
    sujar(this);
    return toDataURL.apply(this, args);
  };
}
