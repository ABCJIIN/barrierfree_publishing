;(function () {
    'use strict';

    // 중복 실행 방지
    if (window.__pageFocusLoopInited) return;
    window.__pageFocusLoopInited = true;

    /* ==============================
    * Config
    * ============================== */
    var ROOT_SELECTOR   = '[data-focus-loop="page"]';
    var HEADER_SELECTOR = 'header';
    var MODAL_SELECTOR  = '.modal[aria-hidden="false"]';

    var FOCUSABLE = [
        'a[href]',
        'area[href]',
        'button:not([disabled]):not([tabindex="-1"])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    /* ==============================
    * Utils
    * ============================== */
    function isVisible(el) {
        return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    }

    function hasOpenModal() {
        return !!document.querySelector(MODAL_SELECTOR);
    }

    function isIntroPage() {
        var path = (location.pathname || '').toLowerCase();

        // 1. 루트 경로('/')만 있는 경우 (index.html이 생략된 경우) 처리
        if (path === '/' || path === '') return true;

        // 2. 파일명이 명시적으로 포함된 경우 (index.html, index_voice.html)
        // endsWith 대신 indexOf를 사용하여 쿼리스트링(?id=123) 등이 붙어도 인식되도록 개선 권장
        return path.indexOf('index.html') !== -1 
            || path.indexOf('index_voice.html') !== -1;
    }

    function getFocusableList(root) {
        var nodes = Array.prototype.slice.call(root.querySelectorAll(FOCUSABLE));
        return nodes.filter(function (el) {
        if (!isVisible(el)) return false;
        return true;
        });
    }

    function buildOrderedList(root) {
        var list = getFocusableList(root);

        // intro 페이지는 기본 DOM 순서 그대로
        if (isIntroPage()) return list;

        // 그 외 페이지는 "헤더 요소들을 맨 뒤로"
        var header = document.querySelector(HEADER_SELECTOR);
        if (!header) return list;

        var headerList = [];
        var restList = [];

        list.forEach(function (el) {
        if (header.contains(el)) headerList.push(el);
        else restList.push(el);
        });

        return restList.concat(headerList);
    }

    function focusByIndex(list, idx) {
        if (!list.length) return null;
        var safe = (idx + list.length) % list.length;
        var el = list[safe];
        try { el.focus(); } catch (e) {}
        return el;
    }

    /* ==============================
    * Bridges (유지)
    * ============================== */
    function handleSortWrapBridge(e, isPrev) {
        var active = document.activeElement;
        if (!active) return false;

        var sortWrap = document.querySelector('.sort-wrap');
        if (!sortWrap) return false;

        // "셀렉트 열림 상태"에서만
        var opened = sortWrap.querySelector(
        '.custom-select .select-item.on, .custom-select .select-item[aria-expanded="true"]'
        );
        if (!opened) return false;

        var infoText = sortWrap.querySelector('.info-text');
        var footer   = document.querySelector('footer.footer, footer');
        if (!footer || !infoText) return false;

        var volumeBtn = footer.querySelector('.volume-control-btn');
        if (!volumeBtn) return false;

        // info-text Tab => volume
        if (active === infoText && !isPrev) {
        e.preventDefault();
        volumeBtn.focus();
        if (window.speakIfNew) { try { window.speakIfNew(volumeBtn); } catch(e){} }
        return true;
        }

        // volume Shift+Tab => info-text
        if (active === volumeBtn && isPrev) {
        e.preventDefault();
        infoText.focus();
        if (window.speakIfNew) { try { window.speakIfNew(infoText); } catch(e){} }
        return true;
        }

        return false;
    }

function handleDetailTitleBridge(e, isPrev) {
  var active = document.activeElement;
  if (!active) return false;

  // ✅ 구조가 달라도 잡히게: detail-title을 페이지에서 직접 찾음
  var titleWrap = document.querySelector('.detail-page .detail-title');
  if (!titleWrap) return false;

  // prev 버튼이 detail-title 밖에 있어도 대응(둘 다 후보로 잡음)
  var prevBtn =
    titleWrap.querySelector('.nav-btn.prev') ||
    document.querySelector('.detail-page .nav-btn.prev');

  var h3 =
    titleWrap.querySelector('h3[tabindex="0"]') ||
    document.querySelector('.detail-page .detail-title h3[tabindex="0"]');

  if (!prevBtn || !h3) return false;

  var isOnPrev = (active === prevBtn) || (active.closest && active.closest('.nav-btn.prev') === prevBtn);
  var isOnH3   = (active === h3);

  // → : prevBtn -> h3
  if (!isPrev && isOnPrev) {
    e.preventDefault();
    e.stopImmediatePropagation();
    h3.focus();
    if (window.speakIfNew) { try { window.speakIfNew(h3); } catch(e){} }
    return true;
  }

  // ← : h3 -> prevBtn
  if (isPrev && isOnH3) {
    e.preventDefault();
    e.stopImmediatePropagation();
    prevBtn.focus();
    if (window.speakIfNew) { try { window.speakIfNew(prevBtn); } catch(e){} }
    return true;
  }

  return false;
}




    /* ==============================
    * Page Tab Controller
    * ============================== */
    function handlePageTab(e, root) {
        
        // 모달 열려있으면 페이지 탭 제어 X
        if (hasOpenModal()) return;

        var active = document.activeElement;

        // (중요) modifier 단독은 절대 처리 금지 (Shift만 눌렀는데 이동하는 버그 방지)
        if (e.key === 'Shift' || e.key === 'Alt' || e.key === 'Control' || e.key === 'Meta') return;

        // 우리가 처리할 키:
        // - Tab            (기존)
        // - ArrowRight(→)  = Tab
        // - ArrowLeft(←)   = Shift+Tab
        var isTab   = (e.key === 'Tab');
        var isRight = (e.key === 'ArrowRight');
        var isLeft  = (e.key === 'ArrowLeft');
        

        if (!isTab && !isRight && !isLeft) return;

        // FILTER LIST paging 영역 제어(핵심 수정)
        // - Tab은 필터 스크립트가 전담
        // - Arrow는 "필터 버튼(라디오)"일 때만 필터 스크립트가 전담
        //   (그래야 wrap → 라디오로 '진입'이 막히지 않음)
        // - 단, 전체 첫/마지막에서의 ←/→ 는 바깥 탈출을 위해 focus.js가 처리
        if (active && active.closest && active.closest('[data-filter-paging="1"]')) {
            if (isTab) return; // Tab은 항상 필터 스크립트가 전담

            if (isLeft || isRight) {
                // "필터 버튼(라디오)"에서만 focus.js가 양보
                var isFilterRadio = (active.getAttribute && active.getAttribute('role') === 'radio')
                    || (active.classList && active.classList.contains('filter-btn'));

                if (isFilterRadio) {
                    var wrap = active.closest('.filter-list-wrap');
                    if (wrap) {
                        var prevBtn = wrap.querySelector('.filter-move-btn.prev');
                        var nextBtn = wrap.querySelector('.filter-move-btn.next');

                        var prevDisabled = !!(prevBtn && (prevBtn.classList.contains('is-disabled') || prevBtn.getAttribute('aria-disabled') === 'true'));
                        var nextDisabled = !!(nextBtn && (nextBtn.classList.contains('is-disabled') || nextBtn.getAttribute('aria-disabled') === 'true'));

                        // 내부 이동/페이지 넘김 구간이면 focus.js는 손 떼기(필터 스크립트가 처리)
                        // 전체 첫에서 ← / 전체 마지막에서 → 는 바깥 탈출이므로 focus.js가 계속 처리해야 함
                        if ((isLeft && !prevDisabled) || (isRight && !nextDisabled)) {
                            return;
                        }
                    } else {
                        // wrap을 못 찾으면 안전하게 양보
                        return;
                    }
                }
                // 라디오가 아니라면(= wrap/prev/next 등) focus.js가 처리해서 라디오로 진입 가능
            }
        }

        // 단축키 조합은 건드리지 않음
        // - Tab은 Shift는 허용, Ctrl/Alt/Meta는 무시
        if (isTab) {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
        } else {
            // Arrow는 Ctrl/Alt/Meta 조합이면 무시
            if (e.altKey || e.ctrlKey || e.metaKey) return;
        }

// [PATCH] 저자세 + 상세페이지: scroll-sec 내부만 sectionMove.js에게 양보
if (document.documentElement.classList.contains('mode-low-posture')) {
  var isDetail = !!document.querySelector('.detail-page');
  if (isDetail) {
    if ((isTab || isLeft || isRight) && active && active.closest('.detail-page .scroll-sec')) {
      return; // scroll-sec 안은 sectionMove가 전담
    }
  }
}




        if (active && active.getAttribute && active.getAttribute('role') === 'option') {
            if (isLeft || isRight) {
                var cs = active.closest('.custom-select');
                if (cs) {
                    var trig = cs.querySelector('.select-item');
                    var opened = trig && (trig.classList.contains('on') || trig.getAttribute('aria-expanded') === 'true');
                    if (opened) {
                        var opts = cs.querySelectorAll('.option-list button[role="option"]');
                        var idxOpt = Array.prototype.indexOf.call(opts, active);

                        // 경계가 아니면 focus.js는 손 떼고(select.js가 한 칸 이동)
                        var atFirst = (idxOpt === 0);
                        var atLast  = (idxOpt === opts.length - 1);
                        if (!( (isLeft && atFirst) || (isRight && atLast) )) {
                            return;
                        }
                        // 경계면 계속 진행해서(아래 로직) 바깥으로 이동
                    }
                }
            } else {
                // Tab은 기존 select.js 로직이 있으니 focus.js는 건드리지 않음
                return;
            }
        }

// 저자세 상세페이지: scroll-sec "진입" 양보는 Tab만 → Tab/←/→로 변경
if ((isTab || isLeft || isRight) && document.documentElement.classList.contains('mode-low-posture')) {
  var sc = document.querySelector('.detail-page .scroll-sec');

  if (sc && active && !sc.contains(active)) {
    var orderedTmp = buildOrderedList(root);
    var idxTmp = orderedTmp.indexOf(active);

    if (idxTmp !== -1) {
      var nextTmp = isPrev ? orderedTmp[idxTmp - 1] : orderedTmp[idxTmp + 1];
      if (nextTmp && sc.contains(nextTmp)) {
        return; // Tab/←/→ 모두 sectionMove에게 넘김
      }
    }
  }
}



        // 핵심: 이동 방향 결정
        // - Tab: shiftKey면 이전, 아니면 다음
        // - ArrowRight: 다음 (Tab과 동일)
        // - ArrowLeft:  이전 (Shift+Tab과 동일)
        var isPrev = false;
        if (isTab) isPrev = !!e.shiftKey;
        else isPrev = isLeft;

        // ======================================================
// [BRIDGE] 저자세 상세: sub-header -> detail prev 버튼 (→/Tab)
// ======================================================
if (!isPrev && document.documentElement.classList.contains('mode-low-posture')) {
  var isDetail = !!document.querySelector('.detail-page');
  if (isDetail) {
    var activeEl = document.activeElement;

    // "현재 포커스가 sub-header일 때만" (여기가 핵심)
    var isOnSubHeader =
      activeEl &&
      activeEl.classList &&
      activeEl.classList.contains('sub-header') &&
      activeEl.getAttribute('tabindex') === '0';

    // prev 버튼 후보
    var prevBtnFromDetail =
      document.querySelector('.detail-page .detail-title .nav-btn.prev') ||
      document.querySelector('.detail-page .nav-btn.prev');

    if (isOnSubHeader && prevBtnFromDetail && isVisible(prevBtnFromDetail)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      prevBtnFromDetail.focus();
      if (window.speakIfNew) { try { window.speakIfNew(prevBtnFromDetail); } catch(e){} }
      return;
    }
  }
}



// 저자세 상세페이지: scroll-sec "진입" 양보는 Tab일 때만
if (isTab && document.documentElement.classList.contains('mode-low-posture')) {
  var sc = document.querySelector('.detail-page .scroll-sec');

  if (sc && active && !sc.contains(active)) {
    var orderedTmp = buildOrderedList(root);
    var idxTmp = orderedTmp.indexOf(active);

    if (idxTmp !== -1) {
      var nextTmp = isPrev ? orderedTmp[idxTmp - 1] : orderedTmp[idxTmp + 1];
      if (nextTmp && sc.contains(nextTmp)) {
        return; // Tab만 sectionMove에게 넘김
      }
    }
  }
}


function handleMapZoomBridge(e, isPrev) {
  var active = document.activeElement;
  if (!active) return false;

  var mapEl = document.querySelector('#map.map-area, #map');
  if (!mapEl) return false;

  // ✅ 1차: 같은 섹션에서 찾기
  var scope = mapEl.closest('.sec-wrap, .map-wrap, .map-section, section') || document;

  // ✅ 2차: 섹션에서 못 찾으면 문서 전체 fallback
  var zin  = scope.querySelector('.map-zoom-in-btn')  || document.querySelector('.map-zoom-in-btn');
  var zout = scope.querySelector('.map-zoom-out-btn') || document.querySelector('.map-zoom-out-btn');

  // 줌 버튼이 포커스 불가로 떨어져 있으면 살려줌
  if (zin  && zin.getAttribute('tabindex')  === '-1') zin.setAttribute('tabindex', '0');
  if (zout && zout.getAttribute('tabindex') === '-1') zout.setAttribute('tabindex', '0');

  // map/zoom 체인인지 판정
  var inChain =
    (active === mapEl) ||
    (zin && active === zin) ||
    (zout && active === zout);

  if (!inChain) return false;

  // next: map -> zoom-in -> zoom-out
  // prev: zoom-out -> zoom-in -> map
  if (!isPrev) {
    if (active === mapEl && zin) {
      e.preventDefault(); e.stopImmediatePropagation();
      zin.focus();
      if (window.speakIfNew) { try { window.speakIfNew(zin); } catch(e){} }
      return true;
    }
    if (zin && active === zin && zout) {
      e.preventDefault(); e.stopImmediatePropagation();
      zout.focus();
      if (window.speakIfNew) { try { window.speakIfNew(zout); } catch(e){} }
      return true;
    }
    return false;
  } else {
    if (zout && active === zout && zin) {
      e.preventDefault(); e.stopImmediatePropagation();
      zin.focus();
      if (window.speakIfNew) { try { window.speakIfNew(zin); } catch(e){} }
      return true;
    }
    if (zin && active === zin) {
      e.preventDefault(); e.stopImmediatePropagation();
      mapEl.focus();
      if (window.speakIfNew) { try { window.speakIfNew(mapEl); } catch(e){} }
      return true;
    }
    return false;
  }
}


        // detail-title 브릿지 (Tab/Shift+Tab/→/← 동일)
if (handleDetailTitleBridge(e, isPrev)) return;

        // map ↔ zoom 브릿지 (Tab/Shift+Tab/→/← 모두 동일)
        if (handleMapZoomBridge(e, isPrev)) return;

        // sort-wrap 브릿지
        if (handleSortWrapBridge(e, isPrev)) return;


        var ordered = buildOrderedList(root);
        if (!ordered.length) return;

        var idx = ordered.indexOf(active);

        // 루트 밖에서 Tab/Arrow 진입 시
        if (!root.contains(active) || idx === -1) {
        e.preventDefault();
        focusByIndex(ordered, 0);
        return;
        }

        // 기본 동작 방지 후 포커스 이동
        e.preventDefault();
        var moved = isPrev
        ? focusByIndex(ordered, idx - 1)
        : focusByIndex(ordered, idx + 1);

        // 포커스 이동 후 TTS
        if (moved && window.speakIfNew) {
        try { window.speakIfNew(moved); } catch (e2) {}
        }
    }

    function initPageLoop(root) {
        // 캡처 단계에서 페이지 탭 제어
        document.addEventListener('keydown', function (e) {
        handlePageTab(e, root);
        }, true);
    }

    document.addEventListener('DOMContentLoaded', function () {
        var root = document.querySelector(ROOT_SELECTOR) || document.body;
        initPageLoop(root);
    });
})();

// ==========================================================
// Map 내부 요소 Tab 포커스 차단 + iframe 회수 + 방향키로 지도 이동
// - map 자체만 tabindex=0 유지
// - map 내부(iframe 포함)로 포커스가 들어가면 map으로 되돌림
// - 확대/축소 버튼(.map-zoom-in-btn / .map-zoom-out-btn)은 예외로 허용
// - map에 포커스 있을 때 방향키로 지도 pan (가능하면 직접, 아니면 이벤트로 위임)
// ==========================================================
;(function () {
    'use strict';

    // 중복 실행 방지
    if (window.__mapFocusGuardInited) return;
    window.__mapFocusGuardInited = true;

    var MAP_SEL = '#map.map-area, #map';

    var FOCUSABLE_IN_MAP = [
        'a[href]',
        'area[href]',
        'button',
        'input',
        'select',
        'textarea',
        'iframe',
        '[tabindex]'
    ].join(',');

    // 방향키 이동 거리(px) - 필요하면 조절
    var PAN_STEP = 60;

    function disableInnerFocus($map) {
        if (!$map || !$map.length) return;

        // map 컨테이너만 대표 포커스 지점
        $map.attr('tabindex', '0');

        $map.find(FOCUSABLE_IN_MAP).each(function () {
            if (this === $map[0]) return;

            // map 컨트롤(확대/축소 버튼 등)은 막지 말기
            if (this.closest && this.closest('.map-control')) return;
            if (this.classList && (this.classList.contains('map-zoom-in-btn') || this.classList.contains('map-zoom-out-btn'))) return;

            if (this.getAttribute('tabindex') !== '-1') {
                this.setAttribute('tabindex', '-1');
            }
        });
    }

    // (1) 가능하면 전역 지도 인스턴스에서 pan을 직접 호출
    function tryPanMap(dx, dy) {
        // 프로젝트마다 전역 이름이 다를 수 있어서 “대표 후보”들을 최대한 안전하게 탐색
        // - window.map / window.naverMap / window.__naverMap / window._map 등
        var candidates = [
            window.naverMap,
            window.__naverMap,
            window.map,
            window._map,
            window.__map
        ].filter(Boolean);

        // naver.maps.Map 인스턴스라면 getCenter/setCenter 또는 panBy 같은 메서드가 있을 수 있음
        for (var i = 0; i < candidates.length; i++) {
            var m = candidates[i];
            try {
                // 1) panBy({x,y}) 형태 (라이브러리마다 다름)
                if (m && typeof m.panBy === 'function') {
                    m.panBy({ x: dx, y: dy });
                    return true;
                }
                // 2) panBy(x,y) 형태
                if (m && typeof m.panBy === 'function') {
                    m.panBy(dx, dy);
                    return true;
                }
                // 3) setCenter/getCenter 기반 (좌표계 변환 필요하면 여기선 어렵고, 보통 panBy가 있음)
            } catch (e) {}
        }
        return false;
    }

    // (2) 직접 pan이 불가능하면, 밖에서 처리할 수 있도록 이벤트로 위임
    function emitPanIntent(mapEl, dx, dy, key) {
        try {
            var ev = new CustomEvent('map:pan', {
                bubbles: true,
                detail: { dx: dx, dy: dy, key: key }
            });
            mapEl.dispatchEvent(ev);
        } catch (e) {}
    }

    function initMapFocusGuard() {
        var $map = $(MAP_SEL).first();
        if (!$map.length) return;

        disableInnerFocus($map);
        // bindArrowKeyFocusNav($map); // 방향키 pan 바인딩 추가

        // 지도 pan: ↑/↓만 사용 (←/→는 focus.js가 Tab처럼 처리하게 둠)
            $map[0].addEventListener('keydown', function (e) {
            if (window.__mapBridgeLock) return;

            var key = e.key || e.code;
            if (key !== 'ArrowUp' && key !== 'ArrowDown') return;

            e.preventDefault();
            e.stopPropagation();

            var dy = (key === 'ArrowUp') ? -PAN_STEP : PAN_STEP;

            var ok = tryPanMap(0, dy);
            if (!ok) emitPanIntent($map[0], 0, dy, key);
            }, true);


        // rAF 스로틀 + 짧은 디바운스
        var scheduled = false;
        var timer = null;

        function schedule() {
            if (scheduled) return;
            scheduled = true;

            requestAnimationFrame(function () {
                scheduled = false;
                disableInnerFocus($map);

                clearTimeout(timer);
                timer = setTimeout(function () {
                    disableInnerFocus($map);
                }, 50);
            });
        }

        var mo = new MutationObserver(function () {
        schedule();
        });

        mo.observe($map[0], {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['tabindex'] // 폭주 방지
        });

        // 포커스가 map 내부로 들어가면 map으로 회수
        document.addEventListener('focusin', function (e) {
        // sectionMove의 map 브릿지 이동 중이면 방해 금지
        if (window.__mapBridgeLock) return;

        var mapEl = $map && $map[0];
        if (!mapEl) return;

        var t = e.target;
        if (!t) return;

        if (mapEl.contains(t) && t !== mapEl) {
            // 확대/축소 버튼은 허용
            if (t.closest && t.closest('.map-control')) return;
            if (t.classList && (t.classList.contains('map-zoom-in-btn') || t.classList.contains('map-zoom-out-btn'))) return;

            try { t.setAttribute('tabindex', '-1'); } catch(err){}
            mapEl.focus();
            if (window.speakIfNew) { try { window.speakIfNew(mapEl); } catch(e){} }
        }
        }, true);

        // 최후 안전장치(가벼운 유지)
        setInterval(function () {
        disableInnerFocus($map);
        }, 2000);
    }

    $(function () {
        initMapFocusGuard();
    });
})();

// ======================================================
// [RESTORE FOCUS + is-keyboard-user AFTER RELOAD] (COMMON)
// - filter-btn(데이터키 자동), custom-select(모든 셀렉트), Zebra pagination 공통 지원
// ======================================================
;(function () {
    'use strict';

    if (window.__restoreFocusAfterReloadInited) return;
    window.__restoreFocusAfterReloadInited = true;

    var KEY = '__focusHint';
    var TTL = 10 * 60 * 1000;

    function save(obj) {
        try { obj.ts = Date.now(); sessionStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) {}
    }
    function load() {
        try {
        var raw = sessionStorage.getItem(KEY);
        if (!raw) return null;
        var obj = JSON.parse(raw);
        if (!obj || !obj.ts) return null;
        if (Date.now() - obj.ts > TTL) return null;
        return obj;
        } catch (e) { return null; }
    }
    function clear() { try { sessionStorage.removeItem(KEY); } catch (e) {} }

    function visible(el) {
        return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    }
    function focus(el) {
        if (!visible(el)) return false;
        document.documentElement.classList.add('is-keyboard-user');
        try { el.focus({ preventScroll: true }); }
        catch (e) { try { el.focus(); } catch (e2) {} }

        if (window.speakIfNew) {
            try { window.speakIfNew(el); } catch (e3) {}
        }
        return true;
    }

    // ------------------------------
    // Utils: selector escape (간단)
    // ------------------------------
    function escAttr(v) {
        return String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    // ------------------------------
    // Utils: filter key 자동 추출
    // - data-q / data-group 등 "data-*" 중 값이 있는 첫 키를 저장
    // ------------------------------
    function getFilterDataKey(btn) {
        if (!btn) return null;
        var ds = btn.dataset;
        if (!ds) return null;

        // 우선순위(명시적으로)
        if (ds.q !== undefined) return 'q';
        if (ds.group !== undefined) return 'group';

        // 그 외 data-* 중 값이 존재하는 첫 키
        for (var k in ds) {
        if (Object.prototype.hasOwnProperty.call(ds, k) && ds[k] !== '') return k;
        }
        return null;
    }

    // ------------------------------
    // Utils: custom-select 식별자 추출
    // - aria-controls(listbox id) 우선
    // - 없으면 문서 내 index
    // ------------------------------
    function getSelectHintFromOption(optionBtn) {
        var root = optionBtn && optionBtn.closest ? optionBtn.closest('.custom-select') : null;
        if (!root) return null;

        var trigger = root.querySelector('.select-item');
        var listId = trigger ? (trigger.getAttribute('aria-controls') || '') : '';

        var idx = -1;
        try {
        var all = Array.prototype.slice.call(document.querySelectorAll('.custom-select'));
        idx = all.indexOf(root);
        } catch (e) {}

        return { listId: listId, index: idx };
    }

    // 1) 클릭 "직전" 힌트 저장 (캡처)
    document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;

        // (A) FILTER 공통
        var fb = t.closest('.filter-btn[role="radio"]');
        if (fb) {
        var key = getFilterDataKey(fb);           // ex) 'q' or 'group' or others
        var val = key ? (fb.dataset[key] || '') : '';
        save({ kind: 'filter', key: key || '', val: val, text: (fb.textContent || '').trim() });
        return;
        }

        // (B) PAGINATION (first/last/next/prev 포함)
        var pa = t.closest('.Zebra_Pagination a');
        if (pa) {
        save({
            kind: 'pagination',
            cls: pa.className || '',
            href: pa.getAttribute('href') || '',
            text: (pa.textContent || '').trim()
        });
        return;
        }

        // (C) SELECT 공통: 옵션 클릭 -> 해당 custom-select의 trigger로 복원
        var opt = t.closest('.custom-select .option-list button[role="option"]');
        if (opt) {
        var sh = getSelectHintFromOption(opt);
        if (sh) {
            save({ kind: 'select', listId: sh.listId || '', index: sh.index });
        }
        return;
        }

        // (D) TAB (있으면)
        var tab = t.closest('.tab-btn, [role="tab"]');
        if (tab) {
        save({ kind: 'tab', id: tab.id || '', controls: tab.getAttribute('aria-controls') || '' });
        return;
        }
    }, true);

    // ------------------------------
    // Restore finder
    // ------------------------------
    function findFromHint(h) {
        if (!h) return null;

        // ---- FILTER ----
        if (h.kind === 'filter') {
            // 1) data-key/value로 복원
            if (h.key) {
                var sel = '.filter-btn[role="radio"][data-' + escAttr(h.key) + '="' + escAttr(h.val || '') + '"]';
                var byKV = document.querySelector(sel);
                if (byKV) return byKV;
            }

            // 2) text로 fallback (동일 텍스트가 많으면 위험하지만 최후 수단)
            if (h.text) {
                var list = document.querySelectorAll('.filter-btn[role="radio"]');
                for (var i = 0; i < list.length; i++) {
                if ((list[i].textContent || '').trim() === h.text) return list[i];
                }
            }

            // 3) 현재 선택(aria-checked=true)
            return document.querySelector('.filter-btn[role="radio"][aria-checked="true"]');
        }

        // ---- SELECT ----
        if (h.kind === 'select') {
            // 1) listbox id 기반(aria-controls)로 가장 안정적으로
            if (h.listId) {
                var trig = document.querySelector('.custom-select .select-item[aria-controls="' + escAttr(h.listId) + '"]');
                if (trig) return trig;
            }
            // 2) index 기반
            if (typeof h.index === 'number' && h.index >= 0) {
                var all = document.querySelectorAll('.custom-select');
                if (all[h.index]) {
                var trg2 = all[h.index].querySelector('.select-item');
                if (trg2) return trg2;
                }
            }
            return null;
        }

        // ---- PAGINATION ----
        if (h.kind === 'pagination') {
            var root = document.querySelector('.Zebra_Pagination');
            if (!root) return null;

            // 기능 버튼(클래스 우선)
            if (/\blast\b/.test(h.cls || ''))  return root.querySelector('a.last')  || root.querySelector('a');
            if (/\bfirst\b/.test(h.cls || '')) return root.querySelector('a.first') || root.querySelector('a');
            if (/\bnext\b/.test(h.cls || ''))  return root.querySelector('a.next')  || root.querySelector('a');
            if (/\bprev(ious)?\b/.test(h.cls || '')) return root.querySelector('a.previous, a.prev') || root.querySelector('a');

            // 숫자 링크는 href 매칭
            if (h.href && h.href !== '#' && h.href !== '') {
                var byHref = root.querySelector('a[href="' + escAttr(h.href) + '"]');
                if (byHref) return byHref;
            }

            // text 매칭(“3” 같은)
            if (h.text) {
                var as = root.querySelectorAll('a');
                for (var i = 0; i < as.length; i++) {
                if ((as[i].textContent || '').trim() === h.text) return as[i];
                }
            }

            // 최후: current
            return root.querySelector('a.current, .current, .active');
        }

        // ---- TAB ----
        if (h.kind === 'tab') {
        return (h.id ? document.getElementById(h.id) : null)
            || (h.controls ? document.querySelector('[role="tab"][aria-controls="' + escAttr(h.controls) + '"], .tab-btn[aria-controls="' + escAttr(h.controls) + '"]') : null)
            || document.querySelector('[role="tab"][aria-selected="true"], .tab-btn.is-active');
        }

        return null;
    }

    function restore() {
        var h = load();
        var tries = 0;
        var max = 25; // 1.25s

        (function loop() {
            tries++;

            var el = findFromHint(h);

            // span.current는 포커스 불가 -> 숫자 a로 보정
            if (el && el.tagName === 'SPAN') {
                var txt = (el.textContent || '').trim();
                var root = document.querySelector('.Zebra_Pagination');
                if (root) {
                    var as = root.querySelectorAll('a');
                    for (var i = 0; i < as.length; i++) {
                        if ((as[i].textContent || '').trim() === txt) { el = as[i]; break; }
                    }
                }
            }

            if (el && focus(el)) { clear(); return; }
            if (tries >= max) { clear(); return; }
            setTimeout(loop, 50);
        })();
    }

    document.addEventListener('DOMContentLoaded', function () {
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                restore();
            });
        });
    });
})();