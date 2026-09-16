import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@/generated/prisma/client'

/**
 * PrismaClient 싱글턴.
 * Prisma 7은 드라이버 어댑터를 통해 SQLite에 접속한다.
 *
 * WAL(Write-Ahead Log) 설정은 여기가 아니라 `scripts/ensure-db.ts` 가 한다 —
 * `journal_mode` 는 DB 파일의 영속 속성이라 한 번만 걸면 되고,
 * 어댑터에는 pragma 옵션이 없다 (SSOT §3.7).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient() {
  const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
  const adapter = new PrismaBetterSqlite3({ url })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
