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

let firebaseAdmin = null;
let firebaseMessaging = null;
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

const app = express();
const port = Number(process.env.PORT || 7000);
const host = process.env.HOST || '127.0.0.1';
const jwtSecret = process.env.JWT_SECRET;
const cookieSecure = String(process.env.COOKIE_SECURE || 'false') === 'true';
const enforceHttps = String(process.env.ENFORCE_HTTPS || 'false') === 'true';

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
    title: 'TERMO DE CHECKLIST DIÁRIO DE EPI',
    version: 'epi-checklist-diario-1',
    paragraphs: [
      'Declaro que conferi, nesta data, os equipamentos de proteção individual que estão sob minha responsabilidade para o trabalho.',
      'Comprometo-me a utilizar cada equipamento para sua finalidade, mantê-lo em condições adequadas e comunicar imediatamente qualquer dano, alteração ou extravio.',
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

function publicUser(row, { companyProfileComplete = null } = {}) {
  if (!row) return null;
  const signatureUserOnboardingComplete = !['tecnico', 'vistoriador'].includes(row.role)
    || (!row.must_change_password && Boolean(row.signature_data) && Boolean(row.consent_at)
      && row.consent_location === true && row.consent_ip === true && row.consent_image === true);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
    mustChangePassword: ['tecnico', 'vistoriador'].includes(row.role) && Boolean(row.must_change_password),
    signatureRegistered: Boolean(row.signature_data),
    consentRegistered: !['tecnico', 'vistoriador'].includes(row.role) || Boolean(row.consent_at),
    onboardingComplete: signatureUserOnboardingComplete,
    companyProfileComplete: row.role === 'admin' ? companyProfileComplete : true,
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
  return !['tecnico', 'vistoriador'].includes(user.role)
    || (!user.must_change_password && Boolean(user.signature_data) && Boolean(user.consent_at)
      && user.consent_location === true && user.consent_ip === true && user.consent_image === true);
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
  const result = await pool.query(
    `INSERT INTO notifications
      (user_id, notification_type, title, message, entity_type, entity_id, metadata)
     SELECT id, $2, $3, $4, $5, $6, $7
     FROM users
     WHERE active = TRUE AND role = ANY($1::text[])
     RETURNING user_id`,
    [roles, notificationType, title, message, entityType, entityId === null || entityId === undefined ? null : String(entityId), metadata],
  );
  await sendNativePush({
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
  await sendNativePush({
    userIds: result.rows.map((row) => row.user_id),
    title,
    message,
    data: { notificationType, entityType, entityId },
  });
}

async function checkDailyChecklistReminders() {
  const client = await pool.connect();
  const pushRecipients = new Set();
  try {
    await client.query('BEGIN');
    const due = await client.query(
      `WITH local_clock AS (
         SELECT timezone('America/Fortaleza', NOW()) AS local_now,
                timezone('America/Fortaleza', NOW())::date AS local_date
       ), missing AS (
         INSERT INTO daily_checklist_reminders (user_id, reminder_date)
         SELECT u.id, clock.local_date
         FROM users u
         CROSS JOIN local_clock clock
         WHERE u.active = TRUE
           AND u.role = 'tecnico'
           AND clock.local_now >= clock.local_date + TIME '12:00'
           AND timezone('America/Fortaleza', u.created_at) < clock.local_date + TIME '12:00'
           AND NOT EXISTS (
             SELECT 1
             FROM epi_processes p
             WHERE p.created_by = u.id
               AND p.process_type = 'checklist_diario'
               AND p.submitted_at IS NOT NULL
               AND timezone('America/Fortaleza', p.submitted_at)::date = clock.local_date
           )
         ON CONFLICT (user_id, reminder_date) DO NOTHING
         RETURNING user_id, reminder_date
       )
       SELECT missing.user_id, missing.reminder_date, u.name
       FROM missing
       JOIN users u ON u.id = missing.user_id`,
    );

    for (const reminder of due.rows) {
      const reminderDate = String(reminder.reminder_date).slice(0, 10);
      const metadata = { technicianId: String(reminder.user_id), reminderDate };
      await client.query(
        `INSERT INTO notifications
          (user_id, notification_type, title, message, metadata)
         VALUES ($1, 'daily_checklist_reminder', 'Lembrete: checklist diário pendente', $2, $3)`,
        [reminder.user_id, 'Você ainda não enviou seu checklist diário de EPI de hoje.', metadata],
      );
      pushRecipients.add(String(reminder.user_id));

      const adminNotifications = await client.query(
        `INSERT INTO notifications
          (user_id, notification_type, title, message, metadata)
         SELECT id, 'daily_checklist_reminder', 'Checklist diário pendente', $1, $2
         FROM users
         WHERE active = TRUE AND role = 'admin'
         RETURNING user_id`,
        [`O técnico ${reminder.name} ainda não enviou o checklist diário de EPI de hoje.`, metadata],
      );
      adminNotifications.rows.forEach((row) => pushRecipients.add(String(row.user_id)));
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  if (pushRecipients.size) {
    await sendNativePush({
      userIds: [...pushRecipients],
      title: 'Checklist diário pendente',
      message: 'Há uma notificação de checklist diário pendente no SIGOS.',
      data: { notificationType: 'daily_checklist_reminder' },
    });
  }
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

function signSession(user) {
  return jwt.sign({ sub: String(user.id), role: user.role, name: user.name }, jwtSecret, { expiresIn: '8h' });
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
              must_change_password, signature_data, signature_hash,
              consent_location, consent_ip, consent_image, consent_at,
              consent_ip_address, consent_user_agent, consent_latitude, consent_longitude
       FROM users WHERE id = $1`,
      [payload.sub],
    );
    const user = result.rows[0];
    if (!user || !user.active) return res.status(401).json({ error: 'Usuário inativo ou inexistente.' });
    req.user = user;
    req.companySettings = user.role === 'admin' ? await getCompanySettings() : null;
    req.companyProfileComplete = user.role !== 'admin' || isCompanyProfileComplete(req.companySettings);
    const onboardingPath = req.path === '/api/me' || req.path.startsWith('/api/onboarding') || req.path.startsWith('/api/company') || req.path === '/api/auth/logout' || req.path === '/api/auth/change-password';
    if (['tecnico', 'vistoriador'].includes(user.role) && !isTechnicianOnboardingComplete(user) && !onboardingPath) {
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
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Você não possui permissão para esta operação.' });
    }
    next();
  };
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'tecnico', 'vistoriador')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_data TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_hash TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_registered_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_location BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_ip BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_image BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_ip_address INET;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_user_agent TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_latitude NUMERIC(9, 6);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_longitude NUMERIC(9, 6);

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
      validated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      validated_at TIMESTAMPTZ,
      validation_notes TEXT,
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE epi_process_items ADD COLUMN IF NOT EXISTS ppe_item_id BIGINT REFERENCES ppe_items(id) ON DELETE SET NULL;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS company_logo_data TEXT;
    ALTER TABLE epi_processes ADD COLUMN IF NOT EXISTS company_logo_mime_type TEXT;

    CREATE TABLE IF NOT EXISTS epi_process_media (
      id BIGSERIAL PRIMARY KEY,
      process_id BIGINT NOT NULL REFERENCES epi_processes(id) ON DELETE CASCADE,
      uploaded_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      kind TEXT NOT NULL CHECK (kind IN ('selfie', 'epi_photo')),
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
    ALTER TABLE epi_process_media ADD COLUMN IF NOT EXISTS user_agent TEXT;
    ALTER TABLE epi_process_media ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6);
    ALTER TABLE epi_process_media ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);
    ALTER TABLE epi_process_media ADD COLUMN IF NOT EXISTS location_label TEXT;

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
        CHECK (status IN ('rascunho', 'pendente_validacao', 'validado', 'reprovado')),
      validation_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      submitted_at TIMESTAMPTZ,
      validated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS vehicle_checklist_items (
      id BIGSERIAL PRIMARY KEY,
      checklist_id BIGINT NOT NULL REFERENCES vehicle_checklists(id) ON DELETE CASCADE,
      item_key TEXT NOT NULL,
      item_name TEXT NOT NULL,
      before_status TEXT NOT NULL DEFAULT 'ok' CHECK (before_status IN ('ok', 'defeito', 'quebrado')),
      before_description TEXT,
      after_status TEXT NOT NULL DEFAULT 'ok' CHECK (after_status IN ('ok', 'defeito', 'quebrado')),
      after_description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

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

    CREATE INDEX IF NOT EXISTS vehicle_checklist_signatures_checklist_idx ON vehicle_checklist_signatures (checklist_id);
    CREATE INDEX IF NOT EXISTS vehicle_checklist_media_checklist_idx ON vehicle_checklist_media (checklist_id, created_at);

    CREATE INDEX IF NOT EXISTS vehicle_checklists_created_at_idx ON vehicle_checklists (created_at DESC);
    CREATE INDEX IF NOT EXISTS vehicle_checklists_status_idx ON vehicle_checklists (status);
    CREATE INDEX IF NOT EXISTS vehicle_checklists_driver_idx ON vehicle_checklists (driver_user_id);
    CREATE INDEX IF NOT EXISTS vehicle_checklist_items_checklist_idx ON vehicle_checklist_items (checklist_id);
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

function requestedStockItems(row) {
  const items = new Map();
  for (const item of row.items || []) {
    const ppeItemId = Number(item.ppeItemId);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(ppeItemId) || ppeItemId < 1 || !Number.isInteger(quantity) || quantity < 1) continue;
    items.set(ppeItemId, (items.get(ppeItemId) || 0) + quantity);
  }
  return items;
}

async function applyEpiProcessStockMovements(client, row, actorUserId) {
  const requested = requestedStockItems(row);
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

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'sigos', database: 'online' });
  } catch {
    res.status(503).json({ ok: false, database: 'offline' });
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

  res.cookie('session', signSession(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    maxAge: 8 * 60 * 60 * 1000,
  });
  await audit({ req, actorUserId: user.id, eventType: 'login_success', entityType: 'user', entityId: user.id });
  const companySettings = user.role === 'admin' ? await getCompanySettings() : null;
  res.json({ user: publicUser(user, { companyProfileComplete: user.role !== 'admin' || isCompanyProfileComplete(companySettings) }) });
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

  const token = signSession(user);
  await audit({ req, actorUserId: user.id, eventType: 'mobile_login_success', entityType: 'user', entityId: user.id });
  const companySettings = user.role === 'admin' ? await getCompanySettings() : null;
  res.json({ user: publicUser(user, { companyProfileComplete: user.role !== 'admin' || isCompanyProfileComplete(companySettings) }), token, expiresIn: 8 * 60 * 60 });
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

app.get('/api/onboarding/status', auth, requireRole('tecnico', 'vistoriador'), (req, res) => {
  res.json({
    onboarding: {
      mustChangePassword: Boolean(req.user.must_change_password),
      signatureRegistered: Boolean(req.user.signature_data),
      consentRegistered: Boolean(req.user.consent_at) && req.user.consent_location === true && req.user.consent_ip === true && req.user.consent_image === true,
      consentAt: req.user.consent_at || null,
    },
    signatureData: req.user.signature_data || null,
  });
});

app.post('/api/onboarding/signature', auth, requireRole('tecnico', 'vistoriador'), async (req, res) => {
  const signatureData = String(req.body.signatureData || '');
  const confirmed = req.body.confirmed === true;
  if (!confirmed) return res.status(400).json({ error: 'Confirme que esta assinatura será usada para validar seus registros.' });
  if (!/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(signatureData) || signatureData.length > 700000) {
    return res.status(400).json({ error: 'A assinatura desenhada é inválida ou excede o limite permitido.' });
  }
  const signatureHash = sha256Json({ algorithm: 'SHA-256', version: 1, userId: String(req.user.id), signatureData });
  await pool.query(
    `UPDATE users
     SET signature_data = $1, signature_hash = $2, signature_registered_at = NOW(), updated_at = NOW()
     WHERE id = $3`,
    [signatureData, signatureHash, req.user.id],
  );
  await audit({ req, actorUserId: req.user.id, eventType: 'user_signature_registered', entityType: 'user', entityId: req.user.id, metadata: { signatureHash, confirmed: true } });
  res.json({ ok: true, signatureRegistered: true, signatureHash });
});

app.post('/api/onboarding/consent', auth, requireRole('tecnico', 'vistoriador'), async (req, res) => {
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
  await sendNativePush({
    userIds,
    title,
    message,
    data: { notificationType: 'admin_message', entityType: 'admin_message' },
  });
  await audit({ req, actorUserId: req.user.id, eventType: 'admin_notification_sent', entityType: 'notification', metadata: { recipientMode, recipientCount: result.rowCount, title } });
  res.status(201).json({ sentCount: result.rowCount });
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
  const isAdmin = req.user.role === 'admin';
  const params = isAdmin ? [] : [req.user.id];
  const actorClause = isAdmin ? '' : ' AND a.actor_user_id = $1';
  const termClause = isAdmin ? '' : ' AND (t.created_by = $1 OR t.signer_user_id = $1)';
  const processClause = isAdmin ? '' : ' AND (p.created_by = $1 OR p.validator_user_id = $1 OR p.target_user_id = $1)';
  const pendingParams = isAdmin ? [] : [req.user.id];

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

async function storeEpiProcessMedia({ req, processId, kind, imageData, deviceInfo, latitude, longitude }) {
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
      (process_id, uploaded_by, kind, file_name, file_path, mime_type, byte_size, sha256, device_info,
       ip_address, user_agent, latitude, longitude, location_label)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id, process_id, kind, mime_type, byte_size, sha256, device_info, ip_address, user_agent, latitude, longitude, location_label, created_at`,
    [processId, req.user.id, kind, fileName, absolutePath, captured.mimeType, captured.imageBuffer.length, sha256, cleanText(deviceInfo, 240) || null, clientIp(req), userAgent, normalizedLatitude, normalizedLongitude, locationLabel],
  );
  return result.rows[0];
}

async function storeVehicleChecklistMedia({ req, checklistId, imageData, kind = 'vehicle_photo', itemKey = null, deviceInfo, latitude, longitude }) {
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
      (checklist_id, uploaded_by, kind, item_key, file_name, file_path, mime_type, byte_size, sha256, device_info,
       ip_address, user_agent, latitude, longitude, location_label)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id, checklist_id, kind, item_key, mime_type, byte_size, sha256, device_info, ip_address, user_agent, latitude, longitude, location_label, created_at`,
    [checklistId, req.user.id, mediaKind, cleanText(itemKey, 120) || null, fileName, absolutePath, captured.mimeType, captured.imageBuffer.length, sha256, cleanText(deviceInfo, 240) || null, clientIp(req), userAgent, normalizedLatitude, normalizedLongitude, locationLabel],
  );
  return result.rows[0];
}

const epiProcessQuery = `
  SELECT p.*,
    creator.name AS creator_name, creator.email AS creator_email,
    creator.signature_data AS creator_signature_data,
    validator.name AS validator_name, validator.role AS validator_role,
    target.name AS target_name, target.role AS target_role,
    validated.name AS validated_by_name,
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
        'observation', i.observation
      ) ORDER BY i.id)
      FROM epi_process_items i WHERE i.process_id = p.id
    ), '[]'::json) AS items,
    COALESCE((
      SELECT JSON_AGG(JSON_BUILD_OBJECT(
        'id', m.id,
        'kind', m.kind,
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
    title: "TERMO DE DEVOLUÇÃO E RESPONSABILIDADE EPI'S",
    companyName,
    companyCnpj,
    companyLogoData,
    companyLogoMimeType,
    intro: `Recebi da empresa ${companyName}, a título de empréstimo, para meu uso exclusivo, os equipamentos de proteção individual especificados neste termo, comprometendo-me a mantê-los em perfeito estado de conservação, ficando ciente de que:`,
    clauses: [
      'Se o equipamento for danificado ou inutilizado por emprego inadequado, mau uso, negligência ou extravio, a empresa me fornecerá novo equipamento e cobrará o valor de um equipamento da mesma marca ou equivalente ao da praça.',
      'Em caso de dano, inutilização ou extravio do equipamento deverei comunicar imediatamente ao setor competente.',
      'Terminando os serviços ou no caso de rescisão do contrato de trabalho, devolverei o equipamento completo e em perfeito estado de conservação, considerando-se o tempo do uso do mesmo, ao setor competente.',
      'Estando os equipamentos em minha posse, estarei sujeito a inspeções sem prévio aviso.',
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
    validatedBy: row.validated_by,
    validatedByName: row.validated_by_name || null,
    validatedAt: row.validated_at,
    validationNotes: row.validation_notes,
    createdAt: row.created_at,
    items: row.items || [],
    media: media.map((item) => ({
      id: item.id,
      kind: item.kind,
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
    return normalized;
  });
}

function canAccessEpiProcess(user, row) {
  return user.role === 'admin'
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
  const visibility = req.user.role === 'admin' ? '' : ' WHERE active = TRUE';
  const result = await pool.query(
    `SELECT id, code, name, ca, category, stock_quantity, minimum_stock, active
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
  const visible = req.user.role === 'admin' ? '' : ' WHERE p.created_by = $1 OR p.validator_user_id = $1 OR p.target_user_id = $1';
  const result = await pool.query(`${epiProcessQuery}${visible} ORDER BY p.created_at DESC LIMIT 100`, req.user.role === 'admin' ? [] : [req.user.id]);
  res.json({ processes: result.rows.map((row) => publicEpiProcess(row)) });
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
  res.setHeader('Content-Disposition', `attachment; filename="processo-epi-${row.id}.pdf"`);
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
  const requestedItems = items.map((item) => ({
    ppeItemId: item.ppeItemId === null || item.ppeItemId === undefined || item.ppeItemId === '' ? null : Number(item.ppeItemId),
    equipmentName: cleanText(item.equipmentName, 180),
    quantity: Number(item.quantity),
    ca: cleanText(item.ca, 80),
    condition: cleanText(item.condition, 40),
    observation: cleanText(item.observation, 180),
  })).filter((item) => item.ppeItemId || item.equipmentName);
  if (!EPI_PROCESS_TYPES.includes(processType)) return res.status(400).json({ error: 'Selecione um tipo de processo EPI.' });
  if (!req.user.signature_data || !req.user.signature_hash) return res.status(400).json({ error: 'Cadastre sua assinatura padrão antes de iniciar um processo.' });
  if (!requestedItems.length || requestedItems.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
    return res.status(400).json({ error: 'Informe pelo menos um EPI com quantidade válida.' });
  }

  const catalogById = new Map();
  const requestedCatalogIds = requestedItems.filter((item) => Number.isInteger(item.ppeItemId)).map((item) => item.ppeItemId);
  if (requestedCatalogIds.length) {
    const catalogResult = await pool.query(
      `SELECT id, name, ca FROM ppe_items WHERE id = ANY($1::bigint[]) AND active = TRUE`,
      [requestedCatalogIds],
    );
    catalogResult.rows.forEach((item) => catalogById.set(Number(item.id), item));
  }
  const normalizedItems = [];
  for (const item of requestedItems) {
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
    });
  }

  let validator = null;
  let target = null;
  if (processType === 'devolucao') {
    if (!Number.isInteger(validatorUserId)) return res.status(400).json({ error: 'Selecione um vistoriador ou administrador para validar a devolução.' });
    const result = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND active = TRUE', [validatorUserId]);
    validator = result.rows[0];
    if (!validator || !['admin', 'vistoriador'].includes(validator.role)) return res.status(400).json({ error: 'O responsável pela devolução precisa ser um vistoriador ou administrador ativo.' });
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
        `INSERT INTO epi_process_items (process_id, ppe_item_id, equipment_name, quantity, ca, condition, observation)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [processId, item.ppeItemId, item.equipmentName, item.quantity, item.ca || null, item.condition || null, item.observation || null],
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
  if (!photos.length || photos.length > 5) return res.status(400).json({ error: 'Envie de uma a cinco fotos capturadas pela câmera.' });
  if (photos.some((photo) => photo?.captureMode !== 'camera')) return res.status(400).json({ error: 'As fotos precisam ser capturadas pela câmera no momento do registro.' });
  const media = [];
  for (const photo of photos) media.push(await storeEpiProcessMedia({ req, processId: row.id, kind: 'epi_photo', imageData: photo.imageData, deviceInfo: req.body.deviceInfo, latitude: photo.latitude ?? req.body.latitude, longitude: photo.longitude ?? req.body.longitude }));
  await pool.query(`UPDATE epi_processes SET status = 'pendente_validacao', submitted_at = NOW() WHERE id = $1`, [row.id]);
  await audit({ req, actorUserId: req.user.id, eventType: 'epi_process_photos_uploaded', entityType: 'epi_process', entityId: row.id, metadata: { mediaIds: media.map((item) => item.id), photoCount: media.length, captureMode: 'camera', signatureHash: row.signature_hash, documentHash: row.signature_document_hash, termVersion: row.term_version, coordinates: media.map((item) => ({ mediaId: item.id, latitude: item.latitude, longitude: item.longitude, locationLabel: item.location_label })) } });
  const recipientIds = [row.validator_user_id, row.target_user_id].filter((id) => id && String(id) !== String(req.user.id));
  if (recipientIds.length) await notifyUsers({ userIds: recipientIds, notificationType: 'epi_process_pending_validation', title: `${epiProcessTitle(row.process_type)} aguardando validação`, message: `${req.user.name} enviou um processo de EPI para sua validação.`, entityType: 'epi_process', entityId: row.id, metadata: { processType: row.process_type } });
  await notifyRoles({ roles: ['admin'], notificationType: 'epi_process_pending_validation', title: 'Processo de EPI aguardando validação', message: `${req.user.name} concluiu um processo de EPI e aguarda validação.`, entityType: 'epi_process', entityId: row.id, metadata: { processType: row.process_type, createdBy: req.user.id } });
  const updated = await pool.query(`${epiProcessQuery} WHERE p.id = $1`, [row.id]);
  res.json({ process: publicEpiProcess(updated.rows[0], true) });
});

app.post('/api/epi/processes/:id/validate', auth, async (req, res) => {
  const row = await getEpiProcess(req.params.id, req.user);
  if (!row) return res.status(404).json({ error: 'Processo de EPI não encontrado.' });
  const canValidate = req.user.role === 'admin' || String(row.validator_user_id || '') === String(req.user.id);
  if (!canValidate) return res.status(403).json({ error: 'Este processo não está atribuído para sua validação.' });
  if (row.status !== 'pendente_validacao') return res.status(409).json({ error: 'Este processo ainda não está pronto para validação.' });
  const decision = String(req.body.decision || 'validado') === 'reprovado' ? 'reprovado' : 'validado';
  const validationNotes = cleanText(req.body.notes, 500) || null;
  const items = row.items || [];
  const expectedDocumentHash = sha256Json({
    schema: 'sigos-epi-process-v1',
    processId: String(row.id),
    processType: row.process_type,
    termVersion: row.term_version,
    createdBy: String(row.created_by),
    targetUserId: row.target_user_id ? String(row.target_user_id) : null,
    validatorUserId: row.validator_user_id ? String(row.validator_user_id) : null,
    items: epiProcessSignatureItems(items),
  });
  const expectedSignatureHash = sha256Json({ algorithm: 'SHA-256', version: 1, signerSignatureHash: row.signer_signature_hash, documentHash: expectedDocumentHash });
  if (!equalHash(row.signature_document_hash, expectedDocumentHash) || !equalHash(row.signature_hash, expectedSignatureHash)) {
    return res.status(409).json({ error: 'A assinatura padrão ou o conteúdo do termo não conferem com o registro original.' });
  }
  const client = await pool.connect();
  let updated;
  try {
    await client.query('BEGIN');
    updated = await client.query(
      `UPDATE epi_processes
       SET status = $1, validated_by = $2, validated_at = NOW(), validation_notes = $3
       WHERE id = $4 AND status = 'pendente_validacao'
       RETURNING id, status, validated_at`,
      [decision, req.user.id, validationNotes, row.id],
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
  await audit({ req, actorUserId: req.user.id, eventType: 'epi_process_validated', entityType: 'epi_process', entityId: row.id, metadata: { decision, notes: validationNotes, signatureHash: row.signature_hash, documentHash: row.signature_document_hash } });
  await notifyRoles({ roles: ['admin'], notificationType: 'epi_process_validated', title: 'Processo de EPI validado', message: `${epiProcessTitle(row.process_type)} foi ${decision === 'validado' ? 'validado' : 'reprovado'} por ${req.user.name}.`, entityType: 'epi_process', entityId: row.id, metadata: { processType: row.process_type, decision, validatedBy: req.user.id } });
  await notifyUsers({ userIds: [row.created_by, row.target_user_id].filter((id) => id && String(id) !== String(req.user.id)), notificationType: 'epi_process_validated', title: 'Processo de EPI atualizado', message: `${epiProcessTitle(row.process_type)} foi ${decision === 'validado' ? 'validado' : 'reprovado'}.`, entityType: 'epi_process', entityId: row.id, metadata: { processType: row.process_type, decision } });
  const finalRow = await pool.query(`${epiProcessQuery} WHERE p.id = $1`, [row.id]);
  res.json({ process: publicEpiProcess(finalRow.rows[0], true) });
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

function pdfParagraph(doc, value, width = null) {
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
  pdfParagraph(doc, TERM_LEGAL_TEXT.clt);
  pdfParagraph(doc, TERM_LEGAL_TEXT.nr06);
  pdfParagraph(doc, TERM_LEGAL_TEXT.declaration);
  pdfEnsureSpace(doc, 150);
  doc.font('Helvetica-Bold').fontSize(9).text(`Status: ${term.status || '–'}`);
  if (term.signature_data) {
    const signature = pdfImageBuffer(term.signature_data);
    if (signature) {
      try { doc.image(signature, doc.page.margins.left, doc.y + 8, { fit: [220, 82] }); } catch { /* Assinatura inválida não impede o PDF. */ }
      doc.y += 92;
    }
  }
  doc.moveTo(120, doc.y).lineTo(330, doc.y).stroke('#4b5563');
  doc.font('Helvetica').fontSize(9).text(`Ass. do Funcionário · ${term.recipient_name || '–'}`, 120, doc.y + 5, { width: 210, align: 'center' });
  doc.y += 30;
  doc.fontSize(8).fillColor('#4b5563').text(`Assinado em: ${term.signed_at ? new Date(term.signed_at).toLocaleString('pt-BR') : 'Não assinado'} · IP: ${term.signer_ip || 'não informado'} · Dispositivo: ${term.signer_device || term.signer_user_agent || 'não informado'}`);
  doc.text(`Hash da assinatura: ${term.signature_hash || '–'}`);
}

function renderEpiProcessPdf(doc, process) {
  const processType = process.process_type;
  const legalText = EPI_PROCESS_LEGAL_TEXT[processType] || EPI_PROCESS_LEGAL_TEXT.checklist_diario;
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

  if (processType === 'checklist_diario') {
    pdfParagraph(doc, `Recebi da empresa ${companyName}, a título de empréstimo, para meu uso exclusivo, os equipamentos de proteção individual especificados neste termo, comprometendo-me a mantê-los em perfeito estado de conservação, ficando ciente de que:`);
    [
      'Se o equipamento for danificado ou inutilizado por emprego inadequado, mau uso, negligência ou extravio, a empresa me fornecerá novo equipamento e cobrará o valor de um equipamento da mesma marca ou equivalente ao da praça.',
      'Em caso de dano, inutilização ou extravio do equipamento deverei comunicar imediatamente ao setor competente.',
      'Terminando os serviços ou no caso de rescisão do contrato de trabalho, devolverei o equipamento completo e em perfeito estado de conservação, considerando-se o tempo do uso do mesmo, ao setor competente.',
      'Estando os equipamentos em minha posse, estarei sujeito a inspeções sem prévio aviso.',
    ].forEach((clause, index) => pdfParagraph(doc, `${index + 1}. ${clause}`));
  } else {
    (legalText.paragraphs || []).forEach((paragraph) => pdfParagraph(doc, paragraph));
  }

  pdfEnsureSpace(doc, 55);
  doc.font('Helvetica').fontSize(9).fillColor('#172033').text(`Processo: #${process.id}    Responsável: ${process.creator_name || '–'}    Emissão: ${process.created_at ? new Date(process.created_at).toLocaleString('pt-BR') : '–'}`);
  if (process.validator_name) doc.text(`Validador designado: ${process.validator_name}`);
  if (process.target_name) doc.text(`Destinatário: ${process.target_name}`);
  doc.moveDown(.8);
  pdfTermTable(doc, (process.items || []).map((item) => ({
    equipment_name: item.equipmentName || '–',
    quantity: item.quantity,
    ca: item.ca || '–',
    observation: `${String(item.condition || '').toUpperCase()}${item.observation ? ` · ${item.observation}` : ''}`,
  })));

  if (processType === 'checklist_diario') {
    pdfParagraph(doc, TERM_LEGAL_TEXT.clt);
    pdfParagraph(doc, TERM_LEGAL_TEXT.nr06);
    pdfParagraph(doc, TERM_LEGAL_TEXT.declaration);
  }

  pdfEnsureSpace(doc, 150);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#172033').text(`Status: ${process.status || '–'}`);
  const signature = pdfImageBuffer(process.creator_signature_data);
  if (signature) {
    try { doc.image(signature, doc.page.margins.left, doc.y + 8, { fit: [220, 82] }); } catch { /* Assinatura inválida não impede o PDF. */ }
    doc.y += 92;
  }
  doc.moveTo(120, doc.y).lineTo(330, doc.y).stroke('#4b5563');
  doc.font('Helvetica').fontSize(9).text(`Assinatura do responsável · ${process.creator_name || '–'}`, 120, doc.y + 5, { width: 210, align: 'center' });
  doc.y += 30;
  doc.fontSize(8).fillColor('#4b5563').text(`Assinatura validada em: ${process.signature_validated_at ? new Date(process.signature_validated_at).toLocaleString('pt-BR') : 'Não informada'}`);
  doc.text(`Hash da assinatura: ${process.signature_hash || '–'}`);
  doc.text(`Hash do documento: ${process.signature_document_hash || '–'}`);
  if (process.validated_by_name || process.validated_at) doc.text(`Processo validado por: ${process.validated_by_name || '–'} · ${process.validated_at ? new Date(process.validated_at).toLocaleString('pt-BR') : '–'}`);
  if (process.validation_notes) pdfParagraph(doc, `Observação da validação: ${process.validation_notes}`);
}

function renderVehicleChecklistPdf(doc, checklist, company) {
  const companyName = company.tradeName || company.legalName || DEFAULT_COMPANY_SETTINGS.tradeName;
  const companyCnpj = company.cnpj || DEFAULT_COMPANY_SETTINGS.cnpj;
  pdfCompanyHeader(doc, {
    companyName,
    companyCnpj,
    logoData: company.logoData,
    label: `CHECKLIST DE VEÍCULO #${checklist.id}`,
  });
  doc.info.Title = `Termo de responsabilidade de veículo #${checklist.id}`;
  doc.info.Author = 'SIGOS';
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#172033').text('TERMO DE RESPONSABILIDADE DE VEÍCULOS', { align: 'center' });
  doc.moveDown(.7);
  pdfParagraph(doc, VEHICLE_TERM_INTRO);
  VEHICLE_TERM_CLAUSES.forEach((clause, index) => pdfParagraph(doc, `${index + 1}. ${clause}`));
  pdfEnsureSpace(doc, 70);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#172033').text(`Checklist #${checklist.id}`);
  doc.font('Helvetica').fontSize(9).text(`Motorista: ${checklist.driverName || '–'}    Vistoriador: ${checklist.inspectorName || '–'}`);
  doc.text(`Placa: ${checklist.plate || '–'}    Modelo: ${checklist.model || '–'}    Ano: ${checklist.vehicleYear || '–'}    KM: ${checklist.mileage ?? '–'}`);
  doc.text(`Status: ${checklist.status || '–'}    Emissão: ${checklist.createdAt ? new Date(checklist.createdAt).toLocaleString('pt-BR') : '–'}`);
  doc.moveDown(.8);
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
  if (checklist.validationNotes) pdfParagraph(doc, `Observação da validação: ${checklist.validationNotes}`);

  (checklist.signatures || []).forEach((signature) => {
    pdfEnsureSpace(doc, 155);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#172033').text(`Assinatura · ${vehicleSignatureRoleLabelForPdf(signature.signerRole)}`);
    const signatureImage = pdfImageBuffer(signature.signatureData);
    if (signatureImage) {
      try { doc.image(signatureImage, doc.page.margins.left, doc.y + 8, { fit: [220, 82] }); } catch { /* Assinatura inválida não impede o PDF. */ }
      doc.y += 92;
    }
    doc.moveTo(120, doc.y).lineTo(330, doc.y).stroke('#4b5563');
    doc.font('Helvetica').fontSize(9).text(`${signature.typedName || '–'} · ${signature.signedAt ? new Date(signature.signedAt).toLocaleString('pt-BR') : '–'}`, 120, doc.y + 5, { width: 210, align: 'center' });
    doc.y += 28;
    doc.fontSize(8).fillColor('#4b5563').text(`IP: ${signature.signerIp || 'não informado'} · Dispositivo: ${signature.signerDevice || signature.signerUserAgent || 'não informado'}`);
    doc.text(`Coordenadas: ${signature.signerLatitude ?? '–'}, ${signature.signerLongitude ?? '–'} · Hash: ${signature.signatureHash || '–'}`);
    doc.text(`Assinatura validada em: ${signature.validatedAt ? new Date(signature.validatedAt).toLocaleString('pt-BR') : 'Não validada'}`);
  });
}

function vehicleSignatureRoleLabelForPdf(role) {
  return ({ tecnico: 'Técnico', vistoriador: 'Vistoriador', admin: 'Administrador' }[role] || role || 'Responsável');
}

function canAccessEpiTerms(user) {
  return user.role === 'admin' || user.role === 'tecnico';
}

app.get('/api/epi/terms', auth, async (req, res) => {
  if (!canAccessEpiTerms(req.user)) return res.status(403).json({ error: 'Este perfil não possui acesso aos termos de EPI.' });
  const visibility = req.user.role === 'admin' ? '' : ' WHERE t.created_by = $1 OR t.signer_user_id = $1';
  const result = await pool.query(`${epiTermQuery}${visibility} GROUP BY t.id, u.name ORDER BY t.created_at DESC LIMIT 100`, req.user.role === 'admin' ? [] : [req.user.id]);
  res.json({ terms: result.rows.map((row) => publicEpiTerm(row)) });
});

app.get('/api/epi/terms/:id', auth, async (req, res) => {
  if (!canAccessEpiTerms(req.user)) return res.status(403).json({ error: 'Este perfil não possui acesso aos termos de EPI.' });
  const visibility = req.user.role === 'admin' ? ' WHERE t.id = $1' : ' WHERE t.id = $1 AND (t.created_by = $2 OR t.signer_user_id = $2)';
  const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
  const result = await pool.query(`${epiTermQuery}${visibility} GROUP BY t.id, u.name`, params);
  if (!result.rows[0]) return res.status(404).json({ error: 'Termo não encontrado.' });
  res.json({ term: publicEpiTerm(result.rows[0], true) });
});

app.get('/api/epi/terms/:id/pdf', auth, async (req, res) => {
  if (!canAccessEpiTerms(req.user)) return res.status(403).json({ error: 'Este perfil não possui acesso aos termos de EPI.' });
  const visibility = req.user.role === 'admin' ? ' WHERE t.id = $1' : ' WHERE t.id = $1 AND (t.created_by = $2 OR t.signer_user_id = $2)';
  const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
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
      roles: ['admin', 'vistoriador'],
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
    plate: row.plate,
    model: row.model,
    vehicleYear: row.vehicle_year,
    mileage: row.mileage,
    status: row.status,
    validationNotes: row.validation_notes,
    driverName: row.driver_name || null,
    inspectorName: row.inspector_name || null,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    validatedAt: row.validated_at,
    items: row.items || [],
    media: (row.media || []).map((item) => ({
      id: item.id,
      kind: item.kind || 'vehicle_photo',
      itemKey: item.itemKey || null,
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
  return (items || []).map((item) => ({
    id: String(item.id ?? ''),
    itemKey: item.item_key ?? item.itemKey ?? null,
    itemName: item.item_name ?? item.itemName ?? null,
    beforeStatus: item.before_status ?? item.beforeStatus ?? null,
    beforeDescription: item.before_description ?? item.beforeDescription ?? null,
    afterStatus: item.after_status ?? item.afterStatus ?? null,
    afterDescription: item.after_description ?? item.afterDescription ?? null,
  }));
}

function vehicleSignatureDocumentPayload(checklist, items, signature) {
  const signatureContext = ['vistoriador', 'admin'].includes(signature.signerRole)
    ? {
      decision: signature.signatureContext?.decision || null,
      notes: signature.signatureContext?.notes || null,
    }
    : {};
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
    COALESCE(
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', i.id,
          'itemKey', i.item_key,
          'itemName', i.item_name,
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
`;

function vehicleChecklistScope(req, alias = 'c', includePending = false) {
  if (req.user.role === 'tecnico') return { clause: ` WHERE ${alias}.driver_user_id = $1`, params: [req.user.id] };
  if (req.user.role === 'vistoriador') {
    const pendingClause = includePending ? ` OR ${alias}.status = 'pendente_validacao'` : '';
    return { clause: ` WHERE (${alias}.driver_user_id = $1 OR ${alias}.inspector_user_id = $1${pendingClause})`, params: [req.user.id] };
  }
  return { clause: '', params: [] };
}

app.get('/api/vehicles/checklists/template', auth, (req, res) => {
  if (!['admin', 'tecnico', 'vistoriador'].includes(req.user.role)) return res.status(403).json({ error: 'Perfil sem acesso ao checklist de veículos.' });
  res.json({ items: VEHICLE_CHECKLIST_ITEMS.map(([key, name]) => ({ key, name })) });
});

app.get('/api/vehicles/catalog', auth, requireRole('admin', 'tecnico', 'vistoriador'), async (_req, res) => {
  const result = await pool.query(
    `SELECT id, plate, model, vehicle_year, color
     FROM vehicles
     WHERE status = 'ativo'
     ORDER BY plate`,
  );
  res.json({ vehicles: result.rows.map((row) => ({ id: row.id, plate: row.plate, model: row.model, year: row.vehicle_year, color: row.color })) });
});

app.get('/api/vehicles/checklists', auth, async (req, res) => {
  const scope = vehicleChecklistScope(req, 'c', req.user.role === 'vistoriador' && req.query.queue === '1');
  const result = await pool.query(`${vehicleChecklistQuery}${scope.clause} GROUP BY c.id, driver.name, inspector.name ORDER BY c.created_at DESC LIMIT 100`, scope.params);
  res.json({ checklists: result.rows.map(publicVehicleChecklist) });
});

app.get('/api/vehicles/checklists/:id', auth, async (req, res) => {
  const includePending = req.user.role === 'vistoriador' && req.query.queue === '1';
  let clause = ' WHERE c.id = $1';
  let params = [req.params.id];
  if (req.user.role === 'tecnico') {
    clause += ' AND c.driver_user_id = $2';
    params = [req.params.id, req.user.id];
  } else if (req.user.role === 'vistoriador') {
    clause += ` AND (c.driver_user_id = $2 OR c.inspector_user_id = $2${includePending ? " OR c.status = 'pendente_validacao'" : ''})`;
    params = [req.params.id, req.user.id];
  }
  const result = await pool.query(`${vehicleChecklistQuery}${clause} GROUP BY c.id, driver.name, inspector.name`, params);
  if (!result.rows[0]) return res.status(404).json({ error: 'Checklist de veículo não encontrado.' });
  res.json({ checklist: publicVehicleChecklist(result.rows[0], true) });
});

app.get('/api/vehicles/checklists/:checklistId/media/:mediaId', auth, async (req, res) => {
  const access = await pool.query(
    `SELECT c.driver_user_id, c.inspector_user_id, c.status, m.file_path, m.mime_type
     FROM vehicle_checklist_media m
     JOIN vehicle_checklists c ON c.id = m.checklist_id
     WHERE m.id = $1 AND m.checklist_id = $2`,
    [req.params.mediaId, req.params.checklistId],
  );
  const media = access.rows[0];
  if (!media) return res.status(404).json({ error: 'Imagem do checklist não encontrada.' });
  const canAccess = req.user.role === 'admin'
    || String(media.driver_user_id) === String(req.user.id)
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
    clause += ' AND c.driver_user_id = $2';
    params = [req.params.id, req.user.id];
  } else if (req.user.role === 'vistoriador') {
    clause += ` AND (c.driver_user_id = $2 OR c.inspector_user_id = $2${includePending ? " OR c.status = 'pendente_validacao'" : ''})`;
    params = [req.params.id, req.user.id];
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Perfil sem acesso ao checklist de veículos.' });
  }
  const result = await pool.query(`${vehicleChecklistQuery}${clause} GROUP BY c.id, driver.name, inspector.name`, params);
  if (!result.rows[0]) return res.status(404).json({ error: 'Checklist de veículo não encontrado.' });
  const company = publicCompanySettings(await getCompanySettings());
  const checklist = publicVehicleChecklist(result.rows[0], true);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="checklist-veiculo-${checklist.id}.pdf"`);
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

app.post('/api/vehicles/checklists', auth, uploadRateLimit, requireRole('tecnico', 'vistoriador'), async (req, res) => {
  const plate = cleanText(req.body.plate, 12).toUpperCase();
  const model = cleanText(req.body.model, 120);
  const vehicleYear = req.body.vehicleYear === null || req.body.vehicleYear === undefined || req.body.vehicleYear === '' ? null : Number(req.body.vehicleYear);
  const mileage = req.body.mileage === null || req.body.mileage === undefined || req.body.mileage === '' ? null : Number(req.body.mileage);
  const submittedItems = Array.isArray(req.body.items) ? req.body.items : [];
  const signatureRequest = parseRegisteredVehicleSignature(req.user, req.body);
  const submittedSelfie = req.body.selfie && typeof req.body.selfie === 'object' ? req.body.selfie : null;
  const submittedPhotos = Array.isArray(req.body.photos) ? req.body.photos : [];
  const itemMap = new Map(submittedItems.map((item) => [String(item.itemKey || ''), item]));
  const normalizedItems = VEHICLE_CHECKLIST_ITEMS.map(([itemKey, itemName]) => {
    const item = itemMap.get(itemKey) || {};
    const beforeStatus = ['ok', 'defeito', 'quebrado'].includes(item.beforeStatus) ? item.beforeStatus : 'ok';
    const afterStatus = ['ok', 'defeito', 'quebrado'].includes(item.afterStatus) ? item.afterStatus : 'ok';
    return {
      itemKey,
      itemName,
      beforeStatus,
      beforeDescription: beforeStatus === 'ok' ? null : cleanText(item.beforeDescription, 500) || null,
      afterStatus,
      afterDescription: afterStatus === 'ok' ? null : cleanText(item.afterDescription, 500) || null,
    };
  });

  if (!plate || !model) return res.status(400).json({ error: 'Informe a placa e o modelo do veículo.' });
  if (vehicleYear !== null && (!Number.isInteger(vehicleYear) || vehicleYear < 1900 || vehicleYear > 2200)) return res.status(400).json({ error: 'Ano do veículo inválido.' });
  if (mileage !== null && (!Number.isInteger(mileage) || mileage < 0)) return res.status(400).json({ error: 'Quilometragem inválida.' });
  if (signatureRequest.error) return res.status(400).json({ error: signatureRequest.error });
  if (!submittedSelfie || submittedSelfie.captureMode !== 'camera' || !submittedSelfie.imageData) return res.status(400).json({ error: 'Capture uma selfie pela câmera antes de enviar o checklist.' });
  if (!submittedPhotos.length || submittedPhotos.length > 10) return res.status(400).json({ error: 'Envie de uma a dez fotos do veículo capturadas pela câmera.' });
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
    const checklistResult = await client.query(
      `INSERT INTO vehicle_checklists (vehicle_id, driver_user_id, plate, model, vehicle_year, mileage, status, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendente_validacao', $7)
       RETURNING id`,
      [vehicleResult.rows[0].id, req.user.id, plate, model, vehicleYear, mileage, signedAt],
    );
    const checklistId = checklistResult.rows[0].id;
    for (const item of normalizedItems) {
      await client.query(
        `INSERT INTO vehicle_checklist_items
          (checklist_id, item_key, item_name, before_status, before_description, after_status, after_description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [checklistId, item.itemKey, item.itemName, item.beforeStatus, item.beforeDescription, item.afterStatus, item.afterDescription],
      );
    }
    const persistedItems = await client.query(
      `SELECT id, item_key, item_name, before_status, before_description, after_status, after_description
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
    await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_checklist_created', entityType: 'vehicle_checklist', entityId: checklistId, metadata: { plate, itemCount: normalizedItems.length, problemCount: normalizedItems.filter((item) => item.beforeStatus !== 'ok' || item.afterStatus !== 'ok').length, signatureHash, documentHash, signatureVersion: 2 } });
    await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_signature_signed', entityType: 'vehicle_checklist', entityId: checklistId, metadata: { signerRole: signature.signerRole, signatureHash, documentHash, signatureVersion: 2, typedName: signature.typedName, latitude: signature.signerLatitude, longitude: signature.signerLongitude, device: signature.signerDevice } });
    await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_checklist_photos_uploaded', entityType: 'vehicle_checklist', entityId: checklistId, metadata: { mediaIds: media.map((item) => item.id), selfieCount: 1, photoCount: submittedPhotos.length, captureMode: 'camera', coordinates: media.map((item) => ({ mediaId: item.id, kind: item.kind, itemKey: item.item_key, latitude: item.latitude, longitude: item.longitude, locationLabel: item.location_label })) } });
    await notifyRoles({
      roles: ['admin', 'vistoriador'],
      notificationType: 'checklist_created',
      title: 'Novo checklist de veículo',
      message: `O checklist do veículo ${plate} foi criado e está aguardando validação.`,
      entityType: 'vehicle_checklist',
      entityId: checklistId,
      metadata: { plate, createdBy: req.user.id, creatorRole: req.user.role },
    });
    const created = await pool.query(`${vehicleChecklistQuery} WHERE c.id = $1 GROUP BY c.id, driver.name, inspector.name`, [checklistId]);
    res.status(201).json({ checklist: publicVehicleChecklist(created.rows[0], true) });
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
  const signatureRequest = req.user.role === 'admin'
    ? parseVehicleLocation(req.body)
    : parseRegisteredVehicleSignature(req.user, req.body);
  if (signatureRequest.error) return res.status(400).json({ error: signatureRequest.error });
  const pending = await pool.query(`${vehicleChecklistQuery} WHERE c.id = $1 AND c.status = 'pendente_validacao' GROUP BY c.id, driver.name, inspector.name`, [req.params.id]);
  const checklist = pending.rows[0];
  if (!checklist) return res.status(404).json({ error: 'Checklist pendente não encontrado.' });

  const signedAt = new Date().toISOString();
  const signature = req.user.role === 'admin' ? null : {
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
    signatureContext: { decision, notes: validationNotes || null },
  };
  const { documentHash, signatureHash } = signature ? vehicleSignatureHashes(checklist, checklist.items, signature) : { documentHash: null, signatureHash: null };
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
    if (signature) {
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
    }
    await client.query('COMMIT');
    await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_checklist_validated', entityType: 'vehicle_checklist', entityId: result.rows[0].id, metadata: { decision, plate: result.rows[0].plate, notes: validationNotes || null, signatureHash, documentHash, signatureVersion: 2 } });
    if (signature) await audit({ req, actorUserId: req.user.id, eventType: 'vehicle_signature_signed', entityType: 'vehicle_checklist', entityId: result.rows[0].id, metadata: { signerRole: signature.signerRole, decision, signatureHash, documentHash, signatureVersion: 2, typedName: signature.typedName, latitude: signature.signerLatitude, longitude: signature.signerLongitude, device: signature.signerDevice, signatureMethod: signature.signatureMethod } });
    await notifyRoles({
      roles: ['admin'],
      notificationType: 'checklist_validated',
      title: 'Checklist validado',
      message: `O checklist do veículo ${result.rows[0].plate} foi ${decision === 'validado' ? 'validado' : 'reprovado'} por ${req.user.name}.`,
      entityType: 'vehicle_checklist',
      entityId: result.rows[0].id,
      metadata: { plate: result.rows[0].plate, decision, validatedBy: req.user.id, notes: validationNotes || null },
    });
    const updated = await pool.query(`${vehicleChecklistQuery} WHERE c.id = $1 GROUP BY c.id, driver.name, inspector.name`, [req.params.id]);
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
  if (req.user.role === 'vistoriador' && signerRole !== 'vistoriador') return res.status(403).json({ error: 'O vistoriador só pode validar a própria assinatura.' });
  if (!['admin', 'tecnico', 'vistoriador'].includes(req.user.role)) return res.status(403).json({ error: 'Perfil sem acesso à validação de assinaturas.' });

  let clause = ' WHERE c.id = $1';
  let params = [req.params.id];
  if (req.user.role === 'tecnico') {
    clause += ' AND c.driver_user_id = $2';
    params = [req.params.id, req.user.id];
  } else if (req.user.role === 'vistoriador') {
    clause += ' AND (c.driver_user_id = $2 OR c.inspector_user_id = $2)';
    params = [req.params.id, req.user.id];
  }
  const result = await pool.query(`${vehicleChecklistQuery}${clause} GROUP BY c.id, driver.name, inspector.name`, params);
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
    lastChecklistAt: row.last_checklist_at || null,
    lastChecklistId: row.last_checklist_id || null,
    integrityItems: row.integrity_items || [],
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
             last_checklist.integrity_items
      FROM vehicles v
      LEFT JOIN LATERAL (
        SELECT vc.id, vc.status, vc.created_at, u.name AS driver_name,
               COALESCE(
                 (SELECT json_agg(json_build_object(
                    'itemKey', i.item_key,
                    'itemName', i.item_name,
                    'beforeStatus', i.before_status,
                    'beforeDescription', i.before_description,
                    'afterStatus', i.after_status,
                    'afterDescription', i.after_description
                  ) ORDER BY i.id)
                  FROM vehicle_checklist_items i
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

app.post('/api/stock/ppes', auth, requireRole('admin'), async (req, res) => {
  const id = req.body.id === null || req.body.id === undefined || req.body.id === '' ? null : Number(req.body.id);
  const name = cleanText(req.body.name, 180);
  const ca = cleanText(req.body.ca, 80);
  const category = cleanText(req.body.category, 100);
  const code = cleanText(req.body.code, 80) || `CA-${ca.replace(/[^A-Za-z0-9]+/g, '-')}`;
  const stockQuantity = Number(req.body.stockQuantity || 0);
  const requestedMinimumStock = req.body.minimumStock === undefined || req.body.minimumStock === null || req.body.minimumStock === ''
    ? null
    : Number(req.body.minimumStock);
  if (!name || !ca) return res.status(400).json({ error: 'Informe o nome do EPI e o CA.' });
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
         SET code = $1, name = $2, ca = $3, category = $4, stock_quantity = $5, minimum_stock = $6, active = TRUE
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
  const result = await pool.query('UPDATE ppe_items SET active = $1 WHERE id = $2 RETURNING *', [active, req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'EPI não encontrado.' });
  await audit({ req, actorUserId: req.user.id, eventType: active ? 'ppe_activated' : 'ppe_deactivated', entityType: 'ppe_item', entityId: result.rows[0].id, metadata: { active } });
  res.json({ ppe: publicStockPpe(result.rows[0]) });
});

app.get('/api/users', auth, requireRole('admin'), async (_req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, role, active, created_at FROM users ORDER BY name',
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
      `SELECT t.id AS term_id, t.signed_at, t.status,
              ti.equipment_name, ti.quantity, ti.ca, ti.condition, ti.observation
       FROM epi_terms t
       JOIN epi_term_items ti ON ti.term_id = t.id
       WHERE (t.created_by = $1 OR t.signer_user_id = $1)
         AND t.status = 'assinado'
         AND timezone('America/Fortaleza', t.signed_at)::date = timezone('America/Fortaleza', NOW())::date
       UNION ALL
       SELECT p.id AS term_id, p.submitted_at AS signed_at, p.status,
              pi.equipment_name, pi.quantity, pi.ca, pi.condition, pi.observation
       FROM epi_processes p
       JOIN epi_process_items pi ON pi.process_id = p.id
       WHERE p.created_by = $1
         AND p.process_type = 'checklist_diario'
         AND p.submitted_at IS NOT NULL
         AND timezone('America/Fortaleza', p.submitted_at)::date = timezone('America/Fortaleza', NOW())::date
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

app.delete('/api/users/:id', auth, requireRole('admin'), async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ error: 'O administrador não pode remover a própria conta.' });
  const result = await pool.query(
    `UPDATE users SET active = FALSE, updated_at = NOW()
     WHERE id = $1 AND active = TRUE
     RETURNING id, name, email, role`,
    [req.params.id],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Conta ativa não encontrada.' });
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
  if (['/', '/index.html', '/app.js', '/styles.css'].includes(req.path)) {
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
