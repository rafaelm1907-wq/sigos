#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${SIGOS_APP_DIR:-/opt/epi-checklist}"
APP_USER="${SIGOS_APP_USER:-epiapp}"
APP_GROUP="${SIGOS_APP_GROUP:-epiapp}"
NODE_VERSION="${SIGOS_NODE_VERSION:-22.20.0}"
NODE_PREFIX="${SIGOS_NODE_PREFIX:-/opt/node-v${NODE_VERSION}}"
ENV_FILE="${SIGOS_ENV_FILE:-/etc/epi-checklist/runtime.env}"
SERVICE_NAME="${SIGOS_SERVICE_NAME:-epi-checklist.service}"
REPO_URL="${SIGOS_UPDATE_REPO_URL:-https://github.com/rafaelm1907-wq/sigos.git}"
UPDATE_BRANCH="${SIGOS_UPDATE_BRANCH:-feature/vehicle-inventory}"
STATUS_FILE="${SIGOS_UPDATE_STATUS_PATH:-${APP_DIR}/.update/status.json}"
LOCK_FILE="${SIGOS_UPDATE_LOCK_PATH:-/run/lock/sigos-update.lock}"
BACKUP_DIR="${SIGOS_UPDATE_BACKUP_DIR:-${APP_DIR}/.update/backups}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
  REPO_URL="${SIGOS_UPDATE_REPO_URL:-${REPO_URL}}"
  UPDATE_BRANCH="${SIGOS_UPDATE_BRANCH:-${UPDATE_BRANCH}}"
  STATUS_FILE="${SIGOS_UPDATE_STATUS_PATH:-${STATUS_FILE}}"
  BACKUP_DIR="${SIGOS_UPDATE_BACKUP_DIR:-${BACKUP_DIR}}"
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Execute este script como root." >&2
  exit 1
fi

status_dir="$(dirname "${STATUS_FILE}")"
install -d -o "${APP_USER}" -g "${APP_GROUP}" -m 0750 "${status_dir}" "${BACKUP_DIR}"

json_escape() {
  local value="${1:-}"
  value="${value//$'\n'/ }"
  value="${value//$'\r'/ }"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '%s' "${value}"
}

write_status() {
  local state="$1"
  local message="${2:-}"
  local commit="${3:-}"
  local temp_file="${STATUS_FILE}.tmp.$$"
  printf '{"status":"%s","message":"%s","commit":"%s","updatedAt":"%s"}\n' \
    "$(json_escape "${state}")" "$(json_escape "${message}")" "$(json_escape "${commit}")" "$(date --iso-8601=seconds)" > "${temp_file}"
  chown "${APP_USER}:${APP_GROUP}" "${temp_file}"
  chmod 0640 "${temp_file}"
  mv -f "${temp_file}" "${STATUS_FILE}"
}

work_dir=""
backup_file=""
previous_commit=""
rollback_started=0

rollback() {
  local reason="${1:-Falha durante a atualização.}"
  [[ "${rollback_started}" -eq 1 ]] && return 0
  rollback_started=1
  if [[ -n "${backup_file}" && -f "${backup_file}" ]]; then
    systemctl stop "${SERVICE_NAME}" || true
    tar -xzf "${backup_file}" -C "${APP_DIR}" || true
    chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}" || true
    runuser -u "${APP_USER}" -- env PATH="${NODE_PREFIX}/bin:${PATH}" npm --prefix "${APP_DIR}" ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null 2>&1 || true
    systemctl start "${SERVICE_NAME}" || true
  fi
  write_status "failed" "${reason}" "${previous_commit}"
}

on_error() {
  local exit_code=$?
  rollback "Atualização não concluída (código ${exit_code})."
  exit "${exit_code}"
}
trap on_error ERR

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  write_status "running" "Já existe uma atualização em andamento."
  exit 0
fi

if ! command -v git >/dev/null 2>&1 || ! command -v rsync >/dev/null 2>&1; then
  write_status "failed" "Dependências do atualizador ausentes no servidor."
  exit 1
fi

if [[ ! -x "${NODE_PREFIX}/bin/node" ]]; then
  write_status "failed" "Runtime Node.js configurado não foi encontrado."
  exit 1
fi

current_commit="$(git -C "${APP_DIR}" rev-parse HEAD 2>/dev/null || true)"
write_status "running" "Baixando a versão mais recente do repositório." "${current_commit}"
work_dir="$(mktemp -d /tmp/sigos-update.XXXXXX)"
trap 'rm -rf "${work_dir}"' EXIT

git clone --depth 1 --branch "${UPDATE_BRANCH}" --single-branch "${REPO_URL}" "${work_dir}/source" >/dev/null 2>&1
new_commit="$(git -C "${work_dir}/source" rev-parse HEAD)"
if [[ "${new_commit}" == "${current_commit}" && -n "${current_commit}" ]]; then
  write_status "success" "O sistema já está atualizado." "${new_commit}"
  exit 0
fi

previous_commit="${current_commit}"
backup_file="${BACKUP_DIR}/app-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "${backup_file}" -C "${APP_DIR}" \
  --exclude='./node_modules' \
  --exclude='./storage' \
  --exclude='./releases' \
  --exclude='./.update' \
  --exclude='./.git' \
  .

write_status "running" "Aplicando a versão ${new_commit:0:12}." "${new_commit}"
rsync -a --delete \
  --exclude '.env' \
  --exclude 'runtime.env' \
  --exclude 'node_modules' \
  --exclude 'storage' \
  --exclude 'releases' \
  --exclude '.update' \
  --exclude '.git' \
  "${work_dir}/source/" "${APP_DIR}/"
chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"

runuser -u "${APP_USER}" -- env PATH="${NODE_PREFIX}/bin:${PATH}" npm --prefix "${APP_DIR}" ci --omit=dev --ignore-scripts --no-audit --no-fund
runuser -u "${APP_USER}" -- env PATH="${NODE_PREFIX}/bin:${PATH}" "${NODE_PREFIX}/bin/node" --check "${APP_DIR}/server.js"

write_status "running" "Reiniciando o serviço SIGOS." "${new_commit}"
systemctl restart "${SERVICE_NAME}"
for _ in {1..15}; do
  if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:7000/api/health >/dev/null; then
    write_status "success" "Atualização concluída com sucesso." "${new_commit}"
    exit 0
  fi
  sleep 2
done

rollback "O serviço não respondeu ao health check após a atualização."
exit 1
