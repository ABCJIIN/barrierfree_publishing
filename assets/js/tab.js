// 탭 버튼 선택 시 콘텐츠 변화
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-menu [role="tab"]');
    if (!btn) return;

    const tabMenu = btn.closest('.tab-menu');
    if (!tabMenu) return;

    // 이 tabMenu에 '직접' 소속된 탭만 대상으로 필터링
    const tabs = Array.from(
        tabMenu.querySelectorAll('[role="tab"]')
    ).filter(tab => tab.closest('.tab-menu') === tabMenu);

    // 이 tabMenu에 '직접' 소속된 패널만 대상으로 필터링
    const panels = Array.from(
        tabMenu.querySelectorAll('.tab-panel[role="tabpanel"]')
    ).filter(panel => panel.closest('.tab-menu') === tabMenu);

    // 1) 탭 비활성화
    tabs.forEach(tab => {
        tab.setAttribute('aria-selected', 'false');
        tab.closest('li')?.classList.remove('is-active');
    });

    // 2) 패널 비활성화
    panels.forEach(panel => {
        panel.classList.remove('is-active');
        panel.setAttribute('aria-hidden', 'true');
    });

    // 3) 클릭한 탭 활성화
    btn.setAttribute('aria-selected', 'true');
    btn.closest('li')?.classList.add('is-active');

    // 4) 해당 패널 활성화
    const panelId = btn.getAttribute('aria-controls');

    // 숫자로 시작하는 id도 고려해서, panels 배열에서 직접 찾기
    const panel = panels.find(p => p.id === panelId);
    if (panel) {
        panel.classList.add('is-active');
        panel.setAttribute('aria-hidden', 'false');
    }

    // updateTourPagination();
});
