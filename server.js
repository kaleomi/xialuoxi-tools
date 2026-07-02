const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── 工具配置 ──
const TOOLS = {
  t2i:      { title: '文生图',           url: 'https://imagefree.net/zh/' },
  rmBg:     { title: '抠图去背景',       url: 'https://imagefree.net/zh/background-remover' },
  upscaler: { title: '图片高清化',       url: 'https://imagefree.net/zh/image-upscaler' },
  editor:   { title: 'AI 图片编辑',      url: 'https://imagefree.net/zh/ai-photo-editor' },
};

const ORIGIN = 'https://imagefree.net';

// ── 通用代理函数 ──
async function proxyRequest(url, res) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      Referer: ORIGIN + '/zh',
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const buffer = Buffer.from(await response.arrayBuffer());

  res.set('Content-Type', contentType);
  if (contentType.includes('text/html')) {
    // 允许 iframe 嵌入
    res.set('X-Frame-Options', '');
  }
  res.status(response.status);
  res.send(buffer);
}

// ── 1. 首页（静态文件） ──
app.use(express.static(path.join(__dirname, 'public')));

// ── 2. 页面代理（带 CSS 注入） ──
app.get('/proxy/:tool', async (req, res) => {
  const tool = TOOLS[req.params.tool];
  if (!tool) return res.status(404).send('Tool not found');

  try {
    const response = await fetch(tool.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Referer: ORIGIN + '/zh',
      },
    });

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      const buffer = Buffer.from(await response.arrayBuffer());
      res.set('Content-Type', contentType);
      res.status(response.status);
      return res.send(buffer);
    }

    let html = await response.text();

    // ── 注入 CSS：只显示第一个 section ──
    const injectCss = `<!-- proxy:imagefree -->
<style>
  /* 隐藏导航栏 */
  nav { display: none !important; }

  /* 隐藏页脚 */
  footer { display: none !important; }

  /* 隐藏第一个 section 之外的所有 section */
  .min-h-screen > section ~ section { display: none !important; }

  /* 隐藏广告相关 */
  ins.adsbygoogle { display: none !important; }
  [class*="ad-"], [class*="ad_"], [id*="ad-"], [id*="ad_"] { display: none !important; }

  body { margin: 0 !important; background: #f5f5f7 !important; }

  .min-h-screen > section:first-of-type {
    min-height: 100vh !important;
    display: flex !important;
    align-items: flex-start !important;
    padding-top: 16px !important;
  }

  .min-h-screen > section:first-of-type > div {
    width: 100% !important;
    max-width: 100% !important;
  }

  .min-h-screen { min-height: 100vh !important; }

  /* 缩小标题 */
  .min-h-screen > section:first-of-type .text-center.mb-8 {
    margin-bottom: 0.5rem !important;
  }
  .min-h-screen > section:first-of-type h1.text-4xl {
    font-size: 1.25rem !important;
    margin-bottom: 0.25rem !important;
  }
  .min-h-screen > section:first-of-type p.text-lg {
    font-size: 0.8rem !important;
    margin-bottom: 0.5rem !important;
  }
</style>`;

    html = html.replace('</head>', injectCss + '</head>');

    res.set('Content-Type', contentType);
    res.send(html);

  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(502).send('代理请求失败: ' + err.message);
  }
});

// ── 3. 静态资源代理（/_next/static/*, /favicon.ico, etc.） ──
app.use(async (req, res, next) => {
  // 跳过已匹配的路由
  if (req.path === '/' || req.path.startsWith('/proxy/')) return next();

  try {
    await proxyRequest(ORIGIN + req.path, res);
  } catch (err) {
    console.error('Asset proxy error:', err.message);
    res.status(502).send('资源代理失败');
  }
});

// ── 启动 ──
app.listen(PORT, () => {
  console.log(`🚀 服务运行中: http://localhost:${PORT}`);
  Object.entries(TOOLS).forEach(([k, v]) => {
    console.log(`   ${v.title}: http://localhost:${PORT}/proxy/${k}`);
  });
});
