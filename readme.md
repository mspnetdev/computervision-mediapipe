# [ComputerVisionMediapipe](https://mspnetdev.github.io/computervision-mediapipe/)

Demo basata su [mediapipe-js-demos](https://github.com/pjbelo/mediapipe-js-demos).

![screenshot](Screenshot-app.png)

## Setup locale

Per un test locale con un server statico:

```bash
npm init -y
npm install express
```

## Avvio locale

Se vuoi testare la demo in locale con il backend Express già presente:

```bash
node app.js
```

Poi apri:

```text
http://localhost:3000
```

## GitHub Pages

Questo progetto è stato adattato per una pubblicazione statica su GitHub Pages.

### Struttura usata

- la cartella `docs/` contiene i file pubblicati
- `index.html` è il punto di ingresso della pagina web
- le librerie MediaPipe vengono caricate da CDN, quindi non servono dipendenze server-side

### Deploy

1. Push del repository su GitHub
2. Vai su `Settings` -> `Pages`
3. Scegli `Deploy from a branch`
4. Seleziona il branch principale e la cartella `docs`
5. Salva

La pagina diventa disponibile a un URL del tipo:

```text
https://<username>.github.io/<repository-name>/
```

> Nota: la webcam richiede HTTPS, che GitHub Pages fornisce automaticamente.

### File statici principali

- `docs/index.html`
- `docs/holistic.css`
- `docs/holistic.js`
- `.nojekyll`

Questo evita problemi di generazione Jekyll con file statici e asset esterni.
