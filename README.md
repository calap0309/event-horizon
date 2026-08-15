# Event Horizon

A real-time black hole that runs entirely in your browser.

GPU raymarching approximates Schwarzschild gravitational lensing, paints a Doppler-shifted accretion disk, and bends a starfield around the photon sphere — with an optional spacetime drone via the Web Audio API.

**Live:** https://calap0309.github.io/event-horizon/

## Controls

- **Drag** to orbit the camera
- **Mass / Disk / Spin / Bloom** — reshape spacetime
- **Hear the void** — deep drone that tracks the dials

## Stack

Vite · React · TypeScript · WebGL2 · Web Audio

## Develop

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run deploy
```

Publishes the production build to the `gh-pages` branch (GitHub Pages).
