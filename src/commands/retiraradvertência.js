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
    .setName("retirar_ausencia")
    .setDescription("Remover ausência de um membro (apenas STAFF)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      // Verifica se o usuário tem a role de STAFF
      if (!interaction.member.roles.cache.has(config.staffExoneracaoId)) {
        return interaction.reply({
          content: "❌ Você não tem permissão para usar este comando!",
          ephemeral: true,
        });
      }

      const db = interaction.client.db;
      const guildId = interaction.guild.id;

      // Buscar todas as ausências ativas (usando await)
      const ausencias = await db.all(
        'SELECT * FROM ausencias WHERE guild_id = ?',
        [guildId]
      );

      // Verificar se há ausências
      if (!ausencias || ausencias.length === 0) {
        return interaction.reply({
          content: "ℹ️ Não há nenhuma ausência registrada no momento.",
          ephemeral: true,
        });
      }

      // Criar lista de membros com ausência
      let description = "**Membros em ausência:**\n\n";

      for (const ausencia of ausencias) {
        const member = await interaction.guild.members.fetch(ausencia.user_id).catch(() => null);
        if (!member) continue;

        const startDate = new Date(ausencia.start_date);
        const returnDate = new Date(ausencia.return_date);

        description += `👤 ${member} (${member.user.tag})\n`;
        description += `├ 📅 Início: <t:${Math.floor(startDate.getTime() / 1000)}:d>\n`;
        description += `├ ⏰ Retorno: <t:${Math.floor(returnDate.getTime() / 1000)}:R>\n`;
        description += `└ 🔔 Lembrete: ${ausencia.reminded ? '✅ Enviado' : '⏳ Pendente'}\n\n`;
      }

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('📋 Ausências Ativas')
        .setDescription(description)
        .setFooter({ text: `Total: ${ausencias.length} ausência(s) registrada(s)` })
        .setTimestamp();

      // Seletor de usuário para remover ausência
      const selectMenu = new UserSelectMenuBuilder()
        .setCustomId('select_remove_ausencia')
        .setPlaceholder('Selecione o membro para remover a ausência')
        .setMinValues(1)
        .setMaxValues(1);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
      });
    } catch (error) {
      console.error('Erro no comando retirar_ausencia:', error);
      await interaction.reply({
        content: "❌ Erro ao buscar ausências!",
        ephemeral: true
      }).catch(() => {});
    }
  },

  // Handler para User Select Menu
  async handleUserSelect(interaction) {
    try {
      if (interaction.customId !== 'select_remove_ausencia') return;

      const selectedUserId = interaction.values[0];
      const db = interaction.client.db;
      const guildId = interaction.guild.id;

      // Buscar ausência do usuário (usando await)
      const ausencia = await db.get(
        'SELECT * FROM ausencias WHERE user_id = ? AND guild_id = ?',
        [selectedUserId, guildId]
      );

      if (!ausencia) {
        return interaction.update({
          content: "❌ Este membro não possui ausência registrada!",
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

      const returnDate = new Date(ausencia.return_date);

      // Confirmar remoção
      const confirmEmbed = new EmbedBuilder()
        .setColor('#FFAA00')
        .setTitle('⚠️ Confirmar Remoção de Ausência')
        .setDescription(`Você tem certeza que deseja remover a ausência de **${member.user.tag}**?`)
        .addFields(
          { name: '👤 Membro', value: `${member}`, inline: true },
          { name: '⏰ Retorno Previsto', value: `<t:${Math.floor(returnDate.getTime() / 1000)}:R>`, inline: true },
          { name: '📋 Observação', value: 'O cargo de ausência será removido e o registro será deletado', inline: false }
        )
        .setFooter({ text: 'Esta ação não pode ser desfeita' })
        .setTimestamp();

      const confirmButton = new ButtonBuilder()
        .setCustomId(`confirm_remove_ausencia_${selectedUserId}`)
        .setLabel('✅ Confirmar Remoção')
        .setStyle(ButtonStyle.Success);

      const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_action_ausencia')
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
    } catch (error) {
      console.error('Erro no handleUserSelect:', error);
      await interaction.reply({
        content: "❌ Erro ao processar seleção!",
        ephemeral: true
      }).catch(() => {});
    }
  },

  // Handler para Buttons
  async handleButton(interaction) {
    try {
      if (interaction.customId === 'cancel_action_ausencia') {
        await interaction.update({
          content: "❌ Ação cancelada.",
          embeds: [],
          components: [],
        });
        return;
      }

      if (interaction.customId.startsWith('confirm_remove_ausencia_')) {
        const userId = interaction.customId.replace('confirm_remove_ausencia_', '');
        const db = interaction.client.db;
        const guildId = interaction.guild.id;

        // Buscar ausência (usando await)
        const ausencia = await db.get(
          'SELECT * FROM ausencias WHERE user_id = ? AND guild_id = ?',
          [userId, guildId]
        );

        if (!ausencia) {
          return interaction.update({
            content: "❌ Ausência não encontrada. Ela pode já ter sido removida.",
            embeds: [],
            components: [],
          });
        }

        // Buscar membro
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        
        if (!member) {
          return interaction.update({
            content: "❌ Membro não encontrado no servidor!",
            embeds: [],
            components: [],
          });
        }

        // Remover cargo de ausência
        const ausenciaRole = interaction.guild.roles.cache.get(config.ausenciaRoleId);
        if (ausenciaRole && member.roles.cache.has(ausenciaRole.id)) {
          await member.roles.remove(ausenciaRole).catch(console.error);
        }

        // Deletar do banco de dados (usando await)
        await db.run(
          'DELETE FROM ausencias WHERE user_id = ? AND guild_id = ?',
          [userId, guildId]
        );

        // Resposta simples sem embed
        await interaction.update({
          content: `✅ A ausência de **${member.user.tag}** foi removida com sucesso!`,
          embeds: [],
          components: [],
        });

        // Notificar o membro via DM
        if (member) {
          try {
            const dmEmbed = new EmbedBuilder()
              .setColor('#FFA500')
              .setTitle('⚠️ Ausência Removida')
              .setDescription('Sua ausência foi **removida pela STAFF**!')
              .addFields(
                { name: '📋 Status', value: 'Ausência cancelada', inline: false },
                { name: '🎖️ Observação', value: 'Você já pode retornar às suas atividades normalmente. Caso tenha dúvidas, contate a administração.', inline: false }
              )
              .setFooter({ text: 'Entre em contato com a STAFF para mais informações' })
              .setTimestamp();

            await member.send({ embeds: [dmEmbed] });
          } catch (error) {
            console.error('Erro ao enviar DM para o membro:', error);
          }
        }
      }
    } catch (error) {
      console.error('Erro no handleButton:', error);
      await interaction.reply({
        content: "❌ Erro ao processar ação!",
        ephemeral: true
      }).catch(() => {});
    }
  },
};

export default command;