// 음량 조절
/*function initVolume() {
    const volumeRange = document.querySelector('.volume-input');
    const marks = document.querySelectorAll('.volume-marks .mark');
    const btnDown = document.querySelector('.volume-btn.down');
    const btnUp = document.querySelector('.volume-btn.up');

    if (!volumeRange) return;

    const MIN = parseInt(volumeRange.min, 10);
    const MAX = parseInt(volumeRange.max, 10);

    function updateVolumeUI(value) {
        // 1) CSS 변수로 바 색 채우기 비율 업데이트
        const percent = ((value - MIN) / (MAX - MIN)) * 100;
        volumeRange.style.setProperty('--volume-percent', `${percent}%`);

        // 2) 점 표시: 현재 값보다 낮은 단계는 숨김 (is-past)
        marks.forEach(mark => {
            const markVal = parseInt(mark.dataset.value, 10);
            if (markVal <= value) {
                mark.classList.add('is-past');
            } else {
                mark.classList.remove('is-past');
            }
        });

        // range 값(1~5)을 TTS API에서 요구하는 실제 볼륨 값으로 변환하는 위치
        // const ttsVolume = value / MAX; // 0 ~ 1 예시
    }

    // 초기 상태 세팅
    updateVolumeUI(parseInt(volumeRange.value, 10));

    // 슬라이더 직접 드래그
    volumeRange.addEventListener('input', () => {
        const val = parseInt(volumeRange.value, 10);
        updateVolumeUI(val);
    });

    // - 버튼
    if (btnDown) {
        btnDown.addEventListener('click', () => {
            let val = parseInt(volumeRange.value, 10);
            if (val > MIN) {
                val -= 1;
                volumeRange.value = String(val);
                updateVolumeUI(val);
            }
        });
    }

    // + 버튼
    if (btnUp) {
        btnUp.addEventListener('click', () => {
            let val = parseInt(volumeRange.value, 10);
            if (val < MAX) {
                val += 1;
                volumeRange.value = String(val);
                updateVolumeUI(val);
            }
        });
    }
}

// 페이지 DOM 준비되면 1차 시도
document.addEventListener('DOMContentLoaded', () => {
    initVolume();
});*/
// 음량 조절
function initVolume() {
    const volumeRange = document.querySelector('.volume-input');
    const marks = document.querySelectorAll('.volume-marks .mark');
    const btnDown = document.querySelector('.volume-btn.down');
    const btnUp = document.querySelector('.volume-btn.up');
    const rangeWrap = volumeRange.closest('.volume-range');

    if (!volumeRange) return;

    const MIN = parseInt(volumeRange.min, 10); // 0
    const MAX = parseInt(volumeRange.max, 10); // 100
    const STEP = parseInt(volumeRange.step, 10); // 25

    // -------------------------
    // UI 반영 함수
    // -------------------------
    function updateVolumeUI(value) {
        // 1) bar 채우기
        const percent = ((value - MIN) / (MAX - MIN)) * 100;
        if (rangeWrap) rangeWrap.style.setProperty('--volume-percent', `${percent}%`);
        else volumeRange.style.setProperty('--volume-percent', `${percent}%`);

        // 2) 점 표시 (0/25/50/75/100)
        marks.forEach(mark => {
            const markVal = parseInt(mark.dataset.value, 10); // 0,25,50...
            if (markVal <= value) {
                mark.classList.add('is-past');
            } else {
                mark.classList.remove('is-past');
            }

            // 현재 값과 동일한 마크를 선택 상태로 표시(접근성)
            const isSelected = (markVal === value);
            mark.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            mark.classList.toggle('is-selected', isSelected);
        });
    }

    // -------------------------
    // 초기 상태: common.js 기준
    // -------------------------
    volumeRange.value = currentVolume;
    updateVolumeUI(currentVolume);

    // -------------------------
    // 마크 위치를 thumb 중심에 맞추기
    // -------------------------
    function positionMarksToThumb() {
        const input = volumeRange;
        const wrap = input.closest('.volume-range');
        const marksWrap = wrap ? wrap.querySelector('.volume-marks') : null;
        if (!marksWrap) return;

        const inputRect = input.getBoundingClientRect();
        const marksRect = marksWrap.getBoundingClientRect();

        const THUMB = 40; // CSS thumb와 동일해야 함
        const radius = THUMB / 2;

        const trackLeft = radius;
        const trackRight = inputRect.width - radius;
        const trackWidth = trackRight - trackLeft;

        const offsetX = inputRect.left - marksRect.left;

        marks.forEach((mark) => {
            const v = parseInt(mark.dataset.value, 10);
            const ratio = (v - MIN) / (MAX - MIN);
            const x = offsetX + trackLeft + trackWidth * ratio;
            mark.style.left = x + 'px';
        });
    }

    // 초기 2회(레이아웃 확정) + 리사이즈
    positionMarksToThumb();
    requestAnimationFrame(positionMarksToThumb);

    window.addEventListener('resize', () => {
        positionMarksToThumb();
        requestAnimationFrame(positionMarksToThumb);
    });

    let isProgrammaticChange = false;

    // -------------------------
    // 슬라이더 직접 이동
    // -------------------------
    volumeRange.addEventListener('input', (e) => {
        const val = parseInt(volumeRange.value, 10);

        // UI → common.js로 위임
        if (window.setVolume) {
            setVolume(val);
        }
    });
    volumeRange.addEventListener('volume-sync', (e) => {
        const val = e.detail.value;
        updateVolumeUI(val);
    });
    // -------------------------
    // - 버튼
    // -------------------------
    if (btnDown) {
        btnDown.addEventListener('click', () => {
            const isActiveVoice = $('html').hasClass('mode-voice');
            if(isActiveVoice) {
                TTS.speak('음량이 작아졌습니다.');
            }
            volumeRange.stepDown();
            volumeRange.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    // -------------------------
    // + 버튼
    // -------------------------
    if (btnUp) {
        btnUp.addEventListener('click', () => {
            const isActiveVoice = $('html').hasClass('mode-voice');
            if(isActiveVoice) {
                TTS.speak('음량이 커졌습니다.');
            }
            volumeRange.stepUp();
            volumeRange.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    // =========================
    // 마크 클릭
    // =========================
    marks.forEach(mark => {
        mark.addEventListener('click', () => {
            const isActiveVoice = $('html').hasClass('mode-voice');
            if (isActiveVoice && window.TTS && typeof window.TTS.speak === 'function') {
                const stepLabel = mark.getAttribute('aria-label') || '음량이 조절되었습니다.';
                TTS.speak(stepLabel + '로 설정되었습니다.');
            }

            volumeRange.value = mark.dataset.value;
            volumeRange.dispatchEvent(new Event('input', { bubbles: true }));
        });
    });

    document.addEventListener('volume-marks-layout', () => {
    positionMarksToThumb();
    requestAnimationFrame(positionMarksToThumb);
});
}

// document.addEventListener('DOMContentLoaded', initVolume);

// ===============================
// footer 음량조절 버튼
// ===============================
function setVolumeBtnState(isOpen) {
    var $btn = $('.footer .volume-control-btn');
    if (!$btn.length) return;

    var $label = $btn.find('.btn-label');

    if (isOpen) {
        $btn.addClass('close');
        $btn.attr('aria-pressed', 'true');
        $btn.attr('aria-label', '음량 조절 닫기');
        if ($label.length) $label.text('음량조절 종료');
    } else {
        $btn.removeClass('close');
        $btn.attr('aria-pressed', 'false');
        $btn.attr('aria-label', '음량 조절 열기');
        if ($label.length) $label.text('음량조절');
    }
}