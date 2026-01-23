// 인트로 슬라이드
document.addEventListener('DOMContentLoaded', function () {
    var swiperContainer = document.querySelector('.intro-slide');
    if (!swiperContainer) return;

    // loop 전에 실제 슬라이드 개수 (페이지네이션용)
    var originalSlides = swiperContainer.querySelectorAll('.swiper-wrapper > .swiper-slide');
    var TOTAL_SLIDES = originalSlides.length;

    var IMAGE_DELAY = 20000; // 이미지 슬라이드는 20초 유지
    var autoplayTimer = null;
    var isCarouselPaused = false; // 슬라이드 자동 넘김 정지 여부

    var currentVideo = null;
    var currentVideoEndedHandler = null;

    var paginationCurrent = document.querySelector('.intro-pagination .current');
    var paginationTotal = document.querySelector('.intro-pagination .total');
    // var slidePrevBtn = document.querySelector('.intro-controls .slide-prev');
    // var slideNextBtn = document.querySelector('.intro-controls .slide-next');
    var slideToggleBtn = document.querySelector('.intro-controls .slide-toggle');

    var lastIndex = null;

    function markUserSlideChange() {
        isUserSlideChange = true;
    }

    function isVoiceMode() {
        return document.documentElement.classList.contains('mode-voice');
    }

    function speakSafe(msg) {
        if (!isVoiceMode()) return;
        if (window.TTS && typeof window.TTS.speak === 'function') {
            try { window.TTS.speak(msg); } catch (e) {}
        }
    }

    function handleSlideChange(swiper) {
        // 사용자 조작으로 발생한 slideChange일 때만 안내 TTS
        if (isVoiceMode() && lastIndex !== null && isUserSlideChange) {
            if (swiper.realIndex > lastIndex) {
                speakSafe('다음 슬라이드입니다.');
            } else if (swiper.realIndex < lastIndex) {
                speakSafe('이전 슬라이드입니다.');
            }
        }

        // 항상 갱신 (중요)
        lastIndex = swiper.realIndex;

        // 다음 autoplay/타이머/영상종료 slideNext에는 영향 없도록 즉시 해제
        isUserSlideChange = false;

        clearAutoplayTimer();
        updatePagination(swiper);

        var activeSlide = swiper.slides[swiper.activeIndex];
        if (!activeSlide) return;

        var video = activeSlide.querySelector('video');

        if (video) {
            handleVideoSlide(swiper, activeSlide, video);
        } else {
            handleImageSlide(swiper);
        }

        updateSlideFocus(swiper);
    }

    if (paginationTotal) {
        paginationTotal.textContent = String(TOTAL_SLIDES);
    }

    function clearAutoplayTimer() {
        if (autoplayTimer) {
            clearTimeout(autoplayTimer);
            autoplayTimer = null;
        }
    }

    function updatePagination(swiper) {
        if (!paginationCurrent) return;
        var index = swiper.realIndex + 1; // loop에서도 실제 index
        paginationCurrent.textContent = String(index);
    }

    function resetAllVideosExcept(targetVideo) {
        var videos = swiperContainer.querySelectorAll('video');
        videos.forEach(function (vid) {
            if (vid !== targetVideo) {
                vid.pause();
                var slide = vid.closest('.swiper-slide');
                if (!slide) return;
                var playBtn = slide.querySelector('.video-play');
                var pauseBtn = slide.querySelector('.video-pause');
                if (playBtn) {
                    playBtn.classList.remove('is-hidden');
                    // playBtn.removeAttribute('tabindex');
                }
                if (pauseBtn) {
                    pauseBtn.classList.add('is-hidden');
                    // pauseBtn.setAttribute('tabindex', '-1');
                }
            }
        });
    }

    function stopAllVideos() {
        // currentVideo ended 핸들러 제거 (전환 중 꼬임 방지)
        if (currentVideo && currentVideoEndedHandler) {
            try { currentVideo.removeEventListener('ended', currentVideoEndedHandler); } catch(e) {}
            currentVideoEndedHandler = null;
        }
        currentVideo = null;

        var videos = swiperContainer.querySelectorAll('video');
        videos.forEach(function (vid) {
            try { vid.pause(); } catch(e) {}
        });
    }

    function isFocusInsideCarousel() {
        var active = document.activeElement;
        if (!active) return false;
        return swiperContainer.contains(active);
    }

    function bindVideoButtons(slideEl, video) {
        var playBtn = slideEl.querySelector('.video-play');
        var pauseBtn = slideEl.querySelector('.video-pause');
        if (!playBtn || !pauseBtn) return;

        function syncUI() {
            if (video.paused) {
                playBtn.classList.remove('is-hidden');
                // playBtn.removeAttribute('tabindex');

                pauseBtn.classList.add('is-hidden');
                // pauseBtn.setAttribute('tabindex', '-1');
            } else {
                pauseBtn.classList.remove('is-hidden');
                // pauseBtn.removeAttribute('tabindex');

                playBtn.classList.add('is-hidden');
                // playBtn.setAttribute('tabindex', '-1');
            }
        }

        // 재진입마다 UI는 동기화
        syncUI();

        // [추가] Tab/Shift+Tab 이동할 때 전역 keydown 로직(=click 변환)으로 넘어가지 않게 차단
        function blockTabClick(e) {
            if (e.key === 'Tab') {
                // Tab은 포커스 이동만 해야 함. 클릭/토글 절대 금지.
                e.stopPropagation();
                // preventDefault는 하면 포커스 이동이 막히니까 하면 안 됨
            }
        }

        // capture 단계에서 막아야 전역 document keydown보다 먼저 잡힘
        playBtn.addEventListener('keydown', blockTabClick, true);
        pauseBtn.addEventListener('keydown', blockTabClick, true);

        function preventWeirdKeyClick(e) {
            // Enter/Space만 "의도된 클릭"으로 인정
            if (e.key === 'Enter' || e.key === ' ') return;
            // Tab 포함, 나머지 키는 버튼이 동작하면 안 됨
            if (e.key === 'Tab') return; // Tab은 위에서 stopPropagation만 함
        }
        playBtn.addEventListener('keydown', preventWeirdKeyClick, true);
        pauseBtn.addEventListener('keydown', preventWeirdKeyClick, true);

        // video 상태 리스너는 1회만 (중복 방지)
        if (video.dataset.syncBound !== '1') {
            video.dataset.syncBound = '1';
            video.addEventListener('play', syncUI);
            video.addEventListener('pause', syncUI);
            video.addEventListener('ended', syncUI);
        }

        // 클릭 이벤트도 1회만
        if (slideEl.dataset.videoBound === '1') return;
        slideEl.dataset.videoBound = '1';

        playBtn.addEventListener('click', function () {
            speakSafe('영상을 재생합니다.');
            safePlayVideo(video, { reset: false });
            syncUI();
            setTimeout(function () {
                if (!pauseBtn.classList.contains('is-hidden')) pauseBtn.focus();
            }, 0);
        });

        pauseBtn.addEventListener('click', function () {
            speakSafe('영상을 일시정지합니다.');
            video.pause();
            syncUI();
            setTimeout(function () {
                if (!playBtn.classList.contains('is-hidden')) playBtn.focus();
            }, 0);
        });
    }

    function safePlayVideo(video, options) {
        var reset = !!(options && options.reset === true);

        // 사용자가 '재생' 누른 경우(reset=false): 멈췄던 지점에서 그대로 재생
        if (!reset) {
            video.muted = true;
            var p0 = video.play();
            if (p0 && typeof p0.catch === 'function') p0.catch(function(){});
            return;
        }

        // 슬라이드 진입(reset=true): 흰화면/무반응 방지용 "강제 복구 루틴"
        try { video.pause(); } catch(e) {}

        var playNow = function () {
            video.muted = true;
            try { video.currentTime = 0; } catch(e) {}
            var p = video.play();
            if (p && typeof p.catch === 'function') p.catch(function(){});
        };

        if (video.readyState >= 2) {
            playNow();
            return;
        }

        try { video.load(); } catch(e) {}

        var fired = false;

        var onCanPlay = function () {
            if (fired) return;
            fired = true;
            try { video.removeEventListener('canplay', onCanPlay); } catch(e) {}
            playNow();
        };

        video.addEventListener('canplay', onCanPlay, { once: true });

        setTimeout(function () {
            if (fired) return;
            fired = true;
            try { video.removeEventListener('canplay', onCanPlay); } catch(e) {}
            playNow();
        }, 600);
    }

    function handleVideoSlide(swiper, slideEl, video) {
        // 이전 영상 ended 핸들러 제거
        if (currentVideo && currentVideoEndedHandler) {
            currentVideo.removeEventListener('ended', currentVideoEndedHandler);
            currentVideoEndedHandler = null;
        }

        currentVideo = video;

        // 다른 슬라이드 영상은 모두 정지
        resetAllVideosExcept(video);

        safePlayVideo(video, { reset: true });

        bindVideoButtons(slideEl, video);

        // 슬라이드 자동 재생이 정지 상태면, 영상 끝나도 슬라이드 안넘김
        currentVideoEndedHandler = function () {
            if (isCarouselPaused) return;
            if (isFocusInsideCarousel()) return;
            swiper.slideNext();
        };
        video.addEventListener('ended', currentVideoEndedHandler);
    }

    function handleImageSlide(swiper) {
        // 이미지 슬라이드에서는 모든 영상 정지
        resetAllVideosExcept(null);

        if (isCarouselPaused) return;
        if (isFocusInsideCarousel()) return; 

        clearAutoplayTimer();
        autoplayTimer = setTimeout(function () {
            swiper.slideNext();
        }, IMAGE_DELAY);
    }

    function updateSlideFocus(swiper) {
        var activeSlide = swiper.slides[swiper.activeIndex];
        if (!activeSlide) return;

        swiper.slides.forEach(function (slideEl) {
            var isActive = (slideEl === activeSlide);

            // 1) 슬라이드 자체: 활성 0 / 비활성 -1 (원하는 요구사항)
            slideEl.setAttribute('tabindex', isActive ? '0' : '-1');

            // 2) aria-hidden
            if (!isActive) slideEl.setAttribute('aria-hidden', 'true');
            else slideEl.removeAttribute('aria-hidden');

            // 3) 비활성 슬라이드면 inert로 통째로 차단 (가능한 환경에서 강력추천)
            // - 크로미움 기반 키오스크면 거의 지원됨
            if ('inert' in slideEl) {
            slideEl.inert = !isActive;
            }

            // 4) 슬라이드 내부 포커스 후보들 (슬라이드 자신은 포함하지 않도록 "slideEl.querySelectorAll"만 사용)
            // - 버튼/링크/폼요소 + 커스텀 tabindex 요소들
            var innerFocusables = slideEl.querySelectorAll(
            'a[href], button, input, textarea, select, [tabindex]'
            );

            // 5) TTS로 읽힐 이미지 타겟
            var ttsTargets = slideEl.querySelectorAll('[data-slide-focus="slide-media"]');

            if (!isActive) {
            // --------------------
            // 비활성: 내부 전부 잠금
            // --------------------
            ttsTargets.forEach(function (el) {
                el.setAttribute('tabindex', '-1');
            });

            innerFocusables.forEach(function (el) {
                // (중요) 슬라이드 자체는 여기 포함되지 않지만 혹시 대비
                if (el === slideEl) return;

                // 이미 잠긴 건 스킵
                if (el.getAttribute('data-swiper-locked') === '1') return;

                // 원래 tabindex 있던 애만 백업
                if (el.hasAttribute('tabindex')) {
                el.setAttribute('data-prev-tabindex', el.getAttribute('tabindex'));
                }

                el.setAttribute('tabindex', '-1');
                el.setAttribute('data-swiper-locked', '1');
            });

            } else {
            // --------------------
            // 활성: 이미지 타겟은 포커스 가능(0)
            // --------------------
            ttsTargets.forEach(function (el) {
                el.setAttribute('tabindex', '0');
            });

            // 잠가둔 요소 복구
            innerFocusables.forEach(function (el) {
                if (el === slideEl) return;

                if (el.getAttribute('data-swiper-locked') !== '1') return;

                if (el.hasAttribute('data-prev-tabindex')) {
                el.setAttribute('tabindex', el.getAttribute('data-prev-tabindex'));
                el.removeAttribute('data-prev-tabindex');
                } else {
                // 원래 tabindex 없던 요소(button/a 등)는 tabindex 제거
                // (기본 포커스 동작으로 돌아가게)
                el.removeAttribute('tabindex');
                }

                el.removeAttribute('data-swiper-locked');
            });
            }
        });
    }

    // 슬라이드 자동 재생 토글 버튼 (슬라이드 흐름만 제어, 영상 재생은 그대로)
    if (slideToggleBtn) {
            
        slideToggleBtn.addEventListener('click', function () {
            isCarouselPaused = !isCarouselPaused;
            slideToggleBtn.classList.toggle('is-paused', isCarouselPaused);
            slideToggleBtn.setAttribute('aria-pressed', String(isCarouselPaused));

            var labelPause = slideToggleBtn.querySelector('.label-pause');
            var labelPlay  = slideToggleBtn.querySelector('.label-play');

            if (isCarouselPaused) {
                // 정지: 타이머만 멈춘다 (영상은 그대로 재생)
                if (isVoiceMode()) speakSafe('슬라이드 자동 넘김을 정지합니다.');

                clearAutoplayTimer();
                slideToggleBtn.setAttribute('aria-label', '슬라이드 자동 넘김 재생');
                if (labelPause) labelPause.hidden = true;
                if (labelPlay)  labelPlay.hidden = false;
            } else {
                // 재생: 현재 슬라이드 타입에 맞게 다시 세팅
                if (isVoiceMode()) speakSafe('슬라이드 자동 넘김을 재생합니다.');

                slideToggleBtn.setAttribute('aria-label', '슬라이드 자동 넘김 일시정지');
                if (labelPause) labelPause.hidden = false;
                if (labelPlay)  labelPlay.hidden = true;

                // 현재 활성 슬라이드 기준으로 로직 다시 적용
                handleSlideChange(introSwiper);
            }
        });
    }

    // Swiper 초기화
    var introSwiper = new Swiper('.intro-slide', {
        loop: true,
        speed: 600,
        allowTouchMove: false, // ★ 터치로 슬라이드 이동 불가 :contentReference[oaicite:4]{index=4}
        navigation: {
            nextEl: '.intro-controls .slide-next',
            prevEl: '.intro-controls .slide-prev'
        },
        a11y: {
            enabled: false
            /*enabled: true,
            containerMessage: '인트로 슬라이드',
            containerRoleDescriptionMessage: '자동으로 넘어가는 슬라이드',
            slideLabelMessage: '{{slidesLength}}장 중 {{index}}번째 슬라이드입니다.',
            prevSlideMessage: '이전 슬라이드',
            nextSlideMessage: '다음 슬라이드',*/
        },
        on: {
            init: function (swiper) {
                swiper.keyboard.disable();
                updatePagination(swiper);

                // 최초 1회는 바로 처리
                handleSlideChange(swiper);      // 타이머/페이지네이션 등
                updateSlideFocus(swiper);
            },

            slideChangeTransitionStart: function (swiper) {
                // 전환 시작: 영상은 무조건 멈추고(흰 화면 방지용)
                stopAllVideos();
                clearAutoplayTimer();
                updatePagination(swiper);
                updateSlideFocus(swiper);
            },

            slideChangeTransitionEnd: function (swiper) {
                // 전환 끝: 여기서 “활성 슬라이드 타입”에 맞게 재생/타이머 시작
                handleSlideChange(swiper);
            }
        }
    });

    // Prev/Next 버튼 조작(터치/클릭/키보드)일 때만 슬라이드 안내 TTS 나오게 하기
    (function bindUserNavMarks() {
        var prevBtn = document.querySelector('.intro-controls .slide-prev');
        var nextBtn = document.querySelector('.intro-controls .slide-next');

        [prevBtn, nextBtn].forEach(function (btn) {
            if (!btn) return;

            // 클릭/터치(포인터)로 누른 경우
            btn.addEventListener('pointerdown', markUserSlideChange, true);
            btn.addEventListener('click', markUserSlideChange, true);

            // 키보드로 버튼 조작한 경우(Enter/Space)
            btn.addEventListener('keydown', function (e) {
                var k = e.key || '';
                if (k === 'Enter' || k === ' ' || e.keyCode === 13 || e.keyCode === 32) {
                    markUserSlideChange();
                }
            }, true);
        });
    })();

    // Prev/Next 버튼은 Swiper navigation 모듈로 제어 (추가 로직 필요 없음)
});