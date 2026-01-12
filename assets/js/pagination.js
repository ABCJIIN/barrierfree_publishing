// empty 데이터 화면에서 페이지네이션 관리
function togglePagination($pagination, isEmpty) {
    if (!$pagination || !$pagination.length) return;

    if (isEmpty) {
        $pagination
            .addClass('is-hidden')
            .attr('aria-hidden', 'true');

        $pagination
            .find('button, [href], [tabindex]')
            .attr('tabindex', '-1');
    } else {
        $pagination
            .removeClass('is-hidden')
            .attr('aria-hidden', 'false');

        $pagination
            .find('button, [href], [tabindex]')
            .each(function () {
                $(this).removeAttr('tabindex');
            });
    }
}

// restaurant 전용
function updateRestaurantPagination() {
    var $main = $('.main.restaurant');
    if (!$main.length) return;

    var $pagination = $main.find('.pagination');
    if (!$pagination.length) return;

    var $panel = $main.find('.filter-panel').first();
    if (!$panel.length) {
        togglePagination($pagination, true);
        return;
    }

    var hasEmpty = $panel.find('.empty-screen:visible').length > 0;
    var hasCard  = $panel.find('.card-list .card:visible').length > 0;

    var isEmpty = hasEmpty || !hasCard;
    togglePagination($pagination, isEmpty);
}

// tour 전용
function updateTourPagination() {
    var $main = $('.main.tour');
    if (!$main.length) return;

    var $pagination = $main.find('.pagination');
    if (!$pagination.length) return;

    var $activePanel = $main.find('.tab-panel.is-active').first();
    if (!$activePanel.length) {
        togglePagination($pagination, true);
        return;
    }

    var hasEmpty = $activePanel.find('.empty-screen:visible').length > 0;
    var hasCard  = $activePanel.find('.card-list .card:visible').length > 0;

    var isEmpty = hasEmpty || !hasCard;
    togglePagination($pagination, isEmpty);
}

$(function () {
    updateRestaurantPagination();
    updateTourPagination();
});