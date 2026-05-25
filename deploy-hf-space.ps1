#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Deploy the ai-service to HuggingFace Spaces (mechmechh/dr-screening-ai).
  Uses Git LFS to upload the large .pth model files.

.USAGE
  .\deploy-hf-space.ps1 -HfToken "hf_xxxx"

  Get your token from https://huggingface.co/settings/tokens
  (needs write access)
#>
param(
    [string]$HfToken = $env:HF_TOKEN,
    [string]$HfUser  = "mechmechh",
    [string]$SpaceName = "dr-screening-ai",
    [string]$DeployDir = "$env:TEMP\hf-space-deploy"
)

if (-not $HfToken) {
    Write-Error "HF_TOKEN not set. Run: .\deploy-hf-space.ps1 -HfToken 'hf_xxxx'"
    exit 1
}

$RepoUrl = "https://${HfUser}:${HfToken}@huggingface.co/spaces/${HfUser}/${SpaceName}"
$SourceDir = "$PSScriptRoot\ai-service"

Write-Host "=== Deploying to HuggingFace Spaces ===" -ForegroundColor Cyan
Write-Host "Space  : ${HfUser}/${SpaceName}"
Write-Host "Source : $SourceDir"
Write-Host "TempDir: $DeployDir"

# ── 1. Clean or clone ──────────────────────────────────────────────────────
if (Test-Path $DeployDir) {
    Write-Host "`n[1/6] Removing old deploy dir..." -ForegroundColor Yellow
    Remove-Item $DeployDir -Recurse -Force
}

Write-Host "`n[1/6] Cloning HF Space repo..." -ForegroundColor Yellow
git clone $RepoUrl $DeployDir 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Could not clone — initialising fresh repo" -ForegroundColor Yellow
    New-Item -ItemType Directory -Force $DeployDir | Out-Null
    Set-Location $DeployDir
    git init
    git remote add origin $RepoUrl
} else {
    Set-Location $DeployDir
}

# ── 2. Enable LFS ─────────────────────────────────────────────────────────
Write-Host "`n[2/6] Enabling Git LFS for model files..." -ForegroundColor Yellow
git lfs install
git lfs track "*.pth" "*.pt" "*.bin"
Add-Content -Path ".gitattributes" "" -NoNewline -ErrorAction SilentlyContinue

# ── 3. Copy ai-service files ───────────────────────────────────────────────
Write-Host "`n[3/6] Copying ai-service files..." -ForegroundColor Yellow

# Copy everything from ai-service/ into the deploy dir root
$exclude = @('.git', '__pycache__', 'heatmaps', '*.pyc')
Get-ChildItem $SourceDir | ForEach-Object {
    if ($_.Name -notin $exclude -and $_.Extension -ne '.pyc') {
        Copy-Item $_.FullName -Destination $DeployDir -Recurse -Force
    }
}

# ── 4. Make sure models/ is fully present ─────────────────────────────────
Write-Host "`n[4/6] Verifying model files..." -ForegroundColor Yellow
$modelsDir = "$DeployDir\models"
if (-not (Test-Path $modelsDir)) { New-Item -ItemType Directory $modelsDir | Out-Null }

$needed = @(
    "dr_resnet50_for_inference.pth",
    "dr_efficientnet_b3.pth",
    "ensemble_weights.json",
    "thresholds.json"
)
foreach ($f in $needed) {
    $src = "$SourceDir\models\$f"
    $dst = "$modelsDir\$f"
    if (Test-Path $src) {
        if (-not (Test-Path $dst) -or (Get-Item $src).Length -ne (Get-Item $dst).Length) {
            Write-Host "  Copying $f ..."
            Copy-Item $src $dst -Force
        } else {
            Write-Host "  $f already up-to-date"
        }
    } else {
        Write-Warning "  MISSING: $src"
    }
}

# ── 5. Commit ─────────────────────────────────────────────────────────────
Write-Host "`n[5/6] Committing changes..." -ForegroundColor Yellow
git add -A
$status = git status --short
if (-not $status) {
    Write-Host "  Nothing to commit — already up-to-date." -ForegroundColor Green
} else {
    Write-Host $status
    git commit -m "feat: restore ensemble (ResNet50+EfficientNetB3) + inline model classes"
}

# ── 6. Push ───────────────────────────────────────────────────────────────
Write-Host "`n[6/6] Pushing to HuggingFace Spaces (LFS upload may take a few minutes)..." -ForegroundColor Yellow
git push origin main --force 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== Deploy complete! ===" -ForegroundColor Green
    Write-Host "Space URL: https://huggingface.co/spaces/${HfUser}/${SpaceName}"
    Write-Host "API  URL : https://${HfUser}-${SpaceName}.hf.space"
} else {
    Write-Host "`n[!] Push failed — check token permissions or branch name." -ForegroundColor Red
    git push origin master --force 2>&1
}
