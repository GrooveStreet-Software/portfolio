document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const toggle = document.getElementById('menuToggle');
  const menu = document.getElementById('navMenu');

  function setMenu(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
  }

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });

    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => setMenu(false));
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') setMenu(false);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 860) setMenu(false);
    });
  }

  const revealItems = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach(item => item.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealItems.forEach(item => revealObserver.observe(item));
  }

  const scrambleEl = document.querySelector('.scramble');
  if (scrambleEl && !reduceMotion) {
    const finalText = scrambleEl.dataset.text || scrambleEl.textContent;
    const glyphs = '0123456789ABCDEF';
    const lockWidth = () => {
      scrambleEl.style.width = `${Math.ceil(scrambleEl.getBoundingClientRect().width)}px`;
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(lockWidth);
    } else {
      lockWidth();
    }
    const scrambleOnce = () => {
      let step = 0;
      const total = 12;
      const interval = setInterval(() => {
        step += 1;
        if (step >= total) {
          scrambleEl.textContent = finalText;
          clearInterval(interval);
          return;
        }
        scrambleEl.textContent = finalText
          .split('')
          .map((letter, index) => (index < step / 2 ? letter : glyphs[Math.floor(Math.random() * glyphs.length)]))
          .join('');
      }, 45);
    };
    window.setTimeout(() => {
      scrambleOnce();
      window.setInterval(scrambleOnce, 5200);
    }, 900);
  }

  const navLinks = Array.from(document.querySelectorAll('.nav-link'));
  const spyTargets = navLinks
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if (spyTargets.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
        });
      });
    }, { rootMargin: '-42% 0px -52% 0px', threshold: 0 });

    spyTargets.forEach(section => spy.observe(section));
  }

  const numberFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
  const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  function relativeTime(date) {
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const units = [
      ['year', 31536000],
      ['month', 2592000],
      ['week', 604800],
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60]
    ];
    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size || unit === 'minute') {
        return relativeFormat.format(Math.round(seconds / size), unit);
      }
    }
    return 'just now';
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(node => {
      node.textContent = value;
    });
  }

  const GITHUB_USER = 'Jacked-cpu';
  const CACHE_KEY = 'atg-github-stats-v1';
  const CACHE_TTL = 10 * 60 * 1000;

  function applyGithub(user, repos) {
    if (!user || !Array.isArray(repos)) return;
    const sorted = [...repos].sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

    setText('[data-live="repos"]', String(user.public_repos ?? sorted.length));
    if (sorted[0]) {
      setText('[data-live="latestRepo"]', sorted[0].name);
      setText('[data-live="lastPush"]', relativeTime(new Date(sorted[0].pushed_at)));
      const updated = document.querySelector('[data-repo-updated]');
      if (updated) updated.textContent = `Updated ${relativeTime(new Date(sorted[0].pushed_at))}`;
    }

    const languages = repos.reduce((acc, repo) => {
      if (repo.language) acc[repo.language] = (acc[repo.language] || 0) + 1;
      return acc;
    }, {});
    const topLanguage = Object.keys(languages).sort((a, b) => languages[b] - languages[a])[0];
    if (topLanguage) setText('[data-live="language"]', topLanguage);

    document.querySelectorAll('[data-repo]').forEach(card => {
      const repo = sorted.find(item => item.full_name.toLowerCase() === card.dataset.repo.toLowerCase());
      if (!repo) return;
      const stars = card.querySelector('[data-repo-stars]');
      if (stars) {
        if (repo.stargazers_count > 0) {
          stars.textContent = `${numberFormat.format(repo.stargazers_count)} stars`;
        } else if (repo.fork) {
          stars.textContent = 'Fork';
        } else {
          stars.textContent = 'Public';
        }
      }
      const updated = card.querySelector('[data-repo-updated]');
      if (updated) updated.textContent = `Updated ${relativeTime(new Date(repo.pushed_at))}`;
    });
  }

  async function loadGithubStats() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        applyGithub(cached.user, cached.repos);
        return;
      }
    } catch (error) {
      /* cache unavailable or malformed */
    }

    try {
      const headers = { Accept: 'application/vnd.github+json' };
      const [userResponse, reposResponse] = await Promise.all([
        fetch(`https://api.github.com/users/${GITHUB_USER}`, { headers }),
        fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=pushed`, { headers })
      ]);
      if (!userResponse.ok || !reposResponse.ok) return;
      const user = await userResponse.json();
      const repos = await reposResponse.json();
      applyGithub(user, repos);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), user, repos }));
      } catch (error) {
        /* storage may be full or blocked */
      }
    } catch (error) {
      /* keep the static fallback values */
    }
  }

  loadGithubStats();

  async function loadVisitCount() {
    const el = document.querySelector('[data-visitor-count]');
    if (!el) return;
    let counted = false;
    try {
      counted = sessionStorage.getItem('atg-visit-counted') === '1';
    } catch (error) {
      /* storage may be blocked */
    }
    const action = counted ? 'get' : 'hit';
    try {
      const response = await fetch(`https://countapi.mileshilliard.com/api/v1/${action}/atg-portfolio-visits-2026`, { cache: 'no-store' });
      if (!response.ok) throw new Error('counter unavailable');
      const data = await response.json();
      const value = Number(data.value);
      el.textContent = Number.isFinite(value) ? String(value).padStart(6, '0') : '------';
      try {
        sessionStorage.setItem('atg-visit-counted', '1');
      } catch (error) {
        /* storage may be blocked */
      }
    } catch (error) {
      /* keep placeholder */
    }
  }

  loadVisitCount();

  const form = document.getElementById('contactForm');
  const formNote = document.getElementById('formNote');
  if (form) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const email = String(data.get('email') || '').trim();
      const message = String(data.get('message') || '').trim();
      const subject = encodeURIComponent(`Portfolio enquiry from ${name}`);
      const body = encodeURIComponent(`${message}\n\nFrom: ${name}\nReply to: ${email}`);
      if (formNote) formNote.textContent = 'Opening your email app with the message ready to send.';
      window.location.href = `mailto:atgodoch@gmail.com?subject=${subject}&body=${body}`;
      setTimeout(() => {
        if (formNote) formNote.textContent = 'Opens your email app with the message ready to send.';
        form.reset();
      }, 2500);
    });
  }
});
