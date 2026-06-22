# Instant Messaging Frontend

基于 React 18、Next.js 和 TypeScript 开发的即时通讯平台前端，支持好友聊天、在线状态、未读提醒、聊天记录分页，以及 DeepSeek AI 多会话流式对话。

本仓库为前端项目，后端仓库请访问：

[Instant Messaging Backend](https://github.com/aiheshuyi/instant-messaging-backend)

## 在线体验

[https://instant-messaging-frontend.vercel.app](https://instant-messaging-frontend.vercel.app)

> 后端部署在 Railway，首次访问时可能需要等待服务启动。

## 技术栈

- React 18
- Next.js 12
- TypeScript
- Ant Design
- styled-components
- Redux Toolkit
- Axios
- Socket.IO Client
- Fetch Stream / SSE

## 功能介绍

### 即时通讯

- 用户注册、登录和登录状态保存
- 联系人选择与好友聊天
- Socket.IO 实时消息通知
- 在线、忙碌、请勿打扰、离开状态展示
- 未读消息数量提示
- 新消息联系人自动置顶
- 双方头像及消息时间展示

### 聊天记录

- 每次加载最近 20 条消息
- 向上滚动加载更多历史记录
- 保持加载前的滚动位置
- 发送新消息后自动停留在底部
- 无更多消息和加载状态提示

### DeepSeek AI 助手

- 将 DeepSeek 作为系统内置联系人
- 使用 Fetch Stream 解析 SSE 流式回复
- 支持 AI 多轮上下文对话
- 支持新建、切换、重命名和删除历史会话
- 支持 AI 会话和历史消息恢复
- 提供请求失败和流式响应异常提示

### 用户体验

- 重新设计联系人列表、聊天窗口和输入区域
- 支持调整联系人区域宽度
- 支持调整消息区域与编辑区域高度
- 支持预设头像选择、随机头像和本地图片上传
- 支持个人状态选择和账号操作弹窗
- 未选择联系人时显示简洁的品牌空状态
- 使用 styled-components SSR 解决刷新时的样式闪烁问题

## 相较原项目的主要改进

| 模块 | 改进内容 |
| --- | --- |
| 页面设计 | 重构聊天页面、联系人列表、消息气泡和编辑区域 |
| 实时状态 | 增加在线状态同步和个人状态切换 |
| 未读消息 | 增加未读数量提示与联系人自动置顶 |
| 历史消息 | 增加分页加载并保持滚动位置 |
| AI 助手 | 接入 DeepSeek SSE 流式多会话聊天 |
| 头像系统 | 支持预设头像、随机头像和本地上传 |
| 页面渲染 | 修复 Hydration 和首屏样式闪烁问题 |
| 生产部署 | 适配 Vercel、Railway 和 HTTPS WebSocket |

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env.development`：

```env
NEXT_PUBLIC_HTTPHOST=http://localhost:3000/
NEXT_PUBLIC_WSHOST=http://localhost:3000/
```

生产环境变量示例：

```env
NEXT_PUBLIC_HTTPHOST=https://instant-messaging-backend-production.up.railway.app/
NEXT_PUBLIC_WSHOST=https://instant-messaging-backend-production.up.railway.app/
```

### 3. 启动项目

```bash
npm run dev
```

访问：

```text
http://localhost:3001
```

## 构建

```bash
npm run build
npm run start
```

## 通信方式

```text
HTTP API
├── 用户注册与登录
├── 用户资料与头像
├── 消息发送与历史记录
└── AI 会话管理

Socket.IO
├── 好友消息通知
├── 在线状态同步
└── 未读消息提醒

SSE
└── DeepSeek AI 流式回复
```

## 部署

前端使用 Vercel 部署。

部署时需要在 Vercel 中配置：

```env
NEXT_PUBLIC_HTTPHOST=后端公网地址
NEXT_PUBLIC_WSHOST=后端公网地址
```

修改环境变量后需要重新部署才能生效。

## 项目来源

本项目基于开源即时通讯项目进行二次开发，主要用于学习 React、Next.js、实时通信、流式输出及前后端协作。

原项目地址：[Instant-messaging-React18](https://github.com/BoyYangzai/Instant-messaging-React18)
