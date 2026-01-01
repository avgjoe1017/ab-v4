# Kill process using port 8787 (or specified port)
param(
    [int]$Port = 8787
)

Write-Host "Checking for processes using port $Port..." -ForegroundColor Cyan

$connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

if ($connection) {
    $processId = $connection.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    
    if ($process) {
        Write-Host "Found process: $($process.ProcessName) (PID: $processId)" -ForegroundColor Yellow
        Write-Host "Path: $($process.Path)" -ForegroundColor Gray
        
        # Kill the process
        Stop-Process -Id $processId -Force
        Write-Host "Successfully killed process $processId" -ForegroundColor Green
        Write-Host "Port $Port is now free. You can start the API server." -ForegroundColor Green
    } else {
        Write-Host "Connection found but process no longer exists (zombie connection)" -ForegroundColor Yellow
        Write-Host "Port may still be in use. Try restarting your terminal or computer." -ForegroundColor Yellow
    }
} else {
    Write-Host "No process found using port $Port" -ForegroundColor Green
    Write-Host "The port is free. You can start the API server." -ForegroundColor Green
}
