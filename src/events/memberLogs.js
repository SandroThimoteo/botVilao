import { EmbedBuilder } from "discord.js";
import config from "../config.js";

// 👉 Banner fixo aqui
const bannerImage = "https://media.discordapp.net/attachments/1428418733734625315/1428427557455532142/Group_2.png?ex=68f47094&is=68f31f14&hm=1fefcde46c3fd022ddd0aa31a65af0aba56686945983f97306b191c77414ed40&=&format=webp&quality=lossless&width=900&height=131";

export function registerMemberLogs(client) {
  // Evento: entrada
  client.on("guildMemberAdd", async (member) => {
    try {
      const channel = member.guild.channels.cache.get(config.channelEnter);
      if (!channel) return console.error("❌ Canal de entrada não encontrado!");

      const totalMembros = member.guild.memberCount;

      const embed = new EmbedBuilder()
        .setTitle("📥 ENTROU NO SERVIDOR")
        .setColor("Green")
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: "👤 Membro", value: `${member}`, inline: false },
          { name: "🆔 ID da Conta", value: member.id, inline: false },
          { name: "📅 Entrada", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
          { name: "👥 Membros", value: `${totalMembros}`, inline: false }
        )
        .setImage(bannerImage)
        .setFooter({ text: `ID do membro: ${member.id}` })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error("Erro ao logar entrada:", err);
    }
  });

  // Evento: saída
  client.on("guildMemberRemove", async (member) => {
    try {
      const channel = member.guild.channels.cache.get(config.channelExit);
      if (!channel) return console.error("❌ Canal de saída não encontrado!");

      const totalMembros = member.guild.memberCount;

      // 👉 Identificar se foi banido ou expulso
      let motivoSaida = "Saiu voluntariamente";
      try {
        const fetchedLogs = await member.guild.fetchAuditLogs({ limit: 1 });
        const logEntry = fetchedLogs.entries.first();

        if (logEntry) {
          if (logEntry.action === 20 && logEntry.target.id === member.id) {
            // MEMBER_KICK
            motivoSaida = `Expulso por ${logEntry.executor.tag}`;
          } else if (logEntry.action === 22 && logEntry.target.id === member.id) {
            // MEMBER_BAN_ADD
            motivoSaida = `Banido por ${logEntry.executor.tag}`;
          }
        }
      } catch (err) {
        console.error("Erro ao buscar audit log:", err);
      }

      // 👉 Roles do usuário antes de sair
      const roles = member.roles.cache
        .filter(r => r.id !== member.guild.id)
        .map(r => r.toString())
        .join(", ") || "Nenhum";

      const embed = new EmbedBuilder()
        .setTitle("📤 SAIU DO SERVIDOR")
        .setColor("Red")
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: "👤 Membro", value: `${member.user.tag}`, inline: false },
          { name: "🆔 ID da Conta", value: member.id, inline: false },
          { name: "🏷️ Apelido", value: member.nickname ? member.nickname : "Nenhum", inline: false },
          { name: "📅 Entrada", value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>` : "Desconhecida", inline: false },
          { name: "📅 Saída", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
          { name: "⚖️ Motivo", value: motivoSaida, inline: false },
          { name: "🎭 Cargos", value: roles, inline: false },
          { name: "👥 Membros", value: `${totalMembros}`, inline: false }
        )
        .setImage(bannerImage)
        .setFooter({ text: `ID do membro: ${member.id}` })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error("Erro ao logar saída:", err);
    }
  });
}
