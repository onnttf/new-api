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

// 视频表单参数。对应 LiblibAI seedance 能走通的字段集合。
// kie.ai 那边 7 个比例 / 3 个分辨率 / 4-15s 任意时长 在这里收敛成 LiblibAI 实际接受的子集。
export type Resolution = '720p' | '1080p'
export type AspectRatio = '16:9' | '4:3' | '1:1'
export type Duration = 5 | 10

export type VideoFormState = {
  prompt: string
  firstFrameUrl: string // 单图 i2v；空串表示纯文生视频
  generateAudio: boolean
  resolution: Resolution
  aspectRatio: AspectRatio
  duration: Duration
  webSearch: boolean
  nsfwChecker: boolean // 对应上游 autoCompliance
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
