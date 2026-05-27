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
import { Download, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { GenerationResult, VideoTask } from '../types'

type Props = {
  result: GenerationResult | null
  videoTask: VideoTask | null
  isPolling: boolean
}

export function ResultDisplay({ result, videoTask, isPolling }: Props) {
  const { t } = useTranslation()

  // 输出类型角标（video / image / null）
  const outputType = result?.kind ?? (isPolling ? 'video' : null)

  return (
    <div className='flex flex-col gap-4'>
      {outputType && (
        <div className='flex items-center gap-2'>
          <span className='text-muted-foreground text-sm'>{t('output type')}</span>
          <Badge variant='secondary'>{outputType}</Badge>
        </div>
      )}

      <Body result={result} videoTask={videoTask} isPolling={isPolling} />

      {result?.kind === 'video' && result.videoUrl && (
        <div className='flex justify-start'>
          <Button
            variant='outline'
            size='sm'
            render={
              <a href={result.videoUrl} download target='_blank' rel='noreferrer' />
            }
          >
            <Download className='size-4' />
            {t('Download')}
          </Button>
        </div>
      )}
    </div>
  )
}

function Body({ result, videoTask, isPolling }: Props) {
  const { t } = useTranslation()

  if (isPolling) {
    return (
      <div className='flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-md border bg-muted/30'>
        <Loader2 className='text-muted-foreground size-6 animate-spin' />
        <p className='text-muted-foreground text-sm'>
          {t('Task in progress')}: {videoTask?.status ?? 'queued'}
        </p>
        {typeof videoTask?.progress === 'number' && videoTask.progress > 0 && (
          <Progress value={videoTask.progress} className='w-64' />
        )}
      </div>
    )
  }

  if (!result) {
    return (
      <div className='text-muted-foreground flex aspect-video w-full items-center justify-center rounded-md border border-dashed text-center text-sm'>
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

  return (
    <video controls src={result.videoUrl} className='aspect-video w-full rounded-md border' />
  )
}
