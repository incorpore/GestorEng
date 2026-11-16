# syntax=docker/dockerfile:1.7
FROM python:3.13-slim-bookworm AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1

# WeasyPrint (Pango/HarfBuzz), fontes, fuso horário e cliente PostgreSQL mais recente do PGDG
# (pg_dump novo funciona com servidores mais antigos: 13 a 18)
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y --no-install-recommends \
       libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libharfbuzz-subset0 libjpeg62-turbo libopenjp2-7 \
       fonts-liberation fonts-dejavu-core fontconfig postgresql-client tzdata tini \
    && apt-get purge -y gnupg && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

RUN groupadd -g 10001 app && useradd -u 10001 -g app -m -d /home/app -s /usr/sbin/nologin app \
    && mkdir -p /data/storage && chown -R app:app /data
COPY --chown=app:app . .
RUN chmod +x docker-entrypoint.sh

USER app
ENV STORAGE_DIR=/data/storage HOME=/home/app XDG_CACHE_HOME=/tmp/.cache TZ=America/Sao_Paulo
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD curl -fsS http://127.0.0.1:8000/api/health || exit 1
ENTRYPOINT ["/usr/bin/tini", "--", "./docker-entrypoint.sh"]
CMD ["api"]
