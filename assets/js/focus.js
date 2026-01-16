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
        'button:not([disabled])',
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
        return path.endsWith('/index.html') || path.endsWith('index.html')
            || path.endsWith('/index_voice.html') || path.endsWith('index_voice.html');
    }

    function getFocusableList(root) {
        var nodes = Array.prototype.slice.call(root.querySelectorAll(FOCUSABLE));
        return nodes.filter(function (el) {
        if (!isVisible(el)) return false;
        if (el.closest('[aria-hidden="true"]')) return false;
        if (el.closest('[hidden]')) return false;
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
        if (!list.length) return;
        var safe = (idx + list.length) % list.length;
        list[safe].focus();
    }

    /* ==============================
    * Bridges (유지)
    * ============================== */
    function handleSortWrapBridge(e) {
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
        if (active === infoText && !e.shiftKey) {
        e.preventDefault();
        volumeBtn.focus();
        return true;
        }

        // volume Shift+Tab => info-text
        if (active === volumeBtn && e.shiftKey) {
        e.preventDefault();
        infoText.focus();
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

        // [PATCH] 저자세 + 상세페이지: sectionMove.js에게 "완전 양보"
        // - h3(노들섬) -> scroll-sec 진입 Tab을 focus.js가 먹어버리는 케이스 방지
        if (document.documentElement.classList.contains('mode-low-posture')) {
            var isDetail = !!document.querySelector('.detail-page');
            if (isDetail) {
            // 상세페이지에서는 sectionMove.js가 Tab 흐름을 관리하게 둔다.
            // (scroll-sec 내부뿐 아니라, scroll-sec "진입 직전" 요소들도 포함)
            if (active && (
                active.closest('.detail-page .scroll-sec') ||
                active.matches('.detail-page .detail-title h3[tabindex="0"]') ||
                active.closest('.detail-page .detail-title')
            )) {
                return;
            }
            }
        }

        // 커스텀 셀렉트 옵션 내부면 select.js가 담당
        if (active && active.getAttribute('role') === 'option') return;

        // 필터 리스트 영역은 filter.js가 담당
        if (active && active.closest && active.closest('.filter-list-wrap')) return;

        // 저자세 상세페이지(scroll-sec)는 sectionMove.js가 Tab 흐름 제어 → focus.js는 건드리지 않음
        if (document.documentElement.classList.contains('mode-low-posture')) {
            var act = document.activeElement;
            if (act && act.closest && act.closest('.detail-page .scroll-sec')) return;
        }

        if (e.key !== 'Tab') return;

        // 저자세 상세페이지: scroll-sec "진입" Tab은 sectionMove.js가 처리하게 양보
        if (document.documentElement.classList.contains('mode-low-posture')) {
            var active = document.activeElement;
            var sc = document.querySelector('.detail-page .scroll-sec');

            // 현재 포커스가 scroll-sec 밖에 있고,
            // 다음 포커스 후보가 scroll-sec 안에 있는 상황이면 focus.js가 Tab을 먹지 않는다.
            if (sc && active && !sc.contains(active)) {
                var orderedTmp = buildOrderedList(root);
                var idxTmp = orderedTmp.indexOf(active);

                if (idxTmp !== -1) {
                    var nextTmp = e.shiftKey ? orderedTmp[idxTmp - 1] : orderedTmp[idxTmp + 1];
                    if (nextTmp && sc.contains(nextTmp)) {
                        return; // 여기서 빠지면 sectionMove.js 캡처 핸들러가 이어서 받음
                    }
                }
            }
        }


        // sort-wrap 브릿지
        if (handleSortWrapBridge(e)) return;

        var ordered = buildOrderedList(root);
        if (!ordered.length) return;

        var idx = ordered.indexOf(active);

        // 루트 밖에서 Tab 진입 시
        if (!root.contains(active) || idx === -1) {
        e.preventDefault();
        focusByIndex(ordered, 0);
        return;
        }

        e.preventDefault();
        if (e.shiftKey) focusByIndex(ordered, idx - 1);
        else focusByIndex(ordered, idx + 1);
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
// Map 내부 요소 Tab 포커스 차단 + iframe 회수 (focus.js 역할은 여기까지만)
// - map 자체만 tabindex=0 유지
// - map 내부(iframe 포함)로 포커스가 들어가면 map으로 되돌림
// - 확대/축소 버튼(.map-zoom-in-btn / .map-zoom-out-btn)은 예외로 허용
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

    function initMapFocusGuard() {
        var $map = $(MAP_SEL).first();
        if (!$map.length) return;

        disableInnerFocus($map);

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