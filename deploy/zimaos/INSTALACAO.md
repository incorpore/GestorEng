---
title: "GestorEng no ZimaOS — Guia de Instalação"
subtitle: "Velmont · banco interno ou externo · passo a passo"
lang: pt-BR
---

# Antes de começar

## Qual arquivo usar

| Arquivo | Quando usar | O que sobe |
|---|---|---|
| `banco-interno.yml` | Instalação nova e independente (**recomendado** se você não tem um Postgres dedicado) | PostgreSQL 16, Redis, API, worker e web |
| `banco-externo.yml` | Você **já tem** PostgreSQL (13 a 18) e/ou Redis rodando na rede | API, worker e web |

Os dois estão em `deploy/zimaos/` no repositório. Em ambos você edita **somente o bloco CONFIGURAÇÃO** no topo do arquivo.

## O que você vai precisar

- ZimaOS com acesso ao **terminal**: pelo painel (Configurações > Terminal) ou por SSH
  (`ssh SEU_USUARIO@IP-DO-ZIMAOS`).
- Uma conta do GitHub com acesso ao repositório `incorpore/GestorEng` (o repositório é **privado**).
- Cerca de 2 GB livres de disco.

> **Convenção deste guia:** `IP-DO-ZIMAOS` é o endereço do seu servidor (ex.: `192.168.3.100`). Comandos que começam com
> `sudo` são executados **no terminal do ZimaOS**. Comandos com `docker exec` executam algo **dentro de um container**.

# Passo 1 — Liberar o download das imagens (repositório privado)

Como o repositório é privado, as imagens `ghcr.io/incorpore/gestoreng-api` e `gestoreng-web` também são privadas.
O ZimaOS precisa de um **token do GitHub** para baixá-las.

**1.1 Criar o token (no navegador):**

1. GitHub > clique na sua foto > **Settings** > **Developer settings** > **Personal access tokens** > **Tokens (classic)**.
2. **Generate new token (classic)**.
3. *Note*: `ZimaOS GestorEng` · *Expiration*: o prazo que preferir (anote para renovar).
4. Marque **somente** `read:packages`.
5. **Generate token** e copie o valor (começa com `ghp_`). Ele aparece uma única vez.

**1.2 Fazer login no ZimaOS (terminal):**

```bash
echo "ghp_SEU_TOKEN" | sudo docker login ghcr.io -u SEU_USUARIO_GITHUB --password-stdin
```

Deve aparecer `Login Succeeded`. O login fica salvo; só repita se o token expirar.

**1.3 Baixar as imagens:**

```bash
sudo docker pull ghcr.io/incorpore/gestoreng-api:latest
sudo docker pull ghcr.io/incorpore/gestoreng-web:latest
```

**Alternativa — tornar somente as imagens públicas** (o repositório e o código no GitHub continuam privados; o ZimaOS
baixa sem login, e os passos 1.1 e 1.2 deixam de ser necessários):

1. GitHub > organização/perfil **incorpore** > aba **Packages** > **gestoreng-api**.
2. **Package settings** (lateral direita) > *Danger Zone* > **Change visibility** > **Public** > digite o nome para confirmar.
3. Repita para **gestoreng-web**.

Se a opção *Public* estiver bloqueada (conta de organização): *Settings* da organização > **Packages** > em
*Package creation*, permita pacotes **Public**.

> Com a imagem pública, qualquer pessoa pode baixá-la e ler o código do sistema que vai dentro dela. Nenhuma senha
> ou chave fica na imagem (elas ficam só no seu arquivo `.yml`), mas, se o código for sigiloso, mantenha as imagens
> privadas e use o login dos passos 1.1 e 1.2.

> **Erro `lookup ghcr.1panel.live: no such host`?** O Docker do servidor está usando um espelho que saiu do ar.
> Veja a seção *Problemas comuns* no final e repita o 1.3.

# Passo 2 — Criar as pastas de dados

```bash
sudo mkdir -p /media/URSUS/AppData/GestorEng/storage
sudo chown -R 10001:10001 /media/URSUS/AppData/GestorEng/storage
```

Somente para **banco interno**, crie também a pasta do PostgreSQL (o próprio Postgres ajusta as permissões):

```bash
sudo mkdir -p /media/URSUS/AppData/GestorEng/postgres
```

> Se quiser outro local (outro disco, NAS montado), troque o caminho `/media/URSUS/AppData/GestorEng` em **todas** as
> linhas `source:` do arquivo `.yml`.

# Passo 3 — Gerar as chaves secretas

Execute **duas vezes** e guarde os dois resultados em local seguro (gerenciador de senhas):

```bash
openssl rand -hex 32
```

- O primeiro valor será a `SECRET_KEY`.
- O segundo será a `ENCRYPTION_KEY`.

> **Atenção:** a `ENCRYPTION_KEY` protege as chaves do OpenRouter, Documenso e do backup S3 gravadas no banco.
> Se ela for perdida ou trocada, será preciso cadastrar essas integrações novamente. **Não troque depois.**

# Passo 4 — Preparar o banco externo (somente `banco-externo.yml`)

Pule este passo se for usar o banco interno.

**4.1 Criar usuário e banco no PostgreSQL.** Descubra o nome do container do seu Postgres e entre nele:

```bash
sudo docker ps --format '{{.Names}}  {{.Image}}' | grep -i postgres
sudo docker exec -it NOME_DO_CONTAINER_POSTGRES psql -U postgres
```

Dentro do `psql`, execute (troque a senha):

```sql
CREATE USER gestoreng WITH PASSWORD 'SUA_SENHA_DO_BANCO';
CREATE DATABASE gestoreng OWNER gestoreng;
\q
```

> Use nomes **em minúsculas** (`gestoreng`). Se você escrever `GestorEng` sem aspas, o PostgreSQL grava como
> `gestoreng` e a conexão com o nome em maiúsculas falha.

**4.2 Testar se o servidor responde** (a partir do ZimaOS):

```bash
sudo docker run --rm postgres:16-alpine pg_isready -h 192.168.3.100 -p 5432
# esperado: 192.168.3.100:5432 - accepting connections
```

Se usar o **Redis externo**, teste também:

```bash
sudo docker run --rm redis:7-alpine redis-cli -h 192.168.3.100 -p 6379 -a 'SENHA_DO_REDIS' --no-auth-warning ping
# esperado: PONG
```

Se algum teste falhar, verifique se a porta está publicada no container do banco (`ports: 5432:5432` / `6379:6379`)
e se o firewall permite a conexão.

# Passo 5 — Preencher o arquivo de instalação

Abra o arquivo escolhido (`banco-interno.yml` ou `banco-externo.yml`) e altere **apenas o bloco CONFIGURAÇÃO**:

| Variável | O que colocar |
|---|---|
| `POSTGRES_PASSWORD` | Senha do banco (interno: será criada agora; externo: a do passo 4.1) |
| `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER` | Só no externo: endereço, banco e usuário do passo 4 |
| `REDIS_PASSWORD` | Senha do Redis (interno: escolha uma; externo: a existente) |
| `REDIS_PREFIX` | Prefixo das chaves no Redis (ex.: `GestorEng_`) |
| `SECRET_KEY` / `ENCRYPTION_KEY` | Os dois valores do passo 3 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seu acesso inicial (10+ caracteres, misturando maiúsculas, minúsculas, números/símbolos) |
| `COOKIE_SECURE` | `"false"` acessando por `http://IP:8917`; `"true"` se usar HTTPS |
| `CORS_ORIGINS` | Troque `192.168.3.100` pelo IP do ZimaOS (e acrescente seu domínio, se tiver) |
| `MAX_UPLOAD_MB` | Tamanho máximo de upload; mantenha `MAX_BODY` do serviço `web` igual (ex.: `50` e `50m`) |

As senhas podem conter **qualquer caractere** — o sistema monta as URLs de conexão e codifica tudo sozinho.

# Passo 6 — Instalar no ZimaOS

**Opção A — pelo painel (recomendado):**

1. Abra o painel do ZimaOS > **App Store**.
2. Clique em **+** (canto superior) > **Install a customized app** (*Instalar app personalizado*).
3. Clique em **Import** (ícone no canto superior direito da janela) > aba **Docker Compose**.
4. Cole o conteúdo **inteiro** do arquivo `.yml` já preenchido > **Submit**.
5. Confira os dados exibidos e clique em **Install**.

**Opção B — pelo terminal:**

```bash
sudo mkdir -p /media/URSUS/AppData/GestorEng/compose
sudo nano /media/URSUS/AppData/GestorEng/compose/docker-compose.yml   # cole o .yml preenchido, Ctrl+O, Enter, Ctrl+X
cd /media/URSUS/AppData/GestorEng/compose
sudo docker compose up -d
```

> Na opção B o app não aparece com ícone no painel da mesma forma; prefira a opção A.

# Passo 7 — Conferir se está tudo funcionando

**7.1 Acompanhar a inicialização da API** (a primeira vez leva até 1 minuto, pois cria as tabelas):

```bash
sudo docker logs -f gestoreng-api
# aguarde: "Application startup complete" (Ctrl+C para sair)
```

**7.2 Diagnóstico completo** (banco, Redis, pasta de arquivos e backup):

```bash
sudo docker exec gestoreng-api python -m app.manage verificar
```

Saída esperada: linhas com `✓` para PostgreSQL, Redis, pasta de arquivos e `pg_dump`.

**7.3 Acessar:** `http://IP-DO-ZIMAOS:8917` e entrar com `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

**7.4 Primeiras configurações no sistema:**

1. **Minha conta** (canto superior direito) > ative a **verificação em duas etapas**.
2. **Configurações > Empresa**: dados, logo e cor da marca.
3. **Configurações > Papel timbrado**: envie o PDF/imagem A4 e ajuste as margens.
4. **Configurações > Integrações**: OpenRouter e Documenso.
5. **Configurações > Backup**: bucket S3 e horário (fortemente recomendado).
6. **Usuários e acesso**: crie os usuários e atribua perfis.

# Comandos de manutenção (terminal do container)

Todos são executados a partir do terminal do ZimaOS com `sudo docker exec -it gestoreng-api ...`:

| Para... | Comando |
|---|---|
| Ver a ajuda | `sudo docker exec -it gestoreng-api python -m app.manage` |
| Listar usuários | `sudo docker exec -it gestoreng-api python -m app.manage usuarios` |
| Criar outro administrador | `sudo docker exec -it gestoreng-api python -m app.manage criar-admin email@velmont.com.br Nome Completo` |
| Redefinir senha (esqueci a senha) | `sudo docker exec -it gestoreng-api python -m app.manage senha email@velmont.com.br` |
| Desbloquear usuário | `sudo docker exec -it gestoreng-api python -m app.manage desbloquear email@velmont.com.br` |
| Remover 2FA (perdeu o celular) | `sudo docker exec -it gestoreng-api python -m app.manage remover-2fa email@velmont.com.br` |
| Encerrar sessões de um usuário | `sudo docker exec -it gestoreng-api python -m app.manage sair-todos email@velmont.com.br` |
| Diagnóstico | `sudo docker exec -it gestoreng-api python -m app.manage verificar` |
| Gerar nova chave | `sudo docker exec -it gestoreng-api python -m app.manage gerar-chave` |
| Executar backup agora | `sudo docker exec -it gestoreng-api ./docker-entrypoint.sh backup executar` |
| Listar backups no S3 | `sudo docker exec -it gestoreng-api ./docker-entrypoint.sh backup listar` |

Os comandos que pedem senha a solicitam de forma oculta (não aparece no histórico do terminal).

**Acesso direto ao banco interno** (consultas manuais):

```bash
sudo docker exec -it gestoreng-db psql -U gestoreng -d gestoreng
```

# Alterar variáveis depois da instalação

**Pelo painel:** ícone do GestorEng > menu (⋮) > **Settings** (*Configurações*) > edite o YAML > **Save**.
O ZimaOS recria os containers automaticamente.

**Pelo terminal (se instalou pela opção B):** edite o arquivo e rode `sudo docker compose up -d` na pasta dele.

Efeito de cada alteração:

| Variável | Pode trocar? | Observação |
|---|---|---|
| `COOKIE_SECURE`, `CORS_ORIGINS`, `TZ`, `WEB_CONCURRENCY`, `REDIS_PREFIX` | Sim | Basta salvar. |
| `MAX_UPLOAD_MB` + `MAX_BODY` | Sim | Altere **os dois** juntos. |
| Porta (`8917:8080`) | Sim | Troque o número da esquerda e também `port_map` no fim do arquivo e o IP:porta em `CORS_ORIGINS`. |
| `SECRET_KEY` | Sim | Todos os usuários serão desconectados (fazem login de novo). |
| `ENCRYPTION_KEY` | **Não** | Se trocar, recadastre OpenRouter, Documenso e o backup S3. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Sem efeito | Só valem na 1ª instalação. Use os comandos `criar-admin` / `senha`. |
| `REDIS_PASSWORD` (interno) | Sim | Basta salvar. |
| `POSTGRES_PASSWORD` (interno) | Sim, em 2 etapas | Veja abaixo. |
| `POSTGRES_PASSWORD` (externo) | Sim, em 2 etapas | Troque primeiro no seu PostgreSQL, depois no arquivo. |
| Pastas (`source:`) | Com cuidado | Pare o app, **copie** os dados para a nova pasta, ajuste o `chown`, altere o arquivo. |

**Trocar a senha do banco interno** (a variável só é lida na criação do banco):

```bash
sudo docker exec -it gestoreng-db psql -U gestoreng -d gestoreng -c "ALTER USER gestoreng PASSWORD 'NOVA_SENHA';"
```

Depois altere `POSTGRES_PASSWORD` no arquivo para `NOVA_SENHA` e salve.

# Atualizar o GestorEng para uma nova versão

```bash
sudo docker pull ghcr.io/incorpore/gestoreng-api:latest
sudo docker pull ghcr.io/incorpore/gestoreng-web:latest
```

Depois, no painel: ícone do GestorEng > **Restart** não basta — use **Settings > Save** (recria os containers com as
imagens novas). Pelo terminal: `sudo docker compose up -d` na pasta do arquivo. As atualizações do banco (migrações) são
aplicadas automaticamente na inicialização da API. Faça um backup antes de atualizar.

# Backup e restauração

**Backup automático (recomendado):** configure em *Configurações > Backup* (S3, MinIO, Backblaze, Cloudflare R2...).
Inclui banco e arquivos, roda todo dia no horário escolhido e apaga os antigos conforme a retenção.

**Backup manual extra do banco interno** (arquivo na pasta do app):

```bash
sudo docker exec gestoreng-db pg_dump -U gestoreng -Fc gestoreng | sudo tee /media/URSUS/AppData/GestorEng/manual-$(date +%F).dump > /dev/null
```

**Restaurar um backup do S3** (sobrescreve os dados atuais):

```bash
sudo docker stop gestoreng-web gestoreng-worker
sudo docker exec -it gestoreng-api ./docker-entrypoint.sh backup listar
sudo docker exec -it gestoreng-api ./docker-entrypoint.sh backup restaurar gestoreng/gestoreng-AAAAMMDD-HHMMSS.tar.gz
sudo docker restart gestoreng-api && sudo docker start gestoreng-worker gestoreng-web
```

# Problemas comuns

**`lookup ghcr.1panel.live: no such host`** — espelho de registro inválido no Docker.
No 1Panel: *Contêineres > Configuração > Espelhos de registro*, apague o espelho e salve. Manualmente:

```bash
sudo cat /etc/docker/daemon.json          # localize "registry-mirrors"
sudo nano /etc/docker/daemon.json         # remova o endereço problemático
sudo systemctl restart docker
```

**`unauthorized` / `denied` ao baixar a imagem** — faça (ou renove) o login do passo 1.2. Confira se o token tem
`read:packages` e se sua conta tem acesso ao repositório.

**`password authentication failed for user`** — senha ou usuário diferentes do banco. Confira maiúsculas/minúsculas
(passo 4.1) e, no banco interno, lembre que `POSTGRES_PASSWORD` só vale na primeira criação.

**`connection refused` / `could not connect`** (banco externo) — refaça os testes do passo 4.2.

**Pasta de arquivos sem permissão** (aparece no `verificar` ou ao anexar arquivos):
`sudo chown -R 10001:10001 /media/URSUS/AppData/GestorEng/storage`

**Sou desconectado ao recarregar a página** — `COOKIE_SECURE` está `"true"` mas o acesso é por `http://`.
Use `"false"` ou configure HTTPS.

**Upload de arquivo falha** — aumente `MAX_UPLOAD_MB` e `MAX_BODY` (iguais).

**Esqueci a senha do administrador** — `sudo docker exec -it gestoreng-api python -m app.manage senha SEU_EMAIL`.

**Worker mostrando "Aguardando migrações..."** — normal nos primeiros segundos; se persistir, veja
`sudo docker logs gestoreng-api`.

**Porta 8917 já em uso** — troque por outra livre (veja a tabela de variáveis).

**Ver logs de qualquer parte:**

```bash
sudo docker logs --tail 100 gestoreng-api
sudo docker logs --tail 100 gestoreng-worker
sudo docker logs --tail 100 gestoreng-web
sudo docker logs --tail 100 gestoreng-db      # banco interno
```

# Acesso pelo celular e HTTPS (opcional)

- **App Android:** no primeiro uso informe `http://IP-DO-ZIMAOS:8917` (na rede da empresa) ou o seu domínio HTTPS.
- **HTTPS / acesso externo:** coloque o GestorEng atrás do proxy que você já usa (Nginx Proxy Manager, Cloudflare
  Tunnel, Traefik) apontando para `IP-DO-ZIMAOS:8917`. Depois ajuste `COOKIE_SECURE: "true"` e inclua o domínio em
  `CORS_ORIGINS` (ex.: `https://gestor.velmont.com.br`).
