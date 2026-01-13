// 돋보기 버튼 기능
function initZoom() {
    const viewport   = document.querySelector('.zoom-viewport');
    const moveWrap   = document.querySelector('.zoom-move-wrap');
    const canvas     = document.querySelector('.zoom-canvas');

    // 푸터의 '돋보기' 버튼 (기존 그대로 있다고 가정)
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

    // 251216 speakMoveIfNeeded 를 initZoom 안으로 이동
    function speakMoveIfNeeded(dir, source) {
        // 음성 모드 아니면 종료
        if (!document.documentElement.classList.contains('mode-voice')) return;

        // 같은 방향 + 같은 입력수단이면 또 말하지 않음
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
    const CONTROLLER_HEIGHT = 200;   // 컨트롤 영역 높이(참고용, 직접 padding값은 따로 지정)
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

    const applyTransform = () => {
        if (isZoomed) {
            canvas.style.transform = `translate(${-posX}px, ${-posY}px) scale(${SCALE})`;
        } else {
            canvas.style.removeProperty('transform');
        }
    };

    const setDisabled = (btn, disabled) => {
        if (!btn) return;
        btn.classList.toggle('is-disable', disabled);
        btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    };

    // 가장자리에 닿았을 때 is-disable 처리
    const updateEdgeButtons = () => {
        setDisabled(btnUp,    posY <= 0);
        setDisabled(btnDown,  posY >= maxY);
        setDisabled(btnLeft,  posX <= 0);
        setDisabled(btnRight, posX >= maxX);
    };

    const startMove = (dx, dy) => {
        movingDir.x = dx;
        movingDir.y = dy;
        if (rafId) return; // 이미 동작 중

        lastTs = 0;
        const step = (ts) => {
            if (!lastTs) lastTs = ts;
            const dt = (ts - lastTs) / 1000; // 초
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

             // Enter 또는 Space일 때만
            if (isEnter || isSpace) {
                e.preventDefault();// 스크롤/클릭 중복 방지
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

    // ★ 키보드(Enter/Space)로도 같은 방향 이동
    bindKeyMove(btnUp,    0, -1, 'up');
    bindKeyMove(btnDown,  0,  1, 'down');
    bindKeyMove(btnLeft, -1,  0, 'left');
    bindKeyMove(btnRight, 1,  0, 'right');
    
    const isLowPostureMode = () =>
    htmlEl.classList.contains('mode-low-posture') ||
    bodyEl.classList.contains('mode-low-posture');

    // ====== 드래그(패닝) 이동 ======
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartPosX = 0;
    let dragStartPosY = 0;

    // drag 중에는 hold-move(버튼 꾹)와 충돌 방지
    const stopMoveAndRaf = () => {
        stopMove();
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    };

    // 이벤트를 붙일 대상: moveWrap이 있으면 거기가 제일 안전(컨트롤러 영역 제외)
    // 없으면 viewport, 그것도 없으면 canvas
    const dragTarget = moveWrap || viewport || canvas;

    const getPoint = (e) => {
        if (e.touches && e.touches[0]) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        if (e.changedTouches && e.changedTouches[0]) {
            return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    };

    const startDrag = (e) => {
        if (!isZoomed) return;

        // 버튼(상/하/좌/우/종료) 위에서 드래그 시작하면 무시
        // (컨트롤러 영역에서 드래그로 화면이 움직이면 UX가 혼란스러워서)
        const target = e.target;
        if (target && target.closest && target.closest('.viewport-controller')) return;

        // 텍스트 드래그/이미지 기본동작 방지
        if (e.cancelable) e.preventDefault();

        stopMoveAndRaf();

        const p = getPoint(e);
        isDragging = true;
        dragStartX = p.x;
        dragStartY = p.y;
        dragStartPosX = posX;
        dragStartPosY = posY;

        // 드래그 중 클릭 방지(드래그 후 click 발생하는 케이스)
        if (dragTarget) dragTarget.classList.add('is-dragging');
    };

    const moveDrag = (e) => {
        if (!isZoomed || !isDragging) return;

        if (e.cancelable) e.preventDefault();

        const p = getPoint(e);
        const dx = p.x - dragStartX;
        const dy = p.y - dragStartY;

        // 손가락/마우스를 오른쪽으로 끌면 화면이 오른쪽으로 “따라오게” 하려면
        // 콘텐츠(캔버스)는 반대로 움직여야 하므로 posX/posY는 -dx/-dy 방향으로 변화
        posX = clamp(dragStartPosX - dx, 0, maxX);
        posY = clamp(dragStartPosY - dy, 0, maxY);

        applyTransform();
        updateEdgeButtons();
    };

    const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;

        if (dragTarget) dragTarget.classList.remove('is-dragging');
    };

    // 마우스
    if (dragTarget) {
        dragTarget.addEventListener('mousedown', startDrag);
        window.addEventListener('mousemove', moveDrag);
        window.addEventListener('mouseup', endDrag);

        // 터치 (passive:false로 preventDefault 가능하게)
        dragTarget.addEventListener('touchstart', startDrag, { passive: false });
        window.addEventListener('touchmove', moveDrag, { passive: false });
        window.addEventListener('touchend', endDrag);
        window.addEventListener('touchcancel', endDrag);
    }

    // 실제 보이는 영역(뷰포트) 크기 기준으로 경계 재계산
    const recalcBounds = () => {
        if (!canvas) return;

        const viewportBox = moveWrap || viewport;
        if (!viewportBox) return;

        const vpW = viewportBox.clientWidth;
        const vpH = viewportBox.clientHeight;

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
            if (viewport) {
                viewport.style.removeProperty('--lp-page-height');
            }
            return;
        }

        if (isZoomed) {
            moveWrap.style.height = LOW_POSTURE_HEIGHT + 'px';
            return;
        }

        // low posture + 줌 OFF → CSS에 맡김
        moveWrap.style.height = '';
        if (viewport) {
            viewport.style.removeProperty('--lp-page-height');
        }
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

        if (zoomLabel) {
            zoomLabel.textContent = '돋보기 종료';
        }

        viewport.classList.add('is-active');
        if (moveWrap) moveWrap.classList.add('is-active');

        if (controller) controller.classList.add('is-active');

        posX = 0;
        posY = 0;

        canvas.style.willChange = 'transform';

        // ★ 모드별 padding-bottom (컨텐츠가 컨트롤러에 가려지지 않도록)
        //   - 일반 모드: 100px
        //   - 낮은 자세 모드: 50px
        const paddingBottom = isLowPostureMode() ? 50 : 100;
        canvas.style.paddingBottom = paddingBottom + 'px';

        // ★ 줌 모드 진입 시 moveWrap 높이 규칙 적용
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

        if (zoomLabel) {
            zoomLabel.textContent = '돋보기';
        }

        viewport.classList.remove('is-active');
        if (moveWrap) moveWrap.classList.remove('is-active');

        if (controller) controller.classList.remove('is-active');

        posX = 0;
        posY = 0;
        canvas.style.transform = '';
        canvas.style.removeProperty('will-change');

        // ★ 줌 모드 전용 padding 제거
        canvas.style.removeProperty('padding-bottom');

        [btnUp, btnDown, btnLeft, btnRight].forEach(b => {
            if (!b) return;
            b.classList.remove('is-disable');
            b.setAttribute('aria-disabled', 'false');
        });

        // ★ 줌 OFF 상태에서 moveWrap 높이 다시 기본값으로
        syncMoveWrapSize();
    };

    // ====== 이벤트 바인딩 ======
    if (zoomBtn) {
        zoomBtn.addEventListener('click', () => {
            if (isZoomed) {
                disableZoom();
            } else {
                enableZoom();
            }
        });
    }

    if (zoomExitBtn) {
        zoomExitBtn.addEventListener('click', () => {
            if (!isZoomed) return;

            if (zoomBtn) {
                zoomBtn.focus();
            }

            disableZoom();
        });
    }

    // ★ 리사이즈 시
    window.addEventListener('resize', () => {
        // 모드/상태에 맞게 moveWrap 높이 다시 맞추고,
        syncMoveWrapSize();

        if (isZoomed) {
            // 줌 중이면 경계 다시 계산
            recalcBounds();
        }
    });

    if (canvas) {
        canvas.style.transformOrigin = '0 0';
    }

    // 초기 1회
    syncMoveWrapSize();

    window.addEventListener('load', () => {
        syncMoveWrapSize();
        if (isZoomed) {
            recalcBounds();
        }
    });

    // 외부(common.js)에서 "저자세 모드가 바뀌었다"라고 알려줄 때 쓰는 훅
    window.onLowPostureModeChange = function () {
        // zoom 레이아웃 요소가 없으면 무시
        if (!viewport || !moveWrap || !canvas) return;

        // 현재 모드 기준으로 높이 다시 맞추기
        syncMoveWrapSize();

        // 줌 켜져 있으면 경계값도 다시 계산
        if (isZoomed) {
            recalcBounds();
        }
    };
}