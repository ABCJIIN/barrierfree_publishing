// 필터 버튼 좌우 이동
// 필터 버튼의 텍스트 길이에 따라 자동 정렬 + 스와이프(좌/우)로 prev/next 이동
$(function () {
    'use strict';

    var SEL = {
        wrap: '.filter-list-wrap',
        list: '.filter-list',
        prev: '.filter-move-btn.prev',
        next: '.filter-move-btn.next',
        item: 'li',
        radioBtn: '.filter-btn[role="radio"]'
    };

    var STATE_KEY = 'filterState';

    /* ==============================
     * Swipe Tuning (감도 조절)
     * ============================== */
    var SWIPE_THRESHOLD = 40; // px: 이 이상 움직이면 스와이프 인식 (↓ 민감, ↑ 둔감)
    var H_RATIO         = 1.2; // 가로/세로 판별 (↓ 대각선도 인식, ↑ 수평만 인식)
    var COOLDOWN_MS     = 300; // 연속 트리거 방지(ms)

    // ===== 라디오(필터 선택) 기본 동작 =====
    function initFilterRadios($root) {
        $root.find(SEL.list).each(function () {
            var $list = $(this);
            var $btns = $list.find(SEL.radioBtn);

            $btns.off('click.filter').on('click.filter', function () {
                var $btn = $(this);
                var $li  = $btn.closest('li');

                $list.find('li').removeClass('is-active');
                $btns.attr('aria-checked', 'false');

                $li.addClass('is-active');
                $btn.attr('aria-checked', 'true');

                // 기존 로직 유지
                updateRestaurantPagination();
            });
            /* =======================================================
            * ✅ Tab/Shift+Tab 시 숨겨진 항목 있으면 페이지 넘기기
            * - 마지막 "보이는" 라디오에서 Tab → next 페이지로 넘기고 첫 항목 focus
            * - 첫 "보이는" 라디오에서 Shift+Tab → prev 페이지로 넘기고 마지막 항목 focus (옵션)
            * ======================================================= */
            $(document).off('keydown.filterPaging', SEL.radioBtn).on('keydown.filterPaging', SEL.radioBtn, function (e) {
                if (e.key !== 'Tab') return;

                var $btn  = $(this);
                var $wrap = $btn.closest(SEL.wrap);
                var state = $wrap.data(STATE_KEY);
                if (!state) return;

                var $items = $wrap.find(SEL.list).first().children(SEL.item);
                var curIdx = $items.index($btn.closest('li'));
                if (curIdx < 0) return;

                // Shift+Tab: (원하면 유지) 첫 보이는 항목에서 이전 페이지로
                if (e.shiftKey) {
                    if (curIdx === state.start && state.pointer > 0) {
                        e.preventDefault();
                        $wrap.find(SEL.prev).trigger('click');

                        setTimeout(function () {
                            var s2 = $wrap.data(STATE_KEY);
                            if (!s2) return;
                            var $items2 = $wrap.find(SEL.list).first().children(SEL.item);
                            var $targetBtn = $items2.eq(s2.end).find(SEL.radioBtn);
                            if ($targetBtn.length) $targetBtn.focus();
                        }, 0);
                    }
                    return;
                }

                if (curIdx === state.end && state.end < state.total - 1) {
                    e.preventDefault();
                    $wrap.find(SEL.next).trigger('click');

                    // prev 처리 후 state 갱신되므로 다음 tick에 새 state 기준 focus
                    setTimeout(function () {
                        var s2 = $wrap.data(STATE_KEY);
                        if (!s2) return;
                        var $items2 = $wrap.find(SEL.list).first().children(SEL.item);
                        var $targetBtn = $items2.eq(s2.start).find(SEL.radioBtn);
                        if ($targetBtn.length) $targetBtn.focus();
                    }, 0);
                }
            });

            /* =======================================================
            * ArrowLeft/ArrowRight도 Tab처럼 동작 + 내부 이동
            * - 보이는 항목 내에서는 한 칸 이동
            * - 경계(첫/마지막 보이는 항목)에서는 prev/next 페이지 넘기고 포커스 이동
            * - 전체 첫/마지막에서는 바깥으로 나가게(= focus.js가 처리) 막지 않음
            * ======================================================= */
            $(document).off('keydown.filterArrowPaging', SEL.radioBtn).on('keydown.filterArrowPaging', SEL.radioBtn, function (e) {
                var key = e.key || e.code;
                if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;

                var $btn  = $(this);
                var $wrap = $btn.closest(SEL.wrap);
                var state = $wrap.data(STATE_KEY);
                if (!state) return;

                var $items = $wrap.find(SEL.list).first().children(SEL.item);
                var $visibleItems = $items.filter(':visible');
                var $curLi = $btn.closest('li');

                var curVisibleIdx = $visibleItems.index($curLi);
                if (curVisibleIdx < 0) return;

                var isLeft  = (key === 'ArrowLeft');
                var isRight = (key === 'ArrowRight');
                var curIdx  = $items.index($curLi);

                // 1) 보이는 목록 내 이동
                if (isRight && curVisibleIdx < $visibleItems.length - 1) {
                    e.preventDefault();
                    $visibleItems.eq(curVisibleIdx + 1).find(SEL.radioBtn).focus();
                    return;
                }
                if (isLeft && curVisibleIdx > 0) {
                    e.preventDefault();
                    $visibleItems.eq(curVisibleIdx - 1).find(SEL.radioBtn).focus();
                    return;
                }

                // 2) 경계에서 페이지 넘김
                if (isRight) {
                    if (curIdx === state.end && state.end >= state.total - 1) return; // 전체 마지막이면 바깥으로
                    if (curIdx === state.end && state.end < state.total - 1) {
                        e.preventDefault();
                        $wrap.find(SEL.next).trigger('click');

                        setTimeout(function () {
                            var s2 = $wrap.data(STATE_KEY);
                            if (!s2) return;
                            var $items2 = $wrap.find(SEL.list).first().children(SEL.item);
                            var $targetBtn = $items2.eq(s2.start).find(SEL.radioBtn);
                            if ($targetBtn.length) $targetBtn.focus();
                        }, 0);
                        return;
                    }
                }

                if (isLeft) {
                    if (curIdx === state.start && state.pointer === 0) return; // 전체 첫번째면 바깥으로
                    if (curIdx === state.start && state.pointer > 0) {
                        e.preventDefault();
                        $wrap.find(SEL.prev).trigger('click');

                        setTimeout(function () {
                            var s2 = $wrap.data(STATE_KEY);
                            if (!s2) return;
                            var $items2 = $wrap.find(SEL.list).first().children(SEL.item);
                            var $targetBtn = $items2.eq(s2.end).find(SEL.radioBtn);
                            if ($targetBtn.length) $targetBtn.focus();
                        }, 0);
                        return;
                    }
                }
            });

        });
    }

    // ===== prev/next 버튼 상태 갱신 =====
    function updateMoveButtons($wrap) {
        var state = $wrap.data(STATE_KEY);
        var $prev = $wrap.find(SEL.prev);
        var $next = $wrap.find(SEL.next);

        // 기본 초기화
        $prev.removeClass('is-disabled').removeAttr('aria-disabled');
        $next.removeClass('is-disabled').removeAttr('aria-disabled');

        if (!state) {
            $prev.addClass('is-disabled').attr('aria-disabled', 'true');
            $next.addClass('is-disabled').attr('aria-disabled', 'true');
            return;
        }

        // 첫 페이지면 prev 비활성
        if (state.pointer === 0) {
            $prev.addClass('is-disabled').attr('aria-disabled', 'true');
        }

        // 마지막 페이지면 next 비활성
        if (state.end >= state.total - 1) {
            $next.addClass('is-disabled').attr('aria-disabled', 'true');
        }
    }

    // ===== 주어진 startIdx부터 화면에 꽉 차게 li를 채워서 보여줌 =====
    // 반환값: { start: number, end: number }
    function renderFromStart($wrap, startIdx) {
        var $list  = $wrap.find(SEL.list).first();
        var $items = $list.children(SEL.item);
        var total  = $items.length;

        if (!total || startIdx >= total) {
            // 보여줄 게 없음
            $items.hide();
            return { start: total, end: total - 1 };
        }

        var maxWidth = $list.innerWidth();
        if (!maxWidth) {
            // 비정상 상황 방어
            $items.show();
            return { start: 0, end: total - 1 };
        }

        // flex gap 값 가져오기
        var listEl = $list.get(0);
        var gap = 0;
        if (listEl && window.getComputedStyle) {
            var cs = window.getComputedStyle(listEl);
            var gapStr = cs.columnGap || cs.gap || '0';
            var parsed = parseFloat(gapStr);
            if (!isNaN(parsed)) {
                gap = parsed; // px
            }
        }

        var TOL = 0.5; // 소수점 보정용 아주 작은 여유

        // 일단 전체 숨기고
        $items.hide();

        var currentWidth = 0;
        var endIdx = startIdx;

        for (var i = startIdx; i < total; i++) {
            var $li = $items.eq(i);

            // width를 재려면 일단 보여야 함
            $li.show();
            var itemWidth = $li.outerWidth(true);

            // 첫 아이템 이후부터 gap 추가
            var extraGap = (i === startIdx) ? 0 : gap;

            // 이미 하나 이상 들어간 상태에서, 이 아이템(+gap)을 더하면 넘치는지 체크
            if (currentWidth > 0 && (currentWidth + extraGap + itemWidth > maxWidth + TOL)) {
                // 넘치면 이 아이템은 다시 숨기고 종료
                $li.hide();
                break;
            }

            currentWidth += extraGap + itemWidth;
            endIdx = i;
        }

        // 혹시 첫 아이템만으로도 넘치는 경우: 첫 아이템은 무조건 보여준다.
        if (currentWidth === 0) {
            var $first = $items.eq(startIdx);
            $first.show();
            endIdx = startIdx;
        }

        return { start: startIdx, end: endIdx };
    }

    var isFilterPagingInit = false;

    // ===== 초기 상태 구성 + 레이아웃 재계산 =====
    function initFilterPaging() {
        var $wraps = $(SEL.wrap);

        // 처음 한 번만: 라디오/prev/next/스와이프 이벤트 바인딩
        if (!isFilterPagingInit) {
            // 1) 라디오 동작 세팅
            initFilterRadios($(document));

            // 2) prev 버튼 클릭
            $(document).on('click', SEL.prev, function () {
                var $wrap = $(this).closest(SEL.wrap);
                var state = $wrap.data(STATE_KEY);
                if (!state) return;

                if (state.pointer === 0) return; // 이미 첫 페이지

                state.pointer -= 1;
                var startIdx = state.starts[state.pointer];

                var page = renderFromStart($wrap, startIdx);
                state.start = page.start;
                state.end   = page.end;

                $wrap.data(STATE_KEY, state);
                updateMoveButtons($wrap);
            });

            // 3) next 버튼 클릭
            $(document).on('click', SEL.next, function () {
                var $wrap = $(this).closest(SEL.wrap);
                var state = $wrap.data(STATE_KEY);
                if (!state) return;

                // 이미 마지막 아이템까지 다 보여줬으면 더 갈 곳 없음
                if (state.end >= state.total - 1) return;

                // 이미 만들어둔 "다음 페이지"가 있는 경우 (뒤로 갔다가 다시 앞으로 가는 경우)
                if (state.pointer < state.starts.length - 1) {
                    state.pointer += 1;
                    var reuseStart = state.starts[state.pointer];
                    var reusedPage = renderFromStart($wrap, reuseStart);

                    state.start = reusedPage.start;
                    state.end   = reusedPage.end;

                    $wrap.data(STATE_KEY, state);
                    updateMoveButtons($wrap);
                    return;
                }

                // 새로운 페이지를 생성해야 하는 경우
                var newStartIdx = state.end + 1;
                if (newStartIdx >= state.total) return;

                var newPage = renderFromStart($wrap, newStartIdx);

                state.start = newPage.start;
                state.end   = newPage.end;
                state.starts.push(newPage.start);
                state.pointer = state.starts.length - 1;

                $wrap.data(STATE_KEY, state);
                updateMoveButtons($wrap);
            });

            /* =======================================================
             *   4) 좌/우 스와이프로 prev/next 트리거
             * - 현재 구조(hide/show 페이지) 유지
             * - ul 영역에서 좌/우 드래그하면 버튼 클릭처럼 동작
             * ======================================================= */
            (function bindFilterSwipePaging() {
                var supportsPointer = !!window.PointerEvent;

                function setSwipeState($el, obj) { $el.data('__swipeState', obj); }
                function getSwipeState($el) { return $el.data('__swipeState'); }

                function getPoint(e) {
                    // pointer/mouse
                    if (e.originalEvent && typeof e.originalEvent.clientX === 'number') {
                        return { x: e.originalEvent.clientX, y: e.originalEvent.clientY };
                    }
                    // touch
                    var oe = e.originalEvent || e;
                    var t = (oe.touches && oe.touches[0]) || (oe.changedTouches && oe.changedTouches[0]);
                    if (t) return { x: t.clientX, y: t.clientY };
                    return { x: 0, y: 0 };
                }

                function onStart(e) {
                    var $list = $(this);
                    var $wrap = $list.closest(SEL.wrap);

                    // paging state 없으면 무시
                    var pagingState = $wrap.data(STATE_KEY);
                    if (!pagingState) return;

                    // prev/next 버튼 위에서 시작은 제외(원하면 유지/삭제)
                    if ($(e.target).closest(SEL.prev + ',' + SEL.next).length) return;

                    var p = getPoint(e);
                    setSwipeState($list, {
                        sx: p.x,
                        sy: p.y,
                        locked: false,
                        canceled: false,
                        fired: false,
                        lastFireAt: 0
                    });
                }

                function onMove(e) {
                    var $list = $(this);
                    var st = getSwipeState($list);
                    if (!st || st.canceled || st.fired) return;

                    var p = getPoint(e);
                    var dx = p.x - st.sx;
                    var dy = p.y - st.sy;

                    // 방향 판정(초기)
                    if (!st.locked) {
                        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;

                        // 가로가 충분히 크면 스와이프로 락
                        if (Math.abs(dx) > Math.abs(dy) * H_RATIO) {
                            st.locked = true;
                        } else {
                            // 세로성 제스처면 취소 (스크롤 방해 X)
                            st.canceled = true;
                            setSwipeState($list, st);
                            return;
                        }
                    }

                    // 가로 스와이프 확정이면 스크롤 방지
                    if (e.cancelable) e.preventDefault();

                    // threshold 넘으면 한 번만 트리거
                    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
                        var now = Date.now();
                        if (now - st.lastFireAt < COOLDOWN_MS) return;

                        st.fired = true;
                        st.lastFireAt = now;
                        setSwipeState($list, st);

                        var $wrap = $list.closest(SEL.wrap);

                        // dx < 0: 왼쪽으로 밀기 => 다음
                        if (dx < 0) {
                            $wrap.find(SEL.next).trigger('click');
                        } else {
                            $wrap.find(SEL.prev).trigger('click');
                        }
                    }
                }

                function onEnd() {
                    $(this).removeData('__swipeState');
                }

                var LIST_SEL = SEL.wrap + ' ' + SEL.list; // ".filter-list-wrap .filter-list"

                if (supportsPointer) {
                    $(document)
                        .on('pointerdown.filterSwipe', LIST_SEL, onStart)
                        .on('pointermove.filterSwipe', LIST_SEL, onMove)
                        .on('pointerup.filterSwipe pointercancel.filterSwipe', LIST_SEL, onEnd);
                } else {
                    // 구형 WebView fallback
                    $(document)
                        .on('touchstart.filterSwipe', LIST_SEL, onStart)
                        .on('touchmove.filterSwipe', LIST_SEL, onMove)
                        .on('touchend.filterSwipe touchcancel.filterSwipe', LIST_SEL, onEnd);
                }
            })();

            isFilterPagingInit = true;
        }

        // === 여기부터는 호출할 때마다 "현재 레이아웃 기준"으로 다시 나눔 ===
        $wraps.each(function () {
            var $wrap  = $(this);
            var $list  = $wrap.find(SEL.list).first();
            var $items = $list.children(SEL.item);
            var total  = $items.length;

            if (!total) return;

            // === 01/12 추가 ===
            // active(선택된) li 인덱스 찾기 (없으면 0)
            var activeIdx = $items.index($items.filter('.is-active').first());
            if (activeIdx < 0) activeIdx = 0;

            // active가 포함된 "페이지"를 찾기 위해 starts를 순차 생성
            var starts = [];
            var pointer = 0;
            var found = false;

            var startIdx = 0;
            while (startIdx < total) {
                var page = renderFromStart($wrap, startIdx);
                starts.push(page.start);

                // active가 이 페이지 안에 있으면 stop
                if (activeIdx >= page.start && activeIdx <= page.end) {
                    pointer = starts.length - 1;

                    // 이 페이지를 최종으로 보여주도록 state 반영
                    var state = {
                        total: total,
                        start: page.start,
                        end:   page.end,
                        starts: starts,
                        pointer: pointer
                    };

                    $wrap.data(STATE_KEY, state);
                    $wrap.attr('data-filter-paging', '1');
                    updateMoveButtons($wrap);
                    found = true;
                    break; // while만 종료
                }

                // 다음 페이지로
                startIdx = page.end + 1;
            }
            // === 01/12 추가 끝===

            // found 없을 시 첫페이지로
            if (!found) {
                var firstPage = renderFromStart($wrap, 0);

                var state2 = {
                    total: total,
                    start: firstPage.start,
                    end:   firstPage.end,
                    starts: [firstPage.start],
                    pointer: 0
                };

                $wrap.data(STATE_KEY, state2);
                $wrap.attr('data-filter-paging', '1'); 
                updateMoveButtons($wrap);
            }
        });
    }

    // DOM 준비 시 1차 계산 + 폰트/로드/리사이즈 재계산
    $(function () {
        initFilterPaging();

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () {
                initFilterPaging();
            });
        }

        $(window).on('load', function () {
            initFilterPaging();
        });

        $(window).on('resize.filterList', function () {
            initFilterPaging();
        });
    });
});