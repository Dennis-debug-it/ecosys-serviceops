<#
.SYNOPSIS
  Creates the ChaiCRM workspace with clean backend/frontend separation on Windows.
#>

$ErrorActionPreference = "Stop"

$RootDir = "ChaiCRM"
$TempDir = $null

# ---------- Helper functions ----------
function Invoke-Cleanup {
    if ($TempDir -and (Test-Path $TempDir)) {
        Remove-Item -Recurse -Force $TempDir
    }
}

function Require-Command {
    param([string]$cmd)
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Error "Missing required command: $cmd"
        exit 1
    }
}

function Write-Base64File {
    param([string]$outputPath)
    # Reads base64 from the pipeline, decodes, and writes to file
    $inputStream = $input | Out-String
    $bytes = [System.Convert]::FromBase64String($inputStream)
    $parent = Split-Path $outputPath -Parent
    if ($parent -and -not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    [System.IO.File]::WriteAllBytes($outputPath, $bytes)
}

# ---------- Checks ----------
Require-Command dotnet
Require-Command npm
Require-Command tar
Require-Command docker

if (Test-Path $RootDir) {
    Write-Error "Directory '$RootDir' already exists. Remove it or run the script elsewhere."
    exit 1
}

# ---------- Create structure ----------
New-Item -ItemType Directory -Path $RootDir -Force | Out-Null
Set-Location $RootDir
New-Item -ItemType Directory -Path "backend" -Force | Out-Null
New-Item -ItemType Directory -Path "frontend" -Force | Out-Null

# Docker Compose
@"
version: "3.9"

services:
  postgres:
    image: postgres:16
    container_name: chaicrm-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: chaicrm
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

  maildev:
    image: maildev/maildev:2.1.0
    container_name: chaicrm-maildev
    restart: unless-stopped
    ports:
      - "1080:1080"
      - "1025:1025"

volumes:
  postgres-data:
"@ | Out-File -FilePath "docker-compose.yml" -Encoding utf8

# ---------- Backend (.NET) ----------
Set-Location backend

dotnet new sln -n ChaiCRM
dotnet new webapi -n ChaiCRM.Api -f net8.0
dotnet new classlib -n ChaiCRM.Domain -f net8.0
dotnet new classlib -n ChaiCRM.Application -f net8.0
dotnet new classlib -n ChaiCRM.Infrastructure -f net8.0
dotnet new webapi -n ChaiCRM.PublicApi -f net8.0

dotnet sln ChaiCRM.sln add ChaiCRM.Api/ChaiCRM.Api.csproj
dotnet sln ChaiCRM.sln add ChaiCRM.Domain/ChaiCRM.Domain.csproj
dotnet sln ChaiCRM.sln add ChaiCRM.Application/ChaiCRM.Application.csproj
dotnet sln ChaiCRM.sln add ChaiCRM.Infrastructure/ChaiCRM.Infrastructure.csproj
dotnet sln ChaiCRM.sln add ChaiCRM.PublicApi/ChaiCRM.PublicApi.csproj

dotnet add ChaiCRM.Api/ChaiCRM.Api.csproj reference ChaiCRM.Application/ChaiCRM.Application.csproj
dotnet add ChaiCRM.Api/ChaiCRM.Api.csproj reference ChaiCRM.Infrastructure/ChaiCRM.Infrastructure.csproj
dotnet add ChaiCRM.Application/ChaiCRM.Application.csproj reference ChaiCRM.Domain/ChaiCRM.Domain.csproj
dotnet add ChaiCRM.Infrastructure/ChaiCRM.Infrastructure.csproj reference ChaiCRM.Application/ChaiCRM.Application.csproj
dotnet add ChaiCRM.PublicApi/ChaiCRM.PublicApi.csproj reference ChaiCRM.Application/ChaiCRM.Application.csproj
dotnet add ChaiCRM.PublicApi/ChaiCRM.PublicApi.csproj reference ChaiCRM.Infrastructure/ChaiCRM.Infrastructure.csproj

# Prepare temp folder for tarballs
$TempDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

# ----- BACKEND SOURCE (copy the ENTIRE base64 block from the bash script here) -----
$backendBase64 = @"
H4sIANk69mkAA+y963bbRrIonN9ea94B4Z41m9qHhkjqwowt0SNLvjDjiyLJ8fm+JCsLIlsSYhJg
...
... (copy the complete base64 lines from your bash script, up to and including the line before EOF_BACKEND)
...
"@
$backendTar = Join-Path $TempDir "backend-source.tar.gz"
$backendBase64 | Write-Base64File -outputPath $backendTar
tar -xzf $backendTar -C (Get-Location)
# Restore packages
dotnet restore ChaiCRM.sln

Set-Location ..

# ---------- Frontend (React) ----------
Set-Location frontend

npm create vite@latest chaicrm-web -- --template react-ts
Set-Location chaicrm-web
npm install

# ----- FRONTEND SOURCE (copy the ENTIRE base64 block from the bash script here) -----
$frontendBase64 = @"
H4sIANA69mkAA+y9eZerSJInWp/np7iT887UTNEK9kX9KmsatCAkIQlJoKVPVx/2fRE7zNT77A8t
...
... (copy the complete base64 lines from your bash script, up to and including the line before EOF_FRONTEND)
...
"@
$frontendTar = Join-Path $TempDir "frontend-source.tar.gz"
$frontendBase64 | Write-Base64File -outputPath $frontendTar
tar -xzf $frontendTar -C (Get-Location)
npm install

Set-Location ../..

# ---------- Cleanup ----------
Invoke-Cleanup

# ---------- README ----------
@"
# ChaiCRM

Cleanly separated backend/frontend ChaiCRM workspace.

## Structure

- `backend/` contains the .NET 8 solution and API/application/domain/infrastructure projects.
- `frontend/chaicrm-web/` contains the Vite + React + TypeScript frontend.
- `docker-compose.yml` starts PostgreSQL and MailDev for local development.

## Next steps

1. Start infrastructure: `docker compose up -d`
2. Run the authenticated API: `cd backend && dotnet run --project ChaiCRM.Api`
3. Run the public API: `cd backend && dotnet run --project ChaiCRM.PublicApi`
4. Run the frontend: `cd frontend/chaicrm-web && npm run dev`
"@ | Out-File -FilePath "README.md" -Encoding utf8

Write-Host "ChaiCRM has been created successfully."