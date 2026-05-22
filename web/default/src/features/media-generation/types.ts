/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

// 模型类型：image = 同步图像生成接口；video = 异步视频生成 + 轮询。
export type MediaModelKind = 'image' | 'video'

export type MediaModelOption = {
  value: string
  label: string
  kind: MediaModelKind
}

// 图像表单参数。映射到 POST /v1/images/generations 请求体。
export type ImageFormState = {
  prompt: string
  size: string // e.g. '1024x1024'
  n: number
}

// 视频表单参数。映射到 POST /v1/video/generations 的 TaskSubmitReq。
export type VideoFormState = {
  prompt: string
  seconds: string // '5' | '10' …
  size: string
}

// 视频任务轮询返回（OpenAIVideo 兼容）。
export type VideoTask = {
  id: string
  task_id?: string
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | string
  progress?: number
  created_at?: number
  completed_at?: number
  model?: string
  metadata?: Record<string, unknown> & { url?: string }
  error?: { message: string; code?: string }
}

// 图像生成响应（OpenAI 兼容）。
export type ImageGenerationResult = {
  data: { url?: string; b64_json?: string }[]
  created: number
}

export type GenerationResult =
  | { kind: 'image'; images: { url?: string; b64_json?: string }[] }
  | { kind: 'video'; videoUrl: string; task: VideoTask }
