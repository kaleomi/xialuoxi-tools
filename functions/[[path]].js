// 夏洛熙工具集 — Pages Functions 代理
const ORIGIN = 'https://imagefree.net';
const KEY_TEST = '1x0000000000000000000000000000000AA';
const KEY_ORIG = '0x4AAAAAACE-XLGoQUckKKm_';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const TOOLS = {
  t2i: 'https://imagefree.net/zh/',
  rmBg: 'https://imagefree.net/zh/background-remover',
  upscaler: 'https://imagefree.net/zh/image-upscaler',
  editor: 'https://imagefree.net/zh/ai-photo-editor',
};

const HIDE_CSS = `<style>nav,footer,.adsbygoogle,[class*="ad-"],[id*="ad-"],.min-h-screen>section~section{display:none!important}body{margin:0!important;background:#f5f5f7!important}.min-h-screen>section:first-of-type{min-height:100vh!important}</style>`;

// 客户端修补（等 turnstile 就绪后覆盖 siteKey）
const PATCH = '<script>(function(){var c=0,i=setInterval(function(){c++;var t=window.turnstile;if(t&&t.render){clearInterval(i);var r=t.render.bind(t);t.render=function(w,p){p.sitekey="'+KEY_TEST+'";return r(w,p)}}if(c>50)clearInterval(i)},300)})()<\/script>';

const CC = {'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'};

export async function onRequest(ctx) {
  const{request}=ctx;
  const u=new URL(request.url);
  const path=u.pathname, qs=u.search;
  if(path==='/'||path==='/index.html') return ctx.next();

  // API
  if(path.startsWith('/api/')){
    const m=request.method; let b=null;
    if(m!=='GET'&&m!=='HEAD') b=await request.text();
    if(b){try{
      const o=JSON.parse(b);
      if(o.turnstile_token){
        const v=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'secret='+KEY_TEST+'&response='+encodeURIComponent(o.turnstile_token)});
        const vj=await v.json();
        if(!vj.success) return new Response(JSON.stringify({error:'Human verification failed'}),{status:403,headers:{...CC,'Content-Type':'application/json'}});
      }
    }catch(e){}}
    const h=new Headers(request.headers);
    h.set('User-Agent',UA);h.set('Referer',ORIGIN+'/zh');h.set('Origin',ORIGIN);h.delete('Host');
    const r=await fetch(ORIGIN+path,{method:m,headers:h,body:b});
    return new Response(r.body,{status:r.status,headers:{...CC,'Content-Type':r.headers.get('content-type')||'application/json'}});
  }

  // 工具页面
  if(path.startsWith('/proxy/')){
    const tool=path.slice(7), tu=TOOLS[tool];
    if(!tu) return new Response('Not found',{status:404});
    const r=await fetch(tu,{headers:{'User-Agent':UA,Accept:'text/html,*/*','Accept-Language':'zh-CN',Referer:ORIGIN+'/zh'}});
    const ct=r.headers.get('content-type')||'';
    let html=await r.text();
    
    const re=new RegExp(KEY_ORIG.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g');
    const beforeLen=html.length;
    html=html.replace(re, KEY_TEST);
    
    if(ct.includes('text/html')){
      html=html.replace('</head>',HIDE_CSS+PATCH+'</head>');
    }
    return new Response(html,{headers:{...CC,'Content-Type':ct.includes('text/html')?'text/html; charset=utf-8':ct,'X-Key-Replaced':String(html.length!==beforeLen)}});
  }

  // 静态资源
  const r=await fetch(ORIGIN+path+qs,{headers:{'User-Agent':UA,Accept:'*/*',Referer:ORIGIN+'/zh'}});
  const ct=r.headers.get('content-type')||'';
  if(ct.includes('text/')||ct.includes('javascript')||ct.includes('ecmascript')||path.endsWith('.js')){
    let txt=await r.text();
    const re=new RegExp(KEY_ORIG.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g');
    const before=txt.length;
    txt=txt.replace(re, KEY_TEST);
    return new Response(txt,{headers:{...CC,'Content-Type':ct,'X-Key-Replaced':String(txt.length!==before)}});
  }
  return new Response(r.body,{status:r.status,headers:{...CC,'Content-Type':ct}});
}
