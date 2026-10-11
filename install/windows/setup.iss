; Narancs Signage – grafikus Windows telepítő (Inno Setup 6)
; A tényleges telepítést a tesztelt install.ps1 végzi; ez a varázsló a választást, a beállításokat és az eltávolítást adja.
; Fordítás (a CI-ban): ISCC /DAppVersion=1.2.3 install\windows\setup.iss  →  install\windows\Output\NarancsSignageSetup.exe

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{6E7B1F0A-3C2D-4B8E-9A51-2F4C8D7E9B10}
AppName=Narancs Signage
AppVersion={#AppVersion}
AppVerName=Narancs Signage {#AppVersion}
AppPublisher=Balázs Mazzag
AppPublisherURL=https://mzzg-bazsi.github.io/narancs-signage-website/
AppSupportURL=https://github.com/mzzg-bazsi/narancs-signage/issues
DefaultDirName={autopf}\Narancs Signage
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
LicenseFile=LICENSE.txt
SetupIconFile=narancs.ico
UninstallDisplayIcon={app}\narancs.ico
WizardStyle=modern
OutputBaseFilename=NarancsSignageSetup
Compression=lzma2
SolidCompression=yes
ShowLanguageDialog=auto

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "hungarian"; MessagesFile: "compiler:Languages\Hungarian.isl"

[CustomMessages]
english.TypeBoth=Server and display on this PC
english.TypeServer=Server only (displays connect to it)
english.TypeScreen=Display only – kiosk PC (full screen, signs in automatically)
english.CompServer=Server – admin panel and content (runs at startup, also without sign-in)
english.CompScreen=Display – Microsoft Edge full screen (kiosk)
english.PortTitle=Server settings
english.PortDesc=Which port should the server use?
english.PortLabel=Port (the admin panel will be at http://this-PC:PORT/admin/):
english.ServerTitle=Server address
english.ServerDesc=Which Narancs Signage server should this display show?
english.ServerLabel=Server address (for example http://192.168.1.10:8080):
english.BadPort=Enter a port number between 1 and 65535.
english.BadServer=Enter the address of the server.
english.Working=Setting up Narancs Signage – this can take a few minutes (Node.js is downloaded if missing)...
english.Failed=The installation did not finish. Details are in the log:%n%1
english.OpenAdmin=Open the admin panel
english.StartDisplay=Start the display now (full screen; exit with Alt+F4)
english.KioskInfo=After the restart this PC signs in automatically with its own kiosk account and shows the display full screen. If it is closed, it starts again.%nTo get back to Windows: Ctrl+Alt+Del → Sign out, then sign in with your own account.
hungarian.TypeBoth=Szerver és kijelző ezen a gépen
hungarian.TypeServer=Csak szerver (a kijelzők ehhez csatlakoznak)
hungarian.TypeScreen=Csak kijelző – kioszk gép (teljes képernyő, automatikus bejelentkezés)
hungarian.CompServer=Szerver – admin felület és tartalmak (a gép indulásakor fut, bejelentkezés nélkül is)
hungarian.CompScreen=Kijelző – Microsoft Edge teljes képernyőn (kioszk)
hungarian.PortTitle=Szerver beállítások
hungarian.PortDesc=Melyik porton fusson a szerver?
hungarian.PortLabel=Port (az admin felület címe: http://ez-a-gép:PORT/admin/):
hungarian.ServerTitle=Szerver címe
hungarian.ServerDesc=Melyik Narancs Signage szerver tartalmát mutassa ez a kijelző?
hungarian.ServerLabel=Szerver címe (pl. http://192.168.1.10:8080):
hungarian.BadPort=Adj meg egy portszámot 1 és 65535 között.
hungarian.BadServer=Add meg a szerver címét.
hungarian.Working=A Narancs Signage beállítása – ez néhány percig tarthat (ha nincs Node.js, letölti)...
hungarian.Failed=A telepítés nem fejeződött be. A részletek a naplóban:%n%1
hungarian.OpenAdmin=Admin felület megnyitása
hungarian.StartDisplay=Kijelző indítása most (teljes képernyő; kilépés: Alt+F4)
hungarian.KioskInfo=Újraindítás után a gép saját kioszk fiókkal automatikusan bejelentkezik, és teljes képernyőn mutatja a kijelzőt. Ha bezárják, újraindul.%nVissza a Windowshoz: Ctrl+Alt+Del → Kijelentkezés, majd jelentkezz be a saját fiókoddal.

[Types]
Name: "both"; Description: "{cm:TypeBoth}"
Name: "server"; Description: "{cm:TypeServer}"
Name: "screen"; Description: "{cm:TypeScreen}"

[Components]
Name: "server"; Description: "{cm:CompServer}"; Types: both server
Name: "screen"; Description: "{cm:CompScreen}"; Types: both screen

[Files]
; a forrás csak a telepítés idejére kell, az install.ps1 másolja a helyére (%ProgramData%\NarancsSignage)
Source: "..\..\server\*"; DestDir: "{tmp}\src\server"; Excludes: "\data\*,\test\*"; Flags: recursesubdirs deleteafterinstall
Source: "..\..\install\*"; DestDir: "{tmp}\src\install"; Excludes: "\windows\*"; Flags: recursesubdirs deleteafterinstall
; az eltávolításhoz megmarad
Source: "..\install.ps1"; DestDir: "{app}"
Source: "narancs.ico"; DestDir: "{app}"

[Run]
Filename: "http://localhost:{code:GetPort}/admin/"; Description: "{cm:OpenAdmin}"; Flags: postinstall shellexec nowait skipifsilent; Components: server
Filename: "{userstartup}\Narancs Signage Display.lnk"; Description: "{cm:StartDisplay}"; Flags: postinstall shellexec nowait skipifsilent unchecked runasoriginaluser; Check: IsBoth

[UninstallRun]
; az adatok (%ProgramData%\NarancsSignage\data) megmaradnak
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\install.ps1"" -Uninstall"; Flags: runhidden waituntilterminated; RunOnceId: "RemoveNarancsSignage"

[Code]
var
  PortPage, ServerPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  PortPage := CreateInputQueryPage(wpSelectComponents, CustomMessage('PortTitle'), CustomMessage('PortDesc'), '');
  PortPage.Add(CustomMessage('PortLabel'), False);
  PortPage.Values[0] := ExpandConstant('{param:port|' + GetPreviousData('Port', '8080') + '}');
  ServerPage := CreateInputQueryPage(PortPage.ID, CustomMessage('ServerTitle'), CustomMessage('ServerDesc'), '');
  ServerPage.Add(CustomMessage('ServerLabel'), False);
  ServerPage.Values[0] := ExpandConstant('{param:server|' + GetPreviousData('Server', '') + '}');
end;

procedure RegisterPreviousData(PreviousDataKey: Integer);
begin
  SetPreviousData(PreviousDataKey, 'Port', PortPage.Values[0]);
  SetPreviousData(PreviousDataKey, 'Server', ServerPage.Values[0]);
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := ((PageID = PortPage.ID) and not WizardIsComponentSelected('server')) or
            ((PageID = ServerPage.ID) and WizardIsComponentSelected('server'));
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  P: Integer;
begin
  Result := True;
  if CurPageID = PortPage.ID then begin
    P := StrToIntDef(Trim(PortPage.Values[0]), 0);
    if (P < 1) or (P > 65535) then begin MsgBox(CustomMessage('BadPort'), mbError, MB_OK); Result := False; end;
  end;
  if (CurPageID = ServerPage.ID) and (Trim(ServerPage.Values[0]) = '') then begin
    MsgBox(CustomMessage('BadServer'), mbError, MB_OK); Result := False;
  end;
end;

function IsBoth: Boolean;
begin
  Result := WizardIsComponentSelected('server') and WizardIsComponentSelected('screen');
end;

// a kioszk gép (csak kijelző) újraindítás után indul az automatikus bejelentkezéssel
function NeedRestart: Boolean;
begin
  Result := not WizardIsComponentSelected('server');
end;

function GetPort(Param: String): String;
begin
  Result := Trim(PortPage.Values[0]);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Mode, Args, Log: String;
  Code: Integer;
begin
  if CurStep <> ssPostInstall then Exit;
  if WizardIsComponentSelected('server') and WizardIsComponentSelected('screen') then Mode := 'both'
  else if WizardIsComponentSelected('server') then Mode := 'server'
  else Mode := 'screen';
  Args := ' -Mode ' + Mode + ' -NoStart -Source "' + ExpandConstant('{tmp}\src') + '"';
  if Mode = 'screen' then Args := Args + ' -Server "' + Trim(ServerPage.Values[0]) + '"'
  else Args := Args + ' -Port ' + GetPort('');
  ForceDirectories(ExpandConstant('{commonappdata}\NarancsSignage'));
  Log := ExpandConstant('{commonappdata}\NarancsSignage\setup.log');
  WizardForm.StatusLabel.Caption := CustomMessage('Working');
  WizardForm.ProgressGauge.Style := npbstMarquee;
  // a PowerShell kimenete a naplóba megy (hiba esetén ebből derül ki az ok)
  if not Exec(ExpandConstant('{cmd}'), '/c powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\src\install\install.ps1') + '"' + Args + ' > "' + Log + '" 2>&1',
              '', SW_HIDE, ewWaitUntilTerminated, Code) or (Code <> 0) then
    SuppressibleMsgBox(FmtMessage(CustomMessage('Failed'), [Log]), mbError, MB_OK, IDOK);
  WizardForm.ProgressGauge.Style := npbstNormal;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if (CurPageID = wpFinished) and not WizardIsComponentSelected('server') then
    WizardForm.FinishedLabel.Caption := CustomMessage('KioskInfo');
end;
