# verify-ca-start.ps1
# Usage: set env vars POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, JWT_SECRET
# POSTGRES_DB defaults to auth_db if not provided.
# Then run this script. It will check TCP connectivity and show the JDBC URL with sslmode=verify-ca.

$caPath = "$(Split-Path -Parent $PSScriptRoot)\ca\aiven-ca.pem"
if (-not (Test-Path $caPath)) {
    Write-Error "CA file not found at $caPath"
    exit 1
}

$pgHost = $env:POSTGRES_HOST
$pgPort = $env:POSTGRES_PORT
$pgDb = $env:POSTGRES_DB
if (-not $pgHost -or -not $pgPort) {
    Write-Host "Please set POSTGRES_HOST and POSTGRES_PORT environment variables first."
    Write-Host "Example: setx POSTGRES_HOST \"gamespotlightdb-...\"; setx POSTGRES_PORT \"22498\"" 
    exit 1
}

if (-not $pgDb) {
    $pgDb = 'auth_db'
}

Write-Host "Testing TCP connectivity to ${pgHost}:${pgPort}"
Test-NetConnection -ComputerName $pgHost -Port $pgPort | Format-List

$jdbcurl = "jdbc:postgresql://${pgHost}:${pgPort}/${pgDb}?sslmode=verify-ca&sslrootcert=$caPath"
Write-Host "\nUse this JDBC URL (insert your user/password into env vars):"
Write-Host $jdbcurl

if ($env:RUN -eq '1') {
    if (-not $env:POSTGRES_USER -or -not $env:POSTGRES_PASSWORD -or -not $env:JWT_SECRET) {
        Write-Error "Set POSTGRES_USER, POSTGRES_PASSWORD, and JWT_SECRET before running with RUN=1"
        exit 1
    }
    Write-Host "Starting service (maven spring-boot:run) with provided env vars..."
    Push-Location "$PSScriptRoot\.."
    mvn spring-boot:run
    Pop-Location
}
