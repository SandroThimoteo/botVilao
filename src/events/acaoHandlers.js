import { EmbedBuilder } from 'discord.js';
import { createAcaoEmbed } from './acaoPanel.js';

/**
 * Handler para o select menu de ações
 */
export async function handleSelect(client, interaction) {
  if (interaction.customId !== 'select_acao') return;

  await interaction.deferUpdate();
  
  const acaoData = JSON.parse(interaction.values[0]);
  
  try {
    const message = await createAcaoEmbed(client, interaction, acaoData);
    
    await interaction.followUp({
      content: `✅ Ação **${acaoData.nome}** criada com sucesso! ${message.url}`,
      ephemeral: true
    });
  } catch (error) {
    console.error('[Ação] Erro ao criar ação:', error);
    await interaction.followUp({
      content: '❌ Erro ao criar a ação!',
      ephemeral: true
    });
  }
}

/**
 * Handler para os botões das ações
 */
export async function handleButton(client, interaction) {
  // 1. Deferir a interação imediatamente para evitar timeout
  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const [action, acaoId] = interaction.customId.split('_');
  
  // Buscar ação no banco de dados
  const acao = await client.db.getAcao(acaoId);
  
  if (!acao) {
    return interaction.editReply({
      content: '❌ Ação não encontrada!',
      ephemeral: true
    });
  }

  // 2. BUSCAR O MEMBRO COMPLETO
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

  if (!member) {
      return interaction.editReply({
          content: '❌ Não foi possível encontrar seu perfil de membro no servidor.',
          ephemeral: true
      });
  }

  // 3. VERIFICAÇÃO DE CARGO DE STAFF COM O MEMBRO COMPLETO
  // Usa a lógica corrigida para verificar se o membro possui qualquer um dos IDs de staff
  const hasStaffRole = client.config.staffRoleId.some(roleId => member.roles.cache.has(roleId));
  
  const isComandante = interaction.user.id === acao.comandanteId;

  // Ações restritas ao comandante ou staff
  if (['vitoria', 'derrota', 'fuga', 'cancelar'].includes(action)) {
    if (!isComandante && !hasStaffRole) {
      return interaction.editReply({
        content: '❌ Apenas o comandante da ação ou staff podem executar esta ação!',
        ephemeral: true
      });
    }
  }

  switch (action) {
    case 'participar':
      await handleParticipar(client, interaction, acao);
      break;
    case 'remover':
      await handleRemover(client, interaction, acao);
      break;
    case 'vitoria':
      await handleResultado(client, interaction, acao, 'vitoria');
      break;
    case 'derrota':
      await handleResultado(client, interaction, acao, 'derrota');
      break;
    case 'fuga':
      await handleFuga(client, interaction, acao);
      break;
    case 'cancelar':
      await handleCancelar(client, interaction, acao);
      break;
  }
}

async function handleParticipar(client, interaction, acao) {
  // ... (restante da função handleParticipar)
  const userId = interaction.user.id;
  
  if (acao.participantes.includes(userId)) {
    return interaction.editReply({
      content: '❌ Você já está participando desta ação!',
      ephemeral: true
    });
  }

  // Verificar se atingiu o máximo de participantes
  if (acao.participantes.length >= acao.maxParticipantes) {
    return interaction.editReply({
      content: `❌ Esta ação já atingiu o número máximo de participantes (${acao.maxParticipantes})!`,
      ephemeral: true
    });
  }

  // Adicionar participante
  acao.participantes.push(userId);
  await client.db.updateAcao(acao.acaoId, { participantes: acao.participantes });

  // Atualizar embed
  await updateAcaoEmbed(client, interaction, acao);
  
  await interaction.editReply({
    content: '✅ Você foi adicionado à ação!',
    ephemeral: true
  });
}

async function handleRemover(client, interaction, acao) {
  // ... (restante da função handleRemover)
  const userId = interaction.user.id;
  
  if (userId === acao.comandanteId) {
    return interaction.editReply({
      content: '❌ O comandante não pode sair da própria ação!',
      ephemeral: true
    });
  }

  if (!acao.participantes.includes(userId)) {
    return interaction.editReply({
      content: '❌ Você não está participando desta ação!',
      ephemeral: true
    });
  }

  // Remover participante
  acao.participantes = acao.participantes.filter(id => id !== userId);
  await client.db.updateAcao(acao.acaoId, { participantes: acao.participantes });

  // Atualizar embed
  await updateAcaoEmbed(client, interaction, acao);
  
  await interaction.editReply({
    content: '✅ Você foi removido da ação!',
    ephemeral: true
  });
}

async function handleResultado(client, interaction, acao, resultado) {
  // ... (restante da função handleResultado)
  if (acao.status !== 'em_andamento') {
    return interaction.editReply({
      content: '❌ Esta ação já foi finalizada!',
      ephemeral: true
    });
  }

  // Atualizar status
  await client.db.updateAcao(acao.acaoId, { 
    status: resultado,
    dataFim: Date.now()
  });
  
  acao.status = resultado;

  // Atualizar embed
  await updateAcaoEmbed(client, interaction, acao, true);
  
  const emoji = resultado === 'vitoria' ? '🏆' : '💀';
  await interaction.editReply({
    content: `${emoji} Ação finalizada com **${resultado.toUpperCase()}**!`,
    ephemeral: false
  });
}

async function handleFuga(client, interaction, acao) {
  // ... (restante da função handleFuga)
  if (acao.status !== 'em_andamento') {
    return interaction.editReply({
      content: '❌ Esta ação já foi finalizada!',
      ephemeral: true
    });
  }

  // Alternar entre Tiro e Fuga
  const tipoAtual = acao.tipoAcao || 'tiro';
  const novoTipo = tipoAtual === 'tiro' ? 'fuga' : 'tiro';
  
  // Atualizar no banco de dados
  await client.db.updateAcao(acao.acaoId, { tipoAcao: novoTipo });
  acao.tipoAcao = novoTipo;

  // Atualizar embed
  await updateAcaoEmbed(client, interaction, acao);
  
  const emoji = novoTipo === 'fuga' ? '🚗' : '🎯';
  const tipoNome = novoTipo === 'fuga' ? 'Fuga' : 'Tiro';
  
  await interaction.editReply({
    content: `${emoji} Tipo da ação atualizado para **${tipoNome}**!`,
    ephemeral: true
  });
}

async function handleCancelar(client, interaction, acao) {
  // ... (restante da função handleCancelar)
  try {
    // Deletar mensagem
    await interaction.message.delete();
    
    // Remover do banco de dados
    await client.db.deleteAcao(acao.acaoId);
    
    await interaction.editReply({
      content: '🗑️ Ação cancelada e removida com sucesso!',
      ephemeral: true
    });
  } catch (error) {
    console.error('[Ação] Erro ao cancelar ação:', error);
    await interaction.editReply({
      content: '❌ Erro ao cancelar a ação!',
      ephemeral: true
    });
  }
}

async function updateAcaoEmbed(client, interaction, acao, finalizada = false) {
  // ... (restante da função updateAcaoEmbed)
  const guild = interaction.guild;
  const comandante = await guild.members.fetch(acao.comandanteId);
  
  // Buscar todos os participantes
  const participantesTexto = await Promise.all(
    acao.participantes.map(async (id) => {
      try {
        const member = await guild.members.fetch(id);
        return member.toString();
      } catch {
        return `<@${id}>`;
      }
    })
  );

  let resultadoTexto = '⏳ Em andamento';
  let embedColor = '#FF6B00';
  
  if (acao.status === 'vitoria') {
    resultadoTexto = '🏆 Vitória';
    embedColor = '#00FF00';
  } else if (acao.status === 'derrota') {
    resultadoTexto = '💀 Derrota';
    embedColor = '#FF0000';
  }

  const qtdParticipantesTexto = `${acao.participantes.length}/${acao.minParticipantes}-${acao.maxParticipantes}`;

  // Definir tipo da ação (Tiro ou Fuga)
  const tipoAcao = acao.tipoAcao || 'tiro';
  const tipoTexto = tipoAcao === 'fuga' ? '🚗 Fuga' : '🎯 Tiro';

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`${acao.acaoNome} - Nº ${acao.acaoId}`)
    .addFields(
      { name: 'Comando da ação:', value: `${comandante}`, inline: false },
      { name: 'Data Iniciado:', value: `${new Date(acao.dataInicio).toLocaleString('pt-BR')}`, inline: false },
      { name: 'Qtd. Participantes', value: qtdParticipantesTexto, inline: true },
      { name: 'Tipo da Ação', value: tipoTexto, inline: true },
      { name: 'Resultado', value: resultadoTexto, inline: true },
      { name: '\nParticipantes', value: participantesTexto.join('\n') || 'Nenhum', inline: false }
    )
    .setFooter({ text: `Atualizado ${new Date().toLocaleString('pt-BR')}` })
    .setTimestamp();

  // Se a ação foi finalizada, remover os botões
  if (finalizada) {
    await interaction.message.edit({
      embeds: [embed],
      components: []
    });
  } else {
    await interaction.message.edit({
      embeds: [embed]
    });
  }
}
