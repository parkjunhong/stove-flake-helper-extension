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

(() => {
  /**
   * 현재 자동 뽑기 루프가 실행 중인지 나타내는 상태 플래그입니다.
   * @type {boolean}
   */
  let isRunning = false;

  /**
   * 사용자가 대화창을 닫거나 확장 프로그램 중단 버튼을 눌렀는지 나타내는 플래그입니다.
   * @type {boolean}
   */
  let isUserStopped = false;

  /**
   * 문자열에서 공백과 특수문자를 제거하고 언어 문자 및 숫자만 추출합니다.
   *
   * @param {string} text - 원본 문자열
   * @returns {string} 정제된 문자열
   */
  const cleanText = (text) => {
    return (text || '').replace(/[^\p{L}\p{N}]/gu, '');
  };

  /**
   * 웹페이지 우측 상단 상태 뱃지를 갱신하고 팝업 UI에도 진행 상태를 전달합니다.
   *
   * @param {string} text - 표시할 상태 문구
   * @param {string} [borderColor='#2196f3'] - 상태 강조 색상
   * @param {boolean} [finished=false] - 작업 완료 및 종료 여부
   * @returns {void}
   */
  const updateStatus = (text, borderColor = '#2196f3', finished = false) => {
    /**
     * 페이지 우측 상단 상태 뱃지 요소입니다.
     * @type {HTMLElement | null}
     */
    let badge = document.getElementById('stove-draw-badge');

    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'stove-draw-badge';
      badge.style.cssText =
        'position:fixed;top:20px;right:20px;z-index:999999;background:rgba(0,0,0,0.88);color:#fff;padding:12px 18px;border-radius:10px;font-size:14px;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:all 0.3s;pointer-events:none;';
      document.body.appendChild(badge);
    }

    badge.style.borderLeft = '5px solid ' + borderColor;
    badge.textContent = text;

    try {
      chrome.runtime.sendMessage({
        type: 'STATUS_UPDATE',
        text,
        color: borderColor,
        finished
      }).catch(() => {});
    } catch (e) {
      // 팝업이 닫혀있는 경우 무시
    }
  };

  /**
   * 대상 요소가 DOM에 포함되어 있고 화면에 시각적으로 노출 중인지 확인합니다.
   *
   * @param {HTMLElement | null} el - 검사할 DOM 요소
   * @returns {boolean} 화면 노출 여부
   */
  const isElementVisible = (el) => {
    if (!el || !document.contains(el)) return false;

    /**
     * 요소의 렌더링 영역 크기입니다.
     * @type {DOMRect}
     */
    const rect = el.getBoundingClientRect();

    /**
     * 계산된 CSS 스타일 객체입니다.
     * @type {CSSStyleDeclaration}
     */
    const style = window.getComputedStyle(el);

    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };

  /**
   * 대상 요소 또는 상위 버튼이 비활성화(disabled) 상태인지 확인합니다.
   *
   * @param {HTMLElement | null} el - 검사할 DOM 요소
   * @returns {boolean} 비활성화 여부
   */
  const isElementDisabled = (el) => {
    if (!el) return true;

    /**
     * 실제 상호작용 대상 버튼 요소입니다.
     * @type {HTMLElement}
     */
    const btn = el.closest("button, a, [role='button']") || el;

    return !!(
      btn.disabled ||
      btn.getAttribute('disabled') !== null ||
      btn.getAttribute('aria-disabled') === 'true'
    );
  };

  /**
   * 정제된 텍스트와 일치하며 화면에 노출 중인 요소를 탐색합니다.
   *
   * @param {string} targetClean - 정제된 탐색 대상 텍스트
   * @param {boolean} [requireEnabled=false] - 활성화(클릭 가능) 상태 필수 여부
   * @returns {HTMLElement | null} 탐색된 대상 요소 또는 null
   */
  const findElementByCleanText = (targetClean, requireEnabled = false) => {
    /**
     * 대화형 후보 태그 셀렉터입니다.
     * @type {string}
     */
    const selector = "button, a, [role='button'], div, span";

    /**
     * 문서 내 후보 요소 목록입니다.
     * @type {HTMLElement[]}
     */
    const candidates = Array.from(document.querySelectorAll(selector));

    /**
     * 화면에 표시 중이며 활성화 조건을 만족하는 요소 목록입니다.
     * @type {HTMLElement[]}
     */
    const visible = candidates.filter((el) => isElementVisible(el) && (!requireEnabled || !isElementDisabled(el)));

    /**
     * 정제 텍스트가 일치하는 요소 목록입니다.
     * @type {HTMLElement[]}
     */
    const exactMatches = visible.filter((el) => cleanText(el.innerText || el.textContent) === targetClean);

    if (exactMatches.length > 0) {
      /**
       * 표준 버튼 태그를 우선 선택합니다.
       * @type {HTMLElement | undefined}
       */
      const preferred = exactMatches.find(
        (el) => el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button'
      );
      return preferred || exactMatches[exactMatches.length - 1];
    }

    return null;
  };

  /**
   * 단일 네이티브 클릭 이벤트를 안전하게 실행합니다.
   *
   * @param {HTMLElement | null} element - 클릭할 대상 요소
   * @returns {void}
   */
  const triggerClick = (element) => {
    if (!element) return;

    /**
     * 상위 버튼 또는 자체 요소입니다.
     * @type {HTMLElement}
     */
    const target = element.closest("button, a, [role='button']") || element;
    target.click();
  };

  /**
   * 화면에서 '오늘 뽑기 | X/30회' 정보를 분석하여 현재 진행 횟수 및 잔여 횟수를 계산합니다.
   *
   * @returns {{ current: number, max: number, remaining: number }} 뽑기 진행 현황 객체
   */
  const getDailyDrawStatus = () => {
    /**
     * 전체 본문 텍스트입니다.
     * @type {string}
     */
    const bodyText = document.body.innerText || '';

    /**
     * 진행 횟수 정규식 매칭 결과입니다.
     * @type {RegExpMatchArray | null}
     */
    const match = bodyText.match(/오늘\s*뽑기[\s|:·-]*(\d+)\s*\/\s*(\d+)/);

    if (match) {
      /**
       * 당일 누적 진행 횟수입니다.
       * @type {number}
       */
      const current = parseInt(match[1], 10);

      /**
       * 당일 최대 허용 횟수입니다.
       * @type {number}
       */
      const max = parseInt(match[2], 10);

      return {
        current,
        max,
        remaining: Math.max(0, max - current)
      };
    }

    return { current: 0, max: 30, remaining: 30 };
  };

  /**
   * '오늘 30회 뽑기 완료!' 대화창 표시 여부를 확인합니다.
   *
   * @returns {boolean} 완료 팝업 노출 여부
   */
  const isDailyFinished = () => {
    /**
     * 공백이 제거된 본문 텍스트입니다.
     * @type {string}
     */
    const bodyText = (document.body.innerText || '').replace(/\s+/g, '');
    return bodyText.includes('오늘30회뽑기완료');
  };

  /**
   * '보유한 플레이크가 부족합니다' 팝업 표시 여부를 확인합니다.
   *
   * @returns {boolean} 잔액 부족 팝업 노출 여부
   */
  const isFlakeInsufficient = () => {
    /**
     * 공백이 제거된 본문 텍스트입니다.
     * @type {string}
     */
    const bodyText = (document.body.innerText || '').replace(/\s+/g, '');
    return bodyText.includes('보유한플레이크가부족합니다');
  };

  /**
   * 플레이크 부족 대화창을 감지하고 확인 버튼을 눌러 닫습니다.
   *
   * @returns {boolean} 부족 팝업 처리 여부
   */
  const handleInsufficientFlakes = () => {
    if (isFlakeInsufficient()) {
      /**
       * 확인 버튼 요소입니다.
       * @type {HTMLElement | null}
       */
      const confirmButton = findElementByCleanText('확인');
      if (confirmButton) {
        triggerClick(confirmButton);
      }
      return true;
    }
    return false;
  };

  /**
   * 일시적인 오류 대화창을 감지하고 확인 버튼을 눌러 닫습니다.
   *
   * @returns {boolean} 오류 팝업 처리 여부
   */
  const checkAndDismissError = () => {
    /**
     * 공백이 제거된 본문 텍스트입니다.
     * @type {string}
     */
    const bodyText = (document.body.innerText || '').replace(/\s+/g, '');

    if (bodyText.includes('일시적인오류가발생했어요')) {
      /**
       * 확인 버튼 요소입니다.
       * @type {HTMLElement | null}
       */
      const confirmButton = findElementByCleanText('확인');
      if (confirmButton) {
        triggerClick(confirmButton);
      }
      return true;
    }

    return false;
  };

  /**
   * 이전 버튼의 소멸/비활성화 전환을 먼저 확인한 뒤, 새로 활성화된 '한번 더' 버튼 생성 이벤트를 수신합니다.
   *
   * @param {string} retryClean - 재도전 버튼 정제 텍스트
   * @param {HTMLElement | null} [prevBtn=null] - 직전에 클릭한 버튼 참조
   * @param {number} [prevCount=-1] - 클릭 직전의 당일 누적 뽑기 횟수
   * @param {number} [timeoutMs=12000] - 최대 대기 시간(밀리초)
   * @returns {Promise<{ status: 'SUCCESS'|'USER_CLOSED'|'FINISHED'|'NO_FLAKES'|'ERROR'|'TIMEOUT', element?: HTMLElement }>} 이벤트 감지 결과 객체
   */
  const observeDrawEvent = (retryClean, prevBtn = null, prevCount = -1, timeoutMs = 12000) => {
    return new Promise((resolve) => {
      /**
       * 프로미스 중복 해결 방지 플래그입니다.
       * @type {boolean}
       */
      let settled = false;

      /**
       * 클릭 이후 기존 버튼이 사라지거나 비활성화되는 실제 상태 전환이 일어났는지 여부입니다.
       * @type {boolean}
       */
      let sawTransition = !prevBtn;

      /**
       * 애니메이션 안정화 디바운스 타이머입니다.
       * @type {number | null}
       */
      let debounceTimer = null;

      /**
       * 감시자를 해제하고 결과를 반환하는 정리 함수입니다.
       *
       * @param {{ status: string, element?: HTMLElement }} result - 반환할 결과 객체
       * @returns {void}
       */
      const finish = (result) => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(timer);
        clearInterval(pollWatcher);
        if (debounceTimer) clearTimeout(debounceTimer);
        resolve(result);
      };

      /**
       * 이전 회차 버튼의 종료(제거/숨김/비활성화/카운트 증가) 여부를 검증합니다.
       *
       * @returns {boolean} 상태 전환 발생 여부
       */
      const checkTransition = () => {
        if (sawTransition) return true;

        if (!document.contains(prevBtn) || !isElementVisible(prevBtn) || isElementDisabled(prevBtn)) {
          sawTransition = true;
          return true;
        }

        if (prevCount >= 0 && getDailyDrawStatus().current > prevCount) {
          sawTransition = true;
          return true;
        }

        /**
         * 새로 마운트된 활성 버튼 요소입니다.
         * @type {HTMLElement | null}
         */
        const cur = findElementByCleanText(retryClean, true);
        if (cur && cur !== prevBtn) {
          sawTransition = true;
          return true;
        }

        return false;
      };

      /**
       * DOM 변경 이벤트 발생 시 현재 화면 상태를 판별하는 콜백 함수입니다.
       *
       * @returns {void}
       */
      const evaluate = () => {
        if (settled) return;
        if (isUserStopped) return finish({ status: 'USER_CLOSED' });
        if (isDailyFinished()) return finish({ status: 'FINISHED' });
        if (handleInsufficientFlakes()) return finish({ status: 'NO_FLAKES' });
        if (checkAndDismissError()) return finish({ status: 'ERROR' });

        if (!checkTransition()) return;

        /**
         * 전환 완료 후 탐색된 활성 재도전 버튼입니다.
         * @type {HTMLElement | null}
         */
        const readyBtn = findElementByCleanText(retryClean, true);

        if (readyBtn) {
          if (!debounceTimer) {
            debounceTimer = setTimeout(() => {
              debounceTimer = null;
              if (settled) return;
              if (isUserStopped) return finish({ status: 'USER_CLOSED' });
              if (isDailyFinished()) return finish({ status: 'FINISHED' });
              if (handleInsufficientFlakes()) return finish({ status: 'NO_FLAKES' });
              if (checkAndDismissError()) return finish({ status: 'ERROR' });

              /**
               * 안정화 후 최종 확인된 활성 버튼 요소입니다.
               * @type {HTMLElement | null}
               */
              const finalBtn = findElementByCleanText(retryClean, true);
              if (finalBtn) {
                finish({ status: 'SUCCESS', element: finalBtn });
              }
            }, 400);
          }
        } else if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
      };

      /**
       * DOM 트리의 생성 및 변경을 실시간 감지하는 옵저버 인스턴스입니다.
       * @type {MutationObserver}
       */
      const observer = new MutationObserver((mutations) => {
        /**
         * 상태 뱃지(#stove-draw-badge) 내부 변경을 제외한 실제 페이지 변경 여부입니다.
         * @type {boolean}
         */
        const hasRelevantMutation = mutations.some((mutation) => {
          /**
           * 변경이 발생한 대상 노드입니다.
           * @type {Node}
           */
          const target = mutation.target;

          /**
           * 대상 엘리먼트 참조입니다.
           * @type {HTMLElement | null}
           */
          const el = target.nodeType === 1 ? target : target.parentElement;

          return !el || !el.closest('#stove-draw-badge');
        });

        if (hasRelevantMutation) {
          evaluate();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      });

      /**
       * 속성 비동기 반영 및 사용자 중단 감시 보조 타이머입니다.
       * @type {number}
       */
      const pollWatcher = setInterval(evaluate, 200);

      /**
       * 최대 응답 대기 타임아웃 타이머입니다.
       * @type {number}
       */
      const timer = setTimeout(() => {
        finish({ status: isUserStopped ? 'USER_CLOSED' : 'TIMEOUT' });
      }, timeoutMs);

      if (!prevBtn) {
        evaluate();
      }
    });
  };

  /**
   * '닫기' 버튼 클릭 이벤트를 감지하는 리스너입니다.
   *
   * @param {MouseEvent} event - 발생한 마우스 클릭 이벤트
   * @returns {void}
   */
  const onCloseClick = (event) => {
    if (!isRunning) return;

    /**
     * 클릭된 요소 기준 가장 가까운 버튼 또는 대화형 태그입니다.
     * @type {HTMLElement | null}
     */
    const button = event.target?.closest?.("button, a, [role='button']");

    if (button) {
      /**
       * 버튼 요소의 정제 텍스트입니다.
       * @type {string}
       */
      const text = cleanText(button.innerText || button.textContent || '');

      /**
       * 웹 접근성 라벨 텍스트입니다.
       * @type {string}
       */
      const aria = cleanText(button.getAttribute('aria-label') || button.getAttribute('title') || '');

      if (text === '닫기' || text === '창닫기' || aria === '닫기') {
        isUserStopped = true;
      }
    }
  };

  /**
   * Esc 키 입력을 감지하는 리스너입니다.
   *
   * @param {KeyboardEvent} event - 키보드 입력 이벤트
   * @returns {void}
   */
  const onKeyDown = (event) => {
    if (!isRunning) return;
    if (event.key === 'Escape' || event.keyCode === 27) {
      isUserStopped = true;
    }
  };

  document.addEventListener('click', onCloseClick, true);
  document.addEventListener('keydown', onKeyDown, true);

  /**
   * 전달받은 옵션(금액, 반복 횟수)에 따라 스토브 뽑기 자동화 시퀀스를 실행합니다.
   *
   * @param {string} drawAmount - 뽑기 금액('100' 또는 '1000')
   * @param {number} totalClicks - '한번 더' 반복 실행 횟수
   * @returns {Promise<void>} 실행 완료 프로미스
   *
   * @async
   */
  const executeAutoDraw = async (drawAmount, totalClicks) => {
    if (isRunning) return;
    isRunning = true;
    isUserStopped = false;

    /**
     * 1,000 플레이크 선택 여부 플래그입니다.
     * @type {boolean}
     */
    const is1000 = drawAmount === '1000';

    /**
     * 표시용 뽑기 금액 문자열입니다.
     * @type {string}
     */
    const targetType = is1000 ? '1,000' : '100';

    /**
     * 초기 뽑기 버튼 정제 텍스트입니다.
     * @type {string}
     */
    const initClean = is1000 ? '1000뽑기' : '100뽑기';

    /**
     * 재도전 버튼 정제 텍스트입니다.
     * @type {string}
     */
    const retryClean = is1000 ? '1000뽑기한번더' : '100뽑기한번더';

    try {
      if (isDailyFinished()) {
        updateStatus('[종료] 오늘 30회 뽑기가 이미 완료되었습니다.', '#2196f3', true);
        return;
      }

      if (handleInsufficientFlakes()) {
        updateStatus('[종료] 보유한 플레이크가 부족합니다.', '#ff9800', true);
        return;
      }

      /**
       * 현재 당일 뽑기 현황 객체입니다.
       * @type {{ current: number, max: number, remaining: number }}
       */
      const status = getDailyDrawStatus();

      if (status.remaining <= 0) {
        updateStatus('[종료] 오늘 뽑기 한도 도달 (' + status.current + '/' + status.max + '회)', '#2196f3', true);
        return;
      }

      /**
       * 현재 대화창이 이미 열려 있는지 여부입니다.
       * @type {boolean}
       */
      const isDialogOpen = !!findElementByCleanText(retryClean, true);

      /**
       * 클릭할 재도전 버튼 참조입니다.
       * @type {HTMLElement | null}
       */
      let currentRetryBtn = null;

      /**
       * 초기 메인 뽑기 버튼 클릭 여부(0 또는 1)입니다.
       * @type {number}
       */
      let initialClickUsed = 0;

      if (!isDialogOpen) {
        /**
         * 초기 뽑기 버튼 요소입니다.
         * @type {HTMLElement | null}
         */
        const initBtn = findElementByCleanText(initClean, true);
        if (!initBtn) {
          updateStatus('[오류] ' + targetType + ' 뽑기 버튼을 찾을 수 없습니다.', '#f44336', true);
          return;
        }

        updateStatus('[초기화] 대화창 생성 이벤트 대기 중...', '#ff9800', false);

        /**
         * 초기 클릭 직전 당일 뽑기 횟수입니다.
         * @type {number}
         */
        const beforeInitCount = status.current;

        /**
         * 초기 대화창 생성 감시 프로미스입니다.
         * @type {Promise<{ status: string, element?: HTMLElement }>}
         */
        const waitInitPromise = observeDrawEvent(retryClean, null, beforeInitCount, 12000);
        triggerClick(initBtn);
        initialClickUsed = 1;

        /**
         * 초기 대화창 생성 결과입니다.
         * @type {{ status: string, element?: HTMLElement }}
         */
        const initResult = await waitInitPromise;

        if (initResult.status === 'USER_CLOSED') {
          updateStatus('[종료] 사용자 요청으로 작업을 중단했습니다.', '#2196f3', true);
          return;
        }
        if (initResult.status === 'FINISHED') {
          updateStatus('[종료] 오늘 30회 뽑기를 완료했습니다!', '#2196f3', true);
          return;
        }
        if (initResult.status === 'NO_FLAKES') {
          updateStatus('[종료] 보유한 플레이크가 부족합니다.', '#ff9800', true);
          return;
        }
        if (initResult.status === 'ERROR') {
          updateStatus('[오류] 서버 통신 중 일시적 오류가 발생했습니다.', '#f44336', true);
          return;
        }
        if (initResult.status !== 'SUCCESS') {
          updateStatus('[오류] 대화창 응답 시간이 초과되었습니다.', '#f44336', true);
          return;
        }

        currentRetryBtn = initResult.element;
      } else {
        currentRetryBtn = findElementByCleanText(retryClean, true);
      }

      /**
       * 성공적으로 완료한 '한번 더' 회차 수입니다.
       * @type {number}
       */
      let completed = 0;

      for (let i = 1; i <= totalClicks; i++) {
        if (isUserStopped) {
          updateStatus('[종료] 작업이 중단되었습니다 (' + completed + '회 완료)', '#2196f3', true);
          return;
        }

        if (!currentRetryBtn || !isElementVisible(currentRetryBtn) || isElementDisabled(currentRetryBtn)) {
          /**
           * 재도전 버튼 활성화 대기 결과입니다.
           * @type {{ status: string, element?: HTMLElement }}
           */
          const waitRes = await observeDrawEvent(retryClean, null, -1, 10000);
          if (waitRes.status === 'USER_CLOSED' || isUserStopped) {
            updateStatus('[종료] 작업이 중단되었습니다 (' + completed + '회 완료)', '#2196f3', true);
            return;
          }
          if (waitRes.status === 'FINISHED') {
            updateStatus('[종료] 오늘 30회 뽑기를 모두 완료했습니다!', '#2196f3', true);
            return;
          }
          if (waitRes.status === 'NO_FLAKES') {
            updateStatus('[종료] 보유 플레이크 부족 (' + completed + '회 완료)', '#ff9800', true);
            return;
          }
          if (waitRes.status !== 'SUCCESS') {
            updateStatus('[오류] 버튼을 찾지 못해 중단되었습니다 (' + completed + '회 완료)', '#f44336', true);
            return;
          }
          currentRetryBtn = waitRes.element;
        }

        /**
         * 클릭 대상 버튼 요소입니다.
         * @type {HTMLElement}
         */
        const clickedBtn = currentRetryBtn;

        /**
         * 클릭 직전 누적 뽑기 횟수입니다.
         * @type {number}
         */
        const beforeClickCount = getDailyDrawStatus().current;

        /**
         * 다음 회차 버튼 생성 감시 프로미스입니다.
         * @type {Promise<{ status: string, element?: HTMLElement }>}
         */
        const nextEventPromise = observeDrawEvent(retryClean, clickedBtn, beforeClickCount, 10000);

        triggerClick(clickedBtn);
        currentRetryBtn = null;
        completed++;
        updateStatus('[진행 중] ' + targetType + ' 한번 더: ' + completed + ' / ' + totalClicks + '회', '#4caf50', false);

        /**
         * 다음 회차 결과 수신 객체입니다.
         * @type {{ status: string, element?: HTMLElement }}
         */
        const nextRes = await nextEventPromise;

        if (nextRes.status === 'USER_CLOSED' || isUserStopped) {
          updateStatus('[종료] 작업이 중단되었습니다 (' + completed + '회 완료)', '#2196f3', true);
          return;
        }
        if (nextRes.status === 'FINISHED') {
          updateStatus('[종료] 오늘 30회 뽑기를 모두 완료했습니다!', '#2196f3', true);
          return;
        }
        if (nextRes.status === 'NO_FLAKES') {
          updateStatus('[종료] 보유 플레이크 부족 (' + completed + '회 완료)', '#ff9800', true);
          return;
        }
        if (nextRes.status === 'ERROR') {
          updateStatus('[오류] 서버 응답 오류로 중단되었습니다 (' + completed + '회 완료)', '#f44336', true);
          return;
        }
        if (nextRes.status === 'SUCCESS') {
          currentRetryBtn = nextRes.element;
        } else {
          updateStatus('[오류] 응답 시간 초과 (' + completed + '회 완료)', '#f44336', true);
          return;
        }
      }

      /**
       * 작업 종료 후 재측정한 뽑기 현황입니다.
       * @type {{ current: number, max: number, remaining: number }}
       */
      const refreshed = getDailyDrawStatus();

      /**
       * 시작 잔여 횟수에서 실제 실행 횟수를 차감한 계산값입니다.
       * @type {number}
       */
      const calculatedRemaining = Math.max(0, status.remaining - initialClickUsed - completed);

      /**
       * 최종 남은 횟수입니다.
       * @type {number}
       */
      const actualRemaining = Math.min(refreshed.remaining, calculatedRemaining);

      if (actualRemaining > 0 && !isDailyFinished()) {
        updateStatus('[완료] ' + completed + '회 실행 완료 (남은 횟수: ' + actualRemaining + '회)', '#2196f3', true);
      } else {
        updateStatus('[종료] 오늘 30회 뽑기를 모두 완료했습니다!', '#2196f3', true);
      }
    } catch (error) {
      console.error(error);
      updateStatus('[오류 발생] ' + (error.message || error), '#f44336', true);
    } finally {
      isRunning = false;
      setTimeout(() => {
        /**
         * 종료 후 제거할 상태 뱃지 요소입니다.
         * @type {HTMLElement | null}
         */
        const badge = document.getElementById('stove-draw-badge');
        if (badge) badge.remove();
      }, isUserStopped ? 1500 : 4000);
    }
  };

  // 확장 프로그램 팝업으로부터 메시지 수신
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    if (message.type === 'GET_STATUS') {
      /**
       * 현재 뽑기 현황입니다.
       * @type {{ current: number, max: number, remaining: number }}
       */
      const status = getDailyDrawStatus();

      /**
       * 현재 대화창이 열려 있는지 여부입니다.
       * @type {boolean}
       */
      const isDialogOpen = !!(
        findElementByCleanText('100뽑기한번더', true) ||
        findElementByCleanText('1000뽑기한번더', true)
      );

      sendResponse({
        ...status,
        isDialogOpen,
        isRunning
      });
      return true;
    }

    if (message.type === 'START_DRAW') {
      const { drawAmount, retryCount } = message.payload || {};
      executeAutoDraw(drawAmount || '100', Number(retryCount) || 0);
      sendResponse({ started: true });
      return true;
    }

    if (message.type === 'STOP_DRAW') {
      isUserStopped = true;
      sendResponse({ stopped: true });
      return true;
    }
  });
})();
