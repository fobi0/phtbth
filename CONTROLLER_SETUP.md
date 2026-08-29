# Arcade Controller Setup for Photobooth

This guide explains how to use your arcade controller with the photobooth website.

## Hardware Detected

Your **DragonRise Inc. PC TWIN SHOCK Gamepad** has been detected and is connected to the system at:
- Joystick device: `/dev/input/js0`
- Event device: `/dev/input/event17`

## How It Works

The photobooth uses the **browser's Gamepad API** to detect and use your arcade controller. This is a standard web API that works in modern browsers like Chrome, Firefox, and Edge.

## Button Mapping

By default, the buttons are mapped as follows:

| Function | Button | Default Mapping |
|----------|--------|-----------------|
| Single Photo | Button 0 | Typically A/South button |
| Burst Mode (3 photos) | Button 1 | Typically B/East button |
| **Toggle Gallery Mode** | **Button 2** | **Typically X/West button** |
| Previous Filter | Button 3 | Typically Y/North button |
| Show Print Preview | Button 4 | Typically L1/Left Trigger |
| **Print (in preview)** | **Button 0** | **A/South - Confirms print** |
| **Download (in preview)** | **Button 1** | **B/East - Direct download** |
| **Cancel (in preview)** | **Button 8** | **Select/Back - Closes preview** |
| Open Settings | Button 9 | Typically Start button |
| Close Settings | Button 8 | Typically Select/Back button |

**Note:** Different arcade controllers may have different button numbering. Use the controller test page to verify your specific layout.

## Joystick Navigation

The joystick behavior **changes based on the current mode**:

### Photobooth Mode (default)
| Function | Axis/Control | Action |
|----------|--------------|--------|
| Next Filter | Left Stick Right (Axis 0 +) | Cycle to next filter |
| Previous Filter | Left Stick Left (Axis 0 -) | Cycle to previous filter |
| Next Filter | Left Stick Up (Axis 1 -) | Cycle to next filter |
| Previous Filter | Left Stick Down (Axis 1 +) | Cycle to previous filter |

### Gallery Mode (after pressing X button)
| Function | Axis/Control | Action |
|----------|--------------|--------|
| Next Photo | Left Stick Right (Axis 0 +) | Select next photo (right) |
| Previous Photo | Left Stick Left (Axis 0 -) | Select previous photo (left) |
| Photo Below | Left Stick Down (Axis 1 +) | Select photo below in grid |
| Photo Above | Left Stick Up (Axis 1 -) | Select photo above in grid |

In gallery mode, the **selected photo is highlighted with a green border**. Press **Button 4 (L1/Trigger)** to print the selected photo, or press **Button 2 (X)** to return to photobooth mode.

## Mode System

- **Photobooth Mode**: Camera preview is visible, joystick controls filters, sidebar shows last 6 photos
- **Gallery Mode**: Full-screen photo gallery **showing ALL photos**, joystick navigates through photos
- **Print Preview Mode**: Shows selected photo full-screen with Print/Cancel buttons, fully controller-controlled
- Toggle between modes by pressing **Button 2 (X/West)**

## How to Test Your Controller

1. Start the photobooth server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000/controller-test
   ```

3. Press buttons on your arcade controller. You should see:
   - The controller name and ID displayed
   - Buttons light up when pressed
   - Axis values change when using joystick/D-pad

4. Note which button numbers correspond to which physical buttons on your controller.

## Using the Controller with the Photobooth

1. Start the photobooth server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Connect your arcade controller (it should be auto-detected)

4. A small controller indicator will appear in the header when connected:
   - Gray circle: Controller not connected
   - Green pulsing circle: Controller connected and ready

5. Use the buttons as mapped above to:
   - Take single photos
   - Take burst photos (3 in a row)
   - Cycle through filters
   - Open/close settings

6. Press **Button 2 (X/West)** to toggle between Photobooth and Gallery modes

7. In **Photobooth Mode**:
   - Use **joystick** to cycle through camera filters
   
8. In **Gallery Mode**:
   - **Shows ALL photos** (not just the last 6)
   - Use **joystick left/right** to select adjacent photos
   - Use **joystick up/down** to select photos above/below in the grid
   - Selected photo is highlighted with a green border
   - Press **Button 4 (L1/Trigger)** to show print preview
   - In print preview: **Button 0 (A)** to print, **Button 1 (B)** to download, **Button 8 (Back)** to cancel
   - Press **Button 2 (X/West)** to return to Photobooth mode

## Customizing Button Mapping

If your controller has different button numbering, you can customize the mapping by editing the `script.js` file:

```javascript
// Find and modify this section:
let gamepadConfig = {
  singlePhoto: 0,    // Change to your button number for single photo
  burstPhoto: 1,     // Change to your button number for burst mode
  filterNext: 2,     // Change to your button number for next filter
  filterPrev: 3,     // Change to your button number for previous filter
  settings: 9,       // Change to your button number for settings
  back: 8           // Change to your button number for back
};
```

## Browser Compatibility

The Gamepad API works in:
- Chrome (recommended) - Full support
- Firefox - Full support
- Edge - Full support
- Safari - Limited support

**Important:** In Chrome, gamepads are only accessible after a user gesture (click, keypress, etc.) due to security restrictions. Simply press any button on your controller or click on the page, and the browser will grant access.

## Troubleshooting

### Controller not detected?
1. Make sure the controller is properly connected via USB
2. Try pressing a button on the controller to wake it up
3. Refresh the browser page
4. Try a different browser (Chrome recommended)
5. On Linux, check if the device exists: `ls /dev/input/js*`

### Buttons not working?
1. Test with the controller-test page first to verify button numbers
2. Update the button mapping in script.js if needed
3. Make sure you've interacted with the page first (click or keypress)

### Controller works but buttons are mapped wrong?
1. Use the controller-test page to identify your button numbers
2. Update the `gamepadConfig` in script.js with the correct button numbers

## Technical Details

The implementation uses:
- **Gamepad API**: Standard browser API for game controller input
- **Polling loop**: `requestAnimationFrame` for continuous gamepad state checking
- **Button state tracking**: Detects press/release transitions to avoid repeated triggers
- **Axis support**: D-pad or joystick can be used for filter navigation

## About Printing

### Browser Security Limitations

**Important**: Modern web browsers do NOT allow automatic printing without user confirmation. This is a security feature to prevent websites from printing without permission. The `window.print()` method will always show the browser's native print dialog.

### Available Options

1. **Print with Confirmation** (Button 0 / A): Opens browser print dialog - requires manual confirmation
2. **Download** (Button 1 / B): Directly downloads the photo file without any dialog - fully automatic
3. **Kiosk Mode** (Recommended for stands): Configure your browser to auto-print:
   - **Chrome**: Launch with `--kiosk --kiosk-printing` flags
   - **Firefox**: Use kiosk mode with print settings
   - This allows silent printing without confirmation dialogs

### Recommended Setup for Photobooth Stand

For a dedicated photobooth stand, configure Chrome to launch in kiosk mode:

```bash
# On Linux:
google-chrome --kiosk --kiosk-printing http://localhost:3000

# On Windows:
chrome.exe --kiosk --kiosk-printing http://localhost:3000
```

This will:
- Launch Chrome in full-screen kiosk mode
- Auto-print when `window.print()` is called (no confirmation dialog)
- Allow full controller operation

**Note**: The kiosk-printing flag makes Chrome auto-confirm print dialogs, enabling true one-button printing.

The controller is detected automatically when:
1. The page loads and a gamepad is already connected
2. A gamepad is connected while the page is open (via `gamepadconnected` event)
3. The controller-test page helps verify which buttons map to which functions

## Files Modified

1. `public/controller-test.html` - New page for testing controller buttons
2. `public/script.js` - Added Gamepad API support
3. `public/index.html` - Added controller indicator and updated hints
4. `public/style.css` - Added styles for controller indicator
5. `server.js` - Added route for controller-test page

## Default DragonRise PC TWIN SHOCK Layout

Based on common layouts for this controller:
- **Button 0**: A / South (Bottom button)
- **Button 1**: B / East (Right button)
- **Button 2**: X / West (Left button)
- **Button 3**: Y / North (Top button)
- **Button 4**: Left Trigger / L1
- **Button 5**: Right Trigger / R1
- **Button 6**: Left Trigger 2 / L2
- **Button 7**: Right Trigger 2 / R2
- **Button 8**: Select / Back
- **Button 9**: Start
- **Button 10**: Left Stick press
- **Button 11**: Right Stick press
- **Axes 0-1**: Left stick (X, Y)
- **Axes 2-3**: Right stick or D-pad (X, Y)
