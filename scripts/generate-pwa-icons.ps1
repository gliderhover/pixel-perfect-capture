# Regenerates PNG app icons — layout matches public/icons/icon-source.svg
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$dir = Join-Path $PSScriptRoot "..\public\icons"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

function Draw-PixelGridIcon {
  param([int]$W)
  $bmp = New-Object System.Drawing.Bitmap $W, $W
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $g.Clear([System.Drawing.Color]::FromArgb(255, 11, 16, 32))

  $cell = [int][math]::Round($W * 0.16015625)
  $gap = [int][math]::Round($W * 0.0546875)
  $total = 3 * $cell + 2 * $gap
  $off = [int](($W - $total) / 2)

  $brushMain = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 30, 184, 122))
  $brushCenter = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 46, 232, 184))

  for ($row = 0; $row -lt 3; $row++) {
    for ($col = 0; $col -lt 3; $col++) {
      $x = $off + $col * ($cell + $gap)
      $y = $off + $row * ($cell + $gap)
      $b = if ($row -eq 1 -and $col -eq 1) { $brushCenter } else { $brushMain }
      $g.FillRectangle($b, $x, $y, $cell, $cell)
    }
  }

  $brushMain.Dispose()
  $brushCenter.Dispose()
  $g.Dispose()
  return $bmp
}

function Save-Png {
  param([int]$size, [string]$name)
  $bmp = Draw-PixelGridIcon $size
  $path = Join-Path $dir $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $path (${size}x${size})"
}

Save-Png 180 "apple-touch-icon.png"
Save-Png 192 "icon-192.png"
Save-Png 512 "icon-512.png"
Write-Host "Done."
