import Link from 'next/link'
import { logout } from '@/actions/auth'

/** 홈 최상단 — 검색이 첫 화면의 주인공이다 (S10) */
export function SearchHeader({
  skuCount,
  available,
  q,
  userName,
}: {
  skuCount: number
  available: number
  q?: string
  userName: string
}) {
  return (
    <header className="acc-grad px-4 pb-4 pt-3 text-white">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-[15px] font-extrabold tracking-tight">
          재고
        </Link>
        <div className="flex items-center gap-3">
          {/* 조회 화면은 작업(＋)과 섞지 않는다 */}
          <Link href="/history" className="text-[11.5px] opacity-85">
            이력
          </Link>
          <form action={logout}>
            <button className="text-[11.5px] opacity-85">{userName} · 로그아웃</button>
          </form>
        </div>
      </div>

      <p className="mt-1 text-[11.5px] opacity-85">
        전체 {skuCount} SKU · 가용 <b className="tnum">{available.toLocaleString()}</b>개
      </p>

      <form action="/" className="mt-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="🔍 상품 검색"
          autoComplete="off"
          className="w-full rounded-xl bg-white/20 px-3 py-2.5 text-[13px] text-white placeholder-white/70 outline-none focus:bg-white/25"
        />
      </form>
    </header>
  )
}
