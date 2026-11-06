using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

namespace CpsOverlay
{
    /// <summary>
    /// `CpsOverlay.exe --preview <folder>` draws sample frames to PNG files and exits.
    /// Used to check the design without a mouse hook or a window.
    /// </summary>
    internal static class Preview
    {
        public static void Run(string folder)
        {
            Directory.CreateDirectory(folder);
            GameFonts.UseInstalledFonts = Type.GetType("Mono.Runtime") != null;
            using (var renderer = new OverlayRenderer())
            {
                Save(renderer, folder, "clicking", Sample(14, 3, 17, 6, 0.9f, Verdict.Human, "looks human", 28, ramp: true));
                Save(renderer, folder, "fast", Sample(21, 0, 23, 6, 1f, Verdict.Suspicious, "robotic timing (48 ms ±0.6)", 46, ramp: true));
                Save(renderer, folder, "autoclicker", Sample(19, 0, 20, 2, 0.6f, Verdict.Autoclicker, "software clicks detected", 132, ramp: true));
                Save(renderer, folder, "idle", Sample(0, 0, 12, 4, 0f, Verdict.NoData, "click fast to run the check", 19, ramp: false));
            }
        }

        private static OverlayState Sample(int cps, int right, int best, int rightBest, float pulse, Verdict verdict, string reason, long ping, bool ramp)
        {
            var rng = new Random(cps * 7 + 3);
            var history = new float[120];
            for (int i = 0; i < history.Length; i++)
            {
                double t = i / (double)(history.Length - 1);
                double v = ramp ? cps * Math.Min(1, Math.Max(0, (t - 0.25) * 2.2)) + Math.Sin(i * 0.4) * 0.8 : best * Math.Max(0, 1 - (t * 1.6)) ;
                history[i] = (float)Math.Max(0, v);
            }
            var pings = new long?[20];
            for (int i = 0; i < pings.Length; i++) pings[i] = i == 13 && ping > 100 ? null : (long?)(ping + rng.Next(-6, 9));
            return new OverlayState
            {
                Cps = cps, RightCps = right, Best = best, RightBest = rightBest, Meter = cps, Pulse = pulse,
                History = history, PingMs = ping, PingAverage = ping + 2, PingLoss = ping > 100 ? 5 : 0, PingMeasuring = false,
                PingHistory = pings, Verdict = verdict, Reason = reason, Time = 0.3f,
            };
        }

        private static void Save(OverlayRenderer renderer, string folder, string name, OverlayState state)
        {
            Bitmap frame = renderer.Render(state, 2f);
            // Put it on a game-ish backdrop so the transparency shows.
            using (var shot = new Bitmap(frame.Width + 80, frame.Height + 80))
            using (Graphics g = Graphics.FromImage(shot))
            {
                using (var bg = new System.Drawing.Drawing2D.LinearGradientBrush(new Rectangle(0, 0, shot.Width, shot.Height),
                    Color.FromArgb(92, 140, 70), Color.FromArgb(120, 170, 220), 70f))
                    g.FillRectangle(bg, 0, 0, shot.Width, shot.Height);
                g.DrawImage(frame, 40, 40);
                shot.Save(Path.Combine(folder, name + ".png"), ImageFormat.Png);
            }
        }
    }
}
