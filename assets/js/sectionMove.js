// 서브페이지에서 이전/다음 버튼으로 섹션을 페이징 이동
// - 낮은자세 모드(html.mode-low-posture)에서만 동작
// - 각 sec-wrap을 step으로 보고, 세 번째 랩은 내부 섹션(first/second)로 분리 + 페이지네이션
// - 섹션 높이가 화면보다 약간만 넘치는 미세 넘침은 페이지로 취급하지 않음
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

    // steps: [{wrapIdx, mode, baseShift, height, pageIndex}]
    var steps = [];
    var current = 0;
    var isLowPosture = false;

    // 페이징 경계 완화(ε): 이 값 이하의 초과는 페이지가 없는 것으로 처리
    var PAGE_EPSILON = 55;

    // 3번째 랩의 second(=access) 첫 페이지 진입 시 살짝 더 보여주기 위한 오버슈트(px)
    var LAST_SECTION_OVERSHOOT = 72;

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
    // 호출 시 임시로 보이게 만들고, 반환된 cleanup()을 호출하면 원복
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

    // 현재 화면에서 유효한 페이징 높이 반환
    // - 낮은자세 모드에서는 scroll-sec의 패딩을 제외한 실 내용 영역을 사용
    // - 일반 모드에서는 패딩 포함(clientHeight)
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
    * Measurement (3번째 랩)
    * ============================== */
    // 3번째 랩의 전체 높이, second 섹션의 시작점(shiftY), 두 섹션이 한 화면에 모두 들어오는지 여부
    function measureThirdWrap(){
        var third = qs(SEL.thirdWrap);
        if (!third) return { totalH: 0, shiftY: 0, fitsBoth: true };

        var cleanup = ensureMeasureVisible(third);
        var totalH  = third.scrollHeight;
        var avail   = getAvailHeight();

        var inner  = qs(SEL.inner, third);
        var access = qs(SEL.access, third);

        // second 섹션을 랩 상단에 붙일 때 필요한 이동량(= first 높이)
        var shiftY = 0;
        if (inner && access){
            shiftY = Math.max(0, access.offsetTop - (inner.offsetTop || 0));
        }

        var fitsBoth = totalH <= avail;
        cleanup();
        return { totalH: totalH, shiftY: shiftY, fitsBoth: fitsBoth };
    }

    /* ==============================
    * Steps & Pagination
    * ============================== */
    // 전체 스텝 구성: 기본은 랩 단위 1스텝, 3번째 랩은 first/second로 분리 가능
    function buildSteps(){
        steps = [];
        var wraps = qsa(SEL.wraps);

        wraps.forEach(function(wrap, idx){
            var cleanup = ensureMeasureVisible(wrap);
            var totalH = wrap.scrollHeight;
            cleanup();

            // 기본: 하나의 스텝(all) + 내부 페이지네이션
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

            // 3번째 랩: 필요 시 first/second로 분리하고 각자 페이지네이션 부여
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
                // first 영역
                steps.push({
                    wrapIdx: idx,
                    mode: 'first',
                    baseShift: 0,
                    height: Math.max(0, m.shiftY),
                    pageIndex: 0
                });
                // second 영역 (access)
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

    // 해당 step에서 가능한 최댓 페이지 인덱스 계산(0-based)
    function getMaxPageIndex(step){
        var avail = getAvailHeight();
        if (!step || !avail) return 0;

        var overflow = step.height - avail;

        // 미세 넘침(ε) 이하는 페이지 없음
        if (overflow <= PAGE_EPSILON) return 0;

        // ε만큼 여유를 두고 계산 (ceil 후 0부터 시작이므로 -1)
        return Math.max(0, Math.ceil((step.height - PAGE_EPSILON) / avail) - 1);
    }

    // 현재 step의 pageIndex를 유효 범위로 보정
    function clampPageIndex(step){
        if (!step) return;
        var maxIdx = getMaxPageIndex(step);
        if (step.pageIndex > maxIdx) step.pageIndex = maxIdx;
        if (step.pageIndex < 0) step.pageIndex = 0;
    }

    /* ==============================
    * Render (visibility & transform)
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

        // 기본 이동량: baseShift + 페이지 * 화면높이
        var rawShift = s.baseShift + (s.pageIndex * avail);

        // 마지막 페이지에서 끝이 똑 떨어지도록 초과 이동 상한 계산
        var overflow = s.height - avail;
        var effectiveOverflow = (overflow > PAGE_EPSILON) ? overflow : 0;
        var maxShift = Math.max(0, s.baseShift + effectiveOverflow);

        // 3번째 랩 second의 첫 페이지에 한해 살짝 더 보여주기(overshoot)
        var isLastStep = (current === steps.length - 1);
        var isAccessFirstPage = (s.mode === 'second' && s.pageIndex === 0);
        if (isLastStep && isAccessFirstPage) {
            rawShift += LAST_SECTION_OVERSHOOT;
            maxShift += LAST_SECTION_OVERSHOOT; // 상한에도 동일하게 반영
        }

        var shift = Math.min(rawShift, maxShift);
        target.style.transform = 'translateY(-' + shift + 'px)';
    }

    /* ==============================
    * Floating Buttons (prev/next)
    * ============================== */
    function updateFloatingButtons(){
        var prevWrap = qs(SEL.prevWrap);
        var nextWrap = qs(SEL.nextWrap);
        var prevBtn  = qs(SEL.prevBtn);
        var nextBtn  = qs(SEL.nextBtn);

        // 현재 포커스가 어디에 있는지 체크
        var activeEl = document.activeElement;
        var prevHadFocus = prevBtn && (activeEl === prevBtn || prevBtn.contains(activeEl));
        var nextHadFocus = nextBtn && (activeEl === nextBtn || nextBtn.contains(activeEl));

        // 첫 페이지 여부: 첫 스텝 & pageIndex 0
        var atFirst = (current === 0 && steps[0] && steps[0].pageIndex === 0);

        // 마지막 페이지 여부: 마지막 스텝 & 해당 스텝의 pageIndex가 max
        var lastStep = steps[steps.length - 1];
        var atLast = false;
        if (lastStep){
            atLast = (current === steps.length - 1) && (lastStep.pageIndex === getMaxPageIndex(lastStep));
        }

        if (prevWrap) prevWrap.style.display = atFirst ? 'none' : '';
        if (nextWrap) nextWrap.style.display = atLast  ? 'none' : '';

        // 보여지는 상태 다시 계산
        var prevVisible = prevWrap ? (prevWrap.style.display !== 'none') : false;
        var nextVisible = nextWrap ? (nextWrap.style.display !== 'none') : false;

        // 🔴 포커스를 갖고 있던 버튼이 사라졌다면 → 남아 있는 버튼으로 포커스 이동
        if (!prevVisible && prevHadFocus && nextVisible && nextBtn){
            nextBtn.focus();
        } else if (!nextVisible && nextHadFocus && prevVisible && prevBtn){
            prevBtn.focus();
        }

        // 보더 정리(예: 이전만 보일 때 오른쪽 보더 제거 등)
        if (prevWrap){
            if (prevVisible && !nextVisible) addClass(prevWrap, 'no-bd');
            else removeClass(prevWrap, 'no-bd');
        }
    }

    /* ==============================
    * Navigation
    * ============================== */
    function goPrev(){
        var s = steps[current];
        if (!s) return;

        // 같은 스텝 내에서 이전 페이지
        if (s.pageIndex > 0){
            s.pageIndex--;
            applyVisibility();
            updateFloatingButtons();
            return;
        }

        // 이전 스텝의 마지막 페이지로
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
        var s = steps[current];
        if (!s) return;

        var maxIdx = getMaxPageIndex(s);

        // 같은 스텝 내에서 다음 페이지
        if (s.pageIndex < maxIdx){
            s.pageIndex++;
            applyVisibility();
            updateFloatingButtons();
            return;
        }

        // 다음 스텝의 첫 페이지로
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
    // 초기 가림/상태 리셋
    function primeClasses(){
        qsa(SEL.wraps).forEach(function(w){
            addClass(w, 'is-hidden');
            removeClass(w, 'is-active');
            w.style.transform = '';
        });
    }

    var resizeTimer = null;
    // 리사이즈/회전 시, 기존 step 내 비율(pageIndex/max)을 유지하여 자연스럽게 복원
    function onResize(){
        if (!isLowPosture) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function(){
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
        }, 150);
    }

    function bindEvents(){
        var prevBtn = qs(SEL.prevBtn);
        var nextBtn = qs(SEL.nextBtn);
        if (prevBtn) prevBtn.addEventListener('click', goPrev);
        if (nextBtn) nextBtn.addEventListener('click', goNext);

        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);
    }

    function init(){
        isLowPosture = !!qs(SEL.rootLow);
        if (!isLowPosture) return; // 낮은자세 모드에서만 동작

        primeClasses();
        buildSteps();
        applyVisibility();
        updateFloatingButtons();
        bindEvents();
    }

    if (document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();