//go:build windows

// OFFAL launcher: a small Windows exe that carries the whole game (the single-file build) inside it,
// unpacks it to %LOCALAPPDATA%\OFFAL and opens it in its own window using the Edge (or Chrome) that
// is already on the PC. No install, and none of Electron's ~80 MB.
package main

import (
	"bytes"
	_ "embed"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

//go:embed offal.html
var game []byte

func main() {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base = os.TempDir()
	}
	dir := filepath.Join(base, "OFFAL")
	page := filepath.Join(dir, "offal.html")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		fail("Could not create " + dir + ":\n" + err.Error())
	}
	// only rewrite the page when this exe carries a different build
	if old, err := os.ReadFile(page); err != nil || !bytes.Equal(old, game) {
		if err := os.WriteFile(page, game, 0o644); err != nil {
			fail("Could not unpack the game to " + page + ":\n" + err.Error())
		}
	}
	// Edge keeps compiled graphics programs in the profile. If the PC goes down while it is writing them they are
	// left corrupt, and every launch after that crashes the page (STATUS_ACCESS_VIOLATION, ILLEGAL_INSTRUCTION...).
	// They are only a cache: throw them away every time. The saves are in Local Storage, which is left alone.
	profile := filepath.Join(dir, "profile")
	for _, c := range []string{"GrShaderCache", "ShaderCache", "GraphiteDawnCache", "Default/GPUCache", "Default/DawnGraphiteCache", "Default/DawnWebGPUCache", "Default/Code Cache"} {
		os.RemoveAll(filepath.Join(profile, filepath.FromSlash(c)))
	}

	// safe graphics: the page is drawn on the processor and the graphics driver is never touched. Slower, but it
	// can't take the machine down with it. Used when the exe is named OFFAL-safe (or run with --safe), and from the
	// moment a session ends without the game window ever closing (the PC went down mid-game). --gpu turns it off again.
	running, safeFile := filepath.Join(dir, "running"), filepath.Join(dir, "safe-graphics")
	name := strings.ToLower(filepath.Base(os.Args[0]))
	if hasArg("--gpu") {
		os.Remove(safeFile)
	} else if _, err := os.Stat(running); err == nil {
		os.WriteFile(safeFile, []byte("The last session ended without the game closing, so OFFAL now starts with safe graphics.\nRun OFFAL.exe --gpu to use the graphics card again.\n"), 0o644)
	}
	_, safeErr := os.Stat(safeFile)
	safe := safeErr == nil || hasArg("--safe") || strings.Contains(name, "safe")
	q := ""
	if safe {
		q = "safe=1"
	}
	u := (&url.URL{Scheme: "file", Path: "/" + filepath.ToSlash(page), RawQuery: q}).String()

	if browser := findBrowser(); browser != "" {
		args := []string{
			"--app=" + u,
			"--user-data-dir=" + profile, // its own profile: own window, own save data
			"--start-maximized",
			// no graphics flags at all: Edge decides what the GPU and its driver can safely do
			"--no-first-run",
			"--no-default-browser-check",
			"--disable-background-timer-throttling",
			"--disable-renderer-backgrounding",
			// RendererCodeIntegrity: some antivirus and security software makes Edge/Chrome pages crash with
			// STATUS_ACCESS_VIOLATION when it is on
			"--disable-features=Translate,RendererCodeIntegrity",
			"--autoplay-policy=no-user-gesture-required",
		}
		if safe {
			args = append(args, "--disable-gpu", "--disable-gpu-compositing", "--enable-unsafe-swiftshader")
		}
		cmd := exec.Command(browser, args...)
		if err := cmd.Start(); err == nil {
			// wait for the game window to close; if the machine goes down first, the marker is still there next time
			os.WriteFile(running, []byte("1"), 0o644)
			cmd.Wait()
			os.Remove(running)
			return
		}
	}
	// no Edge or Chrome: hand it to whatever browser is the default
	if err := exec.Command("rundll32", "url.dll,FileProtocolHandler", page).Start(); err != nil {
		fail("Could not open the game. You can open it yourself:\n" + page)
	}
}

func hasArg(a string) bool {
	for _, x := range os.Args[1:] {
		if strings.EqualFold(x, a) {
			return true
		}
	}
	return false
}

func findBrowser() string {
	roots := []string{os.Getenv("ProgramFiles(x86)"), os.Getenv("ProgramFiles"), os.Getenv("LOCALAPPDATA")}
	rel := []string{
		`Microsoft\Edge\Application\msedge.exe`,
		`Google\Chrome\Application\chrome.exe`,
		`BraveSoftware\Brave-Browser\Application\brave.exe`,
	}
	for _, r := range rel {
		for _, root := range roots {
			if root == "" {
				continue
			}
			p := filepath.Join(root, r)
			if _, err := os.Stat(p); err == nil {
				return p
			}
		}
	}
	return ""
}

func fail(msg string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	box := user32.NewProc("MessageBoxW")
	t, _ := syscall.UTF16PtrFromString(strings.TrimSpace(msg))
	c, _ := syscall.UTF16PtrFromString("OFFAL")
	box.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), 0x10)
	os.Exit(1)
}
