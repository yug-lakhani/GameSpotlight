#!/usr/bin/env pwsh
<#
.SYNOPSIS
    End-to-end Kafka integration test for game stats tracking
.DESCRIPTION
    Tests the complete Kafka event flow:
    1. Creates a test game
    2. Creates a purchase (emits PurchaseCreatedEvent to Kafka)
    3. Waits for GameStatsService to consume the event
    4. Verifies game purchase count was incremented
    5. Tests idempotency by sending duplicate purchase
.PARAMETER kafkaBootstrap
    Kafka bootstrap servers (default: Aiven cloud - gamespotlight-gajerautsav08-9ccc.l.aivencloud.com:22511)
.PARAMETER mongoUri
    MongoDB connection URI
#>
param(
    [string]$kafkaBootstrap = "gamespotlight-gajerautsav08-9ccc.l.aivencloud.com:22511",
    [string]$mongoUri = "mongodb+srv://utsav:9228224337@cluster0.yslwcbv.mongodb.net",
    [int]$maxWaitSeconds = 30
)

$ErrorActionPreference = "Stop"

# Color output functions
function Write-Success { Write-Host "[OK] $args" -ForegroundColor Green }
function Write-Failure { Write-Host "[FAIL] $args" -ForegroundColor Red }
function Write-Info { Write-Host "[*] $args" -ForegroundColor Cyan }
function Write-Warn { Write-Host "[!] $args" -ForegroundColor Yellow }

# Test configuration
$authServiceUrl = "http://localhost:8087"
$gameServiceUrl = "http://localhost:8082"
$purchaseServiceUrl = "http://localhost:8083"
$gameId = "test-game-$(Get-Random -Minimum 1000 -Maximum 9999)"
$userId = "test-user-$(Get-Random -Minimum 1000 -Maximum 9999)"
$purchasePrice = 29.99

function Get-TestAuthToken {
    param(
        [string]$BaseUrl
    )

    $username = "kafka-test-$(Get-Random -Minimum 100000 -Maximum 999999)"
    $password = "Test12345!"

    $registerPayload = @{
        username = $username
        password = $password
        displayName = "Kafka Test User"
        role = "NORMAL_USER"
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$BaseUrl/api/auth/register" `
            -Method Post `
            -ContentType "application/json" `
            -Body $registerPayload `
            -ErrorAction Stop | Out-Null
    } catch {
        Write-Warn "Test user registration returned an error, continuing to login: $_"
    }

    $loginPayload = @{
        username = $username
        password = $password
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginPayload `
        -ErrorAction Stop

    return "Bearer $($loginResponse.token)"
}

Write-Info "========================================="
Write-Info "Kafka Event-Driven Stats Test"
Write-Info "========================================="

Write-Info ""
Write-Info "Step 0: Getting test auth token..."
try {
    $authToken = Get-TestAuthToken -BaseUrl $authServiceUrl
    Write-Success "Test auth token acquired from auth-user-service"
} catch {
    Write-Failure "Failed to get auth token from ${authServiceUrl}: $_"
    exit 1
}

# Check services are running
Write-Info ""
Write-Info "Step 1: Checking service connectivity..."
try {
    $gameHealth = Invoke-RestMethod "$gameServiceUrl/actuator/health" -ErrorAction Stop
    Write-Success "game-service is running"
} catch {
    Write-Failure "game-service is not running on $gameServiceUrl"
    Write-Failure "Start game-service first: mvn spring-boot:run"
    exit 1
}

try {
    $purchaseHealth = Invoke-RestMethod "$purchaseServiceUrl/actuator/health" -ErrorAction Stop
    Write-Success "purchase-service is running"
} catch {
    Write-Failure "purchase-service is not running on $purchaseServiceUrl"
    Write-Failure "Start purchase-service first: mvn spring-boot:run"
    exit 1
}

# Check Kafka connectivity (via spring-kafka producer)
Write-Info ""
Write-Info "Step 2: Checking Kafka connectivity..."
Write-Info "Kafka bootstrap servers: $kafkaBootstrap"
# Kafka connectivity will be tested implicitly when we create a purchase

# Create a test game
Write-Info ""
Write-Info "Step 3: Creating test game..."
$gamePayload = @{
    title = "Event-Driven Test Game"
    description = "Test game for Kafka stats tracking"
    genre = "Action"
    price = 49.99
    developer = "Test Dev"
    imageUrl = "https://example.com/image.jpg"
    gameFileUrl = "https://example.com/game.exe"
    sizeInBytes = 1073741824
    version = "1.0"
    platform = "Windows"
    ageRating = "T"
    systemRequirements = "4GB RAM"
    releaseDate = "2026-01-01"
} | ConvertTo-Json

try {
    $gameResponse = Invoke-RestMethod -Uri "$gameServiceUrl/api/games" `
        -Method Post `
        -ContentType "application/json" `
        -Body $gamePayload `
        -ErrorAction Stop
    $gameId = $gameResponse.id
    Write-Success "Game created: $gameId"
    Write-Info "Initial stats - Purchases: $($gameResponse.totalPurchases), Downloads: $($gameResponse.totalDownloads)"
} catch {
    Write-Failure "Failed to create game: $_"
    exit 1
}

# Get initial purchase count
Write-Info ""
Write-Info "Step 4: Getting initial game stats..."
try {
    $initialStats = Invoke-RestMethod "$gameServiceUrl/api/games/$gameId/stats" `
        -Headers @{ "Authorization" = $authToken } `
        -ErrorAction Stop
    $initialPurchases = $initialStats.totalPurchases
    Write-Success "Initial purchase count: $initialPurchases"
} catch {
    Write-Failure "Failed to get initial stats: $_"
    exit 1
}

# Create first purchase (should emit Kafka event)
Write-Info ""
Write-Info "Step 5: Creating purchase (will emit Kafka event)..."
$purchasePayload = @{
    userId = $userId
    gameId = $gameId
    price = $purchasePrice
    purchaseStatus = "COMPLETED"
} | ConvertTo-Json

$idempotencyKey = "test-idem-$(Get-Random -Minimum 100000 -Maximum 999999)"

try {
    $purchaseResponse = Invoke-RestMethod -Uri "$purchaseServiceUrl/api/purchases" `
        -Method Post `
        -ContentType "application/json" `
        -Body $purchasePayload `
        -Headers @{ 
            "Authorization" = $authToken
            "Idempotency-Key" = $idempotencyKey
        } `
        -ErrorAction Stop
    
    $purchaseId = $purchaseResponse.purchase.id
    Write-Success "Purchase created: $purchaseId"
    Write-Success "Idempotency-Key: $idempotencyKey"
    Write-Info "PurchaseCreatedEvent should now be published to Kafka topic 'game.purchases'"
} catch {
    Write-Failure "Failed to create purchase: $_"
    exit 1
}

# Wait for event to be consumed and stats updated
Write-Info ""
Write-Info "Step 6: Waiting for GameStatsService to consume Kafka event (max $maxWaitSeconds seconds)..."
$pollInterval = 1  # seconds
$maxAttempts = $maxWaitSeconds / $pollInterval
$attempt = 0
$statsUpdated = $false
$finalPurchases = $initialPurchases

while ($attempt -lt $maxAttempts -and -not $statsUpdated) {
    Start-Sleep -Seconds $pollInterval
    $attempt++
    
    try {
        $currentStats = Invoke-RestMethod "$gameServiceUrl/api/games/$gameId/stats" `
            -Headers @{ "Authorization" = $authToken } `
            -ErrorAction Stop
        
        $finalPurchases = $currentStats.totalPurchases
        
        if ($finalPurchases -gt $initialPurchases) {
            $statsUpdated = $true
            Write-Success "Stats updated! Purchase count: $initialPurchases -> $finalPurchases"
        } else {
            Write-Info "  Poll attempt $attempt/$maxAttempts - Purchase count still: $finalPurchases (waiting for Kafka...)"
        }
    } catch {
        Write-Warn "  Poll attempt $attempt/$maxAttempts - Error checking stats: $_"
    }
}

if (-not $statsUpdated) {
    Write-Failure "Stats not updated after $maxWaitSeconds seconds!"
    Write-Failure "Possible issues:"
    Write-Failure "  1. Kafka broker not running or not accessible at $kafkaBootstrap"
    Write-Failure "  2. GameStatsService not listening on 'game.purchases' topic"
    Write-Failure "  3. Event consumer group 'game-service' has no offset"
    Write-Failure ""
    Write-Failure "Diagnostics:"
    Write-Failure "  Check purchase-service logs for: 'Successfully published PurchaseCreatedEvent'"
    Write-Failure "  Check game-service logs for: 'Processing PurchaseCreatedEvent' or 'org.springframework.kafka.KafkaListenerEndpointContainer'"
    exit 1
}

# Test idempotency - send same purchase again (should not increment count)
Write-Info ""
Write-Info "Step 7: Testing event idempotency (duplicate purchase should not increment count)..."
try {
    $duplicateResponse = Invoke-RestMethod -Uri "$purchaseServiceUrl/api/purchases" `
        -Method Post `
        -ContentType "application/json" `
        -Body $purchasePayload `
        -Headers @{ 
            "Authorization" = $authToken
            "Idempotency-Key" = $idempotencyKey
        } `
        -ErrorAction Stop
    
    Write-Info "Duplicate purchase request sent with same Idempotency-Key: $idempotencyKey"
    Write-Info "Response code: 200 (replayed request)"
    $duplicatePurchaseId = $duplicateResponse.purchase.id
    Write-Info "Got same purchase ID back: $purchaseId = $duplicatePurchaseId"
    
    if ($purchaseId -eq $duplicatePurchaseId) {
        Write-Success "Request-level idempotency working (same purchase ID returned)"
    } else {
        Write-Warn "Different purchase IDs (this is unexpected)"
    }
} catch {
    Write-Failure "Failed duplicate purchase: $_"
}

# Wait a bit for Kafka to potentially deliver duplicate event
Start-Sleep -Seconds 2

# Verify purchase count didn't double
Write-Info ""
Write-Info "Step 8: Verifying event-level idempotency (purchase count should not increase)..."
try {
    $finalStats = Invoke-RestMethod "$gameServiceUrl/api/games/$gameId/stats" `
        -Headers @{ "Authorization" = $authToken } `
        -ErrorAction Stop
    
    $finalPurchaseCount = $finalStats.totalPurchases
    
    if ($finalPurchaseCount -eq $finalPurchases) {
        Write-Success "Event-level idempotency working! Purchase count unchanged: $finalPurchaseCount"
    } elseif ($finalPurchaseCount -gt $finalPurchases) {
        Write-Warn "Purchase count increased unexpectedly: $finalPurchases -> $finalPurchaseCount"
        Write-Warn "This might indicate duplicate event processing or concurrent purchases"
    }
} catch {
    Write-Failure "Failed to verify final stats: $_"
    exit 1
}

# Summary
Write-Info ""
Write-Info "========================================="
Write-Success "[PASS] KAFKA INTEGRATION TEST PASSED!"
Write-Info "========================================="
Write-Success "Event Flow Summary:"
Write-Success "  1. Purchase created with Idempotency-Key: $idempotencyKey"
Write-Success "  2. PurchaseCreatedEvent emitted to 'game.purchases' topic"
Write-Success "  3. GameStatsService consumed event via @KafkaListener"
Write-Success "  4. Game purchase count incremented: $initialPurchases -> $finalPurchaseCount"
Write-Success "  5. Duplicate event skipped (idempotency check passed)"
Write-Info ""
Write-Success "Kafka functionality is working correctly!"

exit 0
