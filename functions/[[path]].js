// 夏洛熙工具集 — Pages Functions 代理
// 拦截所有非静态文件请求，代理到 imagefree.net + 注入 CSS + 替换 Turnstile Key

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

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // ── 首页：让 Pages 静态文件服务处理 ──
  if (path === '/' || path === '/index.html') {
    return context.next();
  }

  // ── 工具代理 ──
  if (path.startsWith('/proxy/')) {
    const toolName = path.slice(7);
    const targetUrl = TOOLS[toolName];
    if (!targetUrl) return new Response('Not found', { status: 404 });

    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Referer: ORIGIN + '/zh',
      },
    });

    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('text/html')) {
      return new Response(resp.body, {
        status: resp.status,
        headers: { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*' },
      });
    }

    // HTMLRewriter：注入 CSS + 替换 Turnstile Key
    return new HTMLRewriter()
      .on('head', { element(el) { el.append(HIDE_CSS, { html: true }); } })
      .on('[data-sitekey]', {
        element(el) {
          const key = el.getAttribute('data-sitekey');
          if (key && (key.startsWith('0x4') || key.startsWith('0x3'))) {
            el.setAttribute('data-sitekey', USER_SITE_KEY);
          }
        },
      })
      .transform(resp);
  }

  // ── 静态资源（_next/static, favicon 等）直接从 imagefree.net 代理 ──
  const resourceUrl = ORIGIN + path;
  const res = await fetch(resourceUrl, {
    headers: {
      'User-Agent': UA,
      Accept: '*/*',
      Referer: ORIGIN + '/zh',
    },
  });

  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
