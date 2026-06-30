/**
 * 影流拾光 — CORS 代理服务
 * 解决 OpenAI/DeepSeek/Qwen API 的浏览器 CORS 限制
 * 以及 B站 cid 获取的跨域问题
 *
 * 启动方式: node proxy.js
 * 默认端口: 8787
 *
 * 路由:
 *   GET  /health              健康检查
 *   POST /llm/:provider       转发 LLM 请求 (provider: deepseek|qwen|openai)
 *   GET  /bili/cid?bvid=xxx   获取 B站视频 cid
 */

const http = require('http');
const https = require('https');
const url = require('url');
const PORT = 8787;

// LLM provider endpoint 配置
const LLM_ENDPOINTS = {
  deepseek: { host: 'api.deepseek.com', path: '/v1/chat/completions' },
  qwen:     { host: 'dashscope.aliyuncs.com', path: '/compatible-mode/v1/chat/completions' },
  openai:   { host: 'api.openai.com', path: '/v1/chat/completions' }
};

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key, Authorization');
}

function sendJSON(res, code, data) {
  setCORS(res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function proxyRequest(options, body, callback) {
  var req = https.request(options, function(resp) {
    var chunks = [];
    resp.on('data', function(c) { chunks.push(c); });
    resp.on('end', function() {
      var raw = Buffer.concat(chunks).toString('utf8');
      callback(null, resp.statusCode, raw);
    });
  });
  req.on('error', function(e) { callback(e); });
  if (body) req.write(body);
  req.end();
}

const server = http.createServer(function(req, res) {
  var parsed = url.parse(req.url, true);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') { setCORS(res); res.writeHead(204); res.end(); return; }

  // GET /health
  if (parsed.pathname === '/health' && req.method === 'GET') {
    return sendJSON(res, 200, { ok: true, service: 'vke-proxy', version: '1.0' });
  }

  // GET /bili/cid?bvid=xxx
  if (parsed.pathname === '/bili/cid' && req.method === 'GET') {
    var bvid = parsed.query.bvid;
    if (!bvid) return sendJSON(res, 400, { error: 'missing bvid param' });
    proxyRequest({
      host: 'api.bilibili.com',
      path: '/x/web-interface/view?bvid=' + encodeURIComponent(bvid),
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com' }
    }, null, function(err, code, raw) {
      if (err) return sendJSON(res, 502, { error: err.message });
      try {
        var data = JSON.parse(raw);
        if (data.code !== 0) return sendJSON(res, code, data);
        var d = data.data;
        return sendJSON(res, 200, {
          cid: d.cid, aid: d.aid, title: d.title,
          duration: d.duration, cover: d.pic, desc: d.desc
        });
      } catch (e) {
        return sendJSON(res, 502, { error: 'parse error', raw: raw.substring(0, 200) });
      }
    });
    return;
  }

  // POST /llm/:provider
  var llmMatch = parsed.pathname.match(/^\/llm\/(\w+)$/);
  if (llmMatch && req.method === 'POST') {
    var provider = llmMatch[1];
    var endpoint = LLM_ENDPOINTS[provider];
    if (!endpoint) return sendJSON(res, 400, { error: 'unknown provider: ' + provider });

    var apiKey = req.headers['x-api-key'] || '';
    if (!apiKey) return sendJSON(res, 401, { error: 'missing X-Api-Key header' });

    var bodyChunks = [];
    req.on('data', function(c) { bodyChunks.push(c); });
    req.on('end', function() {
      var bodyStr = Buffer.concat(bodyChunks).toString('utf8');
      proxyRequest({
        host: endpoint.host,
        path: endpoint.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
          'User-Agent': 'vke-proxy/1.0'
        }
      }, bodyStr, function(err, code, raw) {
        if (err) return sendJSON(res, 502, { error: err.message });
        setCORS(res);
        res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(raw);
      });
    });
    return;
  }

  // 404
  sendJSON(res, 404, { error: 'not found', path: parsed.pathname });
});

server.listen(PORT, function() {
  console.log('========================================');
  console.log('  影流拾光 CORS 代理服务 v1.0');
  console.log('  运行中: http://localhost:' + PORT);
  console.log('========================================');
  console.log('  路由:');
  console.log('    GET  /health         健康检查');
  console.log('    POST /llm/:provider  LLM API 转发');
  console.log('    GET  /bili/cid       B站cid获取');
  console.log('========================================');
  console.log('  按 Ctrl+C 停止服务');
});
