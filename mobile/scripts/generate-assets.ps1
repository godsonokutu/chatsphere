Add-Type -AssemblyName System.Drawing
$assetDirectory = Join-Path $PSScriptRoot '..\assets'

function Draw-RoundedBox($graphics, $brush, [float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
    $shape = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $diameter = 2 * $radius
    $shape.AddArc($x, $y, $diameter, $diameter, 180, 90)
    $shape.AddArc(($x + $width - $diameter), $y, $diameter, $diameter, 270, 90)
    $shape.AddArc(($x + $width - $diameter), ($y + $height - $diameter), $diameter, $diameter, 0, 90)
    $shape.AddArc($x, ($y + $height - $diameter), $diameter, $diameter, 90, 90)
    $shape.CloseFigure()
    $graphics.FillPath($brush, $shape)
    $shape.Dispose()
}

function Write-AppIcon([string]$filename, [int]$size, [bool]$transparent, [float]$scale) {
    $bitmap = [System.Drawing.Bitmap]::new($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear($(if ($transparent) { [System.Drawing.Color]::Transparent } else { [System.Drawing.ColorTranslator]::FromHtml('#0D1119') }))
    $graphics.TranslateTransform(($size / 2), ($size / 2))
    $graphics.ScaleTransform(($size / 1024 * $scale), ($size / 1024 * $scale))
    $blue = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#397DF2'))
    $light = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#D7E5FF'))
    $dark = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#0D1119'))
    Draw-RoundedBox $graphics $light -65 -80 330 270 85
    $graphics.FillPolygon($light, [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(170, 130), [System.Drawing.PointF]::new(238, 230), [System.Drawing.PointF]::new(240, 130)))
    Draw-RoundedBox $graphics $dark -300 -245 400 330 104
    Draw-RoundedBox $graphics $blue -275 -220 350 280 85
    $graphics.FillPolygon($blue, [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(-238, 5), [System.Drawing.PointF]::new(-250, 117), [System.Drawing.PointF]::new(-130, 10)))
    foreach ($x in @(-190, -112, -34)) { $graphics.FillEllipse($light, $x, -99, 30, 30) }
    $bitmap.Save((Join-Path $assetDirectory $filename), [System.Drawing.Imaging.ImageFormat]::Png)
    $blue.Dispose(); $light.Dispose(); $dark.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

Write-AppIcon 'icon.png' 1024 $false 1.15
Write-AppIcon 'adaptive-icon.png' 1024 $true 0.9
Write-AppIcon 'splash-icon.png' 512 $true 0.9
Write-AppIcon 'favicon.png' 64 $false 1.3
