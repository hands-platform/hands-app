param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [int]$ApiPort = 3000,
  [int]$AdminPort = 3101
)

$ErrorActionPreference = "Stop"

function Stop-ProcessIfRunning {
  param([int]$ProcessId)

  if (-not $ProcessId) {
    return
  }

  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $ProcessId -Force
  }
}

function Stop-HandsPortListener {
  param([int]$Port)

  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    $processId = $listener.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue).CommandLine
    $isHandsNode =
      $process -and
      $process.ProcessName -eq "node" -and
      (
        $commandLine -match "dist[/\\]main\.js" -or
        $commandLine -match "next[/\\]dist[/\\]server[/\\]lib[/\\]start-server\.js" -or
        $commandLine -match "next[/\\]dist[/\\]bin[/\\]next"
      )

    if ($isHandsNode) {
      Stop-Process -Id $processId -Force
      Write-Host "Stopped lingering HANDS listener on port $Port (PID $processId)"
    }
  }
}

$statePath = Join-Path $RepoRoot "logs\hands-local\state.json"
if (-not (Test-Path $statePath)) {
  Write-Host "No HANDS local state file found at $statePath"
  Stop-HandsPortListener -Port $ApiPort
  Stop-HandsPortListener -Port $AdminPort
  exit 0
}

$state = Get-Content -Raw $statePath | ConvertFrom-Json
foreach ($processId in @($state.apiPid, $state.adminPid)) {
  Stop-ProcessIfRunning -ProcessId $processId
}

Stop-HandsPortListener -Port $state.apiPort
Stop-HandsPortListener -Port $state.adminPort
Remove-Item $statePath -Force
Write-Host "HANDS local services stopped"
