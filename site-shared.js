(function () {
  const WA_PHONE = '5519992591776';
  const WA_MSG = {
    general: 'Olá, Ana! Vim pelo site e gostaria de saber mais sobre o acompanhamento nutricional.',
    transformar: 'Olá, Ana! Tenho interesse no Plano Transformar de 3 meses. Pode me passar mais informações?',
  };

  function track(eventName, params) {
    if (typeof window.trackEvent === 'function') {
      window.trackEvent(eventName, params);
    } else if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params || {});
    }
  }

  document.querySelectorAll('[data-wa]').forEach((el) => {
    const key = el.getAttribute('data-wa') || 'general';
    const text = WA_MSG[key] || WA_MSG.general;
    el.href = 'https://wa.me/' + WA_PHONE + '?text=' + encodeURIComponent(text);
    if (!el.getAttribute('target')) {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    el.addEventListener('click', () => {
      track('click_whatsapp', { wa_type: key });
    });
  });

  document.querySelectorAll('a[href*="wa.me"]').forEach((el) => {
    if (el.hasAttribute('data-wa')) return;
    el.addEventListener('click', () => {
      track('click_whatsapp', { wa_type: 'footer' });
    });
  });

  document.addEventListener(
    'click',
    (event) => {
      const host = event.target.closest('.gcal-schedule-host');
      if (!host) return;
      track('click_agendar', {
        gcal_label: host.getAttribute('data-gcal-label') || 'Agendar',
      });
    },
    true
  );

  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
  }

  function initMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const menu = document.getElementById('nav-menu');
    if (!toggle || !menu) return;

    const mq = window.matchMedia('(min-width: 901px)');

    function closeMenu() {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menu');
      document.body.classList.remove('nav-open');
    }

    function openMenu() {
      menu.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Fechar menu');
      document.body.classList.add('nav-open');
    }

    function syncLayout() {
      if (mq.matches) closeMenu();
    }

    toggle.addEventListener('click', () => {
      if (menu.classList.contains('is-open')) closeMenu();
      else openMenu();
    });

    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        if (!mq.matches) closeMenu();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });

    mq.addEventListener('change', syncLayout);
    syncLayout();
  }

  const GCAL_SCHEDULE_URL =
    'https://calendar.google.com/calendar/appointments/AcZssZ0dGAXsBGvjWRiKiPCUCTKC4DncZaVeOFMWxT0=?gv=true';

  function initGoogleSchedulingButtons() {
    if (!window.calendar || !calendar.schedulingButton) return false;
    document.querySelectorAll('.gcal-schedule-host').forEach((host) => {
      if (host.dataset.gcalInitialized) return;
      host.dataset.gcalInitialized = '1';
      const marker = document.createElement('span');
      marker.className = 'gcal-schedule-marker';
      marker.setAttribute('aria-hidden', 'true');
      host.appendChild(marker);
      calendar.schedulingButton.load({
        url: GCAL_SCHEDULE_URL,
        color: '#6E3B46',
        label: host.getAttribute('data-gcal-label') || 'Agendar',
        target: marker,
      });
    });
    return true;
  }

  function ensureGoogleSchedulingButtons() {
    if (initGoogleSchedulingButtons()) return;
    let n = 0;
    const id = setInterval(() => {
      if (initGoogleSchedulingButtons() || ++n > 100) clearInterval(id);
    }, 50);
  }

  function onPageReady() {
    ensureGoogleSchedulingButtons();
  }

  document.addEventListener('page-ready', onPageReady);
  if (!document.body.classList.contains('is-page-loading')) {
    onPageReady();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
  } else {
    initMobileNav();
  }
})();
