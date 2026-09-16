import Link from 'next/link'
import { HistoryList } from '@/components/HistoryList'
import { getHistory, getLocations } from '@/lib/inventory'
import { db } from '@/lib/db'
import { MOVEMENT_TYPES, MOVEMENT_TYPE_LABEL, type MovementType } from '@/lib/constants'

export const dynamic = 'force-dynamic'

const TAKE = 100

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; product?: string; location?: string }>
}) {
  const sp = await searchParams
  const productId = Number(sp.product) || undefined
  const locationId = Number(sp.location) || undefined

  const [rows, products, locations] = await Promise.all([
    getHistory({ type: sp.type, productId, locationId, take: TAKE }),
    db.product.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    getLocations(),
  ])

  /** 타입 칩을 눌러도 상품·거점 선택은 유지된다 */
  const chipHref = (key: string) => {
    const p = new URLSearchParams()
    if (key !== 'all') p.set('type', key)
    if (productId) p.set('product', String(productId))
    if (locationId) p.set('location', String(locationId))
    const s = p.toString()
    return s ? `/history?${s}` : '/history'
  }

  const chips = [
    { key: 'all', label: '전체' },
    ...Object.values(MOVEMENT_TYPES).map((t) => ({
      key: t,
      label: MOVEMENT_TYPE_LABEL[t as MovementType],
    })),
  ]
  const active = sp.type ?? 'all'
  const filtered = Boolean(sp.type || productId || locationId)

  return (
    <main className="pb-16">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <Link href="/" className="text-[14.5px] font-extrabold">
          ‹ 이력
        </Link>
        <span className="text-[11px] text-sub">최근 {TAKE}건</span>
      </header>

      <nav className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5 [scrollbar-width:none]">
        {chips.map((c) => (
          <Link
            key={c.key}
            href={chipHref(c.key)}
            className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11.5px] ${
              active === c.key
                ? 'border-acc-line bg-acc-soft font-extrabold text-acc'
                : 'border-[#e2ddec] text-[#5b5570]'
            }`}
          >
            {c.label}
          </Link>
        ))}
      </nav>

      {/* SKU별 · 거점별 조회 (REQ-F-10). JS 없이 도는 GET 폼이다 */}
      <form action="/history" className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        {sp.type && <input type="hidden" name="type" value={sp.type} />}

        <select
          name="product"
          defaultValue={productId ? String(productId) : ''}
          className="min-w-0 flex-1 rounded-lg border border-[#e2ddec] px-2 py-1.5 text-[11.5px]"
        >
          <option value="">전체 상품</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          name="location"
          defaultValue={locationId ? String(locationId) : ''}
          className="min-w-0 flex-1 rounded-lg border border-[#e2ddec] px-2 py-1.5 text-[11.5px]"
        >
          <option value="">전체 거점</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <button className="rounded-lg bg-acc-soft px-3 py-1.5 text-[11.5px] font-extrabold text-acc">
          보기
        </button>
        {filtered && (
          <Link href="/history" className="px-1 text-[11.5px] text-sub">
            초기화
          </Link>
        )}
      </form>

      <p className="border-b border-line bg-dim px-4 py-2.5 text-[11.5px] text-[#5b5570]">
        기록은 지우지 않습니다. 취소하면 <b>반대 기록이 새로 생기고</b> 둘 다 남습니다
      </p>

      <HistoryList rows={rows} />
    </main>
  )
}
