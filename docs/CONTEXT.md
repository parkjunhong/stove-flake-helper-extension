# Project Context: Stove 럭키 캡슐 자동 뽑기 Chrome Extension

## 1. 개요 및 이관 배경
- **대상 서비스**: 스토브(STOVE) 리워드 플레이크샵 - 꽝 없는 럭키 캡슐 (`https://reward.onstove.com/ko/event`)
- **목적**: 로그인된 상태에서 100 또는 1,000 플레이크 뽑기 및 결과 대화창의 '한번 더' 버튼을 이벤트 기반으로 안전하게 반복 클릭
- **아키텍처**: Chrome Extension Manifest V3 (`app/` 디렉터리 하위에 실행 코드 분리 배치)
- **배포 전략**: 크롬 웹스토어 심사 대신 지인 공유용 ZIP 배포 (`chrome://extensions` &rarr; 개발자 모드 &rarr; `app` 폴더 로드)

---

## 2. 디렉터리 구조 및 역할

```text
/
├── docs/
│   ├── CONTEXT.md          # Antigravity IDE / App 작업 이관 컨텍스트 명세
│   └── README.md           # 사용자 및 지인 공유용 설치/실행 안내서
└── app/                    # 실제 크롬 브라우저에 로드되는 확장 프로그램 루트 디렉터리
    ├── manifest.json       # Chrome Manifest V3 권한 및 Content Script 주입 정의
    ├── popup.html          # 확장 프로그램 툴바 팝업 UI
    ├── popup.css           # 팝업 다크 테마 스타일시트
    ├── popup.js            # 팝업 초기화, 잔여 횟수 동기화, 메시지 송수신 컨트롤러
    ├── content.js          # 페이지 DOM 감시(MutationObserver) 및 자동 클릭 실행 코어
    └── icons/
        ├── icon16.png      # 툴바 및 파비콘용 16x16 아이콘
        ├── icon48.png      # 확장 프로그램 관리 페이지용 48x48 아이콘
        └── icon128.png     # 패키지 및 상세 정보용 128x128 아이콘
```

---

## 3. 컴포넌트 간 메시지 프로토콜
`app/popup.js` &harr; `app/content.js` 간 `chrome.tabs.sendMessage` / `chrome.runtime.sendMessage` 통신 규격입니다.

- `GET_STATUS` (`popup.js` &rarr; `content.js`):
  - 응답: `{ current: number, max: number, remaining: number, isDialogOpen: boolean, isRunning: boolean }`
  - 설명: 페이지 내 `오늘 뽑기 | X/30회` 텍스트를 파싱해 현재 진행 횟수와 대화창 오픈 여부를 반환합니다.
- `START_DRAW` (`popup.js` &rarr; `content.js`):
  - 요청 페이로드: `{ drawAmount: '100' | '1000', retryCount: number }`
  - 설명: 선택된 금액과 '한번 더' 실행 횟수로 `executeAutoDraw()`를 시작합니다.
- `STOP_DRAW` (`popup.js` &rarr; `content.js`):
  - 설명: `isUserStopped = true`로 전환하여 진행 중인 루프와 `MutationObserver`를 즉시 종료합니다.
- `STATUS_UPDATE` (`content.js` &rarr; `popup.js`):
  - 페이로드: `{ text: string, color: string, finished: boolean }`
  - 설명: 웹페이지 우측 상단 상태 뱃지(`#stove-draw-badge`)와 팝업 UI의 상태 박스를 실시간 동기화합니다.

---

## 4. 핵심 불변 규칙 (회귀 버그 방지 제약사항)

향후 기능 개선이나 리팩토링 시 아래 4가지 규칙은 반드시 유지해야 합니다.

1. **단일 네이티브 클릭만 사용**:
   - `MouseEvent` 합성 이벤트(`mousedown`, `mouseup`, `click`)와 `.click()`을 동시 호출하면 0ms 간격 중복 API 요청이 전송되어 서버에서 `일시적인 오류가 발생했어요` 팝업이 발생합니다.
   - 반드시 `triggerClick()` 내부의 단일 네이티브 `target.click()`만 호출해야 합니다.
2. **텍스트 완전 일치 탐색 (`cleanText`)**:
   - 이벤트 메인 화면 하단에 `100뽑기 : 1회 뽑기 시 100플레이크 차감...` 안내 텍스트가 존재하므로 부분 일치 탐색을 금지합니다.
   - 공백과 특수문자를 제거한 뒤 `100뽑기`, `1000뽑기`, `100뽑기한번더`, `1000뽑기한번더`와 정확히 일치하며 화면에 렌더링되고 활성화된 요소만 탐색합니다.
3. **2단계 버튼 생명주기 이벤트 감지 (`observeDrawEvent`)**:
   - SPA 대화창이 닫히지 않고 결과 숫자만 갱신되는 구조이므로, 클릭 직후 기존 버튼이 아직 DOM에 남아 있는 상태에서 중복 클릭이 일어나지 않도록 다음 순서를 엄수합니다.
     - **1단계 (`checkTransition`)**: 직전 클릭한 버튼(`prevBtn`)의 DOM 제거, 숨김, `disabled` 전환, 새 버튼 마운트, 또는 `오늘 뽑기` 수치 증가 중 하나를 먼저 확인합니다.
     - **2단계 (400ms 안정화 디바운스)**: 전환 확인 후 새로 활성화된 '한번 더' 버튼이 400ms 동안 유지되는지 검증한 뒤 다음 클릭을 실행합니다.
   - 우측 상단 알림 뱃지(`#stove-draw-badge`)의 DOM 변경은 `MutationObserver` 감시 대상에서 제외합니다.
4. **4가지 예외 및 종료 조건 즉시 감지**:
   - `오늘 30회 뽑기 완료` 팝업 출현 시 즉시 정상 종료
   - `보유한 플레이크가 부족합니다` 팝업 출현 시 `확인` 클릭 후 즉시 정상 종료
   - `일시적인 오류가 발생했어요` 팝업 출현 시 `확인` 클릭 후 즉시 중단
   - 사용자가 대화창의 `닫기` 버튼 클릭, `Escape` 키 입력, 또는 팝업 `중단` 버튼 클릭 시 즉시 중단

---

## 5. Antigravity IDE / App 후속 작업 가이드

1. 압축 해제한 프로젝트 루트 폴더를 Antigravity IDE에서 엽니다.
2. 채팅창에서 `@docs/CONTEXT.md` 와 `@app/content.js`, `@app/popup.js` 를 함께 참조하여 후속 기능(예: 백그라운드 서비스 워커 아이콘 뱃지 카운터, 실행 이력 통계, 배포용 `app/` 압축 스크립트 등)을 지시합니다.
3. 코드 수정 후 크롬 브라우저의 `chrome://extensions` 페이지에서 확장 프로그램 카드의 **새로고침(↻)** 아이콘을 클릭하면 즉시 반영됩니다.
