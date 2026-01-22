// 커스텀 select
$(function () {
    initCustomSelect();
});

function initCustomSelect() {
    var $selects = $(".custom-select");
    var $dimmed = $(".sort-wrap .dimmed");
    var isLowPosture =
        $("html").hasClass("mode-low-posture") || $("body").hasClass("mode-low-posture");

    if (!$selects.length) return;

    var $currentOpenSelect = null;

    /* -----------------------------
    * 구조 파서 (현재 마크업 기준)
    * ----------------------------- */
    function getParts($select) {
        return {
            $trigger: $select.find(".select-item").first(),
            $wrap: $select.find(".option-list-wrap").first(),
            $controls: $select.find(".option-controls").first(),
            $prevWrap: $select.find(".option-controls .btn-wrap.prev").first(),
            $nextWrap: $select.find(".option-controls .btn-wrap.next").first(),
            $prevBtn: $select.find(".option-controls .prev-btn").first(),
            $nextBtn: $select.find(".option-controls .next-btn").first(),
            $scroll: $select.find(".option-scroll").first(),
            $list: $select.find(".option-list").first(),
            $hidden: $select.find('input[type="hidden"]').first()
        };
    }

    function getOptions($select) {
        var p = getParts($select);
        return p.$list.find('button[role="option"]');
    }

    /* -----------------------------
    * 포커스 이동 시 브라우저 자동 scrollIntoView 점프 방지
    * ----------------------------- */
    function focusPreventScroll($el, $scroll) {
        if (!$el || !$el.length) return;

        var hasScroll = $scroll && $scroll.length;
        var prevTop = hasScroll ? $scroll.scrollTop() : 0;

        var el = $el[0];

        try {
            el.focus({ preventScroll: true });
            } catch (err) {
            el.focus();
        }

        if (hasScroll) {
            $scroll.scrollTop(prevTop);
        }

        // 포커스 기반 TTS 트리거 
        if (window.speakIfNew) { try { window.speakIfNew(el); } catch(e) {} }
    }

    /* -----------------------------
    * wrap(순환) 시 스크롤을 edge로 이동
    * - top: 0
    * - bottom: maxScrollTop
    * ----------------------------- */
    function scrollToEdge($select, where /* "top" | "bottom" */) {
        var p = getParts($select);
        if (!p.$scroll.length) return;

        var el = p.$scroll[0];
        var maxTop = Math.max(0, el.scrollHeight - p.$scroll.innerHeight());

        var target = (where === "bottom") ? maxTop : 0;

        // 순환 시에는 "한 칸"이 아니라 즉시 edge로 맞추는 게 UX가 안정적
        p.$scroll.stop(true).scrollTop(target);
    }

    /* -----------------------------
    * listbox id / aria-controls 보정
    * ----------------------------- */
    function ensureListboxId($select, index) {
        var p = getParts($select);
        if (!p.$list.length || !p.$trigger.length) return;

        if (!p.$list.attr("id")) {
            p.$list.attr("id", "custom-select-list-" + (index + 1));
        }

        p.$trigger.attr({
            "aria-controls": p.$list.attr("id"),
            "aria-expanded": "false"
        });
    }

    /* -----------------------------
    * 선택 상태 정규화 + 트리거 텍스트 세팅
    * ----------------------------- */
    function normalizeActive($select) {
        var p = getParts($select);
        var $opts = getOptions($select);
        if (!$opts.length) return;

        var $active = $opts.filter('[aria-selected="true"]').first();
        if (!$active.length) $active = $opts.filter(".is-active").first();
        if (!$active.length) $active = $opts.eq(0);

        $opts.each(function () {
            var $o = $(this);
            var isSel = $o.is($active);
            $o.toggleClass("is-active", isSel)
                .attr("aria-selected", isSel ? "true" : "false")
                .closest("li")
                .toggleClass("is-active", isSel);
        });

        p.$trigger.text($.trim($active.text()));
    }

    /* -----------------------------
    * "한 칸" step 계산 (li 높이 + margin)
    * ----------------------------- */
    function getStep($select) {
        var $opts = getOptions($select);
        var $li = $opts.first().closest("li");
        if (!$li.length) return 0;
        return $li.outerHeight(true) || 0;
    }

    /* -----------------------------
    * 옵션이 scroll 영역에서 위/아래로 가려졌는지 판별
    * ----------------------------- */
    function getVisibilityDelta($scroll, $opt) {
        if (!$scroll.length || !$opt.length) return 0;

        var pad = 8;
        var s = $scroll[0].getBoundingClientRect();
        var o = $opt[0].getBoundingClientRect();

        if (o.bottom > s.bottom - pad) return 1;
        if (o.top < s.top + pad) return -1;
        return 0;
    }

    /* -----------------------------
    * "한 칸씩" 스크롤 보정 (점프 금지)
    * ----------------------------- */
    function revealByOneStep($select, $opt, dir /* "up" | "down" */) {
        var p = getParts($select);
        if (!p.$scroll.length || !$opt.length) return;

        var need = getVisibilityDelta(p.$scroll, $opt);
        if (need === 0) return;

        var step = getStep($select);
        if (!step) return;

        var cur = p.$scroll.scrollTop();
        var next = cur + (dir === "up" ? -step : step);
        if (next < 0) next = 0;

        p.$scroll.stop(true).animate({ scrollTop: next }, 80);
    }

    /* -----------------------------
    * 현재 스크롤 영역에서 "보이는 옵션 범위" 계산
    * - firstVisibleIdx: 위쪽에서 처음 보이는 옵션
    * - lastVisibleIdx : 아래쪽에서 마지막 보이는 옵션
    * ----------------------------- */
    function getVisibleRange($select) {
        var p = getParts($select);
        var $opts = getOptions($select);
        if (!p.$scroll.length || !$opts.length) return null;

        var pad = 8;
        var sRect = p.$scroll[0].getBoundingClientRect();

        var first = -1;
        var last = -1;

        $opts.each(function (i) {
            var r = this.getBoundingClientRect();

            // "보인다" 기준: 스크롤 박스와 겹치면(완전 노출 아니어도 OK)
            var visible = (r.bottom > sRect.top + pad) && (r.top < sRect.bottom - pad);
            if (!visible) return;

            if (first === -1) first = i;
            last = i;
        });

        if (first === -1) return null;
        return { firstVisibleIdx: first, lastVisibleIdx: last };
    }

    /* -----------------------------
    * 스크롤이 완전 top/bottom 인지(여유 오차 포함)
    * ----------------------------- */
    function isScrollAtEdge($scroll, where /* "top"|"bottom" */) {
        if (!$scroll || !$scroll.length) return true;

        var el = $scroll[0];
        var maxTop = Math.max(0, el.scrollHeight - $scroll.innerHeight());
        var cur = $scroll.scrollTop();
        var eps = 2; // 오차 허용

        if (where === "top") return cur <= eps;
        return cur >= (maxTop - eps);
    }

    /* -----------------------------
    * 저자세: prev/next 비활성화
    * ----------------------------- */
    function updateMoveBtnState($select) {
        if (!isLowPosture) return;

        var p = getParts($select);
        var $opts = getOptions($select);
        if (!p.$scroll.length || !$opts.length) return;

        var range = getVisibleRange($select);

        // 보이는 범위가 잡히지 않으면, 일단 edge 기준으로 처리
        var prevDisabled = !range ? isScrollAtEdge(p.$scroll, "top") : (range.firstVisibleIdx <= 0 && isScrollAtEdge(p.$scroll, "top"));
        var nextDisabled = !range ? isScrollAtEdge(p.$scroll, "bottom") : (range.lastVisibleIdx >= $opts.length - 1 && isScrollAtEdge(p.$scroll, "bottom"));

        if (p.$prevBtn.length) p.$prevBtn.prop("disabled", prevDisabled);
        if (p.$nextBtn.length) p.$nextBtn.prop("disabled", nextDisabled);

        if (p.$prevWrap.length) p.$prevWrap.toggleClass("is-disabled", prevDisabled);
        if (p.$nextWrap.length) p.$nextWrap.toggleClass("is-disabled", nextDisabled);
    }

    /* -----------------------------
    * 열기/닫기
    * ----------------------------- */
    function openSelect($select) {
        var p = getParts($select);
        if (!p.$trigger.length || !p.$wrap.length) return;

        closeAllSelects();
        $currentOpenSelect = $select;

        p.$trigger.addClass("on").attr("aria-expanded", "true");

        // controls는 Tab 포커스 제외
        p.$controls.find("button").attr("tabindex", "-1");

        // 스크롤 자연 동작 보장
        p.$scroll.css({
            "overflow-y": "scroll",
            "-webkit-overflow-scrolling": "touch",
            "touch-action": "pan-y"
        });

        p.$wrap.stop(true, true).slideDown(160);

        if ($dimmed.length) $dimmed.addClass("is-active");

        updateMoveBtnState($select);
    }

    function closeSelect($select) {
        var p = getParts($select);
        if (!p.$trigger.length || !p.$wrap.length) return;

        p.$trigger.removeClass("on").attr("aria-expanded", "false");

        p.$wrap.stop(true, true).slideUp(160, function () {
            p.$wrap.css("display", "none");
        });

        if ($dimmed.length) $dimmed.removeClass("is-active");

        if ($currentOpenSelect && $currentOpenSelect[0] === $select[0]) {
            $currentOpenSelect = null;
        }
    }

    function closeAllSelects() {
        $selects.each(function () {
            closeSelect($(this));
        });
    }

    function anyOpen() {
        var open = false;
        $selects.each(function () {
            if ($(this).find(".select-item").first().hasClass("on")) {
                open = true;
                return false;
            }
        });
        return open;
    }

    /* -----------------------------
    * 옵션 선택 처리
    * ----------------------------- */
    function handleOptionSelect($select, $opt) {
        var p = getParts($select);
        var $opts = getOptions($select);
        if (!$opts.length) return;

        $opts.each(function () {
        $(this)
            .removeClass("is-active")
            .attr("aria-selected", "false")
            .closest("li")
            .removeClass("is-active");
        });

        $opt
        .addClass("is-active")
        .attr("aria-selected", "true")
        .closest("li")
        .addClass("is-active");

        var id = $opt.data("city-id");
        if (p.$hidden.length && typeof id !== "undefined") {
            p.$hidden.val(id).trigger("change");
        }

        p.$trigger.text($.trim($opt.text()));

        closeAllSelects();
        p.$trigger.focus();

        if ($(".main.restaurant").length) updateRestaurantPagination();
        if ($(".main.tour").length) updateTourPagination();
    }

    /* -----------------------------
    * Tab/Shift+Tab: 옵션 내부 이동
    * - 무한 루프 제거: 끝에 도달하면 외부로 focus 이동
    * ----------------------------- */
    function cycleFocusWithinOptions($select, e) {
        var p = getParts($select);
        var $opts = getOptions($select);
        if (!$opts.length) return;

        var activeEl = document.activeElement;
        var $activeOpt = $(activeEl).is('button[role="option"]') ? $(activeEl) : null;
        var curIdx = $activeOpt && $activeOpt.length ? $opts.index($activeOpt) : -1;

        var backward = !!e.shiftKey;

        // [Case 1] 옵션 리스트 외부(Trigger 등)에서 Tab으로 처음 진입 시
        if (curIdx < 0) {
            e.preventDefault(); // 기본 동작 막고 강제 진입

            // Shift+Tab이면 마지막부터, Tab이면 처음부터 진입
            var entryIdx = backward ? ($opts.length - 1) : 0;

            // 진입 시 스크롤 위치 정렬
            scrollToEdge($select, backward ? "bottom" : "top");

            var $entry = $opts.eq(entryIdx);
            focusPreventScroll($entry, p.$scroll);
            updateMoveBtnState($select);
            return;
        }

        // [Case 2] 리스트의 끝/시작에서 Tab을 눌렀을 때 (루프 제거 & 탈출)
        if (!backward && curIdx === $opts.length - 1) {
            // 마지막 옵션에서 Tab -> 외부 다음 요소로 이동 (기본 동작 허용)
            // closeAllSelects(); // 목록 닫기
            return; 
        }

        if (backward && curIdx === 0) {
            // 첫 번째 옵션에서 Shift+Tab -> 외부 이전 요소(Trigger 등)로 이동 (기본 동작 허용)
            // closeAllSelects(); // 목록 닫기
            return;
        }

        // [Case 3] 리스트 내부에서 한 칸씩 이동
        e.preventDefault(); // 브라우저 기본 탭 이동 막음

        var nextIdx = backward ? (curIdx - 1) : (curIdx + 1);
        var $target = $opts.eq(nextIdx);

        focusPreventScroll($target, p.$scroll);

        // 한 칸씩 스크롤 보정
        revealByOneStep($select, $target, backward ? "up" : "down");
        updateMoveBtnState($select);
    }

    /* -----------------------------
    * 초기화
    * ----------------------------- */
    $selects.each(function (i) {
        var $select = $(this);
        ensureListboxId($select, i);
        normalizeActive($select);

        var p = getParts($select);

        // 스크롤 중에도 prev/next 상태 동기화
        if (p.$scroll.length) {
            p.$scroll.off("scroll.cs").on("scroll.cs", function () {
                updateMoveBtnState($select);
            });
        }

        // 저자세 prev/next 클릭 (클릭/터치 전용, wrap 없음)
        if (p.$prevBtn.length) {
            p.$prevBtn.off(".cs").on("click.cs", function (e) {
                e.preventDefault();
                if (!isLowPosture) return;

                var p = getParts($select);
                var $opts = getOptions($select);
                if (!p.$scroll.length || !$opts.length) return;

                var range = getVisibleRange($select);
                if (!range) { updateMoveBtnState($select); return; }

                // 현재 화면에서 "처음 보이는 옵션"의 이전 옵션이 1개 보이도록
                var targetIdx = range.firstVisibleIdx - 1;
                if (targetIdx < 0) { updateMoveBtnState($select); return; }

                var $target = $opts.eq(targetIdx);

                // 한 칸(step) 위로 이동 (요청사항: 한 옵션씩 노출)
                var step = getStep($select);
                if (step) {
                    var cur = p.$scroll.scrollTop();
                    var next = Math.max(0, cur - step);
                    p.$scroll.stop(true).animate({ scrollTop: next }, 80);
                }

                // 포커스도 같이 이동
                focusPreventScroll($target, p.$scroll);
                updateMoveBtnState($select);
            });
        }

        if (p.$nextBtn.length) {
            p.$nextBtn.off(".cs").on("click.cs", function (e) {
                e.preventDefault();
                if (!isLowPosture) return;

                var p = getParts($select);
                var $opts = getOptions($select);
                if (!p.$scroll.length || !$opts.length) return;

                var range = getVisibleRange($select);
                if (!range) { updateMoveBtnState($select); return; }

                // 현재 화면에서 "마지막 보이는 옵션" 다음 옵션이 1개 보이도록
                var targetIdx = range.lastVisibleIdx + 1;
                if (targetIdx > $opts.length - 1) { updateMoveBtnState($select); return; }

                var $target = $opts.eq(targetIdx);

                // 한 칸(step) 아래로 이동
                var step = getStep($select);
                if (step) {
                    var el = p.$scroll[0];
                    var maxTop = Math.max(0, el.scrollHeight - p.$scroll.innerHeight());
                    var cur = p.$scroll.scrollTop();
                    var next = Math.min(maxTop, cur + step);
                    p.$scroll.stop(true).animate({ scrollTop: next }, 80);
                }

                // 포커스도 같이 이동
                focusPreventScroll($target, p.$scroll);
                updateMoveBtnState($select);
            });
        }

        // trigger click
        p.$trigger.on("click", function (e) {
            e.preventDefault();
            if (p.$trigger.hasClass("on")) closeAllSelects();
            else openSelect($select);
        });

        // trigger keydown
        p.$trigger.on("keydown", function (e) {
            var key = e.key;

            if (key === "Enter" || key === " ") {
                e.preventDefault();

                if (p.$trigger.hasClass("on")) {
                closeAllSelects();
                } else {
                openSelect($select);

                var $opts = getOptions($select);
                var $current = $opts.filter('[aria-selected="true"]').first();
                if (!$current.length) $current = $opts.filter(".is-active").first();
                if (!$current.length) $current = $opts.first();

                if ($current.length) {
                        setTimeout(function () {
                        focusPreventScroll($current, p.$scroll);
                        updateMoveBtnState($select);
                        }, 0);
                    }
                }
            }

            if (key === "ArrowDown") {
                e.preventDefault();
                if (!p.$trigger.hasClass("on")) openSelect($select);

                var $opts2 = getOptions($select);
                var $first = $opts2.first();
                if ($first.length) {
                    // ArrowDown으로 진입할 땐 top으로 맞추는 게 자연스러움
                    scrollToEdge($select, "top");
                    focusPreventScroll($first, p.$scroll);
                    updateMoveBtnState($select);
                }
            }

            if (key === "Escape") {
                if (p.$trigger.hasClass("on")) {
                e.preventDefault();
                closeAllSelects();
                }
            }
        });

        // option events
        getOptions($select).each(function () {
            var $opt = $(this);

            $opt.on("click", function (e) {
                e.preventDefault();
                handleOptionSelect($select, $opt);
            });

            $opt.on("keydown", function (e) {
                var key = e.key;

                if (key === "Tab") {
                    cycleFocusWithinOptions($select, e);
                    return;
                }

                var $all = getOptions($select);
                var idx = $all.index($opt);

                // ←/→ = Tab/Shift+Tab (옵션 내부 이동), 단 경계에서는 바깥으로 탈출(이벤트 흘려보냄)
                // ←/→ = Shift+Tab/Tab 처럼 동작
                // - 옵션 내부 이동은 한 칸씩
                // - 첫 옵션에서 ← : trigger(select-item)로 올라감 (기존 동작 유지)
                // - 마지막 옵션에서 → : 바깥(다음 포커스)으로 나가야 하므로 여기서 "흘려보내고" focus.js가 처리하게 둠
                if (key === "ArrowRight" || key === "ArrowLeft") {
                    var isPrev = (key === "ArrowLeft");

                    // [Case A] 첫 옵션에서 ← : 트리거로 이동 (닫지 않음)
                    if (isPrev && idx === 0) {
                        e.preventDefault();
                        e.stopPropagation();
                        p.$trigger.focus(); // 기존 동작 유지
                        return;
                    }

                    // [Case B] 마지막 옵션에서 → : 바깥으로 탈출
                    // - 여기서는 막지 않는다 (preventDefault/stopPropagation 금지)
                    // - focus.js가 전역 "다음 요소"로 보내게 둔다
                    if (!isPrev && idx === $all.length - 1) {
                        return;
                    }

                    // [Case C] 옵션 내부에서 한 칸 이동
                    e.preventDefault();
                    e.stopPropagation();

                    var nextIdx = isPrev ? (idx - 1) : (idx + 1);
                    var $t = $all.eq(nextIdx);

                    focusPreventScroll($t, p.$scroll);
                    revealByOneStep($select, $t, isPrev ? "up" : "down");
                    updateMoveBtnState($select);
                    return;
                }

                if (key === "ArrowDown") {
                    e.preventDefault();
                    var next = idx + 1;

                    // ArrowDown wrap이면 top으로 스크롤도 함께
                    var didWrap = (next >= $all.length);
                    if (didWrap) {
                        next = 0;
                        scrollToEdge($select, "top");
                    }

                    var $t = $all.eq(next);
                    focusPreventScroll($t, p.$scroll);

                    if (!didWrap) revealByOneStep($select, $t, "down");
                    updateMoveBtnState($select);
                    return;
                }

                if (key === "ArrowUp") {
                    e.preventDefault();
                    var prev = idx - 1;

                    // ArrowUp wrap이면 bottom으로 스크롤도 함께
                    var didWrap2 = (prev < 0);
                    if (didWrap2) {
                        prev = $all.length - 1;
                        scrollToEdge($select, "bottom");
                    }

                    var $t2 = $all.eq(prev);
                    focusPreventScroll($t2, p.$scroll);

                    if (!didWrap2) revealByOneStep($select, $t2, "up");
                    updateMoveBtnState($select);
                    return;
                }

                if (key === "Enter" || key === " ") {
                    e.preventDefault();
                    handleOptionSelect($select, $opt);
                    return;
                }

                if (key === "Escape") {
                    e.preventDefault();
                    closeAllSelects();
                    p.$trigger.focus();
                }
            });

            $opt.on("focus", function () {
                updateMoveBtnState($select);
            });
        });
    });

    /* -----------------------------
    * dimmed / outside click
    * ----------------------------- */
    if ($dimmed.length) {
        $dimmed.on("click", function () {
            if (!isLowPosture && anyOpen()) closeAllSelects();
        });
    }

    $(document).on("click", function (e) {
        if (isLowPosture) return;

        var $t = $(e.target);

        if ($t.closest(".zoom-btn, .volume-control-btn").length) return;

        var inside = $t.closest(".custom-select").length > 0;
        var isDim = $t.closest(".dimmed").length > 0;

        if (!inside && !isDim && anyOpen()) {
            closeAllSelects();
        }
    });

    /* -----------------------------
    * 전역 포커스 트랩
    * ----------------------------- */
    $(document).on("keydown.customSelectTrap", function (e) {
        if (e.key !== "Tab") return;
        if (!$currentOpenSelect || !$currentOpenSelect.length) return;

        var $select = $currentOpenSelect;
        var p = getParts($select);

        if (!p.$trigger.hasClass("on")) return;

        // 중요: 이벤트가 "실제로 발생한 요소" 기준으로 판단해야 함
        // - focus.js가 캡처 단계에서 포커스를 옮긴 뒤(document.activeElement 변경)
        //   여기서 activeElement 기준으로 판단하면 첫 옵션으로 강제 진입하는 버그가 생김
        var targetEl = e.target;
        if (!targetEl) return;

        // 키다운이 셀렉트 바깥에서 발생했으면 트랩은 절대 개입하지 않는다.
        if (!$(targetEl).closest($select).length) return;

        // trigger에서 Tab/Shift+Tab은 "바깥으로 나가는" 게 정상 흐름(포커스 강제진입 금지)
        // (열려있어도 trigger에서 Tab을 누르면 다음/이전 포커싱 요소로 이동해야 함)
        if ($(targetEl).is(p.$trigger)) return;

        // 옵션 자체에서의 Tab은 옵션 keydown이 처리 중이므로 중복 개입 금지
        if ($(targetEl).is('button[role="option"]')) return;

        cycleFocusWithinOptions($select, e);
    });

}