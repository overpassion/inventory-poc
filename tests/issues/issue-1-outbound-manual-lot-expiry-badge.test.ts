/**
 * Issue #1 — 출고 수동 로트 선택 목록에 유통기한 상태 배지 표시
 *
 * 근거: SSOT `RULE-06`(만료 로트도 후보에 포함, 화면에서 경고) ·
 *       `REQ-N-06`(색만으로 구분하지 않음) · `REQ-F-01`(임박 기준일은 품목마다 다름)
 *
 * 렌더링 자체는 vitest 환경이 node 라 검증하지 않는다. 목록에 넘기는
 * 상태 판정 로직(`withExpiryStatus`)을 검증하고, C1·C6 은 수동 확인으로 남긴다.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, ids } from '../helpers'
import { expiryStatus, withExpiryStatus } from '@/lib/expiry'
import { planFefo } from '@/lib/fefo'
import { applyMovement } from '@/lib/stock'
import { addDays, dateOnly, today } from '@/lib/date'

/** 시드와 겹치지 않는 날짜만 쓴다 — 뒤에서 자기 흔적만 지운다 */
const PAST = dateOnly(addDays(today(), -777))
const SOON_D = dateOnly(addDays(today(), 30))
const FAR = dateOnly(addDays(today(), 777))
const MINE = [PAST, SOON_D, FAR]

async function cleanup() {
  await db.movement.deleteMany({ where: { expiryDate: { in: MINE } } })
  await db.lot.deleteMany({ where: { expiryDate: { in: MINE } } })
}

const lot = (id: number, expiryDate: Date, quantity: number, alertDays = 60) => ({
  id,
  expiryDate,
  quantity,
  alertDays,
})

describe('Issue #1 — 출고 수동 선택 목록의 유통기한 배지', () => {
  beforeAll(cleanup)
  afterAll(async () => {
    await cleanup()
    await db.$disconnect()
  })

  it('C2. 배지 판정이 expiryStatus 결과와 일치한다', () => {
    const rows = withExpiryStatus([
      lot(1, PAST, 5),
      lot(2, SOON_D, 5),
      lot(3, FAR, 5),
    ])

    expect(rows.map((r) => r.status)).toEqual(['EXPIRED', 'SOON', 'OK'])

    // 별도 기준을 만들지 않았는지 — 기존 판정 함수와 한 글자도 다르면 안 된다
    for (const r of rows) {
      expect(r.status).toBe(expiryStatus(r.expiryDate, r.alertDays))
    }
  })

  it('C3. 임박 판정에 상품별 alertDays 가 반영된다', () => {
    // 같은 날짜라도 상품의 경고 기준일이 다르면 판정이 갈려야 한다 (REQ-F-01)
    const [strict] = withExpiryStatus([lot(1, SOON_D, 5, 60)])
    const [loose] = withExpiryStatus([lot(2, SOON_D, 5, 14)])

    expect(strict.status).toBe('SOON')
    expect(loose.status).toBe('OK') // 60일로 하드코딩돼 있으면 여기서 깨진다
  })

  it('C4. 만료 로트를 수동 선택해 사유와 함께 출고하면 저장된다', async () => {
    const { own, user, product } = await ids()

    await db.lot.create({
      data: { productId: product.id, locationId: own.id, expiryDate: PAST, quantity: 10 },
    })

    await db.$transaction((tx) =>
      applyMovement(tx, {
        type: 'OUTBOUND',
        reason: 'SALE',
        note: '만료 임박분 우선 소진',
        productId: product.id,
        expiryDate: PAST,
        quantity: 4,
        fromLocationId: own.id,
        userId: user.id,
      })
    )

    const after = await db.lot.findUnique({
      where: {
        productId_locationId_expiryDate: {
          productId: product.id,
          locationId: own.id,
          expiryDate: PAST,
        },
      },
    })
    // 배지는 안내일 뿐 — 만료 로트 출고를 막지 않는다 (RULE-06)
    expect(after?.quantity).toBe(6)
  })

  it('C5. FEFO 자동 배분 결과와 재고 차감이 변경되지 않는다', () => {
    const lots = [lot(3, FAR, 5), lot(1, PAST, 5), lot(2, SOON_D, 5)]
    const { plan, shortage } = planFefo(lots, 7)

    // 만료분이 후보에서 빠지지 않고, 유통기한이 빠른 순서 그대로다
    expect(plan.map((p) => p.lotId)).toEqual([1, 2])
    expect(plan.map((p) => p.qty)).toEqual([5, 2])
    expect(shortage).toBe(0)
  })
})
