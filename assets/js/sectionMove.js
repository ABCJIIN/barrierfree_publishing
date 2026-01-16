// ======================================================
// [MAP TAB BRIDGE] map-area ↔ 확대/축소 버튼 체인 고정 (sectionMove와 완전 분리)
// - Tab:   map -> zoomIn -> zoomOut
// - S+Tab: zoomOut -> zoomIn -> map
// - 네이버지도 iframe로 포커스 빨려들어가는 것도 map으로 회수
// ======================================================
;(function () {
    'use strict';

    var MAP_ID = 'map';
    var ZOOM_IN_SEL  = '.map-zoom-in-btn';
    var ZOOM_OUT_SEL = '.map-zoom-out-btn';

    var BRIDGE_LOCK = false;
    function lockOnce() {
    BRIDGE_LOCK = true;
    window.__mapBridgeLock = true;   // 추가
    setTimeout(function () {
        BRIDGE_LOCK = false;
        window.__mapBridgeLock = false; // 추가
    }, 0);
    }

    function getMapEl() {
        return document.getElementById(MAP_ID);
    }

    function isVisible(el) {
        return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    }

    function isIframeInMap(target, mapEl) {
        return !!(target && target.tagName === 'IFRAME' && mapEl && mapEl.contains(target));
    }

    function ensureMapFocusable() {
        var mapEl = getMapEl();
        if (!mapEl) return;
        if (mapEl.getAttribute('tabindex') !== '0') mapEl.setAttribute('tabindex', '0');
    }

    // 1) Tab 체인 제어 (캡처 단계에서 먼저 잡아서 sectionMove/focusLoop보다 우선)
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;

        var mapEl = getMapEl();
        if (!mapEl) return;

        ensureMapFocusable();

        var zoomIn  = document.querySelector(ZOOM_IN_SEL);
        var zoomOut = document.querySelector(ZOOM_OUT_SEL);
        var a = document.activeElement;

        var isMapFocus = (a === mapEl) || isIframeInMap(a, mapEl);

        if (isMapFocus && !e.shiftKey && zoomIn && isVisible(zoomIn)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        lockOnce();
        zoomIn.focus();
        return;
        }

        if (a === zoomIn && !e.shiftKey && zoomOut && isVisible(zoomOut)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        lockOnce();
        zoomOut.focus();
        return;
        }

        if (a === zoomOut && e.shiftKey && zoomIn && isVisible(zoomIn)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        lockOnce();
        zoomIn.focus();
        return;
        }

        if (a === zoomIn && e.shiftKey && isVisible(mapEl)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        lockOnce();
        mapEl.focus();
        return;
        }
    }, true);

    // 2) iframe 포커스 빨려들어가면 map으로 회수 (브릿지 이동 중엔 방해 금지)
    document.addEventListener('focusin', function (e) {
        if (BRIDGE_LOCK) return;

        var mapEl = getMapEl();
        if (!mapEl) return;

        ensureMapFocusable();

        var t = e.target;
        if (!t) return;

        if (mapEl.contains(t) && t !== mapEl) {
        if (t.closest && t.closest('.map-control')) return;
        if (t.classList && (t.classList.contains('map-zoom-in-btn') || t.classList.contains('map-zoom-out-btn'))) return;

        try { t.setAttribute('tabindex', '-1'); } catch(err){}
        mapEl.focus();
        }
    }, true);

    // 3) 안전장치: 지도 iframe tabindex 되살리는 케이스 대비
    setInterval(function () {
        var mapEl = getMapEl();
        if (!mapEl) return;
        ensureMapFocusable();

        var iframes = mapEl.querySelectorAll('iframe');
        for (var i = 0; i < iframes.length; i++) {
        if (iframes[i].getAttribute('tabindex') !== '-1') {
            iframes[i].setAttribute('tabindex', '-1');
        }
        }
    }, 1500);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureMapFocusable);
    } else {
        ensureMapFocusable();
    }
})();


// ======================================================
// [SECTION MOVE] 서브페이지에서 이전/다음 버튼으로 섹션/스크롤 이동
// - 낮은자세 모드(html.mode-low-posture) : 섹션/페이지 페이징 + 스와이프/휠로 한 단계 이동
// - 일반/고대비 모드 : scroll-sec 영역을 위/아래로 스크롤 이동(롱프레스)
// ======================================================
;(function () {
    'use strict';

    var SEL = {
        rootLow: 'html.mode-low-posture',
        scrollSec: '.detail-page .scroll-sec',
        wraps: '.detail-page .scroll-sec .sec-wrap',
        inner: '.sec-wrap .sec-inner',

        thirdWrap: '.detail-page .scroll-sec .sec-wrap:nth-of-type(3)',
        access: '.detail-page .scroll-sec .sec-wrap:nth-of-type(3) .access-sec',

        prevWrap: '.floating-btn .btn-wrap.prev',
        nextWrap: '.floating-btn .btn-wrap.next',
        prevBtn:  '.floating-btn .sec-move-btn.prev',
        nextBtn:  '.floating-btn .sec-move-btn.next',

        focusable: 'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    };

    var steps = [];
    var current = 0;
    var isLowPosture = false;

    var PAGE_EPSILON = 55;
    var LAST_SECTION_OVERSHOOT = 72;

    var SCROLL_EDGE_EPSILON = 2;

    var HOLD_SCROLL_SPEED = 16;
    var HOLD_SCROLL_INTERVAL = 16;
    var holdTimer = null;
    var holdDir = 0;

    var SWIPE_THRESHOLD = 50;
    var SWIPE_AXIS_LOCK = 10;
    var swipe = { active:false, locked:false, startX:0, startY:0 };

    var NAV_COOLDOWN = 350;
    var navLocked = false;
    function lockNav(){
        navLocked = true;
        setTimeout(function(){ navLocked = false; }, NAV_COOLDOWN);
    }

    function isVisible(el){
        return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    }

    function getFocusableAll(){
        return Array.prototype.slice.call(document.body.querySelectorAll(SEL.focusable)).filter(function(el){
        if (!isVisible(el)) return false;
        if (el.closest && el.closest('[aria-hidden="true"]')) return false;
        if (el.closest && el.closest('[hidden]')) return false;
        if (el.closest && el.closest('.sec-wrap.is-hidden')) return false;
        return true;
        });
    }

    function getNextFocusableFrom(node){
        var all = getFocusableAll();
        var idx = all.indexOf(node);
        return (idx >= 0) ? (all[idx + 1] || null) : null;
    }

    function getPrevFocusableFrom(node){
        var all = getFocusableAll();
        var idx = all.indexOf(node);
        return (idx >= 0) ? (all[idx - 1] || null) : null;
    }

    // focusin으로 화면 맞출 때 재귀 방지
    var SYNC_LOCK = false;
    function lockSyncOnce(){
        SYNC_LOCK = true;
        setTimeout(function(){ SYNC_LOCK = false; }, 0);
    }

    function qs(sel, ctx){ return (ctx || document).querySelector(sel); }
    function qsa(sel, ctx){ return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
    function addClass(el, c){ if (el && !el.classList.contains(c)) el.classList.add(c); }
    function removeClass(el, c){ if (el && el.classList.contains(c)) el.classList.remove(c); }

    function getNumericPx(el, prop){
        var cs = window.getComputedStyle(el);
        return parseFloat(cs.getPropertyValue(prop)) || 0;
    }

    function ensureMeasureVisible(el){
        var restore = {};
        var applied = false;
        if (!el) return function(){};

        var hiddenByClass = el.classList.contains('is-hidden');
        var hiddenByStyle = (el.style.display === 'none');

        if (hiddenByClass || hiddenByStyle){
        restore.class = hiddenByClass;
        restore.display = el.style.display;
        removeClass(el, 'is-hidden');
        el.style.display = 'block';

        restore.visibility = el.style.visibility;
        restore.position   = el.style.position;
        restore.left       = el.style.left;

        el.style.visibility = 'hidden';
        el.style.position   = 'absolute';
        el.style.left       = '-9999px';
        applied = true;
        }

        return function(){
        if (!applied) return;
        if (restore.class) addClass(el, 'is-hidden');
        el.style.display    = restore.display || '';
        el.style.visibility = restore.visibility || '';
        el.style.position   = restore.position || '';
        el.style.left       = restore.left || '';
        };
    }

    function getFirstFocusableIn(el){
        if (!el) return null;
        var nodes = Array.prototype.slice.call(el.querySelectorAll(SEL.focusable));
        for (var i=0; i<nodes.length; i++){
        var n = nodes[i];
        if (!isVisible(n)) continue;
        if (n.closest && n.closest('[aria-hidden="true"]')) continue;
        if (n.closest && n.closest('[hidden]')) continue;
        if (n.closest && n.closest('.sec-wrap.is-hidden')) continue;
        return n;
        }
        return null;
    }

    function getLastFocusableIn(el){
        if (!el) return null;
        var nodes = Array.prototype.slice.call(el.querySelectorAll(SEL.focusable));
        for (var i=nodes.length-1; i>=0; i--){
        var n = nodes[i];
        if (!isVisible(n)) continue;
        if (n.closest && n.closest('[aria-hidden="true"]')) continue;
        if (n.closest && n.closest('[hidden]')) continue;
        if (n.closest && n.closest('.sec-wrap.is-hidden')) continue;
        return n;
        }
        return null;
    }

    function getAllFocusableInWrap(wrap){
        if (!wrap) return [];
        return Array.prototype.slice.call(wrap.querySelectorAll(SEL.focusable)).filter(function(el){
        if (!isVisible(el)) return false;
        if (el.closest && el.closest('[aria-hidden="true"]')) return false;
        if (el.closest && el.closest('[hidden]')) return false;
        if (el.closest && el.closest('.sec-wrap.is-hidden')) return false;
        return true;
        });
    }

    function focusSafe(el){
        if (!el) return;
        try { el.focus({ preventScroll: true }); }
        catch(e){ el.focus(); }
    }

    function getAvailHeight(){
        var sec = qs(SEL.scrollSec);
        if (!sec) return 0;

        if (isLowPosture) {
        var pt = getNumericPx(sec, 'padding-top');
        var pb = getNumericPx(sec, 'padding-bottom');
        return Math.max(0, sec.clientHeight - pt - pb);
        }
        return sec.clientHeight;
    }

    function measureThirdWrap(){
        var third = qs(SEL.thirdWrap);
        if (!third) return { totalH: 0, shiftY: 0, fitsBoth: true };

        var cleanup = ensureMeasureVisible(third);
        var totalH  = third.scrollHeight;
        var avail   = getAvailHeight();

        var inner  = qs(SEL.inner, third);
        var access = qs(SEL.access, third);

        var shiftY = 0;
        if (inner && access){
        shiftY = Math.max(0, access.offsetTop - (inner.offsetTop || 0));
        }

        var fitsBoth = totalH <= avail;
        cleanup();
        return { totalH: totalH, shiftY: shiftY, fitsBoth: fitsBoth };
    }

    function buildSteps(){
        steps = [];
        var wraps = qsa(SEL.wraps);

        wraps.forEach(function(wrap, idx){
        var cleanup = ensureMeasureVisible(wrap);
        var totalH = wrap.scrollHeight;
        cleanup();

        if (idx !== 2){
            steps.push({ wrapIdx: idx, mode: 'all', baseShift: 0, height: totalH, pageIndex: 0 });
            return;
        }

        var m = measureThirdWrap();
        if (m.fitsBoth){
            steps.push({ wrapIdx: idx, mode: 'all', baseShift: 0, height: m.totalH, pageIndex: 0 });
        } else {
            steps.push({ wrapIdx: idx, mode: 'first',  baseShift: 0,                      height: Math.max(0, m.shiftY),             pageIndex: 0 });
            steps.push({ wrapIdx: idx, mode: 'second', baseShift: Math.max(0, m.shiftY),  height: Math.max(0, m.totalH - m.shiftY), pageIndex: 0 });
        }
        });

        if (steps.length){
        if (current >= steps.length) current = steps.length - 1;
        if (current < 0) current = 0;
        } else {
        current = 0;
        }
    }

    function getMaxPageIndex(step){
        var avail = getAvailHeight();
        if (!step || !avail) return 0;

        var overflow = step.height - avail;
        if (overflow <= PAGE_EPSILON) return 0;

        return Math.max(0, Math.ceil((step.height - PAGE_EPSILON) / avail) - 1);
    }

    function clampPageIndex(step){
        if (!step) return;
        var maxIdx = getMaxPageIndex(step);
        if (step.pageIndex > maxIdx) step.pageIndex = maxIdx;
        if (step.pageIndex < 0) step.pageIndex = 0;
    }

    function applyVisibility(){
        var wraps = qsa(SEL.wraps);
        wraps.forEach(function(w){
        addClass(w, 'is-hidden');
        removeClass(w, 'is-active');
        w.style.transform = '';
        });

        var s = steps[current];
        if (!s) return;

        var target = wraps[s.wrapIdx];
        if (!target) return;

        removeClass(target, 'is-hidden');
        addClass(target, 'is-active');

        var avail = getAvailHeight();
        var rawShift = s.baseShift + (s.pageIndex * avail);

        var overflow = s.height - avail;
        var effectiveOverflow = (overflow > PAGE_EPSILON) ? overflow : 0;
        var maxShift = Math.max(0, s.baseShift + effectiveOverflow);

        var isLastStep = (current === steps.length - 1);
        var isAccessFirstPage = (s.mode === 'second' && s.pageIndex === 0);
        if (isLastStep && isAccessFirstPage) {
        rawShift += LAST_SECTION_OVERSHOOT;
        maxShift += LAST_SECTION_OVERSHOOT;
        }

        var shift = Math.min(rawShift, maxShift);
        target.style.transform = 'translateY(-' + shift + 'px)';
    }

    function getScrollContainer(){
        return qs(SEL.scrollSec);
    }

    function stopHoldScroll(){
        if (holdTimer){
        clearInterval(holdTimer);
        holdTimer = null;
        }
        holdDir = 0;
    }

    function startHoldScroll(dir){
        var sc = getScrollContainer();
        if (!sc) return;

        holdDir = dir;
        if (holdTimer) return;

        holdTimer = setInterval(function(){
        sc.scrollTop = sc.scrollTop + (holdDir * HOLD_SCROLL_SPEED);
        updateFloatingButtons();

        if (isAtTop(sc) && holdDir < 0) stopHoldScroll();
        if (isAtBottom(sc) && holdDir > 0) stopHoldScroll();
        }, HOLD_SCROLL_INTERVAL);
    }

    function isAtTop(sc){
        return (sc.scrollTop <= SCROLL_EDGE_EPSILON);
    }

    function isAtBottom(sc){
        return (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - SCROLL_EDGE_EPSILON);
    }

    function updateFloatingButtons(){
        var prevWrap = qs(SEL.prevWrap);
        var nextWrap = qs(SEL.nextWrap);
        var prevBtn  = qs(SEL.prevBtn);
        var nextBtn  = qs(SEL.nextBtn);

        var activeEl = document.activeElement;
        var prevHadFocus = prevBtn && (activeEl === prevBtn || prevBtn.contains(activeEl));
        var nextHadFocus = nextBtn && (activeEl === nextBtn || nextBtn.contains(activeEl));

        var atFirst = false;
        var atLast  = false;

        if (isLowPosture) {
        atFirst = (current === 0 && steps[0] && steps[0].pageIndex === 0);

        var lastStep = steps[steps.length - 1];
        if (lastStep){
            atLast = (current === steps.length - 1) && (lastStep.pageIndex === getMaxPageIndex(lastStep));
        } else {
            atLast = true;
        }
        } else {
        var sc = getScrollContainer();
        if (sc){
            atFirst = isAtTop(sc);
            atLast  = isAtBottom(sc);
        }
        }

        if (prevWrap) prevWrap.style.display = atFirst ? 'none' : '';
        if (nextWrap) nextWrap.style.display = atLast  ? 'none' : '';

        var prevVisible = prevWrap ? (prevWrap.style.display !== 'none') : false;
        var nextVisible = nextWrap ? (nextWrap.style.display !== 'none') : false;

        if (!prevVisible && prevHadFocus && nextVisible && nextBtn){
        nextBtn.focus();
        } else if (!nextVisible && nextHadFocus && prevVisible && prevBtn){
        prevBtn.focus();
        }

        if (prevWrap){
        if (prevVisible && !nextVisible) addClass(prevWrap, 'no-bd');
        else removeClass(prevWrap, 'no-bd');
        }
    }

    function goPrev(){
        if (!isLowPosture){
        startHoldScroll(-1);
        return;
        }

        var s = steps[current];
        if (!s) return;

        if (s.pageIndex > 0){
        s.pageIndex--;
        applyVisibility();
        updateFloatingButtons();
        return;
        }

        if (current > 0){
        current--;
        var t = steps[current];
        clampPageIndex(t);
        t.pageIndex = getMaxPageIndex(t);
        applyVisibility();
        updateFloatingButtons();
        }
    }

    function goNext(){
        if (!isLowPosture){
        startHoldScroll(1);
        return;
        }

        var s = steps[current];
        if (!s) return;

        var maxIdx = getMaxPageIndex(s);
        if (s.pageIndex < maxIdx){
        s.pageIndex++;
        applyVisibility();
        updateFloatingButtons();
        return;
        }

        if (current < steps.length - 1){
        current++;
        var t = steps[current];
        clampPageIndex(t);
        applyVisibility();
        updateFloatingButtons();
        }
    }

    // step 기반으로 현재 보이는 wrap을 "정확히" 가져오기 (is-active query 금지)
    function getWrapByStep(){
        var wraps = qsa(SEL.wraps);
        var s = steps[current];
        if (!s) return null;
        return wraps[s.wrapIdx] || null;
    }

    function focusWrapEdge(isBackward){
        var w = getWrapByStep();
        if (!w) return;
        var el = isBackward ? getLastFocusableIn(w) : getFirstFocusableIn(w);
        if (el) focusSafe(el);
    }

    // first sec-wrap "직전" 포커싱 요소 찾기
    function getPreFirstWrapFocusable(){
        var wraps = qsa(SEL.wraps);
        if (!wraps.length) return null;

        var firstWrap = wraps[0];
        if (!firstWrap) return null;

        var all = getFocusableAll();
        if (!all.length) return null;

        var lastBefore = null;
        for (var i = 0; i < all.length; i++){
        var el = all[i];

        // sec-wrap 내부 요소는 제외
        if (el.closest && el.closest(SEL.wraps)) continue;

        var pos = el.compareDocumentPosition(firstWrap);
        var isBefore = !!(pos & Node.DOCUMENT_POSITION_FOLLOWING); // el -> firstWrap (firstWrap이 뒤)
        if (isBefore) lastBefore = el;
        }

        return lastBefore;
    }

    // 무조건 1번째 sec-wrap 첫 포커스로 점프
    function jumpToFirstWrapFocus(){
        if (!isLowPosture) return;
        if (!steps.length) return;

        current = 0;
        steps[0].pageIndex = 0;

        lockSyncOnce();
        applyVisibility();
        updateFloatingButtons();

        requestAnimationFrame(function(){
        focusWrapEdge(false); // 첫 wrap의 첫 포커스로
        });
    }

    // 포커스가 들어온 요소가 "보이도록" current/pageIndex를 맞춤 (저자세에서만)
    function syncToFocusedEl(el) {
        if (!isLowPosture) return;
        if (SYNC_LOCK) return;

        var sc = qs(SEL.scrollSec);
        if (!el || !sc) return;

        var targetWrap = el.closest(SEL.wraps);
        if (!targetWrap) return;

        var wraps = qsa(SEL.wraps);
        var wrapIdx = wraps.indexOf(targetWrap);
        if (wrapIdx === -1) return;

        var avail = getAvailHeight();
        if (avail <= 0) return;

        var foundStepIdx = -1;
        var foundPageIdx = 0;

        for (var i = 0; i < steps.length; i++) {
        var s = steps[i];
        if (s.wrapIdx !== wrapIdx) continue;

        if (s.mode === 'first') {
            var access = qs(SEL.access, targetWrap);
            if (access && !access.contains(el)) {
            foundStepIdx = i;
            break;
            }
        } else if (s.mode === 'second') {
            var access2 = qs(SEL.access, targetWrap);
            if (access2 && access2.contains(el)) {
            foundStepIdx = i;
            break;
            }
        } else {
            foundStepIdx = i;
            break;
        }
        }

        if (foundStepIdx !== -1) {
        var step = steps[foundStepIdx];

        var relativeTop = el.offsetTop - step.baseShift;
        if (relativeTop < 0) relativeTop = 0;

        foundPageIdx = Math.floor(relativeTop / avail);

        current = foundStepIdx;
        step.pageIndex = foundPageIdx;
        clampPageIndex(step);

        lockSyncOnce();
        applyVisibility();
        updateFloatingButtons();
        }
    }

    function bindLowPostureSwipe(){
        var sc = getScrollContainer();
        if (!sc) return;

        function tryPrev(){
        if (navLocked) return;
        lockNav();
        goPrev();
        }
        function tryNext(){
        if (navLocked) return;
        lockNav();
        goNext();
        }

        sc.addEventListener('touchstart', function(e){
        if (!isLowPosture) return;
        if (!e.touches || e.touches.length !== 1) return;

        var t = e.touches[0];
        swipe.active = true;
        swipe.locked = false;
        swipe.startX = t.clientX;
        swipe.startY = t.clientY;
        }, { passive: true });

        sc.addEventListener('touchmove', function(e){
        if (!isLowPosture) return;
        if (!swipe.active || swipe.locked) return;
        if (!e.touches || e.touches.length !== 1) return;

        var t = e.touches[0];
        var dx = t.clientX - swipe.startX;
        var dy = t.clientY - swipe.startY;

        if (Math.abs(dy) < Math.abs(dx) + SWIPE_AXIS_LOCK) return;

        if (Math.abs(dy) >= SWIPE_THRESHOLD){
            e.preventDefault();
            swipe.locked = true;
            (dy > 0) ? tryPrev() : tryNext();
        }
        }, { passive: false });

        sc.addEventListener('touchend', function(){
        swipe.active = false;
        swipe.locked = false;
        }, { passive: true });

        sc.addEventListener('touchcancel', function(){
        swipe.active = false;
        swipe.locked = false;
        }, { passive: true });

        sc.addEventListener('pointerdown', function(e){
        if (!isLowPosture) return;

        swipe.active = true;
        swipe.locked = false;
        swipe.startX = e.clientX;
        swipe.startY = e.clientY;

        if (sc.setPointerCapture){
            try { sc.setPointerCapture(e.pointerId); } catch(err){}
        }
        }, { passive: true });

        sc.addEventListener('pointermove', function(e){
        if (!isLowPosture) return;
        if (!swipe.active || swipe.locked) return;

        var dx = e.clientX - swipe.startX;
        var dy = e.clientY - swipe.startY;

        if (Math.abs(dy) < Math.abs(dx) + SWIPE_AXIS_LOCK) return;

        if (Math.abs(dy) >= SWIPE_THRESHOLD){
            e.preventDefault();
            swipe.locked = true;
            (dy > 0) ? tryPrev() : tryNext();
        }
        }, { passive: false });

        sc.addEventListener('pointerup', function(){
        swipe.active = false;
        swipe.locked = false;
        }, { passive: true });

        sc.addEventListener('pointercancel', function(){
        swipe.active = false;
        swipe.locked = false;
        }, { passive: true });

        var wheelAcc = 0;
        var WHEEL_THRESHOLD = 80;

        function handleWheel(e){
        if (!isLowPosture) return;

        var a = document.activeElement;
        if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;

        e.preventDefault();
        wheelAcc += e.deltaY;

        if (wheelAcc > WHEEL_THRESHOLD){
            wheelAcc = 0;
            tryNext();
        } else if (wheelAcc < -WHEEL_THRESHOLD){
            wheelAcc = 0;
            tryPrev();
        }
        }

        sc.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('wheel', function(e){
        if (sc && sc.contains(e.target)) return;
        handleWheel(e);
        }, { passive: false });
    }

    function primeClasses(){
        qsa(SEL.wraps).forEach(function(w){
        addClass(w, 'is-hidden');
        removeClass(w, 'is-active');
        w.style.transform = '';
        });
    }

    var resizeTimer = null;
    function onResize(){
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function(){
        if (isLowPosture){
            buildSteps();
            applyVisibility();
            updateFloatingButtons();
            syncToFocusedEl(document.activeElement);
        } else {
            updateFloatingButtons();
        }
        }, 150);
    }

    function onScroll(){
        if (isLowPosture) return;
        updateFloatingButtons();
    }

    function bindHoldEvents(btn, dir){
        if (!btn) return;

        btn.addEventListener('mousedown', function(e){
        if (isLowPosture) return;
        e.preventDefault();
        startHoldScroll(dir);
        });
        btn.addEventListener('mouseup', function(){
        if (isLowPosture) return;
        stopHoldScroll();
        });
        btn.addEventListener('mouseleave', function(){
        if (isLowPosture) return;
        stopHoldScroll();
        });

        btn.addEventListener('touchstart', function(e){
        if (isLowPosture) return;
        e.preventDefault();
        startHoldScroll(dir);
        }, { passive: false });

        btn.addEventListener('touchend', function(){
        if (isLowPosture) return;
        stopHoldScroll();
        });
        btn.addEventListener('touchcancel', function(){
        if (isLowPosture) return;
        stopHoldScroll();
        });

        btn.addEventListener('blur', function(){
        if (isLowPosture) return;
        stopHoldScroll();
        });
    }

    function bindEvents(){
        var prevBtn = qs(SEL.prevBtn);
        var nextBtn = qs(SEL.nextBtn);

        if (prevBtn) prevBtn.addEventListener('click', function(){
        if (!isLowPosture) return;
        goPrev();
        });
        if (nextBtn) nextBtn.addEventListener('click', function(){
        if (!isLowPosture) return;
        goNext();
        });

        if (isLowPosture) bindLowPostureSwipe();

        bindHoldEvents(prevBtn, -1);
        bindHoldEvents(nextBtn,  1);

        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);

        var sc = getScrollContainer();
        if (sc) sc.addEventListener('scroll', onScroll, { passive: true });

        document.addEventListener('visibilitychange', function(){
        if (document.hidden) stopHoldScroll();
        });

        // 저자세: 포커스가 들어오는 순간 "그 포커스가 보이게" 화면 맞춤
        document.addEventListener('focusin', function(e){
        if (!isLowPosture) return;
        if (SYNC_LOCK) return;

        var el = e.target;
        if (!el) return;

        if (el.getAttribute && el.getAttribute('role') === 'option') return;
        if (el.closest && (el.closest('.filter-list-wrap') || el.closest('.custom-select'))) return;

        syncToFocusedEl(el);
        }, true);

        // ======================================================
        // 저자세 모드: sec-wrap 내부 Tab 흐름 (완전 단일 로직)
        // - "첫번째 sec-wrap 직전 요소"에서 Tab 하면 → 무조건 1번째 sec-wrap 첫 포커스
        // - sec-wrap 내부는 기존 로직 그대로
        // ======================================================
        function getDetailTitleEl(){
    // 네 HTML 기준: <div class="detail-title"><h3 tabindex="0">...</h3></div>
    return document.querySelector('.detail-page .detail-title h3[tabindex="0"]');
    }

    document.addEventListener('keydown', function(e){
    if (!isLowPosture) return;
    if (e.key !== 'Tab') return;

    if (document.querySelector('.modal[aria-hidden="false"]')) return;

    var a = document.activeElement;
    if (!a) return;

    // 컴포넌트별 예외
    if (a.getAttribute && a.getAttribute('role') === 'option') return;
    if (a.closest && a.closest('.filter-list-wrap')) return;
    if (a.closest && a.closest('.custom-select')) return;

    // ======================================================
    // ✅[BRIDGE-1] h3(노들섬)에서 Tab → 무조건 1번째 sec-wrap 첫 포커스
    // ======================================================
    var titleEl = getDetailTitleEl();
    if (!e.shiftKey && titleEl && a === titleEl) {
        e.preventDefault();
        e.stopImmediatePropagation();
        jumpToFirstWrapFocus();
        return;
    }

    var sc = qs(SEL.scrollSec);
    if (!sc) return;

    // 현재 step 기준 wrap(정확)
    var activeWrap = getWrapByStep();
    if (!activeWrap) return;

    if (!sc.contains(a)) return;
    if (!activeWrap.contains(a)) return;

    var allNodes = getAllFocusableInWrap(activeWrap);
    if (!allNodes.length) return;

    var idxAll = allNodes.indexOf(a);
    if (idxAll === -1) {
        e.preventDefault();
        e.stopImmediatePropagation();
        focusSafe(e.shiftKey ? allNodes[allNodes.length - 1] : allNodes[0]);
        return;
    }

    var isBackward = !!e.shiftKey;

    // ======================================================
    // ✅[BRIDGE-2] 1번째 sec-wrap "첫 요소"에서 Shift+Tab → 무조건 h3(노들섬)
    // - 전체 DOM prev 탐색(getPrevFocusableFrom) 타지 않게 고정
    // ======================================================
    if (isBackward && idxAll === 0) {
        var s0 = steps[current];
        var isFirstStep = (current === 0);
        var isFirstPage = (s0 && s0.pageIndex === 0);

        if (isFirstStep && isFirstPage && titleEl && isVisible(titleEl)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        focusSafe(titleEl);
        return;
        }
    }

    // 다음/이전 대상
    var target = isBackward ? allNodes[idxAll - 1] : allNodes[idxAll + 1];

    e.preventDefault();
    e.stopImmediatePropagation();

    // 1) 같은 wrap 안에서 이동 가능하면 바로 이동
    if (target) {
        focusSafe(target);
        return;
    }

    // 2) wrap 끝/처음 → step/page 이동 or 바깥으로 탈출
    var s = steps[current];
    if (!s) return;

    var isFirstStep2 = (current === 0);
    var isLastStep  = (current === steps.length - 1);

    var isFirstPage2 = (s.pageIndex === 0);
    var isLastPage  = (s.pageIndex === getMaxPageIndex(s));

    if (!isBackward) {
        if (isLastStep && isLastPage) {
        var outNext = getNextFocusableFrom(a);
        if (outNext) { focusSafe(outNext); return; }

        var footerVol = document.querySelector('footer.footer .volume-control-btn');
        if (footerVol) focusSafe(footerVol);
        return;
        }

        goNext();
        requestAnimationFrame(function(){
        focusWrapEdge(false);
        });
        return;
    }

    if (isFirstStep2 && isFirstPage2) {
        var outPrev = getPrevFocusableFrom(a);
        if (outPrev) { focusSafe(outPrev); return; }

        var header = document.querySelector('header');
        if (header) {
        var hs = Array.prototype.slice.call(header.querySelectorAll(SEL.focusable)).filter(function(el){
            return isVisible(el) && !(el.closest && el.closest('[aria-hidden="true"]')) && !(el.closest && el.closest('[hidden]'));
        });
        if (hs.length) focusSafe(hs[hs.length - 1]);
        }
        return;
    }

    goPrev();
    requestAnimationFrame(function(){
        focusWrapEdge(true);
    });
    return;

    }, true);

    }

    function init(){
        isLowPosture = !!qs(SEL.rootLow);

        if (isLowPosture){
        primeClasses();
        buildSteps();
        applyVisibility();
        updateFloatingButtons();
        bindEvents();
        return;
        }

        updateFloatingButtons();
        bindEvents();
    }

    if (document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();