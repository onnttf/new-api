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
import { useQuery } from '@tanstack/react-query'
import { getUserModels } from '@/features/playground/api'
import { VIDEO_MODEL_KEYWORDS } from '../constants'
import type { MediaModelKind, MediaModelOption } from '../types'

function classify(modelName: string): MediaModelKind {
  const lower = modelName.toLowerCase()
  return VIDEO_MODEL_KEYWORDS.some((kw) => lower.includes(kw))
    ? 'video'
    : 'image'
}

// 拉取用户可用模型并按关键字启发式标注 image / video。
// 这里复用 playground 的接口（/api/user/models）以避免新增后端字段。
export function useMediaModels() {
  return useQuery<MediaModelOption[]>({
    queryKey: ['media-generation', 'models'],
    queryFn: async () => {
      const playgroundModels = await getUserModels()
      return playgroundModels.map((m) => ({
        value: m.value,
        label: m.label,
        kind: classify(m.value),
      }))
    },
    staleTime: 5 * 60 * 1000,
  })
}
