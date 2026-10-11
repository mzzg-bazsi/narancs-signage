# Narancs Signage agent for a Windows kiosk PC - runs as SYSTEM (task "Narancs Signage Agent").
# Same protocol as the Linux signage-agent: commands arrive on the server's live channel (SSE, ?agent=1):
#   restart    - restart the player (Microsoft Edge)
#   reboot     - restart the PC
#   screenshot - screenshot of the display, uploaded to the server
# A szkript csak ASCII karaktert tartalmazhat: a Windows PowerShell 5.1 ANSI-kent olvassa.
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$Base = Join-Path $env:ProgramData 'NarancsSignage'
$Io = Join-Path $Base 'kiosk'
$conf = Get-Content (Join-Path $Base 'install.json') -Raw | ConvertFrom-Json
$S = $conf.server
$D = $conf.device
$AgentVersion = 2

function Send-Report {
  try {
    $os = Get-CimInstance Win32_OperatingSystem
    $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
    $body = @{ device = $D; info = @{ agent = @{
      version = $AgentVersion; seen = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); host = $env:COMPUTERNAME
      os = $os.Caption; ip = $ip; sys_uptime = [int]((Get-Date) - $os.LastBootUpTime).TotalSeconds } } } | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Method Post "$S/api/player/heartbeat" -ContentType 'application/json' -Body $body -TimeoutSec 10 | Out-Null
  } catch { }
}

function Invoke-Command2([string]$cmd) {
  switch ($cmd) {
    'restart' {
      # a kiosk.ps1 par masodpercen belul ujrainditja
      Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*NarancsSignage\kiosk*' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    }
    'reboot' { Start-Sleep -Seconds 2; Restart-Computer -Force }
    'screenshot' {
      Remove-Item "$Io\shot.jpg" -ErrorAction SilentlyContinue
      New-Item -ItemType File "$Io\shot.req" -Force | Out-Null
      for ($i = 0; $i -lt 30 -and -not (Test-Path "$Io\shot.jpg"); $i++) { Start-Sleep -Milliseconds 500 }
      if (Test-Path "$Io\shot.jpg") {
        try { Invoke-WebRequest -Method Post "$S/api/player/screenshot?device=$D" -InFile "$Io\shot.jpg" -ContentType 'image/jpeg' -UseBasicParsing -TimeoutSec 30 | Out-Null } catch { }
        Remove-Item "$Io\shot.jpg" -ErrorAction SilentlyContinue
      }
    }
  }
}

$lastReport = [datetime]::MinValue
while ($true) {
  try {
    $req = [Net.HttpWebRequest]::Create("$S/api/player/stream?device=$D&agent=1")
    $req.Timeout = 15000
    $req.ReadWriteTimeout = 90000   # a szerver 25 mp-enkent pingel; ennyi csend utan uj kapcsolat
    $resp = $req.GetResponse()
    $reader = New-Object IO.StreamReader($resp.GetResponseStream())
    while ($null -ne ($line = $reader.ReadLine())) {
      if (((Get-Date) - $lastReport).TotalSeconds -ge 60) { Send-Report; $lastReport = Get-Date }
      if ($line.StartsWith('data:')) {
        try { $cmd = ($line.Substring(5) | ConvertFrom-Json).command } catch { $cmd = $null }
        if ($cmd) { Invoke-Command2 $cmd }
      }
    }
  } catch { }
  try { $resp.Close() } catch { }
  if (((Get-Date) - $lastReport).TotalSeconds -ge 60) { Send-Report; $lastReport = Get-Date }
  Start-Sleep -Seconds 5   # megszakadt a kapcsolat: ujracsatlakozas
}
