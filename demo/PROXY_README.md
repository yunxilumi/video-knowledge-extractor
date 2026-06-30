# 影流拾光 CORS 代理服务

## 用途

解决浏览器端调用以下 API 时的 CORS 跨域限制：
- DeepSeek API (api.deepseek.com)
- 通义千问/DashScope API (dashscope.aliyuncs.com)
- OpenAI API (api.openai.com)
- B站视频信息 API (api.bilibili.com)

> Claude API 支持浏览器直连，无需代理。

## 启动方式

```bash
cd video-knowledge-extractor/demo
node proxy.js
```

服务运行在 `http://localhost:8787`

## API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查，返回 `{ok:true}` |
| POST | `/llm/:provider` | 转发 LLM 请求，provider 可选: deepseek, qwen, openai |
| GET | `/bili/cid?bvid=xxx` | 获取 B站视频 cid |

## 安全说明

- 代理不保存任何 API Key
- API Key 通过请求头 `X-Api-Key` 透传，不持久化
- 仅用于本地开发环境
