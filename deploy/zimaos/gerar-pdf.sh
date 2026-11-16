#!/bin/sh
# Gera GestorEng-ZimaOS.tex e .pdf a partir do INSTALACAO.md + arquivos .yml (requer pandoc e pdflatex)
set -e
cd "$(dirname "$0")"
{
  cat INSTALACAO.md
  printf '\n\n# Anexo A — banco-interno.yml\n\n> Para instalar, copie do arquivo `deploy/zimaos/banco-interno.yml` do repositório: o PDF quebra linhas longas.\n\n```yaml\n'; cat banco-interno.yml; printf '```\n'
  printf '\n\n# Anexo B — banco-externo.yml\n\n> Para instalar, copie do arquivo `deploy/zimaos/banco-externo.yml` do repositório: o PDF quebra linhas longas.\n\n```yaml\n'; cat banco-externo.yml; printf '```\n'
} > /tmp/gestoreng-guia.md
pandoc /tmp/gestoreng-guia.md -s -o GestorEng-ZimaOS.tex --toc --toc-depth=1 \
  -V geometry:a4paper,margin=2cm -V fontsize=10pt -V documentclass=article \
  -V colorlinks=true -V linkcolor=blue -V urlcolor=blue --highlight-style=tango \
  -H latex/header.tex -V date="$(date +%d/%m/%Y)"
for i in 1 2; do pdflatex -interaction=nonstopmode -halt-on-error -output-directory=/tmp GestorEng-ZimaOS.tex > /tmp/gestoreng-latex.log; done
cp /tmp/GestorEng-ZimaOS.pdf .
echo "Gerado: $(pwd)/GestorEng-ZimaOS.pdf"
