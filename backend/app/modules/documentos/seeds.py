"""Modelos de documento iniciais (podem ser editados em Documentos > Modelos)."""

OFICIO = """<p style="text-align: right">{{ cidade_emissao }}, {{ hoje|data_extenso }}.</p>
<p><strong>{{ documento.numero }}</strong></p>
<p>À<br><strong>{{ documento.destinatario }}</strong></p>
<p><strong>Assunto:</strong> {{ var.assunto }}</p>
<p><strong>Referência:</strong> {{ obra.nome }} — Contrato nº {{ obra.numero_contrato }}</p>
<p>Prezados Senhores,</p>
<p>Escreva aqui o conteúdo do ofício.</p>
<p>Sem mais para o momento, colocamo-nos à disposição para quaisquer esclarecimentos.</p>
<p>Atenciosamente,</p>
<p></p>
<p style="text-align: center">______________________________________<br><strong>{{ empresa.responsavel }}</strong><br>{{ empresa.cargo_responsavel }}<br>{{ empresa.razao_social }} — CNPJ {{ empresa.cnpj|cpf_cnpj }}</p>"""

BOLETIM = """<h2 style="text-align: center">BOLETIM DE MEDIÇÃO Nº {{ medicao.numero }}</h2>
<table>
<tr><th>Obra</th><td colspan="3">{{ obra.nome }}</td></tr>
<tr><th>Contratante</th><td>{{ cliente.nome }}</td><th>Contrato</th><td>{{ obra.numero_contrato }}</td></tr>
<tr><th>Período</th><td>{{ medicao.periodo_inicio|data }} a {{ medicao.periodo_fim|data }}</td><th>Data</th><td>{{ medicao.data|data }}</td></tr>
<tr><th>Valor do contrato</th><td>{{ obra.valor_total|moeda }}</td><th>Local</th><td>{{ obra.cidade }}/{{ obra.uf }}</td></tr>
</table>
<p></p>
{{ tabela_medicao(medicao) }}
<p><strong>Valor desta medição:</strong> {{ medicao.valor_periodo|moeda }} ({{ medicao.valor_periodo|extenso }}).</p>
<p><strong>Valor acumulado:</strong> {{ medicao.valor_acumulado|moeda }}.</p>
<p></p>
<table style="border: none">
<tr>
<td style="border: none; text-align: center; width: 50%">______________________________<br>{{ obra.responsavel_tecnico }}<br>Responsável técnico — {{ obra.crea_cau }}<br>{{ empresa.razao_social }}</td>
<td style="border: none; text-align: center; width: 50%">______________________________<br>{{ obra.fiscal_contrato }}<br>Fiscal do contrato<br>{{ cliente.nome }}</td>
</tr>
</table>"""

RECIBO = """<h2 style="text-align: center">RECIBO</h2>
<p style="text-align: right"><strong>Valor: {{ var.valor|moeda }}</strong></p>
<p>Recebi(emos) de <strong>{{ empresa.razao_social }}</strong>, inscrita no CNPJ sob o nº {{ empresa.cnpj|cpf_cnpj }}, a importância de <strong>{{ var.valor|moeda }} ({{ var.valor|extenso }})</strong>, referente a {{ var.referente }}.</p>
<p>Para maior clareza, firmo(amos) o presente recibo, dando plena e geral quitação do valor acima.</p>
<p style="text-align: right">{{ cidade_emissao }}, {{ hoje|data_extenso }}.</p>
<p></p>
<p style="text-align: center">______________________________________<br><strong>{{ funcionario.nome }}{{ parceiro.nome }}</strong><br>CPF/CNPJ: {{ funcionario.cpf|cpf_cnpj }}{{ parceiro.documento|cpf_cnpj }}</p>"""

DECLARACAO = """<h2 style="text-align: center">DECLARAÇÃO</h2>
<p>A <strong>{{ empresa.razao_social }}</strong>, inscrita no CNPJ sob o nº {{ empresa.cnpj|cpf_cnpj }}, com sede em {{ empresa.endereco }}, {{ empresa.cidade }}/{{ empresa.uf }}, por intermédio de seu representante legal, <strong>{{ empresa.responsavel }}</strong>, DECLARA, para os devidos fins, que {{ var.texto }}.</p>
<p>Por ser expressão da verdade, firma a presente declaração.</p>
<p style="text-align: right">{{ cidade_emissao }}, {{ hoje|data_extenso }}.</p>
<p></p>
{{ assinatura(empresa.responsavel, empresa.cargo_responsavel, empresa.razao_social) }}"""

ORCAMENTO = """<h2 style="text-align: center">PROPOSTA ORÇAMENTÁRIA Nº {{ orcamento.numero }}</h2>
<p><strong>Cliente:</strong> {{ orcamento.cliente.nome }}<br><strong>Objeto:</strong> {{ orcamento.titulo }}<br><strong>Data:</strong> {{ orcamento.data|data }} — <strong>Validade:</strong> {{ orcamento.validade|data }}<br><strong>Referência de preços:</strong> {{ orcamento.referencia }}</p>
{{ tabela_orcamento(orcamento) }}
<p><strong>Valor global:</strong> {{ orcamento.total|moeda }} ({{ orcamento.total|extenso }}).</p>
<p><strong>Condições:</strong> {{ orcamento.condicoes }}</p>
<p style="text-align: right">{{ cidade_emissao }}, {{ hoje|data_extenso }}.</p>
{{ assinatura(empresa.responsavel, empresa.cargo_responsavel, empresa.razao_social) }}"""

RDO = """<h2 style="text-align: center">RELATÓRIO DIÁRIO DE OBRA Nº {{ diario.numero }}</h2>
<p><strong>Obra:</strong> {{ obra.nome }}<br><strong>Contrato:</strong> {{ obra.numero_contrato }} — <strong>Responsável:</strong> {{ diario.responsavel }}</p>
{{ tabela_diario(diario) }}
<p></p>
{{ assinatura(diario.responsavel, "Responsável pelo registro") }}"""

MODELOS = [
    {"nome": "Ofício padrão", "tipo": "oficio", "entidade": "obra", "conteudo": OFICIO, "prefixo_numero": "Ofício nº"},
    {"nome": "Boletim de medição", "tipo": "boletim_medicao", "entidade": "medicao", "conteudo": BOLETIM,
     "prefixo_numero": "BM", "orientacao": "paisagem",
     "margens": {"margem_superior": 30, "margem_inferior": 20, "margem_esquerda": 15, "margem_direita": 15}},
    {"nome": "Recibo de pagamento", "tipo": "recibo", "entidade": "funcionario", "conteudo": RECIBO, "prefixo_numero": "Recibo nº"},
    {"nome": "Declaração", "tipo": "declaracao", "entidade": None, "conteudo": DECLARACAO, "prefixo_numero": "Declaração nº"},
    {"nome": "Proposta orçamentária", "tipo": "proposta", "entidade": "orcamento", "conteudo": ORCAMENTO, "prefixo_numero": "Proposta nº"},
    {"nome": "Relatório diário de obra (RDO)", "tipo": "relatorio", "entidade": "diario", "conteudo": RDO, "prefixo_numero": "RDO"},
]
