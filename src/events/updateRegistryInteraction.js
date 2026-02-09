import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    RoleSelectMenuBuilder,
    UserSelectMenuBuilder
} from 'discord.js';
import config from '../config.js';

// Armazena temporariamente o usuário selecionado
const tempUserSelection = new Map();

// Armazena temporariamente as remoções pendentes de aprovação
const pendingRemovals = new Map();

// Armazena temporariamente as aprovações de cursos pendentes
const pendingCourseApprovals = new Map();

// Mapeamento de IDs de Cargo para Abreviações
// O usuário deve preencher com os IDs reais dos cargos no Discord.
const ROLE_ABBREVIATIONS = {
    "1428418512275243192": "SD",
    "1428418511339782227": "CB",
    "1428418510610108597": "3º SGT",
    "1428418509398081698": "2º SGT",
    "1428418508336926820": "1º SGT",
    "1428418507044945950": "STEN",
    "1428418506042638518": "2ºTEN",
    "1428418504469516511": "1ºTEN",
};

// Função para obter a abreviação usando o ID do cargo
function getRoleAbbreviation(roleId, roleName) {
    // 1. Tenta buscar a abreviação pelo ID (forma mais precisa)
    const abbreviation = ROLE_ABBREVIATIONS[roleId];
    if (abbreviation) {
        return abbreviation;
    }

    // 2. Se não encontrar pelo ID, usa o nome do cargo como fallback (com limpeza)
    const cleanName = roleName.replace(/[\u30FB\u00B7\u2022]/g, '').trim();
    return cleanName;
}

// -------------------- PAINEL --------------------
async function sendUpdatePanel(client) {
    const channel = client.channels.cache.get(config.channelIdAtt);
    if (!channel) {
        console.error('❌ Canal de atualização não encontrado!');
        return;
    }

    const embed = new EmbedBuilder()
        .setAuthor({
            name: "Batalhão de Policia Militar Villa 2025",
        })
        .setTitle(" ")
        .setDescription(
            "# ATUALIZAÇÃO DE REGISTRO\n" +
            "Selecione abaixo a opção que melhor atende sua necessidade.\n" +
            "Nossa equipe processará sua solicitação o mais rápido possível.\n\n" +
            "> <:atualizar:1422309803002298398> **Atualizar Dados** - Atualize informações básicas do registro\n" +
            "> <:estrela:1422308556035723394> **Promoção** - Solicite atualização de patente\n" +
            "> <:membros:1422308560053735444> **Unidade** - Solicite transferência ou designação\n" +
            "> <:curso:1422311480727965726> **Curso** - Solicite certificação de curso\n\n" +
            "⚠️ Certifique-se de ter todas as informações necessárias antes de prosseguir."
        )
        .setColor("#131416")
        .setImage("https://cdn.discordapp.com/attachments/1428418733734625315/1428427557455532142/Group_2.png?ex=68f27654&is=68f124d4&hm=8cd33b7cbd224f9b0a09a2ce5471eae54b1783deae03127458ae1de7d157cee6&")
        .setFooter({
            text: "Polícia Militar APP • " + new Date().toLocaleDateString("pt-BR"),
            iconURL: "https://cdn.discordapp.com/attachments/1428418733734625315/1428427890529275944/BPMV.png?ex=68f276a4&is=68f12524&hm=68f254205a3f65ede78297ec501c17df084c640f312555b951d7179a7aeb6a36&"
        })
        .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("update_type_select")
        .setPlaceholder("Selecione o tipo de atualização")
        .addOptions([
            {
                label: "Atualizar Registro",
                description: "Atualize suas informações básicas",
                value: "update_basic_info",
                emoji: "<:atualizar:1422309803002298398>"
            },
            {
                label: "Promoção de Patente",
                description: "Solicite atualização de patente",
                value: "update_rank",
                emoji: "<:estrela:1422308556035723394>"
            },
            {
                label: "Solicitar Unidade",
                description: "Transferência ou designação de unidade",
                value: "update_unit",
                emoji: "<:membros:1422308560053735444>"
            },
            {
                label: "Solicitar Curso",
                description: "Certificação de conclusão de curso",
                value: "update_course",
                emoji: "<:curso:1422311480727965726>"
            },
            {
                label: "Retirar Curso",
                description: "Retirar um ou mais cursos",
                value: "remove_course",
                emoji: "<:curso:1422311480727965726>"
            },
            {
                label: "Retirar Unidade",
                description: "Retirar a unidade atribuída",
                value: "remove_unit",
                emoji: "<:membros:1422308560053735444>"
            }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    // VERIFICAÇÃO MELHORADA: Checar se já existe qualquer mensagem no canal
    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);

    if (messages && messages.size > 0) {
        console.log(`[UpdateRegistry] Canal ${channel.name} já possui mensagens. Não será enviada nova embed.`);
        console.log(`[UpdateRegistry] Total de mensagens encontradas: ${messages.size}`);

        // Apenas atualiza os componentes se encontrar a mensagem do bot
        const botMessage = messages.find(m =>
            m.author.id === client.user.id &&
            m.embeds.length > 0 &&
            m.embeds[0].description?.includes("🔄 ATUALIZAÇÃO DE REGISTRO")
        );

        if (botMessage) {
            await botMessage.edit({ embeds: [embed], components: [row] }).catch(err => {
                console.error("[UpdateRegistry] Falha ao atualizar componentes:", err);
            });
            console.log("[UpdateRegistry] Componentes da mensagem existente atualizados.");
        }

        return; // IMPORTANTE: Para aqui, não envia nova mensagem
    }

    // Canal está vazio, pode enviar a embed
    console.log(`[UpdateRegistry] Canal ${channel.name} está vazio. Enviando embed de atualização...`);

    await channel.send({ embeds: [embed], components: [row] });
    console.log("[UpdateRegistry] Painel de atualização enviado com sucesso.");
}

// -------------------- HANDLERS --------------------
async function handleButtonInteraction(interaction) {
    // IMPORTANTE: Sempre defer ou reply imediatamente
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => { });
    }

    if (interaction.customId.startsWith("accept_")) {
        // Verifica se é uma aprovação de cursos (accept_course_)
        if (interaction.customId.startsWith("accept_course_")) {
            const approvalId = interaction.customId.replace("accept_course_", "");
            
            if (!pendingCourseApprovals.has(approvalId)) {
                await interaction.deferUpdate().catch(() => { });
                return;
            }

            const courseData = pendingCourseApprovals.get(approvalId);
            const member = await interaction.guild.members.fetch(courseData.userId).catch(() => null);

            if (!member) {
                await interaction.deferUpdate().catch(() => { });
                const embed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setFooter({ text: `❌ Erro: Usuário não encontrado` })
                    .setColor("Red");
                await interaction.editReply({ embeds: [embed], components: [] }).catch(() => { });
                return;
            }

            try {
                await member.roles.add(courseData.roleIds, 'Curso aprovado');
                console.log(`[UpdateRegistry] Approved courses: ${courseData.roleIds.join(', ')} to ${member.id}`);

                pendingCourseApprovals.delete(approvalId);

                await interaction.deferUpdate().catch(() => { });
                const embed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setFooter({ text: `✅ Aprovado por ${interaction.user.tag}` })
                    .setColor("Green");
                await interaction.editReply({ embeds: [embed], components: [] }).catch(() => { });

                // Notifica o usuário
                try {
                    const roleNames = courseData.roleIds.map(id => interaction.guild.roles.cache.get(id)?.name).join(", ");
                    await member.send(`✅ Seu(s) curso(s) **${roleNames}** foi(foram) aprovado(s)!`);
                } catch (e) { }
            } catch (err) {
                console.error(`[UpdateRegistry] Erro ao aprovar cursos:`, err);
                await interaction.deferUpdate().catch(() => { });
                const embed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setFooter({ text: `❌ Erro ao processar aprovação` })
                    .setColor("Red");
                await interaction.editReply({ embeds: [embed], components: [] }).catch(() => { });
            }
            return;
        }

        // Verifica se é uma remoção (accept_removal_)
        if (interaction.customId.startsWith("accept_removal_")) {
            const removalId = interaction.customId.replace("accept_removal_", "");
            
            if (!pendingRemovals.has(removalId)) {
                await interaction.deferUpdate().catch(() => { });
                return;
            }

            const removalData = pendingRemovals.get(removalId);
            const member = await interaction.guild.members.fetch(removalData.userId).catch(() => null);

            if (!member) {
                await interaction.deferUpdate().catch(() => { });
                const embed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setFooter({ text: `❌ Erro: Usuário não encontrado` })
                    .setColor("Red");
                await interaction.editReply({ embeds: [embed], components: [] }).catch(() => { });
                return;
            }

            try {
                if (removalData.type === "course") {
                    await member.roles.remove(removalData.roleIds, 'Retirada de curso aprovada');
                    console.log(`[UpdateRegistry] Approved course removal: ${removalData.roleIds.join(', ')} from ${member.id}`);
                } else if (removalData.type === "unit") {
                    await member.roles.remove(removalData.roleIds[0], 'Retirada de unidade aprovada');
                    console.log(`[UpdateRegistry] Approved unit removal: ${removalData.roleIds[0]} from ${member.id}`);
                }

                pendingRemovals.delete(removalId);

                await interaction.deferUpdate().catch(() => { });
                const embed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setFooter({ text: `✅ Aprovado por ${interaction.user.tag}` })
                    .setColor("Green");
                await interaction.editReply({ embeds: [embed], components: [] }).catch(() => { });

                // Notifica o usuário
                try {
                    const roleNames = removalData.roleIds.map(id => interaction.guild.roles.cache.get(id)?.name).join(", ");
                    await member.send(`✅ Sua remoção de **${roleNames}** foi aprovada!`);
                } catch (e) { }
            } catch (err) {
                console.error(`[UpdateRegistry] Erro ao processar remoção:`, err);
                await interaction.deferUpdate().catch(() => { });
                const embed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setFooter({ text: `❌ Erro ao processar remoção` })
                    .setColor("Red");
                await interaction.editReply({ embeds: [embed], components: [] }).catch(() => { });
            }
            return;
        }

        const [, ...parts] = interaction.customId.split("_");
        const userId = parts[parts.length - 1];
        const roleId = parts[parts.length - 2];

        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        const role = interaction.guild.roles.cache.get(roleId);

        if (!member || !role) {
            return interaction.followUp({ content: "❌ Usuário ou cargo não encontrado.", ephemeral: true }).catch(() => { });
        }

        // Detectar a categoria do cargo
        let category = null;
        if (config.patenteRoleIds.includes(roleId)) category = "patenteRoleIds";
        else if (config.unidadeRoleIds.includes(roleId)) category = "unidadeRoleIds";
        else if (config.cursoRoleIds.includes(roleId)) category = "cursoRoleIds";

        // Remove todos os cargos daquela categoria antes de adicionar o novo
        // EXCEÇÃO: Para cursos, não remove os existentes (permite múltiplos)
        if (category && category !== "cursoRoleIds") {
            // Calcula apenas os cargos que o membro realmente possui e que pertencem
            // à categoria configurada, excluindo o cargo que será adicionado.
            const categoryIds = config[category].map(id => id.toString());
            const rolesToRemove = member.roles.cache
                .filter(r => categoryIds.includes(r.id) && r.id !== roleId)
                .map(r => r.id);

            if (rolesToRemove.length > 0) {
                try {
                    await member.roles.remove(rolesToRemove, 'Atualização de registro - substituição de cargo');
                    console.log(`[UpdateRegistry] Removed roles ${rolesToRemove.join(', ')} from member ${member.id}`);
                } catch (err) {
                    console.error(`[UpdateRegistry] Falha ao remover cargos do membro ${member.id}:`, err);
                }
            }
        }

        // Adiciona o cargo solicitado
        await member.roles.add(role).catch(() => null);

        // Lógica para atualizar o apelido (nickname)
        // O apelido será no formato: "Cargo | Nome Sobrenome #Passaporte"

        // NOTA: Assumindo que a função 'getRegistryData' existe e busca as informações
        // do usuário (nome, sobrenome, passaporte) em um banco de dados ou cache.
        // Esta função 'getRegistryData' PRECISA ser implementada/importada
        // em outro lugar, pois não está visível neste arquivo.

        // Exemplo de como ficaria a chamada (com a função fictícia 'getRegistryData'):
        // const entry = await getRegistryData(userId);
        // if (entry) {
        //     const newNickname = `${role.name} | ${entry.nome} ${entry.sobrenome} #${entry.passaporte}`;
        //     await member.setNickname(newNickname).catch(err => {
        //         console.error(`[UpdateRegistry] Falha ao atualizar apelido do membro ${member.id}:`, err);
        //     });
        // } else {
        //     console.error(`[UpdateRegistry] Dados de registro não encontrados para o usuário ${userId}. Apelido não atualizado.`);
        // }

        // Lógica para atualização PARCIAL do apelido (apenas o cargo)
        // O objetivo é substituir o cargo, mantendo o restante do apelido (nome #passaporte).

        let currentNickname = member.nickname || member.user.username;

        // 0. Remoção de caracteres indesejados (como '・' ou '・' ou '.')
        // Aplica a remoção no apelido atual antes de qualquer processamento
        // Remoção agressiva de caracteres indesejados no início da string.
        // Revertendo a remoção agressiva. A limpeza do '・' será feita apenas na parte do nome/passaporte.

        let nameAndPassport = currentNickname;

        // 1. Tenta identificar e remover o prefixo de cargo antigo (Ex: "3ºsgt | ")
        const pipeIndex = currentNickname.indexOf(' | ');
        // Se o apelido começar com o cargo, removemos o cargo para obter apenas o nome/passaporte
        if (pipeIndex !== -1) {
            // Se encontrar o separador, assume que o restante é o nome #passaporte
            nameAndPassport = currentNickname.substring(pipeIndex + 3).trim();

            // Aplica a remoção do caractere '・' (U+30FB) e outros pontos na parte do nome/passaporte
            nameAndPassport = nameAndPassport.replace(/[\u30FB\u00B7\u2022]/g, '').trim();
        } else {
            // Se não encontrar, usa o nome de usuário do Discord como fallback,
            // já que o nome #passaporte depende de dados externos.
            nameAndPassport = member.user.username;
        }



        // 2. Constrói o novo apelido completo

        // 2. Constrói o novo apelido completo

        // Converte o nome do cargo para a abreviação solicitada
        const roleAbbreviation = getRoleAbbreviation(roleId, role.name);

        const newNickname = `${roleAbbreviation} | ${nameAndPassport}`;

        await member.setNickname(newNickname).catch(err => {
            console.error(`[UpdateRegistry] Falha ao atualizar apelido do membro ${member.id}:`, err);
        });

        // Edita a embed para aprovado
        const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setFooter({ text: `✅ Aprovado por ${interaction.user.tag}` })
            .setColor("Green");

        await interaction.editReply({ embeds: [embed], components: [] }).catch(() => { });

        // Notifica o usuário
        try {
            await member.send(`✅ Sua solicitação de **${role.name}** foi aprovada!`);
        } catch (e) { }
    }

    if (interaction.customId.startsWith("reject_")) {
        // Verifica se é uma rejeição de cursos (reject_course_)
        if (interaction.customId.startsWith("reject_course_")) {
            const approvalId = interaction.customId.replace("reject_course_", "");
            
            if (!pendingCourseApprovals.has(approvalId)) {
                await interaction.deferUpdate().catch(() => { });
                return;
            }

            const courseData = pendingCourseApprovals.get(approvalId);
            const member = await interaction.guild.members.fetch(courseData.userId).catch(() => null);
            
            pendingCourseApprovals.delete(approvalId);

            await interaction.deferUpdate().catch(() => { });
            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .setFooter({ text: `❌ Rejeitado por ${interaction.user.tag}` })
                .setColor("Red");
            await interaction.editReply({ embeds: [embed], components: [] }).catch(() => { });

            if (member) {
                try {
                    const roleNames = courseData.roleIds.map(id => interaction.guild.roles.cache.get(id)?.name).join(", ");
                    await member.send(`❌ Sua solicitação de curso(s) **${roleNames}** foi rejeitada pela staff.`);
                } catch (e) { }
            }
            return;
        }

        // Verifica se é uma rejeição de remoção (reject_removal_)
        if (interaction.customId.startsWith("reject_removal_")) {
            const removalId = interaction.customId.replace("reject_removal_", "");
            
            if (!pendingRemovals.has(removalId)) {
                await interaction.deferUpdate().catch(() => { });
                return;
            }

            const removalData = pendingRemovals.get(removalId);
            const member = await interaction.guild.members.fetch(removalData.userId).catch(() => null);
            
            pendingRemovals.delete(removalId);

            await interaction.deferUpdate().catch(() => { });
            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .setFooter({ text: `❌ Rejeitado por ${interaction.user.tag}` })
                .setColor("Red");
            await interaction.editReply({ embeds: [embed], components: [] }).catch(() => { });

            if (member) {
                try {
                    await member.send(`❌ Sua solicitação de remoção foi rejeitada pela staff.`);
                } catch (e) { }
            }
            return;
        }

        const [, ...parts] = interaction.customId.split("_");
        const userId = parts[parts.length - 1];
        const member = await interaction.guild.members.fetch(userId).catch(() => null);

        // Edita a embed para recusado
        const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setFooter({ text: `❌ Recusado por ${interaction.user.tag}` })
            .setColor("Red");

        await interaction.editReply({ embeds: [embed], components: [] }).catch(() => { });

        // Notifica o usuário
        if (member) {
            try {
                await member.send(`❌ Sua solicitação foi recusada pela staff.`);
            } catch (e) { }
        }
    }
}

async function handleSelectMenuInteraction(interaction) {
    if (interaction.customId === "update_type_select") {
        const selected = interaction.values[0];

        // Sempre pede o usuário alvo
        const userMenu = new UserSelectMenuBuilder()
            .setCustomId(`select_user_${selected}`)
            .setPlaceholder("👤 Selecione o usuário");

        const row = new ActionRowBuilder().addComponents(userMenu);

        await interaction.reply({
            content: "Selecione o usuário para continuar:",
            components: [row],
            ephemeral: true
        });
    }
}

// -------------------- USER SELECT --------------------
async function handleUserSelection(interaction) {
    if (interaction.customId.startsWith("select_user_")) {
        const selectedUserId = interaction.values[0];
        const type = interaction.customId.replace("select_user_", "");
        const member = await interaction.guild.members.fetch(selectedUserId).catch(() => null);

        if (!member) {
            return interaction.reply({ content: "❌ Usuário não encontrado.", ephemeral: true });
        }

        // Armazena o usuário selecionado
        tempUserSelection.set(interaction.user.id, { userId: selectedUserId, type });

        if (type === "update_basic_info") {
            await showBasicInfoModal(interaction, member);
        } else if (type === "update_rank") {
            await showRankRoleSelect(interaction, member);
        } else if (type === "update_unit") {
            await showUnitRoleSelect(interaction, member);
        } else if (type === "update_course") {
            await showCourseRoleSelect(interaction, member);
        } else if (type === "remove_course") {
            await showRemoveCourseRoleSelect(interaction, member);
        } else if (type === "remove_unit") {
            await showRemoveUnitRoleSelect(interaction, member);
        }
    }
}

// -------------------- MODAL --------------------
async function showBasicInfoModal(interaction, member) {
    const modal = new ModalBuilder()
        .setCustomId(`basic_info_modal_${member.id}`)
        .setTitle("Atualizar Informações Básicas");

    const nomeInput = new TextInputBuilder()
        .setCustomId("nome_input")
        .setLabel("Nome")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const sobrenomeInput = new TextInputBuilder()
        .setCustomId("sobrenome_input")
        .setLabel("Sobrenome")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const passaporteInput = new TextInputBuilder()
        .setCustomId("passaporte_input")
        .setLabel("Passaporte")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const motivoInput = new TextInputBuilder()
        .setCustomId("motivo_input")
        .setLabel("Motivo da Atualização")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(nomeInput),
        new ActionRowBuilder().addComponents(sobrenomeInput),
        new ActionRowBuilder().addComponents(passaporteInput),
        new ActionRowBuilder().addComponents(motivoInput)
    );

    await interaction.showModal(modal);
}

async function handleModalSubmit(interaction) {
    if (interaction.customId.startsWith("basic_info_modal_")) {
        const userId = interaction.customId.replace("basic_info_modal_", "");
        const member = await interaction.guild.members.fetch(userId).catch(() => null);

        if (!member) {
            return interaction.reply({ content: "❌ Usuário não encontrado.", ephemeral: true });
        }

        const nome = interaction.fields.getTextInputValue("nome_input");
        const sobrenome = interaction.fields.getTextInputValue("sobrenome_input");
        const passaporte = interaction.fields.getTextInputValue("passaporte_input");
        const motivo = interaction.fields.getTextInputValue("motivo_input");

        await sendUpdateLog(interaction, "Atualização de Registro", {
            "Nome": nome,
            "Sobrenome": sobrenome,
            "Passaporte": passaporte,
            "Motivo": motivo
        }, null, member);

        await interaction.reply({ content: "✅ Solicitação enviada com sucesso!", ephemeral: true });
    }
}

// -------------------- ROLE SELECTS --------------------
async function showRankRoleSelect(interaction, member) {
    const roleMenu = new RoleSelectMenuBuilder()
        .setCustomId(`rank_role_select_${member.id}`)
        .setPlaceholder("⭐ Selecione a patente");

    const row = new ActionRowBuilder().addComponents(roleMenu);

    await interaction.reply({
        content: `**Selecione a patente para ${member}:**`,
        components: [row],
        ephemeral: true
    });
}

async function showUnitRoleSelect(interaction, member) {
    const roleMenu = new RoleSelectMenuBuilder()
        .setCustomId(`unit_role_select_${member.id}`)
        .setPlaceholder("🏛️ Selecione a unidade");

    const row = new ActionRowBuilder().addComponents(roleMenu);

    await interaction.reply({
        content: `**Selecione a unidade para ${member}:**`,
        components: [row],
        ephemeral: true
    });
}

async function showCourseRoleSelect(interaction, member) {
    const roleMenu = new RoleSelectMenuBuilder()
        .setCustomId(`course_role_select_${member.id}`)
        .setPlaceholder("🎓 Selecione o(s) curso(s)")
        .setMinValues(1)
        .setMaxValues(25);

    const row = new ActionRowBuilder().addComponents(roleMenu);

    await interaction.reply({
        content: `**Selecione o(s) curso(s) para ${member}:**`,
        components: [row],
        ephemeral: true
    });
}

async function showRemoveCourseRoleSelect(interaction, member) {
    const roleMenu = new RoleSelectMenuBuilder()
        .setCustomId(`remove_course_role_select_${member.id}`)
        .setPlaceholder("🎓 Selecione o(s) curso(s) para remover")
        .setMinValues(1)
        .setMaxValues(25);

    const row = new ActionRowBuilder().addComponents(roleMenu);

    await interaction.reply({
        content: `**Selecione o(s) curso(s) para remover de ${member}:**`,
        components: [row],
        ephemeral: true
    });
}

async function showRemoveUnitRoleSelect(interaction, member) {
    const roleMenu = new RoleSelectMenuBuilder()
        .setCustomId(`remove_unit_role_select_${member.id}`)
        .setPlaceholder("🏛️ Selecione a unidade para remover")
        .setMinValues(1)
        .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(roleMenu);

    await interaction.reply({
        content: `**Selecione a unidade para remover de ${member}:**`,
        components: [row],
        ephemeral: true
    });
}

// -------------------- HANDLERS DE CARGOS --------------------
async function handleRankSelection(interaction) {
    if (interaction.customId.startsWith("rank_role_select_")) {
        const userId = interaction.customId.split("_").pop();
        const roleId = interaction.values[0];

        if (!config.patenteRoleIds.includes(roleId)) {
            return interaction.reply({ content: "❌ Esse cargo não é permitido para promoção.", ephemeral: true });
        }

        const role = interaction.guild.roles.cache.get(roleId);
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!role || !member) return interaction.reply({ content: "❌ Cargo ou usuário não encontrado.", ephemeral: true });

        await sendUpdateLog(interaction, "Promoção de Patente", {
            "Patente Solicitada": role.name,
            "Usuário": `${member}`
        }, roleId, member);

        await interaction.reply({ content: `✅ Solicitação enviada para promoção de **${member}** para **${role.name}**.`, ephemeral: true });
    }
}

async function handleUnitSelection(interaction) {
    if (interaction.customId.startsWith("unit_role_select_")) {
        const userId = interaction.customId.split("_").pop();
        const roleId = interaction.values[0];

        if (!config.unidadeRoleIds.includes(roleId)) {
            return interaction.reply({ content: "❌ Esse cargo não é permitido para unidades.", ephemeral: true });
        }

        const role = interaction.guild.roles.cache.get(roleId);
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!role || !member) return interaction.reply({ content: "❌ Cargo ou usuário não encontrado.", ephemeral: true });

        await sendUpdateLog(interaction, "Solicitação de Unidade", {
            "Unidade Solicitada": role.name,
            "Usuário": `${member}`
        }, roleId, member);

        await interaction.reply({ content: `✅ Solicitação de unidade **${role.name}** enviada para **${member}**.`, ephemeral: true });
    }
}

async function handleCourseSelection(interaction) {
    if (interaction.customId.startsWith("course_role_select_")) {
        const userId = interaction.customId.split("_").pop();
        const roleIds = interaction.values;

        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) return interaction.reply({ content: "❌ Usuário não encontrado.", ephemeral: true });

        // Valida se todos os cargos são cursos válidos
        const invalidRoles = roleIds.filter(id => !config.cursoRoleIds.includes(id));
        if (invalidRoles.length > 0) {
            return interaction.reply({ content: "❌ Alguns cargos selecionados não são cursos válidos.", ephemeral: true });
        }

        const roleNames = roleIds.map(id => interaction.guild.roles.cache.get(id)?.name || "Desconhecido").join(", ");
        
        // Gera um ID único para esta solicitação de aprovação (sem concatenar todos os IDs)
        const approvalId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        pendingCourseApprovals.set(approvalId, {
            type: "course",
            userId: member.id,
            roleIds: roleIds
        });

        await sendUpdateLog(interaction, "Solicitação de Curso", {
            "Curso(s) Solicitado(s)": roleNames,
            "Usuário": `${member}`,
            "Quantidade": roleIds.length.toString()
        }, approvalId, member, true);

        await interaction.reply({ content: `✅ Solicitação de curso(s) **${roleNames}** enviada para **${member}**.`, ephemeral: true });
    }
}

async function handleRemoveCourseSelection(interaction) {
    if (interaction.customId.startsWith("remove_course_role_select_")) {
        const userId = interaction.customId.split("_").pop();
        const roleIds = interaction.values;

        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) return interaction.reply({ content: "❌ Usuário não encontrado.", ephemeral: true });

        // Valida se todos os cargos são cursos válidos
        const invalidRoles = roleIds.filter(id => !config.cursoRoleIds.includes(id));
        if (invalidRoles.length > 0) {
            return interaction.reply({ content: "❌ Alguns cargos selecionados não são cursos válidos.", ephemeral: true });
        }

        const roleNames = roleIds.map(id => interaction.guild.roles.cache.get(id)?.name || "Desconhecido").join(", ");
        
        // Gera um ID único para esta solicitação de remoção (timestamp)
        const removalId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        pendingRemovals.set(removalId, {
            type: "course",
            userId: member.id,
            roleIds: roleIds
        });

        await sendUpdateLog(interaction, "Retirada de Curso", {
            "Curso(s) para Remover": roleNames,
            "Usuário": `${member}`,
            "Quantidade": roleIds.length.toString()
        }, removalId, member, true);

        await interaction.reply({ content: `✅ Solicitação para remover curso(s) de **${member}** enviada com sucesso.`, ephemeral: true });
    }
}

async function handleRemoveUnitSelection(interaction) {
    if (interaction.customId.startsWith("remove_unit_role_select_")) {
        const userId = interaction.customId.split("_").pop();
        const roleId = interaction.values[0];

        if (!config.unidadeRoleIds.includes(roleId)) {
            return interaction.reply({ content: "❌ Esse cargo não é uma unidade válida.", ephemeral: true });
        }

        const role = interaction.guild.roles.cache.get(roleId);
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!role || !member) return interaction.reply({ content: "❌ Cargo ou usuário não encontrado.", ephemeral: true });

        // Gera um ID único para esta solicitação de remoção (timestamp)
        const removalId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        pendingRemovals.set(removalId, {
            type: "unit",
            userId: member.id,
            roleIds: [roleId]
        });

        // Envia para aprovação
        await sendUpdateLog(interaction, "Retirada de Unidade", {
            "Unidade para Remover": role.name,
            "Usuário": `${member}`
        }, removalId, member, true);

        await interaction.reply({ content: `✅ Solicitação para remover unidade **${role.name}** de **${member}** enviada com sucesso.`, ephemeral: true });
    }
}

// -------------------- LOG --------------------
async function sendUpdateLog(interaction, type, data, roleId = null, member = null, isRemoval = false, courseType = null) {
    const logChannel = interaction.guild.channels.cache.get(config.channelLogAtt);
    if (!logChannel) {
        console.error("❌ Canal de log não encontrado!");
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`📋 ${type}`)
        .setColor("#FFA500")
        .setThumbnail(member ? member.displayAvatarURL() : interaction.user.displayAvatarURL())
        .addFields(
            { name: "👤 Solicitante", value: `${interaction.user} (${interaction.user.id})`, inline: false },
            { name: "👥 Usuário Alvo", value: member ? `${member} (${member.id})` : "N/A", inline: false },
            { name: "📅 Data/Hora", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
            { name: "📋 Tipo", value: type, inline: false }
        )
        .setFooter({ text: "⏳ Aguardando aprovação do staff" })
        .setTimestamp();

    Object.entries(data).forEach(([k, v]) => embed.addFields({ name: k, value: v, inline: false }));

    const components = [];
    if (roleId && member) {
        // Detecta se é uma aprovação de cursos (Solicitação de Curso)
        const isCourseApproval = type === "Solicitação de Curso";
        
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(isCourseApproval ? `accept_course_${roleId}` : isRemoval ? `accept_removal_${roleId}` : `accept_${roleId}_${member.id}`)
                .setLabel("Aceitar")
                .setEmoji("✅")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(isCourseApproval ? `reject_course_${roleId}` : isRemoval ? `reject_removal_${roleId}` : `reject_${member.id}`)
                .setLabel("Recusar")
                .setEmoji("❌")
                .setStyle(ButtonStyle.Danger)
        );
        components.push(buttons);
    }

    await logChannel.send({ embeds: [embed], components }).catch(err => {
        console.error("Erro ao enviar log:", err);
    });
}

// -------------------- EXPORT --------------------
export default {
    init: sendUpdatePanel,
    handleButtonInteraction,
    handleSelectMenuInteraction,
    handleUserSelection,
    handleModalSubmit,
    handleRankSelection,
    handleUnitSelection,
    handleCourseSelection,
    handleRemoveCourseSelection,
    handleRemoveUnitSelection
};