using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

/// <summary>
/// DeckLinkNative - Single-command execution mode.
/// Each invocation runs one command then exits.
/// Uses SetThreadDesktop to attach to the interactive desktop before any UI calls.
/// </summary>
public class DeckLinkNative {
    // ── CoreAudio COM interfaces for direct volume control ──
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

    // ── Win32 imports ──
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool CloseDesktop(IntPtr hDesktop);

    const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    const uint KEYEVENTF_KEYUP = 0x0002;

    // ── Audio Volume (CoreAudio COM - works regardless of desktop) ──
    static IAudioEndpointVolume GetAudioVolume() {
        var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
        IMMDevice dev;
        enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
        Guid IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;
        object obj;
        dev.Activate(IID_IAudioEndpointVolume, 23, IntPtr.Zero, out obj);
        return (IAudioEndpointVolume)obj;
    }

    public static void VolumeUp() {
        try {
            var epv = GetAudioVolume();
            Guid empty = Guid.Empty;
            float current;
            epv.GetMasterVolumeLevelScalar(out current);
            float target = Math.Min(1.0f, current + 0.05f);
            epv.SetMasterVolumeLevelScalar(target, ref empty);
        } catch {}
    }

    public static void VolumeDown() {
        try {
            var epv = GetAudioVolume();
            Guid empty = Guid.Empty;
            float current;
            epv.GetMasterVolumeLevelScalar(out current);
            float target = Math.Max(0.0f, current - 0.05f);
            epv.SetMasterVolumeLevelScalar(target, ref empty);
        } catch {}
    }

    public static void VolumeMute() {
        try {
            var epv = GetAudioVolume();
            Guid empty = Guid.Empty;
            bool isMuted;
            epv.GetMute(out isMuted);
            epv.SetMute(!isMuted, ref empty);
        } catch {}
    }

    // ── Desktop Toggle (Shell COM) ──
    public static void ToggleDesktop() {
        try {
            Type shellType = Type.GetTypeFromProgID("Shell.Application");
            object shell = Activator.CreateInstance(shellType);
            shellType.InvokeMember("ToggleDesktop", System.Reflection.BindingFlags.InvokeMethod, null, shell, null);
        } catch {
            try {
                Type shellType = Type.GetTypeFromProgID("Shell.Application");
                object shell = Activator.CreateInstance(shellType);
                shellType.InvokeMember("MinimizeAll", System.Reflection.BindingFlags.InvokeMethod, null, shell, null);
            } catch {}
        }
    }

    // ── Snip Tool (PrintScreen key) ──
    public static void TriggerSnipTool() {
        try {
            keybd_event(44, 0, 0, UIntPtr.Zero);
            Thread.Sleep(40);
            keybd_event(44, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        } catch {}
    }

    // ── Launch an app or URL ──
    public static void OpenTarget(string target) {
        string t = target.Trim();
        try {
            Process.Start(new ProcessStartInfo(t) { UseShellExecute = true });
        } catch {
            try {
                Process.Start("explorer.exe", "\"" + t + "\"");
            } catch {}
        }
    }

    // ── Hotkey Combo ──
    public static void SendCombo(byte[] mods, byte mainKey) {
        for (int i = 0; i < mods.Length; i++) {
            keybd_event(mods[i], 0, 0, UIntPtr.Zero);
            Thread.Sleep(20);
        }
        Thread.Sleep(20);

        keybd_event(mainKey, 0, 0, UIntPtr.Zero);
        Thread.Sleep(50);
        keybd_event(mainKey, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        Thread.Sleep(20);

        for (int i = mods.Length - 1; i >= 0; i--) {
            keybd_event(mods[i], 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            Thread.Sleep(15);
        }
    }

    public static void ReleaseAllModifiers() {
        keybd_event(0x5B, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(0x5B, 0, KEYEVENTF_KEYUP | KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
        keybd_event(0x5C, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(0x5C, 0, KEYEVENTF_KEYUP | KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
        keybd_event(0x10, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(0x11, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(0x12, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }

    // ── Macro Paste ──
    public static void PasteMacro(string text) {
        try {
            Clipboard.SetText(text);
            Thread.Sleep(35);
            keybd_event(17, 0, 0, UIntPtr.Zero); // Ctrl
            Thread.Sleep(20);
            keybd_event(86, 0, 0, UIntPtr.Zero); // V
            Thread.Sleep(45);
            keybd_event(86, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            Thread.Sleep(20);
            keybd_event(17, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            Thread.Sleep(30);
        } catch {}
    }

    // ── Attach to the user's visible desktop ──
    static bool AttachToInputDesktop() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return false;
        bool ok = SetThreadDesktop(hDesk);
        // Don't close the handle while we're using it
        return ok;
    }

    // ── Main entry point: parse args and execute single command ──
    public static void Main(string[] args) {
        if (args.Length == 0) {
            Console.WriteLine("Usage: DeckLinkNative.exe <command> [args...]");
            return;
        }

        // Attach to the interactive (user-visible) desktop FIRST
        AttachToInputDesktop();

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
            string sub = allArgs[1].ToLower();
            if (sub == "volup") VolumeUp();
            else if (sub == "voldown") VolumeDown();
            else if (sub == "mute") VolumeMute();
            else if (sub == "playpause" || sub == "play" || sub == "pause") {
                keybd_event(179, 0, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
                Thread.Sleep(30);
                keybd_event(179, 0, KEYEVENTF_KEYUP | KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
            } else if (sub == "next") {
                keybd_event(176, 0, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
                Thread.Sleep(30);
                keybd_event(176, 0, KEYEVENTF_KEYUP | KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
            } else if (sub == "prev") {
                keybd_event(177, 0, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
                Thread.Sleep(30);
                keybd_event(177, 0, KEYEVENTF_KEYUP | KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
            }
        } else if (cmd == "desktop") {
            ToggleDesktop();
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
            try {
                SendCombo(mods, mainKey);
            } finally {
                ReleaseAllModifiers();
            }
        } else if (cmd == "press" && allArgs.Length >= 2) {
            byte vk = byte.Parse(allArgs[1]);
            keybd_event(vk, 0, 0, UIntPtr.Zero);
            Thread.Sleep(35);
            keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        }
    }
}
