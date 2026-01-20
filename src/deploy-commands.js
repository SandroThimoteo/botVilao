import { REST, Routes } from "discord.js";
import { readdirSync } from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para a pasta de comandos
const commandsPath = path.join(__dirname, "commands");

const commands = [];

// Carrega os comandos
for (const file of readdirSync(commandsPath).filter(f => f.endsWith(".js"))) {
  const filePath = path.join(commandsPath, file);
  const command = await import(pathToFileURL(filePath));

  if (command.default && command.default.data) {
    commands.push(command.default.data.toJSON());
    console.log(`✅ Comando carregado: ${command.default.data.name}`);
  } else {
    console.log(`⚠️ Ignorado: ${file} não exporta data corretamente`);
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// Registra os comandos
try {
  console.log("🚀 Registrando comandos de barra (/)...");

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );

  console.log("✅ Comandos registrados com sucesso!");
} catch (error) {
  console.error("❌ Erro ao registrar comandos:", error);
}
