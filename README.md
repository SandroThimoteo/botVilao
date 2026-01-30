```md
# 🤖 BotVilao – Discord Bot

Discord bot developed in **Node.js** using **discord.js v14**, focused on **administrative management**, **absence control**, **dismissals**, **user registry**, **member logs**, and advanced interactions through **Slash Commands, Buttons, Select Menus, and Modals**.

---

## 🚀 Features

- ✅ Slash Commands system
- 📋 Action panel with interactive buttons and menus
- 🧾 User registry updates (role, unit, course, etc.)
- 🧑‍✈️ Dismissal and dismissal cancellation system
- 📆 Absence management
- 📨 Mass private message sending (DM)
- 🧠 Local database using SQLite
- 👮 Automatic member join/leave logs
- 📦 Modular and scalable structure

---

## 🛠️ Technologies Used

- Node.js
- discord.js v14
- SQLite
- dotenv
- ES Modules (import/export)

---

## 📁 Project Structure

```bash
botVilao/
├── index.js
├── package.json
├── .env
├── data/
│   └── tickets.sqlite
├── src/
│   ├── commands/
│   ├── events/
│   ├── structures/
│   └── config.js
└── README.md