/**
 * GAP-02 — 홈 할 일 배너가 없는 라우트(`/expiry`)로 링크해 404 가 났다.
 *
 * `/expiry` · `/history` · `/settings` 는 M7 이라 아직 없다. 화면을 만드는 대신
 * **배너가 약속한 것을 실제로 보여주는 곳**으로 보낸다 — 홈의 만료 필터다.
 *
 * 링크가 실제로 눌리는지는 node 환경에서 검증할 수 없다. 대신
 *   ① 목적지 경로가 존재하는 라우트인지 (죽은 링크 회귀 방지)
 *   ② 그 목적지가 정말 만료분을 보여주는지
 * 를 확인한다.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { db } from '../helpers'
import { getStockRows, todoHref } from '@/lib/inventory'

/** 경로가 app 라우터에 실재하는 page 인지 — 쿼리는 떼고 본다 */
function routeExists(href: string) {
  const pathname = href.split('?')[0]
  const rel = pathname === '/' ? 'src/app/page.tsx' : `src/app${pathname}/page.tsx`
  return existsSync(path.join(process.cwd(), rel))
}

describe('GAP-02 — 할 일 배너의 목적지', () => {
  afterAll(() => db.$disconnect())

  it('배너가 가리키는 경로는 모두 실재한다 — 죽은 링크가 없다', () => {
    const cases = [
      todoHref({ pendingReflect: 1, transfersDelayed: 0 }),
      todoHref({ pendingReflect: 0, transfersDelayed: 1 }),
      todoHref({ pendingReflect: 0, transfersDelayed: 0 }),
    ]

    for (const href of cases) {
      expect(routeExists(href), `${href} 라우트가 없다`).toBe(true)
    }
  })

  it('만료만 남으면 홈의 만료 필터로 보낸다 — /expiry 는 아직 없다', () => {
    expect(todoHref({ pendingReflect: 0, transfersDelayed: 0 })).toBe('/?filter=expired')
    expect(routeExists('/expiry')).toBe(false) // M7 에서 생기면 이 줄이 깨진다
  })

  it('우선순위는 미반영 → 배송 지연 → 만료 순이다', () => {
    expect(todoHref({ pendingReflect: 1, transfersDelayed: 1 })).toBe('/fulfillment')
    expect(todoHref({ pendingReflect: 0, transfersDelayed: 1 })).toBe('/transfers')
  })

  it('목적지가 실제로 만료 로트만 보여준다', async () => {
    const rows = await getStockRows({ filter: 'expired' })

    // 시드에 만료 재고가 있어야 이 테스트가 의미를 갖는다
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.headline?.status).toBe('EXPIRED')
    }
  })
})
