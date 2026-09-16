'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from './StatusBadge'
import { Qty } from './Qty'
import { cancelMovement } from '@/actions/history'
import { formatDate } from '@/lib/date'
import { MOVEMENT_TYPE_LABEL, REASON_LABEL } from '@/lib/constants'
import type { HistoryRow } from '@/lib/inventory'

/** 외부에서 들어오거나 외부로 나간 것은 거점 이름이 없다 */
const place = (name: string | null) => name ?? '외부'

export function HistoryList({ rows }: { rows: HistoryRow[] }) {
  const router = useRouter()
  const [pending, setPending] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cancel = async (id: number) => {
    setError(null)
    setPending(id)
    const res = await cancelMovement(id)
    setPending(null)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  if (rows.length === 0) {
    return <p className="px-4 py-12 text-center text-[13px] text-sub">기록이 없습니다</p>
  }

  return (
    <>
      {error && (
        <p className="mx-4 mt-3 rounded-xl bg-red-bg px-3.5 py-2.5 text-[12px] font-bold text-red">
          {error}
        </p>
      )}

      {rows.map((r) => (
        <div
          key={r.id}
          className={`border-b border-line px-4 py-3 ${r.reversed ? 'bg-dim' : ''}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold">
                <span>{r.productName}</span>
                <Badge tone={r.isReversal ? 'gray' : 'acc'}>
                  {r.isReversal ? '취소' : MOVEMENT_TYPE_LABEL[r.type]}
                </Badge>
                {r.reason && <Badge tone="gray">{REASON_LABEL[r.reason]}</Badge>}
                {r.reversed && <Badge tone="gray">취소됨</Badge>}
              </p>

              {/* 어디 → 어디. 재고는 사라지지 않고 이동한다 */}
              <p className="mt-[3px] text-[11px] text-sub tnum">
                {place(r.fromName)} → {place(r.toName)} · 유통기한 {formatDate(r.expiryDate)}
              </p>

              {/* 누가 · 언제 — DOD-11 */}
              <p className="mt-[3px] text-[10.5px] text-[#a9a3b8] tnum">
                {r.userName} · {formatDate(r.createdAt)}{' '}
                {r.createdAt.toTimeString().slice(0, 5)} · #{r.id}
                {r.note ? ` · ${r.note}` : ''}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <Qty value={r.quantity} unit={r.unit} />
              {r.canCancel && (
                <button
                  onClick={() => cancel(r.id)}
                  disabled={pending === r.id}
                  className="mt-1.5 block w-full rounded-lg border border-line px-2 py-1 text-[11px] font-bold text-[#5b5570] disabled:opacity-40"
                >
                  {pending === r.id ? '…' : '취소'}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
