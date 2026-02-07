import advertenciaTracker from './advertenciaTracker.js';
import config from '../config.js';

/**
 * Verifica e processa:
 * 1. Advertências expiradas (>30 dias) - remove dos membros
 * 2. Exonerações agendadas (passaram 7 dias) - expulsa membros
 */
export async function checkExpiredAdvertenciasAndExoneracoes(client) {
  try {
    console.log('[ExpirationChecker] Iniciando verificação de advertências expiradas e exonerações...');

    // 1️⃣ VERIFICAR ADVERTÊNCIAS EXPIRADAS
    const expiredAdvs = advertenciaTracker.getExpiredAdvertencias();
    if (expiredAdvs.length > 0) {
      console.log(`[ExpirationChecker] Encontrado ${expiredAdvs.length} advertência(s) expirada(s)`);

      for (const expired of expiredAdvs) {
        try {
          // Encontrar o servidor (Guild)
          const guilds = client.guilds.cache;
          for (const guild of guilds.values()) {
            try {
              const member = await guild.members.fetch(expired.userId).catch(() => null);
              if (member) {
                // Remover o cargo de advertência expirado
                await member.roles.remove(expired.roleId, 'Advertência expirada (30 dias)').catch(() => {});
                advertenciaTracker.removeAdvertencia(expired.userId, expired.level);
                console.log(`[ExpirationChecker] ✅ Removida advertência nível ${expired.level} de ${member.user.tag}`);
                break;
              }
            } catch (e) {
              // Continuar para próximo servidor
            }
          }
        } catch (e) {
          console.error(`[ExpirationChecker] Erro ao processar advertência expirada:`, e);
        }
      }
    }

    // 2️⃣ VERIFICAR EXONERAÇÕES AGENDADAS
    const dueExoneracoes = advertenciaTracker.getDueExoneracoes();
    if (dueExoneracoes.length > 0) {
      console.log(`[ExpirationChecker] Encontrado ${dueExoneracoes.length} exoneração(ões) a processar`);

      for (const exon of dueExoneracoes) {
        console.log(`[ExpirationChecker] DEBUG Exoneração: userId=${exon.userId}, scheduledFor=${exon.scheduledFor}, agora=${Date.now()}, diferença=${exon.scheduledFor - Date.now()}ms`);
      }

      for (const exon of dueExoneracoes) {
        try {
          const guild = client.guilds.cache.get(exon.guildId);
          if (!guild) {
            console.warn(`[ExpirationChecker] Servidor ${exon.guildId} não encontrado`);
            continue;
          }

          let member = null;
          try {
            member = await guild.members.fetch(exon.userId);
          } catch (fetchError) {
            console.warn(`[ExpirationChecker] Membro ${exon.userId} não encontrado no servidor ${exon.guildId}:`, fetchError.message);
            member = null;
          }
          
          if (member) {
            try {
              // Expulsar membro
              await member.kick(`Exoneração automática - Limite de advertências. Processado por ${exon.processedBy}`);
              console.log(`[ExpirationChecker] ✅ ${member.user.tag} foi removido do servidor (exoneração)`);

              // Enviar notificação no canal de log
              const logChannel = guild.channels.cache.get(config.channelLogExoneracao);
              if (logChannel) {
                await logChannel.send({
                  content: `🔴 **${member.user.tag}** foi removido do servidor - Exoneração automática por limite de advertências.`
                }).catch(() => {});
              }
            } catch (error) {
              console.error(`[ExpirationChecker] Erro ao expulsar ${member.user.tag}:`, error);
            }

            // Remover exoneração do rastreamento
            advertenciaTracker.removeExoneracao(exon.userId);
          } else {
            console.warn(`[ExpirationChecker] Membro ${exon.userId} não encontrado no servidor ${exon.guildId}`);
            advertenciaTracker.removeExoneracao(exon.userId);
          }
        } catch (e) {
          console.error(`[ExpirationChecker] Erro ao processar exoneração agendada:`, e);
        }
      }
    }

    if (expiredAdvs.length === 0 && dueExoneracoes.length === 0) {
      console.log('[ExpirationChecker] Nenhuma advertência expirada ou exoneração pendente.');
    }
  } catch (e) {
    console.error('[ExpirationChecker] Erro geral na verificação:', e);
  }
}

/**
 * Inicializa verificações periódicas
 * Execute uma vez no evento 'ready' do bot
 */
export function startExpirationChecker(client, intervalMs = 60 * 60 * 1000) {
  // Executar na primeira vez imediatamente
  checkExpiredAdvertenciasAndExoneracoes(client).catch(console.error);

  // Executar periodicamente (padrão: a cada 1 hora)
  setInterval(() => {
    checkExpiredAdvertenciasAndExoneracoes(client).catch(console.error);
  }, intervalMs);

  console.log('[ExpirationChecker] ✅ Verificador de expiração iniciado (intervalo: ' + (intervalMs / 1000 / 60) + ' minutos)');
}
