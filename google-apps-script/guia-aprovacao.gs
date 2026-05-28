/**
 * GUIA GRATUITO — aprovação por link no e-mail
 *
 * Configure ADMIN_EMAIL, API_SECRET, ADMIN_TOKEN e implante como App da Web.
 * Cole GUIA_API_URL + GUIA_API_TOKEN em guia-access.js (site).
 *
 * ADMIN_TOKEN fica SOMENTE neste script e nos links do seu e-mail (não publique no site).
 */

const SHEET_NAME = 'Acessos';
/** Troque pelos valores em google-apps-script/VALORES-GERADOS.txt (gerado localmente) */
const ADMIN_EMAIL = 'anafedel@anafedel.com';
const API_SECRET = 'TROQUE_API_SECRET';
const ADMIN_TOKEN = 'TROQUE_ADMIN_TOKEN';

function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = String(params.action || 'status').toLowerCase();
    const email = normalizeEmail_(params.email);

    if (action === 'approve' || action === 'reject') {
      return handleAdminAction_(params, action, email);
    }

    if (!authorizeApi_(params)) {
      return json_({ ok: false, error: 'nao_autorizado' }, 403);
    }
    if (!email) return json_({ ok: false, error: 'email_obrigatorio' }, 400);

    const status = getStatus_(email);
    return json_({ ok: true, email, status });
  } catch (err) {
    return json_({ ok: false, error: String(err) }, 500);
  }
}

function doPost(e) {
  try {
    if (!authorizeApiFromPost_(e)) {
      return json_({ ok: false, error: 'nao_autorizado' }, 403);
    }

    const body = JSON.parse(e.postData.contents || '{}');
    const email = normalizeEmail_(body.email);
    if (!email) return json_({ ok: false, error: 'email_obrigatorio' }, 400);

    const sheet = getSheet_();
    const existing = findRow_(sheet, email);

    if (existing) {
      const status = String(existing.status || 'pendente').toLowerCase();
      if (status === 'aprovado') {
        return json_({ ok: true, email, status: 'aprovado', message: 'ja_aprovado' });
      }
      if (status === 'recusado') {
        return json_({ ok: true, email, status: 'recusado', message: 'ja_recusado' });
      }
      notifyAdmin_(email, existing.createdAt || new Date(), true);
      return json_({ ok: true, email, status: 'pendente', message: 'ja_pendente' });
    }

    const now = new Date();
    sheet.appendRow([email, 'pendente', now, '']);
    notifyAdmin_(email, now, false);
    return json_({ ok: true, email, status: 'pendente', message: 'solicitacao_criada' });
  } catch (err) {
    return json_({ ok: false, error: String(err) }, 500);
  }
}

function handleAdminAction_(params, action, email) {
  if (!authorizeAdmin_(params)) {
    return htmlPage_('Acesso negado', '<p>Este link não é válido ou expirou.</p>', false);
  }
  if (!email) {
    return htmlPage_('E-mail inválido', '<p>Não foi possível identificar o solicitante.</p>', false);
  }

  const sheet = getSheet_();
  const row = findRow_(sheet, email);

  if (!row) {
    return htmlPage_(
      'Solicitação não encontrada',
      '<p>Não há registro para <strong>' + escapeHtml_(email) + '</strong>.</p>',
      false
    );
  }

  if (action === 'approve') {
    if (row.status === 'aprovado') {
      return htmlPage_(
        'Já aprovado',
        '<p>O acesso de <strong>' + escapeHtml_(email) + '</strong> já estava liberado.</p>',
        true
      );
    }
    setStatus_(sheet, row.row, 'aprovado');
    return htmlPage_(
      'Acesso aprovado',
      '<p>Download liberado para <strong>' + escapeHtml_(email) + '</strong>.</p>' +
        '<p>A pessoa verá os links ao atualizar a página do guia (em até ~20 segundos).</p>',
      true
    );
  }

  if (row.status === 'recusado') {
    return htmlPage_(
      'Já recusado',
      '<p>A solicitação de <strong>' + escapeHtml_(email) + '</strong> já constava como recusada.</p>',
      false
    );
  }
  setStatus_(sheet, row.row, 'recusado');
  return htmlPage_(
    'Solicitação recusada',
    '<p>O acesso de <strong>' + escapeHtml_(email) + '</strong> não foi liberado.</p>',
    false
  );
}

function setStatus_(sheet, rowIndex, status) {
  sheet.getRange(rowIndex, 2).setValue(status);
  if (status === 'aprovado') {
    sheet.getRange(rowIndex, 4).setValue(new Date());
  }
}

function authorizeApi_(params) {
  if (!API_SECRET || API_SECRET.indexOf('TROQUE_') === 0) return false;
  return params.token === API_SECRET;
}

function authorizeApiFromPost_(e) {
  if (!API_SECRET || API_SECRET.indexOf('TROQUE_') === 0) return false;
  const body = JSON.parse(e.postData.contents || '{}');
  return body.token === API_SECRET;
}

function authorizeAdmin_(params) {
  if (!ADMIN_TOKEN || ADMIN_TOKEN.indexOf('TROQUE_') === 0) return false;
  return params.admin === ADMIN_TOKEN;
}

function getWebAppUrl_() {
  try {
    return ScriptApp.getService().getUrl();
  } catch (e) {
    return '';
  }
}

function buildAdminLink_(action, email) {
  const base = getWebAppUrl_();
  if (!base) return '';
  return (
    base +
    '?action=' +
    encodeURIComponent(action) +
    '&email=' +
    encodeURIComponent(email) +
    '&admin=' +
    encodeURIComponent(ADMIN_TOKEN)
  );
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['email', 'status', 'criado_em', 'aprovado_em']);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
  }
  return sheet;
}

function normalizeEmail_(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function findRow_(sheet, email) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][0]) === email) {
      return {
        row: i + 1,
        email: data[i][0],
        status: String(data[i][1] || 'pendente').toLowerCase(),
        createdAt: data[i][2] || null,
      };
    }
  }
  return null;
}

function getStatus_(email) {
  const sheet = getSheet_();
  const row = findRow_(sheet, email);
  if (!row) return 'nao_encontrado';
  if (row.status === 'aprovado') return 'aprovado';
  if (row.status === 'recusado') return 'recusado';
  return 'pendente';
}

function notifyAdmin_(email, when, isReminder) {
  if (!ADMIN_EMAIL) return;

  const approveUrl = buildAdminLink_('approve', email);
  const rejectUrl = buildAdminLink_('reject', email);
  const dateStr = Utilities.formatDate(when, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  const subject = (isReminder ? 'Lembrete: ' : '') + 'Guia gratuito — aprovar ' + email;

  const htmlBody =
    '<div style="font-family:Arial,sans-serif;color:#2E2524;max-width:520px;line-height:1.6">' +
    '<p style="margin:0 0 12px"><strong>' +
    (isReminder ? 'Solicitação pendente' : 'Nova solicitação') +
    '</strong> de acesso ao guia gratuito.</p>' +
    '<p style="margin:0 0 8px"><strong>E-mail:</strong> ' +
    escapeHtml_(email) +
    '</p>' +
    '<p style="margin:0 0 20px"><strong>Data:</strong> ' +
    dateStr +
    '</p>' +
    '<p style="margin:0 0 16px">Clique para decidir:</p>' +
    '<p style="margin:0 0 12px">' +
    '<a href="' +
    approveUrl +
    '" style="display:inline-block;background:#6E3B46;color:#fff;text-decoration:none;padding:14px 24px;border-radius:6px;font-weight:600">Aprovar acesso</a>' +
    '</p>' +
    '<p style="margin:0 0 20px">' +
    '<a href="' +
    rejectUrl +
    '" style="display:inline-block;background:#fff;color:#6E3B46;text-decoration:none;padding:12px 22px;border-radius:6px;border:1.5px solid #6E3B46;font-weight:600">Recusar</a>' +
    '</p>' +
    '<p style="font-size:12px;color:#666;margin:0">Se os botões não abrirem, copie os links:<br>' +
    'Aprovar: ' +
    approveUrl +
    '<br>Recusar: ' +
    rejectUrl +
    '</p>' +
    '</div>';

  const plainBody =
    (isReminder ? 'Lembrete — solicitação pendente\n\n' : 'Nova solicitação de guia gratuito\n\n') +
    'E-mail: ' +
    email +
    '\nData: ' +
    dateStr +
    '\n\nAprovar: ' +
    approveUrl +
    '\n\nRecusar: ' +
    rejectUrl;

  try {
    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody,
    });
  } catch (e) {
    Logger.log('Falha ao enviar e-mail: ' + e);
  }
}

function htmlPage_(title, bodyHtml, success) {
  const accent = success ? '#6E3B46' : '#9b3b3b';
  const html =
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' +
    escapeHtml_(title) +
    '</title></head><body style="font-family:Georgia,serif;background:#FAF7F4;color:#2E2524;' +
    'display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px">' +
    '<div style="max-width:440px;background:#fff;border:1px solid #E8DDD6;border-radius:12px;padding:32px;text-align:center">' +
    '<h1 style="font-size:1.5rem;color:' +
    accent +
    ';margin:0 0 16px;font-weight:500">' +
    escapeHtml_(title) +
    '</h1>' +
    '<div style="font-family:Arial,sans-serif;font-size:0.95rem;line-height:1.65;color:#4a403f">' +
    bodyHtml +
    '</div></div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(title);
}

function escapeHtml_(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
