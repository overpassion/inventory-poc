import type { Prisma } from '@/generated/prisma/client'
import { applyMovement } from './stock'
import { ADJUST_REASONS, MOVEMENT_TYPES, REASON_REQUIRES_NOTE, type ReasonCode } from './constants'

/**
 * 재고 조정 · 실사 (F8) — 화면과 서버가 **같은 함수**로 판단한다.
 *
 * "풀필먼트사 수치가 진실"이라는 원칙(`DOM-06`)의 실행 수단이다. 장부가 아니라
 * 실물이 기준이므로, 센 수를 받아 **장부를 거기에 맞춘다.**
 *
 * 차이 계산과 확정 조건을 순수 함수로 떼어 놓은 이유는 두 가지다.
 *  - 화면이 입력하는 즉시 차이와 막힘 사유를 보여줘야 한다 (`DOD-08`)
 *  - 그 판단을 서버가 다시 한 번 한다 — 화면을 거치지 않은 요청도 막아야 한다
 */

export type AdjustLine = { lotId: number; counted: number }
export type AdjustDiff = { lotId: number; book: number; counted: number; delta: number }

/**
 * 장부와 센 수의 차이. 같은 줄은 빼고 돌려준다 — 이력이 의미 없이 불어난다.
 *
 * `unknown` 은 이 거점 시트에 없는 로트를 가리킨 줄 수다. 화면에서는 생기지
 * 않지만, 서버는 남의 거점 로트를 조정하려는 요청을 이것으로 잡는다.
 */
export function diffAdjustment(
  books: { lotId: number; book: number }[],
  lines: AdjustLine[]
): { diffs: AdjustDiff[]; unknown: number } {
  const bookOf = new Map(books.map((b) => [b.lotId, b.book]))
  const diffs: AdjustDiff[] = []
  let unknown = 0

  for (const line of lines) {
    const book = bookOf.get(line.lotId)
    if (book === undefined) {
      unknown += 1
      continue
    }
    const delta = line.counted - book
    if (delta !== 0) diffs.push({ lotId: line.lotId, book, counted: line.counted, delta })
  }

  return { diffs, unknown }
}

/**
 * 확정할 수 있는가. 못 하면 **사람에게 보일 문장**을 돌려준다 (`DOD-08` · `RULE-10`).
 *
 * 사유는 고르기 전까지 빈 문자열이다 — 기본값을 미리 넣어 두지 않는다.
 * 조정은 총 재고를 바꾸므로, 손이 한 번은 가야 한다.
 */
export function adjustmentError(input: {
  reason: ReasonCode | ''
  note?: string | null
  diffs: AdjustDiff[]
  unknown?: number
}): string | null {
  if (!input.reason) return '조정 사유를 고르세요'
  if (!ADJUST_REASONS.includes(input.reason)) return '조정에 쓸 수 없는 사유입니다'
  if (REASON_REQUIRES_NOTE.includes(input.reason) && !input.note?.trim()) {
    return '「기타」 사유는 메모가 필요합니다'
  }
  if (input.unknown) return '이 거점의 로트가 아닙니다'
  if (input.diffs.some((d) => d.counted < 0)) return '센 수는 0 이상이어야 합니다'
  if (input.diffs.length === 0) return '장부와 다른 줄이 없습니다'
  return null
}

/**
 * 차이만큼 `ADJUST` 기록을 만든다. 만든 기록 수를 돌려준다.
 *
 * 방향은 from/to 로 표현한다 —
 *   실물이 적으면  거점 → 외부 (`from`)
 *   실물이 많으면  외부 → 거점 (`to`)
 *
 * 장부를 직접 덮어쓰지 않는다. `applyMovement` 하나만 거치므로 조정도
 * 이력에 남고 되돌릴 수 있다 (`RULE-01` · `RULE-09` · `REQ-F-10`).
 * 호출자가 트랜잭션을 연다 — 한 줄이 실패하면 앞 줄도 남지 않는다.
 */
export async function applyAdjustment(
  tx: Prisma.TransactionClient,
  input: {
    locationId: number
    reason: ReasonCode
    note?: string | null
    userId: number
    diffs: AdjustDiff[]
  }
) {
  for (const d of input.diffs) {
    const lot = await tx.lot.findUniqueOrThrow({ where: { id: d.lotId } })

    await applyMovement(tx, {
      type: MOVEMENT_TYPES.ADJUST,
      reason: input.reason,
      note: input.note?.trim() || null,
      productId: lot.productId,
      expiryDate: lot.expiryDate,
      quantity: Math.abs(d.delta),
      ...(d.delta < 0
        ? { fromLocationId: input.locationId } // 실물이 적다 — 거점에서 뺀다
        : { toLocationId: input.locationId }), // 실물이 많다 — 거점에 더한다
      userId: input.userId,
    })
  }

  return input.diffs.length
}
