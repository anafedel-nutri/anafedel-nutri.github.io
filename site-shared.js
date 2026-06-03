(function () {
  const LOGO_SRC = /logo(-s)?\.svg(\?.*)?$/i;

  function isLogoImage(img) {
    if (img.getAttribute('aria-hidden') === 'true') return true;
    if (img.closest('.nav-logo')) return true;
    const src = (img.getAttribute('src') || '').split('/').pop() || '';
    return LOGO_SRC.test(src);
  }

  function getImageShield(img) {
    const parent = img.parentElement;
    if (parent && parent.tagName === 'PICTURE') return parent;
    if (parent && parent.classList.contains('about-img')) return parent;
    return null;
  }

  function initImageProtection() {
    document.querySelectorAll('img').forEach((img) => {
      if (isLogoImage(img) || img.dataset.protected === '1') return;

      img.dataset.protected = '1';
      img.draggable = false;
      img.setAttribute('draggable', 'false');

      let shield = getImageShield(img);
      if (!shield) {
        if (img.parentElement && img.parentElement.classList.contains('img-protected-wrap')) {
          shield = img.parentElement;
        } else {
          const wrap = document.createElement('span');
          wrap.className = 'img-protected img-protected-wrap';
          img.replaceWith(wrap);
          wrap.appendChild(img);
          shield = wrap;
        }
      }

      shield.classList.add('img-protected');
    });

    document.addEventListener(
      'contextmenu',
      (event) => {
        if (event.target.closest('.img-protected')) event.preventDefault();
      },
      true
    );

    document.addEventListener(
      'dragstart',
      (event) => {
        if (event.target.closest('.img-protected')) event.preventDefault();
      },
      true
    );

    document.addEventListener(
      'copy',
      (event) => {
        if (event.target.closest('.img-protected')) event.preventDefault();
      },
      true
    );

    document.addEventListener(
      'selectstart',
      (event) => {
        if (event.target.closest('.img-protected')) event.preventDefault();
      },
      true
    );
  }

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
  const pageHeader = document.querySelector('body > header');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 60);
      syncNavBarHeight();
    }, { passive: true });
  }

  function syncNavBarHeight() {
    if (!pageHeader || window.matchMedia('(min-width: 768px)').matches) return;
    document.documentElement.style.setProperty(
      '--nav-bar-height',
      `${pageHeader.getBoundingClientRect().height}px`
    );
  }

  let mobileNavReady = false;

  function initMobileNav() {
    if (mobileNavReady) return;
    const toggle = document.querySelector('.nav-toggle');
    const menu = document.getElementById('nav-menu');
    if (!toggle || !menu) return;
    mobileNavReady = true;

    const mq = window.matchMedia('(min-width: 768px)');

    const nav = toggle.closest('.site-nav');

    function placeMenu() {
      if (!nav) return;
      if (mq.matches) {
        if (menu.parentElement === document.body) nav.appendChild(menu);
      } else if (menu.parentElement !== document.body) {
        document.body.appendChild(menu);
      }
    }

    function closeMenu() {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menu');
      menu.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('nav-open');
      menu.scrollTop = 0;
      const focused = document.activeElement;
      if (focused && menu.contains(focused)) focused.blur();
      void menu.offsetHeight;
    }

    function openMenu() {
      placeMenu();
      syncNavBarHeight();
      menu.scrollTop = 0;
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Fechar menu');
      document.body.classList.add('nav-open');
    }

    function scrollToHash(href) {
      const id = href.startsWith('#') ? href.slice(1) : '';
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      const headerHeight = pageHeader ? pageHeader.getBoundingClientRect().height : 80;
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      history.pushState(null, '', `#${id}`);
    }

    function syncLayout() {
      placeMenu();
      if (mq.matches) {
        closeMenu();
        document.documentElement.style.removeProperty('--nav-bar-height');
      } else {
        syncNavBarHeight();
      }
    }

    syncNavBarHeight();
    placeMenu();
    menu.setAttribute('aria-hidden', 'true');
    window.addEventListener('resize', syncNavBarHeight, { passive: true });

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (menu.classList.contains('is-open')) closeMenu();
      else openMenu();
    });

    menu.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (link) {
        if (!mq.matches) {
          const href = link.getAttribute('href') || '';
          if (href.startsWith('#')) {
            event.preventDefault();
            closeMenu();
            requestAnimationFrame(() => {
              requestAnimationFrame(() => scrollToHash(href));
            });
          } else {
            closeMenu();
          }
        }
        return;
      }
      if (event.target === menu) closeMenu();
    });

    window.addEventListener('hashchange', () => {
      if (!mq.matches) closeMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu();
    });

    mq.addEventListener('change', syncLayout);
    syncLayout();
  }

  const GCAL_SCHEDULE_URL =
    'https://calendar.google.com/calendar/appointments/AcZssZ0dGAXsBGvjWRiKiPCUCTKC4DncZaVeOFMWxT0=?gv=true';
  const GCAL_SCRIPT_URL = 'https://calendar.google.com/calendar/scheduling-button-script.js';
  const GCAL_STYLE_URL = 'https://calendar.google.com/calendar/scheduling-button-script.css';

  function loadGoogleCalendarScheduling() {
    if (!document.querySelector('.gcal-schedule-host')) {
      return Promise.resolve();
    }
    if (window.__gcalLoadPromise) return window.__gcalLoadPromise;

    window.__gcalLoadPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-gcal-css]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = GCAL_STYLE_URL;
        link.setAttribute('data-gcal-css', '1');
        document.head.appendChild(link);
      }

      if (window.calendar && window.calendar.schedulingButton) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = GCAL_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Calendar script failed to load'));
      document.head.appendChild(script);
    });

    return window.__gcalLoadPromise;
  }

  function initGoogleSchedulingButtons() {
    if (!window.calendar || !window.calendar.schedulingButton) return false;
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
    if (!document.querySelector('.gcal-schedule-host')) return;

    loadGoogleCalendarScheduling()
      .then(() => {
        if (initGoogleSchedulingButtons()) return;
        let n = 0;
        const id = setInterval(() => {
          if (initGoogleSchedulingButtons() || ++n > 100) clearInterval(id);
        }, 50);
      })
      .catch(() => {});
  }

  let testimonialCarouselReady = false;

  function initTestimonialCarousel() {
    if (testimonialCarouselReady) return;
    const root = document.querySelector('[data-testimonial-carousel]');
    if (!root) return;
    testimonialCarouselReady = true;

    const track = root.querySelector('.testimonial-carousel__track');
    const cards = [...root.querySelectorAll('.testimonial-card')];
    const prevBtn = root.querySelector('[data-carousel-prev]');
    const nextBtn = root.querySelector('[data-carousel-next]');
    const dotsHost = root.querySelector('.testimonial-carousel__dots');
    if (!track || !cards.length || !prevBtn || !nextBtn || !dotsHost) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let index = 0;

    cards.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'testimonial-carousel__dot';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', 'Depoimento ' + (i + 1) + ' de ' + cards.length);
      dot.addEventListener('click', () => goTo(i));
      dotsHost.appendChild(dot);
    });

    const dots = [...dotsHost.querySelectorAll('.testimonial-carousel__dot')];

    function getIndexFromScroll() {
      const x = track.scrollLeft;
      let closest = 0;
      let min = Infinity;
      cards.forEach((card, i) => {
        const dist = Math.abs(card.offsetLeft - x);
        if (dist < min) {
          min = dist;
          closest = i;
        }
      });
      return closest;
    }

    function updateUI() {
      dots.forEach((dot, i) => {
        const active = i === index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      prevBtn.disabled = index <= 0;
      nextBtn.disabled = index >= cards.length - 1;
    }

    function goTo(i) {
      index = Math.max(0, Math.min(cards.length - 1, i));
      cards[index].scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        inline: 'start',
        block: 'nearest',
      });
      updateUI();
    }

    prevBtn.addEventListener('click', () => goTo(index - 1));
    nextBtn.addEventListener('click', () => goTo(index + 1));

    track.addEventListener(
      'scroll',
      () => {
        const next = getIndexFromScroll();
        if (next !== index) {
          index = next;
          updateUI();
        }
      },
      { passive: true }
    );

    root.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(index - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(index + 1);
      }
    });

    let dragActive = false;
    let dragStartX = 0;
    let dragScrollLeft = 0;

    track.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      dragActive = true;
      dragStartX = event.pageX;
      dragScrollLeft = track.scrollLeft;
      track.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', (event) => {
      if (!dragActive) return;
      event.preventDefault();
      track.scrollLeft = dragScrollLeft - (event.pageX - dragStartX);
    });

    window.addEventListener('mouseup', () => {
      if (!dragActive) return;
      dragActive = false;
      track.classList.remove('is-dragging');
      index = getIndexFromScroll();
      updateUI();
    });

    updateUI();
  }

  function onPageReady() {
    ensureGoogleSchedulingButtons();
    initTestimonialCarousel();
  }

  document.addEventListener('page-ready', onPageReady);
  if (!document.body.classList.contains('is-page-loading')) {
    onPageReady();
  }

  function onDomReady() {
    initImageProtection();
    initMobileNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDomReady);
  } else {
    onDomReady();
  }
})();
