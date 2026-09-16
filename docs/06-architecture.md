# 06. 아키텍처 — 대부분 `harness/01-ssot.md` 로 이전됨

> 원래 작성: Phase 6 · 이전: 2026-09-15
>
> **규범 사양은 [`harness/01-ssot.md`](./harness/01-ssot.md) 에 있다.**
> 중복을 없애기 위해 본문을 옮겼고, **`01-ssot.md` 가 담지 않은 두 절만 여기 남겼다** — §3 데이터 모델(필드 수준)과 §7 시드 데이터 설계.

## 어디로 갔나

| 원래 절 | 옮겨간 곳 |
|---|---|
| 0. 이 앱이 실행되는 방식 | `01-ssot.md` §3.1 |
| 1. 스택 확정 · 실제 설치 버전 | `01-ssot.md` `ARCH-01`~`ARCH-08` (§3.1) |
| 1. 채택하지 않은 것 | `01-ssot.md` `ADR-01`~`ADR-06` (§3.2) |
| 2. 폴더 구조 | `01-ssot.md` §3.4 |
| 4.1 `applyMovement()` | `01-ssot.md` §3.5 · `RULE-01`~`RULE-03` `RULE-09` |
| 4.2 로트 배분 FEFO/LEFO | `01-ssot.md` §3.5 · `RULE-04`~`RULE-06` |
| 4.3 팝업 정산 역산 | `01-ssot.md` §3.5 · `RULE-07` |
| 4.4 취소 = 상쇄 기록 | `01-ssot.md` §3.5 · `RULE-08` |
| 5. 상태 흐름 | `01-ssot.md` `DOM-08` |
| 6. 인증 | `01-ssot.md` §3.6 |
| 7.5 아키텍처 결정 요약 | `01-ssot.md` §3.3 |
| 8. 동시성 · 성능 | `01-ssot.md` §3.7 |
| 9. 자동 테스트로 지킬 불변식 | `01-ssot.md` `INV-01`~`INV-07` (§4.1) |

## 여기 남은 것

| 절 | 왜 남겼나 |
|---|---|
| **§3 데이터 모델** | `01-ssot.md` `DOM-04` 는 엔터티 **이름 9개**만 담는다. 필드 · 인덱스 · 관계는 이 문서가 유일하다 |
| **§7 시드 데이터 설계** | `01-ssot.md` 에 없다. 시연이 끊기지 않게 하는 시드 구성은 규범에 가깝지만 이번 추출 대상이 아니었다 |

> **아래 두 절에는 알려진 어긋남이 있다. 임의로 고치지 않고 남겨둔다** (`01-ssot.md` §0.5 — 코드는 판단 기준이 아니다).
>
> - §3 첫 줄 `provider = "prisma-client-js"` 가 실제 `prisma/schema.prisma`(`prisma-client`)와 다르다 → `ESCALATE-01`
> - §7 의 `package.json` scripts 블록이 현재 `package.json` 과 다르다 → `ESCALATE-08`

## 3. 데이터 모델 (`prisma/schema.prisma`)

    generator client { provider = "prisma-client-js" }
    datasource db    { provider = "sqlite"; url = env("DATABASE_URL") }

    // ───────── 사용자
    model User {
      id           Int        @id @default(autoincrement())
      email        String     @unique
      name         String
      passwordHash String
      role         String     @default("MEMBER")   // MEMBER | ADMIN
      movements    Movement[]
      createdAt    DateTime   @default(now())
    }

    // ───────── 상품
    model Product {
      id              Int      @id @default(autoincrement())
      sku             String   @unique
      name            String
      unit            String   @default("개")
      expiryAlertDays Int      @default(60)    // 품목마다 다른 임박 기준일
      isActive        Boolean  @default(true)
      lots            Lot[]
      movements       Movement[]
    }

    // ───────── 거점
    enum_LocationType_note // OWN | FULFILLMENT | POPUP | TRANSIT | DISPOSAL
    model Location {
      id               Int       @id @default(autoincrement())
      name             String
      type             String                        // 위 5종
      isActive         Boolean   @default(true)
      lastReflectedAt  DateTime?                     // 풀필먼트 마지막 반영일 (P6)
      lots             Lot[]
      popup            Popup?    @relation("PopupLocation")
    }

    // ───────── 로트 = 재고의 최소 단위
    model Lot {
      id         Int      @id @default(autoincrement())
      productId  Int
      locationId Int
      expiryDate DateTime
      quantity   Int      @default(0)

      product    Product  @relation(fields: [productId],  references: [id])
      location   Location @relation(fields: [locationId], references: [id])

      @@unique([productId, locationId, expiryDate])   // ★ 로트의 정의
      @@index([locationId, expiryDate])               // FEFO 조회용
    }

    // ───────── 이동 원장 — 이력의 진실
    model Movement {
      id             Int       @id @default(autoincrement())
      type           String    // INBOUND OUTBOUND TRANSFER POPUP_OUT POPUP_IN ADJUST DISPOSE
      reason         String?   // SALE SAMPLE DAMAGE LOSS DISPOSE PURCHASE RETURN COUNT_DIFF INPUT_ERROR OTHER
      note           String?

      productId      Int
      expiryDate     DateTime
      quantity       Int       // 항상 양수. 방향은 from/to로 표현
      fromLocationId Int?      // null = 외부에서 들어옴
      toLocationId   Int?      // null = 외부로 나감

      transferId     Int?
      popupId        Int?
      reversalOfId   Int?      // 상쇄 기록이 가리키는 원본 (취소)

      userId         Int
      createdAt      DateTime  @default(now())

      product        Product   @relation(fields: [productId], references: [id])
      user           User      @relation(fields: [userId],    references: [id])

      @@index([createdAt])
      @@index([productId, createdAt])
    }

    // ───────── 거점 간 이동 (발송 → 도착 확인)
    model Transfer {
      id             Int            @id @default(autoincrement())
      fromLocationId Int
      toLocationId   Int
      status         String         @default("SENT")   // SENT | RECEIVED | CANCELLED
      sentAt         DateTime       @default(now())
      receivedAt     DateTime?
      sentById       Int
      receivedById   Int?
      lines          TransferLine[]
    }

    model TransferLine {
      id           Int      @id @default(autoincrement())
      transferId   Int
      productId    Int
      expiryDate   DateTime
      sentQty      Int
      receivedQty  Int?               // 도착 시 실제 수량 (다르면 차이는 조정 기록)
      transfer     Transfer @relation(fields: [transferId], references: [id])
    }

    // ───────── 팝업 = 여러 번 반출되고 마지막에 정산되는 임시 거점
    model Popup {
      id               Int         @id @default(autoincrement())
      name             String
      status           String      @default("PREP")   // PREP | ACTIVE | SETTLING | CLOSED
      startDate        DateTime
      endDate          DateTime
      locationId       Int         @unique            // 이 팝업 전용 거점
      sourceLocationId Int                            // 보통 자사창고
      location         Location    @relation("PopupLocation", fields: [locationId], references: [id])
      planLines        PopupPlan[]
    }

    model PopupPlan {                                  // 반출서 = 계획. 재고를 움직이지 않는다
      id          Int   @id @default(autoincrement())
      popupId     Int
      productId   Int
      plannedQty  Int
      popup       Popup @relation(fields: [popupId], references: [id])
    }

> `enum_LocationType_note` 줄은 주석용 표기다. SQLite는 Prisma enum을
> 지원하지만, 강의에서 값 목록을 한눈에 보이게 하려고 문자열 +
> 상수(`lib/constants.ts`)로 다룬다.

문자열 상태값은 DB가 오타를 막아주지 않으므로 `lib/constants.ts`에서
`as const` 상수와 파생 타입으로 제한한다. Server Action의 입력도 이
타입과 런타임 검증을 통과한 값만 저장한다.

``` ts
export const LOCATION_TYPES = {
  OWN: 'OWN',
  FULFILLMENT: 'FULFILLMENT',
  POPUP: 'POPUP',
  TRANSIT: 'TRANSIT',
  DISPOSAL: 'DISPOSAL',
} as const

export type LocationType =
  typeof LOCATION_TYPES[keyof typeof LOCATION_TYPES]
```

### 왜 `Movement`에 `from`/`to`를 두는가

재고가 **사라지지 않고 이동한다**(P10)는 원칙을 스키마가 강제하기
위해서다.

  행위 from to                    
  --------------- --------------- ---------------
  입고            `null` (외부)   자사창고
  출고(판매)      자사창고        `null` (외부)
  풀필먼트 발송   자사창고        배송 중
  도착 확인       배송 중         풀필먼트 A
  팝업 반출       자사창고        성수 팝업
  팝업 판매       성수 팝업       `null`
  팝업 복귀       성수 팝업       자사창고
  폐기            자사창고        폐기

**양쪽이 모두 있으면 총 재고는 변하지 않는다.** 이것이 테스트로 검증할
불변식이다.

## 7. 시드 데이터 설계 (`prisma/seed.ts`)

**목표: 시드 직후 모든 화면에 보여줄 것이 있어야 한다.** 빈 화면이
하나라도 있으면 시연이 끊긴다.

  -----------------------------------------------------------------------------
  항목 내용  
  ---------- ------------------------------------------------------------------
  계정       `warehouse@demo.kr` (이현, 물류) / `sales@demo.kr` (민수, 영업) ·
             비밀번호 `demo1234`

  거점       자사창고 · 풀필먼트 A/B/C · 배송 중 · 폐기 · 성수 팝업

  상품 8종   강아지 치즈 간식 200g / 우유껌 M / 오리목뼈 껌 5p / 닭가슴살 저키
             100g / 고구마 말랭이 150g / 연어 트릿 80g / 소고기 육포 120g /
             치킨 스틱 10p

  로트       상품마다 2\~3개 유통기한. **임박 3건 · 만료 2건 포함**

  배송 중    3건 --- 그중 1건은 **8일 경과(지연 경고 확인용)**

  풀필먼트   A·B는 오늘, **C는 3일 전** (할 일 배너 확인용)
  반영       

  팝업       성수 팝업 진행 중 · **반출 2회(120 + 40 = 160)** · 정산 대기

  이력       최근 30건 --- 입고·출고·이동·조정·폐기가 골고루, 두 사용자가
             섞여서
  -----------------------------------------------------------------------------

    // package.json
    "scripts": {
      "dev": "next dev",
      "seed": "tsx prisma/seed.ts",
      "seed:reset": "rm -f prisma/dev.db && prisma migrate dev --name init && tsx prisma/seed.ts",
      "db:studio": "prisma studio",
      "test": "vitest run"
    }

`npm run seed:reset` --- 시연 중 데이터가 엉키면 5초 만에 초기 상태로
되돌린다.

------------------------------------------------------------------------

## 원문이 필요하면

옮기기 직전 679줄 버전이 git 이력에 그대로 있다.

    git show 33baa01:docs/06-architecture.md
    git log --follow -p docs/06-architecture.md

## 이 문서의 권한

`01-ssot.md` §0.6 기준 **아키텍처 영역** — AI 는 읽기만 하고, 변경·승인은 사람이 한다.
`npm run verify:harness` 가 무단 변경을 탐지한다.
