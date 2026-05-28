(function () {
  /**
   * Opcional: URL de um Google Apps Script (Web App) para registrar e-mails.
   * Deixe vazio ('') para liberar o download só com validação local + evento no Analytics.
   *
   * O script deve aceitar POST JSON: { email, source, page }
   */
  const GUIA_LEAD_WEBHOOK = '';

  const STORAGE_KEY = 'anafedel_guia_access';
  const STORAGE_TTL_DAYS = 90;

  const gate = document.getElementById('guia-gate');
  const downloads = document.getElementById('guia-downloads');
  const form = document.getElementById('guia-email-form');
  const emailInput = document.getElementById('guia-email');
  const errorEl = document.getElementById('guia-form-error');
  const emailDisplay = document.getElementById('guia-email-display');
  const logoutBtn = document.getElementById('guia-logout');

  if (!gate || !downloads || !form || !emailInput) return;

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || '').trim());
  }

  function readAccess() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.email || !data.exp) return null;
      if (Date.now() > data.exp) {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return data.email;
    } catch {
      return null;
    }
  }

  function saveAccess(email) {
    const exp = Date.now() + STORAGE_TTL_DAYS * 24 * 60 * 60 * 1000;
    const payload = JSON.stringify({ email, exp });
    localStorage.setItem(STORAGE_KEY, payload);
    sessionStorage.setItem(STORAGE_KEY, payload);
  }

  function clearAccess() {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function unlockUI(email) {
    gate.hidden = true;
    downloads.hidden = false;
    if (emailDisplay) emailDisplay.textContent = email;
    showError('');
  }

  function lockUI() {
    gate.hidden = false;
    downloads.hidden = true;
    emailInput.value = '';
    emailInput.focus();
    showError('');
  }

  function trackUnlock() {
    if (typeof window.trackEvent === 'function') {
      window.trackEvent('guia_gratuito_unlock', { page: 'guia-gratuito' });
    }
  }

  function registerLead(email) {
    if (!GUIA_LEAD_WEBHOOK) return Promise.resolve();

    return fetch(GUIA_LEAD_WEBHOOK, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        source: 'guia-gratuito',
        page: location.pathname,
        sentAt: new Date().toISOString(),
      }),
    }).catch(() => {});
  }

  function grantAccess(email) {
    saveAccess(email);
    unlockUI(email);
    trackUnlock();
    return registerLead(email);
  }

  const saved = readAccess();
  if (saved) unlockUI(saved);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();

    if (!isValidEmail(email)) {
      showError('Informe um e-mail válido para continuar.');
      emailInput.focus();
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
    }

    Promise.resolve(grantAccess(email)).finally(() => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
      }
    });
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearAccess();
      lockUI();
    });
  }
})();
