#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${SIGOS_APP_DIR:-/opt/epi-checklist}"
APP_USER="${SIGOS_APP_USER:-epiapp}"
APP_GROUP="${SIGOS_APP_GROUP:-epiapp}"
NODE_VERSION="${SIGOS_NODE_VERSION:-22.20.0}"
NODE_PREFIX="${SIGOS_NODE_PREFIX:-/opt/node-v${NODE_VERSION}}"
ENV_FILE="${SIGOS_ENV_FILE:-/etc/epi-checklist/runtime.env}"
SERVICE_FILE="/etc/systemd/system/epi-checklist.service"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Execute este script como root." >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  install -d -m 0750 /etc/epi-checklist
  install -o root -g root -m 0640 deploy/runtime.env.example "${ENV_FILE}.example"
  echo "Crie ${ENV_FILE} com os valores reais antes de instalar o serviço." >&2
  echo "Um modelo foi salvo em ${ENV_FILE}.example." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl git rsync sudo xz-utils

if [[ ! -x "${NODE_PREFIX}/bin/node" ]]; then
  download_dir="$(mktemp -d)"
  trap 'rm -rf "${download_dir}"' EXIT
  archive="node-v${NODE_VERSION}-linux-x64.tar.xz"
  curl --fail --silent --show-error --location --output "${download_dir}/${archive}" "https://nodejs.org/dist/v${NODE_VERSION}/${archive}"
  curl --fail --silent --show-error --location --output "${download_dir}/SHASUMS256.txt" "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"
  (
    cd "${download_dir}"
    grep " ${archive}$" SHASUMS256.txt | sha256sum --check --status
  )
  tar -xJf "${download_dir}/${archive}" -C /opt
  mv -T "/opt/node-v${NODE_VERSION}-linux-x64" "${NODE_PREFIX}"
  chown -R root:root "${NODE_PREFIX}"
  trap - EXIT
  rm -rf "${download_dir}"
fi

if ! getent group "${APP_GROUP}" >/dev/null; then
  groupadd --system "${APP_GROUP}"
fi
if ! id "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --gid "${APP_GROUP}" --home-dir "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi

install -d -o "${APP_USER}" -g "${APP_GROUP}" -m 0750 "${APP_DIR}" "${APP_DIR}/storage" "${APP_DIR}/storage/selfies" "${APP_DIR}/releases"
install -d -o root -g "${APP_GROUP}" -m 0750 /etc/epi-checklist

install -o "${APP_USER}" -g "${APP_GROUP}" -m 0640 server.js "${APP_DIR}/server.js"
install -o "${APP_USER}" -g "${APP_GROUP}" -m 0640 package.json "${APP_DIR}/package.json"
install -o "${APP_USER}" -g "${APP_GROUP}" -m 0640 package-lock.json "${APP_DIR}/package-lock.json"
install -d -o "${APP_USER}" -g "${APP_GROUP}" -m 0750 "${APP_DIR}/public"
cp -a public/. "${APP_DIR}/public/"
chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}/public"

install -o root -g root -m 0644 deploy/epi-checklist.service "${SERVICE_FILE}"
install -o root -g root -m 0755 scripts/update.sh /usr/local/sbin/sigos-update
install -d -o root -g root -m 0755 /etc/sudoers.d
install -o root -g root -m 0440 deploy/sigos-update.sudoers /etc/sudoers.d/sigos-update
visudo -cf /etc/sudoers.d/sigos-update
export PATH="${NODE_PREFIX}/bin:${PATH}"
"${NODE_PREFIX}/bin/npm" --prefix "${APP_DIR}" ci --omit=dev --ignore-scripts --no-audit --no-fund

systemctl daemon-reload
systemctl enable epi-checklist.service
systemctl restart epi-checklist.service
systemctl --no-pager --full status epi-checklist.service
