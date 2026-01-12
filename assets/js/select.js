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
    * 저자세: prev/next 비활성화
    * ----------------------------- */
    function updateMoveBtnState($select) {
        if (!isLowPosture) return;

        var p = getParts($select);
        var $opts = getOptions($select);
        if (!$opts.length) return;

        var $focused = $(document.activeElement).is('button[role="option"]')
        ? $(document.activeElement)
        : $opts.filter('[aria-selected="true"]').first();

        if (!$focused.length) $focused = $opts.filter(".is-active").first();
        if (!$focused.length) $focused = $opts.first();

        var idx = $opts.index($focused);
        var isFirst = idx === 0;
        var isLast = idx === $opts.length - 1;

        if (p.$prevBtn.length) p.$prevBtn.prop("disabled", isFirst);
        if (p.$nextBtn.length) p.$nextBtn.prop("disabled", isLast);

        if (p.$prevWrap.length) p.$prevWrap.toggleClass("is-disabled", isFirst);
        if (p.$nextWrap.length) p.$nextWrap.toggleClass("is-disabled", isLast);
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
    * Tab/Shift+Tab: 옵션 내부 순환
    * - wrap 순간에는 스크롤도 edge로 같이 이동
    * ----------------------------- */
    function cycleFocusWithinOptions($select, e) {
        var p = getParts($select);
        var $opts = getOptions($select);
        if (!$opts.length) return;

        var activeEl = document.activeElement;
        var $activeOpt = $(activeEl).is('button[role="option"]') ? $(activeEl) : null;
        var curIdx = $activeOpt && $activeOpt.length ? $opts.index($activeOpt) : -1;

        var backward = !!e.shiftKey;
        e.preventDefault();

        // 옵션이 아닌 곳에서 Tab 진입:
        if (curIdx < 0) {
            var entryIdx = backward ? ($opts.length - 1) : 0;

            // 진입도 edge 정렬(특히 Shift+Tab으로 마지막 진입 시 아래로 맞춤)
            scrollToEdge($select, backward ? "bottom" : "top");

            var $entry = $opts.eq(entryIdx);
            focusPreventScroll($entry, p.$scroll);
            updateMoveBtnState($select);
            return;
        }

        var nextIdx = backward ? (curIdx - 1) : (curIdx + 1);

        // wrap 발생 여부 판단
        var didWrapToStart = (!backward && curIdx === $opts.length - 1);
        var didWrapToEnd   = (backward && curIdx === 0);

        if (nextIdx < 0) nextIdx = $opts.length - 1;
        if (nextIdx >= $opts.length) nextIdx = 0;

        // wrap이면 스크롤도 같이 edge로 이동
        if (didWrapToStart) {
            scrollToEdge($select, "top");
        } else if (didWrapToEnd) {
            scrollToEdge($select, "bottom");
        }

        var $target = $opts.eq(nextIdx);
        focusPreventScroll($target, p.$scroll);

        // wrap이 아닐 때만 "한 칸" 보정
        if (!didWrapToStart && !didWrapToEnd) {
            revealByOneStep($select, $target, backward ? "up" : "down");
        }

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

        // 저자세 prev/next 클릭 (클릭/터치 전용, wrap 없음)
        if (p.$prevBtn.length) {
            p.$prevBtn.off(".cs").on("click.cs", function (e) {
                e.preventDefault();
                if (!isLowPosture) return;

                var $opts = getOptions($select);
                if (!$opts.length) return;

                var $focused = $(document.activeElement).is('button[role="option"]')
                ? $(document.activeElement)
                : $opts.filter('[aria-selected="true"]').first();

                if (!$focused.length) $focused = $opts.filter(".is-active").first();
                if (!$focused.length) $focused = $opts.first();

                var idx = $opts.index($focused);
                if (idx <= 0) {
                    updateMoveBtnState($select);
                    return;
                }

                var $t = $opts.eq(idx - 1);
                focusPreventScroll($t, p.$scroll);
                revealByOneStep($select, $t, "up");
                updateMoveBtnState($select);
            });
        }

        if (p.$nextBtn.length) {
            p.$nextBtn.off(".cs").on("click.cs", function (e) {
                e.preventDefault();
                if (!isLowPosture) return;

                var $opts = getOptions($select);
                if (!$opts.length) return;

                var $focused = $(document.activeElement).is('button[role="option"]')
                ? $(document.activeElement)
                : $opts.filter('[aria-selected="true"]').first();

                if (!$focused.length) $focused = $opts.filter(".is-active").first();
                if (!$focused.length) $focused = $opts.first();

                var idx = $opts.index($focused);
                if (idx >= $opts.length - 1) {
                    updateMoveBtnState($select);
                return;
                }

                var $t = $opts.eq(idx + 1);
                focusPreventScroll($t, p.$scroll);
                revealByOneStep($select, $t, "down");
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

        if ($(document.activeElement).is('button[role="option"]')) return;

        cycleFocusWithinOptions($select, e);
    });
}