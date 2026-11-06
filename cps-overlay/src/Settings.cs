using System;
using System.Collections.Generic;
using System.IO;

namespace CpsOverlay
{
    /// <summary>Saved in %APPDATA%\CpsOverlay\settings.txt as key=value lines.</summary>
    public sealed class Settings
    {
        public const string DefaultPingTarget = "1.1.1.1";

        public int X = 20;
        public int Y = 20;
        public string PingTarget = DefaultPingTarget;
        public float Scale = 1.0f;

        private static string FilePath =>
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "CpsOverlay", "settings.txt");

        public static Settings Load()
        {
            var settings = new Settings();
            try
            {
                if (!File.Exists(FilePath)) return settings;
                var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (string line in File.ReadAllLines(FilePath))
                {
                    int eq = line.IndexOf('=');
                    if (eq > 0) values[line.Substring(0, eq).Trim()] = line.Substring(eq + 1).Trim();
                }
                if (values.TryGetValue("x", out string x) && int.TryParse(x, out int xi)) settings.X = xi;
                if (values.TryGetValue("y", out string y) && int.TryParse(y, out int yi)) settings.Y = yi;
                if (values.TryGetValue("ping", out string ping) && ping.Length > 0) settings.PingTarget = ping;
                if (values.TryGetValue("scale", out string scale) &&
                    float.TryParse(scale, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out float sc) &&
                    sc >= 0.5f && sc <= 2f) settings.Scale = sc;
            }
            catch (Exception)
            {
                // Unreadable settings: use the defaults.
            }
            return settings;
        }

        public void Save()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(FilePath));
                File.WriteAllLines(FilePath, new[] { $"x={X}", $"y={Y}", $"ping={PingTarget}",
                    "scale=" + Scale.ToString(System.Globalization.CultureInfo.InvariantCulture) });
            }
            catch (Exception)
            {
                // Can't save (read-only profile): settings just won't be remembered.
            }
        }
    }
}
