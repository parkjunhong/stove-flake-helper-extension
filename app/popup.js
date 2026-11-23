/*
 * Copyright 2026 parkjunhong77@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * 현재 활성화된 브라우저 탭 정보를 조회합니다.
 *
 * @returns {Promise<chrome.tabs.Tab | undefined>} 활성 탭 객체
 *
 * @async
 */
const getActiveTab = async () => {
  /**
   * 조회된 현재 창 활성 탭 배열입니다.
   * @type {chrome.tabs.Tab[]}
   */
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
};

/**
 * 팝업 내 상태 메시지 영역의 문구와 강조 색상을 갱신합니다.
 *
 * @param {string} text - 표시할 상태 메시지
 * @param {string} [color='#3b82f6'] - 좌측 테두리 색상 코드
 * @returns {void}
 */
const setStatusMessage = (text, color = '#3b82f6') => {
  /**
   * 상태 메시지 표시 박스 요소입니다.
   * @type {HTMLElement | null}
   */
  const box = document.getElementById('statusMessage');
  if (box) {
    box.style.borderLeftColor = color;
    box.textContent = text;
  }
};

/**
 * 실행 상태에 따라 시작/중단 버튼의 활성화 여부를 전환합니다.
 *
 * @param {boolean} isRunning - 현재 '한번 더' 뽑기 실행 중 여부
 * @returns {void}
 */
const toggleButtons = (isRunning) => {
  /**
   * 시작 버튼 요소입니다.
   * @type {HTMLButtonElement | null}
   */
  const startBtn = document.getElementById('startBtn');

  /**
   * 중단 버튼 요소입니다.
   * @type {HTMLButtonElement | null}
   */
  const stopBtn = document.getElementById('stopBtn');

  if (startBtn) startBtn.disabled = isRunning;
  if (stopBtn) stopBtn.disabled = !isRunning;
};

/**
 * 콘텐츠 스크립트로부터 받은 뽑기 현황 데이터를 기반으로 입력 범위와 UI를 동기화합니다.
 *
 * @param {{ current: number, max: number, remaining: number, isDialogOpen: boolean, isRunning: boolean }} status - 페이지 상태 정보
 * @returns {void}
 */
const syncPopupWithPageStatus = (status) => {
  /**
   * 상단 일일 현황 뱃지 요소입니다.
   * @type {HTMLElement | null}
   */
  const badge = document.getElementById('dailyStatusBadge');

  /**
   * 최대 가능 횟수 힌트 요소입니다.
   * @type {HTMLElement | null}
   */
  const maxHint = document.getElementById('maxHint');

  /**
   * 횟수 입력 필드 요소입니다.
   * @type {HTMLInputElement | null}
   */
  const countInput = document.getElementById('retryCountInput');

  if (badge) {
    badge.textContent = status.current + ' / ' + status.max + '회';
  }

  /**
   * 대화창 오픈 여부에 따른 최대 허용 '한번 더' 횟수입니다.
   * @type {number}
   */
  const maxAllowed = status.isDialogOpen ? status.remaining : Math.max(0, status.remaining - 1);

  if (maxHint) {
    maxHint.textContent = '(최대 ' + maxAllowed + '회)';
  }

  if (countInput) {
    countInput.max = String(maxAllowed);
    countInput.value = String(maxAllowed);
  }

  toggleButtons(status.isRunning);

  if (status.remaining <= 0) {
    setStatusMessage('오늘 30회 뽑기 한도를 모두 완료했습니다.', '#10b981');
    toggleButtons(true);
    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) stopBtn.disabled = true;
  } else if (status.isRunning) {
    setStatusMessage("'한번 더' 뽑기가 진행 중입니다...", '#10b981');
  }
};

/**
 * 팝업 초기화 및 이벤트 리스너를 등록합니다.
 *
 * @returns {Promise<void>} 초기화 완료 프로미스
 *
 * @async
 */
const initPopup = async () => {
  /**
   * 현재 활성 탭 객체입니다.
   * @type {chrome.tabs.Tab | undefined}
   */
  const tab = await getActiveTab();

  /**
   * 지원하지 않는 URL 안내 뷰 요소입니다.
   * @type {HTMLElement | null}
   */
  const unsupportedView = document.getElementById('unsupportedView');

  /**
   * 메인 컨트롤 뷰 요소입니다.
   * @type {HTMLElement | null}
   */
  const mainView = document.getElementById('mainView');

  if (!tab || !tab.id || !tab.url || !tab.url.startsWith('https://reward.onstove.com/')) {
    if (unsupportedView) unsupportedView.classList.remove('hidden');
    if (mainView) mainView.classList.add('hidden');
    const badge = document.getElementById('dailyStatusBadge');
    if (badge) badge.textContent = '페이지 미접속';
    return;
  }

  try {
    /**
     * 콘텐츠 스크립트에 요청한 현재 뽑기 상태 응답입니다.
     * @type {{ current: number, max: number, remaining: number, isDialogOpen: boolean, isRunning: boolean }}
     */
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' });
    if (response) {
      syncPopupWithPageStatus(response);
    }
  } catch (error) {
    setStatusMessage('페이지를 새로고침(F5)한 뒤 다시 시도해 주세요.', '#f59e0b');
  }

  /**
   * 시작 버튼 요소입니다.
   * @type {HTMLElement | null}
   */
  const startBtn = document.getElementById('startBtn');

  /**
   * 중단 버튼 요소입니다.
   * @type {HTMLElement | null}
   */
  const stopBtn = document.getElementById('stopBtn');

  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      /**
       * 선택된 라디오 버튼 요소입니다.
       * @type {HTMLInputElement | null}
       */
      const selectedRadio = document.querySelector('input[name="drawAmount"]:checked');

      /**
       * 선택된 뽑기 금액 값('100' 또는 '1000')입니다.
       * @type {string}
       */
      const drawAmount = selectedRadio ? selectedRadio.value : '100';

      /**
       * 횟수 입력 필드 요소입니다.
       * @type {HTMLInputElement | null}
       */
      const countInput = document.getElementById('retryCountInput');

      /**
       * 사용자가 지정한 '한번 더' 실행 횟수입니다.
       * @type {number}
       */
      const retryCount = countInput ? parseInt(countInput.value, 10) : 0;

      /**
       * 허용 최대 횟수입니다.
       * @type {number}
       */
      const maxAllowed = countInput ? parseInt(countInput.max, 10) : 29;

      if (isNaN(retryCount) || retryCount < 0 || retryCount > maxAllowed) {
        setStatusMessage('0부터 ' + maxAllowed + ' 사이의 숫자를 입력해 주세요.', '#ef4444');
        return;
      }

      toggleButtons(true);
      setStatusMessage("'한번 더' 뽑기 명령을 전송했습니다...", '#10b981');

      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'START_DRAW',
          payload: {
            drawAmount,
            retryCount
          }
        });
      } catch (err) {
        toggleButtons(false);
        setStatusMessage('명령 전송 실패: 페이지를 새로고침해 주세요.', '#ef4444');
      }
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', async () => {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'STOP_DRAW' });
        setStatusMessage('중단 요청을 보냈습니다.', '#f59e0b');
        toggleButtons(false);
      } catch (err) {
        setStatusMessage('중단 요청 중 오류가 발생했습니다.', '#ef4444');
      }
    });
  }
};

// 콘텐츠 스크립트에서 보내는 실시간 진행/종료 상태 수신 리스너
chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === 'STATUS_UPDATE') {
    setStatusMessage(message.text, message.color || '#3b82f6');
    if (message.finished) {
      toggleButtons(false);
      getActiveTab().then((tab) => {
        if (tab && tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }).then((res) => {
            if (res) syncPopupWithPageStatus(res);
          }).catch(() => {});
        }
      });
    }
  }
});

document.addEventListener('DOMContentLoaded', initPopup);
