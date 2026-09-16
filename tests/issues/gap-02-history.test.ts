/**
 * GAP-02 — `/history` 화면 (`REQ-F-10` · `DOD-11`)
 *
 * 이력이 쌓이기만 하고 볼 방법이 없었다. `DOD-11`("이력 화면에서 모든 행위의
 * 누가·언제가 확인된다")을 만족시킬 수단이 아예 없던 상태다.
 *
 * 화면 렌더는 node 환경에서 검증할 수 없다. 목록에 넘기는 데이터(`getHistory`)가
 * `REQ-F-10` 이 요구하는 것을 담고, 취소 가능 판정이 `RULE-08` 과 일치하는지 본다.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, ids } from '../helpers'
import { getHistory } from '@/lib/inventory'
import { applyMovement, reverseMovement } from '@/lib/stock'
import { addDays, dateOnly, today } from '@/lib/date'

const EXPIRY = dateOnly(addDays(today(), 555))

async function cleanup() {
  await db.movement.deleteMany({ where: { expiryDate: EXPIRY } })
  await db.lot.deleteMany({ where: { expiryDate: EXPIRY } })
}

describe('GAP-02 — 이력 조회', () => {
  beforeAll(cleanup)
  afterAll(async () => {
    await cleanup()
    await db.$disconnect()
  })

  it('REQ-F-10 이 요구하는 것을 모두 담는다 — 언제·누가·무엇·어디서 어디로·수량·사유', async () => {
    const { own, user, product } = await ids()

    await db.$transaction((tx) =>
      applyMovement(tx, {
        type: 'INBOUND',
        reason: 'PURCHASE',
        note: '이력 테스트',
        productId: product.id,
        expiryDate: EXPIRY,
        quantity: 7,
        toLocationId: own.id,
        userId: user.id,
      })
    )

    const row = (await getHistory({ take: 200 })).find((r) => r.note === '이력 테스트')

    expect(row).toBeDefined()
    expect(row!.createdAt).toBeInstanceOf(Date) // 언제
    expect(row!.userName).toBe(user.name) // 누가
    expect(row!.productName).toBe(product.name) // 무엇
    expect(row!.fromName).toBeNull() // 외부에서
    expect(row!.toName).toBe(own.name) // 자사창고로
    expect(row!.quantity).toBe(7) // 수량
    expect(row!.reason).toBe('PURCHASE') // 사유
  })

  it('최신순으로 돌려준다', async () => {
    const rows = await getHistory({ take: 30 })
    const times = rows.map((r) => r.createdAt.getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('타입으로 거를 수 있다', async () => {
    const rows = await getHistory({ type: 'INBOUND', take: 50 })
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) expect(r.type).toBe('INBOUND')
  })

  it('취소 판정이 RULE-08 과 일치한다 — 취소하면 원본과 상쇄가 둘 다 남는다', async () => {
    const { own, user, product } = await ids()

    const mv = await db.$transaction((tx) =>
      applyMovement(tx, {
        type: 'INBOUND',
        reason: 'PURCHASE',
        note: '취소 대상',
        productId: product.id,
        expiryDate: EXPIRY,
        quantity: 3,
        toLocationId: own.id,
        userId: user.id,
      })
    )

    const before = (await getHistory({ take: 200 })).find((r) => r.id === mv.id)!
    expect(before.canCancel).toBe(true)
    expect(before.reversed).toBe(false)

    await db.$transaction((tx) => reverseMovement(tx, mv.id, user.id))

    const rows = await getHistory({ take: 200 })
    const origin = rows.find((r) => r.id === mv.id)!
    const reversal = rows.find((r) => r.isReversal && r.note?.includes(`#${mv.id}`))!

    // 원본은 지워지지 않는다 — 취소됨으로 표시되고 다시 취소할 수 없다
    expect(origin.reversed).toBe(true)
    expect(origin.canCancel).toBe(false)

    // 상쇄 기록도 목록에 남고, 그것 자체는 취소 대상이 아니다
    expect(reversal).toBeDefined()
    expect(reversal.canCancel).toBe(false)
  })
})

describe('REQ-F-10 — SKU별 · 거점별 조회', () => {
  it('상품으로 거를 수 있다', async () => {
    const { product } = await ids()
    const rows = await getHistory({ productId: product.id, take: 200 })

    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) expect(r.productName).toBe(product.name)
  })

  it('거점으로 거르면 출발·도착 어느 쪽이든 걸린다', async () => {
    const { own } = await ids()
    const rows = await getHistory({ locationId: own.id, take: 200 })

    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.fromName === own.name || r.toName === own.name).toBe(true)
    }
  })

  it('상품과 거점을 함께 걸 수 있다', async () => {
    const { own, product } = await ids()
    const both = await getHistory({ productId: product.id, locationId: own.id, take: 200 })
    const onlyProduct = await getHistory({ productId: product.id, take: 200 })

    expect(both.length).toBeGreaterThan(0)
    expect(both.length).toBeLessThanOrEqual(onlyProduct.length)
    for (const r of both) {
      expect(r.productName).toBe(product.name)
      expect(r.fromName === own.name || r.toName === own.name).toBe(true)
    }
  })
})
