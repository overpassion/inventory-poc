import { notFound } from 'next/navigation'
import { AdjustSheet } from '@/components/AdjustSheet'
import { getAdjustSheet } from '@/lib/inventory'
import { AVAILABLE_LOCATION_TYPES, type LocationType } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function AdjustSheetPage({
  params,
}: {
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params
  const sheet = await getAdjustSheet(Number(locationId))
  if (!sheet) notFound()

  // 「배송 중」·「폐기」는 셀 수 있는 실물이 없다 — 주소를 직접 쳐도 열리지 않는다
  if (!AVAILABLE_LOCATION_TYPES.includes(sheet.location.type as LocationType)) notFound()

  return (
    <AdjustSheet
      location={{
        id: sheet.location.id,
        name: sheet.location.name,
        type: sheet.location.type as LocationType,
      }}
      rows={sheet.rows}
    />
  )
}
