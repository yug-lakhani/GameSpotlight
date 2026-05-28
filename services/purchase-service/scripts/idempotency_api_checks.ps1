param(
    [string]$BaseUrl = "http://localhost:8083",
    [string]$UserId = "idem-api-user"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function ConvertTo-Base64Url {
    param([byte[]]$Bytes)
    ([Convert]::ToBase64String($Bytes)).TrimEnd('=') -replace '\+', '-' -replace '/', '_'
}

function New-Hs256Jwt {
    param(
        [string]$Subject,
        [string]$Secret = "[REDACTED-JWT]"
    )

    $headerJson = (@{ alg = "HS256"; typ = "JWT" } | ConvertTo-Json -Compress)
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $payloadJson = (@{ sub = $Subject; iat = $now } | ConvertTo-Json -Compress)

    $header = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes($headerJson))
    $payload = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes($payloadJson))
    $unsigned = "$header.$payload"

    $hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($Secret))
    $sig = ConvertTo-Base64Url ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($unsigned)))
    "$unsigned.$sig"
}

function Invoke-CreatePurchase {
    param(
        [string]$Url,
        [string]$Auth,
        [string]$IdempotencyKey,
        [string]$JsonBody
    )

    try {
        $resp = Invoke-WebRequest -Uri $Url -Method POST -Headers @{ Authorization = $Auth; "Idempotency-Key" = $IdempotencyKey } -ContentType "application/json" -Body $JsonBody -UseBasicParsing
        return [pscustomobject]@{ status = [int]$resp.StatusCode; raw = $resp.Content }
    }
    catch {
        $response = $_.Exception.Response
        if ($null -ne $response) {
            $stream = $response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $raw = $reader.ReadToEnd()
            return [pscustomobject]@{ status = [int]$response.StatusCode; raw = $raw }
        }
        throw
    }
}

function Get-JsonId {
    param([string]$Raw)
    if ([string]::IsNullOrWhiteSpace($Raw)) { return $null }
    try { return ($Raw | ConvertFrom-Json).id } catch { return $null }
}

function Cleanup-UserPurchases {
    param([string]$Base, [string]$Uid)
    $items = @()
    try { $items = @(Invoke-RestMethod -Uri "$Base/api/purchases/user/$Uid" -Method GET) } catch {}
    foreach ($p in $items) {
        try { Invoke-WebRequest -Uri "$Base/api/purchases/$($p.id)" -Method DELETE -UseBasicParsing | Out-Null } catch {}
    }
}

$token = New-Hs256Jwt -Subject $UserId
$authHeader = "Bearer $token"

$runId = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$seqGame = "idem-seq-game-$runId"
$parGame = "idem-par-game-$runId"
$seqKey = "seq-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$parKey = "par-" + [DateTimeOffset]::UtcNow.AddSeconds(1).ToUnixTimeMilliseconds()

Cleanup-UserPurchases -Base $BaseUrl -Uid $UserId

# Sequential smoke test
$seqBody = (@{ gameId = $seqGame; price = 11.11; purchaseStatus = "COMPLETED" } | ConvertTo-Json)
$seq1 = Invoke-CreatePurchase -Url "$BaseUrl/api/purchases" -Auth $authHeader -IdempotencyKey $seqKey -JsonBody $seqBody
$seq2 = Invoke-CreatePurchase -Url "$BaseUrl/api/purchases" -Auth $authHeader -IdempotencyKey $seqKey -JsonBody $seqBody

$seq1Id = Get-JsonId -Raw $seq1.raw
$seq2Id = Get-JsonId -Raw $seq2.raw

# Same key with different payload must fail with conflict
$mismatchBody = (@{ gameId = $seqGame; price = 99.99; purchaseStatus = "COMPLETED" } | ConvertTo-Json)
$seqMismatch = Invoke-CreatePurchase -Url "$BaseUrl/api/purchases" -Auth $authHeader -IdempotencyKey $seqKey -JsonBody $mismatchBody

# Parallel same-key test
$parBody = (@{ gameId = $parGame; price = 22.22; purchaseStatus = "COMPLETED" } | ConvertTo-Json)
$jobScript = {
    param($Url, $Auth, $Key, $Body)
    try {
        $r = Invoke-WebRequest -Uri $Url -Method POST -Headers @{ Authorization = $Auth; "Idempotency-Key" = $Key } -ContentType "application/json" -Body $Body -UseBasicParsing
        [pscustomobject]@{ status = [int]$r.StatusCode; raw = $r.Content }
    }
    catch {
        $resp = $_.Exception.Response
        if ($null -ne $resp) {
            $stream = $resp.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            [pscustomobject]@{ status = [int]$resp.StatusCode; raw = $reader.ReadToEnd() }
        } else {
            [pscustomobject]@{ status = -1; raw = $_.Exception.Message }
        }
    }
}

$j1 = Start-Job -ScriptBlock $jobScript -ArgumentList "$BaseUrl/api/purchases", $authHeader, $parKey, $parBody
$j2 = Start-Job -ScriptBlock $jobScript -ArgumentList "$BaseUrl/api/purchases", $authHeader, $parKey, $parBody
Wait-Job -Job $j1, $j2 | Out-Null
$parResults = @(Receive-Job -Job $j1, $j2)
Remove-Job -Job $j1, $j2 -Force | Out-Null

$par1 = $parResults[0]
$par2 = $parResults[1]
$par1Id = Get-JsonId -Raw $par1.raw
$par2Id = Get-JsonId -Raw $par2.raw

# Final DB-visible verification through API
$final = @(Invoke-RestMethod -Uri "$BaseUrl/api/purchases/user/$UserId" -Method GET)
$allRecords = if ($null -eq $final) {
    @()
} elseif ($final -is [System.Array]) {
    $final
} else {
    @($final)
}
$seqCount = @($allRecords | Where-Object { $_.gameId -eq $seqGame }).Count
$parCount = @($allRecords | Where-Object { $_.gameId -eq $parGame }).Count

[pscustomobject]@{
    userId = $UserId
    sequential = [pscustomobject]@{
        gameId = $seqGame
        key = $seqKey
        firstStatus = $seq1.status
        secondStatus = $seq2.status
        mismatchStatus = $seqMismatch.status
        firstId = $seq1Id
        secondId = $seq2Id
        sameId = ($seq1Id -and ($seq1Id -eq $seq2Id))
        recordsForGame = $seqCount
    }
    parallel = [pscustomobject]@{
        gameId = $parGame
        key = $parKey
        firstStatus = $par1.status
        secondStatus = $par2.status
        firstId = $par1Id
        secondId = $par2Id
        sameId = ($par1Id -and ($par1Id -eq $par2Id))
        recordsForGame = $parCount
    }
    totalUserRecords = $allRecords.Count
} | ConvertTo-Json -Depth 6
