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

  // ✅ 새 구조: wrap / scroll / list
  function getParts($select) {
    var $wrap = $select.find(".option-list-wrap").first();     // dropdown wrapper
    var $scroll = $select.find(".option-scroll").first();      // scroll container
    var $list = $select.find(".option-list").first();          // ul listbox
    var $controls = $select.find(".option-controls").first();  // controls row
    return { $wrap: $wrap, $scroll: $scroll, $list: $list, $controls: $controls };
  }

  function getOptions($select) {
    var p = getParts($select);
    return p.$list.find('button[role="option"]');
  }

  function ensureListboxId($select, index) {
    var p = getParts($select);
    var $list = p.$list;
    var $trigger = $select.find(".select-item").first();

    if (!$list.length || !$trigger.length) return;

    if (!$list.attr("id")) {
      $list.attr("id", "custom-select-list-" + (index + 1));
    }

    $trigger.attr({
      "aria-controls": $list.attr("id"),
      "aria-expanded": "false",
    });
  }

  // ✅ "한 칸(step)" 계산 (li 높이 + margin)
  function getStep($select) {
    var $opts = getOptions($select);
    var $li = $opts.first().closest("li");
    if (!$li.length) return 0;
    return $li.outerHeight(true) || 0;
  }

  // ✅ 스크롤 영역에서 옵션이 완전히 보이는지
  function isFullyVisible($scroll, $opt) {
    if (!$scroll.length || !$opt.length) return true;

    var pad = 8;
    var sRect = $scroll[0].getBoundingClientRect();
    var oRect = $opt[0].getBoundingClientRect();

    return (oRect.top >= sRect.top + pad) && (oRect.bottom <= sRect.bottom - pad);
  }

  // ✅ 필요한 경우에만, step 만큼만 scrollTop 이동 (점프 금지)
  function scrollOneStepIfNeeded($select, $opt, dir) {
    var p = getParts($select);
    var $scroll = p.$scroll;
    if (!$scroll.length || !$opt.length) return;

    if (isFullyVisible($scroll, $opt)) return;

    var step = getStep($select);
    if (!step) return;

    var cur = $scroll.scrollTop();
    var next = cur + (dir === "up" ? -step : step);
    if (next < 0) next = 0;

    $scroll.stop(true).animate({ scrollTop: next }, 90);
  }

  // ✅ 저자세: prev/next disabled 상태(첫 옵션에 포커스일 때만 prev disabled)
  function updateMoveBtnState($select) {
    if (!isLowPosture) return;

    var p = getParts($select);
    var $controls = p.$controls;
    if (!$controls.length) return;

    var $opts = getOptions($select);
    if (!$opts.length) return;

    var $focused = $(document.activeElement).is('button[role="option"]')
      ? $(document.activeElement)
      : $opts.filter('[aria-selected="true"]').first();

    if (!$focused.length) $focused = $opts.filter(".is-active").first();
    if (!$focused.length) $focused = $opts.first();

    var idx = $opts.index($focused);

    // controls에 is-disabled를 각각 주고 싶다면 구조를 나눠야 하지만,
    // 현재는 한 줄 controls라서 버튼에 클래스로 처리
    var $prev = $controls.find(".prev-btn");
    var $next = $controls.find(".next-btn");

    $prev.toggleClass("is-disabled", idx === 0);
    $next.toggleClass("is-disabled", idx === $opts.length - 1);

    // 클릭 막기 (CSS pointer-events 대신 JS 방어)
    $prev.prop("disabled", idx === 0);
    $next.prop("disabled", idx === $opts.length - 1);
  }

  // 초기 선택 상태 정규화 + 트리거 텍스트 세팅
  $selects.each(function (idx) {
    var $select = $(this);
    ensureListboxId($select, idx);

    var p = getParts($select);
    var $list = p.$list;
    var $trigger = $select.find(".select-item").first();
    if (!$list.length || !$trigger.length) return;

    var $opts = getOptions($select);
    if (!$opts.length) return;

    var $active = $opts.filter('[aria-selected="true"]').first();
    if (!$active.length) $active = $opts.filter(".is-active").first();
    if (!$active.length) $active = $opts.eq(0);

    $opts.each(function () {
      var $o = $(this);
      var isSelected = $o.is($active);
      $o.toggleClass("is-active", isSelected)
        .attr("aria-selected", isSelected ? "true" : "false")
        .closest("li")
        .toggleClass("is-active", isSelected);
    });

    $trigger.text($.trim($active.text()));
  });

  function openSelect($select) {
    var $trigger = $select.find(".select-item").first();
    var p = getParts($select);
    var $wrap = p.$wrap;

    if (!$trigger.length || !$wrap.length) return;

    closeAllSelects();
    $currentOpenSelect = $select;

    $trigger.addClass("on").attr("aria-expanded", "true");

    // ✅ controls는 Tab 포커스 제외(옵션 내부 순환 요구사항)
    var $controls = p.$controls;
    $controls.find("button").attr("tabindex", "-1");

    // ✅ 스크롤 자연 동작 보장
    p.$scroll.css({
      "overflow-y": "auto",
      "-webkit-overflow-scrolling": "touch",
      "touch-action": "pan-y"
    });

    $wrap.stop(true, true).slideDown(160);
    if ($dimmed.length) $dimmed.addClass("is-active");

    // 저자세 버튼 상태 갱신
    updateMoveBtnState($select);
  }

  function closeSelect($select) {
    var $trigger = $select.find(".select-item").first();
    var p = getParts($select);
    var $wrap = p.$wrap;

    if (!$trigger.length || !$wrap.length) return;

    $trigger.removeClass("on").attr("aria-expanded", "false");

    $wrap.stop(true, true).slideUp(160, function () {
      $wrap.css("display", "none");
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

  function handleOptionSelect($select, $opt) {
    var $trigger = $select.find(".select-item").first();
    var $opts = getOptions($select);

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

    $trigger.text($.trim($opt.text()));

    closeAllSelects();
    $trigger.focus();

    if ($(".main.restaurant").length) updateRestaurantPagination();
    if ($(".main.tour").length) updateTourPagination();
  }

  // ✅ Tab/Shift+Tab: 옵션 내부에서만 순환 + 가려진 옵션이면 한 칸씩 스크롤
  function handleTabCycle($select, e) {
    var $opts = getOptions($select);
    if (!$opts.length) return;

    var activeEl = document.activeElement;
    var $activeOpt = $(activeEl).is('button[role="option"]') ? $(activeEl) : null;
    var curIdx = $activeOpt && $activeOpt.length ? $opts.index($activeOpt) : -1;

    var dir = e.shiftKey ? -1 : 1;

    e.preventDefault();

    // 옵션 밖에서 탭이 들어온 경우: 첫/마지막 옵션으로 진입
    if (curIdx < 0) {
      var entryIdx = e.shiftKey ? ($opts.length - 1) : 0;
      var $targetEntry = $opts.eq(entryIdx);
      $targetEntry.focus();

      // 엔트리 이동 시에는 "필요하면" 한칸 스크롤
      scrollOneStepIfNeeded($select, $targetEntry, e.shiftKey ? "up" : "down");
      updateMoveBtnState($select);
      return;
    }

    var nextIdx = curIdx + dir;

    // 순환: 첫에서 Shift+Tab -> 마지막, 마지막에서 Tab -> 첫
    if (nextIdx < 0) nextIdx = $opts.length - 1;
    if (nextIdx >= $opts.length) nextIdx = 0;

    var $target = $opts.eq(nextIdx);
    $target.focus();

    // ✅ 핵심: 점프 금지. 가려져있으면 "한 칸"만 움직여서 보여주기
    scrollOneStepIfNeeded($select, $target, dir === -1 ? "up" : "down");

    updateMoveBtnState($select);
  }

  // 이벤트 바인딩
  $selects.each(function () {
    var $select = $(this);
    var $trigger = $select.find(".select-item").first();
    var p = getParts($select);

    if (!$trigger.length || !p.$wrap.length || !p.$list.length) return;

    // trigger click
    $trigger.on("click", function (e) {
      e.preventDefault();
      if ($trigger.hasClass("on")) closeAllSelects();
      else openSelect($select);
    });

    // trigger keydown
    $trigger.on("keydown", function (e) {
      var key = e.key;

      if (key === "Enter" || key === " ") {
        e.preventDefault();

        if ($trigger.hasClass("on")) {
          closeAllSelects();
        } else {
          openSelect($select);

          // 열린 후 선택 옵션에 포커스
          var $opts = getOptions($select);
          var $current = $opts.filter('[aria-selected="true"]').first();
          if (!$current.length) $current = $opts.filter(".is-active").first();
          if (!$current.length) $current = $opts.first();

          if ($current.length) {
            setTimeout(function () {
              $current.focus();
              updateMoveBtnState($select);
            }, 0);
          }
        }
      }

      if (key === "ArrowDown") {
        e.preventDefault();
        if (!$trigger.hasClass("on")) openSelect($select);

        var $opts2 = getOptions($select);
        var $first = $opts2.first();
        if ($first.length) {
          $first.focus();
          scrollOneStepIfNeeded($select, $first, "down");
          updateMoveBtnState($select);
        }
      }

      if (key === "Escape") {
        if ($trigger.hasClass("on")) {
          e.preventDefault();
          closeAllSelects();
        }
      }

      // ✅ 트리거에 포커스 있을 때 Tab도 옵션 내부로 진입시키려면 전역 트랩에서 처리(아래)
    });

    // option click/keydown
    var $opts = getOptions($select);

    $opts.each(function () {
      var $opt = $(this);

      $opt.on("click", function (e) {
        e.preventDefault();
        handleOptionSelect($select, $opt);
      });

      $opt.on("keydown", function (e) {
        var key = e.key;

        if (key === "Tab") {
          handleTabCycle($select, e);
          return;
        }

        var $all = getOptions($select);
        var idx = $all.index($opt);

        if (key === "ArrowDown") {
          e.preventDefault();
          var next = idx + 1;
          if (next >= $all.length) next = 0;
          var $t = $all.eq(next);
          $t.focus();
          scrollOneStepIfNeeded($select, $t, "down");
          updateMoveBtnState($select);
          return;
        }

        if (key === "ArrowUp") {
          e.preventDefault();
          var prev = idx - 1;
          if (prev < 0) prev = $all.length - 1;
          var $t2 = $all.eq(prev);
          $t2.focus();
          scrollOneStepIfNeeded($select, $t2, "up");
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
          $trigger.focus();
        }
      });

      $opt.on("focus", function () {
        updateMoveBtnState($select);
      });
    });

    // ✅ low posture prev/next click (클릭/터치 전용)
    p.$controls.find(".prev-btn").off(".lp").on("click.lp", function (e) {
      e.preventDefault();
      if (!isLowPosture) return;

      var $all = getOptions($select);
      var $focused = $(document.activeElement).is('button[role="option"]')
        ? $(document.activeElement)
        : $all.filter('[aria-selected="true"]').first();

      if (!$focused.length) $focused = $all.filter(".is-active").first();
      if (!$focused.length) $focused = $all.first();

      var idx = $all.index($focused);
      if (idx <= 0) { updateMoveBtnState($select); return; }

      var $t = $all.eq(idx - 1);
      $t.focus();
      scrollOneStepIfNeeded($select, $t, "up");
      updateMoveBtnState($select);
    });

    p.$controls.find(".next-btn").off(".lp").on("click.lp", function (e) {
      e.preventDefault();
      if (!isLowPosture) return;

      var $all = getOptions($select);
      var $focused = $(document.activeElement).is('button[role="option"]')
        ? $(document.activeElement)
        : $all.filter('[aria-selected="true"]').first();

      if (!$focused.length) $focused = $all.filter(".is-active").first();
      if (!$focused.length) $focused = $all.first();

      var idx = $all.index($focused);
      if (idx >= $all.length - 1) { updateMoveBtnState($select); return; }

      var $t = $all.eq(idx + 1);
      $t.focus();
      scrollOneStepIfNeeded($select, $t, "down");
      updateMoveBtnState($select);
    });

    // ✅ 스크롤 이벤트를 막는 상위 핸들러가 있을 때 대비(방어)
    // (여기서 preventDefault 하지 않고 stopPropagation만)
    p.$scroll.off(".allowScroll").on("wheel.allowScroll touchmove.allowScroll", function (ev) {
      ev.stopPropagation();
    });
  });

  // dimmed 클릭 닫기 (일반모드만)
  if ($dimmed.length) {
    $dimmed.on("click", function () {
      if (!isLowPosture && anyOpen()) closeAllSelects();
    });
  }

  // 바깥 클릭 닫기 (일반모드만)
  $(document).on("click", function (e) {
    if (isLowPosture) return;

    var $t = $(e.target);

    if ($t.closest(".zoom-btn, .volume-control-btn").length) return;

    var inside = $t.closest(".custom-select").length > 0;
    var isDimmed = $t.closest(".dimmed").length > 0;

    if (!inside && !isDimmed && anyOpen()) closeAllSelects();
  });

  // ✅ 전역 포커스 트랩: 드롭다운이 열려있으면 옵션 내부로만 Tab 순환
  $(document).on("keydown.customSelectTrap", function (e) {
    if (e.key !== "Tab") return;
    if (!$currentOpenSelect || !$currentOpenSelect.length) return;

    var $select = $currentOpenSelect;
    var $trigger = $select.find(".select-item").first();
    if (!$trigger.hasClass("on")) return;

    // 옵션 위에서의 Tab은 각 옵션 keydown에서 처리
    if ($(document.activeElement).is('button[role="option"]')) return;

    // 그 외(트리거/controls/다른 요소)에 Tab이 와도 옵션 순환으로 강제
    handleTabCycle($select, e);
  });
}
