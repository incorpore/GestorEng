#!/bin/sh
# Falha com mensagem clara se a configuração do Struvia não foi gerada (ex.: /etc/nginx/conf.d sem permissão de escrita)
if [ ! -f /etc/nginx/conf.d/default.conf ] || ! grep -q "location /api/" /etc/nginx/conf.d/default.conf; then
  echo "Struvia: ERRO — configuração do nginx não foi gerada em /etc/nginx/conf.d." >&2
  echo "Struvia: remova 'read_only' e o tmpfs de /etc/nginx/conf.d do compose, ou use tmpfs com ':mode=1777'." >&2
  exit 1
fi
echo "Struvia: configuração do nginx OK (API em ${API_UPSTREAM})"
