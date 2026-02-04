# Start frontend Next.js dev server
# Make sure .env.local exists with NEXT_PUBLIC_API_URL=http://localhost:3001

Write-Host "Starting frontend on port 3000..." -ForegroundColor Green

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "Creating .env.local file..." -ForegroundColor Yellow
    @"
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
"@ | Out-File -FilePath ".env.local" -Encoding utf8
    Write-Host ".env.local created. Please restart the dev server." -ForegroundColor Green
}

# Start Next.js
npm run dev
