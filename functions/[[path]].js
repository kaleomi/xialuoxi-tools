// 夏洛熙工具集 — Pages Functions 代理
// 运行时拦截 Turnstile + 测试密钥（always pass） + API 自行验证

const ORIGIN = 'https://imagefree.net';

// Turnstile 测试密钥（always pass）：任何后端验证都通过
const TEST_SITE_KEY = '1x0000000000000000000000000000000AA';
const TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

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

// 运行时拦截：劫持 window.turnstile.setter，强制覆盖 siteKey 为测试密钥
const PATCH_SCRIPT = '<script>(function(){var _t;Object.defineProperty(window,"turnstile",{configurable:true,enumerable:true,get:function(){return _t},set:function(v){if(v&&typeof v.render==="function"){var r=v.render.bind(v);v.render=function(c,p){if(p&&typeof p==="object")p.sitekey="' + TEST_SITE_KEY + '";return r(c,p)}}_t=v}})})()<\/script>';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 首页
  if (path === '/' || path === '/index.html') {
    return context.next();
  }

  // ── API 代理 ──
  if (path.startsWith('/api/')) {
    const method = request.method;
    let bodyRaw = null;
    if (method !== 'GET' && method !== 'HEAD') {
      bodyRaw = await request.text();
    }

    // 解析 JSON 并验证 turnstile_token
    if (bodyRaw) {
      try {
        const bodyObj = JSON.parse(bodyRaw);
        const token = bodyObj.turnstile_token;
        if (token) {
          // 自行验证 token（用测试密钥，always pass）
          const verifyResp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'secret=' + TEST_SECRET_KEY + '&response=' + encodeURIComponent(token),
          });
          const verifyResult = await verifyResp.json();
          if (!verifyResult.success) {
            return new Response(JSON.stringify({ error: 'Human verification failed. Please complete the setup or refresh the page to try again.' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
          }
          // 验证通过！保持 token 原样转发（测试密钥的 token 在 imagefree 后端也能通过）
        }
      } catch (e) {
        // 解析失败，继续透传
      }
    }

    const apiUrl = ORIGIN + path;
    const hdrs = new Headers(request.headers);
    hdrs.set('User-Agent', UA);
    hdrs.set('Referer', ORIGIN + '/zh');
    hdrs.set('Origin', ORIGIN);
    hdrs.delete('Host');

    const apiResp = await fetch(apiUrl, {
      method, headers: hdrs,
      body: method !== 'GET' && method !== 'HEAD' ? bodyRaw : undefined,
    });

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

    let body = await resp.text();
    const ct = resp.headers.get('content-type') || '';

    if (ct.includes('text/html')) {
      body = body.replace('</head>', PATCH_SCRIPT + HIDE_CSS + '</head>');
    }

    return new Response(body, {
      headers: { 'Content-Type': ct.includes('text/html') ? 'text/html; charset=utf-8' : ct, 'Access-Control-Allow-Origin': '*' },
    });
  }

  // ── 静态资源 ──
  const resourceUrl = ORIGIN + path;
  const res = await fetch(resourceUrl, {
    headers: { 'User-Agent': UA, Accept: '*/*', Referer: ORIGIN + '/zh' },
  });
  const ct = res.headers.get('content-type') || '';
  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*' },
  });
}
