param(
    [string]$Message = ""
)

$ErrorActionPreference = "Continue"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "🚀 POINTLY - DESPLIEGUE AUTOMATICO A GITHUB Y VERCEL" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Mensaje de commit
$Timestamp = Get-Date -Format "dd/MM/yyyy HH:mm"
if (-not $Message -or $Message.Trim() -eq "") {
    $Message = "deploy: actualizacion automatica ($Timestamp)"
}

# 2. Validar compilacion local
Write-Host "`n🔍 1. Validando compilacion con Next.js..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Error en la compilacion. Corrija los errores antes de subir a Vercel." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Compilacion exitosa (0 errores)." -ForegroundColor Green

# 3. Git add
Write-Host "`n📦 2. Agregando archivos a Git..." -ForegroundColor Yellow
git add .

# 4. Git commit
Write-Host "`n✍️ 3. Creando commit: '$Message'..." -ForegroundColor Yellow
git commit -m "$Message" 2>&1 | Out-Null

# 5. Git push
Write-Host "`n⬆️ 4. Subiendo cambios a GitHub (origin/main)..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host "🎉 ¡CAMBIOS SUBIDOS CON EXITO A GITHUB!" -ForegroundColor Green
    Write-Host "📡 Vercel detecta la rama main y actualiza tu web en" -ForegroundColor Green
    Write-Host "   produccion de forma 100% automatica." -ForegroundColor Green
    Write-Host "========================================================`n" -ForegroundColor Green
} else {
    Write-Host "`n❌ Error al subir a GitHub. Verifique su conexion o credenciales." -ForegroundColor Red
    exit 1
}
