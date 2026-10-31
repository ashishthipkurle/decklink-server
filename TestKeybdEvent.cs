using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

public class TestKeybdEvent {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    static extern bool SetForegroundWindow(IntPtr hWnd);

    const uint KEYEVENTF_KEYUP = 0x0002;

    public static void Main(string[] args) {
        Process p = Process.Start("notepad.exe");
        Thread.Sleep(1000);
        SetForegroundWindow(p.MainWindowHandle);
        Thread.Sleep(500);

        Console.WriteLine("Typing with keybd_event...");
        // Press 'H' (72)
        keybd_event(72, 0, 0, UIntPtr.Zero);
        Thread.Sleep(30);
        keybd_event(72, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        Thread.Sleep(30);
        // Press 'I' (73)
        keybd_event(73, 0, 0, UIntPtr.Zero);
        Thread.Sleep(30);
        keybd_event(73, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

        Console.WriteLine("Done.");
    }
}

