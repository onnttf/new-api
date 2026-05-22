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

// 这些路径直接打 newapi 的对外 relay 接口（需要 Bearer Token）。
export const API_ENDPOINTS = {
  IMAGES_GENERATIONS: '/v1/images/generations',
  VIDEO_GENERATIONS: '/v1/video/generations',
  VIDEO_TASK_FETCH: '/v1/video/generations',
} as const

// 视频任务轮询间隔与上限。
export const POLL_INTERVAL_MS = 3000
export const POLL_TIMEOUT_MS = 10 * 60 * 1000 // 10 分钟兜底，避免死循环

// TODO: 后端目前不在 user models 接口里返回模型类型（image / video），
// 这里用一份关键字启发式临时区分。等接入 LiblibAI 之后，更准的方案是：
//  1) 后端在 /api/user/models 响应里附带 kind 字段；或
//  2) 在前端维护一份 modelMetadata 配置表（按模型名手动标注）。
// 一旦决定方案，把这个数组移走或换成配置。
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

// 视频时长候选。各厂商支持的时长差异较大；当前给最常见的两档。
// TODO: 不同模型支持的时长不一样，等模型 metadata 落地后按模型动态展示。
export const VIDEO_SECONDS_OPTIONS = ['5', '10'] as const

// 图像尺寸候选。同样是占位，等真实模型规格定下来后再按模型变。
export const IMAGE_SIZE_OPTIONS = [
  '1024x1024',
  '1024x1792',
  '1792x1024',
] as const

// 视频比例 / 尺寸候选。
export const VIDEO_SIZE_OPTIONS = ['1280x720', '720x1280', '1024x1024'] as const
