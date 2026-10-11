# Start the LearnLoop API (port 8000) and web app (port 5173) together. Ctrl+C stops the web app; the API window closes with it.
$root = Split-Path -Parent $PSScriptRoot
$api = Start-Process -FilePath "$root\.venv\Scripts\python.exe" -ArgumentList "-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", "8000" -WorkingDirectory $root -PassThru -NoNewWindow
try {
    Set-Location "$root\web"
    npm run dev -- --strictPort
} finally {
    Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue
}
