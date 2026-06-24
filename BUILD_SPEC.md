# BUILD SPEC: Reminder Desktop App + Desktop Pet (Windows, Electron)

You are helping me build a Windows desktop reminder app with Electron. I am new to Electron but I can code (full-stack background). Build this **phase by phase**. After each phase, stop, tell me how to run and test it, and wait for me to confirm before moving on. Do not try to one-shot the whole app.

Explain Electron-specific concepts the first time they come up (main vs renderer, IPC, preload), since I am new to the framework.

---

## What we are building

A small reminder app that runs in the background, fires reminders at custom times by playing a chosen song, tracks "achievements" (completed tasks) with a level system, and has a draggable desktop character that floats on top of all windows and plays voicelines when clicked.

---

## Tech stack and hard constraints

- **Electron** (latest stable). I already ran `npm install electron`.
- **CommonJS** main/preload (`require`), unless you have a strong reason to go full ESM. If we go ESM, flag it first.
- **Renderer = plain HTML + CSS + vanilla JS.** No React/Vue. Reason: I am designing the UI in Figma and importing the HTML/CSS via Figma Dev Mode, so the renderer must stay framework-free so that export drops in cleanly.
- **Security defaults are non-negotiable:** `contextIsolation: true`, `nodeIntegration: false`. All main-process power is exposed to the renderer through a typed API in a `preload.js` via `contextBridge`. The renderer never touches Node directly.
- **No `electron-store`.** It is now pure ESM and needs Electron 30+, which breaks CommonJS. Instead write a tiny JSON store helper using `fs` + `app.getPath('userData')`. Write atomically (write to temp file, then rename). Store mp3/png/gif by file path, never dump big binaries into the JSON.
- Use the device local time directly (`new Date()` in the main process). Reminders are stored as local `"HH:MM"`.

---

## Architecture

Two OS windows, not three:

1. **Main window** (~900x620, centered, not maximizable). One window with three in-app views that the user switches between with a sidebar or tab bar: **Home**, **Reminders**, **Achievements**. This is simpler than three separate OS windows and lets them share state. Use simple show/hide of view containers, or hash routing. No router library.
2. **Pet window**: transparent, frameless, always-on-top, draggable, separate from the main window.

The **main process** owns everything that must keep working in the background: the JSON store, the reminder scheduler, the tray, window lifecycle, and all IPC handlers. The renderer only renders UI and calls the preload API.

Add a **single-instance lock** so launching the app twice just focuses the existing window.

---

## Project structure (suggested)

```
/src
  main.js            # main process: windows, tray, scheduler, IPC
  preload.js         # contextBridge API exposed to renderer
  /store
    jsonStore.js     # tiny fs-based persistence
  /scheduler
    scheduler.js     # reminder firing logic (main process)
  /renderer
    index.html       # main window, 3 views inside
    styles.css
    app.js           # view switching + calls window.api.*
    pet.html         # pet window markup
    pet.css
    pet.js           # drag + click-to-voiceline
/assets
  /pet               # png/gif sprites
  /audio             # voicelines + default reminder sounds
package.json
```

---

## Data models

```js
// Reminder
{
  id: string,            // uuid
  title: string,
  time: "HH:MM",         // 24h local
  repeat: "once" | "daily" | "weekdays" | "weekends" | "weekly" | "custom",
  days: number[],        // 0=Sun..6=Sat, used by "weekly"/"custom"
  date: "YYYY-MM-DD" | null, // used by "once"
  soundPath: string,     // path to mp3 to play
  enabled: boolean,
  lastFiredAt: number | null, // epoch ms, prevents double-firing
  createdAt: number
}

// Achievement (a completed task)
{
  id: string,
  name: string,
  completedAt: number    // epoch ms
}

// Settings
{
  petEnabled: boolean,
  petAlwaysOnTop: boolean,
  petImage: string,          // path to png/gif
  petVoicelines: string[],   // paths to mp3
  autoLaunch: boolean,
  volume: number             // 0..1
}
```

`totalAchievements` is just the count of achievements. Level is derived, not stored.

---

## Level system

Thresholds (number of achievements needed to reach each level):

```
[1, 3, 5, 10, 25, 40, 50, 60, 70, 80, 90, 100]
```

Level = how many thresholds the total has reached or passed. Example: 0 done = Level 0, 1 done = Level 1, 4 done = Level 2 (passed 1 and 3), 26 done = Level 5. Also expose "achievements until next level" for a progress bar on Home.

---

## Critical gotchas (follow these or the app breaks)

1. **Scheduling must live in the main process, never the renderer.** Renderer timers get throttled or paused when the window is hidden or minimized, which kills background reminders. Run a `setInterval` in main that checks every 20-30 seconds: compare current local `HH:MM` and weekday against each enabled reminder, fire if it matches and `lastFiredAt` is not already within this minute, then update `lastFiredAt`.
2. **The main process cannot play audio** (no DOM, no `Audio`). Route playback to a renderer. Keep one always-available renderer for audio (reuse the pet window, or a tiny hidden window when the pet is disabled). Main sends an IPC message like `play-audio { path, volume }` and that renderer plays it.
3. **Local file audio + `contextIsolation` is a known trap.** `new Audio('file://...')` is often blocked. Safer: main reads the mp3 with `fs` and sends it to the renderer as a base64 `data:` URL, OR register a custom protocol (e.g. `appfile://`) in main and map it to disk. Pick one, keep it consistent.
4. **Run in background, do not quit on close.** Intercept the main window `close` event and hide the window instead of quitting. The app only really quits from the tray menu "Quit". Show a tray icon with menu: Open, Toggle Pet, Quit.
5. **Autostart on Windows:** use the built-in `app.setLoginItemSettings({ openAtLogin: true })`, toggled by the `autoLaunch` setting. No extra package needed.
6. **Pet window config:** `transparent: true`, `frame: false`, `skipTaskbar: true`, `resizable: false`, `hasShadow: false`, and `setAlwaysOnTop(true, 'screen-saver')` so it floats above normal and fullscreen windows. The "do not stay on top" toggle calls `setAlwaysOnTop(false)`.
7. **Pet drag vs click:** implement custom dragging (track mousedown + mousemove, move the window via IPC or `win.setPosition`). Treat it as a click (play a random voiceline) only if the pointer barely moved between down and up. Do not use `-webkit-app-region: drag`, because it eats the click interaction.
8. **Avoid double-firing** across the minute boundary by storing `lastFiredAt` and skipping if the reminder already fired in the current minute.

---

## Build plan

### Phase 0 - Setup and security baseline
- Confirm/clean `package.json` (main entry, `"start": "electron ."`).
- Create `main.js`, `preload.js`, and a blank `index.html`.
- Main window with the security flags above, loading `index.html`.
- Verify the renderer can call one test method through `contextBridge` (e.g. `window.api.ping()` returns a string from main).
- **Acceptance:** `npm start` opens a window, devtools show no security warnings, the ping round-trips.

### Phase 1 - App shell, tray, background
- Build the three-view layout in `index.html` (Home, Reminders, Achievements) with a sidebar/tab switcher and empty-state placeholders. Plain HTML/CSS so I can replace it with Figma output later.
- Add the system tray (icon + menu: Open, Quit).
- Make window `close` hide instead of quit; only Quit exits.
- Add single-instance lock.
- **Acceptance:** closing the window keeps the app alive in the tray, reopening works, second launch focuses the first.

### Phase 2 - Data layer
- Implement `jsonStore.js` (atomic read/write JSON in `app.getPath('userData')`).
- Define reminders, achievements, and settings collections with defaults.
- Expose CRUD over IPC and through `preload` as `window.api.reminders.*`, `window.api.achievements.*`, `window.api.settings.*`.
- **Acceptance:** I can add/read/delete a dummy record from the renderer and it survives an app restart.

### Phase 3 - Reminders UI and CRUD
- Reminders view: list today's reminders, plus a weekly view toggle (group by weekday).
- Add/edit/delete reminder form: title, time picker, repeat dropdown (once/daily/weekdays/weekends/weekly/custom days), sound file picker (`dialog.showOpenDialog` filtered to audio), enable toggle.
- **Acceptance:** reminders persist and render correctly in both day and week views.

### Phase 4 - Scheduler and alarm
- Main-process scheduler per gotchas 1, 2, 3, 8.
- On fire: play the reminder's `soundPath` at the settings volume, show a native `Notification`, and (if the pet exists) trigger a small pet reaction.
- **Acceptance:** a reminder set one minute ahead fires once, plays the chosen song, and shows a notification, even with the main window hidden.

### Phase 5 - Achievements and levels
- Achievements view: input to log a completed task, full list (newest first), running total.
- Level logic from the thresholds above, with current level and progress to next.
- Home view: today's upcoming reminders, top 3 most recent achievements, total count, current level + progress bar.
- **Acceptance:** logging tasks updates the count, the level, and the Home summary live.

### Phase 6 - Desktop pet
- `pet.html` window per gotcha 6, showing `settings.petImage` (png or gif).
- Custom drag and click-to-voiceline per gotcha 7, picking a random file from `settings.petVoicelines`.
- Settings to toggle pet on/off and toggle always-on-top.
- Make the pet window the audio renderer from gotcha 2 when it is enabled.
- **Acceptance:** the pet floats over other windows, drags smoothly, plays a voiceline on click, and the always-on-top toggle works.

### Phase 7 - Polish, settings, packaging
- Settings view: autostart toggle, volume slider, pet image picker, voiceline manager, pet on/off.
- Hook up autostart (gotcha 5).
- Help me swap in my Figma-exported HTML/CSS for each view without breaking the JS wiring (keep stable element IDs/classes).
- Package to a Windows `.exe` installer with Electron Forge or electron-builder, and explain the build command.
- **Acceptance:** a built installer runs on a clean Windows session and starts on login if enabled.

---

## Definition of done
Background reminders fire reliably with custom audio, data persists across restarts, achievements drive a working level system shown on Home, and the desktop pet floats, drags, talks, and can be toggled off top. UI is plain HTML/CSS ready for Figma replacement.
