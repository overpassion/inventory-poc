# 01. 요구사항 — `harness/ssot.md` 로 이전됨

> 원래 작성일: 2026-08-18 · 이전: 2026-09-15
>
> **규범 사양은 [`harness/ssot.md`](./harness/ssot.md) 에 있다.**
> 이 문서에 있던 요구사항 본문은 그쪽으로 옮겼다. 여기서 읽고 저기서 고치는 일이 없도록 **본문을 남겨두지 않는다.**

## 어디로 갔나

| 원래 절 | 옮겨간 곳 |
|---|---|
| 1. 프로젝트 정의 · 푸는 문제 3가지 | `ssot.md` `DOM-01` |
| 2. 핵심 개념 — 로트 정의, 쪼개지 않는 이유와 대가 | `ssot.md` `DOM-02` |
| 2. 거점 5종, 가상 거점을 두는 이유 | `ssot.md` `DOM-03` |
| 3. 기능 요구사항 F1~F11 | `ssot.md` `REQ-F-01`~`REQ-F-11` (§2.1) |
| 3. F5-1 재고 증감 사유 체계 | `ssot.md` `DOM-06` |
| 3. F5-1 사유가 붙지 않는 이동 | `ssot.md` `DOM-07` |
| 3. F6 배분 방향 (FEFO / LEFO) | `ssot.md` `RULE-04` (§4.2) |
| 4. 데이터 모델 (개념) | 이름은 `ssot.md` `DOM-04`, 필드는 [`06-architecture.md`](./06-architecture.md) §3, 실제는 `prisma/schema.prisma` |
| 5. 비기능 요구사항 | `ssot.md` `REQ-N-01`~`REQ-N-09` (§2.2) |
| 6. 범위 제외 (Out of Scope) | `ssot.md` `OOS-01`~`OOS-10` (§2.3) |
| 7. 완료 기준 (Definition of Done) | `ssot.md` `DOD-01`~`DOD-12` (§2.4) |
| 8. 확인이 필요한 가정 | `ssot.md` `ASM-01`~`ASM-06` (§2.5) |

## 왜 옮겼나

같은 규칙이 두 문서에 있으면 **한쪽만 고쳐질 때 어느 쪽이 맞는지 알 수 없다.** 그 상태에서 에이전트가 한쪽을 골라 진행하면 판단 기준 하나가 조용히 사라진다.

원래 계획은 *"규범은 `ssot.md`, 근거(왜 그렇게 정했는가)는 여기"* 로 나누는 것이었다. 실제로 추출해 보니 **근거 문장까지 `ssot.md` 가 함께 흡수**해서 — 로트를 쪼개지 않는 대가, 가상 거점을 두는 이유, LEFO 를 쓰는 이유, Out of Scope 각 항목의 이유가 모두 그쪽에 있다 — 이 문서에 따로 남길 것이 없었다.

## 원문이 필요하면

git 이력에 그대로 있다.

```bash
git show 33baa01:docs/01-requirements.md    # 이전 직전 버전 (279줄)
git log --follow -p docs/01-requirements.md
```

## 이 문서의 권한

`ssot.md` §0.6 기준 **요구사항 영역** — AI 는 읽기만 하고, 변경·승인은 사람이 한다.
`npm run verify:harness` 가 무단 변경을 탐지한다.
