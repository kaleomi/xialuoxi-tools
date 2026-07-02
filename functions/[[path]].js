// 夏洛熙工具集 — Pages Functions 代理
// 运行时拦截 Turnstile.render → 强制替换为自己的 site key

const ORIGIN = 'https://imagefree.net';
const USER_SITE_KEY = '0x4AAAAAADuSr57URha6wMyK';
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

// 运行时拦截脚本：Object.defineProperty 劫持 window.turnstile.setter
// 在 Turnstile API 加载设置 window.turnstile 时，自动 patch render 方法
const PATCH_SCRIPT = '<script>(function(){var _t;Object.defineProperty(window,"turnstile",{configurable:true,enumerable:true,get:function(){return _t},set:function(v){if(v&&typeof v.render==="function"){var r=v.render.bind(v);v.render=function(c,p){if(p&&typeof p==="object"){p.sitekey="' + USER_SITE_KEY + '"}return r(c,p)}}_t=v}})})()<\/script>';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 首页
  if (path === '/' || path === '/index.html') {
    return context.next();
  }

  // API 请求：透传
  if (path.startsWith('/api/')) {
    const apiUrl = ORIGIN + path;
    const method = request.method;
    const hdrs = new Headers(request.headers);
    hdrs.set('User-Agent', UA);
    hdrs.set('Referer', ORIGIN + '/zh');
    hdrs.set('Origin', ORIGIN);
    hdrs.delete('Host');
    const apiResp = await fetch(apiUrl, {
      method, headers: hdrs,
      body: method !== 'GET' && method !== 'HEAD' ? request.body : undefined,
    });
    return new Response(apiResp.body, {
      status: apiResp.status,
      headers: { 'Content-Type': apiResp.headers.get('content-type') || 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // 工具页面
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
      // 注入拦截脚本（在 Turnstile API 加载之前执行）
      body = body.replace('</head>', PATCH_SCRIPT + HIDE_CSS + '</head>');
    }

    return new Response(body, {
      headers: { 'Content-Type': ct.includes('text/html') ? 'text/html; charset=utf-8' : ct, 'Access-Control-Allow-Origin': '*' },
    });
  }

  // 静态资源代理（直接透传，不需要替换）
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
