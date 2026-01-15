// 서브페이지에서 이전/다음 버튼으로 섹션/스크롤 이동
// - 낮은자세 모드(html.mode-low-posture) : 기존 섹션/페이지 이동 로직 유지
// - 일반/고대비 모드 : scroll-sec 영역을 위/아래로 스크롤 이동
;(function () {
    'use strict';

    /* ==============================
    * Selectors & Constants
    * ============================== */
    var SEL = {
        rootLow: 'html.mode-low-posture',
        scrollSec: '.detail-page .scroll-sec',
        wraps: '.detail-page .scroll-sec .sec-wrap',
        inner: '.sec-wrap .sec-inner',

        // 3번째 sec-wrap 내부 섹션
        thirdWrap: '.detail-page .scroll-sec .sec-wrap:nth-of-type(3)',
        access: '.detail-page .scroll-sec .sec-wrap:nth-of-type(3) .access-sec',

        // 플로팅 버튼
        prevWrap: '.floating-btn .btn-wrap.prev',
        nextWrap: '.floating-btn .btn-wrap.next',
        prevBtn:  '.floating-btn .sec-move-btn.prev',
        nextBtn:  '.floating-btn .sec-move-btn.next'
    };

    // 저자세 steps: [{wrapIdx, mode, baseShift, height, pageIndex}]
    var steps = [];
    var current = 0;
    var isLowPosture = false;

    // 페이징 경계 완화(ε): 이 값 이하의 초과는 페이지가 없는 것으로 처리
    var PAGE_EPSILON = 55;

    // 3번째 랩의 second(=access) 첫 페이지 진입 시 살짝 더 보여주기 위한 오버슈트(px)
    var LAST_SECTION_OVERSHOOT = 72;

    // 일반/고대비 모드에서 버튼 노출 판정 여유(px)
    var SCROLL_EDGE_EPSILON = 2;

    // 일반/고대비 롱프레스 스크롤 속도/주기
    var HOLD_SCROLL_SPEED = 16;   // 한번에 움직이는 px (속도)
    var HOLD_SCROLL_INTERVAL = 16; // ms (대략 60fps)
    var holdTimer = null;
    var holdDir = 0;

    /* ==============================
    * Utils
    * ============================== */
    function qs(sel, ctx){ return (ctx || document).querySelector(sel); }
    function qsa(sel, ctx){ return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
    function addClass(el, c){ if (el && !el.classList.contains(c)) el.classList.add(c); }
    function removeClass(el, c){ if (el && el.classList.contains(c)) el.classList.remove(c); }

    function getNumericPx(el, prop){
        var cs = window.getComputedStyle(el);
        var v = parseFloat(cs.getPropertyValue(prop)) || 0;
        return v;
    }

    // display:none 또는 .is-hidden 상태에서도 치수 측정을 가능하게 만드는 헬퍼
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

    /* ==============================
    * Height helpers
    * ============================== */
    // 저자세에서만 "패딩 제외한" 실제 컨텐츠 높이를 페이징 기준으로 사용
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

    /* ==============================
    * Measurement (3번째 랩 - 저자세용)
    * ============================== */
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

    /* ==============================
    * Steps & Pagination (저자세용)
    * ============================== */
    function buildSteps(){
        steps = [];
        var wraps = qsa(SEL.wraps);

        wraps.forEach(function(wrap, idx){
            var cleanup = ensureMeasureVisible(wrap);
            var totalH = wrap.scrollHeight;
            cleanup();

            if (idx !== 2){
                steps.push({
                    wrapIdx: idx,
                    mode: 'all',
                    baseShift: 0,
                    height: totalH,
                    pageIndex: 0
                });
                return;
            }

            var m = measureThirdWrap();
            if (m.fitsBoth){
                steps.push({
                    wrapIdx: idx,
                    mode: 'all',
                    baseShift: 0,
                    height: m.totalH,
                    pageIndex: 0
                });
            } else {
                steps.push({
                    wrapIdx: idx,
                    mode: 'first',
                    baseShift: 0,
                    height: Math.max(0, m.shiftY),
                    pageIndex: 0
                });
                steps.push({
                    wrapIdx: idx,
                    mode: 'second',
                    baseShift: Math.max(0, m.shiftY),
                    height: Math.max(0, m.totalH - m.shiftY),
                    pageIndex: 0
                });
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

    /* ==============================
    * Render (저자세용: visibility & transform)
    * ============================== */
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

    /* ==============================
    * 일반/고대비 모드: Scroll Move
    * ============================== */
    function getScrollContainer(){
        // 스크롤이 실제로 걸리는 컨테이너가 scroll-sec라면 이게 맞고,
        // 만약 페이지 전체(window)가 스크롤이면 아래 로직에서 window로 대체 가능.
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

        // 이미 돌고 있으면 방향만 갱신
        if (holdTimer) return;

        holdTimer = setInterval(function(){
            if (!sc) return;

            // 한 프레임당 조금씩 이동
            sc.scrollTop = sc.scrollTop + (holdDir * HOLD_SCROLL_SPEED);

            // 버튼 숨김/노출 즉시 반영
            updateFloatingButtons();

            // 끝까지 닿으면 자동 정지 (불필요한 루프 방지)
            if (isAtTop(sc) && holdDir < 0) stopHoldScroll();
            if (isAtBottom(sc) && holdDir > 0) stopHoldScroll();
        }, HOLD_SCROLL_INTERVAL);
    }

    function isAtTop(sc){
        return (sc.scrollTop <= SCROLL_EDGE_EPSILON);
    }

    function isAtBottom(sc){
        // scrollTop + clientHeight 가 scrollHeight에 거의 닿으면 바닥
        return (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - SCROLL_EDGE_EPSILON);
    }

    /* ==============================
    * Floating Buttons (공통)
    * ============================== */
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
            // 저자세: 기존 규칙 유지
            atFirst = (current === 0 && steps[0] && steps[0].pageIndex === 0);

            var lastStep = steps[steps.length - 1];
            if (lastStep){
                atLast = (current === steps.length - 1) && (lastStep.pageIndex === getMaxPageIndex(lastStep));
            } else {
                atLast = true;
            }
        } else {
            // 일반/고대비: 스크롤 위치 기준
            var sc = getScrollContainer();
            if (sc){
                atFirst = isAtTop(sc);
                atLast  = isAtBottom(sc);
            } else {
                // 컨테이너가 없다면 둘 다 false로 두고 버튼은 일단 노출
                atFirst = false;
                atLast  = false;
            }
        }

        if (prevWrap) prevWrap.style.display = atFirst ? 'none' : '';
        if (nextWrap) nextWrap.style.display = atLast  ? 'none' : '';

        var prevVisible = prevWrap ? (prevWrap.style.display !== 'none') : false;
        var nextVisible = nextWrap ? (nextWrap.style.display !== 'none') : false;

        // 포커스 이동(버튼이 사라졌을 때)
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

    /* ==============================
    * Navigation
    * ============================== */
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

    /* ==============================
    * Init & Events
    * ============================== */
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
                // 저자세: 기존 복원 로직
                var prev = steps[current] || null;
                var prevKey = prev ? (prev.wrapIdx + ':' + prev.mode) : null;
                var prevRatio = 0;

                if (prev){
                    var maxBefore = Math.max(1, getMaxPageIndex(prev));
                    prevRatio = maxBefore ? (prev.pageIndex / maxBefore) : 0;
                }

                buildSteps();

                if (prevKey){
                    var idx = steps.findIndex(function(s){ return (s.wrapIdx + ':' + s.mode) === prevKey; });
                    if (idx >= 0){
                        current = idx;
                        var nowMax = Math.max(1, getMaxPageIndex(steps[current]));
                        steps[current].pageIndex = Math.round(prevRatio * nowMax);
                        clampPageIndex(steps[current]);
                    } else {
                        current = Math.min(current, steps.length - 1);
                    }
                }

                applyVisibility();
                updateFloatingButtons();
            } else {
                // 일반/고대비: 스크롤 기반이므로 버튼만 재계산
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

        // 마우스
        btn.addEventListener('mousedown', function(e){
            if (isLowPosture) return; // 저자세는 기존 click 방식
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

        // 터치 (키오스크/모바일)
        btn.addEventListener('touchstart', function(e){
            if (isLowPosture) return;
            e.preventDefault(); // 길게 누를 때 스크롤/클릭 중복 방지
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

        // 포커스가 빠져도 정지 (접근성/안전)
        btn.addEventListener('blur', function(){
            if (isLowPosture) return;
            stopHoldScroll();
        });
    }

    function bindEvents(){
        var prevBtn = qs(SEL.prevBtn);
        var nextBtn = qs(SEL.nextBtn);

        // ✅ 저자세: 기존 click 이동
        if (prevBtn) prevBtn.addEventListener('click', function(e){
            if (!isLowPosture) return;
            goPrev();
        });
        if (nextBtn) nextBtn.addEventListener('click', function(e){
            if (!isLowPosture) return;
            goNext();
        });

        // ✅ 일반/고대비: 롱프레스 연속 스크롤
        bindHoldEvents(prevBtn, -1);
        bindHoldEvents(nextBtn,  1);

        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);

        var sc = getScrollContainer();
        if (sc) sc.addEventListener('scroll', onScroll, { passive: true });

        // 안전장치: 화면 전환/탭 이동 시 정지
        document.addEventListener('visibilitychange', function(){
            if (document.hidden) stopHoldScroll();
        });
    }

    function init(){
        isLowPosture = !!qs(SEL.rootLow);

        if (isLowPosture){
            // 저자세: 기존 섹션 페이징 방식
            primeClasses();
            buildSteps();
            applyVisibility();
            updateFloatingButtons();
            bindEvents();
            return;
        }

        // 일반/고대비: 숨김/이동 로직을 건드리지 않고 스크롤만 제어
        // (wrap 숨김/transform은 하지 않음!)
        updateFloatingButtons();
        bindEvents();
    }

    if (document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();