# Stove 럭키 캡슐 자동 뽑기 변경 이력 (History)

## [v1.1.0] - 2026-11-22

### ✨ 신규 기능 (New Features)
- **대상 사이트 외 아이콘 비활성화 지원**:
  - 확장 프로그램이 동작하는 대상 사이트(`https://reward.onstove.com/ko/event`)에 접속해 있을 때만 파란색 컬러 아이콘으로 활성화됩니다.
  - 그 외의 모든 사이트(예: 유튜브, 포털 등)에서는 툴바 아이콘이 회색조(Grayscale)로 비활성화(`chrome.action.disable`)되며, 툴팁에 비활성화 상태가 안내됩니다.
- **백그라운드 서비스 워커 (`background.js`) 도입**:
  - Chrome Manifest V3 기반의 백그라운드 서비스 워커를 추가하여 탭 URL 변경(`chrome.tabs.onUpdated`) 및 탭 전환(`chrome.tabs.onActivated`)을 실시간 감지하고 아이콘 상태를 즉각 동적 전환합니다.
- **비활성화 전용 회색조 아이콘 세트 추가**:
  - `app/icons/icon16_disabled.png` (16x16)
  - `app/icons/icon48_disabled.png` (48x48)
  - `app/icons/icon128_disabled.png` (128x128)

### 📚 문서 및 시각 자료 개선 (Documentation)
- **실제 사용 시연 영상 추가**:
  - 럭키 캡슐 자동 뽑기 및 결과 대화창의 연속 자동 클릭 과정을 담은 실제 시연 영상(`docs/videos/how-to-use-stove-flake-helper-extension.mp4`, 20초)과 고화질 대표 썸네일(`docs/images/03_video_preview.png`)을 [README.md](../README.md)에 반영했습니다.
- **새 창 열기 안내 문구 정제**:
  - 브라우저 표준에 맞추어 모든 이미지 및 동영상 원본 링크의 새 창 열기 안내 문구를 **`Ctrl + Shift + 클릭`**으로 통일했습니다.
- **변경 이력 문서 생성**:
  - 버전별 릴리스 내역을 체계적으로 관리할 수 있도록 `docs/history.md`를 신규 생성했습니다.

### ⚙️ 설정 및 패키징 (Configuration & Build)
- `app/manifest.json`: 버전 1.1.0 갱신, `background.service_worker` 및 `tabs` 권한 추가.
- `v1.1.0` 정식 릴리스 압축 파일(`stove-flake-helper-extension-v1.1.0.zip`) 빌드 및 배포.

---

## [v1.0.0] - 2026-11-22

### 🎉 최초 릴리스 (Initial Release)
- **스토브 럭키 캡슐 자동 뽑기 확장 프로그램 최초 출시**:
  - 스토브 리워드 이벤트 페이지([https://reward.onstove.com/ko/event](https://reward.onstove.com/ko/event)) 지원.
  - 100 플레이크 및 1,000 플레이크 선택 뽑기 지원.
  - 오늘 남은 한도 자동 계산 및 `'한번 더'` 반복 뽑기 횟수 입력 지원.
  - MutationObserver 기반 결과 대화창 감지 및 안전한 이벤트 트리거 자동화.
  - 웹페이지 우측 상단 실시간 진행 상태 뱃지(`[진행 중] N / M회...`) 표시.
  - 대화창 [닫기], 키보드 `Esc`, 팝업 [중단] 등 3중 즉시 안전 중단 기능 탑재.
  - 경량 패키징 자동화 스크립트(`scripts/build-dist.ps1`) 및 README 사용자 가이드 제공.
