// Narancs Signage kioszk (Windows) – a kioszk fiók munkamenetében fut (bejelentkezéskor indul):
//   * Microsoft Edge teljes képernyőn; ha bezárják vagy összeomlik, újraindítja
//   * a képernyő időzítése szerint (Képernyők → Szerkesztés → Energia) kikapcsolja / bekapcsolja a monitort
//   * képernyőképet készít, ha az ügynök kéri (az ügynök SYSTEM-ként fut, nem látja az asztalt)
// Lefordított program, nem PowerShell szkript: a Windows Defender a szkriptként futó változatot kártevőnek jelölte.
// Fordítás telepítéskor a .NET Framework csc-jével (C# 5).
using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Management;
using System.Net;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

static class Kiosk {
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern void mouse_event(uint f, int x, int y, uint d, UIntPtr e);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

  static readonly string Base = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "NarancsSignage");
  static readonly string Io = Path.Combine(Base, "kiosk");
  static string logFile;

  static void Log(string m) {
    try { File.AppendAllText(logFile, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + m + Environment.NewLine); } catch { }
  }

  [STAThread]
  static void Main(string[] args) {
    // a közös Indítópultból minden felhasználónál elindul – csak a megadott (kioszk) fióknál dolgozik
    if (args.Length > 0 && !string.Equals(args[0], Environment.UserName, StringComparison.OrdinalIgnoreCase)) return;
    bool created;
    Mutex mutex = new Mutex(true, @"Local\NarancsSignageKiosk", out created);
    if (!created) return;
    logFile = Path.Combine(Io, "kiosk-" + Environment.UserName + ".log");
    try { if (File.Exists(logFile) && new FileInfo(logFile).Length > 1048576) File.Delete(logFile); } catch { }
    Log("kiosk start (user " + Environment.UserName + ")");
    SetProcessDPIAware(); // a képernyőkép a valódi felbontásban készüljön

    string server = null, device = null;
    try {
      Dictionary<string, object> conf = (Dictionary<string, object>)new JavaScriptSerializer().DeserializeObject(File.ReadAllText(Path.Combine(Base, "install.json")));
      object v;
      if (conf.TryGetValue("server", out v)) server = v as string;
      if (conf.TryGetValue("device", out v)) device = v as string;
    } catch (Exception e) { Log("install.json: " + e.Message); }
    if (string.IsNullOrEmpty(server) || string.IsNullOrEmpty(device)) { Log("install.json has no server / device"); return; }

    string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"NarancsSignage\kiosk");
    string edgeArgs = "--kiosk " + server + "/player/?device=" + device + " --edge-kiosk-type=fullscreen --no-first-run --hide-crash-restore-bubble --autoplay-policy=no-user-gesture-required --disable-features=Translate --user-data-dir=\"" + profile + "\"";
    string state = "on";
    DateTime lastPower = DateTime.MinValue;
    while (true) {
      try {
        if (!EdgeRunning(profile)) {
          string edge = FindEdge();
          if (edge == null) { Log("Microsoft Edge not found"); Thread.Sleep(30000); continue; }
          Log("starting Edge: " + edgeArgs);
          Process.Start(edge, edgeArgs);
          Thread.Sleep(5000); // amíg az Edge folyamata megjelenik, ne indítsuk újra
        }
        string req = Path.Combine(Io, "shot.req");
        if (File.Exists(req)) { File.Delete(req); Screenshot(); }
        if ((DateTime.Now - lastPower).TotalSeconds >= 60) {
          lastPower = DateTime.Now;
          string want = ScreenOn(server, device) ? "on" : "off";
          if (want == "off") MonitorOff();          // percenként újra: egy véletlen érintés ne hagyja bekapcsolva
          else if (state == "off") MonitorOn();
          state = want;
        }
      } catch (Exception e) { Log("error: " + e.Message); }
      Thread.Sleep(2000);
    }
  }

  static string FindEdge() {
    foreach (Environment.SpecialFolder f in new[] { Environment.SpecialFolder.ProgramFilesX86, Environment.SpecialFolder.ProgramFiles }) {
      string p = Path.Combine(Environment.GetFolderPath(f), @"Microsoft\Edge\Application\msedge.exe");
      if (File.Exists(p)) return p;
    }
    return null;
  }

  // fut-e az Edge a kioszk profillal (egy második indítás új ablakot nyitna)
  static bool EdgeRunning(string profile) {
    using (ManagementObjectSearcher s = new ManagementObjectSearcher("SELECT CommandLine FROM Win32_Process WHERE Name='msedge.exe'")) {
      foreach (ManagementObject o in s.Get()) {
        string cl = o["CommandLine"] as string;
        if (cl != null && cl.IndexOf(profile, StringComparison.OrdinalIgnoreCase) >= 0) return true;
      }
    }
    return false;
  }

  static int Minutes(object t, int def) {
    string s = t as string;
    if (s == null) return def;
    string[] p = s.Split(':');
    int h, m;
    if (p.Length == 2 && int.TryParse(p[0], out h) && int.TryParse(p[1], out m)) return h * 60 + m;
    return def;
  }

  // ugyanaz a szabály, mint a Linux signage-power-ben: üzemidőn kívül (vagy nem üzemnapon) ki
  static bool ScreenOn(string server, string device) {
    try {
      HttpWebRequest r = (HttpWebRequest)WebRequest.Create(server + "/api/player/config?device=" + device);
      r.Timeout = 10000;
      string json;
      using (WebResponse resp = r.GetResponse()) using (StreamReader sr = new StreamReader(resp.GetResponseStream())) json = sr.ReadToEnd();
      Dictionary<string, object> c = (Dictionary<string, object>)new JavaScriptSerializer().DeserializeObject(json);
      Dictionary<string, object> screen = c.ContainsKey("screen") ? c["screen"] as Dictionary<string, object> : null;
      Dictionary<string, object> st = screen != null && screen.ContainsKey("settings") ? screen["settings"] as Dictionary<string, object> : null;
      if (st == null || !st.ContainsKey("power_schedule") || !(st["power_schedule"] is bool) || !(bool)st["power_schedule"]) return true;
      DateTime now = DateTime.Now;
      int dow = (int)now.DayOfWeek; if (dow == 0) dow = 7;
      IEnumerable days = st.ContainsKey("on_days") ? st["on_days"] as IEnumerable : null;
      if (days != null) {
        bool any = false, today = false;
        foreach (object d in days) { any = true; if (Convert.ToInt32(d) == dow) today = true; }
        if (any && !today) return false;
      }
      int min = now.Hour * 60 + now.Minute;
      int from = Minutes(st.ContainsKey("on_time") ? st["on_time"] : null, 0);
      int to = Minutes(st.ContainsKey("off_time") ? st["off_time"] : null, 1440);
      return from <= to ? (min >= from && min < to) : (min >= from || min < to);
    } catch { return true; }
  }

  static void MonitorOff() { PostMessage((IntPtr)0xFFFF, 0x0112, (IntPtr)0xF170, (IntPtr)2); }
  static void MonitorOn() {
    PostMessage((IntPtr)0xFFFF, 0x0112, (IntPtr)0xF170, (IntPtr)(-1));
    mouse_event(1, 1, 0, 0, UIntPtr.Zero); mouse_event(1, -1, 0, 0, UIntPtr.Zero);
  }

  static void Screenshot() {
    Rectangle b = SystemInformation.VirtualScreen;
    string tmp = Path.Combine(Io, "shot.tmp"), jpg = Path.Combine(Io, "shot.jpg");
    using (Bitmap bmp = new Bitmap(b.Width, b.Height)) {
      using (Graphics g = Graphics.FromImage(bmp)) g.CopyFromScreen(b.Left, b.Top, 0, 0, bmp.Size);
      ImageCodecInfo enc = null;
      foreach (ImageCodecInfo i in ImageCodecInfo.GetImageEncoders()) if (i.MimeType == "image/jpeg") enc = i;
      EncoderParameters p = new EncoderParameters(1);
      p.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 70L);
      bmp.Save(tmp, enc, p);
    }
    if (File.Exists(jpg)) File.Delete(jpg);
    File.Move(tmp, jpg);
  }
}
