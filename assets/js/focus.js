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