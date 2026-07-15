param(
  [string]$EnvFile = ".env",
  [string]$ComposeFile = "docker-compose.prod.yml",
  [switch]$SkipBuild,
  [switch]$IncludeSeed,
  [switch]$SkipSmoke
)

$ErrorActionPreference = "Stop"

function Run-Step {
  param(
    [string]$Name,
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "==> $Name"
  & $Command
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is not installed or not available on PATH."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not installed or not available on PATH."
}

$resolvedEnvFile = (Resolve-Path -LiteralPath $EnvFile).Path
$resolvedComposeFile = (Resolve-Path -LiteralPath $ComposeFile).Path

Run-Step "Validate environment" {
  node infra/scripts/check-env.mjs $resolvedEnvFile
}

$env:HANDS_ENV_FILE = $resolvedEnvFile
$compose = @("compose", "--env-file", $resolvedEnvFile, "-f", $resolvedComposeFile)

if ($SkipBuild) {
  Write-Host "Using existing production images."
} else {
  Run-Step "Build production images" {
    docker @compose build
  }
}

Run-Step "Start production data services" {
  docker @compose up -d postgres redis minio
}

Run-Step "Run Prisma migrations" {
  docker @compose run --rm api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
}

Run-Step "Start production application services" {
  docker @compose up -d
}

if ($IncludeSeed) {
  Run-Step "Seed demo data" {
    docker @compose exec api npm run prisma:seed --workspace @massage-vn/api
  }
}

if (-not $SkipSmoke) {
  Run-Step "Run E2E smoke script" {
    $env:API_BASE_URL = "http://localhost/api"
    node infra/scripts/api-smoke.mjs
  }
}

Write-Host ""
Write-Host "Deployment flow completed."
