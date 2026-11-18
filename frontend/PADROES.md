# Padrões de interface do Struvia

Toda tela usa o **kit de interface** em `src/components/ui` (importe de `@/components/ui`).
O CI roda `npm run lint` e **reprova** o código que fugir destas regras.

## Componentes

| Preciso de… | Use | Observações |
|---|---|---|
| Aviso rápido ("Salvo", erro de rede) | `const toast = useToast(); toast('Salvo')` / `toast(msg, 'error' \| 'info')` | Canto inferior; some sozinho. Para erros da API: `toast(errMsg(e), 'error')` |
| Confirmar uma ação | `const confirm = useConfirm(); if (await confirm('Excluir?', { title, danger: true, ok: 'Excluir' }))` | Sempre por cima de tudo (até do visualizador de fotos) |
| Pop-up (formulário, detalhes, escolha) | `<Modal open onClose title footer size>` | No celular abre de baixo para cima; Esc fecha só o pop-up do topo |
| Sobreposição em tela cheia (visualizador, menu) | `<Overlay camada="viewer" \| "drawer" onClose>` | Cuida de Esc, rolagem e camada |
| Botões | `<Button variant="primary\|secondary\|ghost\|danger\|success" size icon loading>` e `<IconButton label>` | `IconButton` exige `label` (acessibilidade) |
| Campos | `<Field label required hint>` envolvendo `<Input>`, `<Select>`, `<Textarea>`, `<Toggle>` | `Select compacto`; `Textarea variante="compacto"` (tabelas) ou `"codigo"` (HTML) |
| Listas suspensas de cadastro | `RelationSelect` (com "+" para cadastrar em pop-up) e `ListaSelect` (listas editáveis) | Não crie selects próprios para cadastros |
| Estrutura | `PageHeader`, `Card`, `Tabs`, `Pagination`, `Stat`, `Badge`, `Empty`, `Loading`, `Spinner` | |
| Telas de cadastro | `ResourcePage` / `ResourceForm` com a configuração do módulo | Evita repetir lista, filtros, formulário e permissões |

## Camadas (z-index)

Da mais baixa para a mais alta — definidas em `tailwind.config.js`:

`z-drawer` (menu do celular) < `z-modal` (pop-ups) < `z-viewer` (fotos) < `z-confirm` (confirmações) < `z-toast` (notificações)

Nunca use `z-[número]` nem `fixed inset-0` fora do kit.

## Proibido (o lint bloqueia)

- `confirm()`, `alert()`, `prompt()` do navegador
- `<select>`, `<textarea>`, `<dialog>` crus
- `fixed inset-0`, `z-[n]` e `createPortal` fora de `src/components/ui`

## Organização das telas

- Página = arquivo pequeno que **compõe** componentes; cada parte com responsabilidade própria vai para
  `modules/<módulo>/components/` (ou `src/components/` se for usada por vários módulos).
- Telas carregadas sob demanda (`lazy`) para o site abrir rápido.
- Textos para o usuário em português, curtos e no tom do sistema.
