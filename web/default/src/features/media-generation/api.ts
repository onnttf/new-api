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
import { api } from '@/lib/api'
import { API_ENDPOINTS } from './constants'
import type {
  ImageGenerationResult,
  ImageFormState,
  VideoFormState,
  VideoTask,
} from './types'

// /v1/* 接口要求 Bearer Token；从 useActiveChatKey() 里取，再以 header 形式带过去。
// skipBusinessError 让 axios 拦截器放过这些 OpenAI 兼容响应（不走 {success, message} 业务格式）。
function authHeader(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  }
}

export async function submitImage(
  payload: ImageFormState & { model: string },
  token: string
): Promise<ImageGenerationResult> {
  const res = await api.post(
    API_ENDPOINTS.IMAGES_GENERATIONS,
    {
      model: payload.model,
      prompt: payload.prompt,
      n: payload.n,
      size: payload.size,
    },
    {
      headers: authHeader(token),
      skipBusinessError: true,
    } as Record<string, unknown>
  )
  return res.data as ImageGenerationResult
}

// 把 UI 表单展开成 newapi 的 TaskSubmitReq；ratio / resolution / enableSound / search_enabled /
// autoCompliance 全部塞到 metadata 里，由 adaptor.go buildPayload 读取。
export async function submitVideo(
  payload: VideoFormState & { model: string },
  token: string
): Promise<VideoTask> {
  const body: Record<string, unknown> = {
    model: payload.model,
    prompt: payload.prompt,
    duration: payload.duration,
    metadata: {
      ratio: payload.aspectRatio,
      resolution: payload.resolution,
      enableSound: payload.generateAudio ? 'on' : 'off',
      search_enabled: payload.webSearch ? 1 : 0,
      autoCompliance: payload.nsfwChecker ? 1 : 0,
    },
  }
  if (payload.firstFrameUrl.trim()) {
    body.images = [payload.firstFrameUrl.trim()]
  }

  const res = await api.post(API_ENDPOINTS.VIDEO_GENERATIONS, body, {
    headers: authHeader(token),
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data as VideoTask
}

export async function fetchVideoTask(
  taskId: string,
  token: string
): Promise<VideoTask> {
  const res = await api.get(
    `${API_ENDPOINTS.VIDEO_TASK_FETCH}/${encodeURIComponent(taskId)}`,
    {
      headers: authHeader(token),
      skipBusinessError: true,
      disableDuplicate: true, // 轮询需要重复请求，关掉并发去重
    } as Record<string, unknown>
  )
  return res.data as VideoTask
}
