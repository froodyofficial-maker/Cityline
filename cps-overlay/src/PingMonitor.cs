using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;

namespace CpsOverlay
{
    /// <summary>
    /// Pings a target once a second in the background. Uses ICMP (like ping.exe, no admin needed);
    /// if the network blocks ICMP, falls back to timing a TCP connection to port 443.
    /// </summary>
    public sealed class PingMonitor : IDisposable
    {
        private const int TimeoutMs = 1000;
        public const int HistorySize = 20;

        private readonly object gate = new object();
        private readonly Queue<long?> history = new Queue<long?>(); // null = lost
        private readonly CancellationTokenSource stop = new CancellationTokenSource();
        private volatile string target;
        private bool useTcp;

        public PingMonitor(string target)
        {
            this.target = target;
            Task.Run(() => Loop(stop.Token));
        }

        public string Target
        {
            get => target;
            set
            {
                target = value;
                lock (gate)
                {
                    history.Clear();
                    useTcp = false;
                }
            }
        }

        public struct Snapshot
        {
            public long? LastMs;
            public long? AverageMs;
            public int LossPercent;
            public int Samples;
            public bool Tcp;
            public long?[] History; // oldest first, null = lost
        }

        public Snapshot Read()
        {
            lock (gate)
            {
                var ok = history.Where(h => h.HasValue).Select(h => h.Value).ToList();
                return new Snapshot
                {
                    LastMs = history.Count > 0 ? history.Last() : null,
                    AverageMs = ok.Count > 0 ? (long?)Math.Round(ok.Average()) : null,
                    LossPercent = history.Count > 0 ? (int)Math.Round(100.0 * (history.Count - ok.Count) / history.Count) : 0,
                    Samples = history.Count,
                    Tcp = useTcp,
                    History = history.ToArray(),
                };
            }
        }

        private async Task Loop(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                string host = target;
                var started = Stopwatch.StartNew();
                long? result = null;
                bool tcp;
                lock (gate) tcp = useTcp;

                if (!tcp) result = await IcmpPing(host);
                if (result == null)
                {
                    long? viaTcp = await TcpPing(host);
                    if (viaTcp != null)
                    {
                        result = viaTcp;
                        lock (gate) useTcp = true; // ICMP is blocked here; stick with TCP
                    }
                }

                if (host == target)
                {
                    lock (gate)
                    {
                        history.Enqueue(result);
                        while (history.Count > HistorySize) history.Dequeue();
                    }
                }

                int wait = 1000 - (int)started.ElapsedMilliseconds;
                if (wait > 0)
                {
                    try { await Task.Delay(wait, token); } catch (TaskCanceledException) { return; }
                }
            }
        }

        private static async Task<long?> IcmpPing(string host)
        {
            try
            {
                using (var ping = new Ping())
                {
                    PingReply reply = await ping.SendPingAsync(host, TimeoutMs);
                    return reply.Status == IPStatus.Success ? reply.RoundtripTime : (long?)null;
                }
            }
            catch (Exception)
            {
                return null;
            }
        }

        private static async Task<long?> TcpPing(string host)
        {
            try
            {
                using (var client = new TcpClient())
                {
                    var watch = Stopwatch.StartNew();
                    Task connect = client.ConnectAsync(host, 443);
                    if (await Task.WhenAny(connect, Task.Delay(TimeoutMs)) != connect || connect.IsFaulted) return null;
                    return watch.ElapsedMilliseconds;
                }
            }
            catch (Exception)
            {
                return null;
            }
        }

        public void Dispose() => stop.Cancel();
    }
}
