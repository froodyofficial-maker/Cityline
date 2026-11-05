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
    /// A small always-on-top box that the mouse clicks straight through, so it sits over
    /// Minecraft without getting in the way. Options live on the tray icon next to the clock.
    /// </summary>
    public sealed class OverlayForm : Form
    {
        private static readonly Color Background = Color.FromArgb(18, 18, 24);
        private static readonly Color Fg = Color.FromArgb(235, 235, 240);
        private static readonly Color Dim = Color.FromArgb(150, 150, 165);
        private static readonly Color Green = Color.FromArgb(110, 225, 120);
        private static readonly Color Yellow = Color.FromArgb(245, 215, 85);
        private static readonly Color Orange = Color.FromArgb(255, 165, 60);
        private static readonly Color Red = Color.FromArgb(255, 95, 95);

        private const int Pad = 10;
        private const int LineGap = 3;

        private readonly Font bigFont = new Font("Segoe UI", 18f, FontStyle.Bold);
        private readonly Font font = new Font("Segoe UI", 10f, FontStyle.Regular);
        private readonly Font boldFont = new Font("Segoe UI", 10f, FontStyle.Bold);
        private readonly Font smallFont = new Font("Segoe UI", 7.5f, FontStyle.Regular);

        private readonly Settings settings = Settings.Load();
        private readonly ClickStats left = new ClickStats();
        private readonly ClickStats right = new ClickStats();
        private readonly AutoclickDetector leftCheck = new AutoclickDetector();
        private readonly AutoclickDetector rightCheck = new AutoclickDetector();
        private readonly PingMonitor ping;
        private readonly MouseHook hook;
        private readonly Timer refresh = new Timer { Interval = 50 };
        private readonly NotifyIcon tray;
        private readonly ToolStripMenuItem moveItem;
        private readonly ToolStripMenuItem pingItem;
        private readonly ToolStripMenuItem showItem;
        private bool clickThrough = true;
        private int ticks;

        private static double Now => Stopwatch.GetTimestamp() / (double)Stopwatch.Frequency;

        public OverlayForm()
        {
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            BackColor = Background;
            Opacity = 0.88;
            DoubleBuffered = true;
            Text = "CPS Overlay";
            Location = OnScreen(new Point(settings.X, settings.Y));
            ClientSize = new Size(260, 120);

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
                showItem, moveItem, pingItem, resetItem,
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

            refresh.Tick += (s, e) => OnRefresh();
            refresh.Start();
        }

        protected override bool ShowWithoutActivation => true;

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.ExStyle |= WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_LAYERED | WS_EX_TRANSPARENT;
                return cp;
            }
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            tray.ShowBalloonTip(4000, "CPS Overlay is running",
                "Right-click the icon next to the clock to move the overlay, change the ping target or exit.", ToolTipIcon.Info);
        }

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

        // ---- Drawing ----

        private struct Piece
        {
            public string Text;
            public Font Font;
            public Color Color;
            public Piece(string text, Font font, Color color) { Text = text; Font = font; Color = color; }
        }

        private List<List<Piece>> BuildLines()
        {
            double now = Now;
            int l = left.Cps(now), r = right.Cps(now);
            var lines = new List<List<Piece>>();

            lines.Add(new List<Piece>
            {
                new Piece($"{l}", bigFont, CpsColor(l)),
                new Piece(" CPS", boldFont, Fg),
                new Piece($"    Right {r}", font, r > 0 ? CpsColor(r) : Dim),
            });
            lines.Add(new List<Piece>
            {
                new Piece("Best  ", font, Dim),
                new Piece($"{left.Best}", boldFont, Fg),
                new Piece("  ·  Right ", font, Dim),
                new Piece($"{right.Best}", boldFont, Fg),
            });

            var p = ping.Read();
            var pingLine = new List<Piece> { new Piece("Ping  ", font, Dim) };
            if (p.Samples == 0)
                pingLine.Add(new Piece("measuring…", font, Dim));
            else if (p.LastMs is long ms)
                pingLine.Add(new Piece($"{ms} ms", boldFont, PingColor(ms)));
            else
                pingLine.Add(new Piece("no reply", boldFont, Red));
            if (p.Samples > 0)
            {
                string avg = p.AverageMs is long a ? $"avg {a}" : "avg -";
                pingLine.Add(new Piece($"  ({avg} · {p.LossPercent}% lost{(p.Tcp ? " · TCP" : "")})", font, Dim));
            }
            lines.Add(pingLine);

            Verdict lv = leftCheck.Check(now, out string lReason);
            Verdict rv = rightCheck.Check(now, out string rReason);
            bool showRight = rv > lv;
            Verdict v = showRight ? rv : lv;
            string reason = showRight ? "right click: " + rReason : rReason;
            switch (v)
            {
                case Verdict.Autoclicker:
                    lines.Add(new List<Piece> { new Piece("✖ Autoclicker: ", boldFont, Red), new Piece(reason, font, Red) });
                    break;
                case Verdict.Suspicious:
                    lines.Add(new List<Piece> { new Piece("⚠ Suspicious: ", boldFont, Yellow), new Piece(reason, font, Yellow) });
                    break;
                case Verdict.Human:
                    lines.Add(new List<Piece> { new Piece("✔ No autoclicker: ", boldFont, Green), new Piece(reason, font, Green) });
                    break;
                default:
                    lines.Add(new List<Piece> { new Piece("Autoclicker check: ", font, Dim), new Piece(reason, font, Dim) });
                    break;
            }

            lines.Add(new List<Piece> { new Piece("Made by ProMouser", smallFont, Dim) });
            return lines;
        }

        private const TextFormatFlags Flags = TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix | TextFormatFlags.SingleLine;

        private Size Measure(Graphics g, List<List<Piece>> lines)
        {
            int width = 0, height = 0;
            foreach (var line in lines)
            {
                int w = 0, h = 0;
                foreach (var piece in line)
                {
                    Size s = TextRenderer.MeasureText(g, piece.Text, piece.Font, Size.Empty, Flags);
                    w += s.Width;
                    h = Math.Max(h, s.Height);
                }
                width = Math.Max(width, w);
                height += h + LineGap;
            }
            return new Size(width + Pad * 2, height - LineGap + Pad * 2);
        }

        private void OnRefresh()
        {
            if (++ticks % 40 == 0 && Visible) KeepOnTop(); // games sometimes push other windows behind them
            if (!Visible) return;
            using (Graphics g = CreateGraphics())
            {
                Size size = Measure(g, BuildLines());
                if (size != ClientSize) ClientSize = size;
            }
            Invalidate();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            if (!clickThrough)
            {
                using (var pen = new Pen(Yellow, 2)) g.DrawRectangle(pen, 1, 1, ClientSize.Width - 2, ClientSize.Height - 2);
            }

            int y = Pad;
            foreach (var line in BuildLines())
            {
                var sizes = new List<Size>();
                int h = 0;
                foreach (var piece in line)
                {
                    Size s = TextRenderer.MeasureText(g, piece.Text, piece.Font, Size.Empty, Flags);
                    sizes.Add(s);
                    h = Math.Max(h, s.Height);
                }
                int x = Pad;
                for (int i = 0; i < line.Count; i++)
                {
                    // Bottom-align pieces of different sizes on one baseline-ish line.
                    int dy = h - sizes[i].Height - (line[i].Font == bigFont ? 0 : 3);
                    TextRenderer.DrawText(g, line[i].Text, line[i].Font, new Point(x, y + Math.Max(0, dy)), line[i].Color, Flags);
                    x += sizes[i].Width;
                }
                y += h + LineGap;
            }
        }

        private static Color CpsColor(int cps)
        {
            if (cps >= 12) return Red;
            if (cps >= 8) return Orange;
            if (cps >= 4) return Yellow;
            return Green;
        }

        private static Color PingColor(long ms)
        {
            if (ms < 60) return Green;
            if (ms < 120) return Yellow;
            return Red;
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
            Invalidate();
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
            using (var bg = new SolidBrush(Color.FromArgb(40, 44, 52)))
            using (var border = new Pen(Color.FromArgb(255, 200, 40), 3))
            using (var f = new Font("Segoe UI", 9f, FontStyle.Bold, GraphicsUnit.Pixel))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.FillRectangle(bg, 0, 0, 32, 32);
                g.DrawRectangle(border, 1, 1, 29, 29);
                TextRenderer.DrawText(g, "CPS", f, new Rectangle(0, 0, 32, 32), Color.White,
                    TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
                return Icon.FromHandle(bmp.GetHicon());
            }
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            refresh.Stop();
            hook?.Dispose();
            ping.Dispose();
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

        [DllImport("user32.dll")] private static extern int GetWindowLong(IntPtr hWnd, int nIndex);
        [DllImport("user32.dll")] private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
        [DllImport("user32.dll")] private static extern bool ReleaseCapture();
        [DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);
        [DllImport("user32.dll")]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
    }
}
