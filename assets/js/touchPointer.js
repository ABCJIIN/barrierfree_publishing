;(function () {
    'use strict';

    if (window.__touchPointerInited) return;
    window.__touchPointerInited = true;

    // 0.3초 유지
    var HIDE_DELAY = 300;

    var pointerEl = null;
    var hideTimer = null;

    // 멀티터치: 마지막 down만 추적
    var activePointerId = null;

    // move 이벤트 과다 호출 방지(선택)
    var rafId = 0;
    var lastX = 0, lastY = 0;

    // 스크롤 중 표시 방지
    var isScrolling = false;
    var scrollTimer = null;
    var SCROLL_COOLDOWN = 120; // 스크롤 멈춘 뒤 허용까지 딜레이(관성 스크롤 대응)

    function hideNow() {
        if (!pointerEl) return;
        pointerEl.classList.remove('is-show');
    }

    function getZoomState() {
        var viewport = document.querySelector('.zoom-viewport');
        var canvas   = document.querySelector('.zoom-canvas');
        var moveWrap = document.querySelector('.zoom-move-wrap') || viewport;
        var isZoomed = !!(viewport && viewport.classList.contains('is-active'));
        return { isZoomed: isZoomed, viewport: viewport, canvas: canvas, moveWrap: moveWrap };
    }

    function getZoomMath() {
        var z = window.__ZOOM_STATE__;
        return {
            scale: (z && z.scale) || 2,
            posX:  (z && z.posX)  || 0,
            posY:  (z && z.posY)  || 0
        };
    }

    function ensureEl(parentEl) {
        if (pointerEl) {
            if (parentEl && pointerEl.parentElement !== parentEl) parentEl.appendChild(pointerEl);
            return pointerEl;
        }

        pointerEl = document.querySelector('.touch-pointer');
        if (!pointerEl) {
            pointerEl = document.createElement('div');
            pointerEl.className = 'touch-pointer';
            pointerEl.setAttribute('aria-hidden', 'true');
        }

        (parentEl || document.body).appendChild(pointerEl);
        hideNow();
        return pointerEl;
    }

    function scheduleHide() {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(hideNow, HIDE_DELAY);
    }

    // showAt는 스크롤 중엔 무시
    function showAt(clientX, clientY) {
        if (isScrolling) return;

        // 안전장치: 좌표가 비정상일 때(0,0 튐) 방지
        if (clientX == null || clientY == null) return;
        if (clientX === 0 && clientY === 0) return;

        var z = getZoomState();
        var el, left, top;

        // 줌 ON이면: 포인터를 zoom-canvas 안으로 넣어야 크기가 같이 커짐
        if (z.isZoomed && z.canvas && z.moveWrap) {
            el = ensureEl(z.canvas);

            var rect = z.moveWrap.getBoundingClientRect();
            var m = getZoomMath();

            // moveWrap 기준 좌표
            var localX = clientX - rect.left;
            var localY = clientY - rect.top;

            // 캔버스 좌표(스케일 역보정 + 현재 패닝(pos) 반영)
            left = (localX + m.posX) / m.scale;
            top  = (localY + m.posY) / m.scale;

            el.style.left = left + 'px';
            el.style.top  = top + 'px';
        } else {
            // 줌 OFF: viewport 있으면 그 안(absolute), 없으면 body(fixed)
            var container = z.viewport || document.body;
            el = ensureEl(container);

            if (container !== document.body) {
                var r = container.getBoundingClientRect();
                el.style.left = (clientX - r.left) + 'px';
                el.style.top  = (clientY - r.top) + 'px';
            } else {
                el.style.position = 'fixed';
                el.style.left = clientX + 'px';
                el.style.top  = clientY + 'px';
            }
        }

        el.classList.add('is-show');
        scheduleHide();
    }

    function onDown(e) {
        if (isScrolling) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        activePointerId = e.pointerId; // 마지막 손가락 우선
        showAt(e.clientX, e.clientY);
    }

    function onMove(e) {
        // 마지막 down 포인터만 추적
        if (isScrolling) return;
        if (activePointerId != null && e.pointerId !== activePointerId) return;

        var isDraggingMouse = (e.pointerType === 'mouse' && e.buttons === 1);
        var isTouchLike = (e.pointerType === 'touch' || e.pointerType === 'pen');
        if (!isDraggingMouse && !isTouchLike) return;

        lastX = e.clientX;
        lastY = e.clientY;

        if (rafId) return;
        rafId = requestAnimationFrame(function () {
            rafId = 0;
            showAt(lastX, lastY);
        });
    }

    function onUpOrCancel(e) {
        if (activePointerId != null && e.pointerId !== activePointerId) return;
        showAt(e.clientX, e.clientY);
        activePointerId = null;
    }

    function cleanupOnLeave() {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = null;
        hideNow();
        activePointerId = null;
    }

    // 스크롤 핸들러: 스크롤 중 숨김 + 표시 차단
    function onScroll() {
        isScrolling = true;
        hideNow();

        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(function () {
            isScrolling = false;
        }, SCROLL_COOLDOWN);
    }

    function init() {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', init, { once: true });
            return;
        }

        // 초기엔 viewport(없으면 body)에 붙여둠
        var z = getZoomState();
        ensureEl(z.viewport || document.body);

        document.addEventListener('pointerdown', onDown, { passive: true });
        document.addEventListener('pointermove', onMove, { passive: true });
        document.addEventListener('pointerup', onUpOrCancel, { passive: true });
        document.addEventListener('pointercancel', onUpOrCancel, { passive: true });

        window.addEventListener('pagehide', cleanupOnLeave);
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) cleanupOnLeave();
        });

        // capture:true로 스크롤 이벤트 최대한 빨리 감지
        window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    }

    init();
})();