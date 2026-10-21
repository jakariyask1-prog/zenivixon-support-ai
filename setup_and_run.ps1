# ==============================================================================
# ZENIVIXON Setup & Launch Script
# Automated environment initialization for Windows
# ==============================================================================

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   ZENIVIXON Support AI - Setup & Launch   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check Python
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
$pyLauncher = Get-Command py -ErrorAction SilentlyContinue

$hasPython = $false
$pythonExe = "python"

if ($pyLauncher) {
    $hasPython = $true
    $pythonExe = "py"
    Write-Host "[OK] Python launcher detected via py" -ForegroundColor Green
} elseif ($pythonCmd -and $pythonCmd.Source -notlike "*WindowsApps*") {
    $hasPython = $true
    $pythonExe = "python"
    Write-Host "[OK] Python detected: $($pythonCmd.Source)" -ForegroundColor Green
}

if (-not $hasPython) {
    Write-Host "[!] Python is not installed. Installing Python 3.11 via winget..." -ForegroundColor Yellow
    winget install --id Python.Python.3.11 -s winget --silent --accept-package-agreements --accept-source-agreements
    Write-Host "[+] Python installation completed. Please restart your PowerShell terminal if python is not immediately recognized." -ForegroundColor Green
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
$venvPython = "backend\.venv\Scripts\python.exe"
$venvPip = "backend\.venv\Scripts\pip.exe"
$venvValid = $false

if (Test-Path $venvPython) {
    try {
        & $venvPython -c "import sys; sys.exit(0)" 2>$null
        if ($LASTEXITCODE -eq 0) {
            $venvValid = $true
        }
    } catch {
        $venvValid = $false
    }
}

if (-not $venvValid) {
    Write-Host "`n[*] Initializing backend virtual environment (.venv)..." -ForegroundColor Cyan
    if (Test-Path "backend\.venv") {
        Write-Host "[!] Stale or non-functional .venv detected. Rebuilding virtual environment..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force "backend\.venv" -ErrorAction SilentlyContinue
    }
    if ($pythonExe -eq "py") {
        py -m venv backend\.venv
    } else {
        python -m venv backend\.venv
    }
    if (-not (Test-Path $venvPython)) {
        # Fallback to py launcher if default python was windows store stub
        py -m venv backend\.venv
    }
    Write-Host "[*] Installing backend dependencies..." -ForegroundColor Cyan
    & $venvPip install --upgrade pip
    & $venvPip install -r backend\requirements.txt
    Write-Host "[OK] Backend dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "[OK] Backend .venv is healthy and ready." -ForegroundColor Green
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
