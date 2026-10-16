// Cliente mínimo do Chrome DevTools Protocol para Edge/Chrome headless (Node 22+, WebSocket nativo). Sem dependências.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Navegador: EDGE_PATH (ou CHROME_PATH) no ambiente; padrão = Edge no Windows.
const EDGE = process.env.EDGE_PATH || process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port = 9333, profile }) {
  const proc = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars',
    '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank',
  ], { stdio: 'ignore' });
  let info;
  for (let i = 0; i < 50 && !info; i++) {
    try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); }
  }
  if (!info) throw new Error('Edge não respondeu');
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method) listeners.forEach((l) => l(msg));
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const m = ++id; pending.set(m, { resolve, reject });
    ws.send(JSON.stringify({ id: m, method, params, sessionId }));
  });
  const browser = {
    async newPage({ width = 390, height = 844, dpr = 2, mobile = true } = {}) {
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const s = (m, p) => send(m, p, sessionId);
      await s('Page.enable'); await s('Runtime.enable');
      const logs = [];
      listeners.push((msg) => {
        if (msg.sessionId !== sessionId) return;
        if (msg.method === 'Runtime.consoleAPICalled') logs.push(`[${msg.params.type}] ` + msg.params.args.map((a) => a.value ?? a.description).join(' '));
        if (msg.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + JSON.stringify(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
      });
      const page = {
        logs,
        send: s,
        async viewport(w, h, d = dpr, mob = mobile) {
          await s('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: d, mobile: mob });
          if (mob) await s('Emulation.setTouchEmulationEnabled', { enabled: true });
        },
        async goto(url, wait = 1500) {
          await s('Page.navigate', { url });
          for (let i = 0; i < 100; i++) { if ((await page.eval('document.readyState')) === 'complete') break; await sleep(100); }
          await sleep(wait);
        },
        async eval(expression) {
          const r = await s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
          if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
          return r.result.value;
        },
        async shot(file, { fullPage = false, clip } = {}) {
          let params = { format: 'png' };
          if (clip) params = { ...params, captureBeyondViewport: true, clip: { x: clip.x, y: clip.y, width: clip.w, height: clip.h, scale: 1 } };
          if (fullPage) {
            const { cssContentSize } = await s('Page.getLayoutMetrics');
            params = { ...params, captureBeyondViewport: true, clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 } };
          }
          const { data } = await s('Page.captureScreenshot', params);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, Buffer.from(data, 'base64'));
        },
      };
      await page.viewport(width, height, dpr, mobile);
      return page;
    },
    async close() { try { await send('Browser.close'); } catch {} proc.kill(); },
  };
  return browser;
}
export { sleep };
