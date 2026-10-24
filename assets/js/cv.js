document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('cvModal');
  if (!modal || typeof modal.showModal !== 'function') return;

  let alreadyShown = false;
  try {
    alreadyShown = sessionStorage.getItem('atg-cv-cta-seen') === '1';
  } catch (error) {
    /* storage may be blocked */
  }
  if (alreadyShown) return;

  let shown = false;
  let ticking = false;

  const showModal = () => {
    if (shown) return;
    shown = true;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    try {
      sessionStorage.setItem('atg-cv-cta-seen', '1');
    } catch (error) {
      /* storage may be blocked */
    }
    modal.showModal();
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= 0.8) showModal();
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  modal.addEventListener('click', event => {
    if (event.target === modal) modal.close();
  });
});
