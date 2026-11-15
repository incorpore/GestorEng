// Ajustes no projeto Android gerado pelo Capacitor (executado no CI após `cap add android`).
import fs from 'node:fs'

const manifest = 'android/app/src/main/AndroidManifest.xml'
let m = fs.readFileSync(manifest, 'utf8')
const perms = ['android.permission.CAMERA', 'android.permission.ACCESS_NETWORK_STATE']
for (const p of perms) {
  if (!m.includes(p)) m = m.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`)
}
if (!m.includes('android.hardware.camera')) m = m.replace('</manifest>', '    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>')
// Sem backup automático dos dados do app (tokens) para a nuvem do Google
m = m.replace('android:allowBackup="true"', 'android:allowBackup="false" android:fullBackupContent="false" android:dataExtractionRules="@xml/data_extraction_rules"')
// Permite servidor HTTP na rede local (ex.: ZimaOS em http://192.168.x.x). Prefira HTTPS em produção.
if (!m.includes('usesCleartextTraffic')) m = m.replace('<application', '<application android:usesCleartextTraffic="true"')
fs.writeFileSync(manifest, m)
fs.mkdirSync('android/app/src/main/res/xml', { recursive: true })
fs.writeFileSync('android/app/src/main/res/xml/data_extraction_rules.xml', `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup><exclude domain="root" /><exclude domain="sharedpref" /><exclude domain="database" /><exclude domain="file" /></cloud-backup>
  <device-transfer><exclude domain="root" /><exclude domain="sharedpref" /><exclude domain="database" /><exclude domain="file" /></device-transfer>
</data-extraction-rules>
`)

const gradle = 'android/app/build.gradle'
let g = fs.readFileSync(gradle, 'utf8')
const code = process.env.VERSION_CODE || '1'
const name = process.env.VERSION_NAME || '1.0.0'
g = g.replace(/versionCode \d+/, `versionCode ${code}`).replace(/versionName "[^"]*"/, `versionName "${name}"`)
fs.writeFileSync(gradle, g)
console.log(`Android ajustado: versão ${name} (${code})`)
