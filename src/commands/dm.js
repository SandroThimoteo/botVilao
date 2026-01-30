import {
    SlashCommandBuilder,
    ActionRowBuilder,
    UserSelectMenuBuilder
} from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName("dm")
        .setDescription("Envia DM para vários usuários usando select menu")
        .addStringOption(o =>
            o.setName("mensagem")
                .setDescription("Mensagem a ser enviada")
                .setRequired(true)
        ),

    async execute(interaction) {
        const mensagem = interaction.options.getString("mensagem");

        const menu = new UserSelectMenuBuilder()
            .setCustomId("dm_select")
            .setPlaceholder("Selecione os usuários")
            .setMinValues(1)
            .setMaxValues(25);

        const row = new ActionRowBuilder().addComponents(menu);

        await interaction.reply({
            content: "👥 Selecione os usuários que receberão a DM:",
            components: [row],
            ephemeral: true
        });

        // salva a mensagem temporariamente
        interaction.client.dmMessages ??= new Map();
        interaction.client.dmMessages.set(interaction.user.id, mensagem);
    }
};
