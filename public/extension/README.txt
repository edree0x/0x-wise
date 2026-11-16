0x wise Clipper — install guide
===============================

The clipper is a small Chromium extension that sends a page or a selected
sentence straight into your own 0x wise library. It talks only to the address
you give it, using an API token you generate in the app. There is no account,
no vendor server, and no tracking.

Before you start
----------------
1. Run 0x wise, either with Docker Compose or `npm run dev`.
2. Confirm the address in a browser, for example http://localhost:3210.
3. In 0x wise, open Integrations, find the API card, and create a token.
   Copy it immediately: the server stores only its hash.

Install the extension
---------------------
1. Open chrome://extensions in Chrome, Edge, Brave, or another
   Chromium-based browser.
2. Turn on "Developer mode" in the top right.
3. Choose "Load unpacked".
4. Select this `extension` folder. From a source checkout it lives at:
       public/extension
5. Pin the 0x wise icon to the toolbar.

Connect it to your instance
---------------------------
1. Click the 0x wise icon, then the gear in the popup.
   The same page is available from the extension's "Details → Extension
   options".
2. Enter the address, for example http://localhost:3210. Do not add a path.
3. Paste the API token.
4. Choose "Save connection". The browser asks for permission to reach that
   address; allow it so the clipper can post to your instance.
5. Choose "Test connection" to confirm the token works.

Everyday use
------------
- Select a sentence, open the popup, optionally add a note, then click
  "Clip selection". It is saved as a highlight on the page's document and
  enters the review queue immediately.
- Click "Clip page" (or right-click the page and choose
  "Clip page to 0x wise") to save the page as a bookmark.
- Right-click a selection and choose "Clip selection to 0x wise" to skip
  the popup entirely.
- The toolbar badge shows a check when the clip lands.

How it talks to 0x wise
-----------------------
Every clip is a JSON POST to `<your address>/api/clip`:

    {
      "url":   "https://example.com/article",
      "title": "Article title",
      "text":  "The selected sentence, or an empty string for a bookmark",
      "note":  "Optional note"
    }

The request carries `Authorization: Bearer <token>`. Responses are JSON with
`ok`, `docId`, and `highlightId`. If you revoke the token in Integrations,
clipping stops until you paste a new one.

Privacy
-------
- The token lives in this browser's extension storage only.
- The extension requests access to the specific instance address you save,
  not to every site. The active page is read only when you open the popup or
  use a context menu, and only to read its title, URL, and selection.
