'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireUser, SessionExpiredError } from '@/lib/auth'
import { adjustmentError, applyAdjustment, diffAdjustment, type AdjustLine } from '@/lib/adjust'
import { getAdjustSheet } from '@/lib/inventory'
import type { ReasonCode } from '@/lib/constants'
import type { SaveResult } from './inbound'

/**
 * 재고 조정 — 실사 (S8 · `REQ-F-08`)
 *
 * 판단은 `lib/adjust` 가 한다. 화면이 이미 같은 함수로 막고 있지만 서버가 다시
 * 본다 — 화면을 거치지 않은 요청도 있을 수 있고, 그 사이 장부가 움직였을 수도 있다.
 * **장부는 저장 직전에 다시 읽는다.**
 */
export async function saveAdjustment(input: {
  locationId: number
  reason: ReasonCode | ''
  note?: string
  lines: AdjustLine[]
}): Promise<SaveResult> {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof SessionExpiredError) return { ok: false, error: e.message }
    throw e
  }

  const sheet = await getAdjustSheet(input.locationId)
  if (!sheet) return { ok: false, error: '없는 거점입니다' }

  const { diffs, unknown } = diffAdjustment(
    sheet.rows.map((r) => ({ lotId: r.lotId, book: r.book })),
    input.lines
  )

  const error = adjustmentError({ reason: input.reason, note: input.note, diffs, unknown })
  if (error) return { ok: false, error }

  await db.$transaction((tx) =>
    applyAdjustment(tx, {
      locationId: input.locationId,
      reason: input.reason as ReasonCode,
      note: input.note,
      userId: user.id,
      diffs,
    })
  )

  revalidatePath('/adjust')
  revalidatePath(`/adjust/${input.locationId}`)
  revalidatePath('/history')
  revalidatePath('/')

  const plus = diffs.filter((d) => d.delta > 0).length
  const minus = diffs.length - plus
  return { ok: true, message: `조정 ${diffs.length}건 · 늘어난 줄 ${plus} · 줄어든 줄 ${minus}` }
}
