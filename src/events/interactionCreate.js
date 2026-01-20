import { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, UserSelectMenuBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

export const name = 'interactionCreate';
export const once = false;

export default async function interactionCreate(client, interaction) {
  // Função auxiliar para gerar permissões de staff com base na categoria
  const getCategoryStaffOverwrites = (roleIds) => {
    if (!roleIds || roleIds.length === 0) return [];
    return roleIds.map(id => ({
      id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
    }));
  };

  // ====== SELECT MENU ======
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticketSelect') {
    const categoryName = interaction.values[0];
    const guild = interaction.guild;
    const category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === categoryName);
    if (!category) return interaction.reply({ content: 'Categoria não encontrada.', ephemeral: true });

    // Pega os cargos específicos da categoria do config
    const categoryRoles = client.config.ticketCategoryRoles[categoryName] || [];

    const overwrites = [
      { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ...getCategoryStaffOverwrites(categoryRoles)
    ];

    const ticketChannel = await guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: overwrites
    });

    await client.db.createTicket(interaction.guild.id, ticketChannel.id, interaction.user.id, categoryName);

    const closeButton = new ButtonBuilder().setCustomId('closeTicket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger);
    const addButton = new ButtonBuilder().setCustomId('addMember').setLabel('Adicionar Membro').setStyle(ButtonStyle.Secondary);
    const removeButton = new ButtonBuilder().setCustomId('removeMember').setLabel('Remover Membro').setStyle(ButtonStyle.Secondary);
    const notifyButton = new ButtonBuilder().setCustomId('notifyOwner').setLabel('Avisar Dono').setStyle(ButtonStyle.Primary);
    const renameButton = new ButtonBuilder().setCustomId('renameTicket').setLabel('Renomear').setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(closeButton, addButton, removeButton, notifyButton, renameButton);

    const embed = new EmbedBuilder()
      .setColor('#ff0048')
      .setTitle('📩 ATENDIMENTO VILLA')
      .setDescription(`👋 Olá <@${interaction.user.id}>, bem-vindo ao seu ticket de **${categoryName}**.`)
      .addFields(
        { name: '📂 Categoria do Atendimento', value: categoryName, inline: false },
        { name: '📝 Assunto do Ticket', value: categoryName, inline: false }
      )
      .setFooter({ text: 'Villa - Sistema de Tickets' })
      .setTimestamp();

    await ticketChannel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ Ticket criado: ${ticketChannel}`, ephemeral: true });
  }

  // ====== BOTÕES ======
  if (interaction.isButton()) {
    const channel = interaction.channel;

    // ====== FECHAR ======
    if (interaction.customId === 'closeTicket') {
      await interaction.reply({ content: '⏳ Este ticket será fechado em **5 segundos**...', ephemeral: true });
      setTimeout(async () => {
        const messages = await channel.messages.fetch({ limit: 100 });
        const transcript = messages.map(m => `${m.author.tag}: ${m.content}`).reverse().join('\n');

        const dir = path.join(process.cwd(), 'data', 'transcripts');
        fs.mkdirSync(dir, { recursive: true });

        const filePath = path.join(dir, `ticket-${channel.id}-${Date.now()}.txt`);
        fs.writeFileSync(filePath, transcript, 'utf8');

        await client.db.closeTicket(channel.guild.id, channel.id, filePath);
        await channel.delete();
      }, 5000);
    }

    // ====== REABRIR ======
    if (interaction.customId.startsWith('reopenTicket_')) {
      const [, oldChannelId, userId] = interaction.customId.split('_');
      const guild = interaction.guild;

      const ticketData = await client.db.getTicket(guild.id, oldChannelId);
      if (!ticketData) {
        return interaction.reply({ content: 'Não foi possível encontrar os dados deste ticket.', ephemeral: true });
      }

      // Pega os cargos específicos da categoria do ticket a ser reaberto
      const categoryRoles = client.config.ticketCategoryRoles[ticketData.category] || [];

      const overwrites = [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ...getCategoryStaffOverwrites(categoryRoles)
      ];

      const newChannel = await guild.channels.create({
        name: `ticket-reopened-${userId}`,
        type: ChannelType.GuildText,
        parent: ticketData.category ? (guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === ticketData.category)?.id || null) : null,
        permissionOverwrites: overwrites
      });

      await client.db.reopenTicket(guild.id, oldChannelId, newChannel.id);
      await interaction.reply({ content: `♻️ Ticket reaberto em ${newChannel}`, ephemeral: true });
    }
  

    // ====== GERENCIAMENTO STAFF ======
    if (interaction.customId === 'notifyOwner') {
      const isStaff = client.config.staffRoleId.some(roleId => interaction.member.roles.cache.has(roleId));
      if (!isStaff) {
        return interaction.reply({ content: 'Somente staff pode usar isso.', ephemeral: true });
      }

      const ticketData = await client.db.getTicket(channel.guild.id, channel.id);
      if (!ticketData) return interaction.reply({ content: 'Erro: dono do ticket não encontrado.', ephemeral: true });

      const user = await channel.guild.members.fetch(ticketData.userId).catch(() => null);
      if (!user) return interaction.reply({ content: 'Usuário não encontrado.', ephemeral: true });

      try {
        await user.send(`📢 Olá! Seu ticket está em análise por nossa equipe, em breve entraremos em contato.`);
        return interaction.reply({ content: '✅ Mensagem automática enviada em DM para o dono do ticket.', ephemeral: true });
      } catch {
        return interaction.reply({ content: 'Não foi possível enviar DM ao usuário.', ephemeral: true });
      }
    }

    // ====== ADICIONAR/REMOVER/RENOMEAR ======
    if (interaction.customId === 'addMember') {
      const isStaff = client.config.staffRoleId.some(roleId => interaction.member.roles.cache.has(roleId));
      if (!isStaff) {
        return interaction.reply({ content: 'Somente staff pode usar isso.', ephemeral: true });
      }

      const row = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId('addMemberSelect')
          .setPlaceholder('Selecione quem adicionar ao ticket')
          .setMinValues(1)
          .setMaxValues(1)
      );

      return interaction.reply({
        content: 'Escolha o usuário que deseja adicionar:',
        components: [row],
        ephemeral: true
      });
    }

    if (interaction.customId === 'removeMember') {
      const isStaff = client.config.staffRoleId.some(roleId => interaction.member.roles.cache.has(roleId));
      if (!isStaff) {
        return interaction.reply({ content: 'Somente staff pode usar isso.', ephemeral: true });
      }

      const row = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId('removeMemberSelect')
          .setPlaceholder('Selecione quem remover do ticket')
          .setMinValues(1)
          .setMaxValues(1)
      );

      return interaction.reply({
        content: 'Escolha o usuário que deseja remover:',
        components: [row],
        ephemeral: true
      });
    }

    if (interaction.customId === 'renameTicket') {
      const modalData = {
        id: 'renameTicketModal',
        title: 'Renomear Ticket',
        field: { id: 'newName', label: 'Novo nome do ticket', style: 1 }
      };

      await interaction.showModal({
        customId: modalData.id,
        title: modalData.title,
        components: [{
          type: 1,
          components: [{
            type: 4,
            customId: modalData.field.id,
            label: modalData.field.label,
            style: modalData.field.style,
            required: true
          }]
        }]
      });
    }
  }

  // ====== USER SELECT MENU ======
  if (interaction.isUserSelectMenu()) {
    const channel = interaction.channel;
    const memberId = interaction.values[0];

    if (interaction.customId === 'addMemberSelect') {
      try {
        await channel.permissionOverwrites.edit(memberId, { ViewChannel: true, SendMessages: true });
        return interaction.reply({ content: `✅ <@${memberId}> adicionado ao ticket.`, ephemeral: true });
      } catch {
        return interaction.reply({ content: 'Erro ao adicionar usuário.', ephemeral: true });
      }
    }

    if (interaction.customId === 'removeMemberSelect') {
      try {
        await channel.permissionOverwrites.delete(memberId);
        return interaction.reply({ content: `❌ <@${memberId}> removido do ticket.`, ephemeral: true });
      } catch {
        return interaction.reply({ content: 'Erro ao remover usuário.', ephemeral: true });
      }
    }
  }

  // ====== MODAIS ======
  if (interaction.isModalSubmit()) {
    const channel = interaction.channel;

    if (interaction.customId === 'renameTicketModal') {
      const newName = interaction.fields.getTextInputValue('newName');
      try {
        await channel.setName(newName);
        return interaction.reply({ content: `✏️ Ticket renomeado para **${newName}**.`, ephemeral: true });
      } catch {
        return interaction.reply({ content: 'Erro ao renomear o ticket.', ephemeral: true });
      }
    }
  }
}