using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

namespace CpsOverlay
{
    public enum ClickButton { Left, Right }

    /// <summary>
    /// Low-level mouse hook: sees every mouse button press on the computer, in any window,
    /// without needing admin rights. Must be created on a thread with a message loop (the UI thread).
    /// </summary>
    public sealed class MouseHook : IDisposable
    {
        public delegate void ButtonHandler(ClickButton button, bool pressed, bool injected);

        public event ButtonHandler ButtonChanged;

        private const int WH_MOUSE_LL = 14;
        private const int WM_LBUTTONDOWN = 0x0201, WM_LBUTTONUP = 0x0202;
        private const int WM_RBUTTONDOWN = 0x0204, WM_RBUTTONUP = 0x0205;
        private const int LLMHF_INJECTED = 0x01, LLMHF_LOWER_IL_INJECTED = 0x02;
        private const int FlagsOffset = 12; // MSLLHOOKSTRUCT: POINT pt (8), DWORD mouseData (4), DWORD flags

        private delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

        private readonly LowLevelMouseProc proc; // kept in a field so the GC doesn't collect it
        private IntPtr hook;

        public MouseHook()
        {
            proc = Callback;
            hook = SetWindowsHookEx(WH_MOUSE_LL, proc, GetModuleHandle(null), 0);
            if (hook == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        }

        private IntPtr Callback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                int message = wParam.ToInt32();
                ClickButton? button = null;
                bool pressed = false;
                switch (message)
                {
                    case WM_LBUTTONDOWN: button = ClickButton.Left; pressed = true; break;
                    case WM_LBUTTONUP: button = ClickButton.Left; break;
                    case WM_RBUTTONDOWN: button = ClickButton.Right; pressed = true; break;
                    case WM_RBUTTONUP: button = ClickButton.Right; break;
                }
                if (button.HasValue)
                {
                    int flags = Marshal.ReadInt32(lParam, FlagsOffset);
                    bool injected = (flags & (LLMHF_INJECTED | LLMHF_LOWER_IL_INJECTED)) != 0;
                    ButtonChanged?.Invoke(button.Value, pressed, injected);
                }
            }
            return CallNextHookEx(hook, nCode, wParam, lParam);
        }

        public void Dispose()
        {
            if (hook != IntPtr.Zero)
            {
                UnhookWindowsHookEx(hook);
                hook = IntPtr.Zero;
            }
        }

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll")]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);
    }
}
