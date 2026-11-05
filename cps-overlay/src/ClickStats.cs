using System.Collections.Generic;

namespace CpsOverlay
{
    /// <summary>Clicks per second for one mouse button: presses in the last second.</summary>
    public sealed class ClickStats
    {
        public const double WindowSeconds = 1.0;

        private readonly Queue<double> presses = new Queue<double>(); // seconds, oldest first

        public int Best { get; private set; }

        public void Press(double now)
        {
            presses.Enqueue(now);
            Prune(now);
            if (presses.Count > Best) Best = presses.Count;
        }

        public int Cps(double now)
        {
            Prune(now);
            return presses.Count;
        }

        public void ResetBest() => Best = 0;

        private void Prune(double now)
        {
            while (presses.Count > 0 && now - presses.Peek() >= WindowSeconds) presses.Dequeue();
        }
    }
}
