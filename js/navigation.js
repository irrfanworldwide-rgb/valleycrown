function rootPath(path) {
  return path.startsWith('/') ? path : `/${path}`;
}

export async function inject(selector, path) {
  const el = document.querySelector(selector);
  if (!el) return;
  try {
    const response = await fetch(rootPath(path), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    el.innerHTML = await response.text();
  } catch (error) {
    console.warn('Component load failed:', path, error);
  }
}

export async function initNavigation() {
  await Promise.all([
    inject('[data-component="header"]', 'components/header.html'),
    inject('[data-component="footer"]', 'components/footer.html'),
    inject('[data-component="whatsapp"]', 'components/floating-whatsapp.html')
  ]);

  const current = location.pathname.replace(/\/+$/, '') || '/';
  const isHome = current === '/' || current === '/index.html';
  if (!isHome) {
    const backHome = document.createElement('a');
    backHome.className = 'home-cross';
    backHome.href = '/';
    backHome.setAttribute('aria-label', 'Back to home');
    backHome.setAttribute('title', 'Back to Home');
    backHome.innerHTML = '<span aria-hidden="true">←</span>';
    document.body.appendChild(backHome);
  }

  const toggle = document.querySelector('[data-mobile-toggle]');
  const menu = document.querySelector('[data-mobile-menu]');
  toggle?.addEventListener('click', () => {
    const willOpen = menu?.classList.contains('hide');
    menu?.classList.toggle('hide');
    toggle.setAttribute('aria-expanded', String(Boolean(willOpen)));
    toggle.textContent = willOpen ? '×' : '☰';
  });
}
