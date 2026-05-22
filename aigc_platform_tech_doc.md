# AIGC 图视频平台技术执行文档（v2）

> 本文档是项目当前唯一执行依据。v1 中的 Node.js media-service 方案已作废，原因见末尾「废弃方案说明」。

---

## 一、目标

在 New API（本仓库）基础上扩展图像 / 视频生成能力，最大化复用现有 Go 后端，最小化新增代码。第一个版本范围：

1. **后端**：新增一个第三方聚合渠道 **LiblibAI**，借此接入 **seedance** 视频模型（不走火山引擎官方通道）
2. **前端**：新增一个**通用的图视频生成页**（不分图/视频两个页面），由模型决定走图或走视频
3. **复用**：用户体系、Token、扣费、退款、订阅套餐、异步任务轮询全部用 newapi 已有的实现，不重写

---

## 二、newapi 已覆盖的能力（不要再造轮子）

以下能力 newapi 已成熟，本次开发**禁止重复实现**：

| 能力 | 关键文件 |
|---|---|
| 异步任务厂商适配（Kling/Jimeng/Sora/Vidu/Doubao 等共 11 个） | [relay/channel/task/](relay/channel/task/) |
| 任务提交 + 状态查询路由 | [router/video-router.go](router/video-router.go) |
| 任务后端自动轮询（默认 15s 一次） | [service/task_polling.go](service/task_polling.go) |
| 按次扣费（预扣 + 完成后差额结算） | [service/task_billing.go:150-245](service/task_billing.go) |
| 失败自动退款（CAS 防重复退） | `RefundTaskQuota` in [service/task_billing.go](service/task_billing.go) |
| 按月订阅 / 套餐扣减 | [model/subscription.go](model/subscription.go) |
| 用户余额 / Token / OAuth / 充值 | newapi 核心，无需触碰 |
| 图像生成同步接口 (`POST /v1/images/generations`) | [controller/image.go](controller/image.go) + [router/relay-router.go](router/relay-router.go) |

**唯一缺口**：[web/default/src/features/](web/default/src/features/) 下没有面向终端用户的图像/视频生成 UI。

---

## 三、本期开发清单

### 3.1 后端：LiblibAI 任务适配器 ✅ 完整实现（基于逆向 Python 代码，待联调）

**核心文件**：

| 文件 | 说明 |
|---|---|
| [relay/channel/task/liblibai/adaptor.go](relay/channel/task/liblibai/adaptor.go) | 完整实现 `channel.TaskAdaptor` + `OpenAIVideoConverter` 接口。约 430 行。 |
| [relay/channel/task/liblibai/constants.go](relay/channel/task/liblibai/constants.go) | `ModelList = ["seedance"]`、上游硬编码 `star-video2`、设备层固定头（webid/atlas/project_id/node_id 来自 Python）、默认 ratio/resolution/duration |

**已修改文件**：

| 文件 | 改动 |
|---|---|
| [constant/channel.go](constant/channel.go) | 新增 `ChannelTypeLiblibAI = 58`、显示名 `"LiblibAI"`、BaseURL `https://api.liblib.tv` |
| [relay/relay_adaptor.go](relay/relay_adaptor.go) | 导入 + `GetTaskAdaptor` 分支 |
| [controller/channel-test.go](controller/channel-test.go) | 加入 `unsupportedTestChannelTypes` |
| [web/default/src/features/channels/constants.ts](web/default/src/features/channels/constants.ts) | `58: 'LiblibAI'` |

**关键设计决策**（基于你的回答）：

1. **设备层参数全部硬编码**：webid / atlas / project_id / node_id 取 Python 逆向代码里那一份。Channel 配置里用户只填 token。如果以后换账号失败再考虑拆字段。
2. **模型名约定**：用户面向模型名是 `seedance`（newapi 一侧），上游请求体里固定发 `star-video2`（LibLib 内部）。`info.UpstreamModelName` 会被适配器强制写成 `star-video2`。
3. **图片占位符自动补全**：如果 `req.Images` 非空且 `req.Prompt` 没有 `{{Image` 字样，自动在 prompt 末尾追加 ` {{Image 1}}`，并切换 `modeType` 为 `singleImage2video`。

**实现细节**：

- **提交**：`POST https://api.liblib.tv/api/task/generation/create`，custom `token` header（非 Bearer），requestId 用 crypto/rand 生成 16 位 hex
- **轮询**：`POST /api/task/generation/progress`，body `{taskIds: [<id>]}`。`extractTaskInfo` 兼容上游 `data` 既可能是 `map[taskId]→info` 也可能是 `list` 两种形状
- **状态映射**：
  - `SUCCESS / COMPLETED / FINISHED` → `model.TaskStatusSuccess`
  - `FAILED / ERROR / REJECTED` → `model.TaskStatusFailure`（触发自动退款）
  - `PROCESSING / RUNNING` → `model.TaskStatusInProgress`
  - `PENDING / QUEUED / WAITING` → `model.TaskStatusQueued`
  - 未知状态 + progress > 0 → InProgress；否则 Queued
- **size 映射**：接受 `"720p"` / `"1080p"` 直传，或 `"WxH"`（按比例最接近 16:9 / 4:3 / 1:1 取，按 max 边长判 720p / 1080p）。`metadata.ratio` / `metadata.resolution` 可覆盖
- **OpenAIVideoConverter**：实现完整，前端 GET `/v1/video/generations/:task_id` 会返回 OpenAI 兼容 JSON，含 `metadata.url`

**仍未实现的（已知 TODO）**：
- ⚠️ **OSS 上传**：Python 里 `upload_image()` 走 LibLib 自家 OSS 分片上传，能保证 imageList URL 一定被上游接受。我们这边假设用户传进来的 URL 直接可用 —— 如果上游拒绝外部 URL（i2v 场景），需要补一个"先下载再上传到 LibLib OSS"的中间步骤。**等到真实失败案例出现再加**。
- ⚠️ **mixed2video 模式**：Python 有 `reference_to_video()`，处理 `mixedList: [{url, type}]` 多输入参考。当前不支持 —— newapi 的 `TaskSubmitReq` 也没原生 mixedList 概念，等用例出现再设计。
- ⚠️ **按时长 / 分辨率计费**：当前直接走 channel 配的基础单价。如要做"5s 收 100 / 10s 收 180"那种按时长的差异化定价，需要 override `EstimateBilling` 返回 `{"seconds": X}` 倍率，并在 admin 给模型设 OtherRatios。

**待你确认**：
- ⚠️ **未执行 `go build ./...`**：本机只有 go 1.17.4。`gofmt` 过、所有引用的符号都对照源代码核对过。请你在能跑 go 1.25 的环境跑一次 `go build ./...`。
- ⚠️ **未实测请求**：本地没有 token 也没有上游能联通的环境。第一次实际提交时如果发现请求被拒，最可能的几个原因（按概率排序）：
  1. webid / atlas 是账号绑定的，硬编码值跟你的 token 不匹配 → 改成 channel-level 可配置
  2. requestId 长度 / 字符集不符合上游期望（Python 用字母+数字，我们用 hex，理论上更宽容但万一）
  3. ratio / resolution 取值不在白名单
  4. 外部图片 URL 上游不接受（i2v 场景，前面提的 OSS 上传问题）

---

### 3.2 前端：通用图视频生成页 ✅ 骨架完成（待联调验证）

**目标**：一个页面承接图和视频，由模型类型决定表单 + 调用 + 渲染方式。

**已新增文件**（与原计划目录结构略有调整 —— 入口用 `index.tsx` 而不是 `pages/` 子目录，与项目其他 feature 一致）：

```
web/default/src/features/media-generation/
├── index.tsx                          # 主页面（组合所有子组件）
├── api.ts                             # submitImage / submitVideo / fetchVideoTask
├── constants.ts                       # API_ENDPOINTS、模型分类关键字、尺寸/时长选项
├── types.ts                           # MediaModelOption、ImageFormState、VideoTask 等
├── components/
│   ├── model-selector.tsx             # 模型下拉，带 image/video Badge
│   ├── image-form.tsx                 # prompt + size + count
│   ├── video-form.tsx                 # prompt + duration + size
│   └── result-display.tsx             # 根据 kind 渲染 <img> / <video>，含 polling 进度
└── hooks/
    ├── use-models.ts                  # 复用 playground 的 /api/user/models 接口 + 关键字分类
    └── use-task-polling.ts            # 每 3s 轮询 /v1/video/generations/:task_id 直到终态
```

**已修改文件**：

| 文件 | 改动 |
|---|---|
| [web/default/src/routes/_authenticated/media-generation/index.tsx](web/default/src/routes/_authenticated/media-generation/index.tsx) | 注册 TanStack Router 文件路由 `/media-generation` |
| [web/default/src/hooks/use-sidebar-data.ts](web/default/src/hooks/use-sidebar-data.ts) | 在 `chat` 分组里加入 "Media Generation" 入口（Sparkles 图标），Playground 之后 |
| [web/default/rsbuild.config.ts](web/default/rsbuild.config.ts) | 给本地 dev server 的 `proxy` 列表加 `/v1`，否则前端在 dev 模式下调 `/v1/...` 会找不到后端 |
| [web/default/src/i18n/locales/en.json](web/default/src/i18n/locales/en.json) | 加 `"Media Generation"` |
| [web/default/src/i18n/locales/zh.json](web/default/src/i18n/locales/zh.json) | 加 `"Media Generation": "图视频生成"` |

**关键设计决策**：

1. **认证方式**：前端复用 [features/chat/hooks/use-active-chat-key.ts](web/default/src/features/chat/hooks/use-active-chat-key.ts) 的 `useActiveChatKey()`，拿用户第一把启用的 API key 作为 `Authorization: Bearer sk-...` 请求头打到 `/v1/...`。这样**零后端代码改动**就能让 session 已登录的用户用上 `/v1` 接口。代价：用户必须至少有一个启用的 token，否则页面提示去 `/keys` 创建。
2. **模型类型判断**：暂用关键字启发式（`VIDEO_MODEL_KEYWORDS` 数组：`video`/`kling`/`sora`/`seedance`/...）。`useMediaModels()` 拉模型列表后自动打 image/video 标。
3. **失败处理**：后端已经自动退款（[service/task_billing.go RefundTaskQuota](service/task_billing.go)），前端只 toast 提示，**不主动调退款**。

**待用户确认 / TODO**：
- ⚠️ **未执行 TypeScript 类型检查 / 构建验证**：本机没安装 bun。建议你在 `web/default/` 下跑一次 `bun install && bun run build` 确认能编译。
- ⚠️ **模型类型识别只是启发式**：等接入更多模型后必出现误判（比如某图像模型名字里没有任何关键字时会被当作 image，反之同理）。两个长期方案二选一：
  - 后端 `/api/user/models` 响应里附带 `kind` 字段（更干净，需要改 Go）
  - 前端维护一份手工模型 metadata 表
- ⚠️ **图像尺寸 / 视频时长选项是硬编码占位**（[constants.ts:IMAGE_SIZE_OPTIONS](web/default/src/features/media-generation/constants.ts)）。每个模型支持的尺寸/时长不同，等真实模型规格定下来后要按模型动态展示。
- ⚠️ **未挂入 sidebar 模块开关**：[hooks/use-sidebar-config.ts](web/default/src/hooks/use-sidebar-config.ts) 的 `URL_TO_CONFIG_MAP` 没加 `/media-generation` 映射，默认行为是"总是显示"。如果要让 admin 能在系统设置里开关这个入口，需要在那里加映射 + 在 `DEFAULT_SIDEBAR_MODULES` / system-settings UI 里加配置项。
- ⚠️ **其余 UI 文案（Prompt / Size / Count / Duration / Generate Image 等）未单独添加 i18n 翻译**，i18next 默认会显示英文 key。等 UI 稳定后再补 zh/fr/ru/ja/vi 翻译，或者用 `bun run i18n:sync` 自动生成。

**验收**（待你执行）：
- `bun install && bun run build` 通过
- 启动后能在侧边栏看到 "Media Generation"（中文：图视频生成）入口
- 切换模型时表单在 image / video 两套字段之间切换
- 选个已配好的图像模型（如 dall-e-3），提交后页面能看到结果图
- 选个已配好的视频模型（如 doubao-seedance），提交后轮询进度可见，完成后视频可播放
- 故意制造失败（用余额不够的账号），确认前端有错误 toast、后端日志显示退款已发生

---

### 3.3 运营侧配置（不写代码）

- 后台创建 LiblibAI Channel，填 key
- 给每个 seedance 模型设 quota 价格
- 把"充值套餐"配置作为订阅入口（[model/subscription.go](model/subscription.go) 已有）

---

## 四、开发执行顺序

```
Step 1：后端 LiblibAI 适配器骨架（本文档 3.1）✅ 代码完成，待用户在本地 go build 验证
       ↓
Step 2：前端通用生成页骨架（本文档 3.2）✅ 代码完成，含图像 + 视频 + 轮询，待 bun build 验证
       ↓
Step 3：（已并入 Step 2）
       ↓
Step 4：用户提供 Python 逆向代码 → 补全 LiblibAI 适配器实现 ✅ 完成（同样在 3.1）
       ↓
Step 5：联调 ⬅️ 当前阶段
       - 在 admin UI 创建 type=LiblibAI 的 channel，填 token
       - 给 `seedance` 模型设 quota 价格
       - 在前端「图视频生成」页选 seedance 模型，跑 t2v + i2v
       - 观察日志确认 status 终态、自动退款（如果失败）
```

---

## 五、明确剔除的方案（v1 文档遗留）

以下来自 v1 文档，**全部不做**：

- ❌ Node.js + Express 的独立 media-service
- ❌ 反向调用 New API 管理员 Token 扣余额（`PUT /api/user/:id` with `quota: -amount`）
- ❌ 自建任务表 / 任务队列 / 轮询调度（newapi 已有 [service/task_polling.go](service/task_polling.go)）
- ❌ 自建失败退款逻辑（newapi 已有 `RefundTaskQuota`）
- ❌ 独立部署 + Nginx 双子域名（单服务即可，后期需要再拆）
- ❌ 图像页和视频页分两个独立页（合并为一个通用页）

废弃原因：newapi 已原生支持异步任务厂商接入、扣费、退款、订阅、轮询。v1 方案把这些能力当作不存在并在外部用 Node 重新实现，工作量翻 3-5 倍且会与现有逻辑冲突。

---

## 六、待办事项 / 开放问题

- [ ] 确认 newapi 模型列表接口是否返回模型类型（image/video），决定前端类型判断方案 A/B
- [ ] 用户提供 LiblibAI 的 Python 逆向代码（endpoint / 签名 / 请求体 / 任务查询）
- [ ] 确认 seedance 在 LiblibAI 上的模型 ID 列表
- [ ] 第二版再考虑：任务历史列表、批量生成、图生视频的首帧上传 UI
