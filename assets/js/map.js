// map.js
(function () {

    let map = null;
    let marker = null;

    function initMap() {
        const container = document.getElementById('kakaoMap');
        if (!container || !window.TOUR_LOCATION) return;

        const { lat, lng, title } = window.TOUR_LOCATION;

        const center = new kakao.maps.LatLng(lat, lng);

        map = new kakao.maps.Map(container, {
            center,
            level: 3
        });

        marker = new kakao.maps.Marker({
            position: center,
            title
        });

        marker.setMap(map);

        // 🔑 전역 노출 (중요)
        window.kakaoMap = map;
    }

    // autoload=false 대응
    if (window.kakao && kakao.maps) {
        kakao.maps.load(initMap);
    } else {
        console.error('Kakao Maps SDK not loaded');
    }

})();
