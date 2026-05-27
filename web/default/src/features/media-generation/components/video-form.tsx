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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image as ImageIcon, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  ASPECT_RATIO_OPTIONS,
  DURATION_OPTIONS,
  RESOLUTION_OPTIONS,
} from '../constants'
import type { VideoFormState } from '../types'

type Props = {
  value: VideoFormState
  onChange: (next: VideoFormState) => void
  onSubmit: () => void
  onReset: () => void
  isSubmitting: boolean
  disabled?: boolean
}

export function VideoForm({
  value,
  onChange,
  onSubmit,
  onReset,
  isSubmitting,
  disabled,
}: Props) {
  const { t } = useTranslation()
  // 简单的 URL 合法性 + 是否能渲染缩略图
  const [previewError, setPreviewError] = useState(false)
  const trimmedUrl = value.firstFrameUrl.trim()
  const hasUrl = trimmedUrl.length > 0
  const showPreview = hasUrl && !previewError

  return (
    <div className='flex flex-col gap-6'>
      {/* Frames */}
      <FieldSection
        label={t('Frames')}
        hint={t('Optional reference image for image-to-video.')}
      >
        <div
          className={cn(
            'flex flex-col items-center gap-4 rounded-xl border-2 border-dashed bg-muted/20 px-6 py-5 transition-colors',
            hasUrl ? 'border-primary/40 bg-primary/[0.03]' : 'border-input hover:border-primary/30'
          )}
        >
          {showPreview ? (
            <div className='relative w-full max-w-[260px]'>
              <img
                src={trimmedUrl}
                alt='first frame preview'
                onError={() => setPreviewError(true)}
                className='aspect-video w-full rounded-md border object-cover shadow-sm'
              />
              <button
                type='button'
                aria-label={t('Clear')}
                onClick={() => {
                  setPreviewError(false)
                  onChange({ ...value, firstFrameUrl: '' })
                }}
                className='absolute -top-2 -right-2 rounded-full border bg-background p-1 shadow-sm hover:bg-muted'
              >
                <X className='size-3' />
              </button>
            </div>
          ) : (
            <div className='bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg'>
              <ImageIcon className='size-5' />
            </div>
          )}
          <Input
            type='url'
            placeholder='https://example.com/image.jpg'
            value={value.firstFrameUrl}
            onChange={(e) => {
              setPreviewError(false)
              onChange({ ...value, firstFrameUrl: e.target.value })
            }}
            disabled={disabled}
            className='max-w-md'
          />
          <p className='text-muted-foreground text-center text-xs'>
            {t('Paste image URL (JPG / PNG / WEBP)')}
          </p>
        </div>
      </FieldSection>

      {/* Prompt */}
      <FieldSection
        label={t('Prompt')}
        hint={t('The text prompt or description for the video.')}
      >
        <Textarea
          rows={5}
          placeholder={t('Describe the video you want to generate')}
          value={value.prompt}
          onChange={(e) => onChange({ ...value, prompt: e.target.value })}
          disabled={disabled}
          className='resize-y'
        />
      </FieldSection>

      {/* Generate audio */}
      <ToggleField
        label={t('Generate Audio')}
        hint={t('Whether to generate AI audio synchronized with the video.')}
        checked={value.generateAudio}
        onCheckedChange={(c) => onChange({ ...value, generateAudio: c })}
        disabled={disabled}
      />

      {/* Resolution */}
      <FieldSection label={t('Resolution')} hint={t('The output video resolution.')}>
        <PillGroup
          options={RESOLUTION_OPTIONS.map((r) => ({ value: r, label: r }))}
          value={value.resolution}
          onChange={(v) =>
            onChange({ ...value, resolution: v as VideoFormState['resolution'] })
          }
          disabled={disabled}
        />
      </FieldSection>

      {/* Aspect ratio */}
      <FieldSection
        label={t('Aspect Ratio')}
        hint={t('The aspect ratio of the generated video.')}
      >
        <PillGroup
          options={ASPECT_RATIO_OPTIONS.map((r) => ({ value: r, label: r }))}
          value={value.aspectRatio}
          onChange={(v) =>
            onChange({ ...value, aspectRatio: v as VideoFormState['aspectRatio'] })
          }
          disabled={disabled}
        />
      </FieldSection>

      {/* Duration */}
      <FieldSection
        label={t('Duration')}
        hint={t('Video duration in seconds.')}
      >
        <PillGroup
          options={DURATION_OPTIONS.map((d) => ({
            value: String(d),
            label: `${d}s`,
          }))}
          value={String(value.duration)}
          onChange={(v) =>
            onChange({
              ...value,
              duration: Number(v) as VideoFormState['duration'],
            })
          }
          disabled={disabled}
        />
      </FieldSection>

      {/* Web search */}
      <ToggleField
        label={t('Web Search')}
        hint={t('Use online search.')}
        checked={value.webSearch}
        onCheckedChange={(c) => onChange({ ...value, webSearch: c })}
        disabled={disabled}
      />

      {/* NSFW checker */}
      <ToggleField
        label={t('NSFW Checker')}
        hint={t('Enable content compliance check.')}
        checked={value.nsfwChecker}
        onCheckedChange={(c) => onChange({ ...value, nsfwChecker: c })}
        disabled={disabled}
      />

      {/* Reset / Run */}
      <div className='flex items-center justify-end gap-2 border-t pt-4'>
        <Button variant='outline' onClick={onReset} disabled={disabled || isSubmitting}>
          {t('Reset')}
        </Button>
        <Button
          onClick={onSubmit}
          disabled={disabled || isSubmitting || !value.prompt.trim()}
        >
          <Sparkles className='size-4' />
          {isSubmitting ? t('Generating...') : t('Run')}
        </Button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// 内联子组件 —— 这些只在这个表单里用，没必要单独成文件。
// ──────────────────────────────────────────────────────────────────────

function FieldSection({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col gap-2'>
      <Label className='text-sm font-medium'>{label}</Label>
      {children}
      {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
    </div>
  )
}

function PillGroup({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div className='flex flex-wrap gap-2'>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type='button'
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-md border px-4 py-1.5 text-sm transition-colors',
              active
                ? 'border-primary text-primary ring-primary/30 ring-2'
                : 'border-input hover:bg-accent hover:text-accent-foreground',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function ToggleField({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (c: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className='flex items-start justify-between gap-4'>
      <div className='flex flex-col gap-1'>
        <Label className='text-sm font-medium'>{label}</Label>
        {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  )
}
