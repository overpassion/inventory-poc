/**
 * GAP-01 — 재고 조정 · 실사 (`REQ-F-08` · `DOD-08` · `RULE-10`)
 *
 * "풀필먼트사 수치가 진실"이라는 원칙에는 실행 수단이 없었다. 저쪽 숫자가
 * 맞다고 정해 놓고도 장부를 거기에 맞출 방법이 앱에 없던 상태다 (`ASM-03`).
 *
 * 화면 렌더는 node 환경에서 볼 수 없다. 대신 화면과 서버가 **함께 쓰는**
 * 순수 함수(`diffAdjustment` · `adjustmentError`)와 실제 기록을 만드는
 * `applyAdjustment` 를 본다 — 확정 버튼이 막히는 규칙이 여기 들어 있다.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, ids, totalStock } from '../helpers'
import { adjustmentError, applyAdjustment, diffAdjustment } from '@/lib/adjust'
import { getAdjustSheet, getHistory } from '@/lib/inventory'
import { applyMovement } from '@/lib/stock'
import { addDays, dateOnly, today } from '@/lib/date'

const EXPIRY = dateOnly(addDays(today(), 777))

async function cleanup() {
  await db.movement.deleteMany({ where: { expiryDate: EXPIRY } })
  await db.lot.deleteMany({ where: { expiryDate: EXPIRY } })
}

/** 이 테스트가 쓸 로트를 이 거점에 만든다 — 장부 수량 = qty */
async function seedLot(locationId: number, productId: number, userId: number, qty: number) {
  await db.$transaction((tx) =>
    applyMovement(tx, {
      type: 'INBOUND',
      reason: 'PURCHASE',
      note: '실사 테스트 준비',
      productId,
      expiryDate: EXPIRY,
      quantity: qty,
      toLocationId: locationId,
      userId,
    })
  )
  return db.lot.findUniqueOrThrow({
    where: { productId_locationId_expiryDate: { productId, locationId, expiryDate: EXPIRY } },
  })
}

describe('차이 계산 — diffAdjustment', () => {
  const books = [
    { lotId: 1, book: 10 },
    { lotId: 2, book: 4 },
    { lotId: 3, book: 0 },
  ]

  it('센 수가 장부와 같은 줄은 빠진다 — 기록을 만들 이유가 없다', () => {
    const { diffs } = diffAdjustment(books, [
      { lotId: 1, counted: 10 },
      { lotId: 2, counted: 4 },
    ])
    expect(diffs).toEqual([])
  })

  it('실물이 적으면 음수, 많으면 양수', () => {
    const { diffs } = diffAdjustment(books, [
      { lotId: 1, counted: 7 },
      { lotId: 2, counted: 6 },
    ])
    expect(diffs).toEqual([
      { lotId: 1, book: 10, counted: 7, delta: -3 },
      { lotId: 2, book: 4, counted: 6, delta: 2 },
    ])
  })

  it('장부가 0 인 로트도 센다 — 장부에 없던 실물이야말로 실사가 찾는 것이다', () => {
    const { diffs } = diffAdjustment(books, [{ lotId: 3, counted: 5 }])
    expect(diffs).toEqual([{ lotId: 3, book: 0, counted: 5, delta: 5 }])
  })

  it('이 거점의 로트가 아니면 unknown 으로 셈한다', () => {
    const { diffs, unknown } = diffAdjustment(books, [
      { lotId: 1, counted: 9 },
      { lotId: 99, counted: 1 },
    ])
    expect(unknown).toBe(1)
    expect(diffs).toHaveLength(1)
  })
})

describe('확정 조건 — adjustmentError (DOD-08 · RULE-10)', () => {
  const diffs = [{ lotId: 1, book: 10, counted: 7, delta: -3 }]

  it('사유 없이는 확정되지 않는다 — DOD-08', () => {
    expect(adjustmentError({ reason: '', note: '', diffs })).toBeTruthy()
  })

  it('조정 사유가 아닌 코드는 받지 않는다', () => {
    expect(adjustmentError({ reason: 'SALE', note: '', diffs })).toBeTruthy()
  })

  it('OTHER 는 메모 없이 저장할 수 없다 — RULE-10', () => {
    expect(adjustmentError({ reason: 'OTHER', note: '   ', diffs })).toBeTruthy()
    expect(adjustmentError({ reason: 'OTHER', note: '창고 이전 중 누락', diffs })).toBeNull()
  })

  it('장부와 다른 줄이 없으면 확정할 것이 없다', () => {
    expect(adjustmentError({ reason: 'COUNT_DIFF', note: '', diffs: [] })).toBeTruthy()
  })

  it('센 수가 음수면 막는다', () => {
    const minus = [{ lotId: 1, book: 10, counted: -1, delta: -11 }]
    expect(adjustmentError({ reason: 'COUNT_DIFF', note: '', diffs: minus })).toBeTruthy()
  })

  it('남의 거점 로트가 섞이면 막는다', () => {
    expect(adjustmentError({ reason: 'COUNT_DIFF', note: '', diffs, unknown: 1 })).toBeTruthy()
  })

  it('사유가 있고 차이가 있으면 통과한다', () => {
    expect(adjustmentError({ reason: 'COUNT_DIFF', note: '', diffs })).toBeNull()
  })
})

describe('실사 시트 — getAdjustSheet', () => {
  beforeAll(cleanup)
  afterAll(cleanup)

  it('그 거점의 로트를 장부 수량과 함께, 유통기한 순으로 준다', async () => {
    const { ff, user, product } = await ids()
    const lot = await seedLot(ff.id, product.id, user.id, 12)

    const sheet = await getAdjustSheet(ff.id)
    expect(sheet).not.toBeNull()
    expect(sheet!.location.id).toBe(ff.id)

    const row = sheet!.rows.find((r) => r.lotId === lot.id)
    expect(row).toBeDefined()
    expect(row!.book).toBe(12)
    expect(row!.sku).toBe(product.sku)

    const days = sheet!.rows.map((r) => new Date(r.expiry).getTime())
    expect(days).toEqual([...days].sort((a, b) => a - b))
  })

  it('다른 거점의 로트는 섞이지 않는다', async () => {
    const { own, ff } = await ids()
    const mine = await getAdjustSheet(own.id)
    const other = await getAdjustSheet(ff.id)
    const ownIds = new Set(mine!.rows.map((r) => r.lotId))
    for (const r of other!.rows) expect(ownIds.has(r.lotId)).toBe(false)
  })

  it('없는 거점은 null', async () => {
    expect(await getAdjustSheet(999_999)).toBeNull()
  })
})

describe('조정 적용 — applyAdjustment', () => {
  beforeAll(cleanup)
  afterAll(async () => {
    await cleanup()
    await db.$disconnect()
  })

  it('장부를 실물에 맞추고, 차이만큼 ADJUST 기록을 남긴다', async () => {
    const { ff, user, product } = await ids()
    const lot = await seedLot(ff.id, product.id, user.id, 12)
    const before = await totalStock()

    const { diffs } = diffAdjustment(
      (await getAdjustSheet(ff.id))!.rows.map((r) => ({ lotId: r.lotId, book: r.book })),
      [{ lotId: lot.id, counted: 9 }]
    )
    expect(adjustmentError({ reason: 'COUNT_DIFF', note: '', diffs })).toBeNull()

    const created = await db.$transaction((tx) =>
      applyAdjustment(tx, {
        locationId: ff.id,
        reason: 'COUNT_DIFF',
        note: '실사 테스트',
        userId: user.id,
        diffs,
      })
    )

    expect(created).toBe(1)
    const after = await db.lot.findUniqueOrThrow({ where: { id: lot.id } })
    expect(after.quantity).toBe(9) // 장부가 실물을 따라간다

    // 실사는 총 재고를 바꾼다 — 내부 이동이 아니다
    expect(await totalStock()).toBe(before - 3)

    const mv = await db.movement.findFirstOrThrow({
      where: { expiryDate: EXPIRY, type: 'ADJUST' },
      orderBy: { id: 'desc' },
    })
    expect(mv.quantity).toBe(3)
    expect(mv.reason).toBe('COUNT_DIFF')
    expect(mv.fromLocationId).toBe(ff.id) // 실물이 적었다 — 거점에서 뺀다
    expect(mv.toLocationId).toBeNull()
  })

  it('실물이 더 많으면 거점으로 들어오는 기록이 생긴다', async () => {
    const { own, user, product } = await ids()
    const lot = await seedLot(own.id, product.id, user.id, 5)

    const { diffs } = diffAdjustment([{ lotId: lot.id, book: 5 }], [{ lotId: lot.id, counted: 8 }])
    await db.$transaction((tx) =>
      applyAdjustment(tx, {
        locationId: own.id,
        reason: 'INPUT_ERROR',
        note: null,
        userId: user.id,
        diffs,
      })
    )

    const after = await db.lot.findUniqueOrThrow({ where: { id: lot.id } })
    expect(after.quantity).toBe(8)

    const mv = await db.movement.findFirstOrThrow({
      where: { expiryDate: EXPIRY, type: 'ADJUST', toLocationId: own.id },
      orderBy: { id: 'desc' },
    })
    expect(mv.quantity).toBe(3)
    expect(mv.fromLocationId).toBeNull()
  })

  it('조정도 이력에 남는다 — 지워지지 않고 되돌릴 수 있다 (REQ-F-10 · RULE-08)', async () => {
    const rows = await getHistory({ type: 'ADJUST', take: 50 })
    const mine = rows.find((r) => r.note === '실사 테스트')

    expect(mine).toBeDefined()
    expect(mine!.reason).toBe('COUNT_DIFF')
    expect(mine!.canCancel).toBe(true)
  })

  it('한 트랜잭션이다 — 한 줄이 실패하면 앞 줄도 남지 않는다', async () => {
    const { own, user, product } = await ids()
    const lot = await seedLot(own.id, product.id, user.id, 4)
    const before = await db.lot.findUniqueOrThrow({ where: { id: lot.id } })

    await expect(
      db.$transaction((tx) =>
        applyAdjustment(tx, {
          locationId: own.id,
          reason: 'COUNT_DIFF',
          note: null,
          userId: user.id,
          diffs: [
            { lotId: lot.id, book: before.quantity, counted: before.quantity - 1, delta: -1 },
            { lotId: 999_999, book: 1, counted: 0, delta: -1 }, // 없는 로트
          ],
        })
      )
    ).rejects.toThrow()

    const after = await db.lot.findUniqueOrThrow({ where: { id: lot.id } })
    expect(after.quantity).toBe(before.quantity) // 앞 줄도 롤백됐다
  })
})
