=====================================================================
  SPIN MASTER  -  Idle Arcade Wheel Game
  HTML5 + CSS3 + Vanilla JavaScript. No frameworks, no paid APIs.
=====================================================================

FILES
  index.html          Game page and all seven screens
  style.css           Dark neon / glassmorphism design, themes via CSS variables
  script.js           Whole game (config, engine, UI, audio, saving)
  manifest.json       PWA install information
  service-worker.js   Offline cache for the PWA
  icons/              App icons (192, 512, maskable 512)


HOW THE GAME WORKS
  The wheel starts by itself and never stops. Every time it completes one
  360-degree turn you are paid the value of the segment under the pointer.
  Then the game checks for a Lucky x2 bonus and a Jackpot, updates your
  statistics and keeps spinning. Spend coins on the upgrade menu right under
  the wheel (no separate screen) to spin faster and earn more. Missions, achievements, a 7-day login reward and five themes
  give you goals. Progress saves automatically in your browser.

  Start: 1 RPM, 1 coin per round. No numbers on the wheel.
  Round payout  = (1 + Coin Boost) x Round Multiplier
  Lucky Bonus   = chance to double that payout
  Jackpot       = chance to add (payout x jackpot multiplier) on top
  Offline       = away time (up to a cap) x rounds per second x efficiency
                  x average payout. Applies when you reopen the game or
                  return to a tab you left for 15+ seconds.

  Each round pays exactly once: the engine subtracts exactly 360 degrees
  per paid round, so a slow frame can never skip or double a payout. The
  wheel keeps running while you change screens or open popups.


1) RUN IT IN VS CODE WITH LIVE SERVER
   1. Install Visual Studio Code and the "Live Server" extension
      (publisher: Ritwick Dey) from the Extensions panel.
   2. File > Open Folder... and choose the spin-master folder.
   3. Right-click index.html > "Open with Live Server"
      (or click "Go Live" in the bottom-right status bar).
   4. The game opens at http://127.0.0.1:5500 (or localhost:5500).
   Tip: opening index.html by double-click also plays, but the service
   worker and install features only work through http://localhost or HTTPS.


2) TEST ON ANDROID
   Option A - same Wi-Fi (quick look)
     1. Connect the phone and the PC to the same Wi-Fi network.
     2. Find the PC's local IP address (Windows: run "ipconfig", look for
        IPv4 Address, e.g. 192.168.1.20).
     3. Start Live Server, then open http://192.168.1.20:5500 in Chrome on
        the phone. Allow the port in the Windows firewall if asked.
     Note: Chrome only offers "Install" on HTTPS or localhost, so use
     Option B or C to test installing.

   Option B - USB debugging (full PWA testing, recommended)
     1. On the phone: Settings > About phone > tap "Build number" 7 times,
        then Settings > Developer options > enable USB debugging.
     2. Connect by USB. On the PC open chrome://inspect/#devices in Chrome.
     3. Click "Port forwarding...", add 5500 -> localhost:5500, enable it.
     4. On the phone open Chrome and go to http://localhost:5500.
        This counts as a secure origin, so service worker and install work.
     5. You can inspect the phone's page console from chrome://inspect.

   Option C - free HTTPS hosting
     Upload the folder to GitHub Pages, Netlify Drop or Cloudflare Pages
     and open the https:// address on the phone.


3) INSTALL AS A PWA
   Android (Chrome): open the game over HTTPS or localhost, wait a few
     seconds, then tap the Chrome menu (three dots) > "Install app" /
     "Add to Home screen". Or use the "Install app" button in the game's
     Settings screen (it appears when installation is available).
   Desktop (Chrome/Edge): click the install icon at the right end of the
     address bar, or the "Install app" button in Settings.
   iPhone (Safari): Share > Add to Home Screen.
   Once installed, the game runs full-screen and works offline.


4) ADJUST PRICES, REWARDS AND BALANCE
   Open script.js. Everything is in the CONFIG object at the top.

   Upgrade prices ... CONFIG.UPGRADES. Cost of the next level is
       floor(baseCost x growth ^ currentLevel)
     Raise baseCost for a higher starting price, raise growth (e.g. 1.22 ->
     1.30) for a steeper curve, change max for the level cap.
   Upgrade strength ... the *_PER_LEVEL and BASE_* values near the top
     (speed in RPM, coins per level, lucky chance, jackpot odds, offline
     efficiency and hours).
   Wheel ... CONFIG.SEGMENTS. v is the base coins per round (1), w is the
     landing weight. Add or remove entries to change the segment count.
   Start speed ... BASE_SPEED_RPM (1) and SPEED_RPM_PER_LEVEL.
   Daily rewards ... CONFIG.DAILY_REWARDS (Day 1 to Day 7).
   Missions ... CONFIG.MISSIONS (target and reward).
   Achievements ... CONFIG.ACHIEVEMENTS.
   Theme unlock prices ... CONFIG.THEMES, field "unlock" (total coins earned).
   Offline limits ... OFFLINE_MIN_SECONDS, OFFLINE_EFF_*, OFFLINE_HOURS_*.

   After editing: refresh the page. If you installed the PWA or the old
   version keeps appearing, change CACHE_VERSION in service-worker.js
   (for example 'v1' to 'v2') and reload twice.
   Existing saves keep their upgrade levels, so for a clean test reset
   progress (see section 5). To test quickly, lower baseCost values or add
   coins from the console:  it is easiest to reset and lower the prices.


5) RESET PROGRESS
   In the game: Settings > "Reset all progress" > confirm. This deletes
     coins, upgrades, missions, achievements, daily streak and themes.
   Manually: open the browser developer console (F12) and run
       localStorage.removeItem('spinmaster_save_v2'); location.reload();
     Or clear the site's data in browser settings
     (Android Chrome: Settings > Site settings > Storage).
   Your save is stored only in this browser on this device.


SETTINGS REFERENCE
   Music, spin sound and reward sound toggles; separate volume sliders for
   music and effects; vibration toggle (Android devices that support it);
   theme picker (Neon, Galaxy, Ocean Blue, Golden, Cyberpunk - each unlocks
   when your total earned coins reach its price); reset with confirmation.
   Browsers block audio until the first tap, so music starts after you
   touch the screen once.


TROUBLESHOOTING
   - No sound: tap the screen once, check the toggles and volume sliders,
     and make sure the phone is not on silent.
   - Install option missing: use HTTPS or localhost, reload once so the
     service worker registers, and check Chrome has not already installed it.
   - Changes not showing: bump CACHE_VERSION in service-worker.js, or in
     DevTools > Application > Service Workers tick "Update on reload".
   - Progress missing: private/incognito windows and cleared site data do
     not keep saves.
   - Two tabs open at once: the last tab to save wins. Play in one tab.

Enjoy the spin!
