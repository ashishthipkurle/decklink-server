using System;
using System.Runtime.InteropServices;
using System.Threading;

public class TestHotkey {
    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    static extern uint MapVirtualKey(uint uCode, uint uMapType);

    [StructLayout(LayoutKind.Sequential)]
    struct INPUT {
        public uint type;
        public MOUSEKEYBDHARDWAREINPUT mi;
    }

    [StructLayout(LayoutKind.Explicit)]
    struct MOUSEKEYBDHARDWAREINPUT {
        [FieldOffset(0)]
        public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_SCANCODE = 0x0008;

    public static void SendKey(ushort vk, bool down) {
        INPUT[] inputs = new INPUT[1];
        inputs[0].type = INPUT_KEYBOARD;
        inputs[0].mi.ki.wVk = vk;
        inputs[0].mi.ki.wScan = (ushort)MapVirtualKey(vk, 0);
        inputs[0].mi.ki.dwFlags = (down ? 0 : KEYEVENTF_KEYUP);
        if (vk == 0x5B || vk == 0x5C || (vk >= 33 && vk <= 46) || (vk >= 166 && vk <= 183)) {
            inputs[0].mi.ki.dwFlags |= KEYEVENTF_EXTENDEDKEY;
        }
        SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    public static void Main(string[] args) {
        Console.WriteLine("Sending Win + I (Settings)...");
        // Win down
        SendKey(0x5B, true);
        Thread.Sleep(50);
        // I down
        SendKey(0x49, true);
        Thread.Sleep(100);
        // I up
        SendKey(0x49, false);
        Thread.Sleep(50);
        // Win up
        SendKey(0x5B, false);
        Console.WriteLine("Done.");
    }
}

