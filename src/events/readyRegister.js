import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import fs from "fs";
import path from "path";

export const name = "ready";
export const once = true;

const DATA_FILE = path.join(process.cwd(), "data", "registrations.json");

function loadRegistrations() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw || "{}");
  } catch (e) {
    console.error("Could not load registrations:", e);
    return {};
  }
}

function saveRegistrations(obj) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), "utf8");
  } catch (e) {
    console.error("Could not save registrations:", e);
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

function normalizeStaffRoles(client) {
  const cfg = client.config.staffRoleInd || client.config.staffRoleId || "";
  if (Array.isArray(cfg)) return cfg.map(String);
  return String(cfg || "").split(",").map(s => s.trim()).filter(Boolean);
}

export default async function readyRegister(client) {
  // try to fetch channel (fetch if not cached)
  const channelId = client.config.channelRegister;
  if (!channelId) {
    console.log("[readyRegister] CHANNEL_REGISTER not set in config");
    return;
  }

  let channel;
  try {
    channel = await client.channels.fetch(channelId);
  } catch (e) {
    console.log("[readyRegister] failed to fetch channel:", e?.message || e);
    channel = null;
  }
  if (!channel) {
    console.log("[readyRegister] Canal de registro não configurado ou não encontrado.");
    return;
  }

  // Verificação melhorada: checar se já existe QUALQUER mensagem no canal
  const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
  
  if (messages && messages.size > 0) {
    console.log("[readyRegister] Canal já possui mensagens. Não será enviada nova embed para evitar duplicação.");
    console.log(`[readyRegister] Total de mensagens encontradas: ${messages.size}`);
    
    // Apenas atualiza os botões se encontrar a mensagem do bot
    const botMessage = messages.find(m => m.author.id === client.user.id);
    if (botMessage) {
      const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("registroConvencional").setLabel("Registro Convencional").setEmoji("<:atualizar:1422309803002298398>").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("registroIndicacao").setLabel("Registro por Indicação").setEmoji("<:adicionar:1422308094204973237>").setStyle(ButtonStyle.Primary)
    );
      
      await botMessage.edit({ components: [row] }).catch(err => {
        console.error("[readyRegister] Falha ao atualizar botões:", err);
      });
      console.log("[readyRegister] Botões da mensagem existente atualizados.");
    }
    
    // Para aqui, não envia nova mensagem
  } else {
    // Canal está vazio, pode enviar a embed
    console.log("[readyRegister] Canal vazio. Enviando embed de registro...");
    
    const embed = new EmbedBuilder()
      .setColor("#131416")
      .setAuthor({ 
        name: "Batalhão de Policia Militar Villa 2025", 
      })
      .setTitle(" ")
      .setDescription(
        "# REGISTRO DE CONSCRITOS. \n"+
        "Para registrar sua conta, use os botões abaixo.\n" +
        "Use o segundo botão caso possua **indicação de outro oficial**.\n\n" +
        "> ⚠️ Caso ocorra algum problema, contate a administração."
      )
      .setImage("https://cdn.discordapp.com/attachments/1428418733734625315/1428427557455532142/Group_2.png?ex=68f27654&is=68f124d4&hm=8cd33b7cbd224f9b0a09a2ce5471eae54b1783deae03127458ae1de7d157cee6&")
      .setFooter({ 
        text: "Polícia Militar APP • " + new Date().toLocaleDateString("pt-BR"), 
        iconURL: "https://cdn.discordapp.com/attachments/1428418733734625315/1428427890529275944/BPMV.png?ex=68f276a4&is=68f12524&hm=68f254205a3f65ede78297ec501c17df084c640f312555b951d7179a7aeb6a36&"
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("registroConvencional").setLabel("Registro Convencional").setEmoji("<:atualizar:1422309803002298398>").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("registroIndicacao").setLabel("Registro por Indicação").setEmoji("<:adicionar:1422308094204973237>").setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] }).catch(err => 
      console.error("[readyRegister] send failed:", err)
    );
    console.log("[readyRegister] Embed de registro enviada com sucesso.");
  }

  // helper to find member by passaporte (matching nickname or username ending with #passaporte)
  async function findMemberByPassaporte(guild, passaporte) {
    if (!passaporte) return null;
    const id = String(passaporte).trim();
    // escape for regex
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const esc = escapeRegex(id);
    // accept normal '#' and fullwidth '＃' and optional spaces before the number, at the end of the name
    const regex = new RegExp('[#＃]\\s*' + esc + '$', 'i');

    // 1) try cache first (nickname / username)
    let mem = guild.members.cache.find(m => {
      const dn = (m.displayName || '').toString();
      const un = (m.user && m.user.username) ? m.user.username.toString() : '';
      return regex.test(dn) || regex.test(un);
    });
    if (mem) return mem;

    // 2) try fetching by query (searches username/nickname) - useful for partial cache
    try {
      const fetched = await guild.members.fetch({ query: id, limit: 50 }).catch(()=>null);
      if (fetched && fetched.size) {
        mem = fetched.find(m => {
          const dn = (m.displayName || '').toString();
          const un = (m.user && m.user.username) ? m.user.username.toString() : '';
          return regex.test(dn) || regex.test(un);
        });
        if (mem) return mem;
      }
    } catch(e) {}

    // 3) as last resort, try to fetch all members (requires Server Members Intent)
    try {
      await guild.members.fetch().catch(()=>{});
      mem = guild.members.cache.find(m => {
        const dn = (m.displayName || '').toString();
        const un = (m.user && m.user.username) ? m.user.username.toString() : '';
        return regex.test(dn) || regex.test(un);
      });
      if (mem) return mem;
    } catch(e) {}

    return null;
  }


  // interaction handler
  client.on("interactionCreate", async (interaction) => {
    try {
      // BUTTONS: open modals
      if (interaction.isButton()) {
        if (interaction.customId === "registroConvencional") {
          const modal = new ModalBuilder()
            .setCustomId("modalConvencional")
            .setTitle("Registro Convencional")
            .addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("nome").setLabel("Nome").setStyle(TextInputStyle.Short).setRequired(true)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("sobrenome").setLabel("Sobrenome").setStyle(TextInputStyle.Short).setRequired(true)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("passaporte").setLabel("Passaporte").setStyle(TextInputStyle.Short).setRequired(true)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("autorizado").setLabel("Autorizado por").setStyle(TextInputStyle.Short).setRequired(true))
            );
          return interaction.showModal(modal);
        }

        if (interaction.customId === "registroIndicacao") {
          const modal = new ModalBuilder()
            .setCustomId("modalIndicacao")
            .setTitle("Registro por Indicação")
            .addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("nome").setLabel("Nome").setStyle(TextInputStyle.Short).setRequired(true)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("sobrenome").setLabel("Sobrenome").setStyle(TextInputStyle.Short).setRequired(true)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("passaporte").setLabel("Passaporte").setStyle(TextInputStyle.Short).setRequired(true)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("indicador").setLabel("Passaporte do Indicador").setStyle(TextInputStyle.Short).setRequired(true))
            );
          return interaction.showModal(modal);
        }

        // Approve/Reject buttons from log
        if (interaction.customId.startsWith("reg_approve_") || interaction.customId.startsWith("reg_reject_")) {
          const isApprove = interaction.customId.startsWith("reg_approve_");
          const regId = interaction.customId.split("reg_approve_").pop() || interaction.customId.split("reg_reject_").pop();
          const regs = loadRegistrations();
          const entry = regs[regId];
          if (!entry) return interaction.reply({ content: "Registro não encontrado (já processado ou expirado).", ephemeral: true });

          // check staff role
          const staffRoles = normalizeStaffRoles(client);
          const memberRoles = (interaction.member && interaction.member.roles) ? Array.from(interaction.member.roles.cache.keys()) : [];
          const isStaff = memberRoles.some(r => staffRoles.includes(r));
          if (!isStaff) return interaction.reply({ content: "Somente staff pode aprovar/reprovar registros.", ephemeral: true });

          if (entry.status !== "pending") {
            return interaction.reply({ content: "Este registro já foi processado.", ephemeral: true });
          }

          // fetch the member to apply changes
          const guild = interaction.guild;
          const targetMember = await guild.members.fetch(entry.userId).catch(() => null);
          if (!targetMember) {
            entry.status = "error";
            saveRegistrations(regs);
            return interaction.reply({ content: "Não foi possível acessar o usuário para aplicar o registro.", ephemeral: true });
          }

          if (isApprove) {
            // apply nickname and roles
            const nickname = `AL | ${entry.nome} ${entry.sobrenome} #${entry.passaporte}`;
            try {
              await targetMember.setNickname(nickname);
            } catch (e) {}
            try {
              if (client.config.role1Id) await targetMember.roles.add(client.config.role1Id).catch(()=>{});
              if (client.config.role2Id) await targetMember.roles.add(client.config.role2Id).catch(()=>{});
            } catch (e) {}

            entry.status = "approved";
            entry.processedBy = interaction.user.id;
            entry.processedAt = Date.now();
            saveRegistrations(regs);

            // update embed/message in log
            const origMsg = interaction.message;
            const newEmbed = EmbedBuilder.from(origMsg.embeds[0])
              .setColor("Green")
              .addFields({ name: "Status", value: `✅ Aprovado por <@${interaction.user.id}>`, inline: false });
            await origMsg.edit({ embeds: [newEmbed], components: [] }).catch(()=>{});

            
try {
  await targetMember.send(`✅ Olá ${entry.nome}, seu registro (AL | ${entry.nome} ${entry.sobrenome} #${entry.passaporte}) foi aprovado.`).catch(()=>{});
} catch(e) {}
await interaction.reply({ content: "✅ Registro aprovado e cargos atribuídos.", ephemeral: true });
          } else {
            // reject
            entry.status = "rejected";
            entry.processedBy = interaction.user.id;
            entry.processedAt = Date.now();
            saveRegistrations(regs);

            const origMsg = interaction.message;
            const newEmbed = EmbedBuilder.from(origMsg.embeds[0])
              .setColor("Red")
              .addFields({ name: "Status", value: `❌ Rejeitado por <@${interaction.user.id}>`, inline: false });
            await origMsg.edit({ embeds: [newEmbed], components: [] }).catch(()=>{});

            // optional: notify user
            try {
              const usr = await guild.members.fetch(entry.userId);
              await usr.send(`❌ Olá ${entry.nome}, infelizmente seu registro (${entry.nome} ${entry.sobrenome} #${entry.passaporte}) foi rejeitado.`).catch(()=>{});
            } catch (e) {}

            await interaction.reply({ content: "❌ Registro rejeitado.", ephemeral: true });
          }

          return;
        }
      }

      // MODAL SUBMIT
      if (interaction.isModalSubmit()) {
        // gather data and create registration entry, DO NOT assign roles/nick yet
        if (interaction.customId === "modalConvencional" || interaction.customId === "modalIndicacao") {
          const isIndicacao = interaction.customId === "modalIndicacao";
          const nome = interaction.fields.getTextInputValue("nome");
          const sobrenome = interaction.fields.getTextInputValue("sobrenome");
          const passaporte = interaction.fields.getTextInputValue("passaporte");
          const autorizado = isIndicacao ? interaction.fields.getTextInputValue("indicador") : interaction.fields.getTextInputValue("autorizado");

          const regId = generateId();
          const regs = loadRegistrations();
          regs[regId] = {
            id: regId,
            guildId: interaction.guild.id,
            userId: interaction.user.id,
            type: isIndicacao ? "indicacao" : "convencional",
            nome, sobrenome, passaporte,
            autorizado,
            status: "pending",
            createdAt: Date.now(),
            createdBy: interaction.user.id
          };
          saveRegistrations(regs);

          // prepare log embed
          const logChannel = interaction.guild.channels.cache.get(client.config.channelLogRegister) || await client.channels.fetch(client.config.channelLogRegister).catch(()=>null);
          


if (logChannel) {
  let embed;

  if (isIndicacao) {
    const indicatorMember = await findMemberByPassaporte(interaction.guild, autorizado);
    embed = new EmbedBuilder()
      .setTitle("📝 Formulário de Registro por Indicação")
      .setColor("Blue")
      .addFields(
        { name: "Nome", value: `${nome} ${sobrenome}`, inline: false },
        { name: "ID Cidade", value: passaporte, inline: false },
        { name: "Usuário", value: `<@${interaction.user.id}>`, inline: false },
        { name: "ID de Discord", value: interaction.user.id, inline: false },
        { name: "Indicado por", value: indicatorMember ? `<@${indicatorMember.id}> (${autorizado})` : `${autorizado} (não encontrado)`, inline: false },
        { name: "Cargo", value: `<@&${client.config.role1Id}>`, inline: false },
        { name: "Status", value: "⏳ Aguardando análise", inline: false }
      )
      .setFooter({ text: `Enviado por ${interaction.user.tag}` })
      .setTimestamp()
      .setImage("https://cdn.discordapp.com/attachments/1428418733734625315/1428427557455532142/Group_2.png?ex=68f27654&is=68f124d4&hm=8cd33b7cbd224f9b0a09a2ce5471eae54b1783deae03127458ae1de7d157cee6&");
  } else {
    const authorizedMember = await findMemberByPassaporte(interaction.guild, autorizado);
    embed = new EmbedBuilder()
      .setTitle("📝 Formulário de Registro Convencional")
      .setColor("Green")
      .addFields(
        { name: "Nome", value: `${nome} ${sobrenome}`, inline: false },
        { name: "ID Cidade", value: passaporte, inline: false },
        { name: "Usuário", value: `<@${interaction.user.id}>`, inline: false },
        { name: "ID de Discord", value: interaction.user.id, inline: false },
        { name: "Autorizado por", value: authorizedMember ? `<@${authorizedMember.id}> (${autorizado})` : `${autorizado} (não encontrado)`, inline: false },
        { name: "Cargo", value: `<@&${client.config.role1Id}>`, inline: false },
        { name: "Status", value: "⏳ Aguardando análise.", inline: false }
      )
      .setFooter({ text: `Enviado por ${interaction.user.tag}` })
      .setTimestamp()
      .setImage("https://cdn.discordapp.com/attachments/1428418733734625315/1428427557455532142/Group_2.png?ex=68f27654&is=68f124d4&hm=8cd33b7cbd224f9b0a09a2ce5471eae54b1783deae03127458ae1de7d157cee6&");
  }

  const approveBtn = new ButtonBuilder()
    .setCustomId(`reg_approve_${regId}`)
    .setLabel("Aprovar")
    .setStyle(ButtonStyle.Success);

  const rejectBtn = new ButtonBuilder()
    .setCustomId(`reg_reject_${regId}`)
    .setLabel("Rejeitar")
    .setStyle(ButtonStyle.Danger);

  const actionRow = new ActionRowBuilder().addComponents(approveBtn, rejectBtn);

  const sent = await logChannel.send({ embeds: [embed], components: [actionRow] }).catch(err => {
    console.error("[readyRegister] send to log failed:", err);
    return null;
  });

  if (sent) {
    regs[regId].logMessageId = sent.id;
    regs[regId].logChannelId = logChannel.id;
    saveRegistrations(regs);
  }
}

          await interaction.reply({ content: "✅ Registro enviado para análise.", ephemeral: true });
        }
      }
    } catch (err) {
      console.error("[readyRegister] interaction handler error:", err);
      try { if (interaction && !interaction.replied) interaction.reply({ content: "Ocorreu um erro ao processar.", ephemeral: true }); } catch(e) {}
    }
  });
}