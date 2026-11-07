# One Card Bingo

A mobile-friendly 75-ball bingo card for up to six games. The browser creates
one random card, including a free center square, and saves the card, game
number, called numbers, and marks on that device. Use **Draw number** to call
random numbers without repeats, and open **Called numbers** to see the history.
Tapping a square toggles its mark; a completed row, column, or diagonal is
announced as bingo.
Completing a new winning line also displays a fireworks celebration. The
celebration respects the device's reduced-motion preference.

Use **Start game** when ready to play again: after confirmation, marks and
called numbers are cleared while the card stays the same. The sixth game is
the last available game. Existing cards are upgraded as game 1 with their
marks intact.

The card is stored in browser local storage, not on a server. There is no
account or card replacement control. Clearing browser storage removes the card
and game count; the six-game limit is not protected against storage changes.

## Run locally

From the repository root, install the dependencies and start the app:

```bash
pip install -r requirements.txt
uvicorn app:app --app-dir src --reload
```

Open [http://localhost:8000](http://localhost:8000) on a phone or desktop browser.

## Test gameplay

With Node.js 18 or newer installed, run:

```bash
node --test tests/bingo.test.js
```

## Publish with Caddy

The root `Caddyfile` proxies HTTPS traffic to the app on `127.0.0.1:8000`.
`bingo.example.com` is a reserved example domain, so replace it with a real
domain you control.

On a public server with Python and Caddy installed:

1. Point the domain's DNS A/AAAA records at the server and allow inbound TCP
   ports 80 and 443. Only publish an AAAA record if the server is reachable
   over IPv6.
2. From the repository root, install the Python dependencies and start the app
   on the loopback interface:

   ```bash
   pip install -r requirements.txt
   uvicorn app:app --app-dir src --host 127.0.0.1 --port 8000
   ```

3. In a separate shell, start Caddy with your domain:

   ```bash
   BINGO_DOMAIN=your-domain.example caddy run --config Caddyfile
   ```

   Caddy obtains and renews the HTTPS certificate automatically. Leave both
   processes running, or configure them as services on the server. Visit
   `https://your-domain.example` after DNS and certificate issuance complete.

The domain and server must be publicly reachable for automatic certificate
issuance. This configuration alone does not provision a server or publish DNS.
