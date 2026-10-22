const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const PDFDocument = require('pdfkit');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

let firebaseAdmin = null;
let firebaseMessaging = null;
let webPush = null;
const firebaseServiceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '';
if (firebaseServiceAccountPath && fs.existsSync(firebaseServiceAccountPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(firebaseServiceAccountPath, 'utf8'));
    firebaseAdmin = require('firebase-admin');
    const certFactory = firebaseAdmin.cert || firebaseAdmin.credential?.cert;
    if (typeof certFactory !== 'function') throw new Error('A versão instalada do Firebase Admin não expõe o método cert.');
    const firebaseApp = firebaseAdmin.initializeApp({
      credential: certFactory(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    const messagingApi = require('firebase-admin/messaging');
    firebaseMessaging = typeof messagingApi.getMessaging === 'function'
      ? messagingApi.getMessaging(firebaseApp)
      : firebaseAdmin.messaging();
  } catch (error) {
    console.error('Não foi possível inicializar o Firebase Admin:', error.message);
  }
}

const webPushPublicKey = process.env.WEB_PUSH_PUBLIC_KEY || '';
const webPushPrivateKey = process.env.WEB_PUSH_PRIVATE_KEY || '';
const webPushSubject = process.env.WEB_PUSH_SUBJECT || 'mailto:suporte@lvltech.com.br';
if (webPushPublicKey && webPushPrivateKey) {
  try {
    webPush = require('web-push');
    webPush.setVapidDetails(webPushSubject, webPushPublicKey, webPushPrivateKey);
  } catch (error) {
    console.error('Não foi possível inicializar o Web Push:', error.message);
    webPush = null;
  }
}

const app = express();
const port = Number(process.env.PORT || 7000);
const host = process.env.HOST || '127.0.0.1';
const jwtSecret = process.env.JWT_SECRET;
const cookieSecure = String(process.env.COOKIE_SECURE || 'false') === 'true';
const enforceHttps = String(process.env.ENFORCE_HTTPS || 'false') === 'true';
const systemUpdateStatusPath = process.env.SIGOS_UPDATE_STATUS_PATH || '/opt/epi-checklist/.update/status.json';
const systemUpdateCommand = '/usr/local/sbin/sigos-update';
// A sessão precisa sobreviver ao fechamento do navegador e ao uso diário do app.
// O limite de aparelhos continua sendo controlado por session_version: um perfil
// comum mantém uma sessão e o Superadmin mantém as duas mais recentes.
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_DURATION_SECONDS = Math.floor(SESSION_DURATION_MS / 1000);
const SESSION_JWT_DURATION = '30d';

const TERM_LEGAL_TEXT = {
  clt: 'De acordo com o Artigo 158, Parágrafo Único, “b”, da CLT e da Norma Regulamentadora NR 1, a recusa na utilização dos equipamentos descritos neste termo, no todo ou em parte, constitui ATO FALTOSO sujeitando o funcionário às penalidades previstas na lei.',
  nr06: 'De acordo com a portaria nº 3.214 do Ministério do Trabalho, N. R. 06 subitem 6.6.1 “Cabe ao Trabalhador, quanto ao EPI: a) usar o fornecido pela organização; b) utilizar apenas para a finalidade a que se destina; c) responsabilizar-se pela limpeza, guarda e conservação; e, d) comunicar à organização quando extraviado, danificado ou qualquer alteração que o torne impróprio para uso; e) cumprir as determinações da organização sobre o uso adequado.”',
  declaration: 'Declaro que fui plenamente orientado quanto aos procedimentos de segurança do trabalho, estando ciente dos riscos decorrentes da atividade e das sanções disciplinares a que estou sujeito quanto ao seu descumprimento.',
  version: 'modelo-fornecido-pelo-cliente-1',
};

const EPI_PROCESS_LEGAL_TEXT = {
  devolucao: {
    title: 'TERMO DE DEVOLUÇÃO DE EPI',
    version: 'epi-devolucao-1',
    paragraphs: [
      'Declaro que estou devolvendo à empresa os equipamentos de proteção individual registrados neste processo, informando sua condição no momento da devolução.',
      'Comprometo-me a comunicar qualquer dano, inutilização ou extravio identificado e reconheço que a conferência será feita pelo responsável indicado no processo.',
    ],
  },
  checklist_diario: {
    title: 'CHECKLIST DIÁRIO DE EPI',
    version: 'epi-checklist-diario-1',
    paragraphs: [
      'Declaro que realizei, nesta data, a verificação dos EPIs e itens de segurança indicados neste checklist antes do início da atividade.',
      'As respostas registradas correspondem à situação encontrada no momento da conferência. Itens ausentes ou não conformes devem ser comunicados e regularizados antes do início da atividade.',
    ],
  },
  transferencia: {
    title: 'TERMO DE TRANSFERÊNCIA DE EPI',
    version: 'epi-transferencia-1',
    paragraphs: [
      'Declaro que os equipamentos registrados neste processo estão sendo transferidos para o usuário indicado, que deverá mantê-los em perfeito estado de conservação e utilizá-los exclusivamente para sua finalidade.',
      'A transferência será considerada concluída após a validação do destinatário indicado e ficará registrada com data, hora, dispositivo, IP e demais dados de auditoria disponíveis.',
    ],
  },
};

const EPI_DAILY_CHECKLIST_ITEMS = [
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

const EPI_DAILY_CHECKLIST_BY_KEY = new Map(EPI_DAILY_CHECKLIST_ITEMS.map((item) => [item.key, item]));

async function getDailyEpiChecklistDefinitions(db = pool) {
  const catalog = await db.query(
    `SELECT id, name, ca
     FROM ppe_items
     WHERE active = TRUE
     ORDER BY name ASC, id ASC`,
  );
  const catalogItems = catalog.rows.map((row) => ({
    key: `ppe_catalog_${row.id}`,
    section: 'verificacao',
    label: row.name,
    ppeItemId: Number(row.id),
    ca: row.ca || '',
  }));
  return [...catalogItems, ...EPI_DAILY_CHECKLIST_ITEMS.filter((item) => item.section === 'inspecao')];
}

function epiDailyResponseLabel(value) {
  return ({ sim: 'Sim', nao: 'Não', na: 'N/A' }[String(value || '').toLowerCase()] || '–');
}

function epiProcessTermObservation(process, item) {
  const baseObservation = String(item?.observation || '').trim();
  const isFinalValidatedChecklist = process?.process_type === 'checklist_diario'
    && process?.admin_attention_required === true
    && process?.attention_status === 'resolved'
    && process?.status === 'validado';
  if (!isFinalValidatedChecklist) return baseObservation;

  const reasons = Array.isArray(process.admin_attention_reasons) ? process.admin_attention_reasons : [];
  const itemReasons = reasons.filter((reason) => (
    String(reason.itemKey || '') === String(item.itemKey || '')
    || (!reason.itemKey && String(reason.equipmentName || '') === String(item.equipmentName || ''))
  ));
  if (!itemReasons.length) return baseObservation;

  const annotations = [];
  if (itemReasons.some((reason) => reason.type === 'negative_inspection')) {
    annotations.push(String(item.condition || '').toLowerCase() === 'sim'
      ? 'Resposta inicial: Não; problema reportado solucionado após correção.'
      : 'Resposta inicial: Não; correção registrada no processo.');
  }
  if (itemReasons.some((reason) => reason.type === 'replacement_request')) {
    annotations.push(item.replacementEffective === true && String(item.condition || '').toLowerCase() === 'sim'
      ? 'Avaria reportada; troca efetivada e problema solucionado.'
      : 'Avaria reportada; troca registrada no processo.');
  }
  return [...new Set([baseObservation, ...annotations].filter(Boolean))].join(' · ');
}

const EPI_PROCESS_TYPES = Object.keys(EPI_PROCESS_LEGAL_TEXT);

const VEHICLE_TERM_INTRO = 'Declaro estar ciente das regras de uso, conservação e responsabilidade aplicáveis ao veículo da empresa, comprometendo-me a utilizá-lo exclusivamente em serviço e a comunicar imediatamente qualquer dano, avaria ou irregularidade identificada.';
const VEHICLE_TERM_CLAUSES = [
  'É proibido utilizar o veículo para fins pessoais ou para qualquer finalidade estranha ao serviço.',
  'É proibido transportar pessoas, objetos ou equipamentos sem vínculo com a empresa.',
  'É obrigatório utilizar os equipamentos de proteção individual e coletiva, além dos itens de segurança exigidos pela legislação de trânsito.',
  'A velocidade e a condução devem respeitar os limites e todas as imposições da legislação de trânsito.',
  'As multas e os danos causados por mau uso ou má condução serão de responsabilidade do motorista, observados os parâmetros legais.',
  'O motorista deve manter o veículo limpo, acondicionar corretamente os materiais e informar imediatamente qualquer sintoma, sinal de dano ou avaria ao responsável pelo setor.',
  'O descumprimento destes procedimentos poderá resultar na aplicação das penalidades cabíveis.',
  'Declaro estar ciente de que os veículos podem ser monitorados por GPS e possuir sistema interno de gravação de câmeras.',
];

const DEFAULT_COMPANY_SETTINGS = {
  tradeName: process.env.DEFAULT_COMPANY_TRADE_NAME || 'Empresa SIGOS',
  legalName: process.env.DEFAULT_COMPANY_LEGAL_NAME || 'Empresa SIGOS',
  cnpj: process.env.DEFAULT_COMPANY_CNPJ || '',
  phone: '',
  email: '',
  responsibleName: '',
  website: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
};

const COMPANY_REQUIRED_FIELDS = ['trade_name', 'legal_name', 'cnpj', 'phone', 'email', 'responsible_name'];

const DEFAULT_PPE_CATALOG = [
  { code: 'CA-41001', name: 'CAMISA RETARDANTE A CHAMAS', ca: '41001', category: 'Vestimenta' },
  { code: 'CA-41000', name: 'CALÇA RETARDANTE A CHAMAS', ca: '41000', category: 'Vestimenta' },
  { code: 'CA-40872', name: 'BOTINA AMARRAR BI 3 GOMOS', ca: '40872', category: 'Calçado' },
  { code: 'CA-25883', name: 'CAPACETE ABA TOTAL', ca: '25883', category: 'Proteção da cabeça' },
  { code: 'CA-32034', name: 'LUVA DE NYLON', ca: '32034', category: 'Proteção das mãos' },
  { code: 'CA-35520', name: 'CINTURÃO PQD ABD REGULAGEM TOTAL', ca: '35520', category: 'Trabalho em altura' },
  { code: 'CA-42716', name: 'ÓCULOS MINOTOURO FUMÊ', ca: '42716', category: 'Proteção dos olhos' },
  { code: 'CA-15835-15837', name: 'TALABARTE (P) CORDA INOX', ca: '15835/15837', category: 'Trabalho em altura' },
  { code: 'CHECKLIST-PPE-01', name: 'CAPACETE DE SEGURANÇA COM JUGULAR', ca: '', category: 'Proteção da cabeça' },
  { code: 'CHECKLIST-PPE-02', name: 'ÓCULOS DE SEGURANÇA', ca: '', category: 'Proteção dos olhos' },
  { code: 'CHECKLIST-PPE-03', name: 'LUVAS DE PROTEÇÃO CONTRA RISCOS MECÂNICOS', ca: '', category: 'Proteção das mãos' },
  { code: 'CHECKLIST-PPE-04', name: 'CALÇADO DE SEGURANÇA', ca: '', category: 'Calçado' },
  { code: 'CHECKLIST-PPE-05', name: 'COLETE/VESTIMENTA DE ALTA VISIBILIDADE, QUANDO APLICÁVEL', ca: '', category: 'Vestimenta' },
  { code: 'CHECKLIST-PPE-06', name: 'PROTETOR AURICULAR, QUANDO HOUVER EXPOSIÇÃO A RUÍDO', ca: '', category: 'Proteção auditiva' },
  { code: 'CHECKLIST-PPE-07', name: 'CINTURÃO DE SEGURANÇA TIPO PARAQUEDISTA - TRABALHO EM ALTURA', ca: '', category: 'Trabalho em altura' },
  { code: 'CHECKLIST-PPE-08', name: 'TALABARTE DUPLO COM ABSORVEDOR DE ENERGIA, QUANDO APLICÁVEL', ca: '', category: 'Trabalho em altura' },
  { code: 'CHECKLIST-PPE-09', name: 'TRAVA-QUEDAS, QUANDO APLICÁVEL', ca: '', category: 'Trabalho em altura' },
  { code: 'CHECKLIST-PPE-10', name: 'MOSQUETÕES/CONECTORES SEM DEFORMAÇÕES OU DANOS', ca: '', category: 'Trabalho em altura' },
  { code: 'CHECKLIST-PPE-11', name: 'LUVA ISOLANTE ADEQUADA AO RISCO ELÉTRICO, QUANDO APLICÁVEL', ca: '', category: 'Proteção das mãos' },
  { code: 'CHECKLIST-PPE-12', name: 'LUVA DE COBERTURA DA LUVA ISOLANTE, QUANDO APLICÁVEL', ca: '', category: 'Proteção das mãos' },
  { code: 'CHECKLIST-PPE-13', name: 'VESTIMENTA ADEQUADA AO RISCO ELÉTRICO, QUANDO APLICÁVEL', ca: '', category: 'Risco elétrico' },
  { code: 'CHECKLIST-PPE-14', name: 'PROTETOR FACIAL, QUANDO HOUVER RISCO DE ARCO/PROJEÇÃO', ca: '', category: 'Proteção facial' },
];

const VEHICLE_CHECKLIST_ITEMS = [
  ['vidro_eletrico', 'VIDRO ELÉTRICO'],
  ['trava_eletrica', 'TRAVA ELÉTRICA'],
  ['retrovisor_esquerdo', 'RETROVISOR ESQUERDO'],
  ['retrovisor_direito', 'RETROVISOR DIREITO'],
  ['ar_condicionado', 'AR-CONDICIONADO'],
  ['buzina', 'BUZINA'],
  ['lanterna', 'LANTERNA'],
  ['luz_alta', 'LUZ ALTA'],
  ['luz_auxiliar', 'LUZ AUXILIAR'],
  ['pisca_alerta', 'PISCA-ALERTA'],
  ['seta_dianteira_esquerda', 'SETA DIANTEIRA ESQUERDA'],
  ['seta_dianteira_direita', 'SETA DIANTEIRA DIREITA'],
  ['seta_traseira_esquerda', 'SETA TRASEIRA ESQUERDA'],
  ['seta_traseira_direita', 'SETA TRASEIRA DIREITA'],
  ['luz_freio', 'LUZ DE FREIO'],
  ['luz_re', 'LUZ DE RÉ'],
  ['limpador_parabrisa', 'LIMPADOR DE PARA-BRISA'],
  ['painel', 'PAINEL'],
  ['luz_painel', 'LUZ DO PAINEL'],
  ['alarme', 'ALARME'],
  ['chave', 'CHAVE'],
  ['freio_mao', 'FREIO DE MÃO'],
  ['antena', 'ANTENA'],
  ['som', 'SOM'],
  ['volante_freio', 'VOLANTE / FREIO'],
  ['quebra_sol_esquerdo', 'QUEBRA-SOL ESQUERDO'],
  ['quebra_sol_direito', 'QUEBRA-SOL DIREITO'],
  ['farol_dianteiro_esquerdo', 'FAROL DIANTEIRO ESQUERDO'],
  ['farol_dianteiro_direito', 'FAROL DIANTEIRO DIREITO'],
  ['banco', 'BANCO'],
  ['cambio', 'CÂMBIO'],
];

const VEHICLE_DAILY_CHECKLIST_ITEMS = [
  ['esquerda', 'LADO ESQUERDO'],
  ['direita', 'LADO DIREITO'],
  ['frente', 'FRENTE'],
  ['traseira', 'TRASEIRA'],
  ['interna', 'PARTE INTERNA'],
];

// Fotos continuam obrigatórias para os itens visuais. Estes itens funcionais
// podem ser fotografados como evidência, mas não bloqueiam o envio do geral.
const VEHICLE_OPTIONAL_PHOTO_ITEM_KEYS = new Set([
  'vidro_eletrico', 'trava_eletrica', 'ar_condicionado', 'buzina',
  'lanterna', 'luz_alta', 'luz_auxiliar', 'pisca_alerta',
  'seta_dianteira_esquerda', 'seta_dianteira_direita',
  'seta_traseira_esquerda', 'seta_traseira_direita',
  'luz_freio', 'luz_re', 'limpador_parabrisa', 'painel', 'luz_painel',
  'alarme', 'chave', 'freio_mao', 'som', 'volante_freio', 'cambio',
]);

if (!process.env.DATABASE_URL || !jwtSecret) {
  throw new Error('DATABASE_URL e JWT_SECRET são obrigatórios.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

const apkPath = process.env.SIGOS_APK_PATH || path.join(__dirname, 'releases', 'sigos.apk');
const selfieStoragePath = process.env.SIGOS_SELFIE_PATH || path.join(__dirname, 'storage', 'selfies');

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"],
      formAction: ["'self'"],
    },
  },
  hsts: cookieSecure ? undefined : false,
}));
app.use(express.json({ limit: '20mb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  if (!enforceHttps || req.path === '/api/health') return next();
  if (requestScheme(req) === 'https') return next();
  return res.status(403).json({ error: 'Acesso permitido somente via HTTPS.' });
});

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || null;
}

function requestScheme(req) {
  const cloudflareVisitor = req.headers['cf-visitor'];
  if (typeof cloudflareVisitor === 'string') {
    try {
      const parsed = JSON.parse(cloudflareVisitor);
      if (parsed.scheme) return String(parsed.scheme).toLowerCase();
    } catch {
      // Continue with the standard proxy header.
    }
  }
  const forwarded = req.headers['x-forwarded-proto'];
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim().toLowerCase();
  return req.protocol;
}

function createRateLimiter({ windowMs, max, keyGenerator, message }) {
  const buckets = new Map();
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, Math.min(windowMs, 60_000));
  cleanupTimer.unref?.();

  return (req, res, next) => {
    const key = String(keyGenerator(req) || 'unknown');
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(remaining));
    if (bucket.count > max) {
      res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    return next();
  };
}

const loginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${clientIp(req) || 'unknown'}:${String(req.body?.email || '').trim().toLowerCase()}`,
  message: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
});

const uploadRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id ? `user:${req.user.id}` : `ip:${clientIp(req) || 'unknown'}`,
  message: 'Muitas operações de upload. Aguarde alguns minutos e tente novamente.',
});

function isSuperadminRole(role) {
  return role === 'superadmin';
}

function isAdminRole(role) {
  return role === 'admin' || isSuperadminRole(role);
}

// Supervisors keep the legacy database value `vistoriador` for compatibility
// with existing accounts, but have the same checklist validation proof
// requirements as administrators.
function isChecklistValidatorRole(role) {
  return isAdminRole(role) || role === 'vistoriador';
}

function reportDateRange(period, requestedDate) {
  const todayParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const todayKey = `${todayParts.find((part) => part.type === 'year')?.value}-${todayParts.find((part) => part.type === 'month')?.value}-${todayParts.find((part) => part.type === 'day')?.value}`;
  const dateKey = String(requestedDate || todayKey).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const reference = new Date(Date.UTC(year, month - 1, day, 12));
  if (reference.getUTCFullYear() !== year || reference.getUTCMonth() !== month - 1 || reference.getUTCDate() !== day) return null;

  const normalizedPeriod = ['diario', 'semanal', 'mensal'].includes(period) ? period : null;
  if (!normalizedPeriod) return null;
  const start = new Date(reference);
  if (normalizedPeriod === 'semanal') {
    const dayOfWeek = start.getUTCDay() || 7;
    start.setUTCDate(start.getUTCDate() - dayOfWeek + 1);
  } else if (normalizedPeriod === 'mensal') {
    start.setUTCDate(1);
  }
  const end = new Date(start);
  if (normalizedPeriod === 'diario') end.setUTCDate(end.getUTCDate() + 1);
  if (normalizedPeriod === 'semanal') end.setUTCDate(end.getUTCDate() + 7);
  if (normalizedPeriod === 'mensal') end.setUTCMonth(end.getUTCMonth() + 1);
  const toDateKey = (value) => `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  const inclusiveEnd = new Date(end);
  inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() - 1);
  return {
    period: normalizedPeriod,
    referenceDate: dateKey,
    startDate: toDateKey(start),
    endDate: toDateKey(inclusiveEnd),
    endDateExclusive: toDateKey(end),
  };
}

function publicUser(row, { companyProfileComplete = null } = {}) {
  if (!row) return null;
  const superadmin = isSuperadminRole(row.role);
  const requiresDataConsent = !superadmin && ['admin', 'tecnico', 'vistoriador'].includes(row.role);
  const signatureUserOnboardingComplete = superadmin || (!row.must_change_password
    && Boolean(row.signature_data)
    && (!requiresDataConsent || (Boolean(row.consent_at)
      && row.consent_location === true && row.consent_ip === true && row.consent_image === true)));
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
    deactivatedAt: row.deactivated_at || null,
    createdAt: row.created_at,
    mustChangePassword: !superadmin && ['tecnico', 'vistoriador'].includes(row.role) && Boolean(row.must_change_password),
    signatureRegistered: Boolean(row.signature_data),
    signatureMode: row.signature_mode || 'desenhada',
    consentRegistered: superadmin || !requiresDataConsent || (Boolean(row.consent_at)
      && row.consent_location === true && row.consent_ip === true && row.consent_image === true),
    onboardingComplete: signatureUserOnboardingComplete,
    companyProfileComplete: superadmin ? true : row.role === 'admin' ? companyProfileComplete : true,
    systemProtected: superadmin,
  };
}

function isCompanyProfileComplete(row) {
  return Boolean(row) && COMPANY_REQUIRED_FIELDS.every((field) => String(row[field] || '').trim())
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email || '').trim());
}

function publicCompanySettings(row) {
  return {
    id: row?.id || null,
    tradeName: row?.trade_name ?? DEFAULT_COMPANY_SETTINGS.tradeName,
    legalName: row?.legal_name ?? DEFAULT_COMPANY_SETTINGS.legalName,
    cnpj: row?.cnpj ?? DEFAULT_COMPANY_SETTINGS.cnpj,
    phone: row?.phone ?? DEFAULT_COMPANY_SETTINGS.phone,
    email: row?.email ?? DEFAULT_COMPANY_SETTINGS.email,
    responsibleName: row?.responsible_name ?? DEFAULT_COMPANY_SETTINGS.responsibleName,
    website: row?.website ?? DEFAULT_COMPANY_SETTINGS.website,
    address: row?.address ?? DEFAULT_COMPANY_SETTINGS.address,
    city: row?.city ?? DEFAULT_COMPANY_SETTINGS.city,
    state: row?.state ?? DEFAULT_COMPANY_SETTINGS.state,
    zipCode: row?.zip_code ?? DEFAULT_COMPANY_SETTINGS.zipCode,
    logoData: row?.logo_data ?? null,
    logoMimeType: row?.logo_mime_type ?? null,
    configured: isCompanyProfileComplete(row),
    updatedAt: row?.updated_at || null,
  };
}

async function getCompanySettings() {
  const result = await pool.query('SELECT * FROM company_settings WHERE id = 1');
  return result.rows[0] || null;
}

function isTechnicianOnboardingComplete(user) {
  if (isSuperadminRole(user.role)) return true;
  const requiresDataConsent = ['admin', 'tecnico', 'vistoriador'].includes(user.role);
  return !user.must_change_password
    && Boolean(user.signature_data)
    && (!requiresDataConsent || (Boolean(user.consent_at)
      && user.consent_location === true && user.consent_ip === true && user.consent_image === true));
}

async function audit({ req, actorUserId = null, eventType, entityType = null, entityId = null, metadata = {} }) {
  await pool.query(
    `INSERT INTO audit_logs
      (actor_user_id, event_type, entity_type, entity_id, ip_address, user_agent, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [actorUserId, eventType, entityType, entityId, clientIp(req), req.get('user-agent') || null, metadata],
  );
}

async function notifyRoles({ roles, notificationType, title, message, entityType = null, entityId = null, metadata = {} }) {
  const expandedRoles = [...new Set((roles || []).flatMap((role) => role === 'admin' ? ['admin', 'superadmin'] : [role]))];
  const result = await pool.query(
    `INSERT INTO notifications
      (user_id, notification_type, title, message, entity_type, entity_id, metadata)
     SELECT id, $2, $3, $4, $5, $6, $7
     FROM users
     WHERE active = TRUE AND role = ANY($1::text[])
     RETURNING user_id`,
    [expandedRoles, notificationType, title, message, entityType, entityId === null || entityId === undefined ? null : String(entityId), metadata],
  );
  await sendPushNotifications({
    userIds: result.rows.map((row) => row.user_id),
    title,
    message,
    data: { notificationType, entityType, entityId },
  });
}

async function notifyUsers({ userIds, notificationType, title, message, entityType = null, entityId = null, metadata = {} }) {
  const ids = [...new Set((userIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return;
  const result = await pool.query(
    `INSERT INTO notifications
      (user_id, notification_type, title, message, entity_type, entity_id, metadata)
     SELECT id, $2, $3, $4, $5, $6, $7
     FROM users
     WHERE active = TRUE AND id = ANY($1::bigint[])
     RETURNING user_id`,
    [ids, notificationType, title, message, entityType, entityId === null || entityId === undefined ? null : String(entityId), metadata],
  );
  await sendPushNotifications({
    userIds: result.rows.map((row) => row.user_id),
    title,
    message,
    data: { notificationType, entityType, entityId },
  });
}

async function ensureComplianceAlert({ alertKey, alertType, periodKey, subjectType, subjectId, subjectLabel, title, message, metadata = {}, notifyUserId = null, notifyUserTitle = 'Checklist diário pendente', notifyUserMessage = 'Você ainda não enviou o checklist diário de EPI de hoje.' }) {
  const result = await pool.query(
    `INSERT INTO compliance_alerts
      (alert_key, alert_type, period_key, subject_type, subject_id, subject_label, title, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (alert_key) DO NOTHING
     RETURNING alert_key`,
    [alertKey, alertType, periodKey, subjectType, subjectId, subjectLabel, title, message],
  );
  if (!result.rowCount) return false;
  const notificationMetadata = { ...metadata, alertKey, alertType, periodKey, subjectType, subjectId: String(subjectId), subjectLabel };
  await notifyRoles({ roles: ['admin'], notificationType: alertType, title, message, entityType: 'compliance_alert', entityId: alertKey, metadata: notificationMetadata });
  if (notifyUserId) {
    await notifyUsers({
      userIds: [notifyUserId],
      notificationType: alertType,
      title: notifyUserTitle,
      message: notifyUserMessage,
      entityType: 'compliance_alert',
      entityId: alertKey,
      metadata: notificationMetadata,
    });
  }
  return true;
}

async function seedLegacyDailyComplianceAlert() {
  await pool.query(
    `INSERT INTO compliance_alerts
      (alert_key, alert_type, period_key, subject_type, subject_id, subject_label, title, message)
     SELECT
       'epi-daily:' || to_char(r.reminder_date, 'YYYY-MM-DD') || ':technician:' || r.user_id,
       'epi_daily_missing',
       to_char(r.reminder_date, 'YYYY-MM-DD'),
       'tecnico', r.user_id, u.name,
       'Checklist diário pendente',
       'O técnico ' || u.name || ' ainda não enviou o checklist diário de EPI de hoje.'
     FROM daily_checklist_reminders r
     JOIN users u ON u.id = r.user_id
     WHERE r.reminder_date = timezone('America/Fortaleza', NOW())::date
       AND NOT EXISTS (
         SELECT 1 FROM compliance_alerts a
         WHERE a.alert_key = 'epi-daily:' || to_char(r.reminder_date, 'YYYY-MM-DD') || ':technician:' || r.user_id
       )
     ON CONFLICT (alert_key) DO NOTHING`,
  );
}

async function resolveCompletedComplianceAlerts() {
  await pool.query(
    `UPDATE compliance_alerts a
     SET status = 'resolvido', updated_at = NOW()
     WHERE a.status = 'aberto'
       AND a.alert_type = 'epi_daily_missing'
       AND EXISTS (
         SELECT 1
         FROM epi_processes p
         WHERE p.created_by = a.subject_id
           AND p.process_type = 'checklist_diario'
           AND p.submitted_at IS NOT NULL
           AND timezone('America/Fortaleza', p.submitted_at)::date = a.period_key::date
       )`,
  );
  await pool.query(
    `UPDATE compliance_alerts a
     SET status = 'resolvido', updated_at = NOW()
     WHERE a.status = 'aberto'
       AND a.alert_type = 'vehicle_daily_missing_end'
       AND EXISTS (
         SELECT 1
         FROM vehicle_checklists vc
         WHERE vc.checklist_type = 'diario'
           AND vc.daily_period = 'fim'
           AND vc.driver_user_id = a.subject_id
           AND vc.submitted_at IS NOT NULL
           AND timezone('America/Fortaleza', vc.submitted_at)::date = a.period_key::date
           AND a.alert_key = 'vehicle-daily-end:' || a.period_key || ':vehicle:' || vc.vehicle_id || ':user:' || vc.driver_user_id
       )`,
  );
  await pool.query(
    `WITH local_clock AS (
       SELECT timezone('America/Fortaleza', NOW())::date AS local_date
     ), counts AS (
       SELECT v.id AS vehicle_id, COUNT(vc.id)::int AS quinzenal_count
       FROM vehicles v
       CROSS JOIN local_clock clock
       LEFT JOIN vehicle_checklists vc
         ON (vc.vehicle_id = v.id OR (vc.vehicle_id IS NULL AND vc.plate = v.plate))
        AND vc.checklist_type = 'quinzenal'
        AND vc.submitted_at IS NOT NULL
        AND timezone('America/Fortaleza', vc.submitted_at)::date >= date_trunc('month', clock.local_date)::date
        AND timezone('America/Fortaleza', vc.submitted_at)::date < (date_trunc('month', clock.local_date) + INTERVAL '1 month')::date
       WHERE v.status = 'ativo'
       GROUP BY v.id
     )
     UPDATE compliance_alerts a
     SET status = 'resolvido', updated_at = NOW()
     FROM counts
     WHERE a.status = 'aberto'
       AND a.subject_type = 'veiculo'
       AND a.subject_id = counts.vehicle_id
       AND a.period_key = to_char(timezone('America/Fortaleza', NOW())::date, 'YYYY-MM')
       AND ((a.alert_type = 'vehicle_fortnightly_first' AND counts.quinzenal_count >= 1)
         OR (a.alert_type = 'vehicle_fortnightly_month_end' AND counts.quinzenal_count >= 2))`,
  );
}

async function claimDailyChecklistReminder({ reminderKey, technicianId, reminderDate, reminderTime }) {
  const result = await pool.query(
    `INSERT INTO daily_checklist_reminder_dispatches
      (reminder_key, user_id, reminder_date, reminder_time)
     VALUES ($1, $2, $3::date, $4)
     ON CONFLICT (reminder_key) DO NOTHING
     RETURNING reminder_key`,
    [reminderKey, technicianId, reminderDate, reminderTime],
  );
  return result.rowCount > 0;
}

async function checkDailyChecklistReminders() {
  const daily = await pool.query(
    `WITH local_clock AS (
       SELECT timezone('America/Fortaleza', NOW()) AS local_now,
              timezone('America/Fortaleza', NOW())::date AS local_date
     ), reminder_slots(reminder_time, reminder_label) AS (
       VALUES (TIME '09:00', '09'), (TIME '16:00', '16')
     )
     SELECT u.id AS technician_id, u.name,
            to_char(clock.local_date, 'YYYY-MM-DD') AS period_key,
            reminder.reminder_label
     FROM users u
     CROSS JOIN local_clock clock
     CROSS JOIN reminder_slots reminder
     WHERE u.active = TRUE
       AND u.role = 'tecnico'
       AND clock.local_now >= clock.local_date + reminder.reminder_time
       AND timezone('America/Fortaleza', u.created_at) < clock.local_date + reminder.reminder_time
       AND NOT EXISTS (
         SELECT 1 FROM epi_processes p
         WHERE p.created_by = u.id
           AND p.process_type = 'checklist_diario'
           AND p.submitted_at IS NOT NULL
           AND timezone('America/Fortaleza', p.submitted_at)::date = clock.local_date
       )
       AND (reminder.reminder_label = '16' OR NOT EXISTS (
         SELECT 1 FROM compliance_alerts a
         WHERE a.alert_key = 'epi-daily:' || to_char(clock.local_date, 'YYYY-MM-DD') || ':technician:' || u.id
       ))
     ORDER BY reminder.reminder_label`,
  );

  for (const row of daily.rows) {
    const alertKey = `epi-daily:${row.period_key}:technician:${row.technician_id}`;
    const reminderTime = row.reminder_label === '09' ? '09:00' : '16:00';
    const message = `O técnico ${row.name} ainda não enviou o checklist diário de EPI de hoje.`;
    const created = await ensureComplianceAlert({
      alertKey,
      alertType: 'epi_daily_missing',
      periodKey: row.period_key,
      subjectType: 'tecnico',
      subjectId: row.technician_id,
      subjectLabel: row.name,
      title: 'Checklist diário pendente',
      message,
      metadata: { technicianId: String(row.technician_id), reminderDate: row.period_key, reminderTime },
      notifyUserId: row.technician_id,
    });
    if (created) {
      await pool.query('INSERT INTO daily_checklist_reminders (user_id, reminder_date) VALUES ($1, $2::date) ON CONFLICT (user_id, reminder_date) DO NOTHING', [row.technician_id, row.period_key]);
      if (row.reminder_label === '16') await claimDailyChecklistReminder({ reminderKey: `${alertKey}:16`, technicianId: row.technician_id, reminderDate: row.period_key, reminderTime });
    }
    if (!created && row.reminder_label === '16') {
      const alert = await pool.query('SELECT status FROM compliance_alerts WHERE alert_key = $1', [alertKey]);
      const shouldNotify = alert.rows[0]?.status === 'aberto';
      const reminderKey = `${alertKey}:16`;
      if (shouldNotify && await claimDailyChecklistReminder({ reminderKey, technicianId: row.technician_id, reminderDate: row.period_key, reminderTime })) {
        const notificationMetadata = { technicianId: String(row.technician_id), reminderDate: row.period_key, reminderTime, alertKey, alertType: 'epi_daily_missing', periodKey: row.period_key, subjectType: 'tecnico', subjectId: String(row.technician_id), subjectLabel: row.name };
        await notifyRoles({ roles: ['admin'], notificationType: 'epi_daily_missing', title: 'Segundo lembrete: checklist diário pendente', message, entityType: 'compliance_alert', entityId: alertKey, metadata: notificationMetadata });
        await notifyUsers({ userIds: [row.technician_id], notificationType: 'epi_daily_missing', title: 'Checklist diário ainda pendente', message: 'Você ainda não enviou o checklist diário de EPI de hoje.', entityType: 'compliance_alert', entityId: alertKey, metadata: notificationMetadata });
      }
    }
  }

  const vehicleDailyEnd = await pool.query(
    `WITH local_clock AS (
       SELECT timezone('America/Fortaleza', NOW()) AS local_now,
              timezone('America/Fortaleza', NOW())::date AS local_date
     ), morning AS (
       SELECT DISTINCT ON (vc.vehicle_id, vc.driver_user_id)
              vc.vehicle_id, vc.driver_user_id, vc.plate, vc.model,
              u.name AS driver_name, clock.local_date
       FROM vehicle_checklists vc
       JOIN users u ON u.id = vc.driver_user_id AND u.active = TRUE
       CROSS JOIN local_clock clock
       WHERE vc.checklist_type = 'diario'
         AND vc.daily_period = 'inicio'
         AND vc.submitted_at IS NOT NULL
         AND timezone('America/Fortaleza', vc.submitted_at)::date = clock.local_date
         AND clock.local_now >= clock.local_date + TIME '18:00'
       ORDER BY vc.vehicle_id, vc.driver_user_id, vc.submitted_at DESC
     )
     SELECT morning.*
     FROM morning
     WHERE NOT EXISTS (
       SELECT 1
       FROM vehicle_checklists vc_end
       CROSS JOIN local_clock clock
       WHERE vc_end.vehicle_id = morning.vehicle_id
         AND vc_end.driver_user_id = morning.driver_user_id
         AND vc_end.checklist_type = 'diario'
         AND vc_end.daily_period = 'fim'
         AND vc_end.submitted_at IS NOT NULL
         AND timezone('America/Fortaleza', vc_end.submitted_at)::date = clock.local_date
     )
     ORDER BY morning.driver_name, morning.plate`,
  );

  for (const row of vehicleDailyEnd.rows) {
    const periodKey = String(row.local_date).slice(0, 10);
    const alertKey = `vehicle-daily-end:${periodKey}:vehicle:${row.vehicle_id}:user:${row.driver_user_id}`;
    const subjectLabel = `${row.driver_name} · ${row.plate}${row.model ? ` · ${row.model}` : ''}`;
    await ensureComplianceAlert({
      alertKey,
      alertType: 'vehicle_daily_missing_end',
      periodKey,
      subjectType: 'tecnico',
      subjectId: row.driver_user_id,
      subjectLabel,
      title: 'Segundo checklist diário de veículo pendente',
      message: `O usuário ${row.driver_name} fez o checklist de começo do dia do veículo ${row.plate}, mas ainda não registrou o checklist de fim do dia até 18:00.`,
      metadata: { vehicleId: String(row.vehicle_id), plate: row.plate, driverId: String(row.driver_user_id), dailyPeriod: 'fim', deadline: '18:00' },
      notifyUserId: row.driver_user_id,
      notifyUserTitle: 'Checklist de fim do dia pendente',
      notifyUserMessage: `O checklist de fim do dia do veículo ${row.plate} ainda não foi registrado. O Admin também foi notificado.`,
    });
  }

  const vehicles = await pool.query(
    `WITH local_clock AS (
       SELECT timezone('America/Fortaleza', NOW()) AS local_now,
              timezone('America/Fortaleza', NOW())::date AS local_date,
              date_trunc('month', timezone('America/Fortaleza', NOW())::date)::date AS month_start,
              (date_trunc('month', timezone('America/Fortaleza', NOW())::date) + INTERVAL '1 month - 1 day')::date AS month_end
     ), counts AS (
       SELECT v.id AS vehicle_id, v.plate, v.model,
              clock.local_now, clock.local_date, clock.month_end,
              COUNT(vc.id)::int AS quinzenal_count
       FROM vehicles v
       CROSS JOIN local_clock clock
       LEFT JOIN vehicle_checklists vc
         ON (vc.vehicle_id = v.id OR (vc.vehicle_id IS NULL AND vc.plate = v.plate))
        AND vc.checklist_type = 'quinzenal'
        AND vc.submitted_at IS NOT NULL
        AND timezone('America/Fortaleza', vc.submitted_at)::date >= clock.month_start
        AND timezone('America/Fortaleza', vc.submitted_at)::date < (clock.month_end + 1)
       WHERE v.status = 'ativo'
       GROUP BY v.id, v.plate, v.model, clock.local_now, clock.local_date, clock.month_end
     )
     SELECT vehicle_id, plate, model, local_date, month_end,
            to_char(local_date, 'YYYY-MM-DD') AS local_date_key,
            to_char(month_end, 'YYYY-MM-DD') AS month_end_key,
            quinzenal_count,
            to_char(local_date, 'YYYY-MM') AS period_key,
            EXTRACT(DAY FROM local_date)::int AS local_day
     FROM counts
     WHERE local_now >= local_date + TIME '12:00'
       AND ((local_date < month_end AND EXTRACT(DAY FROM local_date) >= 16 AND quinzenal_count < 1)
         OR (local_date = month_end AND quinzenal_count < 2))`,
  );

  for (const row of vehicles.rows) {
    const localDate = row.local_date_key;
    const monthEnd = row.month_end_key;
    const subjectLabel = `${row.plate}${row.model ? ` · ${row.model}` : ''}`;
    if (localDate < monthEnd && row.local_day >= 16 && Number(row.quinzenal_count) < 1) {
      const alertKey = `vehicle-quinzenal-first:${row.period_key}:vehicle:${row.vehicle_id}`;
      await ensureComplianceAlert({
        alertKey,
        alertType: 'vehicle_fortnightly_first',
        periodKey: row.period_key,
        subjectType: 'veiculo',
        subjectId: row.vehicle_id,
        subjectLabel,
        title: 'Checklist recorrente de veículo pendente',
        message: `O veículo ${subjectLabel} ainda não possui checklist recorrente neste mês até o dia 16.`,
        metadata: { vehicleId: String(row.vehicle_id), plate: row.plate, checklistCount: Number(row.quinzenal_count), deadline: '16' },
      });
    }
    if (localDate === monthEnd && Number(row.quinzenal_count) < 2) {
      const alertKey = `vehicle-quinzenal-month-end:${row.period_key}:vehicle:${row.vehicle_id}`;
      await ensureComplianceAlert({
        alertKey,
        alertType: 'vehicle_fortnightly_month_end',
        periodKey: row.period_key,
        subjectType: 'veiculo',
        subjectId: row.vehicle_id,
        subjectLabel,
        title: 'Checklist recorrente de veículo incompleto',
        message: `O veículo ${subjectLabel} encerrou o mês com ${Number(row.quinzenal_count)} checklist(s) recorrente(s); eram necessários dois.`,
        metadata: { vehicleId: String(row.vehicle_id), plate: row.plate, checklistCount: Number(row.quinzenal_count), deadline: 'último dia do mês' },
      });
    }
  }
  await resolveCompletedComplianceAlerts();
}

async function sendNativePush({ userIds, title, message, data = {} }) {
  if (!firebaseMessaging || !userIds?.length) return;
  try {
    const result = await pool.query(
      `SELECT DISTINCT token
       FROM push_devices
       WHERE active = TRUE AND user_id = ANY($1::bigint[])`,
      [userIds],
    );
    const tokens = result.rows.map((row) => row.token).filter(Boolean);
    if (!tokens.length) return;
    const payload = {
      tokens,
      notification: { title, body: message },
      data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value ?? '')])),
      android: { priority: 'high', notification: { channelId: 'sigos_default' } },
    };
    const response = await firebaseMessaging.sendEachForMulticast(payload);
    const invalidTokens = response.responses
      .map((item, index) => (!item.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(item.error?.code) ? tokens[index] : null))
      .filter(Boolean);
    if (invalidTokens.length) {
      await pool.query('UPDATE push_devices SET active = FALSE, updated_at = NOW() WHERE token = ANY($1::text[])', [invalidTokens]);
    }
  } catch (error) {
    console.error('Falha no envio de push FCM:', error.message);
  }
}

async function sendWebPush({ userIds, title, message, data = {} }) {
  if (!webPush || !userIds?.length) return;
  const ids = [...new Set(userIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return;
  const result = await pool.query(
    `SELECT endpoint, p256dh, auth
     FROM web_push_subscriptions
     WHERE active = TRUE AND user_id = ANY($1::bigint[])`,
    [ids],
  );
  if (!result.rows.length) return;
  const payload = JSON.stringify({
    title,
    body: message,
    icon: '/assets/sigos-symbol.png',
    badge: '/assets/sigos-symbol.png',
    data: { ...data, url: '/' },
  });
  await Promise.all(result.rows.map(async (subscription) => {
    try {
      await webPush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, payload);
    } catch (error) {
      if ([404, 410].includes(Number(error.statusCode))) {
        await pool.query('UPDATE web_push_subscriptions SET active = FALSE, updated_at = NOW() WHERE endpoint = $1', [subscription.endpoint]);
      } else {
        console.error('Falha no envio de Web Push:', error.message);
      }
    }
  }));
}

async function sendPushNotifications(args) {
  await Promise.allSettled([sendNativePush(args), sendWebPush(args)]);
}

function publicNotification(row) {
  return {
    id: row.id,
    notificationType: row.notification_type,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata || {},
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function complianceAlertDisplayTitle(alertType, fallbackTitle) {
  return alertType === 'vehicle_fortnightly_first'
    ? 'Checklist recorrente de veículo pendente'
    : alertType === 'vehicle_fortnightly_month_end'
      ? 'Checklist recorrente de veículo incompleto'
      : fallbackTitle;
}

function complianceAlertDisplayMessage(alertType, fallbackMessage) {
  if (!['vehicle_fortnightly_first', 'vehicle_fortnightly_month_end'].includes(alertType)) return fallbackMessage;
  return String(fallbackMessage || '')
    .replaceAll('checklist(s) quinzenal(is)', 'checklist(s) recorrente(s)')
    .replaceAll('checklist quinzenal', 'checklist recorrente');
}

function publicComplianceAlert(row) {
  return {
    alertKey: row.alert_key,
    alertType: row.alert_type,
    periodKey: row.period_key,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    subjectLabel: row.subject_label,
    title: complianceAlertDisplayTitle(row.alert_type, row.title),
    message: complianceAlertDisplayMessage(row.alert_type, row.message),
    status: row.status,
    justification: row.justification || null,
    justifiedBy: row.justified_by || null,
    justifiedByName: row.justified_by_name || null,
    justifiedAt: row.justified_at || null,
    createdAt: row.created_at,
    activeTask: row.pending_task_id ? {
      id: row.pending_task_id,
      assignedTo: row.pending_task_assigned_to,
      assignedToName: row.pending_task_assigned_to_name,
      assignedAt: row.pending_task_assigned_at,
      status: row.pending_task_status,
    } : null,
  };
}

function publicPendingTask(row) {
  return {
    id: row.id,
    alertKey: row.alert_key,
    title: complianceAlertDisplayTitle(row.alert_type, row.alert_title),
    message: complianceAlertDisplayMessage(row.alert_type, row.alert_message),
    alertType: row.alert_type,
    periodKey: row.period_key,
    subjectLabel: row.subject_label,
    instruction: row.instruction,
    status: row.status,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name,
    assignedBy: row.assigned_by,
    assignedByName: row.assigned_by_name,
    assignedAt: row.assigned_at,
    completedAt: row.completed_at,
    completionNote: row.completion_note || null,
  };
}

function signSession(user) {
  return jwt.sign({
    sub: String(user.id),
    role: user.role,
    name: user.name,
    sessionVersion: Number(user.session_version),
  }, jwtSecret, { expiresIn: SESSION_JWT_DURATION });
}

async function advanceSession(userId) {
  const result = await pool.query(
    `UPDATE users
     SET session_version = session_version + 1, updated_at = NOW()
     WHERE id = $1 AND active = TRUE
     RETURNING *`,
    [userId],
  );
  return result.rows[0] || null;
}

async function auth(req, res, next) {
  try {
    const authorization = String(req.headers.authorization || '');
    const bearer = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : null;
    const token = req.cookies.session || bearer;
    if (!token) return res.status(401).json({ error: 'Não autenticado.' });
    const payload = jwt.verify(token, jwtSecret);
    const result = await pool.query(
      `SELECT id, name, email, role, active, created_at,
              session_version,
              must_change_password, signature_data, signature_hash, signature_mode,
              consent_location, consent_ip, consent_image, consent_at,
              consent_ip_address, consent_user_agent, consent_latitude, consent_longitude
       FROM users WHERE id = $1`,
      [payload.sub],
    );
    const user = result.rows[0];
    if (!user || !user.active) return res.status(401).json({ error: 'Usuário inativo ou inexistente.' });
    const currentSessionVersion = Number(user.session_version);
    const tokenSessionVersion = Number(payload.sessionVersion);
    const superadminSessionValid = isSuperadminRole(user.role)
      && tokenSessionVersion >= Math.max(1, currentSessionVersion - 1)
      && tokenSessionVersion <= currentSessionVersion;
    if (tokenSessionVersion !== currentSessionVersion && !superadminSessionValid) {
      return res.status(401).json({ error: 'Sua sessão foi encerrada porque este usuário entrou em outro aparelho.' });
    }
    req.user = user;
    req.companySettings = isAdminRole(user.role) ? await getCompanySettings() : null;
    req.companyProfileComplete = user.role !== 'admin' || isCompanyProfileComplete(req.companySettings);
    const onboardingPath = req.path === '/api/me' || req.path.startsWith('/api/onboarding') || req.path.startsWith('/api/company') || req.path === '/api/auth/logout' || req.path === '/api/auth/change-password';
    if (!isTechnicianOnboardingComplete(user) && !onboardingPath) {
      return res.status(428).json({ code: 'ONBOARDING_REQUIRED', error: 'Conclua o primeiro acesso antes de utilizar o SIGOS.' });
    }
    if (user.role === 'admin' && !req.companyProfileComplete && !onboardingPath) {
      return res.status(428).json({ code: 'COMPANY_PROFILE_REQUIRED', error: 'Cadastre os dados da empresa antes de utilizar o SIGOS.' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.some((role) => req.user.role === role || (role === 'admin' && isSuperadminRole(req.user.role)))) {
      return res.status(403).json({ error: 'Você não possui permissão para esta operação.' });
    }
    next();
  };
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function readSystemUpdateStatus() {
  try {
    const status = JSON.parse(fs.readFileSync(systemUpdateStatusPath, 'utf8'));
    return status && typeof status === 'object' ? status : { status: 'not_configured' };
  } catch {
    return { status: 'not_configured', message: 'O atualizador ainda não foi configurado neste servidor.' };
  }
}

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'superadmin', 'tecnico', 'vistoriador')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
    UPDATE users SET deactivated_at = COALESCE(deactivated_at, updated_at, created_at, NOW()) WHERE active = FALSE AND deactivated_at IS NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version BIGINT NOT NULL DEFAULT 1;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_data TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_hash TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_mode TEXT NOT NULL DEFAULT 'desenhada';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_registered_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_location BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_ip BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_image BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_ip_address INET;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_user_agent TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_latitude NUMERIC(9, 6);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_longitude NUMERIC(9, 6);
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'superadmin', 'tecnico', 'vistoriador'));

    CREATE TABLE IF NOT EXISTS company_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      trade_name TEXT NOT NULL DEFAULT '',
      legal_name TEXT NOT NULL DEFAULT '',
      cnpj TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      responsible_name TEXT NOT NULL DEFAULT '',
      website TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip_code TEXT,
      logo_data TEXT,
      logo_mime_type TEXT,
      logo_updated_at TIMESTAMPTZ,
      updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS logo_data TEXT;
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS logo_mime_type TEXT;
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS logo_updated_at TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      ip_address INET,
      user_agent TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);
    CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_user_id);

    CREATE TABLE IF NOT EXISTS selfie_uploads (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      device_info TEXT,
      ip_address INET,
      user_agent TEXT,
      latitude NUMERIC(9, 6),
      longitude NUMERIC(9, 6),
      location_label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE selfie_uploads ADD COLUMN IF NOT EXISTS ip_address INET;
    ALTER TABLE selfie_uploads ADD COLUMN IF NOT EXISTS user_agent TEXT;
    ALTER TABLE selfie_uploads ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6);
    ALTER TABLE selfie_uploads ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);
    ALTER TABLE selfie_uploads ADD COLUMN IF NOT EXISTS location_label TEXT;

    CREATE INDEX IF NOT EXISTS selfie_uploads_user_created_idx ON selfie_uploads (user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      notification_type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, read_at, created_at DESC);

    CREATE TABLE IF NOT EXISTS daily_checklist_reminders (
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reminder_date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, reminder_date)
    );

    CREATE TABLE IF NOT EXISTS daily_checklist_reminder_dispatches (
      reminder_key TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reminder_date DATE NOT NULL,
      reminder_time TEXT NOT NULL CHECK (reminder_time IN ('09:00', '16:00')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS compliance_alerts (
      alert_key TEXT PRIMARY KEY,
      alert_type TEXT NOT NULL,
      period_key TEXT NOT NULL,
      subject_type TEXT NOT NULL CHECK (subject_type IN ('tecnico', 'veiculo')),
      subject_id BIGINT NOT NULL,
      subject_label TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'justificado', 'resolvido')),
      justification TEXT,
      justified_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      justified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE compliance_alerts DROP CONSTRAINT IF EXISTS compliance_alerts_status_check;
    ALTER TABLE compliance_alerts ADD CONSTRAINT compliance_alerts_status_check CHECK (status IN ('aberto', 'justificado', 'resolvido'));

    CREATE INDEX IF NOT EXISTS compliance_alerts_status_created_idx ON compliance_alerts (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS compliance_alerts_subject_idx ON compliance_alerts (subject_type, subject_id, period_key);

    CREATE TABLE IF NOT EXISTS compliance_pending_tasks (
      id BIGSERIAL PRIMARY KEY,
      alert_key TEXT NOT NULL REFERENCES compliance_alerts(alert_key) ON DELETE CASCADE,
      assigned_to BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      instruction TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluida', 'cancelada')),
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      completed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      completion_note TEXT
    );

    ALTER TABLE compliance_pending_tasks DROP CONSTRAINT IF EXISTS compliance_pending_tasks_status_check;
    ALTER TABLE compliance_pending_tasks ADD CONSTRAINT compliance_pending_tasks_status_check CHECK (status IN ('pendente', 'concluida', 'cancelada'));
    CREATE INDEX IF NOT EXISTS compliance_pending_tasks_assignee_idx ON compliance_pending_tasks (assigned_to, status, assigned_at DESC);
    CREATE INDEX IF NOT EXISTS compliance_pending_tasks_alert_idx ON compliance_pending_tasks (alert_key, assigned_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS compliance_pending_tasks_open_alert_idx ON compliance_pending_tasks (alert_key) WHERE status = 'pendente';

    CREATE TABLE IF NOT EXISTS push_devices (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL DEFAULT 'android',
      device_info TEXT,
      ip_address INET,
      user_agent TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS push_devices_user_active_idx ON push_devices (user_id, active);

    CREATE TABLE IF NOT EXISTS web_push_subscriptions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      device_info TEXT,
      user_agent TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS web_push_subscriptions_user_active_idx ON web_push_subscriptions (user_id, active);

    CREATE TABLE IF NOT EXISTS vehicles (
      id BIGSERIAL PRIMARY KEY,
      plate TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'ativo',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model TEXT;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_year INTEGER;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS color TEXT;

    CREATE TABLE IF NOT EXISTS vehicle_equipment (
      id BIGSERIAL PRIMARY KEY,
      vehicle_id BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (vehicle_id, name)
    );

    CREATE INDEX IF NOT EXISTS vehicle_equipment_vehicle_idx ON vehicle_equipment (vehicle_id, active, name);

    CREATE TABLE IF NOT EXISTS ppe_items (
      id BIGSERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      minimum_stock INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE ppe_items ADD COLUMN IF NOT EXISTS ca TEXT;
    ALTER TABLE ppe_items ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
    UPDATE ppe_items SET deactivated_at = COALESCE(deactivated_at, created_at, NOW()) WHERE active = FALSE AND deactivated_at IS NULL;

    ${DEFAULT_PPE_CATALOG.map((item) => `
      INSERT INTO ppe_items (code, name, ca, category, stock_quantity, minimum_stock, active)
      VALUES (${sqlLiteral(item.code)}, ${sqlLiteral(item.name)}, ${sqlLiteral(item.ca)}, ${sqlLiteral(item.category)}, 0, 0, TRUE)
      ON CONFLICT (code) DO NOTHING;
    `).join('')}

    CREATE TABLE IF NOT EXISTS checklist_templates (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS inspections (
      id BIGSERIAL PRIMARY KEY,
      template_id BIGINT REFERENCES checklist_templates(id) ON DELETE SET NULL,
      vehicle_id BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
      technician_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      inspector_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'rascunho',
      signature_status TEXT NOT NULL DEFAULT 'pendente',
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS epi_terms (
      id BIGSERIAL PRIMARY KEY,
      recipient_name TEXT NOT NULL,
      recipient_role TEXT,
      company_name TEXT NOT NULL DEFAULT 'Empresa SIGOS',
      company_cnpj TEXT NOT NULL DEFAULT '',
      company_logo_data TEXT,
      company_logo_mime_type TEXT,
      status TEXT NOT NULL DEFAULT 'pendente_assinatura'
        CHECK (status IN ('rascunho', 'pendente_assinatura', 'assinado', 'devolvido', 'cancelado')),
      legal_version TEXT NOT NULL DEFAULT 'modelo-fornecido-pelo-cliente-1',
      created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      signer_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      signed_at TIMESTAMPTZ,
      signer_ip INET,
      signer_user_agent TEXT,
      signer_device TEXT,
      signer_latitude NUMERIC(9, 6),
      signer_longitude NUMERIC(9, 6),
      signature_method TEXT,
      signature_hash TEXT,
      signature_data TEXT,
      signer_typed_name TEXT,
      signature_version INTEGER NOT NULL DEFAULT 1,
      document_hash TEXT,
      signature_validated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS epi_term_items (
      id BIGSERIAL PRIMARY KEY,
      term_id BIGINT NOT NULL REFERENCES epi_terms(id) ON DELETE CASCADE,
      equipment_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      ca TEXT,
      condition TEXT NOT NULL DEFAULT 'novo',
      observation TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE epi_term_items ADD COLUMN IF NOT EXISTS ppe_item_id BIGINT REFERENCES ppe_items(id) ON DELETE SET NULL;
    ALTER TABLE epi_terms ADD COLUMN IF NOT EXISTS signer_typed_name TEXT;
    ALTER TABLE epi_terms ADD COLUMN IF NOT EXISTS signature_version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE epi_terms ADD COLUMN IF NOT EXISTS document_hash TEXT;
    ALTER TABLE epi_terms ADD COLUMN IF NOT EXISTS signature_validated_at TIMESTAMPTZ;
    ALTER TABLE epi_terms ADD COLUMN IF NOT EXISTS company_logo_data TEXT;
    ALTER TABLE epi_terms ADD COLUMN IF NOT EXISTS company_logo_mime_type TEXT;

    CREATE INDEX IF NOT EXISTS epi_terms_created_at_idx ON epi_terms (created_at DESC);
    CREATE INDEX IF NOT EXISTS epi_terms_status_idx ON epi_terms (status);
    CREATE INDEX IF NOT EXISTS epi_term_items_term_idx ON epi_term_items (term_id);
    CREATE INDEX IF NOT EXISTS epi_term_items_ppe_idx ON epi_term_items (ppe_item_id);

    CREATE TABLE IF NOT EXISTS epi_processes (
      id BIGSERIAL PRIMARY KEY,
      process_type TEXT NOT NULL CHECK (process_type IN ('devolucao', 'checklist_diario', 'transferencia')),
      created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      validator_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      target_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      source_term_id BIGINT REFERENCES epi_terms(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'aguarda_selfie',
      term_version TEXT NOT NULL,
      company_logo_data TEXT,
      company_logo_mime_type TEXT,
      signature_validated_at TIMESTAMPTZ,
      signer_signature_hash TEXT,
      signature_document_hash TEXT,
      signature_hash TEXT,
      submitted_at TIMESTAMPTZ,
      admin_attention_required BOOLEAN NOT NULL DEFAULT FALSE,
      admin_attention_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
      attention_status TEXT NOT NULL DEFAULT 'none',
      attention_correction_permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
      attention_revision INTEGER NOT NULL DEFAULT 0,
      attention_sent_back_at TIMESTAMPTZ,
      attention_sent_back_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      attention_returned_at TIMESTAMPTZ,
      attention_returned_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      attention_confirmed_at TIMESTAMPTZ,
      attention_confirmed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      attention_document_hash TEXT,
      attention_signature_hash TEXT,
      validated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      validated_at TIMESTAMPTZ,
      validation_notes TEXT,
      validation_signature_data TEXT,
      validation_signature_hash TEXT,
      validation_signature_typed_name TEXT,
      validation_signature_document_hash TEXT,
      validation_signature_validated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS epi_process_items (
      id BIGSERIAL PRIMARY KEY,
      process_id BIGINT NOT NULL REFERENCES epi_processes(id) ON DELETE CASCADE,
      ppe_item_id BIGINT REFERENCES ppe_items(id) ON DELETE SET NULL,
      equipment_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      ca TEXT,
      condition TEXT,
      observation TEXT,
      item_key TEXT,
      section TEXT,
      replacement_effective BOOLEAN NOT NULL DEFAULT FALSE,
      replacement_effective_at TIMESTAMPTZ,
      replacement_effective_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE epi_process_items ADD COLUMN IF NOT EXISTS ppe_item_id BIGINT REFERENCES ppe_items(id) ON DELETE SET NULL;
    ALTER TABLE epi_process_items ADD COLUMN IF NOT EXISTS item_key TEXT;
    ALTER TABLE epi_process_items ADD COLUMN IF NOT EXISTS section TEXT;
    ALTER TABLE epi_process_items ADD COLUMN IF NOT EXISTS replacement_requested BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE epi_process_items ADD COLUMN IF NOT EXISTS replacement_effective BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE epi_process_items ADD COLUMN IF NOT EXISTS replacement_effective_at TIMESTAMPTZ;
    ALTER TABLE epi_process_items ADD COLUMN IF NOT EXISTS replacement_effective_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS company_logo_data TEXT;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS company_logo_mime_type TEXT;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS admin_attention_required BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS admin_attention_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS attention_status TEXT NOT NULL DEFAULT 'none';
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS attention_correction_permissions JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS attention_revision INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS attention_sent_back_at TIMESTAMPTZ;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS attention_sent_back_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS attention_returned_at TIMESTAMPTZ;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS attention_returned_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS attention_confirmed_at TIMESTAMPTZ;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS attention_confirmed_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS attention_document_hash TEXT;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS attention_signature_hash TEXT;
    UPDATE epi_processes SET attention_status = 'pending_admin' WHERE admin_attention_required = TRUE AND status = 'pendente_validacao' AND attention_status = 'none';
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS validation_signature_data TEXT;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS validation_signature_hash TEXT;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS validation_signature_typed_name TEXT;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS validation_signature_document_hash TEXT;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS validation_signature_validated_at TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS epi_process_media (
      id BIGSERIAL PRIMARY KEY,
      process_id BIGINT NOT NULL REFERENCES epi_processes(id) ON DELETE CASCADE,
      uploaded_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      kind TEXT NOT NULL CHECK (kind IN ('selfie', 'epi_photo')),
      capture_context TEXT NOT NULL DEFAULT 'original',
      item_key TEXT,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      device_info TEXT,
      ip_address INET,
      user_agent TEXT,
      latitude NUMERIC(9, 6),
      longitude NUMERIC(9, 6),
      location_label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE epi_process_media ADD COLUMN IF NOT EXISTS ip_address INET;
    ALTER TABLE epi_process_media ADD COLUMN IF NOT EXISTS item_key TEXT;
    ALTER TABLE epi_process_media ADD COLUMN IF NOT EXISTS user_agent TEXT;
    ALTER TABLE epi_process_media ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6);
    ALTER TABLE epi_process_media ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);
    ALTER TABLE epi_process_media ADD COLUMN IF NOT EXISTS location_label TEXT;
    ALTER TABLE epi_process_media ADD COLUMN IF NOT EXISTS capture_context TEXT NOT NULL DEFAULT 'original';

    CREATE INDEX IF NOT EXISTS epi_processes_created_at_idx ON epi_processes (created_at DESC);
    CREATE INDEX IF NOT EXISTS epi_processes_created_by_idx ON epi_processes (created_by, created_at DESC);
    CREATE INDEX IF NOT EXISTS epi_processes_validator_idx ON epi_processes (validator_user_id, status);
    CREATE INDEX IF NOT EXISTS epi_process_items_process_idx ON epi_process_items (process_id);
    CREATE INDEX IF NOT EXISTS epi_process_media_process_idx ON epi_process_media (process_id, kind, created_at);

    CREATE TABLE IF NOT EXISTS ppe_stock_movements (
      id BIGSERIAL PRIMARY KEY,
      ppe_item_id BIGINT NOT NULL REFERENCES ppe_items(id) ON DELETE RESTRICT,
      movement_type TEXT NOT NULL CHECK (movement_type IN ('entrada', 'saida', 'transferencia', 'devolucao', 'ajuste_saida')),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      from_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      to_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      process_id BIGINT REFERENCES epi_processes(id) ON DELETE SET NULL,
      term_id BIGINT REFERENCES epi_terms(id) ON DELETE SET NULL,
      created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      reference_key TEXT NOT NULL UNIQUE,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (movement_type <> 'transferencia' OR (from_user_id IS NOT NULL AND to_user_id IS NOT NULL AND from_user_id <> to_user_id)),
      CHECK (movement_type <> 'devolucao' OR (from_user_id IS NOT NULL AND to_user_id IS NULL)),
      CHECK (movement_type <> 'saida' OR (from_user_id IS NULL AND to_user_id IS NOT NULL)),
      CHECK (movement_type NOT IN ('entrada', 'ajuste_saida') OR (from_user_id IS NULL AND to_user_id IS NULL))
    );

    CREATE INDEX IF NOT EXISTS ppe_stock_movements_ppe_idx ON ppe_stock_movements (ppe_item_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS ppe_stock_movements_users_idx ON ppe_stock_movements (from_user_id, to_user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS ppe_stock_movements_process_idx ON ppe_stock_movements (process_id);
    CREATE INDEX IF NOT EXISTS ppe_stock_movements_term_idx ON ppe_stock_movements (term_id);

    CREATE TABLE IF NOT EXISTS app_migrations (
      migration_key TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vehicle_checklists (
      id BIGSERIAL PRIMARY KEY,
      vehicle_id BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
      driver_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      inspector_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      plate TEXT NOT NULL,
      model TEXT,
      vehicle_year INTEGER,
      mileage INTEGER,
      status TEXT NOT NULL DEFAULT 'pendente_validacao'
        CHECK (status IN ('rascunho', 'pendente_destinatario', 'pendente_validacao', 'validado', 'reprovado')),
      validation_notes TEXT,
      target_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      submitted_at TIMESTAMPTZ,
      validated_at TIMESTAMPTZ
    );

    ALTER TABLE vehicle_checklists ADD COLUMN IF NOT EXISTS checklist_type TEXT NOT NULL DEFAULT 'quinzenal';
    ALTER TABLE vehicle_checklists ADD COLUMN IF NOT EXISTS target_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE vehicle_checklists ADD COLUMN IF NOT EXISTS daily_period TEXT;
    ALTER TABLE vehicle_checklists DROP CONSTRAINT IF EXISTS vehicle_checklists_status_check;
    ALTER TABLE vehicle_checklists ADD CONSTRAINT vehicle_checklists_status_check CHECK (status IN ('rascunho', 'pendente_destinatario', 'pendente_validacao', 'validado', 'reprovado'));
    ALTER TABLE vehicle_checklists DROP CONSTRAINT IF EXISTS vehicle_checklists_checklist_type_check;
    ALTER TABLE vehicle_checklists ADD CONSTRAINT vehicle_checklists_checklist_type_check CHECK (checklist_type IN ('diario', 'quinzenal', 'transferencia', 'recebimento', 'devolucao', 'entrega'));
    ALTER TABLE vehicle_checklists DROP CONSTRAINT IF EXISTS vehicle_checklists_daily_period_check;
    ALTER TABLE vehicle_checklists ADD CONSTRAINT vehicle_checklists_daily_period_check CHECK (daily_period IS NULL OR daily_period IN ('inicio', 'fim'));

    CREATE TABLE IF NOT EXISTS vehicle_checklist_items (
      id BIGSERIAL PRIMARY KEY,
      checklist_id BIGINT NOT NULL REFERENCES vehicle_checklists(id) ON DELETE CASCADE,
      item_key TEXT NOT NULL,
      item_name TEXT NOT NULL,
      item_kind TEXT NOT NULL DEFAULT 'vehicle_item',
      expected_quantity INTEGER,
      before_status TEXT NOT NULL DEFAULT 'ok' CHECK (before_status IN ('ok', 'defeito', 'quebrado')),
      before_description TEXT,
      after_status TEXT NOT NULL DEFAULT 'ok' CHECK (after_status IN ('ok', 'defeito', 'quebrado')),
      after_description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE vehicle_checklist_items ADD COLUMN IF NOT EXISTS item_kind TEXT NOT NULL DEFAULT 'vehicle_item';
    ALTER TABLE vehicle_checklist_items ADD COLUMN IF NOT EXISTS expected_quantity INTEGER;
    ALTER TABLE vehicle_checklist_items DROP CONSTRAINT IF EXISTS vehicle_checklist_items_item_kind_check;
    ALTER TABLE vehicle_checklist_items ADD CONSTRAINT vehicle_checklist_items_item_kind_check CHECK (item_kind IN ('vehicle_item', 'daily_photo', 'vehicle_equipment'));

    CREATE TABLE IF NOT EXISTS vehicle_checklist_signatures (
      id BIGSERIAL PRIMARY KEY,
      checklist_id BIGINT NOT NULL REFERENCES vehicle_checklists(id) ON DELETE CASCADE,
      signer_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      signer_role TEXT NOT NULL CHECK (signer_role IN ('tecnico', 'vistoriador')),
      typed_name TEXT NOT NULL,
      signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      signer_ip INET,
      signer_user_agent TEXT,
      signer_device TEXT,
      signer_latitude NUMERIC(9, 6),
      signer_longitude NUMERIC(9, 6),
      signature_method TEXT NOT NULL,
      signature_hash TEXT NOT NULL,
      document_hash TEXT NOT NULL,
      signature_version INTEGER NOT NULL DEFAULT 2,
      signature_data TEXT NOT NULL,
      signature_context JSONB NOT NULL DEFAULT '{}'::jsonb,
      validated_at TIMESTAMPTZ,
      UNIQUE (checklist_id, signer_role)
    );

    ALTER TABLE vehicle_checklist_signatures DROP CONSTRAINT IF EXISTS vehicle_checklist_signatures_signer_role_check;
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_checklist_signatures_signer_role_check'
      ) THEN
        ALTER TABLE vehicle_checklist_signatures ADD CONSTRAINT vehicle_checklist_signatures_signer_role_check CHECK (signer_role IN ('tecnico', 'vistoriador', 'admin'));
      END IF;
    END $$;

    ALTER TABLE vehicle_checklist_signatures DROP CONSTRAINT IF EXISTS vehicle_checklist_signatures_checklist_id_signer_role_key;

    CREATE TABLE IF NOT EXISTS vehicle_checklist_media (
      id BIGSERIAL PRIMARY KEY,
      checklist_id BIGINT NOT NULL REFERENCES vehicle_checklists(id) ON DELETE CASCADE,
      uploaded_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      device_info TEXT,
      ip_address INET,
      user_agent TEXT,
      latitude NUMERIC(9, 6),
      longitude NUMERIC(9, 6),
      location_label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE vehicle_checklist_media ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'vehicle_photo';
    ALTER TABLE vehicle_checklist_media ADD COLUMN IF NOT EXISTS item_key TEXT;
    ALTER TABLE vehicle_checklist_media ADD COLUMN IF NOT EXISTS capture_context TEXT NOT NULL DEFAULT 'original';

    CREATE INDEX IF NOT EXISTS vehicle_checklist_signatures_checklist_idx ON vehicle_checklist_signatures (checklist_id);
    CREATE INDEX IF NOT EXISTS vehicle_checklist_media_checklist_idx ON vehicle_checklist_media (checklist_id, created_at);

    CREATE INDEX IF NOT EXISTS vehicle_checklists_created_at_idx ON vehicle_checklists (created_at DESC);
    CREATE INDEX IF NOT EXISTS vehicle_checklists_status_idx ON vehicle_checklists (status);
    CREATE INDEX IF NOT EXISTS vehicle_checklists_driver_idx ON vehicle_checklists (driver_user_id);
    CREATE INDEX IF NOT EXISTS vehicle_checklists_daily_period_idx ON vehicle_checklists (vehicle_id, driver_user_id, daily_period, submitted_at DESC);
    CREATE INDEX IF NOT EXISTS vehicle_checklist_items_checklist_idx ON vehicle_checklist_items (checklist_id);

    CREATE TABLE IF NOT EXISTS vehicle_integrity_actions (
      id BIGSERIAL PRIMARY KEY,
      vehicle_id BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
      checklist_id BIGINT NOT NULL REFERENCES vehicle_checklists(id) ON DELETE CASCADE,
      item_key TEXT NOT NULL,
      item_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'corrigida', 'cancelada')),
      assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
      assigned_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      instruction TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      corrected_at TIMESTAMPTZ,
      corrected_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      correction_note TEXT
    );
    CREATE INDEX IF NOT EXISTS vehicle_integrity_actions_checklist_idx ON vehicle_integrity_actions (checklist_id, item_key, created_at DESC);
    CREATE INDEX IF NOT EXISTS vehicle_integrity_actions_assignee_idx ON vehicle_integrity_actions (assigned_to, status, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS vehicle_integrity_actions_open_item_idx ON vehicle_integrity_actions (checklist_id, item_key) WHERE status = 'pendente';
  `);
}

class StockConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StockConflictError';
    this.statusCode = 409;
  }
}

async function lockPpeItem(client, ppeItemId) {
  const result = await client.query(
    'SELECT id, name, stock_quantity FROM ppe_items WHERE id = $1 FOR UPDATE',
    [ppeItemId],
  );
  if (!result.rows[0]) throw new StockConflictError('O EPI informado não existe mais no estoque.');
  return result.rows[0];
}

async function getUserPpeHoldings(client, userId) {
  const result = await client.query(
    `SELECT ppe_item_id, SUM(delta)::int AS quantity
     FROM (
       SELECT ppe_item_id, quantity AS delta
       FROM ppe_stock_movements
       WHERE to_user_id = $1
       UNION ALL
       SELECT ppe_item_id, -quantity AS delta
       FROM ppe_stock_movements
       WHERE from_user_id = $1
     ) movements
     GROUP BY ppe_item_id
     HAVING SUM(delta) > 0`,
    [userId],
  );
  return new Map(result.rows.map((row) => [Number(row.ppe_item_id), Number(row.quantity)]));
}

async function getAssignedQuantity(client, ppeItemId) {
  const result = await client.query(
    `SELECT COALESCE(SUM(delta), 0)::int AS quantity
     FROM (
       SELECT quantity AS delta
       FROM ppe_stock_movements
       WHERE ppe_item_id = $1 AND to_user_id IS NOT NULL
       UNION ALL
       SELECT -quantity AS delta
       FROM ppe_stock_movements
       WHERE ppe_item_id = $1 AND from_user_id IS NOT NULL
     ) movements`,
    [ppeItemId],
  );
  return Number(result.rows[0]?.quantity || 0);
}

async function getAvailableQuantity(client, ppeItemId) {
  const item = await lockPpeItem(client, ppeItemId);
  const assigned = await getAssignedQuantity(client, ppeItemId);
  return { total: Number(item.stock_quantity || 0), assigned, available: Number(item.stock_quantity || 0) - assigned };
}

async function ensureAvailableQuantity(client, ppeItemId, quantity) {
  const balance = await getAvailableQuantity(client, ppeItemId);
  if (quantity > balance.available) {
    throw new StockConflictError(`Estoque insuficiente para ${balance.available < 0 ? 'regularizar ' : ''}o EPI #${ppeItemId}. Disponível: ${balance.available}.`);
  }
  return balance;
}

async function insertPpeStockMovement(client, {
  ppeItemId,
  movementType,
  quantity,
  fromUserId = null,
  toUserId = null,
  processId = null,
  termId = null,
  createdBy = null,
  referenceKey,
  notes = null,
}) {
  if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) return null;
  const result = await client.query(
    `INSERT INTO ppe_stock_movements
      (ppe_item_id, movement_type, quantity, from_user_id, to_user_id, process_id, term_id, created_by, reference_key, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (reference_key) DO NOTHING
     RETURNING id`,
    [ppeItemId, movementType, Number(quantity), fromUserId, toUserId, processId, termId, createdBy, referenceKey, notes],
  );
  return result.rows[0] || null;
}

async function requestedStockItems(client, row) {
  const items = new Map();
  const needsCatalogLookup = (row.items || []).some((item) => !Number.isInteger(Number(item.ppeItemId)) || Number(item.ppeItemId) < 1);
  const catalog = needsCatalogLookup
    ? (await client.query('SELECT id, name, ca FROM ppe_items')).rows
    : [];
  const catalogByName = new Map(catalog.map((item) => [String(item.name || '').trim().toLowerCase(), item]));
  const catalogByCa = new Map(catalog.filter((item) => item.ca).map((item) => [String(item.ca).trim().toLowerCase(), item]));
  for (const item of row.items || []) {
    if (row.process_type === 'checklist_diario' && String(item.condition || '').toLowerCase() !== 'sim') continue;
    let ppeItemId = Number(item.ppeItemId);
    if ((!Number.isInteger(ppeItemId) || ppeItemId < 1) && row.process_type === 'checklist_diario') {
      const match = catalogByName.get(String(item.equipmentName || '').trim().toLowerCase())
        || catalogByCa.get(String(item.ca || '').trim().toLowerCase());
      ppeItemId = Number(match?.id);
    }
    const quantity = Number(item.quantity);
    if (!Number.isInteger(ppeItemId) || ppeItemId < 1 || !Number.isInteger(quantity) || quantity < 1) continue;
    items.set(ppeItemId, (items.get(ppeItemId) || 0) + quantity);
  }
  return items;
}

async function applyEpiProcessStockMovements(client, row, actorUserId) {
  const requested = await requestedStockItems(client, row);
  let current = await getUserPpeHoldings(client, row.created_by);
  const allPpeIds = new Set([...requested.keys(), ...current.keys()]);
  for (const ppeItemId of allPpeIds) await lockPpeItem(client, ppeItemId);
  current = await getUserPpeHoldings(client, row.created_by);

  if (row.process_type === 'checklist_diario') {
    for (const ppeItemId of allPpeIds) {
      const desired = requested.get(ppeItemId) || 0;
      const held = current.get(ppeItemId) || 0;
      const delta = desired - held;
      if (delta > 0) {
        await ensureAvailableQuantity(client, ppeItemId, delta);
        await insertPpeStockMovement(client, {
          ppeItemId,
          movementType: 'saida',
          quantity: delta,
          toUserId: row.created_by,
          processId: row.id,
          createdBy: actorUserId,
          referenceKey: `process:${row.id}:ppe:${ppeItemId}:saida`,
          notes: 'Ajuste de posse pelo checklist diário.',
        });
      } else if (delta < 0) {
        await insertPpeStockMovement(client, {
          ppeItemId,
          movementType: 'devolucao',
          quantity: Math.abs(delta),
          fromUserId: row.created_by,
          processId: row.id,
          createdBy: actorUserId,
          referenceKey: `process:${row.id}:ppe:${ppeItemId}:devolucao`,
          notes: 'EPI removido da posse no checklist diário.',
        });
      }
    }
    return;
  }

  for (const [ppeItemId, quantity] of requested.entries()) {
    const held = current.get(ppeItemId) || 0;
    if (quantity > held) {
      throw new StockConflictError(`O usuário não possui quantidade suficiente do EPI #${ppeItemId}. Posse atual: ${held}.`);
    }
    if (row.process_type === 'devolucao') {
      await insertPpeStockMovement(client, {
        ppeItemId,
        movementType: 'devolucao',
        quantity,
        fromUserId: row.created_by,
        processId: row.id,
        createdBy: actorUserId,
        referenceKey: `process:${row.id}:ppe:${ppeItemId}:devolucao`,
        notes: 'Devolução de EPI validada.',
      });
    } else if (row.process_type === 'transferencia') {
      if (!row.target_user_id) throw new StockConflictError('A transferência não possui um destinatário válido.');
      await insertPpeStockMovement(client, {
        ppeItemId,
        movementType: 'transferencia',
        quantity,
        fromUserId: row.created_by,
        toUserId: row.target_user_id,
        processId: row.id,
        createdBy: actorUserId,
        referenceKey: `process:${row.id}:ppe:${ppeItemId}:transferencia`,
        notes: 'Transferência de EPI validada.',
      });
    }
  }
}

async function backfillPpeStockMovements() {
  const migrationKey = 'ppe-stock-ledger-v1';
  const existing = await pool.query('SELECT 1 FROM app_migrations WHERE migration_key = $1', [migrationKey]);
  if (existing.rowCount) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const marker = await client.query(
      `INSERT INTO app_migrations (migration_key) VALUES ($1)
       ON CONFLICT (migration_key) DO NOTHING
       RETURNING migration_key`,
      [migrationKey],
    );
    if (!marker.rowCount) {
      await client.query('COMMIT');
      return;
    }

    await client.query(
      `INSERT INTO ppe_stock_movements
        (ppe_item_id, movement_type, quantity, to_user_id, term_id, created_by, reference_key, notes)
       SELECT COALESCE(ti.ppe_item_id, catalog.id), 'saida', ti.quantity, t.signer_user_id, t.id, t.created_by,
              'backfill:term:' || t.id || ':item:' || ti.id,
              'Movimentação histórica importada do termo EPI assinado.'
       FROM epi_term_items ti
       JOIN epi_terms t ON t.id = ti.term_id
       LEFT JOIN ppe_items catalog ON (UPPER(COALESCE(ti.ca, '')) = UPPER(COALESCE(catalog.ca, '')) OR LOWER(ti.equipment_name) = LOWER(catalog.name))
       WHERE t.status = 'assinado' AND t.signer_user_id IS NOT NULL AND COALESCE(ti.ppe_item_id, catalog.id) IS NOT NULL
       ON CONFLICT (reference_key) DO NOTHING`,
    );

    await client.query(
      `INSERT INTO ppe_stock_movements
        (ppe_item_id, movement_type, quantity, from_user_id, to_user_id, process_id, created_by, reference_key, notes)
       SELECT COALESCE(pi.ppe_item_id, catalog.id), 'transferencia', pi.quantity, p.created_by, p.target_user_id, p.id, p.validated_by,
              'backfill:process:' || p.id || ':item:' || pi.id,
              'Movimentação histórica importada da transferência de EPI validada.'
       FROM epi_process_items pi
       JOIN epi_processes p ON p.id = pi.process_id
       LEFT JOIN ppe_items catalog ON (UPPER(COALESCE(pi.ca, '')) = UPPER(COALESCE(catalog.ca, '')) OR LOWER(pi.equipment_name) = LOWER(catalog.name))
       WHERE p.status = 'validado' AND p.process_type = 'transferencia'
         AND p.target_user_id IS NOT NULL AND COALESCE(pi.ppe_item_id, catalog.id) IS NOT NULL
       ON CONFLICT (reference_key) DO NOTHING`,
    );

    await client.query(
      `INSERT INTO ppe_stock_movements
        (ppe_item_id, movement_type, quantity, from_user_id, process_id, created_by, reference_key, notes)
       SELECT COALESCE(pi.ppe_item_id, catalog.id), 'devolucao', pi.quantity, p.created_by, p.id, p.validated_by,
              'backfill:process:' || p.id || ':item:' || pi.id,
              'Movimentação histórica importada da devolução de EPI validada.'
       FROM epi_process_items pi
       JOIN epi_processes p ON p.id = pi.process_id
       LEFT JOIN ppe_items catalog ON (UPPER(COALESCE(pi.ca, '')) = UPPER(COALESCE(catalog.ca, '')) OR LOWER(pi.equipment_name) = LOWER(catalog.name))
       WHERE p.status = 'validado' AND p.process_type = 'devolucao' AND COALESCE(pi.ppe_item_id, catalog.id) IS NOT NULL
       ON CONFLICT (reference_key) DO NOTHING`,
    );

    const daily = await client.query(
      `SELECT DISTINCT ON (p.created_by, COALESCE(pi.ppe_item_id, catalog.id))
         p.id AS process_id, p.created_by, pi.id AS item_id, COALESCE(pi.ppe_item_id, catalog.id) AS ppe_item_id, pi.quantity
       FROM epi_process_items pi
       JOIN epi_processes p ON p.id = pi.process_id
       LEFT JOIN ppe_items catalog ON (UPPER(COALESCE(pi.ca, '')) = UPPER(COALESCE(catalog.ca, '')) OR LOWER(pi.equipment_name) = LOWER(catalog.name))
       WHERE p.status = 'validado' AND p.process_type = 'checklist_diario' AND COALESCE(pi.ppe_item_id, catalog.id) IS NOT NULL
       ORDER BY p.created_by, COALESCE(pi.ppe_item_id, catalog.id), p.validated_at DESC NULLS LAST, p.id DESC, pi.id DESC`,
    );
    for (const item of daily.rows) {
      const holdings = await getUserPpeHoldings(client, item.created_by);
      if ((holdings.get(Number(item.ppe_item_id)) || 0) > 0) continue;
      await insertPpeStockMovement(client, {
        ppeItemId: Number(item.ppe_item_id),
        movementType: 'saida',
        quantity: Number(item.quantity),
        toUserId: item.created_by,
        processId: item.process_id,
        createdBy: item.created_by,
        referenceKey: `backfill:daily:${item.process_id}:item:${item.item_id}`,
        notes: 'Posse histórica importada do último checklist diário validado.',
      });
    }

    await client.query('COMMIT');
    console.log('Livro de movimentações de EPI inicializado.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function bootstrapAdmin() {
  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) return;

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount > 0) return;

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')`,
    [process.env.BOOTSTRAP_ADMIN_NAME || 'Administrador', email, hash],
  );
  console.log(`Administrador inicial criado: ${email}`);
}

async function bootstrapSuperadmin() {
  const email = String(process.env.BOOTSTRAP_SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD;
  if (!email || !password) return;

  const existing = await pool.query('SELECT id, role FROM users WHERE email = $1', [email]);
  if (existing.rowCount > 0) {
    if (existing.rows[0].role !== 'superadmin') console.error(`Não foi criado o Superadmin: o e-mail ${email} já pertence a outro perfil.`);
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, must_change_password)
     VALUES ($1, $2, $3, 'superadmin', FALSE)`,
    [process.env.BOOTSTRAP_SUPERADMIN_NAME || 'Superadmin', email, hash],
  );
  console.log(`Superadmin inicial criado: ${email}`);
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'sigos', database: 'online' });
  } catch {
    res.status(503).json({ ok: false, database: 'offline' });
  }
});

app.get('/api/system/update', auth, requireRole('superadmin'), (_req, res) => {
  res.json(readSystemUpdateStatus());
});

app.post('/api/system/update', auth, requireRole('superadmin'), async (req, res) => {
  const currentStatus = readSystemUpdateStatus();
  if (currentStatus.status === 'running') {
    return res.status(409).json({ error: 'Já existe uma atualização em andamento.', status: currentStatus });
  }
  if (!fs.existsSync(systemUpdateCommand)) {
    return res.status(503).json({ error: 'O atualizador ainda não foi instalado neste servidor.' });
  }
  try {
    // O atualizador precisa ficar fora do cgroup do serviço. Caso contrário,
    // o systemd encerra o próprio atualizador quando ele reinicia o SIGOS.
    const child = spawn('/usr/bin/sudo', [
      '-n',
      '/usr/bin/systemd-run',
      '--unit=sigos-system-update',
      '--collect',
      '--no-block',
      systemUpdateCommand,
    ], { detached: true, stdio: 'ignore' });
    child.unref();
    await audit({ req, actorUserId: req.user.id, eventType: 'system_update_requested', entityType: 'system', metadata: { command: systemUpdateCommand } });
    return res.status(202).json({ status: 'started', message: 'Atualização iniciada. Acompanhe o andamento nesta tela.' });
  } catch (error) {
    return res.status(503).json({ error: `Não foi possível iniciar a atualização: ${error.message}` });
  }
});

app.post('/api/auth/login', loginRateLimit, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const result = await pool.query('SELECT * FROM users WHERE email = $1 AND active = TRUE', [email]);
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    await audit({ req, eventType: 'login_failed', metadata: { email } });
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }

  const sessionUser = await advanceSession(user.id);
  if (!sessionUser) return res.status(401).json({ error: 'Não foi possível iniciar a sessão.' });

  res.cookie('session', signSession(sessionUser), {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    maxAge: SESSION_DURATION_MS,
  });
  await audit({ req, actorUserId: sessionUser.id, eventType: 'login_success', entityType: 'user', entityId: sessionUser.id, metadata: { sessionVersion: Number(sessionUser.session_version) } });
  const companySettings = isAdminRole(sessionUser.role) ? await getCompanySettings() : null;
  res.json({ user: publicUser(sessionUser, { companyProfileComplete: sessionUser.role !== 'admin' || isCompanyProfileComplete(companySettings) }) });
});

app.post('/api/mobile/auth/login', loginRateLimit, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const result = await pool.query('SELECT * FROM users WHERE email = $1 AND active = TRUE', [email]);
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    await audit({ req, eventType: 'mobile_login_failed', metadata: { email } });
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }

  const sessionUser = await advanceSession(user.id);
  if (!sessionUser) return res.status(401).json({ error: 'Não foi possível iniciar a sessão.' });

  const token = signSession(sessionUser);
  await audit({ req, actorUserId: sessionUser.id, eventType: 'mobile_login_success', entityType: 'user', entityId: sessionUser.id, metadata: { sessionVersion: Number(sessionUser.session_version) } });
  const companySettings = isAdminRole(sessionUser.role) ? await getCompanySettings() : null;
  res.json({ user: publicUser(sessionUser, { companyProfileComplete: sessionUser.role !== 'admin' || isCompanyProfileComplete(companySettings) }), token, expiresIn: SESSION_DURATION_SECONDS });
});

app.post('/api/mobile/selfies', auth, uploadRateLimit, requireRole('admin', 'tecnico', 'vistoriador'), async (req, res) => {
  const imageData = String(req.body.imageData || '');
  const match = imageData.match(/^data:image\/(jpeg|jpg|png);base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) return res.status(400).json({ error: 'A imagem da selfie é inválida.' });

  const mimeType = match[1] === 'png' ? 'image/png' : 'image/jpeg';
  const extension = match[1] === 'png' ? 'png' : 'jpg';
  const imageBuffer = Buffer.from(match[2], 'base64');
  if (!imageBuffer.length || imageBuffer.length > 1200000) {
    return res.status(400).json({ error: 'A selfie deve ter até 1,2 MB.' });
  }

  await fs.promises.mkdir(selfieStoragePath, { recursive: true });
  const fileName = `${req.user.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
  const absolutePath = path.join(selfieStoragePath, fileName);
  await fs.promises.writeFile(absolutePath, imageBuffer, { flag: 'wx' });
  const sha256 = crypto.createHash('sha256').update(imageBuffer).digest('hex');
  const deviceInfo = cleanText(req.body.deviceInfo, 240) || null;
  const latitude = capturedCoordinate(req.body.latitude, -90, 90);
  const longitude = capturedCoordinate(req.body.longitude, -180, 180);
  const locationLabel = await approximateLocationLabel(latitude, longitude);
  const userAgent = req.get('user-agent') || null;
  const result = await pool.query(
    `INSERT INTO selfie_uploads
      (user_id, file_name, file_path, mime_type, byte_size, sha256, device_info, ip_address, user_agent, latitude, longitude, location_label)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, file_name, mime_type, byte_size, sha256, device_info, ip_address, user_agent, latitude, longitude, location_label, created_at`,
    [req.user.id, fileName, absolutePath, mimeType, imageBuffer.length, sha256, deviceInfo, clientIp(req), userAgent, latitude, longitude, locationLabel],
  );
  await audit({
    req,
    actorUserId: req.user.id,
    eventType: 'selfie_uploaded',
    entityType: 'selfie_upload',
    entityId: result.rows[0].id,
    metadata: { fileName, mimeType, byteSize: imageBuffer.length, sha256, deviceInfo, latitude, longitude, locationLabel },
  });
  res.status(201).json({ selfie: result.rows[0] });
});

app.post('/api/auth/logout', auth, async (req, res) => {
  await audit({ req, actorUserId: req.user.id, eventType: 'logout', entityType: 'user', entityId: req.user.id });
  res.clearCookie('session');
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user, { companyProfileComplete: req.companyProfileComplete }) }));

app.get('/api/company', auth, requireRole('admin'), async (req, res) => {
  const company = req.companySettings || await getCompanySettings();
  res.json({ company: publicCompanySettings(company) });
});

app.put('/api/company', auth, uploadRateLimit, requireRole('admin'), async (req, res) => {
  const tradeName = cleanText(req.body.tradeName, 180);
  const legalName = cleanText(req.body.legalName, 180);
  const cnpj = cleanText(req.body.cnpj, 32);
  const phone = cleanText(req.body.phone, 60);
  const email = cleanText(req.body.email, 180).toLowerCase();
  const responsibleName = cleanText(req.body.responsibleName, 180);
  const website = cleanText(req.body.website, 240);
  const address = cleanText(req.body.address, 240);
  const city = cleanText(req.body.city, 120);
  const state = cleanText(req.body.state, 80);
  const zipCode = cleanText(req.body.zipCode, 20);
  const logoProvided = Object.prototype.hasOwnProperty.call(req.body, 'logoData');
  let logo = null;
  try {
    if (logoProvided) logo = parseCompanyLogo(req.body.logoData);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const cnpjDigits = cnpj.replace(/\D/g, '');
  const phoneDigits = phone.replace(/\D/g, '');

  if (!tradeName || !legalName || cnpjDigits.length !== 14 || phoneDigits.length < 8 || !responsibleName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Preencha nome fantasia, razão social, CNPJ válido, telefone, e-mail e responsável.' });
  }
  if (website) {
    try {
      const parsed = new URL(website.match(/^https?:\/\//i) ? website : `https://${website}`);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid');
    } catch {
      return res.status(400).json({ error: 'Informe um site válido, como https://www.exemplo.com.br.' });
    }
  }

  const result = await pool.query(
    `INSERT INTO company_settings
      (id, trade_name, legal_name, cnpj, phone, email, responsible_name, website, address, city, state, zip_code, logo_data, logo_mime_type, logo_updated_at, updated_by, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $12 THEN $13 ELSE NULL END, CASE WHEN $12 THEN $14 ELSE NULL END, CASE WHEN $12 THEN NOW() ELSE NULL END, $15, NOW())
     ON CONFLICT (id) DO UPDATE SET
       trade_name = EXCLUDED.trade_name,
       legal_name = EXCLUDED.legal_name,
       cnpj = EXCLUDED.cnpj,
       phone = EXCLUDED.phone,
       email = EXCLUDED.email,
       responsible_name = EXCLUDED.responsible_name,
       website = EXCLUDED.website,
       address = EXCLUDED.address,
       city = EXCLUDED.city,
       state = EXCLUDED.state,
       zip_code = EXCLUDED.zip_code,
       logo_data = CASE WHEN $12 THEN $13 ELSE company_settings.logo_data END,
       logo_mime_type = CASE WHEN $12 THEN $14 ELSE company_settings.logo_mime_type END,
       logo_updated_at = CASE WHEN $12 THEN NOW() ELSE company_settings.logo_updated_at END,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING *`,
    [tradeName, legalName, cnpj, phone, email, responsibleName, website || null, address || null, city || null, state || null, zipCode || null, logoProvided, logo?.data || null, logo?.mimeType || null, req.user.id],
  );
  req.companySettings = result.rows[0];
  req.companyProfileComplete = true;
  await audit({ req, actorUserId: req.user.id, eventType: 'company_settings_updated', entityType: 'company_settings', entityId: 1, metadata: { fields: ['tradeName', 'legalName', 'cnpj', 'phone', 'email', 'responsibleName', 'website', 'address', 'city', 'state', 'zipCode', ...(logoProvided ? ['logoData'] : [])] } });
  res.json({ company: publicCompanySettings(result.rows[0]) });
});

app.get('/api/onboarding/status', auth, requireRole('admin', 'tecnico', 'vistoriador'), (req, res) => {
  res.json({
    onboarding: {
      mustChangePassword: Boolean(req.user.must_change_password),
      signatureRegistered: Boolean(req.user.signature_data),
      consentRequired: ['admin', 'tecnico', 'vistoriador'].includes(req.user.role),
      consentRegistered: ['admin', 'tecnico', 'vistoriador'].includes(req.user.role)
        ? (Boolean(req.user.consent_at) && req.user.consent_location === true && req.user.consent_ip === true && req.user.consent_image === true)
        : true,
      consentAt: req.user.consent_at || null,
    },
    signatureData: req.user.signature_data || null,
    signatureMode: req.user.signature_mode || 'desenhada',
  });
});

app.post('/api/onboarding/signature', auth, requireRole('admin', 'tecnico', 'vistoriador'), async (req, res) => {
  const signatureData = String(req.body.signatureData || '');
  const confirmed = req.body.confirmed === true;
  const signatureMode = ['desenhada', 'nome_digitado'].includes(String(req.body.signatureMode || ''))
    ? String(req.body.signatureMode)
    : 'desenhada';
  if (!confirmed) return res.status(400).json({ error: 'Confirme que esta assinatura será usada para validar seus registros.' });
  if (!/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(signatureData) || signatureData.length > 700000) {
    return res.status(400).json({ error: 'A assinatura é inválida ou excede o limite permitido.' });
  }
  const signatureHash = sha256Json({ algorithm: 'SHA-256', version: 1, userId: String(req.user.id), signatureData });
  await pool.query(
    `UPDATE users
     SET signature_data = $1, signature_hash = $2, signature_mode = $3, signature_registered_at = NOW(), updated_at = NOW()
     WHERE id = $4`,
    [signatureData, signatureHash, signatureMode, req.user.id],
  );
  await audit({ req, actorUserId: req.user.id, eventType: 'user_signature_registered', entityType: 'user', entityId: req.user.id, metadata: { signatureHash, signatureMode, confirmed: true } });
  res.json({ ok: true, signatureRegistered: true, signatureHash, signatureMode });
});

app.post('/api/onboarding/consent', auth, requireRole('admin', 'tecnico', 'vistoriador'), async (req, res) => {
  const consentLocation = req.body.consentLocation === true;
  const consentIp = req.body.consentIp === true;
  const consentImage = req.body.consentImage === true;
  if (!consentLocation || !consentIp || !consentImage) {
    return res.status(400).json({ error: 'É necessário consentir com o uso da localização, IP e imagem para utilizar o SIGOS.' });
  }
  const latitude = req.body.latitude === null || req.body.latitude === undefined || req.body.latitude === '' ? null : Number(req.body.latitude);
  const longitude = req.body.longitude === null || req.body.longitude === undefined || req.body.longitude === '' ? null : Number(req.body.longitude);
  if ((latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
    return res.status(400).json({ error: 'A localização informada é inválida.' });
  }
  await pool.query(
    `UPDATE users
     SET consent_location = $1, consent_ip = $2, consent_image = $3,
         consent_at = NOW(), consent_ip_address = $4, consent_user_agent = $5,
         consent_latitude = $6, consent_longitude = $7, updated_at = NOW()
     WHERE id = $8`,
    [consentLocation, consentIp, consentImage, clientIp(req), req.get('user-agent') || null, latitude, longitude, req.user.id],
  );
  await audit({ req, actorUserId: req.user.id, eventType: 'user_data_consent_registered', entityType: 'user', entityId: req.user.id, metadata: { consentLocation, consentIp, consentImage, latitude, longitude } });
  res.json({ ok: true, consentRegistered: true });
});

app.get('/api/notifications', auth, async (req, res) => {
  const result = await pool.query(
    `SELECT id, notification_type, title, message, entity_type, entity_id, metadata, read_at, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [req.user.id],
  );
  const unread = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM notifications
     WHERE user_id = $1 AND read_at IS NULL`,
    [req.user.id],
  );
  res.json({ notifications: result.rows.map(publicNotification), unreadCount: unread.rows[0].count });
});

app.post('/api/notifications/read-all', auth, async (req, res) => {
  await pool.query('UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE user_id = $1', [req.user.id]);
  res.json({ ok: true });
});

app.post('/api/notifications/:id/read', auth, async (req, res) => {
  const result = await pool.query(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, NOW())
     WHERE id = $1 AND user_id = $2
     RETURNING id, read_at`,
    [req.params.id, req.user.id],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Notificação não encontrada.' });
  res.json({ notification: result.rows[0] });
});

app.post('/api/push/register', auth, async (req, res) => {
  const token = cleanText(req.body.token, 4096);
  const platform = cleanText(req.body.platform || 'android', 40) || 'android';
  const deviceInfo = cleanText(req.body.deviceInfo, 500) || req.get('user-agent') || null;
  if (!token || token.length < 20) return res.status(400).json({ error: 'Token de notificações inválido.' });

  await pool.query(
    `INSERT INTO push_devices (user_id, token, platform, device_info, ip_address, user_agent, active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
     ON CONFLICT (token) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       platform = EXCLUDED.platform,
       device_info = EXCLUDED.device_info,
       ip_address = EXCLUDED.ip_address,
       user_agent = EXCLUDED.user_agent,
       active = TRUE,
       updated_at = NOW()` ,
    [req.user.id, token, platform, deviceInfo, clientIp(req), req.get('user-agent') || null],
  );
  await audit({ req, actorUserId: req.user.id, eventType: 'push_device_registered', entityType: 'push_device', metadata: { platform } });
  res.json({ ok: true });
});

app.get('/api/push/web/config', auth, (_req, res) => {
  res.json({ configured: Boolean(webPush && webPushPublicKey), publicKey: webPush && webPushPublicKey ? webPushPublicKey : null });
});

app.post('/api/push/web/register', auth, async (req, res) => {
  if (!webPush || !webPushPublicKey) return res.status(503).json({ error: 'Web Push ainda não está configurado no servidor.' });
  const subscription = req.body.subscription && typeof req.body.subscription === 'object' ? req.body.subscription : req.body;
  const endpoint = cleanText(subscription.endpoint, 2048);
  const p256dh = cleanText(subscription.keys?.p256dh, 512);
  const authKey = cleanText(subscription.keys?.auth, 512);
  if (!endpoint || !p256dh || !authKey) return res.status(400).json({ error: 'Inscrição de notificações inválida.' });
  await pool.query(
    `INSERT INTO web_push_subscriptions
      (user_id, endpoint, p256dh, auth, device_info, user_agent, active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
     ON CONFLICT (endpoint) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       device_info = EXCLUDED.device_info,
       user_agent = EXCLUDED.user_agent,
       active = TRUE,
       updated_at = NOW()`,
    [req.user.id, endpoint, p256dh, authKey, cleanText(req.body.deviceInfo, 500) || null, req.get('user-agent') || null],
  );
  await audit({ req, actorUserId: req.user.id, eventType: 'web_push_registered', entityType: 'web_push_subscription', metadata: { endpointHost: (() => { try { return new URL(endpoint).host; } catch { return null; } })() } });
  res.json({ ok: true });
});

app.post('/api/push/web/unregister', auth, async (req, res) => {
  const endpoint = cleanText(req.body.endpoint, 2048);
  if (endpoint) await pool.query('UPDATE web_push_subscriptions SET active = FALSE, updated_at = NOW() WHERE user_id = $1 AND endpoint = $2', [req.user.id, endpoint]);
  res.json({ ok: true });
});

app.post('/api/push/unregister', auth, async (req, res) => {
  const token = cleanText(req.body.token, 4096);
  if (token) await pool.query('UPDATE push_devices SET active = FALSE, updated_at = NOW() WHERE user_id = $1 AND token = $2', [req.user.id, token]);
  res.json({ ok: true });
});

app.post('/api/admin/notifications', auth, requireRole('admin'), async (req, res) => {
  const recipientMode = String(req.body.recipientMode || 'selected');
  const title = cleanText(req.body.title, 120);
  const message = cleanText(req.body.message, 1000);
  const requestedIds = Array.isArray(req.body.userIds)
    ? [...new Set(req.body.userIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
    : [];

  if (!['all', 'selected'].includes(recipientMode) || !title || !message) {
    return res.status(400).json({ error: 'Informe destinatários, título e mensagem.' });
  }

  const recipients = recipientMode === 'all'
    ? await pool.query('SELECT id FROM users WHERE active = TRUE AND id <> $1 ORDER BY id', [req.user.id])
    : await pool.query('SELECT id FROM users WHERE active = TRUE AND id <> $1 AND id = ANY($2::bigint[]) ORDER BY id', [req.user.id, requestedIds]);
  const userIds = recipients.rows.map((row) => row.id);
  if (!userIds.length) return res.status(400).json({ error: 'Nenhum usuário ativo foi selecionado.' });

  const result = await pool.query(
    `INSERT INTO notifications
      (user_id, notification_type, title, message, entity_type, metadata)
     SELECT id, 'admin_message', $2, $3, 'admin_message', $4
     FROM users
     WHERE active = TRUE AND id = ANY($1::bigint[])
     RETURNING id`,
    [userIds, title, message, { senderId: req.user.id, recipientMode }],
  );
  await sendPushNotifications({
    userIds,
    title,
    message,
    data: { notificationType: 'admin_message', entityType: 'admin_message' },
  });
  await audit({ req, actorUserId: req.user.id, eventType: 'admin_notification_sent', entityType: 'notification', metadata: { recipientMode, recipientCount: result.rowCount, title } });
  res.status(201).json({ sentCount: result.rowCount });
});

app.get('/api/admin/compliance-alerts', auth, requireRole('admin'), async (_req, res) => {
  const result = await pool.query(
    `SELECT a.*, u.name AS justified_by_name,
            t.id AS pending_task_id,
            t.assigned_to AS pending_task_assigned_to,
            assignee.name AS pending_task_assigned_to_name,
            t.assigned_at AS pending_task_assigned_at,
            t.status AS pending_task_status
     FROM compliance_alerts a
     LEFT JOIN users u ON u.id = a.justified_by
     LEFT JOIN compliance_pending_tasks t ON t.alert_key = a.alert_key AND t.status = 'pendente'
     LEFT JOIN users assignee ON assignee.id = t.assigned_to
     WHERE a.status = 'aberto'
     ORDER BY a.created_at DESC
     LIMIT 200`,
  );
  res.json({ alerts: result.rows.map(publicComplianceAlert) });
});

app.post('/api/admin/compliance-alerts/:alertKey/justify', auth, requireRole('admin'), async (req, res) => {
  const alertKey = cleanText(req.params.alertKey, 240);
  const observation = cleanText(req.body.observation, 700);
  if (!alertKey || !observation) return res.status(400).json({ error: 'Informe a justificativa da pendência.' });
  const result = await pool.query(
    `UPDATE compliance_alerts
     SET status = 'justificado', justification = $2, justified_by = $3, justified_at = NOW(), updated_at = NOW()
     WHERE alert_key = $1 AND status = 'aberto'
     RETURNING *`,
    [alertKey, observation, req.user.id],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Alerta aberto não encontrado.' });
  await pool.query(
    `UPDATE compliance_pending_tasks
     SET status = 'cancelada', completed_at = COALESCE(completed_at, NOW()), completion_note = COALESCE(completion_note, 'Pendência justificada pelo administrador.')
     WHERE alert_key = $1 AND status = 'pendente'`,
    [alertKey],
  );
  await audit({ req, actorUserId: req.user.id, eventType: 'compliance_alert_justified', entityType: 'compliance_alert', entityId: alertKey, metadata: { alertType: result.rows[0].alert_type, periodKey: result.rows[0].period_key, subjectType: result.rows[0].subject_type, subjectId: result.rows[0].subject_id, observation } });
  res.json({ alert: publicComplianceAlert(result.rows[0]) });
});

app.post('/api/admin/compliance-alerts/:alertKey/assign', auth, requireRole('admin'), async (req, res) => {
  const alertKey = cleanText(req.params.alertKey, 240);
  const assignedTo = Number(req.body.assignedTo);
  const instruction = cleanText(req.body.instruction, 700) || 'Justificar esta pendência.';
  if (!alertKey || !Number.isInteger(assignedTo) || assignedTo <= 0) return res.status(400).json({ error: 'Selecione um usuário para receber a pendência.' });
  if (assignedTo === Number(req.user.id)) return res.status(400).json({ error: 'Selecione outro usuário para receber a pendência.' });

  const alertResult = await pool.query(
    `SELECT * FROM compliance_alerts WHERE alert_key = $1 AND status = 'aberto'`,
    [alertKey],
  );
  const alert = alertResult.rows[0];
  if (!alert) return res.status(404).json({ error: 'Alerta aberto não encontrado.' });

  const userResult = await pool.query(
    `SELECT id, name FROM users WHERE id = $1 AND active = TRUE`,
    [assignedTo],
  );
  const assignee = userResult.rows[0];
  if (!assignee) return res.status(404).json({ error: 'Usuário ativo não encontrado.' });

  const existingTask = await pool.query(
    `SELECT id FROM compliance_pending_tasks WHERE alert_key = $1 AND status = 'pendente'`,
    [alertKey],
  );
  if (existingTask.rows[0]) return res.status(409).json({ error: 'Esta pendência já foi enviada e está aguardando conclusão.' });

  const taskResult = await pool.query(
    `INSERT INTO compliance_pending_tasks (alert_key, assigned_to, assigned_by, instruction)
     VALUES ($1, $2, $3, $4)
     RETURNING id, assigned_at`,
    [alertKey, assignedTo, req.user.id, instruction],
  );
  const task = taskResult.rows[0];
  const message = `${alert.title}: ${instruction}`;
  await notifyUsers({
    userIds: [assignedTo],
    notificationType: 'compliance_pending_assigned',
    title: 'Nova pendência atribuída',
    message,
    entityType: 'compliance_pending_task',
    entityId: task.id,
    metadata: { taskId: String(task.id), alertKey, alertType: alert.alert_type, periodKey: alert.period_key, assignedBy: String(req.user.id), subjectLabel: alert.subject_label },
  });
  await audit({ req, actorUserId: req.user.id, eventType: 'compliance_pending_assigned', entityType: 'compliance_pending_task', entityId: task.id, metadata: { taskId: String(task.id), alertKey, assignedTo, instruction, subjectLabel: alert.subject_label } });
  res.status(201).json({ taskId: task.id, assignedTo: assignee.id, assignedToName: assignee.name, assignedAt: task.assigned_at });
});

app.get('/api/pending', auth, async (req, res) => {
  const result = await pool.query(
    `SELECT t.*, a.title AS alert_title, a.message AS alert_message, a.alert_type,
            a.period_key, a.subject_label,
            assignee.name AS assigned_to_name,
            assigner.name AS assigned_by_name
     FROM compliance_pending_tasks t
     JOIN compliance_alerts a ON a.alert_key = t.alert_key
     JOIN users assignee ON assignee.id = t.assigned_to
     LEFT JOIN users assigner ON assigner.id = t.assigned_by
     WHERE t.status = 'pendente'
       AND ($2::boolean = TRUE OR t.assigned_to = $1)
     ORDER BY t.assigned_at DESC
     LIMIT 200`,
     [req.user.id, isAdminRole(req.user.role)],
  );
  res.json({ tasks: result.rows.map(publicPendingTask), count: result.rowCount });
});

app.post('/api/pending/:id/complete', auth, async (req, res) => {
  const taskId = Number(req.params.id);
  const completionNote = cleanText(req.body.note, 700) || null;
  if (!Number.isInteger(taskId) || taskId <= 0) return res.status(400).json({ error: 'Pendência inválida.' });

  const taskResult = await pool.query(
    `SELECT t.*, a.title AS alert_title, a.message AS alert_message, a.alert_type,
            a.period_key, a.subject_label,
            assignee.name AS assigned_to_name,
            assigner.name AS assigned_by_name
     FROM compliance_pending_tasks t
     JOIN compliance_alerts a ON a.alert_key = t.alert_key
     JOIN users assignee ON assignee.id = t.assigned_to
     LEFT JOIN users assigner ON assigner.id = t.assigned_by
     WHERE t.id = $1 AND t.status = 'pendente'`,
    [taskId],
  );
  const task = taskResult.rows[0];
  if (!task) return res.status(404).json({ error: 'Pendência não encontrada ou já concluída.' });
  if (Number(task.assigned_to) !== Number(req.user.id)) return res.status(403).json({ error: 'Somente o usuário responsável pode concluir esta pendência.' });

  const completedResult = await pool.query(
    `UPDATE compliance_pending_tasks
     SET status = 'concluida', completed_at = NOW(), completed_by = $2, completion_note = $3
     WHERE id = $1 AND status = 'pendente'
     RETURNING *`,
    [taskId, req.user.id, completionNote],
  );
  if (!completedResult.rows[0]) return res.status(409).json({ error: 'Esta pendência acabou de ser concluída.' });
  await pool.query(`UPDATE compliance_alerts SET status = 'resolvido', updated_at = NOW() WHERE alert_key = $1 AND status = 'aberto'`, [task.alert_key]);

  const recipientIds = [task.assigned_to, task.assigned_by].filter((id) => id && Number(id) !== Number(req.user.id));
  recipientIds.push(req.user.id);
  const message = `${req.user.name} concluiu a pendência de ${task.subject_label}.${completionNote ? ` Observação: ${completionNote}` : ''}`;
  await notifyUsers({
    userIds: recipientIds,
    notificationType: 'compliance_pending_completed',
    title: 'Pendência concluída',
    message,
    entityType: 'compliance_pending_task',
    entityId: task.id,
    metadata: { taskId: String(task.id), alertKey: task.alert_key, completedBy: String(req.user.id), assignedTo: String(task.assigned_to), assignedBy: task.assigned_by ? String(task.assigned_by) : null, subjectLabel: task.subject_label, completionNote },
  });
  await audit({ req, actorUserId: req.user.id, eventType: 'compliance_pending_completed', entityType: 'compliance_pending_task', entityId: task.id, metadata: { taskId: String(task.id), alertKey: task.alert_key, subjectLabel: task.subject_label, completionNote } });
  res.json({ task: publicPendingTask({ ...task, ...completedResult.rows[0], status: 'concluida', completed_at: completedResult.rows[0].completed_at, completion_note: completionNote }) });
});

app.post('/api/admin/compliance-alerts/:alertKey/notify', auth, requireRole('admin'), async (req, res) => {
  const alertKey = cleanText(req.params.alertKey, 240);
  const result = await pool.query(
    `SELECT * FROM compliance_alerts WHERE alert_key = $1 AND status = 'aberto'`,
    [alertKey],
  );
  const alert = result.rows[0];
  if (!alert) return res.status(404).json({ error: 'Alerta aberto não encontrado.' });
  if (alert.subject_type !== 'tecnico') return res.status(400).json({ error: 'Este alerta não possui um técnico destinatário.' });
  const message = cleanText(req.body.message, 700) || `O administrador identificou uma pendência: ${alert.message}`;
  await notifyUsers({
    userIds: [alert.subject_id],
    notificationType: 'compliance_alert_followup',
    title: 'Pendência de checklist diário',
    message,
    entityType: 'compliance_alert',
    entityId: alertKey,
    metadata: { alertKey, alertType: alert.alert_type, periodKey: alert.period_key, subjectId: String(alert.subject_id), sentBy: String(req.user.id) },
  });
  await audit({ req, actorUserId: req.user.id, eventType: 'compliance_alert_followup_sent', entityType: 'compliance_alert', entityId: alertKey, metadata: { alertType: alert.alert_type, periodKey: alert.period_key, subjectId: alert.subject_id, message } });
  res.json({ ok: true });
});

app.post('/api/auth/change-password', auth, async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (newPassword.length < 10) {
    return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 10 caracteres.' });
  }

  const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!result.rows[0] || !(await bcrypt.compare(currentPassword, result.rows[0].password_hash))) {
    return res.status(401).json({ error: 'A senha atual está incorreta.' });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);
  await audit({ req, actorUserId: req.user.id, eventType: 'password_changed', entityType: 'user', entityId: req.user.id });
  res.json({ ok: true });
});

app.get('/api/dashboard', auth, async (_req, res) => {
  const [users, vehicles, ppes, pending, epiTerms] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM users WHERE active = TRUE'),
    pool.query("SELECT COUNT(*)::int AS count FROM vehicles WHERE status = 'ativo'"),
    pool.query("SELECT COUNT(*)::int AS count FROM ppe_items WHERE active = TRUE"),
    pool.query("SELECT COUNT(*)::int AS count FROM inspections WHERE status IN ('rascunho', 'pendente')"),
    pool.query("SELECT COUNT(*)::int AS count FROM epi_terms WHERE status IN ('rascunho', 'pendente_assinatura')"),
  ]);
  res.json({
    users: users.rows[0].count,
    vehicles: vehicles.rows[0].count,
    ppeItems: ppes.rows[0].count,
    pendingInspections: pending.rows[0].count,
    pendingEpiTerms: epiTerms.rows[0].count,
  });
});

app.get('/api/overview', auth, async (req, res) => {
  const isAdmin = isAdminRole(req.user.role);
  const canReviewAll = isChecklistValidatorRole(req.user.role);
  const params = isAdmin ? [] : [req.user.id];
  const actorClause = isAdmin ? '' : ' AND a.actor_user_id = $1';
  const termClause = isAdmin ? '' : ' AND (t.created_by = $1 OR t.signer_user_id = $1)';
  const processClause = canReviewAll ? '' : ' AND (p.created_by = $1 OR p.validator_user_id = $1 OR p.target_user_id = $1)';
  const pendingParams = canReviewAll ? [] : [req.user.id];

  const [activity, eventCount, termCount, pendingTerms, pendingValidations] = await Promise.all([
    pool.query(
      `SELECT a.id, a.event_type, a.entity_type, a.entity_id, a.ip_address,
              a.user_agent, a.metadata, a.created_at, u.name AS actor_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_user_id
       WHERE a.created_at >= CURRENT_DATE
         AND a.created_at < CURRENT_DATE + INTERVAL '1 day'${actorClause}
       ORDER BY a.created_at DESC
       LIMIT 15`,
      params,
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM audit_logs a
       WHERE a.created_at >= NOW() - INTERVAL '7 days'${actorClause}`,
      params,
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM epi_terms t
       WHERE t.created_at >= NOW() - INTERVAL '7 days'${termClause}`,
      params,
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM epi_terms t
       WHERE t.status IN ('rascunho', 'pendente_assinatura')${termClause}`,
      params,
    ),
    pool.query(
      `SELECT (
         (SELECT COUNT(*) FROM vehicle_checklists
          WHERE status = 'pendente_validacao'${isAdmin || req.user.role === 'vistoriador' ? '' : ' AND driver_user_id = $1'})
         +
         (SELECT COUNT(*) FROM epi_processes p
          WHERE p.status = 'pendente_validacao'${processClause})
       )::int AS count`,
      pendingParams,
    ),
  ]);

  res.json({
    period: 'últimos 7 dias',
    stats: {
      activity: eventCount.rows[0].count,
      epiTerms: termCount.rows[0].count,
      pendingEpiTerms: pendingTerms.rows[0].count,
      pendingValidations: pendingValidations.rows[0].count,
    },
    activity: activity.rows,
  });
});

app.get('/api/reports', auth, requireRole('admin'), async (req, res) => {
  const range = reportDateRange(String(req.query.period || 'diario'), req.query.date);
  if (!range) return res.status(400).json({ error: 'Informe um período e uma data de referência válidos.' });
  const params = [range.startDate, range.endDateExclusive];

  const [summary, technicians, vehicles, periodAlerts, openTasks, activity] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM audit_logs a
          WHERE timezone('America/Fortaleza', a.created_at)::date >= $1::date
            AND timezone('America/Fortaleza', a.created_at)::date < $2::date) AS activity_count,
         (SELECT COUNT(*)::int FROM epi_processes p
          WHERE p.process_type = 'checklist_diario'
            AND p.submitted_at IS NOT NULL
            AND timezone('America/Fortaleza', p.submitted_at)::date >= $1::date
            AND timezone('America/Fortaleza', p.submitted_at)::date < $2::date) AS daily_epi_checklists,
         (SELECT COUNT(*)::int FROM epi_processes p
          WHERE p.submitted_at IS NOT NULL
            AND timezone('America/Fortaleza', p.submitted_at)::date >= $1::date
            AND timezone('America/Fortaleza', p.submitted_at)::date < $2::date) AS epi_processes,
         (SELECT COUNT(*)::int FROM epi_terms t
          WHERE t.signed_at IS NOT NULL
            AND timezone('America/Fortaleza', t.signed_at)::date >= $1::date
            AND timezone('America/Fortaleza', t.signed_at)::date < $2::date) AS signed_epi_terms,
         (SELECT COUNT(*)::int FROM vehicle_checklists vc
          WHERE vc.submitted_at IS NOT NULL
            AND timezone('America/Fortaleza', vc.submitted_at)::date >= $1::date
            AND timezone('America/Fortaleza', vc.submitted_at)::date < $2::date) AS vehicle_checklists,
         (SELECT COUNT(*)::int FROM compliance_alerts a
          WHERE timezone('America/Fortaleza', a.created_at)::date >= $1::date
            AND timezone('America/Fortaleza', a.created_at)::date < $2::date) AS period_alerts,
         (SELECT COUNT(*)::int FROM compliance_alerts WHERE status = 'aberto') AS open_alerts,
         (SELECT COUNT(*)::int FROM compliance_pending_tasks WHERE status = 'pendente') AS open_tasks`,
      params,
    ),
    pool.query(
      `SELECT u.id, u.name, u.email,
              COUNT(p.id)::int AS checklist_count,
              COUNT(p.id) FILTER (WHERE p.admin_attention_required)::int AS attention_count,
              MAX(p.submitted_at) AS last_checklist_at
       FROM users u
       LEFT JOIN epi_processes p
         ON p.created_by = u.id
        AND p.process_type = 'checklist_diario'
        AND p.submitted_at IS NOT NULL
        AND timezone('America/Fortaleza', p.submitted_at)::date >= $1::date
        AND timezone('America/Fortaleza', p.submitted_at)::date < $2::date
       WHERE u.active = TRUE
         AND u.role = 'tecnico'
         AND timezone('America/Fortaleza', u.created_at)::date < $2::date
       GROUP BY u.id, u.name, u.email
       ORDER BY u.name ASC`,
      params,
    ),
    pool.query(
      `SELECT v.id, v.plate, v.model, v.status,
              COUNT(vc.id) FILTER (WHERE vc.checklist_type = 'diario')::int AS daily_count,
              COUNT(vc.id) FILTER (WHERE vc.checklist_type = 'quinzenal')::int AS fortnightly_count,
              COUNT(vc.id) FILTER (WHERE vc.checklist_type = 'transferencia')::int AS transfer_count,
              COUNT(vc.id) FILTER (WHERE vc.checklist_type IN ('entrega', 'recebimento', 'devolucao'))::int AS delivery_count,
              COUNT(vc.id) FILTER (WHERE vc.status = 'pendente_validacao')::int AS pending_validation_count,
              MAX(vc.submitted_at) AS last_checklist_at
       FROM vehicles v
       LEFT JOIN vehicle_checklists vc
         ON (vc.vehicle_id = v.id OR (vc.vehicle_id IS NULL AND UPPER(vc.plate) = UPPER(v.plate)))
        AND vc.submitted_at IS NOT NULL
        AND timezone('America/Fortaleza', vc.submitted_at)::date >= $1::date
        AND timezone('America/Fortaleza', vc.submitted_at)::date < $2::date
       WHERE v.status = 'ativo'
       GROUP BY v.id, v.plate, v.model, v.status
       ORDER BY v.plate ASC`,
      params,
    ),
    pool.query(
      `SELECT a.alert_key, a.alert_type, a.title, a.message, a.subject_label, a.status,
              a.justification, a.created_at, a.justified_at, u.name AS justified_by_name
       FROM compliance_alerts a
       LEFT JOIN users u ON u.id = a.justified_by
       WHERE timezone('America/Fortaleza', a.created_at)::date >= $1::date
         AND timezone('America/Fortaleza', a.created_at)::date < $2::date
       ORDER BY a.created_at DESC
       LIMIT 200`,
      params,
    ),
    pool.query(
      `SELECT t.id, t.instruction, t.status, t.assigned_at, t.completed_at,
              a.title, a.subject_label, a.alert_type,
              assignee.name AS assigned_to_name, assigner.name AS assigned_by_name
       FROM compliance_pending_tasks t
       JOIN compliance_alerts a ON a.alert_key = t.alert_key
       LEFT JOIN users assignee ON assignee.id = t.assigned_to
       LEFT JOIN users assigner ON assigner.id = t.assigned_by
       WHERE t.status = 'pendente'
       ORDER BY t.assigned_at DESC
       LIMIT 200`,
      [],
    ),
    pool.query(
      `SELECT a.id, a.event_type, a.entity_type, a.entity_id, a.created_at, u.name AS actor_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_user_id
       WHERE timezone('America/Fortaleza', a.created_at)::date >= $1::date
         AND timezone('America/Fortaleza', a.created_at)::date < $2::date
       ORDER BY a.created_at DESC
       LIMIT 100`,
      params,
    ),
  ]);

  const totals = summary.rows[0];
  res.json({
    period: range.period,
    referenceDate: range.referenceDate,
    startDate: range.startDate,
    endDate: range.endDate,
    stats: {
      activity: totals.activity_count,
      dailyEpiChecklists: totals.daily_epi_checklists,
      epiProcesses: totals.epi_processes,
      signedEpiTerms: totals.signed_epi_terms,
      vehicleChecklists: totals.vehicle_checklists,
      periodAlerts: totals.period_alerts,
      openAlerts: totals.open_alerts,
      openTasks: totals.open_tasks,
    },
    technicians: technicians.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      checklistCount: row.checklist_count,
      attentionCount: row.attention_count,
      completed: Number(row.checklist_count) > 0,
      lastChecklistAt: row.last_checklist_at,
    })),
    vehicles: vehicles.rows.map((row) => ({
      id: row.id,
      plate: row.plate,
      model: row.model,
      status: row.status,
      dailyCount: row.daily_count,
      fortnightlyCount: row.fortnightly_count,
      transferCount: row.transfer_count,
      deliveryCount: row.delivery_count,
      pendingValidationCount: row.pending_validation_count,
      lastChecklistAt: row.last_checklist_at,
    })),
    alerts: periodAlerts.rows,
    openTasks: openTasks.rows,
    activity: activity.rows,
  });
});

function cleanText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function epiProcessTitle(processType) {
  return EPI_PROCESS_LEGAL_TEXT[processType]?.title || 'Processo de EPI';
}

function parseCapturedImage(imageData) {
  const value = String(imageData || '');
  const match = value.match(/^data:image\/(jpeg|jpg|png);base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) throw new Error('A imagem capturada é inválida.');
  const mimeType = match[1] === 'png' ? 'image/png' : 'image/jpeg';
  const extension = match[1] === 'png' ? 'png' : 'jpg';
  const imageBuffer = Buffer.from(match[2], 'base64');
  if (!imageBuffer.length || imageBuffer.length > 1200000) throw new Error('Cada imagem deve ter até 1,2 MB.');
  return { mimeType, extension, imageBuffer };
}

function parseCompanyLogo(imageData) {
  const value = String(imageData || '');
  if (!value) return null;
  const captured = parseCapturedImage(value);
  if (captured.imageBuffer.length > 600000) throw new Error('A logo deve ter até 600 KB após a compactação.');
  return { data: value, mimeType: captured.mimeType };
}

function capturedCoordinate(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? Number(number.toFixed(6)) : null;
}

const locationLabelCache = new Map();

async function approximateLocationLabel(latitude, longitude) {
  if (latitude === null || longitude === null || typeof fetch !== 'function') return null;
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  if (locationLabelCache.has(cacheKey)) return locationLabelCache.get(cacheKey);
  const pending = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=14&addressdetails=1`, {
        headers: { 'User-Agent': 'SIGOS/1.0 (gestao de EPIs e veiculos)' },
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const data = await response.json();
      const address = data.address || {};
      const city = address.city || address.town || address.municipality || address.village || null;
      return city || null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  })();
  locationLabelCache.set(cacheKey, pending);
  const label = await pending;
  locationLabelCache.set(cacheKey, label);
  return label;
}

async function storeEpiProcessMedia({ req, processId, kind, itemKey = null, captureContext = 'original', imageData, deviceInfo, latitude, longitude }) {
  const captured = parseCapturedImage(imageData);
  const normalizedLatitude = capturedCoordinate(latitude, -90, 90);
  const normalizedLongitude = capturedCoordinate(longitude, -180, 180);
  const locationLabel = await approximateLocationLabel(normalizedLatitude, normalizedLongitude);
  const userAgent = req.get('user-agent') || null;
  const directory = path.join(selfieStoragePath, 'epi-processes');
  await fs.promises.mkdir(directory, { recursive: true });
  const fileName = `process-${processId}-${req.user.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${captured.extension}`;
  const absolutePath = path.join(directory, fileName);
  await fs.promises.writeFile(absolutePath, captured.imageBuffer, { flag: 'wx' });
  const sha256 = crypto.createHash('sha256').update(captured.imageBuffer).digest('hex');
  const result = await pool.query(
    `INSERT INTO epi_process_media
      (process_id, uploaded_by, kind, item_key, capture_context, file_name, file_path, mime_type, byte_size, sha256, device_info,
       ip_address, user_agent, latitude, longitude, location_label)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING id, process_id, kind, item_key, capture_context, mime_type, byte_size, sha256, device_info, ip_address, user_agent, latitude, longitude, location_label, created_at`,
    [processId, req.user.id, kind, cleanText(itemKey, 120) || null, cleanText(captureContext, 40) || 'original', fileName, absolutePath, captured.mimeType, captured.imageBuffer.length, sha256, cleanText(deviceInfo, 240) || null, clientIp(req), userAgent, normalizedLatitude, normalizedLongitude, locationLabel],
  );
  return result.rows[0];
}

async function storeVehicleChecklistMedia({ req, checklistId, imageData, kind = 'vehicle_photo', itemKey = null, captureContext = 'original', deviceInfo, latitude, longitude }) {
  const captured = parseCapturedImage(imageData);
  const normalizedLatitude = capturedCoordinate(latitude, -90, 90);
  const normalizedLongitude = capturedCoordinate(longitude, -180, 180);
  const locationLabel = await approximateLocationLabel(normalizedLatitude, normalizedLongitude);
  const userAgent = req.get('user-agent') || null;
  const directory = path.join(selfieStoragePath, 'vehicle-checklists');
  await fs.promises.mkdir(directory, { recursive: true });
  const mediaKind = kind === 'selfie' ? 'selfie' : 'vehicle_photo';
  const fileName = `vehicle-${mediaKind}-${checklistId}-${req.user.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${captured.extension}`;
  const absolutePath = path.join(directory, fileName);
  await fs.promises.writeFile(absolutePath, captured.imageBuffer, { flag: 'wx' });
  const sha256 = crypto.createHash('sha256').update(captured.imageBuffer).digest('hex');
  const result = await pool.query(
    `INSERT INTO vehicle_checklist_media
      (checklist_id, uploaded_by, kind, item_key, capture_context, file_name, file_path, mime_type, byte_size, sha256, device_info,
       ip_address, user_agent, latitude, longitude, location_label)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING id, checklist_id, kind, item_key, capture_context, mime_type, byte_size, sha256, device_info, ip_address, user_agent, latitude, longitude, location_label, created_at`,
    [checklistId, req.user.id, mediaKind, cleanText(itemKey, 120) || null, cleanText(captureContext, 40) || 'original', fileName, absolutePath, captured.mimeType, captured.imageBuffer.length, sha256, cleanText(deviceInfo, 240) || null, clientIp(req), userAgent, normalizedLatitude, normalizedLongitude, locationLabel],
  );
  return result.rows[0];
}

const epiProcessQuery = `
  SELECT p.*,
    creator.name AS creator_name, creator.email AS creator_email,
    creator.signature_data AS creator_signature_data,
    validator.name AS validator_name, validator.role AS validator_role,
    target.name AS target_name, target.role AS target_role,
    validated.name AS validated_by_name, validated.role AS validated_by_role,
    company.trade_name AS company_trade_name, company.legal_name AS company_legal_name, company.cnpj AS company_cnpj,
    company.logo_data AS company_logo_data_current, company.logo_mime_type AS company_logo_mime_type_current,
    COALESCE((
      SELECT JSON_AGG(JSON_BUILD_OBJECT(
        'id', i.id,
        'ppeItemId', i.ppe_item_id,
        'equipmentName', i.equipment_name,
        'quantity', i.quantity,
        'ca', i.ca,
        'condition', i.condition,
        'checkStatus', CASE WHEN p.process_type = 'checklist_diario' THEN i.condition ELSE NULL END,
        'observation', i.observation,
        'itemKey', i.item_key,
        'section', i.section,
        'replacementRequested', i.replacement_requested
        ,'replacementEffective', i.replacement_effective,
        'replacementEffectiveAt', i.replacement_effective_at
      ) ORDER BY i.id)
      FROM epi_process_items i WHERE i.process_id = p.id
    ), '[]'::json) AS items,
    COALESCE((
      SELECT JSON_AGG(JSON_BUILD_OBJECT(
        'id', m.id,
        'kind', m.kind,
        'itemKey', m.item_key,
        'captureContext', m.capture_context,
        'mimeType', m.mime_type,
        'byteSize', m.byte_size,
        'sha256', m.sha256,
        'deviceInfo', m.device_info,
        'ipAddress', m.ip_address,
        'userAgent', m.user_agent,
        'latitude', m.latitude,
        'longitude', m.longitude,
        'locationLabel', m.location_label,
        'createdAt', m.created_at
      ) ORDER BY m.created_at, m.id)
      FROM epi_process_media m WHERE m.process_id = p.id
    ), '[]'::json) AS media
  FROM epi_processes p
  JOIN users creator ON creator.id = p.created_by
  LEFT JOIN users validator ON validator.id = p.validator_user_id
  LEFT JOIN users target ON target.id = p.target_user_id
  LEFT JOIN users validated ON validated.id = p.validated_by
  LEFT JOIN company_settings company ON company.id = 1
`;

function publicEpiProcess(row, includeSignatureData = false) {
  const media = row.media || [];
  const companyName = row.company_trade_name || row.company_legal_name || DEFAULT_COMPANY_SETTINGS.tradeName;
  const companyCnpj = row.company_cnpj || DEFAULT_COMPANY_SETTINGS.cnpj;
  const companyLogoData = row.company_logo_data || row.company_logo_data_current || null;
  const companyLogoMimeType = row.company_logo_mime_type || row.company_logo_mime_type_current || null;
  const responsibilityTerm = row.process_type === 'checklist_diario' ? {
    title: 'CHECKLIST DIÁRIO DE EPI',
    companyName,
    companyCnpj,
    companyLogoData,
    companyLogoMimeType,
    intro: 'Declaro que realizei, nesta data, a verificação dos EPIs e itens de segurança indicados neste checklist antes do início da atividade.',
    clauses: [
      'A resposta “Sim” registra que o EPI ou item de segurança estava disponível ou atendia à verificação no momento do checklist.',
      'A resposta “Não” ou “N/A” deve ser comunicada ao responsável antes do início da atividade, conforme aplicável.',
      'As respostas e observações correspondem à situação encontrada no momento do registro.',
    ],
    legalText: TERM_LEGAL_TEXT,
    signerName: row.creator_name,
    signedAt: row.signature_validated_at || row.created_at,
    signatureHash: row.signature_hash,
    signatureData: includeSignatureData ? row.creator_signature_data : undefined,
  } : null;
  return {
    id: row.id,
    processType: row.process_type,
    processTitle: epiProcessTitle(row.process_type),
    companyName,
    companyCnpj,
    createdBy: { id: row.created_by, name: row.creator_name, email: row.creator_email },
    validatorUserId: row.validator_user_id,
    validatorName: row.validator_name || null,
    validatorRole: row.validator_role || null,
    targetUserId: row.target_user_id,
    targetName: row.target_name || null,
    targetRole: row.target_role || null,
    status: row.status,
    termVersion: row.term_version,
    termText: EPI_PROCESS_LEGAL_TEXT[row.process_type] || null,
    companyLogoData,
    companyLogoMimeType,
    responsibilityTerm,
    signatureValidatedAt: row.signature_validated_at,
    signerSignatureHash: row.signer_signature_hash,
    signatureDocumentHash: row.signature_document_hash,
    signatureHash: row.signature_hash,
    signatureData: includeSignatureData ? row.creator_signature_data : undefined,
    submittedAt: row.submitted_at,
    adminAttentionRequired: Boolean(row.admin_attention_required),
    adminAttentionReasons: Array.isArray(row.admin_attention_reasons) ? row.admin_attention_reasons : [],
    attentionStatus: row.attention_status || (row.admin_attention_required ? 'pending_admin' : 'none'),
    attentionCorrectionPermissions: row.attention_correction_permissions || {},
    attentionRevision: Number(row.attention_revision || 0),
    attentionSentBackAt: row.attention_sent_back_at,
    attentionReturnedAt: row.attention_returned_at,
    attentionConfirmedAt: row.attention_confirmed_at,
    attentionDocumentHash: row.attention_document_hash,
    attentionSignatureHash: row.attention_signature_hash,
    validatedBy: row.validated_by,
    validatedByName: row.validated_by_name || null,
    validatedByRole: row.validated_by_role || null,
    validatedAt: row.validated_at,
    validationNotes: row.validation_notes,
    validationSignatureHash: row.validation_signature_hash,
    validationSignatureTypedName: row.validation_signature_typed_name || null,
    validationSignatureDocumentHash: row.validation_signature_document_hash,
    validationSignatureValidatedAt: row.validation_signature_validated_at,
    validationSignatureData: includeSignatureData ? row.validation_signature_data : undefined,
    createdAt: row.created_at,
    items: (row.items || []).map((item) => ({
      ...item,
      replacementRequested: Boolean(item.replacementRequested),
      replacementEffective: Boolean(item.replacementEffective),
      finalObservation: epiProcessTermObservation(row, item),
    })),
    media: media.map((item) => ({
      id: item.id,
      kind: item.kind,
      itemKey: item.itemKey,
      captureContext: item.captureContext || 'original',
      mimeType: item.mimeType,
      byteSize: item.byteSize,
      sha256: item.sha256,
      deviceInfo: item.deviceInfo,
      ipAddress: item.ipAddress,
      userAgent: item.userAgent,
      latitude: item.latitude,
      longitude: item.longitude,
      locationLabel: item.locationLabel,
      createdAt: item.createdAt,
    })),
    selfieCount: media.filter((item) => item.kind === 'selfie').length,
    photoCount: media.filter((item) => item.kind === 'epi_photo').length,
  };
}

function epiProcessSignatureItems(items) {
  return (items || []).map((item) => {
    const normalized = {
      equipmentName: item.equipmentName,
      quantity: Number(item.quantity),
      ca: item.ca || '',
      condition: item.condition || '',
      observation: item.observation || '',
    };
    if (item.ppeItemId !== null && item.ppeItemId !== undefined) normalized.ppeItemId = String(item.ppeItemId);
    if (item.replacementRequested === true) normalized.replacementRequested = true;
    return normalized;
  });
}

function epiProcessCorrectionSignatureItems(items) {
  return (items || []).map((item) => ({
    ...epiProcessSignatureItems([item])[0],
    replacementEffective: Boolean(item.replacementEffective),
  }));
}

function epiProcessDocumentHash({ row, items, schema = 'sigos-epi-process-v1', baseDocumentHash = null, revision = null }) {
  return sha256Json({
    schema,
    processId: String(row.id),
    processType: row.process_type,
    termVersion: row.term_version,
    createdBy: String(row.created_by),
    targetUserId: row.target_user_id ? String(row.target_user_id) : null,
    validatorUserId: row.validator_user_id ? String(row.validator_user_id) : null,
    ...(baseDocumentHash ? { baseDocumentHash } : {}),
    ...(revision !== null ? { revision: Number(revision) } : {}),
    items: schema === 'sigos-epi-process-correction-v1'
      ? epiProcessCorrectionSignatureItems(items)
      : epiProcessSignatureItems(items),
  });
}

function canAccessEpiProcess(user, row) {
  return isChecklistValidatorRole(user.role)
    || String(row.created_by) === String(user.id)
    || String(row.validator_user_id || '') === String(user.id)
    || String(row.target_user_id || '') === String(user.id);
}

async function getEpiProcess(id, user) {
  const result = await pool.query(`${epiProcessQuery} WHERE p.id = $1`, [id]);
  const row = result.rows[0];
  if (!row || !canAccessEpiProcess(user, row)) return null;
  return row;
}

async function getTodaysDailyEpiProcess(userId, db = pool) {
  const result = await db.query(
    `${epiProcessQuery}
     WHERE p.process_type = 'checklist_diario'
       AND p.created_by = $1
       AND timezone('America/Fortaleza', p.created_at)::date = timezone('America/Fortaleza', NOW())::date
     ORDER BY p.created_at DESC
     LIMIT 1`,
    [userId],
  );
  return result.rows[0] || null;
}

app.get('/api/epi/targets', auth, async (req, res) => {
  const result = await pool.query(
    `SELECT id, name, email, role
     FROM users
     WHERE active = TRUE AND id <> $1
     ORDER BY name`,
    [req.user.id],
  );
  res.json({ users: result.rows });
});

app.get('/api/epi/catalog', auth, requireRole('admin', 'tecnico'), async (req, res) => {
  const visibility = isAdminRole(req.user.role)
    ? ` WHERE active = TRUE OR (deactivated_at IS NOT NULL AND deactivated_at > NOW() - INTERVAL '7 days')`
    : ' WHERE active = TRUE';
  const result = await pool.query(
    `SELECT id, code, name, ca, category, stock_quantity, minimum_stock, active, deactivated_at
     FROM ppe_items${visibility}
     ORDER BY active DESC, name ASC, id ASC`,
  );
  res.json({ items: result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    ca: row.ca,
    category: row.category,
    stockQuantity: row.stock_quantity,
    minimumStock: row.minimum_stock,
    active: row.active,
  })) });
});

app.get('/api/epi/processes', auth, async (req, res) => {
  const canReviewAll = isChecklistValidatorRole(req.user.role);
  const visible = canReviewAll ? '' : ' WHERE p.created_by = $1 OR p.validator_user_id = $1 OR p.target_user_id = $1';
  const result = await pool.query(`${epiProcessQuery}${visible} ORDER BY p.created_at DESC LIMIT 100`, canReviewAll ? [] : [req.user.id]);
  res.json({ processes: result.rows.map((row) => publicEpiProcess(row)) });
});

app.get('/api/epi/processes/daily/today', auth, requireRole('tecnico'), async (req, res) => {
  const process = await getTodaysDailyEpiProcess(req.user.id);
  res.json({
    canStart: !process,
    existing: process ? publicEpiProcess(process) : null,
  });
});

app.get('/api/epi/processes/:id', auth, async (req, res) => {
  const row = await getEpiProcess(req.params.id, req.user);
  if (!row) return res.status(404).json({ error: 'Processo de EPI não encontrado.' });
  res.json({ process: publicEpiProcess(row, true) });
});

app.get('/api/epi/processes/:id/pdf', auth, async (req, res) => {
  const row = await getEpiProcess(req.params.id, req.user);
  if (!row) return res.status(404).json({ error: 'Processo de EPI não encontrado.' });
  res.setHeader('Content-Type', 'application/pdf');
  
  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margins: { top: 42, bottom: 42, left: 42, right: 42 } });
  doc.pipe(res);
  try {
    renderEpiProcessPdf(doc, row);
    doc.end();
  } catch (error) {
    console.error('Não foi possível gerar o PDF do processo EPI:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Não foi possível gerar o PDF do processo EPI.' });
    else res.destroy(error);
  }
});

app.post('/api/epi/processes', auth, requireRole('tecnico'), async (req, res) => {
  if (!isTechnicianOnboardingComplete(req.user)) return res.status(428).json({ code: 'ONBOARDING_REQUIRED', error: 'Conclua o primeiro acesso antes de iniciar um processo de EPI.' });
  const processType = String(req.body.processType || '');
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const validatorUserId = req.body.validatorUserId === null || req.body.validatorUserId === undefined || req.body.validatorUserId === '' ? null : Number(req.body.validatorUserId);
  const targetUserId = req.body.targetUserId === null || req.body.targetUserId === undefined || req.body.targetUserId === '' ? null : Number(req.body.targetUserId);
  const dailyDefinitions = processType === 'checklist_diario' ? await getDailyEpiChecklistDefinitions() : [];
  const dailyDefinitionsByKey = new Map(dailyDefinitions.map((item) => [item.key, item]));
  const requestedItems = items.map((item) => ({
    ppeItemId: item.ppeItemId === null || item.ppeItemId === undefined || item.ppeItemId === '' ? null : Number(item.ppeItemId),
    itemKey: cleanText(item.itemKey, 120),
    equipmentName: cleanText(item.equipmentName, 180),
    quantity: Number(item.quantity),
    ca: cleanText(item.ca, 80),
    condition: cleanText(item.condition, 40),
    observation: cleanText(item.observation, 180),
    replacementRequested: item.replacementRequested === true,
  })).filter((item) => item.ppeItemId || item.equipmentName);
  if (!EPI_PROCESS_TYPES.includes(processType)) return res.status(400).json({ error: 'Selecione um tipo de processo EPI.' });
  if (!req.user.signature_data || !req.user.signature_hash) return res.status(400).json({ error: 'Cadastre sua assinatura padrão antes de iniciar um processo.' });
  const hasInvalidQuantity = requestedItems.some((item) => {
    if (processType === 'checklist_diario') {
      const definition = dailyDefinitionsByKey.get(item.itemKey);
      return definition?.section === 'verificacao' && (!Number.isInteger(item.quantity) || item.quantity < 1);
    }
    return !Number.isInteger(item.quantity) || item.quantity < 1;
  });
  if (!requestedItems.length || hasInvalidQuantity) {
    return res.status(400).json({ error: 'Informe pelo menos um EPI com quantidade válida.' });
  }
  if (processType === 'checklist_diario') {
    const expectedKeys = dailyDefinitions.map((item) => item.key);
    const submittedKeys = requestedItems.map((item) => item.itemKey);
    const hasAllItems = expectedKeys.length === submittedKeys.length && expectedKeys.every((key) => submittedKeys.includes(key));
    if (!hasAllItems) return res.status(400).json({ error: 'O checklist diário precisa conter todas as etapas padrão.' });
    if (requestedItems.some((item) => !['sim', 'nao', 'na'].includes(String(item.condition).toLowerCase()))) {
      return res.status(400).json({ error: 'Responda cada etapa do checklist diário com Sim, Não ou N/A.' });
    }
  }

  const catalogById = new Map();
  const requestedCatalogIds = processType === 'checklist_diario'
    ? dailyDefinitions.filter((item) => Number.isInteger(item.ppeItemId)).map((item) => item.ppeItemId)
    : requestedItems.filter((item) => Number.isInteger(item.ppeItemId)).map((item) => item.ppeItemId);
  if (requestedCatalogIds.length) {
    const catalogResult = await pool.query(
      `SELECT id, name, ca FROM ppe_items WHERE id = ANY($1::bigint[]) AND active = TRUE`,
      [requestedCatalogIds],
    );
    catalogResult.rows.forEach((item) => catalogById.set(Number(item.id), item));
  }
  const normalizedItems = [];
  for (const item of requestedItems) {
    if (processType === 'checklist_diario') {
      const definition = dailyDefinitionsByKey.get(item.itemKey);
      const catalog = Number.isInteger(definition?.ppeItemId) ? catalogById.get(definition.ppeItemId) : null;
      if (!definition) return res.status(400).json({ error: 'Etapa de checklist diário inválida.' });
      if (definition.section === 'verificacao' && !catalog) return res.status(400).json({ error: 'Um dos EPIs selecionados foi desativado. Atualize o checklist e tente novamente.' });
      normalizedItems.push({
        ppeItemId: catalog ? Number(catalog.id) : null,
        equipmentName: definition.label,
        quantity: definition.section === 'verificacao' ? item.quantity : 1,
        ca: catalog?.ca || '',
        condition: String(item.condition).toLowerCase(),
        observation: definition.section === 'verificacao' ? item.observation : null,
        replacementRequested: definition.section === 'verificacao' && item.replacementRequested === true,
        itemKey: definition.key,
        section: definition.section,
      });
      continue;
    }
    let catalog = Number.isInteger(item.ppeItemId) ? catalogById.get(item.ppeItemId) : null;
    if (!catalog && (item.equipmentName || item.ca)) {
      const fallback = await pool.query(
        `SELECT id, name, ca FROM ppe_items
         WHERE active = TRUE AND (LOWER(name) = LOWER($1) OR ($2::text <> '' AND UPPER(COALESCE(ca, '')) = UPPER($2)))
         ORDER BY id ASC LIMIT 1`,
        [item.equipmentName, item.ca || ''],
      );
      catalog = fallback.rows[0];
    }
    if (!catalog) return res.status(400).json({ error: 'Selecione somente EPIs cadastrados e ativos no Estoque.' });
    normalizedItems.push({
      ppeItemId: Number(catalog.id),
      equipmentName: catalog.name,
      quantity: item.quantity,
      ca: catalog.ca || '',
      condition: item.condition,
      observation: item.observation,
      itemKey: null,
      section: null,
    });
  }

  let validator = null;
  let target = null;
  if (processType === 'devolucao') {
    if (!Number.isInteger(validatorUserId)) return res.status(400).json({ error: 'Selecione um supervisor ou administrador para validar a devolução.' });
    const result = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND active = TRUE', [validatorUserId]);
    validator = result.rows[0];
    if (!validator || !(isAdminRole(validator.role) || validator.role === 'vistoriador')) return res.status(400).json({ error: 'O responsável pela devolução precisa ser um supervisor ou administrador ativo.' });
  }
  if (processType === 'transferencia') {
    if (!Number.isInteger(targetUserId) || String(targetUserId) === String(req.user.id)) return res.status(400).json({ error: 'Selecione outro usuário para receber a transferência.' });
    const result = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND active = TRUE', [targetUserId]);
    target = result.rows[0];
    if (!target) return res.status(400).json({ error: 'O usuário escolhido não está ativo.' });
    validator = target;
  }

  const legalText = EPI_PROCESS_LEGAL_TEXT[processType];
  const companySettings = publicCompanySettings(await getCompanySettings());
  const client = await pool.connect();
  let processId;
  let documentHash;
  let signatureHash;
  try {
    await client.query('BEGIN');
    if (processType === 'checklist_diario') {
      // Serializa duas tentativas simultâneas do mesmo usuário no mesmo dia
      // antes de consultar e inserir o processo.
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtext('epi-daily:' || $1::text || ':' || timezone('America/Fortaleza', NOW())::date::text))`,
        [req.user.id],
      );
      const existingDaily = await getTodaysDailyEpiProcess(req.user.id, client);
      if (existingDaily) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          code: 'DAILY_CHECKLIST_EXISTS',
          error: 'Você já possui um checklist diário registrado hoje. Abra o checklist existente para continuar.',
          process: publicEpiProcess(existingDaily),
        });
      }
    }
    const created = await client.query(
      `INSERT INTO epi_processes
        (process_type, created_by, validator_user_id, target_user_id, status, term_version,
         company_logo_data, company_logo_mime_type, signature_validated_at, signer_signature_hash)
       VALUES ($1, $2, $3, $4, 'aguarda_selfie', $5, $6, $7, NOW(), $8)
       RETURNING id`,
      [processType, req.user.id, validator?.id || null, target?.id || null, legalText.version, companySettings.logoData, companySettings.logoMimeType, req.user.signature_hash],
    );
    processId = created.rows[0].id;
    for (const item of normalizedItems) {
      await client.query(
        `INSERT INTO epi_process_items (process_id, ppe_item_id, equipment_name, quantity, ca, condition, observation, item_key, section, replacement_requested)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [processId, item.ppeItemId, item.equipmentName, item.quantity, item.ca || null, item.condition || null, item.observation || null, item.itemKey || null, item.section || null, item.replacementRequested === true],
      );
    }
    documentHash = sha256Json({
      schema: 'sigos-epi-process-v1',
      processId: String(processId),
      processType,
      termVersion: legalText.version,
      createdBy: String(req.user.id),
      targetUserId: target?.id ? String(target.id) : null,
      validatorUserId: validator?.id ? String(validator.id) : null,
      items: epiProcessSignatureItems(normalizedItems),
    });
    signatureHash = sha256Json({ algorithm: 'SHA-256', version: 1, signerSignatureHash: req.user.signature_hash, documentHash });
    await client.query(
      `UPDATE epi_processes SET signature_document_hash = $1, signature_hash = $2 WHERE id = $3`,
      [documentHash, signatureHash, processId],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await audit({ req, actorUserId: req.user.id, eventType: 'epi_process_created', entityType: 'epi_process', entityId: processId, metadata: { processType, itemCount: normalizedItems.length, validatorUserId: validator?.id || null, targetUserId: target?.id || null, termVersion: legalText.version } });
  await audit({ req, actorUserId: req.user.id, eventType: 'epi_process_signature_validated', entityType: 'epi_process', entityId: processId, metadata: { signatureHash, documentHash, signerSignatureHash: req.user.signature_hash, termVersion: legalText.version } });
  if (processType === 'transferencia') {
    await notifyRoles({ roles: ['admin'], notificationType: 'epi_transfer_started', title: 'Transferência de EPI iniciada', message: `${req.user.name} iniciou uma transferência de EPI para ${target.name}.`, entityType: 'epi_process', entityId: processId, metadata: { processType, targetUserId: target.id } });
  }
  const created = await pool.query(`${epiProcessQuery} WHERE p.id = $1`, [processId]);
  res.status(201).json({ process: publicEpiProcess(created.rows[0], true) });
});

app.post('/api/epi/processes/:id/selfie', auth, uploadRateLimit, async (req, res) => {
  const row = await getEpiProcess(req.params.id, req.user);
  if (!row) return res.status(404).json({ error: 'Processo de EPI não encontrado.' });
  if (String(row.created_by) !== String(req.user.id)) return res.status(403).json({ error: 'Somente o usuário que iniciou o processo pode registrar a selfie.' });
  if (row.status !== 'aguarda_selfie') return res.status(409).json({ error: 'A etapa da selfie não está disponível para este processo.' });
  if (req.body.captureMode !== 'camera') return res.status(400).json({ error: 'A selfie precisa ser capturada pela câmera no momento do registro.' });
  const media = await storeEpiProcessMedia({ req, processId: row.id, kind: 'selfie', imageData: req.body.imageData, deviceInfo: req.body.deviceInfo, latitude: req.body.latitude, longitude: req.body.longitude });
  await pool.query(`UPDATE epi_processes SET status = 'aguarda_fotos' WHERE id = $1`, [row.id]);
  await audit({ req, actorUserId: req.user.id, eventType: 'epi_process_selfie_uploaded', entityType: 'epi_process', entityId: row.id, metadata: { mediaId: media.id, sha256: media.sha256, byteSize: media.byte_size, captureMode: 'camera', latitude: media.latitude, longitude: media.longitude, locationLabel: media.location_label } });
  const updated = await pool.query(`${epiProcessQuery} WHERE p.id = $1`, [row.id]);
  res.json({ process: publicEpiProcess(updated.rows[0], true) });
});

app.post('/api/epi/processes/:id/photos', auth, uploadRateLimit, async (req, res) => {
  const row = await getEpiProcess(req.params.id, req.user);
  if (!row) return res.status(404).json({ error: 'Processo de EPI não encontrado.' });
  if (String(row.created_by) !== String(req.user.id)) return res.status(403).json({ error: 'Somente o usuário que iniciou o processo pode registrar as fotos.' });
  if (row.status !== 'aguarda_fotos') return res.status(409).json({ error: 'A etapa das fotos não está disponível para este processo.' });
  const photos = Array.isArray(req.body.photos) ? req.body.photos : [];
  if ((!photos.length && row.process_type !== 'checklist_diario') || photos.length > 5) return res.status(400).json({ error: 'Envie até cinco fotos capturadas pela câmera.' });
  if (photos.some((photo) => photo?.captureMode !== 'camera')) return res.status(400).json({ error: 'As fotos precisam ser capturadas pela câmera no momento do registro.' });
  if (row.process_type === 'checklist_diario') {
    const validItemKeys = new Set((row.items || []).filter((item) => item.section === 'verificacao').map((item) => item.itemKey).filter(Boolean));
    const submittedItemKeys = photos.map((photo) => String(photo.itemKey || ''));
    if (submittedItemKeys.some((itemKey) => !validItemKeys.has(itemKey))) return res.status(400).json({ error: 'Cada foto do checklist diário deve estar vinculada a uma etapa da verificação dos EPIs.' });
    if (new Set(submittedItemKeys).size !== submittedItemKeys.length) return res.status(400).json({ error: 'Use no máximo uma foto por etapa do checklist diário.' });
  }
  const media = [];
  for (const photo of photos) media.push(await storeEpiProcessMedia({ req, processId: row.id, kind: 'epi_photo', itemKey: row.process_type === 'checklist_diario' ? photo.itemKey : null, imageData: photo.imageData, deviceInfo: req.body.deviceInfo, latitude: photo.latitude ?? req.body.latitude, longitude: photo.longitude ?? req.body.longitude }));
  const stockClient = row.process_type === 'checklist_diario' ? await pool.connect() : null;
  try {
    if (stockClient) {
      await stockClient.query('BEGIN');
      await applyEpiProcessStockMovements(stockClient, row, req.user.id);
      await stockClient.query(
        `UPDATE epi_processes
         SET status = 'pendente_validacao', submitted_at = NOW()
         WHERE id = $1`,
        [row.id],
      );
      await stockClient.query('COMMIT');
    } else {
      await pool.query(`UPDATE epi_processes SET status = 'pendente_validacao', submitted_at = NOW() WHERE id = $1`, [row.id]);
    }
  } catch (error) {
    if (stockClient) {
      await stockClient.query('ROLLBACK');
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    }
    throw error;
  } finally {
    stockClient?.release();
  }
  await audit({ req, actorUserId: req.user.id, eventType: 'epi_process_photos_uploaded', entityType: 'epi_process', entityId: row.id, metadata: { mediaIds: media.map((item) => item.id), itemKeys: media.map((item) => item.item_key).filter(Boolean), photoCount: media.length, captureMode: 'camera', signatureHash: row.signature_hash, documentHash: row.signature_document_hash, termVersion: row.term_version, coordinates: media.map((item) => ({ mediaId: item.id, itemKey: item.item_key, latitude: item.latitude, longitude: item.longitude, locationLabel: item.location_label })) } });
  const replacementItems = row.process_type === 'checklist_diario'
    ? (row.items || []).filter((item) => item.section === 'verificacao' && item.replacementRequested === true)
    : [];
  const negativeInspectionItems = row.process_type === 'checklist_diario'
    ? (row.items || []).filter((item) => item.section === 'inspecao' && String(item.condition || '').toLowerCase() === 'nao')
    : [];
  const replacementReasons = replacementItems.map((item) => ({
    type: 'replacement_request',
    itemKey: item.itemKey,
    equipmentName: item.equipmentName,
    ppeItemId: item.ppeItemId || null,
    quantity: item.quantity,
  }));
  const negativeReasons = negativeInspectionItems.map((item) => ({
    type: 'negative_inspection',
    itemKey: item.itemKey,
    equipmentName: item.equipmentName,
    observation: item.observation || null,
  }));
  const attentionReasons = [...replacementReasons, ...negativeReasons];
  if (attentionReasons.length) {
    await pool.query(
      `UPDATE epi_processes
       SET admin_attention_required = TRUE, admin_attention_reasons = $2::jsonb, attention_status = 'pending_admin', attention_revision = 0,
           attention_correction_permissions = '{}'::jsonb, attention_sent_back_at = NULL, attention_returned_at = NULL,
           attention_confirmed_at = NULL, attention_document_hash = NULL, attention_signature_hash = NULL
       WHERE id = $1`,
      [row.id, JSON.stringify(attentionReasons)],
    );
    const replacementSummary = replacementItems.length
      ? `solicitação de troca: ${replacementItems.map((item) => `${item.equipmentName}${item.quantity > 1 ? ` (${item.quantity})` : ''}`).join(', ')}`
      : '';
    const negativeSummary = negativeInspectionItems.length
      ? `resposta “Não” na inspeção: ${negativeInspectionItems.map((item) => item.equipmentName).join(', ')}`
      : '';
    const attentionSummary = [replacementSummary, negativeSummary].filter(Boolean).join('; ');
    await notifyRoles({
      roles: ['admin'],
      notificationType: 'epi_process_attention',
      title: 'Checklist de EPI requer atenção',
      message: `${req.user.name} concluiu um checklist com ${attentionSummary}. Verifique o processo.`,
      entityType: 'epi_process',
      entityId: row.id,
      metadata: { processType: row.process_type, attentionReasons },
    });
    if (replacementItems.length || negativeInspectionItems.length) {
      await notifyUsers({
        userIds: [req.user.id],
        notificationType: replacementItems.length ? 'epi_replacement_requested' : 'epi_process_attention',
        title: replacementItems.length ? 'Solicitação de troca registrada' : 'Checklist requer atenção',
        message: replacementItems.length
          ? `Sua solicitação de troca foi registrada${negativeInspectionItems.length ? ` e houve resposta “Não” em: ${negativeInspectionItems.map((item) => item.equipmentName).join(', ')}` : ''}. Entre em contato com o administrador.`
          : `Seu checklist teve resposta “Não” em: ${negativeInspectionItems.map((item) => item.equipmentName).join(', ')}. Entre em contato com o administrador.`,
        entityType: 'epi_process',
        entityId: row.id,
        metadata: { processType: row.process_type, attentionReasons },
      });
    }
    await audit({
      req,
      actorUserId: req.user.id,
      eventType: 'epi_process_attention',
      entityType: 'epi_process',
      entityId: row.id,
      metadata: { attentionReasons },
    });
  }
  const recipientIds = [row.validator_user_id, row.target_user_id].filter((id) => id && String(id) !== String(req.user.id));
  if (recipientIds.length) await notifyUsers({ userIds: recipientIds, notificationType: 'epi_process_pending_validation', title: `${epiProcessTitle(row.process_type)} aguardando validação`, message: `${req.user.name} enviou um processo de EPI para sua validação.`, entityType: 'epi_process', entityId: row.id, metadata: { processType: row.process_type } });
  await notifyRoles({ roles: ['admin', 'vistoriador'], notificationType: 'epi_process_pending_validation', title: 'Processo de EPI aguardando validação', message: `${req.user.name} concluiu um processo de EPI e aguarda validação.`, entityType: 'epi_process', entityId: row.id, metadata: { processType: row.process_type, createdBy: req.user.id } });
  const updated = await pool.query(`${epiProcessQuery} WHERE p.id = $1`, [row.id]);
  res.json({ process: publicEpiProcess(updated.rows[0], true) });
});

app.post('/api/epi/processes/:id/validate', auth, async (req, res) => {
  const row = await getEpiProcess(req.params.id, req.user);
  if (!row) return res.status(404).json({ error: 'Processo de EPI não encontrado.' });
  const canValidate = isChecklistValidatorRole(req.user.role) || String(row.validator_user_id || '') === String(req.user.id);
  if (!canValidate) return res.status(403).json({ error: 'Este processo não está atribuído para sua validação.' });
  if (row.status !== 'pendente_validacao') return res.status(409).json({ error: 'Este processo ainda não está pronto para validação.' });
  const decision = String(req.body.decision || 'validado') === 'reprovado' ? 'reprovado' : 'validado';
  const validationNotes = cleanText(req.body.notes, 500) || null;
  const isValidatorValidation = isChecklistValidatorRole(req.user.role);
  if (isValidatorValidation && !req.user.signature_data) {
    return res.status(409).json({ code: 'VALIDATOR_SIGNATURE_REQUIRED', error: 'Cadastre sua assinatura padrão antes de validar este processo.' });
  }
  if (isValidatorValidation && req.body.signatureConfirmed !== true) {
    return res.status(400).json({ code: 'VALIDATOR_SIGNATURE_CONFIRMATION_REQUIRED', error: 'Confirme o uso da sua assinatura padrão para validar este processo.' });
  }
  if (isValidatorValidation) {
    const expectedUserSignatureHash = sha256Json({ algorithm: 'SHA-256', version: 1, userId: String(req.user.id), signatureData: req.user.signature_data });
    if (!equalHash(req.user.signature_hash, expectedUserSignatureHash)) {
      return res.status(409).json({ code: 'VALIDATOR_SIGNATURE_INVALID', error: 'A assinatura padrão do responsável não confere. Cadastre-a novamente em Segurança.' });
    }
  }
  const validationSelfie = req.body.validationSelfie && typeof req.body.validationSelfie === 'object' ? req.body.validationSelfie : null;
  if (isValidatorValidation && (!validationSelfie || validationSelfie.captureMode !== 'camera' || !validationSelfie.imageData)) {
    return res.status(400).json({ code: 'VALIDATOR_SELFIE_REQUIRED', error: 'Capture uma selfie pela câmera antes de validar este processo.' });
  }
  if (isValidatorValidation) {
    try { parseCapturedImage(validationSelfie.imageData); } catch (error) { return res.status(400).json({ code: 'VALIDATOR_SELFIE_INVALID', error: error.message }); }
  }
  const items = row.items || [];
  const attentionStatus = row.attention_status || (row.admin_attention_required ? 'pending_admin' : 'none');
  const isAttentionCorrection = row.admin_attention_required === true;
  if (isAttentionCorrection) {
    if (attentionStatus !== 'returned_to_admin') {
      return res.status(409).json({ code: 'ATTENTION_REQUIRES_TECHNICIAN_CONFIRMATION', error: 'Este checklist requer retorno do técnico com nova selfie antes da aprovação.' });
    }
    const replacementItems = items.filter((item) => item.section === 'verificacao' && item.replacementRequested === true);
    if (replacementItems.some((item) => item.replacementEffective !== true)) {
      return res.status(409).json({ code: 'REPLACEMENT_NOT_EFFECTIVE', error: 'Marque todas as trocas como efetivadas antes de aprovar o checklist.' });
    }
    if (replacementItems.some((item) => String(item.condition || '').toLowerCase() !== 'sim')) {
      return res.status(409).json({ code: 'REPLACEMENT_STATUS_NOT_CONFIRMED', error: 'O técnico ainda não confirmou que está com todos os EPIs substituídos.' });
    }
    if (items.some((item) => item.section === 'inspecao' && String(item.condition || '').toLowerCase() === 'nao')) {
      return res.status(409).json({ code: 'NEGATIVE_INSPECTION_REMAINS', error: 'Ainda existe uma resposta “Não” na inspeção do técnico.' });
    }
    if (!row.attention_confirmed_at || !row.attention_confirmed_by || !(row.media || []).some((media) => media.kind === 'selfie' && media.captureContext === 'attention_correction')) {
      return res.status(409).json({ code: 'TECHNICIAN_CONFIRMATION_REQUIRED', error: 'A confirmação do técnico e a nova selfie são obrigatórias antes da aprovação.' });
    }
  }
  const expectedDocumentHash = isAttentionCorrection
    ? epiProcessDocumentHash({ row, items, schema: 'sigos-epi-process-correction-v1', baseDocumentHash: row.signature_document_hash, revision: row.attention_revision })
    : epiProcessDocumentHash({ row, items });
  const expectedSignatureHash = sha256Json({ algorithm: 'SHA-256', version: 1, signerSignatureHash: row.signer_signature_hash, documentHash: expectedDocumentHash });
  const storedDocumentHash = isAttentionCorrection ? row.attention_document_hash : row.signature_document_hash;
  const storedSignatureHash = isAttentionCorrection ? row.attention_signature_hash : row.signature_hash;
  if (!equalHash(storedDocumentHash, expectedDocumentHash) || !equalHash(storedSignatureHash, expectedSignatureHash)) {
    return res.status(409).json({ error: isAttentionCorrection ? 'A confirmação do técnico ou o conteúdo corrigido não conferem com o registro.' : 'A assinatura padrão ou o conteúdo do termo não conferem com o registro original.' });
  }
  const validationSignatureAt = new Date();
  const validationSignatureAtIso = validationSignatureAt.toISOString();
  const validationSignatureDocumentHash = isValidatorValidation ? sha256Json({
    schema: 'sigos-epi-admin-validation-v1',
    processId: String(row.id),
    decision,
    validationNotes,
    originalDocumentHash: storedDocumentHash,
    originalSignatureHash: storedSignatureHash,
    validatorUserId: String(req.user.id),
    validatorRole: req.user.role,
    validatedAt: validationSignatureAtIso,
  }) : null;
  const validationSignatureHash = isValidatorValidation ? sha256Json({
    algorithm: 'SHA-256',
    version: 1,
    signerSignatureHash: req.user.signature_hash,
    documentHash: validationSignatureDocumentHash,
  }) : null;
  let validationMedia = null;
  if (isValidatorValidation) {
    validationMedia = await storeEpiProcessMedia({
      req,
      processId: row.id,
      kind: 'selfie',
      captureContext: 'validation',
      imageData: validationSelfie.imageData,
      deviceInfo: validationSelfie.deviceInfo || req.body.deviceInfo,
      latitude: validationSelfie.latitude,
      longitude: validationSelfie.longitude,
    });
  }
  const client = await pool.connect();
  let updated;
  try {
    await client.query('BEGIN');
    updated = await client.query(
      `UPDATE epi_processes
       SET status = $1, attention_status = CASE WHEN admin_attention_required THEN 'resolved' ELSE attention_status END,
           validated_by = $2, validated_at = $5, validation_notes = $3,
           validation_signature_data = $6, validation_signature_hash = $7,
           validation_signature_typed_name = $8, validation_signature_document_hash = $9,
           validation_signature_validated_at = $5
       WHERE id = $4 AND status = 'pendente_validacao'
       RETURNING id, status, validated_at`,
      [decision, req.user.id, validationNotes, row.id, validationSignatureAt, isValidatorValidation ? req.user.signature_data : null, validationSignatureHash, isValidatorValidation ? req.user.name : null, validationSignatureDocumentHash],
    );
    if (!updated.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Este processo já foi validado por outra pessoa.' });
    }
    if (decision === 'validado') await applyEpiProcessStockMovements(client, row, req.user.id);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    throw error;
  } finally {
    client.release();
  }
  await audit({ req, actorUserId: req.user.id, eventType: 'epi_process_validated', entityType: 'epi_process', entityId: row.id, metadata: { decision, notes: validationNotes, signatureHash: storedSignatureHash, documentHash: storedDocumentHash, validationSignatureHash, validationSignatureDocumentHash, validationMediaId: validationMedia?.id || null, validatorSignatureConfirmed: isValidatorValidation, attentionRevision: row.attention_revision || 0 } });
  if (isValidatorValidation) await audit({ req, actorUserId: req.user.id, eventType: 'epi_process_validator_signature_validated', entityType: 'epi_process', entityId: row.id, metadata: { decision, validationSignatureHash, validationSignatureDocumentHash, validationMediaId: validationMedia?.id || null, originalDocumentHash: storedDocumentHash, validatorRole: req.user.role } });
  await notifyRoles({ roles: ['admin'], notificationType: 'epi_process_validated', title: 'Processo de EPI validado', message: `${epiProcessTitle(row.process_type)} foi ${decision === 'validado' ? 'validado' : 'reprovado'} por ${req.user.name}.`, entityType: 'epi_process', entityId: row.id, metadata: { processType: row.process_type, decision, validatedBy: req.user.id } });
  await notifyUsers({ userIds: [row.created_by, row.target_user_id].filter((id) => id && String(id) !== String(req.user.id)), notificationType: 'epi_process_validated', title: 'Processo de EPI atualizado', message: `${epiProcessTitle(row.process_type)} foi ${decision === 'validado' ? 'validado' : 'reprovado'}.`, entityType: 'epi_process', entityId: row.id, metadata: { processType: row.process_type, decision } });
  const finalRow = await pool.query(`${epiProcessQuery} WHERE p.id = $1`, [row.id]);
  res.json({ process: publicEpiProcess(finalRow.rows[0], true) });
});

app.post('/api/epi/processes/:id/attention/send-back', auth, requireRole('admin'), async (req, res) => {
  const row = await getEpiProcess(req.params.id, req.user);
  if (!row) return res.status(404).json({ error: 'Processo de EPI não encontrado.' });
  const attentionStatus = row.attention_status || (row.admin_attention_required ? 'pending_admin' : 'none');
  if (!row.admin_attention_required || !['pending_admin', 'returned_to_admin'].includes(attentionStatus)) {
    return res.status(409).json({ error: 'Este processo não está aguardando uma decisão de atenção do Admin.' });
  }
  if (row.status !== 'pendente_validacao') return res.status(409).json({ error: 'O processo precisa estar pendente de validação para ser devolvido ao técnico.' });
  const replacementItems = (row.items || []).filter((item) => item.section === 'verificacao' && item.replacementRequested === true);
  const allowedReplacementKeys = new Set(replacementItems.map((item) => String(item.itemKey || '')));
  const requestedEffectiveKeys = Array.isArray(req.body.replacementEffectiveItemKeys)
    ? req.body.replacementEffectiveItemKeys.map((key) => String(key)).filter((key) => allowedReplacementKeys.has(key))
    : [];
  const unknownEffectiveKey = Array.isArray(req.body.replacementEffectiveItemKeys)
    && req.body.replacementEffectiveItemKeys.some((key) => !allowedReplacementKeys.has(String(key)));
  if (unknownEffectiveKey) return res.status(400).json({ error: 'A troca efetivada referencia um item que não pertence a este processo.' });
  const allowInspectionEdits = req.body.allowInspectionEdits === true;
  const allowReplacementStatusEdits = req.body.allowReplacementStatusEdits === true;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE epi_process_items
       SET replacement_effective = (item_key = ANY($2::text[])),
           replacement_effective_at = CASE WHEN item_key = ANY($2::text[]) THEN NOW() ELSE NULL END,
           replacement_effective_by = CASE WHEN item_key = ANY($2::text[]) THEN $3::bigint ELSE NULL END
       WHERE process_id = $1 AND replacement_requested = TRUE`,
      [row.id, requestedEffectiveKeys, req.user.id],
    );
    await client.query(
      `UPDATE epi_processes
       SET status = 'aguarda_correcao_tecnico', attention_status = 'awaiting_technician',
           attention_correction_permissions = $2::jsonb, attention_sent_back_at = NOW(), attention_sent_back_by = $3,
           attention_returned_at = NULL, attention_returned_by = NULL, attention_confirmed_at = NULL, attention_confirmed_by = NULL,
           attention_document_hash = NULL, attention_signature_hash = NULL,
           validation_signature_data = NULL, validation_signature_hash = NULL,
           validation_signature_typed_name = NULL, validation_signature_document_hash = NULL,
           validation_signature_validated_at = NULL
       WHERE id = $1 AND status = 'pendente_validacao'`,
      [row.id, JSON.stringify({ allowInspectionEdits, allowReplacementStatusEdits }), req.user.id],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  const effectiveNames = replacementItems.filter((item) => requestedEffectiveKeys.includes(String(item.itemKey || ''))).map((item) => item.equipmentName);
  const permissionNames = [
    allowInspectionEdits ? 'correção das respostas “Não”' : '',
    allowReplacementStatusEdits ? 'alteração do status dos EPIs' : '',
  ].filter(Boolean);
  await audit({ req, actorUserId: req.user.id, eventType: 'epi_process_attention_sent_back', entityType: 'epi_process', entityId: row.id, metadata: { replacementEffectiveItemKeys: requestedEffectiveKeys, replacementEffectiveNames: effectiveNames, allowInspectionEdits, allowReplacementStatusEdits } });
  await notifyUsers({
    userIds: [row.created_by],
    notificationType: 'epi_process_attention_sent_back',
    title: 'Checklist devolvido para confirmação',
    message: `O administrador devolveu ${epiProcessTitle(row.process_type)} para confirmação com nova selfie${effectiveNames.length ? `. Troca efetivada: ${effectiveNames.join(', ')}` : ''}${permissionNames.length ? `. Você pode revisar: ${permissionNames.join(' e ')}` : '.'}`,
    entityType: 'epi_process',
    entityId: row.id,
    metadata: { replacementEffectiveNames: effectiveNames, allowInspectionEdits, allowReplacementStatusEdits },
  });
  const updated = await pool.query(`${epiProcessQuery} WHERE p.id = $1`, [row.id]);
  res.json({ process: publicEpiProcess(updated.rows[0], true) });
});

app.post('/api/epi/processes/:id/attention/return', auth, requireRole('tecnico'), async (req, res) => {
  const row = await getEpiProcess(req.params.id, req.user);
  if (!row) return res.status(404).json({ error: 'Processo de EPI não encontrado.' });
  if (String(row.created_by) !== String(req.user.id)) return res.status(403).json({ error: 'Somente o técnico que iniciou o processo pode confirmar esta correção.' });
  if (row.status !== 'aguarda_correcao_tecnico' || row.attention_status !== 'awaiting_technician') return res.status(409).json({ error: 'Este processo não está aguardando a confirmação do técnico.' });
  if (req.body.confirmed !== true) return res.status(400).json({ error: 'Confirme as correções antes de devolver o processo ao Admin.' });
  if (req.body.captureMode !== 'camera') return res.status(400).json({ error: 'A nova selfie precisa ser capturada pela câmera.' });
  const permissions = row.attention_correction_permissions || {};
  const submittedItems = Array.isArray(req.body.items) ? req.body.items : [];
  const currentItems = row.items || [];
  const currentByKey = new Map(currentItems.map((item) => [String(item.itemKey || ''), item]));
  const changes = [];
  for (const submitted of submittedItems) {
    const itemKey = String(submitted.itemKey || '');
    const current = currentByKey.get(itemKey);
    if (!current) return res.status(400).json({ error: 'A correção referencia uma etapa que não pertence a este processo.' });
    const isNegativeInspection = current.section === 'inspecao' && String(current.condition || '').toLowerCase() === 'nao';
    const isReplacementItem = current.section === 'verificacao' && current.replacementRequested === true;
    if (!isNegativeInspection && !isReplacementItem) return res.status(400).json({ error: 'Somente itens que geraram atenção podem ser alterados.' });
    const canEdit = isNegativeInspection ? permissions.allowInspectionEdits === true : permissions.allowReplacementStatusEdits === true;
    const nextCondition = String(submitted.condition || current.condition || '').toLowerCase();
    if (!['sim', 'nao', 'na'].includes(nextCondition)) return res.status(400).json({ error: 'A resposta corrigida precisa ser Sim, Não ou N/A.' });
    if (!canEdit && nextCondition !== String(current.condition || '').toLowerCase()) return res.status(403).json({ error: 'O administrador não autorizou a alteração desta resposta.' });
    if (isReplacementItem && !canEdit && nextCondition !== String(current.condition || '').toLowerCase()) return res.status(403).json({ error: 'O administrador não autorizou a alteração do status deste EPI.' });
    const nextObservation = canEdit ? cleanText(submitted.observation, 180) : String(current.observation || '');
    if (nextCondition !== String(current.condition || '').toLowerCase() || nextObservation !== String(current.observation || '')) {
      changes.push({ itemKey, equipmentName: current.equipmentName, section: current.section, previousCondition: current.condition, condition: nextCondition, previousObservation: current.observation || '', observation: nextObservation });
    }
  }
  let correctionMedia;
  try {
    correctionMedia = await storeEpiProcessMedia({ req, processId: row.id, kind: 'selfie', captureContext: 'attention_correction', imageData: req.body.imageData, deviceInfo: req.body.deviceInfo, latitude: req.body.latitude, longitude: req.body.longitude });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const change of changes) {
        await client.query(
          `UPDATE epi_process_items SET condition = $1, observation = $2 WHERE process_id = $3 AND item_key = $4`,
          [change.condition, change.observation || null, row.id, change.itemKey],
        );
      }
      const updatedItemsResult = await client.query(
        `SELECT ppe_item_id AS "ppeItemId", equipment_name AS "equipmentName", quantity, ca, condition, observation, item_key AS "itemKey", section, replacement_requested AS "replacementRequested", replacement_effective AS "replacementEffective"
         FROM epi_process_items WHERE process_id = $1 ORDER BY id`,
        [row.id],
      );
      const revision = Number(row.attention_revision || 0) + 1;
      const attentionDocumentHash = epiProcessDocumentHash({ row, items: updatedItemsResult.rows, schema: 'sigos-epi-process-correction-v1', baseDocumentHash: row.signature_document_hash, revision });
      const attentionSignatureHash = sha256Json({ algorithm: 'SHA-256', version: 1, signerSignatureHash: row.signer_signature_hash, documentHash: attentionDocumentHash });
      await client.query(
        `UPDATE epi_processes
         SET status = 'pendente_validacao', attention_status = 'returned_to_admin', attention_revision = $2,
             attention_returned_at = NOW(), attention_returned_by = $3, attention_confirmed_at = NOW(), attention_confirmed_by = $3,
             attention_document_hash = $4, attention_signature_hash = $5, submitted_at = NOW()
         WHERE id = $1 AND status = 'aguarda_correcao_tecnico'`,
        [row.id, revision, req.user.id, attentionDocumentHash, attentionSignatureHash],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (correctionMedia?.id) {
      const mediaPath = await pool.query('DELETE FROM epi_process_media WHERE id = $1 RETURNING file_path', [correctionMedia.id]);
      if (mediaPath.rows[0]?.file_path) { try { await fs.promises.unlink(mediaPath.rows[0].file_path); } catch { /* Limpeza best effort. */ } }
    }
    throw error;
  }
  const updatedRow = await pool.query(`${epiProcessQuery} WHERE p.id = $1`, [row.id]);
  const updatedProcess = updatedRow.rows[0];
  const confirmedReplacementNames = (updatedProcess.items || []).filter((item) => item.section === 'verificacao' && item.replacementRequested === true).map((item) => item.equipmentName);
  await audit({ req, actorUserId: req.user.id, eventType: 'epi_process_attention_returned_by_technician', entityType: 'epi_process', entityId: row.id, metadata: { mediaId: correctionMedia.id, changes, attentionRevision: updatedProcess.attention_revision, attentionDocumentHash: updatedProcess.attention_document_hash, attentionSignatureHash: updatedProcess.attention_signature_hash, captureContext: 'attention_correction' } });
  await notifyRoles({ roles: ['admin'], notificationType: 'epi_process_attention_returned', title: 'Técnico confirmou as trocas', message: confirmedReplacementNames.length ? `${req.user.name} confirmou as trocas de ${confirmedReplacementNames.join(', ')} em ${epiProcessTitle(row.process_type)} e enviou uma nova selfie para validação.` : `${req.user.name} confirmou as correções em ${epiProcessTitle(row.process_type)} e enviou uma nova selfie para validação.`, entityType: 'epi_process', entityId: row.id, metadata: { changes, confirmedReplacementNames, attentionRevision: updatedProcess.attention_revision } });
  res.json({ process: publicEpiProcess(updatedProcess, true) });
});

app.get('/api/epi/processes/:processId/media/:mediaId', auth, async (req, res) => {
  const process = await getEpiProcess(req.params.processId, req.user);
  if (!process) return res.status(404).json({ error: 'Processo de EPI não encontrado.' });
  const result = await pool.query(
    `SELECT file_path, mime_type FROM epi_process_media WHERE id = $1 AND process_id = $2`,
    [req.params.mediaId, req.params.processId],
  );
  const media = result.rows[0];
  if (!media) return res.status(404).json({ error: 'Imagem não encontrada.' });
  res.type(media.mime_type).sendFile(media.file_path);
});

function publicEpiTerm(row, includeSignature = false) {
  return {
    id: row.id,
    recipientName: row.recipient_name,
    recipientRole: row.recipient_role,
    companyName: row.company_name,
    companyCnpj: row.company_cnpj,
    status: row.status,
    legalVersion: row.legal_version,
    createdBy: row.created_by_name || null,
    signerUserId: row.signer_user_id,
    issuedAt: row.issued_at,
    createdAt: row.created_at,
    signedAt: row.signed_at,
    signerIp: row.signer_ip,
    signerUserAgent: row.signer_user_agent,
    signerDevice: row.signer_device,
    signerLatitude: row.signer_latitude,
    signerLongitude: row.signer_longitude,
    signatureMethod: row.signature_method,
    signatureHash: row.signature_hash,
    signerTypedName: row.signer_typed_name,
    signatureVersion: row.signature_version,
    documentHash: row.document_hash,
    signatureValidatedAt: row.signature_validated_at,
    signatureData: includeSignature ? row.signature_data : undefined,
    companyLogoData: includeSignature ? (row.company_display_logo_data || row.company_logo_data || null) : undefined,
    companyLogoMimeType: includeSignature ? (row.company_display_logo_mime_type || row.company_logo_mime_type || null) : undefined,
    items: row.items || [],
    legalText: TERM_LEGAL_TEXT,
  };
}

function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function equalHash(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function legacySignatureHash(term, typedName) {
  return sha256Json({
    termId: term.id,
    recipientName: term.recipient_name,
    typedName,
    signatureData: term.signature_data,
    signedAt: new Date(term.signed_at).toISOString(),
    legalVersion: term.legal_version,
  });
}

function signatureDocumentPayload(term, items) {
  const payload = {
    schema: 'sigos-epi-term-signature-v2',
    termId: String(term.id),
    recipientName: term.recipient_name,
    recipientRole: term.recipient_role || null,
    companyName: term.company_name,
    companyCnpj: term.company_cnpj,
    legalVersion: term.legal_version,
    issuedAt: String(term.issued_at),
    items: items.map((item) => ({
      id: String(item.id),
      equipmentName: item.equipment_name,
      quantity: Number(item.quantity),
      ca: item.ca || null,
      condition: item.condition,
      observation: item.observation || null,
    })),
    typedName: term.signer_typed_name,
    signedAt: new Date(term.signed_at).toISOString(),
    signerUserId: term.signer_user_id ? String(term.signer_user_id) : null,
    signerIp: term.signer_ip || null,
    signerUserAgent: term.signer_user_agent || null,
    signerDevice: term.signer_device || null,
    signerLatitude: term.signer_latitude === null || term.signer_latitude === undefined ? null : Number(term.signer_latitude),
    signerLongitude: term.signer_longitude === null || term.signer_longitude === undefined ? null : Number(term.signer_longitude),
    signatureMethod: term.signature_method || null,
    signatureData: term.signature_data,
  };
  if (term.company_logo_data) {
    payload.companyLogoData = term.company_logo_data;
    payload.companyLogoMimeType = term.company_logo_mime_type || null;
  }
  return payload;
}

async function signatureItems(termId) {
  const result = await pool.query(
    `SELECT id, ppe_item_id, equipment_name, quantity, ca, condition, observation
     FROM epi_term_items
     WHERE term_id = $1
     ORDER BY id`,
    [termId],
  );
  return result.rows;
}

const epiTermQuery = `
  SELECT t.*, u.name AS created_by_name,
    (SELECT logo_data FROM company_settings WHERE id = 1) AS company_display_logo_data,
    (SELECT logo_mime_type FROM company_settings WHERE id = 1) AS company_display_logo_mime_type,
    COALESCE(
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', i.id,
          'equipmentName', i.equipment_name,
          'quantity', i.quantity,
          'ca', i.ca,
          'condition', i.condition,
          'observation', i.observation
        ) ORDER BY i.id
      ) FILTER (WHERE i.id IS NOT NULL),
      '[]'::json
    ) AS items
  FROM epi_terms t
  LEFT JOIN epi_term_items i ON i.term_id = t.id
  LEFT JOIN users u ON u.id = t.created_by
`;

function pdfImageBuffer(data) {
  const value = String(data || '');
  const match = value.match(/^data:image\/(jpeg|jpg|png);base64,([a-zA-Z0-9+/=]+)$/);
  return match ? Buffer.from(match[2], 'base64') : null;
}

function pdfEnsureSpace(doc, height = 80) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function pdfContentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

const mediaResult = await pool.query(    `SELECT id, kind, item_key, capture_context, file_path, mime_type, created_at     FROM epi_process_media     WHERE process_id = $1     ORDER BY created_at, id`,    [row.id],  );  row.pdfMedia = mediaResult.rows;  res.setHeader('Content-Disposition', `attachment; filename="processo-epi-${row.id}.pdf"`);
  pdfEnsureSpace(doc, 45);
  doc.x = doc.page.margins.left;
  doc.font('Helvetica').fontSize(10).fillColor('#172033').text(String(value || ''), { width: width || pdfContentWidth(doc), lineGap: 2, align: 'justify' });
  doc.moveDown(.55);
}

function pdfTermTable(doc, items) {
  const availableWidth = pdfContentWidth(doc);
  const columns = [
    { label: 'Equipamentos', width: availableWidth * .45, key: 'equipment_name' },
    { label: 'Qtd.', width: availableWidth * .09, key: 'quantity' },
    { label: 'CA', width: availableWidth * .15, key: 'ca' },
    { label: 'Observação', width: availableWidth * .31, key: 'observation' },
  ];
  const x = doc.page.margins.left;
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const drawHeader = () => {
    const headerY = doc.y;
    doc.save().fillColor('#e5e7eb').rect(x, headerY, totalWidth, 24).fill().restore();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#172033');
    let columnX = x;
    columns.forEach((column) => {
      doc.rect(columnX, headerY, column.width, 24).stroke('#9ca3af');
      doc.text(column.label, columnX + 4, headerY + 8, { width: column.width - 8, lineBreak: false });
      columnX += column.width;
    });
    doc.y = headerY + 24;
  };
  drawHeader();
  (items || []).forEach((item) => {
    const values = columns.map((column) => String(item[column.key] ?? '–'));
    doc.font('Helvetica').fontSize(8);
    const rowHeight = Math.max(24, ...values.map((value, index) => doc.heightOfString(value, { width: columns[index].width - 8, lineGap: 1 }) + 8));
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    const rowY = doc.y;
    let columnX = x;
    values.forEach((value, index) => {
      const column = columns[index];
      doc.rect(columnX, rowY, column.width, rowHeight).stroke('#9ca3af');
      doc.text(value, columnX + 4, rowY + 7, { width: column.width - 8, lineGap: 1 });
      columnX += column.width;
    });
    doc.y = rowY + rowHeight;
  });
  doc.moveDown(1);
}

function pdfCompanyHeader(doc, { companyName, companyCnpj, logoData, label }) {
  const logo = pdfImageBuffer(logoData);
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  if (logo) {
    try { doc.image(logo, left, 32, { fit: [100, 58] }); } catch { /* Logo inválido não impede o PDF. */ }
  }
  const headerX = logo ? left + 116 : left;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#172033').text(companyName || DEFAULT_COMPANY_SETTINGS.tradeName, headerX, 42, { width: 300 });
  doc.font('Helvetica').fontSize(9).text(`CNPJ: ${companyCnpj || DEFAULT_COMPANY_SETTINGS.cnpj}`, headerX, 59, { width: 300 });
  doc.font('Helvetica').fontSize(9).text(label, right - 150, 47, { width: 150, align: 'right' });
  doc.x = left;
  doc.moveTo(left, 105).lineTo(right, 105).stroke('#9ca3af');
  doc.y = 123;
  return logo;
}

function pdfTable(doc, columns, rows) {
  const x = doc.page.margins.left;
  const totalWidth = pdfContentWidth(doc);
  const scale = totalWidth / columns.reduce((sum, column) => sum + column.width, 0);
  const scaledColumns = columns.map((column) => ({ ...column, width: column.width * scale }));
  const drawHeader = () => {
    const headerY = doc.y;
    doc.save().fillColor('#e5e7eb').rect(x, headerY, totalWidth, 24).fill().restore();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#172033');
    let columnX = x;
    scaledColumns.forEach((column) => {
      doc.rect(columnX, headerY, column.width, 24).stroke('#9ca3af');
      doc.text(column.label, columnX + 4, headerY + 8, { width: column.width - 8, lineBreak: false });
      columnX += column.width;
    });
    doc.y = headerY + 24;
  };
  const drawRow = (row) => {
    const values = scaledColumns.map((column) => String(row[column.key] ?? '–'));
    doc.font('Helvetica').fontSize(8);
    const rowHeight = Math.max(24, ...values.map((value, index) => doc.heightOfString(value, { width: scaledColumns[index].width - 8, lineGap: 1 }) + 8));
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    const rowY = doc.y;
    let columnX = x;
    values.forEach((value, index) => {
      const column = scaledColumns[index];
      doc.rect(columnX, rowY, column.width, rowHeight).stroke('#9ca3af');
      doc.text(value, columnX + 4, rowY + 7, { width: column.width - 8, lineGap: 1 });
      columnX += column.width;
    });
    doc.y = rowY + rowHeight;
  };
  drawHeader();
  (rows || []).forEach(drawRow);
  doc.moveDown(1);
}

function renderEpiTermPdf(doc, term) {
  const logo = pdfImageBuffer(term.company_logo_data || term.company_display_logo_data);
  doc.info.Title = `Termo de EPI #${term.id}`;
  doc.info.Author = 'SIGOS';
  if (logo) {
    try { doc.image(logo, doc.page.margins.left, 32, { fit: [110, 62] }); } catch { /* Logo inválido não impede o PDF. */ }
  }
  const headerX = logo ? doc.page.margins.left + 126 : doc.page.margins.left;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#172033').text(term.company_name || DEFAULT_COMPANY_SETTINGS.tradeName, headerX, 42, { width: 300 });
  doc.font('Helvetica').fontSize(9).text(`CNPJ: ${term.company_cnpj || DEFAULT_COMPANY_SETTINGS.cnpj}`, headerX, 59, { width: 300 });
  doc.font('Helvetica').fontSize(9).text(`TERMO #${term.id}`, 430, 47, { width: 120, align: 'right' });
  doc.x = doc.page.margins.left;
  doc.moveTo(doc.page.margins.left, 105).lineTo(doc.page.width - doc.page.margins.right, 105).stroke('#9ca3af');
  doc.y = 123;
  doc.font('Helvetica-Bold').fontSize(13).text("TERMO DE DEVOLUÇÃO E RESPONSABILIDADE EPI'S", { align: 'center' });
  doc.moveDown(.9);
  pdfParagraph(doc, `Recebi da empresa ${term.company_name || DEFAULT_COMPANY_SETTINGS.tradeName}, pessoa jurídica de direito privado, inscrita no CNPJ N° ${term.company_cnpj || DEFAULT_COMPANY_SETTINGS.cnpj}, a título de empréstimo, para meu uso exclusivo, conforme determinado na lei, os equipamentos de proteção individual especificados neste termo, comprometendo-me a mantê-los em perfeito estado de conservação, ficando ciente de que:`);
  [
    'Se o equipamento for danificado ou inutilizado por emprego inadequado, mau uso, negligência ou extravio, a empresa me fornecerá novo equipamento e cobrará o valor de um equipamento da mesma marca ou equivalente ao da praça.',
    'Em caso de dano, inutilização ou extravio do equipamento deverei comunicar imediatamente ao setor competente.',
    'Terminando os serviços ou no caso de rescisão do contrato de trabalho, devolverei o equipamento completo e em perfeito estado de conservação, considerando-se o tempo do uso do mesmo, ao setor competente.',
    'Estando os equipamentos em minha posse, estarei sujeito a inspeções sem prévio aviso.',
  ].forEach((clause, index) => pdfParagraph(doc, `${index + 1}. ${clause}`));
  pdfEnsureSpace(doc, 38);
  doc.font('Helvetica').fontSize(9).text(`Funcionário: ${term.recipient_name || '–'}    Função: ${term.recipient_role || 'Não informada'}    Emissão: ${String(term.issued_at || '').slice(0, 10)}`);
  doc.moveDown(.8);
  pdfTermTable(doc, (term.items || []).map((item) => ({
    equipment_name: item.equipmentName || item.equipment_name || '–',
    quantity: item.quantity,
    ca: item.ca || '–',
    observation: `${String(item.condition || '').toUpperCase()}${item.observation ? ` · ${item.observation}` : ''}`,
  })));
  function pdfMediaSource(media) {  const imageData = media?.imageData || media?.image_data;  const imageBuffer = pdfImageBuffer(imageData);  if (imageBuffer) return imageBuffer;  const filePath = media?.filePath || media?.file_path;  return filePath && fs.existsSync(filePath) ? filePath : null;}function pdfMediaLabel(media, index) {  const kind = media?.kind || '';  const context = media?.captureContext || media?.capture_context || 'original';  if (kind === 'selfie' && context === 'validation') return `Selfie do validador ${index}`;  if (kind === 'selfie' && context === 'attention_correction') return `Selfie após correção ${index}`;  if (kind === 'selfie') return `Selfie do responsável ${index}`;  if (media?.itemKey || media?.item_key) return `Foto do item ${media.itemKey || media.item_key}`;  return `Foto registrada ${index}`;}function pdfMediaSection(doc, media, title = 'Fotos registradas') {  const photos = (media || []).filter((item) => pdfMediaSource(item));  if (!photos.length) return;  const gap = 12;  const cellWidth = (pdfContentWidth(doc) - gap) / 2;  const imageHeight = 150;  const rowHeight = imageHeight + 34;  let rowY = null;  const drawTitle = () => {    doc.font('Helvetica-Bold').fontSize(10).fillColor('#172033').text(title, doc.page.margins.left, doc.y, { width: pdfContentWidth(doc) });    doc.moveDown(.35);  };  pdfEnsureSpace(doc, rowHeight + 38);  drawTitle();  photos.forEach((photo, index) => {    if (index % 2 === 0) {      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {        doc.addPage();        drawTitle();      }      rowY = doc.y;    }    const columnX = doc.page.margins.left + (index % 2) * (cellWidth + gap);    const source = pdfMediaSource(photo);    try {      doc.image(source, columnX, rowY, { fit: [cellWidth, imageHeight], align: 'center', valign: 'center' });    } catch {      doc.rect(columnX, rowY, cellWidth, imageHeight).stroke('#9ca3af');      doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text('Imagem indisponível', columnX, rowY + imageHeight / 2 - 5, { width: cellWidth, align: 'center' });    }    doc.font('Helvetica').fontSize(8).fillColor('#4b5563').text(pdfMediaLabel(photo, index + 1), columnX, rowY + imageHeight + 5, { width: cellWidth, align: 'center' });    if (index % 2 === 1 || index === photos.length - 1) doc.y = rowY + rowHeight;  });  doc.moveDown(.35);}function pdfParagraph(doc, value, width = null) {
  pdfParagraph(doc, TERM_LEGAL_TEXT.nr06);
  pdfParagraph(doc, TERM_LEGAL_TEXT.declaration);
  pdfEnsureSpace(doc, 150);
  doc.font('Helvetica-Bold').fontSize(9).text(`Status: ${term.status || '–'}`);
  if (term.signature_data) {
    const signature = pdfImageBuffer(term.signature_data);
    if (signature) {
      const signatureWidth = 220;
      try { doc.image(signature, (doc.page.width - signatureWidth) / 2, doc.y + 8, { fit: [signatureWidth, 82] }); } catch { /* Assinatura inválida não impede o PDF. */ }
      doc.y += 92;
    }
  }
  const signatureLineWidth = 210;
  const signatureLineX = (doc.page.width - signatureLineWidth) / 2;
  doc.moveTo(signatureLineX, doc.y).lineTo(signatureLineX + signatureLineWidth, doc.y).stroke('#4b5563');
  doc.font('Helvetica').fontSize(9).text(`Ass. do Funcionário · ${term.recipient_name || '–'}`, signatureLineX, doc.y + 5, { width: signatureLineWidth, align: 'center' });
  doc.y += 30;
  doc.fontSize(8).fillColor('#4b5563').text(`Assinado em: ${term.signed_at ? new Date(term.signed_at).toLocaleString('pt-BR') : 'Não assinado'} · IP: ${term.signer_ip || 'não informado'} · Dispositivo: ${term.signer_device || term.signer_user_agent || 'não informado'}`);
  doc.text(`Hash da assinatura: ${term.signature_hash || '–'}`);
}

function renderEpiProcessPdf(doc, process) {
  const processType = process.process_type;
  const legalText = EPI_PROCESS_LEGAL_TEXT[processType] || EPI_PROCESS_LEGAL_TEXT.checklist_diario;
  const attentionStatus = process.attention_status || (process.admin_attention_required ? 'pending_admin' : 'none');
  const attentionOpen = process.admin_attention_required === true && ['pending_admin', 'awaiting_technician'].includes(attentionStatus);
  const companyName = process.company_trade_name || process.company_legal_name || DEFAULT_COMPANY_SETTINGS.tradeName;
  const companyCnpj = process.company_cnpj || DEFAULT_COMPANY_SETTINGS.cnpj;
  const logo = pdfCompanyHeader(doc, {
    companyName,
    companyCnpj,
    logoData: process.company_logo_data || process.company_logo_data_current,
    label: `PROCESSO EPI #${process.id}`,
  });
  doc.info.Title = `${legalText.title} #${process.id}`;
  doc.info.Author = 'SIGOS';
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#172033').text(legalText.title, { align: 'center' });
  doc.moveDown(.7);

  (legalText.paragraphs || []).forEach((paragraph) => pdfParagraph(doc, paragraph));

  pdfEnsureSpace(doc, 55);
  doc.font('Helvetica').fontSize(9).fillColor('#172033').text(`Processo: #${process.id}    Responsável: ${process.creator_name || '–'}    Emissão: ${process.created_at ? new Date(process.created_at).toLocaleString('pt-BR') : '–'}`);
  if (process.validator_name) doc.text(`Validador designado: ${process.validator_name}`);
  if (process.target_name) doc.text(`Destinatário: ${process.target_name}`);
  doc.moveDown(.8);
  if (processType === 'checklist_diario') {
    const dailyColumns = [
      { label: 'Nº', width: 38, key: 'number' },
      { label: 'EPI / item de segurança', width: 280, key: 'item' },
      { label: 'Resposta', width: 62, key: 'response' },
      { label: 'Observação', width: 110, key: 'observation' },
    ];
    const dailyItems = process.items || [];
    const dailyGroups = [
      { section: 'verificacao', title: '1. VERIFICAÇÃO DOS EPIs' },
      { section: 'inspecao', title: '2. INSPEÇÃO ANTES DO INÍCIO DA ATIVIDADE' },
    ];
    const hasSections = dailyItems.some((item) => item.section);
    const drawDailyRows = (items) => pdfTable(doc, dailyColumns, items.map((item) => ({
      number: dailyItems.indexOf(item) + 1,
      item: item.equipmentName || '–',
      response: epiDailyResponseLabel(item.checkStatus || item.condition),
      observation: [attentionOpen && item.replacementRequested ? 'SOLICITAÇÃO DE TROCA' : '', epiProcessTermObservation(process, item)].filter(Boolean).join(' · ') || '–',
    })));
    if (hasSections) {
      dailyGroups.forEach((group) => {
        const items = dailyItems.filter((item) => item.section === group.section);
        if (!items.length) return;
        pdfEnsureSpace(doc, 72);
        doc.x = doc.page.margins.left;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#172033').text(group.title, doc.page.margins.left, doc.y, { width: pdfContentWidth(doc) });
        doc.moveDown(.25);
        drawDailyRows(items);
      });
    } else {
      drawDailyRows(dailyItems);
    }
  } else {
    pdfTermTable(doc, (process.items || []).map((item) => ({
      equipment_name: item.equipmentName || '–',
      quantity: item.quantity,
      ca: item.ca || '–',
      observation: `${String(item.condition || '').toUpperCase()}${item.observation ? ` · ${item.observation}` : ''}`,
    })));
  }

  if (processType === 'checklist_diario') {
    function pdfMediaSource(media) {  const imageData = media?.imageData || media?.image_data;  const imageBuffer = pdfImageBuffer(imageData);  if (imageBuffer) return imageBuffer;  const filePath = media?.filePath || media?.file_path;  return filePath && fs.existsSync(filePath) ? filePath : null;}function pdfMediaLabel(media, index) {  const kind = media?.kind || '';  const context = media?.captureContext || media?.capture_context || 'original';  if (kind === 'selfie' && context === 'validation') return `Selfie do validador ${index}`;  if (kind === 'selfie' && context === 'attention_correction') return `Selfie após correção ${index}`;  if (kind === 'selfie') return `Selfie do responsável ${index}`;  if (media?.itemKey || media?.item_key) return `Foto do item ${media.itemKey || media.item_key}`;  return `Foto registrada ${index}`;}function pdfMediaSection(doc, media, title = 'Fotos registradas') {  const photos = (media || []).filter((item) => pdfMediaSource(item));  if (!photos.length) return;  const gap = 12;  const cellWidth = (pdfContentWidth(doc) - gap) / 2;  const imageHeight = 150;  const rowHeight = imageHeight + 34;  let rowY = null;  const drawTitle = () => {    doc.font('Helvetica-Bold').fontSize(10).fillColor('#172033').text(title, doc.page.margins.left, doc.y, { width: pdfContentWidth(doc) });    doc.moveDown(.35);  };  pdfEnsureSpace(doc, rowHeight + 38);  drawTitle();  photos.forEach((photo, index) => {    if (index % 2 === 0) {      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {        doc.addPage();        drawTitle();      }      rowY = doc.y;    }    const columnX = doc.page.margins.left + (index % 2) * (cellWidth + gap);    const source = pdfMediaSource(photo);    try {      doc.image(source, columnX, rowY, { fit: [cellWidth, imageHeight], align: 'center', valign: 'center' });    } catch {      doc.rect(columnX, rowY, cellWidth, imageHeight).stroke('#9ca3af');      doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text('Imagem indisponível', columnX, rowY + imageHeight / 2 - 5, { width: cellWidth, align: 'center' });    }    doc.font('Helvetica').fontSize(8).fillColor('#4b5563').text(pdfMediaLabel(photo, index + 1), columnX, rowY + imageHeight + 5, { width: cellWidth, align: 'center' });    if (index % 2 === 1 || index === photos.length - 1) doc.y = rowY + rowHeight;  });  doc.moveDown(.35);}function pdfParagraph(doc, value, width = null) {
    pdfParagraph(doc, TERM_LEGAL_TEXT.nr06);
    pdfParagraph(doc, TERM_LEGAL_TEXT.declaration);
  }

  pdfEnsureSpace(doc, 150);
  if (attentionOpen) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#9a3412').text('CHECKLIST REQUER ATENCAO DO ADMIN');
    const reasons = Array.isArray(process.admin_attention_reasons) ? process.admin_attention_reasons : [];
    reasons.forEach((reason) => doc.font('Helvetica').fontSize(8).text(`- ${reason.type === 'replacement_request' ? 'Solicitacao de troca' : 'Resposta "Nao" na inspecao'}: ${reason.equipmentName || 'item'}`));
    doc.moveDown(.5);
  }
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#172033').text(`Status: ${process.status || '–'}`);
  const signature = pdfImageBuffer(process.creator_signature_data);
  if (signature) {
    const signatureWidth = 220;
    try { doc.image(signature, (doc.page.width - signatureWidth) / 2, doc.y + 8, { fit: [signatureWidth, 82] }); } catch { /* Assinatura inválida não impede o PDF. */ }
    doc.y += 92;
  }
  const signatureLineWidth = 210;
  const signatureLineX = (doc.page.width - signatureLineWidth) / 2;
  doc.moveTo(signatureLineX, doc.y).lineTo(signatureLineX + signatureLineWidth, doc.y).stroke('#4b5563');
  doc.font('Helvetica').fontSize(9).text(`Assinatura do responsável · ${process.creator_name || '–'}`, signatureLineX, doc.y + 5, { width: signatureLineWidth, align: 'center' });
  doc.y += 30;
  doc.fontSize(8).fillColor('#4b5563').text(`Assinatura validada em: ${process.signature_validated_at ? new Date(process.signature_validated_at).toLocaleString('pt-BR') : 'Não informada'}`);
  doc.text(`Hash da assinatura: ${process.signature_hash || '–'}`);
  doc.text(`Hash do documento: ${process.signature_document_hash || '–'}`);
  if (attentionOpen) {
    doc.text(`Tratamento da atenção: ${attentionStatus}`);
    if (process.attention_returned_at) doc.text(`Confirmação do técnico: ${new Date(process.attention_returned_at).toLocaleString('pt-BR')} · revisão ${process.attention_revision || 0}`);
    if (process.attention_signature_hash) doc.text(`Hash da confirmação do técnico: ${process.attention_signature_hash}`);
    if (process.attention_document_hash) doc.text(`Hash do documento corrigido: ${process.attention_document_hash}`);
  }
  if (process.validated_by_name || process.validated_at) {
    doc.text(`Processo validado por: ${process.validated_by_name || '–'} · ${process.validated_at ? new Date(process.validated_at).toLocaleString('pt-BR') : '–'}`);
    pdfEnsureSpace(doc, 150);
    const validationLabel = isAdminRole(process.validated_by_role) ? 'Assinatura do Admin validador' : process.validated_by_role === 'vistoriador' ? 'Assinatura do Supervisor validador' : 'Assinatura do responsável pela validação';
    doc.moveDown(.7);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#172033').text(validationLabel);
    const validationSignature = pdfImageBuffer(process.validation_signature_data);
    if (validationSignature) {
      const signatureWidth = 220;
      try { doc.image(validationSignature, (doc.page.width - signatureWidth) / 2, doc.y + 8, { fit: [signatureWidth, 82] }); } catch { /* Assinatura inválida não impede o PDF. */ }
      doc.y += 92;
    }
    const validationLineWidth = 210;
    const validationLineX = (doc.page.width - validationLineWidth) / 2;
    doc.moveTo(validationLineX, doc.y).lineTo(validationLineX + validationLineWidth, doc.y).stroke('#4b5563');
    doc.font('Helvetica').fontSize(9).text(`${validationLabel} · ${process.validation_signature_typed_name || process.validated_by_name || '–'}`, validationLineX, doc.y + 5, { width: validationLineWidth, align: 'center' });
    doc.y += 30;
    doc.fontSize(8).fillColor('#4b5563').text(`Validação registrada em: ${process.validation_signature_validated_at ? new Date(process.validation_signature_validated_at).toLocaleString('pt-BR') : process.validated_at ? new Date(process.validated_at).toLocaleString('pt-BR') : 'Não informada'}`);
    doc.text(`Hash da assinatura do validador: ${process.validation_signature_hash || '–'}`);
    doc.text(`Hash do documento validado: ${process.validation_signature_document_hash || '–'}`);
  }
  if (process.validation_notes) pdfParagraph(doc, `Observação da validação: ${process.validation_notes}`);
}

function renderVehicleChecklistPdf(doc, checklist, company) {
  const isDaily = checklist.checklistType === 'diario';
  const vehicleDocumentLabel = vehicleChecklistTypeLabelForPdf(checklist.checklistType);
  const companyName = company.tradeName || company.legalName || DEFAULT_COMPANY_SETTINGS.tradeName;
  const companyCnpj = company.cnpj || DEFAULT_COMPANY_SETTINGS.cnpj;
  pdfCompanyHeader(doc, {
    companyName,
    companyCnpj,
    logoData: company.logoData,
    label: `${vehicleDocumentLabel} DE VEÍCULO #${checklist.id}`,
  });
  doc.info.Title = `Termo de responsabilidade de veículo #${checklist.id}`;
  doc.info.Author = 'SIGOS';
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#172033').text(vehicleDocumentLabel === 'CHECKLIST DIÁRIO' ? 'CHECKLIST DIÁRIO DE VEÍCULOS' : `TERMO DE ${vehicleDocumentLabel} DE VEÍCULOS`, { align: 'center' });
  doc.moveDown(.7);
  pdfParagraph(doc, VEHICLE_TERM_INTRO);
  VEHICLE_TERM_CLAUSES.forEach((clause, index) => pdfParagraph(doc, `${index + 1}. ${clause}`));
  pdfEnsureSpace(doc, 70);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#172033').text(`Checklist #${checklist.id}`);
  doc.font('Helvetica').fontSize(9).text(`Motorista: ${checklist.driverName || '–'}    Supervisor: ${checklist.inspectorName || '–'}`);
  doc.text(`Placa: ${checklist.plate || '–'}    Modelo: ${checklist.model || '–'}    Ano: ${checklist.vehicleYear || '–'}    KM: ${checklist.mileage ?? '–'}`);
  if (checklist.targetName) doc.text(`${['entrega', 'recebimento'].includes(checklist.checklistType) ? 'Técnico destinatário' : 'Destinatário da transferência'}: ${checklist.targetName}`);
  if (isDaily && checklist.dailyPeriod) doc.text(`Período: ${checklist.dailyPeriod === 'inicio' ? 'Começo do dia' : 'Fim do dia'}`);
  doc.text(`Status: ${checklist.status || '–'}    Emissão: ${checklist.createdAt ? new Date(checklist.createdAt).toLocaleString('pt-BR') : '–'}`);
  doc.moveDown(.8);
  if (isDaily) {
    pdfTable(doc, [
      { label: 'Ponto', width: 170, key: 'item' },
      { label: 'Status', width: 85, key: 'status' },
      { label: 'Observação', width: 238, key: 'observation' },
    ], (checklist.items || []).map((item) => ({
      item: item.itemKind === 'vehicle_equipment' && item.expectedQuantity ? `${item.itemName || '–'} (Qtd. cadastrada: ${item.expectedQuantity})` : item.itemName || '–',
      status: item.itemKind === 'vehicle_equipment' ? (item.beforeStatus === 'ok' ? 'SIM' : 'NÃO') : item.beforeStatus || '–',
      observation: item.beforeDescription || '–',
    })));
  } else {
    pdfTable(doc, [
      { label: 'Item', width: 145, key: 'item' },
      { label: 'Antes', width: 58, key: 'before' },
      { label: 'Descrição', width: 116, key: 'beforeDescription' },
      { label: 'Depois', width: 58, key: 'after' },
      { label: 'Descrição', width: 116, key: 'afterDescription' },
    ], (checklist.items || []).map((item) => ({
      item: item.itemName || '–',
      before: item.beforeStatus || '–',
      beforeDescription: item.beforeDescription || '–',
      after: item.afterStatus || '–',
      afterDescription: item.afterDescription || '–',
    })));
  }
  pdfMediaSection(doc, process.pdfMedia || process.media, 'Fotos do checklist');    pdfParagraph(doc, TERM_LEGAL_TEXT.clt);

  (checklist.signatures || []).forEach((signature) => {
    pdfEnsureSpace(doc, 155);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#172033').text(`Assinatura · ${vehicleSignatureRoleLabelForPdf(signature.signerRole, signature.signatureContext)}`);
    const signatureImage = pdfImageBuffer(signature.signatureData);
    if (signatureImage) {
      const signatureWidth = 220;
      try { doc.image(signatureImage, (doc.page.width - signatureWidth) / 2, doc.y + 8, { fit: [signatureWidth, 82] }); } catch { /* Assinatura inválida não impede o PDF. */ }
      doc.y += 92;
    }
    const signatureLineWidth = 210;
    const signatureLineX = (doc.page.width - signatureLineWidth) / 2;
    doc.moveTo(signatureLineX, doc.y).lineTo(signatureLineX + signatureLineWidth, doc.y).stroke('#4b5563');
    doc.font('Helvetica').fontSize(9).text(`${signature.typedName || '–'} · ${signature.signedAt ? new Date(signature.signedAt).toLocaleString('pt-BR') : '–'}`, signatureLineX, doc.y + 5, { width: signatureLineWidth, align: 'center' });
    doc.y += 28;
    doc.fontSize(8).fillColor('#4b5563').text(`IP: ${signature.signerIp || 'não informado'} · Dispositivo: ${signature.signerDevice || signature.signerUserAgent || 'não informado'}`);
    doc.text(`Coordenadas: ${signature.signerLatitude ?? '–'}, ${signature.signerLongitude ?? '–'} · Hash: ${signature.signatureHash || '–'}`);
  });
}

function vehicleChecklistTypeLabelForPdf(type) {
  return ({ diario: 'CHECKLIST DIÁRIO', quinzenal: 'CHECKLIST RECORRENTE', transferencia: 'TRANSFERÊNCIA DE RESPONSABILIDADE', recebimento: 'RECEBIMENTO DE RESPONSABILIDADE', devolucao: 'DEVOLUÇÃO DE RESPONSABILIDADE', entrega: 'ENTREGA DE RESPONSABILIDADE' }[type] || 'RESPONSABILIDADE');
}

function vehicleSignatureRoleLabelForPdf(role, context = {}) {
  if (context.stage === 'transfer_recipient') return 'Usuário destinatário';
  if (context.stage === 'delivery_recipient') return 'Técnico destinatário';
  return ({ tecnico: 'Técnico', vistoriador: 'Supervisor', admin: 'Administrador', superadmin: 'Superadmin' }[role] || role || 'Responsável');
}

function canAccessEpiTerms(user) {
  return isAdminRole(user.role) || user.role === 'tecnico';
}

app.get('/api/epi/terms', auth, async (req, res) => {
  if (!canAccessEpiTerms(req.user)) return res.status(403).json({ error: 'Este perfil não possui acesso aos termos de EPI.' });
  const visibility = isAdminRole(req.user.role) ? '' : ' WHERE t.created_by = $1 OR t.signer_user_id = $1';
  const result = await pool.query(`${epiTermQuery}${visibility} GROUP BY t.id, u.name ORDER BY t.created_at DESC LIMIT 100`, isAdminRole(req.user.role) ? [] : [req.user.id]);
  res.json({ terms: result.rows.map((row) => publicEpiTerm(row)) });
});

app.get('/api/epi/terms/:id', auth, async (req, res) => {
  if (!canAccessEpiTerms(req.user)) return res.status(403).json({ error: 'Este perfil não possui acesso aos termos de EPI.' });
  const visibility = isAdminRole(req.user.role) ? ' WHERE t.id = $1' : ' WHERE t.id = $1 AND (t.created_by = $2 OR t.signer_user_id = $2)';
  const params = isAdminRole(req.user.role) ? [req.params.id] : [req.params.id, req.user.id];
  const result = await pool.query(`${epiTermQuery}${visibility} GROUP BY t.id, u.name`, params);
  if (!result.rows[0]) return res.status(404).json({ error: 'Termo não encontrado.' });
  res.json({ term: publicEpiTerm(result.rows[0], true) });
});

app.get('/api/epi/terms/:id/pdf', auth, async (req, res) => {
  if (!canAccessEpiTerms(req.user)) return res.status(403).json({ error: 'Este perfil não possui acesso aos termos de EPI.' });
  const visibility = isAdminRole(req.user.role) ? ' WHERE t.id = $1' : ' WHERE t.id = $1 AND (t.created_by = $2 OR t.signer_user_id = $2)';
  const params = isAdminRole(req.user.role) ? [req.params.id] : [req.params.id, req.user.id];
  const result = await pool.query(`${epiTermQuery}${visibility} GROUP BY t.id, u.name`, params);
  const term = result.rows[0];
  if (!term) return res.status(404).json({ error: 'Termo não encontrado.' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="termo-epi-${term.id}.pdf"`);
  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margins: { top: 42, bottom: 42, left: 42, right: 42 } });
  doc.pipe(res);
  try {
    renderEpiTermPdf(doc, term);
    doc.end();
  } catch (error) {
    console.error('Não foi possível gerar o PDF do termo:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Não foi possível gerar o PDF do termo.' });
    else res.destroy(error);
  }
});

app.post('/api/epi/terms', auth, requireRole('tecnico'), async (req, res) => {
  const recipientName = cleanText(req.body.recipientName, 160);
  const recipientRole = cleanText(req.body.recipientRole, 120);
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const normalizedItems = items.map((item) => ({
    equipmentName: cleanText(item.equipmentName, 180),
    quantity: Number(item.quantity),
    ca: cleanText(item.ca, 80),
    condition: cleanText(item.condition, 40).toLowerCase() || 'novo',
    observation: cleanText(item.observation, 180),
  })).filter((item) => item.equipmentName);

  if (!recipientName || normalizedItems.length === 0) {
    return res.status(400).json({ error: 'Informe o funcionário e pelo menos um equipamento.' });
  }
  if (normalizedItems.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
    return res.status(400).json({ error: 'A quantidade de cada equipamento precisa ser um número inteiro maior que zero.' });
  }

  const companySettings = publicCompanySettings(await getCompanySettings());

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const termResult = await client.query(
      `INSERT INTO epi_terms (recipient_name, recipient_role, company_name, company_cnpj, company_logo_data, company_logo_mime_type, created_by, legal_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [recipientName, recipientRole || null, companySettings.tradeName, companySettings.cnpj, companySettings.logoData, companySettings.logoMimeType, req.user.id, TERM_LEGAL_TEXT.version],
    );
    const termId = termResult.rows[0].id;
    for (const item of normalizedItems) {
      const catalog = await client.query(
        `SELECT id FROM ppe_items
         WHERE ($1::text IS NOT NULL AND UPPER(COALESCE(ca, '')) = UPPER($1))
            OR LOWER(name) = LOWER($2)
         ORDER BY active DESC, id ASC
         LIMIT 1`,
        [item.ca || null, item.equipmentName],
      );
      await client.query(
        `INSERT INTO epi_term_items (term_id, ppe_item_id, equipment_name, quantity, ca, condition, observation)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [termId, catalog.rows[0]?.id || null, item.equipmentName, item.quantity, item.ca || null, item.condition, item.observation || null],
      );
    }
    await client.query('COMMIT');
    await audit({
      req,
      actorUserId: req.user.id,
      eventType: 'epi_term_created',
      entityType: 'epi_term',
      entityId: termId,
      metadata: { recipientName, itemCount: normalizedItems.length, legalVersion: TERM_LEGAL_TEXT.version },
    });
    await notifyRoles({
      roles: ['admin'],
      notificationType: 'checklist_created',
      title: 'Novo checklist de EPI',
      message: `O termo de EPI de ${recipientName} foi criado e aguarda acompanhamento.`,
      entityType: 'epi_term',
      entityId: termId,
      metadata: { recipientName, createdBy: req.user.id },
    });
    const created = await pool.query(`${epiTermQuery} WHERE t.id = $1 GROUP BY t.id, u.name`, [termId]);
    res.status(201).json({ term: publicEpiTerm(created.rows[0]) });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

app.post('/api/epi/terms/:id/sign', auth, requireRole('tecnico'), async (req, res) => {
  const typedName = cleanText(req.body.typedName, 160);
  const signatureData = String(req.body.signatureData || '');
  const signerDevice = cleanText(req.body.deviceInfo, 240);
  const latitude = req.body.latitude === null || req.body.latitude === undefined || req.body.latitude === '' ? null : Number(req.body.latitude);
  const longitude = req.body.longitude === null || req.body.longitude === undefined || req.body.longitude === '' ? null : Number(req.body.longitude);

  if (!typedName || typedName.length < 3) return res.status(400).json({ error: 'Informe o nome do signatário.' });
  if (!/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(signatureData) || signatureData.length > 700000) {
    return res.status(400).json({ error: 'A assinatura desenhada é inválida ou excede o limite permitido.' });
  }
  if ((latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
    return res.status(400).json({ error: 'A localização informada é inválida.' });
  }

  const termResult = await pool.query('SELECT * FROM epi_terms WHERE id = $1', [req.params.id]);
  const term = termResult.rows[0];
  if (!term) return res.status(404).json({ error: 'Termo não encontrado.' });
  if (String(term.created_by) !== String(req.user.id)) return res.status(403).json({ error: 'O técnico só pode assinar os próprios termos.' });
  if (term.status === 'assinado') return res.status(409).json({ error: 'Este termo já está assinado.' });
  if (term.status === 'cancelado' || term.status === 'devolvido') return res.status(409).json({ error: 'Este termo não pode mais ser assinado.' });

  const signedAt = new Date().toISOString();
  const items = await signatureItems(term.id);
  const signedTerm = {
    ...term,
    signer_typed_name: typedName,
    signed_at: signedAt,
    signer_user_id: req.user.id,
    signer_ip: clientIp(req),
    signer_user_agent: req.get('user-agent') || null,
    signer_device: signerDevice || null,
    signer_latitude: latitude,
    signer_longitude: longitude,
    signature_method: 'assinatura_eletronica_interna_canvas',
    signature_data: signatureData,
  };
  const documentHash = sha256Json(signatureDocumentPayload(signedTerm, items));
  const signatureHash = sha256Json({
    algorithm: 'SHA-256',
    version: 2,
    documentHash,
    signedAt,
    signerUserId: String(req.user.id),
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lockedTerm = await client.query('SELECT status FROM epi_terms WHERE id = $1 FOR UPDATE', [term.id]);
    if (!lockedTerm.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Termo não encontrado.' });
    }
    if (lockedTerm.rows[0].status === 'assinado') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Este termo já está assinado.' });
    }
    const termItems = await client.query(
      'SELECT id, ppe_item_id, quantity FROM epi_term_items WHERE term_id = $1 ORDER BY id',
      [term.id],
    );
    for (const item of termItems.rows) {
      if (!item.ppe_item_id) continue;
      await ensureAvailableQuantity(client, Number(item.ppe_item_id), Number(item.quantity));
      await insertPpeStockMovement(client, {
        ppeItemId: Number(item.ppe_item_id),
        movementType: 'saida',
        quantity: Number(item.quantity),
        toUserId: req.user.id,
        termId: term.id,
        createdBy: req.user.id,
        referenceKey: `term:${term.id}:item:${item.id}:saida`,
        notes: 'Saída de EPI por assinatura de termo.',
      });
    }
    await client.query(
      `UPDATE epi_terms
       SET status = 'assinado', signed_at = $1, signer_user_id = $2,
           signer_ip = $3, signer_user_agent = $4, signer_device = $5,
           signer_latitude = $6, signer_longitude = $7,
           signature_method = 'assinatura_eletronica_interna_canvas',
           signature_hash = $8, signature_data = $9,
           signer_typed_name = $10, signature_version = 2, document_hash = $11,
           signature_validated_at = NULL
       WHERE id = $12`,
      [signedAt, req.user.id, clientIp(req), req.get('user-agent') || null, signerDevice || null, latitude, longitude, signatureHash, signatureData, typedName, documentHash, term.id],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    throw error;
  } finally {
    client.release();
  }
  await audit({
    req,
    actorUserId: req.user.id,
    eventType: 'epi_term_signed',
    entityType: 'epi_term',
    entityId: term.id,
    metadata: {
      typedName,
      signatureMethod: 'assinatura_eletronica_interna_canvas',
      signatureHash,
      documentHash,
      signatureVersion: 2,
      latitude,
      longitude,
      device: signerDevice || null,
    },
  });
  const updated = await pool.query(`${epiTermQuery} WHERE t.id = $1 GROUP BY t.id, u.name`, [term.id]);
  res.json({ term: publicEpiTerm(updated.rows[0], true) });
});

app.post('/api/epi/terms/:id/validate-signature', auth, async (req, res) => {
  if (!canAccessEpiTerms(req.user)) return res.status(403).json({ error: 'Este perfil não possui acesso aos termos de EPI.' });
  const result = await pool.query(`${epiTermQuery} WHERE t.id = $1 GROUP BY t.id, u.name`, [req.params.id]);
  const term = result.rows[0];
  if (!term) return res.status(404).json({ error: 'Termo não encontrado.' });
  if (req.user.role === 'tecnico' && String(term.created_by) !== String(req.user.id) && String(term.signer_user_id) !== String(req.user.id)) {
    return res.status(403).json({ error: 'O técnico só pode validar os próprios termos.' });
  }

  const checkedAt = new Date().toISOString();
  const signatureVersion = Number(term.signature_version || 1);
  let valid = false;
  let documentHash = term.document_hash || null;
  let message = 'O termo ainda não possui uma assinatura verificável.';

  if (term.status === 'assinado' && term.signed_at && term.signature_hash && term.signature_data) {
    if (signatureVersion >= 2) {
      const items = await signatureItems(term.id);
      const expectedDocumentHash = sha256Json(signatureDocumentPayload(term, items));
      const expectedSignatureHash = sha256Json({
        algorithm: 'SHA-256',
        version: 2,
        documentHash: expectedDocumentHash,
        signedAt: new Date(term.signed_at).toISOString(),
        signerUserId: String(term.signer_user_id),
      });
      valid = equalHash(documentHash, expectedDocumentHash) && equalHash(term.signature_hash, expectedSignatureHash);
      message = valid ? 'Assinatura e conteúdo do termo íntegros.' : 'A assinatura ou o conteúdo do termo não conferem com o registro original.';
    } else {
      const auditResult = await pool.query(
        `SELECT metadata
         FROM audit_logs
         WHERE event_type = 'epi_term_signed'
           AND entity_type = 'epi_term'
           AND entity_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [String(term.id)],
      );
      const typedName = auditResult.rows[0]?.metadata?.typedName;
      if (typedName) {
        const expectedSignatureHash = legacySignatureHash(term, typedName);
        valid = equalHash(term.signature_hash, expectedSignatureHash);
        message = valid ? 'Assinatura histórica íntegra. O termo usa o formato anterior de validação.' : 'A assinatura histórica não confere com o registro original.';
      } else {
        message = 'Não há dados suficientes no histórico para validar esta assinatura antiga.';
      }
    }
  }

  if (valid) {
    await pool.query('UPDATE epi_terms SET signature_validated_at = $1 WHERE id = $2', [checkedAt, term.id]);
  }
  await audit({
    req,
    actorUserId: req.user.id,
    eventType: 'epi_signature_validated',
    entityType: 'epi_term',
    entityId: term.id,
    metadata: { valid, signatureVersion, signatureHash: term.signature_hash, documentHash, message },
  });

  res.json({
    valid,
    status: valid ? 'valida' : 'invalida',
    message,
    algorithm: 'SHA-256',
    signatureVersion,
    signatureHash: term.signature_hash,
    documentHash,
    signedAt: term.signed_at,
    checkedAt,
  });
});

function publicVehicleChecklist(row, includeSignatureData = false) {
  return {
    id: row.id,
    checklistType: row.checklist_type || 'quinzenal',
    dailyPeriod: row.daily_period || null,
    plate: row.plate,
    model: row.model,
    vehicleYear: row.vehicle_year,
    mileage: row.mileage,
    status: row.status,
    validationNotes: row.validation_notes,
    driverName: row.driver_name || null,
    inspectorName: row.inspector_name || null,
    targetUserId: row.target_user_id || null,
    targetName: row.target_name || null,
    targetRole: row.target_role || null,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    validatedAt: row.validated_at,
    items: row.items || [],
    media: (row.media || []).map((item) => ({
      id: item.id,
      kind: item.kind || 'vehicle_photo',
      itemKey: item.itemKey || null,
      captureContext: item.captureContext || 'original',
      uploadedBy: item.uploadedBy || null,
      mimeType: item.mimeType,
      byteSize: item.byteSize,
      sha256: item.sha256,
      deviceInfo: item.deviceInfo,
      ipAddress: item.ipAddress,
      userAgent: item.userAgent,
      latitude: item.latitude,
      longitude: item.longitude,
      locationLabel: item.locationLabel,
      createdAt: item.createdAt,
    })),
    signatures: (row.signatures || []).map((signature) => ({
      id: signature.id,
      signerUserId: signature.signerUserId,
      signerRole: signature.signerRole,
      typedName: signature.typedName,
      signedAt: signature.signedAt,
      signerIp: signature.signerIp,
      signerUserAgent: signature.signerUserAgent,
      signerDevice: signature.signerDevice,
      signerLatitude: signature.signerLatitude,
      signerLongitude: signature.signerLongitude,
      signatureMethod: signature.signatureMethod,
      signatureHash: signature.signatureHash,
      documentHash: signature.documentHash,
      signatureVersion: signature.signatureVersion,
      signatureContext: signature.signatureContext || {},
      validatedAt: signature.validatedAt,
      signatureData: includeSignatureData ? signature.signatureData : undefined,
    })),
  };
}

function vehicleSignatureItems(items) {
  return (items || []).map((item) => {
    const itemKind = item.item_kind ?? item.itemKind ?? null;
    const expectedQuantity = item.expected_quantity ?? item.expectedQuantity ?? null;
    return {
      id: String(item.id ?? ''),
      itemKey: item.item_key ?? item.itemKey ?? null,
      itemName: item.item_name ?? item.itemName ?? null,
      ...(itemKind && itemKind !== 'vehicle_item' ? { itemKind } : {}),
      ...(expectedQuantity !== null && expectedQuantity !== undefined ? { expectedQuantity: Number(expectedQuantity) } : {}),
      beforeStatus: item.before_status ?? item.beforeStatus ?? null,
      beforeDescription: item.before_description ?? item.beforeDescription ?? null,
      afterStatus: item.after_status ?? item.afterStatus ?? null,
      afterDescription: item.after_description ?? item.afterDescription ?? null,
    };
  });
}

function vehicleSignatureDocumentPayload(checklist, items, signature) {
  const signatureContext = {
    ...(signature.signatureContext?.stage ? { stage: signature.signatureContext.stage } : {}),
    ...(['vistoriador', 'admin'].includes(signature.signerRole) ? {
      decision: signature.signatureContext?.decision || null,
      notes: signature.signatureContext?.notes || null,
    } : {}),
  };
  return {
    schema: 'sigos-vehicle-checklist-signature-v2',
    checklistId: String(checklist.id),
    plate: checklist.plate,
    model: checklist.model || null,
    vehicleYear: checklist.vehicle_year ?? checklist.vehicleYear ?? null,
    mileage: checklist.mileage ?? null,
    items: vehicleSignatureItems(items),
    signerRole: signature.signerRole,
    typedName: signature.typedName,
    signedAt: new Date(signature.signedAt).toISOString(),
    signerUserId: signature.signerUserId ? String(signature.signerUserId) : null,
    signerIp: signature.signerIp || null,
    signerUserAgent: signature.signerUserAgent || null,
    signerDevice: signature.signerDevice || null,
    signerLatitude: signature.signerLatitude === null || signature.signerLatitude === undefined ? null : Number(signature.signerLatitude),
    signerLongitude: signature.signerLongitude === null || signature.signerLongitude === undefined ? null : Number(signature.signerLongitude),
    signatureMethod: signature.signatureMethod || null,
    signatureData: signature.signatureData,
    signatureContext,
  };
}

function vehicleSignatureHashes(checklist, items, signature) {
  const documentHash = sha256Json(vehicleSignatureDocumentPayload(checklist, items, signature));
  const signatureHash = sha256Json({
    algorithm: 'SHA-256',
    version: 2,
    documentHash,
    signedAt: new Date(signature.signedAt).toISOString(),
    signerUserId: String(signature.signerUserId),
    signerRole: signature.signerRole,
  });
  return { documentHash, signatureHash };
}

function parseVehicleLocation(body) {
  const signerDevice = cleanText(body.deviceInfo, 240);
  const latitude = body.latitude === null || body.latitude === undefined || body.latitude === '' ? null : Number(body.latitude);
  const longitude = body.longitude === null || body.longitude === undefined || body.longitude === '' ? null : Number(body.longitude);
  const error = (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))
    || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
    ? 'A localização informada é inválida.'
    : null;
  return { signerDevice, latitude, longitude, error };
}

function parseRegisteredVehicleSignature(user, body) {
  const location = parseVehicleLocation(body);
  if (location.error) return { ...location, typedName: cleanText(user.name, 160), signatureData: user.signature_data || '' };
  if (!user.signature_data || !user.signature_hash) {
    return { ...location, typedName: cleanText(user.name, 160), signatureData: '', error: 'Cadastre sua assinatura padrão antes de enviar um checklist de veículo.' };
  }
  if (body.signatureConfirmed !== true) {
    return { ...location, typedName: cleanText(user.name, 160), signatureData: user.signature_data, error: 'Confirme o uso da sua assinatura padrão para enviar o checklist.' };
  }
  return { ...location, typedName: cleanText(user.name, 160), signatureData: user.signature_data, error: null };
}

const vehicleChecklistQuery = `
  SELECT c.*, driver.name AS driver_name, inspector.name AS inspector_name,
    target.name AS target_name, target.role AS target_role,
    COALESCE(
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', i.id,
          'itemKey', i.item_key,
          'itemName', i.item_name,
          'itemKind', i.item_kind,
          'expectedQuantity', i.expected_quantity,
          'beforeStatus', i.before_status,
          'beforeDescription', i.before_description,
          'afterStatus', i.after_status,
          'afterDescription', i.after_description
        ) ORDER BY i.id
      ) FILTER (WHERE i.id IS NOT NULL),
      '[]'::json
    ) AS items,
    COALESCE(
      (
        SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', s.id,
            'signerUserId', s.signer_user_id,
            'signerRole', s.signer_role,
            'typedName', s.typed_name,
            'signedAt', s.signed_at,
            'signerIp', s.signer_ip,
            'signerUserAgent', s.signer_user_agent,
            'signerDevice', s.signer_device,
            'signerLatitude', s.signer_latitude,
            'signerLongitude', s.signer_longitude,
            'signatureMethod', s.signature_method,
            'signatureHash', s.signature_hash,
            'documentHash', s.document_hash,
            'signatureVersion', s.signature_version,
            'signatureData', s.signature_data,
            'signatureContext', s.signature_context,
            'validatedAt', s.validated_at
          ) ORDER BY s.id
        )
        FROM vehicle_checklist_signatures s
        WHERE s.checklist_id = c.id
      ),
      '[]'::json
    ) AS signatures,
    COALESCE(
      (
        SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', m.id,
            'kind', m.kind,
            'itemKey', m.item_key,
            'captureContext', m.capture_context,
            'uploadedBy', m.uploaded_by,
            'mimeType', m.mime_type,
            'byteSize', m.byte_size,
            'sha256', m.sha256,
            'deviceInfo', m.device_info,
            'ipAddress', m.ip_address,
            'userAgent', m.user_agent,
            'latitude', m.latitude,
            'longitude', m.longitude,
            'locationLabel', m.location_label,
            'createdAt', m.created_at
          ) ORDER BY m.created_at, m.id
        )
        FROM vehicle_checklist_media m
        WHERE m.checklist_id = c.id
      ),
      '[]'::json
    ) AS media
  FROM vehicle_checklists c
  LEFT JOIN vehicle_checklist_items i ON i.checklist_id = c.id
  LEFT JOIN users driver ON driver.id = c.driver_user_id
  LEFT JOIN users inspector ON inspector.id = c.inspector_user_id
  LEFT JOIN users target ON target.id = c.target_user_id
`;

function vehicleChecklistScope(req, alias = 'c', includePending = false) {
  if (req.user.role === 'tecnico') return { clause: ` WHERE (${alias}.driver_user_id = $1 OR ${alias}.target_user_id = $1)`, params: [req.user.id] };
  if (req.user.role === 'vistoriador') {
    const pendingClause = includePending ? ` OR ${alias}.status = 'pendente_validacao'` : '';
    return { clause: ` WHERE (${alias}.driver_user_id = $1 OR ${alias}.target_user_id = $1 OR ${alias}.inspector_user_id = $1${pendingClause})`, params: [req.user.id] };
  }
  return { clause: '', params: [] };
}

app.get('/api/vehicles/checklists/template', auth, (req, res) => {
  if (!['admin', 'superadmin', 'tecnico', 'vistoriador'].includes(req.user.role)) return res.status(403).json({ error: 'Perfil sem acesso ao checklist de veículos.' });
  res.json({ items: VEHICLE_CHECKLIST_ITEMS.map(([key, name]) => ({ key, name })), dailyItems: VEHICLE_DAILY_CHECKLIST_ITEMS.map(([key, name]) => ({ key, name })), processTypes: ['diario', 'geral', 'quinzenal', 'transferencia', 'recebimento', 'entrega', 'devolucao'] });
});

app.get('/api/vehicles/targets', auth, requireRole('admin', 'tecnico', 'vistoriador'), async (req, res) => {
  const checklistType = String(req.query.type || 'transferencia');
  if (['entrega', 'recebimento'].includes(checklistType) && !isAdminRole(req.user.role) && req.user.role !== 'vistoriador') return res.status(403).json({ error: 'Somente Admin ou Supervisor podem iniciar este processo de veículo.' });
  const targetRoles = ['entrega', 'recebimento'].includes(checklistType) ? "('tecnico')" : "('tecnico', 'vistoriador')";
  const result = await pool.query(
    `SELECT id, name, email, role
     FROM users
     WHERE active = TRUE AND id <> $1 AND role IN ${targetRoles}
     ORDER BY name`,
    [req.user.id],
  );
  res.json({ users: result.rows });
});

app.get('/api/vehicles/catalog', auth, requireRole('admin', 'tecnico', 'vistoriador'), async (_req, res) => {
  const result = await pool.query(
    `SELECT v.id, v.plate, v.model, v.vehicle_year, v.color,
            COALESCE(
              (
                SELECT json_agg(json_build_object(
                  'id', equipment.id,
                  'name', equipment.name,
                  'quantity', equipment.quantity
                ) ORDER BY equipment.name, equipment.id)
                FROM vehicle_equipment equipment
                WHERE equipment.vehicle_id = v.id AND equipment.active = TRUE
              ),
              '[]'::json
            ) AS equipment_items
     FROM vehicles v
     WHERE v.status = 'ativo'
     ORDER BY v.plate`,
  );
  res.json({ vehicles: result.rows.map((row) => ({ id: row.id, plate: row.plate, model: row.model, year: row.vehicle_year, color: row.color, equipmentItems: row.equipment_items || [] })) });
});

app.get('/api/vehicles/checklists', auth, async (req, res) => {
  const scope = vehicleChecklistScope(req, 'c', req.user.role === 'vistoriador' && req.query.queue === '1');
  const result = await pool.query(`${vehicleChecklistQuery}${scope.clause} GROUP BY c.id, driver.name, inspector.name, target.name, target.role ORDER BY c.created_at DESC LIMIT 100`, scope.params);
  res.json({ checklists: result.rows.map(publicVehicleChecklist) });
});

app.get('/api/vehicles/checklists/:id', auth, async (req, res) => {
  const includePending = req.user.role === 'vistoriador' && req.query.queue === '1';
  let clause = ' WHERE c.id = $1';
  let params = [req.params.id];
  if (req.user.role === 'tecnico') {
    clause += ' AND (c.driver_user_id = $2 OR c.target_user_id = $2)';
    params = [req.params.id, req.user.id];
  } else if (req.user.role === 'vistoriador') {
    clause += ` AND (c.driver_user_id = $2 OR c.target_user_id = $2 OR c.inspector_user_id = $2${includePending ? " OR c.status = 'pendente_validacao'" : ''})`;
    params = [req.params.id, req.user.id];
  }
  const result = await pool.query(`${vehicleChecklistQuery}${clause} GROUP BY c.id, driver.name, inspector.name, target.name, target.role`, params);
  if (!result.rows[0]) return res.status(404).json({ error: 'Checklist de veículo não encontrado.' });
  res.json({ checklist: publicVehicleChecklist(result.rows[0], true) });
});

app.get('/api/vehicles/checklists/:checklistId/media/:mediaId', auth, async (req, res) => {
  const access = await pool.query(
    `SELECT c.driver_user_id, c.target_user_id, c.inspector_user_id, c.status, m.file_path, m.mime_type
     FROM vehicle_checklist_media m
     JOIN vehicle_checklists c ON c.id = m.checklist_id
     WHERE m.id = $1 AND m.checklist_id = $2`,
    [req.params.mediaId, req.params.checklistId],
  );
  const media = access.rows[0];
  if (!media) return res.status(404).json({ error: 'Imagem do checklist não encontrada.' });
  const canAccess = isAdminRole(req.user.role)
    || String(media.driver_user_id) === String(req.user.id)
    || String(media.target_user_id || '') === String(req.user.id)
    || String(media.inspector_user_id || '') === String(req.user.id)
    || (req.user.role === 'vistoriador' && media.status === 'pendente_validacao');
  if (!canAccess) return res.status(403).json({ error: 'Você não possui acesso a esta imagem.' });
  res.type(media.mime_type).sendFile(media.file_path);
});

app.get('/api/vehicles/checklists/:id/pdf', auth, async (req, res) => {
  const includePending = req.user.role === 'vistoriador' && req.query.queue === '1';
  let clause = ' WHERE c.id = $1';
  let params = [req.params.id];
  if (req.user.role === 'tecnico') {
    clause += ' AND (c.driver_user_id = $2 OR c.target_user_id = $2)';
    params = [req.params.id, req.user.id];
  } else if (req.user.role === 'vistoriador') {
    clause += ` AND (c.driver_user_id = $2 OR c.target_user_id = $2 OR c.inspector_user_id = $2${includePending ? " OR c.status = 'pendente_validacao'" : ''})`;
    params = [req.params.id, req.user.id];
  } else if (!isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Perfil sem acesso ao checklist de veículos.' });
  }
  const result = await pool.query(`${vehicleChecklistQuery}${clause} GROUP BY c.id, driver.name, inspector.name, target.name, target.role`, params);
  if (!result.rows[0]) return res.status(404).json({ error: 'Checklist de veículo não encontrado.' });
  const company = publicCompanySettings(await getCompanySettings());
  const checklist = publicVehicleChecklist(result.rows[0], true);
  res.setHeader('Content-Type', 'application/pdf');
  pdfMediaSection(doc, checklist.pdfMedia || checklist.media, 'Fotos do checklist');  if (checklist.validationNotes) pdfParagraph(doc, `Observação da validação: ${checklist.validationNotes}`);
  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margins: { top: 42, bottom: 42, left: 42, right: 42 } });
  doc.pipe(res);
  try {
    renderVehicleChecklistPdf(doc, checklist, company);
    doc.end();
  } catch (error) {
    console.error('Não foi possível gerar o PDF do checklist de veículo:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Não foi possível gerar o PDF do checklist de veículo.' });
    else res.destroy(error);
  }
});

app.post('/api/vehicles/checklists', auth, uploadRateLimit, requireRole('admin', 'tecnico', 'vistoriador'), async (req, res) => {
  const requestedChecklistType = String(req.body.checklistType || 'quinzenal');
  const checklistType = requestedChecklistType === 'geral' ? String(req.body.checklistPurpose || '') : requestedChecklistType;
  if (!['diario', 'quinzenal', 'transferencia', 'recebimento', 'entrega', 'devolucao'].includes(checklistType)) return res.status(400).json({ error: 'Escolha a finalidade do Checklist geral.' });
  if (['entrega', 'recebimento'].includes(checklistType) && !isAdminRole(req.user.role) && req.user.role !== 'vistoriador') return res.status(403).json({ error: 'Somente Admin ou Supervisor podem iniciar este processo de veículo.' });
  const dailyPeriod = checklistType === 'diario' ? String(req.body.dailyPeriod || '') : null;
  if (checklistType === 'diario' && !['inicio', 'fim'].includes(dailyPeriod)) return res.status(400).json({ error: 'Escolha se o checklist diário é do começo ou do fim do dia.' });
  const baseChecklistDefinition = checklistType === 'diario'
    ? VEHICLE_DAILY_CHECKLIST_ITEMS.map(([itemKey, itemName]) => [itemKey, itemName, 'daily_photo', null])
    : VEHICLE_CHECKLIST_ITEMS.map(([itemKey, itemName]) => [itemKey, itemName, 'vehicle_item', null]);
  const plate = cleanText(req.body.plate, 12).toUpperCase();
  const model = cleanText(req.body.model, 120);
  const vehicleYear = req.body.vehicleYear === null || req.body.vehicleYear === undefined || req.body.vehicleYear === '' ? null : Number(req.body.vehicleYear);
  const mileage = req.body.mileage === null || req.body.mileage === undefined || req.body.mileage === '' ? null : Number(req.body.mileage);
  const targetUserId = req.body.targetUserId === null || req.body.targetUserId === undefined || req.body.targetUserId === '' ? null : Number(req.body.targetUserId);
  const submittedItems = Array.isArray(req.body.items) ? req.body.items : [];
  const signatureRequest = parseRegisteredVehicleSignature(req.user, req.body);
  const submittedSelfie = req.body.selfie && typeof req.body.selfie === 'object' ? req.body.selfie : null;
  const submittedPhotos = Array.isArray(req.body.photos) ? req.body.photos : [];
  let target = null;
  if (['transferencia', 'recebimento', 'entrega'].includes(checklistType)) {
    if (!Number.isInteger(targetUserId) || targetUserId <= 0 || targetUserId === Number(req.user.id)) return res.status(400).json({ error: 'Selecione outro usuário para receber o veículo.' });
    const targetResult = await pool.query(`SELECT id, name, role FROM users WHERE id = $1 AND active = TRUE AND role IN ${['entrega', 'recebimento'].includes(checklistType) ? "('tecnico')" : "('tecnico', 'vistoriador')"}`, [targetUserId]);
    target = targetResult.rows[0];
    if (!target) return res.status(404).json({ error: 'Usuário destinatário não encontrado ou inativo.' });
  } else if (targetUserId !== null) {
    return res.status(400).json({ error: 'O usuário destinatário só pode ser informado em uma transferência ou entrega.' });
  }
  let checklistDefinition = baseChecklistDefinition;
  if (checklistType === 'diario' && plate) {
    const vehicleResult = await pool.query('SELECT id FROM vehicles WHERE plate = $1 AND status = \'ativo\'', [plate]);
    if (vehicleResult.rows[0]) {
      const equipmentResult = await pool.query(
        `SELECT id, name, quantity
         FROM vehicle_equipment
         WHERE vehicle_id = $1 AND active = TRUE
         ORDER BY name, id`,
        [vehicleResult.rows[0].id],
      );
      checklistDefinition = [
        ...baseChecklistDefinition,
        ...equipmentResult.rows.map((item) => [`vehicle_equipment_${item.id}`, item.name, 'vehicle_equipment', Number(item.quantity)]),
      ];
    }
  }
  const itemMap = new Map(submittedItems.map((item) => [String(item.itemKey || ''), item]));
  const normalizedItems = checklistDefinition.map(([itemKey, itemName, itemKind = 'vehicle_item', expectedQuantity = null]) => {
    const item = itemMap.get(itemKey) || {};
    if (checklistType === 'diario') {
      const dailyStatus = item.status ?? item.beforeStatus;
      const status = ['ok', 'defeito', 'quebrado'].includes(dailyStatus) ? dailyStatus : 'ok';
      const observation = cleanText(item.observation || item.beforeDescription, 500) || null;
      return { itemKey, itemName, itemKind, expectedQuantity, beforeStatus: status, beforeDescription: observation, afterStatus: status, afterDescription: observation };
    }
    const beforeStatus = ['ok', 'defeito', 'quebrado'].includes(item.beforeStatus) ? item.beforeStatus : 'ok';
    const afterStatus = ['ok', 'defeito', 'quebrado'].includes(item.afterStatus) ? item.afterStatus : 'ok';
    return {
      itemKey,
      itemName,
      itemKind,
      expectedQuantity,
      beforeStatus,
      beforeDescription: beforeStatus === 'ok' ? null : cleanText(item.beforeDescription, 500) || null,
      afterStatus,
      afterDescription: afterStatus === 'ok' ? null : cleanText(item.afterDescription, 500) || null,
    };
  });
  const problemItems = normalizedItems.filter((item) => item.beforeStatus !== 'ok' || item.afterStatus !== 'ok');

  if (!plate || !model) return res.status(400).json({ error: 'Informe a placa e o modelo do veículo.' });
  if (vehicleYear !== null && (!Number.isInteger(vehicleYear) || vehicleYear < 1900 || vehicleYear > 2200)) return res.status(400).json({ error: 'Ano do veículo inválido.' });
  if (mileage !== null && (!Number.isInteger(mileage) || mileage < 0)) return res.status(400).json({ error: 'Quilometragem inválida.' });
  if (signatureRequest.error) return res.status(400).json({ error: signatureRequest.error });
  if (!submittedSelfie || submittedSelfie.captureMode !== 'camera' || !submittedSelfie.imageData) return res.status(400).json({ error: 'Capture uma selfie pela câmera antes de enviar o checklist.' });
  const allowedPhotoKeys = new Set(checklistDefinition.filter(([, , itemKind]) => itemKind !== 'vehicle_equipment').map(([itemKey]) => itemKey));
  const expectedPhotoKeys = new Set(checklistDefinition
    .filter(([itemKey, , itemKind]) => itemKind !== 'vehicle_equipment' && (checklistType === 'diario' || !VEHICLE_OPTIONAL_PHOTO_ITEM_KEYS.has(itemKey)))
    .map(([itemKey]) => itemKey));
  const itemPhotos = submittedPhotos.filter((photo) => photo?.itemKey);
  const extraPhotos = submittedPhotos.filter((photo) => !photo?.itemKey);
  const itemPhotoKeys = itemPhotos.map((photo) => String(photo.itemKey));
  const invalidPhotoKey = itemPhotoKeys.find((itemKey) => !allowedPhotoKeys.has(itemKey));
  const duplicatePhotoKey = itemPhotoKeys.find((itemKey, index) => itemPhotoKeys.indexOf(itemKey) !== index);
  const missingPhotoKey = [...expectedPhotoKeys].find((itemKey) => !itemPhotoKeys.includes(itemKey));
  if (invalidPhotoKey || duplicatePhotoKey || missingPhotoKey) return res.status(400).json({ error: 'Envie exatamente uma foto capturada pela câmera para cada item do checklist.' });
  if (extraPhotos.length > 2) return res.status(400).json({ error: 'Envie no máximo duas fotos extras do veículo.' });
  if (expectedPhotoKeys.size > 0 && !submittedPhotos.length) return res.status(400).json({ error: 'Capture as fotos obrigatórias do checklist.' });
  if (submittedPhotos.some((photo) => photo?.captureMode !== 'camera' || !photo?.imageData)) return res.status(400).json({ error: 'As fotos do veículo precisam ser capturadas pela câmera no momento do registro.' });
  try {
    parseCapturedImage(submittedSelfie.imageData);
    submittedPhotos.forEach((photo) => parseCapturedImage(photo.imageData));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const signedAt = new Date().toISOString();
  const signature = {
    signerRole: req.user.role,
    typedName: signatureRequest.typedName,
    signedAt,
    signerUserId: req.user.id,
    signerIp: clientIp(req),
    signerUserAgent: req.get('user-agent') || null,
    signerDevice: signatureRequest.signerDevice || null,
    signerLatitude: signatureRequest.latitude,
    signerLongitude: signatureRequest.longitude,
    signatureMethod: 'assinatura_eletronica_registrada',
    signatureData: signatureRequest.signatureData,
    signatureContext: {},
  };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const vehicleResult = await client.query(
      `INSERT INTO vehicles (plate, description, model, vehicle_year)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (plate) DO UPDATE SET
         description = EXCLUDED.description,
         model = COALESCE(EXCLUDED.model, vehicles.model),
         vehicle_year = COALESCE(EXCLUDED.vehicle_year, vehicles.vehicle_year)
       RETURNING id`,
      [plate, [model, vehicleYear ? `Ano ${vehicleYear}` : null].filter(Boolean).join(' · '), model, vehicleYear],
    );
    if (checklistType === 'diario') {
      const duplicate = await client.query(
        `SELECT id
         FROM vehicle_checklists
         WHERE vehicle_id = $1
           AND driver_user_id = $2
           AND checklist_type = 'diario'
           AND daily_period = $3
           AND submitted_at IS NOT NULL
           AND timezone('America/Fortaleza', submitted_at)::date = timezone('America/Fortaleza', NOW())::date
         LIMIT 1
         FOR UPDATE`,
        [vehicleResult.rows[0].id, req.user.id, dailyPeriod],
      );
      if (duplicate.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Você já registrou o checklist de ${dailyPeriod === 'inicio' ? 'começo' : 'fim'} do dia deste veículo hoje.` });
      }
    }
    const checklistResult = await client.query(
      `INSERT INTO vehicle_checklists (vehicle_id, driver_user_id, target_user_id, checklist_type, daily_period, plate, model, vehicle_year, mileage, status, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [vehicleResult.rows[0].id, req.user.id, target?.id || null, checklistType, dailyPeriod, plate, model, vehicleYear, mileage, ['transferencia', 'recebimento', 'entrega'].includes(checklistType) ? 'pendente_destinatario' : 'pendente_validacao', signedAt],
    );
    const checklistId = checklistResult.rows[0].id;
    for (const item of normalizedItems) {
      await client.query(
        `INSERT INTO vehicle_checklist_items
          (checklist_id, item_key, item_name, item_kind, expected_quantity, before_status, before_description, after_status, after_description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [checklistId, item.itemKey, item.itemName, item.itemKind, item.expectedQuantity, item.beforeStatus, item.beforeDescription, item.afterStatus, item.afterDescription],
      );
    }
    const persistedItems = await client.query(
      `SELECT id, item_key, item_name, item_kind, expected_quantity, before_status, before_description, after_status, after_description
       FROM vehicle_checklist_items
       WHERE checklist_id = $1
       ORDER BY id`,
      [checklistId],
    );
    const { documentHash, signatureHash } = vehicleSignatureHashes(
      { id: checklistId, plate, model, vehicle_year: vehicleYear, mileage },
      persistedItems.rows,
      signature,
    );
    await client.query(
      `INSERT INTO vehicle_checklist_signatures
        (checklist_id, signer_user_id, signer_role, typed_name, signed_at, signer_ip, signer_user_agent,
         signer_device, signer_latitude, signer_longitude, signature_method, signature_hash, document_hash,
         signature_version, signature_data, signature_context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 2, $14, $15::jsonb)`,
      [
        checklistId,
        req.user.id,
        signature.signerRole,
        signature.typedName,
        signature.signedAt,
        signature.signerIp,
        signature.signerUserAgent,
        signature.signerDevice,
        signature.signerLatitude,
        signature.signerLongitude,
        signature.signatureMethod,
        signatureHash,
        documentHash,
        signature.signatureData,
        JSON.stringify(signature.signatureContext),
      ],
    );
    await client.query('COMMIT');
    const media = [];
    media.push(await storeVehicleChecklistMedia({
      req,
      checklistId,
      imageData: submittedSelfie.imageData,
      kind: 'selfie',
      deviceInfo: req.body.deviceInfo,
      latitude: submittedSelfie.latitude ?? req.body.latitude,
      longitude: submittedSelfie.longitude ?? req.body.longitude,
    }));
    for (const photo of submittedPhotos) {
      media.push(await storeVehicleChecklistMedia({
        req,
        checklistId,
        imageData: photo.imageData,
        kind: 'vehicle_photo',
        itemKey: photo.itemKey,
        deviceInfo: req.body.deviceInfo,
        latitude: photo.latitude ?? req.body.latitude,
        longitude: photo.longitude ?? req.body.longitude,
      }));
    }
    await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_checklist_created', entityType: 'vehicle_checklist', entityId: checklistId, metadata: { plate, checklistType, dailyPeriod, targetUserId: target?.id || null, itemCount: normalizedItems.length, problemCount: problemItems.length, signatureHash, documentHash, signatureVersion: 2 } });
    await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_signature_signed', entityType: 'vehicle_checklist', entityId: checklistId, metadata: { signerRole: signature.signerRole, signatureHash, documentHash, signatureVersion: 2, typedName: signature.typedName, latitude: signature.signerLatitude, longitude: signature.signerLongitude, device: signature.signerDevice } });
    await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_checklist_photos_uploaded', entityType: 'vehicle_checklist', entityId: checklistId, metadata: { mediaIds: media.map((item) => item.id), selfieCount: 1, photoCount: submittedPhotos.length, captureMode: 'camera', coordinates: media.map((item) => ({ mediaId: item.id, kind: item.kind, itemKey: item.item_key, latitude: item.latitude, longitude: item.longitude, locationLabel: item.location_label })) } });
    await notifyRoles({
      roles: ['entrega', 'recebimento'].includes(checklistType) ? ['admin'] : ['admin', ...(checklistType === 'transferencia' || checklistType === 'devolucao' ? [] : ['vistoriador'])],
      notificationType: 'checklist_created',
      title: 'Novo checklist de veículo',
      message: checklistType === 'transferencia'
        ? `A transferência do veículo ${plate} foi iniciada por ${req.user.name} e aguarda o aceite de ${target.name}.`
        : ['entrega', 'recebimento'].includes(checklistType)
          ? `A entrega do veículo ${plate} foi iniciada por ${req.user.name} e aguarda o aceite do técnico ${target.name}.`
          : `O ${checklistType === 'diario' ? `checklist diário de ${dailyPeriod === 'inicio' ? 'começo' : 'fim'} do dia` : checklistType === 'devolucao' ? 'termo de devolução' : 'checklist recorrente'} do veículo ${plate} foi criado e está aguardando validação.`,
      entityType: 'vehicle_checklist',
      entityId: checklistId,
      metadata: { plate, checklistType, dailyPeriod, createdBy: req.user.id, creatorRole: req.user.role, targetUserId: target?.id || null },
    });
    if (target) {
      await notifyUsers({
        userIds: [target.id],
        notificationType: ['entrega', 'recebimento'].includes(checklistType) ? 'vehicle_delivery_recipient' : 'vehicle_transfer_recipient',
        title: ['entrega', 'recebimento'].includes(checklistType) ? `${checklistType === 'recebimento' ? 'Recebimento' : 'Entrega'} de veículo para seu aceite` : 'Transferência de veículo para sua validação',
        message: ['entrega', 'recebimento'].includes(checklistType)
          ? `${req.user.name} registrou o ${checklistType === 'recebimento' ? 'recebimento' : 'entrega'} do veículo ${plate} para você. Abra o checklist, confira os itens, assine e tire a selfie para aceitar.`
          : `${req.user.name} enviou o veículo ${plate} para você. Abra o checklist, confira os itens, assine e tire a selfie para aceitar a transferência.`,
        entityType: 'vehicle_checklist',
        entityId: checklistId,
        metadata: { plate, checklistType, createdBy: req.user.id, targetUserId: target.id },
      });
    }
    if (problemItems.length) {
      await notifyRoles({
        roles: ['admin'],
        notificationType: 'vehicle_checklist_issue',
        title: 'Avaria identificada em veículo',
        message: `O ${checklistType === 'diario' ? 'checklist diário' : checklistType === 'devolucao' ? 'termo de devolução' : checklistType === 'transferencia' ? 'processo de transferência' : checklistType === 'recebimento' ? 'processo de recebimento' : checklistType === 'entrega' ? 'termo de entrega' : 'checklist recorrente'} do veículo ${plate} registrou ${problemItems.length} item(ns) com avaria ou irregularidade.`,
        entityType: 'vehicle_checklist',
        entityId: checklistId,
        metadata: {
          plate,
          checklistType,
          createdBy: req.user.id,
          problemCount: problemItems.length,
          problemItems: problemItems.map((item) => ({ itemKey: item.itemKey, itemName: item.itemName, beforeStatus: item.beforeStatus, afterStatus: item.afterStatus })),
        },
      });
    }
    const created = await pool.query(`${vehicleChecklistQuery} WHERE c.id = $1 GROUP BY c.id, driver.name, inspector.name, target.name, target.role`, [checklistId]);
    res.status(201).json({ checklist: publicVehicleChecklist(created.rows[0], true) });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

app.post('/api/vehicles/checklists/:id/accept-transfer', auth, requireRole('admin', 'tecnico', 'vistoriador'), async (req, res) => {
  const pending = await pool.query(`${vehicleChecklistQuery} WHERE c.id = $1 AND c.status = 'pendente_destinatario' AND c.target_user_id = $2 GROUP BY c.id, driver.name, inspector.name, target.name, target.role`, [req.params.id, req.user.id]);
  const checklist = pending.rows[0];
  if (!checklist || !['transferencia', 'recebimento', 'entrega'].includes(checklist.checklist_type)) return res.status(404).json({ error: 'Processo pendente para este usuário não encontrado.' });
  const isDelivery = ['recebimento', 'entrega'].includes(checklist.checklist_type);
  const signatureRequest = parseRegisteredVehicleSignature(req.user, req.body);
  const submittedSelfie = req.body.selfie && typeof req.body.selfie === 'object' ? req.body.selfie : null;
  if (signatureRequest.error) return res.status(400).json({ error: signatureRequest.error });
  const acceptanceWord = checklist.checklist_type === 'recebimento' ? 'recebimento' : isDelivery ? 'entrega' : 'transferência';
  if (!submittedSelfie || submittedSelfie.captureMode !== 'camera' || !submittedSelfie.imageData) return res.status(400).json({ error: `Capture uma selfie pela câmera antes de aceitar o ${acceptanceWord}.` });
  try { parseCapturedImage(submittedSelfie.imageData); } catch (error) { return res.status(400).json({ error: error.message }); }

  const signedAt = new Date().toISOString();
  const signature = {
    signerRole: req.user.role,
    typedName: signatureRequest.typedName,
    signedAt,
    signerUserId: req.user.id,
    signerIp: clientIp(req),
    signerUserAgent: req.get('user-agent') || null,
    signerDevice: signatureRequest.signerDevice || null,
    signerLatitude: signatureRequest.latitude,
    signerLongitude: signatureRequest.longitude,
    signatureMethod: 'assinatura_eletronica_registrada',
    signatureData: signatureRequest.signatureData,
    signatureContext: { stage: isDelivery ? 'delivery_recipient' : 'transfer_recipient', sourceUserId: String(checklist.driver_user_id) },
  };
  const { documentHash, signatureHash } = vehicleSignatureHashes(checklist, checklist.items, signature);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE vehicle_checklists
       SET status = $1,
           inspector_user_id = CASE WHEN $1 = 'validado' THEN $2 ELSE inspector_user_id END,
           validated_at = CASE WHEN $1 = 'validado' THEN $3 ELSE validated_at END
       WHERE id = $4 AND status = 'pendente_destinatario' AND target_user_id = $5
       RETURNING id, plate`,
      [isDelivery ? 'validado' : 'pendente_validacao', req.user.id, signedAt, req.params.id, req.user.id],
    );
    if (!updated.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Esta ${acceptanceWord} já foi aceita ou não está mais disponível.` });
    }
    await client.query(
      `INSERT INTO vehicle_checklist_signatures
        (checklist_id, signer_user_id, signer_role, typed_name, signed_at, signer_ip, signer_user_agent,
         signer_device, signer_latitude, signer_longitude, signature_method, signature_hash, document_hash,
         signature_version, signature_data, signature_context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 2, $14, $15::jsonb)`,
      [req.params.id, req.user.id, signature.signerRole, signature.typedName, signature.signedAt, signature.signerIp, signature.signerUserAgent, signature.signerDevice, signature.signerLatitude, signature.signerLongitude, signature.signatureMethod, signatureHash, documentHash, signature.signatureData, JSON.stringify(signature.signatureContext)],
    );
    await client.query('COMMIT');
    const media = await storeVehicleChecklistMedia({ req, checklistId: req.params.id, imageData: submittedSelfie.imageData, kind: 'selfie', deviceInfo: req.body.deviceInfo, latitude: submittedSelfie.latitude ?? req.body.latitude, longitude: submittedSelfie.longitude ?? req.body.longitude });
    await audit({ req, actorUserId: req.user.id, eventType: isDelivery ? 'vehicle_delivery_accepted' : 'vehicle_transfer_accepted', entityType: 'vehicle_checklist', entityId: req.params.id, metadata: { plate: updated.rows[0].plate, signatureHash, documentHash, mediaId: media.id, sourceUserId: checklist.driver_user_id, finalized: isDelivery, checklistType: checklist.checklist_type } });
    await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_signature_signed', entityType: 'vehicle_checklist', entityId: req.params.id, metadata: { signerRole: signature.signerRole, signatureContext: signature.signatureContext, signatureHash, documentHash, typedName: signature.typedName, latitude: signature.signerLatitude, longitude: signature.signerLongitude, device: signature.signerDevice } });
    await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_checklist_photos_uploaded', entityType: 'vehicle_checklist', entityId: req.params.id, metadata: { mediaIds: [media.id], selfieCount: 1, photoCount: 0, captureMode: 'camera' } });
    if (isDelivery) {
      const deliveryLabel = checklist.checklist_type === 'recebimento' ? 'recebimento' : 'entrega';
      await notifyRoles({ roles: ['admin'], notificationType: 'vehicle_delivery_accepted', title: `${deliveryLabel[0].toUpperCase()}${deliveryLabel.slice(1)} de veículo aceita`, message: `O técnico ${req.user.name} aceitou o ${deliveryLabel} do veículo ${updated.rows[0].plate} com assinatura e selfie.`, entityType: 'vehicle_checklist', entityId: req.params.id, metadata: { plate: updated.rows[0].plate, acceptedBy: req.user.id, sourceUserId: checklist.driver_user_id, status: 'validado', checklistType: checklist.checklist_type } });
      await notifyUsers({ userIds: [checklist.driver_user_id], notificationType: 'vehicle_delivery_accepted', title: `${deliveryLabel[0].toUpperCase()}${deliveryLabel.slice(1)} de veículo aceita`, message: `${req.user.name} aceitou o ${deliveryLabel} do veículo ${updated.rows[0].plate}. O processo foi concluído.`, entityType: 'vehicle_checklist', entityId: req.params.id, metadata: { plate: updated.rows[0].plate, acceptedBy: req.user.id, status: 'validado', checklistType: checklist.checklist_type } });
    } else {
      await notifyRoles({ roles: ['admin'], notificationType: 'vehicle_transfer_ready_for_admin', title: 'Transferência de veículo pronta para validação', message: `A transferência do veículo ${updated.rows[0].plate} foi aceita por ${req.user.name} e aguarda validação do Admin.`, entityType: 'vehicle_checklist', entityId: req.params.id, metadata: { plate: updated.rows[0].plate, acceptedBy: req.user.id, sourceUserId: checklist.driver_user_id } });
      await notifyUsers({ userIds: [checklist.driver_user_id], notificationType: 'vehicle_transfer_recipient_accepted', title: 'Transferência de veículo aceita', message: `${req.user.name} aceitou a transferência do veículo ${updated.rows[0].plate}. O processo agora aguarda a validação do Admin.`, entityType: 'vehicle_checklist', entityId: req.params.id, metadata: { plate: updated.rows[0].plate, acceptedBy: req.user.id } });
    }
    const result = await pool.query(`${vehicleChecklistQuery} WHERE c.id = $1 GROUP BY c.id, driver.name, inspector.name, target.name, target.role`, [req.params.id]);
    res.json({ checklist: publicVehicleChecklist(result.rows[0], true) });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

app.post('/api/vehicles/checklists/:id/validate', auth, requireRole('admin', 'vistoriador'), async (req, res) => {
  const decision = String(req.body.decision || '');
  const validationNotes = cleanText(req.body.notes, 700);
  if (!['validado', 'reprovado'].includes(decision)) return res.status(400).json({ error: 'Informe se a vistoria foi validada ou reprovada.' });
  const signatureRequest = parseRegisteredVehicleSignature(req.user, req.body);
  if (signatureRequest.error) return res.status(400).json({ error: signatureRequest.error });
  const validationSelfie = req.body.validationSelfie && typeof req.body.validationSelfie === 'object' ? req.body.validationSelfie : null;
  if (!validationSelfie || validationSelfie.captureMode !== 'camera' || !validationSelfie.imageData) return res.status(400).json({ code: 'VALIDATOR_SELFIE_REQUIRED', error: 'Capture uma selfie pela câmera antes de validar este checklist.' });
  try { parseCapturedImage(validationSelfie.imageData); } catch (error) { return res.status(400).json({ code: 'VALIDATOR_SELFIE_INVALID', error: error.message }); }
  const pending = await pool.query(`${vehicleChecklistQuery} WHERE c.id = $1 AND c.status = 'pendente_validacao' GROUP BY c.id, driver.name, inspector.name, target.name, target.role`, [req.params.id]);
  const checklist = pending.rows[0];
  if (!checklist) return res.status(404).json({ error: 'Checklist pendente não encontrado.' });
  if (['transferencia', 'devolucao'].includes(checklist.checklist_type) && !isAdminRole(req.user.role)) return res.status(403).json({ error: 'Este processo precisa ser validado por um administrador.' });
  if (checklist.checklist_type === 'transferencia') {
    const recipientSigned = (checklist.signatures || []).some((item) => item.signerUserId && String(item.signerUserId) === String(checklist.target_user_id) && item.signatureContext?.stage === 'transfer_recipient');
    const recipientSelfie = (checklist.media || []).some((item) => item.kind === 'selfie' && item.uploadedBy && String(item.uploadedBy) === String(checklist.target_user_id));
    if (!recipientSigned || !recipientSelfie) return res.status(409).json({ error: 'A transferência ainda precisa ser aceita pelo usuário destinatário com assinatura e selfie.' });
  }

  const signedAt = new Date().toISOString();
  const signature = {
    signerRole: isSuperadminRole(req.user.role) ? 'admin' : req.user.role,
    typedName: signatureRequest.typedName,
    signedAt,
    signerUserId: req.user.id,
    signerIp: clientIp(req),
    signerUserAgent: req.get('user-agent') || null,
    signerDevice: signatureRequest.signerDevice || null,
    signerLatitude: signatureRequest.latitude,
    signerLongitude: signatureRequest.longitude,
    signatureMethod: 'assinatura_eletronica_registrada',
    signatureData: signatureRequest.signatureData,
    signatureContext: { decision, notes: validationNotes || null },
  };
  const { documentHash, signatureHash } = vehicleSignatureHashes(checklist, checklist.items, signature);
  const validationMedia = await storeVehicleChecklistMedia({
    req,
    checklistId: checklist.id,
    imageData: validationSelfie.imageData,
    kind: 'selfie',
    captureContext: 'validation',
    deviceInfo: validationSelfie.deviceInfo || req.body.deviceInfo,
    latitude: validationSelfie.latitude,
    longitude: validationSelfie.longitude,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE vehicle_checklists
       SET status = $1, inspector_user_id = $2, validation_notes = $3, validated_at = $4
       WHERE id = $5 AND status = 'pendente_validacao'
       RETURNING id, plate, status`,
      [decision, req.user.id, validationNotes || null, signedAt, req.params.id],
    );
    if (!result.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Checklist pendente não encontrado.' });
    }
    await client.query(
      `INSERT INTO vehicle_checklist_signatures
        (checklist_id, signer_user_id, signer_role, typed_name, signed_at, signer_ip, signer_user_agent,
         signer_device, signer_latitude, signer_longitude, signature_method, signature_hash, document_hash,
         signature_version, signature_data, signature_context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 2, $14, $15::jsonb)`,
      [
        req.params.id,
        req.user.id,
        signature.signerRole,
        signature.typedName,
        signature.signedAt,
        signature.signerIp,
        signature.signerUserAgent,
        signature.signerDevice,
        signature.signerLatitude,
        signature.signerLongitude,
        signature.signatureMethod,
        signatureHash,
        documentHash,
        signature.signatureData,
        JSON.stringify(signature.signatureContext),
      ],
    );
    await client.query('COMMIT');
    await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_checklist_validated', entityType: 'vehicle_checklist', entityId: result.rows[0].id, metadata: { decision, plate: result.rows[0].plate, notes: validationNotes || null, signatureHash, documentHash, validationMediaId: validationMedia.id, signatureVersion: 2 } });
    await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_signature_signed', entityType: 'vehicle_checklist', entityId: result.rows[0].id, metadata: { signerRole: signature.signerRole, decision, signatureHash, documentHash, validationMediaId: validationMedia.id, signatureVersion: 2, typedName: signature.typedName, latitude: signature.signerLatitude, longitude: signature.signerLongitude, device: signature.signerDevice, signatureMethod: signature.signatureMethod } });
    await notifyRoles({
      roles: ['admin'],
      notificationType: 'checklist_validated',
      title: 'Checklist validado',
      message: `O checklist do veículo ${result.rows[0].plate} foi ${decision === 'validado' ? 'validado' : 'reprovado'} por ${req.user.name}.`,
      entityType: 'vehicle_checklist',
      entityId: result.rows[0].id,
      metadata: { plate: result.rows[0].plate, decision, validatedBy: req.user.id, notes: validationNotes || null },
    });
    await notifyUsers({
      userIds: [checklist.driver_user_id, checklist.target_user_id].filter(Boolean),
      notificationType: 'vehicle_checklist_validation_result',
      title: `Processo de veículo ${decision === 'validado' ? 'validado' : 'reprovado'}`,
      message: `O ${checklist.checklist_type === 'devolucao' ? 'termo de devolução' : checklist.checklist_type === 'transferencia' ? 'processo de transferência' : 'checklist'} do veículo ${result.rows[0].plate} foi ${decision === 'validado' ? 'validado' : 'reprovado'} pelo Admin ${req.user.name}.`,
      entityType: 'vehicle_checklist',
      entityId: result.rows[0].id,
      metadata: { plate: result.rows[0].plate, decision, validatedBy: req.user.id, checklistType: checklist.checklist_type, notes: validationNotes || null },
    });
    const updated = await pool.query(`${vehicleChecklistQuery} WHERE c.id = $1 GROUP BY c.id, driver.name, inspector.name, target.name, target.role`, [req.params.id]);
    res.json({ checklist: publicVehicleChecklist(updated.rows[0], true) });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

app.post('/api/vehicles/checklists/:id/validate-signature', auth, async (req, res) => {
  const signerRole = String(req.body.signerRole || '');
  const signatureId = req.body.signatureId === null || req.body.signatureId === undefined || req.body.signatureId === '' ? null : String(req.body.signatureId);
  if (!['tecnico', 'vistoriador', 'admin'].includes(signerRole)) return res.status(400).json({ error: 'Informe o tipo de assinatura a validar.' });
  if (req.user.role === 'tecnico' && signerRole !== 'tecnico') return res.status(403).json({ error: 'O técnico só pode validar a própria assinatura.' });
  if (req.user.role === 'vistoriador' && signerRole !== 'vistoriador') return res.status(403).json({ error: 'O Supervisor só pode validar a própria assinatura.' });
  if (!['admin', 'superadmin', 'tecnico', 'vistoriador'].includes(req.user.role)) return res.status(403).json({ error: 'Perfil sem acesso à validação de assinaturas.' });

  let clause = ' WHERE c.id = $1';
  let params = [req.params.id];
  if (req.user.role === 'tecnico') {
    clause += ' AND (c.driver_user_id = $2 OR c.target_user_id = $2)';
    params = [req.params.id, req.user.id];
  } else if (req.user.role === 'vistoriador') {
    clause += ' AND (c.driver_user_id = $2 OR c.target_user_id = $2 OR c.inspector_user_id = $2)';
    params = [req.params.id, req.user.id];
  }
  const result = await pool.query(`${vehicleChecklistQuery}${clause} GROUP BY c.id, driver.name, inspector.name, target.name, target.role`, params);
  const checklist = result.rows[0];
  if (!checklist) return res.status(404).json({ error: 'Checklist de veículo não encontrado.' });
  const signature = (checklist.signatures || []).find((item) => (signatureId ? String(item.id) === signatureId : item.signerRole === signerRole) && item.signerRole === signerRole);
  if (!signature) return res.status(404).json({ error: 'Assinatura não encontrada para este checklist.' });

  const signaturePayload = {
    signerRole: signature.signerRole,
    typedName: signature.typedName,
    signedAt: signature.signedAt,
    signerUserId: signature.signerUserId,
    signerIp: signature.signerIp,
    signerUserAgent: signature.signerUserAgent,
    signerDevice: signature.signerDevice,
    signerLatitude: signature.signerLatitude,
    signerLongitude: signature.signerLongitude,
    signatureMethod: signature.signatureMethod,
    signatureData: signature.signatureData,
    signatureContext: signature.signatureContext || {},
  };
  const expected = vehicleSignatureHashes(checklist, checklist.items, signaturePayload);
  const valid = Number(signature.signatureVersion || 1) >= 2
    && equalHash(signature.documentHash, expected.documentHash)
    && equalHash(signature.signatureHash, expected.signatureHash);
  const checkedAt = new Date().toISOString();
  if (valid) await pool.query('UPDATE vehicle_checklist_signatures SET validated_at = $1 WHERE id = $2', [checkedAt, signature.id]);
  const message = valid ? 'Assinatura e conteúdo do checklist íntegros.' : 'A assinatura ou o conteúdo do checklist não conferem com o registro original.';
  await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_signature_validated', entityType: 'vehicle_checklist', entityId: checklist.id, metadata: { valid, signatureId: signature.id, signerRole, signatureHash: signature.signatureHash, documentHash: signature.documentHash, message } });
  res.json({ valid, status: valid ? 'valida' : 'invalida', message, algorithm: 'SHA-256', signatureVersion: signature.signatureVersion, signatureId: signature.id, signerRole, signatureHash: signature.signatureHash, documentHash: signature.documentHash, signedAt: signature.signedAt, checkedAt });
});

function publicStockVehicle(row) {
  return {
    id: row.id,
    plate: row.plate,
    model: row.model,
    year: row.vehicle_year,
    color: row.color,
    status: row.status,
    lastDriver: row.last_driver || null,
    lastChecklistStatus: row.last_checklist_status || null,
    lastChecklistType: row.last_checklist_type || 'quinzenal',
    lastChecklistAt: row.last_checklist_at || null,
    lastChecklistId: row.last_checklist_id || null,
    integrityItems: row.integrity_items || [],
    equipmentItems: row.equipment_items || [],
  };
}

function publicStockPpe(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    ca: row.ca,
    category: row.category,
    stockQuantity: row.stock_quantity,
    availableQuantity: row.available_quantity === undefined ? row.stock_quantity : Number(row.available_quantity),
    minimumStock: row.minimum_stock,
    active: row.active,
    deactivatedAt: row.deactivated_at || null,
    assignedTo: row.assigned_to || null,
    assignedQuantity: Number(row.assigned_quantity || 0),
    assignedUsers: row.assigned_users || [],
    stockStatus: row.stock_status || null,
  };
}

function publicStockMovement(row) {
  return {
    id: row.id,
    movementType: row.movement_type,
    quantity: Number(row.quantity),
    ppeItemId: row.ppe_item_id,
    ppeName: row.ppe_name,
    ca: row.ca,
    fromUserId: row.from_user_id,
    fromUser: row.from_user || null,
    toUserId: row.to_user_id,
    toUser: row.to_user || null,
    processId: row.process_id,
    processType: row.process_type || null,
    termId: row.term_id,
    createdBy: row.created_by_name || null,
    notes: row.notes || null,
    createdAt: row.created_at,
  };
}

app.get('/api/stock', auth, requireRole('admin'), async (_req, res) => {
  const [vehicles, ppes] = await Promise.all([
    pool.query(`
      SELECT v.*, last_checklist.driver_name AS last_driver,
             last_checklist.status AS last_checklist_status,
             last_checklist.created_at AS last_checklist_at,
             last_checklist.id AS last_checklist_id,
             last_checklist.checklist_type AS last_checklist_type,
             last_checklist.integrity_items,
             COALESCE(
               (
                 SELECT json_agg(json_build_object(
                   'id', equipment.id,
                   'name', equipment.name,
                   'quantity', equipment.quantity,
                   'active', equipment.active
                 ) ORDER BY equipment.name, equipment.id)
                 FROM vehicle_equipment equipment
                 WHERE equipment.vehicle_id = v.id AND equipment.active = TRUE
               ),
               '[]'::json
             ) AS equipment_items
      FROM vehicles v
      LEFT JOIN LATERAL (
        SELECT vc.id, vc.status, vc.checklist_type, vc.created_at, vc.driver_user_id, u.name AS driver_name,
               COALESCE(
                  (SELECT json_agg(json_build_object(
                    'itemKey', i.item_key,
                    'itemName', i.item_name,
                    'beforeStatus', i.before_status,
                    'beforeDescription', i.before_description,
                    'afterStatus', i.after_status,
                     'afterDescription', i.after_description,
                     'reportedByUserId', vc.driver_user_id,
                     'reportedBy', u.name,
                     'reportedAt', vc.created_at,
                     'integrityActionId', integrity_action.id,
                     'integrityActionStatus', integrity_action.status,
                     'integrityAssignedTo', integrity_action.assigned_to,
                     'integrityAssignedToName', integrity_action.assigned_to_name,
                     'integrityInstruction', integrity_action.instruction,
                     'integrityCorrectedAt', integrity_action.corrected_at,
                     'integrityCorrectionNote', integrity_action.correction_note
                  ) ORDER BY i.id)
                  FROM vehicle_checklist_items i
                   LEFT JOIN LATERAL (
                     SELECT action.id, action.status, action.assigned_to, action.instruction, action.corrected_at, action.correction_note,
                            assignee.name AS assigned_to_name
                     FROM vehicle_integrity_actions action
                     LEFT JOIN users assignee ON assignee.id = action.assigned_to
                     WHERE action.checklist_id = vc.id AND action.item_key = i.item_key
                     ORDER BY action.created_at DESC, action.id DESC
                     LIMIT 1
                   ) integrity_action ON TRUE
                  WHERE i.checklist_id = vc.id),
                 '[]'::json
               ) AS integrity_items
        FROM vehicle_checklists vc
        LEFT JOIN users u ON u.id = vc.driver_user_id
        WHERE vc.vehicle_id = v.id OR vc.plate = v.plate
        ORDER BY vc.created_at DESC, vc.id DESC
        LIMIT 1
      ) last_checklist ON TRUE
      ORDER BY v.plate`,
    ),
    pool.query(`
      WITH holding_deltas AS (
        SELECT ppe_item_id, to_user_id AS user_id, quantity::bigint AS delta
        FROM ppe_stock_movements
        WHERE to_user_id IS NOT NULL
        UNION ALL
        SELECT ppe_item_id, from_user_id AS user_id, (-quantity)::bigint AS delta
        FROM ppe_stock_movements
        WHERE from_user_id IS NOT NULL
      ), holding_by_user AS (
        SELECT h.ppe_item_id, h.user_id, u.name AS user_name, SUM(h.delta)::int AS quantity
        FROM holding_deltas h
        LEFT JOIN users u ON u.id = h.user_id
        GROUP BY h.ppe_item_id, h.user_id, u.name
        HAVING SUM(h.delta) > 0
      ), holding_totals AS (
        SELECT ppe_item_id,
               SUM(quantity)::int AS assigned_quantity,
               json_agg(json_build_object('id', user_id, 'name', user_name, 'quantity', quantity) ORDER BY user_name) AS assigned_users
        FROM holding_by_user
        GROUP BY ppe_item_id
      )
      SELECT p.*,
             COALESCE(h.assigned_quantity, 0)::int AS assigned_quantity,
             (p.stock_quantity - COALESCE(h.assigned_quantity, 0))::int AS available_quantity,
             h.assigned_users,
             CASE
               WHEN p.stock_quantity - COALESCE(h.assigned_quantity, 0) < 0 THEN 'inconsistente'
               WHEN p.stock_quantity - COALESCE(h.assigned_quantity, 0) = 0 THEN 'indisponivel'
               WHEN p.stock_quantity - COALESCE(h.assigned_quantity, 0) <= p.minimum_stock THEN 'baixo'
               ELSE 'normal'
             END AS stock_status,
             COALESCE((h.assigned_users->0->>'name'), NULL) AS assigned_to
      FROM ppe_items p
      LEFT JOIN holding_totals h ON h.ppe_item_id = p.id
      WHERE p.active = TRUE
         OR (p.deactivated_at IS NOT NULL AND p.deactivated_at > NOW() - INTERVAL '7 days')
      ORDER BY p.name`,
    ),
  ]);
  const movements = await pool.query(
    `SELECT m.id, m.ppe_item_id, m.movement_type, m.quantity,
            m.from_user_id, from_user.name AS from_user,
            m.to_user_id, to_user.name AS to_user,
            m.process_id, process.process_type,
            m.term_id, creator.name AS created_by_name,
            m.notes, m.created_at, p.name AS ppe_name, p.ca
     FROM ppe_stock_movements m
     JOIN ppe_items p ON p.id = m.ppe_item_id
     LEFT JOIN users from_user ON from_user.id = m.from_user_id
     LEFT JOIN users to_user ON to_user.id = m.to_user_id
     LEFT JOIN users creator ON creator.id = m.created_by
     LEFT JOIN epi_processes process ON process.id = m.process_id
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT 100`,
  );
  res.json({ vehicles: vehicles.rows.map(publicStockVehicle), ppes: ppes.rows.map(publicStockPpe), movements: movements.rows.map(publicStockMovement) });
});

async function findVehicleIntegrityIssue({ vehicleId, checklistId, itemKey }) {
  const result = await pool.query(
    `SELECT c.id AS checklist_id, c.vehicle_id, c.plate, c.driver_user_id,
            driver.name AS reported_by, i.item_key, i.item_name,
            i.before_status, i.before_description,
            i.after_status, i.after_description
     FROM vehicle_checklists c
     JOIN vehicles v ON v.id = $1
       AND (c.vehicle_id = v.id OR c.plate = v.plate)
     JOIN vehicle_checklist_items i ON i.checklist_id = c.id AND i.item_key = $3
     LEFT JOIN users driver ON driver.id = c.driver_user_id
     WHERE c.id = $2
     LIMIT 1`,
    [vehicleId, checklistId, itemKey],
  );
  const row = result.rows[0];
  if (!row) return null;
  if (![row.before_status, row.after_status].some((status) => status && status !== 'ok')) return null;
  return row;
}

function publicVehicleIntegrityAction(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    vehicleId: row.vehicle_id,
    checklistId: row.checklist_id,
    itemKey: row.item_key,
    itemName: row.item_name,
    assignedTo: row.assigned_to || null,
    assignedToName: row.assigned_to_name || null,
    assignedBy: row.assigned_by || null,
    instruction: row.instruction || null,
    createdAt: row.created_at,
    correctedAt: row.corrected_at || null,
    correctedBy: row.corrected_by || null,
    correctionNote: row.correction_note || null,
  };
}

app.post('/api/stock/vehicle-integrity/resolve', auth, requireRole('admin'), async (req, res) => {
  const vehicleId = Number(req.body.vehicleId);
  const checklistId = Number(req.body.checklistId);
  const itemKey = cleanText(req.body.itemKey, 180);
  const correctionNote = cleanText(req.body.note, 500) || null;
  if (!Number.isInteger(vehicleId) || vehicleId < 1 || !Number.isInteger(checklistId) || checklistId < 1 || !itemKey) {
    return res.status(400).json({ error: 'Informe o veículo, o checklist e o item da integridade.' });
  }
  const issue = await findVehicleIntegrityIssue({ vehicleId, checklistId, itemKey });
  if (!issue) return res.status(404).json({ error: 'A avaria informada não foi encontrada ou já não está pendente.' });
  const existing = await pool.query(
    `SELECT action.*, assignee.name AS assigned_to_name
     FROM vehicle_integrity_actions action
     LEFT JOIN users assignee ON assignee.id = action.assigned_to
     WHERE action.checklist_id = $1 AND action.item_key = $2
     ORDER BY action.created_at DESC, action.id DESC
     LIMIT 1`,
    [checklistId, itemKey],
  );
  if (existing.rows[0]?.status === 'corrigida') return res.status(409).json({ error: 'Este item já foi marcado como corrigido.' });
  const result = existing.rows[0]
    ? await pool.query(
      `UPDATE vehicle_integrity_actions
       SET status = 'corrigida', corrected_at = NOW(), corrected_by = $2,
           correction_note = $3
       WHERE id = $1
       RETURNING *`,
      [existing.rows[0].id, req.user.id, correctionNote],
    )
    : await pool.query(
      `INSERT INTO vehicle_integrity_actions
        (vehicle_id, checklist_id, item_key, item_name, status, assigned_by, corrected_at, corrected_by, correction_note)
       VALUES ($1, $2, $3, $4, 'corrigida', $5, NOW(), $5, $6)
       RETURNING *`,
      [vehicleId, checklistId, itemKey, issue.item_name, req.user.id, correctionNote],
    );
  const action = result.rows[0];
  const recipientIds = [issue.driver_user_id, existing.rows[0]?.assigned_to].filter((id) => Number(id) !== Number(req.user.id));
  await notifyUsers({
    userIds: recipientIds,
    notificationType: 'vehicle_integrity_corrected',
    title: 'Avaria de veículo marcada como corrigida',
    message: `${issue.item_name} do veículo ${issue.plate} foi marcada como corrigida por ${req.user.name}.`,
    entityType: 'vehicle_integrity_action',
    entityId: action.id,
    metadata: { vehicleId, checklistId, itemKey, itemName: issue.item_name, reportedBy: issue.reported_by || null, correctedBy: req.user.name, correctionNote },
  });
  await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_integrity_corrected', entityType: 'vehicle_integrity_action', entityId: action.id, metadata: { vehicleId, checklistId, itemKey, itemName: issue.item_name, reportedBy: issue.reported_by || null, correctionNote } });
  res.json({ action: publicVehicleIntegrityAction({ ...action, vehicle_id: vehicleId, checklist_id: checklistId, item_key: itemKey, item_name: issue.item_name }) });
});

app.post('/api/stock/vehicle-integrity/assign', auth, requireRole('admin'), async (req, res) => {
  const vehicleId = Number(req.body.vehicleId);
  const checklistId = Number(req.body.checklistId);
  const itemKey = cleanText(req.body.itemKey, 180);
  const assignedTo = Number(req.body.assignedTo);
  const instruction = cleanText(req.body.instruction, 500) || null;
  if (!Number.isInteger(vehicleId) || vehicleId < 1 || !Number.isInteger(checklistId) || checklistId < 1 || !itemKey || !Number.isInteger(assignedTo) || assignedTo < 1) {
    return res.status(400).json({ error: 'Informe o veículo, o checklist, o item e o usuário responsável.' });
  }
  if (assignedTo === Number(req.user.id)) return res.status(400).json({ error: 'Selecione outro usuário para receber esta pendência.' });
  const issue = await findVehicleIntegrityIssue({ vehicleId, checklistId, itemKey });
  if (!issue) return res.status(404).json({ error: 'A avaria informada não foi encontrada ou já não está pendente.' });
  const assignee = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND active = TRUE', [assignedTo]);
  if (!assignee.rows[0]) return res.status(404).json({ error: 'Usuário responsável não encontrado ou inativo.' });
  const latest = await pool.query(
    `SELECT status FROM vehicle_integrity_actions
     WHERE checklist_id = $1 AND item_key = $2
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [checklistId, itemKey],
  );
  if (latest.rows[0]?.status === 'corrigida') return res.status(409).json({ error: 'Este item já foi marcado como corrigido.' });
  const result = await pool.query(
    `INSERT INTO vehicle_integrity_actions
      (vehicle_id, checklist_id, item_key, item_name, status, assigned_to, assigned_by, instruction)
     VALUES ($1, $2, $3, $4, 'pendente', $5, $6, $7)
     ON CONFLICT (checklist_id, item_key) WHERE status = 'pendente'
     DO UPDATE SET assigned_to = EXCLUDED.assigned_to, assigned_by = EXCLUDED.assigned_by,
                   instruction = EXCLUDED.instruction, created_at = NOW()
     RETURNING *`,
    [vehicleId, checklistId, itemKey, issue.item_name, assignedTo, req.user.id, instruction],
  );
  const action = result.rows[0];
  await notifyUsers({
    userIds: [assignedTo],
    notificationType: 'vehicle_integrity_assigned',
    title: 'Pendência de integridade de veículo',
    message: `${req.user.name} enviou para você a correção de ${issue.item_name} do veículo ${issue.plate}.`,
    entityType: 'vehicle_integrity_action',
    entityId: action.id,
    metadata: { vehicleId, checklistId, itemKey, itemName: issue.item_name, reportedBy: issue.reported_by || null, assignedBy: req.user.name, instruction },
  });
  await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_integrity_assigned', entityType: 'vehicle_integrity_action', entityId: action.id, metadata: { vehicleId, checklistId, itemKey, itemName: issue.item_name, reportedBy: issue.reported_by || null, assignedTo, instruction } });
  res.status(201).json({ action: publicVehicleIntegrityAction({ ...action, vehicle_id: vehicleId, checklist_id: checklistId, item_key: itemKey, item_name: issue.item_name, assigned_to_name: assignee.rows[0].name }) });
});

app.post('/api/stock/vehicles', auth, requireRole('admin'), async (req, res) => {
  const id = req.body.id === null || req.body.id === undefined || req.body.id === '' ? null : Number(req.body.id);
  const plate = cleanText(req.body.plate, 12).toUpperCase();
  const model = cleanText(req.body.model, 120);
  const color = cleanText(req.body.color, 60);
  const year = req.body.year === null || req.body.year === undefined || req.body.year === '' ? null : Number(req.body.year);
  const status = String(req.body.status || 'ativo') === 'inativo' ? 'inativo' : 'ativo';
  if (!plate || !model) return res.status(400).json({ error: 'Informe a placa e o modelo do veículo.' });
  if (id !== null && (!Number.isInteger(id) || id < 1)) return res.status(400).json({ error: 'Veículo inválido.' });
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2200)) return res.status(400).json({ error: 'Ano do veículo inválido.' });
  try {
    let result;
    if (id === null) {
      result = await pool.query(
        `INSERT INTO vehicles (plate, description, model, vehicle_year, color, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (plate) DO UPDATE SET
           description = EXCLUDED.description,
           model = EXCLUDED.model,
           vehicle_year = EXCLUDED.vehicle_year,
           color = EXCLUDED.color,
           status = EXCLUDED.status
         RETURNING *`,
        [plate, [model, color].filter(Boolean).join(' · '), model, year, color || null, status],
      );
    } else {
      result = await pool.query(
        `UPDATE vehicles
         SET plate = $1, description = $2, model = $3, vehicle_year = $4, color = $5
         WHERE id = $6
         RETURNING *`,
        [plate, [model, color].filter(Boolean).join(' · '), model, year, color || null, id],
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Veículo não encontrado.' });
    }
    await audit({ req, actorUserId: req.user.id, eventType: id === null ? 'vehicle_registered' : 'vehicle_updated', entityType: 'vehicle', entityId: result.rows[0].id, metadata: { plate, model, year, color, status: result.rows[0].status } });
    res.status(201).json({ vehicle: publicStockVehicle(result.rows[0]) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Já existe um veículo com essa placa.' });
    throw error;
  }
});

app.delete('/api/stock/vehicles/:id', auth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Veículo inválido.' });
  const result = await pool.query('DELETE FROM vehicles WHERE id = $1 RETURNING *', [id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Veículo não encontrado.' });
  await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_deleted', entityType: 'vehicle', entityId: id, metadata: { plate: result.rows[0].plate, model: result.rows[0].model, year: result.rows[0].vehicle_year, color: result.rows[0].color } });
  res.json({ ok: true });
});

app.post('/api/stock/vehicles/:vehicleId/equipment', auth, requireRole('admin'), async (req, res) => {
  const vehicleId = Number(req.params.vehicleId);
  const id = req.body.id === null || req.body.id === undefined || req.body.id === '' ? null : Number(req.body.id);
  const name = cleanText(req.body.name, 180);
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(vehicleId) || vehicleId < 1) return res.status(400).json({ error: 'Veículo inválido.' });
  if (id !== null && (!Number.isInteger(id) || id < 1)) return res.status(400).json({ error: 'Equipamento inválido.' });
  if (!name || !Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ error: 'Informe o equipamento e uma quantidade inteira maior que zero.' });
  const vehicle = await pool.query('SELECT id, plate FROM vehicles WHERE id = $1', [vehicleId]);
  if (!vehicle.rows[0]) return res.status(404).json({ error: 'Veículo não encontrado.' });
  try {
    const result = id === null
      ? await pool.query(
        `INSERT INTO vehicle_equipment (vehicle_id, name, quantity, created_by, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, vehicle_id, name, quantity, active, created_at, updated_at`,
        [vehicleId, name, quantity, req.user.id],
      )
      : await pool.query(
        `UPDATE vehicle_equipment
         SET name = $1, quantity = $2, updated_at = NOW()
         WHERE id = $3 AND vehicle_id = $4
         RETURNING id, vehicle_id, name, quantity, active, created_at, updated_at`,
        [name, quantity, id, vehicleId],
      );
    if (!result.rows[0]) return res.status(404).json({ error: 'Equipamento não encontrado neste veículo.' });
    await audit({ req, actorUserId: req.user.id, eventType: id === null ? 'vehicle_equipment_registered' : 'vehicle_equipment_updated', entityType: 'vehicle_equipment', entityId: result.rows[0].id, metadata: { vehicleId, plate: vehicle.rows[0].plate, name, quantity } });
    res.status(id === null ? 201 : 200).json({ equipment: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Este equipamento já está cadastrado neste veículo.' });
    throw error;
  }
});

app.delete('/api/stock/vehicles/:vehicleId/equipment/:id', auth, requireRole('admin'), async (req, res) => {
  const vehicleId = Number(req.params.vehicleId);
  const id = Number(req.params.id);
  if (!Number.isInteger(vehicleId) || vehicleId < 1 || !Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Equipamento inválido.' });
  const result = await pool.query(
    `DELETE FROM vehicle_equipment equipment
     USING vehicles vehicle
     WHERE equipment.id = $1 AND equipment.vehicle_id = $2 AND vehicle.id = equipment.vehicle_id
     RETURNING equipment.id, equipment.vehicle_id, equipment.name, equipment.quantity`,
    [id, vehicleId],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Equipamento não encontrado neste veículo.' });
  await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_equipment_deleted', entityType: 'vehicle_equipment', entityId: result.rows[0].id, metadata: { vehicleId, name: result.rows[0].name, quantity: result.rows[0].quantity } });
  res.json({ ok: true });
});

app.post('/api/stock/ppes', auth, requireRole('admin'), async (req, res) => {
  const id = req.body.id === null || req.body.id === undefined || req.body.id === '' ? null : Number(req.body.id);
  const name = cleanText(req.body.name, 180);
  const ca = cleanText(req.body.ca, 80);
  const category = cleanText(req.body.category, 100);
  const code = cleanText(req.body.code, 80) || (ca
    ? `CA-${ca.replace(/[^A-Za-z0-9]+/g, '-')}`
    : `EPI-${crypto.randomUUID()}`);
  const stockQuantity = Number(req.body.stockQuantity || 0);
  const requestedMinimumStock = req.body.minimumStock === undefined || req.body.minimumStock === null || req.body.minimumStock === ''
    ? null
    : Number(req.body.minimumStock);
  if (!name) return res.status(400).json({ error: 'Informe o nome do EPI.' });
  if (id !== null && (!Number.isInteger(id) || id < 1)) return res.status(400).json({ error: 'EPI inválido.' });
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || (requestedMinimumStock !== null && (!Number.isInteger(requestedMinimumStock) || requestedMinimumStock < 0))) return res.status(400).json({ error: 'As quantidades de estoque precisam ser números inteiros não negativos.' });
  const client = await pool.connect();
  let result;
  let previousQuantity = 0;
  let itemId = id;
  try {
    await client.query('BEGIN');
    const existing = id === null
      ? await client.query('SELECT * FROM ppe_items WHERE code = $1 FOR UPDATE', [code])
      : await client.query('SELECT * FROM ppe_items WHERE id = $1 FOR UPDATE', [id]);
    if (id !== null && !existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'EPI não encontrado.' });
    }
    if (existing.rows[0]) {
      itemId = Number(existing.rows[0].id);
      previousQuantity = Number(existing.rows[0].stock_quantity || 0);
      const effectiveMinimumStock = requestedMinimumStock === null ? Number(existing.rows[0].minimum_stock || 0) : requestedMinimumStock;
      const assigned = await getAssignedQuantity(client, itemId);
      if (stockQuantity < assigned) {
        throw new StockConflictError(`A quantidade total não pode ficar abaixo dos ${assigned} EPI(s) atualmente em posse de usuários.`);
      }
      result = await client.query(
        `UPDATE ppe_items
         SET code = $1, name = $2, ca = $3, category = $4, stock_quantity = $5, minimum_stock = $6, active = TRUE, deactivated_at = NULL
         WHERE id = $7
         RETURNING *`,
        [code, name, ca, category || null, stockQuantity, effectiveMinimumStock, itemId],
      );
    } else {
      const effectiveMinimumStock = requestedMinimumStock === null ? 0 : requestedMinimumStock;
      result = await client.query(
        `INSERT INTO ppe_items (code, name, ca, category, stock_quantity, minimum_stock, active)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING *`,
        [code, name, ca, category || null, stockQuantity, effectiveMinimumStock],
      );
      itemId = Number(result.rows[0].id);
    }
    const difference = stockQuantity - previousQuantity;
    if (difference > 0) {
      await insertPpeStockMovement(client, {
        ppeItemId: itemId,
        movementType: 'entrada',
        quantity: difference,
        createdBy: req.user.id,
        referenceKey: `manual:${itemId}:entrada:${crypto.randomUUID()}`,
        notes: existing.rows[0] ? 'Aumento manual do estoque total.' : 'Estoque inicial cadastrado pelo administrador.',
      });
    } else if (difference < 0) {
      await insertPpeStockMovement(client, {
        ppeItemId: itemId,
        movementType: 'ajuste_saida',
        quantity: Math.abs(difference),
        createdBy: req.user.id,
        referenceKey: `manual:${itemId}:ajuste-saida:${crypto.randomUUID()}`,
        notes: 'Redução manual do estoque total.',
      });
    }
    await client.query('COMMIT');
    await audit({ req, actorUserId: req.user.id, eventType: id === null ? 'ppe_registered' : 'ppe_updated', entityType: 'ppe_item', entityId: result.rows[0].id, metadata: { code, name, ca, stockQuantity, minimumStock: result.rows[0].minimum_stock, previousQuantity } });
    res.status(201).json({ ppe: publicStockPpe(result.rows[0]) });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === '23505') return res.status(409).json({ error: 'Já existe um EPI com esse código.' });
    throw error;
  } finally {
    client.release();
  }
});

app.patch('/api/stock/ppes/:id/status', auth, requireRole('admin'), async (req, res) => {
  const active = req.body.active === true || String(req.body.active).toLowerCase() === 'true';
  const result = active
    ? await pool.query(
      `UPDATE ppe_items
       SET active = TRUE, deactivated_at = NULL
       WHERE id = $1
         AND (active = TRUE OR (deactivated_at IS NOT NULL AND deactivated_at > NOW() - INTERVAL '7 days'))
       RETURNING *`,
      [req.params.id],
    )
    : await pool.query(
      `UPDATE ppe_items
       SET active = FALSE, deactivated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id],
    );
  if (!result.rows[0]) {
    const existing = await pool.query('SELECT active, deactivated_at FROM ppe_items WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'EPI não encontrado.' });
    if (active && !existing.rows[0].active) return res.status(410).json({ error: 'O prazo de reativação deste EPI expirou.' });
    return res.status(409).json({ error: 'O status do EPI já está atualizado.' });
  }
  await audit({ req, actorUserId: req.user.id, eventType: active ? 'ppe_activated' : 'ppe_deactivated', entityType: 'ppe_item', entityId: result.rows[0].id, metadata: { active } });
  res.json({ ppe: publicStockPpe(result.rows[0]) });
});

app.get('/api/users', auth, requireRole('admin'), async (_req, res) => {
  const result = await pool.query(
    `SELECT id, name, email, role, active, deactivated_at, created_at
     FROM users
     WHERE active = TRUE
        OR (deactivated_at IS NOT NULL AND deactivated_at > NOW() - INTERVAL '7 days')
     ORDER BY name`,
  );
  res.json({ users: result.rows.map(publicUser) });
});

app.get('/api/users/:id/technician-summary', auth, requireRole('admin'), async (req, res) => {
  const userResult = await pool.query(
    `SELECT id, name, email, role, active, created_at
     FROM users WHERE id = $1`,
    [req.params.id],
  );
  const technician = userResult.rows[0];
  if (!technician) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (technician.role !== 'tecnico') return res.status(400).json({ error: 'O detalhe de checklist está disponível apenas para técnicos.' });

  const [logs, epis, pending, dailyChecklistDays] = await Promise.all([
    pool.query(
      `SELECT a.id, a.event_type, a.entity_type, a.entity_id,
              a.ip_address, a.user_agent, a.metadata, a.created_at
       FROM audit_logs a
       WHERE a.actor_user_id = $1
         AND a.event_type IN (
           'epi_term_created', 'epi_term_signed',
           'epi_process_created', 'epi_process_signature_validated',
           'epi_process_selfie_uploaded', 'epi_process_photos_uploaded',
           'epi_process_validated', 'vehicle_checklist_created',
           'vehicle_checklist_validated'
         )
       ORDER BY a.created_at DESC
       LIMIT 100`,
      [technician.id],
    ),
    pool.query(
      `WITH latest_daily_checklist AS (
         SELECT p.id, p.submitted_at, p.status
         FROM epi_processes p
         WHERE p.created_by = $1
           AND p.process_type = 'checklist_diario'
           AND p.submitted_at IS NOT NULL
           AND timezone('America/Fortaleza', p.submitted_at)::date = timezone('America/Fortaleza', NOW())::date
         ORDER BY p.submitted_at DESC, p.id DESC
         LIMIT 1
       )
       SELECT t.id AS term_id, t.signed_at, t.status,
              ti.equipment_name, ti.quantity, ti.ca, ti.condition, ti.observation
       FROM epi_terms t
       JOIN epi_term_items ti ON ti.term_id = t.id
       WHERE (t.created_by = $1 OR t.signer_user_id = $1)
         AND t.status = 'assinado'
         AND timezone('America/Fortaleza', t.signed_at)::date = timezone('America/Fortaleza', NOW())::date
       UNION ALL
       SELECT p.id AS term_id, p.submitted_at AS signed_at, p.status,
              pi.equipment_name, pi.quantity, pi.ca, pi.condition, pi.observation
       FROM latest_daily_checklist p
       JOIN epi_process_items pi ON pi.process_id = p.id
       ORDER BY signed_at DESC, term_id ASC`,
      [technician.id],
    ),
    pool.query(
      `SELECT 'vehicle_checklist' AS type, id, plate AS label, status, created_at
       FROM vehicle_checklists
       WHERE driver_user_id = $1 AND status IN ('pendente_validacao', 'reprovado')
       UNION ALL
       SELECT 'epi_term' AS type, id, recipient_name AS label, status, created_at
       FROM epi_terms
       WHERE (created_by = $1 OR signer_user_id = $1)
         AND status IN ('rascunho', 'pendente_assinatura')
       UNION ALL
       SELECT 'epi_process' AS type, id, process_type AS label, status, created_at
       FROM epi_processes
       WHERE created_by = $1
         AND status IN ('aguarda_selfie', 'aguarda_fotos', 'pendente_validacao', 'reprovado')
       ORDER BY created_at DESC`,
      [technician.id],
    ),
    pool.query(
      `SELECT DISTINCT to_char(timezone('America/Fortaleza', submitted_at)::date, 'YYYY-MM-DD') AS day
       FROM epi_processes
       WHERE created_by = $1
         AND process_type = 'checklist_diario'
         AND submitted_at IS NOT NULL
       ORDER BY day DESC`,
      [technician.id],
    ),
  ]);

  res.json({
    technician: publicUser(technician),
    period: 'hoje',
    stats: {
      checklistEvents: logs.rowCount,
      episToday: epis.rows.reduce((total, item) => total + Number(item.quantity || 0), 0),
      pending: pending.rowCount,
    },
    logs: logs.rows,
    epis: epis.rows,
    pending: pending.rows,
    dailyChecklistDays: dailyChecklistDays.rows.map((row) => row.day),
  });
});

app.post('/api/users', auth, requireRole('admin'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const role = String(req.body.role || 'tecnico');
  const password = String(req.body.password || '');

  if (!name || !email || password.length < 10 || !['admin', 'tecnico', 'vistoriador'].includes(role)) {
    return res.status(400).json({ error: 'Informe nome, e-mail, perfil válido e senha com pelo menos 10 caracteres.' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, must_change_password)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, active, created_at, must_change_password`,
      [name, email, hash, role, role === 'tecnico'],
    );
    await audit({ req, actorUserId: req.user.id, eventType: 'user_created', entityType: 'user', entityId: result.rows[0].id, metadata: { role } });
    res.status(201).json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    throw error;
  }
});

app.patch('/api/users/:id', auth, requireRole('admin'), async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Usuário inválido.' });
  const targetResult = await pool.query('SELECT id, name, email, role, active, must_change_password FROM users WHERE id = $1', [userId]);
  const target = targetResult.rows[0];
  if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (target.role === 'superadmin') return res.status(403).json({ error: 'A conta Superadmin é protegida e não pode ser alterada.' });

  const name = cleanText(req.body.name, 180);
  const email = cleanText(req.body.email, 180).toLowerCase();
  const role = String(req.body.role || target.role);
  const password = String(req.body.password || '');
  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email) || !['admin', 'tecnico', 'vistoriador'].includes(role)) {
    return res.status(400).json({ error: 'Informe nome, e-mail e um perfil válido.' });
  }
  if (password && password.length < 10) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 10 caracteres.' });
  if (userId === Number(req.user.id) && role !== target.role) return res.status(400).json({ error: 'Você não pode alterar o próprio perfil nesta tela.' });

  try {
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const result = await pool.query(
      `UPDATE users
       SET name = $1, email = $2, role = $3,
           password_hash = COALESCE($4, password_hash),
           must_change_password = CASE WHEN $4 IS NOT NULL THEN ($3 = 'tecnico') ELSE CASE WHEN $3 <> 'tecnico' THEN FALSE ELSE must_change_password END END,
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, email, role, active, created_at, must_change_password`,
      [name, email, role, passwordHash, userId],
    );
    await audit({ req, actorUserId: req.user.id, eventType: 'user_updated', entityType: 'user', entityId: userId, metadata: { fields: ['name', 'email', 'role', ...(password ? ['password'] : [])], role } });
    res.json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    throw error;
  }
});

app.patch('/api/users/:id/status', auth, requireRole('admin'), async (req, res) => {
  const userId = Number(req.params.id);
  const active = req.body.active === true || String(req.body.active).toLowerCase() === 'true';
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Usuário inválido.' });
  if (!active) return res.status(400).json({ error: 'Use a opção Remover para desativar uma conta.' });

  const result = await pool.query(
    `UPDATE users
     SET active = TRUE, deactivated_at = NULL, session_version = session_version + 1, updated_at = NOW()
     WHERE id = $1
       AND active = FALSE
       AND role <> 'superadmin'
       AND deactivated_at IS NOT NULL
       AND deactivated_at > NOW() - INTERVAL '7 days'
     RETURNING id, name, email, role, active, deactivated_at, created_at`,
    [userId],
  );
  if (!result.rows[0]) {
    const existing = await pool.query('SELECT id, role, active, deactivated_at FROM users WHERE id = $1', [userId]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Usuário não encontrado.' });
    if (existing.rows[0].role === 'superadmin') return res.status(403).json({ error: 'A conta Superadmin é protegida.' });
    if (existing.rows[0].active) return res.status(409).json({ error: 'A conta já está ativa.' });
    return res.status(410).json({ error: 'O prazo de reativação desta conta expirou.' });
  }
  await audit({ req, actorUserId: req.user.id, eventType: 'user_activated', entityType: 'user', entityId: userId, metadata: { role: result.rows[0].role } });
  res.json({ user: publicUser(result.rows[0]) });
});

app.delete('/api/users/:id', auth, requireRole('admin'), async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ error: 'O administrador não pode remover a própria conta.' });
  const result = await pool.query(
    `UPDATE users SET active = FALSE, deactivated_at = NOW(), session_version = session_version + 1, updated_at = NOW()
     WHERE id = $1 AND active = TRUE AND role <> 'superadmin'
     RETURNING id, name, email, role`,
    [req.params.id],
  );
  if (!result.rows[0]) {
    const protectedUser = await pool.query('SELECT role FROM users WHERE id = $1 AND active = TRUE', [req.params.id]);
    if (protectedUser.rows[0]?.role === 'superadmin') return res.status(403).json({ error: 'A conta Superadmin é protegida e não pode ser removida.' });
    return res.status(404).json({ error: 'Conta ativa não encontrada.' });
  }
  await audit({ req, actorUserId: req.user.id, eventType: 'user_deactivated', entityType: 'user', entityId: result.rows[0].id, metadata: { role: result.rows[0].role } });
  res.json({ ok: true, user: result.rows[0] });
});

app.get('/api/audit-logs', auth, requireRole('admin'), async (_req, res) => {
  const result = await pool.query(
    `SELECT a.id, a.event_type, a.entity_type, a.entity_id, a.ip_address,
            a.user_agent, a.metadata, a.created_at, u.name AS actor_name
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.actor_user_id
     ORDER BY a.created_at DESC
     LIMIT 500`,
  );
  res.json({ logs: result.rows });
});

app.get('/download', (_req, res) => res.redirect('/download/sigos.apk'));

app.get('/download/sigos.apk', (req, res) => {
  res.download(
    apkPath,
    'sigos.apk',
    {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Cache-Control': 'no-store',
      },
    },
    (error) => {
      if (!error || res.headersSent) return;
      if (error.code === 'ENOENT') return res.status(404).json({ error: 'O APK ainda não foi publicado.' });
      return res.status(500).json({ error: 'Não foi possível entregar o APK.' });
    },
  );
});

app.use((req, res, next) => {
  if (['/', '/index.html', '/app.js', '/styles.css', '/sw.js', '/manifest.webmanifest'].includes(req.path)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

async function main() {
  await initSchema();
  await backfillPpeStockMovements();
  await bootstrapAdmin();
  await bootstrapSuperadmin();
  await checkDailyChecklistReminders();
  const reminderTimer = setInterval(() => {
    checkDailyChecklistReminders().catch((error) => console.error('Não foi possível verificar checklists diários pendentes:', error));
  }, 60_000);
  reminderTimer.unref?.();
  app.listen(port, host, () => console.log(`SIGOS ouvindo em ${host}:${port}`));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
