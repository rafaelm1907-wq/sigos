# SIGOS

Sistema web de gestão de checklists de EPIs e veículos, termos eletrônicos, assinaturas, fotos capturadas pela câmera, auditoria e notificações.

## O que é versionado

Este repositório contém somente o código da aplicação, os arquivos públicos, as dependências fixadas e os modelos de instalação. Não devem ser versionados:

- credenciais, `.env` ou `runtime.env` reais;
- JSON de conta de serviço do Firebase;
- banco de dados, fotos, selfies, PDFs gerados, APKs e logs;
- arquivos de backup ou configurações específicas de um cliente.

## Instalação em um novo cliente

Pré-requisitos: Debian 13 ou distribuição compatível, acesso root, PostgreSQL já criado e um proxy HTTPS (por exemplo, Nginx ou Cloudflare Tunnel).

1. Crie o banco e o usuário do PostgreSQL.
2. Copie `deploy/runtime.env.example` para `/etc/epi-checklist/runtime.env` e preencha os valores reais fora do repositório.
3. Gere um segredo forte para `JWT_SECRET`, por exemplo com `openssl rand -base64 48`.
4. Execute, a partir da raiz do projeto:

```bash
sudo ./scripts/install.sh
```

O instalador prepara o usuário de serviço, o runtime Node.js compatível, os diretórios de armazenamento, as dependências e a unidade systemd. Ele não cria credenciais reais nem publica arquivos do cliente.

O instalador também prepara a atualização controlada pelo Superadmin. Com o repositório configurado em `SIGOS_UPDATE_REPO_URL`, o botão de atualização baixa somente a branch definida em `SIGOS_UPDATE_BRANCH`, cria um backup da aplicação, instala as dependências, reinicia o serviço e verifica `/api/health`. O processo é executado por um script fixo autorizado no `sudoers`; o navegador não envia comandos ao servidor.

Para uma instalação nova, preencha também `BOOTSTRAP_SUPERADMIN_NAME`, `BOOTSTRAP_SUPERADMIN_EMAIL` e `BOOTSTRAP_SUPERADMIN_PASSWORD` no `runtime.env` se quiser que o Superadmin inicial seja criado automaticamente. O banco começa vazio; os dados de uma instalação existente não são levados pelo Git.

Para habilitar o modelo de firewall, revise as portas permitidas em `deploy/sigos-firewall.nft` e instale-o conscientemente no servidor. O arquivo mantém o SSH na porta 22 e o HTTP na porta 80 por padrão; ajuste conforme a infraestrutura do cliente.

## Desenvolvimento local

```bash
cp .env.example .env
npm install
npm start
```

O serviço espera `DATABASE_URL` e `JWT_SECRET`. Em produção, use `COOKIE_SECURE=true`, `ENFORCE_HTTPS=true` e um proxy HTTPS.

## Verificações

```bash
npm run check
npm audit --omit=dev
```

O código aplica CSP, limitação de tentativas de login e de uploads, execução sem root e validação de imagens capturadas pela câmera. A auditoria registra IP, user-agent, coordenadas quando consentidas e o hash dos arquivos.

