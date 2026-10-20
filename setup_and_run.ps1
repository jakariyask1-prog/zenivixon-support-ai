# ==============================================================================
# ZENIVIXON Setup & Launch Script
# Automated environment initialization for Windows
# ==============================================================================

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   ZENIVIXON Support AI - Setup & Launch   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check Python
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd -or $pythonCmd.Source -like "*WindowsApps*") {
    Write-Host "[!] Python is not installed. Installing Python 3.11 via winget..." -ForegroundColor Yellow
    winget install --id Python.Python.3.11 -s winget --silent --accept-package-agreements --accept-source-agreements
    Write-Host "[+] Python installation completed. Please restart your PowerShell terminal if python is not immediately recognized." -ForegroundColor Green
} else {
    Write-Host "[OK] Python detected: $($pythonCmd.Source)" -ForegroundColor Green
}

# 2. Check Node.js
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "[!] Node.js is not installed. Installing Node.js LTS via winget..." -ForegroundColor Yellow
    winget install --id OpenJS.NodeJS.LTS -s winget --silent --accept-package-agreements --accept-source-agreements
    Write-Host "[+] Node.js installation completed. Please restart your PowerShell terminal if node is not immediately recognized." -ForegroundColor Green
} else {
    Write-Host "[OK] Node.js detected: $($nodeCmd.Source)" -ForegroundColor Green
}

# 3. Setup Backend Virtual Environment
if (-not (Test-Path "backend\.venv")) {
    Write-Host "`n[*] Creating backend virtual environment (.venv)..." -ForegroundColor Cyan
    python -m venv backend\.venv
    Write-Host "[*] Installing backend dependencies..." -ForegroundColor Cyan
    & "backend\.venv\Scripts\pip.exe" install --upgrade pip
    & "backend\.venv\Scripts\pip.exe" install -r backend\requirements.txt
    Write-Host "[OK] Backend dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "[OK] Backend .venv is ready." -ForegroundColor Green
}

# 4. Setup Frontend Dependencies
if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "`n[*] Installing frontend npm dependencies..." -ForegroundColor Cyan
    Push-Location frontend
    npm install
    Pop-Location
    Write-Host "[OK] Frontend dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "[OK] Frontend node_modules ready." -ForegroundColor Green
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "  To launch ZENIVIXON:" -ForegroundColor Cyan
Write-Host "  1. Backend API:  cd backend; .venv\Scripts\uvicorn.exe main:app --reload --port 8000" -ForegroundColor White
Write-Host "  2. Frontend UI:  cd frontend; npm run dev" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Cyan
