# =============================================================================
#  Narancs Signage - Windows installer: server, display, or both on one PC
#
#  Run in PowerShell (as Administrator for the server):
#     irm https://raw.githubusercontent.com/mzzg-bazsi/narancs-signage/main/install/install.ps1 | iex
#  With options (no menu):
#     & ([scriptblock]::Create((irm https://raw.githubusercontent.com/mzzg-bazsi/narancs-signage/main/install/install.ps1))) -Mode server|screen|both [-Port 8080] [-Server http://192.168.1.10:8080]
#  Remove (the data is kept): the same with -Uninstall
#
#  Running it again updates the program; your data and settings are kept.
# =============================================================================
param(
  [ValidateSet('', 'server', 'screen', 'both')] [string]$Mode = '',
  [int]$Port = 0,
  [string]$Server = '',
  [string]$Version = 'latest',
  [string]$Source = '',               # helyi forrásmappa letöltés helyett (a grafikus telepítő és a tesztek)
  [switch]$NoStart,                   # a kijelzőt most ne indítsa el (a grafikus telepítő a végén kérdezi)
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

$KioskUser = 'NarancsKiosk'
$KioskTask = 'Narancs Signage Display'
$Winlogon = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'

$PwLessKey = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\PasswordLess\Device'
$PwLessPrev = Join-Path $Base 'passwordless.prev'

# Az automatikus bejelentkezés jelszava az LSA titkos tárolóba kerül (mint a Sysinternals Autologonnál), nem olvasható szövegként a registrybe
function Set-LsaSecret([string]$Key, [string]$Value) {
  if (-not ('NsLsa' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class NsLsa {
  [StructLayout(LayoutKind.Sequential)] struct US { public ushort Length; public ushort MaximumLength; public IntPtr Buffer; }
  [StructLayout(LayoutKind.Sequential)] struct OA { public int Length; public IntPtr RootDirectory; public IntPtr ObjectName; public uint Attributes; public IntPtr SecurityDescriptor; public IntPtr SecurityQualityOfService; }
  [DllImport("advapi32.dll")] static extern uint LsaOpenPolicy(IntPtr system, ref OA attrs, uint access, out IntPtr handle);
  [DllImport("advapi32.dll")] static extern uint LsaStorePrivateData(IntPtr handle, ref US key, IntPtr data);
  [DllImport("advapi32.dll")] static extern uint LsaClose(IntPtr handle);
  [DllImport("advapi32.dll")] static extern int LsaNtStatusToWinError(uint status);
  static US Str(string s) { US u = new US(); u.Buffer = Marshal.StringToHGlobalUni(s); u.Length = (ushort)(s.Length * 2); u.MaximumLength = (ushort)(s.Length * 2 + 2); return u; }
  // value == null: törlés; visszatérés: Win32 hibakód (0 = rendben)
  public static int Store(string key, string value) {
    OA oa = new OA(); IntPtr h;
    uint st = LsaOpenPolicy(IntPtr.Zero, ref oa, 0x000F0FFF, out h);
    if (st != 0) return LsaNtStatusToWinError(st);
    US k = Str(key); IntPtr p = IntPtr.Zero;
    if (value != null) { US v = Str(value); p = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(US))); Marshal.StructureToPtr(v, p, false); }
    st = LsaStorePrivateData(h, ref k, p);
    LsaClose(h);
    return st == 0 ? 0 : LsaNtStatusToWinError(st);
  }
}
'@
  }
  return [NsLsa]::Store($Key, $Value)
}

# A kioszk fiók visszabontása (eltávolításkor, és ha a gép már nem „csak kijelző”)
function Remove-Kiosk {
  Unregister-ScheduledTask -TaskName $KioskTask -Confirm:$false -ErrorAction SilentlyContinue
  if ((Get-ItemProperty $Winlogon -ErrorAction SilentlyContinue).DefaultUserName -eq $KioskUser) {
    Set-ItemProperty $Winlogon AutoAdminLogon '0'
    Remove-ItemProperty $Winlogon DefaultPassword -ErrorAction SilentlyContinue
    [void](Set-LsaSecret 'DefaultPassword' $null)
  }
  # a Windows Hello beállítást visszaállítjuk, ha mi kapcsoltuk ki
  if (Test-Path $PwLessPrev) {
    Set-ItemProperty $PwLessKey DevicePasswordLessBuildVersion ([int](Get-Content $PwLessPrev)) -Type DWord -ErrorAction SilentlyContinue
    Remove-Item $PwLessPrev
  }
  $u = Get-LocalUser $KioskUser -ErrorAction SilentlyContinue
  if ($u) {
    Get-CimInstance Win32_UserProfile | Where-Object { $_.SID -eq $u.SID.Value } | Remove-CimInstance -ErrorAction SilentlyContinue
    Remove-LocalUser $KioskUser
  }
}

function Stop-Server {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  # a feladat leállítása a node gyermekfolyamatot nem mindig zárja be, az pedig fogja a fájlokat
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*$Base*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

# ---------- Eltávolítás (az adatok maradnak) ----------
if ($Uninstall) {
  if (-not $IsAdmin) { throw 'Run PowerShell as Administrator.' }
  Stop-Server
  Remove-Kiosk
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  Remove-Item $Shortcut -ErrorAction SilentlyContinue
  foreach ($d in 'server', 'install', 'node') { Remove-Item (Join-Path $Base $d) -Recurse -Force -ErrorAction SilentlyContinue }
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
if (-not $IsAdmin) { throw 'Administrator rights are needed: open PowerShell with "Run as administrator" and run the command again.' }

if ($Mode -eq 'screen') {
  if (-not $Server -and $Prev -and $Prev.server) { $Server = $Prev.server }
  if (-not $Server) { $Server = Read-Host '  Server address (for example http://192.168.1.10:8080)' }
  $Server = $Server.Trim().TrimEnd('/')
  if ($Server -notmatch '^[a-z]+://') { $Server = "http://$Server" }
  if ($Server -notmatch '^https?://[^\s/''"]+$') { throw "Invalid server address: $Server" }
}
New-Item -ItemType Directory -Force $Base | Out-Null

# ---------- Szerver ----------
$Ver = ''
if ($WithServer) {
  function Test-NodeExe($exe) {
    try { return [version](& $exe -p 'process.versions.node') -ge [version]'22.13.0' } catch { return $false }
  }
  $Node = $null
  $sysNode = Get-Command node -ErrorAction SilentlyContinue
  if ($sysNode -and (Test-NodeExe $sysNode.Source)) { $Node = $sysNode.Source }
  elseif ((Test-Path "$Base\node\node.exe") -and (Test-NodeExe "$Base\node\node.exe")) { $Node = "$Base\node\node.exe" }
  else {
    # saját Node.js a program mellé, közvetlenül a nodejs.org-ról (a winget nem mindenhol van meg, pl. régebbi Windows 10-en)
    $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
    # PowerShell 5.1-ben az irm a JSON tömböt egyben adja tovább, ezért foreach-csel bontjuk ki
    $lts = ''
    foreach ($r in (Invoke-RestMethod 'https://nodejs.org/dist/index.json')) { if ($r.lts) { $lts = [string]$r.version; break } }
    if ($lts -notmatch '^v\d+\.\d+\.\d+$') { throw 'Could not find the current Node.js version on nodejs.org.' }
    Info "Downloading Node.js $lts"
    $zip = Join-Path $env:TEMP "node-$lts-win-$arch.zip"
    Invoke-WebRequest "https://nodejs.org/dist/$lts/node-$lts-win-$arch.zip" -OutFile $zip -UseBasicParsing
    Stop-Server
    Remove-Item "$Base\node", "$Base\node-$lts-win-$arch" -Recurse -Force -ErrorAction SilentlyContinue
    tar -xf $zip -C $Base
    Rename-Item "$Base\node-$lts-win-$arch" 'node'
    Remove-Item $zip -ErrorAction SilentlyContinue
    $Node = "$Base\node\node.exe"
    if (-not (Test-NodeExe $Node)) { throw 'Node.js could not be installed. Install Node.js 22.13 or newer from https://nodejs.org, then run this again.' }
  }
  Ok "Node.js $(& $Node -v)"

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

# ---------- Kijelző: Microsoft Edge kioszk módban ----------
# Csak kijelző: önálló kioszk gép – külön fiók automatikus bejelentkezéssel, a lejátszó teljes képernyőn, bezárás után újraindul.
# Szerver + kijelző: a saját fiókban, bejelentkezéskor (a gép a sajátod marad).
$Url = ''
if ($Mode -ne 'screen') { Remove-Kiosk }
if ($WithScreen) {
  $Url = if ($WithServer) { "http://localhost:$Port/player/" } else { "$Server/player/" }
  $Edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $Edge) { throw 'Microsoft Edge was not found. Install it, then run this again.' }
  $Flags = "--kiosk `"$Url`" --edge-kiosk-type=fullscreen --no-first-run --hide-crash-restore-bubble --autoplay-policy=no-user-gesture-required --disable-features=Translate"
  # az Edge első indításkori üdvözlő lapjai ne takarják el a lejátszót
  New-Item 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' -Force | Out-Null
  Set-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' HideFirstRunExperience 1 -Type DWord
  # a kijelző ne kapcsoljon ki és a gép ne aludjon el (hálózati tápról)
  powercfg /change monitor-timeout-ac 0 | Out-Null
  powercfg /change standby-timeout-ac 0 | Out-Null

  if ($Mode -eq 'screen') {
    Remove-Item $Shortcut -ErrorAction SilentlyContinue
    # véletlen jelszó: senkinek nem kell tudnia, csak az automatikus bejelentkezés használja
    $bytes = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $Pw = [Convert]::ToBase64String($bytes) + 'a1!'
    $Sec = ConvertTo-SecureString $Pw -AsPlainText -Force
    if (Get-LocalUser $KioskUser -ErrorAction SilentlyContinue) { Set-LocalUser $KioskUser -Password $Sec -PasswordNeverExpires $true }
    else { New-LocalUser $KioskUser -Password $Sec -FullName 'Narancs Signage' -Description 'Narancs Signage display (kiosk)' -PasswordNeverExpires -UserMayNotChangePassword | Out-Null }
    # a Felhasználók csoport SID-del (magyar Windowson „Felhasználók” a neve), adminisztrátor nem lesz
    Add-LocalGroupMember -SID 'S-1-5-32-545' -Member $KioskUser -ErrorAction SilentlyContinue
    $err = Set-LsaSecret 'DefaultPassword' $Pw
    if ($err) { throw "Could not store the automatic sign-in password (error $err)." }
    Remove-ItemProperty $Winlogon DefaultPassword -ErrorAction SilentlyContinue
    Remove-ItemProperty $Winlogon AutoLogonCount -ErrorAction SilentlyContinue   # ha volt, a számláló lejárta után kikapcsolná
    Set-ItemProperty $Winlogon AutoAdminLogon '1'
    Set-ItemProperty $Winlogon DefaultUserName $KioskUser
    Set-ItemProperty $Winlogon DefaultDomainName $env:COMPUTERNAME
    # Windows 11: a „Csak Windows Hello bejelentkezés a Microsoft-fiókokhoz” beállítás letiltja az automatikus bejelentkezést
    $pl = (Get-ItemProperty $PwLessKey -ErrorAction SilentlyContinue).DevicePasswordLessBuildVersion
    if ($pl -and $pl -ne 0) {
      if (-not (Test-Path $PwLessPrev)) { Set-Content $PwLessPrev $pl }
      Set-ItemProperty $PwLessKey DevicePasswordLessBuildVersion 0 -Type DWord
    }
    Set-ItemProperty $Winlogon EnableFirstLogonAnimation 0 -Type DWord
    # az új fiók első bejelentkezésekor ne jöjjön fel az adatvédelmi beállítások képernyője
    New-Item 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\OOBE' -Force | Out-Null
    Set-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\OOBE' DisablePrivacyExperience 1 -Type DWord

    # a kioszk fiók bejelentkezésekor: az Edge teljes képernyőn, és ha bezárják / összeomlik, pár másodperc múlva újra
    $KioskScript = "$Base\kiosk.ps1"
    @(
      "`$profileDir = Join-Path `$env:LOCALAPPDATA 'NarancsSignage\kiosk'",
      "while (`$true) {",
      "  Start-Process '$Edge' -ArgumentList ('$($Flags.Replace('"', '')) --user-data-dir=' + `$profileDir) -Wait",
      "  Start-Sleep -Seconds 3",
      "}"
    ) | Set-Content -Encoding ASCII $KioskScript
    $act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$KioskScript`""
    $trg = New-ScheduledTaskTrigger -AtLogOn -User "$env:COMPUTERNAME\$KioskUser"
    $set = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    $pri = New-ScheduledTaskPrincipal -UserId "$env:COMPUTERNAME\$KioskUser" -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $KioskTask -Action $act -Trigger $trg -Settings $set -Principal $pri -Force | Out-Null
    Ok "Kiosk: after a restart this PC signs in as '$KioskUser' and shows the display full screen"
  } else {
    # külön profil: a kijelző azonosítója (párosítás) itt marad meg, és nem keveredik a saját böngészéssel
    $EdgeArgs = "$Flags --user-data-dir=`"$(Join-Path $env:LOCALAPPDATA 'NarancsSignage\kiosk')`""
    $lnk = (New-Object -ComObject WScript.Shell).CreateShortcut($Shortcut)
    $lnk.TargetPath = $Edge
    $lnk.Arguments = $EdgeArgs
    $lnk.Description = 'Narancs Signage display'
    $lnk.Save()
    Ok 'Display: Microsoft Edge starts full screen when you sign in'
    if (-not $NoStart -and -not $env:CI) { Start-Process $Edge $EdgeArgs }
  }
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
  if ($Mode -eq 'screen') {
    Write-Host '  Restart the PC to start the kiosk. To get back to Windows: Ctrl+Alt+Del, then Sign out, and sign in with your own account.'
  } else { Write-Host '  Exit full screen: Alt+F4.' }
}
Write-Host '  Update:         run the same command again (data is kept)'
Write-Host '  Remove:         & ([scriptblock]::Create((irm https://raw.githubusercontent.com/mzzg-bazsi/narancs-signage/main/install/install.ps1))) -Uninstall'
Write-Host ''
