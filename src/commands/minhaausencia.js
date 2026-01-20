import { 
  SlashCommandBuilder, 
  EmbedBuilder
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('minhaausencia')
    .setDescription('📊 Consultar status da sua ausência atual'),

  async execute(interaction) {
    try {
      const db = interaction.client.db;
      const userId = interaction.user.id;
      const guildId = interaction.guild.id;

      // Buscar ausência do usuário (usando await)
      const ausencia = await db.get(
        'SELECT * FROM ausencias WHERE user_id = ? AND guild_id = ?',
        [userId, guildId]
      );

      if (!ausencia) {
        return interaction.reply({
          content: '📋 Você não possui nenhuma ausência registrada no momento.',
          ephemeral: true
        });
      }

      const startDate = new Date(ausencia.start_date);
      const returnDate = new Date(ausencia.return_date);
      const now = Date.now();
      
      const totalDuration = Math.ceil((ausencia.return_date - ausencia.start_date) / (1000 * 60 * 60 * 24));
      const daysElapsed = Math.floor((now - ausencia.start_date) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.ceil((ausencia.return_date - now) / (1000 * 60 * 60 * 24));
      const progressPercent = Math.min(100, Math.floor((daysElapsed / totalDuration) * 100));

      // Criar barra de progresso visual
      const totalBars = 10;
      const filledBars = Math.floor((progressPercent / 100) * totalBars);
      const emptyBars = totalBars - filledBars;
      const progressBar = '🟦'.repeat(filledBars) + '⬜'.repeat(emptyBars);

      const statusEmbed = new EmbedBuilder()
        .setColor('#4A90E2')
        .setTitle('📊 Status da Sua Ausência')
        .setDescription(`**${interaction.user.username}**, aqui estão os detalhes da sua ausência:`)
        .addFields(
          { name: '📅 Início', value: `<t:${Math.floor(startDate.getTime() / 1000)}:F>`, inline: true },
          { name: '📅 Retorno Previsto', value: `<t:${Math.floor(returnDate.getTime() / 1000)}:F>`, inline: true },
          { name: '\u200b', value: '\u200b', inline: false },
          { name: '⏳ Duração Total', value: `${totalDuration} dia(s)`, inline: true },
          { name: '✅ Dias Ausente', value: `${daysElapsed} dia(s)`, inline: true },
          { name: '⏰ Dias Restantes', value: `${daysRemaining} dia(s)`, inline: true },
          { name: '📊 Progresso', value: `${progressBar}\n${progressPercent}% concluído`, inline: false },
          { name: '🔔 Lembrete', value: ausencia.reminded ? '✅ Já enviado' : '⏳ Será enviado 24h antes', inline: true },
          { name: '⏱️ Tempo Relativo', value: `Retorno <t:${Math.floor(returnDate.getTime() / 1000)}:R>`, inline: true }
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({ text: 'Bom descanso! A staff pode reverter sua ausência a qualquer momento.' })
        .setTimestamp();

      await interaction.reply({
        embeds: [statusEmbed],
        ephemeral: true
      });

    } catch (error) {
      console.error('Erro no comando /minhaausencia:', error);
      await interaction.reply({
        content: '❌ Erro ao consultar sua ausência!',
        ephemeral: true
      }).catch(() => {});
    }
  }
};