import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder
} from "discord.js";
import config from "../config.js";

export default {
  data: new SlashCommandBuilder()
    .setName("acao")
    .setDescription("Registrar uma ação (missão/evento)"),

  async execute(interaction) {
    const policeRole = config.policeId;
    if (!interaction.member.roles.cache.has(policeRole)) {
      return interaction.reply({
        content: "❌ Você não tem permissão para usar este comando.",
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("acao_modal")
      .setTitle("Registrar Ação");

    const nomeInput = new TextInputBuilder()
      .setCustomId("acao_nome")
      .setLabel("Nome da Ação")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(nomeInput));
    await interaction.showModal(modal);
  }
};

// -------------------- HANDLERS --------------------
export async function handleModalSubmit(interaction) {
  if (interaction.customId === "acao_modal") {
    const nomeAcao = interaction.fields.getTextInputValue("acao_nome");

    interaction.client.acaoData = { nome: nomeAcao };

    const comandanteMenu = new UserSelectMenuBuilder()
      .setCustomId("acao_comandante")
      .setPlaceholder("👤 Selecione o comandante da ação")
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(comandanteMenu);

    await interaction.reply({
      content: `🏷️ Nome da Ação: **${nomeAcao}**\nAgora selecione o **Comandante**:`,
      components: [row],
      ephemeral: true
    });
  }
}

export async function handleUserSelection(interaction) {
  if (interaction.customId === "acao_comandante") {
    const comandanteId = interaction.values[0];
    interaction.client.acaoData.comandante = comandanteId;

    // Participantes com MentionableSelectMenu (usuários ou cargos)
    const participantesMenu = new MentionableSelectMenuBuilder()
      .setCustomId("acao_participantes")
      .setPlaceholder("👥 Selecione os participantes (usuários ou cargos)")
      .setMinValues(1)
      .setMaxValues(10);

    const row = new ActionRowBuilder().addComponents(participantesMenu);

    await interaction.update({
      content: `👤 Comandante: <@${comandanteId}>\nAgora selecione os **Participantes** (usuários ou cargos):`,
      components: [row]
    });
  } else if (interaction.customId === "acao_participantes") {
    interaction.client.acaoData.participantes = interaction.values;

    const resultadoMenu = new StringSelectMenuBuilder()
      .setCustomId("acao_resultado")
      .setPlaceholder("📊 Resultado da Ação")
      .addOptions([
        { label: "✅ Vitória", value: "Vitória" },
        { label: "❌ Derrota", value: "Derrota" }
      ]);

    const row = new ActionRowBuilder().addComponents(resultadoMenu);

    await interaction.update({
      content: `👥 Participantes selecionados!\nAgora escolha o **Resultado**:`,
      components: [row]
    });
  }
}

export async function handleSelectMenuInteraction(interaction) {
  if (interaction.customId === "acao_resultado") {
    const resultado = interaction.values[0];
    interaction.client.acaoData.resultado = resultado;

    if (!interaction.client.acaoStats) {
      interaction.client.acaoStats = { vitorias: 0, derrotas: 0, total: 0 };
    }

    if (resultado === "Vitória") {
      interaction.client.acaoStats.vitorias++;
    } else {
      interaction.client.acaoStats.derrotas++;
    }
    interaction.client.acaoStats.total++;

    const total = interaction.client.acaoStats.total;
    const pctVitorias = ((interaction.client.acaoStats.vitorias / total) * 100).toFixed(1);
    const pctDerrotas = ((interaction.client.acaoStats.derrotas / total) * 100).toFixed(1);

    const logChannel = interaction.guild.channels.cache.get(config.channelLogAcao);
    if (!logChannel) {
      return interaction.reply({ content: "❌ Canal de log não encontrado.", ephemeral: true });
    }

    const { nome, comandante, participantes } = interaction.client.acaoData;

    const embedAcao = new EmbedBuilder()
      .setAuthor({ 
        name: "Batalhão de Policia Militar Villa | Registro de Ação", 
        iconURL: "https://cdn.discordapp.com/attachments/1419333371615514654/1419425491684954112/Group_2.png"
      })
      .setTitle(" ")
      .setDescription(
        `# ${resultado === "Vitória" ? "🎖️" : "⚔️"} ${nome}\n\n` +
        `**Comandante da Operação**\n` +
        `<@${comandante}>\n\n` +
        `**Efetivo Mobilizado**\n` +
        `${participantes.map(p => `• <@${p}>`).join("\n")}\n\n` +
        `> ${resultado === "Vitória" ? "✅" : "❌"} **Resultado:** ${resultado}`
      )
      .setColor(resultado === "Vitória" ? "#22c55e" : "#ef4444")
      .setImage("https://cdn.discordapp.com/attachments/1419333371615514654/1419425491684954112/Group_2.png")
      .setFooter({ 
        text: `Polícia Militar APP • Hoje às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        iconURL: "https://cdn.discordapp.com/attachments/1419333371615514654/1419425491684954112/Group_2.png"
      })
      .setTimestamp();

    await logChannel.send({ embeds: [embedAcao] });

    if (interaction.client.acaoStats.total % 10 === 0) {
      const embedStats = new EmbedBuilder()
        .setAuthor({ 
          name: "Batalhão de Policia Militar Villa | Estatísticas", 
          iconURL: "https://cdn.discordapp.com/attachments/1419333371615514654/1419425491684954112/Group_2.png"
        })
        .setTitle(" ")
        .setDescription(
          `# 📊 RELATÓRIO DE DESEMPENHO\n` +
          `**Análise das últimas ${total} operações registradas**\n\n` +
          `### Resultados Consolidados\n` +
          `> ✅ **Vitórias:** ${interaction.client.acaoStats.vitorias} operações (${pctVitorias}%)\n` +
          `> ❌ **Derrotas:** ${interaction.client.acaoStats.derrotas} operações (${pctDerrotas}%)\n` +
          `> 📈 **Total de Ações:** ${total} operações\n\n` +
          `> 🎯 **Taxa de Sucesso:** ${pctVitorias}%`
        )
        .setColor("#3b82f6")
        .setImage("https://cdn.discordapp.com/attachments/1419333371615514654/1419425491684954112/Group_2.png")
        .setFooter({ 
          text: "Polícia Militar APP • Relatório Automático",
          iconURL: "https://cdn.discordapp.com/attachments/1419333371615514654/1419425491684954112/Group_2.png"
        })
        .setTimestamp();

      await logChannel.send({ embeds: [embedStats] });
    }

    await interaction.update({ content: "✅ Ação registrada com sucesso!", components: [] });
  }
}

// -------------------- LISTENER INTERNO --------------------
export function registerAcaoListeners(client) {
  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
      } else if (interaction.isUserSelectMenu() || interaction.isMentionableSelectMenu()) {
        await handleUserSelection(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await handleUserSelection(interaction);
        await handleSelectMenuInteraction(interaction);
      }
    } catch (err) {
      console.error(err);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "❌ Ocorreu um erro ao processar a interação.", ephemeral: true });
        } else {
          await interaction.reply({ content: "❌ Ocorreu um erro ao processar a interação.", ephemeral: true });
        }
      } catch (e) {
        console.error("Falha ao enviar resposta de erro:", e);
      }
    }
  });
}