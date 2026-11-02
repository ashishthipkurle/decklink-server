using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

public class DeckLinkNative {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern IntPtr SendMessageW(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("gdi32.dll")]
    public static extern bool SetDeviceGammaRamp(IntPtr hDC, ref RAMP lpRamp);

    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public struct RAMP {
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 256)]
        public ushort[] Red;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 256)]
        public ushort[] Green;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 256)]
        public ushort[] Blue;
    }

    private static int _lastBrightness = 100;

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
            case "voldn":
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

    // ─── CoreAudio COM for Hardware Volume, Endpoints & Application Mixer ───
    [ComImport]
    [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumeratorComObject { }

    [ComImport]
    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator {
        int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IMMDeviceCollection ppDevices);
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
        int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string pwstrId, out IMMDevice ppDevice);
    }

    [ComImport]
    [Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceCollection {
        int GetCount(out uint pcDevices);
        int Item(uint nDevice, out IMMDevice ppDevice);
    }

    [ComImport]
    [Guid("D666063F-1587-4E43-81F1-B948E807363F")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice {
        int Activate([MarshalAs(UnmanagedType.LPStruct)] Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
        int OpenPropertyStore(int stgmAccess, out IPropertyStore ppProperties);
        int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
    }

    [ComImport]
    [Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore {
        int GetCount(out uint cProps);
        int GetAt(uint iProp, out PropertyKey pkey);
        int GetValue(ref PropertyKey key, out PropVariant pv);
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PropertyKey {
        public Guid fmtid;
        public uint pid;
    }

    [StructLayout(LayoutKind.Explicit)]
    struct PropVariant {
        [FieldOffset(0)] public short vt;
        [FieldOffset(8)] public IntPtr pwszVal;
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

    [ComImport]
    [Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionManager2 {
        int NotImpl1();
        int NotImpl2();
        int GetSessionEnumerator(out IAudioSessionEnumerator SessionEnum);
    }

    [ComImport]
    [Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionEnumerator {
        int GetCount(out int SessionCount);
        int GetSession(int SessionIndex, [MarshalAs(UnmanagedType.IUnknown)] out object Session);
    }

    [ComImport]
    [Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionControl2 {
        int GetState(out int pRetVal);
        int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string Value, [In] ref Guid EventContext);
        int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string Value, [In] ref Guid EventContext);
        int GetGroupingParam(out Guid pRetVal);
        int SetGroupingParam([In] ref Guid Override, [In] ref Guid EventContext);
        int RegisterAudioSessionNotification(IntPtr NewNotifications);
        int UnregisterAudioSessionNotification(IntPtr NewNotifications);
        int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        int GetProcessId(out uint pRetVal);
        int IsSystemSoundsSession();
        int SetDuckingPreference(bool optOut);
    }

    [DllImport("ole32.dll")]
    static extern int CoInitialize(IntPtr pvReserved);

    [ComImport]
    [Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface ISimpleAudioVolume {
        [PreserveSig] int SetMasterVolume(float fLevel, [In] ref Guid EventContext);
        [PreserveSig] int GetMasterVolume(out float pfLevel);
        [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, [In] ref Guid EventContext);
        [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
    }

    // dataFlow: 0 = eRender (Speakers/Headset), 1 = eCapture (Microphone)
    static IAudioEndpointVolume GetAudioVolume(int dataFlow) {
        var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
        IMMDevice dev;
        enumerator.GetDefaultAudioEndpoint(dataFlow, 1, out dev);
        Guid IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;
        object obj;
        dev.Activate(IID_IAudioEndpointVolume, 1, IntPtr.Zero, out obj);
        return (IAudioEndpointVolume)obj;
    }

    static string GetDeviceFriendlyName(IMMDevice dev) {
        try {
            IPropertyStore store;
            dev.OpenPropertyStore(0, out store);
            PropertyKey pkey = new PropertyKey {
                fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),
                pid = 14 // PKEY_Device_FriendlyName
            };
            PropVariant pv;
            store.GetValue(ref pkey, out pv);
            return Marshal.PtrToStringUni(pv.pwszVal) ?? "Audio Device";
        } catch {
            return "Audio Device";
        }
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

    // ─── Per-Device Volume & Mute ───
    public static void SetDeviceVolume(string targetNameOrId, float scalar) {
        try {
            var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
            Guid IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;
            Guid empty = Guid.Empty;

            for (int flow = 0; flow <= 1; flow++) {
                IMMDeviceCollection coll;
                if (enumerator.EnumAudioEndpoints(flow, 1, out coll) == 0) {
                    uint count;
                    coll.GetCount(out count);
                    for (uint i = 0; i < count; i++) {
                        IMMDevice dev;
                        coll.Item(i, out dev);
                        string id;
                        dev.GetId(out id);
                        string name = GetDeviceFriendlyName(dev);

                        if (id.Equals(targetNameOrId, StringComparison.OrdinalIgnoreCase) ||
                            name.IndexOf(targetNameOrId, StringComparison.OrdinalIgnoreCase) >= 0 ||
                            targetNameOrId.IndexOf(name, StringComparison.OrdinalIgnoreCase) >= 0) {
                            object obj;
                            dev.Activate(IID_IAudioEndpointVolume, 1, IntPtr.Zero, out obj);
                            var epv = (IAudioEndpointVolume)obj;
                            epv.SetMasterVolumeLevelScalar(Math.Max(0.0f, Math.Min(1.0f, scalar)), ref empty);
                            return;
                        }
                    }
                }
            }

            // Fallback: If device was "Headset", "Headphones", "Speakers", or generic audio, route to default render endpoint
            if (targetNameOrId.IndexOf("head", StringComparison.OrdinalIgnoreCase) >= 0 ||
                targetNameOrId.IndexOf("speak", StringComparison.OrdinalIgnoreCase) >= 0 ||
                targetNameOrId.IndexOf("audio", StringComparison.OrdinalIgnoreCase) >= 0 ||
                targetNameOrId.IndexOf("sound", StringComparison.OrdinalIgnoreCase) >= 0 ||
                targetNameOrId.IndexOf("master", StringComparison.OrdinalIgnoreCase) >= 0) {
                SetVolume(scalar);
            }
        } catch {}
    }

    public static void ToggleDeviceMute(string targetNameOrId) {
        try {
            var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
            Guid IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;
            Guid empty = Guid.Empty;

            for (int flow = 0; flow <= 1; flow++) {
                IMMDeviceCollection coll;
                if (enumerator.EnumAudioEndpoints(flow, 1, out coll) == 0) {
                    uint count;
                    coll.GetCount(out count);
                    for (uint i = 0; i < count; i++) {
                        IMMDevice dev;
                        coll.Item(i, out dev);
                        string id;
                        dev.GetId(out id);
                        string name = GetDeviceFriendlyName(dev);

                        if (id.Equals(targetNameOrId, StringComparison.OrdinalIgnoreCase) ||
                            name.IndexOf(targetNameOrId, StringComparison.OrdinalIgnoreCase) >= 0 ||
                            targetNameOrId.IndexOf(name, StringComparison.OrdinalIgnoreCase) >= 0) {
                            object obj;
                            dev.Activate(IID_IAudioEndpointVolume, 1, IntPtr.Zero, out obj);
                            var epv = (IAudioEndpointVolume)obj;
                            bool isMuted;
                            epv.GetMute(out isMuted);
                            epv.SetMute(!isMuted, ref empty);
                            return;
                        }
                    }
                }
            }

            // Fallback for generic audio targets
            if (targetNameOrId.IndexOf("head", StringComparison.OrdinalIgnoreCase) >= 0 ||
                targetNameOrId.IndexOf("speak", StringComparison.OrdinalIgnoreCase) >= 0 ||
                targetNameOrId.IndexOf("audio", StringComparison.OrdinalIgnoreCase) >= 0 ||
                targetNameOrId.IndexOf("sound", StringComparison.OrdinalIgnoreCase) >= 0 ||
                targetNameOrId.IndexOf("master", StringComparison.OrdinalIgnoreCase) >= 0) {
                MediaCommand("mute");
            }
        } catch {}
    }

    // ─── Per-Application Volume & Mute ───
    static string GetSessionProcessName(IAudioSessionControl2 ctl2, uint pid) {
        if (ctl2 == null) return "System";

        // 1. Process ID lookup (handles running games & apps directly)
        if (pid > 0) {
            try {
                var p = Process.GetProcessById((int)pid);
                if (p != null && !string.IsNullOrEmpty(p.ProcessName)) {
                    return p.ProcessName;
                }
            } catch {}
        }

        // 2. Parse process executable name from SessionIdentifier
        // Format: "{0.0.0...}|\Device\HarddiskVolume7\...\FallGuys_client_game.exe%b{...}"
        try {
            string sessId = null;
            ctl2.GetSessionIdentifier(out sessId);
            if (!string.IsNullOrEmpty(sessId)) {
                string raw = sessId;
                int barIdx = raw.LastIndexOf('|');
                if (barIdx >= 0 && barIdx < raw.Length - 1) {
                    raw = raw.Substring(barIdx + 1);
                }
                int pctIdx = raw.IndexOf('%');
                if (pctIdx > 0) {
                    raw = raw.Substring(0, pctIdx);
                }
                int slashIdx = Math.Max(raw.LastIndexOf('\\'), raw.LastIndexOf('/'));
                string file = slashIdx >= 0 ? raw.Substring(slashIdx + 1) : raw;
                int dotIdx = file.LastIndexOf('.');
                if (dotIdx > 0) file = file.Substring(0, dotIdx);
                file = file.Trim();
                if (!string.IsNullOrEmpty(file) && !file.StartsWith("{") && !file.StartsWith("#")) {
                    return file;
                }
            }
        } catch {}

        // 3. Display name fallback
        try {
            string dispName = null;
            ctl2.GetDisplayName(out dispName);
            if (!string.IsNullOrEmpty(dispName)) {
                if (dispName.IndexOf("AudioSrv", StringComparison.OrdinalIgnoreCase) >= 0) {
                    return "System Sounds";
                }
                return dispName.Trim();
            }
        } catch {}

        // 4. System Sounds fallback for PID 0 / Windows audio service
        if (pid == 0) return "System Sounds";

        return "System";
    }

    static bool IsSessionMatch(string sessionProc, string target) {
        if (string.IsNullOrEmpty(sessionProc) || string.IsNullOrEmpty(target)) return false;
        string p = sessionProc.ToLower().Trim();
        string t = target.ToLower().Trim();

        // Exact match
        if (p == t) return true;

        // Browser match (Generic "Browser", "Browser Audio", or specific browser name)
        if (t == "browser" || t == "browser audio" || t == "chrome" || t == "edge" || t == "brave" || t == "firefox" || t == "web") {
            return p.IndexOf("chrome", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   p.IndexOf("brave", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   p.IndexOf("msedge", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   p.IndexOf("edge", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   p.IndexOf("firefox", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   p.IndexOf("opera", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   p.IndexOf("vivaldi", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   p.IndexOf("arc", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        if (t == "discord") {
            return p.IndexOf("discord", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        if (t == "spotify") {
            return p.IndexOf("spotify", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        // Generic Game Audio (Auto-detect): Any session not in system/browser/chat list
        if (t == "game" || t == "game audio" || t == "games") {
            if (p == "chrome" || p == "msedge" || p == "brave" || p == "firefox" || 
                p == "opera" || p == "vivaldi" || p == "spotify" || p == "discord" ||
                p == "obs64" || p == "obs" || p == "system" || p == "system sounds" || p == "audiodg" ||
                p == "explorer" || p == "taskhostw" || p == "svchost" || p == "code" ||
                p == "devenv" || p == "dcv2" || p == "decklink" || p == "decklinknative" ||
                p == "steamwebhelper" || p == "epicgameslauncher" ||
                p == "nvcontainer" || p == "rtkngui64") {
                return false;
            }
            return true;
        }

        // Direct substring match
        if (p.IndexOf(t, StringComparison.OrdinalIgnoreCase) >= 0 || t.IndexOf(p, StringComparison.OrdinalIgnoreCase) >= 0) {
            return true;
        }

        // Fuzzy match without separators (e.g. "fall guys" matches "fallguys_client_game")
        string cp = p.Replace("_", "").Replace("-", "").Replace(" ", "");
        string ct = t.Replace("_", "").Replace("-", "").Replace(" ", "");
        if (cp.Length > 2 && ct.Length > 2) {
            if (cp.IndexOf(ct, StringComparison.OrdinalIgnoreCase) >= 0 || ct.IndexOf(cp, StringComparison.OrdinalIgnoreCase) >= 0) {
                return true;
            }
        }

        return false;
    }

    public static void SetAppVolume(string processName, float scalar) {
        try {
            CoInitialize(IntPtr.Zero);
            var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
            Guid IID_IAudioSessionManager2 = typeof(IAudioSessionManager2).GUID;
            Guid empty = Guid.Empty;
            bool matchedAny = false;
            float clamped = Math.Max(0.0f, Math.Min(1.0f, scalar));

            IMMDeviceCollection renderColl;
            if (enumerator.EnumAudioEndpoints(0, 1, out renderColl) == 0) {
                uint devCount;
                renderColl.GetCount(out devCount);
                for (uint d = 0; d < devCount; d++) {
                    try {
                        IMMDevice dev;
                        renderColl.Item(d, out dev);
                        object obj = null;
                        if (dev.Activate(IID_IAudioSessionManager2, 23, IntPtr.Zero, out obj) != 0 || obj == null) {
                            if (dev.Activate(IID_IAudioSessionManager2, 1, IntPtr.Zero, out obj) != 0 || obj == null) continue;
                        }
                        var mgr = (IAudioSessionManager2)obj;
                        IAudioSessionEnumerator sessionEnum;
                        if (mgr.GetSessionEnumerator(out sessionEnum) != 0 || sessionEnum == null) continue;
                        int count;
                        sessionEnum.GetCount(out count);
                        for (int i = 0; i < count; i++) {
                            object sessionObj;
                            sessionEnum.GetSession(i, out sessionObj);
                            var ctl2 = sessionObj as IAudioSessionControl2;
                            var vol = sessionObj as ISimpleAudioVolume;
                            if (ctl2 != null && vol != null) {
                                uint pid;
                                ctl2.GetProcessId(out pid);
                                string proc = GetSessionProcessName(ctl2, pid);
                                if (IsSessionMatch(proc, processName)) {
                                    vol.SetMasterVolume(clamped, ref empty);
                                    if (clamped <= 0.001f) {
                                        vol.SetMute(true, ref empty);
                                    } else {
                                        vol.SetMute(false, ref empty);
                                    }
                                    matchedAny = true;
                                    Console.WriteLine("[AppVol] " + proc + " -> " + (int)(clamped * 100) + "%");
                                }
                            }
                        }
                    } catch {}
                }
            }

            // Fallback: If no app matched, and target mentions headset, speakers, or master, adjust master volume
            if (!matchedAny && (processName.IndexOf("head", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                processName.IndexOf("speak", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                processName.IndexOf("master", StringComparison.OrdinalIgnoreCase) >= 0)) {
                SetVolume(scalar);
            }
        } catch {}
    }

    public static void ToggleAppMute(string processName) {
        try {
            CoInitialize(IntPtr.Zero);
            var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
            Guid IID_IAudioSessionManager2 = typeof(IAudioSessionManager2).GUID;
            Guid empty = Guid.Empty;
            bool matchedAny = false;

            IMMDeviceCollection renderColl;
            if (enumerator.EnumAudioEndpoints(0, 1, out renderColl) == 0) {
                uint devCount;
                renderColl.GetCount(out devCount);
                for (uint d = 0; d < devCount; d++) {
                    try {
                        IMMDevice dev;
                        renderColl.Item(d, out dev);
                        object obj = null;
                        if (dev.Activate(IID_IAudioSessionManager2, 23, IntPtr.Zero, out obj) != 0 || obj == null) {
                            if (dev.Activate(IID_IAudioSessionManager2, 1, IntPtr.Zero, out obj) != 0 || obj == null) continue;
                        }
                        var mgr = (IAudioSessionManager2)obj;
                        IAudioSessionEnumerator sessionEnum;
                        if (mgr.GetSessionEnumerator(out sessionEnum) != 0 || sessionEnum == null) continue;
                        int count;
                        sessionEnum.GetCount(out count);
                        for (int i = 0; i < count; i++) {
                            object sessionObj;
                            sessionEnum.GetSession(i, out sessionObj);
                            var ctl2 = sessionObj as IAudioSessionControl2;
                            var vol = sessionObj as ISimpleAudioVolume;
                            if (ctl2 != null && vol != null) {
                                uint pid;
                                ctl2.GetProcessId(out pid);
                                string proc = GetSessionProcessName(ctl2, pid);
                                if (IsSessionMatch(proc, processName)) {
                                    bool isMuted;
                                    vol.GetMute(out isMuted);
                                    vol.SetMute(!isMuted, ref empty);
                                    matchedAny = true;
                                    Console.WriteLine("[AppMute] " + proc + " -> " + (!isMuted ? "MUTED" : "UNMUTED"));
                                }
                            }
                        }
                    } catch {}
                }
            }

            // Fallback: If no app matched and target mentions headset, speakers, or master, toggle master mute
            if (!matchedAny && (processName.IndexOf("head", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                processName.IndexOf("speak", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                processName.IndexOf("master", StringComparison.OrdinalIgnoreCase) >= 0)) {
                VolumeMute();
            }
        } catch {}
    }

    // ─── Display Brightness ("Smart Lights") ───
    public static void SetBrightness(int percent) {
        try {
            int p = Math.Max(10, Math.Min(100, percent));
            _lastBrightness = p;

            IntPtr hdc = GetDC(IntPtr.Zero);
            if (hdc != IntPtr.Zero) {
                RAMP ramp = new RAMP();
                ramp.Red = new ushort[256];
                ramp.Green = new ushort[256];
                ramp.Blue = new ushort[256];
                double factor = p / 100.0;
                for (int i = 0; i < 256; i++) {
                    ushort val = (ushort)Math.Max(0, Math.Min(65535, (int)(i * 256 * factor)));
                    ramp.Red[i] = val;
                    ramp.Green[i] = val;
                    ramp.Blue[i] = val;
                }
                SetDeviceGammaRamp(hdc, ref ramp);
                ReleaseDC(IntPtr.Zero, hdc);
            }

            try {
                Process.Start(new ProcessStartInfo("powershell.exe",
                    string.Format("-NoProfile -ExecutionPolicy Bypass -Command \"(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue).WmiSetBrightness(1,{0})\"", p)) {
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                });
            } catch {}
        } catch {}
    }

    public static int GetBrightness() {
        return _lastBrightness;
    }

    // ─── Audio Devices & Sessions JSON List ───
    public static void OutputAudioJson() {
        try {
            var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
            Guid IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;

            StringBuilder sb = new StringBuilder();
            sb.Append("{");

            // 1. Output Devices
            sb.Append("\"outputs\":[");
            IMMDeviceCollection renderColl;
            if (enumerator.EnumAudioEndpoints(0, 1, out renderColl) == 0) {
                uint count;
                renderColl.GetCount(out count);
                for (uint i = 0; i < count; i++) {
                    IMMDevice dev;
                    renderColl.Item(i, out dev);
                    string id;
                    dev.GetId(out id);
                    string name = GetDeviceFriendlyName(dev);

                    float vol = 1.0f;
                    bool muted = false;
                    try {
                        object obj;
                        dev.Activate(IID_IAudioEndpointVolume, 1, IntPtr.Zero, out obj);
                        var epv = (IAudioEndpointVolume)obj;
                        epv.GetMasterVolumeLevelScalar(out vol);
                        epv.GetMute(out muted);
                    } catch {}

                    if (i > 0) sb.Append(",");
                    sb.Append("{");
                    sb.AppendFormat("\"id\":\"{0}\",\"name\":\"{1}\",\"type\":\"device\",\"volume\":{2},\"muted\":{3}",
                        EscapeJson(id), EscapeJson(name), (int)Math.Round(vol * 100), muted ? "true" : "false");
                    sb.Append("}");
                }
            }
            sb.Append("],");

            // 2. Input Devices (Microphones)
            sb.Append("\"inputs\":[");
            IMMDeviceCollection captureColl;
            if (enumerator.EnumAudioEndpoints(1, 1, out captureColl) == 0) {
                uint count;
                captureColl.GetCount(out count);
                for (uint i = 0; i < count; i++) {
                    IMMDevice dev;
                    captureColl.Item(i, out dev);
                    string id;
                    dev.GetId(out id);
                    string name = GetDeviceFriendlyName(dev);

                    float vol = 1.0f;
                    bool muted = false;
                    try {
                        object obj;
                        dev.Activate(IID_IAudioEndpointVolume, 1, IntPtr.Zero, out obj);
                        var epv = (IAudioEndpointVolume)obj;
                        epv.GetMasterVolumeLevelScalar(out vol);
                        epv.GetMute(out muted);
                    } catch {}

                    if (i > 0) sb.Append(",");
                    sb.Append("{");
                    sb.AppendFormat("\"id\":\"{0}\",\"name\":\"{1}\",\"type\":\"mic\",\"volume\":{2},\"muted\":{3}",
                        EscapeJson(id), EscapeJson(name), (int)Math.Round(vol * 100), muted ? "true" : "false");
                    sb.Append("}");
                }
            }
            sb.Append("],");

            // 3. Audio Sessions (Applications across all render devices)
            sb.Append("\"sessions\":[");
            try {
                var seenProcesses = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                bool firstSession = true;

                IMMDeviceCollection devColl;
                if (enumerator.EnumAudioEndpoints(0, 1, out devColl) == 0) {
                    uint dCount;
                    devColl.GetCount(out dCount);
                    Guid IID_IAudioSessionManager2 = typeof(IAudioSessionManager2).GUID;

                    for (uint d = 0; d < dCount; d++) {
                        try {
                            IMMDevice dev;
                            devColl.Item(d, out dev);
                            object obj = null;
                            if (dev.Activate(IID_IAudioSessionManager2, 23, IntPtr.Zero, out obj) != 0 || obj == null) {
                                if (dev.Activate(IID_IAudioSessionManager2, 1, IntPtr.Zero, out obj) != 0 || obj == null) continue;
                            }
                            var mgr = (IAudioSessionManager2)obj;
                            IAudioSessionEnumerator sessionEnum;
                            if (mgr.GetSessionEnumerator(out sessionEnum) != 0 || sessionEnum == null) continue;
                            int count;
                            sessionEnum.GetCount(out count);

                            for (int i = 0; i < count; i++) {
                                object sessionObj;
                                sessionEnum.GetSession(i, out sessionObj);
                                var ctl2 = sessionObj as IAudioSessionControl2;
                                var vol = sessionObj as ISimpleAudioVolume;
                                if (ctl2 != null && vol != null) {
                                    uint pid;
                                    ctl2.GetProcessId(out pid);
                                    string procName = GetSessionProcessName(ctl2, pid);

                                    if (string.IsNullOrEmpty(procName) || procName == "System" || procName == "audiodg") continue;
                                    if (seenProcesses.Contains(procName)) continue;
                                    seenProcesses.Add(procName);

                                    float currentVol = 1.0f;
                                    bool isMuted = false;
                                    vol.GetMasterVolume(out currentVol);
                                    vol.GetMute(out isMuted);

                                    if (!firstSession) sb.Append(",");
                                    firstSession = false;
                                    sb.Append("{");
                                    sb.AppendFormat("\"name\":\"{0}\",\"process\":\"{1}\",\"type\":\"app\",\"volume\":{2},\"muted\":{3}",
                                        EscapeJson(FormatAppName(procName)), EscapeJson(procName), (int)Math.Round(currentVol * 100), isMuted ? "true" : "false");
                                    sb.Append("}");
                                }
                            }
                        } catch {}
                    }
                }
            } catch {}
            sb.Append("],");

            // 4. Brightness
            int brightness = GetBrightness();
            sb.AppendFormat("\"brightness\":{0}", brightness);

            sb.Append("}");
            Console.WriteLine(sb.ToString());
        } catch (Exception ex) {
            Console.WriteLine("{\"error\":\"" + EscapeJson(ex.Message) + "\"}");
        }
    }

    static string FormatAppName(string proc) {
        if (string.IsNullOrEmpty(proc)) return "Audio App";
        string l = proc.ToLower();
        if (l == "chrome") return "Google Chrome";
        if (l == "brave") return "Brave Browser";
        if (l == "msedge") return "Microsoft Edge";
        if (l == "firefox") return "Mozilla Firefox";
        if (l == "discord") return "Discord";
        if (l == "spotify") return "Spotify";
        if (l == "obs64" || l == "obs") return "OBS Studio";
        if (l == "steam") return "Steam";
        if (l.IndexOf("fallguys", StringComparison.OrdinalIgnoreCase) >= 0) return "Fall Guys";
        if (l.IndexOf("tslgame", StringComparison.OrdinalIgnoreCase) >= 0) return "PUBG: BATTLEGROUNDS";
        if (l.IndexOf("fortnite", StringComparison.OrdinalIgnoreCase) >= 0) return "Fortnite";
        if (l.IndexOf("valorant", StringComparison.OrdinalIgnoreCase) >= 0) return "Valorant";
        if (l.IndexOf("cs2", StringComparison.OrdinalIgnoreCase) >= 0 || l.IndexOf("csgo", StringComparison.OrdinalIgnoreCase) >= 0) return "Counter-Strike 2";
        if (l.IndexOf("r5apex", StringComparison.OrdinalIgnoreCase) >= 0) return "Apex Legends";
        if (l.IndexOf("gta5", StringComparison.OrdinalIgnoreCase) >= 0) return "Grand Theft Auto V";
        if (l.IndexOf("genshin", StringComparison.OrdinalIgnoreCase) >= 0) return "Genshin Impact";
        if (l.IndexOf("dota2", StringComparison.OrdinalIgnoreCase) >= 0) return "Dota 2";
        if (l.IndexOf("leagueclient", StringComparison.OrdinalIgnoreCase) >= 0 || l.IndexOf("league of legends", StringComparison.OrdinalIgnoreCase) >= 0) return "League of Legends";

        string clean = proc;
        clean = clean.Replace("-Win64-Shipping", "").Replace("_Win64_Shipping", "").Replace("-Shipping", "").Replace("_client_game", "").Replace("_client", "");
        return clean;
    }

    static string EscapeJson(string s) {
        if (string.IsNullOrEmpty(s)) return "";
        return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", "");
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
        try {
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
            return;
        } catch {}

        try {
            Process.Start(new ProcessStartInfo("cmd.exe", "/c start ms-screenclip:") {
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            });
        } catch {}
    }

    // ─── Launch Target (Apps, URLs) ───
    public static void OpenTarget(string target) {
        string t = target.Trim();

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

        if (t.Equals("settings", StringComparison.OrdinalIgnoreCase) ||
            t.Equals("ms-settings:", StringComparison.OrdinalIgnoreCase)) {
            try {
                Process.Start(new ProcessStartInfo("cmd.exe", "/c start ms-settings:") { UseShellExecute = true, WindowStyle = ProcessWindowStyle.Hidden });
                return;
            } catch {}
        }

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
        CoInitialize(IntPtr.Zero);
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
        } else if (cmd == "list-audio") {
            OutputAudioJson();
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
        } else if (cmd == "setappvol" && allArgs.Length >= 3) {
            float percent;
            if (float.TryParse(allArgs[allArgs.Length - 1], out percent)) {
                string proc = string.Join(" ", allArgs, 1, allArgs.Length - 2);
                SetAppVolume(proc, percent / 100.0f);
            }
        } else if (cmd == "appmute" && allArgs.Length >= 2) {
            string proc = string.Join(" ", allArgs, 1, allArgs.Length - 1);
            ToggleAppMute(proc);
        } else if (cmd == "setdevvol" && allArgs.Length >= 3) {
            float percent;
            if (float.TryParse(allArgs[allArgs.Length - 1], out percent)) {
                string target = string.Join(" ", allArgs, 1, allArgs.Length - 2);
                SetDeviceVolume(target, percent / 100.0f);
            }
        } else if (cmd == "devmute" && allArgs.Length >= 2) {
            string target = string.Join(" ", allArgs, 1, allArgs.Length - 1);
            ToggleDeviceMute(target);
        } else if (cmd == "setbrightness" && allArgs.Length >= 2) {
            int b;
            if (int.TryParse(allArgs[1], out b)) {
                SetBrightness(b);
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
