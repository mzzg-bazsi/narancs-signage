# =============================================================================
#  Narancs Signage - Windows installer: server, display, or both on one PC
#
#  Run in PowerShell (as Administrator for the server):
#     irm https://github.com/mzzg-bazsi/narancs-signage/releases/latest/download/install.ps1 | iex
#  With options (no menu):
#     & ([scriptblock]::Create((irm https://github.com/mzzg-bazsi/narancs-signage/releases/latest/download/install.ps1))) -Mode server|screen|both [-Port 8080] [-Server http://192.168.1.10:8080]
#  Remove (the data is kept): the same with -Uninstall
#
#  Running it again updates the program; your data and settings are kept.
# =============================================================================
param(
  [ValidateSet('', 'server', 'screen', 'both')] [string]$Mode = '',
  [int]$Port = 0,
  [string]$Server = '',
  [string]$Version = '__VERSION__',   # a kiadáskor a release.sh írja be
  [string]$Source = '',               # tesztekhez: helyi forrásmappa letöltés helyett
  [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # az Invoke-WebRequest folyamatjelzője nagyon lelassítja a letöltést
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$Repo = 'mzzg-bazsi/narancs-signage'
$Base = Join-Path $env:ProgramData 'NarancsSignage'
$TaskName = 'Narancs Signage Server'
$RuleName = 'Narancs Signage'
$Shortcut = Join-Path ([Environment]::GetFolderPath('Startup')) 'Narancs Signage Display.lnk'
$ConfFile = Join-Path $Base 'install.json'

function Ok($m) { Write-Host "  [OK] $m" -ForegroundColor Green }
function Info($m) { Write-Host "  --> $m" -ForegroundColor Yellow }
# figyelem: irm | iex alatt az exit a felhasználó PowerShell ablakát zárná be, ezért hibánál throw
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

function Stop-Server {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  # a feladat leállítása a node gyermekfolyamatot nem mindig zárja be, az pedig fogja a fájlokat
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*$Base*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

# ---------- Eltávolítás (az adatok maradnak) ----------
if ($Uninstall) {
  if (-not $IsAdmin -and (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)) { throw 'Run PowerShell as Administrator to remove the server.' }
  Stop-Server
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  Remove-Item $Shortcut -ErrorAction SilentlyContinue
  foreach ($d in 'server', 'install') { Remove-Item (Join-Path $Base $d) -Recurse -Force -ErrorAction SilentlyContinue }
  Ok "Narancs Signage removed. Your data is kept in $Base\data"
  return
}

# ---------- Mit telepítsünk? (újrafuttatáskor az előző választás az alapértelmezett) ----------
$Prev = $null
if (Test-Path $ConfFile) { try { $Prev = Get-Content $ConfFile -Raw | ConvertFrom-Json } catch { } }
if (-not $Mode) {
  $Def = if ($Prev) { $Prev.mode } else { 'both' }
  $Num = @{ server = '1'; screen = '2'; both = '3' }[$Def]
  Write-Host ''
  Write-Host '  Narancs Signage - what do you want to install on this PC?' -ForegroundColor Cyan
  Write-Host '    1) Server only        (the admin panel; displays connect to it)'
  Write-Host '    2) Display only       (this PC shows the content of a server)'
  Write-Host '    3) Server and display (everything on this PC)'
  $c = Read-Host "  Choose 1, 2 or 3 [$Num]"
  $Mode = @{ '1' = 'server'; '2' = 'screen'; '3' = 'both' }[$c.Trim()]
  if (-not $Mode) { $Mode = $Def }
}
$WithServer = $Mode -ne 'screen'
$WithScreen = $Mode -ne 'server'
if ($Port -le 0) { $Port = if ($Prev -and $Prev.port) { [int]$Prev.port } else { 8080 } }
if ($WithServer -and -not $IsAdmin) { throw 'The server needs Administrator rights: open PowerShell with "Run as administrator" and run the command again.' }

if ($Mode -eq 'screen') {
  if (-not $Server -and $Prev -and $Prev.server) { $Server = $Prev.server }
  if (-not $Server) { $Server = Read-Host '  Server address (for example http://192.168.1.10:8080)' }
  $Server = $Server.Trim().TrimEnd('/')
  if ($Server -notmatch '^[a-z]+://') { $Server = "http://$Server" }
  if ($Server -notmatch '^https?://[^\s/]+$') { throw "Invalid server address: $Server" }
}
New-Item -ItemType Directory -Force $Base | Out-Null

# ---------- Szerver ----------
$Ver = ''
if ($WithServer) {
  function Test-Node {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
    try { return [version](& node -p 'process.versions.node') -ge [version]'22.13.0' } catch { return $false }
  }
  if (-not (Test-Node)) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
      Info 'Installing Node.js LTS (winget)...'
      winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements | Out-Null
      $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    }
    if (-not (Test-Node)) { throw 'Node.js 22.13 or newer is required. Install it from https://nodejs.org, then run this again.' }
  }
  $Node = (Get-Command node).Source
  Ok "Node.js $(& node -v)"

  # forrás: a kiadás csomagja a GitHubról
  $Tmp = $null
  if ($Source) { $Src = (Resolve-Path $Source).Path } else {
    if ($Version -like '__*' -or $Version -eq 'latest') { $Version = (Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ 'User-Agent' = 'NarancsSignage' }).tag_name }
    $Version = $Version.TrimStart('v')
    if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Could not determine the version to install.' }
    Info "Downloading Narancs Signage v$Version"
    $Tmp = Join-Path $env:TEMP ('narancs-signage-' + [guid]::NewGuid())
    New-Item -ItemType Directory $Tmp | Out-Null
    Invoke-WebRequest "https://github.com/$Repo/archive/refs/tags/v$Version.tar.gz" -OutFile "$Tmp\src.tar.gz" -UseBasicParsing
    tar -xzf "$Tmp\src.tar.gz" -C $Tmp
    $Src = Join-Path $Tmp "narancs-signage-$Version"
  }
  if (-not (Test-Path "$Src\server\src\server.js")) { throw 'The download is incomplete.' }
  $Ver = (Get-Content "$Src\server\package.json" -Raw | ConvertFrom-Json).version

  Stop-Server
  New-Item -ItemType Directory -Force "$Base\data" | Out-Null
  foreach ($d in 'server', 'install') {
    Remove-Item "$Base\$d" -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item "$Src\$d" "$Base\$d" -Recurse   # az install mappából a szerver a kijelző telepítőt is kiszolgálja
  }
  Remove-Item "$Base\server\data" -Recurse -Force -ErrorAction SilentlyContinue
  if ($Tmp) { Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue }

  # shortcut: a napló korlátlanul nő, ha sokat ír a szerver – kell majd forgatás
  $Run = "$Base\run.cmd"
  @(
    '@echo off',
    "set PORT=$Port",
    "set SIGNAGE_DATA=$Base\data",
    'set NODE_ENV=production',
    "cd /d `"$Base\server`"",
    "`"$Node`" --disable-warning=ExperimentalWarning `"$Base\server\src\server.js`" >> `"$Base\server.log`" 2>&1"
  ) | Set-Content -Encoding ASCII $Run

  # a gép indításakor fut (bejelentkezés nélkül is), összeomlás után percenként újraindul
  $act = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$Run`""
  $trg = New-ScheduledTaskTrigger -AtStartup
  $set = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
  $pri = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  Register-ScheduledTask -TaskName $TaskName -Action $act -Trigger $trg -Settings $set -Principal $pri -Force | Out-Null
  Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow | Out-Null
  Start-ScheduledTask -TaskName $TaskName

  $up = $false
  for ($i = 0; $i -lt 40 -and -not $up; $i++) {
    Start-Sleep -Milliseconds 750
    try { $up = (Invoke-RestMethod "http://127.0.0.1:$Port/healthz" -TimeoutSec 3).ok } catch { }
  }
  if (-not $up) { throw "The server did not start. Log: $Base\server.log" }
  Ok "Server v$Ver is running on port $Port"
}

# ---------- Kijelző: Microsoft Edge kioszk módban, bejelentkezéskor indul ----------
$Url = ''
if ($WithScreen) {
  $Url = if ($WithServer) { "http://localhost:$Port/player/" } else { "$Server/player/" }
  $Edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $Edge) { throw 'Microsoft Edge was not found. Install it, then run this again.' }
  # külön profil: a kijelző azonosítója (párosítás) itt marad meg, és nem keveredik a saját böngészéssel
  $KioskProfile = Join-Path $env:LOCALAPPDATA 'NarancsSignage\kiosk'
  $EdgeArgs = "--kiosk `"$Url`" --edge-kiosk-type=fullscreen --no-first-run --hide-crash-restore-bubble --autoplay-policy=no-user-gesture-required --disable-features=Translate --user-data-dir=`"$KioskProfile`""
  $lnk = (New-Object -ComObject WScript.Shell).CreateShortcut($Shortcut)
  $lnk.TargetPath = $Edge
  $lnk.Arguments = $EdgeArgs
  $lnk.Description = 'Narancs Signage display'
  $lnk.Save()
  # a kijelző ne kapcsoljon ki és a gép ne aludjon el (hálózati tápról)
  powercfg /change monitor-timeout-ac 0 | Out-Null
  powercfg /change standby-timeout-ac 0 | Out-Null
  Ok 'Display: Microsoft Edge starts full screen when you sign in'
  if (-not $env:CI) { Start-Process $Edge $EdgeArgs }
}

@{ mode = $Mode; port = $Port; server = $Server; version = $Ver } | ConvertTo-Json | Set-Content -Encoding ASCII $ConfFile

# ---------- Összefoglaló ----------
$Ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
Write-Host ''
Ok 'Narancs Signage is installed!'
Write-Host ''
if ($WithServer) {
  Write-Host "  Admin panel:    http://localhost:$Port/admin/   (from other devices: http://${Ip}:$Port/admin/)"
  Write-Host "  Display on another device: open http://${Ip}:$Port/player/ in a browser,"
  Write-Host "     or on Ubuntu/Raspberry Pi:  curl -fsSL http://${Ip}:$Port/install-player.sh | sudo bash"
  Write-Host "  Data:           $Base\data"
  Write-Host "  Log:            $Base\server.log"
}
if ($WithScreen) {
  Write-Host "  Display:        $Url  (pair it in the admin panel with the code it shows)"
  Write-Host '  Tip: for an unattended display turn on automatic sign-in (run: netplwiz). Exit kiosk mode: Alt+F4.'
}
Write-Host '  Update:         run the same command again (data is kept)'
Write-Host '  Remove:         & ([scriptblock]::Create((irm https://github.com/mzzg-bazsi/narancs-signage/releases/latest/download/install.ps1))) -Uninstall'
Write-Host ''
