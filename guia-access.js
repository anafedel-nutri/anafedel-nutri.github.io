(function () {
  const CFG = window.GUIA_SECRETS || {};
  /** URL do App da Web (Google Apps Script) — ver guia-secrets.js ou google-apps-script/ */
  const GUIA_API_URL = CFG.apiUrl || '';
  /** Mesmo valor de API_SECRET no Apps Script */
  const GUIA_API_TOKEN = CFG.apiToken || '';

  const STORAGE_KEY = 'anafedel_guia_access';
  const STORAGE_TTL_DAYS = 90;
  const POLL_MS = 20000;

  const gate = document.getElementById('guia-gate');
  const pending = document.getElementById('guia-pending');
  const downloads = document.getElementById('guia-downloads');
  const form = document.getElementById('guia-email-form');
  const emailInput = document.getElementById('guia-email');
  const errorEl = document.getElementById('guia-form-error');
  const emailDisplay = document.getElementById('guia-email-display');
  const pendingEmailDisplay = document.getElementById('guia-pending-email');
  const checkStatusBtn = document.getElementById('guia-check-status');
  const logoutBtn = document.getElementById('guia-logout');
  const pendingLogoutBtn = document.getElementById('guia-pending-logout');

  if (!gate || !pending || !downloads || !form || !emailInput) return;

  let pollTimer = null;
  let pendingEmail = '';

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || '').trim());
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function apiConfigured() {
    return Boolean(GUIA_API_URL && GUIA_API_TOKEN);
  }

  function readAccess() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.email || data.status !== 'aprovado' || !data.exp) return null;
      if (Date.now() > data.exp) {
        clearAccess();
        return null;
      }
      return data.email;
    } catch {
      return null;
    }
  }

  function saveApproved(email) {
    const exp = Date.now() + STORAGE_TTL_DAYS * 24 * 60 * 60 * 1000;
    const payload = JSON.stringify({ email, status: 'aprovado', exp });
    localStorage.setItem(STORAGE_KEY, payload);
    sessionStorage.setItem(STORAGE_KEY, payload);
  }

  function clearAccess() {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    pendingEmail = '';
    stopPolling();
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function hideAllPanels() {
    gate.hidden = true;
    pending.hidden = true;
    downloads.hidden = true;
  }

  function showGate() {
    hideAllPanels();
    gate.hidden = false;
    showError('');
  }

  function showPending(email) {
    hideAllPanels();
    pending.hidden = false;
    pendingEmail = email;
    if (pendingEmailDisplay) pendingEmailDisplay.textContent = email;
    showError('');
  }

  function showDownloads(email) {
    hideAllPanels();
    downloads.hidden = false;
    if (emailDisplay) emailDisplay.textContent = email;
    showError('');
    stopPolling();
  }

  function trackEvent(name, params) {
    if (typeof window.trackEvent === 'function') {
      window.trackEvent(name, params || {});
    }
  }

  function apiUrl(params) {
    const url = new URL(GUIA_API_URL);
    url.searchParams.set('token', GUIA_API_TOKEN);
    Object.keys(params).forEach((key) => {
      url.searchParams.set(key, params[key]);
    });
    return url.toString();
  }

  async function fetchStatus(email) {
    const response = await fetch(apiUrl({ email: normalizeEmail(email) }), {
      method: 'GET',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('status_http');
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'status_erro');
    return data.status;
  }

  async function requestAccess(email) {
    const response = await fetch(GUIA_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token: GUIA_API_TOKEN,
        email: normalizeEmail(email),
        source: 'guia-gratuito',
        page: location.pathname,
      }),
    });
    if (!response.ok) throw new Error('post_http');
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'post_erro');
    return data.status;
  }

  async function handleStatus(email, { fromPoll } = {}) {
    const status = await fetchStatus(email);

    if (status === 'aprovado') {
      saveApproved(email);
      showDownloads(email);
      trackEvent('guia_gratuito_aprovado', { page: 'guia-gratuito' });
      return;
    }

    if (status === 'recusado') {
      clearAccess();
      showGate();
      showError('Sua solicitação não foi aprovada. Em caso de dúvida, fale conosco pelo WhatsApp.');
      return;
    }

    if (status === 'pendente' || status === 'nao_encontrado') {
      showPending(email);
      if (!fromPoll) trackEvent('guia_gratuito_pendente', { page: 'guia-gratuito' });
      startPolling(email);
      return;
    }

    throw new Error('status_desconhecido');
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startPolling(email) {
    stopPolling();
    pollTimer = setInterval(() => {
      handleStatus(email, { fromPoll: true }).catch(() => {});
    }, POLL_MS);
  }

  async function onSubmit(email) {
    if (!apiConfigured()) {
      showError('Sistema de aprovação ainda não configurado. Entre em contato com a nutricionista.');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
    }

    try {
      const postStatus = await requestAccess(email);
      if (postStatus === 'aprovado') {
        saveApproved(email);
        showDownloads(email);
        trackEvent('guia_gratuito_aprovado', { page: 'guia-gratuito' });
        return;
      }
      await handleStatus(email);
    } catch {
      showError('Não foi possível enviar sua solicitação. Tente novamente em instantes.');
      showGate();
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
      }
    }
  }

  async function onCheckStatus() {
    const email = pendingEmail || emailInput.value.trim();
    if (!isValidEmail(email)) {
      showError('Informe um e-mail válido.');
      return;
    }
    if (!apiConfigured()) {
      showError('Sistema de aprovação ainda não configurado.');
      return;
    }

    if (checkStatusBtn) {
      checkStatusBtn.disabled = true;
      checkStatusBtn.setAttribute('aria-busy', 'true');
    }

    try {
      await handleStatus(email);
    } catch {
      showError('Não foi possível verificar agora. Tente novamente em alguns segundos.');
    } finally {
      if (checkStatusBtn) {
        checkStatusBtn.disabled = false;
        checkStatusBtn.removeAttribute('aria-busy');
      }
    }
  }

  function boot() {
    if (!apiConfigured()) {
      showGate();
      showError('O guia gratuito será liberado após aprovação. Configure a API no site para ativar.');
      return;
    }

    const saved = readAccess();
    if (saved) {
      fetchStatus(saved)
        .then((status) => {
          if (status === 'aprovado') {
            showDownloads(saved);
          } else {
            clearAccess();
            showGate();
          }
        })
        .catch(() => showDownloads(saved));
      return;
    }

    showGate();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = normalizeEmail(emailInput.value);

    if (!isValidEmail(email)) {
      showError('Informe um e-mail válido para continuar.');
      emailInput.focus();
      return;
    }

    onSubmit(email);
  });

  if (checkStatusBtn) {
    checkStatusBtn.addEventListener('click', onCheckStatus);
  }

  function logout() {
    clearAccess();
    showGate();
    emailInput.value = '';
    emailInput.focus();
  }

  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  if (pendingLogoutBtn) pendingLogoutBtn.addEventListener('click', logout);

  boot();
})();
