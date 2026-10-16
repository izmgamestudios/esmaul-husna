# Deploys the latest main branch of izmgamestudios/esmaul-husna to the server over SSH.
# Run from Windows PowerShell (OpenSSH client is built into Windows 10/11).
#
# Example:
#   .\deploy\deploy.ps1 -Server 203.0.113.10 -User root -KeyPath "$HOME\.ssh\id_ed25519"
#
# Prerequisite: deploy/install.sh has already been run once on the server.
# The script only updates code (git reset --hard origin/<branch>), restarts the
# systemd service and checks the health endpoint. data/progress.json is git-ignored,
# so progress survives deploys.

param(
  [Parameter(Mandatory = $true)][string]$Server,
  [string]$User = 'root',
  [string]$KeyPath = "$HOME\.ssh\id_ed25519",
  [string]$AppDir = '/opt/esmaul-husna',
  [string]$Branch = 'main'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $KeyPath)) { throw "SSH anahtarı bulunamadı: $KeyPath" }

$remoteScript = @"
set -euo pipefail
cd $AppDir
git fetch --depth=1 origin $Branch
git reset --hard origin/$Branch
sudo systemctl restart esmaul-husna.service
for i in 1 2 3 4 5; do
  if curl -fsS http://127.0.0.1:3000/api/state > /dev/null 2>&1; then
    echo DEPLOY_OK
    exit 0
  fi
  sleep 1
done
echo DEPLOY_HEALTHCHECK_FAILED >&2
sudo journalctl -u esmaul-husna.service -n 30 --no-pager >&2
exit 1
"@

# Normalize to LF: Windows line endings break bash on the server.
$remoteScript = $remoteScript -replace "`r`n", "`n"

Write-Host "Deploy: $User@$Server  ($Branch) -> $AppDir" -ForegroundColor Cyan
$remoteScript | ssh -i $KeyPath -o StrictHostKeyChecking=accept-new "$User@$Server" "bash -s"
if ($LASTEXITCODE -ne 0) { throw "Deploy başarısız (ssh çıkış kodu $LASTEXITCODE)" }
Write-Host "Tamam: https://teknodoz-esmaulhusna-ortakofis.org" -ForegroundColor Green
