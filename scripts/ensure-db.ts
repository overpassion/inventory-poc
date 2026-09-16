/**
 * 첫 실행 자동 준비.
 *
 * dev.db 파일이 없으면 마이그레이션과 시드를 알아서 돌린다.
 * 수강생은 `git clone → npm install → npm run dev` 세 줄이면 된다.
 * (DB 파일은 커밋하지 않는다 — 바이너리라 병합이 안 되고, 스키마가 어긋난다)
 */
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import Database from 'better-sqlite3'
import 'dotenv/config'

const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
const dbPath = path.resolve(process.cwd(), url.replace(/^file:/, ''))

const run = (cmd: string) => execSync(cmd, { stdio: 'inherit' })

/**
 * WAL(Write-Ahead Log, 변경내용을 먼저 기록) 모드로 전환한다 — SSOT §3.7.
 *
 * `journal_mode` 는 DB 파일의 영속 속성이라 **한 번만** 걸면 된다.
 * 어댑터(`PrismaBetterSqlite3`)에는 pragma 옵션이 없어 여기서 직접 건다.
 * 이미 WAL이면 아무것도 하지 않는다.
 */
function ensureWal() {
  const db = new Database(dbPath)
  try {
    const before = db.pragma('journal_mode', { simple: true })
    if (before === 'wal') return
    const after = db.pragma('journal_mode = WAL', { simple: true })
    console.log(`▸ WAL 모드로 전환했습니다 (${before} → ${after})`)
  } finally {
    db.close()
  }
}

if (existsSync(dbPath)) {
  ensureWal() // 이미 있는 DB도 전환한다 — 이 단계를 조기 종료보다 앞에 둔다
  process.exit(0)
}

console.log('\n▸ 데이터베이스가 없어 새로 만듭니다 (최초 1회)\n')
run('npx prisma migrate deploy')
run('npx prisma generate')
run('npx tsx prisma/seed.ts')
ensureWal()
console.log('\n▸ 준비 완료. 로그인: warehouse@demo.kr / demo1234\n')
