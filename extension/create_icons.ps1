# Create minimal valid PNG icons for Chrome extension
# These are simple 1-pixel PNG files that will work as placeholders

$iconsDir = Join-Path $PSScriptRoot "icons"
New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null

# Base64 encoded minimal 1x1 green PNG (valid PNG file)
$png1x1 = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")

# Create icon files (Chrome will scale them)
$sizes = @(16, 48, 128)

foreach ($size in $sizes) {
    $iconPath = Join-Path $iconsDir "icon$size.png"
    [System.IO.File]::WriteAllBytes($iconPath, $png1x1)
    Write-Host "Created $iconPath"
}

Write-Host "`nIcons created successfully!"
Write-Host "Note: These are minimal placeholder icons. You can replace them with custom icons later."




