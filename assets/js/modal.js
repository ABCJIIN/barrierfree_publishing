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

    // 모달 출력 시 관광/음식도 지도 z-index 제어
    function lowerMapZIndex() {
        $('.map-area').each(function () {
            const $map = $(this);

            // 최초 z-index 저장 (1회만)
            if ($map.data('origin-z') == null) {
                const z = $map.css('z-index');
                $map.data('origin-z', z === 'auto' ? '' : z);
            }

            $map.css('z-index', 1);
        });
    }

    function restoreMapZIndex() {
        $('.map-area').each(function () {
            const $map = $(this);
            const originZ = $map.data('origin-z');

            if (originZ === '') {
                $map.css('z-index', '');
            } else if (originZ != null) {
                $map.css('z-index', originZ);
            }
        });
    }

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

    // footer에서 모달 열려있을 때도 포커싱 허용할 요소들
    function getFooterFocusable() {
        // 필요한 버튼만 딱 지정 (원하면 셀렉터 추가 가능)
        const $footer = $('.footer');
        if (!$footer.length) return $();

        return $footer
            .find('button:not([disabled]), [tabindex]:not([tabindex="-1"])')
            .filter(':visible')
            .filter(function () {
                var $el = $(this);
                if ($el.is('[disabled]')) return false;
                if ($el.attr('aria-hidden') === 'true') return false;
                return true;
            });
    }

    // 모달 오픈 시 실제 포커스가 순환할 "전체" 리스트 (모달 → footer 순서)
    function getLoopFocusables() {
        const $modalFocus = getFocusable($currentModal);
        const $footerFocus = getFooterFocusable();

        // 중복 제거(혹시 같은 요소가 잡힐 경우 대비)
        const $all = $modalFocus.add($footerFocus);
        const seen = new Set();
        return $all.filter(function () {
            const el = this;
            if (seen.has(el)) return false;
            seen.add(el);
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

        // footer는 모달 중에도 포커스 가능해야 하므로 inert 해제
        $('.footer').removeAttr('inert');
        $('.footer').find('[inert]').removeAttr('inert');
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

        lowerMapZIndex();        // 모달 열리면 지도 z-index 내림
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

        // 열려있는 모달이 하나도 없을 때만 지도 복원
        if (!$('.modal.is-active').length) {
            restoreMapZIndex();
        }
    }

    // ================== 이벤트 바인딩 ==================

    // 1) 인트로 슬라이드 상세 모달 열기 (slide02 / slide03 클래스 기준)
    $(document).on('click', '.slide-detail-btn', function (e) {
        e.preventDefault();

        const $btn   = $(this);
        const $slide = $btn.closest('.swiper-slide');

        if (!$slide.length) return;

        // slide02 / slide03 같은 클래스 추출
        const slideClass = $slide
            .attr('class')
            .split(' ')
            .find(c => /^slide\d+$/.test(c));

        if (!slideClass) return;

        // 동일한 slide 클래스를 가진 slide-modal 찾기
        const $modal = $('.modal.slide-modal.' + slideClass).first();
        if (!$modal.length) return;

        // 공통 모달 열기
        openModal($modal, $btn);
    });

    // 1) QR 크게보기 모달 열기 (구글/네이버)
    $(document).on('click', '.qr-zoom-btn', function (e) {
        e.preventDefault();

        const $btn = $(this);

        // 버튼 클래스 기준으로 어떤 모달을 열지 결정
        const isGoogle = $btn.hasClass('google');
        const $modal = isGoogle ? $('.modal.qr-zoom.google') : $('.modal.qr-zoom.naver');

        openModal($modal, $btn, {
            // 필요하면 첫 포커스 위치 지정 가능
            // focusSelector: '.close-btn',
            tts: isGoogle ? '구글 지도 QR코드 크게보기 화면입니다.' : '네이버 지도 QR코드 크게보기 화면입니다.'
        });
    });

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
            var $focusables = getLoopFocusables();
            if (!$focusables.length) return;

            // 모달 요소만 따로 (경계 판단용)
            var $modalFocus = getFocusable($currentModal);
            var $footerFocus = getFooterFocusable();

            if (!$modalFocus.length) return; // 모달에 포커스가 하나도 없으면 루프 의미 없음

            var $firstModal  = $modalFocus.first();
            var $lastModal   = $modalFocus.last();

            // footer가 없으면 기존처럼 모달 내부에서만 트랩
            if (!$footerFocus.length) {
                var $first = $modalFocus.first();
                var $last  = $modalFocus.last();
                var active = document.activeElement;

                if (e.shiftKey) {
                    if (active === $first[0]) { e.preventDefault(); $last.focus(); }
                } else {
                    if (active === $last[0]) { e.preventDefault(); $first.focus(); }
                }
                return;
            }

            var $firstFooter = $footerFocus.first();
            var $lastFooter  = $footerFocus.last();

            var active = document.activeElement;

            if (e.shiftKey) {
                // Shift+Tab (역방향)
                // 1) 모달 첫 요소에서 Shift+Tab → footer 마지막으로
                if (active === $firstModal[0]) {
                    e.preventDefault();
                    $lastFooter.focus();
                    return;
                }
                // 2) footer 첫 요소에서 Shift+Tab → 모달 마지막으로
                if (active === $firstFooter[0]) {
                    e.preventDefault();
                    $lastModal.focus();
                    return;
                }
            } else {
                // Tab (정방향)
                // 1) 모달 마지막 요소에서 Tab → footer 첫 요소로
                if (active === $lastModal[0]) {
                    e.preventDefault();
                    $firstFooter.focus();
                    return;
                }
                // 2) footer 마지막 요소에서 Tab → 모달 첫 요소로
                if (active === $lastFooter[0]) {
                    e.preventDefault();
                    $firstModal.focus();
                    return;
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