// 필터 버튼 좌우 이동
// 필터 버튼의 텍스트 길이에 따라 자동 정렬
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

                updateRestaurantPagination();
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

        // 처음 한 번만: 라디오/prev/next 이벤트 바인딩
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

            isFilterPagingInit = true;
        }

        // === 여기부터는 호출할 때마다 "현재 레이아웃 기준"으로 다시 나눔 ===
        $wraps.each(function () {
            var $wrap  = $(this);
            var $list  = $wrap.find(SEL.list).first();
            var $items = $list.children(SEL.item);
            var total  = $items.length;

            if (!total) return;

            // 항상 처음부터 다시 계산
            var firstPage = renderFromStart($wrap, 0);

            var state = {
                total: total,
                start: firstPage.start,
                end:   firstPage.end,
                starts: [firstPage.start],
                pointer: 0
            };

            $wrap.data(STATE_KEY, state);
            updateMoveButtons($wrap);
        });
    }


    $(function () {
        // DOM 준비 시 1차 계산
        initFilterPaging();

        // 웹폰트가 다 로딩된 후 한 번 더 계산
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () {
            initFilterPaging();
            });
        }

        // 이미지/레이아웃까지 모두 로딩 완료 후 한 번 더
        $(window).on('load', function () {
            initFilterPaging();
        });

        // 혹시나 화면 크기/모드(저시선 모드 등) 바뀔 때도 다시 계산
        $(window).on('resize.filterList', function () {
            initFilterPaging();
        });
    });


});
