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
// 这里统一把 skipBusinessError 设置上，避免命中默认的业务错误拦截（这些接口走 OpenAI 兼容格式，不是 newapi 的 {success, message} 格式）。
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

export async function submitVideo(
  payload: VideoFormState & { model: string },
  token: string
): Promise<VideoTask> {
  const res = await api.post(
    API_ENDPOINTS.VIDEO_GENERATIONS,
    {
      model: payload.model,
      prompt: payload.prompt,
      seconds: payload.seconds,
      size: payload.size,
    },
    {
      headers: authHeader(token),
      skipBusinessError: true,
    } as Record<string, unknown>
  )
  // 提交接口直接返回 OpenAIVideo 兼容结构（参考 doubao adaptor DoResponse）。
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
      disableDuplicate: true, // 轮询本来就需要重复请求，关掉并发去重
    } as Record<string, unknown>
  )
  return res.data as VideoTask
}
