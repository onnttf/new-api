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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveChatKey } from '@/features/chat/hooks/use-active-chat-key'
import { submitImage, submitVideo } from './api'
import { ImageForm } from './components/image-form'
import { ModelSelector } from './components/model-selector'
import { ResultDisplay } from './components/result-display'
import { VideoForm } from './components/video-form'
import { DEFAULT_VIDEO_FORM } from './constants'
import { useMediaModels } from './hooks/use-models'
import { useVideoTaskPolling } from './hooks/use-task-polling'
import type {
  GenerationResult,
  ImageFormState,
  VideoFormState,
  VideoTask,
} from './types'

const DEFAULT_IMAGE_FORM: ImageFormState = {
  prompt: '',
  size: '1024x1024',
  n: 1,
}

export function MediaGeneration() {
  const { t } = useTranslation()
  const { data: models, isLoading: modelsLoading } = useMediaModels()
  // 复用 chat2link 同款 hook：从用户已启用的 token 里挑第一把作为 Bearer。
  const { data: token, error: keyError } = useActiveChatKey(true)

  const [modelValue, setModelValue] = useState<string | null>(null)
  const [imageForm, setImageForm] = useState<ImageFormState>(DEFAULT_IMAGE_FORM)
  const [videoForm, setVideoForm] = useState<VideoFormState>(DEFAULT_VIDEO_FORM)
  const [isSubmitting, setSubmitting] = useState(false)
  const [pendingVideoTaskId, setPendingVideoTaskId] = useState<string | null>(
    null
  )
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [latestVideoTask, setLatestVideoTask] = useState<VideoTask | null>(null)

  // 默认选第一个模型
  useEffect(() => {
    if (!modelValue && models && models.length > 0) {
      setModelValue(models[0].value)
    }
  }, [models, modelValue])

  const selectedModel = useMemo(
    () => models?.find((m) => m.value === modelValue) ?? null,
    [models, modelValue]
  )

  const pollingState = useVideoTaskPolling({
    taskId: pendingVideoTaskId,
    token: token ?? null,
    onTerminal: (task) => {
      setLatestVideoTask(task)
      if (task.status === 'completed') {
        const videoUrl = (task.metadata?.url as string | undefined) ?? ''
        if (!videoUrl) {
          toast.error(t('Video task completed but no URL was returned'))
          setResult(null)
        } else {
          setResult({ kind: 'video', videoUrl, task })
        }
      } else {
        toast.error(task.error?.message ?? t('Video task failed'))
        setResult(null)
      }
      setPendingVideoTaskId(null)
    },
  })

  // 轮询中的 task 状态实时反映到 UI
  useEffect(() => {
    if (pollingState.status === 'polling' || pollingState.status === 'done') {
      setLatestVideoTask(pollingState.task)
    }
  }, [pollingState])

  const handleSubmitImage = async () => {
    if (!selectedModel || !token) return
    setSubmitting(true)
    setResult(null)
    try {
      const out = await submitImage(
        { ...imageForm, model: selectedModel.value },
        token
      )
      setResult({ kind: 'image', images: out.data ?? [] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Image request failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitVideo = async () => {
    if (!selectedModel || !token) return
    setSubmitting(true)
    setResult(null)
    setLatestVideoTask(null)
    try {
      const task = await submitVideo(
        { ...videoForm, model: selectedModel.value },
        token
      )
      const taskId = task.id || task.task_id || ''
      if (!taskId) {
        toast.error(t('Video task submit returned no task id'))
        return
      }
      setLatestVideoTask(task)
      setPendingVideoTaskId(taskId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Video request failed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (keyError) {
    return (
      <div className='mx-auto max-w-2xl p-6'>
        <p className='text-destructive'>
          {keyError instanceof Error
            ? keyError.message
            : t('No enabled API keys found. Create or enable one first.')}
        </p>
      </div>
    )
  }

  const isVideo = selectedModel?.kind === 'video'
  const isPolling = Boolean(pendingVideoTaskId)
  const formDisabled = !token || !selectedModel || isPolling
  const isBusy = formDisabled || isSubmitting

  return (
    <div className='mx-auto flex w-full max-w-7xl flex-col gap-6 p-6'>
      {/* 顶部：页面标题 + 模型下拉小型化 */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('Media Generation')}</h1>
          <p className='text-muted-foreground text-sm'>
            {t('Generate images or videos. Video tasks are polled automatically.')}
          </p>
        </div>
        <div className='w-full sm:w-72'>
          <ModelSelector
            models={models ?? []}
            value={modelValue}
            onChange={setModelValue}
            disabled={modelsLoading || isBusy}
          />
        </div>
      </div>

      {/* 主体：双栏 Input / Output */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>{t('Input')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isVideo ? (
              <VideoForm
                value={videoForm}
                onChange={setVideoForm}
                onSubmit={handleSubmitVideo}
                onReset={() => setVideoForm(DEFAULT_VIDEO_FORM)}
                isSubmitting={isSubmitting}
                disabled={formDisabled}
              />
            ) : (
              <ImageForm
                value={imageForm}
                onChange={setImageForm}
                onSubmit={handleSubmitImage}
                isSubmitting={isSubmitting}
                disabled={formDisabled}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('Output')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResultDisplay
              result={result}
              videoTask={latestVideoTask}
              isPolling={isPolling}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
