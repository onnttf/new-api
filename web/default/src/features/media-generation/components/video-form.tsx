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
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { VIDEO_SECONDS_OPTIONS, VIDEO_SIZE_OPTIONS } from '../constants'
import type { VideoFormState } from '../types'

type Props = {
  value: VideoFormState
  onChange: (next: VideoFormState) => void
  onSubmit: () => void
  isSubmitting: boolean
  disabled?: boolean
}

export function VideoForm({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  disabled,
}: Props) {
  const { t } = useTranslation()
  const secondsItems = VIDEO_SECONDS_OPTIONS.map((s) => ({
    value: s,
    label: `${s}s`,
  }))
  const sizeItems = VIDEO_SIZE_OPTIONS.map((s) => ({ value: s, label: s }))

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <Label>{t('Prompt')}</Label>
        <Textarea
          rows={4}
          placeholder={t('Describe the video you want to generate')}
          value={value.prompt}
          onChange={(e) => onChange({ ...value, prompt: e.target.value })}
          disabled={disabled}
        />
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='flex flex-col gap-2'>
          <Label>{t('Duration')}</Label>
          <Select
            items={secondsItems}
            value={value.seconds}
            onValueChange={(v) =>
              v && onChange({ ...value, seconds: v as string })
            }
            disabled={disabled}
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder={t('Duration')} />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {VIDEO_SECONDS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{`${s}s`}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className='flex flex-col gap-2'>
          <Label>{t('Size')}</Label>
          <Select
            items={sizeItems}
            value={value.size}
            onValueChange={(v) => v && onChange({ ...value, size: v as string })}
            disabled={disabled}
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder={t('Size')} />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {VIDEO_SIZE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={onSubmit}
        disabled={disabled || isSubmitting || !value.prompt.trim()}
      >
        {isSubmitting ? t('Generating...') : t('Generate Video')}
      </Button>
    </div>
  )
}
