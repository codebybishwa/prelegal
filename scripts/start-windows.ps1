# Build and start PreLegal in Docker. The database is recreated on every start.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "PreLegal is running at http://localhost:8000"
