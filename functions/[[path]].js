// Cloudflare Pages Function — 代理 imagefree.net
// 1. 注入 CSS 隐藏导航/广告
// 2. 替换 Turnstile site key 为你的 Key，验证通过
const ORIGIN = 'https://imagefree.net';

const TOOLS = {
  t2i:      'https://imagefree.net/zh/',
  rmBg:     'https://imagefree.net/zh/background-remover',
  upscaler: 'https://imagefree.net/zh/image-upscaler',
  editor:   'https://imagefree.net/zh/ai-photo-editor',
};

// ↓↓↓ 你的 Turnstile Site Key （已注册到 xialuoxi-tools.pages.dev） ↓↓↓
const USER_SITE_KEY = '0x4AAAAAADuSr57URha6wMyK';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ── CSS：隐藏导航、页脚、广告等 ──
const INJECT_CSS = `<style>
nav,footer{display:none!important}
.min-h-screen>section~section{display:none!important}
ins.adsbygoogle,[class*="ad-"],[class*="ad_"],[id*="ad-"],[id*="ad_"],iframe[src*="ads"]{display:none!important}
body{margin:0!important;background:#f5f5f7!important}
.min-h-screen>section:first-of-type{min-height:100vh!important;display:flex!important;align-items:flex-start!important;padding-top:16px!important}
.min-h-screen>section:first-of-type>div{width:100%!important;max-width:100%!important}
.min-h-screen{min-height:100vh!important}
.min-h-screen>section:first-of-type .text-center.mb-8{margin-bottom:.5rem!important}
.min-h-screen>section:first-of-type h1.text-4xl{font-size:1.25rem!important;margin-bottom:.25rem!important}
.min-h-screen>section:first-of-type p.text-lg{font-size:.8rem!important;margin-bottom:.5rem!important}
</style>`;

// ── HTMLRewriter：向 <head> 追加 CSS ──
class CssInjector {
  element(el) { el.append(INJECT_CSS, { html: true }); }
}

// ── HTMLRewriter：替换所有 data-sitekey 属性 ──
class KeyReplacer {
  element(el) {
    const key = el.getAttribute('data-sitekey');
    if (key && (key.startsWith('0x4') || key.startsWith('0x3'))) {
      el.setAttribute('data-sitekey', USER_SITE_KEY);
    }
  }
}

export async function onRequest(context) {
  const { params } = context;
  // [[path]] 捕获的是数组，需 join
  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');

  // 根路径 → Pages 静态文件（index.html）
  if (path === '') return context.next();

  // ── 1. 工具页面代理：/proxy/t2i, /proxy/rmBg 等 ──
  if (path.startsWith('proxy/')) {
    const toolName = path.slice(6);
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
        headers: { 'Content-Type': ct },
      });
    }

    // ── 核心：HTMLRewriter 同时做两件事 ──
    const rewriter = new HTMLRewriter()
      .on('head', new CssInjector())
      .on('[data-sitekey]', new KeyReplacer());

    return rewriter.transform(resp);
  }

  // ── 2. 静态资源代理（_next/static/*, favicon.ico 等） ──
  const resourceUrl = ORIGIN + '/' + path;
  const res = await fetch(resourceUrl, {
    headers: {
      'User-Agent': UA,
      Accept: '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      Referer: ORIGIN + '/zh',
    },
  });

  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') || 'application/octet-stream' },
  });
}
