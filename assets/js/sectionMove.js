// 서브페이지에서 이전/다음 버튼으로 섹션/스크롤 이동
// - 낮은자세 모드(html.mode-low-posture) : 섹션/페이지 페이징 + 스와이프/휠로 한 단계 이동
// - 일반/고대비 모드 : scroll-sec 영역을 위/아래로 스크롤 이동(롱프레스)
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

        thirdWrap: '.detail-page .scroll-sec .sec-wrap:nth-of-type(3)',
        access: '.detail-page .scroll-sec .sec-wrap:nth-of-type(3) .access-sec',

        prevWrap: '.floating-btn .btn-wrap.prev',
        nextWrap: '.floating-btn .btn-wrap.next',
        prevBtn:  '.floating-btn .sec-move-btn.prev',
        nextBtn:  '.floating-btn .sec-move-btn.next'
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

    // 저자세: 스와이프/드래그
    var SWIPE_THRESHOLD = 50;
    var SWIPE_AXIS_LOCK = 10;
    var swipe = { active:false, locked:false, startX:0, startY:0 };

    // 저자세: PC 휠/드래그 연속 이동 방지
    var NAV_COOLDOWN = 350;
    var navLocked = false;
    function lockNav(){
        navLocked = true;
        setTimeout(function(){ navLocked = false; }, NAV_COOLDOWN);
    }

    /* ==============================
    * Utils
    * ============================== */
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

    /* ==============================
    * Height helpers
    * ============================== */
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
                steps.push({ wrapIdx: idx, mode: 'all', baseShift: 0, height: totalH, pageIndex: 0 });
                return;
            }

            var m = measureThirdWrap();
            if (m.fitsBoth){
                steps.push({ wrapIdx: idx, mode: 'all', baseShift: 0, height: m.totalH, pageIndex: 0 });
            } else {
                steps.push({ wrapIdx: idx, mode: 'first',  baseShift: 0,               height: Math.max(0, m.shiftY),       pageIndex: 0 });
                steps.push({ wrapIdx: idx, mode: 'second', baseShift: Math.max(0, m.shiftY), height: Math.max(0, m.totalH - m.shiftY), pageIndex: 0 });
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
    * Render (저자세용)
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
            if (!sc) return;

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

    /* ==============================
    * Floating Buttons
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
    * Low posture swipe/wheel
    * ============================== */
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

        // Touch
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

        // Pointer (mouse 포함)
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

        // Wheel (스크롤 영역 위에서 휠)
        var wheelAcc = 0;
        var WHEEL_THRESHOLD = 80;

        function handleWheel(e){
            if (!isLowPosture) return;

            // input/textarea 등 입력중이면 휠 페이징 방해하지 않게 (안전)
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

        // 보조: sc 바깥에 마우스가 있어도 저자세면 휠을 페이징으로 (PC 테스트 안정화)
        window.addEventListener('wheel', function(e){
            // sc 내부에서 이미 처리된 경우 중복 방지(버블링 시)
            // target이 sc 내부면 sc handler가 먼저 동작하므로 여기선 무시
            if (sc && sc.contains(e.target)) return;
            handleWheel(e);
        }, { passive: false });
    }

    /* ==============================
    * Events
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

        // 저자세: click 이동
        if (prevBtn) prevBtn.addEventListener('click', function(){
            if (!isLowPosture) return;
            goPrev();
        });
        if (nextBtn) nextBtn.addEventListener('click', function(){
            if (!isLowPosture) return;
            goNext();
        });

        // 저자세: 스와이프/휠
        if (isLowPosture) bindLowPostureSwipe();

        // 일반/고대비: 롱프레스 연속 스크롤
        bindHoldEvents(prevBtn, -1);
        bindHoldEvents(nextBtn,  1);

        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);

        var sc = getScrollContainer();
        if (sc) sc.addEventListener('scroll', onScroll, { passive: true });

        document.addEventListener('visibilitychange', function(){
            if (document.hidden) stopHoldScroll();
        });
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
