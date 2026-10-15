const $ = (selector) => document.querySelector(selector);

const sampleItems = [
  ['CAMISA RETARDANTE A CHAMAS', 1, '41001', 'nova'],
  ['CALÇA RETARDANTE A CHAMAS', 3, '41000', 'nova'],
  ['BOTINA AMARRAR BI 3 GOMOS', 1, '40872', 'usada'],
  ['CAPACETE ABA TOTAL', 1, '25883', 'novo'],
  ['LUVA DE NYLON', 1, '32034', 'nova'],
  ['CINTURÃO PQD ABD REGULAGEM TOTAL', 1, '35520', 'usado'],
  ['OCULOS MINOTOURO FUME', 1, '42716', 'novo'],
  ['TALABARTE (P) CORDA INOX', 1, '15835/15837', 'usado'],
];

const vehicleItems = [
  ['vidro_eletrico', 'VIDRO ELÉTRICO'], ['trava_eletrica', 'TRAVA ELÉTRICA'], ['retrovisor_esquerdo', 'RETROVISOR ESQUERDO'], ['retrovisor_direito', 'RETROVISOR DIREITO'],
  ['ar_condicionado', 'AR-CONDICIONADO'], ['buzina', 'BUZINA'], ['lanterna', 'LANTERNA'], ['luz_alta', 'LUZ ALTA'], ['luz_auxiliar', 'LUZ AUXILIAR'], ['pisca_alerta', 'PISCA-ALERTA'],
  ['seta_dianteira_esquerda', 'SETA DIANTEIRA ESQUERDA'], ['seta_dianteira_direita', 'SETA DIANTEIRA DIREITA'], ['seta_traseira_esquerda', 'SETA TRASEIRA ESQUERDA'], ['seta_traseira_direita', 'SETA TRASEIRA DIREITA'], ['luz_freio', 'LUZ DE FREIO'], ['luz_re', 'LUZ DE RÉ'],
  ['limpador_parabrisa', 'LIMPADOR DE PARA-BRISA'], ['painel', 'PAINEL'], ['luz_painel', 'LUZ DO PAINEL'], ['alarme', 'ALARME'], ['chave', 'CHAVE'], ['freio_mao', 'FREIO DE MÃO'], ['antena', 'ANTENA'], ['som', 'SOM'], ['volante_freio', 'VOLANTE / FREIO'], ['quebra_sol_esquerdo', 'QUEBRA-SOL ESQUERDO'], ['quebra_sol_direito', 'QUEBRA-SOL DIREITO'], ['farol_dianteiro_esquerdo', 'FAROL DIANTEIRO ESQUERDO'], ['farol_dianteiro_direito', 'FAROL DIANTEIRO DIREITO'], ['banco', 'BANCO'], ['cambio', 'CÂMBIO'],
];

const roleLabels = { admin: 'Administrador', tecnico: 'Técnico', vistoriador: 'Vistoriador' };
const eventLabels = {
  login_success: 'Login realizado',
  login_failed: 'Falha de login',
  logout: 'Logout',
  password_changed: 'Senha alterada',
  user_created: 'Conta criada',
  user_deactivated: 'Conta desativada',
  epi_term_created: 'Termo EPI emitido',
  epi_term_signed: 'Termo EPI assinado',
  epi_signature_validated: 'Assinatura EPI validada',
  vehicle_checklist_created: 'Checklist de veículo enviado',
  vehicle_checklist_validated: 'Checklist de veículo validado',
  vehicle_signature_signed: 'Assinatura de checklist registrada',
  vehicle_signature_validated: 'Assinatura de checklist validada',
  vehicle_checklist_photos_uploaded: 'Fotos do veículo registradas',
  selfie_uploaded: 'Selfie registrada',
  user_signature_registered: 'Assinatura padrão cadastrada',
  user_data_consent_registered: 'Consentimento registrado',
  epi_process_created: 'Processo EPI iniciado',
  epi_process_signature_validated: 'Termo EPI validado',
  epi_process_selfie_uploaded: 'Selfie do processo EPI registrada',
  epi_process_photos_uploaded: 'Fotos dos EPIs registradas',
  epi_process_validated: 'Processo EPI validado',
  epi_transfer_started: 'Transferência de EPI iniciada',
  push_device_registered: 'Dispositivo de notificações registrado',
};

let selectedTermId = null;
let selectedVehicleId = null;
let currentUser = null;
let currentLocation = { latitude: null, longitude: null };
let vehicleSignatureCanvas = null;
let vehicleSignatureLocation = { latitude: null, longitude: null };
let notificationsTimer = null;
let onboardingSignatureCanvas = null;
let onboardingLocation = { latitude: null, longitude: null };
let selectedEpiProcessType = null;
let currentEpiProcess = null;
let epiCameraStream = null;
let epiPhotoDrafts = [];
let epiProcessLocation = { latitude: null, longitude: null };
let vehiclePhotoDrafts = [];
let epiCatalog = [];
let stockPpeCatalog = [];
let nativePushToken = null;
let selectedSettingsTab = 'company';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function formatDate(value) {
  if (!value) return '–';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function browserLabel(userAgent) {
  const value = String(userAgent || '');
  if (!value) return 'Não informado';
  if (/Android.*wv/i.test(value)) return 'Android WebView';
  if (/Edg\//i.test(value)) return 'Microsoft Edge';
  if (/Firefox\//i.test(value)) return 'Mozilla Firefox';
  if (/SamsungBrowser\//i.test(value)) return 'Samsung Internet';
  if (/Chrome\//i.test(value)) return 'Google Chrome';
  if (/Safari\//i.test(value) && !/Chrome\//i.test(value)) return 'Safari';
  return 'Navegador não identificado';
}

function deviceLabel(userAgent) {
  const value = String(userAgent || '');
  if (!value) return 'Não informado';
  if (/iPad/i.test(value)) return 'iPad';
  if (/iPhone/i.test(value)) return 'iPhone';
  if (/Android/i.test(value)) return 'Android';
  if (/Windows/i.test(value)) return 'Windows';
  if (/Macintosh|Mac OS/i.test(value)) return 'macOS';
  if (/Linux/i.test(value)) return 'Linux';
  return 'Dispositivo não identificado';
}

function formatMediaLocation(media) {
  if (media.locationLabel) {
    const parts = String(media.locationLabel).split(' · ').filter(Boolean);
    return parts.length >= 3 ? parts[1] : parts[0];
  }
  if (media.latitude !== null && media.latitude !== undefined && media.longitude !== null && media.longitude !== undefined) {
    return `${Number(media.latitude).toFixed(6)}, ${Number(media.longitude).toFixed(6)}`;
  }
  return 'Não informado';
}

function formatMediaCoordinates(media) {
  if (media.latitude === null || media.latitude === undefined || media.longitude === null || media.longitude === undefined) return 'Não informado';
  return `${Number(media.latitude).toFixed(6)}, ${Number(media.longitude).toFixed(6)}`;
}

function requestEpiProcessLocation() {
  if (!navigator.geolocation) return Promise.resolve(epiProcessLocation);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition((position) => {
      epiProcessLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      resolve(epiProcessLocation);
    }, () => resolve(epiProcessLocation), { enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 });
  });
}

function statusLabel(status) {
  return ({ rascunho: 'Rascunho', pendente_assinatura: 'Pendente de assinatura', assinado: 'Assinado', devolvido: 'Devolvido', cancelado: 'Cancelado' }[status] || status);
}

function eventLabel(eventType) { return eventLabels[eventType] || eventType; }

function auditCoordinates(item) {
  const metadata = item.metadata || {};
  const coordinate = Number.isFinite(Number(metadata.latitude)) && Number.isFinite(Number(metadata.longitude))
    ? { latitude: metadata.latitude, longitude: metadata.longitude }
    : Array.isArray(metadata.coordinates) ? metadata.coordinates.find((entry) => entry && entry.latitude !== null && entry.latitude !== undefined && entry.longitude !== null && entry.longitude !== undefined) : null;
  return coordinate ? `${Number(coordinate.latitude).toFixed(6)}, ${Number(coordinate.longitude).toFixed(6)}` : '–';
}

function notificationEntityLabel(notification) {
  if (notification.entityType === 'vehicle_checklist') return 'Abrir checklist de veículo';
  if (notification.entityType === 'epi_term') return 'Abrir termo de EPI';
  if (notification.entityType === 'epi_process') return 'Abrir processo de EPI';
  if (notification.notificationType === 'admin_message') return 'Mensagem do administrador';
  return 'Abrir registro';
}

function renderNotifications(notifications, unreadCount) {
  const count = $('#notification-count');
  count.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
  count.classList.toggle('hidden', unreadCount === 0);
  $('#notifications-list').innerHTML = notifications.length ? notifications.map((notification) => `<button type="button" class="notification-item ${notification.readAt ? '' : 'unread'}" data-notification-id="${notification.id}"><span class="notification-item-heading"><strong>${escapeHtml(notification.title)}</strong><small>${escapeHtml(formatDate(notification.createdAt))}</small></span><span>${escapeHtml(notification.message)}</span><small class="notification-link">${escapeHtml(notificationEntityLabel(notification))}</small></button>`).join('') : '<p class="muted">Nenhuma notificação.</p>';
  $('#notifications-list').querySelectorAll('[data-notification-id]').forEach((button) => button.addEventListener('click', () => openNotification(button.dataset.notificationId, notifications)));
}

async function loadNotifications() {
  if (!currentUser) return;
  try {
    const data = await api('/api/notifications');
    renderNotifications(data.notifications, data.unreadCount);
  } catch (error) {
    $('#notifications-list').innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

async function openNotification(notificationId, notifications) {
  const notification = notifications.find((item) => String(item.id) === String(notificationId));
  if (!notification) return;
  try { await api(`/api/notifications/${notification.id}/read`, { method: 'POST' }); } catch { /* a navegação ainda pode continuar */ }
  $('#notifications-panel').classList.add('hidden');
  $('#notifications-toggle').setAttribute('aria-expanded', 'false');
  await loadNotifications();
  try {
    if (notification.entityType === 'vehicle_checklist') {
      if (currentUser.role === 'admin') { setView('vehicles-view'); await openVehicleChecklist(notification.entityId, '#vehicle-admin-detail'); }
      else if (currentUser.role === 'vistoriador') { setView('validation-view'); await openVehicleChecklist(notification.entityId, '#validation-detail', true); }
      else { setView('vehicles-view'); await openVehicleChecklist(notification.entityId, '#vehicle-tech-detail'); }
    } else if (notification.entityType === 'epi_term' && ['admin', 'tecnico'].includes(currentUser.role)) {
      setView('epi-view'); await loadTerms(); await openTerm(notification.entityId);
    } else if (notification.entityType === 'epi_process') {
      setView('epi-view'); await openEpiProcess(notification.entityId);
    }
  } catch (error) {
    $('#notifications-panel').classList.remove('hidden');
    $('#notifications-toggle').setAttribute('aria-expanded', 'true');
    $('#notifications-list').innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

function closeMobileMenu() {
  const sidebar = $('.sidebar');
  const toggle = $('#mobile-menu-toggle');
  sidebar?.classList.remove('mobile-open');
  toggle?.setAttribute('aria-expanded', 'false');
}

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a operação.');
  return body;
}

const companyFormFields = ['tradeName', 'legalName', 'cnpj', 'phone', 'email', 'responsibleName', 'website', 'address', 'city', 'state', 'zipCode'];

function companyFieldId(prefix, field) { return `#company-${prefix}-${field.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`; }

function fillCompanyForm(prefix, company = {}) {
  companyFormFields.forEach((field) => {
    const input = $(companyFieldId(prefix, field));
    if (input) input.value = company[field] || '';
  });
  const preview = $(`#company-${prefix}-logo-preview`);
  if (preview) {
    preview.classList.toggle('hidden', !company.logoData);
    if (company.logoData) preview.src = company.logoData;
  }
}

function readCompanyForm(prefix) {
  return Object.fromEntries(companyFormFields.map((field) => [field, $(companyFieldId(prefix, field))?.value.trim() || '']));
}

function optimizeCompanyLogo(file) {
  if (!file) return Promise.resolve(null);
  if (!['image/jpeg', 'image/png'].includes(file.type)) return Promise.reject(new Error('Escolha uma logo em PNG ou JPG.'));
  if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('A imagem da logo deve ter até 5 MB antes da compactação.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem da logo.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('A imagem da logo é inválida.'));
      image.onload = () => {
        const maxSide = 720;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d', { alpha: false });
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/jpeg', 0.82);
        if (data.length > 800000) { reject(new Error('A logo compactada ainda ficou grande. Use uma imagem menor.')); return; }
        resolve(data);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function readCompanyPayload(prefix) {
  const payload = readCompanyForm(prefix);
  const input = $(`#company-${prefix}-logo`);
  if (input?.files?.[0]) payload.logoData = await optimizeCompanyLogo(input.files[0]);
  return payload;
}

async function loadCompanySettings() {
  try {
    const data = await api('/api/company');
    fillCompanyForm('onboarding', data.company);
    fillCompanyForm('settings', data.company);
    return data.company;
  } catch (error) {
    const onboardingMessage = $('#company-onboarding-message');
    const settingsMessage = $('#company-settings-message');
    if (onboardingMessage) onboardingMessage.textContent = error.message;
    if (settingsMessage) settingsMessage.textContent = error.message;
    throw error;
  }
}

function setSettingsTab(tab) {
  const allowedTabs = currentUser?.role === 'admin' ? ['company', 'security', 'users'] : ['security'];
  const selectedTab = allowedTabs.includes(tab) ? tab : allowedTabs[0];
  selectedSettingsTab = selectedTab;
  document.querySelectorAll('.settings-tab-button').forEach((button) => {
    const active = button.dataset.settingsTab === selectedTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-settings-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.settingsPanel !== selectedTab));
  if (selectedTab === 'company' && currentUser?.role === 'admin') loadCompanySettings();
  if (selectedTab === 'users' && currentUser?.role === 'admin') loadUsers();
}

async function registerNativePushToken(token = nativePushToken || window.__SIGOS_FCM_TOKEN) {
  if (token) nativePushToken = token;
  if (!currentUser || !nativePushToken) return;
  try {
    await api('/api/push/register', { method: 'POST', body: JSON.stringify({ token: nativePushToken, platform: 'android', deviceInfo: navigator.userAgent }) });
  } catch {
    // O WebView continua funcionando mesmo quando o push ainda não está configurado no servidor.
  }
}

window.addEventListener('sigosNativePushToken', (event) => {
  registerNativePushToken(event.detail?.token);
});

function setView(viewId) {
  closeMobileMenu();
  document.querySelectorAll('.app-section').forEach((section) => section.classList.toggle('hidden', section.id !== viewId));
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === viewId));
  if (viewId === 'home-view') loadOverview();
  if (viewId === 'epi-view' && currentUser) {
    loadEpiProcesses();
    if (['admin', 'tecnico'].includes(currentUser.role)) loadTerms();
  }
  if (viewId === 'vehicles-view' && currentUser) loadVehicleChecklists();
  if (viewId === 'validation-view' && ['admin', 'vistoriador'].includes(currentUser?.role)) loadValidationQueue();
  if (viewId === 'settings-view') setSettingsTab(currentUser?.role === 'admin' ? selectedSettingsTab : 'security');
  if (viewId === 'stock-view' && currentUser?.role === 'admin') loadStock();
  if (viewId === 'audit-view' && currentUser?.role === 'admin') loadAuditLogs();
}

function configureNavigation(user) {
  $('#sidebar-role').textContent = roleLabels[user.role] || user.role;
  $('#user-role').textContent = roleLabels[user.role] || user.role;
  $('#nav-epi').classList.remove('hidden');
  $('#nav-validation').classList.toggle('hidden', !['admin', 'vistoriador'].includes(user.role));
  $('#nav-settings').classList.remove('hidden');
  $('#nav-settings').innerHTML = `<span>⚙</span> ${user.role === 'admin' ? 'Usuários e perfil' : 'Meu perfil'}`;
  $('#nav-stock').classList.toggle('hidden', user.role !== 'admin');
  $('#nav-audit').classList.toggle('hidden', user.role !== 'admin');
  $('#epi-technician-form').classList.toggle('hidden', user.role !== 'tecnico');
  $('#admin-panel').classList.toggle('hidden', user.role !== 'admin');
  $('#company-settings-card').classList.toggle('hidden', user.role !== 'admin');
  $('#settings-tab-company').classList.toggle('hidden', user.role !== 'admin');
  $('#settings-tab-users').classList.toggle('hidden', user.role !== 'admin');
  setSettingsTab(user.role === 'admin' ? selectedSettingsTab : 'security');
  $('#vehicle-tech-panel').classList.toggle('hidden', !['tecnico', 'vistoriador'].includes(user.role));
  $('#vehicle-admin-panel').classList.toggle('hidden', user.role !== 'admin');
}

function showApp(user) {
  currentUser = user;
  registerNativePushToken();
  $('#login-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  $('#user-name').textContent = user.name;
  $('#company-onboarding-gate').classList.add('hidden');
  if (user.role === 'admin' && user.companyProfileComplete === false) {
    $('#main-app-layout').classList.add('hidden');
    $('#company-onboarding-gate').classList.remove('hidden');
    loadCompanySettings();
    return;
  }
  if (['tecnico', 'vistoriador'].includes(user.role) && !user.onboardingComplete) {
    $('#main-app-layout').classList.add('hidden');
    $('#onboarding-gate').classList.remove('hidden');
    loadOnboardingStatus();
    return;
  }
  $('#onboarding-gate').classList.add('hidden');
  $('#main-app-layout').classList.remove('hidden');
  configureNavigation(user);
  if (['tecnico', 'vistoriador'].includes(user.role)) { renderVehicleEditor(); setupVehicleTechnicianSignature(); }
  if (['tecnico', 'vistoriador'].includes(user.role)) loadOnboardingStatus();
  if (user.role === 'tecnico') { renderEpiProcessItems(); setEpiProcessType(selectedEpiProcessType, false); }
  loadNotifications();
  if (notificationsTimer) clearInterval(notificationsTimer);
  notificationsTimer = window.setInterval(loadNotifications, 30000);
  loadOverview();
}

async function loadOverview() {
  try {
    const data = await api('/api/overview');
    $('#overview-period').textContent = data.period;
    $('#overview-activity').textContent = data.stats.activity;
    $('#overview-terms').textContent = data.stats.epiTerms;
    $('#overview-pending-terms').textContent = data.stats.pendingEpiTerms;
    $('#overview-validations').textContent = data.stats.pendingValidations;
    $('#activity-table').innerHTML = data.activity.length ? data.activity.map((item) => `<tr><td>${escapeHtml(formatDate(item.created_at))}</td><td>${escapeHtml(eventLabel(item.event_type))}</td><td>${escapeHtml(item.actor_name || 'Sistema')}</td><td>${escapeHtml(item.entity_type ? `${item.entity_type} #${item.entity_id || '–'}` : '–')}</td></tr>`).join('') : '<tr><td colspan="4" class="muted">Nenhuma atividade registrada no período.</td></tr>';
  } catch (error) {
    $('#activity-table').innerHTML = `<tr><td colspan="4" class="error">${escapeHtml(error.message)}</td></tr>`;
  }
}

async function loadOnboardingStatus() {
  if (!['tecnico', 'vistoriador'].includes(currentUser?.role)) return;
  try {
    const data = await api('/api/onboarding/status');
    currentUser.onboarding = data.onboarding;
    currentUser.signatureData = data.signatureData;
    const complete = !data.onboarding.mustChangePassword && data.onboarding.signatureRegistered && data.onboarding.consentRegistered;
    currentUser.onboardingComplete = complete;
    if (complete) {
      $('#onboarding-gate').classList.add('hidden');
      $('#main-app-layout').classList.remove('hidden');
      configureNavigation(currentUser);
      renderVehicleEditor();
      setupVehicleTechnicianSignature();
      renderEpiSignaturePreview(data.signatureData);
      if (currentUser.role === 'tecnico') {
        renderEpiProcessItems();
        setEpiProcessType(selectedEpiProcessType, false);
      }
      loadNotifications();
      loadOverview();
      return;
    }
    $('#main-app-layout').classList.add('hidden');
    $('#onboarding-gate').classList.remove('hidden');
    document.querySelectorAll('.onboarding-step').forEach((step) => step.classList.add('hidden'));
    if (data.onboarding.mustChangePassword) $('#onboarding-password-step').classList.remove('hidden');
    else if (!data.onboarding.signatureRegistered) {
      $('#onboarding-signature-step').classList.remove('hidden');
      setupOnboardingSignature(data.signatureData);
    } else $('#onboarding-consent-step').classList.remove('hidden');
  } catch (error) {
    $('#onboarding-consent-message').textContent = error.message;
  }
}

function setupOnboardingSignature(signatureData) {
  const mount = $('#onboarding-signature-mount');
  if (!mount) return;
  mount.innerHTML = '';
  if (signatureData) {
    mount.innerHTML = `<img class="saved-signature" src="${signatureData}" alt="Assinatura cadastrada" />`;
    return;
  }
  onboardingSignatureCanvas = makeSignatureCanvas();
  mount.appendChild(onboardingSignatureCanvas);
}

function renderEpiSignaturePreview(signatureData) {
  const mount = $('#epi-process-signature-preview');
  if (!mount) return;
  mount.innerHTML = signatureData ? `<img src="${signatureData}" alt="Assinatura padrão cadastrada" />` : '<p class="muted">Assinatura não cadastrada.</p>';
}

function stopEpiCamera(videoSelector) {
  epiCameraStream?.getTracks().forEach((track) => track.stop());
  epiCameraStream = null;
  const video = $(videoSelector);
  if (video) video.srcObject = null;
}

async function openEpiCamera(videoSelector, messageSelector, facingMode = 'user') {
  const message = $(messageSelector);
  if (!navigator.mediaDevices?.getUserMedia) { message.textContent = 'A câmera exige HTTPS e suporte do navegador.'; return false; }
  stopEpiCamera(videoSelector);
  try {
    epiCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
    const video = $(videoSelector);
    video.srcObject = epiCameraStream;
    video.onloadedmetadata = () => video.play().catch(() => {});
    message.textContent = 'Câmera aberta. Faça a captura quando estiver pronto.';
    return true;
  } catch (error) {
    message.textContent = 'Não foi possível abrir a câmera. Verifique a permissão do dispositivo.';
    return false;
  }
}

function captureVideoFrame(videoSelector) {
  const video = $(videoSelector);
  if (!video?.videoWidth || !video?.videoHeight) return null;
  const canvas = document.createElement('canvas');
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

function renderEpiProcessItems(items = null) {
  const selectedItems = items === null
    ? (epiCatalog.length ? epiCatalog.map((item) => ({ ppeItemId: item.id, quantity: 1, condition: 'novo' })) : [{ ppeItemId: '', quantity: 1, condition: 'novo' }])
    : (items.length ? items : [{ ppeItemId: '', quantity: 1, condition: 'novo' }]);
  const options = (selectedId) => `<option value="">Selecione o EPI</option>${epiCatalog.map((item) => `<option value="${escapeHtml(item.id)}" ${String(item.id) === String(selectedId || '') ? 'selected' : ''}>${escapeHtml(item.name)} · CA ${escapeHtml(item.ca || '–')}</option>`).join('')}`;
  $('#epi-process-items').innerHTML = selectedItems.map((item, index) => {
    const selectedId = item.ppeItemId ?? item[0] ?? '';
    const quantity = item.quantity ?? item[1] ?? 1;
    const condition = item.condition ?? item[3] ?? 'novo';
    return `<div class="epi-process-item" data-item-row="${index}"><select data-field="ppeItemId" required>${options(selectedId)}</select><input data-field="quantity" type="number" min="1" value="${escapeHtml(quantity)}" required /><select data-field="condition"><option value="novo" ${condition === 'novo' ? 'selected' : ''}>Novo</option><option value="usado" ${condition === 'usado' ? 'selected' : ''}>Usado</option><option value="danificado" ${condition === 'danificado' ? 'selected' : ''}>Danificado</option></select><button type="button" class="icon-button remove-item" title="Remover item">×</button></div>`;
  }).join('');
  $('#epi-process-items').querySelectorAll('.remove-item').forEach((button) => button.addEventListener('click', () => { button.closest('.epi-process-item').remove(); }));
}

function readEpiProcessItems() {
  return [...document.querySelectorAll('#epi-process-items .epi-process-item')].map((row) => {
    const ppeItemId = row.querySelector('[data-field="ppeItemId"]').value;
    const catalog = epiCatalog.find((item) => String(item.id) === String(ppeItemId));
    return { ppeItemId: ppeItemId ? Number(ppeItemId) : null, equipmentName: catalog?.name || '', quantity: Number(row.querySelector('[data-field="quantity"]').value), ca: catalog?.ca || '', condition: row.querySelector('[data-field="condition"]').value, observation: '' };
  });
}

async function loadEpiCatalog() {
  const data = await api('/api/epi/catalog');
  epiCatalog = data.items || [];
  renderEpiProcessItems();
}

async function loadEpiTargets() {
  if (currentUser?.role !== 'tecnico') return;
  const data = await api('/api/epi/targets');
  const validators = data.users.filter((user) => ['admin', 'vistoriador'].includes(user.role));
  $('#epi-validator-user').innerHTML = '<option value="">Selecione um vistoriador ou admin</option>' + validators.map((user) => `<option value="${user.id}">${escapeHtml(user.name)} · ${escapeHtml(roleLabels[user.role])}</option>`).join('');
  $('#epi-target-user').innerHTML = '<option value="">Selecione o usuário</option>' + data.users.map((user) => `<option value="${user.id}">${escapeHtml(user.name)} · ${escapeHtml(roleLabels[user.role])}</option>`).join('');
}

function setEpiWorkflowOpen(open) {
  const form = $('#epi-process-form');
  const hint = $('#epi-process-selection-hint');
  const workflow = $('#epi-technician-form');
  if (!form) return;
  form.classList.toggle('hidden', !open);
  workflow?.classList.toggle('workflow-open', open);
  hint?.classList.toggle('hidden', open);
  if (!open) {
    $('#epi-selfie-step')?.classList.add('hidden');
    $('#epi-photos-step')?.classList.add('hidden');
  }
}

function setEpiProcessType(processType, reveal = true) {
  selectedEpiProcessType = processType || null;
  const normalizedType = processType || '';
  $('#epi-process-type').value = normalizedType;
  document.querySelectorAll('.epi-process-option').forEach((button) => button.classList.toggle('active', button.dataset.processType === normalizedType));
  const isDevolution = normalizedType === 'devolucao';
  const isTransfer = normalizedType === 'transferencia';
  $('#epi-validator-field').classList.toggle('hidden', !isDevolution);
  $('#epi-target-field').classList.toggle('hidden', !isTransfer);
  $('#epi-validator-user').required = isDevolution;
  $('#epi-target-user').required = isTransfer;
  if (reveal) setEpiWorkflowOpen(true);
}

function epiProcessStatusLabel(status) {
  return ({ aguarda_selfie: 'Aguardando selfie', aguarda_fotos: 'Aguardando fotos', pendente_validacao: 'Pendente de validação', validado: 'Validado', reprovado: 'Reprovado' }[status] || status);
}

function renderEpiProcessRow(process) {
  const target = process.targetName ? ` · destino: ${process.targetName}` : '';
  const action = `<button type="button" class="secondary small-button epi-process-open" data-process-id="${process.id}">Abrir</button>`;
  return `<div class="epi-process-row"><div><strong>${escapeHtml(process.processTitle)}</strong><small>${escapeHtml(process.createdBy.name)}${escapeHtml(target)} · ${escapeHtml(formatDate(process.createdAt))}</small></div><div class="epi-process-actions"><span class="status status-${escapeHtml(process.status)}">${escapeHtml(epiProcessStatusLabel(process.status))}</span>${action}</div></div>`;
}

async function loadEpiProcesses() {
  try {
    const data = await api('/api/epi/processes');
    $('#epi-process-list').innerHTML = data.processes.length ? data.processes.map(renderEpiProcessRow).join('') : '<p class="muted">Nenhum processo cadastrado.</p>';
    document.querySelectorAll('.epi-process-open').forEach((button) => button.addEventListener('click', () => openEpiProcess(button.dataset.processId)));
    if (currentUser?.role === 'tecnico') { await loadEpiTargets(); await loadEpiCatalog(); renderEpiSignaturePreview(currentUser.signatureData); }
  } catch (error) { $('#epi-process-list').innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; }
}

function renderEpiDailyResponsibilityTerm(process) {
  const term = process.responsibilityTerm;
  if (!term) return '';
  const signature = term.signatureData || process.signatureData || '';
  const logo = term.companyLogoData ? `<img class="company-term-logo" src="${escapeHtml(term.companyLogoData)}" alt="Logo da empresa" />` : '';
  return `<section class="epi-responsibility-term"><div class="paper-header"><div class="term-brand">${logo}<div><strong>${escapeHtml(term.companyName)}</strong><span>CNPJ: ${escapeHtml(term.companyCnpj)}</span></div></div><span class="paper-number">TERMO ASSINADO</span></div><h3>${escapeHtml(term.title)}</h3><p>${escapeHtml(term.intro)}</p><ol>${term.clauses.map((clause) => `<li>${escapeHtml(clause)}</li>`).join('')}</ol><div class="recipient-line"><span><b>Funcionário:</b> ${escapeHtml(process.createdBy.name)}</span><span><b>Emissão:</b> ${escapeHtml(formatDate(process.createdAt))}</span></div><table class="paper-table"><thead><tr><th>Equipamentos</th><th>Qtd.</th><th>CA</th><th>Condição</th></tr></thead><tbody>${process.items.map((item) => `<tr><td>${escapeHtml(item.equipmentName)}</td><td>${escapeHtml(item.quantity)}</td><td>${escapeHtml(item.ca || '–')}</td><td>${escapeHtml((item.condition || '–').toUpperCase())}</td></tr>`).join('')}</tbody></table><div class="legal-text"><p>${escapeHtml(term.legalText.clt)}</p><p>${escapeHtml(term.legalText.nr06)}</p><p>${escapeHtml(term.legalText.declaration)}</p></div><div class="signature-block"><img class="saved-signature" src="${signature}" alt="Assinatura eletrônica do técnico" /><div class="signature-line">Ass. do Funcionário · ${escapeHtml(term.signerName)}</div><div class="audit-note">Assinatura validada em ${escapeHtml(formatDate(term.signedAt))} · SHA-256: ${escapeHtml(term.signatureHash || '–')}</div></div><p class="epi-term-attached-note">Este termo assinado faz parte deste checklist diário e foi enviado junto com as fotos registradas.</p></section>`;
}

function renderEpiGenericTerm(process) {
  const logo = process.companyLogoData ? `<img class="company-term-logo" src="${escapeHtml(process.companyLogoData)}" alt="Logo da empresa" />` : '';
  const signature = process.signatureData || currentUser.signatureData || '';
  return `<section class="epi-responsibility-term"><div class="paper-header"><div class="term-brand">${logo}<div><strong>${escapeHtml(process.companyName || 'Empresa')}</strong><span>CNPJ: ${escapeHtml(process.companyCnpj || '–')}</span></div></div><span class="paper-number">TERMO</span></div><h3>${escapeHtml(process.termText?.title || process.processTitle)}</h3><p>${escapeHtml(process.termText?.paragraphs?.[0] || '')}</p><p>${escapeHtml(process.termText?.paragraphs?.[1] || '')}</p><div class="epi-signature-preview"><img src="${escapeHtml(signature)}" alt="Assinatura usada no termo" /></div><div class="table-wrap"><table class="paper-table"><thead><tr><th>EPI</th><th>Qtd.</th><th>CA</th><th>Condição</th></tr></thead><tbody>${process.items.map((item) => `<tr><td>${escapeHtml(item.equipmentName)}</td><td>${escapeHtml(item.quantity)}</td><td>${escapeHtml(item.ca || '–')}</td><td>${escapeHtml(item.condition || '–')}</td></tr>`).join('')}</tbody></table></div><div class="detail-actions"><button id="print-epi-process" type="button" class="secondary small-button">Imprimir / salvar PDF</button></div></section>`;
}

async function openEpiProcess(id) {
  const panel = $('#epi-process-detail');
  panel.classList.remove('hidden');
  panel.innerHTML = '<p class="muted">Carregando processo...</p>';
  try {
    const { process } = await api(`/api/epi/processes/${id}`);
    const media = process.media.map((item) => `<figure class="epi-process-media-item"><img src="/api/epi/processes/${process.id}/media/${item.id}" alt="${item.kind === 'selfie' ? 'Selfie do processo' : 'Foto do EPI'}" loading="lazy" /><figcaption><strong>${item.kind === 'selfie' ? 'Selfie' : 'Foto do EPI'}</strong><span>Data/hora: ${escapeHtml(formatDate(item.createdAt))}</span><span>IP: ${escapeHtml(item.ipAddress || 'Não informado')}</span><span>Navegador: ${escapeHtml(browserLabel(item.userAgent || item.deviceInfo))}</span><span>Dispositivo: ${escapeHtml(deviceLabel(item.userAgent || item.deviceInfo))}</span><span>Cidade: ${escapeHtml(formatMediaLocation(item))}</span><span>Coordenadas: ${escapeHtml(formatMediaCoordinates(item))}</span></figcaption></figure>`).join('');
    const responsibilityTerm = process.processType === 'checklist_diario' ? renderEpiDailyResponsibilityTerm(process) : renderEpiGenericTerm(process);
    const canValidate = currentUser.role === 'admin' || String(process.validatorUserId || '') === String(currentUser.id);
    const validation = process.status === 'pendente_validacao' && canValidate ? `<div class="epi-review-actions"><textarea id="epi-validation-notes" maxlength="500" placeholder="Observação da validação (opcional)"></textarea><div class="form-actions"><button type="button" data-epi-validate="validado">Validar processo</button><button type="button" class="secondary" data-epi-validate="reprovado">Reprovar</button></div></div>` : '';
    panel.innerHTML = `<div class="epi-process-detail-card"><div class="section-heading"><div><div class="eyebrow">${escapeHtml(process.processTitle)}</div><h3>Processo #${escapeHtml(process.id)}</h3><p class="muted">${escapeHtml(epiProcessStatusLabel(process.status))} · ${escapeHtml(formatDate(process.createdAt))}</p></div><button id="close-epi-process-detail" type="button" class="secondary small-button">Fechar</button></div>${responsibilityTerm}<p class="audit-note">Responsável: ${escapeHtml(process.createdBy.name)} · Validador: ${escapeHtml(process.validatorName || 'Administradores')} · Assinatura SHA-256: ${escapeHtml(process.signatureHash || '–')}</p>${media ? `<div class="epi-process-media">${media}</div>` : '<p class="muted">Nenhuma imagem registrada.</p>'}${validation}</div>`;
    panel.querySelector('.epi-process-detail-card > .section-heading')?.insertAdjacentHTML('beforeend', '<button id="download-epi-process-pdf" type="button" class="secondary small-button">Baixar PDF</button>');
    $('#close-epi-process-detail').addEventListener('click', () => panel.classList.add('hidden'));
    $('#download-epi-process-pdf')?.addEventListener('click', () => {
      const link = document.createElement('a');
      link.href = `/api/epi/processes/${process.id}/pdf`;
      link.download = `processo-epi-${process.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
    $('#print-epi-process')?.addEventListener('click', () => window.print());
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    panel.querySelectorAll('[data-epi-validate]').forEach((button) => button.addEventListener('click', async () => {
      try { await api(`/api/epi/processes/${process.id}/validate`, { method: 'POST', body: JSON.stringify({ decision: button.dataset.epiValidate, notes: $('#epi-validation-notes').value }) }); await loadEpiProcesses(); await openEpiProcess(process.id); await loadNotifications(); await loadOverview(); } catch (error) { panel.querySelector('.epi-review-actions').insertAdjacentHTML('beforeend', `<p class="error">${escapeHtml(error.message)}</p>`); }
    }));
  } catch (error) { panel.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; }
}

async function loadUsers() {
  const data = await api('/api/users');
  $('#users-table').innerHTML = data.users.map((user) => `<tr><td>${user.role === 'tecnico' ? `<button type="button" class="user-detail-button" data-user-id="${user.id}">${escapeHtml(user.name)}</button>` : escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(roleLabels[user.role] || user.role)}</td><td>${user.active ? 'Ativo' : 'Desativado'}</td><td>${user.active && String(user.id) !== String(currentUser.id) ? `<button type="button" class="danger-button deactivate-user" data-user-id="${user.id}">Remover</button>` : ''}</td></tr>`).join('');
  renderAdminNotificationRecipients(data.users);
  document.querySelectorAll('.user-detail-button').forEach((button) => button.addEventListener('click', () => loadTechnicianSummary(button.dataset.userId)));
  document.querySelectorAll('.deactivate-user').forEach((button) => button.addEventListener('click', async () => {
    if (!window.confirm('Desativar esta conta? Os registros de auditoria serão preservados.')) return;
    try { await api(`/api/users/${button.dataset.userId}`, { method: 'DELETE' }); await loadUsers(); await loadOverview(); } catch (error) { $('#user-form-message').textContent = error.message; }
  }));
}

function renderAdminNotificationRecipients(users) {
  const select = $('#admin-notification-users');
  if (!select) return;
  const recipients = users.filter((user) => user.active && String(user.id) !== String(currentUser?.id));
  select.innerHTML = recipients.length
    ? recipients.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)} · ${escapeHtml(roleLabels[user.role] || user.role)}</option>`).join('')
    : '<option value="" disabled>Nenhum outro usuário ativo</option>';
  updateAdminNotificationRecipientMode();
}

function updateAdminNotificationRecipientMode() {
  const mode = $('#admin-notification-recipient-mode');
  const field = $('#admin-notification-users-field');
  const select = $('#admin-notification-users');
  if (!mode || !field || !select) return;
  const specific = mode.value === 'selected';
  field.classList.toggle('hidden', !specific);
  select.disabled = !specific;
  select.required = specific;
}

async function loadTechnicianSummary(userId) {
  const panel = $('#technician-detail');
  panel.classList.remove('hidden');
  panel.innerHTML = '<p class="muted">Carregando dados do técnico...</p>';
  try {
    const data = await api(`/api/users/${userId}/technician-summary`);
    panel.innerHTML = `<div class="technician-detail-heading"><div><div class="eyebrow">DETALHE DO TÉCNICO · ${escapeHtml(data.period.toUpperCase())}</div><h3>${escapeHtml(data.technician.name)}</h3><p class="muted">${escapeHtml(data.technician.email)} · ${data.technician.active ? 'Conta ativa' : 'Conta desativada'}</p></div><button id="close-technician-detail" type="button" class="secondary small-button">Fechar</button></div><div class="technician-stats"><div><strong>${escapeHtml(data.stats.checklistEvents)}</strong><span>eventos de checklist</span></div><div><strong>${escapeHtml(data.stats.episToday)}</strong><span>EPIs registrados hoje</span></div><div><strong>${escapeHtml(data.stats.pending)}</strong><span>pendências</span></div></div><div class="technician-detail-grid"><section><h4>EPIs com o técnico hoje</h4>${data.epis.length ? `<div class="table-wrap"><table><thead><tr><th>EPI</th><th>Qtd.</th><th>CA</th><th>Condição</th><th>Assinado</th></tr></thead><tbody>${data.epis.map((item) => `<tr><td>${escapeHtml(item.equipment_name)}</td><td>${escapeHtml(item.quantity)}</td><td>${escapeHtml(item.ca || '–')}</td><td>${escapeHtml(item.condition || '–')}</td><td>${escapeHtml(formatDate(item.signed_at))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nenhum EPI registrado em termo assinado hoje.</p>'}</section><section><h4>Pendências</h4>${data.pending.length ? `<div class="pending-list">${data.pending.map((item) => `<div class="pending-item"><strong>${escapeHtml(item.type === 'vehicle_checklist' ? 'Checklist de veículo' : 'Termo de EPI')}</strong><span>${escapeHtml(item.label)} · ${escapeHtml(item.status)}</span></div>`).join('')}</div>` : '<p class="muted">Nenhuma pendência encontrada.</p>'}</section></div><section><h4>Logs de checklist</h4>${data.logs.length ? `<div class="table-wrap"><table><thead><tr><th>Quando</th><th>Evento</th><th>Registro</th><th>IP</th></tr></thead><tbody>${data.logs.map((item) => `<tr><td>${escapeHtml(formatDate(item.created_at))}</td><td>${escapeHtml(eventLabel(item.event_type))}</td><td>${escapeHtml(item.entity_type ? `${item.entity_type} #${item.entity_id || '–'}` : '–')}</td><td>${escapeHtml(item.ip_address || '–')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nenhum log de checklist encontrado.</p>'}</section>`;
    $('#close-technician-detail').addEventListener('click', () => panel.classList.add('hidden'));
  } catch (error) {
    panel.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

function auditRecordMarkup(item) {
  const label = item.entity_type ? `${item.entity_type} #${item.entity_id || '–'}` : '–';
  if (item.entity_type === 'epi_process' && item.entity_id) {
    return `${escapeHtml(label)} <button type="button" class="secondary small-button audit-open-process" data-audit-open-epi="${escapeHtml(item.entity_id)}">Abrir processo</button>`;
  }
  return escapeHtml(label);
}

async function loadAuditLogs() {
  const data = await api('/api/audit-logs');
  $('#audit-table').innerHTML = data.logs.length ? data.logs.map((item) => `<tr><td>${escapeHtml(formatDate(item.created_at))}</td><td>${escapeHtml(eventLabel(item.event_type))}</td><td>${escapeHtml(item.actor_name || 'Sistema')}</td><td>${escapeHtml(item.ip_address || '–')}</td><td>${escapeHtml(browserLabel(item.user_agent))}</td><td>${escapeHtml(auditCoordinates(item))}</td><td>${auditRecordMarkup(item)}</td></tr>`).join('') : '<tr><td colspan="7" class="muted">Nenhum evento registrado.</td></tr>';
  document.querySelectorAll('.audit-open-process').forEach((button) => button.addEventListener('click', async () => {
    setView('epi-view');
    await openEpiProcess(button.dataset.auditOpenEpi);
  }));
}

async function loadStock() {
  const data = await api('/api/stock');
  stockPpeCatalog = data.ppes || [];
  $('#stock-vehicles-table').innerHTML = data.vehicles.length ? data.vehicles.map((vehicle) => `<tr><td><strong>${escapeHtml(vehicle.plate)}</strong></td><td>${escapeHtml(vehicle.model || '–')}</td><td>${escapeHtml(vehicle.year || '–')}</td><td>${escapeHtml(vehicle.color || '–')}</td><td>${escapeHtml(vehicle.lastDriver || 'Sem checklist')}${vehicle.lastChecklistAt ? `<small class="table-subtext">${escapeHtml(formatDate(vehicle.lastChecklistAt))}</small>` : ''}</td><td>${escapeHtml(vehicle.status === 'ativo' ? 'Ativo' : 'Inativo')}</td></tr>`).join('') : '<tr><td colspan="6" class="muted">Nenhum veículo cadastrado.</td></tr>';
  $('#stock-ppes-table').innerHTML = stockPpeCatalog.length ? stockPpeCatalog.map((ppe) => `<tr><td><strong>${escapeHtml(ppe.name)}</strong><small class="table-subtext">${escapeHtml(ppe.category || 'Sem categoria')}</small></td><td>${escapeHtml(ppe.ca)}</td><td>${escapeHtml(ppe.stockQuantity)}</td><td>${escapeHtml(ppe.assignedTo || 'Sem termo assinado')}${ppe.assignedQuantity ? ` · ${escapeHtml(ppe.assignedQuantity)} un.` : ''}</td><td>${escapeHtml(ppe.active ? 'Ativo' : 'Inativo')}</td><td><div class="table-actions"><button type="button" class="secondary small-button" data-ppe-edit="${escapeHtml(ppe.id)}">Editar</button><button type="button" class="secondary small-button" data-ppe-toggle="${escapeHtml(ppe.id)}" data-ppe-next-active="${ppe.active ? 'false' : 'true'}">${ppe.active ? 'Desativar' : 'Ativar'}</button></div>${ppe.assignedAt ? `<small class="table-subtext">${escapeHtml(formatDate(ppe.assignedAt))}</small>` : ''}</td></tr>`).join('') : '<tr><td colspan="6" class="muted">Nenhum EPI cadastrado.</td></tr>';
  document.querySelectorAll('[data-ppe-edit]').forEach((button) => button.addEventListener('click', () => {
    const ppe = stockPpeCatalog.find((item) => String(item.id) === String(button.dataset.ppeEdit));
    if (!ppe) return;
    $('#stock-ppe-id').value = ppe.id;
    $('#stock-ppe-code').value = ppe.code || '';
    $('#stock-ppe-name').value = ppe.name || '';
    $('#stock-ppe-ca').value = ppe.ca || '';
    $('#stock-ppe-category').value = ppe.category || '';
    $('#stock-ppe-quantity').value = ppe.stockQuantity ?? 0;
    $('#stock-ppe-cancel').classList.remove('hidden');
    $('#stock-ppe-message').textContent = 'Editando EPI do catálogo.';
    $('#stock-ppe-name').focus();
  }));
  document.querySelectorAll('[data-ppe-toggle]').forEach((button) => button.addEventListener('click', async () => {
    try { await api(`/api/stock/ppes/${button.dataset.ppeToggle}/status`, { method: 'PATCH', body: JSON.stringify({ active: button.dataset.ppeNextActive === 'true' }) }); await loadStock(); } catch (error) { $('#stock-ppe-message').textContent = error.message; }
  }));
}

function resetStockPpeForm() {
  $('#stock-ppe-form').reset();
  $('#stock-ppe-id').value = '';
  $('#stock-ppe-code').value = '';
  $('#stock-ppe-cancel').classList.add('hidden');
}

function vehicleStatusLabel(status) { return ({ ok: 'OK', defeito: 'Defeito', quebrado: 'Quebrado' }[status] || status); }

function updateVehicleDescriptionCell(row, side) {
  const status = row.querySelector(`[data-side="${side}-status"]`);
  const toggle = row.querySelector(`[data-side="${side}-description-toggle"]`);
  const description = row.querySelector(`[data-side="${side}-description"]`);
  const hasProblem = status.value !== 'ok';
  toggle.disabled = !hasProblem;
  if (!hasProblem) toggle.checked = false;
  description.disabled = !hasProblem || !toggle.checked;
  description.classList.toggle('hidden', !hasProblem || !toggle.checked);
  if (!hasProblem) description.value = '';
}

function renderVehicleEditor() {
  $('#vehicle-items-editor').innerHTML = vehicleItems.map(([key, name]) => `<tr data-item-key="${key}"><td><strong>${escapeHtml(name)}</strong></td>${['before', 'after'].map((side) => `<td><select data-side="${side}-status"><option value="ok">OK</option><option value="defeito">Defeito</option><option value="quebrado">Quebrado</option></select><label class="description-toggle"><input type="checkbox" data-side="${side}-description-toggle" disabled /> Descrição</label><textarea data-side="${side}-description" class="hidden" disabled maxlength="500" placeholder="Descreva rapidamente o problema"></textarea></td>`).join('')}</tr>`).join('');
  document.querySelectorAll('#vehicle-items-editor tr').forEach((row) => ['before', 'after'].forEach((side) => {
    row.querySelector(`[data-side="${side}-status"]`).addEventListener('change', () => updateVehicleDescriptionCell(row, side));
    row.querySelector(`[data-side="${side}-description-toggle"]`).addEventListener('change', () => updateVehicleDescriptionCell(row, side));
    updateVehicleDescriptionCell(row, side);
  }));
}

function readVehicleEditor() {
  return [...document.querySelectorAll('#vehicle-items-editor tr')].map((row) => ({
    itemKey: row.dataset.itemKey,
    beforeStatus: row.querySelector('[data-side="before-status"]').value,
    beforeDescription: row.querySelector('[data-side="before-description"]').value,
    afterStatus: row.querySelector('[data-side="after-status"]').value,
    afterDescription: row.querySelector('[data-side="after-description"]').value,
  }));
}

function renderVehicleSummary(checklist, includeAction = false) {
  const problems = checklist.items.filter((item) => item.beforeStatus !== 'ok' || item.afterStatus !== 'ok').length;
  const action = includeAction ? `<button type="button" class="secondary small-button vehicle-open" data-vehicle-id="${checklist.id}">Abrir</button>` : '';
  return `<div class="vehicle-list-item"><div><strong>${escapeHtml(checklist.plate)} · ${escapeHtml(checklist.model || 'Modelo não informado')}</strong><small>${escapeHtml(checklist.driverName || 'Técnico não informado')} · ${escapeHtml(formatDate(checklist.createdAt))} · ${problems} ocorrência(s)</small></div><div class="vehicle-list-actions"><span class="status status-${escapeHtml(checklist.status)}">${escapeHtml({ pendente_validacao: 'Aguardando validação', validado: 'Validado', reprovado: 'Reprovado', rascunho: 'Rascunho' }[checklist.status] || checklist.status)}</span>${action}</div></div>`;
}

async function loadVehicleChecklists() {
  const data = await api('/api/vehicles/checklists');
  if (['tecnico', 'vistoriador'].includes(currentUser.role)) {
    $('#vehicle-tech-list').innerHTML = data.checklists.length ? data.checklists.map((checklist) => renderVehicleSummary(checklist, true)).join('') : '<p class="muted">Nenhum checklist realizado.</p>';
    document.querySelectorAll('#vehicle-tech-list .vehicle-open').forEach((button) => button.addEventListener('click', () => openVehicleChecklist(button.dataset.vehicleId, '#vehicle-tech-detail')));
  }
  if (currentUser.role === 'admin') {
    $('#vehicle-admin-list').innerHTML = data.checklists.length ? data.checklists.map((checklist) => renderVehicleSummary(checklist, true)).join('') : '<p class="muted">Nenhum checklist cadastrado.</p>';
    document.querySelectorAll('#vehicle-admin-list .vehicle-open').forEach((button) => button.addEventListener('click', () => openVehicleChecklist(button.dataset.vehicleId, '#vehicle-admin-detail')));
  }
}

function vehicleSignatureRoleLabel(role) { return ({ tecnico: 'Técnico', vistoriador: 'Vistoriador', admin: 'Administrador' }[role] || role); }

function renderVehicleSignatures(checklist) {
  if (!checklist.signatures?.length) return '<section class="vehicle-signatures"><h4>Assinaturas</h4><p class="muted">Nenhuma assinatura registrada.</p></section>';
  return `<section class="vehicle-signatures"><h4>Assinaturas</h4><div class="vehicle-signature-list">${checklist.signatures.map((signature) => {
    const canValidate = currentUser?.role === 'admin' || currentUser?.role === signature.signerRole;
    return `<div class="vehicle-signature-row"><div><strong>${escapeHtml(vehicleSignatureRoleLabel(signature.signerRole))}</strong><small>${escapeHtml(signature.typedName || 'Nome não informado')} · ${escapeHtml(formatDate(signature.signedAt))}</small></div><div class="vehicle-signature-actions"><span id="vehicle-signature-status-${signature.id}" class="signature-validation-status ${signature.validatedAt ? 'valid' : ''}">${signature.validatedAt ? 'Validada' : 'Não validada'}</span>${canValidate ? `<button type="button" class="secondary small-button vehicle-signature-validate" data-signature-id="${signature.id}" data-signature-role="${escapeHtml(signature.signerRole)}">Validar assinatura</button>` : ''}</div></div>`;
  }).join('')}</div></section>`;
}

function renderVehicleDetail(checklist, containerSelector, canValidate) {
  const container = $(containerSelector);
  if (!container) return;
  container.classList.remove('hidden');
  const requiresValidationSignature = currentUser?.role !== 'admin';
  const validationControls = canValidate && checklist.status === 'pendente_validacao' ? `<div class="validation-controls">${requiresValidationSignature ? `<div class="epi-signature-preview"><img src="${escapeHtml(currentUser?.signatureData || '')}" alt="Assinatura padrão do responsável pela validação" /></div><label class="consent-check"><input id="vehicle-validation-signature-confirm" type="checkbox" /> Confirmo o uso da minha assinatura padrão nesta validação.</label>` : '<p class="muted">A validação administrativa registra a decisão e a auditoria sem assinatura do administrador.</p>'}<div class="signature-actions"><button id="vehicle-validation-capture-location" type="button" class="secondary">Capturar localização</button></div><textarea id="validation-notes" maxlength="700" placeholder="Observação da validação (opcional)"></textarea><div class="signature-actions"><button id="approve-vehicle" type="button">Validar vistoria</button><button id="reject-vehicle" type="button" class="danger-button">Reprovar vistoria</button></div><p id="validation-message" class="muted">${requiresValidationSignature ? 'A assinatura padrão e a localização serão registradas na validação.' : 'A decisão, data, IP, dispositivo e localização disponível serão registrados.'}</p></div>` : '';
  const media = (checklist.media || []).map((item) => `<figure class="epi-process-media-item"><img src="/api/vehicles/checklists/${checklist.id}/media/${item.id}" alt="Foto do veículo" loading="lazy" /><figcaption><strong>Foto do veículo</strong><span>Data/hora: ${escapeHtml(formatDate(item.createdAt))}</span><span>IP: ${escapeHtml(item.ipAddress || 'Não informado')}</span><span>Navegador: ${escapeHtml(browserLabel(item.userAgent || item.deviceInfo))}</span><span>Dispositivo: ${escapeHtml(deviceLabel(item.userAgent || item.deviceInfo))}</span><span>Cidade: ${escapeHtml(formatMediaLocation(item))}</span><span>Coordenadas: ${escapeHtml(formatMediaCoordinates(item))}</span></figcaption></figure>`).join('');
  container.innerHTML = `<div class="vehicle-detail-card"><div class="section-heading"><div><div class="eyebrow">CHECKLIST #${checklist.id}</div><h3>${escapeHtml(checklist.plate)} · ${escapeHtml(checklist.model || '')}</h3><p class="muted">Técnico: ${escapeHtml(checklist.driverName || '–')} · ${escapeHtml(formatDate(checklist.createdAt))}</p></div><span class="status status-${escapeHtml(checklist.status)}">${escapeHtml({ pendente_validacao: 'Aguardando validação', validado: 'Validado', reprovado: 'Reprovado' }[checklist.status] || checklist.status)}</span></div><div class="table-wrap"><table class="vehicle-detail-table"><thead><tr><th>Item</th><th>Antes</th><th>Descrição</th><th>Depois</th><th>Descrição</th></tr></thead><tbody>${checklist.items.map((item) => `<tr><td>${escapeHtml(item.itemName)}</td><td>${escapeHtml(vehicleStatusLabel(item.beforeStatus))}</td><td>${escapeHtml(item.beforeDescription || '–')}</td><td>${escapeHtml(vehicleStatusLabel(item.afterStatus))}</td><td>${escapeHtml(item.afterDescription || '–')}</td></tr>`).join('')}</tbody></table></div>${checklist.validationNotes ? `<p class="validation-note"><b>Observação do vistoriador:</b> ${escapeHtml(checklist.validationNotes)}</p>` : ''}${media ? `<section class="vehicle-checklist-media"><h4>Fotos registradas</h4><div class="epi-process-media">${media}</div></section>` : ''}${renderVehicleSignatures(checklist)}${validationControls}</div>`;
  container.querySelector('.vehicle-detail-card')?.insertAdjacentHTML('afterbegin', '<div class="detail-actions"><button id="download-vehicle-checklist-pdf" type="button" class="secondary small-button">Baixar PDF</button></div>');
  container.querySelector('#download-vehicle-checklist-pdf')?.addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = `/api/vehicles/checklists/${checklist.id}/pdf`;
    link.download = `checklist-veiculo-${checklist.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  container.querySelectorAll('.vehicle-signature-validate').forEach((button) => button.addEventListener('click', async () => {
    const status = container.querySelector(`#vehicle-signature-status-${button.dataset.signatureId}`);
    button.disabled = true;
    status.className = 'signature-validation-status';
    status.textContent = 'Validando...';
    try {
      const validation = await api(`/api/vehicles/checklists/${checklist.id}/validate-signature`, { method: 'POST', body: JSON.stringify({ signerRole: button.dataset.signatureRole, signatureId: button.dataset.signatureId }) });
      status.className = `signature-validation-status ${validation.valid ? 'valid' : 'invalid'}`;
      status.textContent = validation.valid ? 'Assinatura válida' : 'Assinatura inconsistente';
      status.title = validation.message;
    } catch (error) {
      status.className = 'signature-validation-status invalid';
      status.textContent = error.message;
    } finally { button.disabled = false; }
  }));

  if (canValidate && checklist.status === 'pendente_validacao') {
    let validationLocation = { latitude: null, longitude: null };
    $('#vehicle-validation-capture-location').addEventListener('click', () => {
      const message = $('#validation-message');
      if (!navigator.geolocation) { message.textContent = 'Este dispositivo não oferece localização pelo navegador.'; return; }
      navigator.geolocation.getCurrentPosition((position) => {
        validationLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        message.textContent = `Localização capturada: ${validationLocation.latitude.toFixed(6)}, ${validationLocation.longitude.toFixed(6)}.`;
      }, () => { message.textContent = 'Não foi possível capturar a localização; a assinatura pode continuar sem ela.'; });
    });
    const validate = async (decision) => {
      const message = $('#validation-message');
      if (currentUser?.role !== 'admin' && !$('#vehicle-validation-signature-confirm')?.checked) { message.textContent = 'Confirme o uso da sua assinatura padrão antes de validar.'; return; }
      try {
        if (validationLocation.latitude === null || validationLocation.longitude === null) {
          await new Promise((resolve) => navigator.geolocation?.getCurrentPosition((position) => { validationLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude }; resolve(); }, () => resolve(), { enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 }) || resolve());
        }
        const updated = await api(`/api/vehicles/checklists/${checklist.id}/validate`, { method: 'POST', body: JSON.stringify({ decision, notes: $('#validation-notes').value, signatureConfirmed: currentUser?.role !== 'admin', latitude: validationLocation.latitude, longitude: validationLocation.longitude, deviceInfo: navigator.userAgent }) });
        renderVehicleDetail(updated.checklist, containerSelector, true);
        await loadValidationQueue();
        await loadOverview();
      } catch (error) { message.textContent = error.message; }
    };
    $('#approve-vehicle').addEventListener('click', () => validate('validado'));
    $('#reject-vehicle').addEventListener('click', () => validate('reprovado'));
  }
}

async function openVehicleChecklist(id, containerSelector, validationQueue = false) {
  const data = await api(`/api/vehicles/checklists/${id}${validationQueue ? '?queue=1' : ''}`);
  renderVehicleDetail(data.checklist, containerSelector, ['admin', 'vistoriador'].includes(currentUser.role));
}

function renderEpiPendingSummary(process) {
  return `<div class="vehicle-list-item"><div><strong>${escapeHtml(process.processTitle)}</strong><small>${escapeHtml(process.createdBy.name)}${process.validatorName ? ` · responsável: ${escapeHtml(process.validatorName)}` : ''} · ${escapeHtml(formatDate(process.createdAt))}</small></div><div class="vehicle-list-actions"><span class="status status-pendente_validacao">Aguardando validação</span><button type="button" class="secondary small-button epi-pending-open" data-process-id="${process.id}">Abrir</button></div></div>`;
}

async function loadValidationQueue() {
  const [vehicleData, epiData] = await Promise.all([api('/api/vehicles/checklists?queue=1'), api('/api/epi/processes')]);
  const vehiclePending = vehicleData.checklists.filter((checklist) => checklist.status === 'pendente_validacao');
  const epiPending = epiData.processes.filter((process) => process.status === 'pendente_validacao'
    && (currentUser.role === 'admin' || String(process.validatorUserId || '') === String(currentUser.id)));
  const pending = [
    ...vehiclePending.map((checklist) => renderVehicleSummary(checklist, true)),
    ...epiPending.map(renderEpiPendingSummary),
  ];
  $('#validation-list').innerHTML = pending.length ? pending.join('') : '<p class="muted">Nenhuma pendência encontrada.</p>';
  document.querySelectorAll('#validation-list .vehicle-open').forEach((button) => button.addEventListener('click', () => openVehicleChecklist(button.dataset.vehicleId, '#validation-detail', true)));
  document.querySelectorAll('#validation-list .epi-pending-open').forEach((button) => button.addEventListener('click', async () => { setView('epi-view'); await openEpiProcess(button.dataset.processId); }));
}

function renderItemEditor(items) {
  $('#epi-items-editor').innerHTML = items.map((item, index) => `
    <tr data-item-row="${index}"><td><input data-field="equipmentName" value="${escapeHtml(item[0] ?? item.equipmentName ?? '')}" placeholder="Nome do EPI" required /></td><td><input data-field="quantity" type="number" min="1" value="${escapeHtml(item[1] ?? item.quantity ?? 1)}" required /></td><td><input data-field="ca" value="${escapeHtml(item[2] ?? item.ca ?? '')}" placeholder="CA" /></td><td><select data-field="condition"><option value="novo">Novo</option><option value="nova">Nova</option><option value="usado">Usado</option><option value="usada">Usada</option></select></td><td><input data-field="observation" value="${escapeHtml(item[4] ?? item.observation ?? '')}" placeholder="Observação" /></td><td><button type="button" class="icon-button remove-item" title="Remover item">×</button></td></tr>`).join('');
  $('#epi-items-editor').querySelectorAll('select[data-field="condition"]').forEach((select, index) => { select.value = items[index][3] ?? items[index].condition ?? 'novo'; });
  $('#epi-items-editor').querySelectorAll('.remove-item').forEach((button) => button.addEventListener('click', () => button.closest('tr').remove()));
}

function readItemEditor() {
  return [...document.querySelectorAll('#epi-items-editor tr')].map((row) => ({ equipmentName: row.querySelector('[data-field="equipmentName"]').value, quantity: Number(row.querySelector('[data-field="quantity"]').value), ca: row.querySelector('[data-field="ca"]').value, condition: row.querySelector('[data-field="condition"]').value, observation: row.querySelector('[data-field="observation"]').value }));
}

function renderTerms(terms) {
  if (!terms.length) { $('#terms-list').innerHTML = '<p class="muted">Nenhum termo cadastrado.</p>'; return; }
  $('#terms-list').innerHTML = terms.map((term) => `<button type="button" class="term-list-item ${selectedTermId === term.id ? 'selected' : ''}" data-term-id="${term.id}"><span><strong>${escapeHtml(term.recipientName)}</strong><small>${escapeHtml(term.recipientRole || 'Função não informada')} · ${formatDate(term.createdAt)}</small></span><span class="status status-${escapeHtml(term.status)}">${escapeHtml(statusLabel(term.status))}</span></button>`).join('');
  $('#terms-list').querySelectorAll('[data-term-id]').forEach((button) => button.addEventListener('click', () => openTerm(button.dataset.termId)));
}

async function loadTerms() {
  const data = await api('/api/epi/terms');
  renderTerms(data.terms);
  if (selectedTermId) await openTerm(selectedTermId);
}

function makeSignatureCanvas() {
  const canvas = document.createElement('canvas'); canvas.className = 'signature-pad'; canvas.width = 760; canvas.height = 190;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = '#172033'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  let drawing = false;
  const position = (event) => { const rect = canvas.getBoundingClientRect(); const point = event.touches?.[0] || event; return { x: (point.clientX - rect.left) * canvas.width / rect.width, y: (point.clientY - rect.top) * canvas.height / rect.height }; };
  const start = (event) => { event.preventDefault(); drawing = true; const point = position(event); ctx.beginPath(); ctx.moveTo(point.x, point.y); };
  const move = (event) => { if (!drawing) return; event.preventDefault(); const point = position(event); ctx.lineTo(point.x, point.y); ctx.stroke(); };
  const stop = () => { drawing = false; };
  canvas.addEventListener('pointerdown', start); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointerleave', stop);
  return canvas;
}

function clearSignatureCanvas(canvas) {
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function setupVehicleTechnicianSignature() {
  if (!['tecnico', 'vistoriador'].includes(currentUser?.role)) return;
  const preview = $('#vehicle-signature-preview');
  if (preview) preview.innerHTML = currentUser.signatureData ? `<img src="${escapeHtml(currentUser.signatureData)}" alt="Assinatura padrão cadastrada" />` : '<p class="muted">Assinatura padrão não cadastrada.</p>';
  vehicleSignatureLocation = { latitude: null, longitude: null };
  vehiclePhotoDrafts = [];
  renderVehiclePhotoDrafts();
  $('#vehicle-typed-name').value = currentUser.name || '';
  $('#vehicle-signature-confirm').checked = false;
  $('#vehicle-capture-location').onclick = () => {
    const message = $('#vehicle-signature-message');
    if (!navigator.geolocation) { message.textContent = 'Este dispositivo não oferece localização pelo navegador.'; return; }
    navigator.geolocation.getCurrentPosition((position) => {
      vehicleSignatureLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      message.textContent = `Localização capturada: ${vehicleSignatureLocation.latitude.toFixed(6)}, ${vehicleSignatureLocation.longitude.toFixed(6)}.`;
    }, () => { message.textContent = 'Não foi possível capturar a localização; a assinatura pode continuar sem ela.'; });
  };
}

function renderVehiclePhotoDrafts() {
  const previews = $('#vehicle-photo-previews');
  if (previews) previews.innerHTML = vehiclePhotoDrafts.map((photo, index) => `<div><img src="${photo}" alt="Foto do veículo ${index + 1}" /></div>`).join('');
  const openButton = $('#vehicle-open-photo-camera');
  if (openButton) openButton.disabled = vehiclePhotoDrafts.length >= 10;
  const message = $('#vehicle-photo-message');
  if (message && !vehiclePhotoDrafts.length) message.textContent = 'Nenhuma foto capturada.';
}

async function ensureVehicleLocation() {
  if (vehicleSignatureLocation.latitude !== null && vehicleSignatureLocation.longitude !== null) return;
  if (!navigator.geolocation) return;
  await new Promise((resolve) => navigator.geolocation.getCurrentPosition((position) => {
    vehicleSignatureLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    resolve();
  }, () => resolve(), { enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 }));
}

function renderTermDetail(term) {
  selectedTermId = term.id;
  currentLocation = { latitude: null, longitude: null };
  const canSign = currentUser?.role === 'tecnico' && term.status !== 'assinado';
  $('#term-detail').classList.remove('hidden');
  $('#term-detail').innerHTML = `<div class="detail-actions term-detail-toolbar"><button id="close-term-detail" type="button" class="secondary small-button">Fechar</button></div><div class="term-paper" id="term-paper"><div class="paper-header"><div><strong>${escapeHtml(term.companyName)}</strong><span>CNPJ: ${escapeHtml(term.companyCnpj)}</span></div><span class="paper-number">TERMO #${term.id}</span></div><h2>TERMO DE DEVOLUÇÃO E RESPONSABILIDADE EPI'S</h2><p>Recebi da empresa <strong>${escapeHtml(term.companyName)}</strong>, pessoa jurídica de direito privado, inscrita no CNPJ N° ${escapeHtml(term.companyCnpj)}, a título de empréstimo, para meu uso exclusivo, conforme determinado na lei, os equipamentos de proteção individual especificados neste termo, comprometendo-me a mantê-los em perfeito estado de conservação, ficando ciente de que:</p><ol><li>Se o equipamento for danificado ou inutilizado por emprego inadequado, mau uso, negligência ou extravio, a empresa me fornecerá novo equipamento e cobrará o valor de um equipamento da mesma marca ou equivalente ao da praça.</li><li>Em caso de dano, inutilização ou extravio do equipamento deverei comunicar imediatamente ao setor competente.</li><li>Terminando os serviços ou no caso de rescisão do contrato de trabalho, devolverei o equipamento completo e em perfeito estado de conservação, considerando-se o tempo do uso do mesmo, ao setor competente.</li><li>Estando os equipamentos em minha posse, estarei sujeito a inspeções sem prévio aviso.</li></ol><div class="recipient-line"><span><b>Funcionário:</b> ${escapeHtml(term.recipientName)}</span><span><b>Função:</b> ${escapeHtml(term.recipientRole || 'Não informada')}</span><span><b>Emissão:</b> ${escapeHtml(new Date(`${term.issuedAt}T12:00:00`).toLocaleDateString('pt-BR'))}</span></div><table class="paper-table"><thead><tr><th>Equipamentos</th><th>Qntd.</th><th>CA</th><th>Observação</th></tr></thead><tbody>${term.items.map((item) => `<tr><td>${escapeHtml(item.equipmentName)}</td><td>${escapeHtml(item.quantity)}</td><td>${escapeHtml(item.ca || '')}</td><td>${escapeHtml((item.condition || '').toUpperCase())}${item.observation ? ` · ${escapeHtml(item.observation)}` : ''}</td></tr>`).join('')}</tbody></table><div class="legal-text"><p>${escapeHtml(term.legalText.clt)}</p><p>${escapeHtml(term.legalText.nr06)}</p><p>${escapeHtml(term.legalText.declaration)}</p></div><div class="signature-block"><div class="signature-status"><b>Status: ${escapeHtml(statusLabel(term.status))}</b>${term.signedAt ? `<span>Assinado em ${escapeHtml(formatDate(term.signedAt))}</span><span>Hash: ${escapeHtml(term.signatureHash || '–')}</span><button id="validate-signature" type="button" class="secondary small-button">Validar assinatura</button><span id="signature-validation-status" class="signature-validation-status" aria-live="polite"></span>` : ''}</div>${term.status === 'assinado' ? `<img class="saved-signature" src="${term.signatureData}" alt="Assinatura eletrônica" /><div class="signature-line">Ass. do Funcionário · ${escapeHtml(term.recipientName)}</div><div class="audit-note">Método: assinatura eletrônica interna · IP: ${escapeHtml(term.signerIp || 'não informado')} · Dispositivo: ${escapeHtml(term.signerDevice || term.signerUserAgent || 'não informado')}${term.signerLatitude !== null && term.signerLatitude !== undefined ? ` · Localização: ${escapeHtml(term.signerLatitude)}, ${escapeHtml(term.signerLongitude)}` : ''}</div>` : '<div id="signature-mount"></div><div class="signature-line">Ass. do Funcionário</div>'}</div></div>${canSign ? `<div class="sign-controls"><label>Nome digitado para conferência<input id="typed-name" value="${escapeHtml(term.recipientName)}" /></label><div class="signature-actions"><button id="capture-location" type="button" class="secondary">Capturar localização</button><button id="clear-signature" type="button" class="secondary">Limpar assinatura</button><button id="sign-term" type="button">Assinar termo</button></div><p id="signature-message" class="muted">Desenhe a assinatura no quadro branco. A localização é opcional.</p></div>` : ''}<div class="detail-actions"><button id="print-term" type="button" class="secondary">Imprimir / salvar PDF</button></div>`;

  const termHeader = $('#term-paper .paper-header');
  if (termHeader && term.companyLogoData) {
    const companyBlock = termHeader.querySelector('div');
    companyBlock?.classList.add('term-brand');
    companyBlock?.insertAdjacentHTML('afterbegin', `<img class="company-term-logo" src="${escapeHtml(term.companyLogoData)}" alt="Logo da empresa" />`);
  }
  const termActions = $('#term-detail .detail-actions:last-child');
  termActions?.insertAdjacentHTML('afterbegin', '<button id="download-term-pdf" type="button" class="secondary">Baixar PDF</button>');
  $('#download-term-pdf')?.addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = `/api/epi/terms/${term.id}/pdf`;
    link.download = `termo-epi-${term.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  });
  $('#close-term-detail').addEventListener('click', () => {
    selectedTermId = null;
    $('#term-detail').classList.add('hidden');
  });

  if (canSign) {
    const canvas = makeSignatureCanvas(); $('#signature-mount').appendChild(canvas);
    $('#clear-signature').addEventListener('click', () => { const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); });
    $('#capture-location').addEventListener('click', () => { if (!navigator.geolocation) { $('#signature-message').textContent = 'Este dispositivo não oferece localização pelo navegador.'; return; } navigator.geolocation.getCurrentPosition((position) => { currentLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude }; $('#signature-message').textContent = `Localização capturada: ${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}.`; }, () => { $('#signature-message').textContent = 'Não foi possível capturar a localização; a assinatura pode continuar sem ela.'; }); });
    $('#sign-term').addEventListener('click', async () => { const message = $('#signature-message'); try { const signed = await api(`/api/epi/terms/${term.id}/sign`, { method: 'POST', body: JSON.stringify({ typedName: $('#typed-name').value.trim(), signatureData: canvas.toDataURL('image/png'), latitude: currentLocation.latitude, longitude: currentLocation.longitude, deviceInfo: navigator.userAgent }) }); renderTermDetail(signed.term); await loadTerms(); await loadOverview(); } catch (error) { message.textContent = error.message; } });
  }
  if (term.status === 'assinado') {
    $('#validate-signature').addEventListener('click', async () => {
      const button = $('#validate-signature');
      const status = $('#signature-validation-status');
      button.disabled = true;
      status.className = 'signature-validation-status';
      status.textContent = 'Validando...';
      try {
        const validation = await api(`/api/epi/terms/${term.id}/validate-signature`, { method: 'POST' });
        status.className = `signature-validation-status ${validation.valid ? 'valid' : 'invalid'}`;
        status.textContent = validation.valid ? 'Assinatura válida' : 'Assinatura inconsistente';
        status.title = validation.message;
      } catch (error) {
        status.className = 'signature-validation-status invalid';
        status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  }
  $('#print-term').addEventListener('click', () => window.print());
  document.querySelectorAll('#terms-list [data-term-id]').forEach((button) => button.classList.toggle('selected', String(button.dataset.termId) === String(term.id)));
}

async function openTerm(id) { const data = await api(`/api/epi/terms/${id}`); renderTermDetail(data.term); $('#term-detail').scrollIntoView({ behavior: 'smooth', block: 'start' }); }

$('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); $('#login-error').textContent = ''; try { const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: $('#login-email').value, password: $('#login-password').value }) }); showApp(data.user); } catch (error) { $('#login-error').textContent = error.message; } });
$('#logout').addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST' }); window.location.reload(); });
document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelectorAll('.settings-tab-button').forEach((button) => button.addEventListener('click', () => setSettingsTab(button.dataset.settingsTab)));
$('#mobile-menu-toggle').addEventListener('click', () => { const sidebar = $('.sidebar'); const toggle = $('#mobile-menu-toggle'); const isOpen = sidebar.classList.toggle('mobile-open'); toggle.setAttribute('aria-expanded', String(isOpen)); });
$('#notifications-toggle').addEventListener('click', async () => { const panel = $('#notifications-panel'); const open = panel.classList.toggle('hidden'); $('#notifications-toggle').setAttribute('aria-expanded', String(!open)); if (!open) await loadNotifications(); });
$('#notifications-close').addEventListener('click', () => { $('#notifications-panel').classList.add('hidden'); $('#notifications-toggle').setAttribute('aria-expanded', 'false'); });
$('#notifications-read-all').addEventListener('click', async () => { try { await api('/api/notifications/read-all', { method: 'POST' }); await loadNotifications(); } catch (error) { $('#notifications-list').innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; } });
$('#refresh-overview').addEventListener('click', () => loadOverview());
$('#refresh-audit').addEventListener('click', () => loadAuditLogs());

$('#onboarding-password-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#onboarding-password-message');
  if ($('#onboarding-new-password').value !== $('#onboarding-confirm-password').value) { message.textContent = 'A confirmação não corresponde à nova senha.'; return; }
  try {
    await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: $('#onboarding-current-password').value, newPassword: $('#onboarding-new-password').value }) });
    event.target.reset();
    message.textContent = '';
    await loadOnboardingStatus();
  } catch (error) { message.textContent = error.message; }
});

$('#onboarding-clear-signature').addEventListener('click', () => { if (onboardingSignatureCanvas) clearSignatureCanvas(onboardingSignatureCanvas); });
$('#onboarding-save-signature').addEventListener('click', async () => {
  const message = $('#onboarding-signature-message');
  if (!onboardingSignatureCanvas || !$('#onboarding-signature-confirm').checked) { message.textContent = 'Desenhe sua assinatura e confirme que ela será usada para validar seus registros.'; return; }
  try { await api('/api/onboarding/signature', { method: 'POST', body: JSON.stringify({ signatureData: onboardingSignatureCanvas.toDataURL('image/png'), confirmed: true }) }); message.textContent = ''; await loadOnboardingStatus(); } catch (error) { message.textContent = error.message; }
});

$('#onboarding-capture-location').addEventListener('click', () => {
  const message = $('#onboarding-consent-message');
  if (!navigator.geolocation) { message.textContent = 'O dispositivo não oferece localização pelo navegador. Você ainda pode consentir e registrar sem coordenadas.'; return; }
  navigator.geolocation.getCurrentPosition((position) => { onboardingLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude }; message.textContent = `Localização capturada: ${onboardingLocation.latitude.toFixed(6)}, ${onboardingLocation.longitude.toFixed(6)}.`; }, () => { message.textContent = 'Não foi possível capturar coordenadas; o consentimento ainda pode ser registrado.'; });
});

$('#onboarding-save-consent').addEventListener('click', async () => {
  const message = $('#onboarding-consent-message');
  const payload = { consentLocation: $('#consent-location').checked, consentIp: $('#consent-ip').checked, consentImage: $('#consent-image').checked, latitude: onboardingLocation.latitude, longitude: onboardingLocation.longitude };
  if (!payload.consentLocation || !payload.consentIp || !payload.consentImage) { message.textContent = 'Marque os três consentimentos para continuar.'; return; }
  try { await api('/api/onboarding/consent', { method: 'POST', body: JSON.stringify(payload) }); message.textContent = ''; const data = await api('/api/me'); showApp(data.user); } catch (error) { message.textContent = error.message; }
});

$('#company-onboarding-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#company-onboarding-message');
  message.textContent = 'Salvando dados da empresa...';
  try {
    await api('/api/company', { method: 'PUT', body: JSON.stringify(await readCompanyPayload('onboarding')) });
    const data = await api('/api/me');
    message.textContent = '';
    showApp(data.user);
  } catch (error) { message.textContent = error.message; }
});

$('#company-settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#company-settings-message');
  message.textContent = 'Salvando dados da empresa...';
  try {
    const payload = await readCompanyPayload('settings');
    const saved = await api('/api/company', { method: 'PUT', body: JSON.stringify(payload) });
    fillCompanyForm('onboarding', saved.company);
    fillCompanyForm('settings', saved.company);
    message.textContent = 'Dados da empresa salvos.';
    const data = await api('/api/me');
    currentUser = data.user;
  } catch (error) { message.textContent = error.message; }
});

$('#password-form').addEventListener('submit', async (event) => { event.preventDefault(); const message = $('#password-message'); if ($('#new-password').value !== $('#confirm-password').value) { message.textContent = 'A confirmação não corresponde à nova senha.'; return; } try { await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: $('#current-password').value, newPassword: $('#new-password').value }) }); event.target.reset(); message.textContent = 'Senha alterada com sucesso.'; } catch (error) { message.textContent = error.message; } });

$('#user-form').addEventListener('submit', async (event) => { event.preventDefault(); const message = $('#user-form-message'); try { await api('/api/users', { method: 'POST', body: JSON.stringify({ name: $('#user-name-input').value, email: $('#user-email-input').value, role: $('#user-role-input').value, password: $('#user-password-input').value }) }); event.target.reset(); message.textContent = 'Usuário criado com sucesso.'; await loadUsers(); await loadOverview(); } catch (error) { message.textContent = error.message; } });

$('#admin-notification-recipient-mode').addEventListener('change', updateAdminNotificationRecipientMode);
$('#admin-notification-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = $('#admin-notification-status');
  const mode = $('#admin-notification-recipient-mode').value;
  const userIds = mode === 'selected' ? [...$('#admin-notification-users').selectedOptions].map((option) => option.value) : [];
  try {
    const result = await api('/api/admin/notifications', { method: 'POST', body: JSON.stringify({ recipientMode: mode, userIds, title: $('#admin-notification-title').value, message: $('#admin-notification-message').value }) });
    event.target.reset();
    updateAdminNotificationRecipientMode();
    status.textContent = `Notificação enviada para ${result.sentCount} usuário(s).`;
  } catch (error) { status.textContent = error.message; }
});

$('#epi-add-process-item').addEventListener('click', () => { const items = readEpiProcessItems(); items.push({ ppeItemId: '', quantity: 1, condition: 'novo', observation: '' }); renderEpiProcessItems(items); });
document.querySelectorAll('.epi-process-option').forEach((button) => button.addEventListener('click', () => setEpiProcessType(button.dataset.processType)));
$('#refresh-epi-processes').addEventListener('click', () => loadEpiProcesses());
$('#refresh-epi-terms').addEventListener('click', () => loadTerms().catch((error) => { $('#terms-list').innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; }));
$('#epi-process-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#epi-process-form-message');
  try {
    const data = await api('/api/epi/processes', { method: 'POST', body: JSON.stringify({ processType: $('#epi-process-type').value, validatorUserId: $('#epi-validator-user').value || null, targetUserId: $('#epi-target-user').value || null, items: readEpiProcessItems() }) });
    currentEpiProcess = data.process;
    epiProcessLocation = { latitude: null, longitude: null };
    $('#epi-process-form').classList.add('hidden');
    $('#epi-selfie-step').classList.remove('hidden');
    message.textContent = '';
    $('#epi-selfie-message').textContent = 'A assinatura foi validada. Agora registre a selfie.';
    await loadEpiProcesses();
    await loadOverview();
  } catch (error) { message.textContent = error.message; }
});

$('#epi-open-selfie-camera').addEventListener('click', () => { $('#epi-selfie-camera').classList.remove('hidden'); openEpiCamera('#epi-selfie-video', '#epi-selfie-message', 'user'); });
$('#epi-cancel-selfie').addEventListener('click', () => { stopEpiCamera('#epi-selfie-video'); $('#epi-selfie-camera').classList.add('hidden'); });
$('#epi-take-selfie').addEventListener('click', async () => {
  const message = $('#epi-selfie-message');
  const imageData = captureVideoFrame('#epi-selfie-video');
  if (!imageData || !currentEpiProcess) { message.textContent = 'A câmera ainda não está pronta.'; return; }
  stopEpiCamera('#epi-selfie-video');
  $('#epi-selfie-camera').classList.add('hidden');
  try {
    message.textContent = 'Enviando selfie...';
    await requestEpiProcessLocation();
    const data = await api(`/api/epi/processes/${currentEpiProcess.id}/selfie`, { method: 'POST', body: JSON.stringify({ imageData, captureMode: 'camera', deviceInfo: navigator.userAgent, latitude: epiProcessLocation.latitude, longitude: epiProcessLocation.longitude }) });
    currentEpiProcess = data.process;
    $('#epi-selfie-step').classList.add('hidden');
    $('#epi-photos-step').classList.remove('hidden');
    $('#epi-photos-message').textContent = 'Tire até cinco fotos dos EPIs para concluir.';
  } catch (error) { message.textContent = error.message; }
});

function renderEpiPhotoDrafts() {
  $('#epi-photo-previews').innerHTML = epiPhotoDrafts.map((photo, index) => `<div><img src="${photo}" alt="Foto do EPI ${index + 1}" /></div>`).join('');
  $('#epi-send-photos').disabled = epiPhotoDrafts.length === 0;
  $('#epi-open-photo-camera').disabled = epiPhotoDrafts.length >= 5;
}

$('#epi-open-photo-camera').addEventListener('click', () => { $('#epi-photo-camera').classList.remove('hidden'); openEpiCamera('#epi-photo-video', '#epi-photos-message', 'environment'); });
$('#epi-cancel-photo').addEventListener('click', () => { stopEpiCamera('#epi-photo-video'); $('#epi-photo-camera').classList.add('hidden'); });
$('#epi-take-photo').addEventListener('click', () => {
  const imageData = captureVideoFrame('#epi-photo-video');
  if (!imageData) { $('#epi-photos-message').textContent = 'A câmera ainda não está pronta.'; return; }
  epiPhotoDrafts.push(imageData);
  stopEpiCamera('#epi-photo-video');
  $('#epi-photo-camera').classList.add('hidden');
  renderEpiPhotoDrafts();
  $('#epi-photos-message').textContent = `${epiPhotoDrafts.length} foto(s) preparada(s).`;
});
$('#epi-send-photos').addEventListener('click', async () => {
  if (!currentEpiProcess || !epiPhotoDrafts.length) return;
  const message = $('#epi-photos-message');
  try {
    await requestEpiProcessLocation();
    await api(`/api/epi/processes/${currentEpiProcess.id}/photos`, { method: 'POST', body: JSON.stringify({ photos: epiPhotoDrafts.map((imageData) => ({ imageData, captureMode: 'camera', latitude: epiProcessLocation.latitude, longitude: epiProcessLocation.longitude })), deviceInfo: navigator.userAgent, latitude: epiProcessLocation.latitude, longitude: epiProcessLocation.longitude }) });
    message.textContent = 'Processo enviado para validação.';
    currentEpiProcess = null;
    epiPhotoDrafts = [];
    renderEpiPhotoDrafts();
    $('#epi-photos-step').classList.add('hidden');
    $('#epi-process-form').classList.remove('hidden');
    $('#epi-process-form').reset();
    $('#epi-signature-confirm').checked = false;
    renderEpiProcessItems();
    setEpiProcessType(selectedEpiProcessType);
    await loadEpiProcesses();
    await loadNotifications();
    await loadOverview();
  } catch (error) { message.textContent = error.message; }
});

$('#vehicle-open-photo-camera').addEventListener('click', () => { $('#vehicle-photo-camera').classList.remove('hidden'); openEpiCamera('#vehicle-photo-video', '#vehicle-photo-message', 'environment'); });
$('#vehicle-cancel-photo').addEventListener('click', () => { stopEpiCamera('#vehicle-photo-video'); $('#vehicle-photo-camera').classList.add('hidden'); });
$('#vehicle-take-photo').addEventListener('click', () => {
  const imageData = captureVideoFrame('#vehicle-photo-video');
  if (!imageData) { $('#vehicle-photo-message').textContent = 'A câmera ainda não está pronta.'; return; }
  vehiclePhotoDrafts.push(imageData);
  stopEpiCamera('#vehicle-photo-video');
  $('#vehicle-photo-camera').classList.add('hidden');
  renderVehiclePhotoDrafts();
  $('#vehicle-photo-message').textContent = `${vehiclePhotoDrafts.length} foto(s) preparada(s).`;
});

$('#vehicle-checklist-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#vehicle-form-message');
  if (!currentUser?.signatureData || !$('#vehicle-signature-confirm').checked) { message.textContent = 'Confirme a assinatura padrão cadastrada antes de enviar o checklist.'; return; }
  if (!vehiclePhotoDrafts.length) { message.textContent = 'Capture pelo menos uma foto do veículo antes de enviar o checklist.'; return; }
  try {
    await ensureVehicleLocation();
    await api('/api/vehicles/checklists', { method: 'POST', body: JSON.stringify({ plate: $('#vehicle-plate').value, model: $('#vehicle-model').value, vehicleYear: $('#vehicle-year').value, mileage: $('#vehicle-mileage').value, items: readVehicleEditor(), signatureConfirmed: true, latitude: vehicleSignatureLocation.latitude, longitude: vehicleSignatureLocation.longitude, deviceInfo: navigator.userAgent, photos: vehiclePhotoDrafts.map((imageData) => ({ imageData, captureMode: 'camera', latitude: vehicleSignatureLocation.latitude, longitude: vehicleSignatureLocation.longitude })) }) });
    event.target.reset(); renderVehicleEditor(); setupVehicleTechnicianSignature(); message.textContent = 'Checklist e fotos enviados para validação do vistoriador.'; await loadVehicleChecklists(); await loadOverview();
  } catch (error) { message.textContent = error.message; }
});
$('#refresh-vehicle-checklists').addEventListener('click', () => loadVehicleChecklists().catch((error) => { $('#vehicle-tech-list').innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; }));
$('#refresh-validation').addEventListener('click', () => loadValidationQueue().catch((error) => { $('#validation-list').innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; }));
$('#refresh-stock').addEventListener('click', () => loadStock().catch((error) => { $('#stock-vehicles-table').innerHTML = `<tr><td colspan="6" class="error">${escapeHtml(error.message)}</td></tr>`; }));

$('#stock-vehicle-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#stock-vehicle-message');
  try {
    await api('/api/stock/vehicles', { method: 'POST', body: JSON.stringify({ plate: $('#stock-vehicle-plate').value, model: $('#stock-vehicle-model').value, year: $('#stock-vehicle-year').value, color: $('#stock-vehicle-color').value }) });
    event.target.reset(); message.textContent = 'Veículo salvo no estoque.'; await loadStock();
  } catch (error) { message.textContent = error.message; }
});

$('#stock-ppe-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#stock-ppe-message');
  try {
    await api('/api/stock/ppes', { method: 'POST', body: JSON.stringify({ id: $('#stock-ppe-id').value || null, code: $('#stock-ppe-code').value || null, name: $('#stock-ppe-name').value, ca: $('#stock-ppe-ca').value, category: $('#stock-ppe-category').value, stockQuantity: $('#stock-ppe-quantity').value }) });
    resetStockPpeForm(); message.textContent = 'EPI salvo no catálogo.'; await loadStock();
  } catch (error) { message.textContent = error.message; }
});

$('#stock-ppe-cancel').addEventListener('click', () => { resetStockPpeForm(); $('#stock-ppe-message').textContent = ''; });

api('/api/me').then(({ user }) => showApp(user)).catch(() => {});
