import { Client, GatewayIntentBits, Partials, Collection, ActivityType } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import Database from './src/structures/database.js';
import fs from 'fs';
import config from "./src/config.js";
import updateRegistry from './src/events/updateRegistryInteraction.js';
import { registerMemberLogs } from "./src/events/memberLogs.js";
import * as acaoPanel from './src/events/acaoPanel.js';
import * as acaoHandlers from './src/events/acaoHandlers.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// usa o config centralizado
client.config = config;

client.db = new Database('./data/tickets.sqlite');

registerMemberLogs(client);

// Collection para armazenar comandos
client.commands = new Collection();

// Load commands dynamically
const commandsPath = path.join(__dirname, 'src', 'commands');
if (fs.existsSync(commandsPath)) {
  for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    try {
      const command = await import(pathToFileURL(path.join(commandsPath, file)));
      if (command.default && command.default.data) {
        client.commands.set(command.default.data.name, command.default);
        console.log(`✅ Comando carregado: ${command.default.data.name}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao carregar comando ${file}:`, error);
    }
  }
}

// Load events dynamically
const eventsPath = path.join(__dirname, 'src', 'events');
if (fs.existsSync(eventsPath)) {
  for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
    try {
      const event = await import(pathToFileURL(path.join(eventsPath, file)));
      if (event.default && event.name) {
        if (event.once) {
          client.once(event.name, (...args) => event.default(client, ...args));
        } else {
          client.on(event.name, (...args) => event.default(client, ...args));
        }
        console.log(`✅ Evento carregado: ${event.name}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao carregar evento ${file}:`, error);
    }
  }
}

client.on("interactionCreate", async interaction => {
  if (!interaction.isUserSelectMenu()) return;
  if (interaction.customId !== "dm_select") return;

  // 🔥 ISSO AQUI É O MAIS IMPORTANTE
  await interaction.deferUpdate();

  const mensagem = interaction.client.dmMessages.get(interaction.user.id);
  if (!mensagem) return;

  let enviados = 0;
  let falhas = 0;

  for (const user of interaction.users.values()) {
    try {
      await user.send(mensagem);
      enviados++;
    } catch {
      falhas++;
    }
  }

  interaction.client.dmMessages.delete(interaction.user.id);

  // agora pode editar com segurança
  await interaction.editReply({
    content: `📨 DM enviada!\n✅ Sucesso: ${enviados}\n❌ Falha: ${falhas}`,
    components: []
  });
});


// Handler para mensagens (para exoneração)
client.on('messageCreate', async (message) => {
  try {
    // Buscar comando de exoneração
    const exoneracaoCommand = client.commands.get('exoneracao');
    if (exoneracaoCommand && exoneracaoCommand.handleMessage) {
      const handled = await exoneracaoCommand.handleMessage(message);
      if (handled) return; // Se foi tratado, não processa mais nada
    }
  } catch (error) {
    console.error('[MessageCreate] Erro ao processar mensagem:', error);
  }
});

// Handler para slash commands e interações
client.on('interactionCreate', async (interaction) => {
  try {
    // Comandos normais (slash commands)
    if (interaction.isCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error('Erro ao executar comando:', error);
        const reply = {
          content: '❌ Houve um erro ao executar este comando!',
          ephemeral: true
        };
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
          } else {
            await interaction.reply(reply);
          }
        } catch (replyError) {
          console.error('Erro ao responder comando:', replyError);
        }
      }
      return; // importante: retorna após processar comando
    }

    // ===== SISTEMA DE AÇÕES =====
    
    // Select Menu de Ações
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'select_acao') {
        await acaoHandlers.handleSelect(client, interaction);
        return;
      }
      // Update Registry
      if (interaction.customId === "update_type_select") {
        await updateRegistry.handleSelectMenuInteraction(interaction);
        return;
      }
    }

    // Botões das Ações
    if (interaction.isButton()) {
      const buttonId = interaction.customId;
      
      // Sistema de Ações
      if (buttonId.startsWith('participar_') || 
          buttonId.startsWith('remover_') || 
          buttonId.startsWith('vitoria_') || 
          buttonId.startsWith('derrota_') || 
          buttonId.startsWith('fuga_') || 
          buttonId.startsWith('cancelar_')) {
        await acaoHandlers.handleButton(client, interaction);
        return;
      }

      // Sistema de Ausências
      if (buttonId.startsWith('confirm_ausencia_') || buttonId === 'cancel_ausencia') {
        const ausenciaCommand = client.commands.get('ausencia');
        if (ausenciaCommand && ausenciaCommand.handleButton) {
          await ausenciaCommand.handleButton(interaction);
          return;
        }
      }

      // Sistema de Exonerações
      if (buttonId === 'confirm_exoneracao_final' || buttonId === 'cancel_exoneracao') {
        const exoneracaoCommand = client.commands.get('exoneracao');
        if (exoneracaoCommand && exoneracaoCommand.handleButton) {
          await exoneracaoCommand.handleButton(interaction);
          return;
        }
      }

      // Sistema de Cancelamento de Exonerações
      if (buttonId.startsWith('confirm_cancel_exoneracao_') || buttonId === 'cancel_action') {
        const cancelCommand = client.commands.get('cancelar_exoneracao');
        if (cancelCommand && cancelCommand.handleButton) {
          await cancelCommand.handleButton(interaction);
          return;
        }
      }

      // Sistema de Remoção de Ausências
      if (buttonId.startsWith('confirm_remove_ausencia_') || buttonId === 'cancel_action_ausencia') {
        const removeAusenciaCommand = client.commands.get('retirar_ausencia');
        if (removeAusenciaCommand && removeAusenciaCommand.handleButton) {
          await removeAusenciaCommand.handleButton(interaction);
          return;
        }
      }
      
      // Update Registry
      if (buttonId.startsWith("accept_") || buttonId.startsWith("reject_")) {
        await updateRegistry.handleButtonInteraction(interaction);
        return;
      }
    }

    // ===== SISTEMA DE ATUALIZAÇÃO DE REGISTRO =====

    // User Select Menu (selecionar usuário alvo)
    if (interaction.isUserSelectMenu()) {
      // Sistema de Exoneração
      if (interaction.customId === 'select_exoneracao_users') {
        const exoneracaoCommand = client.commands.get('exoneracao');
        if (exoneracaoCommand && exoneracaoCommand.handleUserSelect) {
          await exoneracaoCommand.handleUserSelect(interaction);
          return;
        }
      }

      // Sistema de Cancelamento de Exoneração
      if (interaction.customId === 'select_cancel_exoneracao') {
        const cancelCommand = client.commands.get('cancelar_exoneracao');
        if (cancelCommand && cancelCommand.handleUserSelect) {
          await cancelCommand.handleUserSelect(interaction);
          return;
        }
      }

      // Sistema de Remoção de Ausências
      if (interaction.customId === 'select_remove_ausencia') {
        const removeAusenciaCommand = client.commands.get('retirar_ausencia');
        if (removeAusenciaCommand && removeAusenciaCommand.handleUserSelect) {
          await removeAusenciaCommand.handleUserSelect(interaction);
          return;
        }
      }

      if (interaction.customId.startsWith("select_user_")) {
        await updateRegistry.handleUserSelection(interaction);
        return;
      }
    }

    // Role Select Menu (selecionar cargo)
    if (interaction.isRoleSelectMenu()) {
      if (interaction.customId.startsWith("rank_role_select_")) {
        await updateRegistry.handleRankSelection(interaction);
        return;
      } else if (interaction.customId.startsWith("unit_role_select_")) {
        await updateRegistry.handleUnitSelection(interaction);
        return;
      } else if (interaction.customId.startsWith("course_role_select_")) {
        await updateRegistry.handleCourseSelection(interaction);
        return;
      } else if (interaction.customId.startsWith("remove_course_role_select_")) {
        await updateRegistry.handleRemoveCourseSelection(interaction);
        return;
      } else if (interaction.customId.startsWith("remove_unit_role_select_")) {
        await updateRegistry.handleRemoveUnitSelection(interaction);
        return;
      }
    }

    // Modal Submit (formulário de atualização)
    if (interaction.isModalSubmit()) {
      // Sistema de Ausências
      if (interaction.customId === 'ausencia_modal') {
        const ausenciaCommand = client.commands.get('ausencia');
        if (ausenciaCommand && ausenciaCommand.handleModal) {
          await ausenciaCommand.handleModal(interaction);
          return;
        }
      }

      // Sistema de Advertências
      if (interaction.customId === 'advertencia_modal') {
        const advertenciaCommand = client.commands.get('advertencia');
        if (advertenciaCommand && advertenciaCommand.handleModal) {
          await advertenciaCommand.handleModal(interaction);
          return;
        }
      }

      if (interaction.customId.startsWith("basic_info_modal_")) {
        await updateRegistry.handleModalSubmit(interaction);
        return;
      }
    }

  } catch (error) {
    console.error('[InteractionCreate] Erro ao processar interação:', error);
    try {
      const errorReply = {
        content: '❌ Ocorreu um erro ao processar esta interação.',
        ephemeral: true
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    } catch (e) {
      console.error('[InteractionCreate] Erro ao enviar mensagem de erro:', e);
    }
  }
});

process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));

client.login(process.env.DISCORD_TOKEN);