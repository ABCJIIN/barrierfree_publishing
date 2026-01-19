$(function () {
    updateInfoListSubwayClass();

    // 혹시 ajax/템플릿으로 내용이 나중에 바뀌는 케이스가 있으면,
    // 필요 시 아래를 호출해주면 됨:
    // updateInfoListSubwayClass();
    });

    function updateInfoListSubwayClass() {
    var CLASS_NAME = 'subway-multi'; // 추가할 클래스명
    var MIN_COUNT = 4;

    $('.info-list').each(function () {
        var $list = $(this);

        // row04는 제외
        if ($list.hasClass('row04')) return;

        // subway 개수 카운트
        var subwayCount = $list.find('.info-desc.subway').length;

        // 4개 이상일 때만 클래스 on
        $list.toggleClass(CLASS_NAME, subwayCount >= MIN_COUNT);
    });
}
