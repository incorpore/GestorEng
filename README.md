# GestorEng — Sistema de gestão da Velmont

Sistema modular para gerir a construtora: **obras** (públicas e particulares) com **medições/boletins**, **diário de obras (RDO)**,
**licitações** com integração ao **PNCP**, **orçamentos**, **financeiro**, **documentos** com papel timbrado e variáveis
(`{{ obra.nome }}`), assinatura eletrônica via **Documenso**, **frota**, **funcionários** (CLT, diarista, horista, empreiteiro),
**inventário**, **assistente de IA** (OpenRouter), **backup automático em S3** e **app Android** gerado pelo GitHub Actions.

| Camada | Tecnologia |
|---|---|
| API | Python 3.13 · FastAPI · SQLAlchemy 2 · Alembic · PostgreSQL 16 |
| PDF | WeasyPrint + pypdf (timbrado em imagem ou PDF, margens configuráveis) |
| Web | React 18 · TypeScript · Vite · Tailwind · TanStack Query · TipTap |
| Android | Capacitor 7 (mesmo código do web) — APK pelo GitHub Actions |
| Infra | Docker · Nginx · Redis (opcional) · S3 compatível para backup |

---

## 1. Instalação com Docker

Há **dois arquivos compose**:

| Arquivo | Quando usar |
|---|---|
| `docker-compose.yml` | **Completo**: sobe PostgreSQL, Redis, API, worker (backups) e web. |
| `docker-compose.external.yml` | **Só a aplicação** (API, worker, web), usando **PostgreSQL e Redis que já rodam em outros containers** (ex.: no ZimaOS). |

### 1.1 Preparação (ambos)

```bash
git clone https://github.com/incorpore/GestorEng.git && cd GestorEng
cp .env.example .env
# gere os segredos e cole no .env (SECRET_KEY, ENCRYPTION_KEY, senhas):
openssl rand -base64 48
```

> ⚠️ Guarde o `ENCRYPTION_KEY`: ele criptografa as chaves de API (OpenRouter, Documenso, S3). Se trocá-lo, será preciso
> informá-las novamente.

### 1.2 Instalação completa

```bash
docker compose up -d --build
docker compose logs -f api     # aguarde "Application startup complete"
```

Acesse `http://IP-DO-SERVIDOR:8080` com o `ADMIN_EMAIL` / `ADMIN_PASSWORD` do `.env`.

### 1.3 Instalação usando Postgres/Redis existentes

1. No seu PostgreSQL (16 ou superior):
   ```sql
   CREATE USER gestoreng WITH PASSWORD 'senha-forte';
   CREATE DATABASE gestoreng OWNER gestoreng;
   ```
2. Descubra a rede Docker onde estão o Postgres/Redis: `docker network ls` (ex.: `infra`, `zimaos_default`).
3. No `.env`:
   ```env
   EXTERNAL_NETWORK=infra
   DATABASE_URL=postgresql+psycopg://gestoreng:senha-forte@postgres:5432/gestoreng
   REDIS_URL=redis://:senha-redis@redis:6379/0     # opcional — vazio = sem Redis
   # STORAGE_PATH=/DATA/AppData/gestoreng/storage  # opcional: pasta do host/NAS para anexos
   ```
   (`postgres`/`redis` são os nomes dos containers nessa rede.)

   **Redis com senha e prefixo** — tudo pode ir na URL:
   ```env
   REDIS_URL=redis://:minha%40senha@redis:6379/2?prefix=velmont
   ```
   - Caracteres especiais da senha devem ser codificados (`@`→`%40`, `#`→`%23`, `:`→`%3A`, `/`→`%2F`, `%`→`%25`).
     Para gerar: `python3 -c "import urllib.parse;print(urllib.parse.quote('SUA_SENHA', safe=''))"`.
   - Com usuário ACL (Redis 6+): `redis://usuario:senha@redis:6379/0`; com TLS use `rediss://`.
   - `/2` é o número do banco do Redis (0–15) — outra forma de isolar o GestorEng de outros sistemas.
   - `?prefix=velmont` faz todas as chaves começarem com `velmont:` (padrão `gestoreng:`). Alternativa: `REDIS_PREFIX=velmont`.
4. `docker compose -f docker-compose.external.yml up -d --build`

> **Redis** é opcional: quando presente, o limite de tentativas de login é compartilhado entre processos/réplicas.
> Sem ele, o limite funciona em memória. O sistema **não usa NATS** nem outro broker de mensagens; se você quis dizer
> **NAS**, aponte `STORAGE_PATH` para a pasta do NAS montada no host.

### 1.4 Imagens

Por padrão as imagens são **construídas no próprio servidor** (`pull_policy: build`) — a primeira instalação leva alguns
minutos e precisa de acesso a Docker Hub, PyPI, npm e apt.postgresql.org.

Opcionalmente, use as imagens publicadas pelo workflow **Imagens Docker** (amd64 e arm64) após o merge na `main`:
```env
IMAGE_API=ghcr.io/incorpore/gestoreng-api:latest
IMAGE_WEB=ghcr.io/incorpore/gestoreng-web:latest
PULL_POLICY=always
```
Se o repositório for privado, faça `docker login ghcr.io` com um token com escopo `read:packages`.

### 1.5 Problemas comuns

**`lookup ghcr.1panel.live: no such host`** (ou outro espelho como `*.1panel.live`, `docker.m.daocloud.io`):
o Docker do servidor está configurado com um espelho de registro que saiu do ar. Remova-o:
- **1Panel:** *Contêineres › Configuração › Espelhos de registro* — apague a linha do espelho e salve (reinicia o Docker).
- **Manual:** edite `/etc/docker/daemon.json`, remova a entrada `registry-mirrors` com o endereço problemático e rode
  `sudo systemctl restart docker`. Se o espelho estiver no containerd: `grep -rl 1panel /etc/containerd /etc/docker`.

Depois teste com `docker pull ghcr.io/home-assistant/home-assistant:stable` (ou qualquer imagem pública do ghcr.io).

**A instalação tenta baixar `gestoreng/api:local`:** confirme que o `.env` não tem `PULL_POLICY=always` sem as variáveis
`IMAGE_*` e rode `docker compose up -d --build`.

### 1.6 ZimaOS / CasaOS

Arquivos prontos em [`deploy/zimaos/`](deploy/zimaos/):

- [`banco-interno.yml`](deploy/zimaos/banco-interno.yml) — instala PostgreSQL e Redis junto com o app;
- [`banco-externo.yml`](deploy/zimaos/banco-externo.yml) — usa PostgreSQL/Redis já existentes;
- [`INSTALACAO.md`](deploy/zimaos/INSTALACAO.md) e [`GestorEng-ZimaOS.pdf`](deploy/zimaos/GestorEng-ZimaOS.pdf) — guia
  passo a passo (login no registro privado, pastas, chaves, banco, instalação, manutenção, atualização e problemas comuns).
  Regenere o PDF/LaTeX com `deploy/zimaos/gerar-pdf.sh`.

### 1.7 Atualização

```bash
git pull && docker compose up -d --build      # migrações do banco são aplicadas automaticamente
```

---

## 2. Backup (S3 compatível)

Configurações › **Backup** (somente administradores):

- Funciona com **AWS S3, MinIO, Cloudflare R2, Backblaze B2, Wasabi**, MinIO no ZimaOS etc.
- Backup diário no horário escolhido, executado pelo container `worker` (com trava no banco — nunca roda em duplicidade).
- Conteúdo: `gestoreng-AAAAMMDD-HHMMSS.tar.gz` com o banco (`pg_dump -Fc`) e todos os anexos/PDFs.
- Retenção configurável (apaga backups mais antigos que N dias), SSE-AES256 opcional, histórico com status e botão
  **Executar agora**. A secret key fica criptografada no banco.

Linha de comando:

```bash
docker compose exec api ./docker-entrypoint.sh backup listar
docker compose exec api ./docker-entrypoint.sh backup executar
# Restauração (sobrescreve o banco atual!):
docker compose stop web worker
docker compose run --rm api backup restaurar gestoreng/gestoreng-20261115-023000.tar.gz
docker compose up -d
```

> Teste a restauração periodicamente em um ambiente separado — backup não testado não é backup.

---

## 3. Segurança

Nenhum sistema é "100% seguro", mas o GestorEng adota as práticas recomendadas (OWASP ASVS):

- Senhas com **Argon2id**, política de força, bloqueio após 5 tentativas e limite de requisições por IP.
- **2FA (TOTP)** opcional por usuário; administradores podem resetar.
- Access token JWT de **15 min**; refresh token **rotativo com detecção de reuso** (token roubado revoga a sessão inteira),
  em cookie `HttpOnly + Secure + SameSite=Strict` no navegador. Lista e encerramento de sessões.
- **RBAC granular**: perfis com permissões por módulo/ação, exceções por usuário (conceder/negar), **restrição por obra**
  e ocultação de dados sensíveis (salários, CPF) sem a permissão `funcionarios.ver_salarios`. Um usuário nunca concede
  permissões que não possui.
- **Auditoria** de todas as alterações (quem, quando, IP, antes/depois).
- Modelos de documento em **Jinja2 sandbox** com escape automático; o gerador de PDF **bloqueia recursos externos** (SSRF).
- Uploads validados pelo conteúdo real (não pela extensão), fora da raiz web, servidos por links assinados de 10 min.
- Chaves de API e credenciais de backup **criptografadas** (Fernet) no banco.
- Containers sem root, sistema de arquivos somente leitura, `no-new-privileges`, `cap_drop: ALL`; só o `web` expõe porta.
- Nginx com CSP restritiva, `X-Frame-Options`, `nosniff`, `Referrer-Policy`; documentação da API desativada em produção.

Recomendações operacionais: use **HTTPS**, mantenha as imagens atualizadas, ative **2FA** para administradores e habilite o
backup S3 fora do servidor.

---

## 4. App Android

Workflow **App Android** (`.github/workflows/android.yml`) — roda ao criar uma tag `v1.2.3` ou manualmente em *Actions*.
Gera o APK assinado (artefato do workflow e anexo da *Release*).

1. Crie a chave de assinatura **uma única vez** e guarde-a com segurança:
   ```bash
   keytool -genkeypair -v -keystore velmont.jks -alias gestoreng -keyalg RSA -keysize 4096 -validity 10000
   base64 -w0 velmont.jks   # copie a saída
   ```
2. Em *Settings › Secrets and variables › Actions* crie: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
3. `git tag v1.0.0 && git push origin v1.0.0`.

No primeiro uso o app pede o **endereço do servidor** (ex.: `https://gestor.velmont.com.br` ou `http://192.168.0.10:8080`).
As permissões do usuário são as mesmas do sistema web — menus e ações aparecem conforme o perfil. A câmera é usada para fotos
do diário de obra e anexos. Adicione `https://localhost` e `capacitor://localhost` em `CORS_ORIGINS`.

---

## 5. Integrações

| Integração | Onde configurar | Observações |
|---|---|---|
| **PNCP** | — (API pública) | Licitações › Buscar no PNCP: propostas abertas / publicadas, filtros por UF, modalidade e palavras-chave, buscas salvas e importação com um clique. |
| **OpenRouter** | Configurações › Integrações | Assistente IA e "Redigir com IA" nos documentos; qualquer modelo do OpenRouter. |
| **Documenso** | Configurações › Integrações | URL da sua instância (ZimaOS) + API token. Documento emitido › *Enviar p/ assinatura*. Webhook opcional em `/api/webhooks/documenso` com o cabeçalho `X-Documenso-Secret`. |
| **S3** | Configurações › Backup | Ver seção 2. |

---

## 6. Documentos, timbrado e variáveis

- Configurações › **Papel timbrado**: envie um **PDF A4** (1ª página e, opcionalmente, 2ª página de continuação) ou imagem A4;
  defina margens (mm), fonte, entrelinha e numeração de páginas. O conteúdo respeita as margens e é sobreposto ao timbrado.
- Documentos › **Modelos**: editor visual (ou HTML) com seletor de variáveis. Exemplos:
  `{{ empresa.razao_social }}`, `{{ obra.valor_contrato|moeda }}`, `{{ medicao.valor_periodo|extenso }}`,
  `{{ hoje|data_extenso }}`, `{{ documento.numero }}`, `{{ var.assunto }}` (variável livre do documento).
- Funções prontas: `{{ tabela_medicao(medicao) }}`, `{{ tabela_orcamento(orcamento) }}`, `{{ tabela_diario(diario) }}`,
  `{{ assinatura(nome, cargo) }}`, `{{ quebra_pagina() }}`.
- Fluxo: **rascunho → emitir** (congela os valores, gera PDF com hash SHA-256 auditado e numeração anual por tipo) **→ assinatura**.

---

## 7. Desenvolvimento

```bash
# Banco local
docker run -d --name pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine
# API
cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt
cp .env.dev.example .env    # ajuste DATABASE_URL
alembic upgrade head && python -m app.seed && uvicorn app.main:app --reload
pytest                     # testes (usa o banco gestoreng_test)
# Web
cd frontend && npm install && npm run dev    # http://localhost:5173 (proxy /api → :8000)
```

Arquitetura e como criar novos módulos: [docs/MODULOS.md](docs/MODULOS.md).
