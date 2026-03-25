# Nanobot 项目详细说明文档

## 目录

1. [项目概述](#1-项目概述)
2. [系统架构](#2-系统架构)
3. [核心模块说明](#3-核心模块说明)
4. [通信渠道](#4-通信渠道)
5. [工具系统](#5-工具系统)
6. [API 接口文档](#6-api-接口文档)
7. [配置说明](#7-配置说明)
8. [消息处理流程](#8-消息处理流程)
9. [会话管理](#9-会话管理)
10. [记忆系统](#10-记忆系统)
11. [定时任务](#11-定时任务)
12. [部署与运行](#12-部署与运行)

---

## 1. 项目概述

**Nanobot** 是一个超轻量级的个人 AI 助手框架，受 OpenClaw 项目启发，以 99% 更少的代码实现核心代理功能。

### 1.1 核心特性

- **多平台支持**: Telegram、WhatsApp、Discord、Slack、飞书、钉钉、QQ、微信企业版、Matrix、Email、Web UI
- **插件化架构**: 基于 MCP (Model Context Protocol) 的工具扩展系统
- **智能记忆**: 双层记忆系统（长期记忆 + 历史日志）
- **定时任务**: 内置 Cron 服务支持定时消息和提醒
- **Web 控制台**: 现代化的 Web Dashboard 界面
- **会话管理**: JSONL 格式的持久化会话存储

### 1.2 版本信息

- **当前版本**: v0.1.4.post4
- **Python 要求**: ≥ 3.11
- **许可证**: MIT

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Nanobot 架构                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐           │
│  │  Channels  │───>│ MessageBus │<───│ Agent Loop │           │
│  │  (渠道层)   │    │  (消息总线) │    │ (代理循环)  │           │
│  └────────────┘    └────────────┘    └────────────┘           │
│        │                                   │                   │
│        │                                   │                   │
│   Telegram/                              ┌──┴──┐              │
│   WhatsApp/                             │Tools │              │
│   Discord/                              └──┬──┘              │
│   Web UI                                 │ │                   │
│                                          │ │                   │
│  ┌───────────────────────────────────────┼─┼───────────────┐  │
│  │                Services               │ │               │  │
│  │  ┌──────────┐  ┌──────────┐  ┌────────┴──┐  ┌──────────┐ │  │
│  │  │ Session  │  │  Memory  │  │   Cron   │  │   MCP    │ │  │
│  │  │ Manager  │  │Consolida.│  │ Service  │  │ Servers  │ │  │
│  │  └──────────┘  └──────────┘  └───────────┘  └──────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Providers                               │  │
│  │  Anthropic / OpenAI / DeepSeek / Groq / Gemini / ...      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 目录结构

```
nanobot/
├── agent/              # 核心代理逻辑
│   ├── loop.py        # AgentLoop - 主处理循环
│   ├── context.py     # ContextBuilder - 消息上下文构建
│   ├── memory.py      # MemoryConsolidator - 记忆整合
│   ├── skills.py      # 技能系统
│   ├── subagent.py    # SubagentManager - 子代理管理
│   └── tools/         # 工具集
│       ├── base.py    # Tool 基类
│       ├── registry.py # ToolRegistry - 工具注册表
│       ├── filesystem.py # 文件系统工具
│       ├── shell.py   # 命令执行工具
│       ├── web.py     # Web 工具
│       ├── mcp.py     # MCP 协议支持
│       └── ...
├── channels/           # 通信渠道
│   ├── base.py        # BaseChannel - 渠道基类
│   ├── manager.py     # ChannelManager - 渠道管理器
│   ├── telegram.py    # Telegram 渠道
│   ├── whatsapp.py    # WhatsApp 渠道
│   ├── discord.py     # Discord 渠道
│   ├── web.py         # Web UI 渠道
│   └── ...
├── providers/          # LLM 提供商
│   ├── base.py        # LLMProvider 基类
│   ├── litellm_provider.py # LiteLLM 统一接口
│   ├── registry.py    # 提供商注册表
│   └── ...
├── bus/                # 消息总线
│   ├── events.py      # InboundMessage / OutboundMessage
│   └── queue.py       # MessageBus
├── session/            # 会话管理
│   └── manager.py     # SessionManager
├── cron/               # 定时任务
│   ├── service.py     # CronService
│   └── types.py       # CronJob / CronSchedule
├── config/             # 配置管理
│   ├── schema.py      # Pydantic 配置模型
│   ├── loader.py      # 配置加载器
│   └── paths.py       # 路径管理
├── web/                # Web Dashboard
│   └── dashboard/     # React + Vite 前端
└── cli/                # 命令行接口
    └── commands.py    # CLI 命令
```

---

## 3. 核心模块说明

### 3.1 AgentLoop - 代理循环

**文件**: `nanobot/agent/loop.py`

AgentLoop 是 nanobot 的核心处理引擎，负责：

1. 从消息总线接收消息
2. 构建上下文（历史、记忆、技能）
3. 调用 LLM
4. 执行工具调用
5. 发送响应

#### 主要方法

| 方法 | 说明 |
|------|------|
| `run()` | 启动代理循环，持续处理消息 |
| `_process_message()` | 处理单条消息的核心逻辑 |
| `_run_agent_loop()` | 运行 LLM 迭代循环（支持多轮工具调用） |
| `_handle_stop()` | 处理 `/stop` 命令，取消正在进行的任务 |
| `process_direct()` | 直接处理消息（用于 CLI 或 Cron） |

#### 配置参数

```python
AgentLoop(
    bus=MessageBus(),              # 消息总线
    provider=LLMProvider,          # LLM 提供商
    workspace=Path,                # 工作区路径
    model="anthropic/claude-opus-4-5",  # 模型名称
    max_iterations=40,             # 最大工具调用迭代次数
    temperature=0.1,               # 采样温度
    max_tokens=4096,               # 最大生成 token 数
    reasoning_effort="medium",     # 推理强度 (low/medium/high)
    context_window_tokens=65536,   # 上下文窗口大小
    brave_api_key=None,            # Brave 搜索 API 密钥
    web_proxy=None,                # Web 代理
    exec_config=ExecToolConfig(),  # 执行工具配置
    cron_service=CronService(),    # Cron 服务
    restrict_to_workspace=False,   # 限制工具访问工作区
)
```

### 3.2 MessageBus - 消息总线

**文件**: `nanobot/bus/queue.py`

异步消息队列，实现渠道与代理核心的解耦。

```python
class MessageBus:
    inbound: asyncio.Queue[InboundMessage]  # 入站消息队列
    outbound: asyncio.Queue[OutboundMessage] # 出站消息队列
```

#### 事件类型

```python
@dataclass
class InboundMessage:
    channel: str           # 渠道名称
    sender_id: str         # 发送者 ID
    chat_id: str           # 聊天 ID
    content: str           # 消息内容
    media: list[str]       # 媒体 URL 列表
    metadata: dict         # 渠道特定元数据
    session_key_override: str  # 会话键覆盖

    @property
    def session_key(self) -> str:  # 会话键: "channel:chat_id"
        ...

@dataclass
class OutboundMessage:
    channel: str
    chat_id: str
    content: str
    reply_to: str | None
    media: list[str]
    metadata: dict
```

### 3.3 ToolRegistry - 工具注册表

**文件**: `nanobot/agent/tools/registry.py`

动态管理所有可用工具。

```python
class ToolRegistry:
    def register(self, tool: Tool) -> None:        # 注册工具
    def unregister(self, name: str) -> None:       # 注销工具
    def get(self, name: str) -> Tool | None:       # 获取工具
    def get_definitions(self) -> list[dict]:       # 获取 OpenAI 格式定义
    async def execute(self, name: str, params: dict) -> str:  # 执行工具
```

---

## 4. 通信渠道

### 4.1 渠道基类 (BaseChannel)

**文件**: `nanobot/channels/base.py`

所有渠道必须继承此基类并实现以下方法：

```python
class BaseChannel(ABC):
    @abstractmethod
    async def start(self) -> None:    # 启动渠道
    @abstractmethod
    async def stop(self) -> None:     # 停止渠道
    @abstractmethod
    async def send(self, msg: OutboundMessage) -> None:  # 发送消息

    def is_allowed(self, sender_id: str) -> bool:  # 权限检查
    async def _handle_message(...) -> None:         # 处理入站消息
```

### 4.2 支持的渠道

| 渠道 | 配置键 | 特殊配置 |
|------|--------|----------|
| **Telegram** | `telegram.enabled` | `token`, `allow_from`, `proxy`, `group_policy` |
| **WhatsApp** | `whatsapp.enabled` | `bridge_url`, `bridge_token`, `allow_from` |
| **Discord** | `discord.enabled` | `token`, `allow_from`, `group_policy` |
| **飞书** | `feishu.enabled` | `app_id`, `app_secret`, `encrypt_key` |
| **钉钉** | `dingtalk.enabled` | `client_id`, `client_secret` |
| **Slack** | `slack.enabled` | `bot_token`, `app_token`, `reply_in_thread` |
| **QQ** | `qq.enabled` | `app_id`, `secret` |
| **企业微信** | `wecom.enabled` | `bot_id`, `secret` |
| **Matrix** | `matrix.enabled` | `homeserver`, `access_token`, `user_id` |
| **Email** | `email.enabled` | `imap_*`, `smtp_*` 配置 |
| **Web** | `web.enabled` | `host`, `port`, `auth_token` |

### 4.3 ChannelManager - 渠道管理器

**文件**: `nanobot/channels/manager.py`

```python
class ChannelManager:
    def __init__(self, config: Config, bus: MessageBus):
        # 根据配置初始化所有启用的渠道

    async def start_all(self) -> None:    # 启动所有渠道
    async def stop_all(self) -> None:     # 停止所有渠道
    async def _dispatch_outbound(self) -> None:  # 分发出站消息

    def get_status(self) -> dict:         # 获取所有渠道状态
    def get_channel(self, name: str) -> BaseChannel | None:  # 获取指定渠道
```

---

## 5. 工具系统

### 5.1 内置工具

| 工具名 | 功能 | 参数 |
|--------|------|------|
| `read_file` | 读取文件内容 | `file_path` |
| `write_file` | 写入文件 | `file_path`, `content` |
| `edit_file` | 编辑文件 (字符串替换) | `file_path`, `old_string`, `new_string` |
| `list_dir` | 列出目录内容 | `path`, `pattern` |
| `exec` | 执行 Shell 命令 | `command` |
| `web_search` | Web 搜索 (Brave) | `query` |
| `web_fetch` | 获取网页内容 | `url` |
| `message` | 发送消息到其他渠道 | `channel`, `to`, `content` |
| `spawn` | 启动子代理 | `prompt`, `mode` |
| `cron` | 管理 Cron 任务 | `action`, `schedule`, ... |

### 5.2 工具基类

```python
class Tool(ABC):
    @property
    @abstractmethod
    def name(self) -> str:  # 工具名称
        ...

    @property
    @abstractmethod
    def description(self) -> str:  # 工具描述
        ...

    @property
    @abstractmethod
    def parameters(self) -> dict:  # JSON Schema 参数
        ...

    @abstractmethod
    async def execute(self, **kwargs) -> str:  # 执行工具
        ...

    def to_schema(self) -> dict:  # 转换为 OpenAI 函数格式
        ...
```

### 5.3 MCP 工具集成

支持 Model Context Protocol (MCP)，可以动态加载外部工具服务器。

**配置示例**:
```yaml
tools:
  mcp_servers:
    filesystem:
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed"]
    github:
      command: npx
      args: ["-y", "@modelcontextprotocol/server-github"]
      env:
        GITHUB_TOKEN: "your-token"
```

---

## 6. API 接口文档

### 6.1 Web API 概述

Web Channel 提供 RESTful API 和 SSE (Server-Sent Events) 接口。

**基础地址**: `http://localhost:8080`

### 6.2 SSE 接口

#### `GET /api/sse`

建立 SSE 连接，接收实时事件流。

**事件类型**:
- `ping`: 保活心跳
- `progress`: 处理进度更新
- `tool_call`: 工具调用提示
- `message`: 最终响应消息

**示例**:
```javascript
const eventSource = new EventSource('http://localhost:8080/api/sse');
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Event:', data.type, data.content);
};
```

### 6.3 消息接口

#### `POST /api/message`

发送消息并获取响应（支持流式）。

**请求体**:
```json
{
    "content": "你好，请帮我写一段 Python 代码",
    "sender_id": "user123",
    "chat_id": "chat456",
    "sse_client_id": "optional-sse-id"
}
```

**响应**:
```json
{
    "status": "sent"
}
```

### 6.4 会话接口

#### `GET /api/sessions`

列出所有会话。

**查询参数**:
- `limit`: 返回数量限制 (默认 100)
- `offset`: 偏移量

**响应**:
```json
{
    "total": 42,
    "sessions": [
        {
            "key": "web:chat456",
            "created_at": "2026-03-15T10:30:00",
            "updated_at": "2026-03-16T14:22:00",
            "message_count": 25
        }
    ]
}
```

#### `GET /api/sessions/{key}`

获取会话详情和历史消息。

**响应**:
```json
{
    "key": "web:chat456",
    "created_at": "2026-03-15T10:30:00",
    "updated_at": "2026-03-16T14:22:00",
    "message_count": 25,
    "messages": [
        {
            "role": "user",
            "content": "你好"
        },
        {
            "role": "assistant",
            "content": "你好！有什么我可以帮助你的吗？"
        }
    ]
}
```

#### `DELETE /api/sessions/{key}`

删除指定会话。

### 6.5 Cron 任务接口

#### `GET /api/cron/jobs`

列出所有定时任务。

**查询参数**:
- `include_disabled`: 是否包含禁用的任务

**响应**:
```json
{
    "jobs": [
        {
            "id": "a1b2c3d4",
            "name": "每日提醒",
            "schedule_type": "cron",
            "schedule": "0 9 * * *",
            "enabled": true,
            "next_run": "1710987600000",
            "last_run": "1710901200000",
            "last_status": "ok"
        }
    ],
    "total": 1
}
```

#### `POST /api/cron/jobs`

创建新的定时任务。

**请求体**:
```json
{
    "name": "每日提醒",
    "schedule_type": "cron",
    "schedule": "0 9 * * *",
    "payload": {
        "message": "记得查看邮件",
        "deliver": false
    }
}
```

**schedule_type 支持**:
- `cron`: 标准 Cron 表达式 (如 `0 9 * * *`)
- `every`: 间隔格式 (如 `1h`, `30m`, `1d`)
- `at`: 时间戳 (毫秒)

#### `DELETE /api/cron/jobs/{job_id}`

删除定时任务。

#### `PUT /api/cron/jobs/{job_id}`

更新任务状态。

**请求体**:
```json
{
    "enabled": false
}
```

#### `POST /api/cron/jobs/{job_id}/run`

手动执行任务。

### 6.6 工具接口

#### `GET /api/tools`

列出所有可用工具。

**响应**:
```json
{
    "tools": [
        {
            "name": "read_file",
            "description": "Read the contents of a file",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to the file"
                    }
                },
                "required": ["file_path"]
            }
        }
    ],
    "total": 10
}
```

#### `GET /api/tools/{name}`

获取特定工具的详细定义。

### 6.7 记忆接口

#### `GET /api/memory`

获取长期记忆内容 (MEMORY.md)。

**响应**:
```json
{
    "content": "# 长期记忆\n\n用户偏好：..."
}
```

#### `GET /api/memory/history`

获取历史记录 (HISTORY.md)。

#### `PUT /api/memory`

更新记忆内容。

**请求体**:
```json
{
    "content": "# 更新后的记忆内容\n\n..."
}
```

### 6.8 配置接口

#### `GET /api/config`

获取当前配置。

#### `GET /api/channels`

获取已启用的渠道列表。

**响应**:
```json
{
    "channels": [
        {"id": "web", "name": "Web"},
        {"id": "telegram", "name": "Telegram"}
    ]
}
```

#### `PUT /api/config`

更新配置（可能需要重启）。

### 6.9 状态接口

#### `GET /api/status`

获取系统状态。

**响应**:
```json
{
    "connections": 3,
    "running": true,
    "host": "127.0.0.1",
    "port": 8080,
    "inbound_queue": 0,
    "outbound_queue": 0,
    "sessions": 42,
    "cron_jobs": 5
}
```

#### `GET /api/stats`

获取使用统计。

#### `GET /api/channels/status`

获取所有渠道的连接状态。

### 6.10 技能接口

#### `GET /api/skills`

列出可用技能。

**响应**:
```json
{
    "skills": [
        {
            "id": "summarize",
            "name": "Summarize",
            "description": "总结文本内容",
            "triggers": ["总结", "summarize"],
            "source": "skills/summarize.md"
        }
    ],
    "total": 6
}
```

#### `GET /api/skills/{skill_id}/source`

获取技能源文件内容。

---

## 7. 配置说明

### 7.1 配置文件位置

配置文件按以下顺序查找：

1. `~/.nanobot/config.yml`
2. `~/.nanobot/config.yaml`
3. 当前目录的 `.nanobot.yml` 或 `.nanobot.yaml`

### 7.2 配置结构

```yaml
# === Agent 配置 ===
agents:
  defaults:
    workspace: "~/.nanobot/workspace"     # 工作区路径
    model: "anthropic/claude-opus-4-5"   # 默认模型
    provider: "auto"                      # 提供商 (auto/anthropic/openai/...)
    max_tokens: 8192                      # 最大生成 token
    context_window_tokens: 65536          # 上下文窗口
    temperature: 0.1                      # 温度参数
    max_tool_iterations: 40               # 最大工具迭代次数
    reasoning_effort: "medium"            # 推理强度 (low/medium/high)

# === 渠道配置 ===
channels:
  send_progress: true      # 发送处理进度
  send_tool_hints: false   # 发送工具提示

  # Telegram
  telegram:
    enabled: false
    token: "your-bot-token"
    allow_from: ["*"]       # 允许所有用户，或指定用户 ID 列表
    proxy: null             # HTTP/SOCKS5 代理
    group_policy: "mention" # mention/open

  # WhatsApp
  whatsapp:
    enabled: false
    bridge_url: "ws://localhost:3001"
    bridge_token: ""
    allow_from: ["*"]

  # Discord
  discord:
    enabled: false
    token: "your-bot-token"
    allow_from: ["*"]
    group_policy: "mention"

  # 飞书
  feishu:
    enabled: false
    app_id: "your-app-id"
    app_secret: "your-app-secret"
    encrypt_key: ""
    verification_token: ""
    allow_from: ["*"]
    react_emoji: "THUMBSUP"

  # Web UI
  web:
    enabled: false
    host: "127.0.0.1"
    port: 8080
    allow_from: ["*"]
    cors_origins: ["http://localhost:8080"]
    auth_token: ""

# === LLM 提供商配置 ===
providers:
  anthropic:
    api_key: "sk-ant-..."
  openai:
    api_key: "sk-..."
  deepseek:
    api_key: "sk-..."
  groq:
    api_key: "gsk_..."
  # ... 其他提供商

# === 工具配置 ===
tools:
  web:
    proxy: null
    search:
      api_key: "your-brave-api-key"  # Brave Search API
      max_results: 5

  exec:
    timeout: 60              # Shell 命令超时（秒）
    path_append: ""         # 额外 PATH 路径

  restrict_to_workspace: false  # 限制工具访问工作区

  mcp_servers:              # MCP 服务器配置
    filesystem:
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]

# === 网关配置 ===
gateway:
  host: "0.0.0.0"
  port: 18790
  heartbeat:
    enabled: true
    interval_s: 1800        # 30 分钟
```

### 7.3 环境变量配置

支持通过环境变量配置（前缀 `NANOBOT_`）：

```bash
# LLM API 密钥
export NANOBOT_PROVIDERS__ANTHROPIC__API_KEY="sk-ant-..."
export NANOBOT_PROVIDERS__OPENAI__API_KEY="sk-..."

# 渠道配置
export NANOBOT_CHANNELS__TELEGRAM__TOKEN="your-bot-token"
export NANOBOT_CHANNELS__WEB__ENABLED=true

# 工具配置
export NANOBOT_TOOLS__WEB__SEARCH__API_KEY="your-brave-key"
```

---

## 8. 消息处理流程

### 8.1 完整处理流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     消息处理流程                                 │
└─────────────────────────────────────────────────────────────────┘

1. 渠道接收消息
   └──> BaseChannel._handle_message()
       └──> 权限检查 (is_allowed)

2. 发布到消息总线
   └──> MessageBus.publish_inbound(InboundMessage)

3. AgentLoop 消费消息
   └──> AgentLoop._dispatch()
       └──> 斜杠命令处理 (/new, /help, /stop)
       └──> 会话记忆整合 (maybe_consolidate_by_tokens)

4. 构建上下文
   └──> ContextBuilder.build_messages()
       ├──> 系统提示词
       ├──> 长期记忆 (MEMORY.md)
       ├──> 会话历史
       └──> 当前消息

5. LLM 迭代循环
   ┌─────────────────────────────────────┐
   │  while iteration < max_iterations:  │
   │                                     │
   │  1. 调用 LLM                        │
   │  2. 如果有工具调用:                 │
   │     - 执行工具                      │
   │     - 将结果添加到上下文            │
   │  3. 否则:                           │
   │     - 返回最终响应                  │
   │     - break                         │
   └─────────────────────────────────────┘

6. 保存会话
   └──> SessionManager.save()
       └──> workspace/sessions/{key}.jsonl

7. 发布响应
   └──> MessageBus.publish_outbound(OutboundMessage)

8. 渠道发送响应
   └──> BaseChannel.send()
```

### 8.2 斜杠命令

| 命令 | 功能 |
|------|------|
| `/new` | 开始新会话（归档当前会话） |
| `/help` | 显示帮助信息 |
| `/stop` | 停止当前正在执行的任务 |

---

## 9. 会话管理

### 9.1 Session 数据结构

```python
@dataclass
class Session:
    key: str                      # 会话键 "channel:chat_id"
    messages: list[dict]          # 消息列表
    created_at: datetime          # 创建时间
    updated_at: datetime          # 更新时间
    metadata: dict                # 元数据
    last_consolidated: int        # 最后整合的消息索引
```

### 9.2 存储格式

会话以 JSONL 格式存储在 `workspace/sessions/` 目录：

```
workspace/sessions/
├── web_chat123.jsonl
├── telegram_user456.jsonl
└── discord_channel789.jsonl
```

**文件格式**:
```jsonl
{"_type":"metadata","key":"web:chat123","created_at":"2026-03-15T10:00:00","last_consolidated":0}
{"role":"user","content":"你好","timestamp":"2026-03-15T10:00:01"}
{"role":"assistant","content":"你好！","timestamp":"2026-03-15T10:00:02"}
{"role":"user","content":"帮我写代码","timestamp":"2026-03-15T10:00:03"}
```

### 9.3 会话键规则

- 默认: `{channel}:{chat_id}`
- 线程模式: `{channel}:{chat_id}:{thread_id}`
- CLI: `cli:direct`

---

## 10. 记忆系统

### 10.1 双层记忆架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      双层记忆系统                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────┐     ┌──────────────────────┐           │
│  │   MEMORY.md        │     │    HISTORY.md        │           │
│  │   (长期记忆)        │     │    (历史日志)        │           │
│  ├────────────────────┤     ├──────────────────────┤           │
│  │ • 用户偏好          │     │ • 按时间排序的事件   │           │
│  │ • 重要事实          │     │ • 便于 grep 搜索     │           │
│  │ • 上下文信息        │     │ • [日期] 条目格式    │           │
│  └────────────────────┘     └──────────────────────┘           │
│                                                                 │
│  工作区: ~/.nanobot/workspace/memory/                           │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 记忆整合策略

当会话 token 数超过 `context_window_tokens // 2` 时，自动触发整合：

1. 选择用户回合边界作为切分点
2. 调用 LLM 生成摘要和历史条目
3. 更新 MEMORY.md 和 HISTORY.md
4. 更新会话的 `last_consolidated` 索引

### 10.3 记忆存储位置

```
workspace/memory/
├── MEMORY.md      # 长期记忆
└── HISTORY.md     # 历史日志
```

---

## 11. 定时任务

### 11.1 CronService

**文件**: `nanobot/cron/service.py`

支持三种调度类型：

| 类型 | 说明 | 示例 |
|------|------|------|
| `cron` | 标准 Cron 表达式 | `0 9 * * *` (每天 9 点) |
| `every` | 间隔调度 | `1h`, `30m`, `1d` |
| `at` | 定时执行 (时间戳) | `1710987600000` |

### 11.2 任务配置

任务存储在 `workspace/cron/jobs.json`：

```json
{
    "version": 1,
    "jobs": [
        {
            "id": "a1b2c3d4",
            "name": "每日提醒",
            "enabled": true,
            "schedule": {
                "kind": "cron",
                "expr": "0 9 * * *",
                "tz": "Asia/Shanghai"
            },
            "payload": {
                "kind": "agent_turn",
                "message": "检查邮件",
                "deliver": false,
                "channel": null,
                "to": null
            },
            "state": {
                "nextRunAtMs": 1710987600000,
                "lastRunAtMs": 1710901200000,
                "lastStatus": "ok",
                "lastError": null
            },
            "createdAtMs": 1710800000000,
            "updatedAtMs": 1710901200000,
            "deleteAfterRun": false
        }
    ]
}
```

### 11.3 任务 Payload 类型

| 字段 | 说明 |
|------|------|
| `message` | 发送给代理的消息内容 |
| `deliver` | 是否作为消息发送（否则仅后台处理） |
| `channel` | 目标渠道（如果 deliver=true） |
| `to` | 目标聊天 ID |

---

## 12. 部署与运行

### 12.1 安装

```bash
# 使用 pip 安装
pip install nanobot-ai

# 或从源码安装
git clone https://github.com/HKUDS/nanobot.git
cd nanobot
pip install -e .
```

### 12.2 配置

1. 创建配置文件 `~/.nanobot/config.yml`：
```yaml
agents:
  defaults:
    model: "anthropic/claude-opus-4-5"

providers:
  anthropic:
    api_key: "your-api-key"

channels:
  web:
    enabled: true
    port: 8080
```

2. 配置 API 密钥（可选，也可在配置文件中设置）：
```bash
export NANOBOT_PROVIDERS__ANTHROPIC__API_KEY="your-key"
```

### 12.3 启动

```bash
# 启动 nanobot
nanobot

# 指定配置文件
nanobot --config /path/to/config.yml

# 仅启动 Web UI
nanobot web
```

### 12.4 Docker 部署

```bash
# 使用 docker-compose
docker-compose up -d

# 或使用 Dockerfile
docker build -t nanobot .
docker run -p 8080:8080 -v ~/.nanobot:/workspace nanobot
```

### 12.5 生产环境建议

1. **反向代理**: 使用 Nginx/Caddy 代理 Web UI
2. **进程管理**: 使用 systemd 或 supervisor
3. **日志管理**: 配置 loguru 输出到文件
4. **安全配置**: 设置 `allow_from` 限制访问
5. **备份**: 定期备份 `workspace` 目录

### 12.6 systemd 服务示例

```ini
[Unit]
Description=Nanobot AI Assistant
After=network.target

[Service]
Type=simple
User=nanobot
WorkingDirectory=/home/nanobot
Environment="NANOBOT_PROVIDERS__ANTHROPIC__API_KEY=your-key"
ExecStart=/usr/local/bin/nanobot
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

---

## 附录

### A. 支持的 LLM 提供商

| 提供商 | 模型前缀 | 说明 |
|--------|----------|------|
| Anthropic | `anthropic/` | Claude 系列 |
| OpenAI | `openai/` | GPT 系列 |
| DeepSeek | `deepseek/` | DeepSeek 系列 |
| Groq | `groq/` | 高速推理 |
| Gemini | `gemini/` | Google Gemini |
| OpenRouter | `openrouter/` | 模型网关 |
| Azure OpenAI | `azure/` | Azure 托管 |
| Ollama | `ollama/` | 本地模型 |
| Moonshot | `moonshot/` | 月之暗面 |
| Zhipu | `zhipu/` | 智谱 AI |
| DashScope | `dashscope/` | 阿里云通义 |
| SiliconFlow | `siliconflow/` | 硅基流动 |
| VolcEngine | `volcengine/` | 火山引擎 |

### B. MCP 服务器示例

**文件系统**:
```yaml
mcp_servers:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
```

**GitHub**:
```yaml
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "your-token"
```

**Brave 搜索**:
```yaml
mcp_servers:
  brave-search:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-brave-search"]
    env:
      BRAVE_API_KEY: "your-key"
```

### C. 故障排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 渠道无法连接 | Token 错误 | 检查 API Token 配置 |
| 消息无响应 | LLM API 失败 | 检查 API 密钥和网络 |
| 工具执行失败 | 权限问题 | 检查工作区路径和权限 |
| 记忆未整合 | Token 估计偏差 | 调整 `context_window_tokens` |
| Cron 未触发 | 时区问题 | 确认 Cron 时区设置 |

---

*文档版本: v0.1.4*
*更新日期: 2026-03-16*
