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
        volumeRange.style.setProperty('--volume-percent', `${percent}%`);

        // 2) 점 표시 (0/25/50/75/100)
        marks.forEach(mark => {
            const markVal = parseInt(mark.dataset.value, 10); // 0,25,50...
            if (markVal <= value) {
                mark.classList.add('is-past');
            } else {
                mark.classList.remove('is-past');
            }
        });
    }

    // -------------------------
    // 초기 상태: common.js 기준
    // -------------------------
    volumeRange.value = currentVolume;
    updateVolumeUI(currentVolume);

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
            if(isActiveVoice) {
                TTS.speak('음량이 조절되었습니다.');
            }
            volumeRange.value = mark.dataset.value;
            volumeRange.dispatchEvent(new Event('input', { bubbles: true }));
        });
    });
}

// document.addEventListener('DOMContentLoaded', initVolume);
