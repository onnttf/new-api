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
import type {
  AspectRatio,
  Duration,
  Resolution,
  VideoFormState,
} from './types'

// 这些路径直接打 newapi 的对外 relay 接口（需要 Bearer Token）。
export const API_ENDPOINTS = {
  IMAGES_GENERATIONS: '/v1/images/generations',
  VIDEO_GENERATIONS: '/v1/video/generations',
  VIDEO_TASK_FETCH: '/v1/video/generations',
} as const

// 视频任务轮询间隔与上限。
export const POLL_INTERVAL_MS = 3000
export const POLL_TIMEOUT_MS = 10 * 60 * 1000 // 10 分钟兜底

// TODO: 后端目前不在 user models 接口里返回模型类型（image / video），
// 这里用一份关键字启发式临时区分。等接入更多模型后改成后端 metadata 字段。
export const VIDEO_MODEL_KEYWORDS = [
  'video',
  'kling',
  'sora',
  'seedance',
  'jimeng',
  'vidu',
  'runway',
  'pika',
  'hailuo',
  'doubao-seedance',
  'minimax-video',
] as const

// LiblibAI seedance 实际接受的取值集合（来自 Python 逆向）。
// kie.ai 的 6 个 aspect_ratio / 3 个 resolution / 4-15s 自由 duration 在我们这里收敛到这三组。
export const RESOLUTION_OPTIONS: Resolution[] = ['720p', '1080p']
export const ASPECT_RATIO_OPTIONS: AspectRatio[] = ['16:9', '4:3', '1:1']
export const DURATION_OPTIONS: Duration[] = [5, 10]

export const DEFAULT_VIDEO_FORM: VideoFormState = {
  prompt: '',
  firstFrameUrl: '',
  generateAudio: true,
  resolution: '720p',
  aspectRatio: '16:9',
  duration: 5,
  webSearch: false,
  nsfwChecker: true,
}

// 图像表单（图像模型走 OpenAI 兼容同步接口；和 LiblibAI 无关）。
export const IMAGE_SIZE_OPTIONS = [
  '1024x1024',
  '1024x1792',
  '1792x1024',
] as const
