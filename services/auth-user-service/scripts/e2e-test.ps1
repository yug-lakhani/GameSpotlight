# e2e-test.ps1 - end-to-end API test for auth-user-service
# Creates a test user, logs in, fetches the user, bootstraps an admin, and deletes the test user.

param(
    [string]$BaseUrl = 'http://localhost:8087',
    [string]$TestUsername = "test_e2e_$(Get-Date -Format yyyyMMddHHmmss)",
    [string]$TestPassword = 'Password123!'
)

Write-Host "Using BaseUrl=$BaseUrl, TestUsername=$TestUsername"

function PostJson($uri, $body){
    return Invoke-RestMethod -Uri $uri -Method Post -Body ($body | ConvertTo-Json -Depth 6) -ContentType 'application/json'
}

# 1) Register test user
$regBody = @{ username = $TestUsername; email = "$TestUsername@example.local"; password = $TestPassword; displayName = "$TestUsername" }
Write-Host "Registering user $TestUsername..."
try{ $regResp = PostJson "$BaseUrl/api/auth/register" $regBody; Write-Host "Registered: $($regResp.username)" } catch { Write-Host "Register failed: $($_.Exception.Message)"; exit 1 }

# 2) Login test user
$loginBody = @{ username = $TestUsername; password = $TestPassword }
Write-Host "Logging in user $TestUsername..."
try{ $loginResp = PostJson "$BaseUrl/api/auth/login" $loginBody; $token = $loginResp.token; Write-Host "User token length: $($token.Length)" } catch { Write-Host "Login failed: $($_.Exception.Message)"; exit 1 }

# 3) Fetch by username (public)
Write-Host "Fetching user by username..."
try{ $userResp = Invoke-RestMethod -Uri "$BaseUrl/api/users/by-username/$TestUsername" -Method Get; Write-Host "Fetched: $($userResp.username) id=$($userResp.id)" } catch { Write-Host "Fetch failed: $($_.Exception.Message)"; exit 1 }

# 4) Bootstrap admin
$adminUser = "admin_e2e_$(Get-Date -Format yyyyMMddHHmmss)"
$adminPass = 'AdminPass123!'
$adminBody = @{ username = $adminUser; email = "$adminUser@example.local"; password = $adminPass; displayName = $adminUser; role = 'ADMIN' }
Write-Host "Bootstrapping admin $adminUser..."
try{ $boot = PostJson "$BaseUrl/api/auth/bootstrap" $adminBody; Write-Host "Bootstrap response: $($boot)" } catch { Write-Host "Bootstrap failed: $($_.Exception.Message)"; exit 1 }

# 5) Login admin
$adminLogin = @{ username = $adminUser; password = $adminPass }
try{ $adminResp = PostJson "$BaseUrl/api/auth/login" $adminLogin; $adminToken = $adminResp.token; Write-Host "Admin token obtained" } catch { Write-Host "Admin login failed: $($_.Exception.Message)"; exit 1 }

# 6) List users and find test user id
Write-Host "Listing users to find test user id..."
try{ $users = Invoke-RestMethod -Uri "$BaseUrl/api/users" -Method Get -Headers @{ Authorization = "Bearer $adminToken" } } catch { Write-Host "List users failed: $($_.Exception.Message)"; exit 1 }
$testUser = $users | Where-Object { $_.username -eq $TestUsername }
if (-not $testUser) { Write-Host "Test user not found in list"; exit 1 }
$testUserId = $testUser.id
Write-Host "Test user id: $testUserId"

# 7) Delete test user
Write-Host "Deleting test user id $testUserId..."
try{ Invoke-RestMethod -Uri "$BaseUrl/api/users/$testUserId" -Method Delete -Headers @{ Authorization = "Bearer $adminToken" }; Write-Host "Deleted test user" } catch { Write-Host "Delete failed: $($_.Exception.Message)"; exit 1 }

Write-Host "E2E test completed successfully"
