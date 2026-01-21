// 돋보기 버튼 기능
function initZoom() {
    const viewport   = document.querySelector('.zoom-viewport');
    const moveWrap   = document.querySelector('.zoom-move-wrap');
    const canvas     = document.querySelector('.zoom-canvas');

    // 푸터의 '돋보기' 버튼
    const zoomBtn    = document.querySelector('.zoom-btn');
    const zoomLabel  = document.querySelector('.zoom-btn .btn-label');

    // 하단 컨트롤 바
    const controller = document.querySelector('.viewport-controller');

    // 새 구조 기준 버튼들
    const btnUp      = document.querySelector('.zoom-control.move-up');
    const btnDown    = document.querySelector('.zoom-control.move-down');
    const btnLeft    = document.querySelector('.zoom-control.move-left');
    const btnRight   = document.querySelector('.zoom-control.move-right');
    const zoomExitBtn = document.querySelector('.zoom-control.zoom-exit-btn');

    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    let lastSpokenDir = null;   // 마지막으로 말한 방향
    let lastInputSource = null; // 'button' | 'key'

    const DIR_SPEECH = {
        up: '위로 이동합니다.',
        down: '아래로 이동합니다.',
        left: '좌측으로 이동합니다.',
        right: '우측으로 이동합니다.'
    };

    function speakMoveIfNeeded(dir, source) {
        if (!document.documentElement.classList.contains('mode-voice')) return;
        if (lastSpokenDir === dir && lastInputSource === source) return;

        lastSpokenDir = dir;
        lastInputSource = source;

        if (window.TTS && typeof window.TTS.speak === 'function') {
            window.TTS.speak(DIR_SPEECH[dir]);
        }
    }

    // ====== 상태값 ======
    let isZoomed = false;
    const SCALE = 2; // 200%
    const LOW_POSTURE_HEIGHT = 733;  // 낮은자세 줌 모드시 moveWrap 높이

    let posX = 0;    // 현재 X 오프셋
    let posY = 0;    // 현재 Y 오프셋
    let maxX = 0;    // 이동 가능한 최대 X
    let maxY = 0;    // 이동 가능한 최대 Y

    // 버튼 꾹 눌렀을 때 이동 처리
    const SPEED = 900; // px/초
    let movingDir = { x: 0, y: 0 };
    let rafId = null;
    let lastTs = 0;

    // ====== 유틸 ======
    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

    function publishZoomState() {
        window.__ZOOM_STATE__ = window.__ZOOM_STATE__ || {};
        window.__ZOOM_STATE__.scale = SCALE;
        window.__ZOOM_STATE__.posX = posX;
        window.__ZOOM_STATE__.posY = posY;
        window.__ZOOM_STATE__.isZoomed = isZoomed;
    }

    const isLowPostureMode = () =>
        htmlEl.classList.contains('mode-low-posture') ||
        bodyEl.classList.contains('mode-low-posture');

    // 실제 transform 적용 (posX/posY 기반)
    // - posX/posY는 0~maxX, 0~maxY 범위
    // - 화면을 "우측/아래로 드래그"하면 콘텐츠는 반대로 움직여야 하므로 translate는 -pos
    const applyTransform = () => {
        if (!canvas) return;

        if (!isZoomed) {
            canvas.style.transform = '';
            return;
        }

        canvas.style.transform = `translate(${-posX}px, ${-posY}px) scale(${SCALE})`;
        publishZoomState();
    };

    const setDisabled = (btn, disabled) => {
        if (!btn) return;
        btn.classList.toggle('is-disable', disabled);
        btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    };

    const updateEdgeButtons = () => {
        setDisabled(btnUp,    posY <= 0);
        setDisabled(btnDown,  posY >= maxY);
        setDisabled(btnLeft,  posX <= 0);
        setDisabled(btnRight, posX >= maxX);
    };

    const startMove = (dx, dy) => {
        movingDir.x = dx;
        movingDir.y = dy;
        if (rafId) return;

        lastTs = 0;
        const step = (ts) => {
            if (!lastTs) lastTs = ts;
            const dt = (ts - lastTs) / 1000;
            lastTs = ts;

            if (movingDir.x !== 0 || movingDir.y !== 0) {
                posX = clamp(posX + movingDir.x * SPEED * dt, 0, maxX);
                posY = clamp(posY + movingDir.y * SPEED * dt, 0, maxY);

                applyTransform();
                updateEdgeButtons();
                rafId = requestAnimationFrame(step);
            } else {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        };
        rafId = requestAnimationFrame(step);
    };

    const stopMove = () => {
        movingDir.x = 0;
        movingDir.y = 0;
    };

    // 전역 stop
    document.addEventListener('mouseup', stopMove);
    document.addEventListener('touchend', stopMove);
    document.addEventListener('touchcancel', stopMove);

    const bindHoldMove = (el, dirX, dirY, dirName) => {
        if (!el) return;

        el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (!isZoomed) return;
            if (el.classList.contains('is-disable')) return;

            speakMoveIfNeeded(dirName, 'button');
            startMove(dirX, dirY);
        });

        el.addEventListener('mouseleave', stopMove);

        el.addEventListener('touchstart', (e) => {
            if (!isZoomed) return;
            if (el.classList.contains('is-disable')) return;
            if (e.cancelable) e.preventDefault();

            speakMoveIfNeeded(dirName, 'button');
            startMove(dirX, dirY);
        }, { passive: false });

        el.addEventListener('touchend', stopMove);
        el.addEventListener('touchcancel', stopMove);
    };

    const bindKeyMove = (el, dirX, dirY, dirName) => {
        if (!el) return;

        el.addEventListener('keydown', (e) => {
            if (!isZoomed) return;
            if (el.classList.contains('is-disable')) return;

            const isEnter = e.key === 'Enter';
            const isSpace = (e.key === ' ' || e.code === 'Space');

            if (isEnter || isSpace) {
                e.preventDefault();
                speakMoveIfNeeded(dirName, 'key');
                startMove(dirX, dirY);
            }
        });

        el.addEventListener('keyup', (e) => {
            const isEnter = e.key === 'Enter';
            const isSpace = (e.key === ' ' || e.code === 'Space');
            if (isEnter || isSpace) stopMove();
        });
    };

    bindHoldMove(btnUp,    0, -1, 'up');
    bindHoldMove(btnDown,  0,  1, 'down');
    bindHoldMove(btnLeft, -1,  0, 'left');
    bindHoldMove(btnRight, 1,  0, 'right');

    bindKeyMove(btnUp,    0, -1, 'up');
    bindKeyMove(btnDown,  0,  1, 'down');
    bindKeyMove(btnLeft, -1,  0, 'left');
    bindKeyMove(btnRight, 1,  0, 'right');

    // ====== 드래그(패닝) 이동 ======
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartPosX = 0;
    let dragStartPosY = 0;

    // "조금 움직이면 드래그 우선" (탭 보호용)
    const DRAG_THRESHOLD = 8; // 6~12 권장
    let didDrag = false;

    const stopMoveAndRaf = () => {
        stopMove();
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    };

    // 이벤트를 붙일 대상: moveWrap > viewport > canvas
    const dragTarget = moveWrap || viewport || canvas;

    const getPointFromPointer = (e) => ({ x: e.clientX, y: e.clientY });

    const getPointFromTouch = (e) => {
        if (e.touches && e.touches[0]) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        if (e.changedTouches && e.changedTouches[0]) {
            return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    };

    // 공통: 드래그 시작
    const startDragCommon = (x, y) => {
        stopMoveAndRaf();
        isDragging = true;
        didDrag = false;

        dragStartX = x;
        dragStartY = y;
        dragStartPosX = posX;
        dragStartPosY = posY;

        if (dragTarget) dragTarget.classList.add('is-dragging');
    };

    // 공통: 드래그 이동
    const moveDragCommon = (x, y) => {
        if (!isZoomed || !isDragging) return;

        const dx = x - dragStartX;
        const dy = y - dragStartY;

        if (!didDrag && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
            didDrag = true;
        }
        if (!didDrag) return;

        posX = clamp(dragStartPosX - dx, 0, maxX);
        posY = clamp(dragStartPosY - dy, 0, maxY);

        applyTransform();
        updateEdgeButtons();
    };

    // 공통: 드래그 종료
    const endDragCommon = () => {
        if (!isDragging) return;
        isDragging = false;

        if (dragTarget) dragTarget.classList.remove('is-dragging');

        // click 이벤트 순서 때문에 0ms 후 리셋
        setTimeout(() => {
            didDrag = false;
        }, 0);
    };

    if (dragTarget) {
        // 컨트롤러(하단 버튼바)에서 시작한 터치는 드래그 금지
        const isInController = (target) => !!(target && target.closest && target.closest('.viewport-controller'));

        // =========================
        // 1) Pointer Events (권장/안드 안정)
        // =========================
        if (window.PointerEvent) {
            dragTarget.addEventListener('pointerdown', (e) => {
                if (!isZoomed) return;
                if (isInController(e.target)) return;

                // 좌클릭/터치만
                if (e.button != null && e.button !== 0) return;

                // 여기서 preventDefault 해야 브라우저 제스처/스크롤 방지
                if (e.cancelable) e.preventDefault();

                // 버튼/링크 위에서 시작해도 move/up 계속 받기
                try { dragTarget.setPointerCapture(e.pointerId); } catch (_) {}

                const p = getPointFromPointer(e);
                startDragCommon(p.x, p.y);
            }, { passive: false });

            dragTarget.addEventListener('pointermove', (e) => {
                if (!isZoomed || !isDragging) return;
                if (e.cancelable) e.preventDefault();

                const p = getPointFromPointer(e);
                moveDragCommon(p.x, p.y);
            }, { passive: false });

            const onPointerEnd = (e) => {
                try { dragTarget.releasePointerCapture(e.pointerId); } catch (_) {}
                endDragCommon();
            };

            dragTarget.addEventListener('pointerup', onPointerEnd, { passive: true });
            dragTarget.addEventListener('pointercancel', onPointerEnd, { passive: true });

            // 드래그로 확정된 경우에만 click 막기 (버튼/링크 오동작 방지)
            dragTarget.addEventListener('click', (e) => {
                if (!didDrag) return;
                e.preventDefault();
                e.stopPropagation();
            }, true);
        }

        // =========================
        // 2) Fallback: Touch/Mouse
        // =========================
        else {
            dragTarget.addEventListener('mousedown', (e) => {
                if (!isZoomed) return;
                if (isInController(e.target)) return;

                e.preventDefault();
                startDragCommon(e.clientX, e.clientY);
            });

            window.addEventListener('mousemove', (e) => {
                if (!isZoomed || !isDragging) return;
                moveDragCommon(e.clientX, e.clientY);
            });

            window.addEventListener('mouseup', () => {
                endDragCommon();
            });

            dragTarget.addEventListener('touchstart', (e) => {
                if (!isZoomed) return;
                if (isInController(e.target)) return;

                if (e.cancelable) e.preventDefault();
                const p = getPointFromTouch(e);
                startDragCommon(p.x, p.y);
            }, { passive: false });

            window.addEventListener('touchmove', (e) => {
                if (!isZoomed || !isDragging) return;
                if (e.cancelable) e.preventDefault();

                const p = getPointFromTouch(e);
                moveDragCommon(p.x, p.y);
            }, { passive: false });

            window.addEventListener('touchend', () => {
                endDragCommon();
            });

            window.addEventListener('touchcancel', () => {
                endDragCommon();
            });

            dragTarget.addEventListener('click', (e) => {
                if (!didDrag) return;
                e.preventDefault();
                e.stopPropagation();
            }, true);
        }
    }

    // ====== 경계 재계산 ======
    const recalcBounds = () => {
        if (!canvas) return;

        const viewportBox = moveWrap || viewport;
        if (!viewportBox) return;

        const vpW = viewportBox.clientWidth;
        const vpH = viewportBox.clientHeight;

        // canvas.scrollWidth/Height는 padding 포함/레이아웃에 따라 오차가 날 수 있어서
        // 실제 크기 기준이 필요하면 getBoundingClientRect/offsetWidth로 바꿀 수도 있음
        const contentW = canvas.scrollWidth;
        const contentH = canvas.scrollHeight;

        const scaledW = contentW * (isZoomed ? SCALE : 1);
        const scaledH = contentH * (isZoomed ? SCALE : 1);

        maxX = Math.max(0, scaledW - vpW);
        maxY = Math.max(0, scaledH - vpH);

        posX = clamp(posX, 0, maxX);
        posY = clamp(posY, 0, maxY);

        applyTransform();
        updateEdgeButtons();
    };

    // 낮은자세 모드 + 줌 모드일 때만 733px 고정
    const syncMoveWrapSize = () => {
        if (!moveWrap) return;

        if (!isLowPostureMode()) {
            moveWrap.style.height = '';
            if (viewport) viewport.style.removeProperty('--lp-page-height');
            return;
        }

        if (isZoomed) {
            moveWrap.style.height = LOW_POSTURE_HEIGHT + 'px';
            return;
        }

        moveWrap.style.height = '';
        if (viewport) viewport.style.removeProperty('--lp-page-height');
    };

    const enableZoom = () => {
        if (!canvas || !viewport) return;

        const isActiveVoice = document.documentElement.classList.contains('mode-voice');
        if (isActiveVoice && window.TTS && typeof window.TTS.speak === 'function') {
            window.TTS.speak('돋보기가 켜졌습니다. 화면을 위, 아래, 왼쪽, 오른쪽으로 이동할 수 있습니다.');
        }

        isZoomed = true;

        if (zoomBtn) {
            zoomBtn.classList.add('close');
            zoomBtn.setAttribute('aria-pressed', 'true');
        }
        if (zoomLabel) zoomLabel.textContent = '돋보기 종료';

        viewport.classList.add('is-active');
        if (moveWrap) moveWrap.classList.add('is-active');
        if (controller) controller.classList.add('is-active');

        posX = 0;
        posY = 0;

        canvas.style.willChange = 'transform';

        // 모드별 padding-bottom
        const paddingBottom = isLowPostureMode() ? 50 : 100;
        canvas.style.paddingBottom = paddingBottom + 'px';

        syncMoveWrapSize();

        // 확대 상태에서 경계 계산
        recalcBounds();

        // 시작 지점을 "우하단"으로 이동
        posX = maxX;
        posY = maxY;

        applyTransform();
        updateEdgeButtons();
    };

    const disableZoom = () => {
        if (!canvas || !viewport) return;

        const isActiveVoice = document.documentElement.classList.contains('mode-voice');
        if (isActiveVoice && window.TTS && typeof window.TTS.speak === 'function') {
            window.TTS.speak('돋보기를 종료합니다.');
        }

        isZoomed = false;

        if (zoomBtn) {
            zoomBtn.classList.remove('close');
            zoomBtn.setAttribute('aria-pressed', 'false');
        }
        if (zoomLabel) zoomLabel.textContent = '돋보기';

        viewport.classList.remove('is-active');
        if (moveWrap) moveWrap.classList.remove('is-active');
        if (controller) controller.classList.remove('is-active');

        posX = 0;
        posY = 0;

        canvas.style.transform = '';
        canvas.style.removeProperty('will-change');
        canvas.style.removeProperty('padding-bottom');

        [btnUp, btnDown, btnLeft, btnRight].forEach(b => {
            if (!b) return;
            b.classList.remove('is-disable');
            b.setAttribute('aria-disabled', 'false');
        });

        syncMoveWrapSize();
    };

    // ====== 이벤트 바인딩 ======
    if (zoomBtn) {
        zoomBtn.addEventListener('click', () => {
            if (isZoomed) disableZoom();
            else enableZoom();
        });
    }

    if (zoomExitBtn) {
        zoomExitBtn.addEventListener('click', () => {
            if (!isZoomed) return;
            if (zoomBtn) zoomBtn.focus();
            disableZoom();
        });
    }

    window.addEventListener('resize', () => {
        syncMoveWrapSize();
        if (isZoomed) recalcBounds();
    });

    if (canvas) {
        canvas.style.transformOrigin = '0 0';
    }

    // 초기 1회
    syncMoveWrapSize();

    window.addEventListener('load', () => {
        syncMoveWrapSize();
        if (isZoomed) recalcBounds();
    });

    // 외부(common.js)에서 "저자세 모드가 바뀌었다"라고 알려줄 때 쓰는 훅
    window.onLowPostureModeChange = function () {
        if (!viewport || !moveWrap || !canvas) return;

        syncMoveWrapSize();
        if (isZoomed) recalcBounds();
    };
}