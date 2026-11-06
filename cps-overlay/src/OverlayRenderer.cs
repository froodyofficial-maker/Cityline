using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;

namespace CpsOverlay
{
    /// <summary>Everything the overlay shows in one frame.</summary>
    public sealed class OverlayState
    {
        public int Cps;
        public int RightCps;
        public int Best;
        public int RightBest;
        public float Meter;        // smoothed CPS for the bar, so it slides instead of jumping
        public float Pulse;        // 1 right after a click, fades to 0
        public float[] History = new float[0]; // CPS over the last few seconds, oldest first
        public long? PingMs;
        public long? PingAverage;
        public int PingLoss;
        public bool PingTcp;
        public bool PingMeasuring = true;
        public long?[] PingHistory = new long?[0];
        public Verdict Verdict;
        public string Reason = "";
        public bool MoveMode;
        public float Time;         // seconds, for animations
    }

    /// <summary>
    /// Draws the overlay into a transparent bitmap (rounded panel with soft edges), in a fixed
    /// 300-pixel-wide layout scaled up or down for the screen's DPI and the chosen size.
    /// </summary>
    public sealed class OverlayRenderer : IDisposable
    {
        public const int Width = 300;
        public const int Height = 290;
        private const float Pad = 14f;
        public const int MeterSegments = 20;

        // Palette
        private static readonly Color PanelTop = Color.FromArgb(238, 16, 18, 30);
        private static readonly Color PanelBottom = Color.FromArgb(238, 9, 10, 18);
        private static readonly Color Cyan = Color.FromArgb(0, 229, 255);
        private static readonly Color Magenta = Color.FromArgb(255, 46, 151);
        private static readonly Color Green = Color.FromArgb(57, 255, 136);
        private static readonly Color Yellow = Color.FromArgb(255, 214, 10);
        private static readonly Color Orange = Color.FromArgb(255, 138, 36);
        private static readonly Color Red = Color.FromArgb(255, 56, 96);
        private static readonly Color White = Color.FromArgb(240, 242, 250);
        private static readonly Color Dim = Color.FromArgb(128, 134, 160);

        private readonly Font titleFont = GameFonts.Create(GameFonts.Display, 9.5f);
        private readonly Font tagFont = GameFonts.Create(GameFonts.Display, 8f);
        private readonly Font unitFont = GameFonts.Create(GameFonts.Display, 10f);
        private readonly Font valueFont = GameFonts.Create(GameFonts.Display, 16f);
        private readonly Font smallUnitFont = GameFonts.Create(GameFonts.Display, 8.5f);
        private readonly Font labelFont = GameFonts.Create(GameFonts.Body, 11f);
        private readonly Font bodyFont = GameFonts.Create(GameFonts.Body, 12.5f);
        private readonly Font badgeFont = GameFonts.Create(GameFonts.Display, 8.5f);
        private readonly Font footerFont = GameFonts.Create(GameFonts.Display, 7f);
        private readonly Font bigFont = GameFonts.Create(GameFonts.DisplayHeavy, 58f);

        private Bitmap bitmap;

        /// <summary>Renders a frame. The bitmap is reused between frames; don't dispose it.</summary>
        public Bitmap Render(OverlayState s, float scale)
        {
            int w = (int)Math.Ceiling(Width * scale), h = (int)Math.Ceiling(Height * scale);
            if (bitmap == null || bitmap.Width != w || bitmap.Height != h)
            {
                bitmap?.Dispose();
                bitmap = new Bitmap(w, h, PixelFormat.Format32bppArgb);
            }

            using (Graphics g = Graphics.FromImage(bitmap))
            {
                g.Clear(Color.Transparent);
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.TextRenderingHint = TextRenderingHint.AntiAlias;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.ScaleTransform(scale, scale);

                DrawPanel(g, s);
                DrawHeader(g, s);
                DrawBigNumber(g, s);
                DrawGraph(g, s, new RectangleF(152, 44, Width - Pad - 152, 62));
                DrawMeter(g, s, 126);
                DrawStats(g, s, 148);
                DrawPing(g, s, 192);
                DrawDivider(g, 234);
                DrawCheck(g, s, 243);
                DrawFooter(g, s, 279);
            }
            return bitmap;
        }

        // ---- Sections ----

        private void DrawPanel(Graphics g, OverlayState s)
        {
            var rect = new RectangleF(1, 1, Width - 2, Height - 2);
            using (GraphicsPath panel = Rounded(rect, 14))
            {
                using (var fill = new LinearGradientBrush(rect, PanelTop, PanelBottom, 90f)) g.FillPath(fill, panel);

                // Soft colour wash from the top-left corner.
                using (var wash = new LinearGradientBrush(rect, Color.FromArgb(28, Cyan), Color.FromArgb(0, Cyan), 35f)) g.FillPath(wash, panel);

                if (s.MoveMode)
                {
                    using (var pen = new Pen(Yellow, 2f) { DashStyle = DashStyle.Dash, DashOffset = s.Time * 8f }) g.DrawPath(pen, panel);
                }
                else
                {
                    using (var border = new LinearGradientBrush(rect, Color.FromArgb(200, Cyan), Color.FromArgb(200, Magenta), 20f))
                    using (var pen = new Pen(border, 1.3f)) g.DrawPath(pen, panel);
                }
            }
        }

        private void DrawHeader(Graphics g, OverlayState s)
        {
            // Accent chevrons and title
            using (var brush = new SolidBrush(Cyan))
            {
                g.FillPolygon(brush, new[] { new PointF(Pad, 13), new PointF(Pad + 5, 18), new PointF(Pad, 23) });
            }
            using (var brush = new SolidBrush(Color.FromArgb(150, Cyan)))
            {
                g.FillPolygon(brush, new[] { new PointF(Pad + 6, 13), new PointF(Pad + 11, 18), new PointF(Pad + 6, 23) });
            }
            DrawTracked(g, "CPS OVERLAY", titleFont, White, Pad + 17, 22.5f, 1.6f);

            // LIVE / IDLE tag
            bool live = s.Cps > 0;
            string tag = s.MoveMode ? "DRAG TO MOVE" : live ? "LIVE" : "IDLE";
            Color tagColor = s.MoveMode ? Yellow : live ? Red : Dim;
            float tagWidth = TrackedWidth(g, tag, tagFont, 1.2f);
            float x = Width - Pad - tagWidth;
            DrawTracked(g, tag, tagFont, tagColor, x, 22f, 1.2f);
            if (live && !s.MoveMode)
            {
                float blink = 0.55f + 0.45f * (float)Math.Abs(Math.Sin(s.Time * 4));
                using (var dot = new SolidBrush(Color.FromArgb((int)(255 * blink), Red))) g.FillEllipse(dot, x - 12, 15, 6, 6);
                using (var glow = new SolidBrush(Color.FromArgb((int)(60 * blink), Red))) g.FillEllipse(glow, x - 15, 12, 12, 12);
            }

            DrawDivider(g, 32);
        }

        private void DrawBigNumber(Graphics g, OverlayState s)
        {
            Color color = CpsColor(s.Cps);
            string text = s.Cps.ToString();
            float baseline = 98;
            float x = Pad - 2;

            using (var path = new GraphicsPath())
            {
                FontFamily family = GameFonts.FamilyOf(bigFont);
                float ascent = Ascent(bigFont);
                path.AddString(text, family, (int)bigFont.Style, bigFont.Size, new PointF(x, baseline - ascent), StringFormat.GenericTypographic);

                // Neon glow: wide faint strokes under the solid number, brighter right after a click.
                float glow = s.Cps == 0 ? 0f : 0.35f + 0.65f * s.Pulse;
                foreach (var (width, alpha) in new[] { (14f, 18), (9f, 30), (5f, 50) })
                {
                    using (var pen = new Pen(Color.FromArgb((int)(alpha * glow), color), width) { LineJoin = LineJoin.Round })
                        g.DrawPath(pen, path);
                }
                using (var fill = new LinearGradientBrush(new RectangleF(x, baseline - 44, 10, 46), Lighten(color, 0.45f), color, 90f))
                    g.FillPath(fill, path);
            }

            DrawTracked(g, "CPS", unitFont, Dim, Pad, 116, 2.5f);
        }

        private void DrawGraph(Graphics g, OverlayState s, RectangleF r)
        {
            using (GraphicsPath box = Rounded(r, 6))
            using (var bg = new SolidBrush(Color.FromArgb(12, 255, 255, 255)))
            using (var outline = new Pen(Color.FromArgb(22, 255, 255, 255), 1f))
            {
                g.FillPath(bg, box);
                g.DrawPath(outline, box);
            }

            float[] h = s.History;
            float max = 20;
            foreach (float v in h) max = Math.Max(max, v);
            max = (float)Math.Ceiling(max / 5) * 5;

            float Y(float v) => r.Bottom - 4 - (r.Height - 10) * Math.Min(v, max) / max;

            // Grid lines at every 10 CPS
            using (var grid = new Pen(Color.FromArgb(22, 255, 255, 255), 1f) { DashStyle = DashStyle.Dot })
            {
                for (int v = 10; v < max; v += 10) g.DrawLine(grid, r.Left + 4, Y(v), r.Right - 4, Y(v));
            }
            DrawText(g, ((int)max).ToString() + " CPS", footerFont, Dim, r.Left + 6, r.Top + 11);
            DrawText(g, "LAST 6s", footerFont, Color.FromArgb(110, Dim), r.Right - 6 - TextWidth(g, "LAST 6s", footerFont), r.Bottom - 5);

            if (h.Length >= 2)
            {
                var points = new PointF[h.Length];
                for (int i = 0; i < h.Length; i++)
                    points[i] = new PointF(r.Left + 3 + (r.Width - 6) * i / (h.Length - 1), Y(h[i]));

                using (var area = new GraphicsPath())
                {
                    area.AddLines(points);
                    area.AddLine(points[points.Length - 1], new PointF(points[points.Length - 1].X, r.Bottom - 3));
                    area.AddLine(new PointF(points[points.Length - 1].X, r.Bottom - 3), new PointF(points[0].X, r.Bottom - 3));
                    area.CloseFigure();
                    using (var fill = new LinearGradientBrush(r, Color.FromArgb(90, Cyan), Color.FromArgb(0, Cyan), 90f)) g.FillPath(fill, area);
                }
                using (var lineBrush = new LinearGradientBrush(r, Cyan, Magenta, 0f))
                using (var line = new Pen(lineBrush, 1.8f) { LineJoin = LineJoin.Round })
                    g.DrawLines(line, points);

                PointF last = points[points.Length - 1];
                using (var dot = new SolidBrush(White)) g.FillEllipse(dot, last.X - 2.5f, last.Y - 2.5f, 5, 5);
            }
        }

        private void DrawMeter(Graphics g, OverlayState s, float y)
        {
            float x0 = Pad, total = Width - Pad * 2, gap = 2.5f;
            float seg = (total - gap * (MeterSegments - 1)) / MeterSegments;
            for (int i = 0; i < MeterSegments; i++)
            {
                var r = new RectangleF(x0 + i * (seg + gap), y, seg, 9);
                float lit = Clamp(s.Meter - i, 0, 1);
                Color c = SegmentColor(i);
                using (GraphicsPath p = Rounded(r, 2))
                {
                    using (var off = new SolidBrush(Color.FromArgb(20, 255, 255, 255))) g.FillPath(off, p);
                    if (lit > 0)
                    {
                        using (var glow = new SolidBrush(Color.FromArgb((int)(45 * lit), c)))
                            g.FillRectangle(glow, r.X - 1.5f, r.Y - 2, r.Width + 3, r.Height + 4);
                        using (var on = new SolidBrush(Color.FromArgb((int)(255 * lit), c))) g.FillPath(on, p);
                    }
                }
            }
        }

        private void DrawStats(Graphics g, OverlayState s, float y)
        {
            float colWidth = (Width - Pad * 2) / 3f;
            DrawStat(g, Pad, y, "RIGHT CLICK", s.RightCps.ToString(), "CPS", s.RightCps > 0 ? CpsColor(s.RightCps) : White);
            DrawStat(g, Pad + colWidth, y, "BEST", s.Best.ToString(), "CPS", White);
            DrawStat(g, Pad + colWidth * 2, y, "BEST RIGHT", s.RightBest.ToString(), "CPS", White);
        }

        private void DrawStat(Graphics g, float x, float y, string label, string value, string unit, Color color)
        {
            DrawTracked(g, label, labelFont, Dim, x, y + 9, 0.8f);
            DrawText(g, value, valueFont, color, x, y + 30);
            DrawText(g, unit, smallUnitFont, Dim, x + TextWidth(g, value, valueFont) + 4, y + 30);
        }

        private void DrawPing(Graphics g, OverlayState s, float y)
        {
            float labelBase = y + 9, valueBase = y + 30;
            DrawTracked(g, "PING", labelFont, Dim, Pad, labelBase, 0.8f);

            string detail = s.PingMeasuring ? "" :
                $"AVG {(s.PingAverage.HasValue ? s.PingAverage.Value.ToString() : "-")} MS  ·  {s.PingLoss}% LOSS{(s.PingTcp ? "  ·  TCP" : "")}";
            DrawText(g, detail, labelFont, Dim, Width - Pad - TextWidth(g, detail, labelFont), labelBase);

            string value;
            Color color;
            if (s.PingMeasuring) { value = "..."; color = Dim; }
            else if (s.PingMs is long ms) { value = ms.ToString(); color = PingColor(ms); }
            else { value = "LOST"; color = Red; }
            DrawText(g, value, valueFont, color, Pad, valueBase);
            if (s.PingMs.HasValue && !s.PingMeasuring)
                DrawText(g, "MS", smallUnitFont, Dim, Pad + TextWidth(g, value, valueFont) + 4, valueBase);

            // Bars for the last 20 pings, newest on the right
            int slots = PingMonitor.HistorySize;
            float left = 112, right = Width - Pad, gap = 2f, bh = 17;
            float bw = (right - left - gap * (slots - 1)) / slots;
            long?[] hist = s.PingHistory;
            int offset = slots - hist.Length;
            long scaleMax = 100;
            foreach (long? p in hist) if (p.HasValue) scaleMax = Math.Max(scaleMax, p.Value);
            for (int i = 0; i < slots; i++)
            {
                float x = left + i * (bw + gap);
                int hi = i - offset;
                long? p = hi >= 0 ? hist[hi] : null;
                using (var track = new SolidBrush(Color.FromArgb(14, 255, 255, 255))) g.FillRectangle(track, x, valueBase - bh, bw, bh);
                if (hi < 0) continue;
                if (p is long v)
                {
                    float bar = Math.Max(4, bh * Math.Min(v, scaleMax) / scaleMax);
                    using (var b = new SolidBrush(Color.FromArgb(225, PingColor(v)))) g.FillRectangle(b, x, valueBase - bar, bw, bar);
                }
                else
                {
                    using (var b = new SolidBrush(Red)) g.FillRectangle(b, x, valueBase - bh, bw, 3);
                }
            }
        }

        private void DrawCheck(Graphics g, OverlayState s, float y)
        {
            string badge;
            Color color;
            switch (s.Verdict)
            {
                case Verdict.Autoclicker: badge = "AUTOCLICKER"; color = Red; break;
                case Verdict.Suspicious: badge = "SUSPICIOUS"; color = Yellow; break;
                case Verdict.Human: badge = "LEGIT"; color = Green; break;
                default: badge = "SCANNING"; color = Dim; break;
            }

            float bw = TrackedWidth(g, badge, badgeFont, 1.2f) + 26;
            var r = new RectangleF(Pad, y, bw, 21);
            using (GraphicsPath p = Rounded(r, 10.5f))
            {
                float flash = s.Verdict >= Verdict.Suspicious ? 0.6f + 0.4f * (float)Math.Abs(Math.Sin(s.Time * 3)) : 1f;
                using (var fill = new SolidBrush(Color.FromArgb((int)(45 * flash), color))) g.FillPath(fill, p);
                using (var pen = new Pen(Color.FromArgb((int)(220 * flash), color), 1.2f)) g.DrawPath(pen, p);
            }
            DrawIcon(g, s.Verdict, color, r.X + 11, r.Y + 10.5f, s.Time);
            DrawTracked(g, badge, badgeFont, color, r.X + 19, y + 14.5f, 1.2f);

            // Reason, cut off with "..." if it's too long
            var reasonRect = new RectangleF(r.Right + 8, y + 1, Width - Pad - r.Right - 8, 20);
            using (var brush = new SolidBrush(s.Verdict == Verdict.NoData ? Dim : White))
            using (var format = new StringFormat(StringFormat.GenericTypographic)
            {
                Trimming = StringTrimming.EllipsisCharacter,
                FormatFlags = StringFormatFlags.NoWrap,
                LineAlignment = StringAlignment.Center,
            })
            {
                g.DrawString(s.Reason, bodyFont, brush, reasonRect, format);
            }
        }

        private void DrawIcon(Graphics g, Verdict verdict, Color color, float cx, float cy, float time)
        {
            using (var pen = new Pen(color, 1.6f) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round })
            {
                switch (verdict)
                {
                    case Verdict.Human: // tick
                        g.DrawLines(pen, new[] { new PointF(cx - 3.5f, cy), new PointF(cx - 1, cy + 2.6f), new PointF(cx + 3.5f, cy - 2.8f) });
                        break;
                    case Verdict.Autoclicker: // cross
                        g.DrawLine(pen, cx - 3, cy - 3, cx + 3, cy + 3);
                        g.DrawLine(pen, cx + 3, cy - 3, cx - 3, cy + 3);
                        break;
                    case Verdict.Suspicious: // exclamation
                        g.DrawLine(pen, cx, cy - 3.5f, cx, cy + 0.8f);
                        using (var b = new SolidBrush(color)) g.FillEllipse(b, cx - 1, cy + 2.2f, 2, 2);
                        break;
                    default: // spinning scan arc
                        g.DrawArc(pen, cx - 3.5f, cy - 3.5f, 7, 7, time * 360f % 360f, 260);
                        break;
                }
            }
        }

        private void DrawFooter(Graphics g, OverlayState s, float baseline)
        {
            const string text = "MADE BY PROMOUSER";
            float w = TrackedWidth(g, text, footerFont, 1.8f);
            DrawTracked(g, text, footerFont, Color.FromArgb(150, Dim), Width - Pad - w, baseline, 1.8f);
            var line = new RectangleF(Pad, baseline - 4, 70, 1.5f);
            using (var accent = new LinearGradientBrush(new RectangleF(line.X - 1, line.Y, line.Width + 2, 2), Cyan, Color.FromArgb(0, Magenta), 0f))
                g.FillRectangle(accent, line);
        }

        private void DrawDivider(Graphics g, float y)
        {
            var r = new RectangleF(Pad, y, Width - Pad * 2, 1);
            using (var brush = new LinearGradientBrush(new RectangleF(r.X - 1, r.Y, r.Width + 2, 1), Color.FromArgb(70, Cyan), Color.FromArgb(10, Magenta), 0f))
                g.FillRectangle(brush, r);
        }

        // ---- Text helpers (positions are baselines, so mixed sizes line up) ----

        private static float Ascent(Font f) => GameFonts.Ascent(f);

        private static void DrawText(Graphics g, string text, Font font, Color color, float x, float baseline)
        {
            using (var brush = new SolidBrush(color))
                g.DrawString(text, font, brush, x, baseline - Ascent(font), StringFormat.GenericTypographic);
        }

        private static float TextWidth(Graphics g, string text, Font font)
        {
            if (string.IsNullOrEmpty(text)) return 0;
            using (var format = new StringFormat(StringFormat.GenericTypographic))
            {
                format.FormatFlags |= StringFormatFlags.MeasureTrailingSpaces;
                return g.MeasureString(text, font, PointF.Empty, format).Width;
            }
        }

        // Letter-spaced text, for the techy labels.
        private static void DrawTracked(Graphics g, string text, Font font, Color color, float x, float baseline, float tracking)
        {
            foreach (char c in text)
            {
                string ch = c.ToString();
                DrawText(g, ch, font, color, x, baseline);
                x += TextWidth(g, ch, font) + tracking;
            }
        }

        private static float TrackedWidth(Graphics g, string text, Font font, float tracking)
        {
            float w = 0;
            foreach (char c in text) w += TextWidth(g, c.ToString(), font) + tracking;
            return w - tracking;
        }

        // ---- Colours and shapes ----

        public static Color CpsColor(int cps)
        {
            if (cps == 0) return Color.FromArgb(96, 102, 130);
            if (cps < 5) return Green;
            if (cps < 10) return Cyan;
            if (cps < 15) return Yellow;
            if (cps < 20) return Orange;
            return Red;
        }

        private static Color SegmentColor(int i)
        {
            float t = i / (float)(MeterSegments - 1);
            if (t < 0.45f) return Mix(Green, Cyan, t / 0.45f);
            if (t < 0.7f) return Mix(Cyan, Yellow, (t - 0.45f) / 0.25f);
            return Mix(Yellow, Red, (t - 0.7f) / 0.3f);
        }

        private static Color PingColor(long ms)
        {
            if (ms < 50) return Green;
            if (ms < 100) return Yellow;
            if (ms < 180) return Orange;
            return Red;
        }

        private static Color Mix(Color a, Color b, float t)
        {
            t = Clamp(t, 0, 1);
            return Color.FromArgb(
                (int)(a.R + (b.R - a.R) * t),
                (int)(a.G + (b.G - a.G) * t),
                (int)(a.B + (b.B - a.B) * t));
        }

        private static Color Lighten(Color c, float t) => Mix(c, Color.White, t);

        private static float Clamp(float v, float lo, float hi) => v < lo ? lo : v > hi ? hi : v;

        private static GraphicsPath Rounded(RectangleF r, float radius)
        {
            float d = radius * 2;
            var path = new GraphicsPath();
            path.AddArc(r.X, r.Y, d, d, 180, 90);
            path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        public void Dispose()
        {
            bitmap?.Dispose();
            foreach (var f in new[] { titleFont, tagFont, unitFont, valueFont, smallUnitFont, labelFont, bodyFont, badgeFont, footerFont, bigFont })
                f.Dispose();
        }
    }
}
