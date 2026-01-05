# Moneta Desktop - Guia de Desenvolvimento e Build

## Visão Geral

O Moneta agora suporta **versão desktop** usando Electron, além da versão mobile Android via Capacitor. O mesmo código-base é usado para ambas as plataformas, com detecção automática de ambiente.

## Requisitos

- Node.js 18+ e npm
- Windows: Para gerar executável Windows
- macOS: Para gerar executável macOS
- Linux: Para gerar executável Linux

## Desenvolvimento Local

### 1. Modo Web (Vite Dev Server)

```powershell
npm run dev
```

Abre o app em `http://localhost:5173` no navegador.

### 2. Modo Electron (Desktop)

**Opção A: Build + Electron**
```powershell
npm run start
```
Faz build de produção e abre no Electron.

**Opção B: Dev + Electron (Recomendado)**
```powershell
# Terminal 1: Iniciar Vite dev server
npm run dev

# Terminal 2: Iniciar Electron (após Vite iniciar)
npm run electron:dev
```
> [!IMPORTANT]
> Aguarde o Vite dev server iniciar completamente (porta 5173) antes de executar `npm run electron:dev`.

Permite hot-reload durante desenvolvimento.

## Build de Produção

### Windows

```powershell
# Gerar instalador NSIS + versão portátil
npm run package:win
```

**Saída:**
- `release/Moneta-1.0.0-x64.exe` - Instalador NSIS (64-bit)
- `release/Moneta-1.0.0-ia32.exe` - Instalador NSIS (32-bit)
- `release/Moneta-1.0.0-x64-portable.exe` - Versão portátil

### macOS

```powershell
# Gerar DMG + ZIP
npm run package:mac
```

**Saída:**
- `release/Moneta-1.0.0-arm64.dmg` - Instalador DMG (Apple Silicon)
- `release/Moneta-1.0.0-x64.dmg` - Instalador DMG (Intel)
- `release/Moneta-1.0.0-arm64.zip` - Arquivo ZIP

### Linux

```powershell
# Gerar AppImage + DEB
npm run package:linux
```

**Saída:**
- `release/Moneta-1.0.0-x86_64.AppImage` - AppImage
- `release/Moneta-1.0.0-amd64.deb` - Pacote Debian

### Todas as Plataformas

```powershell
npm run package
```

Gera builds para a plataforma atual.

## Build Android (Mobile)

```powershell
npm run android:sync
```

Sincroniza o código web com o projeto Android do Capacitor.

## Estrutura de Arquivos

```
MonetaRemaster02/
├── main.cjs                # Processo principal do Electron
├── preload.cjs             # Script de preload (ponte segura)
├── vite.config.js          # Configuração do Vite
├── package.json            # Configuração do electron-builder
├── build/
│   └── icon.png            # Ícone do app (1024x1024)
├── dist/                   # Build de produção (gerado)
├── release/                # Executáveis (gerado)
└── src/
    └── js/
        └── utils/
            └── platform.js # Detector de plataforma
```

## Detecção de Plataforma

O app detecta automaticamente o ambiente de execução:

```javascript
import Platform from './utils/platform.js';

if (Platform.isElectron) {
    console.log('Rodando no Electron (Desktop)');
}

if (Platform.isCapacitor) {
    console.log('Rodando no Capacitor (Mobile)');
}

if (Platform.isWeb) {
    console.log('Rodando no navegador (Web)');
}
```

## Funcionalidades Cross-Platform

### Haptics (Vibração)
- **Mobile:** Usa Capacitor Haptics API
- **Desktop/Web:** Desabilitado silenciosamente

### Notificações
- **Mobile:** Usa Capacitor LocalNotifications (agendamento)
- **Desktop/Web:** Usa browser Notification API (imediato)

### Armazenamento
- **Todas:** localStorage via StoreService

### Sincronização
- **Todas:** Supabase (online)

## Troubleshooting

### Erro: "Cannot find module 'electron'"

```powershell
npm install
```

### Erro: "VITE_SUPABASE_URL is not defined"

Certifique-se de ter o arquivo `.env` com as variáveis:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

### Build falha no Windows

Execute como Administrador ou desabilite antivírus temporariamente.

### App não abre no Electron

Verifique se o build foi gerado:
```powershell
npm run build
```

Depois execute:
```powershell
npm run electron:dev
```

### Ícone não aparece no executável

Certifique-se de que `build/icon.png` existe e tem 1024x1024 pixels.

## Configuração Avançada

### Alterar Ícone

Substitua `build/icon.png` por um ícone 1024x1024 pixels. O electron-builder converterá automaticamente para os formatos necessários (.ico, .icns).

### Alterar Nome do App

Edite `package.json`:

```json
{
  "name": "seu-app",
  "build": {
    "productName": "Seu App Nome",
    "appId": "com.seudominio.seuapp"
  }
}
```

### Desabilitar Auto-Update

Já está desabilitado por padrão (`"publish": null` no package.json).

## Segurança

- ✅ `contextIsolation: true` - Isolamento de contexto ativado
- ✅ `nodeIntegration: false` - Node.js desabilitado no renderer
- ✅ `sandbox: true` - Sandbox ativado
- ✅ Navegação externa bloqueada (exceto Supabase)
- ✅ Abertura de novas janelas bloqueada

## Próximos Passos

1. **Testar:** Execute `npm run start` e teste todas as funcionalidades
2. **Build:** Gere o executável com `npm run package:win`
3. **Distribuir:** Compartilhe o instalador em `release/`

## Suporte

Para problemas ou dúvidas, consulte:
- [Documentação do Electron](https://www.electronjs.org/docs)
- [Documentação do electron-builder](https://www.electron.build/)
- [Documentação do Vite](https://vitejs.dev/)
