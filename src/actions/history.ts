'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireUser, SessionExpiredError } from '@/lib/auth'
import { reverseMovement } from '@/lib/stock'
import type { SaveResult } from './inbound'

/**
 * 이력 취소 (F10 · RULE-08)
 *
 * 기록을 지우지 않는다. **방향을 뒤집은 기록을 새로 만들어** 상쇄한다.
 * 그래서 목록에는 원본과 상쇄가 둘 다 남는다.
 *
 * 중복 취소 금지와 상쇄 기록 재취소 금지는 `reverseMovement` 가
 * 트랜잭션 안에서 판정한다 — 화면이 두 번 눌러도 안전하다.
 */
export async function cancelMovement(movementId: number, note?: string): Promise<SaveResult> {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof SessionExpiredError) return { ok: false, error: e.message }
    throw e
  }

  try {
    await db.$transaction((tx) => reverseMovement(tx, movementId, user.id, note))
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '취소하지 못했습니다' }
  }

  revalidatePath('/history')
  revalidatePath('/')
  return { ok: true, message: `#${movementId} 취소` }
}
