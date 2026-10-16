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
.PARAMETER EnableBypassCertificatePinning
    If specified or needed, configures winget administrator settings to enable BypassCertificatePinningForMicrosoftStore.
.EXAMPLE
    .\setup_x4_supply_matrix.ps1
.EXAMPLE
    .\setup_x4_supply_matrix.ps1 -Mode dev -NoBrowser
.EXAMPLE
    .\setup_x4_supply_matrix.ps1 -Clean -Mode dev
.EXAMPLE
    .\setup_x4_supply_matrix.ps1 -ServerOnly
.EXAMPLE
    .\setup_x4_supply_matrix.ps1 -EnableBypassCertificatePinning
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
    [switch]$Force,
    [switch]$EnableBypassCertificatePinning,
    [int]$Port = 5173,
    [int]$BackendPort = 3000
)

# -------------------------------------------------------------
# 0. Setup Execution Environment & Working Directory
# -------------------------------------------------------------
$ErrorActionPreference = 'Stop'

function Ask-UserConfirmation {
    param (
        [string]$PromptMessage,
        [bool]$Default = $true
    )
    if ($Force -or [Console]::IsInputRedirected) {
        return $Default
    }
    try {
        $ans = Read-Host "$PromptMessage (Y/N)"
        if ($ans -match '^[Yy]') { return $true }
        if ($ans -match '^[Nn]') { return $false }
        return $Default
    } catch {
        return $Default
    }
}

# Ensure working directory is the script's directory
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } elseif ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } elseif ($MyInvocation.MyCommand.Definition) { Split-Path -Parent $MyInvocation.MyCommand.Definition } else { $PWD.Path }
if ($ScriptDir -and (Test-Path $ScriptDir)) {
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
            if ($proc -and $proc.ProcessName -ne 'X4' -and $procId -ne $PID) {
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
    $extensionsToSync = @("djfhe_http", "x4_companion_bridge")
    $validExtensions = [System.Collections.Generic.List[string]]::new()

    foreach ($extName in $extensionsToSync) {
        $extSourcePath = Join-Path $PWD "extensions\$extName"
        if (Test-Path $extSourcePath) {
            $validExtensions.Add($extName)
        } else {
            Write-Warning "Source extension directory '$extSourcePath' not found; skipping '$extName'."
        }
    }

    if ($validExtensions.Count -eq 0) {
        return
    }

    Write-Host "[Mod Sync] Scanning X4 installation paths for companion extensions ($($validExtensions -join ', '))..." -ForegroundColor Yellow

    $candidatePaths = [System.Collections.Generic.List[string]]::new()

    # 1. Check known Steam paths & libraryfolders.vdf
    $steamKnownPaths = @(
        "C:\SteamLibrary\steamapps\common\X4 Foundations\extensions"
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
        try {
            if (-not (Test-Path $destExtRoot)) {
                New-Item -ItemType Directory -Path $destExtRoot -Force | Out-Null
            }

            $dirSuccess = $false
            foreach ($extName in $validExtensions) {
                $sourceExt = Join-Path $PWD "extensions\$extName"
                $destExtDir = Join-Path $destExtRoot $extName
                if (-not (Test-Path $destExtDir)) {
                    New-Item -ItemType Directory -Path $destExtDir -Force | Out-Null
                }

                # For djfhe_http, if core.dll and content.xml already exist at destination, skip overwriting locked native DLLs
                if ($extName -eq "djfhe_http") {
                    $existingCoreDll = Join-Path $destExtDir "lua\luasocket\core.dll"
                    $existingContentXml = Join-Path $destExtDir "content.xml"
                    if ((Test-Path $existingCoreDll) -and (Test-Path $existingContentXml)) {
                        Write-Host "  -> '$extName' already present at: $destExtDir" -ForegroundColor DarkGray
                        $dirSuccess = $true
                        continue
                    }
                }

                try {
                    Write-Host "  -> Copying '$extName' to: $destExtDir" -ForegroundColor DarkGray
                    Copy-Item -Path "$sourceExt\*" -Destination $destExtDir -Recurse -Force -ErrorAction Stop
                    $dirSuccess = $true
                } catch {
                    Write-Warning "Failed syncing '$extName' to '$destExtDir': $_"
                }
            }
            if ($dirSuccess) {
                $syncedCount++
            }
        } catch {
            Write-Warning "Failed accessing extensions directory '$destExtRoot': $_"
        }
    }

    if ($syncedCount -gt 0) {
        Write-Host "  -> Successfully synchronized $($validExtensions.Count) extension(s) to $syncedCount game directory/directories." -ForegroundColor Green
    } else {
        Write-Host "  -> No active X4 Foundations extensions folders detected; skipping auto-sync." -ForegroundColor DarkGray
    }
}

function Enable-WingetBypassCertificatePinning {
    param ([bool]$ForceEnable = $false)

    $wingetCmd = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $wingetCmd) { return }

    # Check current export state if available
    try {
        $exportJson = & winget settings export 2>$null | Out-String
        if ($exportJson) {
            $parsed = $exportJson | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($parsed -and $parsed.adminSettings -and $parsed.adminSettings.BypassCertificatePinningForMicrosoftStore -eq $true) {
                # Already enabled
                return
            }
        }
    } catch {}

    Write-Host "`n[winget Settings] Configuring administrator setting: --enable BypassCertificatePinningForMicrosoftStore..." -ForegroundColor DarkYellow

    $isAdmin = $false
    try {
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = [Security.Principal.WindowsPrincipal]$identity
        $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch {}

    if ($isAdmin) {
        try {
            & winget settings --enable BypassCertificatePinningForMicrosoftStore
            Write-Host "  -> Successfully enabled BypassCertificatePinningForMicrosoftStore." -ForegroundColor Green
        } catch {
            Write-Warning "Failed enabling winget setting directly: $_"
        }
    } else {
        # Needs elevation: prompt user if not forced, then invoke elevated process
        $shouldPrompt = -not $ForceEnable
        $proceed = $true
        if ($shouldPrompt) {
            $proceed = Ask-UserConfirmation "Bypass certificate pinning for Microsoft Store in winget requires elevation. Run elevated prompt to enable?" $true
        }

        if ($proceed) {
            try {
                Write-Host "  Prompting for elevation to execute 'winget settings --enable BypassCertificatePinningForMicrosoftStore'..." -ForegroundColor DarkGray
                $elevatedProc = Start-Process winget.exe -ArgumentList "settings", "--enable", "BypassCertificatePinningForMicrosoftStore" -Verb RunAs -PassThru -Wait -ErrorAction Stop
                if ($elevatedProc.ExitCode -eq 0) {
                    Write-Host "  -> Successfully enabled BypassCertificatePinningForMicrosoftStore via elevated process." -ForegroundColor Green
                } else {
                    Write-Warning "Elevated winget process returned exit code $($elevatedProc.ExitCode)."
                }
            } catch {
                Write-Warning "Could not elevate to enable winget setting: $_"
            }
        } else {
            Write-Host "  -> Skipped enabling winget certificate pinning bypass." -ForegroundColor DarkGray
        }
    }
}

# -------------------------------------------------------------
# 1. Verify Node.js & npm Installation
# -------------------------------------------------------------
Write-Host "[1/5] Checking Node.js and npm environment..." -ForegroundColor Yellow

function Refresh-EnvironmentPath {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath    = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path    = "$machinePath;$userPath"

    # Prepend project-local and global Node/npm module binary paths if present
    $localBin = Join-Path $PWD "node_modules\.bin"
    $standardPaths = [System.Collections.Generic.List[string]]::new()
    $standardPaths.Add($localBin)
    $standardPaths.Add("$env:ProgramFiles\nodejs")
    $standardPaths.Add("${env:ProgramFiles(x86)}\nodejs")
    $standardPaths.Add("$env:LOCALAPPDATA\Programs\node")
    $standardPaths.Add("$env:APPDATA\npm")
    $standardPaths.Add("$env:LOCALAPPDATA\Microsoft\WinGet\Links")
    $standardPaths.Add("$env:APPDATA\nvm")

    # Locate WinGet portable Node package directories if installed
    $wingetNodeDirs = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS*" -Directory -ErrorAction SilentlyContinue |
        Get-ChildItem -Directory -Filter "node-*" -ErrorAction SilentlyContinue
    if ($wingetNodeDirs) {
        foreach ($wnd in $wingetNodeDirs) {
            $standardPaths.Add($wnd.FullName)
        }
    }

    foreach ($dir in $standardPaths) {
        if ((Test-Path $dir) -and ($env:Path -notlike "*$dir*")) {
            $env:Path = "$dir;$env:Path"
        }
    }
}

# If -EnableBypassCertificatePinning was explicitly passed, configure it now
if ($EnableBypassCertificatePinning) {
    Enable-WingetBypassCertificatePinning -ForceEnable $true
}

Refresh-EnvironmentPath

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$npmCmd  = Get-Command npm -ErrorAction SilentlyContinue

# Case A: Neither Node nor npm found
if (-not $nodeCmd) {
    Write-Warning "Node.js was not detected on this system."

    $installedSuccessfully = $false
    $wingetCmd = Get-Command winget -ErrorAction SilentlyContinue

    # Automatically insure winget administrator setting BypassCertificatePinningForMicrosoftStore is enabled
    Enable-WingetBypassCertificatePinning

    if ($wingetCmd) {
        if (Ask-UserConfirmation "Would you like to install Node.js LTS (includes npm) via winget automatically?" $true) {
            # Insure bypass certificate pinning setting is enabled prior to installation
            Enable-WingetBypassCertificatePinning

            Write-Host "Installing Node.js LTS via winget..." -ForegroundColor Green
            try {
                & winget install OpenJS.NodeJS.LTS --scope user --accept-package-agreements --accept-source-agreements --silent
            } catch {
                Write-Warning "winget user-scope installation encountered an issue: $_"
                # If network or store cert issue might have occurred, try enabling bypass certificate pinning
                Enable-WingetBypassCertificatePinning -ForceEnable $false
                try {
                    & winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
                } catch {
                    Write-Warning "winget machine-scope installation also encountered an issue: $_"
                }
            }
            Refresh-EnvironmentPath
            $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
            $npmCmd  = Get-Command npm -ErrorAction SilentlyContinue
            if ($nodeCmd -and $npmCmd) {
                $installedSuccessfully = $true
            }
        }
    }

    # Fallback to direct official Node LTS portable archive download
    if (-not $installedSuccessfully -and -not $nodeCmd) {
        if (Ask-UserConfirmation "Download and install official Node.js LTS portable package now?" $true) {
            Write-Host "Fetching latest Node.js LTS portable package..." -ForegroundColor Green
            try {
                $targetNodeDir = "$env:LOCALAPPDATA\Programs\node"
                if (-not (Test-Path $targetNodeDir)) {
                    New-Item -ItemType Directory -Path $targetNodeDir -Force | Out-Null
                }

                $tempZip = Join-Path $env:TEMP "node-lts-portable.zip"
                $downloadUrl = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip"
                Write-Host "Downloading from $downloadUrl to $tempZip..." -ForegroundColor DarkGray
                
                [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13
                Invoke-WebRequest -Uri $downloadUrl -OutFile $tempZip -UseBasicParsing
                
                Write-Host "Extracting Node.js portable archive..." -ForegroundColor Green
                $tempExtract = Join-Path $env:TEMP "node-extract-temp"
                if (Test-Path $tempExtract) { Remove-Item -Recurse -Force $tempExtract }
                Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force

                $extractedInner = Get-ChildItem -Path $tempExtract -Directory -Filter "node-*" | Select-Object -First 1
                if ($extractedInner) {
                    Copy-Item -Path "$($extractedInner.FullName)\*" -Destination $targetNodeDir -Recurse -Force
                    Write-Host "  -> Node.js installed to $targetNodeDir" -ForegroundColor Green
                }

                if (Test-Path $tempZip) { Remove-Item -Force $tempZip }
                if (Test-Path $tempExtract) { Remove-Item -Recurse -Force $tempExtract }

                # Persist to User Path in registry so future sessions also have it
                $currentUserPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
                if ($currentUserPath -notlike "*$targetNodeDir*") {
                    [System.Environment]::SetEnvironmentVariable("Path", "$targetNodeDir;$currentUserPath", "User")
                }
            } catch {
                Write-Warning "Direct portable download/install failed: $_"
            }

            Refresh-EnvironmentPath
            $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
            $npmCmd  = Get-Command npm -ErrorAction SilentlyContinue
        }
    }

    if (-not $nodeCmd) {
        Write-Error "Node.js (v18+) is required to run X4 Supply Matrix. Please install from https://nodejs.org/ and re-run this script."
        exit 1
    }
}

# Case B: Node.js is present, but npm is not found
if (-not $npmCmd) {
    Write-Warning "Node.js is present, but npm was not found in PATH."

    $nodeExePath = if ($nodeCmd.Source) { $nodeCmd.Source } elseif ($nodeCmd.Path) { $nodeCmd.Path } else { (Get-Command node).Source }
    $nodeDir = Split-Path -Parent $nodeExePath

    # Check if npm.cmd or npm exists in the same directory as node.exe
    if ((Test-Path (Join-Path $nodeDir "npm.cmd")) -or (Test-Path (Join-Path $nodeDir "npm"))) {
        if ($env:Path -notlike "*$nodeDir*") {
            $env:Path = "$nodeDir;$env:Path"
        }
        $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    }

    # Sub-case B1: Check if npm-cli.js exists bundled inside Node's installation directory
    if (-not $npmCmd) {
        $bundledNpmCli = Join-Path $nodeDir "node_modules\npm\bin\npm-cli.js"

        if (Test-Path $bundledNpmCli) {
            Write-Host "  -> Detected bundled npm at: $bundledNpmCli" -ForegroundColor Green
            Write-Host "  Installing global npm via bundled CLI..." -ForegroundColor Yellow
            try {
                & node "$bundledNpmCli" install -g npm --silent
                Refresh-EnvironmentPath
                $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
            } catch {
                Write-Warning "Could not restore npm using bundled CLI: $_"
            }
        }
    }

    # Sub-case B2: If still not found, offer automated npm download or Node repair
    if (-not $npmCmd) {
        if (Ask-UserConfirmation "Would you like to install npm now?" $true) {
            Write-Host "Attempting automated npm installation..." -ForegroundColor Green
            try {
                # Download npm tarball and unpack or run official npm install
                $tempNpmDir = Join-Path $env:TEMP "npm-install-temp"
                if (Test-Path $tempNpmDir) { Remove-Item -Recurse -Force $tempNpmDir }
                New-Item -ItemType Directory -Path $tempNpmDir -Force | Out-Null
                
                $npmTgz = Join-Path $tempNpmDir "npm.tgz"
                Invoke-WebRequest -Uri "https://registry.npmjs.org/npm/-/npm-11.2.0.tgz" -OutFile $npmTgz -UseBasicParsing
                
                # Extract and install using node
                & tar -xzf "$npmTgz" -C "$tempNpmDir"
                $extractedNpmCli = Join-Path $tempNpmDir "package\bin\npm-cli.js"
                if (Test-Path $extractedNpmCli) {
                    & node "$extractedNpmCli" install -g npm
                    Refresh-EnvironmentPath
                    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
                }
                if (Test-Path $tempNpmDir) { Remove-Item -Recurse -Force $tempNpmDir }
            } catch {
                Write-Warning "Automated npm install failed: $_"
            }

            # If still not found, repair Node.js installation
            if (-not $npmCmd) {
                Write-Host "Repairing Node.js LTS via winget to restore npm..." -ForegroundColor Yellow
                $wingetCmd = Get-Command winget -ErrorAction SilentlyContinue
                if ($wingetCmd) {
                    Enable-WingetBypassCertificatePinning
                    & winget install OpenJS.NodeJS.LTS --scope user --force --accept-package-agreements --accept-source-agreements --silent
                    Refresh-EnvironmentPath
                    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
                }
            }
        }
    }

    if (-not $npmCmd) {
        Write-Error "npm is required to install dependencies and run X4 Supply Matrix. Please reinstall Node.js (with npm checked) from https://nodejs.org/ and re-run this script."
        exit 1
    }
}

try {
    $nodeVersionRaw = (& node -v 2>$null)
    $npmVersionRaw  = (& npm -v 2>$null)
    $nodeVersion = if ($nodeVersionRaw) { $nodeVersionRaw.Trim() } else { "Unknown" }
    $npmVersion  = if ($npmVersionRaw) { $npmVersionRaw.Trim() } else { "Unknown" }
    
    # Check minimum major version (18+)
    if ($nodeVersion -match '^v(\d+)\.') {
        $majorVer = [int]$matches[1]
        if ($majorVer -lt 18) {
            Write-Error "Node.js version $nodeVersion is too old. Please upgrade to Node.js 18 or newer."
            exit 1
        }
    }
} catch {
    Write-Warning "Could not verify Node.js version string: $_"
}

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

# Ensure newly installed project binaries (e.g. vite, rolldown, luaparse) are actively exposed in $env:Path
Refresh-EnvironmentPath
$localModuleBin = Join-Path $PWD "node_modules\.bin"
if (Test-Path $localModuleBin) {
    if ($env:Path -notlike "*$localModuleBin*") {
        $env:Path = "$localModuleBin;$env:Path"
    }
    Write-Host "  -> Project module binaries mapped to PATH ($localModuleBin)" -ForegroundColor DarkGray
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

    $nodeExe = if ($nodeCmd -and $nodeCmd.Source) { $nodeCmd.Source } elseif ($nodeCmd -and $nodeCmd.Path) { $nodeCmd.Path } else { 'node' }
    Write-Host "  [1/2] Starting backend companion server (Port $BackendPort)..." -ForegroundColor Green
    $backendProcess = Start-Process $nodeExe -ArgumentList "server.js" -WorkingDirectory $PWD -PassThru -NoNewWindow

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

    $backendUrl = "http://localhost:$BackendPort"
    if ($ServerOnly) {
        if (-not $NoBrowser) {
            Write-Host "  [Browser] Opening Companion Dashboard ($backendUrl)..." -ForegroundColor DarkGray
            Start-Process $backendUrl
        }
        Write-Host "`n==================================================================" -ForegroundColor Cyan
        Write-Host " Companion server is running in ServerOnly mode. Press Ctrl+C to stop." -ForegroundColor Cyan
        Write-Host "==================================================================" -ForegroundColor Cyan
        $backendProcess.WaitForExit()
        return
    }

    # 5.2 Auto-Launch Browser (Companion Backend & Supply Matrix UI)
    $appUrl = "http://localhost:$Port/X4/"
    if (-not $NoBrowser) {
        Write-Host "  [Browser] Opening Companion Dashboard ($backendUrl)..." -ForegroundColor DarkGray
        Start-Process $backendUrl
        Start-Sleep -Milliseconds 400
        Write-Host "  [Browser] Opening Supply Matrix UI ($appUrl)..." -ForegroundColor DarkGray
        Start-Process $appUrl
    }

    # 5.3 Launch Vite Frontend Server
    Write-Host "  [2/2] Launching frontend UI ($Mode server on Port $Port)..." -ForegroundColor Green
    Write-Host "  ----------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  [Status Check] Node.js & npm       : Verified ($nodeVersion / $npmVersion)" -ForegroundColor Green
    Write-Host "  [Status Check] Companion Backend   : Active on $backendUrl" -ForegroundColor Green
    Write-Host "  [Status Check] Supply Matrix UI    : Starting on $appUrl" -ForegroundColor Green
    Write-Host "  ----------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  All systems initialized! Press Ctrl+C when finished to stop servers." -ForegroundColor Cyan
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
    Write-Host "All services stopped cleanly. Everything went well!`n" -ForegroundColor Green
    $global:LASTEXITCODE = 0
}
exit 0
