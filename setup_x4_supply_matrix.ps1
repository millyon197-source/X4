.SYNOPSIS
    Installs required modules, builds, and executes the X4 Supply Matrix application.
.DESCRIPTION
    Automates the steps outlined in Installation.md:
    1. Verifies/Installs Node.js & npm environment.
    2. Configures process execution policy.
    3. Installs project dependencies (Vite, Rollup, etc.) via npm.
    4. Executes the production build (npm run build).
    5. Launches the local development server (npm run dev) or preview server.
.PARAMETER Mode
    Server mode to launch after build: 'dev' (default) or 'preview'.
.PARAMETER BuildOnly
    If specified, builds the application and exits without starting the server.
.PARAMETER Clean
    If specified, deletes existing node_modules and dist before a clean reinstall.
.PARAMETER Port
    Optional custom port to bind Vite to (defaults to 5173).
.EXAMPLE
    .\setup_x4_supply_matrix.ps1
.EXAMPLE
    .\setup_x4_supply_matrix.ps1 -BuildOnly
.EXAMPLE
    .\setup_x4_supply_matrix.ps1 -Clean -Mode dev
#>

[CmdletBinding()]
param (
    [ValidateSet('dev', 'preview')]
    [string]$Mode = 'dev',

    [switch]$BuildOnly,
    [switch]$Clean,
    [int]$Port = 0
)

# -------------------------------------------------------------
# 0. Setup Execution Environment & Working Directory
# -------------------------------------------------------------
$ErrorActionPreference = 'Stop'

# Ensure process execution policy permits script execution
try {
    $currentPolicy = Get-ExecutionPolicy -Scope Process
    if ($currentPolicy -ne 'Bypass' -and $currentPolicy -ne 'RemoteSigned' -and $currentPolicy -ne 'Unrestricted') {
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned -Force
    }
} catch {
    Write-Warning "Could not update Process ExecutionPolicy: $_"
}

# Ensure working directory is the script's directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if ($ScriptDir) {
    Set-Location -Path $ScriptDir
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   X4 Supply Matrix: Setup, Build & Launch Utility   " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Working Directory: $PWD`n" -ForegroundColor DarkGray

# -------------------------------------------------------------
# 1. Verify Node.js & npm Installation
# -------------------------------------------------------------
Write-Host "[1/4] Checking Node.js and npm environment..." -ForegroundColor Yellow

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$npmCmd  = Get-Command npm -ErrorAction SilentlyContinue

if (-not $nodeCmd) {
    Write-Warning "Node.js was not detected on this system."
    $wingetCmd = Get-Command winget -ErrorAction SilentlyContinue
    if ($wingetCmd) {
        $response = Read-Host "Would you like to install Node.js LTS via winget now? (Y/N)"
        if ($response -match '^[Yy]') {
            Write-Host "Installing Node.js LTS via winget..." -ForegroundColor Green
            & winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
            # Refresh PATH in current process
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
            $npmCmd  = Get-Command npm -ErrorAction SilentlyContinue
        }
    }
    
    if (-not $nodeCmd) {
        Write-Error "Node.js is required. Please install Node.js 18+ from https://nodejs.org/ and re-run this script."
        exit 1
    }
}

$nodeVersion = (& node -v).Trim()
$npmVersion  = (& npm -v).Trim()
Write-Host "  -> Node.js version: $nodeVersion" -ForegroundColor Green
Write-Host "  -> npm version:     $npmVersion" -ForegroundColor Green

# -------------------------------------------------------------
# 2. Install / Restore npm Dependencies (Vite & Modules)
# -------------------------------------------------------------
Write-Host "`n[2/4] Installing required project modules..." -ForegroundColor Yellow

if ($Clean) {
    Write-Host "  Cleaning existing node_modules and dist folders..." -ForegroundColor DarkYellow
    if (Test-Path "node_modules") { Remove-Item -Recurse -Force "node_modules" }
    if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
    if (Test-Path "package-lock.json") { Remove-Item -Force "package-lock.json" }
}

if (-not (Test-Path "package.json")) {
    Write-Error "package.json not found in $PWD. Please run this script from the project root."
    exit 1
}

# Run npm install
Write-Host "  Running 'npm install'..." -ForegroundColor DarkGray
& npm install

if ($LASTEXITCODE -ne 0) {
    Write-Error "npm install encountered an error (exit code $LASTEXITCODE)."
    exit $LASTEXITCODE
}
Write-Host "  -> Modules installed successfully." -ForegroundColor Green

# -------------------------------------------------------------
# 3. Build Application for Production
# -------------------------------------------------------------
Write-Host "`n[3/4] Building X4 Vite Explorer production assets..." -ForegroundColor Yellow

& npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Error "npm run build failed (exit code $LASTEXITCODE)."
    exit $LASTEXITCODE
}

if (Test-Path "dist/index.html") {
    $distFiles = Get-ChildItem -Path "dist" -Recurse -File
    $totalSize = ($distFiles | Measure-Object -Property Length -Sum).Sum / 1KB
    Write-Host "  -> Build verified! Generated $($distFiles.Count) files ($([Math]::Round($totalSize, 1)) KB) in ./dist" -ForegroundColor Green
} else {
    Write-Warning "Build completed, but dist/index.html was not found."
}

# -------------------------------------------------------------
# 4. Execute / Launch Server
# -------------------------------------------------------------
if ($BuildOnly) {
    Write-Host "`n[4/4] -BuildOnly flag specified. Build complete, exiting." -ForegroundColor Cyan
    exit 0
}

Write-Host "`n[4/4] Starting X4 Vite Explorer ($Mode server)..." -ForegroundColor Yellow

$portArg = @()
if ($Port -gt 0) {
    $portArg = @("--port", $Port.ToString())
}

if ($Mode -eq 'preview') {
    Write-Host "  Launching production preview server..." -ForegroundColor Green
    & npm run preview -- @portArg
} else {
    Write-Host "  Launching Vite development server..." -ForegroundColor Green
    & npm run dev -- @portArg
}
