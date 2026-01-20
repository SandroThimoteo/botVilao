# Discord Ticket Bot (modular)

Structure:
- src/events -> event handlers (ready, interactionCreate)
- src/commands -> placeholder for future slash/utility commands
- src/structures -> database wrapper (sqlite)
- src/components, src/embeds -> UI components and embed builders
- assets/visualx.png -> image used in embed (placeholder)

Setup:
1. Copy `.env.example` to `.env` and fill values.
2. `npm install`
3. `npm start`

Behavior:
- On ready: ensures categories Suporte, Curso, Corregedoria exist and posts the ticket embed+select in CHANNEL_TICKET (if not already posted).
- Creates private ticket channels on select, stores tickets in SQLite, and keeps state across restarts.
- Includes a "Fechar Ticket" button to close tickets and saves transcripts in ./data/transcripts.
