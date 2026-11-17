import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'br.com.velmont.struvia',
  appName: 'Struvia',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
    // Permite acessar servidores locais (ex.: ZimaOS na rede interna via http)
    cleartext: true,
  },
  plugins: {
    StatusBar: { overlaysWebView: false },
  },
}

export default config
