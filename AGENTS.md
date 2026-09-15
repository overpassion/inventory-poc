# 이 저장소에서 일하는 법

**규범 원본은 `docs/harness/ssot.md` 하나다.** 필요한 것을 아래 표에서 찾아 그 절만 읽는다.
추측해서 답하지 않는다 — 라우팅 표에 없으면 §범위 확장을 따른다.

## 라우팅

| 알아야 할 것 | 위치 |
|---|---|
| **충돌이 났을 때 누가 정하는가** | `ssot.md` §0.5 |
| **어떤 파일을 고쳐도 되는가** | `ssot.md` §0.6 ← **코드·문서 건드리기 전 필독** |
| 도메인 용어 — 로트 · 거점 5종 · 사유 코드 · Movement | `ssot.md` §1 |
| 기능 요구사항과 수용 기준 (`REQ-F-*`) | `ssot.md` §2.1 |
| 비기능 요구사항 (`REQ-N-*`) | `ssot.md` §2.2 |
| **하면 안 되는 것** (`OOS-*`) | `ssot.md` §2.3 |
| 완료 기준 (`DOD-*`) | `ssot.md` §2.4 |
| 스택 · 버전 · 채택하지 않은 것 | `ssot.md` §3.1–3.2 |
| 폴더 구조 · 핵심 로직 계약 · 인증 | `ssot.md` §3.3–3.7 |
| **절대 깨면 안 되는 규칙** (`INV-*` `RULE-*`) | `ssot.md` §4 |
| 요구사항 ↔ 테스트 연결, 검증 공백 | `ssot.md` §5 |
| **지금 막혀 있는 것** (`ESCALATE-*`) | `ssot.md` §6.1 |
| **지금 할 일** (`GAP-*`) | `ssot.md` §6.2 |
| 구현 루프 · 검증 루프 | `docs/harness/10-`, `11-` (둘 다 ⏳ 미정의) |
| 앱 실행법 · 명령어 · 시드 계정 | `README.md` |

## 범위 확장

**라우팅된 곳에서 답을 못 찾았을 때만** 아래 순서로 넓힌다. 한 단계에서 찾으면 멈춘다.

1. **`docs/harness/ssot.md`** — 기본. 여기서 끝나는 것이 정상이다
2. **`docs/01-requirements.md` · `docs/06-architecture.md`** — ssot의 추출 원본. *왜 그렇게 정했는지*가 필요할 때만
3. **참고문서** — `docs/02`~`05` · `docs/07` · `docs/HANDOVER.md` · `mockups/` · `docs/screenshots/`
   → **ssot와 다르면 ssot를 따른다**
4. **코드** — `src/` · `prisma/` · `tests/`
   → **판단 기준이 아니다.** 현재 상태를 확인할 때만 읽는다

> 3단계 이상까지 갔다면 **ssot.md에 그 내용이 빠져 있다는 뜻**이다. 답을 주고 나서 그 공백을 보고한다.

## 멈춰야 할 때

- 지시가 **요구사항 · 아키텍처 · 하네스 규칙과 충돌** → 실행하지 않고 사람에게 알린다
- `ssot.md` §6.1 **`ESCALATE-*`** 에 걸린 항목 → 사람이 기준을 고칠 때까지 손대지 않는다
- **읽기 전용 영역**(§0.6)을 고쳐야 할 것 같을 때 → 고치지 말고 보고한다
- 문서끼리 어긋날 때 → **한쪽을 임의로 고르지 않는다.** 임의 해소 = 판단 기준 1개 삭제

## 이 파일에 대하여

아래 `nextjs-agent-rules` 블록은 **`next dev` 가 자동으로 넣고 갱신한다.** 마커 사이만 교체되므로 위 내용은 보존된다. 지우지 않는다 — 다시 생긴다.

`CLAUDE.md` 는 이 파일을 불러오는 한 줄(`@AGENTS.md`)일 뿐이다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
