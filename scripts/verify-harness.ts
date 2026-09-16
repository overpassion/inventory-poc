/**
 * 하네스 보호 경로 검증.
 *
 * 01-ssot.md §0.6 에서 AI 에게 "읽기" 또는 "실행"만 허용된 파일이
 * 사람 승인 없이 바뀌지 않았는지 확인한다.
 *
 *   npm run verify:harness              # 검증 — 바뀌었으면 exit 1
 *   npm run verify:harness -- --update  # 기준선 갱신 (사람이 승인할 때만)
 *
 * 줄바꿈(CRLF/LF)은 정규화 후 해시하므로 OS 차이로 실패하지 않는다.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MANIFEST = path.join(ROOT, 'docs/harness/protected.json')

/** 01-ssot.md §0.6 경로 매핑에서 AI 가 고칠 수 없는 것만 추린 목록 */
const PROTECTED = [
  { file: 'AGENTS.md', area: '하네스 핵심 규칙', ai: '읽기' },
  { file: 'CLAUDE.md', area: '하네스 핵심 규칙', ai: '읽기' },
  { file: 'docs/harness/01-ssot.md', area: '하네스 핵심 규칙 + 요구사항·아키텍처', ai: '읽기' },
  { file: 'docs/harness/02-verification.md', area: '하네스 핵심 규칙', ai: '읽기' },
  { file: 'docs/harness/03-loop.md', area: '하네스 핵심 규칙', ai: '읽기' },
  { file: 'docs/harness/04-workflow.md', area: '하네스 핵심 규칙', ai: '읽기' },
  { file: 'docs/01-requirements.md', area: '요구사항', ai: '읽기' },
  { file: 'docs/06-architecture.md', area: '아키텍처', ai: '읽기' },
  { file: 'scripts/verify-harness.ts', area: '검증 스크립트', ai: '실행' },
  { file: 'scripts/verify-m1.ts', area: '검증 스크립트', ai: '실행' },
  { file: 'scripts/verify-headline.ts', area: '검증 스크립트', ai: '실행' },
  { file: 'scripts/snapshot.ts', area: '검증 스크립트', ai: '실행' },
] as const

type Manifest = { note: string; generatedAt: string; files: Record<string, string> }

const digest = (file: string) => {
  const raw = readFileSync(path.join(ROOT, file), 'utf-8').replace(/\r\n/g, '\n')
  return createHash('sha256').update(raw).digest('hex')
}

function update() {
  const files: Record<string, string> = {}
  for (const { file } of PROTECTED) files[file] = digest(file)
  const manifest: Manifest = {
    note: '01-ssot.md §0.6 보호 경로의 기준선. 사람이 승인한 변경 뒤에만 갱신한다.',
    generatedAt: new Date().toISOString(),
    files,
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
  console.log(`▸ 기준선 갱신 — 보호 경로 ${PROTECTED.length}개`)
  for (const { file } of PROTECTED) console.log(`    ${files[file].slice(0, 12)}  ${file}`)
}

function verify() {
  if (!existsSync(MANIFEST)) {
    console.error('❌ 기준선이 없다. `npm run verify:harness -- --update` 로 먼저 만든다.')
    process.exit(1)
  }
  const manifest: Manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'))
  const failures: string[] = []

  console.log('▸ 보호 경로 검증 (01-ssot.md §0.6)\n')
  for (const { file, area, ai } of PROTECTED) {
    const expected = manifest.files[file]
    if (!expected) {
      failures.push(`${file} — 기준선에 없음`)
      console.log(`  ❌ ${file}  (기준선 없음)`)
      continue
    }
    if (!existsSync(path.join(ROOT, file))) {
      failures.push(`${file} — 파일이 사라짐`)
      console.log(`  ❌ ${file}  (파일 없음)`)
      continue
    }
    const actual = digest(file)
    if (actual === expected) {
      console.log(`  ✅ ${file}`)
    } else {
      failures.push(`${file} — 내용이 바뀜 (AI 권한: ${ai}, 영역: ${area})`)
      console.log(`  ❌ ${file}  (변경됨 — AI 권한은 "${ai}")`)
    }
  }

  const orphans = Object.keys(manifest.files).filter(
    (f) => !PROTECTED.some((p) => p.file === f),
  )
  for (const f of orphans) {
    failures.push(`${f} — 보호 목록에서 빠짐`)
    console.log(`  ❌ ${f}  (보호 목록에서 제거됨)`)
  }

  if (failures.length === 0) {
    console.log(`\n▸ 통과 — 보호 경로 ${PROTECTED.length}개 모두 기준선과 일치`)
    return
  }

  console.error(`\n▸ 실패 ${failures.length}건 — 보호 경로가 승인 없이 바뀌었다`)
  for (const f of failures) console.error(`    · ${f}`)
  console.error(
    '\n  이 파일들은 사람이 변경·승인하는 영역이다 (01-ssot.md §0.6).',
    '\n  의도한 변경이라면 사람이 확인한 뒤 `npm run verify:harness -- --update` 로 기준선을 갱신한다.',
  )
  process.exit(1)
}

if (process.argv.includes('--update')) {
  update()
} else {
  verify()
}
