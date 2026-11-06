using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace CpsOverlay
{
    /// <summary>
    /// An always-on-top overlay that mouse clicks pass straight through, so it sits over
    /// Minecraft without getting in the way. It's a per-pixel-alpha layered window: each frame
    /// is drawn into a bitmap by <see cref="OverlayRenderer"/> and handed to Windows as is.
    /// Options live on the tray icon next to the clock.
    /// </summary>
    public sealed class OverlayForm : Form
    {
        private const int HistorySeconds = 6;
        private const double HistoryStep = 0.05; // seconds between graph samples
        private const double MeterTimeConstant = 0.07; // how quickly the bar slides to the CPS
        private const double PulseTimeConstant = 0.18; // how quickly the click glow fades

        private readonly Settings settings = Settings.Load();
        private readonly ClickStats left = new ClickStats();
        private readonly ClickStats right = new ClickStats();
        private readonly AutoclickDetector leftCheck = new AutoclickDetector();
        private readonly AutoclickDetector rightCheck = new AutoclickDetector();
        private readonly PingMonitor ping;
        private readonly MouseHook hook;
        private readonly OverlayRenderer renderer = new OverlayRenderer();
        private readonly OverlayState state = new OverlayState();
        private readonly Queue<float> history = new Queue<float>();
        private readonly Timer frameTimer = new Timer { Interval = 15 }; // ~60 frames a second
        private readonly NotifyIcon tray;
        private readonly ToolStripMenuItem moveItem;
        private readonly ToolStripMenuItem pingItem;
        private readonly ToolStripMenuItem showItem;
        private readonly double startTime = Now;
        private bool clickThrough = true;
        private double lastFrame = Now;
        private double nextSample = Now;
        private float dpiScale = 1f;
        private int frames;

        private static double Now => Stopwatch.GetTimestamp() / (double)Stopwatch.Frequency;

        public OverlayForm()
        {
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            Text = "CPS Overlay";
            Location = OnScreen(new Point(settings.X, settings.Y));
            Size = new Size(OverlayRenderer.Width, OverlayRenderer.Height);

            ping = new PingMonitor(settings.PingTarget);

            try
            {
                hook = new MouseHook();
                hook.ButtonChanged += OnButton;
            }
            catch (Exception ex)
            {
                MessageBox.Show("CPS Overlay couldn't start watching the mouse:\n" + ex.Message,
                    "CPS Overlay", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Environment.Exit(1);
            }

            moveItem = new ToolStripMenuItem("Move overlay (drag it, then click here again)") { CheckOnClick = true };
            moveItem.CheckedChanged += (s, e) => SetClickThrough(!moveItem.Checked);
            pingItem = new ToolStripMenuItem();
            pingItem.Click += (s, e) => AskPingTarget();
            showItem = new ToolStripMenuItem("Show overlay") { Checked = true, CheckOnClick = true };
            showItem.CheckedChanged += (s, e) => Visible = showItem.Checked;
            var sizeItem = new ToolStripMenuItem("Size");
            foreach (var (label, value) in new[] { ("Small", 0.8f), ("Medium", 1.0f), ("Large", 1.25f), ("Extra large", 1.5f) })
            {
                var item = new ToolStripMenuItem(label) { Checked = Math.Abs(settings.Scale - value) < 0.01f, Tag = value };
                item.Click += (s, e) =>
                {
                    settings.Scale = value;
                    settings.Save();
                    foreach (ToolStripMenuItem other in sizeItem.DropDownItems) other.Checked = other == item;
                };
                sizeItem.DropDownItems.Add(item);
            }
            var resetItem = new ToolStripMenuItem("Reset best CPS and checks");
            resetItem.Click += (s, e) => ResetAll();
            var exitItem = new ToolStripMenuItem("Exit");
            exitItem.Click += (s, e) => Close();
            UpdatePingItem();

            var menu = new ContextMenuStrip();
            menu.Items.AddRange(new ToolStripItem[]
            {
                new ToolStripMenuItem("CPS Overlay - Made by ProMouser") { Enabled = false },
                new ToolStripSeparator(),
                showItem, moveItem, sizeItem, pingItem, resetItem,
                new ToolStripSeparator(),
                exitItem,
            });

            tray = new NotifyIcon
            {
                Icon = MakeIcon(),
                Text = "CPS Overlay (right-click for options)",
                ContextMenuStrip = menu,
                Visible = true,
            };
            tray.DoubleClick += (s, e) => showItem.Checked = !showItem.Checked;

            frameTimer.Tick += (s, e) => OnFrame();
        }

        protected override bool ShowWithoutActivation => true;

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.ExStyle |= WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT;
                return cp;
            }
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            UpdateDpi();
            OnFrame();
            frameTimer.Start();
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            tray.ShowBalloonTip(4000, "CPS Overlay is running",
                "Right-click the icon next to the clock to move or resize the overlay, change the ping target or exit.", ToolTipIcon.Info);
        }

        // Windows paints nothing for layered windows; every frame comes from OnFrame.
        protected override void OnPaintBackground(PaintEventArgs e) { }
        protected override void OnPaint(PaintEventArgs e) { }

        // ---- Input ----

        private void OnButton(ClickButton button, bool pressed, bool injected)
        {
            double now = Now;
            ClickStats stats = button == ClickButton.Left ? left : right;
            AutoclickDetector check = button == ClickButton.Left ? leftCheck : rightCheck;
            if (pressed)
            {
                stats.Press(now);
                check.Press(now, injected, stats.Cps(now));
                if (button == ClickButton.Left) state.Pulse = 1f;
            }
            else
            {
                check.Release(now, injected);
            }
        }

        private void ResetAll()
        {
            left.ResetBest();
            right.ResetBest();
            leftCheck.Reset();
            rightCheck.Reset();
        }

        // ---- Frames ----

        private void OnFrame()
        {
            double now = Now;
            double dt = Math.Min(0.25, now - lastFrame);
            lastFrame = now;

            // Live CPS = presses in the last second, so it climbs with every click and
            // falls away within a second of stopping.
            int cps = left.Cps(now);
            state.Cps = cps;
            state.RightCps = right.Cps(now);
            state.Best = left.Best;
            state.RightBest = right.Best;
            state.Meter += (float)((cps - state.Meter) * (1 - Math.Exp(-dt / MeterTimeConstant)));
            if (Math.Abs(state.Meter - cps) < 0.01f) state.Meter = cps;
            state.Pulse *= (float)Math.Exp(-dt / PulseTimeConstant);
            state.Time = (float)(now - startTime);

            while (now >= nextSample)
            {
                history.Enqueue(state.Meter);
                while (history.Count > HistorySeconds / HistoryStep) history.Dequeue();
                nextSample += HistoryStep;
                if (now - nextSample > 1) nextSample = now; // after sleep/hibernate
            }
            state.History = history.ToArray();

            var p = ping.Read();
            state.PingMeasuring = p.Samples == 0;
            state.PingMs = p.LastMs;
            state.PingAverage = p.AverageMs;
            state.PingLoss = p.LossPercent;
            state.PingTcp = p.Tcp;
            state.PingHistory = p.History ?? new long?[0];

            Verdict lv = leftCheck.Check(now, out string lReason);
            Verdict rv = rightCheck.Check(now, out string rReason);
            bool showRight = rv > lv;
            state.Verdict = showRight ? rv : lv;
            state.Reason = showRight ? "right click: " + rReason : lReason;
            state.MoveMode = !clickThrough;

            if (++frames % 60 == 0)
            {
                UpdateDpi();
                if (Visible) KeepOnTop(); // games sometimes push other windows behind them
            }
            if (Visible) Present(renderer.Render(state, dpiScale * settings.Scale));
        }

        private void Present(Bitmap frame)
        {
            IntPtr screenDc = GetDC(IntPtr.Zero);
            IntPtr memDc = CreateCompatibleDC(screenDc);
            IntPtr hBitmap = frame.GetHbitmap(Color.FromArgb(0));
            IntPtr old = SelectObject(memDc, hBitmap);
            try
            {
                var size = new SIZE { cx = frame.Width, cy = frame.Height };
                var source = new POINT();
                var blend = new BLENDFUNCTION { BlendOp = AC_SRC_OVER, SourceConstantAlpha = 255, AlphaFormat = AC_SRC_ALPHA };
                UpdateLayeredWindow(Handle, screenDc, IntPtr.Zero, ref size, memDc, ref source, 0, ref blend, ULW_ALPHA);
            }
            finally
            {
                SelectObject(memDc, old);
                DeleteObject(hBitmap);
                DeleteDC(memDc);
                ReleaseDC(IntPtr.Zero, screenDc);
            }
        }

        private void UpdateDpi()
        {
            try
            {
                uint dpi = GetDpiForWindow(Handle);
                if (dpi > 0) dpiScale = dpi / 96f;
            }
            catch (EntryPointNotFoundException)
            {
                using (Graphics g = CreateGraphics()) dpiScale = g.DpiX / 96f; // Windows older than 10 (1607)
            }
        }

        // ---- Moving ----

        private void SetClickThrough(bool on)
        {
            clickThrough = on;
            int ex = GetWindowLong(Handle, GWL_EXSTYLE);
            ex = on ? ex | WS_EX_TRANSPARENT : ex & ~WS_EX_TRANSPARENT;
            SetWindowLong(Handle, GWL_EXSTYLE, ex);
            if (on)
            {
                settings.X = Left;
                settings.Y = Top;
                settings.Save();
            }
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            if (clickThrough || e.Button != MouseButtons.Left) return;
            ReleaseCapture();
            SendMessage(Handle, WM_NCLBUTTONDOWN, (IntPtr)HTCAPTION, IntPtr.Zero);
        }

        private static Point OnScreen(Point p)
        {
            foreach (Screen screen in Screen.AllScreens)
                if (screen.WorkingArea.Contains(p)) return p;
            return new Point(20, 20);
        }

        private void KeepOnTop() =>
            SetWindowPos(Handle, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);

        // ---- Ping target ----

        private void UpdatePingItem() => pingItem.Text = $"Ping target: {ping.Target}…";

        private void AskPingTarget()
        {
            using (var dialog = new Form
            {
                Text = "Ping target",
                FormBorderStyle = FormBorderStyle.FixedDialog,
                StartPosition = FormStartPosition.CenterScreen,
                MinimizeBox = false,
                MaximizeBox = false,
                TopMost = true,
                AutoScaleMode = AutoScaleMode.Dpi,
                ClientSize = new Size(380, 130),
            })
            {
                var label = new Label
                {
                    Text = "IP address or website to ping. Use the host's computer IP to see your ping to them, " +
                           $"or {Settings.DefaultPingTarget} for your internet ping.",
                    Location = new Point(12, 10),
                    Size = new Size(356, 40),
                };
                var box = new TextBox { Text = ping.Target, Location = new Point(12, 56), Width = 356 };
                var ok = new System.Windows.Forms.Button { Text = "OK", DialogResult = DialogResult.OK, Location = new Point(212, 92), Width = 75 };
                var cancel = new System.Windows.Forms.Button { Text = "Cancel", DialogResult = DialogResult.Cancel, Location = new Point(293, 92), Width = 75 };
                dialog.Controls.AddRange(new Control[] { label, box, ok, cancel });
                dialog.AcceptButton = ok;
                dialog.CancelButton = cancel;

                if (dialog.ShowDialog() != DialogResult.OK) return;
                string target = box.Text.Trim();
                if (target.Length == 0) target = Settings.DefaultPingTarget;
                ping.Target = target;
                settings.PingTarget = target;
                settings.Save();
                UpdatePingItem();
            }
        }

        // ---- Tray icon ----

        private static Icon MakeIcon()
        {
            using (var bmp = new Bitmap(32, 32))
            using (Graphics g = Graphics.FromImage(bmp))
            using (var bg = new SolidBrush(Color.FromArgb(14, 16, 26)))
            using (var border = new Pen(Color.FromArgb(0, 229, 255), 3))
            using (var bar = new SolidBrush(Color.FromArgb(255, 46, 151)))
            using (Font f = GameFonts.Create(GameFonts.DisplayHeavy, 11f))
            using (var text = new SolidBrush(Color.White))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAlias;
                g.FillRectangle(bg, 0, 0, 32, 32);
                g.DrawRectangle(border, 1.5f, 1.5f, 29, 29);
                g.FillRectangle(bar, 6, 23, 20, 3);
                var format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                g.DrawString("CPS", f, text, new RectangleF(0, -2, 32, 30), format);
                return Icon.FromHandle(bmp.GetHicon());
            }
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            frameTimer.Stop();
            hook?.Dispose();
            ping.Dispose();
            renderer.Dispose();
            tray.Visible = false;
            tray.Dispose();
            base.OnFormClosed(e);
        }

        // ---- Win32 ----

        private const int GWL_EXSTYLE = -20;
        private const int WS_EX_TRANSPARENT = 0x20, WS_EX_TOOLWINDOW = 0x80, WS_EX_LAYERED = 0x80000, WS_EX_NOACTIVATE = 0x08000000;
        private const int WM_NCLBUTTONDOWN = 0xA1, HTCAPTION = 2;
        private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        private const uint SWP_NOSIZE = 0x1, SWP_NOMOVE = 0x2, SWP_NOACTIVATE = 0x10;
        private const byte AC_SRC_OVER = 0, AC_SRC_ALPHA = 1;
        private const int ULW_ALPHA = 2;

        [StructLayout(LayoutKind.Sequential)] private struct POINT { public int x, y; }
        [StructLayout(LayoutKind.Sequential)] private struct SIZE { public int cx, cy; }

        [StructLayout(LayoutKind.Sequential, Pack = 1)]
        private struct BLENDFUNCTION
        {
            public byte BlendOp, BlendFlags, SourceConstantAlpha, AlphaFormat;
        }

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool UpdateLayeredWindow(IntPtr hwnd, IntPtr hdcDst, IntPtr pptDst, ref SIZE psize,
            IntPtr hdcSrc, ref POINT pptSrc, int crKey, ref BLENDFUNCTION pblend, int dwFlags);

        [DllImport("user32.dll")] private static extern IntPtr GetDC(IntPtr hWnd);
        [DllImport("user32.dll")] private static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);
        [DllImport("gdi32.dll")] private static extern IntPtr CreateCompatibleDC(IntPtr hDC);
        [DllImport("gdi32.dll")] private static extern bool DeleteDC(IntPtr hdc);
        [DllImport("gdi32.dll")] private static extern IntPtr SelectObject(IntPtr hDC, IntPtr hObject);
        [DllImport("gdi32.dll")] private static extern bool DeleteObject(IntPtr hObject);
        [DllImport("user32.dll")] private static extern uint GetDpiForWindow(IntPtr hwnd);
        [DllImport("user32.dll")] private static extern int GetWindowLong(IntPtr hWnd, int nIndex);
        [DllImport("user32.dll")] private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
        [DllImport("user32.dll")] private static extern bool ReleaseCapture();
        [DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);
        [DllImport("user32.dll")]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
    }
}
