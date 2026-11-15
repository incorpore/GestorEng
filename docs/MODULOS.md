# Arquitetura modular

```
backend/app/
  core/            # núcleo: config, banco, segurança, permissões, CRUD genérico, auditoria, arquivos
  modules/<nome>/  # cada módulo: models.py + module.py (rotas, permissões, entidades de documentos)
  worker.py        # tarefas agendadas (backup)
frontend/src/
  core/            # API, autenticação, permissões, formatação, plataforma (web/Android)
  components/ui/   # biblioteca de componentes
  components/resource/  # telas genéricas de cadastro (lista + filtros + formulário + anexos)
  modules/<nome>/  # telas do módulo, divididas em components/
```

## Criando um módulo (exemplo: "Segurança do Trabalho")

### Backend

`backend/app/modules/sst/models.py`
```python
class Treinamento(TimestampMixin, Base):
    __tablename__ = "treinamentos"
    id: Mapped[int] = mapped_column(primary_key=True)
    funcionario_id: Mapped[int] = mapped_column(ForeignKey("funcionarios.id", ondelete="CASCADE"))
    norma: Mapped[str] = mapped_column(String(20))          # NR-35, NR-18...
    validade: Mapped[date | None] = mapped_column(Date)
```

`backend/app/modules/sst/module.py`
```python
class TreinamentoIn(In):
    funcionario_id: int
    norma: str = Field(max_length=20)
    validade: date | None = None

class TreinamentoOut(Out, TreinamentoIn):
    pass

crud = Crud(Treinamento, TreinamentoIn, TreinamentoOut, perm="sst", entity="treinamento",
            search=["norma"], filters=["funcionario_id", "validade"], order="validade")

module = ModuleDef(key="sst", label="Segurança do trabalho", icon="hard-hat", order=55,
                   routers=[crud.router("/treinamentos")], attachable={"treinamento": "sst"},
                   template_entities={"treinamento": ("Treinamento", Treinamento, "sst.ver")})
module.crud_permissions(label="Segurança do trabalho")
```

O `Crud` já entrega: listagem paginada com busca, filtros (`campo`, `campo__gte`, `__lte`, `__in`), ordenação,
permissões `sst.ver/criar/editar/excluir`, auditoria, escopo por obra (`obra_field`), ocultação de campos sensíveis
(`redact`) e itens filhos (`children`).

Registre em `app/modules/__init__.py` (`MODULES`) e gere a migração:
```bash
alembic revision --autogenerate -m "sst" && alembic upgrade head
```
As novas permissões aparecem automaticamente na tela de perfis; o perfil *Administrador* as recebe no próximo start.

### Frontend

`frontend/src/modules/sst/index.tsx`
```tsx
const cfg: ResourceConfig = {
  endpoint: '/treinamentos', title: 'Treinamentos', singular: 'Treinamento', perm: 'sst', attachEntity: 'treinamento',
  fields: [
    { name: 'funcionario_id', label: 'Funcionário', type: 'relation', relation: { endpoint: '/funcionarios' }, required: true },
    { name: 'norma', label: 'Norma', required: true },
    { name: 'validade', label: 'Validade', type: 'date' },
  ],
  columns: [{ key: 'norma', label: 'Norma', primary: true }, { key: 'validade', label: 'Validade', type: 'date' }],
}
export default {
  key: 'sst', group: 'Gestão',
  nav: [{ label: 'SST', path: '/sst', icon: HardHat, perm: ['sst.ver'] }],
  routes: [{ path: '/sst', element: <ResourcePage cfg={cfg} /> }],
} satisfies FrontModule
```
Adicione em `src/modules/index.ts`. Pronto: menu, tela responsiva (tabela no desktop, cartões no celular), formulário,
anexos com câmera, permissões e ativação/desativação em Configurações › Módulos — também no app Android.

## Convenções

- Páginas grandes são divididas em componentes em `modules/<nome>/components/` (ex.: `documentos/components/DocActions.tsx`).
- Telas são carregadas sob demanda (`lazy`), mantendo o app leve.
- Toda regra de permissão é validada **no backend**; o frontend apenas oculta o que o usuário não pode usar.
