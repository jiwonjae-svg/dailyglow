param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Message,

  [string[]]$Files = @(),

  [switch]$All,
  [switch]$AllowMain,
  [switch]$AllowAssets
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($Files.Count -eq 1 -and $Files[0] -match ",") {
  $Files = @($Files[0] -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,

    [string[]]$Arguments = @()
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Normalize-RepoPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  return (($Path -replace "\\", "/") -replace "^\./", "").Trim()
}

function Get-GitLines {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $output = & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }

  return @($output | Where-Object { $_ -ne $null -and $_.ToString().Trim() -ne "" })
}

$repoRoot = @(Get-GitLines -Arguments @("rev-parse", "--show-toplevel"))[0]
Set-Location $repoRoot

$branch = @(Get-GitLines -Arguments @("branch", "--show-current"))[0]
if (($branch -eq "main" -or $branch -eq "master") -and -not $AllowMain) {
  throw "Refusing to commit directly on $branch. Use -AllowMain only when the user explicitly wants that."
}

if ($All -and $Files.Count -gt 0) {
  throw "Use either -All or -Files, not both."
}

if (-not $All -and $Files.Count -eq 0) {
  throw "Provide -Files for scoped staging, or use -All intentionally."
}

$statusBefore = Get-GitLines -Arguments @("status", "--porcelain")
if ($statusBefore.Count -eq 0) {
  Write-Host "No changes to commit."
  exit 0
}

Write-Host "Running npm run lint..."
Invoke-Checked -Command "npm" -Arguments @("run", "lint")

Write-Host "Running npm run build..."
Invoke-Checked -Command "npm" -Arguments @("run", "build")

if ($All) {
  Invoke-Checked -Command "git" -Arguments @("add", "-A")
} else {
  $normalizedAllowed = @{}
  foreach ($file in $Files) {
    $normalizedAllowed[(Normalize-RepoPath $file)] = $true
  }

  Invoke-Checked -Command "git" -Arguments (@("add", "--") + $Files)

  $remainingStatus = Get-GitLines -Arguments @("status", "--porcelain")
  $outsideChanges = @()
  foreach ($line in $remainingStatus) {
    $path = $line.Substring(3).Trim()
    if ($path -match " -> ") {
      $path = ($path -split " -> ")[-1]
    }
    $path = Normalize-RepoPath $path
    if (-not $normalizedAllowed.ContainsKey($path)) {
      $outsideChanges += $path
    }
  }

  if ($outsideChanges.Count -gt 0) {
    throw "Unrelated changes are present outside -Files: $($outsideChanges -join ', ')"
  }
}

$stagedFiles = Get-GitLines -Arguments @("diff", "--cached", "--name-only")
if ($stagedFiles.Count -eq 0) {
  throw "No staged changes to commit."
}

$forbiddenPatterns = @(
  "(^|/)\.env($|[./])",
  "(^|/)\.vercel/",
  "(^|/)\.next/",
  "(^|/)node_modules/",
  "(^|/)repomix-output\.xml$"
)

foreach ($file in $stagedFiles) {
  $normalized = Normalize-RepoPath $file
  foreach ($pattern in $forbiddenPatterns) {
    if ($normalized -match $pattern) {
      throw "Refusing to stage protected file: $normalized"
    }
  }
}

$assetAdditions = Get-GitLines -Arguments @("diff", "--cached", "--name-only", "--diff-filter=A") |
  Where-Object { (Normalize-RepoPath $_) -match "\.(png|jpe?g|gif|webp|svg|ico|mp4|mov|zip|pdf)$" }

if ($assetAdditions.Count -gt 0 -and -not $AllowAssets) {
  throw "Asset additions require -AllowAssets: $($assetAdditions -join ', ')"
}

Invoke-Checked -Command "git" -Arguments @("diff", "--cached", "--check")

Write-Host "Staged files:"
$stagedFiles | ForEach-Object { Write-Host " - $_" }
Write-Host "Commit message: $Message"

Invoke-Checked -Command "git" -Arguments @("commit", "-m", $Message)
Invoke-Checked -Command "git" -Arguments @("push", "-u", "origin", "HEAD")
