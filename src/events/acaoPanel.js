import { 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';

// Lista de ações pré-definidas com quantidade de participantes
const ACOES = [
  { nome: 'Barbearia', minParticipantes: 2, maxParticipantes: 4 },
  { nome: 'Ammunation', minParticipantes: 2, maxParticipantes: 4 },
  { nome: 'Atom Food', minParticipantes: 2, maxParticipantes: 4 },
  { nome: 'Bebidas Samir', minParticipantes: 2, maxParticipantes: 4 },
  { nome: 'Comedy Club', minParticipantes: 2, maxParticipantes: 7 },
  { nome: 'Galinheiro', minParticipantes: 2, maxParticipantes: 9 },
  { nome: 'Loja de Departamentos', minParticipantes: 2, maxParticipantes: 6 },
  { nome: 'Yellow Jack', minParticipantes: 2, maxParticipantes: 6 },
  { nome: 'Mergulhador', minParticipantes: 2, maxParticipantes: 8 },
  { nome: 'Aeroporto Abandonado', minParticipantes: 2, maxParticipantes: 8 },

  { nome: 'Açougue', minParticipantes: 2, maxParticipantes: 9 },
  { nome: 'Fleeca Life', minParticipantes: 2, maxParticipantes: 12 },
  { nome: 'Banco Fleeca', minParticipantes: 2, maxParticipantes: 10 },
  { nome: 'Joalheria', minParticipantes: 2, maxParticipantes: 9 },
  { nome: 'Pink Hotel', minParticipantes: 2, maxParticipantes: 9 },
  { nome: 'Estacionamento Marrom', minParticipantes: 2, maxParticipantes: 10 },
  
  { nome: 'Banco Paleto Bay', minParticipantes: 2, maxParticipantes: 14 },
  { nome: 'Niobio', minParticipantes: 2, maxParticipantes: 20 },
  { nome: 'Banco Central', minParticipantes: 2, maxParticipantes: 13 },
];

// contador global de ações
let totalAcoes = 0;

/**
 * Inicializa o contador de ações com base no banco de dados
 */
async function initContador(client) {
  try {
    const acoes = await client.db.getAllAcoes();
    if (acoes && acoes.length > 0) {
      // Pegar o maior ID numérico das ações existentes
      const maiorId = Math.max(...acoes.map(a => parseInt(a.acaoId) || 0));
      totalAcoes = maiorId;
      console.log(`[Ação] 📊 Contador inicializado com ${totalAcoes} ações`);
    }
  } catch (error) {
    console.error('[Ação] Erro ao inicializar contador:', error);
  }
}

/**
 * Envia o painel de ações automaticamente no canal configurado
 */
export async function init(client) {
  try {
    // Inicializar contador baseado no banco de dados
    await initContador(client);

    const channelId = client.config.channelAcaoEmbed;
    if (!channelId) {
      console.error('[Ação] ❌ CHANNEL_ACAO_EMBED não está configurado no .env');
      return;
    }

    const channel = client.channels.cache.get(channelId);
    if (!channel) {
      console.error(`[Ação] ❌ Canal ${channelId} não encontrado.`);
      return;
    }

    // Criar o select menu com as ações
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_acao')
      .setPlaceholder('Selecione a ação')
      .addOptions(
        ACOES.map(acao => ({
          label: acao.nome,
          description: `Participantes: ${acao.minParticipantes}-${acao.maxParticipantes}`,
          value: JSON.stringify({ nome: acao.nome, min: acao.minParticipantes, max: acao.maxParticipantes }),
          emoji: '🚔'
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setColor('#131416')
      .setTitle('CRIAR RELATÓRIO DE AÇÃO')
      .setDescription('Selecione a ação sendo realizada e peça para os oficiais reagirem na sala <#1428418780656308404>.')
      .addFields({
        name: 'LISTA DE AÇÕES',
        value: ACOES.map(a => `**${a.nome}**`).join('\n')
      })
      .setFooter({ text: `Atualizado ${new Date().toLocaleString('pt-BR')}` })
      .setTimestamp();

    // Buscar mensagens recentes do canal (até 100)
    const messages = await channel.messages.fetch({ limit: 100 });
    
    // Procurar por mensagem existente do bot com o título correto
    const existingPanel = messages.find(m => 
      m.author.id === client.user.id && 
      m.embeds.length > 0 &&
      m.embeds[0].title === 'CRIAR RELATÓRIO DE AÇÃO'
    );

    if (existingPanel) {
      // Se encontrou, apenas edita
      await existingPanel.edit({ embeds: [embed], components: [row] });
      console.log('[Ação] ✅ Painel de ações atualizado (mensagem existente editada)');
    } else {
      // Se não encontrou, envia nova mensagem
      await channel.send({ embeds: [embed], components: [row] });
      console.log('[Ação] ✅ Painel de ações criado (nova mensagem enviada)');
    }
  } catch (error) {
    console.error('[Ação] ❌ Erro ao enviar/atualizar painel de ações:', error);
  }
}

/**
 * Criar a embed da ação no canal de log
 */
export async function createAcaoEmbed(client, interaction, acaoData) {
  totalAcoes++; 
  const numeroAcao = totalAcoes;
  const comandante = interaction.user;
  const { nome: acaoNome, min: minParticipantes, max: maxParticipantes } = acaoData;

  const embed = new EmbedBuilder()
    .setColor('#131416')
    .setTitle(`${acaoNome} - Nº ${numeroAcao}`)
    .addFields(
      { name: 'Comando da ação:', value: `${comandante}`, inline: false },
      { name: 'Data Iniciado:', value: `${new Date().toLocaleString('pt-BR')}`, inline: false },
      { name: 'Qtd. Participantes', value: `1/${minParticipantes}-${maxParticipantes}`, inline: true },
      { name: 'Tipo da Ação', value: '🚔 Tiro', inline: true },
      { name: 'Resultado', value: '⏳ Em andamento', inline: true },
      { name: '\nParticipantes', value: `${comandante}`, inline: false }
    )
    .setFooter({ text: `Atualizado ${new Date().toLocaleString('pt-BR')}` })
    .setTimestamp();

  // === BOTÕES EM DUAS ACTIONROWS ===
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`participar_${numeroAcao}`)
      .setLabel('Estou Participando')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`remover_${numeroAcao}`)
      .setLabel('Me remova da lista')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌'),
    new ButtonBuilder()
      .setCustomId(`vitoria_${numeroAcao}`)
      .setLabel('Vitória')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🏆'),
    new ButtonBuilder()
      .setCustomId(`derrota_${numeroAcao}`)
      .setLabel('Derrota')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('💀'),
    new ButtonBuilder()
      .setCustomId(`fuga_${numeroAcao}`)
      .setLabel('Marcar como Fuga')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🏃')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cancelar_${numeroAcao}`)
      .setLabel('Cancelar Ação')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🗑️')
  );

  const channel = client.channels.cache.get(client.config.channelAcaoLog);
  if (!channel) throw new Error('Canal de log de ações não configurado!');

  const message = await channel.send({
    content: `<@${interaction.user.id}> Nova ação iniciada, não esqueça de finalizar!`,
    embeds: [embed],
    components: [row1, row2]
  });

  // Salvar no banco (se estiver usando)
  await client.db.createAcao({
    acaoId: numeroAcao.toString(),
    messageId: message.id,
    acaoNome,
    comandanteId: comandante.id,
    participantes: [comandante.id],
    status: 'em_andamento',
    dataInicio: Date.now(),
    minParticipantes,
    maxParticipantes
  });

  return message;
}

/**
 * Função para cancelar/excluir ação
 */
export async function cancelarAcao(numeroAcao) {
  totalAcoes--;
  if (totalAcoes < 0) totalAcoes = 0;
  console.log(`[Ação] 🗑️ Ação Nº ${numeroAcao} cancelada. Total agora: ${totalAcoes}`);
}

/**
 * Atualizar embed da ação
 */
export async function updateAcaoEmbed(client, acaoId, acaoData) {
  try {
    const channel = client.channels.cache.get(client.config.channelAcaoLog);
    if (!channel) return;

    const message = await channel.messages.fetch(acaoData.messageId);
    if (!message) return;

    const participantesTexto = acaoData.participantes.length > 0
      ? (await Promise.all(
          acaoData.participantes.map(async id => {
            try {
              const user = await client.users.fetch(id);
              return `<@${id}>`;
            } catch {
              return `<@${id}>`;
            }
          })
        )).join('\n')
      : 'Nenhum participante';

    const embed = new EmbedBuilder()
      .setColor('#131416')
      .setTitle(`${acaoData.acaoNome} - Nº ${acaoId}`)
      .addFields(
        { name: 'Comando da ação:', value: `<@${acaoData.comandanteId}>`, inline: false },
        { name: 'Data Iniciado:', value: `${new Date(acaoData.dataInicio).toLocaleString('pt-BR')}`, inline: false },
        { 
          name: 'Qtd. Participantes', 
          value: `${acaoData.participantes.length}/${acaoData.minParticipantes}-${acaoData.maxParticipantes}`, 
          inline: true 
        },
        { name: 'Tipo da Ação', value: acaoData.tipoAcao === 'perseguicao' ? '🚓 Perseguição' : '🚔 Tiro', inline: true },
        { 
          name: 'Resultado', 
          value: acaoData.status === 'vitoria' ? '🏆 Vitória' :
                 acaoData.status === 'derrota' ? '💀 Derrota' :
                 acaoData.status === 'fuga' ? '🏃 Fuga' :
                 '⏳ Em andamento',
          inline: true 
        },
        { name: '\nParticipantes', value: participantesTexto, inline: false }
      )
      .setFooter({ text: `Atualizado ${new Date().toLocaleString('pt-BR')}` })
      .setTimestamp();

    // Manter os botões se ainda em andamento
    if (acaoData.status === 'em_andamento') {
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`participar_${acaoId}`)
          .setLabel('Estou Participando')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`remover_${acaoId}`)
          .setLabel('Me remova da lista')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌'),
        new ButtonBuilder()
          .setCustomId(`vitoria_${acaoId}`)
          .setLabel('Vitória')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🏆'),
        new ButtonBuilder()
          .setCustomId(`derrota_${acaoId}`)
          .setLabel('Derrota')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('💀'),
        new ButtonBuilder()
          .setCustomId(`fuga_${acaoId}`)
          .setLabel('Marcar como Fuga')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🏃')
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`cancelar_${acaoId}`)
          .setLabel('Cancelar Ação')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🗑️')
      );

      await message.edit({ embeds: [embed], components: [row1, row2] });
    } else {
      // Remover botões se finalizada
      await message.edit({ embeds: [embed], components: [] });
    }
  } catch (error) {
    console.error('[Ação] Erro ao atualizar embed:', error);
  }
}

/**
 * Finalizar ação (vitória, derrota ou fuga)
 */
export async function finalizarAcao(client, acaoId, resultado) {
  try {
    const acaoData = await client.db.getAcao(acaoId);
    if (!acaoData) return;

    acaoData.status = resultado;
    acaoData.dataFim = Date.now();

    await client.db.updateAcao(acaoId, {
      status: resultado,
      dataFim: Date.now()
    });

    await updateAcaoEmbed(client, acaoId, acaoData);
  } catch (error) {
    console.error('[Ação] Erro ao finalizar ação:', error);
  }
}

export default { init, createAcaoEmbed, updateAcaoEmbed, finalizarAcao, cancelarAcao };