param(
  [string]$BaseUrl = 'http://localhost:8080'
)

$ErrorActionPreference = 'Stop'

function Call-Api($Method, $Path, $Body, $Session) {
  $params = @{
    Method = $Method
    Uri = "$BaseUrl$Path"
    WebSession = $Session
    ContentType = 'application/json'
  }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 8)
  }
  try {
    $result = Invoke-RestMethod @params
  } catch {
    $bodyText = $_.ErrorDetails.Message
    if ($bodyText) { throw "$Path failed: $bodyText" }
    throw
  }
  if ($result.code -ne 0) {
    throw "$Path failed: $($result.message)"
  }
  return $result.data
}

$frontResp = Invoke-WebRequest -UseBasicParsing "$BaseUrl/"
$adminResp = Invoke-WebRequest -UseBasicParsing "$BaseUrl/admin"
if ($frontResp.StatusCode -ne 200 -or $adminResp.StatusCode -ne 200) {
  throw 'frontend routes failed'
}

$health = Call-Api GET '/api/health' $null (New-Object Microsoft.PowerShell.Commands.WebRequestSession)
if ($health.database -ne 'ok') {
  throw 'health database not ok'
}

$siteSettings = Call-Api GET '/api/site-settings' $null (New-Object Microsoft.PowerShell.Commands.WebRequestSession)
if (-not $siteSettings.site_name -or -not $siteSettings.support_email) {
  throw 'public site settings missing'
}

$userSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$username = "accept$suffix"
$email = "$username@example.hk"

$user = Call-Api POST '/api/auth/register' @{ username = $username; email = $email; password = 'Passw0rd!' } $userSession
$me = Call-Api GET '/api/auth/me' $null $userSession
if ($me.username -ne $username) { throw 'auth me mismatch' }

$admin = Call-Api POST '/api/admin/auth/login' @{ username = 'admin'; password = '123456' } $adminSession
$adminMe = Call-Api GET '/api/admin/auth/me' $null $adminSession
if ($adminMe.username -ne 'admin') { throw 'admin me mismatch' }

$newProduct = Call-Api POST '/api/admin/products' @{ name = "Acceptance VPS $suffix"; priceMonthly = 66; priceYearly = 660; stock = 5 } $adminSession
$products = Call-Api GET '/api/products' $null $userSession
if (-not ($products | Where-Object { $_.id -eq $newProduct.id })) {
  throw 'new product not visible publicly'
}

$order = Call-Api POST '/api/orders' @{ productId = $newProduct.id; cycle = 'monthly' } $userSession
$users = Call-Api GET '/api/admin/users' $null $adminSession
$createdUser = $users | Where-Object { $_.username -eq $username } | Select-Object -First 1
if (-not $createdUser) { throw 'registered user not in admin users' }

Call-Api POST "/api/admin/users/$($createdUser.id)/adjust-balance" @{ amount = 1000; remark = 'acceptance recharge' } $adminSession | Out-Null
$paid = Call-Api POST "/api/orders/$($order.id)/pay-with-balance" $null $userSession
if ($paid.payStatus -ne 'paid') { throw 'balance payment failed' }

$orders = Call-Api GET '/api/admin/orders' $null $adminSession
$paidOrder = $orders | Where-Object { $_.id -eq $order.id } | Select-Object -First 1
if ($paidOrder.payStatus -ne 'paid') { throw 'admin order status not paid' }

$server = Call-Api POST '/api/admin/servers' @{
  orderId = $order.id
  name = "ACC-$suffix"
  ip = '10.88.66.10'
  os = 'Ubuntu 22.04'
  loginUser = 'root'
  loginPassword = 'Secret!234'
  expiresAt = (Get-Date).AddDays(30).ToString('yyyy-MM-dd')
} $adminSession

$servers = Call-Api GET '/api/client/servers' $null $userSession
$clientServer = $servers | Where-Object { $_.id -eq $server.id } | Select-Object -First 1
if (-not $clientServer -or $clientServer.loginPassword -ne 'Secret!234') {
  throw 'client server not visible or password decrypt failed'
}

$renewOrder = Call-Api POST "/api/client/servers/$($server.id)/renew" @{ cycle = 'monthly' } $userSession
$renewPaid = Call-Api POST "/api/orders/$($renewOrder.id)/pay-with-balance" $null $userSession
if ($renewPaid.payStatus -ne 'paid') { throw 'renewal payment failed' }

$serverBeforeManualRenew = (Call-Api GET '/api/client/servers' $null $userSession | Where-Object { $_.id -eq $server.id } | Select-Object -First 1)
$manualRenewOrder = Call-Api POST "/api/client/servers/$($server.id)/renew" @{ cycle = 'monthly' } $userSession
$manualRenewPaid = Call-Api POST "/api/admin/orders/$($manualRenewOrder.id)/mark-paid" $null $adminSession
if ($manualRenewPaid.payStatus -ne 'paid') { throw 'manual renewal mark paid failed' }
$serverAfterManualRenew = (Call-Api GET '/api/client/servers' $null $userSession | Where-Object { $_.id -eq $server.id } | Select-Object -First 1)
if ([DateTime]$serverAfterManualRenew.expiresAt -le [DateTime]$serverBeforeManualRenew.expiresAt) {
  throw 'manual renewal did not extend server expiry'
}

$ticket = Call-Api POST '/api/client/tickets' @{ title = "Acceptance ticket $suffix"; content = 'Please check server.' } $userSession
Call-Api POST "/api/admin/tickets/$($ticket.id)/replies" @{ content = 'Acceptance reply.' } $adminSession | Out-Null

$tokenResult = Call-Api POST "/api/admin/users/$($createdUser.id)/impersonate" $null $adminSession
$impersonated = Call-Api POST '/api/auth/impersonate' @{ token = $tokenResult.token } (New-Object Microsoft.PowerShell.Commands.WebRequestSession)
$tokenReuseFailed = $false
try {
  Call-Api POST '/api/auth/impersonate' @{ token = $tokenResult.token } (New-Object Microsoft.PowerShell.Commands.WebRequestSession) | Out-Null
} catch {
  $tokenReuseFailed = $true
}
if (-not $tokenReuseFailed) { throw 'impersonation token reused successfully' }

$jobs = Call-Api POST '/api/admin/jobs/run' $null $adminSession
$logs = Call-Api GET '/api/admin/operation-logs' $null $adminSession
if (-not ($logs | Where-Object { $_.action -eq 'open_server' -and $_.targetId -eq $server.id })) {
  throw 'open_server operation log missing'
}

$wallet = Call-Api GET '/api/client/wallet/transactions' $null $userSession
if (-not ($wallet | Where-Object { $_.type -eq 'payment' })) {
  throw 'payment wallet transaction missing'
}

$dbUser = docker exec jiyun-mysql-1 mysql -ujiyun -pjiyun_password jiyun -N -e "select passwordHash from User where username='$username';"
if ($dbUser -match 'Passw0rd') { throw 'plain user password stored' }
$dbServer = docker exec jiyun-mysql-1 mysql -ujiyun -pjiyun_password jiyun -N -e "select loginPasswordEncrypted from Server where id='$($server.id)';"
if ($dbServer -match 'Secret!234') { throw 'plain server password stored' }

[PSCustomObject]@{
  frontendHome = $frontResp.StatusCode
  frontendAdmin = $adminResp.StatusCode
  health = $health.database
  registeredUser = $username
  productId = $newProduct.id
  orderNo = $order.orderNo
  serverId = $server.id
  renewalOrder = $renewOrder.orderNo
  manualRenewalOrder = $manualRenewOrder.orderNo
  ticketId = $ticket.id
  siteName = $siteSettings.site_name
  impersonationOneTime = $tokenReuseFailed
  walletTransactions = @($wallet).Count
  operationLogs = @($logs).Count
  jobs = ($jobs | ConvertTo-Json -Compress -Depth 6)
}
