using System;
using System.Threading;
using System.Windows.Forms;

namespace CpsOverlay
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            if (args.Length == 2 && args[0] == "--preview")
            {
                Preview.Run(args[1]);
                return;
            }

            using (var mutex = new Mutex(true, "CpsOverlay-ProMouser", out bool first))
            {
                if (!first)
                {
                    MessageBox.Show("CPS Overlay is already running. Look for its icon next to the clock.",
                        "CPS Overlay", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new OverlayForm());
            }
        }
    }
}
