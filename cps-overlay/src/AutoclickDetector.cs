using System;
using System.Collections.Generic;
using System.Linq;

namespace CpsOverlay
{
    public enum Verdict
    {
        NoData = 0,
        Human = 1,
        Suspicious = 2,
        Autoclicker = 3,
    }

    /// <summary>
    /// Watches one mouse button for signs of an autoclicker:
    ///  1. Injected input: clicks made by a program (SendInput / mouse_event) carry a flag
    ///     that real mouse clicks never have. This catches almost every software autoclicker.
    ///  2. Timing that is too even: even very steady people wobble by several milliseconds
    ///     between clicks, while timers repeat to within a millisecond or two.
    ///  3. Buttons released instantly: a finger holds a button for tens of milliseconds.
    ///  4. CPS no person can reach.
    /// 2-4 can also catch macro mice and clickers that don't inject input.
    /// </summary>
    public sealed class AutoclickDetector
    {
        public const int SampleSize = 16;          // clicks needed before timing is judged
        public const double BurstGapSeconds = 0.25; // a longer pause starts a new burst (under 4 CPS)
        public const double MinStdDevMs = 2.5;     // intervals steadier than this are machine-like
        public const double MinHoldMs = 5.0;       // median press shorter than this is machine-like
        public const int MaxHumanCps = 30;
        public const double FlagSeconds = 10.0;    // how long a warning stays on screen
        public const double HumanSeconds = 30.0;   // how long a passed check stays on screen

        private readonly List<double> burst = new List<double>(); // press times in the current burst
        private readonly List<double> holdsMs = new List<double>();
        private double lastPress = double.NegativeInfinity;
        private double? pressedAt;
        private double lastPassed = double.NegativeInfinity;

        private Verdict flag = Verdict.NoData;
        private string flagReason = "";
        private double flaggedUntil = double.NegativeInfinity;

        public void Press(double now, bool injected, int cps)
        {
            if (injected) Flag(Verdict.Autoclicker, "software clicks detected", now);

            if (now - lastPress > BurstGapSeconds) burst.Clear();
            lastPress = now;
            pressedAt = now;

            burst.Add(now);
            if (burst.Count > SampleSize + 1) burst.RemoveAt(0);
            if (burst.Count == SampleSize + 1) CheckTiming(now);

            if (cps > MaxHumanCps) Flag(Verdict.Suspicious, $"{cps} CPS - faster than humanly possible", now);
        }

        public void Release(double now, bool injected)
        {
            if (injected) Flag(Verdict.Autoclicker, "software clicks detected", now);
            if (pressedAt is double start)
            {
                holdsMs.Add((now - start) * 1000.0);
                if (holdsMs.Count > SampleSize) holdsMs.RemoveAt(0);
                if (holdsMs.Count == SampleSize)
                {
                    double median = Median(holdsMs);
                    if (median < MinHoldMs) Flag(Verdict.Suspicious, $"instant release ({median:0.0} ms hold)", now);
                }
            }
            pressedAt = null;
        }

        public Verdict Check(double now, out string reason)
        {
            if (now < flaggedUntil)
            {
                reason = flagReason;
                return flag;
            }
            if (now - lastPassed < HumanSeconds)
            {
                reason = "looks human";
                return Verdict.Human;
            }
            reason = "click fast to run the check";
            return Verdict.NoData;
        }

        public void Reset()
        {
            burst.Clear();
            holdsMs.Clear();
            lastPress = double.NegativeInfinity;
            pressedAt = null;
            lastPassed = double.NegativeInfinity;
            flag = Verdict.NoData;
            flagReason = "";
            flaggedUntil = double.NegativeInfinity;
        }

        private void CheckTiming(double now)
        {
            var intervals = new double[burst.Count - 1];
            for (int i = 1; i < burst.Count; i++) intervals[i - 1] = (burst[i] - burst[i - 1]) * 1000.0;
            double mean = intervals.Average();
            double sd = Math.Sqrt(intervals.Sum(x => (x - mean) * (x - mean)) / intervals.Length);

            if (sd < MinStdDevMs)
                Flag(Verdict.Suspicious, $"robotic timing ({mean:0} ms ±{sd:0.0})", now);
            else
                lastPassed = now;
        }

        private void Flag(Verdict verdict, string reason, double now)
        {
            bool active = now < flaggedUntil;
            if (!active || verdict >= flag)
            {
                flag = verdict;
                flagReason = reason;
            }
            flaggedUntil = now + FlagSeconds;
        }

        private static double Median(List<double> values)
        {
            var sorted = values.OrderBy(v => v).ToArray();
            int mid = sorted.Length / 2;
            return sorted.Length % 2 == 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2.0;
        }
    }
}
