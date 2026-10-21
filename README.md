# Photobooth

A browser-based photobooth for an Ubuntu laptop: webcam preview with filters, single photos and 3-shot series, a gallery, and one-button printing to a **Canon SELPHY CP1500** (Hagaki / postcard paper, 100 × 148 mm). It can be operated entirely with an arcade controller (USB gamepad encoder), a keyboard, or a USB "custom keyboard". See [CONTROLLER_SETUP.md](CONTROLLER_SETUP.md).

## Install (Ubuntu)

```bash
# Node.js 18 or newer (Express 5)
sudo apt install nodejs npm
node -v

cd phtbth
npm ci
npm start            # → http://localhost:3000
```

Photos are stored in `photos/`.

| URL | What |
|-----|------|
| `/` | The photobooth |
| `/gallery` | All photos, click to print (for a second screen / helper) |
| `/slideshow` | Auto-advancing slideshow (for a TV) |
| `/controller-test` | Shows which button/axis numbers your controller sends |

Environment variables (all optional):

| Variable | Default | Meaning |
|----------|---------|---------|
| `PORT` | `3000` | HTTP port |
| `PRINTER_NAME` | system default printer | CUPS queue to print to |
| `PRINT_MEDIA` | queue default | Paper name, e.g. `jpn_hagaki_100x148mm` or `Postcard` |
| `PRINT_OPTIONS` | – | Extra space-separated `lp -o` options |

## Printer setup (SELPHY CP1500)

Printing goes **directly from the server to CUPS** (`lp`). No browser print dialog is involved, and Chrome needs no special flags.

1. Install CUPS and add the printer:
   ```bash
   sudo apt install cups printer-driver-gutenprint ipp-usb
   lpinfo -v                       # find the SELPHY (usb://… or ipp://…)
   lpinfo -m | grep -i selphy      # available driver; otherwise use "everywhere" (driverless)
   sudo lpadmin -p selphy -E -v '<uri from lpinfo -v>' -m '<driver or everywhere>'
   sudo lpadmin -d selphy          # make it the default printer
   ```
2. Set Hagaki paper as the queue's default:
   ```bash
   lpoptions -p selphy -l | grep -i -E 'media|pagesize'   # find the exact Hagaki/Postcard name
   lpoptions -p selphy -o media=jpn_hagaki_100x148mm       # or PageSize=Postcard, as listed above
   ```
   (Or start the server with `PRINT_MEDIA=<name>` instead.)
3. Check it from the photobooth: **Settings → Printing** shows the printer the server will use.

### How a print is made

1. The photo is cropped (centered) to exactly 148:100 at 300 dpi. The print preview shows this crop, so what you see is what gets printed.
2. It is rotated to portrait, the way Hagaki paper goes through the printer.
3. The server runs `lp -o print-scaling=fill …`. Because the image already has the paper's aspect ratio, "fill" scales it edge to edge with no white border.

3-shot series are composed at the paper's aspect ratio already, so they print without cropping.

### Fallback: browser printing

**Settings → Printing → Browser print** uses `window.print()` instead. The page then contains only the prepared image, fixed to the page box, so it fills the whole page and produces exactly one page. To skip the print dialog, Chrome must run with `--kiosk-printing`, and the SELPHY must be the default printer with Hagaki paper selected. The booth also falls back to browser printing automatically if CUPS is not installed.

## Kiosk mode

```bash
google-chrome --kiosk --autoplay-policy=no-user-gesture-required http://localhost:3000
```

- `--autoplay-policy=no-user-gesture-required`: without it, the countdown/shutter sounds only play after someone has clicked or typed; controller buttons don't count.
- Add `--kiosk-printing` only if you use browser printing.
- Allow the camera once when asked. Chrome remembers it for `localhost`.

## Troubleshooting

**Camera preview stutters after a while**
- The page no longer runs any constant background animations. If it still stutters, check `chrome://gpu`. If "Video Decode" or "Compositing" say *Software only*, Chrome is drawing the video on the CPU, and filters (Vintage/Noir…) make that worse.
- **Settings → Camera** shows the resolution and frame rate actually delivered. Many USB webcams only deliver 1080p at 5–10 fps. `v4l2-ctl --list-formats-ext` (package `v4l-utils`) lists what the camera can do.
- Flicker under room lighting: set the camera to 50 Hz (Germany): `v4l2-ctl -c power_line_frequency=1`.
- USB power saving can drop the camera. The booth now reconnects automatically. To prevent it: `echo -1 | sudo tee /sys/module/usbcore/parameters/autosuspend`.

**Print has white edges or a second page** → make sure you are on *Direct to printer*, and that the queue's default media is Hagaki (step 2 above).

**Nothing prints** → `lpstat -p -d` for the queue state, and the server log for the `lp` error message.
