<div align="center">

  <a href="https://github.com/NousResearch/hermes-agent">
    <img src="https://github.com/user-attachments/assets/ac2f5702-c842-4b2e-9340-737481fa0ece" width="96" height="96" alt="Nous Research Hermes mark" />
  </a>

  # Borealis

  **A live dithered landscape behind your Hermes desktop.**

  One theme for Hermes Desktop, with a scene that moves behind the whole window.
  By night, tall aurora curtains rise behind three mountain ridges and a lake mirrors them, under stars, a crescent moon and the odd shooting star.
  By day, the same view turns into a two-ink print: pink and teal ridges on cream paper, with a low sun.
  Everything is drawn in dots, one per 3 pixels, in the theme's own colours.

  <sub>FOR <a href="https://github.com/NousResearch/hermes-agent">HERMES DESKTOP</a> &nbsp;·&nbsp; COMMUNITY THEME &nbsp;·&nbsp; VERSION 0.1.1</sub>

  <br /><br />

  [Try it in a minute](#try-it-in-a-minute) &nbsp;·&nbsp; [Night and day](#night-and-day) &nbsp;·&nbsp; [Switch any time](#switch-any-time)

</div>

![The Hermes Desktop window split diagonally: on the left, a dark window with a mint and violet dithered aurora over black mountain ridges; on the right, a cream window with pink and teal ridges and a pink sun](media/banner.png?v=0.1.1)

## Try it in a minute

You need Hermes Desktop 0.22.2 or later. You don't need a terminal.

**1. Install.** In Hermes Desktop, open **Capabilities → Plugins** and click **Install from Git**. Paste this address, click **Review repository**, then install:

```text
https://github.com/Adolanium/hermes-borealis
```

<details>
<summary>Prefer the terminal?</summary>

<br />

```sh
hermes plugins install Adolanium/hermes-borealis
```

If it asks whether to enable the plugin, either answer works. That switch is for the agent side, and Borealis has nothing there.

</details>

**2. Turn it on.** **Borealis** now appears in **Capabilities → Plugins**. Flip its **Desktop** switch on. Desktop plugins installed from a package start turned off, and this is the step people miss.

**3. Pick the theme.** Type this in the message box and press Enter:

```text
/skin borealis
```

The whole app changes on the spot, with no restart.

## Night and day

Borealis follows your Hermes light/dark setting. Click a picture to see the full window.

| [![Night: a mint, blue and violet aurora over dark ridges and a lake, with stars and a crescent moon](media/shots/night.png?v=0.1.1)](media/shots/night.png?v=0.1.1) | [![Day: pink and teal mountain ridges on cream paper, with a pink sun and its reflection](media/shots/day.png?v=0.1.1)](media/shots/day.png?v=0.1.1) |
|:---:|:---:|
| **Night** (dark mode) | **Day** (light mode) |

- **Night.** Near-black with an indigo cast and a mint accent. The aurora is mint at its lower edge and fades through blue to violet. The nearest ridge is a black silhouette, and the far ones sit in violet mist. Stars twinkle, and a shooting star crosses every 13 seconds.
- **Day.** Cream paper with teal and bright pink, like a two-colour riso print. The curtains thin out to streaks of dawn light, and there are no stars.
- **The lake.** A strip along the bottom mirrors the whole scene, with ripples that grow towards the near shore.
- **A little depth.** The ridges slide a few pixels as you move the mouse, the near ones more than the far ones.

## Switch any time

Borealis is a normal Hermes theme, so all the usual ways to switch work:

| Where | What to do |
| --- | --- |
| **Message box** | `/skin borealis`. `/skin list` shows every theme; `/skin` alone moves to the next one. |
| **Command palette** | Press <kbd>Ctrl</kbd> <kbd>K</kbd> (<kbd>⌘</kbd> <kbd>K</kbd> on macOS), choose **Change theme**, and pick **Borealis**. |
| **Settings** | **Settings → Appearance → Theme**. |

To go back to the stock look, type `/skin nous`.

## Small decisions, already made

- **The chat stays readable.** The scene is at full strength only on an empty chat. Once there is text to read, in a conversation or on any other page, it fades back to about a quarter strength.
- **The colours are yours to change.** The scene reads its colours from the theme, so picking another accent in **Settings → Appearance** recolours the aurora too.
- **Calm when you ask for it.** With your system's reduced-motion setting on, the scene holds one still frame.
- **Easy on the machine.** The scene is drawn at one pixel per 3px dot, at 24 frames a second, and stops while the window is hidden.
- **Works without a graphics card.** If WebGL is not available, you get the plain palette with no scene.
- **Hermes's own lettering.** Borealis keeps the app's fonts, including the HERMES AGENT wordmark.
- **Nothing leaves your machine.** The plugin is one 30 KB file with no images, no fonts and no network requests.

## Update or remove

```sh
hermes plugins update hermes-borealis
hermes plugins remove hermes-borealis
```

Or use **Capabilities → Plugins**: switch **Borealis** off to hide the theme, or remove it from there. If Borealis was active, Hermes goes back to its default theme.

## What it touches

- **Theme registration** through the Desktop plugin SDK, the same way any theme plugin adds itself to the picker.
- **Style rules** that apply only while Borealis is active, and disappear when you switch away. They restyle parts of Desktop's own UI (tabs, the composer, the sidebar edge, keyboard hints) and make the window's main backgrounds transparent so the scene shows through.
- **One canvas.** While Borealis is active, the plugin adds a single `<canvas>` behind the app and draws the scene on it with WebGL. It removes the canvas when you switch themes or turn the plugin off.
- **Three listeners.** It watches Desktop's active theme, mode and accent (attributes on the page's root element) to know when to show, recolour or remove the scene. It listens for window resizes, and for mouse movement to slide the ridges. It reads only the pointer's horizontal position and stores nothing.

It makes no network requests, adds no agent tools, hooks, background processes or settings, and reads none of your data.

While Borealis is active, Hermes's **Window Translucency** setting has no visible effect, because the scene covers the window.

The restyled tabs, composer and edges style Hermes Desktop's own markup, because the plugin SDK has no slots for decoration yet. If a Desktop update renames that markup, those touches fall back to the plain palette. Nothing else breaks.

## Compatibility

| Hermes Desktop | Platform | Status |
| --- | --- | --- |
| 0.23.1 | Windows 11 | Tested |
| 0.23.1 | macOS, Linux | Expected to work; not yet tested |
| 0.22.2 | any | Expected to work; not yet tested |

## More themes

Borealis installs side by side with these packs, and none of their theme names overlap, so every theme shows up in the same picker.

- **[Pantheon](https://github.com/Adolanium/hermes-pantheon)**: 18 Greek gods in dithered marble.
- **[Kemet](https://github.com/Adolanium/hermes-kemet)**: 12 Egyptian gods in painted relief and gold leaf.
- **[Asgard](https://github.com/Adolanium/hermes-asgard)**: Norse gods carved in runestone and wood.
- **[Nous](https://github.com/Adolanium/hermes-nous)**: Nous Research characters as video game heroes.

<br />

<div align="center">
  <strong>Borealis</strong><br />
  <sub>Lights on. Start typing.</sub>
</div>

<br />

## License

[MIT](LICENSE).

> **Community project**
>
> Borealis is an independent community theme. It is not affiliated with, endorsed by, sponsored by, or officially associated with [Nous Research](https://github.com/NousResearch) or the [Hermes Agent project](https://github.com/NousResearch/hermes-agent). Hermes, Hermes Agent, and Nous Research are names and marks belonging to their respective owners.
