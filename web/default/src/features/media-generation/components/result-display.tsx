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
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import type { GenerationResult, VideoTask } from '../types'

type Props = {
  result: GenerationResult | null
  videoTask: VideoTask | null
  isPolling: boolean
}

export function ResultDisplay({ result, videoTask, isPolling }: Props) {
  const { t } = useTranslation()

  if (isPolling && videoTask) {
    return (
      <div className='flex flex-col items-center gap-3 rounded-md border p-6'>
        <Loader2 className='text-muted-foreground size-6 animate-spin' />
        <p className='text-muted-foreground text-sm'>
          {t('Task in progress')}: {videoTask.status}
        </p>
        {typeof videoTask.progress === 'number' && (
          <Progress value={videoTask.progress} className='w-64' />
        )}
      </div>
    )
  }

  if (!result) {
    return (
      <div className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>
        {t('Results will appear here after generation')}
      </div>
    )
  }

  if (result.kind === 'image') {
    return (
      <div className='grid grid-cols-2 gap-3'>
        {result.images.map((img, idx) => {
          const src = img.url ?? `data:image/png;base64,${img.b64_json ?? ''}`
          return (
            <img
              key={idx}
              src={src}
              alt={`generated-${idx}`}
              className='h-auto w-full rounded-md border'
            />
          )
        })}
      </div>
    )
  }

  // video
  return (
    <video
      controls
      src={result.videoUrl}
      className='w-full rounded-md border'
    />
  )
}
