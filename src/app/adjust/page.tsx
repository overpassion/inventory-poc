import Link from 'next/link'
import { Badge } from '@/components/StatusBadge'
import { getAdjustLocations } from '@/lib/inventory'
import { LOCATION_TYPES, LOCATION_TYPE_LABEL } from '@/lib/constants'
import { formatDate } from '@/lib/date'

export const dynamic = 'force-dynamic'

export default async function AdjustPage() {
  const locations = await getAdjustLocations()

  return (
    <main className="pb-16">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <Link href="/" className="text-[14.5px] font-extrabold">
          ‹ 재고 조정 · 실사
        </Link>
      </header>

      <p className="border-b border-line bg-dim px-4 py-2.5 text-[11.5px] leading-relaxed text-[#5b5570]">
        센 수를 적으면 <b>장부가 실물을 따라갑니다.</b> 조정에는 사유가 반드시 붙고, 기록은
        지워지지 않습니다
      </p>

      {locations.map((l) => (
        <Link
          key={l.id}
          href={`/adjust/${l.id}`}
          className="flex items-center justify-between border-b border-line px-4 py-3.5"
        >
          <div>
            <p className="text-[13.5px] font-bold">{l.name}</p>
            <p className="mt-[3px] text-[11px] text-sub tnum">
              로트 {l.lotCount}개 · {l.total.toLocaleString()}개 보유
              {l.lastAdjustedAt && ` · 마지막 조정 ${formatDate(l.lastAdjustedAt)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={l.type === LOCATION_TYPES.OWN ? 'ok' : 'acc'}>
              {LOCATION_TYPE_LABEL[l.type]}
            </Badge>
            <span className="text-sub">›</span>
          </div>
        </Link>
      ))}

      <p className="mx-4 mt-4 rounded-xl bg-dim px-3.5 py-3 text-[11.5px] leading-relaxed text-[#5b5570]">
        자사창고는 <b>로트별로 직접 세어</b> 적고, 풀필먼트는 저쪽 재고표의 숫자를 옮겨 적습니다.
        배송 중과 폐기는 셀 수 있는 실물이 없어 여기 나오지 않습니다
      </p>
    </main>
  )
}
