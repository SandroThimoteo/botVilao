import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import config from '../config.js';

// Armazenar dados temporários de ausências pendentes
const pendingAusencias = new Map();

export default {
  data: new SlashCommandBuilder()
    .setName('ausencia')
    .setDescription('📅 Registrar ausência das atividades militares'),

  async execute(interaction) {
    try {
      const member = interaction.member;
      const ausenciaRole = interaction.guild.roles.cache.get(config.ausenciaRoleId);

      // Verificar se o cargo de ausência existe
      if (!ausenciaRole) {
        return interaction.reply({
          content: '❌ Cargo de ausência não configurado! Contate um administrador.',
          ephemeral: true
        });
      }

      // Verificar se já está em ausência
      if (member.roles.cache.has(config.ausenciaRoleId)) {
        return interaction.reply({
          content: '⚠️ Você já está registrado como ausente! Use `/minhaausencia` para ver os detalhes ou aguarde a staff reverter sua ausência.',
          ephemeral: true
        });
      }

      // Criar modal com formulário
      const modal = new ModalBuilder()
        .setCustomId('ausencia_modal')
        .setTitle('📅 Registrar Ausência');

      // Campo: Data de Retorno
      const dataInput = new TextInputBuilder()
        .setCustomId('data_retorno')
        .setLabel('Data de Retorno')
        .setPlaceholder('DD/MM/AAAA ou DD/MM/AAAA HH:MM')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(16);

      // Campo: Motivo
      const motivoInput = new TextInputBuilder()
        .setCustomId('motivo_ausencia')
        .setLabel('Motivo da Ausência')
        .setPlaceholder('Explique brevemente o motivo da sua ausência...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(500);

      // Adicionar campos ao modal
      const row1 = new ActionRowBuilder().addComponents(dataInput);
      const row2 = new ActionRowBuilder().addComponents(motivoInput);

      modal.addComponents(row1, row2);

      await interaction.showModal(modal);

    } catch (error) {
      console.error('Erro no comando /ausencia:', error);
      await interaction.reply({
        content: '❌ Erro ao processar o comando de ausência!',
        ephemeral: true
      }).catch(() => {});
    }
  },

  async handleModal(interaction) {
    try {
      if (interaction.customId !== 'ausencia_modal') return;

      await interaction.deferReply({ ephemeral: true });

      const dataRetorno = interaction.fields.getTextInputValue('data_retorno');
      const motivo = interaction.fields.getTextInputValue('motivo_ausencia');

      const member = interaction.member;
      const parsedDate = parseDate(dataRetorno);

      if (!parsedDate.valid) {
        return interaction.editReply({
          content: `❌ **Data inválida!**\n${parsedDate.error}\n\nFormato correto: DD/MM/AAAA ou DD/MM/AAAA HH:MM`,
          ephemeral: true
        });
      }

      const returnDate = parsedDate.date;
      const now = new Date();

      // Validações
      if (returnDate <= now) {
        return interaction.editReply({
          content: '❌ A data de retorno deve ser no futuro! Tente novamente.',
          ephemeral: true
        });
      }

      const maxDays = 90;
      const diffTime = returnDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > maxDays) {
        return interaction.editReply({
          content: `❌ A ausência não pode ser superior a ${maxDays} dias! (Você tentou registrar ${diffDays} dias)`,
          ephemeral: true
        });
      }

      // Salvar dados temporariamente
      const tempId = `${interaction.user.id}_${Date.now()}`;
      pendingAusencias.set(tempId, {
        userId: interaction.user.id,
        returnDate: returnDate.getTime(),
        motivo: motivo
      });

      // Limpar após 10 minutos
      setTimeout(() => {
        pendingAusencias.delete(tempId);
      }, 600000);

      // Confirmar registro
      const confirmEmbed = new EmbedBuilder()
        .setColor('#FFAA00')
        .setTitle('⚠️ Confirmar Registro de Ausência')
        .setDescription(`**${member.user.username}**, confirme os dados da sua ausência:`)
        .addFields(
          { name: '👤 Usuário', value: `${member}`, inline: true },
          { name: '📅 Data de Retorno', value: `<t:${Math.floor(returnDate.getTime() / 1000)}:F>`, inline: false },
          { name: '⏳ Duração', value: `${diffDays} dia(s)`, inline: true },
          { name: '🔔 Lembrete', value: `<t:${Math.floor((returnDate.getTime() - 86400000) / 1000)}:F>`, inline: true },
          { name: '📝 Motivo', value: motivo, inline: false }
        )
        .setFooter({ text: 'Confirme clicando no botão abaixo' })
        .setTimestamp();

      const confirmRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm_ausencia_${tempId}`)
            .setLabel('✅ Confirmar')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('cancel_ausencia')
            .setLabel('❌ Cancelar')
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.editReply({
        embeds: [confirmEmbed],
        components: [confirmRow]
      });

    } catch (error) {
      console.error('Erro ao processar modal:', error);
      await interaction.editReply({
        content: '❌ Erro ao processar o formulário.',
        ephemeral: true
      }).catch(() => {});
    }
  },

  async handleButton(interaction) {
    try {
      if (interaction.customId === 'cancel_ausencia') {
        await interaction.update({
          content: '❌ Registro de ausência cancelado.',
          embeds: [],
          components: []
        });
        return;
      }

      if (interaction.customId.startsWith('confirm_ausencia_')) {
        await interaction.deferUpdate();

        const tempId = interaction.customId.replace('confirm_ausencia_', '');
        
        // Buscar dados temporários
        const tempData = pendingAusencias.get(tempId);
        
        if (!tempData) {
          return interaction.editReply({
            content: '❌ Sessão expirada! Use `/ausencia` novamente.',
            embeds: [],
            components: []
          });
        }

        const returnDate = new Date(tempData.returnDate);
        const motivo = tempData.motivo;
        const member = interaction.member;
        const ausenciaRole = interaction.guild.roles.cache.get(config.ausenciaRoleId);

        // Limpar dados temporários
        pendingAusencias.delete(tempId);

        // Adicionar cargo de ausência
        await member.roles.add(ausenciaRole).catch(console.error);

        // Salvar no banco de dados
        const db = interaction.client.db;
        await db.run(`
          INSERT INTO ausencias (user_id, username, guild_id, start_date, return_date, reminded)
          VALUES (?, ?, ?, ?, ?, 0)
        `, [
          member.id,
          member.user.username,
          interaction.guild.id,
          Date.now(),
          returnDate.getTime()
        ]);

        // Embed de confirmação (privado)
        const confirmEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Ausência Registrada')
          .setDescription('Sua ausência foi registrada com sucesso!')
          .addFields(
            { name: '📅 Retorno Previsto', value: `<t:${Math.floor(returnDate.getTime() / 1000)}:F>`, inline: false },
            { name: '📝 Motivo', value: motivo, inline: false },
            { name: '🔔 Lembrete', value: 'Você receberá um lembrete 1 dia antes', inline: false },
            { name: '🎖️ Cargo', value: `${ausenciaRole} adicionado`, inline: false }
          )
          .setFooter({ text: 'Bom descanso! Esperamos seu retorno.' })
          .setTimestamp();

        await interaction.editReply({
          embeds: [confirmEmbed],
          components: []
        });

        // Embed para o canal de log
        if (config.channelLogAusencia) {
          const logChannel = interaction.guild.channels.cache.get(config.channelLogAusencia);
          if (logChannel) {
            const diffTime = returnDate - Date.now();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const logEmbed = new EmbedBuilder()
              .setColor('#FFA500')
              .setAuthor({ 
                name: member.user.username, 
                iconURL: member.user.displayAvatarURL() 
              })
              .setTitle('📋 Nova Ausência Registrada')
              .addFields(
                { name: '👤 Membro', value: `${member} (${member.id})`, inline: true },
                { name: '📅 Data de Retorno', value: `<t:${Math.floor(returnDate.getTime() / 1000)}:F>`, inline: false },
                { name: '⏳ Duração', value: `${diffDays} dia(s)`, inline: true },
                { name: '🕐 Registrado em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: '📝 Motivo', value: motivo, inline: false }
              )
              .setThumbnail(member.user.displayAvatarURL())
              .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] });
          }
        }

        // Agendar verificação de retorno e lembrete
        scheduleChecks(interaction.client, member.id, interaction.guild.id, returnDate);
      }
    } catch (error) {
      console.error('Erro ao processar botão de ausência:', error);
      await interaction.reply({
        content: '❌ Erro ao processar a confirmação.',
        ephemeral: true
      }).catch(() => {});
    }
  }
};

// Função para parsear data
function parseDate(input) {
  const patterns = [
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/ // DD/MM/YYYY HH:MM
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1; // Mês começa em 0
      const year = parseInt(match[3]);
      const hour = match[4] ? parseInt(match[4]) : 23;
      const minute = match[5] ? parseInt(match[5]) : 59;

      const date = new Date(year, month, day, hour, minute);

      // Validar se a data é válida
      if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
        return { valid: false, error: 'Data inválida (dia/mês/ano incorretos)' };
      }

      return { valid: true, date };
    }
  }

  return { valid: false, error: 'Formato inválido. Use: DD/MM/AAAA ou DD/MM/AAAA HH:MM' };
}

// Função para agendar verificações
function scheduleChecks(client, userId, guildId, returnDate) {
  const now = Date.now();
  const returnTime = returnDate.getTime();
  const reminderTime = returnTime - 86400000; // 24 horas antes

  // Agendar lembrete (24h antes)
  if (reminderTime > now) {
    setTimeout(async () => {
      await sendReminder(client, userId, guildId, returnDate);
    }, reminderTime - now);
  }

  // Agendar remoção do cargo (na data de retorno)
  if (returnTime > now) {
    setTimeout(async () => {
      await removeAusencia(client, userId, guildId);
    }, returnTime - now);
  }
}

// Função para enviar lembrete
async function sendReminder(client, userId, guildId, returnDate) {
  try {
    const user = await client.users.fetch(userId);
    const db = client.db;

    // Verificar se já foi lembrado
    const row = await db.get('SELECT reminded FROM ausencias WHERE user_id = ? AND guild_id = ? AND reminded = 0', [userId, guildId]);
    
    if (!row) return; // Já foi removido ou lembrado

    const reminderEmbed = new EmbedBuilder()
      .setColor('#FFFF00')
      .setTitle('🔔 Lembrete de Retorno')
      .setDescription('Sua ausência está chegando ao fim!')
      .addFields(
        { name: '📅 Data de Retorno', value: `<t:${Math.floor(returnDate.getTime() / 1000)}:F>`, inline: false },
        { name: '⚠️ Importante', value: 'Prepare-se para retornar às atividades militares.', inline: false }
      )
      .setFooter({ text: 'Seu cargo será removido automaticamente na data de retorno' })
      .setTimestamp();

    await user.send({ embeds: [reminderEmbed] }).catch(console.error);

    // Marcar como lembrado
    await db.run('UPDATE ausencias SET reminded = 1 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);

  } catch (error) {
    console.error('Erro ao enviar lembrete:', error);
  }
}

// Função para remover ausência
async function removeAusencia(client, userId, guildId) {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const ausenciaRole = guild.roles.cache.get(config.ausenciaRoleId);
    if (!ausenciaRole) return;

    // Remover cargo
    if (member.roles.cache.has(ausenciaRole.id)) {
      await member.roles.remove(ausenciaRole);
    }

    // Remover do banco de dados
    const db = client.db;
    await db.run('DELETE FROM ausencias WHERE user_id = ? AND guild_id = ?', [userId, guildId]);

    // Notificar usuário
    const welcomeBackEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🎉 Bem-vindo de volta!')
      .setDescription('Sua ausência terminou e você já pode retornar às atividades militares.')
      .addFields(
        { name: '✅ Status', value: 'Cargo de ausência removido', inline: false },
        { name: '🎖️ Próximos Passos', value: 'Retorne às suas funções normalmente', inline: false }
      )
      .setTimestamp();

    await member.send({ embeds: [welcomeBackEmbed] }).catch(console.error);

    // Log de retorno
    if (config.channelLogAusencia) {
      const logChannel = guild.channels.cache.get(config.channelLogAusencia);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Ausência Finalizada')
          .setDescription(`${member} retornou das atividades`)
          .addFields(
            { name: '👤 Membro', value: `${member} (${member.id})`, inline: true },
            { name: '🕐 Retorno', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
          )
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
      }
    }

  } catch (error) {
    console.error('Erro ao remover ausência:', error);
  }
}

// Exportar funções auxiliares para uso no ready event
export { scheduleChecks, removeAusencia, sendReminder };