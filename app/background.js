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
 * 확장 프로그램이 정상 동작하는 대상 URL 접두사입니다.
 * @type {string}
 */
const TARGET_URL_PREFIX = 'https://reward.onstove.com/ko/event';

/**
 * 활성화 상태(동작 사이트)일 때 적용할 아이콘 세트입니다.
 * @type {Record<number, string>}
 */
const ACTIVE_ICONS = {
  16: 'icons/icon16.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png'
};

/**
 * 비활성화 상태(비동작 사이트)일 때 적용할 아이콘 세트입니다.
 * @type {Record<number, string>}
 */
const DISABLED_ICONS = {
  16: 'icons/icon16_disabled.png',
  48: 'icons/icon48_disabled.png',
  128: 'icons/icon128_disabled.png'
};

/**
 * 탭의 URL에 따라 확장 프로그램 아이콘 및 활성 상태를 동적으로 갱신합니다.
 *
 * @param {number} tabId - 대상 탭 식별자
 * @param {string | undefined} url - 대상 탭의 현재 URL
 * @returns {void}
 */
const updateActionState = (tabId, url) => {
  if (!tabId) return;

  const isTarget = typeof url === 'string' && url.startsWith(TARGET_URL_PREFIX);

  if (isTarget) {
    chrome.action.enable(tabId);
    chrome.action.setIcon({
      tabId,
      path: ACTIVE_ICONS
    });
    chrome.action.setTitle({
      tabId,
      title: "Stove 럭키 캡슐 '한번 더' 뽑기 도우미 (활성화)"
    });
  } else {
    chrome.action.disable(tabId);
    chrome.action.setIcon({
      tabId,
      path: DISABLED_ICONS
    });
    chrome.action.setTitle({
      tabId,
      title: "Stove 럭키 캡슐 '한번 더' 뽑기 도우미 (비활성화 - 대상 페이지 아님)"
    });
  }
};

// 1. 탭 URL 변경 감지 리스너
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    updateActionState(tabId, tab.url || changeInfo.url);
  }
});

// 2. 활성 탭 전환 감지 리스너
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab) {
      updateActionState(tab.id, tab.url);
    }
  } catch (err) {
    // 탭이 닫히는 중이거나 접근 불가한 경우 무시
  }
});

// 3. 확장 프로그램 설치 시 모든 기존 탭 상태 초기화
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        updateActionState(tab.id, tab.url);
      }
    }
  } catch (err) {}
});

// 4. 브라우저 시작 시 모든 기존 탭 상태 초기화
chrome.runtime.onStartup.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        updateActionState(tab.id, tab.url);
      }
    }
  } catch (err) {}
});
