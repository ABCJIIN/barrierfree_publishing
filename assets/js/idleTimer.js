console.log('idleTimer loaded');

(function () {
    // const TOTAL_LIMIT = (window.IDLE_TIMEOUT || 60) * 1000; // 전체 3분
    const TOTAL_LIMIT = (window.IDLE_TIMEOUT || 180) * 1000; // 전체 3분
    const WARNING_TIME = 30 * 1000; // 30초

    let idleTimer = null;
    let warningTimer = null;
    let countdownTimer = null;
    let remaining = 30;
    let warningShown = false;

    function resetTimer() {
        // (버튼 클릭/터치는 아래 전용 핸들러에서 처리)
        if (warningShown) return;
        
        clearAllTimers();

        if (warningShown) {
            Modal.close(false);
            warningShown = false;
        }

        warningTimer = setTimeout(showIdleWarning, TOTAL_LIMIT - WARNING_TIME);
        idleTimer = setTimeout(goHome, TOTAL_LIMIT);
    }

    function tickCountdown() {
        remaining--;
        updateCountdown();

        if (remaining <= 0) {
            goHome();
        }

        // 10초 남았을 때 음성 안내 (선택)
        if (remaining === 10 && document.documentElement.classList.contains('mode-voice')) {
            TTS.speak('10초 후 처음 화면으로 이동합니다.');
        }
    }

    function showIdleWarning() {
        const $modal = $('.modal.idle-reset');
        if (!$modal.length || !window.Modal) return;

        warningShown = true;
        remaining = 30;
        updateCountdown();

        Modal.open($modal, null, {
            tts: '30초 후 처음 화면으로 이동합니다. 계속 이용하시려면 화면을 터치해 주세요.',
            ttsOnce: true,
            focusSelector: '.return-home-btn'
        });

        const btn = $modal.find('.return-home-btn')[0];
        if (btn) {
            btn.onclick = function (e) {
                e.preventDefault();
                e.stopPropagation();
                goHome();
            };
        }

        countdownTimer = setInterval(tickCountdown, 1000);
        bindIdleModalButtons();
    }


    function updateCountdown() {
        const num = document.querySelector('.modal.idle-reset .countdown-num');
        if (num) num.textContent = remaining;
    }

    function goHome() {
        clearAllTimers();
        window.location.href = window.IDLE_REDIRECT_URL || '/';
    }

    function clearAllTimers() {
        if (idleTimer) clearTimeout(idleTimer);
        if (warningTimer) clearTimeout(warningTimer);
        if (countdownTimer) clearInterval(countdownTimer);
    }
    function bindIdleModalButtons() {
        const modal = document.querySelector('.modal.idle-reset');
        if (!modal) return;

        // 처음으로 버튼
        const homeBtn = modal.querySelector('.return-home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('pointerdown', function (e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                goHome();
            }, true);

            homeBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                goHome();
            }, true);
        }

        // 모달 아무 곳이나 터치하면 계속 이용(닫고 리셋)
        modal.addEventListener('pointerdown', function (e) {
            // 버튼 눌렀으면 위에서 처리하니 여기선 패스
            if (e.target.closest('.return-home-btn')) return;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            // 모달 닫고 타이머 리셋
            Modal.close(false);
            warningShown = false;
            resetTimer();
        }, true);
    }


    // =========================
    // 사용자 동작 감지
    // =========================
    // ['mousemove','mousedown','keydown','scroll','touchstart']
    // ['mousedown','keydown','scroll','touchstart']
    ['pointerdown','keydown','scroll']
        .forEach(evt =>
            document.addEventListener(evt, resetTimer, true)
        );

    // =========================
    // 모달 내 버튼 처리
    // =========================

    // [처음으로] 버튼 → 즉시 이동
    // document.addEventListener('click', function (e) {
    //     if (e.target.closest('.modal.idle-reset .return-home-btn')) {
    //         goHome();
    //     }
    // }, true);

    // 모달 떠 있을 때 화면 터치하면 계속 이용
    document.addEventListener('click', function (e) {
        if (!warningShown) return;

        const insideModal = e.target.closest('.modal.idle-reset');
        if (!insideModal) return;

        resetTimer();
    }, true);

    resetTimer();
})();
