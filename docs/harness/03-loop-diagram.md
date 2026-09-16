# 03-A. 루프 도식

> 작성일: 2026-09-16 · 기준 커밋: `f8ec201`
> [03-loop.md](./03-loop.md) 의 그림이다. **규칙 본문은 그쪽에만 있다** — 이 문서는 도식만 담는다.
> 그림과 본문이 다르면 [03-loop.md](./03-loop.md) 를 따른다.

---

## 1. 전체 흐름 — 이슈에서 머지까지

```mermaid
flowchart TD
    ISSUE["이슈<br/>템플릿 6항목"] --> PRE{"착수 전 확인"}

    PRE -->|"ESCALATE 에 걸림"| BLOCK["차단<br/>사람이 기준을 정할 때까지"]
    PRE -->|"OOS 에 걸림"| BLOCK2["중단<br/>안 만들기로 한 것이다<br/>SSOT 부터 고쳐야 한다"]
    PRE -->|"통과"| BR["브랜치 생성<br/>WF-02 · main 에 직접 커밋하지 않는다"]

    BR --> TFIRST["테스트 먼저<br/>변경 전 실패를 확인한다"]
    TFIRST --> EDIT

    subgraph LOOP["구현 루프 — 기본 최대 3회 · LOOP-02"]
        direction TB
        EDIT["코드 수정"] --> VERIFY["npm run verify<br/>1회로 센다 · LOOP-01"]
        VERIFY -->|"실패"| CHECK{"계속 돌 수 있나"}
        CHECK -->|"횟수 남음"| EDIT
    end

    CHECK -->|"즉시 중단"| STOPPED["멈춤<br/>LOOP-03 · 04"]
    CHECK -->|"같은 실패 2회"| STOPPED
    CHECK -->|"횟수 소진"| STOPPED

    VERIFY -->|"통과"| REPORT
    STOPPED --> REPORT

    REPORT["보고 · WF-07<br/>회차<br/>변경 파일과 근거 ID<br/>종료 조건 상태<br/>수동 미확인 항목"]
    REPORT --> COMMIT["커밋 + 푸시<br/>origin 에만 · WF-05"]
    COMMIT --> HUMAN["사람이 머지<br/>WF-06"]
    HUMAN --> DONE["이슈 종료"]

    BLOCK --> REPORT
    BLOCK2 --> REPORT
```

**읽는 법** — 실패든 성공이든 **모든 길이 `보고` 로 모인다.** 조용히 끝나는 경로가 없다.

---

## 2. `npm run verify` — 한 회차 안에서 도는 5단계

```mermaid
flowchart LR
    S1["1 verify:harness<br/>보호 경로 12개"] --> S2["2 typecheck<br/>tsc noEmit"]
    S2 --> S3["3 lint<br/>ESLint"]
    S3 --> S4["4 test<br/>vitest"]
    S4 --> S5["5 build<br/>next build"]
    S5 --> PASS["통과 · exit 0"]

    S1 -.->|"실패"| HALT
    S2 -.->|"실패"| HALT
    S3 -.->|"실패"| HALT
    S4 -.->|"실패"| HALT
    S5 -.->|"실패"| HALT
    HALT["exit 1<br/>뒤 단계는 돌지 않는다"]
```

싼 것부터 비싼 것 순이다. 상세는 [02-verification.md](./02-verification.md).

---

## 3. 루프 중 어긋남을 발견하면

```mermaid
flowchart TD
    FOUND["문서와 현실이 어긋난다"] --> Q{"규범인가 서술인가"}

    Q -->|"규범<br/>배분 전략 · 소유권 · SSOT 내부 모순"| ESC["ESCALATE<br/>멈추고 사람에게 올린다"]
    Q -->|"서술<br/>파일명 · 경로 · 버전 · 스크립트"| DRIFT["DRIFT<br/>실물 확인 후 갱신하고 보고한다"]
    Q -->|"SSOT 가 요구하는데 코드에 없다"| GAP["GAP<br/>할 일로 기록하고 진행한다"]
    Q -->|"애매하다"| ESC

    ESC --> HALT2["루프 중단"]
    DRIFT --> GO["루프 계속"]
    GAP --> GO
```

**애매하면 `ESCALATE`** — 서술로 잘못 분류해 규범을 지우는 쪽이 더 나쁘다. 분류 기준은 [01-ssot.md](./01-ssot.md) §0.5.

---

## 4. 루프가 건드릴 수 있는 것

```mermaid
flowchart LR
    subgraph OKZONE["루프가 고칠 수 있다"]
        SRC["src/**<br/>이슈 범위 안에서만"]
        TST["tests/**<br/>작성 · 수정"]
    end

    subgraph NOZONE["읽기만 — 고치려면 사람 승인"]
        HARNESS["docs/harness/**<br/>AGENTS.md · CLAUDE.md"]
        REQ["docs/01-requirements.md<br/>docs/06-architecture.md"]
        SCRIPTS["scripts/verify-*.ts<br/>.github/workflows/**<br/>실행만 한다"]
    end

    GUARD["npm run verify:harness"] -.->|"무단 변경 탐지"| NOZONE
```

권한 원본은 [01-ssot.md](./01-ssot.md) §0.6. **가드는 사후 탐지이지 사전 차단이 아니다** — 편집 자체를 막지는 못한다.
