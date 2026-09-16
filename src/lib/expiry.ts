import { daysUntil } from './date'
import { DEFAULT_EXPIRY_ALERT_DAYS } from './constants'

export type ExpiryStatus = 'EXPIRED' | 'SOON' | 'OK'

/**
 * 유통기한 상태 판정.
 * 경고 기준일은 상품마다 다르다 (F1).
 */
export function expiryStatus(expiryDate: Date, alertDays = DEFAULT_EXPIRY_ALERT_DAYS): ExpiryStatus {
  const d = daysUntil(expiryDate)
  if (d < 0) return 'EXPIRED'
  if (d <= alertDays) return 'SOON'
  return 'OK'
}

/**
 * 로트 목록에 유통기한 상태를 붙인다.
 * 화면과 테스트가 같은 함수를 쓴다 — 배지 판정이 화면에만 있으면 검증할 수 없다.
 * 기준일은 로트가 들고 있는 `alertDays` 를 쓴다. 품목마다 다르다 (F1).
 */
export function withExpiryStatus<T extends { expiryDate: Date; alertDays: number }>(
  lots: T[]
): (T & { status: ExpiryStatus })[] {
  return lots.map((l) => ({ ...l, status: expiryStatus(l.expiryDate, l.alertDays) }))
}

export const EXPIRY_LABEL: Record<ExpiryStatus, string> = {
  EXPIRED: '만료',
  SOON: '임박',
  OK: '정상',
}

/** 색만으로 구분하지 않는다 — 배지 글자를 함께 쓴다 (접근성) */
export const EXPIRY_CLASS: Record<ExpiryStatus, string> = {
  EXPIRED: 'bg-red-bg text-red',
  SOON: 'bg-amber-bg text-amber',
  OK: 'bg-ok-bg text-ok',
}
