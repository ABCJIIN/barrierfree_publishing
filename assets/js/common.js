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

    applyBottomNavAriaLabels();

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
            TTS.speak('전체메뉴로 이동합니다.');
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
            // 음량, 빠르기 초기화
            setRateCookie(1);
            setVolume(50);
            location.replace("/index.html");
        }
    });

    $(document).on('click', '#homeBtn', function () {        
        const isActiveVoice = $('html').hasClass('mode-voice');

        try {
            localStorage.setItem('contrastMode', '0');
            localStorage.setItem('lowMode', '0');
            localStorage.setItem('voiceMode', '0');
            localStorage.setItem('lastMode', 'none');
        } catch (e) {}

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

            // 모달 오픈/모달 내부 클릭은 TTS cancel 금지
            if (target.closest('.modal')) return;
            if (target.closest('[data-open-modal], .slide-detail-btn, .qr-zoom-btn, .traffic-search-btn, .footer .volume-control-btn, .intro .card-btn.inquiry, .card-link[data-title]')) return;

        },
        true
    );


    window.addEventListener('keydown', (e) => {

        // ←/→ 는 focus.js에게 맡긴다 (Tab/Shift+Tab과 100% 동일 동작 만들기 위해)
        if (e.keyCode === 37 || e.keyCode === 39) {
        return; // preventDefault/stopPropagation 절대 하지 않음
        }

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
            36,  // Home
            // 37,  // ArrowLeft
            38,  // ArrowUp
            // 39,  // ArrowRight
            40,  // ArrowDown
            13   // Enter
        ];

        if (!targetKeyCodes.includes(e.keyCode)) return;
        const hasVoice = document.documentElement.classList.contains('mode-voice');

        // sectionMove: 이전/다음(스크롤 홀드) 버튼이면 common.js는 Enter를 건드리지 않는다
        // - 안 그러면 stopPropagation 때문에 sectionMove.js의 keydown/keyup이 못 받음
        if (
            e.keyCode === 13 &&
            document.activeElement &&
            document.activeElement.closest('.floating-btn .sec-move-btn')
        ) {
            return;
        }

        // ✅ [EXCEPTION] 상세페이지 floating 이전/다음(스크롤) 버튼은 "누름 유지"를 sectionMove가 처리
        const ae = document.activeElement;
        if (
        ae &&
        ae.closest('.floating-btn') &&
        (
            ae.matches('.sec-move-btn.prev, .sec-move-btn.next') ||
            ae.closest('.btn-wrap.prev, .btn-wrap.next')
        ) &&
        (e.keyCode === 13 || e.key === 'Enter' || e.keyCode === 32 || e.key === ' ')
        ) {
        return; // common.js는 여기서 손 떼기 (preventDefault/stopPropagation/click 변환 금지)
        }


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
            // case 37: // ArrowLeft → prev
            //     moveFocus(false);
            //     break;

            // case 39: // ArrowRight → next
            //     moveFocus(true);
            //     break;

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
                playBeep();
                el.click();
                break;

            case 36:
                TTS.stop();
                const text = '읽기를 멈췄습니다.';
                TTS.speak(text);
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

function applyBottomNavAriaLabels() {
  document.querySelectorAll('.bottom-nav .nav-btn').forEach((el) => {
    const label =
      el.querySelector('.label')?.textContent?.trim() ||
      el.getAttribute('data-nav') ||
      '메뉴';

    const isCurrent =
      el.getAttribute('aria-current') === 'page' ||
      el.classList.contains('is-active');

    if (isCurrent) {
      el.setAttribute('aria-label', `${label}, 현재 카테고리입니다.`);
    } else {
      el.setAttribute('aria-label', `${label}. 확인 버튼을 누르면 ${label} 카테고리로 이동합니다.`);
    }
  });
}


function ttsStop(){
    TTS.stop();
}

// Enter 비프음
const beepAudio = new Audio('/assets/audio/beep.mp3'); 
beepAudio.preload = 'auto';

function playBeep() {
  try {
    beepAudio.pause();
    beepAudio.currentTime = 0;
    beepAudio.play();
  } catch (e) {
    // autoplay 정책/로드 문제 등으로 실패할 수 있음 (특히 첫 재생)
    // 필요하면 console.log(e);
  }
}

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

    // 모달이 열려있으면 포커스 탐색 범위를 모달로 제한
    const activeModal = document.querySelector('.modal.is-active[aria-hidden="false"]');
    const scope = activeModal ? activeModal : document;

    // const focusables = Array.from(
    //     document.querySelectorAll(
    //         'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    //     )
    // ).filter(el => !el.disabled && el.offsetParent !== null);

    const focusables = Array.from(
        scope.querySelectorAll(
            'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
    ).filter(el => !el.disabled && el.offsetParent !== null);

    if (!focusables.length) return;

    const index = focusables.indexOf(document.activeElement);


    // let nextIndex = next ? index + 1 : index - 1;

    // if (nextIndex < 0) nextIndex = focusables.length - 1;
    // if (nextIndex >= focusables.length) nextIndex = 0;


    // 모달 처음 진입 시, index가 -1일 수 있으니 안전 처리
    let nextIndex;
    if (index === -1) {
        nextIndex = next ? 0 : focusables.length - 1;
    } else {
        nextIndex = next ? index + 1 : index - 1;
        if (nextIndex < 0) nextIndex = focusables.length - 1;
        if (nextIndex >= focusables.length) nextIndex = 0;
    }

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
// TTS 추가 - 구글 TTS(유료)
/*const TTS = {
  audio: null,
  queue: Promise.resolve(),

  isEnabled() {
    return document.documentElement.classList.contains('mode-voice');
  },

  speak(text) {
    if (!this.isEnabled()) return;
    if (!text) return;

    // 이전 음성 중단
    this.stop();

    // 큐에 쌓아서 순서 보장
    this.queue = this.queue.then(() => {
      return new Promise((resolve) => {
        fetch('/function/tts_barrier_free.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            text: text,
            rate: currentRate,        // ← 확장 가능
            volume: currentVolume     // ← 확장 가능
          })
        })
        .then(res => res.blob())
        .then(blob => {
          const audio = new Audio(URL.createObjectURL(blob));
          this.audio = audio;

          // 볼륨 적용 (0~1)
          audio.volume = currentVolume / 100;

          audio.onended = resolve;
          audio.onerror = resolve;

          audio.play();
        })
        .catch(() => resolve());
      });
    });
  },

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    this.queue = Promise.resolve();
  }
};*/
// TTS 추가 - chrome TTS(무료)
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

    // 메인화면 mp3 일시중지
    window.BarrierFreeBGM?.pauseNow?.();

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

window.TTS = TTS;

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
    if (window.__ttsFocusLock) return;
  if (lastSpokenEl === el) return;
  lastSpokenEl = el;
  window.TTS.speak(getReadableLabel(el));
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

  TTS.stop();

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

                // ✅ 현재 페이지 판별 추가
                const isCurrent =
                    a.getAttribute('aria-current') === 'page' ||
                    li.classList.contains('active') ||
                    a.classList.contains('current');

                if (has('first')) {
                    label = '첫 페이지로 이동하는 버튼입니다.';
                }
                else if (has('previous')) {
                    label = '이전 페이지로 이동하는 버튼입니다.';
                }
                else if (has('next')) {
                    label = '다음 페이지로 이동하는 버튼입니다.';
                }
                else if (has('last')) {
                    label = '마지막 페이지로 이동하는 버튼입니다.';
                }
                else if (/^\d+$/.test(a.textContent.trim())) {
                    // label = `${a.textContent.trim()} 페이지. 확인버튼을 누르면 해당페이지로 이동합니다.`;

                    const pageNum = a.textContent.trim();

                    if (isCurrent) {
                        label = ` ${pageNum}페이지, 현재 페이지입니다.`;
                        a.setAttribute('aria-current', 'page'); // 혹시 빠져있으면 보강
                    } else {
                        label = `${pageNum} 페이지, 확인버튼을 누르면 해당페이지로 이동합니다.`;
                    }
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

/* ==============================================
    Input Mode Detection (전역 실행)
    - 키보드 입력 감지 시: is-keyboard-user ON
    - 포인터 입력 감지 시: is-keyboard-user OFF
    - ※ 캡처 단계에서 잡아서(modal.js 등에서 stopPropagation 해도) 안정적으로 동작
   ============================================== */
(function () {
    'use strict';

    var root = document.documentElement;

    function setKeyboardUser() {
        if (!root.classList.contains('is-keyboard-user')) {
        root.classList.add('is-keyboard-user');
        }
    }

    function unsetKeyboardUser() {
        if (root.classList.contains('is-keyboard-user')) {
        root.classList.remove('is-keyboard-user');
        }
    }

    // “키보드 조작”으로 간주할 키들
    // (키패드 환경이면 사실상 아무 키든 ON 해도 됨. 그래도 최소한 방향키/탭/엔터/스페이스는 포함)
    var KEYBOARD_KEYS = {
        Tab: true,
        Enter: true,
        ' ': true,
        ArrowLeft: true,
        ArrowRight: true,
        ArrowUp: true,
        ArrowDown: true,
        Home: true,
        End: true
    };

    // 키보드 입력 -> ON (캡처 단계)
    window.addEventListener('keydown', function (e) {
        // 키패드/키보드 어떤 키든 포커스 링 보여야 하면 아래 if를 제거하고 setKeyboardUser()만 호출해도 됨
        if (KEYBOARD_KEYS[e.key]) setKeyboardUser();
    }, true);

    // 포인터 입력 -> OFF (캡처 단계)
    // pointerdown 하나로 대부분 커버됨(마우스+터치+펜)
    window.addEventListener('pointerdown', function () {
        unsetKeyboardUser();
    }, true);

    // 구형 브라우저/특수 디바이스 대비(있어도 무방)
    window.addEventListener('mousedown', function () {
        unsetKeyboardUser();
    }, true);

    window.addEventListener('touchstart', function () {
        unsetKeyboardUser();
    }, true);
})();

window.BarrierFreeBGM = (function () {
  let timerId = null;
  let started = false;
  let audio = null;

  let AUDIO_SRC = "";
  let MIN_DELAY = 60 * 1000;
  let MAX_DELAY = 120 * 1000;

  function randDelay() {
    return Math.floor(MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY));
  }

  function clearTimer() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function scheduleNext() {
    clearTimer();
    timerId = setTimeout(() => {
      playOnce();
    }, randDelay());
  }

  function detachGestureStart(handler) {
    document.removeEventListener("click", handler, true);
    document.removeEventListener("keydown", handler, true);
    document.removeEventListener("touchstart", handler, true);
  }

  function attachGestureStart() {
    const handler = () => {
      detachGestureStart(handler);
      start();
    };

    // 중복 등록 방지: 한 번 싹 제거 후 다시 등록
    detachGestureStart(handler);

    document.addEventListener("click", handler, true);
    document.addEventListener("keydown", handler, true);
    document.addEventListener("touchstart", handler, true);
  }

  async function playOnce() {
    if (!audio) return;

    try {
      audio.currentTime = 0;
      await audio.play(); // autoplay 막히면 catch
    } catch (e) {
      started = false;
      attachGestureStart();
    }
  }

  function stop() {
    started = false;
    clearTimer();
    if (audio) audio.pause();
  }

  function start() {
    if (!audio || started) return;
    started = true;
    clearTimer();
    playOnce();
  }

  function pauseNow() {
    if (audio) audio.pause(); // started/timer 건드리지 않음
  }

  function bindVisibility() {
    // 여러 페이지/재초기화에서 중복 바인딩 방지
    if (bindVisibility._bound) return;
    bindVisibility._bound = true;

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else start();
    });
  }

  /**
   * @param {Object} opts
   * @param {string} opts.src 오디오 경로
   * @param {number} [opts.minDelayMs] 최소 딜레이(ms)
   * @param {number} [opts.maxDelayMs] 최대 딜레이(ms)
   * @param {boolean} [opts.stopTts] 시작 전에 ttsStop 호출할지
   * @param {boolean} [opts.autoStart] 로드 즉시 시작 시도할지
   */
  function init(opts) {
    opts = opts || {};

    AUDIO_SRC = opts.src || AUDIO_SRC;
    MIN_DELAY = typeof opts.minDelayMs === "number" ? opts.minDelayMs : MIN_DELAY;
    MAX_DELAY = typeof opts.maxDelayMs === "number" ? opts.maxDelayMs : MAX_DELAY;

    const initialDelayMs = typeof opts.initialDelayMs === "number" ? opts.initialDelayMs : 0;

    if (!AUDIO_SRC) return; // src 없으면 아무것도 안 함

    // 기존 오디오/타이머 정리
    stop();

    audio = new Audio(AUDIO_SRC);
    audio.preload = "auto";
    audio.loop = false;
    audio.playsInline = true;

    audio.addEventListener("ended", scheduleNext);
    audio.addEventListener("error", scheduleNext);

    if (opts.stopTts && typeof window.ttsStop === "function") {
      window.ttsStop();
    }

    bindVisibility();

    if (opts.autoStart !== false) {
        clearTimer();
        timerId = setTimeout(() => {
        start();
        }, initialDelayMs);
    }
  }

  return {
    init,
    start,
    stop,
    isStarted: () => started,
    pauseNow,
  };
})();

window.speakIfNew = window.speakIfNew || speakIfNew;