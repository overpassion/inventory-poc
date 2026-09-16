/**
 * 코드 강제 규칙(`RULE-*`) 중 **기계가 읽을 수 있는 것**을 검사한다.
 *
 *   npm run verify:rules
 *
 * 왜 있는가 — 2026-09-16, 규칙을 어긴 커밋이 `npm run verify` 5단계를 전부
 * 통과했다. 보호 경로 해시는 *파일을 고쳤는지* 만 보고, 테스트는 *불변식*
 * (`INV-*`)만 본다. 그 사이에 `RULE-*` 가 통째로 비어 있었다.
 *
 * 무엇을 하지 않는가 — 규칙을 "이해"하지 않는다. 문자열을 볼 뿐이다.
 * 여기서 잡히지 않는다고 규칙을 지켰다는 뜻이 아니다 (§5 참고).
 * 검사할 수 없는 규칙은 아래 NOT_CHECKED 에 이유와 함께 남긴다.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

type Violation = { rule: string; file: string; line: number; text: string; why: string }

/** 검사 대상 — 앱 코드만. 생성물과 테스트·시드는 뺀다 (아래 §제외 참고) */
const SCAN_ROOT = 'src'
const SKIP_DIRS = ['generated', 'node_modules']
const EXT = ['.ts', '.tsx']

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      if (SKIP_DIRS.includes(name)) continue
      walk(full, out)
    } else if (EXT.includes(path.extname(name))) {
      out.push(path.relative(ROOT, full).replace(/\\/g, '/'))
    }
  }
  return out
}

/**
 * `RULE-01` — 재고 수량을 바꾸는 코드는 `lib/stock.ts` 의 `applyMovement()`
 * 한 곳에만 존재한다. 화면·액션은 `prisma.lot.update()` 를 직접 부르지 않는다.
 *
 * `Movement` 생성도 함께 막는다. 이력 없는 재고 변경을 금지한 `INV-07` 이
 * 성립하려면 **두 테이블이 같은 문에서만** 움직여야 한다.
 */
const OWNER = 'src/lib/stock.ts'
const MUTATION =
  /\b(lot|movement)\s*\.\s*(update|updateMany|upsert|create|createMany|delete|deleteMany)\s*\(/

/**
 * `RULE-02` — `applyMovement()` 는 반드시 `$transaction()` 안에서 호출한다.
 *
 * "트랜잭션 안인가"를 문자열로 알 수는 없다. 대신 **확실히 밖인 경우**만
 * 잡는다 — 전역 클라이언트(`db` · `prisma`)를 첫 인자로 넘긴 호출이다.
 * 트랜잭션 클라이언트는 이름이 `tx` · `t` 처럼 콜백 인자에서 온다.
 */
const GLOBAL_CLIENT_CALL = /\bapplyMovement\s*\(\s*(db|prisma)\b/

/** 문자열로는 확인할 수 없는 규칙 — 무엇이 검사 밖인지 적어 둔다 */
const NOT_CHECKED: Record<string, string> = {
  'RULE-03': '음수 재고 금지 — tests/stock-invariant (INV-01) 가 실제로 돌려서 본다',
  'RULE-04': '배분 방향(FEFO/LEFO) — tests/fefo 가 본다',
  'RULE-05': '한 거점 안에서만 배분 — 테스트 밖. 사람이 본다',
  'RULE-06': '만료 로트도 후보에 포함 — tests/fefo 가 본다',
  'RULE-07': '팝업 누적 정산 — tests/popup-settle (INV-05·06) 가 본다',
  'RULE-08': '상쇄 1회 제한 — tests/issues/gap-02-history 가 본다',
  'RULE-09': '로트 수만큼 호출 — 호출 횟수는 정적으로 셀 수 없다. 사람이 본다',
  'RULE-10': '사유 기본값 · OTHER 메모 — 메모 쪽은 테스트가 있고, 기본값 쪽은 화면이라 node 환경 밖이다. 사람이 본다',
}

function main() {
  const files = walk(path.join(ROOT, SCAN_ROOT))
  const violations: Violation[] = []

  for (const file of files) {
    const lines = readFileSync(path.join(ROOT, file), 'utf-8').split(/\r?\n/)

    lines.forEach((raw, i) => {
      const line = raw.trim()
      // 주석은 규칙을 설명하느라 같은 문자열을 쓴다 (stock.ts 머리글이 그렇다)
      if (line.startsWith('*') || line.startsWith('//')) return

      if (file !== OWNER && MUTATION.test(line)) {
        violations.push({
          rule: 'RULE-01',
          file,
          line: i + 1,
          text: line,
          why: `재고·이력을 직접 바꿨다. ${OWNER} 의 applyMovement() 를 통한다`,
        })
      }
      if (GLOBAL_CLIENT_CALL.test(line)) {
        violations.push({
          rule: 'RULE-02',
          file,
          line: i + 1,
          text: line,
          why: '전역 클라이언트로 호출했다. db.$transaction(tx => applyMovement(tx, …)) 안에서 부른다',
        })
      }
    })
  }

  console.log('▸ 코드 강제 규칙 검증 (01-ssot.md §4.2)\n')
  console.log(`  대상 ${files.length}개 파일 (${SCAN_ROOT}/ · 생성물 제외)`)
  console.log(`  검사 RULE-01 · RULE-02   문자열로 확인 불가 ${Object.keys(NOT_CHECKED).length}건\n`)

  if (violations.length === 0) {
    console.log('▸ 통과 — 재고·이력을 바꾸는 코드는 stock.ts 한 곳뿐이다')
    return
  }

  console.error(`▸ 실패 ${violations.length}건`)
  for (const v of violations) {
    console.error(`\n  ❌ ${v.rule}  ${v.file}:${v.line}`)
    console.error(`     ${v.text}`)
    console.error(`     ${v.why}`)
  }
  console.error(
    '\n  규칙은 01-ssot.md §4.2 에 있다. 규칙 자체를 바꿔야 한다면 코드가 아니라',
    '\n  SSOT 부터 고쳐야 하고, 그것은 사람이 한다 (§0.5 · §0.6).',
  )
  process.exit(1)
}

main()
