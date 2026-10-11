# Narancs Signage kiosk - runs in the kiosk account's session (started at sign-in by the "Narancs Signage Display" task):
#   * Microsoft Edge full screen; started again if it is closed or crashes
#   * monitor off / on by the screen's power schedule (Screens -> Edit -> Power)
#   * screenshot when the agent asks for one (the agent runs as SYSTEM and cannot see the desktop)
# A szkript csak ASCII karaktert tartalmazhat: a Windows PowerShell 5.1 ANSI-kent olvassa.
$ErrorActionPreference = 'Continue'
$Base = Join-Path $env:ProgramData 'NarancsSignage'
$Io = Join-Path $Base 'kiosk'
$Log = Join-Path $Io "kiosk-$env:USERNAME.log"
function Write-Log($m) { try { Add-Content -Path $Log -Value ("{0:yyyy-MM-dd HH:mm:ss} {1}" -f (Get-Date), $m) } catch { } }

# ket uton is indul (utemezett feladat + Inditopult), de csak egy peldany fusson
$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\NarancsSignageKiosk', [ref]$created)
if (-not $created) { return }
if ((Test-Path $Log) -and (Get-Item $Log).Length -gt 1MB) { Remove-Item $Log -ErrorAction SilentlyContinue }
Write-Log "kiosk start (user $env:USERNAME)"
trap { Write-Log ("error: " + $_); continue }
$conf = Get-Content (Join-Path $Base 'install.json') -Raw | ConvertFrom-Json
if (-not $conf.server -or -not $conf.device) { Write-Log 'install.json has no server / device'; return }
$Edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$ProfileDir = Join-Path $env:LOCALAPPDATA 'NarancsSignage\kiosk'
$EdgeArgs = "--kiosk $($conf.server)/player/?device=$($conf.device) --edge-kiosk-type=fullscreen --no-first-run --hide-crash-restore-bubble --autoplay-policy=no-user-gesture-required --disable-features=Translate --user-data-dir=`"$ProfileDir`""

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class NsDisplay {
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern void mouse_event(uint f, int x, int y, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  public static void Off() { PostMessage((IntPtr)0xFFFF, 0x0112, (IntPtr)0xF170, (IntPtr)2); }
  public static void On() { PostMessage((IntPtr)0xFFFF, 0x0112, (IntPtr)0xF170, (IntPtr)(-1)); mouse_event(1, 1, 0, 0, UIntPtr.Zero); mouse_event(1, -1, 0, 0, UIntPtr.Zero); }
}
'@
[void][NsDisplay]::SetProcessDPIAware()   # a kepernyokep a valodi felbontasban keszuljon

function ToMinutes([string]$t, [int]$def) { if ($t -match '^(\d{1,2}):(\d{2})$') { return [int]$Matches[1] * 60 + [int]$Matches[2] } return $def }

# ugyanaz a szabaly, mint a Linux signage-power-ben: uzemidon kivul (vagy nem uzemnapon) ki
function Test-ScreenOn {
  try { $c = Invoke-RestMethod "$($conf.server)/api/player/config?device=$($conf.device)" -TimeoutSec 10 } catch { return $true }
  $s = $c.screen.settings
  if (-not $s -or -not $s.power_schedule) { return $true }
  $now = Get-Date
  $dow = [int]$now.DayOfWeek; if ($dow -eq 0) { $dow = 7 }
  $days = @($s.on_days | Where-Object { $_ })
  if ($days.Count -gt 0 -and -not ($days -contains $dow)) { return $false }
  $m = $now.Hour * 60 + $now.Minute
  $from = ToMinutes $s.on_time 0
  $to = ToMinutes $s.off_time 1440
  if ($from -le $to) { return ($m -ge $from -and $m -lt $to) }
  return ($m -ge $from -or $m -lt $to)
}

function Save-Screenshot {
  $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
  $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $p = New-Object System.Drawing.Imaging.EncoderParameters 1
  $p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]70)
  $bmp.Save("$Io\shot.tmp", $enc, $p)
  $g.Dispose(); $bmp.Dispose()
  Move-Item "$Io\shot.tmp" "$Io\shot.jpg" -Force
}

$state = 'on'
$lastPower = [datetime]::MinValue
while ($true) {
  # az Edge fut-e a kioszk profillal (a masodik inditas uj ablakot nyitna, ezert csak ha nem fut)
  $running = Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*$ProfileDir*" }
  if (-not $running) {
    if (-not $Edge) { Write-Log 'Microsoft Edge not found'; Start-Sleep -Seconds 30; continue }
    Write-Log "starting Edge: $EdgeArgs"
    try { Start-Process $Edge $EdgeArgs } catch { Write-Log ("Edge start failed: " + $_) }
    Start-Sleep -Seconds 5   # amig az Edge folyamata megjelenik, ne inditsuk ujra
  }

  if (Test-Path "$Io\shot.req") {
    Remove-Item "$Io\shot.req" -Force -ErrorAction SilentlyContinue
    try { Save-Screenshot } catch { }
  }

  if (((Get-Date) - $lastPower).TotalSeconds -ge 60) {
    $lastPower = Get-Date
    $want = if (Test-ScreenOn) { 'on' } else { 'off' }
    if ($want -eq 'off') { [NsDisplay]::Off() }   # percenkent ujra: egy veletlen erintes / egermozgas ne hagyja bekapcsolva
    elseif ($state -eq 'off') { [NsDisplay]::On() }
    $state = $want
  }
  Start-Sleep -Seconds 2
}
