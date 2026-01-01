# Start API dev server with automatic port cleanup
param(
    [int]$Port = 8787
)

Write-Host "Starting API development server..." -ForegroundColor Cyan

# Check if port is in use and kill the process
$connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($connection) {
    $processId = $connection.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "Found existing process on port $Port (PID: $processId), killing it..." -ForegroundColor Yellow
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }
}

# Start the dev server
Write-Host "Starting server on port $Port..." -ForegroundColor Green
pnpm -C apps/api dev







