# Arcade Controller & Keyboard Setup

The photobooth can be operated with an arcade controller (here a **DragonRise "PC TWIN SHOCK"** USB encoder), a normal keyboard, or a USB "custom keyboard" (button box that sends key presses). All of them work at the same time, and every action can have several keys/buttons.

## Default bindings

| Action | Keyboard | Controller | Camera screen | Gallery | Print preview |
|--------|----------|------------|---------------|---------|---------------|
| Photo / select | `Space`, `1` | Btn 0 | Single photo | Open print preview | **Print** |
| Series | `B`, `2` | Btn 1 | 3-shot series | – | Download |
| Gallery | `X`, `G`, `3` | Btn 2 | Open gallery | Back to camera | Cancel |
| Print | `P`, `Enter`, `4` | Btn 4 | Open gallery | Open print preview | **Print** |
| Next filter | `F` | Btn 3 | Next filter | – | – |
| Back | `Esc`, `Backspace` | Btn 8 | – | Back to camera | Cancel |
| Settings | `S` | Btn 9 | Open settings | Open settings | – |
| Directions | Arrow keys | Joystick, D-pad (Btn 12–15) | Change filter | Move selection | – |

The bar at the bottom of the screen always shows the current bindings. In the gallery, holding the joystick or an arrow key auto-repeats.

## Changing bindings

1. Open **Settings** (gear icon, `S` or Btn 9).
2. Under **Controls**, click **+** next to an action, then press the key or controller button you want.
   - A key/button can only do one thing. If it was bound elsewhere, it moves.
   - Click a binding chip to remove it. **Reset to defaults** restores the table above.
3. Bindings are saved in the kiosk browser (localStorage) and survive restarts.

Keys are recorded by physical position (`KeyboardEvent.code`), so a custom keyboard works regardless of the keyboard layout set in Ubuntu.

## Finding your button numbers

Open `http://localhost:3000/controller-test` and press the buttons. Each one lights up with its number. Different encoders number buttons differently. If yours doesn't match the defaults, just rebind in Settings.

The joystick must appear as axes 0 (left/right) and 1 (up/down). If your stick shows up as buttons instead, bind those buttons to Up/Down/Left/Right.

## Notes

- Chrome only exposes a controller after one of its buttons has been pressed. The indicator top right turns green once the controller is seen.
- If several gamepads are connected, the DragonRise one is preferred, otherwise the first one.
- A press is only counted once. Holding a button never fires it again, even when a dialog opens or closes underneath it.
- On Linux, check that the device exists with `ls /dev/input/js*`.
