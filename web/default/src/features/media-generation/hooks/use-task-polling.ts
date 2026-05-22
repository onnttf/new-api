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
import { useEffect, useRef, useState } from 'react'
import { fetchVideoTask } from '../api'
import { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from '../constants'
import type { VideoTask } from '../types'

type PollState =
  | { status: 'idle' }
  | { status: 'polling'; task: VideoTask }
  | { status: 'done'; task: VideoTask }
  | { status: 'error'; task?: VideoTask; error: string }

const TERMINAL = new Set(['completed', 'failed'])

// 简单的视频任务轮询。每 POLL_INTERVAL_MS 取一次状态，遇到终态停止；
// 超过 POLL_TIMEOUT_MS 直接报错（防止前端跑死）。后端有自己的 15s 轮询和自动退款，
// 这个 hook 只是把状态拉到前端展示，不做业务侧的退款判断。
export function useVideoTaskPolling(args: {
  taskId: string | null
  token: string | null
  onTerminal?: (task: VideoTask) => void
}) {
  const { taskId, token, onTerminal } = args
  const [state, setState] = useState<PollState>({ status: 'idle' })
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (!taskId || !token) {
      setState({ status: 'idle' })
      return
    }

    cancelledRef.current = false
    const start = Date.now()

    const tick = async () => {
      if (cancelledRef.current) return
      try {
        const task = await fetchVideoTask(taskId, token)
        if (cancelledRef.current) return

        if (TERMINAL.has(task.status)) {
          setState({ status: 'done', task })
          onTerminal?.(task)
          return
        }

        setState({ status: 'polling', task })

        if (Date.now() - start > POLL_TIMEOUT_MS) {
          setState({ status: 'error', task, error: 'Polling timed out' })
          return
        }
        setTimeout(tick, POLL_INTERVAL_MS)
      } catch (err) {
        if (cancelledRef.current) return
        setState({
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    tick()
    return () => {
      cancelledRef.current = true
    }
    // onTerminal 故意排除以避免不必要的重启；只在 taskId/token 真变时重启轮询。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, token])

  return state
}
