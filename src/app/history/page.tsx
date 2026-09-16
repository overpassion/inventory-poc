import Link from 'next/link'
import { HistoryList } from '@/components/HistoryList'
import { getHistory } from '@/lib/inventory'
import { MOVEMENT_TYPES, MOVEMENT_TYPE_LABEL, type MovementType } from '@/lib/constants'

export const dynamic = 'force-dynamic'

const TAKE = 100

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const rows = await getHistory({ type, take: TAKE })

  const chips: { key: string; label: string }[] = [
    { key: 'all', label: '전체' },
    ...Object.values(MOVEMENT_TYPES).map((t) => ({
      key: t,
      label: MOVEMENT_TYPE_LABEL[t as MovementType],
    })),
  ]
  const active = type ?? 'all'

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
            href={c.key === 'all' ? '/history' : `/history?type=${c.key}`}
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

      <p className="border-b border-line bg-dim px-4 py-2.5 text-[11.5px] text-[#5b5570]">
        기록은 지우지 않습니다. 취소하면 <b>반대 기록이 새로 생기고</b> 둘 다 남습니다
      </p>

      <HistoryList rows={rows} />
    </main>
  )
}
