# Render .boxel files in a hidden, isolated Boxel instance (port 8812) for the art loop.
#   powershell -File scripts/art/boxel-shots.ps1 -Out <dir> -Files a.boxel,b.boxel
# Each file gets one PNG per angle: <name>_<tag>.png. Needs C:\trontstack\boxel built.
param(
  [Parameter(Mandatory)][string]$Out,
  [Parameter(Mandatory)][string[]]$Files,
  [string]$Boxel = 'C:\trontstack\boxel',
  [int]$Port = 8812
)
$ErrorActionPreference = 'Stop'
$Files = $Files | ForEach-Object { $_ -split ',' } | Where-Object { $_ } # -File passes the list as one string
New-Item -ItemType Directory -Force "$Out\config" | Out-Null
# (tag, yaw, pitch): yaw 0 looks at the model's front (+z) if Boxel's convention holds; the loop checks.
$angles = @(('front', 0.0, 0.25), ('game', 0.0, 0.95), ('three4', 0.7, 0.35), ('back', 3.14159, 0.35))
$env:BOXEL_HTTP = "127.0.0.1:$Port"; $env:BOXEL_CONFIG_DIR = "$Out\config"; $env:BOXEL_DATA_DIR = $Boxel
$env:BOXEL_MULTI_INSTANCE = '1'; $env:BOXEL_BACKGROUND = '1'; $env:BOXEL_BG_FPS = '60'; $env:BOXEL_CONTINUOUS = '1'
$env:WGPU_BACKEND = 'vulkan'
$si = New-Object System.Diagnostics.ProcessStartInfo
$si.FileName = "$Boxel\target\release\boxel.exe"; $si.Arguments = '--multi-instance'; $si.WorkingDirectory = $Boxel
$si.UseShellExecute = $false; $si.CreateNoWindow = $true; $si.WindowStyle = 'Minimized'
$p = [System.Diagnostics.Process]::Start($si)
$url = "http://127.0.0.1:$Port/"
function Op($body) { Invoke-RestMethod $url -Method Post -Body ($body | ConvertTo-Json -Compress -Depth 5) -ContentType 'application/json' -TimeoutSec 60 }
try {
  for ($i = 0; $i -lt 60; $i++) { try { Invoke-RestMethod "${url}state" -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep -Milliseconds 500 } }
  foreach ($f in $Files) {
    $name = [IO.Path]::GetFileNameWithoutExtension($f)
    $r = Op @{ op = 'load'; path = ((Resolve-Path $f).Path -replace '\\', '/') }
    "load $name ok=$($r.ok) voxels=$($r.voxels)"
    Start-Sleep -Milliseconds 600
    foreach ($a in $angles) {
      Op @{ op = 'set_camera'; yaw = $a[1]; pitch = $a[2]; ortho = $false } | Out-Null
      $s = Op @{ op = 'hero_shot'; path = "$Out/${name}_$($a[0]).png"; target = 0.8; expose = $true; width = 520; height = 520; clean = $true; supersample = 2; transparent = $false }
      if (-not $s.ok) { "shot failed: $name $($a[0])" }
    }
  }
}
finally { if (-not $p.HasExited) { $p.Kill() } }
