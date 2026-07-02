// Cloudflare Worker — 夏洛熙工具集
// 代理 imagefree.net + 注入 CSS 隐藏导航广告 + 替换 Turnstile Key
const ORIGIN = 'https://imagefree.net';

const TOOLS = {
  t2i:      'https://imagefree.net/zh/',
  rmBg:     'https://imagefree.net/zh/background-remover',
  upscaler: 'https://imagefree.net/zh/image-upscaler',
  editor:   'https://imagefree.net/zh/ai-photo-editor',
};

// 你的 Turnstile Site Key（已注册到 workers.dev 域名）
const USER_SITE_KEY = '0x4AAAAAADuSr57URha6wMyK';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ── 注入 CSS ──
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

// ── 首页 HTML ──
const INDEX_HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>夏洛熙工具集</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f5f7;display:flex;flex-direction:column;height:100vh;overflow:hidden}
.header{background:#fff;border-bottom:1px solid #e0e0e0;padding:0 20px;flex-shrink:0;display:flex;align-items:center;height:56px}
.header h1{font-size:18px;font-weight:700;color:#1a1a1a;margin-right:32px;white-space:nowrap}
.tabs{display:flex;gap:4px;background:#f0f0f0;padding:4px;border-radius:10px}
.tab{padding:8px 20px;border:none;border-radius:8px;background:transparent;font-size:14px;font-weight:500;color:#555;cursor:pointer;transition:all .2s;white-space:nowrap}
.tab:hover{color:#1a1a1a;background:rgba(0,0,0,.04)}
.tab.active{background:#fff;color:#1a1a1a;box-shadow:0 1px 3px rgba(0,0,0,.12)}
.frame-wrap{flex:1;position:relative;overflow:hidden}
.frame-wrap iframe{width:100%;height:100%;border:none;display:none}
.frame-wrap iframe.active{display:block}
.loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#f5f5f7;color:#888;font-size:15px;pointer-events:none;transition:opacity .3s}
.loading.hide{opacity:0}
</style>
</head>
<body>
<div class="header">
  <h1>🧰 夏洛熙工具集</h1>
  <div class="tabs" id="tabs">
    <button class="tab active" data-tool="t2i">🖼️ 文生图</button>
    <button class="tab" data-tool="rmBg">✂️ 抠图去背景</button>
    <button class="tab" data-tool="upscaler">🔍 图片高清化</button>
    <button class="tab" data-tool="editor">🎨 AI 图片编辑</button>
  </div>
</div>
<div class="frame-wrap">
  <div class="loading" id="loading">加载中...</div>
  <iframe src="/proxy/t2i" class="active" data-tool="t2i"></iframe>
  <iframe src="/proxy/rmBg"  data-tool="rmBg"></iframe>
  <iframe src="/proxy/upscaler" data-tool="upscaler"></iframe>
  <iframe src="/proxy/editor" data-tool="editor"></iframe>
</div>
<script>
const tabs=document.querySelectorAll('.tab'),frames=document.querySelectorAll('iframe'),loading=document.getElementById('loading');
let loaded={};
tabs.forEach(t=>{t.addEventListener('click',()=>{const r=t.dataset.tool;tabs.forEach(e=>e.classList.remove('active')),t.classList.add('active'),frames.forEach(e=>e.classList.remove('active')),document.querySelector('iframe[data-tool="'+r+'"]').classList.add('active'),loaded[r]||loading.classList.remove('hide')})});
frames.forEach(f=>{f.addEventListener('load',()=>{const r=f.dataset.tool;loaded[r]=true,f.classList.contains('active')&&loading.classList.add('hide')})});
document.querySelector('iframe.active').addEventListener('load',()=>loading.classList.add('hide'),{once:true});
setTimeout(()=>loading.classList.add('hide'),3e3);
</script>
</body>
</html>`;

// ── HTMLRewriter 处理器 ──
class CssInjector {
  element(el) { el.append(INJECT_CSS, { html: true }); }
}
class KeyReplacer {
  element(el) {
    const key = el.getAttribute('data-sitekey');
    if (key && (key.startsWith('0x4') || key.startsWith('0x3'))) {
      el.setAttribute('data-sitekey', USER_SITE_KEY);
    }
  }
}

// ── Worker 入口 ──
export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = url.pathname;

    // 首页
    if (path === '/' || path === '') {
      return new Response(INDEX_HTML, {
        headers: { 'Content-Type': 'text/html;charset=utf-8' },
      });
    }

    // ── 工具页面代理 ──
    if (path.startsWith('/proxy/')) {
      const toolName = path.slice(7); // 去掉 "/proxy/"
      const targetUrl = TOOLS[toolName];
      if (!targetUrl) {
        return new Response('Not found', { status: 404 });
      }

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

      // HTMLRewriter：注入 CSS + 替换 Turnstile Key
      return new HTMLRewriter()
        .on('head', new CssInjector())
        .on('[data-sitekey]', new KeyReplacer())
        .transform(resp);
    }

    // ── 静态资源代理 ──
    const resourceUrl = ORIGIN + path;
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
  },
};
