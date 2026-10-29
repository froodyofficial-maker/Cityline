// Cityline runtime config.
// You can fill this in instead of using a .env file — handy if you deploy the
// built "dist" folder and want to change keys without rebuilding.
// Leave a value empty ("") to fall back to the .env value or the in-app setup screen.
window.CITYLINE_CONFIG = {
  // Supabase → Project Settings → API (or "Connect")
  supabaseUrl: "",          // e.g. "https://abcdefghijklm.supabase.co"
  supabaseAnonKey: "",      // the "anon" / "publishable" key — never the service_role key

  // Optional extras
  giphyApiKey: "",          // https://developers.giphy.com — enables the GIF picker
  turnUrl: "",              // e.g. "turn:turn.example.com:3478" — helps voice/video through strict firewalls
  turnUsername: "",
  turnCredential: "",
};
