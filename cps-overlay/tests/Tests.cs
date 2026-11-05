using System;
using CpsOverlay;

// Simulates click streams and checks the CPS count and the autoclicker verdict.
static class Tests
{
    static int failures;

    static void Expect(string name, bool ok, string detail = "")
    {
        Console.WriteLine($"{(ok ? "PASS" : "FAIL")}  {name} {detail}");
        if (!ok) failures++;
    }

    // Feeds clicks: interval(i) and hold(i) in ms. Returns the verdict right after.
    static Verdict Run(int clicks, Func<int, double> intervalMs, Func<int, double> holdMs, bool injected, out string reason, out int peak)
    {
        var stats = new ClickStats();
        var check = new AutoclickDetector();
        double t = 100;
        for (int i = 0; i < clicks; i++)
        {
            t += intervalMs(i) / 1000.0;
            stats.Press(t);
            check.Press(t, injected, stats.Cps(t));
            check.Release(t + holdMs(i) / 1000.0, injected);
        }
        peak = stats.Best;
        return check.Check(t + 0.2, out reason);
    }

    static double Gauss(Random r, double mean, double sd)
    {
        double u = 1 - r.NextDouble(), v = r.NextDouble();
        return mean + sd * Math.Sqrt(-2 * Math.Log(u)) * Math.Cos(2 * Math.PI * v);
    }

    static double Quantize(double ms, double step) => Math.Max(step, Math.Round(ms / step) * step);

    static void Main()
    {
        var rng = new Random(1);
        string reason; int peak;

        // CPS counting
        var s = new ClickStats();
        for (int i = 0; i < 10; i++) s.Press(i * 0.1);
        Expect("10 clicks in 1 s = 10 CPS", s.Cps(0.95) == 10);
        Expect("clicks older than 1 s drop off", s.Cps(1.55) == 4, $"(got {s.Cps(1.55)})");
        Expect("best is kept", s.Best == 10);

        Verdict v = Run(5, i => 100, i => 50, false, out reason, out peak);
        Expect("too few clicks: no verdict yet", v == Verdict.NoData, reason);

        v = Run(40, i => Gauss(rng, 90, 18), i => Gauss(rng, 55, 12), false, out reason, out peak);
        Expect("human clicking ~11 CPS", v == Verdict.Human, $"({reason}, best {peak})");

        v = Run(40, i => Gauss(rng, 90, 18), i => 50, true, out reason, out peak);
        Expect("software autoclicker (injected)", v == Verdict.Autoclicker, $"({reason})");

        v = Run(40, i => 100 + (rng.NextDouble() - 0.5), i => 30, false, out reason, out peak);
        Expect("perfectly even timing", v == Verdict.Suspicious, $"({reason})");

        v = Run(40, i => 109.4 + Gauss(rng, 0, 0.8), i => 30, false, out reason, out peak);
        Expect("Sleep(100) timer clicker (lands on 15.6 ms ticks)", v == Verdict.Suspicious, $"({reason})");

        v = Run(40, i => Gauss(rng, 90, 18), i => 0.5, false, out reason, out peak);
        Expect("instant release", v == Verdict.Suspicious, $"({reason})");

        v = Run(60, i => Gauss(rng, 28, 6), i => 10, false, out reason, out peak);
        Expect("35 CPS", v == Verdict.Suspicious, $"({reason}, best {peak})");

        // False positive rate for real people, including very steady clickers on a 125 Hz mouse.
        foreach (var (mean, sd, step, label) in new[] {
            (100.0, 15.0, 1.0, "typical, 1000 Hz mouse"),
            (83.0, 12.0, 8.0, "typical, 125 Hz mouse"),
            (100.0, 8.0, 8.0, "very steady, 125 Hz mouse"),
            (100.0, 6.0, 1.0, "extremely steady, 1000 Hz mouse"),
            (60.0, 10.0, 1.0, "fast jitter clicking"),
        })
        {
            int flagged = 0, runs = 2000;
            for (int k = 0; k < runs; k++)
            {
                v = Run(60, i => Quantize(Gauss(rng, mean, sd), step), i => Quantize(Math.Max(8, Gauss(rng, 45, 15)), step), false, out reason, out peak);
                if (v >= Verdict.Suspicious) flagged++;
            }
            double rate = 100.0 * flagged / runs;
            Expect($"false positives, {label}", rate < 1.0, $"({rate:0.00}% of 60-click sessions flagged)");
        }

        Console.WriteLine(failures == 0 ? "\nAll passed." : $"\n{failures} failed.");
        Environment.Exit(failures == 0 ? 0 : 1);
    }
}
