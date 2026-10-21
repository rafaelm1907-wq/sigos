const $ = (selector) => document.querySelector(selector);

const stockPpeCaField = $('#stock-ppe-ca');
if (stockPpeCaField) {
  stockPpeCaField.required = false;
  stockPpeCaField.placeholder = 'CA (opcional)';
}

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

const vehicleDailyItems = [
  ['esquerda', 'LADO ESQUERDO'],
  ['direita', 'LADO DIREITO'],
  ['frente', 'FRENTE'],
  ['traseira', 'TRASEIRA'],
  ['interna', 'PARTE INTERNA'],
];

let epiDailyChecklistItems = [
  { key: 'ppe_capacete_jugular', section: 'verificacao', label: 'Capacete de segurança com jugular' },
  { key: 'ppe_oculos_seguranca', section: 'verificacao', label: 'Óculos de segurança' },
  { key: 'ppe_luvas_riscos_mecanicos', section: 'verificacao', label: 'Luvas de proteção contra riscos mecânicos' },
  { key: 'ppe_calcado_seguranca', section: 'verificacao', label: 'Calçado de segurança' },
  { key: 'ppe_colete_visibilidade', section: 'verificacao', label: 'Colete/vestimenta de alta visibilidade, quando aplicável' },
  { key: 'ppe_protetor_auricular', section: 'verificacao', label: 'Protetor auricular, quando houver exposição a ruído' },
  { key: 'ppe_cinturao_paraquedista', section: 'verificacao', label: 'Cinturão de segurança tipo paraquedista - trabalho em altura' },
  { key: 'ppe_talabarte_absorvedor', section: 'verificacao', label: 'Talabarte duplo com absorvedor de energia, quando aplicável' },
  { key: 'ppe_trava_quedas', section: 'verificacao', label: 'Trava-quedas, quando aplicável' },
  { key: 'ppe_mosquetoes_conectores', section: 'verificacao', label: 'Mosquetões/conectores sem deformações ou danos' },
  { key: 'ppe_luva_isolante', section: 'verificacao', label: 'Luva isolante adequada ao risco elétrico, quando aplicável' },
  { key: 'ppe_luva_cobertura', section: 'verificacao', label: 'Luva de cobertura da luva isolante, quando aplicável' },
  { key: 'ppe_vestimenta_risco_eletrico', section: 'verificacao', label: 'Vestimenta adequada ao risco elétrico, quando aplicável' },
  { key: 'ppe_protetor_facial', section: 'verificacao', label: 'Protetor facial, quando houver risco de arco/projeção' },
  { key: 'inspection_limpeza', section: 'inspecao', label: 'EPIs estão limpos e sem rasgos, trincas ou deformações.' },
  { key: 'inspection_jugular', section: 'inspecao', label: 'Jugular do capacete está funcionando corretamente.' },
  { key: 'inspection_cinturao', section: 'inspecao', label: 'Cinturão não apresenta cortes, fios rompidos ou costuras danificadas.' },
  { key: 'inspection_conectores', section: 'inspecao', label: 'Talabartes, trava-quedas e conectores estão sem danos e funcionando corretamente.' },
  { key: 'inspection_calcado', section: 'inspecao', label: 'Calçado está sem rasgos, sola solta ou desgaste excessivo.' },
  { key: 'inspection_luvas', section: 'inspecao', label: 'Luvas estão sem furos, rasgos ou contaminação.' },
  { key: 'inspection_compatibilidade', section: 'inspecao', label: 'EPIs estão compatíveis com a atividade programada e com os riscos identificados.' },
  { key: 'inspection_substituicao', section: 'inspecao', label: 'Nenhum EPI danificado será utilizado; item não conforme será substituído antes do início.' },
];

const roleLabels = { admin: 'Administrador', superadmin: 'Superadmin', tecnico: 'Técnico', vistoriador: 'Supervisor' };
function isAdminRole(role = currentUser?.role) { return role === 'admin' || role === 'superadmin'; }
function isSuperadminRole(role = currentUser?.role) { return role === 'superadmin'; }
function isChecklistValidatorRole(role = currentUser?.role) { return isAdminRole(role) || role === 'vistoriador'; }
const eventLabels = {
  login_success: 'Login realizado',
  login_failed: 'Falha de login',
  logout: 'Logout',
  password_changed: 'Senha alterada',
  user_created: 'Conta criada',
  user_updated: 'Conta alterada',
  user_deactivated: 'Conta desativada',
  epi_term_created: 'Termo EPI emitido',
  epi_term_signed: 'Termo EPI assinado',
  epi_signature_validated: 'Assinatura EPI validada',
  vehicle_checklist_created: 'Checklist de veículo enviado',
  vehicle_checklist_validated: 'Checklist de veículo validado',
  vehicle_registered: 'Veículo cadastrado',
  vehicle_updated: 'Veículo atualizado',
  vehicle_deleted: 'Veículo excluído',
  vehicle_equipment_registered: 'Equipamento de veículo cadastrado',
  vehicle_equipment_updated: 'Equipamento de veículo atualizado',
  vehicle_equipment_deleted: 'Equipamento de veículo excluído',
  vehicle_signature_signed: 'Assinatura de checklist registrada',
  vehicle_signature_validated: 'Assinatura de checklist validada',
  vehicle_checklist_photos_uploaded: 'Fotos do veículo registradas',
  vehicle_transfer_accepted: 'Transferência de veículo aceita',
  vehicle_transfer_ready_for_admin: 'Transferência pronta para validação do Admin',
  vehicle_delivery_accepted: 'Entrega de veículo aceita pelo técnico',
  vehicle_integrity_assigned: 'Pendência de integridade enviada',
  vehicle_integrity_corrected: 'Avaria de veículo marcada como corrigida',
  selfie_uploaded: 'Selfie registrada',
  user_signature_registered: 'Assinatura padrão cadastrada',
  user_data_consent_registered: 'Consentimento registrado',
  epi_process_created: 'Processo EPI iniciado',
  epi_process_signature_validated: 'Termo EPI validado',
  epi_process_selfie_uploaded: 'Selfie do processo EPI registrada',
  epi_process_photos_uploaded: 'Fotos dos EPIs registradas',
  epi_process_validated: 'Processo EPI validado',
  epi_process_admin_signature_validated: 'Assinatura do Admin registrada na validação',
  epi_replacement_requested: 'Solicitação de troca de EPI',
  epi_process_attention: 'Checklist EPI requer atenção',
  epi_process_attention_sent_back: 'Checklist devolvido ao técnico',
  epi_process_attention_returned: 'Confirmação do técnico recebida',
  epi_process_attention_returned_by_technician: 'Checklist retornado pelo técnico',
  epi_transfer_started: 'Transferência de EPI iniciada',
  push_device_registered: 'Dispositivo de notificações registrado',
  compliance_alert_justified: 'Alerta de conformidade justificado',
  compliance_alert_followup_sent: 'Notificação de pendência enviada',
  compliance_pending_assigned: 'Pendência enviada para usuário',
  compliance_pending_completed: 'Pendência concluída',
  system_update_requested: 'Atualização do sistema solicitada',
};

let selectedTermId = null;
let selectedVehicleId = null;
let currentUser = null;
let currentLocation = { latitude: null, longitude: null };
let vehicleSignatureCanvas = null;
let vehicleSignatureLocation = { latitude: null, longitude: null };
let notificationsTimer = null;
let browserNotificationBaselineReady = false;
let browserNotificationKnownIds = new Set();
let vehicleCatalog = [];
let vehicleTargetUsers = [];
let vehicleDeliveryTargetUsers = [];
let vehicleWizardIndex = 0;
let vehicleWizardDraft = [];
let vehicleSelfieDraft = null;
let vehiclePhotoCaptureItemKey = null;
let selectedVehicleChecklistType = null;
let selectedVehicleChecklistPurpose = null;
let onboardingSignatureCanvas = null;
let securitySignatureCanvas = null;
let onboardingSignatureMode = 'desenhada';
let securitySignatureMode = 'desenhada';
let onboardingLocation = { latitude: null, longitude: null };
let selectedEpiProcessType = null;
let currentEpiProcess = null;
let epiCameraStream = null;
let epiPhotoDrafts = [];
let epiProcessLocation = { latitude: null, longitude: null };
let epiAttentionSelfieDraft = null;
let validationSelfieDraft = null;
let epiWizardIndex = 0;
let epiWizardItems = [];
let epiDailyPhotoDrafts = {};
let mobileChecklistActive = false;
let mobileChecklistKind = null;
let mobileWorkflowParent = null;
let mobileWorkflowAnchor = null;
let vehiclePhotoDrafts = [];
let epiCatalog = [];
const epiDailyInspectionItems = epiDailyChecklistItems.filter((item) => item.section === 'inspecao');

function rebuildDailyChecklistItemsFromCatalog() {
  const verificationItems = epiCatalog.map((item) => ({
    key: `ppe_catalog_${item.id}`,
    section: 'verificacao',
    label: item.name,
    ppeItemId: item.id,
    ca: item.ca || '',
  }));
  epiDailyChecklistItems = [...verificationItems, ...epiDailyInspectionItems];
}
let stockPpeCatalog = [];
let selectedStockVehicleId = '';
let nativePushToken = null;
let webPushPublicKey = null;
let webPushServiceWorkerRegistration = null;
let selectedSettingsTab = 'company';
let selectedStockPanel = 'fleet';
let activeViewId = 'home-view';
let technicianCalendarMonth = '';
let technicianCalendarDays = [];
let complianceAssignableUsers = [];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function activateSubtab(group, tab) {
  const buttons = [...document.querySelectorAll('[data-subtab-button]')].filter((button) => button.dataset.subtabGroup === group);
  const panels = [...document.querySelectorAll('[data-subtab-panel]')].filter((panel) => panel.dataset.subtabPanel === group);
  if (!buttons.length && !panels.length) return;
  const availableTabs = buttons.map((button) => button.dataset.subtab).filter((value) => value);
  const selected = availableTabs.includes(tab) ? tab : (availableTabs[0] || tab);
  buttons.forEach((button) => {
    const active = button.dataset.subtab === selected;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  panels.forEach((panel) => panel.classList.toggle('hidden', panel.dataset.subtab !== selected));
}

function createSubtabBar(group, tabs, label) {
  const bar = document.createElement('div');
  bar.className = 'subtabs';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', label);
  tabs.forEach(([value, text], index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `subtab-button${index === 0 ? ' active' : ''}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(index === 0));
    button.dataset.subtabButton = '';
    button.dataset.subtabGroup = group;
    button.dataset.subtab = value;
    button.textContent = text;
    bar.appendChild(button);
  });
  return bar;
}

function initializeSubtabs() {
  const stockView = $('#stock-view');
  const stockGrid = $('#stock-grid');
  if (stockView && stockGrid && !stockView.querySelector('[data-subtab-group="stock-main"]')) {
    stockView.insertBefore(createSubtabBar('stock-main', [['fleet', 'Frota'], ['ppe', 'EPIs'], ['movements', 'Movimentações']], 'Áreas do estoque'), stockGrid);
    [['stock-fleet-panel', 'fleet'], ['stock-ppe-panel', 'ppe'], ['stock-movements-panel', 'movements']].forEach(([id, tab]) => {
      const panel = $(`#${id}`);
      if (!panel) return;
      panel.dataset.subtabPanel = 'stock-main';
      panel.dataset.subtab = tab;
      panel.dataset.stockPanel = tab;
    });
  }

  const adminPanel = $('#admin-panel');
  if (adminPanel && !adminPanel.querySelector('[data-subtab-group="admin-main"]')) {
    const notificationPanel = adminPanel.querySelector('.admin-notification-panel');
    const managementSelectors = ['#user-form', '#user-form-message', '.table-wrap', '#user-edit-panel', '#technician-detail'];
    managementSelectors.forEach((selector) => adminPanel.querySelector(selector)?.setAttribute('data-subtab-panel', 'admin-main'));
    managementSelectors.forEach((selector) => adminPanel.querySelector(selector)?.setAttribute('data-subtab', 'users'));
    notificationPanel?.setAttribute('data-subtab-panel', 'admin-main');
    notificationPanel?.setAttribute('data-subtab', 'notifications');
    const heading = adminPanel.querySelector('.section-heading');
    if (heading) heading.insertAdjacentElement('afterend', createSubtabBar('admin-main', [['users', 'Usuários'], ['notifications', 'Notificações']], 'Administração de usuários'));
  }

  document.querySelectorAll('[data-subtab-button]').forEach((button) => {
    if (button.dataset.subtabBound === 'true') return;
    button.dataset.subtabBound = 'true';
    button.addEventListener('click', () => {
      activateSubtab(button.dataset.subtabGroup, button.dataset.subtab);
      if (button.dataset.subtabGroup === 'stock-main') {
        selectedStockPanel = button.dataset.subtab;
        const stockGrid = $('#stock-grid');
        if (stockGrid) stockGrid.dataset.stockPanel = selectedStockPanel;
        updateNavigationActive();
      }
    });
  });
  const groups = [...new Set([...document.querySelectorAll('[data-subtab-button]')].map((button) => button.dataset.subtabGroup).filter(Boolean))];
  groups.forEach((group) => {
    const active = [...document.querySelectorAll('[data-subtab-button]')].find((button) => button.dataset.subtabGroup === group && button.classList.contains('active'));
    activateSubtab(group, active?.dataset.subtab);
  });
}

function formatDate(value) {
  if (!value) return '–';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function currentFortalezaMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}

function currentFortalezaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function reportDateLabel(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return '–';
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

function shiftCalendarMonth(value, amount) {
  const [year, month] = value.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + amount, 1, 12));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

function renderTechnicianCalendar() {
  const container = $('#technician-calendar');
  if (!container || !technicianCalendarMonth) return;
  const [year, month] = technicianCalendarMonth.split('-').map(Number);
  const firstDayOffset = (new Date(Date.UTC(year, month - 1, 1, 12)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  const title = new Date(Date.UTC(year, month - 1, 1, 12)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const completedDays = new Set(technicianCalendarDays);
  const cells = [
    ...Array.from({ length: firstDayOffset }, () => '<span class="calendar-day empty" aria-hidden="true"></span>'),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const dateKey = `${technicianCalendarMonth}-${String(day).padStart(2, '0')}`;
      const completed = completedDays.has(dateKey);
      return `<span class="calendar-day ${completed ? 'completed' : ''}" ${completed ? `title="Checklist diário realizado em ${dateKey}" aria-label="${day}, checklist realizado"` : `title="${dateKey}: sem checklist diário registrado" aria-label="${day}, sem checklist"`}>${day}${completed ? '<span class="calendar-check" aria-hidden="true">✓</span>' : ''}</span>`;
    }),
  ].join('');
  container.innerHTML = `<div class="technician-calendar-heading"><button type="button" class="secondary small-button" data-calendar-shift="-1" aria-label="Mês anterior">‹</button><h4>${escapeHtml(title)}</h4><button type="button" class="secondary small-button" data-calendar-shift="1" aria-label="Próximo mês">›</button></div><div class="technician-calendar-grid" aria-label="Calendário de checklists diários"><span class="calendar-weekday">Seg</span><span class="calendar-weekday">Ter</span><span class="calendar-weekday">Qua</span><span class="calendar-weekday">Qui</span><span class="calendar-weekday">Sex</span><span class="calendar-weekday">Sáb</span><span class="calendar-weekday">Dom</span>${cells}</div><p class="calendar-legend"><span class="calendar-check" aria-hidden="true">✓</span> Checklist diário registrado</p>`;
  container.querySelectorAll('[data-calendar-shift]').forEach((button) => button.addEventListener('click', () => {
    technicianCalendarMonth = shiftCalendarMonth(technicianCalendarMonth, Number(button.dataset.calendarShift));
    renderTechnicianCalendar();
  }));
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
  if (notification.entityType === 'vehicle_integrity_action') return isAdminRole() ? 'Abrir integridade dos veículos' : 'Pendência de integridade de veículo';
  if (notification.entityType === 'epi_term') return 'Abrir termo de EPI';
  if (notification.entityType === 'epi_process') return 'Abrir processo de EPI';
  if (notification.entityType === 'compliance_alert') return isAdminRole() ? 'Abrir alertas de conformidade' : 'Fazer checklist diário';
  if (notification.entityType === 'compliance_pending_task') return 'Abrir Pendências';
  if (notification.notificationType === 'daily_checklist_reminder') return 'Abrir checklist diário de EPI';
  if (notification.notificationType === 'admin_message') return 'Mensagem do administrador';
  return 'Abrir registro';
}

function browserNotificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function browserNotificationStorageKey() {
  return currentUser ? `sigos.browser-notifications.${currentUser.id}` : null;
}

function loadBrowserNotificationState() {
  browserNotificationKnownIds = new Set();
  const key = browserNotificationStorageKey();
  if (!key) return;
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || '[]');
    if (Array.isArray(stored)) browserNotificationKnownIds = new Set(stored.map((id) => String(id)).slice(-100));
  } catch {
    browserNotificationKnownIds = new Set();
  }
}

function saveBrowserNotificationState() {
  const key = browserNotificationStorageKey();
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...browserNotificationKnownIds].slice(-100)));
  } catch {
    // A política de armazenamento do navegador não impede as notificações internas.
  }
}

function updateBrowserNotificationControls() {
  const button = $('#enable-browser-notifications');
  const status = $('#browser-notification-status');
  if (!button || !status) return;
  if (!browserNotificationsSupported()) {
    button.classList.add('hidden');
    status.textContent = 'Este navegador não oferece alertas nativos.';
    return;
  }
  const permission = Notification.permission;
  button.classList.toggle('hidden', permission === 'granted');
  button.disabled = permission === 'denied';
  button.textContent = permission === 'denied' ? 'Alertas bloqueados' : 'Ativar alertas do navegador';
  status.textContent = permission === 'granted'
    ? 'Alertas do navegador ativados.'
    : permission === 'denied'
      ? 'Permissão bloqueada. Libere as notificações nas configurações do navegador.'
      : 'Receba alertas mesmo quando esta aba estiver em segundo plano.';
}

async function requestBrowserNotifications() {
  if (!browserNotificationsSupported()) return;
  const status = $('#browser-notification-status');
  try {
    const permission = await Notification.requestPermission();
    updateBrowserNotificationControls();
    if (permission === 'granted') {
      status.textContent = 'Alertas do navegador ativados.';
      const testNotification = new Notification('SIGOS', {
        body: 'Os alertas do navegador estão ativados.',
        icon: '/assets/sigos-symbol.png',
        tag: 'sigos-browser-notifications-enabled',
      });
      testNotification.onclick = () => window.focus();
    }
  } catch {
    if (status) status.textContent = 'Não foi possível ativar os alertas neste navegador.';
  }
}

function showBrowserNotification(notification, notifications) {
  if (!browserNotificationsSupported() || Notification.permission !== 'granted') return;
  const browserNotification = new Notification(notification.title || 'SIGOS', {
    body: notification.message || 'Você recebeu uma nova notificação.',
    icon: '/assets/sigos-symbol.png',
    tag: `sigos-notification-${notification.id}`,
    renotify: true,
  });
  browserNotification.onclick = () => {
    window.focus();
    openNotification(notification.id, notifications);
    browserNotification.close();
  };
}

function notifyBrowserAboutNewNotifications(notifications) {
  const ids = notifications.map((notification) => String(notification.id));
  if (!browserNotificationBaselineReady) {
    ids.forEach((id) => browserNotificationKnownIds.add(id));
    browserNotificationBaselineReady = true;
    saveBrowserNotificationState();
    return;
  }
  const newNotifications = notifications.filter((notification) => !browserNotificationKnownIds.has(String(notification.id)));
  newNotifications.slice().reverse().forEach((notification) => showBrowserNotification(notification, notifications));
  ids.forEach((id) => browserNotificationKnownIds.add(id));
  saveBrowserNotificationState();
}

function renderNotifications(notifications, unreadCount) {
  const count = $('#notification-count');
  count.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
  count.classList.toggle('hidden', unreadCount === 0);
  updateBrowserNotificationControls();
  $('#notifications-list').innerHTML = notifications.length ? notifications.map((notification) => `<button type="button" class="notification-item ${notification.readAt ? '' : 'unread'}" data-notification-id="${notification.id}"><span class="notification-item-heading"><strong>${escapeHtml(notification.title)}</strong><small>${escapeHtml(formatDate(notification.createdAt))}</small></span><span>${escapeHtml(notification.message)}</span><small class="notification-link">${escapeHtml(notificationEntityLabel(notification))}</small></button>`).join('') : '<p class="muted">Nenhuma notificação.</p>';
  $('#notifications-list').querySelectorAll('[data-notification-id]').forEach((button) => button.addEventListener('click', () => openNotification(button.dataset.notificationId, notifications)));
}

async function loadNotifications() {
  if (!currentUser) return;
  try {
    const data = await api('/api/notifications');
    notifyBrowserAboutNewNotifications(data.notifications);
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
      if (isAdminRole()) { setView('vehicles-view'); await openVehicleChecklist(notification.entityId, '#vehicle-admin-detail'); }
      else if (currentUser.role === 'vistoriador') { setView('validation-view'); await openVehicleChecklist(notification.entityId, '#validation-detail', true); }
      else { setView('vehicles-view'); await openVehicleChecklist(notification.entityId, '#vehicle-tech-detail'); }
    } else if (notification.entityType === 'epi_term' && (isAdminRole() || currentUser.role === 'tecnico')) {
      setView('epi-view'); await loadTerms(); await openTerm(notification.entityId);
    } else if (notification.entityType === 'epi_process') {
      setView('epi-view'); await openEpiProcess(notification.entityId);
    } else if (notification.entityType === 'compliance_alert' && isAdminRole()) {
      setView('home-view'); await loadComplianceAlerts();
    } else if (notification.entityType === 'compliance_alert' && currentUser.role === 'tecnico' && notification.notificationType === 'epi_daily_missing') {
      setView('epi-view'); setEpiProcessType('checklist_diario');
    } else if (notification.entityType === 'compliance_alert' && ['tecnico', 'vistoriador'].includes(currentUser.role) && notification.notificationType === 'vehicle_daily_missing_end') {
      setView('vehicles-view'); await loadVehicleChecklists();
    } else if (notification.entityType === 'compliance_pending_task') {
      setView('pending-view'); await loadPendingTasks();
    } else if (notification.entityType === 'vehicle_integrity_action' && isAdminRole()) {
      setView('stock-view'); await loadStock();
    }
  } catch (error) {
    $('#notifications-panel').classList.remove('hidden');
    $('#notifications-toggle').setAttribute('aria-expanded', 'true');
    $('#notifications-list').innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

function setMobileMenuOpen(open) {
  const sidebar = $('.sidebar');
  const toggle = $('#mobile-menu-toggle');
  const backdrop = $('#mobile-menu-backdrop');
  const isOpen = Boolean(open);
  sidebar?.classList.toggle('mobile-open', isOpen);
  backdrop?.classList.toggle('open', isOpen);
  backdrop?.setAttribute('aria-hidden', String(!isOpen));
  toggle?.setAttribute('aria-expanded', String(isOpen));
  document.body.classList.toggle('mobile-menu-open', isOpen);
}

function closeMobileMenu() {
  setMobileMenuOpen(false);
}

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/mobile/auth/login')) {
    handleSessionExpired(body.error);
  }
  if (!response.ok) {
    const error = new Error(body.error || 'Não foi possível concluir a operação.');
    error.code = body.code;
    error.process = body.process;
    throw error;
  }
  return body;
}

function pdfDownloadStatus(button) {
  const parent = button?.parentElement;
  if (!parent) return null;
  let status = parent.querySelector('[data-pdf-download-status]');
  if (!status) {
    status = document.createElement('span');
    status.className = 'muted pdf-download-status';
    status.dataset.pdfDownloadStatus = 'true';
    status.setAttribute('aria-live', 'polite');
    button.insertAdjacentElement('afterend', status);
  }
  return status;
}

async function downloadPdfFile(url, filename, button) {
  if (!button || button.disabled) return;
  const status = pdfDownloadStatus(button);
  const originalLabel = button.textContent;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = 'Preparando PDF…';
  if (status) status.textContent = '';
  try {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) handleSessionExpired(body.error);
      throw new Error(body.error || 'Não foi possível baixar o PDF.');
    }
    const blob = await response.blob();
    const file = new File([blob], filename, { type: 'application/pdf' });
    let canShareFile = false;
    try {
      canShareFile = typeof navigator.share === 'function'
        && typeof navigator.canShare === 'function'
        && navigator.canShare({ files: [file] });
    } catch {
      canShareFile = false;
    }
    if (canShareFile) {
      try {
        await navigator.share({ title: filename, text: 'PDF gerado pelo SIGOS', files: [file] });
        if (status) status.textContent = 'PDF pronto para salvar ou compartilhar.';
        return;
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        // Alguns WebViews expõem o Web Share, mas recusam arquivos após o await do download.
        // Nesse caso, continua para o fallback de download/abertura do PDF.
      }
    }
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    if (status) status.textContent = 'Download iniciado.';
  } catch (error) {
    if (error?.name === 'AbortError') {
      if (status) status.textContent = 'Compartilhamento cancelado.';
    } else if (status) {
      status.textContent = error.message || 'Não foi possível baixar o PDF.';
      status.classList.add('error');
    }
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.textContent = originalLabel;
  }
}

function handleSessionExpired(message = 'Sua sessão foi encerrada porque este usuário entrou em outro aparelho.') {
  currentUser = null;
  if (notificationsTimer) {
    clearInterval(notificationsTimer);
    notificationsTimer = null;
  }
  $('#app-view').classList.add('hidden');
  $('#login-view').classList.remove('hidden');
  $('#login-error').textContent = message;
  $('#notifications-panel')?.classList.add('hidden');
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isPwaStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches === true || navigator.standalone === true;
}

function updatePwaInstallControls() {
  const iosButton = $('#pwa-install-ios');
  const status = $('#pwa-install-status');
  if (!iosButton || !status) return;
  const standalone = isPwaStandalone();
  iosButton.textContent = standalone && isIosDevice() ? 'SIGOS já está instalado' : 'Instalar no iPhone/iPad';
  if (standalone) {
    status.textContent = 'O SIGOS está instalado como aplicativo neste dispositivo.';
  } else if (isIosDevice()) {
    status.textContent = 'No iPhone/iPad, use o Safari e a opção “Adicionar à Tela de Início”.';
  } else {
    status.textContent = 'Se o botão de instalação não aparecer, use o menu do navegador e escolha “Adicionar à tela inicial”.';
  }
}

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

function webPushStatus(message, isError = false) {
  const element = $('#pwa-push-status');
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('error', isError);
}

async function registerWebPushSubscription(subscription) {
  if (!subscription) return false;
  await api('/api/push/web/register', {
    method: 'POST',
    body: JSON.stringify({ subscription: subscription.toJSON(), deviceInfo: navigator.userAgent }),
  });
  webPushStatus('Notificações deste dispositivo estão ativadas.');
  return true;
}

async function enableWebPushNotifications() {
  if (!webPushPublicKey) {
    webPushStatus('O servidor ainda não terminou a configuração das notificações para este dispositivo.', true);
    return;
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    webPushStatus('Este navegador não oferece notificações Web Push.', true);
    return;
  }
  if (isIosDevice() && !isPwaStandalone()) {
    webPushStatus('No iPhone/iPad, primeiro instale o SIGOS pela opção “Adicionar à Tela de Início”. Depois abra o ícone instalado e tente novamente.', true);
    $('#pwa-ios-instructions')?.classList.remove('hidden');
    return;
  }
  try {
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') {
      webPushStatus('Permissão de notificações não concedida. Libere-a nas configurações do navegador.', true);
      return;
    }
    webPushServiceWorkerRegistration ||= await navigator.serviceWorker.ready;
    let subscription = await webPushServiceWorkerRegistration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await webPushServiceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(webPushPublicKey),
      });
    }
    await registerWebPushSubscription(subscription);
  } catch (error) {
    webPushStatus(error.message || 'Não foi possível ativar as notificações neste dispositivo.', true);
  }
}

function ensureApplicationsSettingsPanel() {
  let panel = $('#applications-settings-panel');
  if (!panel) {
    const securityPanel = $('#security-settings-panel');
    if (!securityPanel?.parentElement) return null;
    panel = document.createElement('section');
    panel.id = 'applications-settings-panel';
    panel.className = 'card profile-card settings-panel hidden';
    panel.dataset.settingsPanel = 'applications';
    panel.setAttribute('role', 'tabpanel');
    panel.innerHTML = '<div class="section-heading"><div><div class="eyebrow">CONFIGURAÇÕES</div><h2>Aplicativos</h2><p class="muted">Instale o SIGOS neste dispositivo e configure as notificações.</p></div></div>';
    securityPanel.parentElement.insertBefore(panel, securityPanel.nextSibling);
  }
  const pwaSection = $('.pwa-install-section');
  if (pwaSection && pwaSection.parentElement !== panel) panel.appendChild(pwaSection);
  return panel;
}

let systemUpdatePollTimer = null;

function renderSystemUpdateStatus(status = {}) {
  const message = $('#system-update-status');
  const button = $('#system-update-button');
  if (!message || !button) return;
  const labels = { running: 'Atualização em andamento...', success: status.message || 'Sistema atualizado.', failed: status.message || 'A atualização falhou.', not_configured: status.message || 'O atualizador ainda não foi configurado neste servidor.' };
  message.textContent = labels[status.status] || status.message || 'Status do atualizador indisponível.';
  message.classList.toggle('error', status.status === 'failed' || status.status === 'not_configured');
  message.classList.toggle('success-message', status.status === 'success');
  button.disabled = status.status === 'running' || status.status === 'not_configured';
  if (systemUpdatePollTimer) { clearTimeout(systemUpdatePollTimer); systemUpdatePollTimer = null; }
  if (status.status === 'running') systemUpdatePollTimer = setTimeout(loadSystemUpdateStatus, 3000);
}

async function loadSystemUpdateStatus() {
  if (!isSuperadminRole()) return;
  try {
    renderSystemUpdateStatus(await api('/api/system/update'));
  } catch (error) {
    const message = $('#system-update-status');
    if (message) { message.textContent = error.message; message.classList.add('error'); }
    const button = $('#system-update-button');
    if (button) button.disabled = false;
  }
}

async function startSystemUpdate() {
  const button = $('#system-update-button');
  const message = $('#system-update-status');
  if (!button || !message || !isSuperadminRole()) return;
  button.disabled = true;
  message.classList.remove('error', 'success-message');
  message.textContent = 'Solicitando a atualização...';
  try {
    await api('/api/system/update', { method: 'POST' });
    await loadSystemUpdateStatus();
  } catch (error) {
    message.textContent = error.message;
    message.classList.add('error');
    button.disabled = false;
  }
}

async function setupPwaFeatures() {
  ensureApplicationsSettingsPanel();
  $('#pwa-install-android')?.remove();
  $('#pwa-android-instructions')?.remove();
  const installActions = $('.pwa-install-actions');
  if (installActions && !$('#pwa-download-android')) {
    const downloadLink = document.createElement('a');
    downloadLink.id = 'pwa-download-android';
    downloadLink.className = 'pwa-download-button';
    downloadLink.href = '/download/sigos.apk';
    downloadLink.download = 'sigos.apk';
    downloadLink.textContent = 'Baixar APK Android';
    installActions.insertBefore(downloadLink, $('#pwa-install-ios'));
  }
  updatePwaInstallControls();
  if (!('serviceWorker' in navigator)) return;
  try {
    webPushServiceWorkerRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    if (!currentUser) return;
    const config = await api('/api/push/web/config');
    webPushPublicKey = config.publicKey || null;
    const subscription = await webPushServiceWorkerRegistration.pushManager?.getSubscription();
    if (subscription && webPushPublicKey) await registerWebPushSubscription(subscription);
  } catch {
    // A instalação do PWA continua disponível mesmo quando o Web Push não é suportado.
  }
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
  const allowedTabs = isAdminRole() ? ['company', 'security', 'users', 'applications'] : ['security', 'applications'];
  const selectedTab = allowedTabs.includes(tab) ? tab : allowedTabs[0];
  selectedSettingsTab = selectedTab;
  document.querySelectorAll('.settings-tab-button').forEach((button) => {
    const active = button.dataset.settingsTab === selectedTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-settings-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.settingsPanel !== selectedTab));
  if (selectedTab === 'company' && isAdminRole()) loadCompanySettings();
  if (selectedTab === 'users' && isAdminRole()) loadUsers();
  if (selectedTab === 'applications') { updatePwaInstallControls(); loadSystemUpdateStatus(); }
  updateNavigationActive();
}

function setStockPanel(panel) {
  selectedStockPanel = ['fleet', 'ppe', 'movements'].includes(panel) ? panel : 'fleet';
  document.querySelectorAll('#stock-view .stock-panel').forEach((element) => element.classList.toggle('hidden', element.dataset.stockPanel !== selectedStockPanel));
  const stockGrid = $('#stock-grid');
  if (stockGrid) stockGrid.dataset.stockPanel = selectedStockPanel;
  activateSubtab('stock-main', selectedStockPanel);
  updateNavigationActive();
}

function updateNavigationActive() {
  document.querySelectorAll('.nav-item').forEach((button) => {
    const settingsMatch = !button.dataset.settingsTab || button.dataset.settingsTab === selectedSettingsTab;
    const stockMatch = !button.dataset.stockPanel || button.dataset.stockPanel === selectedStockPanel;
    button.classList.toggle('active', button.dataset.view === activeViewId && settingsMatch && stockMatch);
  });
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

function setView(viewId, options = {}) {
  closeMobileMenu();
  activeViewId = viewId;
  if (options.settingsTab) selectedSettingsTab = options.settingsTab;
  if (options.stockPanel) selectedStockPanel = options.stockPanel;
  document.querySelectorAll('.app-section').forEach((section) => section.classList.toggle('hidden', section.id !== viewId));
  if (viewId === 'home-view') loadOverview();
  if (viewId === 'report-view' && isAdminRole()) loadReport();
  if (viewId === 'pending-view' && currentUser) loadPendingTasks();
  if (viewId === 'epi-view' && currentUser) {
    loadEpiProcesses();
    if (isAdminRole() || currentUser.role === 'tecnico') loadTerms();
  }
  if (viewId === 'vehicles-view' && currentUser) { loadVehicleCatalog(); loadVehicleChecklists(); }
  if (viewId === 'validation-view' && isChecklistValidatorRole()) loadValidationQueue();
  if (viewId === 'settings-view') setSettingsTab(selectedSettingsTab);
  if (viewId === 'stock-view' && isAdminRole()) { setStockPanel(selectedStockPanel); loadStock(); }
  if (viewId === 'audit-view' && isAdminRole()) loadAuditLogs();
  updateNavigationActive();
}

function configureCadastroHeading() {
  const heading = $('#stock-view .page-intro');
  if (!heading) return;
  const eyebrow = heading.querySelector('.eyebrow');
  const title = heading.querySelector('h2');
  if (eyebrow) eyebrow.textContent = 'CADASTRO';
  if (title) title.textContent = 'Cadastro';
}

function configureNavigation(user) {
  initializeSubtabs();
  $('#sidebar-role').textContent = roleLabels[user.role] || user.role;
  $('#user-role').textContent = roleLabels[user.role] || user.role;
  $('#nav-epi').classList.remove('hidden');
  $('#nav-validation').classList.toggle('hidden', !isChecklistValidatorRole(user.role));
  $('#nav-reports').classList.toggle('hidden', !isAdminRole(user.role));
  $('#nav-stock-fleet').classList.toggle('hidden', !isAdminRole(user.role));
  $('#nav-stock-ppe').classList.toggle('hidden', !isAdminRole(user.role));
  $('#nav-admin-users').classList.toggle('hidden', !isAdminRole(user.role));
  $('#nav-admin-company').classList.toggle('hidden', !isAdminRole(user.role));
  $('#nav-admin-security').classList.remove('hidden');
  $('#nav-audit').classList.toggle('hidden', !isAdminRole(user.role));
  $('#nav-pending').classList.remove('hidden');
  $('#system-update-section')?.classList.toggle('hidden', !isSuperadminRole(user.role));
  configureCadastroHeading();
  $('#epi-technician-form').classList.toggle('hidden', user.role !== 'tecnico');
  $('#admin-panel').classList.toggle('hidden', !isAdminRole(user.role));
  $('#epi-new-process-tab')?.classList.toggle('hidden', user.role !== 'tecnico');
  $('#company-settings-card').classList.toggle('hidden', !isAdminRole(user.role));
  $('#settings-tab-company').classList.toggle('hidden', !isAdminRole(user.role));
  $('#settings-tab-users').classList.toggle('hidden', !isAdminRole(user.role));
  setSettingsTab(selectedSettingsTab);
  $('#vehicle-tech-panel').classList.toggle('hidden', !['admin', 'superadmin', 'tecnico', 'vistoriador'].includes(user.role));
  $('#vehicle-admin-panel').classList.toggle('hidden', !isAdminRole(user.role));
  $('#vehicle-main-management-tab')?.classList.toggle('hidden', !isAdminRole(user.role));
  $('#compliance-alerts-card').classList.toggle('hidden', !isAdminRole(user.role));
  activateSubtab('epi-main', user.role === 'tecnico' ? 'new' : 'processes');
  activateSubtab('vehicles-main', 'new');
  activateSubtab('vehicles-tech', 'new');
  activateSubtab('vehicles-admin', 'list');
  activateSubtab('validation-main', 'list');
  activateSubtab('admin-main', 'users');
}

function showApp(user) {
  currentUser = user;
  browserNotificationBaselineReady = false;
  loadBrowserNotificationState();
  registerNativePushToken();
  setupPwaFeatures();
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
  if (!user.onboardingComplete) {
    $('#main-app-layout').classList.add('hidden');
    $('#onboarding-gate').classList.remove('hidden');
    loadOnboardingStatus();
    return;
  }
  $('#onboarding-gate').classList.add('hidden');
  $('#main-app-layout').classList.remove('hidden');
  initializeSubtabs();
  configureNavigation(user);
  if (['admin', 'superadmin', 'tecnico', 'vistoriador'].includes(user.role)) { renderVehicleEditor(); setupVehicleTechnicianSignature(); }
  if (['admin', 'superadmin', 'tecnico', 'vistoriador'].includes(user.role)) loadVehicleCatalog();
  loadOnboardingStatus();
  if (user.role === 'tecnico') { renderEpiProcessItems(); setEpiProcessType(selectedEpiProcessType, false); }
  loadNotifications();
  loadPendingTasks();
  if (notificationsTimer) clearInterval(notificationsTimer);
  notificationsTimer = window.setInterval(loadNotifications, 30000);
  loadOverview();
}

function complianceAlertTypeLabel(type) {
  return ({
    epi_daily_missing: 'Checklist diário de EPI ausente',
    vehicle_daily_missing_end: 'Segundo checklist diário de veículo ausente',
    vehicle_fortnightly_first: 'Primeiro prazo quinzenal do mês',
    vehicle_fortnightly_month_end: 'Segundo checklist quinzenal do mês',
  }[type] || 'Pendência de checklist');
}

async function loadComplianceAlerts() {
  const container = $('#compliance-alerts-list');
  if (!container || !isAdminRole()) return;
  try {
    if (!complianceAssignableUsers.length) {
      const usersData = await api('/api/users');
      complianceAssignableUsers = usersData.users || [];
    }
    const data = await api('/api/admin/compliance-alerts');
    if (!data.alerts.length) {
      container.innerHTML = '<p class="muted">Nenhum alerta pendente.</p>';
      return;
    }
    container.innerHTML = data.alerts.map((alert) => {
      const encodedKey = encodeURIComponent(alert.alertKey);
      const recipients = complianceAssignableUsers.filter((user) => user.active && String(user.id) !== String(currentUser.id));
      const assignment = alert.activeTask
        ? `<div class="compliance-assigned-task"><strong>Pendência enviada para ${escapeHtml(alert.activeTask.assignedToName || 'usuário')}.</strong><span class="muted">Aguardando conclusão.</span></div>`
        : `<div class="compliance-assignment"><label>Enviar para<select data-alert-recipient="${escapeHtml(encodedKey)}" ${recipients.length ? '' : 'disabled'}><option value="">Selecione um usuário</option>${recipients.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)} · ${escapeHtml(roleLabels[user.role] || user.role)}</option>`).join('')}</select></label><button type="button" class="secondary small-button" data-compliance-action="assign" data-alert-key="${escapeHtml(encodedKey)}" ${recipients.length ? '' : 'disabled'}>Enviar para</button></div>`;
      return `<article class="compliance-alert-item"><div class="compliance-alert-heading"><div><strong>${escapeHtml(alert.title)}</strong><span>${escapeHtml(complianceAlertTypeLabel(alert.alertType))} · ${escapeHtml(alert.periodKey)}</span></div><small>${escapeHtml(alert.subjectLabel)}</small></div><p>${escapeHtml(alert.message)}</p><textarea data-alert-observation="${escapeHtml(encodedKey)}" maxlength="700" placeholder="Justificar"></textarea><div class="form-actions"><button type="button" class="small-button" data-compliance-action="justify" data-alert-key="${escapeHtml(encodedKey)}">Justificar</button>${assignment}<span class="muted" data-alert-status="${escapeHtml(encodedKey)}" aria-live="polite"></span></div></article>`;
    }).join('');
    container.querySelectorAll('[data-compliance-action]').forEach((button) => button.addEventListener('click', async () => {
      const key = decodeURIComponent(button.dataset.alertKey);
      const observationField = [...container.querySelectorAll('[data-alert-observation]')].find((field) => field.dataset.alertObservation === button.dataset.alertKey);
      const status = [...container.querySelectorAll('[data-alert-status]')].find((field) => field.dataset.alertStatus === button.dataset.alertKey);
      const observation = observationField?.value.trim() || '';
      try {
        button.disabled = true;
        let endpoint;
        let body;
        if (button.dataset.complianceAction === 'justify') {
          if (!observation) throw new Error('Informe a justificativa antes de salvar.');
          endpoint = `/api/admin/compliance-alerts/${encodeURIComponent(key)}/justify`;
          body = { observation };
        } else {
          const recipient = container.querySelector(`[data-alert-recipient="${CSS.escape(button.dataset.alertKey)}"]`);
          if (!recipient?.value) throw new Error('Selecione um usuário antes de enviar.');
          endpoint = `/api/admin/compliance-alerts/${encodeURIComponent(key)}/assign`;
          body = { assignedTo: recipient.value, instruction: observation };
        }
        await api(endpoint, { method: 'POST', body: JSON.stringify(body) });
        await loadComplianceAlerts();
        await loadPendingTasks();
        await loadNotifications();
      } catch (error) {
        if (status) status.textContent = error.message;
        button.disabled = false;
      }
    }));
  } catch (error) {
    container.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

async function loadPendingTasks() {
  const container = $('#pending-list');
  if (!container || !currentUser) return;
  try {
    const data = await api('/api/pending');
    const tasks = data.tasks || [];
    const count = $('#pending-count');
    if (count) {
      count.textContent = tasks.length > 99 ? '99+' : String(tasks.length);
      count.classList.toggle('hidden', tasks.length === 0);
    }
    if (!tasks.length) {
      container.innerHTML = '<p class="muted">Nenhuma pendência.</p>';
      return;
    }
    container.innerHTML = tasks.map((task) => `<article class="pending-task-item"><div class="pending-task-heading"><div><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.subjectLabel)} · ${escapeHtml(complianceAlertTypeLabel(task.alertType))}</span></div><small>${escapeHtml(formatDate(task.assignedAt))}</small></div><p>${escapeHtml(task.message)}</p><div class="pending-task-meta"><span>Enviada por: ${escapeHtml(task.assignedByName || 'Administrador')}</span><span>Responsável: ${escapeHtml(task.assignedToName || '–')}</span></div><div class="pending-task-instruction"><strong>Orientação</strong><span>${escapeHtml(task.instruction)}</span></div><textarea data-pending-note="${escapeHtml(task.id)}" maxlength="700" placeholder="Observação da conclusão (opcional)"></textarea><div class="pending-task-actions"><button type="button" data-pending-action="complete" data-pending-id="${escapeHtml(task.id)}">Marcar como cumprida</button><span class="muted" data-pending-status="${escapeHtml(task.id)}" aria-live="polite"></span></div></article>`).join('');
    container.querySelectorAll('[data-pending-action="complete"]').forEach((button) => button.addEventListener('click', async () => {
      const taskId = button.dataset.pendingId;
      const note = container.querySelector(`[data-pending-note="${CSS.escape(taskId)}"]`)?.value.trim() || '';
      const status = container.querySelector(`[data-pending-status="${CSS.escape(taskId)}"]`);
      try {
        button.disabled = true;
        await api(`/api/pending/${encodeURIComponent(taskId)}/complete`, { method: 'POST', body: JSON.stringify({ note }) });
        await loadPendingTasks();
        await loadNotifications();
    if (isAdminRole()) { await loadComplianceAlerts(); await loadOverview(); }
      } catch (error) {
        if (status) status.textContent = error.message;
        button.disabled = false;
      }
    }));
  } catch (error) {
    container.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
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
    if (isAdminRole()) await loadComplianceAlerts();
    await loadPendingTasks();
  } catch (error) {
    $('#activity-table').innerHTML = `<tr><td colspan="4" class="error">${escapeHtml(error.message)}</td></tr>`;
  }
}

function reportChecklistStatus(technician) {
  if (technician.completed) return '<span class="report-status report-status-ok">Fez checklist</span>';
  return '<span class="report-status report-status-missing">Não fez</span>';
}

function reportVehicleChecklistSummary(vehicle) {
  const total = Number(vehicle.dailyCount || 0) + Number(vehicle.fortnightlyCount || 0) + Number(vehicle.transferCount || 0) + Number(vehicle.deliveryCount || 0);
  if (!total) return '<span class="report-status report-status-missing">Nenhum no período</span>';
  return `<span class="report-status report-status-ok">${total} registro${total === 1 ? '' : 's'}</span>`;
}

function reportAlertStatus(status) {
  return ({ aberto: 'Aberto', justificado: 'Justificado', resolvido: 'Resolvido' }[status] || status || '–');
}

function renderReport(data) {
  const content = $('#report-content');
  if (!content) return;
  const periodNames = { diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal' };
  const periodText = `${periodNames[data.period] || data.period} · ${reportDateLabel(data.startDate)} a ${reportDateLabel(data.endDate)}`;
  $('#report-period-label').textContent = `Período analisado: ${periodText}`;
  const technicians = data.technicians || [];
  const missingTechnicians = technicians.filter((technician) => !technician.completed);
  const vehicles = data.vehicles || [];
  const alerts = data.alerts || [];
  const openTasks = data.openTasks || [];
  const activity = data.activity || [];
  const stats = data.stats || {};
  const metric = (label, value) => `<article class="stat card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? 0)}</strong></article>`;
  content.innerHTML = `<div class="stats-grid report-stats">${metric('Checklists diários EPI', stats.dailyEpiChecklists)}${metric('Checklists de veículos', stats.vehicleChecklists)}${metric('Termos EPI assinados', stats.signedEpiTerms)}${metric('Técnicos que fizeram', technicians.filter((technician) => technician.completed).length)}${metric('Técnicos que faltaram', missingTechnicians.length)}${metric('Pendências abertas agora', Number(stats.openAlerts || 0) + Number(stats.openTasks || 0))}</div><div class="report-grid"><section class="report-subcard"><div class="section-heading"><div><h3>Checklist diário dos técnicos</h3><p class="muted">Quem realizou e quem não registrou no período.</p></div><span class="badge">${technicians.length} técnico${technicians.length === 1 ? '' : 's'}</span></div>${technicians.length ? `<div class="table-wrap"><table><thead><tr><th>Técnico</th><th>Status</th><th>Checklists</th><th>Com atenção</th><th>Último registro</th></tr></thead><tbody>${technicians.map((technician) => `<tr><td><strong>${escapeHtml(technician.name)}</strong><small class="table-subtext">${escapeHtml(technician.email)}</small></td><td>${reportChecklistStatus(technician)}</td><td>${escapeHtml(technician.checklistCount)}</td><td>${escapeHtml(technician.attentionCount)}</td><td>${escapeHtml(formatDate(technician.lastChecklistAt))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nenhum técnico elegível no período.</p>'}</section><section class="report-subcard"><div class="section-heading"><div><h3>Veículos</h3><p class="muted">Movimentações e checklists registrados no período.</p></div><span class="badge">${vehicles.length} veículo${vehicles.length === 1 ? '' : 's'}</span></div>${vehicles.length ? `<div class="table-wrap"><table><thead><tr><th>Veículo</th><th>Registros</th><th>Diário</th><th>Quinzenal</th><th>Transf.</th><th>Entrega/recebimento</th><th>Pend. validação</th></tr></thead><tbody>${vehicles.map((vehicle) => `<tr><td><strong>${escapeHtml(vehicle.plate)}</strong><small class="table-subtext">${escapeHtml(vehicle.model || '–')}</small></td><td>${reportVehicleChecklistSummary(vehicle)}</td><td>${escapeHtml(vehicle.dailyCount)}</td><td>${escapeHtml(vehicle.fortnightlyCount)}</td><td>${escapeHtml(vehicle.transferCount)}</td><td>${escapeHtml(vehicle.deliveryCount)}</td><td>${escapeHtml(vehicle.pendingValidationCount)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nenhum veículo ativo cadastrado.</p>'}</section></div><div class="report-grid"><section class="report-subcard"><div class="section-heading"><div><h3>Pendências do período</h3><p class="muted">Alertas de conformidade gerados na faixa selecionada.</p></div><span class="badge">${alerts.length}</span></div>${alerts.length ? `<div class="report-list">${alerts.map((alert) => `<article class="report-list-item"><div><strong>${escapeHtml(alert.title)}</strong><span>${escapeHtml(alert.subject_label || '–')} · ${escapeHtml(reportAlertStatus(alert.status))}</span></div><p>${escapeHtml(alert.message || '–')}</p><small>${escapeHtml(formatDate(alert.created_at))}</small></article>`).join('')}</div>` : '<p class="muted">Nenhum alerta gerado no período.</p>'}</section><section class="report-subcard"><div class="section-heading"><div><h3>Tarefas pendentes</h3><p class="muted">Pendências atribuídas que ainda aguardam conclusão.</p></div><span class="badge">${openTasks.length}</span></div>${openTasks.length ? `<div class="report-list">${openTasks.map((task) => `<article class="report-list-item"><div><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.subject_label || '–')} · Responsável: ${escapeHtml(task.assigned_to_name || '–')}</span></div><p>${escapeHtml(task.instruction || '–')}</p><small>Enviada em ${escapeHtml(formatDate(task.assigned_at))}</small></article>`).join('')}</div>` : '<p class="muted">Nenhuma tarefa pendente.</p>'}</section></div><section class="report-subcard"><div class="section-heading"><div><h3>Atividades do período</h3><p class="muted">Últimos registros de auditoria relacionados ao intervalo.</p></div><span class="badge">${activity.length}</span></div>${activity.length ? `<div class="table-wrap"><table><thead><tr><th>Quando</th><th>Evento</th><th>Responsável</th><th>Registro</th></tr></thead><tbody>${activity.map((item) => `<tr><td>${escapeHtml(formatDate(item.created_at))}</td><td>${escapeHtml(eventLabel(item.event_type))}</td><td>${escapeHtml(item.actor_name || 'Sistema')}</td><td>${escapeHtml(item.entity_type ? `${item.entity_type} #${item.entity_id || '–'}` : '–')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nenhuma atividade registrada no período.</p>'}</section>`;
}

async function loadReport() {
  if (!isAdminRole()) return;
  const content = $('#report-content');
  const period = $('#report-period')?.value || 'diario';
  const dateField = $('#report-date');
  if (dateField && !dateField.value) dateField.value = currentFortalezaDate();
  const referenceDate = dateField?.value || currentFortalezaDate();
  if (content) content.innerHTML = '<p class="muted">Gerando relatório...</p>';
  try {
    const data = await api(`/api/reports?period=${encodeURIComponent(period)}&date=${encodeURIComponent(referenceDate)}`);
    renderReport(data);
  } catch (error) {
    if (content) content.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

async function loadOnboardingStatus() {
  if (!['admin', 'superadmin', 'tecnico', 'vistoriador'].includes(currentUser?.role)) return;
  try {
    const data = await api('/api/onboarding/status');
    currentUser.onboarding = data.onboarding;
    currentUser.signatureData = data.signatureData;
    const complete = currentUser.role === 'superadmin' || (!data.onboarding.mustChangePassword && data.onboarding.signatureRegistered
      && (!data.onboarding.consentRequired || data.onboarding.consentRegistered));
    currentUser.onboardingComplete = complete;
    const isAdmin = isAdminRole();
    const onboardingCard = $('#onboarding-gate .onboarding-card');
    const onboardingTitle = onboardingCard?.querySelector('h2');
    const onboardingIntro = onboardingCard?.querySelector(':scope > .muted');
    if (onboardingTitle) onboardingTitle.textContent = isAdmin ? 'Cadastre sua assinatura no SIGOS' : 'Configure seu acesso ao SIGOS';
    if (onboardingIntro) onboardingIntro.textContent = isAdmin ? 'Antes de utilizar o SIGOS, cadastre sua assinatura padrão e registre os consentimentos de segurança.' : 'Antes de usar os checklists, conclua as três etapas de segurança.';
    $('#onboarding-consent-step')?.classList.add('hidden');
    const signatureStepNumber = $('#onboarding-signature-step .step-number');
    if (signatureStepNumber) signatureStepNumber.textContent = isAdmin ? '1' : '2';
    const consentStepNumber = $('#onboarding-consent-step .step-number');
    if (consentStepNumber) consentStepNumber.textContent = isAdmin ? '2' : '3';
    const signatureStepTitle = $('#onboarding-signature-step h3');
    if (signatureStepTitle) signatureStepTitle.textContent = isAdmin ? 'Cadastre sua assinatura padrão' : 'Cadastre sua assinatura padrão';
    renderSecuritySignatureEditor(data.signatureData);
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
  const nameInput = $('#onboarding-signature-name');
  if (nameInput && !nameInput.value) nameInput.value = currentUser?.name || '';
  mount.innerHTML = '';
  onboardingSignatureMode = 'desenhada';
  if (signatureData) {
    mount.innerHTML = `<img class="saved-signature" src="${signatureData}" alt="Assinatura cadastrada" />`;
    return;
  }
  onboardingSignatureCanvas = makeSignatureCanvas();
  const frame = document.createElement('div');
  frame.className = 'signature-pad-frame';
  frame.appendChild(onboardingSignatureCanvas);
  mount.appendChild(frame);
}

function renderSecuritySignatureEditor(signatureData) {
  const preview = $('#security-signature-preview');
  const mount = $('#security-signature-mount');
  if (!preview || !mount) return;
  const nameInput = $('#security-signature-name');
  if (nameInput && !nameInput.value) nameInput.value = currentUser?.name || '';
  preview.innerHTML = signatureData
    ? `<p class="muted">Assinatura atual:</p><img class="saved-signature" src="${escapeHtml(signatureData)}" alt="Assinatura padrão atual" />`
    : '<p class="muted">Nenhuma assinatura padrão cadastrada.</p>';
  mount.innerHTML = '';
  securitySignatureMode = 'desenhada';
  securitySignatureCanvas = makeSignatureCanvas();
  const frame = document.createElement('div');
  frame.className = 'signature-pad-frame';
  frame.appendChild(securitySignatureCanvas);
  mount.appendChild(frame);
}

function generateAutomaticSignature(canvas, name) {
  const normalizedName = String(name || '').trim().replace(/\s+/g, ' ');
  if (!canvas || !normalizedName) throw new Error('Digite o nome que será usado para gerar a assinatura.');
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  let fontSize = 72;
  let font = '';
  let width = 0;
  do {
    font = `italic ${fontSize}px "Segoe Script", "Brush Script MT", "URW Chancery L", cursive`;
    context.font = font;
    width = context.measureText(normalizedName).width;
    fontSize -= 2;
  } while (width > canvas.width - 80 && fontSize >= 30);
  context.font = font;
  context.fillStyle = '#172033';
  context.textBaseline = 'middle';
  const x = Math.max(35, (canvas.width - width) / 2);
  context.fillText(normalizedName, x, 92);
  context.beginPath();
  context.strokeStyle = '#172033';
  context.lineWidth = 2.2;
  context.lineCap = 'round';
  context.moveTo(x, 132);
  context.quadraticCurveTo(x + width * 0.52, 145, Math.min(canvas.width - 30, x + width + 15), 128);
  context.stroke();
  return canvas.toDataURL('image/png');
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

function normalizeEpiWizardItem(item) {
  return {
    itemKey: item.itemKey ?? item.key ?? '',
    section: item.section ?? '',
    label: item.label ?? item.equipmentName ?? '',
    ppeItemId: item.ppeItemId ?? item[0] ?? '',
    ca: item.ca ?? '',
    quantity: item.quantity ?? item[1] ?? 1,
    condition: item.condition ?? item[3] ?? 'novo',
    observation: item.observation ?? item[4] ?? '',
    replacementRequested: item.replacementRequested === true,
  };
}

function syncEpiSignatureActions() {
  $('#epi-signature-form-actions')?.classList.toggle('hidden', !Boolean(window.epiWizardSignatureVisible));
}

function renderEpiProcessItems(items = null) {
  const daily = selectedEpiProcessType === 'checklist_diario';
  const selectedItems = items === null
    ? (daily
      ? (epiWizardItems.length && epiWizardItems.every((item) => item.itemKey) ? epiWizardItems : epiDailyChecklistItems.map((item) => ({ itemKey: item.key, section: item.section, label: item.label, ppeItemId: item.ppeItemId || '', ca: item.ca || '', quantity: 1, condition: 'sim', observation: '', replacementRequested: false })))
      : (epiCatalog.length ? epiCatalog.map((item) => ({ ppeItemId: item.id, quantity: 1, condition: 'novo', observation: '' })) : [{ ppeItemId: '', quantity: 1, condition: 'novo', observation: '' }]))
    : (items.length ? items : (daily ? epiDailyChecklistItems.map((item) => ({ itemKey: item.key, section: item.section, label: item.label, ppeItemId: item.ppeItemId || '', ca: item.ca || '', quantity: 1, condition: 'sim', observation: '', replacementRequested: false })) : [{ ppeItemId: '', quantity: 1, condition: 'novo', observation: '' }]));
  epiWizardItems = selectedItems.map(normalizeEpiWizardItem);
  epiWizardIndex = Math.min(epiWizardIndex, epiWizardItems.length - 1);
  if (!Number.isInteger(epiWizardIndex) || epiWizardIndex < 0) epiWizardIndex = 0;
  const container = $('#epi-process-items');
  if (!container) return;
  $('#epi-add-process-item')?.classList.toggle('hidden', daily || Boolean(window.epiWizardSignatureVisible));
  if (!$('#epi-wizard-navigation')) container.insertAdjacentHTML('afterend', '<div id="epi-wizard-navigation" class="wizard-navigation"><button id="epi-wizard-back" type="button" class="secondary small-button">Anterior</button><span id="epi-wizard-counter" class="muted"></span><button id="epi-wizard-next" type="button" class="small-button">Próximo EPI</button><p id="epi-wizard-message" class="error"></p></div>');
  const signatureStep = $('#epi-process-form')?.querySelector('.epi-step-card');
  signatureStep?.setAttribute('id', 'epi-signature-step');
  if (!signatureStep?.classList.contains('hidden') && !window.epiWizardSignatureVisible) signatureStep?.classList.add('hidden');
  syncEpiSignatureActions();
  if (!$('#epi-wizard-navigation')?.dataset.bound) {
    $('#epi-wizard-navigation').dataset.bound = 'true';
    $('#epi-wizard-back').addEventListener('click', () => {
      if (window.epiWizardSignatureVisible) {
        window.epiWizardSignatureVisible = false;
        $('#epi-signature-step')?.classList.add('hidden');
        $('#epi-process-items')?.classList.remove('hidden');
        $('#epi-add-process-item')?.classList.toggle('hidden', selectedEpiProcessType === 'checklist_diario');
        renderEpiWizardItem();
        return;
      }
      saveEpiWizardItem();
      if (epiWizardIndex > 0) { epiWizardIndex -= 1; renderEpiWizardItem(); }
    });
    $('#epi-wizard-next').addEventListener('click', () => {
      saveEpiWizardItem();
      const current = epiWizardItems[epiWizardIndex];
      const message = $('#epi-wizard-message');
      const currentIsDaily = selectedEpiProcessType === 'checklist_diario';
      const invalidDailyAnswer = !['sim', 'nao', 'na'].includes(String(current?.condition || '').toLowerCase());
      const requiresDailyQuantity = currentIsDaily && current?.section === 'verificacao';
      const invalidQuantity = !Number.isInteger(Number(current?.quantity)) || Number(current.quantity) < 1;
      if (currentIsDaily ? (invalidDailyAnswer || (requiresDailyQuantity && invalidQuantity)) : (!current?.ppeItemId || invalidQuantity)) {
        message.textContent = currentIsDaily
          ? (requiresDailyQuantity ? 'Responda esta etapa e informe uma quantidade válida antes de continuar.' : 'Responda esta etapa antes de continuar.')
          : 'Selecione o EPI e informe uma quantidade válida antes de continuar.';
        return;
      }
      message.textContent = '';
      if (epiWizardIndex < epiWizardItems.length - 1) { epiWizardIndex += 1; renderEpiWizardItem(); return; }
      window.epiWizardSignatureVisible = true;
      $('#epi-process-items')?.classList.add('hidden');
      $('#epi-add-process-item')?.classList.add('hidden');
      $('#epi-signature-step')?.classList.remove('hidden');
      renderEpiWizardItem();
      $('#epi-signature-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  renderEpiWizardItem();
}

function saveEpiWizardItem() {
  const row = $('#epi-process-items .epi-process-item');
  if (!row || !epiWizardItems[epiWizardIndex]) return;
  if (selectedEpiProcessType === 'checklist_diario') {
    const item = epiWizardItems[epiWizardIndex];
    const isVerification = item.section === 'verificacao';
    const answer = row.querySelector('[data-field="condition"]:checked')?.value || item.condition || 'sim';
    item.condition = answer;
    item.quantity = isVerification ? (row.querySelector('[data-field="quantity"]')?.value || item.quantity || 1) : 1;
    item.observation = isVerification ? (row.querySelector('[data-field="observation"]')?.value || '') : '';
    item.replacementRequested = isVerification ? Boolean(item.replacementRequested) : false;
    item.label = row.querySelector('[data-daily-label]')?.textContent || item.label;
    return;
  }
  epiWizardItems[epiWizardIndex] = {
    itemKey: epiWizardItems[epiWizardIndex].itemKey || '',
    section: epiWizardItems[epiWizardIndex].section || '',
    label: epiWizardItems[epiWizardIndex].label || '',
    ppeItemId: row.querySelector('[data-field="ppeItemId"]').value,
    quantity: row.querySelector('[data-field="quantity"]').value,
    condition: row.querySelector('[data-field="condition"]').value,
    observation: row.querySelector('[data-field="observation"]').value,
  };
}

function renderEpiWizardItem() {
  const container = $('#epi-process-items');
  const item = epiWizardItems[epiWizardIndex];
  if (!container || !item) return;
  if (selectedEpiProcessType === 'checklist_diario') {
    renderEpiDailyWizardItem(container, item);
    return;
  }
  const options = `<option value="">Selecione o EPI</option>${epiCatalog.map((catalogItem) => `<option value="${escapeHtml(catalogItem.id)}" ${String(catalogItem.id) === String(item.ppeItemId || '') ? 'selected' : ''}>${escapeHtml(catalogItem.name)} · CA ${escapeHtml(catalogItem.ca || '–')}</option>`).join('')}`;
  container.innerHTML = `<div class="epi-process-item epi-wizard-item" data-item-row="${epiWizardIndex}"><div class="wizard-item-heading"><strong>EPI ${epiWizardIndex + 1} de ${epiWizardItems.length}</strong><span class="muted">Um item por vez</span></div><label>Equipamento<select data-field="ppeItemId" required>${options}</select></label><label>Quantidade<input data-field="quantity" type="number" min="1" value="${escapeHtml(item.quantity)}" required /></label><label>Condição<select data-field="condition"><option value="novo" ${item.condition === 'novo' ? 'selected' : ''}>Novo</option><option value="usado" ${item.condition === 'usado' ? 'selected' : ''}>Usado</option><option value="danificado" ${item.condition === 'danificado' ? 'selected' : ''}>Danificado</option></select></label><label>Observação (opcional)<textarea data-field="observation" maxlength="180" placeholder="Observação rápida">${escapeHtml(item.observation)}</textarea></label><button type="button" class="danger-button remove-item">Remover este item</button></div>`;
  const signatureStep = $('#epi-signature-step');
  signatureStep?.classList.toggle('hidden', !window.epiWizardSignatureVisible);
  syncEpiSignatureActions();
  const back = $('#epi-wizard-back');
  const next = $('#epi-wizard-next');
  const counter = $('#epi-wizard-counter');
  if (counter) counter.textContent = `EPI ${epiWizardIndex + 1} de ${epiWizardItems.length}`;
  if (back) { back.disabled = epiWizardIndex === 0 && !window.epiWizardSignatureVisible; back.textContent = window.epiWizardSignatureVisible ? 'Voltar aos itens' : 'Anterior'; }
  if (next) { next.classList.toggle('hidden', Boolean(window.epiWizardSignatureVisible)); next.textContent = epiWizardIndex === epiWizardItems.length - 1 ? 'Ir para assinatura' : 'Próximo EPI'; }
  container.querySelectorAll('[data-field]').forEach((field) => field.addEventListener('change', saveEpiWizardItem));
  container.querySelectorAll('[data-field="quantity"], [data-field="observation"]').forEach((field) => field.addEventListener('input', saveEpiWizardItem));
  container.querySelector('.remove-item')?.addEventListener('click', () => {
    if (epiWizardItems.length <= 1) return;
    epiWizardItems.splice(epiWizardIndex, 1);
    epiWizardIndex = Math.min(epiWizardIndex, epiWizardItems.length - 1);
    renderEpiWizardItem();
  });
}

function epiDailyResponseLabel(value) {
  return ({ sim: 'Sim', nao: 'Não', na: 'N/A' }[String(value || '').toLowerCase()] || '–');
}

function epiDailyObservation(item, attentionOpen = true) {
  return [attentionOpen && item.replacementRequested ? '⚠️ Solicitação de troca' : '', item.finalObservation || item.observation || ''].filter(Boolean).join(' · ') || '–';
}

function renderEpiDailyWizardItem(container, item) {
  const definition = epiDailyChecklistItems.find((entry) => entry.key === item.itemKey) || item;
  const isVerification = item.section === 'verificacao';
  const photo = isVerification ? epiDailyPhotoDrafts[item.itemKey] : null;
  const sectionTitle = item.section === 'inspecao' ? '2. Inspeção antes do início da atividade' : '1. Verificação dos EPIs';
  const photoCount = Object.keys(epiDailyPhotoDrafts).length;
  const quantityMarkup = isVerification ? `<label class="epi-daily-quantity-field">Quantidade<input data-field="quantity" type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(item.quantity || 1)}" required /></label>` : '';
  const observationMarkup = isVerification ? `<label>Observação (opcional)<textarea data-field="observation" maxlength="500" placeholder="Descreva rapidamente se necessário">${escapeHtml(item.observation)}</textarea></label>` : '';
  const replacementMarkup = isVerification ? `<div class="epi-daily-item-actions"><button type="button" class="secondary small-button epi-replacement-toggle ${item.replacementRequested ? 'reported' : ''}" data-action="toggle-replacement" aria-pressed="${item.replacementRequested ? 'true' : 'false'}">${item.replacementRequested ? 'Avaria reportada' : 'Reportar avaria'}</button>${item.replacementRequested ? '<span class="muted">Será solicitada a troca deste item ao finalizar.</span>' : ''}</div>` : '';
  const photoMarkup = isVerification ? `<div class="epi-daily-photo-entry"><div class="subheading"><h4>Foto desta etapa (opcional)</h4><span class="muted">${photoCount}/5 fotos</span></div><button type="button" class="secondary small-button" data-action="open-daily-photo-camera" ${photo || photoCount >= 5 ? 'disabled' : ''}>Tirar foto agora</button><div class="hidden" data-role="daily-photo-camera"><video id="epi-daily-photo-video" class="capture-video" autoplay playsinline muted></video><div class="form-actions"><button type="button" data-action="take-daily-photo">Capturar foto</button><button type="button" class="secondary" data-action="cancel-daily-photo">Cancelar</button></div></div><div class="epi-daily-photo-preview">${photo ? `<img src="${photo.imageData}" alt="Foto da etapa" /><button type="button" class="secondary small-button" data-action="remove-daily-photo">Remover foto</button>` : '<span class="muted">Nenhuma foto capturada para esta etapa.</span>'}</div><p class="muted" data-role="daily-photo-message" aria-live="polite">${photoCount >= 5 && !photo ? 'Limite de cinco fotos atingido.' : ''}</p></div>` : '';
  container.innerHTML = `<div class="epi-process-item epi-wizard-item epi-daily-wizard-item" data-item-row="${epiWizardIndex}"><div class="wizard-item-heading"><span class="eyebrow">${escapeHtml(sectionTitle)}</span><strong>Etapa ${epiWizardIndex + 1} de ${epiWizardItems.length}</strong><span class="muted">Uma etapa por vez</span></div><p class="epi-daily-question" data-daily-label>${escapeHtml(definition.label || item.label)}</p>${replacementMarkup}${quantityMarkup}<fieldset class="epi-answer-group"><legend>${item.section === 'verificacao' ? 'O técnico está com este EPI/item?' : 'A verificação está conforme?'}</legend><label class="epi-answer-option"><input type="radio" name="epi-daily-answer" data-field="condition" value="sim" ${item.condition === 'sim' ? 'checked' : ''} /><span>Sim</span></label><label class="epi-answer-option"><input type="radio" name="epi-daily-answer" data-field="condition" value="nao" ${item.condition === 'nao' ? 'checked' : ''} /><span>Não</span></label><label class="epi-answer-option"><input type="radio" name="epi-daily-answer" data-field="condition" value="na" ${item.condition === 'na' ? 'checked' : ''} /><span>N/A</span></label></fieldset>${observationMarkup}${photoMarkup}</div>`;
  const signatureStep = $('#epi-signature-step');
  signatureStep?.classList.toggle('hidden', !window.epiWizardSignatureVisible);
  syncEpiSignatureActions();
  const back = $('#epi-wizard-back');
  const next = $('#epi-wizard-next');
  const counter = $('#epi-wizard-counter');
  if (counter) counter.textContent = `Etapa ${epiWizardIndex + 1} de ${epiWizardItems.length}`;
  const mobileProgress = $('#mobile-checklist-progress');
  if (mobileProgress && mobileChecklistActive && mobileChecklistKind === 'epi') mobileProgress.textContent = `Etapa ${epiWizardIndex + 1} de ${epiWizardItems.length}`;
  if (back) { back.disabled = epiWizardIndex === 0 && !window.epiWizardSignatureVisible; back.textContent = window.epiWizardSignatureVisible ? 'Voltar às etapas' : 'Anterior'; }
  if (next) { next.classList.toggle('hidden', Boolean(window.epiWizardSignatureVisible)); next.textContent = epiWizardIndex === epiWizardItems.length - 1 ? 'Ir para assinatura' : 'Próxima etapa'; }
  container.querySelectorAll('[data-field="condition"]').forEach((field) => field.addEventListener('change', saveEpiWizardItem));
  container.querySelectorAll('[data-field="quantity"], [data-field="observation"]').forEach((field) => field.addEventListener('input', saveEpiWizardItem));
  container.querySelector('[data-action="toggle-replacement"]')?.addEventListener('click', () => {
    saveEpiWizardItem();
    item.replacementRequested = !item.replacementRequested;
    renderEpiDailyWizardItem(container, epiWizardItems[epiWizardIndex]);
  });
  container.querySelector('[data-action="open-daily-photo-camera"]')?.addEventListener('click', () => {
    const camera = container.querySelector('[data-role="daily-photo-camera"]');
    camera?.classList.remove('hidden');
    openEpiCamera('#epi-daily-photo-video', '[data-role="daily-photo-message"]', 'environment');
  });
  container.querySelector('[data-action="cancel-daily-photo"]')?.addEventListener('click', () => {
    stopEpiCamera('#epi-daily-photo-video');
    container.querySelector('[data-role="daily-photo-camera"]')?.classList.add('hidden');
  });
  container.querySelector('[data-action="take-daily-photo"]')?.addEventListener('click', async () => {
    const imageData = captureVideoFrame('#epi-daily-photo-video');
    const message = container.querySelector('[data-role="daily-photo-message"]');
    if (!imageData) { if (message) message.textContent = 'A câmera ainda não está pronta.'; return; }
    stopEpiCamera('#epi-daily-photo-video');
    container.querySelector('[data-role="daily-photo-camera"]')?.classList.add('hidden');
    await requestEpiProcessLocation();
    epiDailyPhotoDrafts[item.itemKey] = { imageData, captureMode: 'camera', itemKey: item.itemKey, latitude: epiProcessLocation.latitude, longitude: epiProcessLocation.longitude };
    renderEpiDailyWizardItem(container, epiWizardItems[epiWizardIndex]);
  });
  container.querySelector('[data-action="remove-daily-photo"]')?.addEventListener('click', () => {
    delete epiDailyPhotoDrafts[item.itemKey];
    renderEpiDailyWizardItem(container, epiWizardItems[epiWizardIndex]);
  });
}

function readEpiProcessItems() {
  saveEpiWizardItem();
  if (selectedEpiProcessType === 'checklist_diario') return epiWizardItems.map((item) => ({ itemKey: item.itemKey, ppeItemId: item.ppeItemId ? Number(item.ppeItemId) : null, equipmentName: item.label, quantity: Number(item.quantity), ca: item.ca || '', condition: item.condition, observation: item.observation || '', replacementRequested: item.section === 'verificacao' && item.replacementRequested === true }));
  return epiWizardItems.map((item) => {
    const catalog = epiCatalog.find((catalogItem) => String(catalogItem.id) === String(item.ppeItemId));
    return { ppeItemId: item.ppeItemId ? Number(item.ppeItemId) : null, equipmentName: catalog?.name || '', quantity: Number(item.quantity), ca: catalog?.ca || '', condition: item.condition, observation: item.observation || '' };
  });
}

async function loadEpiCatalog() {
  const data = await api('/api/epi/catalog');
  epiCatalog = data.items || [];
  rebuildDailyChecklistItemsFromCatalog();
  renderEpiProcessItems();
}

async function loadEpiTargets() {
  if (currentUser?.role !== 'tecnico') return;
  const data = await api('/api/epi/targets');
  const validators = data.users.filter((user) => ['admin', 'superadmin', 'vistoriador'].includes(user.role));
  $('#epi-validator-user').innerHTML = '<option value="">Selecione um supervisor ou admin</option>' + validators.map((user) => `<option value="${user.id}">${escapeHtml(user.name)} · ${escapeHtml(roleLabels[user.role])}</option>`).join('');
  $('#epi-target-user').innerHTML = '<option value="">Selecione o usuário</option>' + data.users.map((user) => `<option value="${user.id}">${escapeHtml(user.name)} · ${escapeHtml(roleLabels[user.role])}</option>`).join('');
}

function dailyChecklistStatusLabel(status) {
  return ({
    aguarda_selfie: 'aguardando sua selfie',
    aguarda_fotos: 'aguardando o envio das fotos',
    aguarda_correcao_tecnico: 'aguardando sua confirmação após uma correção',
    pendente_validacao: 'aguardando a validação do Admin ou Supervisor',
    validado: 'validado',
    reprovado: 'reprovado',
  }[status] || 'registrado');
}

async function resumeDailyChecklist(process) {
  if (!process) return;
  if (!['aguarda_selfie', 'aguarda_fotos'].includes(process.status)) {
    if (mobileChecklistActive && mobileChecklistKind === 'epi') closeMobileEpiChecklist({ reset: false });
    setEpiWorkflowOpen(false);
    await openEpiProcess(process.id);
    return;
  }
  if (mobileChecklistActive && mobileChecklistKind === 'epi') closeMobileEpiChecklist({ reset: false });
  currentEpiProcess = process;
  selectedEpiProcessType = process.processType;
  $('#epi-process-type').value = process.processType;
  epiWizardItems = (process.items || []).map(normalizeEpiWizardItem);
  epiWizardIndex = 0;
  window.epiWizardSignatureVisible = false;
  epiDailyPhotoDrafts = {};
  renderDailyChecklistGuard(null);
  renderEpiProcessItems(process.items || []);
  setEpiWorkflowOpen(true);
  $('#epi-process-form').classList.add('hidden');
  $('#epi-selfie-step').classList.toggle('hidden', process.status !== 'aguarda_selfie');
  $('#epi-photos-step').classList.toggle('hidden', process.status !== 'aguarda_fotos');
  $('#epi-selfie-message').textContent = process.status === 'aguarda_selfie' ? 'Continue este checklist registrando a selfie.' : '';
  $('#epi-photos-message').textContent = process.status === 'aguarda_fotos' ? 'Continue este checklist enviando as fotos pendentes.' : '';
  if (shouldUseMobileEpiChecklist('checklist_diario')) openMobileEpiChecklist();
  document.querySelector('#epi-selfie-step:not(.hidden), #epi-photos-step:not(.hidden)')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDailyChecklistGuard(process) {
  const guard = $('#epi-daily-checklist-guard');
  if (!guard) return;
  if (!process) {
    guard.classList.add('hidden');
    guard.innerHTML = '';
    $('#epi-process-form')?.classList.remove('hidden');
    return;
  }
  const pending = !['validado', 'reprovado'].includes(process.status);
  const title = pending ? 'Você já possui um checklist diário pendente hoje.' : 'Você já realizou o checklist diário de hoje.';
  const detail = pending
    ? `Este checklist está ${dailyChecklistStatusLabel(process.status)}. Continue nele antes de iniciar outro.`
    : `O processo de hoje está ${dailyChecklistStatusLabel(process.status)}. Um novo checklist estará disponível no próximo dia.`;
  guard.innerHTML = `<strong>${title}</strong><p>${escapeHtml(detail)}</p><button type="button" class="secondary small-button" data-open-daily-existing="${escapeHtml(process.id)}">Abrir checklist de hoje</button>`;
  guard.classList.remove('hidden');
  $('#epi-process-form')?.classList.add('hidden');
  $('#epi-selfie-step')?.classList.add('hidden');
  $('#epi-photos-step')?.classList.add('hidden');
  guard.querySelector('[data-open-daily-existing]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const existing = await api(`/api/epi/processes/${button.dataset.openDailyExisting}`);
      await resumeDailyChecklist(existing.process);
    } catch (error) {
      button.disabled = false;
      guard.insertAdjacentHTML('beforeend', `<p class="error">${escapeHtml(error.message)}</p>`);
    }
  });
}

async function loadDailyChecklistStatus() {
  if (currentUser?.role !== 'tecnico' || selectedEpiProcessType !== 'checklist_diario') return;
  const guard = $('#epi-daily-checklist-guard');
  const form = $('#epi-process-form');
  if (!guard || !form) return;
  guard.classList.remove('hidden');
  guard.innerHTML = '<p>Verificando se já existe um checklist diário para hoje...</p>';
  form.classList.add('hidden');
  try {
    const data = await api('/api/epi/processes/daily/today');
    if (selectedEpiProcessType !== 'checklist_diario') return;
    renderDailyChecklistGuard(data.existing);
  } catch (error) {
    guard.innerHTML = `<strong>Não foi possível verificar o checklist de hoje.</strong><p>${escapeHtml(error.message)}</p><button type="button" class="secondary small-button" data-retry-daily-checklist>Verificar novamente</button>`;
    guard.querySelector('[data-retry-daily-checklist]')?.addEventListener('click', () => loadDailyChecklistStatus());
  }
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
    window.epiWizardSignatureVisible = false;
    $('#epi-selfie-step')?.classList.add('hidden');
    $('#epi-photos-step')?.classList.add('hidden');
    $('#epi-signature-step')?.classList.add('hidden');
    $('#epi-process-items')?.classList.remove('hidden');
    $('#epi-add-process-item')?.classList.remove('hidden');
  }
  syncEpiSignatureActions();
}

function shouldUseMobileEpiChecklist(processType) {
  return processType === 'checklist_diario'
    && currentUser?.role === 'tecnico'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 760px)').matches;
}

function openMobileChecklist(kind, workflowSelector, title, progress) {
  const screen = $('#epi-mobile-checklist-screen');
  const mount = $('#epi-mobile-checklist-mount');
  const workflow = $(workflowSelector);
  if (!screen || !mount || !workflow) return;
  mobileWorkflowParent = workflow.parentElement;
  mobileWorkflowAnchor = workflow.nextElementSibling;
  mount.appendChild(workflow);
  workflow.classList.add('mobile-checklist-workflow');
  if (kind === 'epi') {
    workflow.querySelector('.epi-process-options')?.classList.add('hidden');
    workflow.querySelector('.epi-process-selection-hint')?.classList.add('hidden');
  }
  screen.classList.remove('hidden');
  screen.setAttribute('aria-hidden', 'false');
  mobileChecklistActive = true;
  mobileChecklistKind = kind;
  document.body.classList.add('mobile-checklist-open');
  const titleElement = $('#mobile-checklist-title');
  const progressElement = $('#mobile-checklist-progress');
  if (titleElement) titleElement.textContent = title;
  if (progressElement) progressElement.textContent = progress;
}

function closeMobileChecklist({ reset = true } = {}) {
  const screen = $('#epi-mobile-checklist-screen');
  const workflow = mobileChecklistKind === 'vehicle' ? $('#vehicle-checklist-form') : $('#epi-technician-form');
  if (!screen || !workflow) return;
  if (mobileChecklistKind === 'epi' && currentEpiProcess && reset) {
    $('#epi-process-form-message').textContent = 'Conclua o envio deste checklist antes de voltar à lista.';
    return;
  }
  stopEpiCamera('#epi-selfie-video');
  stopEpiCamera('#epi-daily-photo-video');
  if (mobileWorkflowParent) {
    mobileWorkflowParent.insertBefore(workflow, mobileWorkflowAnchor || null);
  }
  workflow.classList.remove('mobile-checklist-workflow');
  workflow.querySelector('.epi-process-options')?.classList.remove('hidden');
  mobileChecklistActive = false;
  mobileChecklistKind = null;
  screen.classList.add('hidden');
  screen.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('mobile-checklist-open');
  if (reset) {
    if (workflow.id === 'epi-technician-form') {
      selectedEpiProcessType = null;
      $('#epi-process-type').value = '';
      document.querySelectorAll('.epi-process-option').forEach((button) => button.classList.remove('active'));
      setEpiWorkflowOpen(false);
    } else {
      resetVehicleWizard();
    }
  }
}

function openMobileEpiChecklist() {
  openMobileChecklist('epi', '#epi-technician-form', 'Preenchimento do checklist', `Etapa ${epiWizardIndex + 1} de ${epiWizardItems.length}`);
}

function closeMobileEpiChecklist(options) {
  closeMobileChecklist(options);
}

function shouldUseMobileVehicleChecklist() {
  return currentUser?.role === 'tecnico'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 760px)').matches;
}

function openMobileVehicleChecklist() {
  openMobileChecklist('vehicle', '#vehicle-checklist-form', 'Checklist de veículo', `Item ${vehicleWizardIndex + 1} de ${vehicleWizardDraft.length}`);
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
  if (reveal) {
    window.epiWizardSignatureVisible = false;
    epiDailyPhotoDrafts = {};
    if (normalizedType !== 'checklist_diario') renderDailyChecklistGuard(null);
    renderEpiProcessItems();
    setEpiWorkflowOpen(true);
    if (shouldUseMobileEpiChecklist(normalizedType)) openMobileEpiChecklist();
    if (normalizedType === 'checklist_diario') {
      loadEpiCatalog().then(() => {
        if (selectedEpiProcessType !== 'checklist_diario' || currentEpiProcess) return;
        epiWizardItems = [];
        epiWizardIndex = 0;
        renderEpiProcessItems();
      }).catch((error) => {
        $('#epi-process-form-message').textContent = `Não foi possível atualizar os EPIs ativos: ${error.message}`;
      });
      loadDailyChecklistStatus();
    }
  }
}

function epiProcessStatusLabel(status) {
  return ({ aguarda_selfie: 'Aguardando selfie', aguarda_fotos: 'Aguardando fotos', aguarda_correcao_tecnico: 'Aguardando confirmação do técnico', pendente_validacao: 'Pendente de validação', validado: 'Validado', reprovado: 'Reprovado' }[status] || status);
}

function epiAttentionReasonLabel(reason) {
  if (reason?.type === 'replacement_request') return `Solicitação de troca: ${reason.equipmentName || 'EPI'}`;
  if (reason?.type === 'negative_inspection') return `Resposta “Não” na inspeção: ${reason.equipmentName || 'item'}`;
  return 'Resposta que requer atenção';
}

function renderEpiProcessRow(process) {
  const target = process.targetName ? ` · destino: ${process.targetName}` : '';
  const action = `<button type="button" class="secondary small-button epi-process-open" data-process-id="${process.id}">Abrir</button>`;
  const attentionStatus = process.attentionStatus || (process.adminAttentionRequired ? 'pending_admin' : 'none');
  const attentionOpen = process.adminAttentionRequired && ['pending_admin', 'awaiting_technician'].includes(attentionStatus);
  const attention = attentionOpen ? '<span class="status status-attention">⚠️ Requer atenção</span>' : '';
  return `<div class="epi-process-row"><div><strong>${escapeHtml(process.processTitle)}</strong><small>${escapeHtml(process.createdBy.name)}${escapeHtml(target)} · ${escapeHtml(formatDate(process.createdAt))}</small></div><div class="epi-process-actions">${attention}<span class="status status-${escapeHtml(process.status)}">${escapeHtml(epiProcessStatusLabel(process.status))}</span>${action}</div></div>`;
}

async function loadEpiProcesses() {
  try {
    const data = await api('/api/epi/processes');
    $('#epi-process-list').innerHTML = data.processes.length ? data.processes.map(renderEpiProcessRow).join('') : '<p class="muted">Nenhum processo cadastrado.</p>';
    document.querySelectorAll('.epi-process-open').forEach((button) => button.addEventListener('click', () => openEpiProcess(button.dataset.processId)));
    if (currentUser?.role === 'tecnico') { await loadEpiTargets(); await loadEpiCatalog(); renderEpiSignaturePreview(currentUser.signatureData); }
    if (currentUser?.role === 'tecnico' && selectedEpiProcessType === 'checklist_diario') await loadDailyChecklistStatus();
  } catch (error) { $('#epi-process-list').innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; }
}

function renderEpiDailyResponsibilityTerm(process) {
  const term = process.responsibilityTerm;
  if (!term) return '';
  const signature = term.signatureData || process.signatureData || '';
  const logo = term.companyLogoData ? `<img class="company-term-logo" src="${escapeHtml(term.companyLogoData)}" alt="Logo da empresa" />` : '';
  const attentionStatus = process.attentionStatus || (process.adminAttentionRequired ? 'pending_admin' : 'none');
  const attentionOpen = process.adminAttentionRequired && ['pending_admin', 'awaiting_technician'].includes(attentionStatus);
  const groups = [
    { section: 'verificacao', title: '1. Verificação dos EPIs' },
    { section: 'inspecao', title: '2. Inspeção antes do início da atividade' },
  ];
  const hasSections = process.items.some((item) => item.section);
  const rows = hasSections ? groups.map((group) => {
    const items = process.items.filter((item) => item.section === group.section);
    if (!items.length) return '';
    return `<tr class="daily-section-row"><th colspan="4">${escapeHtml(group.title)}</th></tr>${items.map((item) => `<tr><td>${escapeHtml(process.items.indexOf(item) + 1)}</td><td>${escapeHtml(item.equipmentName)}</td><td>${escapeHtml(epiDailyResponseLabel(item.checkStatus || item.condition))}</td><td>${escapeHtml(epiDailyObservation(item, attentionOpen))}</td></tr>`).join('')}`;
  }).join('') : process.items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.equipmentName)}</td><td>${escapeHtml(epiDailyResponseLabel(item.checkStatus || item.condition))}</td><td>${escapeHtml(epiDailyObservation(item, attentionOpen))}</td></tr>`).join('');
  return `<section class="epi-responsibility-term"><div class="paper-header"><div class="term-brand">${logo}<div><strong>${escapeHtml(term.companyName)}</strong><span>CNPJ: ${escapeHtml(term.companyCnpj)}</span></div></div><span class="paper-number">TERMO ASSINADO</span></div><h3>${escapeHtml(term.title)}</h3><p>${escapeHtml(term.intro)}</p><ol>${term.clauses.map((clause) => `<li>${escapeHtml(clause)}</li>`).join('')}</ol><div class="recipient-line"><span><b>Funcionário:</b> ${escapeHtml(process.createdBy.name)}</span><span><b>Emissão:</b> ${escapeHtml(formatDate(process.createdAt))}</span></div><table class="paper-table daily-checklist-table"><thead><tr><th>Nº</th><th>EPI / item de segurança</th><th>Resposta</th><th>Observação</th></tr></thead><tbody>${rows}</tbody></table><div class="legal-text"><p>${escapeHtml(term.legalText.clt)}</p><p>${escapeHtml(term.legalText.nr06)}</p><p>${escapeHtml(term.legalText.declaration)}</p></div><div class="signature-block"><img class="saved-signature" src="${signature}" alt="Assinatura eletrônica do técnico" /><div class="signature-line">Ass. do Funcionário · ${escapeHtml(term.signerName)}</div><div class="audit-note">Assinatura validada em ${escapeHtml(formatDate(term.signedAt))} · SHA-256: ${escapeHtml(term.signatureHash || '–')}</div></div><p class="epi-term-attached-note">Este termo assinado faz parte deste checklist diário e foi enviado junto com as fotos registradas.</p></section>`;
}

function renderEpiGenericTerm(process) {
  const logo = process.companyLogoData ? `<img class="company-term-logo" src="${escapeHtml(process.companyLogoData)}" alt="Logo da empresa" />` : '';
  const signature = process.signatureData || currentUser.signatureData || '';
  return `<section class="epi-responsibility-term"><div class="paper-header"><div class="term-brand">${logo}<div><strong>${escapeHtml(process.companyName || 'Empresa')}</strong><span>CNPJ: ${escapeHtml(process.companyCnpj || '–')}</span></div></div><span class="paper-number">TERMO</span></div><h3>${escapeHtml(process.termText?.title || process.processTitle)}</h3><p>${escapeHtml(process.termText?.paragraphs?.[0] || '')}</p><p>${escapeHtml(process.termText?.paragraphs?.[1] || '')}</p><div class="epi-signature-preview"><img src="${escapeHtml(signature)}" alt="Assinatura usada no termo" /></div><div class="table-wrap"><table class="paper-table"><thead><tr><th>EPI</th><th>Qtd.</th><th>CA</th><th>Condição</th></tr></thead><tbody>${process.items.map((item) => `<tr><td>${escapeHtml(item.equipmentName)}</td><td>${escapeHtml(item.quantity)}</td><td>${escapeHtml(item.ca || '–')}</td><td>${escapeHtml(item.condition || '–')}</td></tr>`).join('')}</tbody></table></div><div class="detail-actions"><button id="print-epi-process" type="button" class="secondary small-button">Imprimir / salvar PDF</button></div></section>`;
}

function renderEpiAdminValidationSignature(process) {
  if (!process.validatedByName && !process.validatedAt) return '';
  const signerLabel = process.validatedByRole === 'admin' || process.validatedByRole === 'superadmin' ? 'Admin validador' : process.validatedByRole === 'vistoriador' ? 'Supervisor validador' : 'Responsável pela validação';
  const signature = process.validationSignatureData
    ? `<img class="saved-signature" src="${escapeHtml(process.validationSignatureData)}" alt="Assinatura de ${escapeHtml(signerLabel)}" />`
    : '<p class="muted">Assinatura do validador não disponível neste registro.</p>';
  return `<div class="epi-admin-validation-signature"><strong>${escapeHtml(signerLabel)}: ${escapeHtml(process.validatedByName || '–')}</strong>${signature}<div class="signature-line">${escapeHtml(signerLabel)} · ${escapeHtml(process.validationSignatureTypedName || process.validatedByName || '–')}</div><div class="audit-note">Validação registrada em ${escapeHtml(formatDate(process.validationSignatureValidatedAt || process.validatedAt))} · SHA-256: ${escapeHtml(process.validationSignatureHash || '–')}</div>${process.validationSignatureDocumentHash ? `<div class="audit-note">Hash do documento validado: ${escapeHtml(process.validationSignatureDocumentHash)}</div>` : ''}</div>`;
}

function renderEpiAttentionWorkflow(process) {
  if (!process.adminAttentionRequired) return '';
  const attentionStatus = process.attentionStatus || 'pending_admin';
  if (attentionStatus === 'resolved') return '';
  const reasons = process.adminAttentionReasons || [];
  const reasonMarkup = reasons.map((reason) => `<li>${escapeHtml(epiAttentionReasonLabel(reason))}</li>`).join('');
  if (isAdminRole()) {
    if (attentionStatus === 'awaiting_technician') {
      return `<section class="epi-attention-workflow"><div class="eyebrow">ATENÇÃO EM TRATAMENTO</div><h4>Aguardando confirmação do técnico</h4><ul>${reasonMarkup}</ul><p class="muted">O Admin não pode aprovar enquanto o técnico não confirmar as correções e enviar uma nova selfie.</p></section>`;
    }
    if (attentionStatus === 'returned_to_admin') {
      const returnedItems = process.items.filter((item) => reasons.some((reason) => String(reason.itemKey || '') === String(item.itemKey || '')));
      const confirmationMarkup = returnedItems.length
        ? `<div class="epi-attention-items"><strong>Confirmações recebidas do técnico</strong><ul>${returnedItems.map((item) => `<li><b>${escapeHtml(item.equipmentName)}</b> — ${item.replacementRequested ? 'troca efetivada e confirmada' : `resposta ${escapeHtml(epiDailyResponseLabel(item.condition))} confirmada`}</li>`).join('')}</ul></div>`
        : '';
      return `<section class="epi-attention-workflow"><div class="eyebrow">CONFIRMAÇÃO RECEBIDA</div><h4>O técnico confirmou as trocas e retornou o checklist</h4><p class="muted">A nova selfie foi registrada depois da troca/correção. Revise o resumo e valide somente se tudo estiver regularizado.</p>${confirmationMarkup}<p class="success-message">Nenhuma opção de troca ou permissão precisa ser preenchida novamente.</p></section>`;
    }
    if (attentionStatus === 'pending_admin') {
      const replacementItems = process.items.filter((item) => item.section === 'verificacao' && item.replacementRequested === true);
      const negativeReasons = reasons.filter((reason) => reason.type === 'negative_inspection');
      const replacementMarkup = replacementItems.length
        ? `<div class="epi-attention-items"><strong>Trocas solicitadas</strong>${replacementItems.map((item) => `<label class="consent-check"><input type="checkbox" data-attention-replacement-key="${escapeHtml(item.itemKey)}" ${item.replacementEffective ? 'checked' : ''} /> <span><b>${escapeHtml(item.equipmentName)}</b><small>${item.replacementEffective ? 'Troca efetivada' : 'Troca ainda não marcada como efetivada'}</small></span></label>`).join('')}</div>`
        : '';
      const inspectionPermission = negativeReasons.length ? '<label class="consent-check"><input id="epi-allow-inspection-edits" type="checkbox" /> <span><b>Permitir correção das respostas “Não”</b><small>O técnico poderá revisar somente os itens de inspeção sinalizados.</small></span></label>' : '';
      const replacementPermission = replacementItems.length ? '<label class="consent-check"><input id="epi-allow-replacement-edits" type="checkbox" /> <span><b>Permitir alteração do status dos EPIs</b><small>O técnico deverá confirmar o status dos itens cuja troca foi solicitada.</small></span></label>' : '';
      return `<section class="epi-attention-workflow"><div class="eyebrow">TRATAMENTO DE ATENÇÃO</div><h4>${attentionStatus === 'returned_to_admin' ? 'Técnico retornou o checklist' : 'Checklist requer ação antes da validação'}</h4><p class="muted">${attentionStatus === 'returned_to_admin' ? 'Confira o retorno abaixo. A aprovação só será liberada quando todas as pendências estiverem resolvidas.' : 'Este checklist não pode ser aprovado agora. Marque as trocas efetivadas e devolva o processo ao técnico.'}</p><ul>${reasonMarkup}</ul>${replacementMarkup}${inspectionPermission}${replacementPermission}<button id="epi-attention-send-back" type="button">Enviar de volta ao técnico</button><p id="epi-attention-message" class="error" aria-live="polite"></p></section>`;
    }
  }
  if (currentUser.role === 'tecnico' && attentionStatus === 'awaiting_technician') {
    const permissions = process.attentionCorrectionPermissions || {};
    const reasonKeys = new Set(reasons.map((reason) => String(reason.itemKey || '')));
    const correctionItems = process.items.filter((item) => reasonKeys.has(String(item.itemKey || '')));
    const rows = correctionItems.map((item) => {
      const canEdit = item.section === 'inspecao' ? permissions.allowInspectionEdits === true : permissions.allowReplacementStatusEdits === true;
      const condition = String(item.condition || '').toLowerCase();
      return `<div class="epi-attention-correction-item"><div><strong>${escapeHtml(item.equipmentName)}</strong><small>${item.section === 'inspecao' ? 'Resposta da inspeção' : `EPI · ${item.replacementEffective ? 'troca marcada como efetivada pelo Admin' : 'troca ainda não efetivada'}`}</small></div>${canEdit ? `<label>Status<select data-attention-condition="${escapeHtml(item.itemKey)}"><option value="sim" ${condition === 'sim' ? 'selected' : ''}>Sim</option><option value="nao" ${condition === 'nao' ? 'selected' : ''}>Não</option><option value="na" ${condition === 'na' ? 'selected' : ''}>N/A</option></select></label><label>Observação<textarea data-attention-observation="${escapeHtml(item.itemKey)}" maxlength="180">${escapeHtml(item.observation || '')}</textarea></label>` : `<p class="muted">O Admin solicitou apenas sua confirmação, sem permitir alteração deste item. Status atual: <b>${escapeHtml(epiDailyResponseLabel(item.condition))}</b></p>`}</div>`;
    }).join('');
    return `<section class="epi-attention-workflow"><div class="eyebrow">CONFIRMAÇÃO DO TÉCNICO</div><h4>O Admin devolveu este checklist</h4><p class="muted">Revise os itens abaixo, capture uma nova selfie e confirme o retorno ao Admin.</p><div class="epi-attention-correction-list">${rows}</div><button id="epi-attention-open-selfie" type="button" class="secondary">Capturar nova selfie</button><div id="epi-attention-selfie-camera" class="hidden"><video id="epi-attention-selfie-video" class="capture-video" autoplay playsinline muted></video><div class="form-actions"><button id="epi-attention-take-selfie" type="button">Capturar selfie</button><button id="epi-attention-cancel-selfie" type="button" class="secondary">Cancelar</button></div></div><p id="epi-attention-selfie-message" class="muted" aria-live="polite">Nenhuma nova selfie capturada.</p><label class="consent-check"><input id="epi-attention-confirm" type="checkbox" /> Confirmo as informações e autorizo o envio deste checklist ao Admin.</label><button id="epi-attention-return" type="button">Confirmar e enviar ao Admin</button><p id="epi-attention-return-message" class="error" aria-live="polite"></p></section>`;
  }
  return `<section class="epi-attention-workflow"><div class="eyebrow">ATENÇÃO</div><h4>Este checklist requer tratamento</h4><ul>${reasonMarkup}</ul></section>`;
}

async function openEpiProcess(id) {
  activateSubtab('epi-main', 'processes');
  const panel = $('#epi-process-detail');
  panel.classList.remove('hidden');
  panel.innerHTML = '<p class="muted">Carregando processo...</p>';
  epiAttentionSelfieDraft = null;
  validationSelfieDraft = null;
  epiProcessLocation = { latitude: null, longitude: null };
  try {
    const { process } = await api(`/api/epi/processes/${id}`);
    const media = process.media.map((item) => { const itemDefinition = epiDailyChecklistItems.find((entry) => entry.key === item.itemKey); const storedItem = process.items.find((entry) => String(entry.itemKey || '') === String(item.itemKey || '')); const itemLabel = itemDefinition?.label || storedItem?.equipmentName; const label = item.kind === 'selfie' ? (item.captureContext === 'validation' ? 'Selfie do validador' : process.adminAttentionRequired ? (item.captureContext === 'attention_correction' ? 'Selfie depois da troca' : 'Selfie antes da troca') : 'Selfie do processo') : itemLabel ? `Foto · ${itemLabel}` : 'Foto do EPI'; return `<figure class="epi-process-media-item"><img src="/api/epi/processes/${process.id}/media/${item.id}" alt="${escapeHtml(label)}" loading="lazy" /><figcaption><strong>${escapeHtml(label)}</strong><span>Data/hora: ${escapeHtml(formatDate(item.createdAt))}</span><span>IP: ${escapeHtml(item.ipAddress || 'Não informado')}</span><span>Navegador: ${escapeHtml(browserLabel(item.userAgent || item.deviceInfo))}</span><span>Dispositivo: ${escapeHtml(deviceLabel(item.userAgent || item.deviceInfo))}</span><span>Cidade: ${escapeHtml(formatMediaLocation(item))}</span><span>Coordenadas: ${escapeHtml(formatMediaCoordinates(item))}</span></figcaption></figure>`; }).join('');
    const responsibilityTerm = process.processType === 'checklist_diario' ? renderEpiDailyResponsibilityTerm(process) : renderEpiGenericTerm(process);
    const canValidate = isChecklistValidatorRole() || String(process.validatorUserId || '') === String(currentUser.id);
    const attentionStatus = process.attentionStatus || (process.adminAttentionRequired ? 'pending_admin' : 'none');
    const attentionOpen = process.adminAttentionRequired && ['pending_admin', 'awaiting_technician'].includes(attentionStatus);
    const attention = attentionOpen ? `<div class="epi-attention-flag"><strong>⚠️ Checklist requer atenção do Admin</strong><div>${(process.adminAttentionReasons || []).map((reason) => `<span>${escapeHtml(epiAttentionReasonLabel(reason))}</span>`).join('')}</div></div>` : '';
    const attentionWorkflow = renderEpiAttentionWorkflow(process);
    const validatorValidation = isChecklistValidatorRole();
    const validatorLabel = currentUser.role === 'vistoriador' ? 'Supervisor' : 'Admin';
    const validationSignaturePreview = validatorValidation
      ? `<div class="epi-validation-signature-box"><strong>Assinatura do ${validatorLabel}</strong>${currentUser.signatureData ? `<div class="epi-signature-preview"><img src="${escapeHtml(currentUser.signatureData)}" alt="Sua assinatura padrão" /></div>` : `<p class="error">Cadastre sua assinatura padrão em Segurança antes de validar.</p>`}<button id="epi-validation-signature-button" type="button" class="secondary" ${currentUser.signatureData ? '' : 'disabled'}>Validar assinatura do ${validatorLabel}</button><p id="epi-validation-signature-status" class="muted" aria-live="polite">Clique para confirmar a assinatura que será anexada ao documento.</p><button id="epi-validation-open-selfie" type="button" class="secondary" ${currentUser.signatureData ? '' : 'disabled'}>Capturar selfie do ${validatorLabel}</button><div id="epi-validation-selfie-camera" class="hidden"><video id="epi-validation-selfie-video" class="capture-video" autoplay playsinline muted></video><div class="form-actions"><button id="epi-validation-take-selfie" type="button">Tirar selfie</button><button id="epi-validation-cancel-selfie" type="button" class="secondary">Cancelar</button></div></div><div id="epi-validation-selfie-preview" class="epi-photo-previews"></div><p id="epi-validation-selfie-status" class="muted" aria-live="polite">Selfie do responsável ainda não capturada.</p></div>`
      : '';
    const validationAllowedForAttention = !process.adminAttentionRequired || attentionStatus === 'returned_to_admin';
    const validation = process.status === 'pendente_validacao' && canValidate && validationAllowedForAttention ? `<div class="epi-review-actions">${validationSignaturePreview}<textarea id="epi-validation-notes" maxlength="500" placeholder="Observação da validação (opcional)"></textarea><div class="form-actions"><button type="button" data-epi-validate="validado">Validar processo</button><button type="button" class="secondary" data-epi-validate="reprovado">Reprovar</button></div><p id="epi-validation-message" class="error" aria-live="polite"></p></div>` : '';
    const adminValidationSignature = renderEpiAdminValidationSignature(process);
    panel.innerHTML = `<div class="epi-process-detail-card"><div class="section-heading"><div><div class="eyebrow">${escapeHtml(process.processTitle)}</div><h3>Processo #${escapeHtml(process.id)}</h3><p class="muted">${escapeHtml(epiProcessStatusLabel(process.status))} · ${escapeHtml(formatDate(process.createdAt))}</p></div><button id="close-epi-process-detail" type="button" class="secondary small-button">Fechar</button></div>${attention}${attentionWorkflow}${responsibilityTerm}<p class="audit-note">Responsável: ${escapeHtml(process.createdBy.name)} · Validador: ${escapeHtml(process.validatorName || 'Administradores')} · Assinatura SHA-256: ${escapeHtml(process.signatureHash || '–')}</p>${adminValidationSignature}${media ? `<div class="epi-process-media">${media}</div>` : '<p class="muted">Nenhuma imagem registrada.</p>'}${validation}</div>`;
    panel.querySelector('.epi-process-detail-card > .section-heading')?.insertAdjacentHTML('beforeend', '<button id="download-epi-process-pdf" type="button" class="secondary small-button">Baixar PDF</button>');
    $('#close-epi-process-detail').addEventListener('click', () => { panel.classList.add('hidden'); activateSubtab('epi-main', 'processes'); });
    $('#download-epi-process-pdf')?.addEventListener('click', (event) => downloadPdfFile(`/api/epi/processes/${process.id}/pdf`, `processo-epi-${process.id}.pdf`, event.currentTarget));
    $('#print-epi-process')?.addEventListener('click', () => window.print());
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#epi-attention-send-back')?.addEventListener('click', async () => {
      const message = $('#epi-attention-message');
      const button = $('#epi-attention-send-back');
      button.disabled = true;
      try {
        const replacementEffectiveItemKeys = [...panel.querySelectorAll('[data-attention-replacement-key]:checked')].map((input) => input.dataset.attentionReplacementKey);
        const data = await api(`/api/epi/processes/${process.id}/attention/send-back`, { method: 'POST', body: JSON.stringify({ replacementEffectiveItemKeys, allowInspectionEdits: Boolean($('#epi-allow-inspection-edits')?.checked), allowReplacementStatusEdits: Boolean($('#epi-allow-replacement-edits')?.checked) }) });
        await loadEpiProcesses();
        await loadNotifications();
        await openEpiProcess(data.process.id);
      } catch (error) { button.disabled = false; message.textContent = error.message; }
    });
    $('#epi-attention-open-selfie')?.addEventListener('click', () => { $('#epi-attention-selfie-camera').classList.remove('hidden'); openEpiCamera('#epi-attention-selfie-video', '#epi-attention-selfie-message', 'user'); });
    $('#epi-attention-cancel-selfie')?.addEventListener('click', () => { stopEpiCamera('#epi-attention-selfie-video'); $('#epi-attention-selfie-camera').classList.add('hidden'); });
    $('#epi-attention-take-selfie')?.addEventListener('click', async () => {
      const imageData = captureVideoFrame('#epi-attention-selfie-video');
      const message = $('#epi-attention-selfie-message');
      if (!imageData) { message.textContent = 'A câmera ainda não está pronta.'; return; }
      stopEpiCamera('#epi-attention-selfie-video');
      $('#epi-attention-selfie-camera').classList.add('hidden');
      await requestEpiProcessLocation();
      epiAttentionSelfieDraft = { imageData, captureMode: 'camera', latitude: epiProcessLocation.latitude, longitude: epiProcessLocation.longitude };
      message.textContent = 'Nova selfie capturada. Confira os itens e confirme o envio.';
    });
    $('#epi-attention-return')?.addEventListener('click', async () => {
      const message = $('#epi-attention-return-message');
      if (!epiAttentionSelfieDraft) { message.textContent = 'Capture a nova selfie antes de enviar.'; return; }
      if (!$('#epi-attention-confirm')?.checked) { message.textContent = 'Confirme as informações antes de enviar ao Admin.'; return; }
      const button = $('#epi-attention-return');
      button.disabled = true;
      try {
        const items = [...panel.querySelectorAll('[data-attention-condition]')].map((field) => ({ itemKey: field.dataset.attentionCondition, condition: field.value, observation: panel.querySelector(`[data-attention-observation="${CSS.escape(field.dataset.attentionCondition)}"]`)?.value || '' }));
        const data = await api(`/api/epi/processes/${process.id}/attention/return`, { method: 'POST', body: JSON.stringify({ ...epiAttentionSelfieDraft, deviceInfo: navigator.userAgent, confirmed: true, items }) });
        epiAttentionSelfieDraft = null;
        await loadEpiProcesses();
        await loadNotifications();
        await loadOverview();
        await openEpiProcess(data.process.id);
      } catch (error) { button.disabled = false; message.textContent = error.message; }
    });
    let adminSignatureConfirmed = !validatorValidation;
    $('#epi-validation-signature-button')?.addEventListener('click', () => {
      const status = $('#epi-validation-signature-status');
      if (!currentUser.signatureData) { status.textContent = 'Cadastre sua assinatura padrão em Segurança antes de continuar.'; status.className = 'error'; return; }
      adminSignatureConfirmed = true;
      $('#epi-validation-signature-button').disabled = true;
      $('#epi-validation-signature-button').textContent = 'Assinatura validada';
      status.textContent = 'Assinatura confirmada. Agora você pode validar ou reprovar o processo.';
      status.className = 'success-message';
    });
    $('#epi-validation-open-selfie')?.addEventListener('click', () => { $('#epi-validation-selfie-camera').classList.remove('hidden'); openEpiCamera('#epi-validation-selfie-video', '#epi-validation-selfie-status', 'user'); });
    $('#epi-validation-cancel-selfie')?.addEventListener('click', () => { stopEpiCamera('#epi-validation-selfie-video'); $('#epi-validation-selfie-camera').classList.add('hidden'); });
    $('#epi-validation-take-selfie')?.addEventListener('click', async () => {
      const imageData = captureVideoFrame('#epi-validation-selfie-video');
      const status = $('#epi-validation-selfie-status');
      if (!imageData) { status.textContent = 'A câmera ainda não está pronta.'; return; }
      stopEpiCamera('#epi-validation-selfie-video');
      $('#epi-validation-selfie-camera').classList.add('hidden');
      await requestEpiProcessLocation();
      validationSelfieDraft = { imageData, captureMode: 'camera', latitude: epiProcessLocation.latitude, longitude: epiProcessLocation.longitude };
      $('#epi-validation-selfie-preview').innerHTML = `<div><img src="${imageData}" alt="Selfie do responsável pela validação" /></div>`;
      status.textContent = 'Selfie capturada. Ela será anexada à validação.';
      status.className = 'success-message';
    });
    panel.querySelectorAll('[data-epi-validate]').forEach((button) => button.addEventListener('click', async () => {
      const message = $('#epi-validation-message');
      if (validatorValidation && !currentUser.signatureData) { message.textContent = 'Cadastre sua assinatura padrão em Segurança antes de validar.'; return; }
      if (validatorValidation && !adminSignatureConfirmed) { message.textContent = `Clique em “Validar assinatura do ${validatorLabel}” antes de continuar.`; return; }
      if (validatorValidation && !validationSelfieDraft) { message.textContent = `Capture uma selfie do ${validatorLabel} antes de continuar.`; return; }
      try { message.textContent = ''; await api(`/api/epi/processes/${process.id}/validate`, { method: 'POST', body: JSON.stringify({ decision: button.dataset.epiValidate, notes: $('#epi-validation-notes').value, signatureConfirmed: validatorValidation ? adminSignatureConfirmed : false, validationSelfie: validatorValidation ? validationSelfieDraft : null }) }); validationSelfieDraft = null; await loadEpiProcesses(); await openEpiProcess(process.id); await loadNotifications(); await loadOverview(); } catch (error) { message.textContent = error.message; }
    }));
  } catch (error) { panel.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; }
}

async function loadUsers() {
  const data = await api('/api/users');
  complianceAssignableUsers = data.users || [];
  $('#users-table').innerHTML = data.users.map((user) => `<tr><td>${user.role === 'tecnico' ? `<button type="button" class="user-detail-button" data-user-id="${user.id}">${escapeHtml(user.name)}</button>` : escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(roleLabels[user.role] || user.role)}</td><td>${user.active ? 'Ativo' : 'Desativado'}</td><td class="user-actions">${user.systemProtected ? '<span class="muted">Protegido</span>' : `<button type="button" class="secondary small-button edit-user" data-user-id="${user.id}">Alterar</button>${user.active && String(user.id) !== String(currentUser.id) ? `<button type="button" class="danger-button deactivate-user" data-user-id="${user.id}">Remover</button>` : ''}`}</td></tr>`).join('');
  renderAdminNotificationRecipients(data.users);
  document.querySelectorAll('.user-detail-button').forEach((button) => button.addEventListener('click', () => loadTechnicianSummary(button.dataset.userId)));
  document.querySelectorAll('.edit-user').forEach((button) => button.addEventListener('click', () => startUserEdit(button.dataset.userId, data.users)));
  document.querySelectorAll('.deactivate-user').forEach((button) => button.addEventListener('click', async () => {
    if (!window.confirm('Desativar esta conta? Os registros de auditoria serão preservados.')) return;
    try { await api(`/api/users/${button.dataset.userId}`, { method: 'DELETE' }); await loadUsers(); await loadOverview(); } catch (error) { $('#user-form-message').textContent = error.message; }
  }));
}

function startUserEdit(userId, users) {
  activateSubtab('admin-main', 'users');
  const user = users.find((item) => String(item.id) === String(userId));
  const panel = $('#user-edit-panel');
  if (!user || user.systemProtected || !panel) return;
  $('#user-edit-id').value = user.id;
  $('#user-edit-name').value = user.name || '';
  $('#user-edit-email').value = user.email || '';
  $('#user-edit-role').value = ['admin', 'tecnico', 'vistoriador'].includes(user.role) ? user.role : 'tecnico';
  $('#user-edit-password').value = '';
  $('#user-edit-message').textContent = '';
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  activateSubtab('admin-main', 'users');
  const panel = $('#technician-detail');
  panel.classList.remove('hidden');
  panel.innerHTML = '<p class="muted">Carregando dados do técnico...</p>';
  try {
    const data = await api(`/api/users/${userId}/technician-summary`);
    technicianCalendarDays = data.dailyChecklistDays || [];
    technicianCalendarMonth = currentFortalezaMonth();
    panel.innerHTML = `<div class="technician-detail-heading"><div><div class="eyebrow">DETALHE DO TÉCNICO · ${escapeHtml(data.period.toUpperCase())}</div><h3>${escapeHtml(data.technician.name)}</h3><p class="muted">${escapeHtml(data.technician.email)} · ${data.technician.active ? 'Conta ativa' : 'Conta desativada'}</p></div><button id="close-technician-detail" type="button" class="secondary small-button">Fechar</button></div><div class="technician-stats"><div><strong>${escapeHtml(data.stats.checklistEvents)}</strong><span>eventos de checklist</span></div><div><strong>${escapeHtml(data.stats.episToday)}</strong><span>EPIs registrados hoje</span></div><div><strong>${escapeHtml(data.stats.pending)}</strong><span>pendências</span></div></div><section class="technician-calendar-section"><h4>Calendário de checklist diário</h4><div id="technician-calendar"></div></section><div class="technician-detail-grid"><section><h4>EPIs com o técnico hoje</h4>${data.epis.length ? `<div class="table-wrap"><table><thead><tr><th>EPI</th><th>Qtd.</th><th>CA</th><th>Condição</th><th>Registrado</th></tr></thead><tbody>${data.epis.map((item) => `<tr><td>${escapeHtml(item.equipment_name)}</td><td>${escapeHtml(item.quantity)}</td><td>${escapeHtml(item.ca || '–')}</td><td>${escapeHtml(item.condition || '–')}</td><td>${escapeHtml(formatDate(item.signed_at))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nenhum EPI registrado hoje.</p>'}</section><section><h4>Pendências</h4>${data.pending.length ? `<div class="pending-list">${data.pending.map((item) => `<div class="pending-item"><strong>${escapeHtml(item.type === 'vehicle_checklist' ? 'Checklist de veículo' : item.type === 'epi_process' ? 'Processo de EPI' : 'Termo de EPI')}</strong><span>${escapeHtml(item.label)} · ${escapeHtml(item.status)}</span></div>`).join('')}</div>` : '<p class="muted">Nenhuma pendência encontrada.</p>'}</section></div><section><h4>Logs de checklist</h4>${data.logs.length ? `<div class="table-wrap"><table><thead><tr><th>Quando</th><th>Evento</th><th>Registro</th><th>IP</th></tr></thead><tbody>${data.logs.map((item) => `<tr><td>${escapeHtml(formatDate(item.created_at))}</td><td>${escapeHtml(eventLabel(item.event_type))}</td><td>${escapeHtml(item.entity_type ? `${item.entity_type} #${item.entity_id || '–'}` : '–')}</td><td>${escapeHtml(item.ip_address || '–')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nenhum log de checklist encontrado.</p>'}</section>`;
    renderTechnicianCalendar();
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
  if (item.entity_type === 'vehicle_checklist' && item.entity_id) {
    return `${escapeHtml(label)} <button type="button" class="secondary small-button audit-open-vehicle" data-audit-open-vehicle="${escapeHtml(item.entity_id)}">Abrir checklist</button>`;
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
  document.querySelectorAll('.audit-open-vehicle').forEach((button) => button.addEventListener('click', async () => {
    const detail = '#vehicle-admin-detail';
    setView('vehicles-view');
    try {
      await openVehicleChecklist(button.dataset.auditOpenVehicle, detail);
      $(detail)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      const container = $(detail);
      if (container) {
        container.classList.remove('hidden');
        container.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
      }
    }
  }));
}

function stockMovementLabel(type) {
  return ({ entrada: 'Entrada', saida: 'Saída', transferencia: 'Transferência', devolucao: 'Devolução', ajuste_saida: 'Ajuste de saída' }[type] || type || 'Movimento');
}

function stockStatusLabel(status) {
  return ({ normal: 'Normal', baixo: 'Estoque baixo', indisponivel: 'Indisponível', inconsistente: 'Inconsistente' }[status] || status || '–');
}

function stockProcessLabel(movement) {
  if (movement.processId) {
    const type = ({ checklist_diario: 'Checklist diário', transferencia: 'Transferência', devolucao: 'Devolução' }[movement.processType] || 'Processo EPI');
    return `${type} #${movement.processId}`;
  }
  if (movement.termId) return `Termo EPI #${movement.termId}`;
  return 'Ajuste manual';
}

function vehicleIntegrityItemHasIssue(item) {
  if (item.integrityActionStatus === 'corrigida') return false;
  return [item.afterStatus, item.beforeStatus].some((status) => status && status !== 'ok');
}

async function loadVehicleIntegrityAssignableUsers() {
  if (!complianceAssignableUsers.length) {
    const data = await api('/api/users');
    complianceAssignableUsers = data.users || [];
  }
  return complianceAssignableUsers.filter((user) => user.active && String(user.id) !== String(currentUser?.id));
}

function renderVehicleIntegrityActionMeta(item) {
  if (item.integrityActionStatus === 'corrigida') {
    const correction = item.integrityCorrectedAt ? ` · ${formatDate(item.integrityCorrectedAt)}` : '';
    const note = item.integrityCorrectionNote ? ` · ${escapeHtml(item.integrityCorrectionNote)}` : '';
    return `<small class="vehicle-integrity-action-meta is-resolved">Correção marcada${correction}${note}</small>`;
  }
  if (item.integrityActionStatus === 'pendente') {
    const recipient = item.integrityAssignedToName ? `Enviado para: ${escapeHtml(item.integrityAssignedToName)}` : 'Correção pendente';
    const instruction = item.integrityInstruction ? ` · ${escapeHtml(item.integrityInstruction)}` : '';
    return `<small class="vehicle-integrity-action-meta">${recipient}${instruction}</small>`;
  }
  return '';
}

function renderVehicleIntegrityActions(vehicle, item, users) {
  if (!isAdminRole() || !vehicle.lastChecklistId || !vehicleIntegrityItemHasIssue(item)) return '';
  const options = users.length
    ? `<option value="">Selecione um usuário</option>${users.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)} · ${escapeHtml(roleLabels[user.role] || user.role)}</option>`).join('')}`
    : '<option value="">Nenhum usuário disponível</option>';
  return `<div class="vehicle-integrity-actions" data-integrity-action-container><button type="button" class="small-button" data-integrity-action="correct" data-vehicle-id="${escapeHtml(vehicle.id)}" data-checklist-id="${escapeHtml(vehicle.lastChecklistId)}" data-item-key="${escapeHtml(item.itemKey)}">Marcar como corrigido</button><div class="vehicle-integrity-assignment"><label>Enviar para<select data-integrity-assignee ${users.length ? '' : 'disabled'}>${options}</select></label><input type="text" maxlength="500" data-integrity-instruction placeholder="Orientação opcional" /><button type="button" class="secondary small-button" data-integrity-action="assign" data-vehicle-id="${escapeHtml(vehicle.id)}" data-checklist-id="${escapeHtml(vehicle.lastChecklistId)}" data-item-key="${escapeHtml(item.itemKey)}" ${users.length ? '' : 'disabled'}>Enviar para</button></div><small class="vehicle-integrity-action-status" data-integrity-action-status aria-live="polite"></small></div>`;
}

function renderVehicleIntegrityItems(vehicle, users = []) {
  const items = vehicle.integrityItems || [];
  return items.map((item) => {
    const hasIssue = vehicleIntegrityItemHasIssue(item);
    const warning = hasIssue ? '<span class="vehicle-integrity-item-warning" title="Item com avaria ou irregularidade" aria-label="Item com avaria ou irregularidade">!</span>' : '';
    const resolved = item.integrityActionStatus === 'corrigida';
    const reportedBy = item.reportedBy || 'Usuário não identificado';
    const reportedAt = item.reportedAt ? ` · ${formatDate(item.reportedAt)}` : '';
    return `<div class="vehicle-integrity-item${hasIssue ? ' has-integrity-issue' : ''}${resolved ? ' is-resolved' : ''}"><div class="vehicle-integrity-item-heading"><strong>${escapeHtml(item.itemName)}</strong>${warning}</div><span>Estado: ${escapeHtml(vehicleStatusLabel(item.afterStatus || item.beforeStatus))}</span>${item.beforeStatus !== item.afterStatus ? `<small>Antes: ${escapeHtml(vehicleStatusLabel(item.beforeStatus))} · Depois: ${escapeHtml(vehicleStatusLabel(item.afterStatus))}</small>` : ''}${item.afterDescription || item.beforeDescription ? `<small>Descrição: ${escapeHtml(item.afterDescription || item.beforeDescription)}</small>` : ''}<small class="vehicle-integrity-reporter">Reportado por: ${escapeHtml(reportedBy)}${escapeHtml(reportedAt)}</small>${renderVehicleIntegrityActionMeta(item)}${renderVehicleIntegrityActions(vehicle, item, users)}</div>`;
  }).join('');
}

function bindVehicleIntegrityActions(vehicle) {
  const modal = $('#vehicle-integrity-modal');
  const content = modal?.querySelector('#vehicle-integrity-modal-content');
  if (!modal || !content) return;
  content.querySelectorAll('[data-integrity-action]').forEach((button) => button.addEventListener('click', async () => {
    const container = button.closest('[data-integrity-action-container]');
    const status = container?.querySelector('[data-integrity-action-status]');
    const payload = {
      vehicleId: Number(button.dataset.vehicleId),
      checklistId: Number(button.dataset.checklistId),
      itemKey: button.dataset.itemKey,
    };
    try {
      button.disabled = true;
      if (button.dataset.integrityAction === 'correct') {
        const note = window.prompt('Observação da correção (opcional):', '') || '';
        await api('/api/stock/vehicle-integrity/resolve', { method: 'POST', body: JSON.stringify({ ...payload, note }) });
      } else {
        const assignee = container?.querySelector('[data-integrity-assignee]')?.value;
        if (!assignee) throw new Error('Selecione o usuário que receberá a pendência.');
        const instruction = container?.querySelector('[data-integrity-instruction]')?.value.trim() || '';
        await api('/api/stock/vehicle-integrity/assign', { method: 'POST', body: JSON.stringify({ ...payload, assignedTo: Number(assignee), instruction }) });
      }
      closeVehicleIntegrityModal();
      await loadStock();
      await loadNotifications();
    } catch (error) {
      if (status) status.textContent = error.message;
      button.disabled = false;
    }
  }));
}

async function openVehicleIntegrityModal(vehicle) {
  const modal = $('#vehicle-integrity-modal');
  if (!modal || !vehicle) return;
  const items = vehicle.integrityItems || [];
  const hasIntegrityIssue = items.some(vehicleIntegrityItemHasIssue);
  let assignableUsers = [];
  if (isAdminRole() && hasIntegrityIssue) {
    try { assignableUsers = await loadVehicleIntegrityAssignableUsers(); } catch { assignableUsers = []; }
  }
  const title = modal.querySelector('#vehicle-integrity-modal-title');
  const subtitle = modal.querySelector('#vehicle-integrity-modal-subtitle');
  const content = modal.querySelector('#vehicle-integrity-modal-content');
  if (title) title.textContent = `Integridade · ${vehicle.plate || 'Veículo'}`;
  if (subtitle) subtitle.textContent = vehicle.lastChecklistId
    ? `${vehicle.lastChecklistType === 'diario' ? 'Checklist diário' : 'Checklist quinzenal'} · ${formatDate(vehicle.lastChecklistAt)}`
    : 'Nenhum checklist lançado para este veículo.';
  if (content) {
    content.innerHTML = vehicle.lastChecklistId && items.length
      ? `${hasIntegrityIssue ? '<p class="vehicle-integrity-modal-alert">Os itens marcados com <b>!</b> geraram a sinalização de avaria ou irregularidade.</p>' : '<p class="muted">Nenhum item com avaria ou irregularidade está pendente. Os registros corrigidos permanecem no histórico.</p>'}<div class="vehicle-integrity-list">${renderVehicleIntegrityItems(vehicle, assignableUsers)}</div>`
      : '<p class="muted">Nenhum checklist lançado para este veículo.</p>';
  }
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('vehicle-integrity-modal-open');
  modal.querySelector('[data-vehicle-integrity-close]')?.focus();
  bindVehicleIntegrityActions(vehicle);
}

function closeVehicleIntegrityModal() {
  const modal = $('#vehicle-integrity-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('vehicle-integrity-modal-open');
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeVehicleIntegrityModal();
});

function renderStockVehicleIntegrity(vehicle) {
  const items = vehicle.integrityItems || [];
  const hasIntegrityIssue = items.some(vehicleIntegrityItemHasIssue);
  const warning = hasIntegrityIssue ? '<span class="vehicle-integrity-warning" title="Há item com avaria ou irregularidade" aria-label="Há item com avaria ou irregularidade">!</span>' : '';
  return `<button type="button" class="vehicle-integrity-open-button${hasIntegrityIssue ? ' has-integrity-issue' : ''}" data-vehicle-integrity="${escapeHtml(vehicle.id)}" aria-label="Abrir integridade do veículo ${escapeHtml(vehicle.plate || '')}"><span>Integridade</span>${warning}</button>`;
}

async function loadStock() {
  const data = await api('/api/stock');
  const stockVehicles = data.vehicles || [];
  stockPpeCatalog = data.ppes || [];
  renderStockVehicleEquipment(stockVehicles);
  const vehicleTableHead = document.querySelector('#stock-vehicles-table')?.closest('table')?.querySelector('thead tr');
  if (vehicleTableHead && !vehicleTableHead.querySelector('[data-stock-vehicle-integrity-heading]')) {
    const actionsHeading = [...vehicleTableHead.children].find((heading) => heading.textContent.trim() === 'Ações');
    if (actionsHeading) actionsHeading.insertAdjacentHTML('beforebegin', '<th data-stock-vehicle-inventory-heading>Inventário</th><th data-stock-vehicle-integrity-heading>Integridade</th>');
  }
  const inventoryLabel = document.querySelector('.vehicle-equipment-stock .eyebrow');
  const inventoryHeading = document.querySelector('.vehicle-equipment-stock h3');
  if (inventoryLabel) inventoryLabel.textContent = 'INVENTÁRIO';
  if (inventoryHeading) inventoryHeading.textContent = 'Itens cadastrados em cada veículo';
  $('#stock-vehicles-table').innerHTML = stockVehicles.length ? stockVehicles.map((vehicle) => { const count = (vehicle.equipmentItems || []).length; return `<tr><td><strong>${escapeHtml(vehicle.plate)}</strong></td><td>${escapeHtml(vehicle.model || '–')}</td><td>${escapeHtml(vehicle.year || '–')}</td><td>${escapeHtml(vehicle.color || '–')}</td><td>${escapeHtml(vehicle.lastDriver || 'Sem checklist')}${vehicle.lastChecklistAt ? `<small class="table-subtext">${escapeHtml(formatDate(vehicle.lastChecklistAt))}</small>` : ''}</td><td>${escapeHtml(vehicle.status === 'ativo' ? 'Ativo' : 'Inativo')}</td><td><button type="button" class="secondary small-button" data-vehicle-inventory="${escapeHtml(vehicle.id)}">${count} ${count === 1 ? 'item' : 'itens'}</button></td><td>${renderStockVehicleIntegrity(vehicle)}</td><td><div class="table-actions"><button type="button" class="secondary small-button" data-vehicle-edit="${escapeHtml(vehicle.id)}">Editar</button><button type="button" class="secondary small-button" data-vehicle-delete="${escapeHtml(vehicle.id)}">Excluir</button></div></td></tr>`; }).join('') : '<tr><td colspan="9" class="muted">Nenhum veículo cadastrado.</td></tr>';
  document.querySelectorAll('[data-vehicle-integrity]').forEach((button) => button.addEventListener('click', () => { void openVehicleIntegrityModal(stockVehicles.find((vehicle) => String(vehicle.id) === String(button.dataset.vehicleIntegrity))); }));
  $('#vehicle-integrity-modal')?.querySelectorAll('[data-vehicle-integrity-close]').forEach((button) => { button.onclick = closeVehicleIntegrityModal; });
  document.querySelectorAll('[data-vehicle-inventory]').forEach((button) => button.addEventListener('click', () => { selectedStockVehicleId = String(button.dataset.vehicleInventory); renderStockVehicleEquipment(stockVehicles); document.querySelector('.vehicle-equipment-stock')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); $('#stock-vehicle-equipment-vehicle')?.focus(); }));
  $('#stock-ppes-table').innerHTML = stockPpeCatalog.length ? stockPpeCatalog.map((ppe) => {
    const holders = (ppe.assignedUsers || []).map((holder) => `${holder.name || 'Usuário'} · ${holder.quantity} un.`).join(', ');
    return `<tr><td><strong>${escapeHtml(ppe.name)}</strong><small class="table-subtext">${escapeHtml(ppe.category || 'Sem categoria')}</small></td><td>${escapeHtml(ppe.ca)}</td><td>${escapeHtml(ppe.stockQuantity)}</td><td><strong>${escapeHtml(ppe.availableQuantity)}</strong></td><td>${escapeHtml(holders || 'Ninguém')}${ppe.assignedQuantity ? `<small class="table-subtext">Total em posse: ${escapeHtml(ppe.assignedQuantity)}</small>` : ''}</td><td><span class="stock-state stock-state-${escapeHtml(ppe.stockStatus || 'normal')}">${escapeHtml(stockStatusLabel(ppe.stockStatus))}</span><small class="table-subtext">${escapeHtml(ppe.active ? 'Ativo' : 'Inativo')}</small></td><td><div class="table-actions"><button type="button" class="secondary small-button" data-ppe-edit="${escapeHtml(ppe.id)}">Editar</button><button type="button" class="secondary small-button" data-ppe-toggle="${escapeHtml(ppe.id)}" data-ppe-next-active="${ppe.active ? 'false' : 'true'}">${ppe.active ? 'Desativar' : 'Ativar'}</button></div></td></tr>`;
  }).join('') : '<tr><td colspan="7" class="muted">Nenhum EPI cadastrado.</td></tr>';
  const movements = data.movements || [];
  $('#stock-movements-table').innerHTML = movements.length ? movements.map((movement) => `<tr><td>${escapeHtml(formatDate(movement.createdAt))}</td><td>${escapeHtml(stockMovementLabel(movement.movementType))}</td><td><strong>${escapeHtml(movement.ppeName)}</strong><small class="table-subtext">CA ${escapeHtml(movement.ca || '–')}</small></td><td>${escapeHtml(movement.quantity)}</td><td>${escapeHtml(movement.fromUser || 'Estoque')}</td><td>${escapeHtml(movement.toUser || 'Estoque')}</td><td>${escapeHtml(stockProcessLabel(movement))}</td><td>${escapeHtml(movement.createdBy || 'Sistema')}</td></tr>`).join('') : '<tr><td colspan="8" class="muted">Nenhuma movimentação registrada.</td></tr>';
  document.querySelectorAll('[data-vehicle-edit]').forEach((button) => button.addEventListener('click', () => {
    const vehicle = stockVehicles.find((item) => String(item.id) === String(button.dataset.vehicleEdit));
    if (!vehicle) return;
    selectedStockVehicleId = String(vehicle.id);
    renderStockVehicleEquipment(stockVehicles);
    $('#stock-vehicle-id').value = vehicle.id;
    $('#stock-vehicle-plate').value = vehicle.plate || '';
    $('#stock-vehicle-model').value = vehicle.model || '';
    $('#stock-vehicle-year').value = vehicle.year ?? '';
    $('#stock-vehicle-color').value = vehicle.color || '';
    $('#stock-vehicle-cancel').classList.remove('hidden');
    $('#stock-vehicle-message').textContent = 'Editando veículo do cadastro.';
    $('#stock-vehicle-plate').focus();
  }));
  document.querySelectorAll('[data-vehicle-delete]').forEach((button) => button.addEventListener('click', async () => {
    const vehicle = stockVehicles.find((item) => String(item.id) === String(button.dataset.vehicleDelete));
    if (!vehicle || !window.confirm(`Excluir o veículo ${vehicle.plate}? O histórico de checklists será preservado.`)) return;
    try { await api(`/api/stock/vehicles/${button.dataset.vehicleDelete}`, { method: 'DELETE' }); resetStockVehicleForm(); await loadStock(); } catch (error) { $('#stock-vehicle-message').textContent = error.message; }
  }));
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

function resetStockVehicleForm() {
  $('#stock-vehicle-form').reset();
  $('#stock-vehicle-id').value = '';
  $('#stock-vehicle-cancel').classList.add('hidden');
}

function resetStockVehicleEquipmentForm() {
  $('#stock-vehicle-equipment-form')?.reset();
  $('#stock-vehicle-equipment-id').value = '';
  $('#stock-vehicle-equipment-vehicle').value = selectedStockVehicleId || '';
  $('#stock-vehicle-equipment-cancel').classList.add('hidden');
}

function renderStockVehicleEquipment(vehicles) {
  const select = $('#stock-vehicle-equipment-vehicle');
  const table = $('#stock-vehicle-equipment-table');
  if (!select || !table) return;
  if (!vehicles.length) {
    select.innerHTML = '<option value="">Nenhum veículo cadastrado</option>';
    table.innerHTML = '<tr><td colspan="3" class="muted">Cadastre um veículo antes de incluir equipamentos.</td></tr>';
    return;
  }
  if (!vehicles.some((vehicle) => String(vehicle.id) === String(selectedStockVehicleId))) selectedStockVehicleId = String(vehicles[0].id);
  select.innerHTML = `<option value="">Selecione o veículo</option>${vehicles.map((vehicle) => `<option value="${escapeHtml(vehicle.id)}">${escapeHtml(vehicle.plate)} · ${escapeHtml(vehicle.model || 'Modelo não informado')}</option>`).join('')}`;
  select.value = selectedStockVehicleId;
  const vehicle = vehicles.find((item) => String(item.id) === String(selectedStockVehicleId));
  const equipment = vehicle?.equipmentItems || [];
  table.innerHTML = equipment.length ? equipment.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.quantity)}</td><td><div class="table-actions"><button type="button" class="secondary small-button" data-vehicle-equipment-edit="${escapeHtml(item.id)}">Editar</button><button type="button" class="secondary small-button" data-vehicle-equipment-delete="${escapeHtml(item.id)}">Excluir</button></div></td></tr>`).join('') : '<tr><td colspan="3" class="muted">Nenhum equipamento cadastrado para este veículo.</td></tr>';
  select.onchange = () => { selectedStockVehicleId = select.value; resetStockVehicleEquipmentForm(); renderStockVehicleEquipment(vehicles); };
  table.querySelectorAll('[data-vehicle-equipment-edit]').forEach((button) => button.addEventListener('click', () => {
    const item = equipment.find((entry) => String(entry.id) === String(button.dataset.vehicleEquipmentEdit));
    if (!item || !vehicle) return;
    $('#stock-vehicle-equipment-id').value = item.id;
    $('#stock-vehicle-equipment-vehicle').value = vehicle.id;
    $('#stock-vehicle-equipment-name').value = item.name || '';
    $('#stock-vehicle-equipment-quantity').value = item.quantity || 1;
    $('#stock-vehicle-equipment-cancel').classList.remove('hidden');
    $('#stock-vehicle-equipment-message').textContent = 'Editando equipamento do veículo.';
    $('#stock-vehicle-equipment-name').focus();
  }));
  table.querySelectorAll('[data-vehicle-equipment-delete]').forEach((button) => button.addEventListener('click', async () => {
    const item = equipment.find((entry) => String(entry.id) === String(button.dataset.vehicleEquipmentDelete));
    if (!item || !vehicle || !window.confirm(`Excluir o equipamento ${item.name} do veículo ${vehicle.plate}?`)) return;
    try {
      await api(`/api/stock/vehicles/${vehicle.id}/equipment/${item.id}`, { method: 'DELETE' });
      resetStockVehicleEquipmentForm();
      await loadStock();
    } catch (error) { $('#stock-vehicle-equipment-message').textContent = error.message; }
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

function vehicleChecklistDefinition() {
  if (selectedVehicleChecklistType !== 'diario') return vehicleItems.map(([itemKey, itemName]) => [itemKey, itemName, 'vehicle_item', null]);
  const selectedId = $('#vehicle-select')?.value;
  const vehicle = vehicleCatalog.find((item) => String(item.id) === String(selectedId));
  const equipmentItems = (vehicle?.equipmentItems || []).map((item) => [`vehicle_equipment_${item.id}`, item.name, 'vehicle_equipment', Number(item.quantity)]);
  return [...vehicleDailyItems.map(([itemKey, itemName]) => [itemKey, itemName, 'daily_photo', null]), ...equipmentItems];
}

function vehicleChecklistTypeLabel(type = selectedVehicleChecklistType) {
  return ({ diario: 'Checklist diário', geral: 'Checklist geral', quinzenal: 'Checklist quinzenal', transferencia: 'Transferência de veículo', recebimento: 'Recebimento de veículo', entrega: 'Entrega de veículo', devolucao: 'Devolução de veículo' }[type] || 'Checklist de veículo');
}

function vehicleChecklistDisplayLabel(checklist) {
  const label = vehicleChecklistTypeLabel(checklist?.checklistType);
  if (checklist?.checklistType === 'diario' && checklist.dailyPeriod) return `${label} · ${checklist.dailyPeriod === 'inicio' ? 'começo do dia' : 'fim do dia'}`;
  return label;
}

function vehicleExtraPhotoCount() {
  return vehiclePhotoDrafts.filter((photo) => !photo.itemKey).length;
}

function setVehicleChecklistType(type) {
  if (!['diario', 'geral', 'quinzenal', 'transferencia', 'recebimento', 'entrega', 'devolucao'].includes(type)) return;
  if (['entrega', 'recebimento'].includes(type) && !(isAdminRole() || currentUser?.role === 'vistoriador')) return;
  selectedVehicleChecklistType = type;
  selectedVehicleChecklistPurpose = type === 'geral' ? null : type;
  document.querySelectorAll('[data-vehicle-checklist-type]').forEach((button) => button.classList.toggle('active', button.dataset.vehicleChecklistType === type));
  $('#vehicle-start-message').textContent = `${vehicleChecklistTypeLabel()} selecionado. Agora escolha o veículo.`;
  resetVehicleWizard();
}

function initializeVehicleWizardDom() {
  const form = $('#vehicle-checklist-form');
  if (!form || $('#vehicle-start-step')) return;
  const meta = form.querySelector('.vehicle-meta-grid');
  const legend = form.querySelector('.checklist-legend');
  const table = form.querySelector('.vehicle-checklist-table');
  const signature = form.querySelector('.vehicle-signature-entry');
  const photo = form.querySelector('.vehicle-photo-entry');
  const submitActions = [...form.children].find((child) => child.classList.contains('form-actions'));
  form.insertAdjacentHTML('afterbegin', '<div id="vehicle-start-step" class="vehicle-step"><div class="subheading"><h3>Tipo de checklist</h3><p class="muted">O Checklist geral é preenchido uma vez e sua finalidade é escolhida no final.</p></div><div class="vehicle-checklist-options" role="tablist" aria-label="Tipo de checklist de veículo"><button type="button" class="vehicle-checklist-option" data-vehicle-checklist-type="diario">Checklist diário</button><button type="button" class="vehicle-checklist-option" data-vehicle-checklist-type="geral">Checklist geral</button></div><label>Veículo<select id="vehicle-select"><option value="">Carregando veículos...</option></select></label><div class="form-actions"><button id="vehicle-start-checklist" type="button">Iniciar checklist</button><span id="vehicle-start-message" class="muted">Escolha o tipo e o veículo para iniciar.</span></div></div><div id="vehicle-checklist-step" class="vehicle-step hidden"><div class="vehicle-selected-card"><strong id="vehicle-selected-title">Veículo selecionado</strong><span id="vehicle-selected-details" class="muted"></span></div><label id="vehicle-mileage-field">Quilometragem (opcional)<input id="vehicle-wizard-mileage" type="number" min="0" placeholder="Quilometragem atual" /></label><div class="vehicle-wizard-progress"><strong id="vehicle-wizard-counter">Item 1</strong><span id="vehicle-wizard-instruction">Faça a conferência e avance.</span><div class="wizard-progress-track"><span id="vehicle-wizard-progress-bar"></span></div></div><div id="vehicle-item-wizard"></div><div class="wizard-navigation"><button id="vehicle-item-back" type="button" class="secondary small-button">Anterior</button><span id="vehicle-item-message" class="muted"></span><button id="vehicle-item-next" type="button" class="small-button">Próximo item</button></div></div>');
  meta?.classList.add('hidden');
  legend?.classList.add('hidden');
  table?.classList.add('hidden');
  const finalStep = document.createElement('div');
  finalStep.id = 'vehicle-final-step';
  finalStep.className = 'vehicle-step hidden';
  finalStep.innerHTML = '<div class="vehicle-final-heading"><div><h3>Finalizar checklist</h3><p class="muted">Escolha a finalidade, confira a assinatura, tire a selfie e envie as fotos.</p></div><button id="vehicle-return-to-items" type="button" class="secondary small-button">Voltar aos itens</button></div><div class="vehicle-final-purpose"><label id="vehicle-final-purpose-field">Finalidade do Checklist geral<select id="vehicle-final-purpose"><option value="quinzenal">Quinzenal</option><option value="transferencia">Transferência</option><option value="recebimento">Recebimento</option><option value="entrega">Entrega</option></select></label><label id="vehicle-final-target-field" class="hidden">Usuário que receberá o veículo<select id="vehicle-final-target-user"><option value="">Selecione o usuário</option></select></label><label id="vehicle-final-daily-period-field" class="hidden">Período do checklist diário<select id="vehicle-final-daily-period"><option value="inicio">Começo do dia</option><option value="fim">Fim do dia</option></select></label><p id="vehicle-final-purpose-help" class="muted"></p></div><div class="vehicle-selfie-entry"><div class="subheading"><h3>Selfie do momento</h3></div><p class="muted">Tire a selfie agora pela câmera. Não é permitido escolher uma imagem da galeria.</p><button id="vehicle-open-selfie-camera" type="button">Abrir câmera</button><div id="vehicle-selfie-camera" class="hidden"><video id="vehicle-selfie-video" class="capture-video" autoplay playsinline muted></video><div class="form-actions"><button id="vehicle-take-selfie" type="button">Tirar selfie</button><button id="vehicle-cancel-selfie" type="button" class="secondary">Cancelar</button></div></div><div id="vehicle-selfie-preview" class="epi-photo-previews"></div><p id="vehicle-selfie-message" class="muted" aria-live="polite">Nenhuma selfie capturada.</p></div>';
  const selfieEntry = finalStep.querySelector('.vehicle-selfie-entry');
  if (signature) finalStep.insertBefore(signature, selfieEntry);
  if (selfieEntry && photo) finalStep.append(photo);
  if (submitActions) finalStep.append(submitActions);
  form.append(finalStep);
  const submitButton = submitActions?.querySelector('button[type="submit"]');
  if (submitButton) submitButton.textContent = 'Enviar checklist';
  document.querySelectorAll('[data-vehicle-checklist-type]').forEach((button) => button.addEventListener('click', () => setVehicleChecklistType(button.dataset.vehicleChecklistType)));
  $('#vehicle-final-purpose').addEventListener('change', configureVehicleFinalFields);
  $('#vehicle-start-checklist').addEventListener('click', startVehicleChecklist);
  $('#vehicle-item-back').addEventListener('click', () => {
    saveVehicleWizardItem();
    if (vehicleWizardIndex > 0) { vehicleWizardIndex -= 1; renderVehicleWizardItem(); }
  });
  $('#vehicle-item-next').addEventListener('click', () => {
    saveVehicleWizardItem();
    const currentItem = vehicleWizardDraft[vehicleWizardIndex];
    if (!currentItem || (currentItem.requiresPhoto && !vehiclePhotoDrafts.some((photo) => photo.itemKey === currentItem.itemKey))) {
      $('#vehicle-item-message').textContent = `Capture a foto obrigatória de ${currentItem?.itemName || 'este item'} antes de continuar.`;
      return;
    }
    $('#vehicle-item-message').textContent = '';
    if (vehicleWizardIndex < vehicleWizardDraft.length - 1) { vehicleWizardIndex += 1; renderVehicleWizardItem(); return; }
    $('#vehicle-checklist-step').classList.add('hidden');
    $('#vehicle-final-step').classList.remove('hidden');
    configureVehicleFinalFields();
    $('#vehicle-item-message').textContent = '';
    $('#vehicle-final-step').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#vehicle-return-to-items').addEventListener('click', () => {
    $('#vehicle-final-step').classList.add('hidden');
    $('#vehicle-checklist-step').classList.remove('hidden');
    renderVehicleWizardItem();
    $('#vehicle-checklist-step').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#vehicle-open-selfie-camera').addEventListener('click', () => { $('#vehicle-selfie-camera').classList.remove('hidden'); openEpiCamera('#vehicle-selfie-video', '#vehicle-selfie-message', 'user'); });
  $('#vehicle-cancel-selfie').addEventListener('click', () => { stopEpiCamera('#vehicle-selfie-video'); $('#vehicle-selfie-camera').classList.add('hidden'); });
  $('#vehicle-take-selfie').addEventListener('click', async () => {
    const imageData = captureVideoFrame('#vehicle-selfie-video');
    if (!imageData) { $('#vehicle-selfie-message').textContent = 'A câmera ainda não está pronta.'; return; }
    stopEpiCamera('#vehicle-selfie-video');
    $('#vehicle-selfie-camera').classList.add('hidden');
    await ensureVehicleLocation();
    vehicleSelfieDraft = { imageData, captureMode: 'camera', latitude: vehicleSignatureLocation.latitude, longitude: vehicleSignatureLocation.longitude };
    $('#vehicle-selfie-preview').innerHTML = `<div><img src="${imageData}" alt="Selfie do checklist" /></div>`;
    $('#vehicle-selfie-message').textContent = 'Selfie preparada para envio.';
  });
}

function configureVehicleFinalFields() {
  const purposeField = $('#vehicle-final-purpose-field');
  const purposeSelect = $('#vehicle-final-purpose');
  const targetField = $('#vehicle-final-target-field');
  const targetSelect = $('#vehicle-final-target-user');
  const dailyPeriodField = $('#vehicle-final-daily-period-field');
  const help = $('#vehicle-final-purpose-help');
  if (!purposeSelect || !targetField || !dailyPeriodField) return;
  const isDaily = selectedVehicleChecklistType === 'diario';
  purposeField?.classList.toggle('hidden', isDaily);
  dailyPeriodField.classList.toggle('hidden', !isDaily);
  const purpose = isDaily ? 'diario' : (purposeSelect.value || 'quinzenal');
  const needsTarget = ['transferencia', 'recebimento', 'entrega'].includes(purpose);
  purposeSelect.querySelectorAll('option').forEach((option) => {
    const restricted = ['entrega', 'recebimento'].includes(option.value) && !(isAdminRole() || currentUser?.role === 'vistoriador');
    option.disabled = restricted;
  });
  targetField.classList.toggle('hidden', !needsTarget);
  if (targetSelect) targetSelect.required = needsTarget;
  if (help) {
    help.textContent = purpose === 'quinzenal'
      ? 'A regra de notificação dos checklists quinzenais continua valendo.'
      : purpose === 'transferencia'
        ? 'O destinatário deverá assinar e tirar uma selfie; depois o processo seguirá para validação do Admin.'
        : purpose === 'entrega'
          ? 'A entrega deve ser iniciada pelo Admin ou Supervisor e aceita pelo técnico destinatário.'
          : purpose === 'recebimento'
            ? 'O usuário destinatário deverá assinar e tirar uma selfie para confirmar o recebimento.'
            : 'Escolha o período correspondente ao momento em que o veículo foi conferido.';
  }
  populateVehicleTargetUsers();
}

function startVehicleChecklist() {
  const selectedId = $('#vehicle-select')?.value;
  const vehicle = vehicleCatalog.find((item) => String(item.id) === String(selectedId));
  const message = $('#vehicle-start-message');
  if (!selectedVehicleChecklistType) {
    if (message) message.textContent = 'Escolha o tipo de checklist antes de iniciar.';
    return;
  }
  if (!vehicle) {
    if (message) message.textContent = 'Selecione um veículo antes de iniciar.';
    return;
  }
  vehicleWizardIndex = 0;
  vehicleWizardDraft = vehicleChecklistDefinition().map(([itemKey, itemName, itemKind = 'vehicle_item', expectedQuantity = null]) => ({ itemKey, itemName, itemKind, expectedQuantity, requiresPhoto: itemKind !== 'vehicle_equipment', beforeStatus: 'ok', beforeDescription: '', afterStatus: 'ok', afterDescription: '' }));
  vehiclePhotoDrafts = [];
  vehicleSelfieDraft = null;
  vehiclePhotoCaptureItemKey = null;
  $('#vehicle-plate').value = vehicle.plate || '';
  $('#vehicle-model').value = vehicle.model || '';
  $('#vehicle-year').value = vehicle.year || '';
  $('#vehicle-selected-title').textContent = `${vehicle.plate} · ${vehicle.model || 'Modelo não informado'}`;
  $('#vehicle-selected-details').textContent = [vehicleChecklistTypeLabel(), vehicle.year, vehicle.color].filter(Boolean).join(' · ') || 'Veículo selecionado';
  $('#vehicle-mileage-field').classList.toggle('hidden', selectedVehicleChecklistType === 'diario');
  $('#vehicle-wizard-instruction').textContent = selectedVehicleChecklistType === 'diario'
    ? (vehicleWizardDraft.some((item) => item.itemKind === 'vehicle_equipment') ? 'Etapa 1: confirme os pontos do veículo com fotos. Etapa 2: confirme se cada equipamento cadastrado está presente.' : 'Marque OK ou Não OK, registre uma observação se quiser e capture a foto.')
    : 'Confira antes e depois, registre a descrição quando necessário e capture a foto.';
  $('#vehicle-start-step').classList.add('hidden');
  $('#vehicle-final-step').classList.add('hidden');
  $('#vehicle-checklist-step').classList.remove('hidden');
  $('#vehicle-start-message').textContent = '';
  configureVehicleFinalFields();
  renderVehicleWizardItem();
  renderVehiclePhotoDrafts();
  if (shouldUseMobileVehicleChecklist()) openMobileVehicleChecklist();
  $('#vehicle-checklist-step').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function populateVehicleCatalog() {
  const select = $('#vehicle-select');
  if (!select) return;
  const selected = select.value;
  select.innerHTML = vehicleCatalog.length ? `<option value="">Selecione o veículo</option>${vehicleCatalog.map((vehicle) => `<option value="${escapeHtml(vehicle.id)}">${escapeHtml(vehicle.plate)} · ${escapeHtml(vehicle.model || 'Modelo não informado')}${vehicle.year ? ` · ${escapeHtml(vehicle.year)}` : ''}</option>`).join('')}` : '<option value="">Nenhum veículo ativo cadastrado</option>';
  if (vehicleCatalog.some((vehicle) => String(vehicle.id) === String(selected))) select.value = selected;
}

async function loadVehicleCatalog() {
  if (!['admin', 'superadmin', 'tecnico', 'vistoriador'].includes(currentUser?.role)) return;
  try {
    const [data, targetData, deliveryTargetData] = await Promise.all([
      api('/api/vehicles/catalog'),
      api('/api/vehicles/targets'),
      (isAdminRole() || currentUser?.role === 'vistoriador') ? api('/api/vehicles/targets?type=entrega') : Promise.resolve({ users: [] }),
    ]);
    vehicleCatalog = data.vehicles || [];
    vehicleTargetUsers = targetData.users || [];
    vehicleDeliveryTargetUsers = deliveryTargetData.users || [];
    populateVehicleCatalog();
    populateVehicleTargetUsers();
  } catch (error) { const message = $('#vehicle-start-message'); if (message) message.textContent = error.message; }
}

function populateVehicleTargetUsers() {
  const targetSelect = $('#vehicle-final-target-user');
  if (!targetSelect) return;
  const purpose = $('#vehicle-final-purpose')?.value || selectedVehicleChecklistPurpose;
  const users = ['entrega', 'recebimento'].includes(purpose) ? vehicleDeliveryTargetUsers : vehicleTargetUsers;
  targetSelect.innerHTML = users.length ? `<option value="">Selecione o usuário</option>${users.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)} · ${escapeHtml(roleLabels[user.role] || user.role)}</option>`).join('')}` : '<option value="">Nenhum usuário ativo disponível</option>';
}

function configureVehicleChecklistOptions() {
  document.querySelectorAll('[data-vehicle-checklist-type]').forEach((button) => {
    button.classList.remove('hidden');
    button.disabled = false;
  });
}

function resetVehicleWizard() {
  vehicleWizardIndex = 0;
  vehicleWizardDraft = [];
  vehiclePhotoDrafts = [];
  vehicleSelfieDraft = null;
  vehiclePhotoCaptureItemKey = null;
  $('#vehicle-start-step')?.classList.remove('hidden');
  $('#vehicle-checklist-step')?.classList.add('hidden');
  $('#vehicle-final-step')?.classList.add('hidden');
  $('#vehicle-wizard-mileage').value = '';
  if ($('#vehicle-final-target-user')) $('#vehicle-final-target-user').value = '';
  if ($('#vehicle-final-purpose')) $('#vehicle-final-purpose').value = 'quinzenal';
  if ($('#vehicle-final-daily-period')) $('#vehicle-final-daily-period').value = 'inicio';
  $('#vehicle-item-wizard').innerHTML = '';
  renderVehicleWizardItem();
  renderVehiclePhotoDrafts();
  if ($('#vehicle-selfie-preview')) $('#vehicle-selfie-preview').innerHTML = '';
  if ($('#vehicle-selfie-message')) $('#vehicle-selfie-message').textContent = 'Nenhuma selfie capturada.';
}

function renderVehicleEditor() {
  initializeVehicleWizardDom();
  configureVehicleChecklistOptions();
  selectedVehicleChecklistType = null;
  selectedVehicleChecklistPurpose = null;
  document.querySelectorAll('[data-vehicle-checklist-type]').forEach((button) => button.classList.remove('active'));
  resetVehicleWizard();
  populateVehicleCatalog();
}

function saveVehicleWizardItem() {
  const card = $('#vehicle-item-wizard .vehicle-wizard-item');
  const item = vehicleWizardDraft[vehicleWizardIndex];
  if (!card || !item) return;
  if (selectedVehicleChecklistType === 'diario') {
    const status = card.querySelector('[data-side="daily-status"]').value;
    const observation = card.querySelector('[data-side="daily-description"]').value;
    vehicleWizardDraft[vehicleWizardIndex] = { ...item, beforeStatus: status, beforeDescription: observation, afterStatus: status, afterDescription: observation };
    return;
  }
  const beforeStatus = card.querySelector('[data-side="before-status"]').value;
  const afterStatus = card.querySelector('[data-side="after-status"]').value;
  vehicleWizardDraft[vehicleWizardIndex] = { ...item, beforeStatus, beforeDescription: beforeStatus === 'ok' ? '' : card.querySelector('[data-side="before-description"]').value, afterStatus, afterDescription: afterStatus === 'ok' ? '' : card.querySelector('[data-side="after-description"]').value };
}

function renderVehicleWizardItem() {
  const container = $('#vehicle-item-wizard');
  const item = vehicleWizardDraft[vehicleWizardIndex];
  if (!container || !item) return;
  const photoCount = vehiclePhotoDrafts.filter((photo) => photo.itemKey === item.itemKey).length;
  const isDaily = selectedVehicleChecklistType === 'diario';
  const isEquipment = isDaily && item.itemKind === 'vehicle_equipment';
  const stageLabel = isEquipment ? 'Etapa 2 · Equipamentos cadastrados' : isDaily ? 'Etapa 1 · Verificação visual' : 'Conferência do veículo';
  const fields = isDaily
    ? `<label>${isEquipment ? 'Está no veículo?' : 'Status'}<select data-side="daily-status"><option value="ok" ${item.beforeStatus === 'ok' ? 'selected' : ''}>${isEquipment ? 'Sim' : 'OK'}</option><option value="defeito" ${item.beforeStatus === 'defeito' ? 'selected' : ''}>${isEquipment ? 'Não' : 'Não OK'}</option></select></label>${isEquipment ? `<p class="muted vehicle-equipment-expected">Quantidade cadastrada: <strong>${escapeHtml(item.expectedQuantity || 0)}</strong></p>` : ''}<label>Observação (opcional)<textarea data-side="daily-description" maxlength="500" placeholder="${isEquipment ? 'Informe se faltou ou houve alguma divergência.' : 'Descreva uma irregularidade, se quiser'}">${escapeHtml(item.beforeDescription)}</textarea></label>`
    : `<label>Antes<select data-side="before-status"><option value="ok" ${item.beforeStatus === 'ok' ? 'selected' : ''}>OK</option><option value="defeito" ${item.beforeStatus === 'defeito' ? 'selected' : ''}>Com defeito</option><option value="quebrado" ${item.beforeStatus === 'quebrado' ? 'selected' : ''}>Quebrado</option></select></label><label>Depois<select data-side="after-status"><option value="ok" ${item.afterStatus === 'ok' ? 'selected' : ''}>OK</option><option value="defeito" ${item.afterStatus === 'defeito' ? 'selected' : ''}>Com defeito</option><option value="quebrado" ${item.afterStatus === 'quebrado' ? 'selected' : ''}>Quebrado</option></select></label><label data-description-wrap="before" class="hidden">Descrição antes<textarea data-side="before-description" maxlength="500">${escapeHtml(item.beforeDescription)}</textarea></label><label data-description-wrap="after" class="hidden">Descrição depois<textarea data-side="after-description" maxlength="500">${escapeHtml(item.afterDescription)}</textarea></label>`;
  const photoBlock = item.requiresPhoto
    ? `<button id="vehicle-item-photo-button" type="button" class="secondary">${photoCount ? 'Refazer foto deste item' : 'Capturar foto deste item'}</button><div id="vehicle-item-camera" class="hidden"><video id="vehicle-item-video" class="capture-video" autoplay playsinline muted></video><div class="form-actions"><button id="vehicle-item-take-photo" type="button">Capturar foto</button><button id="vehicle-item-cancel-photo" type="button" class="secondary">Cancelar</button></div></div><p id="vehicle-item-photo-message" class="muted" aria-live="polite">${photoCount ? 'Foto deste item preparada.' : 'A foto deste item é obrigatória.'}</p>`
    : '<p class="muted vehicle-equipment-photo-note">Este item é conferido na segunda etapa e não exige foto individual.</p>';
  container.innerHTML = `<div class="vehicle-wizard-item"><div class="wizard-item-heading"><div><span class="eyebrow">${stageLabel}</span><strong>${escapeHtml(item.itemName)}</strong></div><span class="muted">Item ${vehicleWizardIndex + 1} de ${vehicleWizardDraft.length}</span></div><div class="vehicle-wizard-fields">${fields}</div>${photoBlock}</div>`;
  if (isDaily) {
    container.querySelector('[data-side="daily-status"]').addEventListener('change', saveVehicleWizardItem);
    container.querySelector('[data-side="daily-description"]').addEventListener('input', saveVehicleWizardItem);
  } else {
    const updateDescription = (side) => { const status = container.querySelector(`[data-side="${side}-status"]`); container.querySelector(`[data-description-wrap="${side}"]`).classList.toggle('hidden', status.value === 'ok'); };
    ['before', 'after'].forEach((side) => { container.querySelector(`[data-side="${side}-status"]`).addEventListener('change', () => { updateDescription(side); saveVehicleWizardItem(); }); updateDescription(side); });
  }
  if (item.requiresPhoto) {
    container.querySelector('#vehicle-item-photo-button').addEventListener('click', () => { vehiclePhotoCaptureItemKey = item.itemKey; container.querySelector('#vehicle-item-camera').classList.remove('hidden'); openEpiCamera('#vehicle-item-video', '#vehicle-item-photo-message', 'environment'); });
    container.querySelector('#vehicle-item-cancel-photo').addEventListener('click', () => { stopEpiCamera('#vehicle-item-video'); container.querySelector('#vehicle-item-camera').classList.add('hidden'); });
    container.querySelector('#vehicle-item-take-photo').addEventListener('click', () => { const imageData = captureVideoFrame('#vehicle-item-video'); if (!imageData) { container.querySelector('#vehicle-item-photo-message').textContent = 'A câmera ainda não está pronta.'; return; } const existingIndex = vehiclePhotoDrafts.findIndex((photo) => photo.itemKey === vehiclePhotoCaptureItemKey); const photo = { imageData, itemKey: vehiclePhotoCaptureItemKey }; if (existingIndex >= 0) vehiclePhotoDrafts[existingIndex] = photo; else vehiclePhotoDrafts.push(photo); stopEpiCamera('#vehicle-item-video'); renderVehicleWizardItem(); renderVehiclePhotoDrafts(); });
  }
  $('#vehicle-wizard-counter').textContent = `Item ${vehicleWizardIndex + 1} de ${vehicleWizardDraft.length}`;
  $('#vehicle-wizard-progress-bar').style.width = `${((vehicleWizardIndex + 1) / vehicleWizardDraft.length) * 100}%`;
  const mobileProgress = $('#mobile-checklist-progress');
  if (mobileProgress && mobileChecklistActive && mobileChecklistKind === 'vehicle') mobileProgress.textContent = `Item ${vehicleWizardIndex + 1} de ${vehicleWizardDraft.length}`;
  $('#vehicle-item-back').disabled = vehicleWizardIndex === 0;
  $('#vehicle-item-next').textContent = vehicleWizardIndex === vehicleWizardDraft.length - 1 ? 'Ir para assinatura' : 'Próximo item';
}

function readVehicleEditor() {
  saveVehicleWizardItem();
  return vehicleWizardDraft.map((item) => ({ itemKey: item.itemKey, itemKind: item.itemKind, expectedQuantity: item.expectedQuantity, beforeStatus: item.beforeStatus, beforeDescription: item.beforeDescription, afterStatus: item.afterStatus, afterDescription: item.afterDescription }));
}

function renderVehicleSummary(checklist, includeAction = false) {
  const problems = checklist.items.filter((item) => item.beforeStatus !== 'ok' || item.afterStatus !== 'ok').length;
  const action = includeAction ? `<button type="button" class="secondary small-button vehicle-open" data-vehicle-id="${checklist.id}">Abrir</button>` : '';
  const statusLabel = { pendente_destinatario: 'Aguardando destinatário', pendente_validacao: 'Aguardando validação', validado: 'Validado', reprovado: 'Reprovado', rascunho: 'Rascunho' }[checklist.status] || checklist.status;
  const target = checklist.targetName ? ` · destinatário: ${checklist.targetName}` : '';
  return `<div class="vehicle-list-item"><div><strong>${escapeHtml(checklist.plate)} · ${escapeHtml(checklist.model || 'Modelo não informado')}</strong><small>${escapeHtml(vehicleChecklistDisplayLabel(checklist))} · ${escapeHtml(checklist.driverName || 'Técnico não informado')}${escapeHtml(target)} · ${escapeHtml(formatDate(checklist.createdAt))} · ${problems} ocorrência(s)</small></div><div class="vehicle-list-actions"><span class="status status-${escapeHtml(checklist.status)}">${escapeHtml(statusLabel)}</span>${action}</div></div>`;
}

async function loadVehicleChecklists() {
  const data = await api('/api/vehicles/checklists');
  if (['tecnico', 'vistoriador'].includes(currentUser.role)) {
    $('#vehicle-tech-list').innerHTML = data.checklists.length ? data.checklists.map((checklist) => renderVehicleSummary(checklist, true)).join('') : '<p class="muted">Nenhum checklist realizado.</p>';
    document.querySelectorAll('#vehicle-tech-list .vehicle-open').forEach((button) => button.addEventListener('click', () => openVehicleChecklist(button.dataset.vehicleId, '#vehicle-tech-detail')));
  }
  if (isAdminRole()) {
    $('#vehicle-admin-list').innerHTML = data.checklists.length ? data.checklists.map((checklist) => renderVehicleSummary(checklist, true)).join('') : '<p class="muted">Nenhum checklist cadastrado.</p>';
    document.querySelectorAll('#vehicle-admin-list .vehicle-open').forEach((button) => button.addEventListener('click', () => openVehicleChecklist(button.dataset.vehicleId, '#vehicle-admin-detail')));
  }
}

function vehicleSignatureRoleLabel(role, context = {}) { if (context.stage === 'transfer_recipient') return 'Usuário destinatário'; if (context.stage === 'delivery_recipient') return 'Técnico destinatário'; return ({ tecnico: 'Técnico', vistoriador: 'Supervisor', admin: 'Administrador', superadmin: 'Superadmin' }[role] || role); }

function renderVehicleSignatures(checklist) {
  if (!checklist.signatures?.length) return '<section class="vehicle-signatures"><h4>Assinaturas</h4><p class="muted">Nenhuma assinatura registrada.</p></section>';
  return `<section class="vehicle-signatures"><h4>Assinaturas registradas</h4><div class="vehicle-signature-list">${checklist.signatures.map((signature) => `<div class="vehicle-signature-row"><div><strong>${escapeHtml(vehicleSignatureRoleLabel(signature.signerRole, signature.signatureContext))}</strong><small>${escapeHtml(signature.typedName || 'Nome não informado')} · ${escapeHtml(formatDate(signature.signedAt))}</small></div></div>`).join('')}</div></section>`;
}

function renderVehicleDetail(checklist, containerSelector, canValidate) {
  const container = $(containerSelector);
  if (!container) return;
  container.classList.remove('hidden');
  const isDaily = checklist.checklistType === 'diario';
  const adminOnlyValidation = ['transferencia', 'devolucao'].includes(checklist.checklistType);
  const canValidateChecklist = canValidate && checklist.status === 'pendente_validacao' && (!adminOnlyValidation || isAdminRole());
  const isRecipientAcceptance = ['transferencia', 'recebimento', 'entrega'].includes(checklist.checklistType) && checklist.status === 'pendente_destinatario' && String(checklist.targetUserId || '') === String(currentUser?.id || '');
  let vehicleValidationSelfie = null;
  const validationControls = canValidateChecklist ? `<div class="validation-controls"><div class="epi-signature-preview"><img src="${escapeHtml(currentUser?.signatureData || '')}" alt="Assinatura padrão do responsável pela validação" /></div><label class="consent-check"><input id="vehicle-validation-signature-confirm" type="checkbox" /> Confirmo o uso da minha assinatura padrão nesta validação.</label><button id="vehicle-validation-open-selfie" type="button" class="secondary">Capturar selfie do validador</button><div id="vehicle-validation-selfie-camera" class="hidden"><video id="vehicle-validation-selfie-video" class="capture-video" autoplay playsinline muted></video><div class="form-actions"><button id="vehicle-validation-take-selfie" type="button">Tirar selfie</button><button id="vehicle-validation-cancel-selfie" type="button" class="secondary">Cancelar</button></div></div><div id="vehicle-validation-selfie-preview" class="epi-photo-previews"></div><p id="vehicle-validation-selfie-status" class="muted" aria-live="polite">Selfie do validador ainda não capturada.</p><div class="signature-actions"><button id="vehicle-validation-capture-location" type="button" class="secondary">Capturar localização</button></div><textarea id="validation-notes" maxlength="700" placeholder="Observação da validação (opcional)"></textarea><div class="signature-actions"><button id="approve-vehicle" type="button">Validar vistoria</button><button id="reject-vehicle" type="button" class="danger-button">Reprovar vistoria</button></div><p id="validation-message" class="muted">A assinatura, a selfie e a localização serão registradas na validação.</p></div>` : '';
  const isDelivery = ['recebimento', 'entrega'].includes(checklist.checklistType);
  const acceptanceLabel = checklist.checklistType === 'recebimento' ? 'Aceitar recebimento' : isDelivery ? 'Aceitar entrega' : 'Aceitar transferência';
  const transferAcceptanceControls = isRecipientAcceptance ? `<div class="vehicle-transfer-acceptance"><div class="subheading"><h4>${acceptanceLabel}</h4><p class="muted">Confira o veículo e confirme com sua assinatura padrão e uma selfie feita agora.</p></div><div class="epi-signature-preview"><img src="${escapeHtml(currentUser?.signatureData || '')}" alt="Sua assinatura padrão" /></div><label class="consent-check"><input id="vehicle-transfer-signature-confirm" type="checkbox" /> Confirmo minha assinatura e aceito receber este veículo.</label><button id="vehicle-transfer-open-selfie" type="button">Abrir câmera para selfie</button><div id="vehicle-transfer-selfie-camera" class="hidden"><video id="vehicle-transfer-selfie-video" class="capture-video" autoplay playsinline muted></video><div class="form-actions"><button id="vehicle-transfer-take-selfie" type="button">Tirar selfie</button><button id="vehicle-transfer-cancel-selfie" type="button" class="secondary">Cancelar</button></div></div><div id="vehicle-transfer-selfie-preview" class="epi-photo-previews"></div><p id="vehicle-transfer-message" class="muted" aria-live="polite">Nenhuma selfie capturada.</p><button id="vehicle-transfer-accept" type="button">${acceptanceLabel}</button></div>` : '';
  const media = (checklist.media || []).map((item) => { const isSelfie = item.kind === 'selfie'; const itemName = [...vehicleItems, ...vehicleDailyItems].find(([key]) => key === item.itemKey)?.[1]; const label = isSelfie ? (item.captureContext === 'validation' ? 'Selfie do validador' : 'Selfie do checklist') : itemName ? `Foto · ${itemName}` : 'Foto extra do veículo'; return `<figure class="epi-process-media-item"><img src="/api/vehicles/checklists/${checklist.id}/media/${item.id}" alt="${escapeHtml(label)}" loading="lazy" /><figcaption><strong>${escapeHtml(label)}</strong><span>Data/hora: ${escapeHtml(formatDate(item.createdAt))}</span><span>IP: ${escapeHtml(item.ipAddress || 'Não informado')}</span><span>Navegador: ${escapeHtml(browserLabel(item.userAgent || item.deviceInfo))}</span><span>Dispositivo: ${escapeHtml(deviceLabel(item.userAgent || item.deviceInfo))}</span><span>Cidade: ${escapeHtml(formatMediaLocation(item))}</span><span>Coordenadas: ${escapeHtml(formatMediaCoordinates(item))}</span></figcaption></figure>`; }).join('');
  const table = isDaily
    ? `<table class="vehicle-detail-table"><thead><tr><th>Ponto</th><th>Status</th><th>Observação</th></tr></thead><tbody>${checklist.items.map((item) => `<tr><td>${escapeHtml(item.itemKind === 'vehicle_equipment' && item.expectedQuantity ? `${item.itemName} (Qtd. cadastrada: ${item.expectedQuantity})` : item.itemName)}</td><td>${escapeHtml(item.itemKind === 'vehicle_equipment' ? (item.beforeStatus === 'ok' ? 'Sim' : 'Não') : vehicleStatusLabel(item.beforeStatus))}</td><td>${escapeHtml(item.beforeDescription || '–')}</td></tr>`).join('')}</tbody></table>`
    : `<table class="vehicle-detail-table"><thead><tr><th>Item</th><th>Antes</th><th>Descrição</th><th>Depois</th><th>Descrição</th></tr></thead><tbody>${checklist.items.map((item) => `<tr><td>${escapeHtml(item.itemName)}</td><td>${escapeHtml(vehicleStatusLabel(item.beforeStatus))}</td><td>${escapeHtml(item.beforeDescription || '–')}</td><td>${escapeHtml(vehicleStatusLabel(item.afterStatus))}</td><td>${escapeHtml(item.afterDescription || '–')}</td></tr>`).join('')}</tbody></table>`;
  const statusLabel = { pendente_destinatario: 'Aguardando destinatário', pendente_validacao: 'Aguardando validação', validado: 'Validado', reprovado: 'Reprovado' }[checklist.status] || checklist.status;
  const targetLine = checklist.targetName ? `<p class="muted">${isDelivery ? 'Técnico destinatário' : 'Destinatário'}: ${escapeHtml(checklist.targetName)}</p>` : '';
  const dailyPeriodLine = isDaily && checklist.dailyPeriod ? `<p class="muted">Período: ${checklist.dailyPeriod === 'inicio' ? 'Começo do dia' : 'Fim do dia'}</p>` : '';
  container.innerHTML = `<div class="vehicle-detail-card"><div class="section-heading"><div><div class="eyebrow">${escapeHtml(vehicleChecklistDisplayLabel(checklist).toUpperCase())} #${checklist.id}</div><h3>${escapeHtml(checklist.plate)} · ${escapeHtml(checklist.model || '')}</h3><p class="muted">Técnico: ${escapeHtml(checklist.driverName || '–')} · ${escapeHtml(formatDate(checklist.createdAt))}</p>${dailyPeriodLine}${targetLine}</div><span class="status status-${escapeHtml(checklist.status)}">${escapeHtml(statusLabel)}</span></div><div class="table-wrap">${table}</div>${checklist.validationNotes ? `<p class="validation-note"><b>Observação do responsável pela validação:</b> ${escapeHtml(checklist.validationNotes)}</p>` : ''}${media ? `<section class="vehicle-checklist-media"><h4>Fotos registradas</h4><div class="epi-process-media">${media}</div></section>` : ''}${renderVehicleSignatures(checklist)}${transferAcceptanceControls}${validationControls}</div>`;
  container.querySelector('.vehicle-detail-card')?.insertAdjacentHTML('afterbegin', '<div class="detail-actions vehicle-detail-toolbar"><button id="close-vehicle-detail" type="button" class="secondary small-button">Fechar</button><button id="download-vehicle-checklist-pdf" type="button" class="secondary small-button">Baixar PDF</button></div>');
  container.querySelector('#close-vehicle-detail')?.addEventListener('click', () => { container.classList.add('hidden'); if (containerSelector === '#vehicle-tech-detail') activateSubtab('vehicles-tech', 'history'); if (containerSelector === '#vehicle-admin-detail') { activateSubtab('vehicles-admin', 'list'); activateSubtab('vehicles-main', 'management'); } if (containerSelector === '#validation-detail') activateSubtab('validation-main', 'list'); });
  container.querySelector('#download-vehicle-checklist-pdf')?.addEventListener('click', (event) => downloadPdfFile(`/api/vehicles/checklists/${checklist.id}/pdf`, `checklist-veiculo-${checklist.id}.pdf`, event.currentTarget));

  if (isRecipientAcceptance) {
    let transferSelfie = null;
    container.querySelector('#vehicle-transfer-open-selfie').addEventListener('click', () => { container.querySelector('#vehicle-transfer-selfie-camera').classList.remove('hidden'); openEpiCamera('#vehicle-transfer-selfie-video', '#vehicle-transfer-message', 'user'); });
    container.querySelector('#vehicle-transfer-cancel-selfie').addEventListener('click', () => { stopEpiCamera('#vehicle-transfer-selfie-video'); container.querySelector('#vehicle-transfer-selfie-camera').classList.add('hidden'); });
    container.querySelector('#vehicle-transfer-take-selfie').addEventListener('click', async () => {
      const imageData = captureVideoFrame('#vehicle-transfer-selfie-video');
      if (!imageData) { container.querySelector('#vehicle-transfer-message').textContent = 'A câmera ainda não está pronta.'; return; }
      stopEpiCamera('#vehicle-transfer-selfie-video');
      container.querySelector('#vehicle-transfer-selfie-camera').classList.add('hidden');
      await ensureVehicleLocation();
      transferSelfie = { imageData, captureMode: 'camera', latitude: vehicleSignatureLocation.latitude, longitude: vehicleSignatureLocation.longitude };
      container.querySelector('#vehicle-transfer-selfie-preview').innerHTML = `<div><img src="${imageData}" alt="Selfie de aceite da transferência" /></div>`;
      container.querySelector('#vehicle-transfer-message').textContent = 'Selfie preparada para envio.';
    });
    container.querySelector('#vehicle-transfer-accept').addEventListener('click', async () => {
      const message = container.querySelector('#vehicle-transfer-message');
      if (!currentUser?.signatureData || !container.querySelector('#vehicle-transfer-signature-confirm')?.checked) { message.textContent = 'Confirme o uso da sua assinatura padrão antes de aceitar.'; return; }
      if (!transferSelfie) { message.textContent = 'Capture a selfie pela câmera antes de aceitar.'; return; }
      try {
        await api(`/api/vehicles/checklists/${checklist.id}/accept-transfer`, { method: 'POST', body: JSON.stringify({ signatureConfirmed: true, latitude: vehicleSignatureLocation.latitude, longitude: vehicleSignatureLocation.longitude, deviceInfo: navigator.userAgent, selfie: transferSelfie }) });
        await loadVehicleChecklists();
        await loadNotifications();
        await loadOverview();
        await openVehicleChecklist(checklist.id, containerSelector);
      } catch (error) { message.textContent = error.message; }
    });
  }

  if (canValidateChecklist) {
    let validationLocation = { latitude: null, longitude: null };
    $('#vehicle-validation-open-selfie').addEventListener('click', () => { $('#vehicle-validation-selfie-camera').classList.remove('hidden'); openEpiCamera('#vehicle-validation-selfie-video', '#vehicle-validation-selfie-status', 'user'); });
    $('#vehicle-validation-cancel-selfie').addEventListener('click', () => { stopEpiCamera('#vehicle-validation-selfie-video'); $('#vehicle-validation-selfie-camera').classList.add('hidden'); });
    $('#vehicle-validation-take-selfie').addEventListener('click', async () => {
      const imageData = captureVideoFrame('#vehicle-validation-selfie-video');
      const status = $('#vehicle-validation-selfie-status');
      if (!imageData) { status.textContent = 'A câmera ainda não está pronta.'; return; }
      stopEpiCamera('#vehicle-validation-selfie-video');
      $('#vehicle-validation-selfie-camera').classList.add('hidden');
      await ensureVehicleLocation();
      vehicleValidationSelfie = { imageData, captureMode: 'camera', latitude: vehicleSignatureLocation.latitude, longitude: vehicleSignatureLocation.longitude };
      $('#vehicle-validation-selfie-preview').innerHTML = `<div><img src="${imageData}" alt="Selfie do validador" /></div>`;
      status.textContent = 'Selfie capturada. Ela será anexada à validação.';
      status.className = 'success-message';
    });
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
      if (!$('#vehicle-validation-signature-confirm')?.checked) { message.textContent = 'Confirme o uso da sua assinatura padrão antes de validar.'; return; }
      if (!vehicleValidationSelfie) { message.textContent = 'Capture a selfie do validador antes de validar.'; return; }
      try {
        if (validationLocation.latitude === null || validationLocation.longitude === null) {
          await new Promise((resolve) => navigator.geolocation?.getCurrentPosition((position) => { validationLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude }; resolve(); }, () => resolve(), { enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 }) || resolve());
        }
        const updated = await api(`/api/vehicles/checklists/${checklist.id}/validate`, { method: 'POST', body: JSON.stringify({ decision, notes: $('#validation-notes').value, signatureConfirmed: true, latitude: validationLocation.latitude, longitude: validationLocation.longitude, deviceInfo: navigator.userAgent, validationSelfie: vehicleValidationSelfie }) });
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
  if (containerSelector === '#vehicle-tech-detail') activateSubtab('vehicles-tech', 'history');
  if (containerSelector === '#vehicle-admin-detail') { activateSubtab('vehicles-main', 'management'); activateSubtab('vehicles-admin', 'detail'); }
  if (containerSelector === '#validation-detail') activateSubtab('validation-main', 'detail');
  const data = await api(`/api/vehicles/checklists/${id}${validationQueue ? '?queue=1' : ''}`);
  renderVehicleDetail(data.checklist, containerSelector, isChecklistValidatorRole());
}

function renderEpiPendingSummary(process) {
  return `<div class="vehicle-list-item"><div><strong>${escapeHtml(process.processTitle)}</strong><small>${escapeHtml(process.createdBy.name)}${process.validatorName ? ` · responsável: ${escapeHtml(process.validatorName)}` : ''} · ${escapeHtml(formatDate(process.createdAt))}</small></div><div class="vehicle-list-actions"><span class="status status-pendente_validacao">Aguardando validação</span><button type="button" class="secondary small-button epi-pending-open" data-process-id="${process.id}">Abrir</button></div></div>`;
}

async function loadValidationQueue() {
  activateSubtab('validation-main', 'list');
  const [vehicleData, epiData] = await Promise.all([api('/api/vehicles/checklists?queue=1'), api('/api/epi/processes')]);
  const vehiclePending = vehicleData.checklists.filter((checklist) => checklist.status === 'pendente_validacao'
    && (!['transferencia', 'devolucao'].includes(checklist.checklistType) || isAdminRole()));
  const epiPending = epiData.processes.filter((process) => process.status === 'pendente_validacao'
    && (isChecklistValidatorRole() || String(process.validatorUserId || '') === String(currentUser.id)));
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
  if (!['admin', 'superadmin', 'tecnico', 'vistoriador'].includes(currentUser?.role)) return;
  const preview = $('#vehicle-signature-preview');
  if (preview) preview.innerHTML = currentUser.signatureData ? `<img src="${escapeHtml(currentUser.signatureData)}" alt="Assinatura padrão cadastrada" />` : '<p class="muted">Assinatura padrão não cadastrada.</p>';
  vehicleSignatureLocation = { latitude: null, longitude: null };
  vehiclePhotoDrafts = [];
  vehicleSelfieDraft = null;
  renderVehiclePhotoDrafts();
  if ($('#vehicle-selfie-preview')) $('#vehicle-selfie-preview').innerHTML = '';
  if ($('#vehicle-selfie-message')) $('#vehicle-selfie-message').textContent = 'Nenhuma selfie capturada.';
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
  if (previews) previews.innerHTML = vehiclePhotoDrafts.map((photo, index) => { const extraNumber = vehiclePhotoDrafts.slice(0, index + 1).filter((entry) => !entry.itemKey).length; return `<div><img src="${photo.imageData}" alt="Foto do veículo ${index + 1}" /><small>${photo.itemKey ? escapeHtml([...vehicleItems, ...vehicleDailyItems].find(([key]) => key === photo.itemKey)?.[1] || 'Item') : `Foto extra ${extraNumber}`}</small></div>`; }).join('');
  const openButton = $('#vehicle-open-photo-camera');
  if (openButton) openButton.disabled = vehicleExtraPhotoCount() >= 2;
  const message = $('#vehicle-photo-message');
  if (message) message.textContent = vehicleExtraPhotoCount() ? `${vehicleExtraPhotoCount()} de 2 fotos extras preparadas.` : 'Nenhuma foto extra capturada. Você pode enviar até 2.';
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
  $('#download-term-pdf')?.addEventListener('click', (event) => downloadPdfFile(`/api/epi/terms/${term.id}/pdf`, `termo-epi-${term.id}.pdf`, event.currentTarget));
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

async function openTerm(id) { activateSubtab('epi-main', 'terms'); const data = await api(`/api/epi/terms/${id}`); renderTermDetail(data.term); $('#term-detail').scrollIntoView({ behavior: 'smooth', block: 'start' }); }

$('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); $('#login-error').textContent = ''; try { const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: $('#login-email').value, password: $('#login-password').value }) }); showApp(data.user); } catch (error) { $('#login-error').textContent = error.message; } });
$('#logout').addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST' }); window.location.reload(); });
document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view, { settingsTab: button.dataset.settingsTab, stockPanel: button.dataset.stockPanel })));
document.querySelectorAll('.settings-tab-button').forEach((button) => button.addEventListener('click', () => setSettingsTab(button.dataset.settingsTab)));
$('#pwa-install-ios')?.addEventListener('click', () => {
  $('#pwa-ios-instructions')?.classList.toggle('hidden');
  updatePwaInstallControls();
});
$('#pwa-enable-push')?.addEventListener('click', () => enableWebPushNotifications());
$('#system-update-button')?.addEventListener('click', () => startSystemUpdate());
$('#mobile-menu-toggle').addEventListener('click', () => setMobileMenuOpen(!$('.sidebar')?.classList.contains('mobile-open')));
$('#mobile-menu-close').addEventListener('click', () => closeMobileMenu());
$('#mobile-menu-backdrop').addEventListener('click', () => closeMobileMenu());
$('#notifications-toggle').addEventListener('click', async () => { const panel = $('#notifications-panel'); const open = panel.classList.toggle('hidden'); $('#notifications-toggle').setAttribute('aria-expanded', String(!open)); if (!open) await loadNotifications(); });
$('#notifications-close').addEventListener('click', () => { $('#notifications-panel').classList.add('hidden'); $('#notifications-toggle').setAttribute('aria-expanded', 'false'); });
$('#enable-browser-notifications').addEventListener('click', () => requestBrowserNotifications());
$('#notifications-read-all').addEventListener('click', async () => { try { await api('/api/notifications/read-all', { method: 'POST' }); await loadNotifications(); } catch (error) { $('#notifications-list').innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; } });
$('#refresh-overview').addEventListener('click', () => loadOverview());
$('#refresh-report').addEventListener('click', () => loadReport());
$('#generate-report').addEventListener('click', () => loadReport());
$('#refresh-compliance-alerts').addEventListener('click', () => loadComplianceAlerts());
$('#refresh-pending').addEventListener('click', () => loadPendingTasks());
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

$('#onboarding-save-signature').addEventListener('click', async () => {
  const message = $('#onboarding-signature-message');
  if (!onboardingSignatureCanvas || !$('#onboarding-signature-confirm').checked) { message.textContent = 'Desenhe sua assinatura e confirme que ela será usada para validar seus registros.'; return; }
  try { await api('/api/onboarding/signature', { method: 'POST', body: JSON.stringify({ signatureData: onboardingSignatureCanvas.toDataURL('image/png'), signatureMode: onboardingSignatureMode, confirmed: true }) }); message.textContent = ''; await loadOnboardingStatus(); } catch (error) { message.textContent = error.message; }
});

$('#onboarding-generate-signature').addEventListener('click', () => {
  const message = $('#onboarding-signature-message');
  try { generateAutomaticSignature(onboardingSignatureCanvas, $('#onboarding-signature-name').value); onboardingSignatureMode = 'nome_digitado'; message.textContent = 'Assinatura gerada. Confira e confirme para salvar.'; } catch (error) { message.textContent = error.message; }
});

$('#onboarding-clear-signature').addEventListener('click', () => { if (onboardingSignatureCanvas) { clearSignatureCanvas(onboardingSignatureCanvas); onboardingSignatureMode = 'desenhada'; } });
$('#security-clear-signature').addEventListener('click', () => { if (securitySignatureCanvas) { clearSignatureCanvas(securitySignatureCanvas); securitySignatureMode = 'desenhada'; } });
$('#security-generate-signature').addEventListener('click', () => {
  const message = $('#security-signature-message');
  try { generateAutomaticSignature(securitySignatureCanvas, $('#security-signature-name').value); securitySignatureMode = 'nome_digitado'; message.textContent = 'Assinatura gerada. Confira e confirme para salvar.'; } catch (error) { message.textContent = error.message; }
});
$('#security-save-signature').addEventListener('click', async () => {
  const message = $('#security-signature-message');
  if (!securitySignatureCanvas || !$('#security-signature-confirm').checked) { message.textContent = 'Desenhe a nova assinatura e confirme o uso dela no SIGOS.'; return; }
  try {
    await api('/api/onboarding/signature', { method: 'POST', body: JSON.stringify({ signatureData: securitySignatureCanvas.toDataURL('image/png'), signatureMode: securitySignatureMode, confirmed: true }) });
    $('#security-signature-confirm').checked = false;
    message.textContent = 'Assinatura padrão atualizada.';
    await loadOnboardingStatus();
  } catch (error) { message.textContent = error.message; }
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

$('#cancel-user-edit')?.addEventListener('click', () => { $('#user-edit-panel')?.classList.add('hidden'); $('#user-edit-message').textContent = ''; });
$('#user-edit-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#user-edit-message');
  try {
    await api(`/api/users/${$('#user-edit-id').value}`, { method: 'PATCH', body: JSON.stringify({ name: $('#user-edit-name').value, email: $('#user-edit-email').value, role: $('#user-edit-role').value, password: $('#user-edit-password').value }) });
    message.textContent = 'Usuário alterado com sucesso.';
    $('#user-edit-password').value = '';
    await loadUsers();
    await loadOverview();
  } catch (error) { message.textContent = error.message; }
});

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

$('#epi-add-process-item').addEventListener('click', () => { if (window.epiWizardSignatureVisible) return; const items = readEpiProcessItems(); items.push({ ppeItemId: '', quantity: 1, condition: 'novo', observation: '' }); epiWizardIndex = items.length - 1; renderEpiProcessItems(items); });
document.querySelectorAll('.epi-process-option').forEach((button) => button.addEventListener('click', () => setEpiProcessType(button.dataset.processType)));
$('#mobile-epi-checklist-close')?.addEventListener('click', () => closeMobileEpiChecklist());
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
  } catch (error) {
    if (error.code === 'DAILY_CHECKLIST_EXISTS' && error.process) {
      renderDailyChecklistGuard(error.process);
      message.textContent = '';
    } else {
      message.textContent = error.message;
    }
  }
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
    if (selectedEpiProcessType === 'checklist_diario') {
      const verificationPhotos = Object.values(epiDailyPhotoDrafts).filter((photo) => epiDailyChecklistItems.find((item) => item.key === photo.itemKey)?.section === 'verificacao');
      await submitEpiProcessPhotos(verificationPhotos, message);
      return;
    }
    $('#epi-photos-step').classList.remove('hidden');
    $('#epi-photos-message').textContent = 'Tire até cinco fotos dos EPIs para concluir.';
  } catch (error) { message.textContent = error.message; }
});

async function submitEpiProcessPhotos(photos, messageElement) {
  if (!currentEpiProcess) return;
  const returnToMobileChecklistList = mobileChecklistActive && mobileChecklistKind === 'epi' && selectedEpiProcessType === 'checklist_diario';
  await requestEpiProcessLocation();
  const data = await api(`/api/epi/processes/${currentEpiProcess.id}/photos`, { method: 'POST', body: JSON.stringify({ photos, deviceInfo: navigator.userAgent, latitude: epiProcessLocation.latitude, longitude: epiProcessLocation.longitude }) });
  currentEpiProcess = data.process;
  const message = messageElement || $('#epi-photos-message');
  message.textContent = 'Processo enviado para validação.';
  $('#epi-process-form-message').textContent = 'Processo enviado para validação.';
  currentEpiProcess = null;
  epiPhotoDrafts = [];
  epiDailyPhotoDrafts = {};
  renderEpiPhotoDrafts();
  $('#epi-selfie-step').classList.add('hidden');
  $('#epi-photos-step').classList.add('hidden');
  $('#epi-process-form').classList.remove('hidden');
  $('#epi-process-form').reset();
  $('#epi-signature-confirm').checked = false;
  if (returnToMobileChecklistList) closeMobileEpiChecklist();
  else setEpiProcessType(selectedEpiProcessType);
  await loadEpiProcesses();
  await loadNotifications();
  await loadOverview();
  if (returnToMobileChecklistList) $('#epi-process-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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
    await submitEpiProcessPhotos(epiPhotoDrafts.map((imageData) => ({ imageData, captureMode: 'camera', latitude: epiProcessLocation.latitude, longitude: epiProcessLocation.longitude })), message);
  } catch (error) { message.textContent = error.message; }
});

$('#vehicle-open-photo-camera').addEventListener('click', () => { $('#vehicle-photo-camera').classList.remove('hidden'); openEpiCamera('#vehicle-photo-video', '#vehicle-photo-message', 'environment'); });
$('#vehicle-cancel-photo').addEventListener('click', () => { stopEpiCamera('#vehicle-photo-video'); $('#vehicle-photo-camera').classList.add('hidden'); });
$('#vehicle-take-photo').addEventListener('click', () => {
  const imageData = captureVideoFrame('#vehicle-photo-video');
  if (!imageData) { $('#vehicle-photo-message').textContent = 'A câmera ainda não está pronta.'; return; }
  if (vehicleExtraPhotoCount() >= 2) { $('#vehicle-photo-message').textContent = 'O limite de duas fotos extras foi atingido.'; return; }
  vehiclePhotoDrafts.push({ imageData, itemKey: null });
  stopEpiCamera('#vehicle-photo-video');
  $('#vehicle-photo-camera').classList.add('hidden');
  renderVehiclePhotoDrafts();
  $('#vehicle-photo-message').textContent = `${vehiclePhotoDrafts.length} foto(s) preparada(s).`;
});

$('#vehicle-checklist-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#vehicle-form-message');
  if (!selectedVehicleChecklistType) { message.textContent = 'Escolha o tipo de checklist antes de enviar.'; return; }
  const finalChecklistType = selectedVehicleChecklistType === 'geral' ? ($('#vehicle-final-purpose')?.value || '') : selectedVehicleChecklistType;
  const dailyPeriod = finalChecklistType === 'diario' ? ($('#vehicle-final-daily-period')?.value || '') : null;
  const targetUserId = ['transferencia', 'recebimento', 'entrega'].includes(finalChecklistType) ? ($('#vehicle-final-target-user')?.value || '') : null;
  if (selectedVehicleChecklistType === 'geral' && !['quinzenal', 'transferencia', 'recebimento', 'entrega'].includes(finalChecklistType)) { message.textContent = 'Escolha a finalidade do Checklist geral.'; return; }
  if (finalChecklistType === 'diario' && !['inicio', 'fim'].includes(dailyPeriod)) { message.textContent = 'Escolha se o checklist diário é do começo ou do fim do dia.'; return; }
  if (['transferencia', 'recebimento', 'entrega'].includes(finalChecklistType) && !targetUserId) { message.textContent = 'Selecione o usuário que receberá o veículo.'; return; }
  if (!currentUser?.signatureData || !$('#vehicle-signature-confirm').checked) { message.textContent = 'Confirme a assinatura padrão cadastrada antes de enviar o checklist.'; return; }
  if (!vehicleSelfieDraft) { message.textContent = 'Capture a selfie pela câmera antes de enviar o checklist.'; return; }
  const missingPhoto = vehicleWizardDraft.find((item) => item.requiresPhoto && !vehiclePhotoDrafts.some((photo) => photo.itemKey === item.itemKey));
  if (missingPhoto) { message.textContent = `Capture a foto obrigatória do item: ${missingPhoto.itemName}.`; return; }
  const returnToMobileVehicleList = mobileChecklistActive && mobileChecklistKind === 'vehicle';
  try {
    await ensureVehicleLocation();
    await api('/api/vehicles/checklists', { method: 'POST', body: JSON.stringify({ checklistType: finalChecklistType, targetUserId, dailyPeriod, plate: $('#vehicle-plate').value, model: $('#vehicle-model').value, vehicleYear: $('#vehicle-year').value, mileage: $('#vehicle-wizard-mileage').value, items: readVehicleEditor(), signatureConfirmed: true, latitude: vehicleSignatureLocation.latitude, longitude: vehicleSignatureLocation.longitude, deviceInfo: navigator.userAgent, selfie: vehicleSelfieDraft, photos: vehiclePhotoDrafts.map((photo) => ({ imageData: photo.imageData, itemKey: photo.itemKey || null, captureMode: 'camera', latitude: vehicleSignatureLocation.latitude, longitude: vehicleSignatureLocation.longitude })) }) });
    const sentType = vehicleChecklistTypeLabel(finalChecklistType);
    const sentMessage = finalChecklistType === 'transferencia' ? `${sentType} enviado. Aguardando assinatura e selfie do destinatário.` : ['recebimento', 'entrega'].includes(finalChecklistType) ? `${sentType} enviado. Aguardando assinatura e selfie do técnico destinatário.` : finalChecklistType === 'diario' ? `${sentType} de ${dailyPeriod === 'inicio' ? 'começo' : 'fim'} do dia enviado para validação.` : `${sentType} e fotos enviados para validação.`;
    if (returnToMobileVehicleList) closeMobileChecklist({ reset: false });
    event.target.reset(); selectedVehicleChecklistType = null; renderVehicleEditor(); setupVehicleTechnicianSignature(); message.textContent = sentMessage; await loadVehicleChecklists(); await loadOverview();
  } catch (error) { message.textContent = error.message; }
});
$('#refresh-vehicle-checklists').addEventListener('click', () => loadVehicleChecklists().catch((error) => { $('#vehicle-tech-list').innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; }));
$('#refresh-validation').addEventListener('click', () => loadValidationQueue().catch((error) => { $('#validation-list').innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; }));
$('#refresh-stock').addEventListener('click', () => loadStock().catch((error) => { $('#stock-vehicles-table').innerHTML = `<tr><td colspan="8" class="error">${escapeHtml(error.message)}</td></tr>`; }));

$('#stock-vehicle-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#stock-vehicle-message');
  try {
    await api('/api/stock/vehicles', { method: 'POST', body: JSON.stringify({ id: $('#stock-vehicle-id').value || null, plate: $('#stock-vehicle-plate').value, model: $('#stock-vehicle-model').value, year: $('#stock-vehicle-year').value, color: $('#stock-vehicle-color').value }) });
    resetStockVehicleForm(); message.textContent = 'Veículo salvo no cadastro.'; await loadStock();
  } catch (error) { message.textContent = error.message; }
});

$('#stock-vehicle-cancel').addEventListener('click', () => { resetStockVehicleForm(); $('#stock-vehicle-message').textContent = ''; });

$('#stock-vehicle-equipment-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#stock-vehicle-equipment-message');
  const vehicleId = $('#stock-vehicle-equipment-vehicle').value;
  if (!vehicleId) { message.textContent = 'Selecione um veículo antes de salvar o equipamento.'; return; }
  try {
    await api(`/api/stock/vehicles/${vehicleId}/equipment`, { method: 'POST', body: JSON.stringify({ id: $('#stock-vehicle-equipment-id').value || null, name: $('#stock-vehicle-equipment-name').value, quantity: $('#stock-vehicle-equipment-quantity').value }) });
    selectedStockVehicleId = vehicleId;
    resetStockVehicleEquipmentForm();
    message.textContent = 'Equipamento do veículo salvo.';
    await loadStock();
  } catch (error) { message.textContent = error.message; }
});

$('#stock-vehicle-equipment-cancel').addEventListener('click', () => { resetStockVehicleEquipmentForm(); $('#stock-vehicle-equipment-message').textContent = ''; });

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
