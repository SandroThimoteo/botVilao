import { createTicketSelect } from '../components/ticketSelect.js';
import { createTicketEmbed } from '../embeds/ticketEmbed.js';
import * as acaoPanel from './acaoPanel.js';
import fs from 'fs';
import path from 'path';
import { ChannelType, ActivityType } from 'discord.js';
import updateRegistry from './updateRegistryInteraction.js';
import { scheduleChecks } from '../commands/ausencia.js';

export const name = 'ready';
export const once = true;

export default async function ready(client) {
  console.log(`Logged in as ${client.user.tag}`);

  const guilds = client.guilds.cache;
  for (const [guildId, guild] of guilds) {
    if (client.config.guildId && client.config.guildId !== guildId) continue;

    const categoriesToEnsure = ['Suporte', 'Curso', 'Corregedoria'];
    for (const catName of categoriesToEnsure) {
      let category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === catName
      );
      if (!category) {
        category = await guild.channels.create({ name: catName, type: ChannelType.GuildCategory });
        console.log(`Created category ${catName}`);
      }
    }

    const channelId = client.config.channelTicket;
    if (!channelId) continue;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel) continue;

    // VERIFICAÇÃO MELHORADA: Checar se já existe qualquer mensagem no canal
    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    
    if (messages && messages.size > 0) {
      console.log(`[Ready] Canal ${channel.name} já possui mensagens. Não será enviada nova embed.`);
      console.log(`[Ready] Total de mensagens encontradas: ${messages.size}`);
      
      // Apenas atualiza os componentes se encontrar a mensagem do bot
      const botMessage = messages.find(m => m.author.id === client.user.id);
      if (botMessage) {
        const row = createTicketSelect();
        await botMessage.edit({ components: [row] }).catch(err => {
          console.error("[Ready] Falha ao atualizar componentes:", err);
        });
        console.log("[Ready] Componentes da mensagem existente atualizados.");
      }
      
      continue; // Pula para o próximo guild, não envia nova mensagem
    }

    // Canal está vazio, pode enviar a embed
    console.log(`[Ready] Canal ${channel.name} está vazio. Enviando embed de tickets...`);
    
    const embed = createTicketEmbed();
    let files = [];
    const row = createTicketSelect();
    
    const msg = await channel.send({ embeds: [embed], components: [row], files });
    await client.db.addPostedMessage(guildId, channelId, msg.id);
    
    console.log(`[Ready] Embed de tickets enviada com sucesso em ${channel.name}`);
  }

  // envia o painel de atualização automaticamente
  await updateRegistry.init(client);

  // 🎯 Inicializa o painel de ações
  await acaoPanel.init(client);

  // 📅 SISTEMA DE AUSÊNCIAS - Reagendar ausências pendentes
  try {
    const db = client.db;
    const now = Date.now();
    
    // Buscar todas as ausências ativas
    const ausencias = await db.all(
      'SELECT * FROM ausencias WHERE return_date > ?',
      [now]
    );

    if (ausencias && ausencias.length > 0) {
      console.log(`📅 Reagendando ${ausencias.length} ausência(s) pendente(s)...`);
      
      for (const ausencia of ausencias) {
        const returnDate = new Date(ausencia.return_date);
        scheduleChecks(client, ausencia.user_id, ausencia.guild_id, returnDate);
      }
      
      console.log('✅ Ausências reagendadas com sucesso!');
    } else {
      console.log('📅 Nenhuma ausência pendente para reagendar.');
    }
  } catch (error) {
    console.error('❌ Erro ao reagendar ausências:', error);
  }

  // Presença fixa: Ocupado + Assistindo
  try {
    console.log("⏳ Definindo presença...");
    client.user.setPresence({
      activities: [
        {
          name: "Desenvolvido por pTkezy & _sandrinho",
          type: ActivityType.Playing
        }
      ],
      status: "dnd" // 🔴 sempre ocupado
    });

    // pequena verificação de debug
    console.log("✅ Presença definida:", {
      status: client.user.presence?.status,
      activities: client.user.presence?.activities?.map(a => `${a.type}:${a.name}`)
    });
  } catch (e) {
    console.error("❌ Erro ao definir presença:", e);
  }
}