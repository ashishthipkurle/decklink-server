using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public class TestFocus {
    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    public static void Main(string[] args) {
        IntPtr hwnd = GetForegroundWindow();
        StringBuilder sb = new StringBuilder(256);
        GetWindowText(hwnd, sb, 256);
        uint pid;
        GetWindowThreadProcessId(hwnd, out pid);
        string procName = "unknown";
        try { procName = Process.GetProcessById((int)pid).ProcessName; } catch {}

        string msg = string.Format("[Focus Check] HWND: 0x{0:X}, PID: {1} ({2}), Title: \"{3}\"",
            hwnd.ToInt64(), pid, procName, sb.ToString());
        Console.WriteLine(msg);
        string logPath = @"d:\All Projects\My_Elgato_Steam_deck\decklink-server\focus_log.txt";
        File.AppendAllText(logPath, msg + Environment.NewLine);
    }
}
