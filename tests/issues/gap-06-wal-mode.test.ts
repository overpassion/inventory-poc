/**
 * GAP-06 — `db.ts` 주석은 "WAL 모드로 열어..." 라고 하는데 실제로는
 * `PRAGMA journal_mode` 를 실행하지 않아 `dev.db` 가 `delete` 모드였다.
 *
 * SSOT §3.7 이 WAL(Write-Ahead Log, 변경내용을 먼저 기록)을 요구한다.
 * `journal_mode` 는 DB 파일의 영속 속성이므로 `db:ensure` 가 한 번 걸어두면
 * 이후 모든 접속에 적용된다.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { db } from '../helpers'

describe('GAP-06 — WAL 모드', () => {
  afterAll(() => db.$disconnect())

  it('dev.db 는 WAL 모드로 열린다 (SSOT §3.7)', async () => {
    const rows = await db.$queryRawUnsafe<{ journal_mode: string }[]>('PRAGMA journal_mode')

    // delete(롤백 저널)면 쓰는 동안 읽기가 막힌다 — §3.7 의 전제가 깨진다
    expect(rows[0]?.journal_mode?.toLowerCase()).toBe('wal')
  })
})
