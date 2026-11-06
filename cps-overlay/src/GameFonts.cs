using System;
using System.Drawing;
using System.Drawing.Text;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;

namespace CpsOverlay
{
    /// <summary>
    /// The overlay's fonts (Orbitron and Rajdhani, SIL Open Font License) are built into the .exe,
    /// so they look the same on every computer without being installed.
    /// </summary>
    public static class GameFonts
    {
        // Family names as GDI+ sees them (each weight is its own family or style).
        public const string Display = "Orbitron";          // bold
        public const string DisplayHeavy = "Orbitron Black";
        public const string Body = "Rajdhani SemiBold";
        public const string BodyBold = "Rajdhani";         // bold

        private static readonly PrivateFontCollection Collection = new PrivateFontCollection();
        private static readonly System.Collections.Generic.Dictionary<Font, FontFamily> Families =
            new System.Collections.Generic.Dictionary<Font, FontFamily>();

        static GameFonts()
        {
            Assembly assembly = typeof(GameFonts).Assembly;
            foreach (string name in assembly.GetManifestResourceNames().Where(n => n.EndsWith(".ttf", StringComparison.OrdinalIgnoreCase)))
            {
                using (Stream stream = assembly.GetManifestResourceStream(name))
                using (var buffer = new MemoryStream())
                {
                    stream.CopyTo(buffer);
                    byte[] bytes = buffer.ToArray();
                    // GDI+ reads the font from this memory for as long as the app runs, so it's never freed.
                    IntPtr memory = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, memory, bytes.Length);
                    Collection.AddMemoryFont(memory, bytes.Length);
                }
            }
        }

        /// <summary>
        /// Preview on Mono only: its GDI+ can't draw fonts loaded from memory, so use copies
        /// of the same fonts installed on the system.
        /// </summary>
        public static bool UseInstalledFonts;

        public static string[] FamilyNames => Collection.Families.Select(f => f.Name).ToArray();

        /// <summary>A font sized in pixels. Falls back to Segoe UI if the built-in font can't load.</summary>
        public static Font Create(string family, float pixels)
        {
            if (UseInstalledFonts)
            {
                var installed = new FontFamily(family);
                FontStyle installedStyle = installed.IsStyleAvailable(FontStyle.Regular) ? FontStyle.Regular : FontStyle.Bold;
                var f = new Font(installed, pixels, installedStyle, GraphicsUnit.Pixel);
                Families[f] = installed;
                return f;
            }

            FontFamily match = Collection.Families.FirstOrDefault(f => f.Name == family)
                               ?? Collection.Families.FirstOrDefault(f => family.StartsWith(f.Name, StringComparison.Ordinal));
            if (match == null) return new Font("Segoe UI", pixels, FontStyle.Bold, GraphicsUnit.Pixel);
            FontStyle style = match.IsStyleAvailable(FontStyle.Regular) && !family.Equals(Display) && !family.Equals(BodyBold)
                ? FontStyle.Regular
                : FontStyle.Bold;
            if (!match.IsStyleAvailable(style)) style = match.IsStyleAvailable(FontStyle.Bold) ? FontStyle.Bold : FontStyle.Regular;
            var font = new Font(match, pixels, style, GraphicsUnit.Pixel);
            Families[font] = match;
            return font;
        }

        /// <summary>The family a font was made from (Font.FontFamily can't always find built-in fonts again).</summary>
        public static FontFamily FamilyOf(Font font) => Families.TryGetValue(font, out FontFamily f) ? f : font.FontFamily;

        /// <summary>Distance from the top of a line of text to its baseline, in pixels.</summary>
        public static float Ascent(Font font)
        {
            try
            {
                FontFamily family = FamilyOf(font);
                return font.Size * family.GetCellAscent(font.Style) / family.GetEmHeight(font.Style);
            }
            catch (ArgumentException)
            {
                return font.Size * 0.8f;
            }
        }
    }
}
