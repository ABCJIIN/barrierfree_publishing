// 공통
const VOLUME_KEY = 'voiceVolume';
const VOLUME_DEFAULT = 50;
let currentVolume = 50;
const VOLUME_STEP = 25;
const VOLUME_MIN  = 0;
const VOLUME_MAX  = 100;
let lastSpokenEl = null;
const TTS_RATE_KEY = 'voiceRate';
const TTS_RATE_DEFAULT = 1.0;
const TTS_RATE_MIN = 0.6;
const TTS_RATE_MAX = 1.6;
const TTS_RATE_STEP = 0.1;
let currentRate = TTS_RATE_DEFAULT;

$(document).ready(function(){
    currentRate = initRateState();
    currentVolume = initVolumeState();

    // setting mode
    const contrast = localStorage.getItem('contrastMode');
    const low      = localStorage.getItem('lowMode');
    const voice      = localStorage.getItem('voiceMode');
    const last     = localStorage.getItem('lastMode') || 'none';

    const $html = $('html');
    const hasContrastClass = $html.hasClass('mode-high-contrast');
    const hasLowClass      = $html.hasClass('mode-low-posture');
    const hasVoiceClass      = $html.hasClass('mode-voice');

    // 1) html 클래스가 있는데 storage/lastMode가 안 맞는 경우 → 클래스를 기준으로 강제 정렬
    if (hasContrastClass && (contrast !== '1' || last !== 'contrast')) {
        saveModeState('contrast');
    } else if (hasLowClass && (low !== '1' || last !== 'low')) {
        saveModeState('low');
    } else if (hasVoiceClass && (voice !== '1' || last !== 'voice')) {
        saveModeState('voice');
    }

    // 2) html에 클래스가 전혀 없고, localStorage 값만 있는 희귀 케이스라면?
    // (예: 어떤 이유로 head 스니펫이 빠진 페이지)
    if (!hasContrastClass && !hasLowClass && !hasVoiceClass) {
        if (last === 'contrast' && contrast === '1') {
            enableContrastMode(false);
        } else if (last === 'low' && low === '1') {
            enableLowPostureMode(false);
        } else if (last === 'voice' && voice === '1') {
            enableVoiceMode(false, false);
        } else if (contrast === '1') {
            enableContrastMode(false);
        } else if (low === '1') {
            enableLowPostureMode(false);
        } else if (voice === '1') {
            enableVoiceMode(false, false);
        }
    }

    // header, footer, bottom-nav

    if (typeof initHeaderClock === 'function') {
        initHeaderClock();
    }
    
    // footer.html 안에 zoom 버튼이 들어온 뒤 줌 초기화
    if (typeof initZoom === 'function') {
        initZoom();
    }

    enhanceZebraPaginationA11y();
    
    if (voice === '1') {
        setTimeout(speakPageSummaryOnce, 300);
    }

    const key = getSecondLastPath();

    $(".bottom-nav .nav-btn")
        .removeClass("is-active")
        .removeAttr("aria-current");

    $(`.bottom-nav .nav-btn[data-nav="${key}"]`)
        .addClass("is-active")
        .attr("aria-current", "page");

    // modal (공통)
    // modal.html 안에 volume 모달이 들어오고 나서 다시 초기화
    if (typeof initVolume === 'function') {
        initVolume();
    }

    $(document).on('click', '#highContrastBtn', function () {
        const isActive = $('html').hasClass('mode-high-contrast');

        if (!isActive) {
            enableContrastMode();
        }

        location.replace("/html/main/category.html");
    });

    $(document).on('click', '#menuBtn', function () {
        const isActive = $('html').hasClass('mode-high-contrast');
        const isActiveVoice = $('html').hasClass('mode-voice');

        if (isActive) {
            disableAllModes();
        }

        if (isActiveVoice) {
            TTS.speak('전체메뉴를 엽니다');
        }

        location.replace("/html/main/category.html");
    });


    $(document).on('click', '#lowScreenBtn', function () {
        const isActive = $('html').hasClass('mode-low-posture');

        if (!isActive) {
            enableLowPostureMode();
        }
    });


    $(document).on('click', '#voiceBtn', function () {
        const isActive = $('html').hasClass('mode-voice');

        if (!isActive) {
            enableVoiceMode(true, true);
        }

        location.replace("/index_voice.html");
    });


    $(document).on('click', '#resetBtn', function () {        
        const isActiveVoice = $('html').hasClass('mode-voice');
        const isActiveLow = $('html').hasClass('mode-low-posture');

        disableAllModes();
        if(isActiveLow) {
            $('#lowScreenBtn').focus();
        } else if (isActiveVoice) {
            TTS.speak('모드를 초기화합니다');
            location.replace("/index.html");
        }
    });

    $(document).on('click', '#homeBtn', function () {        
        const isActiveVoice = $('html').hasClass('mode-voice');

        if(isActiveVoice) {
            location.replace("/index_voice.html");
        } else {
            location.replace("/index.html");
        }
    });


    $(document).on('click', '.refresh-btn', function () {
        const isActiveVoice = $('html').hasClass('mode-voice');

        if(isActiveVoice) {
            TTS.speak('항공편 정보를 새로 불러옵니다.');

            setTimeout(() => {
                location.reload();
            }, 2000);
        }  else {
            location.reload();
        }
    });

    $(document).on('click', '.nav-btn.prev', function (e) {
        e.preventDefault(); 
        const isActiveVoice = $('html').hasClass('mode-voice');

        if(isActiveVoice) {
            TTS.speak('목록으로 돌아갑니다.');
        }

        // 히스토리가 있을 때만 뒤로가기
        if (window.history.length > 1) {
            history.back();
        } else {
            // fallback (원하면 수정 가능)
            location.href = '/';
        }
    });

    document.addEventListener(
        'click',
        function (e) {
            const target = e.target.closest('a, button');
            if (!target) return;

            // data-tts 있는 경우는 TTS 끄지 않음
            if (target.hasAttribute('data-tts')) {
                return;
            }

            if (window.TTS) {
            TTS.stop();
            }
            if (window.speechSynthesis) {
            speechSynthesis.cancel();
            }
        },
        true
    );


    window.addEventListener('keydown', (e) => {

        // Tab / Shift+Tab 은 포커스 이동 전용. 여기서 prevent/click 변환 금지
        // if (e.key === 'Tab' || e.keyCode === 9) return;
        
        // zoom-control이면 common.js는 아예 무시
        if (
            e.keyCode === 13 &&
            document.activeElement &&
            document.activeElement.closest('.zoom-control')
        ) {
            return; // 여기서 끝
        }
        
        const targetKeyCodes = [
            /*119, // F8 <<
            120, // F9 >>
            121, // F10 Repeat*/
            128, // F17 AudioVolumeUp
            129, // F18 AudioVolumeDown
            135, // F24 <<
            134, // F23 >>
            131, // F20 Home
            130, // F19 Repeat
            127, // F16 earphone out
            126, // F15 earphone in
            37,  // ArrowLeft
            38,  // ArrowUp
            39,  // ArrowRight
            40,  // ArrowDown
            13   // Enter
        ];

        if (!targetKeyCodes.includes(e.keyCode)) return;
        const hasVoice = document.documentElement.classList.contains('mode-voice');

        // 모든 대상 키 기본 동작 차단
        e.preventDefault();
        e.stopPropagation();

        // 콘솔에는 "어떤 키가 눌렸다" 정도만
        const isActiveVoice = $('html').hasClass('mode-voice');

        switch (e.keyCode) {

            /* ===============================
            볼륨 제어
            =============================== */
            case 128: // volume up
                changeVolume(+25);
                if(isActiveVoice) {
                    TTS.speak('음량이 커졌습니다.');
                }
                break;

            case 129: // volume down
                changeVolume(-25);
                if(isActiveVoice) {
                    TTS.speak('음량이 작아졌습니다.');
                }
                break;

            /* ===============================
            음성 모드 ON / OFF
            =============================== */
            case 126: // earphone in → voice ON
                if (!hasVoice) enableVoiceMode(true, false);
                if(isActiveVoice) {
                    TTS.speak('음성 모드가 켜졌습니다.');
                }
                break;

            case 127: // earphone out → voice OFF
                if (hasVoice) disableAllModes();
                break;

            /* ===============================
            voice 모드 전용 키
            =============================== */
            case 135: // >>
                if (!hasVoice) return;
                changeSpeechRate(+TTS_RATE_STEP);
                break;

            case 134: // <<
                if (!hasVoice) return;
                changeSpeechRate(-TTS_RATE_STEP);
                break;

            /*case 119: // >>
                if (!hasVoice) return;
                changeSpeechRate(+TTS_RATE_STEP);
                break;

            case 120: // <<
                if (!hasVoice) return;
                changeSpeechRate(-TTS_RATE_STEP);
                break;*/

            case 130: // repeat
                if (!hasVoice) return;
                if (lastSpokenEl) {
                    TTS.speak(getReadableLabel(lastSpokenEl));
                }
                // 나중에 TTS 제어 연결
                break;

            /*case 121: // repeat
                if (!hasVoice) return;
                if (lastSpokenEl) {
                    TTS.speak(getReadableLabel(lastSpokenEl));
                }
                // 나중에 TTS 제어 연결
                break;*/

            /* ===============================
            홈 이동
            =============================== */
            case 131:
                location.href = '/index.html';
                break;

            /* ===============================
            포커스 이동 (Tab / Shift+Tab)
            =============================== */
            case 37: // ArrowLeft → prev
                moveFocus(false);
                break;

            case 39: // ArrowRight → next
                moveFocus(true);
                break;

            /* ===============================
            스크롤
            =============================== */
            case 38: // up
                const prevBtn = document.querySelector('.btn-wrap .prev');
                if (prevBtn) {
                    prevBtn.click();
                }
                // window.scrollBy({ top: -120, behavior: 'smooth' });
                break;

            case 40: // down
                const nextBtn = document.querySelector('.btn-wrap .next');
                if (nextBtn) {
                    nextBtn.click();
                }
                // window.scrollBy({ top: 120, behavior: 'smooth' });
                break;

            case 13: // enter
                const el = document.activeElement;

                // 안전장치: 클릭 가능한 요소만 클릭
                if (!el) break;

                const clickable =
                    el.matches('button, a[href], input:not([type="hidden"]), [role="button"], [role="link"]');

                if (!clickable) break;

                // 또 하나: disabled면 클릭 금지
                if (el.matches(':disabled,[aria-disabled="true"]')) break;

                el.click();
                break;
        }
    }, true);
});

// 포커스 아웃라인 : 키보드 이동시에만 아웃라인 생성, 클릭/터치 할때는 아웃라인 X
/*(function () {
    var root = document.documentElement;

    // 키보드로 포커스 이동 시작
    window.addEventListener('keydown', function (e) {
        if (
        e.key === 'Tab' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight'
        ) {
        root.classList.add('is-keyboard-user');
        }
    });

    // 마우스/터치 입력 시에는 키보드 포커스 상태 해제
    window.addEventListener('mousedown', function () {
        root.classList.remove('is-keyboard-user');
    });

    window.addEventListener('touchstart', function () {
        root.classList.remove('is-keyboard-user');
    });
})();*/

function getSecondLastPath() {
    const segments = location.pathname.replace(/\/$/, '')
        .split('/')
        .filter(Boolean);
    return segments.length >= 2 ? segments.at(-2) : null;
}

function setModeCookie(name, value) {
    document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24}`;
}

function saveModeState(mode) {
    // mode: 'contrast' | 'low' | 'none'
    switch (mode) {
        case 'contrast':
            localStorage.setItem('contrastMode', '1');
            localStorage.setItem('lowMode', '0');
            localStorage.setItem('voiceMode', '0');
            localStorage.setItem('lastMode', 'contrast');

            setModeCookie('contrastMode', '1');
            setModeCookie('lowMode', '0');
            setModeCookie('voiceMode', '0');
            setModeCookie('lastMode', 'contrast');
            break;

        case 'low':
            localStorage.setItem('lowMode', '1');
            localStorage.setItem('contrastMode', '0');
            localStorage.setItem('voiceMode', '0');
            localStorage.setItem('lastMode', 'low');

            setModeCookie('lowMode', '1');
            setModeCookie('contrastMode', '0');
            setModeCookie('voiceMode', '0');
            setModeCookie('lastMode', 'low');
            break;

        case 'voice':
            localStorage.setItem('voiceMode', '1');
            localStorage.setItem('lowMode', '0');
            localStorage.setItem('contrastMode', '0');
            localStorage.setItem('lastMode', 'voice');

            setModeCookie('voiceMode', '1');
            setModeCookie('lowMode', '0');
            setModeCookie('contrastMode', '0');
            setModeCookie('lastMode', 'voice');
            break;

        default: // 'none'
            localStorage.setItem('lowMode', '0');
            localStorage.setItem('contrastMode', '0');
            localStorage.setItem('voiceMode', '0');
            localStorage.setItem('lastMode', 'none');

            setModeCookie('lowMode', '0');
            setModeCookie('contrastMode', '0');
            setModeCookie('voiceMode', '0');
            setModeCookie('lastMode', 'none');
            break;
    }
}

function enableContrastMode(save = true) {
    const $html = $('html');

    $html
        .addClass('mode-high-contrast')
        .removeClass('mode-low-posture')
        .removeClass('mode-voice');

    if (save) {
        saveModeState('contrast');
    }

    notifyLayoutChange();
}

function enableLowPostureMode(save = true) {
    const $html = $('html');

    $html
        .addClass('mode-low-posture')
        .removeClass('mode-high-contrast')
        .removeClass('mode-voice');

    if (save) {
        saveModeState('low');
    }

    notifyLayoutChange();
}

function enableVoiceMode(save = true, announce = false) {
    const $html = $('html');

    if ($html.hasClass('mode-voice')) return;

    $html
        .addClass('mode-voice')
        .removeClass('mode-high-contrast')
        .removeClass('mode-low-posture');

    if (save) {
        saveModeState('voice');
    }

    notifyLayoutChange();

    // 사용자 클릭으로 들어온 경우에만 안내
    if (announce) {
        setTimeout(() => {
            TTS.speak('음성 모드가 켜졌습니다');
            // 안내 후 요약
            setTimeout(speakPageSummaryOnce, 300);
        }, 200);
    } else {
        // 이어폰 꽂힘 등 자동 진입이면 안내 없이 요약만
        setTimeout(speakPageSummaryOnce, 300);
    }
}

function disableAllModes() {
    const wasVoice = document.documentElement.classList.contains('mode-voice');
    
    const $html = $('html');

    $html.removeClass('mode-low-posture mode-high-contrast mode-voice');

    saveModeState('none');

    notifyLayoutChange();
        
    if (wasVoice) {
        TTS.stop(); // tts 멈추기
        lastSpokenEl = null;
    }
}

function notifyLayoutChange() {
    if (typeof window.onLowPostureModeChange === 'function') {
        window.onLowPostureModeChange();
    } else {
        window.dispatchEvent(new Event('resize'));
    }
}

/**
 * header clock
 * - KST 고정
 * - Ajax include 대응
 * - 자정 날짜 변경 처리
 */
function initHeaderClock() {

    const $dOut   = $('.date');
    const $hOut   = $('.w_time_h');
    const $mOut   = $('.w_time_m');
    const $barOut = $('.w_time_bar');

    if (!$hOut.length || !$mOut.length) return;

    let toggle = true;

    function updateClock() {

        const now = new Date();

        // UTC → KST 보정
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const kr  = new Date(utc + 9 * 3600000);

        const h = String(kr.getHours()).padStart(2,'0');
        const m = String(kr.getMinutes()).padStart(2,'0');
        
        const weekMap = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
        const y  = kr.getFullYear();
        const mo = String(kr.getMonth() + 1).padStart(2,'0');
        const d  = String(kr.getDate()).padStart(2,'0');
        const w  = weekMap[kr.getDay()];

        // 시간
        $hOut.text(h);
        $mOut.text(m);

        // 날짜 + 요일 (항상 최신)
        $dOut.text(`${y}.${mo}.${d}/${w}`);

        // : 깜빡임
        $barOut.css('visibility', toggle ? 'visible' : 'hidden');
        toggle = !toggle;
    }

    // 최초 실행
    updateClock();

    // 기존 interval 정리 (중복 방지)
    if (window.__headerClockTimer) {
        clearInterval(window.__headerClockTimer);
    }

    window.__headerClockTimer = setInterval(updateClock, 1000);
}
// 볼륨 제어
function changeVolume(delta) {
    const isActiveVoice = $('html').hasClass('mode-voice');
    if(isActiveVoice) {
        TTS.speak('음량이 조절되었습니다.');
    }
  setVolume(currentVolume + delta);
}
// 포커스 이동 (Tab / Shift+Tab 대체)
/*function moveFocus(next = true) {
  const focusables = Array.from(
    document.querySelectorAll(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => !el.disabled && el.offsetParent !== null);

  if (!focusables.length) return;

  const index = focusables.indexOf(document.activeElement);
  let nextIndex = next ? index + 1 : index - 1;

  if (nextIndex < 0) nextIndex = focusables.length - 1;
  if (nextIndex >= focusables.length) nextIndex = 0;

  focusables[nextIndex].focus();
}*/
function moveFocus(next = true) {
    // document.documentElement.classList.add('is-keyboard-user');
    
    TTS.stop();

    const focusables = Array.from(
        document.querySelectorAll(
            'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
    ).filter(el => !el.disabled && el.offsetParent !== null);

    if (!focusables.length) return;

    const index = focusables.indexOf(document.activeElement);
    let nextIndex = next ? index + 1 : index - 1;

    if (nextIndex < 0) nextIndex = focusables.length - 1;
    if (nextIndex >= focusables.length) nextIndex = 0;

    const target = focusables[nextIndex];
    target.focus();

    // TTS
    speakIfNew(target);
}
// 음량 관련 값
function initVolumeState() {
  let v = localStorage.getItem(VOLUME_KEY);

  if (v === null) {
    v = VOLUME_DEFAULT;
    localStorage.setItem(VOLUME_KEY, v);
    setVolumeCookie(v);
  }

  return clampVolume(parseInt(v, 10));
}
function clampVolume(v) {
  return Math.max(0, Math.min(100, v));
}
function setVolumeCookie(value) {
  document.cookie = `voiceVolume=${value}; path=/; max-age=${60 * 60 * 24}`;
}
// TTS 추가
const TTS = {
  synth: window.speechSynthesis,
  utterance: null,

  isEnabled() {
    return document.documentElement.classList.contains('mode-voice');
  },

  speak(text) {
    if (!this.isEnabled()) return;
    if (!text) return;

    this.stop();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = currentRate;
    u.pitch = 1.0;
    u.volume = currentVolume / 100;

    this.utterance = u;
    this.synth.speak(u);
  },

  stop() {
    if (this.synth.speaking || this.synth.pending) {
      this.synth.cancel();
    }
  }
};

// 포커스 이동 시 TTS 읽기
/*function getReadableLabel(el) {
  return (
    el.getAttribute('aria-label') ||
    el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.innerText ||
    el.innerText ||
    el.value ||
    ''
  ).trim();
}*/
function getReadableLabel(el) {
  if (!el) return '';

  let parts = [];

  // aria-label (최우선)
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) {
    parts.push(ariaLabel.trim());
  }

  // aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (!ariaLabel && labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl && labelEl.innerText) {
      parts.push(labelEl.innerText.trim());
    }
  }

  // aria-describedby
  const describedBy = el.getAttribute('aria-describedby');
  if (describedBy) {
    describedBy.split(' ').forEach(id => {
      const descEl = document.getElementById(id);
      if (descEl && descEl.innerText) {
        parts.push(descEl.innerText.trim());
      }
    });
  }

  // fallback
  if (!parts.length) {
    if (el.innerText) parts.push(el.innerText.trim());
    else if (el.value) parts.push(el.value.trim());
  }

  return parts.join('. ');
}

function speakIfNew(el) {
  if (lastSpokenEl === el) return;
  lastSpokenEl = el;
  TTS.speak(getReadableLabel(el));
}
// tts rate
function initRateState() {
  let r = localStorage.getItem(TTS_RATE_KEY);

  if (r === null) {
    r = TTS_RATE_DEFAULT;
    localStorage.setItem(TTS_RATE_KEY, r);
    setRateCookie(r);
  }

  return clampRate(parseFloat(r));
}

function clampRate(r) {
  return Math.max(TTS_RATE_MIN, Math.min(TTS_RATE_MAX, r));
}

function setRateCookie(value) {
  document.cookie = `voiceRate=${value}; path=/; max-age=${60 * 60 * 24}`;
}
function changeSpeechRate(delta) {
  currentRate = clampRate(
    parseFloat((currentRate + delta).toFixed(2))
  );

  localStorage.setItem(TTS_RATE_KEY, currentRate);
  setRateCookie(currentRate);
  // TTS.speak(`말하기 속도 ${currentRate}`);
}

// 페이지 진입 요약 TTS (이 페이지에서 1번만)
function speakPageSummaryOnce() {
  if (!document.documentElement.classList.contains('mode-voice')) return;

  /*const key = 'tts_summary_' + location.pathname; // 페이지별로 1회
  if (sessionStorage.getItem(key) === '1') return;
  sessionStorage.setItem(key, '1');*/

  /*const title =
    document.querySelector('h1')?.innerText?.trim() ||
    document.title ||
    '';

  // 페이지마다 커스텀 요약(있으면 그걸 우선)
  const custom = document.body.getAttribute('data-tts-summary'); 
  const summary = (custom || '').trim();

  // 없으면 자동 요약(간단 버전)
  const focusables = Array.from(document.querySelectorAll('button, a, [role="button"], input, select, textarea'))
    .filter(el => !el.disabled && el.offsetParent !== null);

  const quick = focusables
    .slice(0, 5)
    .map(el => getReadableLabel(el))
    .filter(Boolean);

  const msgParts = [];
  // if (title) msgParts.push(`${title} 화면입니다.`);
  if (summary) msgParts.push(summary);
  if (quick.length) msgParts.push(`주요 버튼: ${quick.join(', ')}.`);

  const msg = msgParts.join(' ');
  if (!msg) return;

  // 약간 텀 주고 말하기(렌더/포커스 안정화)
  setTimeout(() => TTS.speak(msg), 300);*/

  if (!document.documentElement.classList.contains('mode-voice')) return;

  // 페이지 진입 시마다 초기화
  lastSpokenEl = null;

  const custom = document.body.getAttribute('data-tts-summary');
  if (!custom) return;

  setTimeout(() => {
    TTS.speak(custom.trim());
  }, 500);
}

function clampVolume(v) {
  return Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, v));
}

function normalizeVolume(v) {
  return Math.round(v / VOLUME_STEP) * VOLUME_STEP;
}
function setVolume(value) {
  currentVolume = clampVolume(value);

  localStorage.setItem(VOLUME_KEY, currentVolume);
  setVolumeCookie(currentVolume);

  syncVolumeUI(); // UI 동기화
}

function syncVolumeUI() {
  const range = document.querySelector('.volume-input');
  if (!range) return;

  range.value = currentVolume;

  // UI 전용 이벤트 (input 말고 custom)
  range.dispatchEvent(new CustomEvent('volume-sync', {
    detail: { value: currentVolume }
  }));
}

function showPageLoading() {
    const loading = document.getElementById('pageLoading');
    if (loading) {
        loading.classList.remove('is-hidden');
    }
}

function enhanceZebraPaginationA11y() {
    document.querySelectorAll('.Zebra_Pagination').forEach(nav => {

        if (nav.dataset.a11yApplied === 'true') return;
        nav.dataset.a11yApplied = 'true';

        nav.setAttribute('role', 'navigation');
        nav.setAttribute('aria-label', '페이지 이동');

        nav.querySelectorAll('li').forEach(li => {
            const a = li.querySelector('a');
            const span = li.querySelector('span');

            if (a) {
                let label = '';

                const has = cls =>
                    li.classList.contains(cls) || a.classList.contains(cls);

                if (has('first')) {
                    label = '첫 페이지로 이동';
                }
                else if (has('previous')) {
                    label = '이전 페이지로 이동';
                }
                else if (has('next')) {
                    label = '다음 페이지로 이동';
                }
                else if (has('last')) {
                    label = '마지막 페이지로 이동';
                }
                else if (/^\d+$/.test(a.textContent.trim())) {
                    label = `${a.textContent.trim()} 페이지로 이동`;
                }

                if (label) {
                    a.setAttribute('aria-label', label);
                    a.setAttribute('role', 'button');
                }
            }

            if (span && li.classList.contains('active')) {
                span.setAttribute('aria-current', 'page');
                span.setAttribute('aria-label', `현재 페이지 ${span.textContent.trim()}`);
            }
        });
    });
}


// PC 키보드( Tab 포함 )로 이동해도 포커스 아웃라인 보이게
(function () {
  const root = document.documentElement;

  // 키보드 입력이면 아웃라인 ON (PC 환경 포함)
  window.addEventListener(
    'keydown',
    function (e) {
      // Tab, 방향키, Enter 등 "키보드 탐색" 계열이면 ON
      if (
        e.key === 'Tab' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'Enter'
      ) {
        root.classList.add('is-keyboard-user');
      }
    },
    true
  );

  // 마우스/터치 입력 시에는 OFF (클릭 시 아웃라인 숨김 유지)
  window.addEventListener(
    'mousedown',
    function () {
      root.classList.remove('is-keyboard-user');
    },
    true
  );

  window.addEventListener(
    'touchstart',
    function () {
      root.classList.remove('is-keyboard-user');
    },
    true
  );
})();

/* ==============================================
    Input Mode Detection (전역 실행)
    - 키보드/키패드 입력 감지 시: is-keyboard-user 클래스 추가
    - 마우스/터치 입력 감지 시: is-keyboard-user 클래스 제거
   ============================================== */
(function () {
    const root = document.documentElement;

    // 키보드(키패드) 사용 감지
    window.addEventListener('keydown', function (e) {
        // 모든 키 입력에 대해 반응하거나, 특정 키만 반응하도록 설정
        // 배리어프리 키오스크의 경우, 키패드의 어떤 키를 눌러도 포커스가 보여야 함
        
        // 이미 클래스가 있다면 중복 실행 방지
        if (root.classList.contains('is-keyboard-user')) return;

        // (옵션) 특정 키만 반응하게 하려면 아래 조건문 사용
        /*
        const focusKeys = [
            9, 13, 37, 38, 39, 40, // Tab, Enter, Arrows
            128, 129, 135, 134, 131, 130, 127, 126 // F-Keys (키패드)
        ];
        if (!focusKeys.includes(e.keyCode)) return; 
        */

        root.classList.add('is-keyboard-user');
    });

    // 마우스 클릭 시 해제
    window.addEventListener('mousedown', function () {
        root.classList.remove('is-keyboard-user');
    });

    // 터치 시작 시 해제
    window.addEventListener('touchstart', function () {
        root.classList.remove('is-keyboard-user');
    });
})();