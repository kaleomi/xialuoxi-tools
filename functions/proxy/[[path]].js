// Cloudflare Pages Function — 代理 imagefree.net 页面并注入 CSS 隐藏多余元素
const ORIGIN = 'https://imagefree.net';

const TOOLS = {
  t2i:      'https://imagefree.net/zh/',
  rmBg:     'https://imagefree.net/zh/background-remover',
  upscaler: 'https://imagefree.net/zh/image-upscaler',
  editor:   'https://imagefree.net/zh/ai-photo-editor',
};

// ── 注入的 CSS：隐藏导航、页脚、广告等，只保留第一个 section ──
const INJECT_CSS = `<!-- proxy:imagefree -->
<style>
  nav { display: none !important; }
  footer { display: none !important; }
  .min-h-screen > section ~ section { display: none !important; }
  ins.adsbygoogle { display: none !important; }
  [class*="ad-"], [class*="ad_"], [id*="ad-"], [id*="ad_"] { display: none !important; }
  body { margin: 0 !important; background: #f5f5f7 !important; }
  .min-h-screen > section:first-of-type {
    min-height: 100vh !important;
    display: flex !important;
    align-items: flex-start !important;
    padding-top: 16px !important;
  }
  .min-h-screen > section:first-of-type > div { width: 100% !important; max-width: 100% !important; }
  .min-h-screen { min-height: 100vh !important; }
  .min-h-screen > section:first-of-type .text-center.mb-8 { margin-bottom: 0.5rem !important; }
  .min-h-screen > section:first-of-type h1.text-4xl { font-size: 1.25rem !important; margin-bottom: 0.25rem !important; }
  .min-h-screen > section:first-of-type p.text-lg { font-size: 0.8rem !important; margin-bottom: 0.5rem !important; }
</style>`;

export async function onRequest(context) {
  const { request, params } = context;
  const path = params.path || '';
  const url = new URL(request.url);

  // ── 1. 工具页面代理 ──
  if (path in TOOLS) {
    const targetUrl = TOOLS[path];
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Referer: ORIGIN + '/zh',
      },
    });

    const contentType = response.headers.get('content-type') || '';

    // 非 HTML 直接透传
    if (!contentType.includes('text/html')) {
      return new Response(response.body, {
        status: response.status,
        headers: { 'Content-Type': contentType },
      });
    }

    // HTML：注入 CSS
    let html = await response.text();
    html = html.replace('</head>', INJECT_CSS + '</head>');

    return new Response(html, {
      status: response.status,
      headers: { 'Content-Type': 'text/html;charset=utf-8' },
    });
  }

  // ── 2. 静态资源代理（/_next/static/*, /favicon.ico 等） ──
  const resourceUrl = ORIGIN + '/' + path;
  const res = await fetch(resourceUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      Referer: ORIGIN + '/zh',
    },
  });

  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': contentType },
  });
}
