# Narancs Signage – tálca ikon a Windows szerverhez (bejelentkezéskor indul, minden felhasználónál).
# Mutatja, hogy fut-e a szerver, és gyors elérést ad az admin felülethez, a naplóhoz és az újraindításhoz.
# UTF-8 BOM-mal mentve: így a Windows PowerShell 5.1 az ékezeteket is jól olvassa.
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

# egy felhasználónál csak egy példány fusson
$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\NarancsSignageTray', [ref]$created)
if (-not $created) { return }

$Base = Join-Path $env:ProgramData 'NarancsSignage'
$Port = 8080
try { $Port = [int](Get-Content (Join-Path $Base 'install.json') -Raw | ConvertFrom-Json).port } catch { }
$Url = "http://localhost:$Port"

$hu = (Get-UICulture).TwoLetterISOLanguageName -eq 'hu'
function T($en, $hun) { if ($hu) { $hun } else { $en } }

$icon = New-Object System.Windows.Forms.NotifyIcon
$ico = Join-Path $Base 'install\windows\narancs.ico'
$icon.Icon = if (Test-Path $ico) { New-Object System.Drawing.Icon $ico } else { [System.Drawing.SystemIcons]::Application }
$icon.Text = 'Narancs Signage'
$icon.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$status = $menu.Items.Add('Narancs Signage')
$status.Enabled = $false
[void]$menu.Items.Add('-')
function Add-Item($text, $action) { $i = $menu.Items.Add($text); $i.add_Click($action); $i }
$admin = Add-Item (T 'Open admin panel' 'Admin felület megnyitása') { Start-Process "$Url/admin/" }
$admin.Font = New-Object System.Drawing.Font($admin.Font, [System.Drawing.FontStyle]::Bold)
[void](Add-Item (T 'Open the player' 'Lejátszó megnyitása') { Start-Process "$Url/player/" })
[void]$menu.Items.Add('-')
[void](Add-Item (T 'Open data folder' 'Adatmappa megnyitása') { Start-Process explorer.exe (Join-Path $Base 'data') })
[void](Add-Item (T 'Open log' 'Napló megnyitása') { Start-Process notepad.exe (Join-Path $Base 'server.log') })
[void](Add-Item (T 'Restart server' 'Szerver újraindítása') {
  # rendszergazdai jog kell (a szerver SYSTEM-ként fut) – a Windows rákérdez
  $cmd = "Get-CimInstance Win32_Process -Filter `"Name='node.exe'`" | Where-Object { `$_.CommandLine -like '*NarancsSignage*' } | ForEach-Object { Stop-Process -Id `$_.ProcessId -Force }; Start-Sleep 2; Start-ScheduledTask -TaskName 'Narancs Signage Server'"
  Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -ArgumentList '-NoProfile', '-Command', $cmd
})
[void]$menu.Items.Add('-')
[void](Add-Item (T 'Hide this icon' 'Ikon elrejtése') { $icon.Visible = $false; [System.Windows.Forms.Application]::Exit() })
$icon.ContextMenuStrip = $menu
$icon.add_MouseDoubleClick({ Start-Process "$Url/admin/" })

# állapot 5 mp-enként (a /healthz a verziót is megadja)
$last = $null
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$check = {
  $v = $null
  try { $v = (Invoke-RestMethod "$Url/healthz" -TimeoutSec 3).version } catch { }
  $text = if ($v) { (T 'Server running: v{0} – port {1}' 'A szerver fut: v{0} – port {1}') -f $v, $Port } else { T 'Server is not running' 'A szerver nem fut' }
  $status.Text = $text
  $icon.Text = ('Narancs Signage – ' + $text).Substring(0, [Math]::Min(63, ('Narancs Signage – ' + $text).Length))
  $running = [bool]$v
  # csak változáskor szólunk (az első ellenőrzésnél nem)
  if ($null -ne $last -and $running -ne $last) {
    $icon.ShowBalloonTip(4000, 'Narancs Signage', $text, $(if ($running) { 'Info' } else { 'Warning' }))
  }
  $script:last = $running
}
$timer.add_Tick($check)
$timer.Start()
& $check

[System.Windows.Forms.Application]::Run()
$icon.Dispose()
