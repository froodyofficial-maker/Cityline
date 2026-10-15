//go:build windows

// OFFAL launcher: a small Windows exe that carries the whole game (the single-file build) inside it,
// unpacks it to %LOCALAPPDATA%\OFFAL and opens it in its own window using the Edge (or Chrome) that
// is already on the PC. No install, and none of Electron's ~80 MB.
package main

import (
	_ "embed"
	"bytes"
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
	u := (&url.URL{Scheme: "file", Path: "/" + filepath.ToSlash(page)}).String()

	if browser := findBrowser(); browser != "" {
		args := []string{
			"--app=" + u,
			"--user-data-dir=" + filepath.Join(dir, "profile"), // its own profile: own window, own save data
			"--start-maximized",
			"--no-first-run",
			"--no-default-browser-check",
			"--ignore-gpu-blocklist",
			"--enable-gpu-rasterization",
			"--disable-background-timer-throttling",
			"--disable-renderer-backgrounding",
			"--disable-features=Translate",
			"--autoplay-policy=no-user-gesture-required",
		}
		if err := exec.Command(browser, args...).Start(); err == nil {
			return
		}
	}
	// no Edge or Chrome: hand it to whatever browser is the default
	if err := exec.Command("rundll32", "url.dll,FileProtocolHandler", page).Start(); err != nil {
		fail("Could not open the game. You can open it yourself:\n" + page)
	}
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
