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
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MediaModelOption } from '../types'

type Props = {
  models: MediaModelOption[]
  value: string | null
  onChange: (value: string) => void
  disabled?: boolean
}

export function ModelSelector({ models, value, onChange, disabled }: Props) {
  const { t } = useTranslation()
  const items = models.map((m) => ({ value: m.value, label: m.label }))

  return (
    <div className='flex flex-col gap-2'>
      <Label>{t('Model')}</Label>
      <Select
        items={items}
        value={value ?? ''}
        onValueChange={(v) => v && onChange(v as string)}
        disabled={disabled}
      >
        <SelectTrigger className='w-full'>
          <SelectValue placeholder={t('Select a model')} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {models.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                <span className='flex items-center gap-2'>
                  <span>{m.label}</span>
                  <Badge
                    variant={m.kind === 'video' ? 'default' : 'secondary'}
                    className='text-[10px]'
                  >
                    {m.kind}
                  </Badge>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
