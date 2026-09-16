# 02. 검증 — 변경을 확인하는 방법

> 작성일: 2026-09-16 · 기준 커밋: `f458ea8`
> [SSOT](./01-ssot.md) §4 · §5 의 상세다. SSOT와 다르면 SSOT를 따르고, 이 문서의 변경은 사람이 한다.
> 루프 안에서 언제 멈추는지는 [03-loop.md](./03-loop.md) 가 정한다.
> 참고 원문: [01-requirements.md](../01-requirements.md) · [06-architecture.md](../06-architecture.md) · [07-plan.md](../07-plan.md) §2

---

## 1. 핵심 규칙

기준 원본은 SSOT다.

| 출처 | 내용 |
|---|---|
| [`01-ssot.md`](./01-ssot.md) §4.1 | `INV-01`~`INV-07` — 자동 테스트로 지킬 불변식 |
| [`01-ssot.md`](./01-ssot.md) §2.4 | `DOD-01`~`DOD-12` — 완료 기준 (Definition of Done) |
| [`01-ssot.md`](./01-ssot.md) §0.6 | **통과 기준을 낮춰 초록 불을 만들지 않는다.** 검증 스크립트는 실행만 한다 |
| [`01-ssot.md`](./01-ssot.md) §5.1 | 커버리지 공백 — 무엇이 검증되지 않는지 |

`07-plan.md` §2 의 QA 체크리스트와 갈리면 **`DOD-*` 를 따른다** (계획 문서 ↔ 요구사항 → 요구사항, §0.5).

---

## 2. 파이프라인 — `npm run verify`

싼 것부터 비싼 것 순. **한 단계라도 실패하면 뒤는 돌지 않는다.**

| # | 단계 | 명령 | 검사 | 비용 |
|---|---|---|---|---|
| 1 | 하네스 | `verify:harness` | 보호 경로 sha256 대조 (§0.6) | 즉시 |
| 2 | 타입 | `typecheck` | `tsc --noEmit` · `strict: true` | ~15초 |
| 3 | 린트 | `lint` | ESLint (`eslint-config-next`) | ~10초 |
| 4 | 테스트 | `test` | `vitest run` — `INV-01`~`07` | ~1초 |
| 5 | 빌드 | `build` | `prisma generate && next build` | ~90초 |

CI는 `.github/workflows/verify.yml` — ubuntu · Node 24 · 푸시/PR마다. `.env` · `prisma/dev.db` · `src/generated` 가 모두 gitignore 라 **CI가 매번 만든다** (`npm run db:ensure` → migrate · generate · seed). `db:ensure` 가 `verify` 보다 앞에 와야 한다 — `typecheck` 가 `@/generated/prisma/client` 를 필요로 한다.

`verify:harness` 는 해시 전에 줄바꿈을 정규화하므로 Windows에서 만든 기준선이 ubuntu 러너에서도 통과한다.

---

## 3. 체인 밖 점검

읽기 전용이라 체인에서 빼고 필요할 때 따로 돌린다.

```
npx tsx scripts/verify-m1.ts         시드 상태 7항목 (불변식 · 로트분리 · 임박 · 배송중 · 팝업)
npx tsx scripts/verify-headline.ts   목록 대표 로트 — 거점 합산 버그 회귀 방지
npx tsx scripts/snapshot.ts          거점별 재고 — 이동 전후 총량 비교
npx prisma validate                  스키마 유효성
npx prisma migrate status            마이그레이션 적용 상태
```

---

## 4. 무엇이 자동으로 검증되는가

| 대상 | 상태 |
|---|---|
| `INV-01`~`INV-07` | ✅ `tests/fefo` · `stock-invariant` · `popup-settle` |
| 이슈별 종료 조건 | ✅ `tests/issues/issue-{번호}-{기능명}.test.ts` |
| `DOD-02` `03` `04` `05` `06` `07` | 🟡 불변식 테스트로 간접 |
| `DOD-01` `08` `09` `10` `11` `12` | ❌ 자동 검증 없음 |
| `REQ-N-03`~`REQ-N-07` | ❌ 자동 검증 수단 자체가 없음 |

화면 · Server Action 은 테스트 환경이 `node` 라 자동 검증 밖이다. `07-plan.md` §2 의 B~E 를 사람이 확인한다.

---

## 5. 알려진 빈틈

- **테스트가 실제 `dev.db` 를 쓴다.** 별도 테스트 DB가 없고, 각 테스트가 `beforeAll`/`afterAll` 에서 **자기가 만든 것만** 지우는 데 의존한다 (고정 `EXPIRY` 날짜 · 팝업 이름으로 범위를 좁힌다). `vitest.config.ts` 의 `fileParallelism: false` 도 같은 이유다. **시연 중에는 돌리지 않는다.** 어긋나면 `npm run seed:reset`
- **`verify-m1.ts` 가 날짜에 취약하다.** 시드가 풀필먼트 A·B 의 `lastReflectedAt` 을 *시드 당일* 로 박아서, 하루만 지나도 `오늘 미반영 1곳` 단정이 깨진다. CI는 매번 새로 시드해 이 문제를 못 잡는다
- `verify-m1.ts` · `verify-headline.ts` 는 **종료 코드로 결과를 알리지 않는다.** 사람이 출력을 읽어야 한다 — 그래서 체인에 넣지 못했다
- `INV-04`(발송 → 도착 전후 총합)는 단순 이동 1건만 테스트한다
- 수동 확인 항목은 **사람이 볼 때까지 미확인**으로 남는다. 루프가 판정하지 못한다 ([03-loop.md](./03-loop.md) §8)

---

## 6. 예정 · 미정

- 아키텍처 규칙 검사 — `'use server'` 위치 · Server Action 의 `requireUser()` · 클라이언트 모듈의 db import 금지 · `applyMovement` 단일 통로(`RULE-01`). 지금은 **규칙만 있고 기계가 확인하지 않는다**
- `npm test` 단독 실행의 DB 격리 (지금은 `dev.db` 공용)
- `verify-m1` 의 파이프라인 편입 — 종료 코드부터 고쳐야 한다
- CI 통과를 **머지 필수 조건**으로 둘지 (브랜치 보호 규칙)
- 성능 기준(`REQ-N-04` 목록 조회 1초) 측정 방법
- 커버리지 수집 여부
