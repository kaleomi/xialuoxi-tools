// 夏洛熙工具集 — Pages Functions 代理
// 暴力替换所有文本响应中的 site key + API 自行验证

const ORIGIN = 'https://imagefree.net';

const KEY_TEST = '1x0000000000000000000000000000000AA';
const KEY_ORIG = '0x4AAAAAACE-XLGoQUckKKm_';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TOOLS = {
  t2i: 'https://imagefree.net/zh/',
  rmBg: 'https://imagefree.net/zh/background-remover',
  upscaler: 'https://imagefree.net/zh/image-upscaler',
  editor: 'https://imagefree.net/zh/ai-photo-editor',
};

const HIDE_CSS = `<style>
nav,footer,[class*="ad-"],[class*="ad_"],[id*="ad-"],[id*="ad_"],ins.adsbygoogle{display:none!important}
.min-h-screen>section~section{display:none!important}
body{margin:0!important;background:#f5f5f7!important}
.min-h-screen>section:first-of-type{min-height:100vh!important;display:flex!important;align-items:flex-start!important;padding-top:16px!important}
.min-h-screen>section:first-of-type>div{width:100%!important;max-width:100%!important}
.min-h-screen{min-height:100vh!important}
.min-h-screen>section:first-of-type .text-center.mb-8{margin-bottom:.5rem!important}
.min-h-screen>section:first-of-type h1.text-4xl{font-size:1.25rem!important;margin-bottom:.25rem!important}
.min-h-screen>section:first-of-type p.text-lg{font-size:.8rem!important;margin-bottom:.5rem!important}
</style>`;

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const search = url.search; // 保留 query 参数（如 ?dpl=xxx）

  // 首页
  if (path === '/' || path === '/index.html') {
    return context.next();
  }

  // ── API 代理 ──
  if (path.startsWith('/api/')) {
    const method = request.method;
    let bodyRaw = null;
    if (method !== 'GET' && method !== 'HEAD') bodyRaw = await request.text();

    if (bodyRaw) {
      try {
        const bodyObj = JSON.parse(bodyRaw);
        const token = bodyObj.turnstile_token;
        if (token) {
          const verifyResp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'secret=' + KEY_TEST + '&response=' + encodeURIComponent(token),
          });
          const verifyResult = await verifyResp.json();
          if (!verifyResult.success) {
            return new Response(JSON.stringify({ error: 'Human verification failed. Please complete the setup or refresh the page to try again.' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
          }
        }
      } catch (e) {}
    }

    const apiUrl = ORIGIN + path;
    const hdrs = new Headers(request.headers);
    hdrs.set('User-Agent', UA);
    hdrs.set('Referer', ORIGIN + '/zh');
    hdrs.set('Origin', ORIGIN);
    hdrs.delete('Host');

    const apiResp = await fetch(apiUrl, { method, headers: hdrs, body: method !== 'GET' && method !== 'HEAD' ? bodyRaw : undefined });

    return new Response(apiResp.body, {
      status: apiResp.status,
      headers: { 'Content-Type': apiResp.headers.get('content-type') || 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // ── 工具页面 ──
  if (path.startsWith('/proxy/')) {
    const toolName = path.slice(7);
    const targetUrl = TOOLS[toolName];
    if (!targetUrl) return new Response('Not found', { status: 404 });

    const resp = await fetch(targetUrl, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'zh-CN,zh;q=0.9', Referer: ORIGIN + '/zh' },
    });

    const ct = resp.headers.get('content-type') || '';
    let body = await resp.text();

    body = body.replaceAll(KEY_ORIG, KEY_TEST);
    if (ct.includes('text/html')) {
      body = body.replace('</head>', HIDE_CSS + '</head>');
    }

    return new Response(body, {
      headers: { 'Content-Type': ct.includes('text/html') ? 'text/html; charset=utf-8' : ct, 'Access-Control-Allow-Origin': '*' },
    });
  }

  // ── 静态资源（带 query params 转发）──
  const resourceUrl = ORIGIN + path + search;
  const res = await fetch(resourceUrl, {
    headers: { 'User-Agent': UA, Accept: '*/*', Referer: ORIGIN + '/zh' },
  });
  const ct = res.headers.get('content-type') || '';

  // 所有文本类型都替换 site key
  if (ct.includes('text/') || ct.includes('javascript') || ct.includes('ecmascript') || path.endsWith('.js')) {
    let textBody = await res.text();
    textBody = textBody.replaceAll(KEY_ORIG, KEY_TEST);
    return new Response(textBody, { headers: { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*' } });
  }

  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*' },
  });
}
