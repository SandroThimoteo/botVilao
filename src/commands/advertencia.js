import { SlashCommandBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import config from '../config.js';

const command = new SlashCommandBuilder()
  .setName('advertencia')
  .setDescription('Registrar uma advertência para um membro')
  .setDefaultMemberPermissions('0')
  .setDMPermission(false);

async function execute(interaction) {
  // Verifica se o usuário é staff
  const staffRoles = Array.isArray(config.staffExoneracaoId)
    ? config.staffExoneracaoId
    : config.staffExoneracaoId?.split(',').map(id => id.trim()) || [];

  const memberRoles = Array.from(interaction.member.roles.cache.keys());
  const isStaff = memberRoles.some(r => staffRoles.includes(r));

  if (!isStaff) {
    return interaction.reply({ content: "❌ Você não tem permissão para usar este comando.", ephemeral: true });
  }

  // Criar modal
  const modal = new ModalBuilder()
    .setCustomId('advertencia_modal')
    .setTitle('Registrar Advertência');

  const qraInput = new TextInputBuilder()
    .setCustomId('qra_input')
    .setLabel('QRA')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: Sandro TEP')
    .setRequired(true);

  const passaporteInput = new TextInputBuilder()
    .setCustomId('passaporte_input')
    .setLabel('ID do Discord')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: 451142751837224961')
    .setRequired(true);

  const motivoInput = new TextInputBuilder()
    .setCustomId('motivo_input')
    .setLabel('Motivo')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Descreva o motivo da advertência')
    .setRequired(true);

  const punicaoInput = new TextInputBuilder()
    .setCustomId('punicao_input')
    .setLabel('Punição')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: Remoção de cursos básicos')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(qraInput),
    new ActionRowBuilder().addComponents(passaporteInput),
    new ActionRowBuilder().addComponents(motivoInput),
    new ActionRowBuilder().addComponents(punicaoInput)
  );

  await interaction.showModal(modal);
}

// Handler para o modal
async function handleModal(interaction) {
  if (interaction.customId !== 'advertencia_modal') return;

  await interaction.deferReply({ ephemeral: true });

  const qra = interaction.fields.getTextInputValue('qra_input');
  const passaporte = interaction.fields.getTextInputValue('passaporte_input');
  const motivo = interaction.fields.getTextInputValue('motivo_input');
  const punicao = interaction.fields.getTextInputValue('punicao_input');

  // Validar se é QRA válido (numérico)
//   if (!/^\d+$/.test(qra)) {
//     return interaction.editReply({ content: "❌ QRA deve conter apenas números." });
//   }

  // Procurar membro pelo passaporte/QRA — primeiro em registrations.json, depois buscar no servidor (todos os usuários)
  let targetMember = null;
  const registrationsPath = path.join(process.cwd(), 'data', 'registrations.json');

  try {
    const registrations = JSON.parse(fs.readFileSync(registrationsPath, 'utf-8'));
    const registryEntry = Object.values(registrations).find(r => r.passaporte === passaporte || r.passaporte === qra || r.userId === passaporte || r.userId === qra);

    if (registryEntry) {
      targetMember = await interaction.guild.members.fetch(registryEntry.userId).catch(() => null);
    }
  } catch (e) {
    console.error('[Advertencia] Erro ao ler registrations.json:', e);
  }

  // Se não encontrado em registrations.json, tentar localizar no servidor inteiro
  if (!targetMember) {
    // 1) tentar extrair ID de menção como <@123...>
    try {
      const mentionMatch = passaporte.match(/^<@!?(\d+)>$/) || qra.match(/^<@!?(\d+)>$/);
      const maybeId = mentionMatch ? mentionMatch[1] : null;

      // 2) se o input parece com um id, tentar buscar por id
      if (!targetMember && maybeId) {
        targetMember = await interaction.guild.members.fetch(maybeId).catch(() => null);
      }

      // 3) se 'passaporte' parece um id longo, tentar buscar por id
      if (!targetMember && /\d{17,20}/.test(passaporte)) {
        targetMember = await interaction.guild.members.fetch(passaporte).catch(() => null);
      }
      if (!targetMember && /\d{17,20}/.test(qra)) {
        targetMember = await interaction.guild.members.fetch(qra).catch(() => null);
      }

      // 4) buscar por username/nickname via query (padrão discord.js)
      if (!targetMember) {
        const query = (passaporte && passaporte.length > 0) ? passaporte : qra;
        if (query) {
          const fetched = await interaction.guild.members.fetch({ query, limit: 5 }).catch(() => null);
          if (fetched && fetched.size > 0) {
            targetMember = fetched.first();
          }
        }
      }

      // 5) fallback: procurar na cache por username, tag ou nickname que contenham o texto
      if (!targetMember) {
        const lcPass = (passaporte || '').toLowerCase();
        const lcQra = (qra || '').toLowerCase();
        const found = interaction.guild.members.cache.find(m => {
          const uname = (m.user.username || '').toLowerCase();
          const tag = (m.user.tag || '').toLowerCase();
          const nick = (m.nickname || '').toLowerCase();
          return (lcPass && (uname.includes(lcPass) || tag.includes(lcPass) || nick.includes(lcPass))) ||
                 (lcQra && (uname.includes(lcQra) || tag.includes(lcQra) || nick.includes(lcQra)));
        });
        if (found) targetMember = found;
      }
    } catch (e) {
      console.error('[Advertencia] Erro ao buscar membro no servidor:', e);
    }
  }

  if (!targetMember) {
    return interaction.editReply({ content: `❌ Membro com passaporte **${passaporte}** não encontrado.` });
  }

  // Executar punição
  const punitionLog = [];
  let shouldExonerate = false;
  
  try {
    // 🔴 ADICIONAR CARGO DE ADVERTÊNCIA (SEMPRE, INDEPENDENTEMENTE DA PUNIÇÃO)
    // ⚠️ Sistema de Advertências Progressivas
    const adv1RoleId = config.advertencia1RoleId;
    const adv2RoleId = config.advertencia2RoleId;
    
    if (adv1RoleId || adv2RoleId) {
      const hasAdv1 = adv1RoleId && targetMember.roles.cache.has(adv1RoleId);
      const hasAdv2 = adv2RoleId && targetMember.roles.cache.has(adv2RoleId);
      
      if (hasAdv1 && hasAdv2) {
        // Já tem 2 advertências → Exonerar
        shouldExonerate = true;
        punitionLog.push(`🔴 **LIMITE DE ADVERTÊNCIAS ATINGIDO - MEMBRO SERÁ EXONERADO**`);
      } else if (hasAdv1) {
        // Tem 1ª advertência → Adicionar 2ª
        if (adv2RoleId) {
          await targetMember.roles.add(adv2RoleId, 'Advertência - Segunda Advertência').catch(e => {
            console.error('[Advertencia] Erro ao adicionar 2ª advertência:', e);
          });
          punitionLog.push(`⚠️ Adicionada 2ª ADVERTÊNCIA`);
        }
      } else {
        // Sem advertências → Adicionar 1ª
        if (adv1RoleId) {
          await targetMember.roles.add(adv1RoleId, 'Advertência - Primeira Advertência').catch(e => {
            console.error('[Advertencia] Erro ao adicionar 1ª advertência:', e);
          });
          punitionLog.push(`⚠️ Adicionada 1ª ADVERTÊNCIA`);
        }
      }
    }
    
    // OUTRAS PUNIÇÕES (OPCIONAIS - DEPENDEM DO CAMPO PUNIÇÃO)
    // Se punição contém "curso" ou similar, remover cursos básicos (não remover cargos de advertência)
    if (punicao.toLowerCase().includes('curso')) {
      const basicCourses = config.cursoRoleIds ? config.cursoRoleIds.slice(0, 3) : [];
      const advIds = [config.advertencia1RoleId, config.advertencia2RoleId].filter(Boolean);
      const coursesToRemove = basicCourses.filter(id => !advIds.includes(id));
      if (coursesToRemove.length > 0) {
        await targetMember.roles.remove(coursesToRemove, 'Advertência - Remoção de cursos').catch(e => {
          console.error('[Advertencia] Erro ao remover cursos:', e);
        });
        punitionLog.push(`✅ Removido ${coursesToRemove.length} cursos básicos`);
      }
    }

    // Se punição contém "patente" ou "rebaixamento", rebaixar para a patente anterior
    if (punicao.toLowerCase().includes('patente') || punicao.toLowerCase().includes('rebaixa')) {
      const patenteHierarquia = config.patenteHierarquia || [];
      
      if (patenteHierarquia.length > 0) {
        // Encontrar a patente atual do membro
        const memberPatentes = Array.from(targetMember.roles.cache.keys())
          .filter(roleId => patenteHierarquia.some(p => p.roleId === roleId));
        
        if (memberPatentes.length > 0) {
          const currentRoleId = memberPatentes[0];
          const currentIndex = patenteHierarquia.findIndex(p => p.roleId === currentRoleId);
          
          if (currentIndex !== -1) {
            // proteger cargos de advertência caso estejam erroneamente presentes nas listas
            const advIds = [config.advertencia1RoleId, config.advertencia2RoleId].filter(Boolean);
            if (!advIds.includes(currentRoleId)) {
              // Remover a patente atual
              await targetMember.roles.remove(currentRoleId, 'Advertência - Rebaixamento de patente').catch(e => {
                console.error('[Advertencia] Erro ao remover patente:', e);
              });
            }
            
            // Se não for a última patente, adicionar a próxima (mais baixa)
            if (currentIndex + 1 < patenteHierarquia.length) {
              const nextPatente = patenteHierarquia[currentIndex + 1];
              await targetMember.roles.add(nextPatente.roleId, 'Advertência - Rebaixamento de patente').catch(e => {
                console.error('[Advertencia] Erro ao adicionar nova patente:', e);
              });
              punitionLog.push(`✅ Rebaixado de ${patenteHierarquia[currentIndex].nome} para ${nextPatente.nome}`);
            } else {
              punitionLog.push(`✅ Removida patente ${patenteHierarquia[currentIndex].nome} (patente mínima atingida)`);
            }
          }
        }
      } else {
        // Fallback se não houver hierarquia configurada
        const patenteRoles = config.patenteRoleIds || [];
        const memberPatentes = Array.from(targetMember.roles.cache.keys())
          .filter(roleId => patenteRoles.includes(roleId));
        
        if (memberPatentes.length > 0) {
          const advIds = [config.advertencia1RoleId, config.advertencia2RoleId].filter(Boolean);
          const patenteToRemove = advIds.includes(memberPatentes[0]) ? null : memberPatentes[0];
          if (patenteToRemove) {
            await targetMember.roles.remove(patenteToRemove, 'Advertência - Rebaixamento de patente').catch(e => {
              console.error('[Advertencia] Erro ao remover patente:', e);
            });
            punitionLog.push(`✅ Removed rank role`);
          }
        }
      }
    }

    // Se punição contém "unidade", remover unidade
    if (punicao.toLowerCase().includes('unidade')) {
      const unidadeRoles = config.unidadeRoleIds || [];
      const memberUnidade = Array.from(targetMember.roles.cache.keys())
        .filter(roleId => unidadeRoles.includes(roleId));
      
      if (memberUnidade.length > 0) {
        const advIds = [config.advertencia1RoleId, config.advertencia2RoleId].filter(Boolean);
        const unidadeToRemove = advIds.includes(memberUnidade[0]) ? null : memberUnidade[0];
        if (unidadeToRemove) {
          await targetMember.roles.remove(unidadeToRemove, 'Advertência - Remoção de unidade').catch(e => {
            console.error('[Advertencia] Erro ao remover unidade:', e);
          });
          punitionLog.push(`✅ Removido da unidade`);
        }
      }
    }
  } catch (e) {
    console.error('[Advertencia] Erro ao executar punição:', e);
  }

  // Enviar para canal de log
  const logChannel = interaction.guild.channels.cache.get(config.channelLogAdvertencia);
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Advertência Registrada')
      .setColor('#FFA500')
      .setThumbnail(targetMember.displayAvatarURL())
      .addFields(
        { name: '👤 Membro', value: `${targetMember} (${targetMember.id})`, inline: false },
        { name: '🆔 QRA', value: qra, inline: false },
        { name: '🆔 ID do Discord', value: passaporte, inline: false },
        { name: '📝 Motivo', value: motivo, inline: false },
        { name: '⚖️ Punição', value: punicao, inline: false },
        { name: '📋 Ações Executadas', value: punitionLog.length > 0 ? punitionLog.join('\n') : 'Nenhuma ação aplicada', inline: false },
        { name: '👮 Registrado por', value: `${interaction.user} (${interaction.user.id})`, inline: false }
      )
      .setFooter({ text: 'Sistema de Advertências' })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(e => {
      console.error('[Advertencia] Erro ao enviar log:', e);
    });
  }

  // Notificar membro
  try {
    const dmEmbed = new EmbedBuilder()
      .setTitle('⚠️ Você recebeu uma advertência')
      .setColor('#FFA500')
      .addFields(
        { name: 'QRA', value: qra, inline: false },
        { name: 'Motivo', value: motivo, inline: false },
        { name: 'Punição', value: punicao, inline: false }
      )
      .setTimestamp();

    await targetMember.send({ embeds: [dmEmbed] }).catch(() => {});
  } catch (e) {}

  // Se deve exonerar, fazer isso agora
  if (shouldExonerate) {
    try {
      const nomeMembro = targetMember.nickname || targetMember.user.displayName || targetMember.user.username;
      
      // Obter canal de log de exoneração
      const logChannel = interaction.guild.channels.cache.get(config.channelLogExoneracao);
      const targetChannel = logChannel || interaction.channel;

      // Enviar mensagem de exoneração no mesmo formato do comando /exoneracao
      const mensagemExoneracao = `${targetMember}\`\`\`ini\n` +
        `[Nome do oficial] ${nomeMembro}\n` +
        `[Motivo] Atingido limite máximo de advertências (2)\n` +
        `[Autorizado por: ${interaction.user.tag}]\n` +
        `[Tipo] Automática - Sistema de Advertências\n` +
        `\`\`\``;

      await targetChannel.send(mensagemExoneracao).catch(e => {
        console.error('[Advertencia] Erro ao enviar log de exoneração:', e);
      });

      // 🔴 REMOVER TODOS OS CARGOS DO MEMBRO
      const allRolesToRemove = [];

      // Remover cargos de advertência
      if (config.advertencia1RoleId) {
        allRolesToRemove.push(config.advertencia1RoleId);
      }
      if (config.advertencia2RoleId) {
        allRolesToRemove.push(config.advertencia2RoleId);
      }

      // Remover cargos de patentes
      if (config.patenteRoleIds && Array.isArray(config.patenteRoleIds)) {
        allRolesToRemove.push(...config.patenteRoleIds.filter(id => targetMember.roles.cache.has(id)));
      }

      // Remover cargos de unidades
      if (config.unidadeRoleIds && Array.isArray(config.unidadeRoleIds)) {
        allRolesToRemove.push(...config.unidadeRoleIds.filter(id => targetMember.roles.cache.has(id)));
      }

      // Remover cargos de cursos
      if (config.cursoRoleIds && Array.isArray(config.cursoRoleIds)) {
        allRolesToRemove.push(...config.cursoRoleIds.filter(id => targetMember.roles.cache.has(id)));
      }

      // Remover cargos de ausência
      if (config.ausenciaRoleId && targetMember.roles.cache.has(config.ausenciaRoleId)) {
        allRolesToRemove.push(config.ausenciaRoleId);
      }

      // Remover cargos de registro policial (ROLE1 e ROLE2)
      if (config.role1Id && targetMember.roles.cache.has(config.role1Id)) {
        allRolesToRemove.push(config.role1Id);
      }
      if (config.role2Id && targetMember.roles.cache.has(config.role2Id)) {
        allRolesToRemove.push(config.role2Id);
      }

      // Executar remoção de todos os cargos
      if (allRolesToRemove.length > 0) {
        await targetMember.roles.remove(allRolesToRemove, 'Exoneração - Limite de advertências').catch(e => {
          console.error('[Advertencia] Erro ao remover cargos:', e);
        });
      }

      // Agendar expulsão em 7 dias (mesmo padrão do comando exoneracao)
      const kickDelay = 7 * 24 * 60 * 60 * 1000; // 7 dias
      const timeoutId = setTimeout(async () => {
        try {
          await targetMember.kick(`Exoneração automática - Sistema de Advertências. Executado por ${interaction.user.tag}`);
          
          await targetChannel.send({
            content: `🔴 **${targetMember.user.tag}** foi removido do servidor (exoneração automática por advertências).`
          }).catch(() => {});
        } catch (error) {
          console.error(`[Advertencia] Erro ao expulsar ${targetMember.user.tag}:`, error);
          await targetChannel.send({
            content: `❌ Não foi possível remover **${targetMember.user.tag}** do servidor.`
          }).catch(() => {});
        }
      }, kickDelay);

      // Guardar informações do agendamento (opcional para rastreamento)
      console.log(`[Advertencia] Expulsão agendada para ${targetMember.user.tag} em 7 dias - Timeout ID: ${timeoutId._destroyed}`);
    } catch (e) {
      console.error('[Advertencia] Erro ao processar exoneração automática:', e);
    }
  }

  await interaction.editReply({
    content: `✅ Advertência registrada para **${targetMember.user.username}** (${passaporte}). Punições aplicadas: ${punitionLog.length > 0 ? punitionLog.join(', ') : 'nenhuma'}`,
    ephemeral: true
  });
}

export default {
  data: command,
  execute,
  handleModal
};
