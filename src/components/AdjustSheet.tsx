'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BulkInputRow } from './BulkInputRow'
import { ExpiryBadge } from './StatusBadge'
import { saveAdjustment } from '@/actions/adjust'
import { adjustmentError, diffAdjustment } from '@/lib/adjust'
import { ADJUST_REASONS, LOCATION_TYPES, REASON_LABEL, REASON_REQUIRES_NOTE } from '@/lib/constants'
import type { LocationType, ReasonCode } from '@/lib/constants'
import { formatDate } from '@/lib/date'
import type { AdjustLot } from '@/lib/inventory'

/**
 * 재고 조정 · 실사 (S8 · `REQ-F-08`)
 *
 * 장부를 보여주고 **센 수**를 받는다. 비워 둔 줄은 세지 않은 줄이다 —
 * 0 을 적은 것과 다르다. 0 은 "세어 봤는데 없었다"이고, 그것은 조정 대상이다.
 *
 * 차이와 확정 조건은 서버와 같은 함수(`lib/adjust`)로 계산한다. 화면이
 * 먼저 막고 서버가 다시 막는다 (`DOD-08`).
 */
export function AdjustSheet({
  location,
  rows,
}: {
  location: { id: number; name: string; type: LocationType }
  rows: AdjustLot[]
}) {
  const router = useRouter()
  const [counted, setCounted] = useState<Record<number, string>>({})
  const [reason, setReason] = useState<ReasonCode | ''>('')
  const [note, setNote] = useState('')
  const [onlyDiff, setOnlyDiff] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  /** 적은 줄만 넘긴다 — 비운 칸은 세지 않은 것이므로 장부를 그대로 둔다 */
  const lines = useMemo(
    () =>
      rows
        .filter((r) => (counted[r.lotId] ?? '') !== '')
        .map((r) => ({ lotId: r.lotId, counted: Number(counted[r.lotId]) })),
    [rows, counted]
  )

  const { diffs } = useMemo(
    () => diffAdjustment(rows.map((r) => ({ lotId: r.lotId, book: r.book })), lines),
    [rows, lines]
  )
  const deltaOf = useMemo(() => new Map(diffs.map((d) => [d.lotId, d.delta])), [diffs])

  const blocked = adjustmentError({ reason, note, diffs })
  const netDelta = diffs.reduce((s, d) => s + d.delta, 0)
  const isOwn = location.type === LOCATION_TYPES.OWN

  const visible = onlyDiff ? rows.filter((r) => deltaOf.has(r.lotId)) : rows

  const submit = async () => {
    if (blocked) return setError(blocked)
    setPending(true)
    setError(null)
    const res = await saveAdjustment({ locationId: location.id, reason, note, lines })
    setPending(false)
    if (!res.ok) return setError(res.error)
    router.push('/history?type=ADJUST')
    router.refresh()
  }

  return (
    <main className="pb-44">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <Link href="/adjust" className="text-[14.5px] font-extrabold">
          ‹ {location.name} 실사
        </Link>
        <span className="text-[11px] text-sub tnum">로트 {rows.length}개</span>
      </header>

      <p className="border-b border-line bg-dim px-4 py-2.5 text-[11.5px] leading-relaxed text-[#5b5570]">
        {isOwn ? (
          <>
            로트(유통기한)별로 <b>직접 센 수</b>를 적습니다. 세지 않은 줄은 비워 두세요 — 비운 줄은
            장부가 그대로 남습니다
          </>
        ) : (
          <>
            {location.name} 재고표의 <b>수량을 그대로</b> 옮겨 적습니다. 저쪽 숫자가 맞다고 보고
            장부를 거기에 맞춥니다
          </>
        )}
      </p>

      {rows.length > 0 && (
        <div className="flex gap-1.5 px-4 py-2.5">
          <button
            onClick={() => setOnlyDiff(false)}
            className={`rounded-full px-3 py-1.5 text-[11.5px] ${
              onlyDiff ? 'bg-dim font-semibold text-sub' : 'bg-acc-soft font-extrabold text-acc'
            }`}
          >
            전체 {rows.length}
          </button>
          <button
            onClick={() => setOnlyDiff(true)}
            className={`rounded-full px-3 py-1.5 text-[11.5px] ${
              onlyDiff ? 'bg-acc-soft font-extrabold text-acc' : 'bg-dim font-semibold text-sub'
            }`}
          >
            차이 {diffs.length}
          </button>
        </div>
      )}

      {/* PC에서만 보이는 표 머리 */}
      <div className="hidden border-y border-line bg-dim px-4 py-1.5 text-[10.5px] font-extrabold tracking-wider text-sub lg:grid lg:grid-cols-[minmax(0,1.4fr)_112px_112px_minmax(0,1.6fr)] lg:gap-x-3">
        <span>상품 · 유통기한</span>
        <span className="text-right">장부</span>
        <span className="text-center">센 수</span>
        <span>차이</span>
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-14 text-center text-[13px] text-sub">
          {onlyDiff ? '장부와 다른 줄이 없습니다' : '이 거점에 로트가 없습니다'}
        </p>
      ) : (
        visible.map((r) => {
          const delta = deltaOf.get(r.lotId)
          const wrote = (counted[r.lotId] ?? '') !== ''
          return (
            <BulkInputRow
              key={r.lotId}
              name={r.productName}
              sub={`${r.sku} · ${formatDate(new Date(r.expiry))}`}
              unit={r.unit}
              ariaLabel={`${r.productName} ${formatDate(new Date(r.expiry))} 센 수`}
              value={counted[r.lotId] ?? ''}
              onChange={(v) => setCounted((p) => ({ ...p, [r.lotId]: v }))}
              tone={delta !== undefined ? 'error' : wrote ? 'filled' : 'idle'}
              info={<>장부 {r.book.toLocaleString()}</>}
              result={
                <span className="flex items-center gap-1.5">
                  {r.status !== 'OK' && <ExpiryBadge status={r.status} />}
                  {delta === undefined ? (
                    wrote ? (
                      <span className="text-ok">장부와 같음</span>
                    ) : (
                      <span className="text-[#c9c4d6]">세지 않음</span>
                    )
                  ) : (
                    <b className={delta < 0 ? 'text-red' : 'text-acc'}>
                      {delta > 0 ? '＋' : '－'}
                      {Math.abs(delta).toLocaleString()}
                      {r.unit} {delta < 0 ? '부족' : '초과'}
                    </b>
                  )}
                </span>
              }
            />
          )
        })
      )}

      {error && (
        <p className="mx-4 mt-3 rounded-xl bg-red-bg px-3.5 py-2.5 text-[12px] font-bold text-red">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[560px] border-t border-line bg-white p-3 lg:max-w-[960px]">
        {/* 사유는 미리 골라 두지 않는다 — 조정은 총 재고를 바꾸므로 손이 한 번은 가야 한다 */}
        <div className="mb-2 flex gap-2">
          <select
            aria-label="조정 사유"
            value={reason}
            onChange={(e) => setReason(e.target.value as ReasonCode | '')}
            className="min-w-0 flex-1 rounded-xl border border-[#e2ddec] px-2.5 py-2 text-[12.5px]"
          >
            <option value="">사유를 고르세요</option>
            {ADJUST_REASONS.map((r) => (
              <option key={r} value={r}>
                {REASON_LABEL[r]}
              </option>
            ))}
          </select>
          <input
            aria-label="메모"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              reason && REASON_REQUIRES_NOTE.includes(reason) ? '메모 (필수)' : '메모 (선택)'
            }
            className="min-w-0 flex-[1.2] rounded-xl border border-[#e2ddec] px-2.5 py-2 text-[12.5px]"
          />
        </div>

        <div className="mb-2 flex items-center justify-between px-1 text-[11.5px]">
          <span className="font-bold text-[#5b5570] tnum">
            {diffs.length > 0
              ? `차이 ${diffs.length}줄 · 합계 ${netDelta > 0 ? '＋' : ''}${netDelta.toLocaleString()}개`
              : `센 줄 ${lines.length} · 차이 없음`}
          </span>
          {blocked && diffs.length > 0 && (
            <span className="font-extrabold text-amber">{blocked}</span>
          )}
        </div>

        <button
          onClick={submit}
          disabled={pending || !!blocked}
          className="acc-grad w-full rounded-xl py-3.5 text-[14.5px] font-extrabold text-white disabled:opacity-40"
        >
          {pending ? '조정 중…' : diffs.length > 0 ? `조정 확정 · ${diffs.length}줄` : '조정 확정'}
        </button>
      </div>
    </main>
  )
}
