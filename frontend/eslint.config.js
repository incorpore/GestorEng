// Regras do padrão de interface do Struvia (veja PADROES.md). Rodam no CI: `npm run lint`.
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

const PADRAO = 'Use o kit de interface (src/components/ui) — veja frontend/PADROES.md.'

export default tseslint.config(
  { ignores: ['dist', 'android', 'node_modules', '*.config.*'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    plugins: { 'react-hooks': reactHooks, '@typescript-eslint': tseslint.plugin },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // ---- diálogos nativos do navegador: fora do visual do sistema e bloqueiam a página
      'no-restricted-globals': ['error',
        { name: 'confirm', message: `Use useConfirm(). ${PADRAO}` },
        { name: 'alert', message: `Use useToast() (notificação) ou um Modal. ${PADRAO}` },
        { name: 'prompt', message: `Use um Modal com campo. ${PADRAO}` },
      ],
      'no-restricted-properties': ['error',
        { object: 'window', property: 'confirm', message: `Use useConfirm(). ${PADRAO}` },
        { object: 'window', property: 'alert', message: `Use useToast(). ${PADRAO}` },
        { object: 'window', property: 'prompt', message: `Use um Modal com campo. ${PADRAO}` },
      ],
      'no-restricted-syntax': ['error',
        // ---- campos crus: usar Select / Textarea (variantes: compacto, codigo)
        { selector: "JSXOpeningElement[name.name='select']", message: `Use <Select> (ou <Select compacto>). ${PADRAO}` },
        { selector: "JSXOpeningElement[name.name='textarea']", message: `Use <Textarea> (variantes: padrao, compacto, codigo). ${PADRAO}` },
        { selector: "JSXOpeningElement[name.name='dialog']", message: `Use <Modal> ou <Overlay>. ${PADRAO}` },
        // ---- sobreposições e camadas: sempre <Overlay>/<Modal> com camada nomeada (drawer, modal, viewer, confirm, toast)
        { selector: 'Literal[value=/\\bfixed inset-0\\b/]', message: `Sobreposição em tela cheia: use <Overlay camada="..."> ou <Modal>. ${PADRAO}` },
        { selector: 'TemplateElement[value.raw=/\\bfixed inset-0\\b/]', message: `Sobreposição em tela cheia: use <Overlay camada="..."> ou <Modal>. ${PADRAO}` },
        { selector: 'Literal[value=/\\bz-\\[\\d+\\]/]', message: 'z-index solto: use as camadas z-drawer, z-modal, z-viewer, z-confirm, z-toast (tailwind.config.js).' },
        { selector: 'TemplateElement[value.raw=/\\bz-\\[\\d+\\]/]', message: 'z-index solto: use as camadas z-drawer, z-modal, z-viewer, z-confirm, z-toast (tailwind.config.js).' },
        // ---- portal só no kit (Overlay/Modal cuidam de Esc, rolagem e camada)
        { selector: "CallExpression[callee.name='createPortal']", message: `Use <Overlay> ou <Modal>. ${PADRAO}` },
      ],
    },
  },
  {
    // o próprio kit e as notificações implementam os elementos básicos
    files: ['src/components/ui/**', 'src/core/toast.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
)
