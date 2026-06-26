# Launch both Vite (frontend) and API server
$API_PORT = 5782
$VITE_PORT = 5173
$VITE_URL = "http://localhost:$VITE_PORT"
$API_URL = "http://localhost:$API_PORT"
$LOG_DIR = "$env:TEMP\product-ai-logs"

# Kill any processes using these ports
foreach ($port in @($API_PORT, $VITE_PORT)) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        $conn | ForEach-Object { Kill -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
        Write-Host "[launcher] Killed process on port $port"
    }
}
Start-Sleep -Milliseconds 500

$node = "D:\node-js\node.exe"
$wd = "D:\00product-ai"

# Start API server
Write-Host "[launcher] Starting API server on port $API_PORT..."
Start-Process -FilePath $node -ArgumentList "dist/server/index.js" -WorkingDirectory $wd -WindowStyle Hidden

# Start Vite frontend
Write-Host "[launcher] Starting Vite frontend on port $VITE_PORT..."
Start-Process -FilePath $node -ArgumentList "node_modules\vite\bin\vite.js","--port $VITE_PORT" -WorkingDirectory $wd -WindowStyle Hidden

# Wait for both to come up
Start-Sleep -Seconds 4

# Verify
$viteOk = try { Invoke-WebRequest -Uri $VITE_URL -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop | Select-Object -ExpandProperty StatusCode } catch { $null }
$apiOk = try { Invoke-WebRequest -Uri "$API_URL/api/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop | Select-Object -ExpandProperty StatusCode } catch { $null }

if ($viteOk -eq 200) {
    Write-Host "[launcher] Frontend UP at $VITE_URL" -ForegroundColor Green
} else {
    Write-Host "[launcher] Frontend FAILED to start" -ForegroundColor Red
}

if ($apiOk -eq 200) {
    Write-Host "[launcher] API server UP at $API_URL" -ForegroundColor Green
} else {
    Write-Host "[launcher] API server FAILED to start" -ForegroundColor Red
}
