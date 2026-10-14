<#
.SYNOPSIS
    Scans X4 Foundations extensions directory for assets folders, collects .xml files,
    extracts component element names as the primary KEY, and strips the directory path
    after \extensions to the first directory name as the SECOND ENTRY (VALUE) in a
    Cuckoo HashTable of size 1847.
#>

param(
    [string]$ExtensionsDir = "C:\SteamLibrary\steamapps\common\X4 Foundations\extensions",
    [int]$TableSize = 1847,
    [int]$MaxDisplacements = 500
)

# 1. Verify extensions directory
if (-not (Test-Path -Path $ExtensionsDir)) {
    $altPaths = @(
        "D:\Games\Steam\steamapps\common\X4 Foundations\extensions",
        "$env:USERPROFILE\OneDrive\Documents\Egosoft\X4\extensions",
        "$env:USERPROFILE\Documents\Egosoft\X4\extensions"
    )
    $found = $altPaths | Where-Object { Test-Path -Path $_ } | Select-Object -First 1
    if ($found) {
        $ExtensionsDir = $found
    } else {
        Write-Error "Extensions directory not found at $ExtensionsDir"
        exit 1
    }
}

Write-Host "Scanning extensions directory: $ExtensionsDir" -ForegroundColor Cyan
Write-Host "Initializing Cuckoo Hashing (Table Size: $TableSize, Key = Component Name, Value = First Directory Name)...`n" -ForegroundColor Yellow

# 2. Cuckoo Hashing Setup: Two tables T1 and T2 of size 1847
$Table1 = New-Object 'System.Object[]' $TableSize
$Table2 = New-Object 'System.Object[]' $TableSize

# Primary Hash Function h1: DJB2 hash modulo TableSize
function Get-CuckooHash1([string]$Key, [int]$Size = 1847) {
    [long]$h = 5381
    foreach ($char in $Key.ToCharArray()) {
        $h = (($h * 33) + [int]$char) % $Size
    }
    return [int](($h + $Size) % $Size)
}

# Secondary Hash Function h2: FNV/Polynomial hash modulo TableSize
function Get-CuckooHash2([string]$Key, [int]$Size = 1847) {
    [long]$h = 0
    foreach ($char in $Key.ToCharArray()) {
        $h = (($h * 31) + [int]$char) % $Size
    }
    return [int](($h + $Size) % $Size)
}

# Cuckoo Insert Function (Pagh-Rodler Algorithm)
# Key: Component Name (1st entry)
# Value: First Directory Name after \extensions (2nd entry)
$totalDisplacements = 0

function Insert-CuckooEntry([string]$Key, [string]$Value, [string]$FileName, [ref]$DisplacementCounter) {
    # Check if key already exists in Table 1
    $pos1 = Get-CuckooHash1 -Key $Key -Size $TableSize
    if ($null -ne $Table1[$pos1] -and $Table1[$pos1].Key -eq $Key) {
        if (-not ($Table1[$pos1].Extensions -contains $Value)) {
            $Table1[$pos1].Extensions += $Value
            $Table1[$pos1].Value = ($Table1[$pos1].Extensions -join ', ')
        }
        return $true
    }

    # Check if key already exists in Table 2
    $pos2 = Get-CuckooHash2 -Key $Key -Size $TableSize
    if ($null -ne $Table2[$pos2] -and $Table2[$pos2].Key -eq $Key) {
        if (-not ($Table2[$pos2].Extensions -contains $Value)) {
            $Table2[$pos2].Extensions += $Value
            $Table2[$pos2].Value = ($Table2[$pos2].Extensions -join ', ')
        }
        return $true
    }

    # Create new Cuckoo pair entry: [Key = ComponentName, Value = FirstDir]
    $curr = [PSCustomObject]@{
        Key = $Key
        Value = $Value
        Extensions = @($Value)
        FileName = $FileName
    }

    $targetTable = 1
    for ($i = 0; $i -lt $MaxDisplacements; $i++) {
        if ($targetTable -eq 1) {
            $pos = Get-CuckooHash1 -Key $curr.Key -Size $TableSize
            if ($null -eq $Table1[$pos]) {
                $Table1[$pos] = $curr
                return $true
            }
            # Evict existing occupant (Cuckoo displacement)
            $DisplacementCounter.Value++
            $evicted = $Table1[$pos]
            $Table1[$pos] = $curr
            $curr = $evicted
            $targetTable = 2
        } else {
            $pos = Get-CuckooHash2 -Key $curr.Key -Size $TableSize
            if ($null -eq $Table2[$pos]) {
                $Table2[$pos] = $curr
                return $true
            }
            # Evict existing occupant (Cuckoo displacement)
            $DisplacementCounter.Value++
            $evicted = $Table2[$pos]
            $Table2[$pos] = $curr
            $curr = $evicted
            $targetTable = 1
        }
    }

    Write-Warning "Cuckoo displacement cycle detected for component '$($curr.Key)' after $MaxDisplacements kicks."
    return $false
}

# Cuckoo Lookup Function (Guaranteed O(1) worst-case time using at most 2 memory probes)
function Find-CuckooEntry([string]$Key) {
    $pos1 = Get-CuckooHash1 -Key $Key -Size $TableSize
    if ($null -ne $Table1[$pos1] -and $Table1[$pos1].Key -eq $Key) {
        return [PSCustomObject]@{ Found = $true; Table = 1; Slot = $pos1; Key = $Key; Value = $Table1[$pos1].Value; Entry = $Table1[$pos1] }
    }

    $pos2 = Get-CuckooHash2 -Key $Key -Size $TableSize
    if ($null -ne $Table2[$pos2] -and $Table2[$pos2].Key -eq $Key) {
        return [PSCustomObject]@{ Found = $true; Table = 2; Slot = $pos2; Key = $Key; Value = $Table2[$pos2].Value; Entry = $Table2[$pos2] }
    }

    return [PSCustomObject]@{ Found = $false; Table = 0; Slot = -1; Key = $Key; Value = $null; Entry = $null }
}

# Function to extract component element name from XML
function Get-ComponentElementName([string]$FilePath) {
    try {
        $content = [System.IO.File]::ReadAllText($FilePath)
        if ($content -match '<component\b[^>]*\bname\s*=\s*["'']([^"'']+)["'']') {
            return $matches[1].Trim()
        }
        if ($content -match '<component\b[^>]*\bref\s*=\s*["'']([^"'']+)["'']') {
            return $matches[1].Trim()
        }
        if ($content -match '<macro\b[^>]*\bname\s*=\s*["'']([^"'']+)["'']') {
            return $matches[1].Trim()
        }
        return [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
    } catch {
        return [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
    }
}

# 3. Scan extension subdirectories
$extFolders = Get-ChildItem -Path $ExtensionsDir -Directory
$totalXml = 0
$failedInsertions = 0

foreach ($ext in $extFolders) {
    # Check for assets or assests directory
    $assetsDir = Get-ChildItem -Path $ext.FullName -Directory | Where-Object { $_.Name -match '^assets?$' -or $_.Name -match '^assests?$' } | Select-Object -First 1

    if ($null -ne $assetsDir) {
        Write-Host "Entering assets folder: [$($ext.Name)\$($assetsDir.Name)]" -ForegroundColor Green

        # Recursively search for .xml files
        $xmlFiles = Get-ChildItem -Path $assetsDir.FullName -Filter "*.xml" -Recurse -File

        foreach ($xml in $xmlFiles) {
            $totalXml++

            # 1st Entry (Key): Component element name
            $compName = Get-ComponentElementName $xml.FullName

            # Obtain directory path for inclusion after \extensions
            $subDirAfterExtensions = $xml.DirectoryName.Substring($ExtensionsDir.Length).TrimStart('\', '/')

            # 2nd Entry (Value): Strip path information after the first directory name
            $firstDirAfterExtensions = ($subDirAfterExtensions -split '[\\/]', 2)[0]

            # Insert pair into Cuckoo Hash Table
            $counterRef = [ref]$totalDisplacements
            $success = Insert-CuckooEntry -Key $compName -Value $firstDirAfterExtensions -FileName $xml.Name -DisplacementCounter $counterRef
            if (-not $success) {
                $failedInsertions++
            }
        }
    }
}

# 4. Compute Cuckoo Statistics
$occT1 = ($Table1 | Where-Object { $null -ne $_ }).Count
$occT2 = ($Table2 | Where-Object { $null -ne $_ }).Count
$uniqueKeys = $occT1 + $occT2
$totalSlots = $TableSize * 2

Write-Host "`n=== Cuckoo Hashing (Table Size: $TableSize) Statistics ===" -ForegroundColor Yellow
Write-Host "Total XML Files Scanned      : $totalXml"
Write-Host "Unique Component Keys Inserted: $uniqueKeys"
Write-Host "Failed (Cycles Detected)      : $failedInsertions"
Write-Host "Total Cuckoo Displacements    : $totalDisplacements"
Write-Host "Table 1 Occupied              : $occT1 / $TableSize ($([math]::Round(($occT1 / $TableSize) * 100, 1))%)"
Write-Host "Table 2 Occupied              : $occT2 / $TableSize ($([math]::Round(($occT2 / $TableSize) * 100, 1))%)"
Write-Host "Combined Capacity             : $totalSlots slots (2 x $TableSize)"
Write-Host "Overall Load Factor           : $([math]::Round($uniqueKeys / $totalSlots, 3)) ($([math]::Round(($uniqueKeys / $totalSlots) * 100, 1))%)"
Write-Host "Worst-Case Lookup Cost        : O(1) - exactly <= 2 memory probes per query`n"

# 5. Display sample entries from Table 1 and Table 2
Write-Host "Sample Cuckoo Table 1 Entries (Key = Component, Value = First Directory):" -ForegroundColor Cyan
$shownT1 = 0
for ($i = 0; $i -lt $TableSize; $i++) {
    if ($null -ne $Table1[$i] -and $shownT1 -lt 10) {
        $shownT1++
        Write-Host "  T1 [$($i.ToString().PadLeft(4))]: Key = '$($Table1[$i].Key)'  ==>  Value = '$($Table1[$i].Value)'"
    }
}

Write-Host "`nSample Cuckoo Table 2 Entries (Displaced Occupants):" -ForegroundColor Cyan
$shownT2 = 0
for ($i = 0; $i -lt $TableSize; $i++) {
    if ($null -ne $Table2[$i] -and $shownT2 -lt 10) {
        $shownT2++
        Write-Host "  T2 [$($i.ToString().PadLeft(4))]: Key = '$($Table2[$i].Key)'  ==>  Value = '$($Table2[$i].Value)'"
    }
}

# 6. Verify Live O(1) Cuckoo Lookup
Write-Host "`n--- Live O(1) Cuckoo Lookup Verification ---" -ForegroundColor Yellow
$sampleKeys = @(
    "station_bor_tradestation_base_01",
    "dockarea_ter_xl_carrier_01",
    "prod_ter_siliconcarbide"
)

foreach ($k in $sampleKeys) {
    $res = Find-CuckooEntry -Key $k
    if ($res.Found) {
        Write-Host "  [OK] Key: '$($res.Key)' -> Found in Table $($res.Table) (Slot $($res.Slot)), Value: '$($res.Value)'" -ForegroundColor Green
    } else {
        Write-Host "  [MISS] Key: '$k' not found" -ForegroundColor Red
    }
}

# 7. Save to JSON file in src/data/cuckoo_extensions_table.json
$projectRoot = Split-Path -Path $PSScriptRoot -Parent
$outputDir = Join-Path $projectRoot "src\data"
if (-not (Test-Path -Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}
$outputFile = Join-Path $outputDir "cuckoo_extensions_table.json"

# Build convenient lookup map
$lookupMap = [ordered]@{}
for ($i = 0; $i -lt $TableSize; $i++) {
    if ($null -ne $Table1[$i]) {
        $lookupMap[$Table1[$i].Key] = $Table1[$i].Value
    }
    if ($null -ne $Table2[$i]) {
        $lookupMap[$Table2[$i].Key] = $Table2[$i].Value
    }
}

$exportData = [ordered]@{
    tableSize = $TableSize
    totalUniqueComponents = $uniqueKeys
    totalXmlScanned = $totalXml
    generatedAt = (Get-Date).ToString("o")
    statistics = [ordered]@{
        table1Occupied = $occT1
        table2Occupied = $occT2
        totalSlots = $totalSlots
        totalDisplacements = $totalDisplacements
        loadFactor = [math]::Round($uniqueKeys / $totalSlots, 3)
        worstCaseLookupProbes = 2
    }
    lookupMap = $lookupMap
    table1 = $Table1
    table2 = $Table2
}

$exportData | ConvertTo-Json -Depth 6 | Set-Content -Path $outputFile -Encoding utf8
Write-Host "`n💾 Successfully exported Cuckoo HashTable to: $outputFile" -ForegroundColor Green

