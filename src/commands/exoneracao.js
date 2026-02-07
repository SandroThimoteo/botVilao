import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import config from "../config.js";

// Armazena os timeouts de expulsão
const scheduledKicks = new Map();

// Armazena usuários que estão preenchendo dados via chat
const awaitingResponse = new Map();

const command = {
  data: new SlashCommandBuilder()
    .setName("exoneracao")
    .setDescription("Exonerar membros da equipe")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Verifica se o usuário tem a role de STAFF
    if (!interaction.member.roles.cache.has(config.staffExoneracaoId)) {
      return interaction.reply({
        content: "❌ Você não tem permissão para usar este comando!",
        ephemeral: true,
      });
    }

    // Cria o seletor de usuários
    const selectMenu = new UserSelectMenuBuilder()
      .setCustomId("select_exoneracao_users")
      .setPlaceholder("Selecione os membros a serem exonerados")
      .setMinValues(1)
      .setMaxValues(10);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: "👥 **Selecione os membros que serão exonerados:**",
      components: [row],
      ephemeral: true,
    });
  },

  // Handler para User Select Menu
  async handleUserSelect(interaction) {
    if (!interaction.customId.startsWith("select_exoneracao_users")) return;

    // IMPORTANTE: Responder imediatamente para evitar timeout
    await interaction.deferUpdate().catch(console.error);

    const selectedUsers = interaction.values;

    // Busca os membros para pegar os apelidos
    const members = await Promise.all(
      selectedUsers.map((id) => interaction.guild.members.fetch(id).catch(() => null))
    ).then(m => m.filter(Boolean));

    if (members.length === 0) {
      return interaction.followUp({
        content: "❌ Erro ao buscar os membros selecionados!",
        ephemeral: true,
      });
    }

    // Salva os dados temporariamente
    if (!command.pendingExoneracoes) command.pendingExoneracoes = new Map();
    command.pendingExoneracoes.set(interaction.user.id, {
      members,
      userIds: selectedUsers,
      dados: [],
      currentIndex: 0,
      channelId: interaction.channel.id
    });

    // Marca que está aguardando resposta
    awaitingResponse.set(interaction.user.id, true);

    // Inicia o processo de coleta via chat
    const firstMember = members[0];
    const nomeOficial = firstMember.nickname || firstMember.user.displayName || firstMember.user.username;

    await interaction.editReply({
      content: `📝 **Exoneração 1/${members.length}**\n\n` +
               `👤 Membro: ${firstMember} - **${nomeOficial}**\n\n` +
               `Por favor, envie no chat as informações no seguinte formato:\n` +
               `\`\`\`\n` +
               `Patente: [sua resposta]\n` +
               `Unidade: [sua resposta]\n` +
               `Motivo: [sua resposta]\n` +
               `\`\`\`\n` +
               `**Exemplo:**\n` +
               `\`\`\`\n` +
               `Patente: Capitão\n` +
               `Unidade: BOPE\n` +
               `Motivo: Inatividade prolongada\n` +
               `\`\`\``,
      components: [],
    });
  },

  // Handler para mensagens no chat
  async handleMessage(message) {
    // Ignora mensagens de bots
    if (message.author.bot) return false;

    // Verifica se o usuário está aguardando resposta
    if (!awaitingResponse.has(message.author.id)) return false;

    const data = command.pendingExoneracoes?.get(message.author.id);
    if (!data) return false;

    // Verifica se está no canal correto
    if (data.channelId !== message.channel.id) return false;

    const content = message.content.trim();

    // Verifica se a mensagem está no formato correto
    const patenteMatch = content.match(/Patente:\s*(.+)/i);
    const unidadeMatch = content.match(/Unidade:\s*(.+)/i);
    const motivoMatch = content.match(/Motivo:\s*(.+)/i);

    if (!patenteMatch || !unidadeMatch || !motivoMatch) {
      await message.reply("❌ Formato inválido! Use o formato:\n```\nPatente: [sua resposta]\nUnidade: [sua resposta]\nMotivo: [sua resposta]\n```");
      return true;
    }

    const patente = patenteMatch[1].trim();
    const unidade = unidadeMatch[1].trim();
    const motivo = motivoMatch[1].trim();

    // Salva os dados do membro atual
    const currentMember = data.members[data.currentIndex];
    data.dados.push({
      member: currentMember,
      patente,
      unidade,
      motivo
    });

    // Deleta a mensagem do usuário
    try {
      await message.delete();
    } catch (err) {
      // Ignora erro se não tiver permissão
    }

    // Verifica se há mais membros
    data.currentIndex++;
    if (data.currentIndex < data.members.length) {
      // Próximo membro
      const nextMember = data.members[data.currentIndex];
      const nomeOficial = nextMember.nickname || nextMember.user.displayName || nextMember.user.username;

      await message.channel.send({
        content: `✅ Dados salvos!\n\n` +
                 `📝 **Exoneração ${data.currentIndex + 1}/${data.members.length}**\n\n` +
                 `👤 Membro: ${nextMember} - **${nomeOficial}**\n\n` +
                 `Por favor, envie no chat as informações no seguinte formato:\n` +
                 `\`\`\`\n` +
                 `Patente: [sua resposta]\n` +
                 `Unidade: [sua resposta]\n` +
                 `Motivo: [sua resposta]\n` +
                 `\`\`\``
      });
    } else {
      // Todos os dados foram coletados, mostra prévia
      awaitingResponse.delete(message.author.id);

      let preview = "📋 **Prévia das Exonerações:**\n\n";
      
      data.dados.forEach((d, index) => {
        const nomeOficial = d.member.nickname || d.member.user.displayName || d.member.user.username;
        preview += `**${index + 1}. ${d.member}**\n`;
        preview += `\`\`\`ini\n`;
        preview += `[Nome do oficial] ${nomeOficial}\n`;
        preview += `[Patente] ${d.patente}\n`;
        preview += `[Unidade] ${d.unidade}\n`;
        preview += `[Motivo] ${d.motivo}\n`;
        preview += `[Autorizado por: ${message.author.tag}]\n`;
        preview += `\`\`\`\n`;
      });

      // Botões de confirmação
      const confirmButton = new ButtonBuilder()
        .setCustomId(`confirm_exoneracao_final`)
        .setLabel("✅ Confirmar e Enviar")
        .setStyle(ButtonStyle.Success);

      const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel_exoneracao`)
        .setLabel("❌ Cancelar")
        .setStyle(ButtonStyle.Danger);

      const buttonRow = new ActionRowBuilder().addComponents(
        confirmButton,
        cancelButton
      );

      await message.channel.send({
        content: preview,
        components: [buttonRow]
      });
    }

    return true;
  },

  // Handler para Buttons
  async handleButton(interaction) {
    if (interaction.customId === "confirm_exoneracao_final") {
      // Defer imediatamente para evitar timeout
      await interaction.deferUpdate().catch(console.error);

      const data = command.pendingExoneracoes?.get(interaction.user.id);
      
      if (!data) {
        return interaction.followUp({
          content: "❌ Dados da exoneração não encontrados. Use o comando novamente.",
          ephemeral: true,
        });
      }

      // Decide onde enviar
      let targetChannel = interaction.channel;
      
      if (config.channelLogExoneracao) {
        const logChannel = interaction.guild.channels.cache.get(config.channelLogExoneracao);
        if (logChannel) {
          targetChannel = logChannel;
        }
      }

      // Envia uma mensagem para cada oficial exonerado
      for (let i = 0; i < data.dados.length; i++) {
        const d = data.dados[i];
        const nomeOficial = d.member.nickname || d.member.user.displayName || d.member.user.username;

        const mensagem = `${d.member}\n\`\`\`ini\n` +
          `[Nome do oficial] ${nomeOficial}\n` +
          `[Patente] ${d.patente}\n` +
          `[Unidade] ${d.unidade}\n` +
          `[Motivo] ${d.motivo}\n` +
          `[Autorizado por: ${interaction.user.tag}]\n` +
          `\`\`\``;

        await targetChannel.send(mensagem);
      }

      await interaction.editReply({
        content: "✅ **Exonerações registradas com sucesso!**\n⏰ Os membros serão removidos do servidor em **7 dias**.",
        components: [],
      });

      // Agenda a expulsão dos membros em 1 dia
      const kickDelay = 0 * 0 * 0 * 0 * 5000; // 1 dias em milissegundos
      
      data.dados.forEach((d) => {
        const member = d.member;
        const timeoutId = setTimeout(async () => {
          try {
            await member.kick(`Exoneração automática após 1 dia - Executado por ${interaction.user.tag}`);
            
            // Remove do mapa após expulsar
            scheduledKicks.delete(member.id);
            
            // Notifica no canal
            await targetChannel.send({
              content: `🔴 **${member.user.tag}** foi removido do servidor (exoneração automática).`
            });
          } catch (error) {
            console.error(`Erro ao expulsar ${member.user.tag}:`, error);
            await targetChannel.send({
              content: `❌ Não foi possível remover **${member.user.tag}** do servidor.`
            });
          }
        }, kickDelay);

        // Salva o timeout para poder cancelar depois
        scheduledKicks.set(member.id, {
          timeoutId,
          userId: member.id,
          guildId: interaction.guild.id,
          scheduledBy: interaction.user.id,
          scheduledAt: Date.now(),
          kickAt: Date.now() + kickDelay
        });
      });

      // Limpa os dados temporários
      command.pendingExoneracoes.delete(interaction.user.id);

    } else if (interaction.customId === "cancel_exoneracao") {
      await interaction.update({
        content: "❌ **Exoneração cancelada.**",
        components: [],
      });

      // Limpa os dados temporários
      command.pendingExoneracoes?.delete(interaction.user.id);
      awaitingResponse.delete(interaction.user.id);
    }
  },

  // Funções auxiliares para gerenciar expulsões agendadas
  getScheduledKicks() {
    return scheduledKicks;
  },

  cancelKick(userId) {
    const kickData = scheduledKicks.get(userId);
    if (kickData) {
      clearTimeout(kickData.timeoutId);
      scheduledKicks.delete(userId);
      return true;
    }
    return false;
  },
};

export default command;