"""Estrutura das seções do diário de obra."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.core.schemas import In, Out

CONDICAO = Literal["bom", "parcialmente_nublado", "nublado", "garoa", "chuvoso", "tempestade", "impraticavel"]
VENTO = Literal["sem_vento", "fraco", "moderado", "forte"]
TRABALHO = Literal["praticavel", "parcial", "impraticavel"]


class ClimaPeriodo(BaseModel):
    condicao: CONDICAO | None = None
    temp_min: float | None = Field(None, ge=-30, le=60)
    temp_max: float | None = Field(None, ge=-30, le=60)
    umidade: float | None = Field(None, ge=0, le=100)
    vento: VENTO | None = None
    condicao_trabalho: TRABALHO | None = None


class ClimaDetalhe(BaseModel):
    manha: ClimaPeriodo | None = None
    tarde: ClimaPeriodo | None = None
    noite: ClimaPeriodo | None = None


class Equipe(BaseModel):
    """Membro da equipe (funcionário próprio ou terceiro)."""

    funcionario_id: int | None = None
    nome: str | None = Field(None, max_length=150)
    funcao: str | None = Field(None, max_length=100)
    horas: float | None = Field(None, ge=0, le=24)
    quantidade: int = Field(1, ge=0, le=10000)
    empresa: str | None = Field("propria", max_length=100)

    @model_validator(mode="after")
    def _algum(self):
        if not (self.nome or self.funcao):
            raise ValueError("Informe o nome ou a função")
        return self


class Maquina(BaseModel):
    veiculo_id: int | None = None
    descricao: str = Field(max_length=200)
    quantidade: int = Field(1, ge=0, le=10000)
    horas: float | None = Field(None, ge=0, le=24)


class Material(BaseModel):
    item_id: int | None = None
    descricao: str = Field(max_length=200)
    quantidade: float | None = Field(None, ge=0)
    unidade: str | None = Field(None, max_length=20)
    observacao: str | None = Field(None, max_length=300)


class ServicoDia(BaseModel):
    servico_id: int | None = None
    descricao: str = Field(max_length=1000)
    local: str | None = Field(None, max_length=200)
    percentual: float | None = Field(None, ge=0, le=100)
    situacao: Literal["iniciada", "em_andamento", "concluida", "paralisada"] | None = None
    observacao: str | None = Field(None, max_length=500)


class Visita(BaseModel):
    visitante: str = Field(max_length=150)
    empresa: str | None = Field(None, max_length=150)
    motivo: str | None = Field(None, max_length=300)


class Ocorrencia(BaseModel):
    descricao: str = Field(max_length=1000)
    tipo: Literal["acidente", "paralisacao", "interferencia", "seguranca", "outro"] = "outro"
    gravidade: Literal["baixa", "media", "alta"] = "baixa"


class Pendencia(BaseModel):
    id: str | None = Field(None, max_length=40)  # identifica a mesma pendência ao longo dos diários
    descricao: str = Field(max_length=1000)
    responsavel: str | None = Field(None, max_length=150)
    prazo: date | None = None
    resolvida: bool = False
    resolvida_em: date | None = None
    origem_data: date | None = None


class Providencia(BaseModel):
    descricao: str = Field(max_length=1000)
    responsavel: str | None = Field(None, max_length=150)
    prazo: date | None = None


class DiarioIn(In):
    obra_id: int
    data: date
    clima_manha: CONDICAO | None = None
    clima_tarde: CONDICAO | None = None
    clima_noite: CONDICAO | None = None
    condicao: TRABALHO = "praticavel"
    temperatura: str | None = Field(None, max_length=20)
    clima_detalhe: ClimaDetalhe | None = None
    clima_atual: dict | None = None
    efetivo: list[Equipe] = []
    equipamentos: list[Maquina] = []
    materiais: list[Material] = []
    atividades: list[ServicoDia] = []
    visitas_lista: list[Visita] = []
    ocorrencias_lista: list[Ocorrencia] = []
    pendencias: list[Pendencia] = []
    providencias: list[Providencia] = []
    materiais_recebidos: str | None = None
    ocorrencias: str | None = None
    visitas: str | None = None
    observacoes: str | None = None
    responsavel: str | None = Field(None, max_length=150)


class DiarioOut(Out, DiarioIn):
    numero: int
    status: str
    obra_nome: str | None = None
    total_efetivo: int = 0
    media_servicos: float | None = None
    pendencias_abertas: int = 0
    fechado_em: datetime | None = None
