import fs from 'fs';
import path from 'path';

const trackerPath = path.join(process.cwd(), 'data', 'advertencias_log.json');

/**
 * Estrutura do arquivo advertencias_log.json:
 * {
 *   "userId": {
 *     "adv1": { roleId: "...", addedAt: timestamp, expiresAt: timestamp },
 *     "adv2": { roleId: "...", addedAt: timestamp, expiresAt: timestamp },
 *     "exoneracoes_agendadas": [
 *       { userId: "...", guildId: "...", scheduledFor: timestamp, processedBy: "..." }
 *     ]
 *   }
 * }
 */

class AdvertenciaTracker {
  constructor() {
    this.ensureFileExists();
  }

  ensureFileExists() {
    if (!fs.existsSync(trackerPath)) {
      fs.writeFileSync(trackerPath, JSON.stringify({}, null, 2));
    }
  }

  readData() {
    try {
      const data = fs.readFileSync(trackerPath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('[AdvertenciaTracker] Erro ao ler arquivo:', e);
      return {};
    }
  }

  writeData(data) {
    try {
      fs.writeFileSync(trackerPath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('[AdvertenciaTracker] Erro ao escrever arquivo:', e);
    }
  }

  /**
   * Registra uma advertência com timestamp
   */
  addAdvertencia(userId, advLevel, roleId) {
    const data = this.readData();
    if (!data[userId]) {
      data[userId] = { adv1: null, adv2: null, exoneracoes_agendadas: [] };
    }

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    if (advLevel === 1) {
      data[userId].adv1 = {
        roleId,
        addedAt: now,
        expiresAt: now + thirtyDaysMs
      };
    } else if (advLevel === 2) {
      data[userId].adv2 = {
        roleId,
        addedAt: now,
        expiresAt: now + thirtyDaysMs
      };
    }

    this.writeData(data);
  }

  /**
   * Remove uma advertência do rastreamento
   */
  removeAdvertencia(userId, advLevel) {
    const data = this.readData();
    if (data[userId]) {
      if (advLevel === 1) {
        data[userId].adv1 = null;
      } else if (advLevel === 2) {
        data[userId].adv2 = null;
      }
      this.writeData(data);
    }
  }

  /**
   * Agenda uma exoneração automática
   */
  scheduleExoneracao(userId, guildId, processedBy) {
    const data = this.readData();
    if (!data[userId]) {
      data[userId] = { adv1: null, adv2: null, exoneracoes_agendadas: [] };
    }

    data[userId].exoneracoes_agendadas.push({
      userId,
      guildId,
      scheduledFor: Date.now() + 5000, // ⏱️ TESTE: 5 segundos (em produção: 7 * 24 * 60 * 60 * 1000)
      processedBy,
      createdAt: Date.now()
    });

    this.writeData(data);
  }

  /**
   * Remove a primeira exoneração agendada (FIFO - primeira a entrar, primeira a sair)
   */
  removeExoneracao(userId) {
    const data = this.readData();
    if (data[userId] && data[userId].exoneracoes_agendadas && Array.isArray(data[userId].exoneracoes_agendadas)) {
      // Remove apenas a primeira exoneração da fila
      data[userId].exoneracoes_agendadas.shift();
      this.writeData(data);
    }
  }

  /**
   * Retorna advertências expiradas (>30 dias)
   */
  getExpiredAdvertencias() {
    const data = this.readData();
    const expired = [];
    const now = Date.now();

    for (const [userId, info] of Object.entries(data)) {
      if (info.adv1 && info.adv1.expiresAt < now) {
        expired.push({ userId, level: 1, roleId: info.adv1.roleId });
      }
      if (info.adv2 && info.adv2.expiresAt < now) {
        expired.push({ userId, level: 2, roleId: info.adv2.roleId });
      }
    }

    return expired;
  }

  /**
   * Retorna exonerações que devem ser processadas (passaram 7 dias)
   */
  getDueExoneracoes() {
    const data = this.readData();
    const due = [];
    const now = Date.now();

    for (const [userId, info] of Object.entries(data)) {
      if (info.exoneracoes_agendadas && Array.isArray(info.exoneracoes_agendadas)) {
        const dueItems = info.exoneracoes_agendadas.filter(e => e.scheduledFor <= now);
        due.push(...dueItems);
      }
    }

    return due;
  }

  /**
   * Retorna informações de advertência de um usuário
   */
  getAdvertenciaInfo(userId) {
    const data = this.readData();
    return data[userId] || { adv1: null, adv2: null, exoneracoes_agendadas: [] };
  }
}

export default new AdvertenciaTracker();
