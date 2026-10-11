// Narancs Signage ügynök (Windows kioszk gép) – SYSTEM-ként fut („Narancs Signage Agent” feladat).
// Ugyanaz a protokoll, mint a Linux signage-agent: a parancsok a szerver élő csatornáján (SSE, ?agent=1) érkeznek:
//   restart    – a lejátszó (Edge) újraindítása (a kioszk program pár másodpercen belül újra elindítja)
//   reboot     – a gép újraindítása
//   screenshot – képernyőkép (a kioszk program készíti a kioszk munkamenetben), feltöltés a szerverre
// Lefordított program, nem PowerShell szkript (a Windows Defender a szkriptet kártevőnek jelölte). C# 5, .NET Framework csc.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

static class Agent {
  const int AgentVersion = 2;
  static readonly string Base = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "NarancsSignage");
  static readonly string Io = Path.Combine(Base, "kiosk");
  static string server, device;
  static DateTime lastReport = DateTime.MinValue;

  static void Main() {
    ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
    Dictionary<string, object> conf = (Dictionary<string, object>)new JavaScriptSerializer().DeserializeObject(File.ReadAllText(Path.Combine(Base, "install.json")));
    object v;
    if (conf.TryGetValue("server", out v)) server = v as string;
    if (conf.TryGetValue("device", out v)) device = v as string;
    if (string.IsNullOrEmpty(server) || string.IsNullOrEmpty(device)) return;
    while (true) {
      try {
        HttpWebRequest r = (HttpWebRequest)WebRequest.Create(server + "/api/player/stream?device=" + device + "&agent=1");
        r.Timeout = 15000;
        r.ReadWriteTimeout = 90000; // a szerver 25 mp-enként pingel; ennyi csend után új kapcsolat
        using (WebResponse resp = r.GetResponse())
        using (StreamReader sr = new StreamReader(resp.GetResponseStream())) {
          string line;
          while ((line = sr.ReadLine()) != null) {
            ReportIfDue();
            if (!line.StartsWith("data:")) continue;
            string cmd = null;
            try {
              Dictionary<string, object> m = new JavaScriptSerializer().DeserializeObject(line.Substring(5)) as Dictionary<string, object>;
              if (m != null && m.ContainsKey("command")) cmd = m["command"] as string;
            } catch { }
            if (cmd != null) Handle(cmd);
          }
        }
      } catch { }
      ReportIfDue();
      Thread.Sleep(5000); // megszakadt a kapcsolat: újracsatlakozás
    }
  }

  static void Handle(string cmd) {
    if (cmd == "restart") {
      using (ManagementObjectSearcher s = new ManagementObjectSearcher("SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name='msedge.exe'")) {
        foreach (ManagementObject o in s.Get()) {
          string cl = o["CommandLine"] as string;
          if (cl == null || cl.IndexOf(@"NarancsSignage\kiosk", StringComparison.OrdinalIgnoreCase) < 0) continue;
          try { Process.GetProcessById(Convert.ToInt32(o["ProcessId"])).Kill(); } catch { }
        }
      }
    } else if (cmd == "reboot") {
      Process.Start("shutdown.exe", "/r /f /t 2");
    } else if (cmd == "screenshot") {
      string jpg = Path.Combine(Io, "shot.jpg");
      try { File.Delete(jpg); } catch { }
      File.WriteAllText(Path.Combine(Io, "shot.req"), "");
      for (int i = 0; i < 30 && !File.Exists(jpg); i++) Thread.Sleep(500);
      if (!File.Exists(jpg)) return;
      Thread.Sleep(300);
      try {
        byte[] data = File.ReadAllBytes(jpg);
        HttpWebRequest r = (HttpWebRequest)WebRequest.Create(server + "/api/player/screenshot?device=" + device);
        r.Method = "POST"; r.ContentType = "image/jpeg"; r.Timeout = 30000; r.ContentLength = data.Length;
        using (Stream st = r.GetRequestStream()) st.Write(data, 0, data.Length);
        r.GetResponse().Close();
      } catch { }
      try { File.Delete(jpg); } catch { }
    }
  }

  static void ReportIfDue() {
    if ((DateTime.Now - lastReport).TotalSeconds < 60) return;
    lastReport = DateTime.Now;
    try {
      string os = "Windows"; long up = 0;
      using (ManagementObjectSearcher s = new ManagementObjectSearcher("SELECT Caption, LastBootUpTime FROM Win32_OperatingSystem")) {
        foreach (ManagementObject o in s.Get()) {
          os = (o["Caption"] as string ?? os).Trim();
          up = (long)(DateTime.Now - ManagementDateTimeConverter.ToDateTime((string)o["LastBootUpTime"])).TotalSeconds;
        }
      }
      Dictionary<string, object> agent = new Dictionary<string, object>();
      agent["version"] = AgentVersion;
      agent["seen"] = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
      agent["host"] = Environment.MachineName;
      agent["os"] = os;
      agent["ip"] = LanIp();
      agent["sys_uptime"] = up;
      Dictionary<string, object> body = new Dictionary<string, object>();
      body["device"] = device;
      body["info"] = new Dictionary<string, object> { { "agent", agent } };
      byte[] data = Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(body));
      HttpWebRequest r = (HttpWebRequest)WebRequest.Create(server + "/api/player/heartbeat");
      r.Method = "POST"; r.ContentType = "application/json"; r.Timeout = 10000; r.ContentLength = data.Length;
      using (Stream st = r.GetRequestStream()) st.Write(data, 0, data.Length);
      r.GetResponse().Close();
    } catch { }
  }

  static string LanIp() {
    foreach (NetworkInterface n in NetworkInterface.GetAllNetworkInterfaces()) {
      if (n.OperationalStatus != OperationalStatus.Up || n.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
      foreach (UnicastIPAddressInformation a in n.GetIPProperties().UnicastAddresses) {
        string ip = a.Address.ToString();
        if (a.Address.AddressFamily == AddressFamily.InterNetwork && !ip.StartsWith("169.254.")) return ip;
      }
    }
    return null;
  }
}
