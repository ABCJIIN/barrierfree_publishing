// 모달 공통 + 교통_필터 버튼 선택 이벤트
$(function () {
    var focusableSelector = [
        'a[href]',
        'area[href]',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    var $currentModal = null;        // 지금 열려 있는 모달
    var $lastFocused = null;         // 모달 열기 전 포커스 요소
    var $backgroundFocusable = $();  // 배경 포커스 가능한 요소들

    // 모든 모달에 기본 aria-hidden 세팅 (없으면 'true')
    $('.modal').each(function () {
        var $m = $(this);
        if (!$m.attr('aria-hidden')) {
        $m.attr('aria-hidden', 'true');
        }
    });

    function getFocusable($container) {
        if (!$container || !$container.length) return $();

        return $container
        .find(focusableSelector)
        .filter(':visible')
        .filter(function () {
            var $el = $(this);
            if ($el.is('[disabled]')) return false;
            if ($el.attr('aria-hidden') === 'true') return false;
            return true;
        });
    }

    // 배경 포커스 막기
    function disableBackgroundFocus() {
        /*var $all = $(focusableSelector).filter(':visible');
        var $modalElems = getFocusable($currentModal);

        $backgroundFocusable = $all.not($modalElems);

        $backgroundFocusable.each(function () {
            var $el = $(this);
            var prev = $el.attr('tabindex');
            $el.data('prev-tabindex', prev != null ? prev : '');
            $el.attr('tabindex', '-1');
        });*/
        $('.modal-background')
        .children()
        .not('.global-modal-wrap')
        .attr('inert', '');

        // 혹시 modal 형제가 있다면 대비
        $('.modal-background')
            .find('.modal')
            .not($currentModal)
            .attr('inert', '');
    }

    // 배경 포커스 원복
    function restoreBackgroundFocus() {
        /*if (!$backgroundFocusable || !$backgroundFocusable.length) return;

        $backgroundFocusable.each(function () {
            var $el = $(this);
            var prev = $el.data('prev-tabindex');

            if (prev === '') {
                $el.removeAttr('tabindex');
            } else if (prev != null) {
                $el.attr('tabindex', prev);
            } else {
                $el.removeAttr('tabindex');
            }

            $el.removeData('prev-tabindex');
        });

        $backgroundFocusable = $();*/
        $('.modal-background [inert]').removeAttr('inert');
    }

    // 공통: 모달 열기
    function openModal($modal, $trigger, options = {}) {
        if (!$modal || !$modal.length) return;

        // 이미 다른 모달이 열려있다면 먼저 닫고(포커스는 복원하지 않음)
        if ($currentModal && $currentModal.length && !$currentModal.is($modal)) {
            closeModal(false);
        }

        $currentModal = $modal;
        $lastFocused = ($trigger && $trigger.length) ? $trigger : $(document.activeElement);

        $currentModal
            .addClass('is-active')
            .attr('aria-hidden', 'false');

        disableBackgroundFocus();

        /*var $focusables = getFocusable($currentModal);
        if ($focusables.length) {
            $focusables.first().focus();
        }*/

        // TTS 처리 (옵션 기반)
        if (
            options.tts &&
            document.documentElement.classList.contains('mode-voice')
        ) {
            // 중복 방지: 같은 모달 연속 오픈 시 1회만
            if (!options.ttsOnce || !$modal.data('tts-spoken')) {
                TTS.speak(options.tts);
                $modal.data('tts-spoken', true);
            }
        }

        // 포커스 이동
        var $focusables = getFocusable($currentModal);
        if (options.focusSelector) {
            const $target = $currentModal.find(options.focusSelector);
            if ($target.length) {
                $target.focus();
                return;
            }
        }

        if ($focusables.length) {
            $focusables.first().focus();
        }
    }

    // 공통: 모달 닫기
    function closeModal(restoreFocus = true) {
        if (!$currentModal || !$currentModal.length) return;

        $currentModal
            .removeClass('is-active')
            .attr('aria-hidden', 'true');

        restoreBackgroundFocus();

        // 모달 닫을 때 포커스를 원래 버튼으로 돌려줄지 여부
        if (restoreFocus && $lastFocused && $lastFocused.length && typeof $lastFocused.focus === 'function') {
            $lastFocused.focus();
        }

        $currentModal = null;
    }

    // ================== 이벤트 바인딩 ==================

    // 1) 교통 모달 열기 (.modal.traffic 전용)
    $(document).on('click', '.traffic-search-btn, .bottom-nav .nav-btn.traffic-btn, .category .traffic-btn', function (e) {
        e.preventDefault();
        openModal($('.modal.traffic'), $(this));
    });

    // 1) 음량 조절 모달 열기 (.modal.volume-control 전용)
    $(document).on('click', '.footer .volume-control-btn', function (e) {
        e.preventDefault();
        const isActiveVoice = $('html').hasClass('mode-voice');
        if(isActiveVoice) {
            TTS.speak('음량 조절 화면입니다.');
        }
        openModal($('.modal.volume-control'), $(this));
    });

    // 1) 문의 모달 열기 (.modal.inquiry 전용)
    $('.intro .card-btn.inquiry').on('click', function (e) {
        e.preventDefault();
        openModal($('.modal.inquiry'), $(this), {
            tts: '문의 정보 화면입니다. 문의 전화번호 032-466-7282. 문의 메일 Helpme@smart.tourist. 하단에 닫기 버튼이 있습니다.'
        });
    });

    // 2) 공통: 모달 안의 닫기 버튼으로 닫기
    $(document).on('click', '.modal .close-btn', function (e) {
        e.preventDefault();
        const isActiveVoice = $('html').hasClass('mode-voice');

        // 현재 모달 관리 중이면 공통 로직 사용
        if ($currentModal && $currentModal.length) {
            if(isActiveVoice) {
                TTS.speak('이전 화면으로 돌아갑니다.');
            }
            closeModal();
            return;
        }

        // 혹시라도 $currentModal이 없으면, fallback으로 자기 모달만 닫기
        if(isActiveVoice) {
            TTS.speak('이전 화면으로 돌아갑니다.');
        }
        var $m = $(this).closest('.modal');
        $m.removeClass('is-active').attr('aria-hidden', 'true');
    });

    // 3) 공통: ESC로 닫기 + Tab 포커스 트랩
    $(document).on('keydown', function (e) {
        if (!$currentModal || $currentModal.attr('aria-hidden') === 'true') return;
        const isActiveVoice = $('html').hasClass('mode-voice');

        // ESC: 모달 닫기
        if (e.key === 'Escape' || e.key === 'Esc') {
            e.preventDefault();
            if(isActiveVoice) {
                TTS.speak('이전 화면으로 돌아갑니다.');
            }
            closeModal();
            return;
        }

        // Tab 포커스 트랩
        if (e.key === 'Tab') {
            var $focusables = getFocusable($currentModal);
            if (!$focusables.length) return;

            var $first = $focusables.first();
            var $last = $focusables.last();
            var active = document.activeElement;

            if (e.shiftKey) {
                // Shift + Tab: 첫 요소에서 이전 → 마지막으로
                if (active === $first[0]) {
                    e.preventDefault();
                    $last.focus();
                }
            } else {
                // Tab: 마지막 요소에서 다음 → 첫 요소로
                if (active === $last[0]) {
                    e.preventDefault();
                    $first.focus();
                }
            }
        }
    });

    // ===============================
    // 교통 모달 필터 (radio 버튼) 토글
    // ===============================
    $(document).on(
        'click keydown',
        '.modal.traffic [role="radio"]',
        function (e) {
            // 키보드: Enter / Space 허용
            if (e.type === 'keydown') {
            if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
            }

            const $radio = $(this);
            const $group = $radio.closest('[role="radiogroup"]');

            // 이미 선택된 상태면 아무 것도 안 함
            if ($radio.attr('aria-checked') === 'true') return;

            // 그룹 내 전체 OFF
            $group.find('[role="radio"]')
            .attr('aria-checked', 'false')
            .closest('li').removeClass('is-active');

            const isActiveVoice = $('html').hasClass('mode-voice');
            if(isActiveVoice) {
                const labelText =
                    $radio.attr('aria-label') ||
                    $radio.text().trim();
                TTS.speak(labelText+'선택');
                setTimeout(() => {// 현재 버튼 ON
                    $radio
                    .attr('aria-checked', 'true')
                    .closest('li').addClass('is-active');
                }, 500);
            } else {
                // 현재 버튼 ON
                $radio
                .attr('aria-checked', 'true')
                .closest('li').addClass('is-active');
            }

        }
    );

    // ===============================
    // 교통 모달 [적용] 버튼
    // ===============================
    $(document).on('click', '.modal.traffic .apply-btn', function () {
        // 출발 / 도착
        const isDeparture = $('.modal.traffic #DeparturePanel').hasClass('is-active');
        const direction = isDeparture ? 'O' : 'I';

        // 터미널
        const $activePanel = isDeparture
            ? $('.modal.traffic #DeparturePanel')
            : $('.modal.traffic #ArrivalPanel');

        /*const terminal = $('.modal.traffic [role="radiogroup"] [role="radio"][aria-checked="true"]')
            .data('code');*/
        const terminal = $activePanel
            .find('[role="radio"][aria-checked="true"]')
            .data('code');

        const isActiveVoice = $('html').hasClass('mode-voice');

        if(isActiveVoice) {
            TTS.speak('적용합니다.');
            setTimeout(() => {
                location.replace('/html/traffic/traffic.html?io_type='+direction+'&code='+terminal);
            }, 1000);
        } else {
            location.replace('/html/traffic/traffic.html?io_type='+direction+'&code='+terminal);
        }        
    });

    // ===============================
    // 디지털 관광지도 모달 열기
    // ===============================
    $(document).on('click', '.card-link[data-title]', function (e) {
        e.preventDefault();

        const $trigger = $(this);
        const $modal = $('.modal.digital-map');

        if (!$modal.length) return;

        const title = $trigger.data('title') || '';
        const desc  = $trigger.data('desc')  || '';
        const theme  = $trigger.data('theme')  || '';

        // 제목 / 설명 세팅
        $modal.find('.modal-title strong').text(title);
        $modal.find('.qr-desc').text(desc);

        // QR 코드 이미지 세팅
        const safeTitle = title
            .replace(/\s+/g, '_')        // 공백 → _
            .replace(/[^\w가-힣_-]/g, ''); // 특수문자 제거

        let qrSrc = `../../assets/images/map/QR/${safeTitle}.png`;
        if(theme != '') {
            if(theme == 'kdh') {
                qrSrc = `../../assets/images/map/QR/qr_kdh.png`;
            } else if (theme === 'top100') {
                qrSrc = `../../assets/images/map/QR/qr_travle100.png`;
            }
        }

        const $qrImg = $modal.find('.qr-code img');

        if ($qrImg.length) {
            $qrImg
                .attr('src', qrSrc)
                .attr('alt', `${title} 지도 정보 QR코드`);
        }

        // 공통 모달 열기
        openModal($modal, $trigger);

        // TTS 연동
        if (window.TTS && TTS.isEnabled()) {
            TTS.speak(`${title} 상세 정보입니다.`);
        }
    });

    window.Modal = {
        open: openModal,
        close: closeModal
    };

});