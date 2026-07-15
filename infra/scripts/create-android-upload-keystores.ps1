param(
  [string]$RepoRoot = "C:\dev\massage-on-demand-vn",
  [string]$SecretRoot = "C:\dev\hands-secrets\android-signing",
  [switch]$Force,
  [switch]$SkipKeyProperties
)

$ErrorActionPreference = "Stop"

function New-StrongPassword {
  param([int]$ByteCount = 24)

  $bytes = New-Object byte[] $ByteCount
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return [Convert]::ToBase64String($bytes).Replace("+", "A").Replace("/", "B").TrimEnd("=")
}

function Write-Utf8NoBom {
  param(
    [string]$Path,
    [string]$Content
  )

  $encoding = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Resolve-Keytool {
  $command = Get-Command keytool.exe -ErrorAction SilentlyContinue
  if (-not $command) {
    $command = Get-Command keytool -ErrorAction SilentlyContinue
  }
  if (-not $command) {
    throw "keytool was not found. Install or repair Java JDK, then rerun this script."
  }
  return $command.Source
}

function ConvertTo-CommandLineArgument {
  param([string]$Value)

  if ($Value -notmatch '[\s"]') {
    return $Value
  }

  return '"' + ($Value -replace '"', '\"') + '"'
}

function Invoke-Keytool {
  param(
    [string]$KeytoolPath,
    [string[]]$Arguments
  )

  $stdoutPath = [System.IO.Path]::GetTempFileName()
  $stderrPath = [System.IO.Path]::GetTempFileName()
  try {
    $argumentLine = ($Arguments | ForEach-Object { ConvertTo-CommandLineArgument -Value $_ }) -join " "
    $process = Start-Process `
      -FilePath $KeytoolPath `
      -ArgumentList $argumentLine `
      -NoNewWindow `
      -Wait `
      -PassThru `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath
    $stdout = Get-Content -Raw -Path $stdoutPath -ErrorAction SilentlyContinue
    $stderr = Get-Content -Raw -Path $stderrPath -ErrorAction SilentlyContinue
    if ($process.ExitCode -ne 0) {
      throw "keytool failed with exit code $($process.ExitCode). $stderr $stdout"
    }
    return $stdout
  } finally {
    Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
  }
}

function Format-Fingerprint {
  param([byte[]]$Bytes)

  return ([BitConverter]::ToString($Bytes)).Replace("-", ":")
}

function Get-CertificateFingerprints {
  param(
    [string]$KeystorePath,
    [string]$Alias,
    [string]$StorePassword,
    [string]$KeytoolPath
  )

  $exportArgs = @(
    "-exportcert",
    "-rfc",
    "-keystore",
    $KeystorePath,
    "-alias",
    $Alias,
    "-storepass",
    $StorePassword
  )
  $pem = Invoke-Keytool -KeytoolPath $KeytoolPath -Arguments $exportArgs

  $base64 = ($pem -split "\r?\n" |
    Where-Object { $_ -and $_ -notmatch "-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----" }) -join ""
  $certificateBytes = [Convert]::FromBase64String($base64)
  $certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 @(,$certificateBytes)
  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  $sha256 = [System.Security.Cryptography.SHA256]::Create()

  try {
    return @(
      "SHA1: $(Format-Fingerprint -Bytes ($sha1.ComputeHash($certificate.RawData)))",
      "SHA256: $(Format-Fingerprint -Bytes ($sha256.ComputeHash($certificate.RawData)))"
    )
  } finally {
    $sha1.Dispose()
    $sha256.Dispose()
    $certificate.Dispose()
  }
}

function New-AppUploadKey {
  param(
    [string]$Label,
    [string]$Alias,
    [string]$KeystorePath,
    [string]$KeyPropertiesPath,
    [string]$DName,
    [string]$KeytoolPath
  )

  if ((Test-Path $KeystorePath) -and -not $Force) {
    throw "$KeystorePath already exists. Move it, back it up, or rerun with -Force if you intentionally want to replace it."
  }

  $storePassword = New-StrongPassword
  $keyPassword = $storePassword
  $keystoreDir = Split-Path -Parent $KeystorePath
  $keyPropertiesDir = Split-Path -Parent $KeyPropertiesPath
  New-Item -ItemType Directory -Force -Path $keystoreDir | Out-Null
  New-Item -ItemType Directory -Force -Path $keyPropertiesDir | Out-Null

  if (Test-Path $KeystorePath) {
    Remove-Item -LiteralPath $KeystorePath -Force
  }

  $generateArgs = @(
    "-genkeypair",
    "-v",
    "-keystore",
    $KeystorePath,
    "-storetype",
    "PKCS12",
    "-keyalg",
    "RSA",
    "-keysize",
    "2048",
    "-validity",
    "10000",
    "-alias",
    $Alias,
    "-storepass",
    $storePassword,
    "-keypass",
    $keyPassword,
    "-dname",
    $DName,
    "-noprompt"
  )
  Invoke-Keytool -KeytoolPath $KeytoolPath -Arguments $generateArgs | Out-Null

  if (-not $SkipKeyProperties) {
    $storeFile = $KeystorePath.Replace("\", "/")
    $content = @"
storeFile=$storeFile
storePassword=$storePassword
keyAlias=$Alias
keyPassword=$keyPassword
"@
    Write-Utf8NoBom -Path $KeyPropertiesPath -Content $content
  }

  $fingerprints = Get-CertificateFingerprints `
    -KeystorePath $KeystorePath `
    -Alias $Alias `
    -StorePassword $storePassword `
    -KeytoolPath $KeytoolPath

  return [pscustomobject]@{
    label = $Label
    alias = $Alias
    keystore = $KeystorePath
    keyProperties = if ($SkipKeyProperties) { $null } else { $KeyPropertiesPath }
    fingerprints = $fingerprints
  }
}

$repoRootFull = (Resolve-Path $RepoRoot).Path
$secretRootFull = if (Test-Path $SecretRoot) {
  (Resolve-Path $SecretRoot).Path
} else {
  New-Item -ItemType Directory -Force -Path $SecretRoot | Out-Null
  (Resolve-Path $SecretRoot).Path
}
$keytool = Resolve-Keytool

$customer = New-AppUploadKey `
  -Label "customer" `
  -Alias "hands-customer" `
  -KeystorePath (Join-Path $secretRootFull "hands-customer-upload.jks") `
  -KeyPropertiesPath (Join-Path $repoRootFull "apps\customer_app\android\key.properties") `
  -DName "CN=HANDS Customer,O=HANDS,L=Ho Chi Minh City,C=VN" `
  -KeytoolPath $keytool

$provider = New-AppUploadKey `
  -Label "provider" `
  -Alias "hands-provider" `
  -KeystorePath (Join-Path $secretRootFull "hands-provider-upload.jks") `
  -KeyPropertiesPath (Join-Path $repoRootFull "apps\provider_app\android\key.properties") `
  -DName "CN=HANDS Provider,O=HANDS,L=Ho Chi Minh City,C=VN" `
  -KeytoolPath $keytool

$summaryPath = Join-Path $secretRootFull "android-signing-summary.txt"
$summaryLines = New-Object System.Collections.Generic.List[string]
$summaryLines.Add("HANDS Android upload signing summary")
$summaryLines.Add("Generated at: $((Get-Date).ToString("o"))")
$summaryLines.Add("Repo root: $repoRootFull")
$summaryLines.Add("Secret root: $secretRootFull")
$summaryLines.Add("")
$summaryLines.Add("Customer app ID: com.massagevn.customer.customer_app")
$summaryLines.Add("Customer keystore: $($customer.keystore)")
$summaryLines.Add("Customer key.properties: $($customer.keyProperties)")
$summaryLines.Add("Customer fingerprints:")
$customer.fingerprints | ForEach-Object { $summaryLines.Add("  $_") }
$summaryLines.Add("")
$summaryLines.Add("Provider app ID: com.massagevn.provider.provider_app")
$summaryLines.Add("Provider keystore: $($provider.keystore)")
$summaryLines.Add("Provider key.properties: $($provider.keyProperties)")
$summaryLines.Add("Provider fingerprints:")
$provider.fingerprints | ForEach-Object { $summaryLines.Add("  $_") }
$summaryLines.Add("")
$summaryLines.Add("Do not commit .jks, .keystore, or key.properties files.")
$summaryLines.Add("Back up this secret folder in a secure password manager or private vault.")
$summary = $summaryLines -join [Environment]::NewLine

Write-Utf8NoBom -Path $summaryPath -Content $summary

Write-Host "HANDS Android upload keys are ready."
Write-Host "Secret folder: $secretRootFull"
Write-Host "Summary: $summaryPath"
Write-Host "Next: run flutter build appbundle --release in apps/customer_app and apps/provider_app for Play Console upload."
