<#
.SYNOPSIS
    Installs required modules, builds, and launches the X4 Supply Matrix application and companion backend.
.DESCRIPTION
    Automates setup, dependency management, game mod synchronization, and process orchestration:
    1. Verifies/Installs Node.js & npm environment.
    2. Synchronizes the in-game companion extension (x4_companion_bridge) to X4 install paths.
    3. Cleans conflicting processes on port 3000 (backend) and 5173 (frontend).
    4. Installs project dependencies via npm if missing or if -Clean is specified.
    5. Builds production assets if missing or if -Build / -BuildOnly is specified.
    6. Launches the backend server (node server.js on port 3000) and waits for health readiness.
    7. Launches the frontend UI (Vite dev or preview on port 5173).
    8. Opens the application in the default web browser.
    9. Gracefully shuts down background processes upon exit (Ctrl+C).
.PARAMETER Mode
    Server mode to launch for the frontend: 'dev' (default) or 'preview'.
.PARAMETER BuildOnly
    If specified, builds the application and exits without starting the servers.
.PARAMETER Clean
    If specified, deletes existing node_modules and dist before a clean reinstall.
.PARAMETER NoBuild
    Skips the build step (useful for quick dev startup when dist is already built or not needed).
.PARAMETER NoBrowser
    Do not automatically open the default web browser after startup.
.PARAMETER NoExtensionSync
    Skips synchronizing the x4_companion_bridge mod into X4 extensions directories.
.PARAMETER ServerOnly
    Starts only the companion backend server (port 3000) without launching the Vite UI.
.PARAMETER Port
    Optional custom port to bind Vite to (defaults to 5173).
.PARAMETER BackendPort
    Optional custom port for the backend server (defaults to 3000).
.EXAMPLE
    .\setup_x4_supply_matrix.ps1
.EXAMPLE
    .\setup_x4_supply_matrix.ps1 -Mode dev -NoBrowser
.EXAMPLE
    .\setup_x4_supply_matrix.ps1 -Clean -Mode dev
.EXAMPLE
    .\setup_x4_supply_matrix.ps1 -ServerOnly
#>

[CmdletBinding()]
param (
    [ValidateSet('dev', 'preview')]
    [string]$Mode = 'dev',

    [switch]$BuildOnly,
    [switch]$Clean,
    [switch]$NoBuild,
    [switch]$NoBrowser,
    [switch]$NoExtensionSync,
    [switch]$ServerOnly,
    [int]$Port = 5173,
    [int]$BackendPort = 3000
)

# -------------------------------------------------------------
# 0. Setup Execution Environment & Working Directory
# -------------------------------------------------------------
$ErrorActionPreference = 'Stop'

# Check and configure ExecutionPolicy
try {
    # 1. Ensure current process can execute scripts
    $procPolicy = Get-ExecutionPolicy -Scope Process
    if ($procPolicy -ne 'Bypass' -and $procPolicy -ne 'RemoteSigned' -and $procPolicy -ne 'Unrestricted') {
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned -Force -ErrorAction SilentlyContinue
    }

    # 2. Check persistent CurrentUser policy
    $userPolicy = Get-ExecutionPolicy -Scope CurrentUser
    $effectivePolicy = Get-ExecutionPolicy
    $isPermitted = ($userPolicy -in @('RemoteSigned', 'Unrestricted', 'Bypass')) -or 
                   ($effectivePolicy -in @('RemoteSigned', 'Unrestricted', 'Bypass'))

    if (-not $isPermitted) {
        Write-Host "`n[Security Notice] PowerShell script execution policy is currently '$effectivePolicy' (CurrentUser: '$userPolicy')." -ForegroundColor Yellow
        Write-Host "To allow PowerShell to execute scripts without blocking, CurrentUser policy should be 'RemoteSigned'." -ForegroundColor Yellow
        $response = Read-Host "Would you like to set 'Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser' now? (Y/N)"
        if ($response -match '^[Yy]') {
            Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
            Write-Host "  -> Successfully updated ExecutionPolicy to RemoteSigned for CurrentUser.`n" -ForegroundColor Green
        } else {
            Write-Warning "ExecutionPolicy change was declined. Script execution aborted."
            exit 1
        }
    }
} catch {
    Write-Warning "Could not query or update ExecutionPolicy: $_"
    exit 1
}

# Ensure working directory is the script's directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if ($ScriptDir) {
    Set-Location -Path $ScriptDir
}

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   X4 Supply Matrix: Companion Server & UI Orchestrator           " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "Working Directory : $PWD" -ForegroundColor DarkGray
Write-Host "Target Mode       : $Mode" -ForegroundColor DarkGray
Write-Host "UI Port           : $Port" -ForegroundColor DarkGray
Write-Host "Backend Port      : $BackendPort`n" -ForegroundColor DarkGray

# -------------------------------------------------------------
# Helper Functions
# -------------------------------------------------------------
function Stop-PortProcess {
    param ([int]$TargetPort)
    try {
        # 1. Identify listening sockets (covers IPv4, IPv6, and standard listening states)
        $conns = Get-NetTCPConnection -LocalPort $TargetPort -ErrorAction SilentlyContinue |
            Where-Object { $_.OwningProcess -gt 0 -and ($_.State -eq 'Listen' -or $_.State -eq 2 -or -not $_.State) }
        
        $pidsToKill = [System.Collections.Generic.HashSet[int]]::new()
        if ($conns) {
            foreach ($conn in $conns) {
                [void]$pidsToKill.Add($conn.OwningProcess)
            }
        }

        # 2. If inspecting backend port 3000, also locate any active server.js processes
        if ($TargetPort -eq $BackendPort) {
            $nodeProcs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
                Where-Object { $_.CommandLine -like "*server.js*" }
            if ($nodeProcs) {
                foreach ($np in $nodeProcs) {
                    [void]$pidsToKill.Add($np.ProcessId)
                }
            }
        }

        # 3. Terminate identified processes
        foreach ($procId in $pidsToKill) {
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -ne 'X4') {
                Write-Host "  [Port Cleanup] Freeing port $TargetPort (Terminating PID $($procId): $($proc.ProcessName))..." -ForegroundColor Yellow
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }

        if ($pidsToKill.Count -gt 0) {
            Start-Sleep -Milliseconds 600
        }
    } catch {
        # Fallback silently if permissions or CIM query fail
    }
}

function Test-PortOpen {
    param (
        [string]$HostName = "127.0.0.1",
        [int]$TargetPort = 3000
    )
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    try {
        $asyncResult = $tcpClient.BeginConnect($HostName, $TargetPort, $null, $null)
        $waitSuccess = $asyncResult.AsyncWaitHandle.WaitOne(800, $false)
        if ($waitSuccess -and $tcpClient.Connected) {
            $tcpClient.EndConnect($asyncResult)
            return $true
        }
        return $false
    } catch {
        return $false
    } finally {
        $tcpClient.Close()
        $tcpClient.Dispose()
    }
}

function Sync-X4CompanionExtension {
    $sourceExt = Join-Path $PWD "extensions\x4_companion_bridge"
    if (-not (Test-Path $sourceExt)) {
        Write-Warning "Source extension directory '$sourceExt' not found; skipping mod sync."
        return
    }

    Write-Host "[Mod Sync] Scanning X4 installation paths for companion bridge..." -ForegroundColor Yellow

    $candidatePaths = [System.Collections.Generic.List[string]]::new()

    # 1. Check known Steam paths & libraryfolders.vdf
    $steamKnownPaths = @(
        "C:\SteamLibrary\steamapps\common\X4 Foundations\extensions",
        "D:\Games\Steam\steamapps\common\X4 Foundations\extensions",
        "D:\SteamLibrary\steamapps\common\X4 Foundations\extensions",
        "E:\SteamLibrary\steamapps\common\X4 Foundations\extensions",
        "G:\SteamLibrary\steamapps\common\X4 Foundations\extensions"
    )
    foreach ($p in $steamKnownPaths) {
        $parent = Split-Path -Parent $p
        if (Test-Path $parent) {
            $candidatePaths.Add($p)
        }
    }

    # 2. Check Steam libraryfolders.vdf if present in HKCU
    try {
        $steamKey = Get-ItemProperty "HKCU:\Software\Valve\Steam" -Name "SteamPath" -ErrorAction SilentlyContinue
        if ($steamKey -and $steamKey.SteamPath) {
            $vdfPath = Join-Path $steamKey.SteamPath "steamapps\libraryfolders.vdf"
            if (Test-Path $vdfPath) {
                $vdfContent = Get-Content $vdfPath -Raw -ErrorAction SilentlyContinue
                $matches = [regex]::Matches($vdfContent, '"path"\s+"([^"]+)"')
                foreach ($m in $matches) {
                    $libDir = $m.Groups[1].Value.Replace('\\', '\')
                    $x4Ext = Join-Path $libDir "steamapps\common\X4 Foundations\extensions"
                    $x4Root = Join-Path $libDir "steamapps\common\X4 Foundations"
                    if ((Test-Path $x4Root) -and (-not $candidatePaths.Contains($x4Ext))) {
                        $candidatePaths.Add($x4Ext)
                    }
                }
            }
        }
    } catch {}

    # 3. Check User Documents / OneDrive Documents Egosoft folder
    $docFolders = @(
        "$HOME\Documents\Egosoft\X4\extensions",
        "$HOME\OneDrive\Documents\Egosoft\X4\extensions"
    )
    try {
        $envDoc = [Environment]::GetFolderPath("MyDocuments")
        if ($envDoc) {
            $docFolders += (Join-Path $envDoc "Egosoft\X4\extensions")
        }
    } catch {}

    foreach ($df in $docFolders) {
        $dfParent = Split-Path -Parent $df
        if ((Test-Path $dfParent) -and (-not $candidatePaths.Contains($df))) {
            $candidatePaths.Add($df)
        }
    }

    # Execute synchronization to any detected valid extensions destinations
    $syncedCount = 0
    foreach ($destExtRoot in $candidatePaths) {
        $destExtDir = Join-Path $destExtRoot "x4_companion_bridge"
        try {
            if (-not (Test-Path $destExtRoot)) {
                New-Item -ItemType Directory -Path $destExtRoot -Force | Out-Null
            }
            if (-not (Test-Path $destExtDir)) {
                New-Item -ItemType Directory -Path $destExtDir -Force | Out-Null
            }

            Write-Host "  -> Copying companion extension to: $destExtDir" -ForegroundColor DarkGray
            Copy-Item -Path "$sourceExt\*" -Destination $destExtDir -Recurse -Force
            $syncedCount++
        } catch {
            Write-Warning "Failed syncing to '$destExtDir': $_"
        }
    }

    if ($syncedCount -gt 0) {
        Write-Host "  -> Successfully synchronized companion mod to $syncedCount game directory/directories." -ForegroundColor Green
    } else {
        Write-Host "  -> No active X4 Foundations extensions folders detected; skipping auto-sync." -ForegroundColor DarkGray
    }
}

# -------------------------------------------------------------
# 1. Verify Node.js & npm Installation
# -------------------------------------------------------------
Write-Host "[1/5] Checking Node.js and npm environment..." -ForegroundColor Yellow

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
Write-Host "  -> Node.js: $nodeVersion" -ForegroundColor Green
Write-Host "  -> npm:     $npmVersion" -ForegroundColor Green

# -------------------------------------------------------------
# 2. Synchronize In-Game Extension (Unless Skipped)
# -------------------------------------------------------------
if (-not $NoExtensionSync) {
    Write-Host "`n[2/5] Checking in-game companion extension..." -ForegroundColor Yellow
    Sync-X4CompanionExtension
} else {
    Write-Host "`n[2/5] Skipping in-game extension sync (-NoExtensionSync specified)." -ForegroundColor DarkGray
}

# -------------------------------------------------------------
# 3. Clean Ports & Install npm Dependencies
# -------------------------------------------------------------
Write-Host "`n[3/5] Preparing environment and installing dependencies..." -ForegroundColor Yellow

# Clean active listeners on target ports
Stop-PortProcess -TargetPort $BackendPort
if (-not $ServerOnly) {
    Stop-PortProcess -TargetPort $Port
}

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

# Fast start: only run npm install if node_modules is missing or $Clean was passed
if (-not (Test-Path "node_modules") -or $Clean) {
    Write-Host "  Running 'npm install'..." -ForegroundColor DarkGray
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install encountered an error (exit code $LASTEXITCODE)."
        exit $LASTEXITCODE
    }
    Write-Host "  -> Dependencies successfully installed." -ForegroundColor Green
} else {
    Write-Host "  -> node_modules already present. Skipping npm install (use -Clean to reinstall)." -ForegroundColor Green
}

# -------------------------------------------------------------
# 4. Build Application (If Applicable)
# -------------------------------------------------------------
$needsBuild = $false
if ($BuildOnly) {
    $needsBuild = $true
} elseif ($Mode -eq 'preview' -and (-not (Test-Path "dist/index.html"))) {
    $needsBuild = $true
} elseif ((-not $NoBuild) -and (-not (Test-Path "dist/index.html"))) {
    $needsBuild = $true
}

if ($needsBuild) {
    Write-Host "`n[4/5] Building production assets (npm run build)..." -ForegroundColor Yellow
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm run build failed (exit code $LASTEXITCODE)."
        exit $LASTEXITCODE
    }
    if (Test-Path "dist/index.html") {
        $distFiles = Get-ChildItem -Path "dist" -Recurse -File
        $totalSize = ($distFiles | Measure-Object -Property Length -Sum).Sum / 1KB
        Write-Host "  -> Build verified! Generated $($distFiles.Count) files ($([Math]::Round($totalSize, 1)) KB) in ./dist" -ForegroundColor Green
    }
} else {
    Write-Host "`n[4/5] Skipping build step (already built or running dev mode)." -ForegroundColor DarkGray
}

if ($BuildOnly) {
    Write-Host "`nExecution complete (-BuildOnly specified)." -ForegroundColor Cyan
    exit 0
}

# -------------------------------------------------------------
# 5. Launch Backend Server & Frontend UI
# -------------------------------------------------------------
Write-Host "`n[5/5] Launching X4 Supply Matrix services..." -ForegroundColor Yellow

$backendProcess = $null

try {
    # 5.1 Launch Backend Companion Server (node server.js)
    # If backend is already running on the port or in the background, restart it
    if (Test-PortOpen -TargetPort $BackendPort) {
        Write-Host "  Backend is already running on port $BackendPort. Restarting server..." -ForegroundColor Yellow
        Stop-PortProcess -TargetPort $BackendPort
    }

    Write-Host "  [1/2] Starting backend companion server (Port $BackendPort)..." -ForegroundColor Green
    $backendProcess = Start-Process node -ArgumentList "server.js" -WorkingDirectory $PWD -PassThru -NoNewWindow

    # Poll port readiness
    $ready = $false
    $timeoutSeconds = 12
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    Write-Host "  Waiting for backend port $BackendPort to become active..." -ForegroundColor DarkGray -NoNewline

    while ($stopwatch.Elapsed.TotalSeconds -lt $timeoutSeconds) {
        if (Test-PortOpen -TargetPort $BackendPort) {
            $ready = $true
            break
        }
        if ($backendProcess.HasExited) {
            Write-Host " FAILED" -ForegroundColor Red
            Write-Error "Backend server process exited unexpectedly with code $($backendProcess.ExitCode)."
            exit 1
        }
        Start-Sleep -Milliseconds 400
        Write-Host "." -ForegroundColor DarkGray -NoNewline
    }
    Write-Host ""

    if ($ready) {
        Write-Host "  -> Backend server ready and listening on http://localhost:$BackendPort" -ForegroundColor Green
    } else {
        Write-Warning "Backend did not open port $BackendPort within $timeoutSeconds seconds. Continuing startup..."
    }

    if ($ServerOnly) {
        Write-Host "`n==================================================================" -ForegroundColor Cyan
        Write-Host " Companion server is running in ServerOnly mode. Press Ctrl+C to stop." -ForegroundColor Cyan
        Write-Host "==================================================================" -ForegroundColor Cyan
        $backendProcess.WaitForExit()
        return
    }

    # 5.2 Auto-Launch Browser
    $appUrl = "http://localhost:$Port/X4/"
    if (-not $NoBrowser) {
        Write-Host "  [Browser] Opening $appUrl in default browser..." -ForegroundColor DarkGray
        Start-Process $appUrl
    }

    # 5.3 Launch Vite Frontend Server
    Write-Host "  [2/2] Launching frontend UI ($Mode server on Port $Port)..." -ForegroundColor Green
    Write-Host "  ----------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  Access URL : $appUrl" -ForegroundColor Cyan
    Write-Host "  Backend    : http://localhost:$BackendPort" -ForegroundColor Cyan
    Write-Host "  Press Ctrl+C to terminate both backend and frontend servers." -ForegroundColor DarkYellow
    Write-Host "  ----------------------------------------------------------------`n" -ForegroundColor DarkGray

    $portArgs = @("--port", $Port.ToString())

    if ($Mode -eq 'preview') {
        & npm run preview -- @portArgs
    } else {
        & npm run dev -- @portArgs
    }
}
finally {
    Write-Host "`nShutting down X4 Supply Matrix services..." -ForegroundColor Yellow
    if ($backendProcess -and (-not $backendProcess.HasExited)) {
        Write-Host "  Terminating backend server (PID $($backendProcess.Id))..." -ForegroundColor DarkGray
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Stop-PortProcess -TargetPort $BackendPort
    Write-Host "All services stopped cleanly.`n" -ForegroundColor Green
}
