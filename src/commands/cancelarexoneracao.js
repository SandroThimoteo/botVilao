import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import config from "../config.js";

const command = {
  data: new SlashCommandBuilder()
    .setName("cancelar_exoneracao")
    .setDescription("Cancelar exoneração agendada de um membro")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Verifica se o usuário tem a role de STAFF
    if (!interaction.member.roles.cache.has(config.staffExoneracaoId)) {
      return interaction.reply({
        content: "❌ Você não tem permissão para usar este comando!",
        ephemeral: true,
      });
    }

    // Buscar comando de exoneração para acessar scheduledKicks
    const exoneracaoCommand = interaction.client.commands.get('exoneracao');
    if (!exoneracaoCommand) {
      return interaction.reply({
        content: "❌ Sistema de exoneração não encontrado!",
        ephemeral: true,
      });
    }

    const scheduledKicks = exoneracaoCommand.getScheduledKicks();

    // Verificar se há expulsões agendadas
    if (scheduledKicks.size === 0) {
      return interaction.reply({
        content: "ℹ️ Não há nenhuma exoneração agendada no momento.",
        ephemeral: true,
      });
    }

    // Criar lista de membros com exoneração agendada
    let description = "**Membros com exoneração agendada:**\n\n";
    const kickArray = Array.from(scheduledKicks.values());

    for (const kickData of kickArray) {
      const member = await interaction.guild.members.fetch(kickData.userId).catch(() => null);
      if (!member) continue;

      const scheduledDate = new Date(kickData.scheduledAt);
      const kickDate = new Date(kickData.kickAt);
      const scheduledBy = await interaction.client.users.fetch(kickData.scheduledBy).catch(() => null);

      description += `👤 ${member} (${member.user.tag})\n`;
      description += `├ 📅 Agendado em: <t:${Math.floor(scheduledDate.getTime() / 1000)}:f>\n`;
      description += `├ ⏰ Expulsão em: <t:${Math.floor(kickDate.getTime() / 1000)}:R>\n`;
      description += `└ 👮 Por: ${scheduledBy ? scheduledBy.tag : 'Desconhecido'}\n\n`;
    }

    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('🗂️ Exonerações Agendadas')
      .setDescription(description)
      .setFooter({ text: `Total: ${scheduledKicks.size} exoneração(ões) agendada(s)` })
      .setTimestamp();

    // Seletor de usuário para cancelar
    const selectMenu = new UserSelectMenuBuilder()
      .setCustomId('select_cancel_exoneracao')
      .setPlaceholder('Selecione o membro para cancelar a exoneração')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },

  // Handler para User Select Menu
  async handleUserSelect(interaction) {
    if (interaction.customId !== 'select_cancel_exoneracao') return;

    const selectedUserId = interaction.values[0];

    // Buscar comando de exoneração
    const exoneracaoCommand = interaction.client.commands.get('exoneracao');
    if (!exoneracaoCommand) {
      return interaction.reply({
        content: "❌ Sistema de exoneração não encontrado!",
        ephemeral: true,
      });
    }

    const scheduledKicks = exoneracaoCommand.getScheduledKicks();
    const kickData = scheduledKicks.get(selectedUserId);

    if (!kickData) {
      return interaction.update({
        content: "❌ Este membro não possui exoneração agendada!",
        embeds: [],
        components: [],
      });
    }

    // Buscar informações do membro
    const member = await interaction.guild.members.fetch(selectedUserId).catch(() => null);
    if (!member) {
      return interaction.update({
        content: "❌ Não foi possível encontrar este membro!",
        embeds: [],
        components: [],
      });
    }

    // Confirmar cancelamento
    const confirmEmbed = new EmbedBuilder()
      .setColor('#FFAA00')
      .setTitle('⚠️ Confirmar Cancelamento')
      .setDescription(`Você tem certeza que deseja cancelar a exoneração de **${member.user.tag}**?`)
      .addFields(
        { name: '👤 Membro', value: `${member}`, inline: true },
        { name: '⏰ Expulsão Agendada Para', value: `<t:${Math.floor(kickData.kickAt / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: 'Esta ação não pode ser desfeita' })
      .setTimestamp();

    const confirmButton = new ButtonBuilder()
      .setCustomId(`confirm_cancel_exoneracao_${selectedUserId}`)
      .setLabel('✅ Confirmar Cancelamento')
      .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_action')
      .setLabel('❌ Voltar')
      .setStyle(ButtonStyle.Secondary);

    const buttonRow = new ActionRowBuilder().addComponents(
      confirmButton,
      cancelButton
    );

    await interaction.update({
      embeds: [confirmEmbed],
      components: [buttonRow],
    });
  },

  // Handler para Buttons
  async handleButton(interaction) {
    if (interaction.customId === 'cancel_action') {
      await interaction.update({
        content: "❌ Ação cancelada.",
        embeds: [],
        components: [],
      });
      return;
    }

    if (interaction.customId.startsWith('confirm_cancel_exoneracao_')) {
      const userId = interaction.customId.replace('confirm_cancel_exoneracao_', '');

      // Buscar comando de exoneração
      const exoneracaoCommand = interaction.client.commands.get('exoneracao');
      if (!exoneracaoCommand) {
        return interaction.update({
          content: "❌ Sistema de exoneração não encontrado!",
          embeds: [],
          components: [],
        });
      }

      // Cancelar a exoneração
      const cancelled = exoneracaoCommand.cancelKick(userId);

      if (!cancelled) {
        return interaction.update({
          content: "❌ Não foi possível cancelar a exoneração. Ela pode já ter sido executada ou cancelada.",
          embeds: [],
          components: [],
        });
      }

      // Buscar membro para enviar notificação
      const member = await interaction.guild.members.fetch(userId).catch(() => null);

      // Resposta simples sem embed
      await interaction.update({
        content: `✅ A exoneração de **${member ? member.user.tag : 'Membro'}** foi cancelada com sucesso!`,
        embeds: [],
        components: [],
      });

      // Notificar no canal de log
      if (config.channelLogExoneracao && member) {
        const logChannel = interaction.guild.channels.cache.get(config.channelLogExoneracao);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🔄 Exoneração Cancelada')
            .setDescription(`A exoneração agendada foi cancelada.`)
            .addFields(
              { name: '👤 Membro', value: `${member} (${member.user.tag})`, inline: true },
              { name: '👮 Cancelado Por', value: `${interaction.user.tag}`, inline: true },
              { name: '📅 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        }
      }

      // Notificar o membro via DM
      if (member) {
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Boa Notícia!')
            .setDescription('Sua exoneração foi **cancelada**! Você não será mais removido do servidor.')
            .addFields(
              { name: '✅ Status', value: 'Exoneração cancelada', inline: false },
              { name: '📋 Observação', value: 'Continue seguindo as regras e participando das atividades.', inline: false }
            )
            .setTimestamp();

          await member.send({ embeds: [dmEmbed] });
        } catch (error) {
          console.error('Erro ao enviar DM para o membro:', error);
        }
      }
    }
  },
};

export default command;