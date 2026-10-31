using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

public class DeckLinkNative {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern IntPtr SendMessageW(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("PowrProf.dll", SetLastError = true)]
    static extern bool SetSuspendState(bool hibernate, bool forceCritical, bool disableWakeEvent);

    public static void SleepPC() {
        try {
            SetSuspendState(false, false, false);
        } catch {}
    }

    const int WM_APPCOMMAND = 0x0319;
    static readonly IntPtr HWND_BROADCAST = (IntPtr)0xffff;

    const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    const uint KEYEVENTF_KEYUP = 0x0002;

    static bool IsExtendedKey(byte vk) {
        return vk == 0x5B || vk == 0x5C // LWIN, RWIN
            || (vk >= 33 && vk <= 46)   // PageUp, PageDown, End, Home, Left, Up, Right, Down, PrintScreen, Insert, Delete
            || (vk >= 166 && vk <= 183) // Browser & Media keys
            || vk == 144                // NumLock
            || vk == 163 || vk == 165;  // RControl, RMenu (Alt)
    }

    public static void KeyDown(byte vk) {
        uint flags = IsExtendedKey(vk) ? KEYEVENTF_EXTENDEDKEY : 0;
        keybd_event(vk, 0, flags, UIntPtr.Zero);
    }

    public static void KeyUp(byte vk) {
        uint flags = KEYEVENTF_KEYUP | (IsExtendedKey(vk) ? KEYEVENTF_EXTENDEDKEY : 0);
        keybd_event(vk, 0, flags, UIntPtr.Zero);
    }

    public static void SendKeyStroke(byte vk) {
        KeyDown(vk);
        Thread.Sleep(45);
        KeyUp(vk);
        Thread.Sleep(25);
    }

    public static void SendCombo(byte[] mods, byte mainKey) {
        for (int i = 0; i < mods.Length; i++) {
            KeyDown(mods[i]);
            Thread.Sleep(30);
        }
        Thread.Sleep(30);

        KeyDown(mainKey);
        Thread.Sleep(60);
        KeyUp(mainKey);
        Thread.Sleep(30);

        for (int i = mods.Length - 1; i >= 0; i--) {
            KeyUp(mods[i]);
            Thread.Sleep(20);
        }
        ReleaseAllModifiers();
    }

    public static void ReleaseAllModifiers() {
        KeyUp(0x5B); // LWIN
        KeyUp(0x5C); // RWIN
        KeyUp(0x10); // Shift
        KeyUp(0x11); // Ctrl
        KeyUp(0x12); // Alt
    }

    // ─── Media Commands (WM_APPCOMMAND + keybd_event) ───
    public static void MediaCommand(string cmd) {
        int appCmd = 0;
        byte vk = 0;
        switch (cmd.ToLower()) {
            case "mute":
                VolumeMute();
                return;
            case "volup":
                VolumeUp();
                return;
            case "voldown":
                VolumeDown();
                return;
            case "micmute":
                MicrophoneMute();
                return;
            case "playpause":
            case "play":
            case "pause":
                appCmd = 14;
                vk = 179;
                break;
            case "next":
                appCmd = 11;
                vk = 176;
                break;
            case "prev":
                appCmd = 12;
                vk = 177;
                break;
            case "stop":
                appCmd = 13;
                vk = 178;
                break;
        }

        if (appCmd > 0) {
            SendMessageW(HWND_BROADCAST, WM_APPCOMMAND, IntPtr.Zero, (IntPtr)(appCmd << 16));
        }

        if (vk > 0) {
            SendKeyStroke(vk);
        }
    }

    // ─── CoreAudio COM for Hardware Volume & Microphone Control ───
    [ComImport]
    [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumeratorComObject { }

    [ComImport]
    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator {
        int NotImpl1();
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
    }

    [ComImport]
    [Guid("D666063F-1587-4E43-81F1-B948E807363F")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice {
        int Activate([MarshalAs(UnmanagedType.LPStruct)] Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    }

    [ComImport]
    [Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioEndpointVolume {
        int RegisterControlChangeNotify(IntPtr pNotify);
        int UnregisterControlChangeNotify(IntPtr pNotify);
        int GetChannelCount(out uint pnChannelCount);
        int SetMasterVolumeLevel(float fLevelDB, ref Guid pguidEventContext);
        int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
        int GetMasterVolumeLevel(out float pfLevelDB);
        int GetMasterVolumeLevelScalar(out float pfLevel);
        int SetChannelVolumeLevel(uint nChannel, float fLevelDB, ref Guid pguidEventContext);
        int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, ref Guid pguidEventContext);
        int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
        int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
        int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
        int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
    }

    // dataFlow: 0 = eRender (Speakers), 1 = eCapture (Microphone)
    static IAudioEndpointVolume GetAudioVolume(int dataFlow) {
        var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
        IMMDevice dev;
        enumerator.GetDefaultAudioEndpoint(dataFlow, 1, out dev);
        Guid IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;
        object obj;
        dev.Activate(IID_IAudioEndpointVolume, 23, IntPtr.Zero, out obj);
        return (IAudioEndpointVolume)obj;
    }

    public static void VolumeUp() {
        try {
            var epv = GetAudioVolume(0);
            Guid empty = Guid.Empty;
            float current;
            epv.GetMasterVolumeLevelScalar(out current);
            float target = Math.Min(1.0f, current + 0.05f);
            epv.SetMasterVolumeLevelScalar(target, ref empty);
        } catch {}
    }

    public static void VolumeDown() {
        try {
            var epv = GetAudioVolume(0);
            Guid empty = Guid.Empty;
            float current;
            epv.GetMasterVolumeLevelScalar(out current);
            float target = Math.Max(0.0f, current - 0.05f);
            epv.SetMasterVolumeLevelScalar(target, ref empty);
        } catch {}
    }

    public static void VolumeMute() {
        try {
            var epv = GetAudioVolume(0);
            Guid empty = Guid.Empty;
            bool isMuted;
            epv.GetMute(out isMuted);
            epv.SetMute(!isMuted, ref empty);
        } catch {}
    }

    public static void MicrophoneMute() {
        try {
            // dataFlow = 1 mutes the physical system microphone globally!
            var epv = GetAudioVolume(1);
            Guid empty = Guid.Empty;
            bool isMuted;
            epv.GetMute(out isMuted);
            epv.SetMute(!isMuted, ref empty);
        } catch {}
    }

    public static void SetVolume(float scalar) {
        try {
            var epv = GetAudioVolume(0);
            Guid empty = Guid.Empty;
            epv.SetMasterVolumeLevelScalar(Math.Max(0.0f, Math.Min(1.0f, scalar)), ref empty);
        } catch {}
    }

    public static void SetMicVolume(float scalar) {
        try {
            var epv = GetAudioVolume(1);
            Guid empty = Guid.Empty;
            epv.SetMasterVolumeLevelScalar(Math.Max(0.0f, Math.Min(1.0f, scalar)), ref empty);
        } catch {}
    }

    // ─── Show Desktop ───
    public static void ToggleDesktop() {
        try {
            Type shellType = Type.GetTypeFromProgID("Shell.Application");
            object shell = Activator.CreateInstance(shellType);
            shellType.InvokeMember("ToggleDesktop", BindingFlags.InvokeMethod, null, shell, null);
        } catch {}
    }

    // ─── Snip Tool ───
    public static void TriggerSnipTool() {
        // Method 1: Win + Shift + S keystroke
        KeyDown(0x5B); // Win
        Thread.Sleep(30);
        KeyDown(0x10); // Shift
        Thread.Sleep(30);
        SendKeyStroke(0x53); // S
        Thread.Sleep(30);
        KeyUp(0x10);
        Thread.Sleep(20);
        KeyUp(0x5B);
        ReleaseAllModifiers();

        // Method 2: VK_SNAPSHOT (PrintScreen = 44)
        Thread.Sleep(40);
        SendKeyStroke(44);
    }

    // ─── Launch Target (Apps, URLs) ───
    public static void OpenTarget(string target) {
        string t = target.Trim();

        // Handle Notepad directly
        if (t.Equals("notepad.exe", StringComparison.OrdinalIgnoreCase) ||
            t.Equals("notepad", StringComparison.OrdinalIgnoreCase)) {
            try {
                Process.Start(new ProcessStartInfo("notepad.exe") { UseShellExecute = true });
                return;
            } catch {
                try {
                    Process.Start(new ProcessStartInfo("cmd.exe", "/c start notepad") { UseShellExecute = true, WindowStyle = ProcessWindowStyle.Hidden });
                    return;
                } catch {}
            }
        }

        // Handle URLs: Launch Chrome or default browser
        if (t.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            t.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) {
            string chromePath = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
            string chromeX86 = @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe";

            try {
                if (File.Exists(chromePath)) {
                    Process.Start(new ProcessStartInfo(chromePath, "\"" + t + "\"") { UseShellExecute = true });
                    return;
                }
                if (File.Exists(chromeX86)) {
                    Process.Start(new ProcessStartInfo(chromeX86, "\"" + t + "\"") { UseShellExecute = true });
                    return;
                }
                Process.Start(new ProcessStartInfo("cmd.exe", "/c start \"\" \"" + t + "\"") { UseShellExecute = true, WindowStyle = ProcessWindowStyle.Hidden });
                return;
            } catch {}
        }

        // Handle Settings
        if (t.Equals("settings", StringComparison.OrdinalIgnoreCase) ||
            t.Equals("ms-settings:", StringComparison.OrdinalIgnoreCase)) {
            try {
                Process.Start(new ProcessStartInfo("cmd.exe", "/c start ms-settings:") { UseShellExecute = true, WindowStyle = ProcessWindowStyle.Hidden });
                return;
            } catch {}
        }

        // Handle Standard Executables (calc.exe, powershell.exe, explorer.exe, taskmgr.exe)
        try {
            Process.Start(new ProcessStartInfo(t) { UseShellExecute = true });
        } catch {
            try {
                Process.Start(new ProcessStartInfo("cmd.exe", "/c start " + t) { UseShellExecute = true, WindowStyle = ProcessWindowStyle.Hidden });
            } catch {}
        }
    }

    // ─── Paste Macro Text ───
    public static void PasteMacro(string text) {
        try {
            Thread t = new Thread(() => {
                Clipboard.SetText(text);
            });
            t.SetApartmentState(ApartmentState.STA);
            t.Start();
            t.Join();

            Thread.Sleep(50);
            KeyDown(0x11); // Ctrl
            Thread.Sleep(30);
            SendKeyStroke(0x56); // V
            Thread.Sleep(30);
            KeyUp(0x11);
            ReleaseAllModifiers();
        } catch {}
    }

    // ─── Main Entry Point ───
    [STAThread]
    public static void Main(string[] args) {
        if (args.Length == 0) {
            Console.WriteLine("DeckLinkNative Active");
            string line;
            while ((line = Console.ReadLine()) != null) {
                line = line.Trim();
                if (string.IsNullOrEmpty(line)) continue;
                if (line.Equals("exit", StringComparison.OrdinalIgnoreCase) ||
                    line.Equals("quit", StringComparison.OrdinalIgnoreCase)) {
                    break;
                }
                string[] parts = line.Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length > 0) {
                    string c = parts[0].ToLower();
                    string fa = parts.Length > 1 ? string.Join(" ", parts, 1, parts.Length - 1) : "";
                    try {
                        ExecuteCommand(c, fa, parts);
                        Console.WriteLine("OK");
                    } catch (Exception ex) {
                        Console.WriteLine("ERR: " + ex.Message);
                    }
                }
            }
            return;
        }

        string cmd = args[0].ToLower();
        string fullArgs = args.Length > 1 ? string.Join(" ", args, 1, args.Length - 1) : "";

        try {
            ExecuteCommand(cmd, fullArgs, args);
            Console.WriteLine("OK");
        } catch (Exception ex) {
            Console.WriteLine("ERR: " + ex.Message);
        }
    }

    static void ExecuteCommand(string cmd, string fullArgs, string[] allArgs) {
        if (cmd == "release") {
            ReleaseAllModifiers();
        } else if (cmd == "media" && allArgs.Length >= 2) {
            MediaCommand(allArgs[1]);
        } else if (cmd == "setvol" && allArgs.Length >= 2) {
            float percent;
            if (float.TryParse(allArgs[1], out percent)) {
                SetVolume(percent / 100.0f);
            }
        } else if (cmd == "setmicvol" && allArgs.Length >= 2) {
            float percent;
            if (float.TryParse(allArgs[1], out percent)) {
                SetMicVolume(percent / 100.0f);
            }
        } else if (cmd == "desktop") {
            ToggleDesktop();
        } else if (cmd == "sleep") {
            SleepPC();
        } else if (cmd == "snip") {
            TriggerSnipTool();
        } else if (cmd == "open" && allArgs.Length >= 2) {
            OpenTarget(fullArgs);
        } else if (cmd == "macro" && allArgs.Length >= 2) {
            PasteMacro(fullArgs);
        } else if (cmd == "combo" && allArgs.Length >= 2) {
            byte mainKey = byte.Parse(allArgs[allArgs.Length - 1]);
            byte[] mods = new byte[allArgs.Length - 2];
            for (int i = 1; i < allArgs.Length - 1; i++) {
                mods[i - 1] = byte.Parse(allArgs[i]);
            }
            SendCombo(mods, mainKey);
        } else if (cmd == "press" && allArgs.Length >= 2) {
            byte vk = byte.Parse(allArgs[1]);
            SendKeyStroke(vk);
        }
    }
}
