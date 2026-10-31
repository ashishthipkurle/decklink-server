using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

public class TestTyping {
    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    static extern bool SetForegroundWindow(IntPtr hWnd);

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT {
        public uint type;
        public InputUnion u;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct InputUnion {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
        [FieldOffset(0)] public HARDWAREINPUT hi;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT {
        public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT {
        public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct HARDWAREINPUT {
        public uint uMsg; public ushort wParamL; public ushort wParamH;
    }

    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_UNICODE = 0x0004;

    public static void TypeText(string text) {
        foreach (char c in text) {
            INPUT[] inputs = new INPUT[2];
            // Keydown
            inputs[0].type = INPUT_KEYBOARD;
            inputs[0].u.ki.wScan = (ushort)c;
            inputs[0].u.ki.dwFlags = KEYEVENTF_UNICODE;
            // Keyup
            inputs[1].type = INPUT_KEYBOARD;
            inputs[1].u.ki.wScan = (ushort)c;
            inputs[1].u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;

            uint ret = SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
            if (ret != 2) {
                Console.WriteLine("SendInput failed for char '" + c + "', ret=" + ret + ", err=" + Marshal.GetLastWin32Error());
            }
            Thread.Sleep(20);
        }
    }

    public static void Main(string[] args) {
        Process p = Process.Start("notepad.exe");
        Thread.Sleep(1000);
        SetForegroundWindow(p.MainWindowHandle);
        Thread.Sleep(500);
        Console.WriteLine("Typing into Notepad...");
        TypeText("DeckLink Test Success!\n");
        Console.WriteLine("Done.");
    }
}

