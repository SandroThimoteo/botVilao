import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

export default class Database {
  constructor(file) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new sqlite3.Database(file);
    this.init();
  }

  init() {
    this.db.serialize(() => {
      // ⚡ Otimizações
      this.db.run("PRAGMA journal_mode = WAL;");
      this.db.run("PRAGMA synchronous = NORMAL;");
      this.db.run("PRAGMA cache_size = -2000;");
      this.db.run("PRAGMA temp_store = MEMORY;");
      this.db.run("PRAGMA foreign_keys = ON;");
      this.db.run("PRAGMA optimize;");

      // Tickets
      this.db.run(`CREATE TABLE IF NOT EXISTS tickets (
        guildId TEXT,
        channelId TEXT,
        userId TEXT,
        category TEXT,
        closed INTEGER DEFAULT 0,
        reopened INTEGER DEFAULT 0,
        transcript TEXT,
        closedAt INTEGER
      )`);

      this.db.run(`ALTER TABLE tickets ADD COLUMN closedAt INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Erro ao adicionar coluna closedAt:', err.message);
        }
      });

      // Mensagens fixas do bot
      this.db.run(`CREATE TABLE IF NOT EXISTS postedMessages (
        guildId TEXT,
        channelId TEXT,
        messageId TEXT
      )`);

      // Tabela de Ações
      this.db.run(`CREATE TABLE IF NOT EXISTS acoes (
        acaoId TEXT PRIMARY KEY,
        messageId TEXT,
        acaoNome TEXT,
        comandanteId TEXT,
        participantes TEXT,
        status TEXT,
        dataInicio INTEGER,
        dataFim INTEGER,
        minParticipantes INTEGER,
        maxParticipantes INTEGER,
        tipoAcao TEXT DEFAULT 'tiro'
      )`);

      // Tabela de Ausências
      this.db.run(`CREATE TABLE IF NOT EXISTS ausencias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        start_date INTEGER NOT NULL,
        return_date INTEGER NOT NULL,
        reminded INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )`);

      // Índices para melhor performance
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_ausencias_user 
        ON ausencias(user_id, guild_id)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_ausencias_return 
        ON ausencias(return_date)`);
    });
  }

  // =====================
  // TICKETS
  // =====================

  createTicket(guildId, channelId, userId, category) {
    this.db.run(
      `INSERT INTO tickets (guildId, channelId, userId, category, closed, reopened) VALUES (?, ?, ?, ?, 0, 0)`,
      [guildId, channelId, userId, category]
    );
  }

  closeTicket(guildId, channelId, transcriptPath) {
    const timestamp = Date.now();
    this.db.run(
      `UPDATE tickets SET closed = 1, transcript = ?, closedAt = ? WHERE guildId = ? AND channelId = ?`,
      [transcriptPath, timestamp, guildId, channelId]
    );
  }

  reopenTicket(guildId, oldChannelId, newChannelId) {
    this.db.run(
      `UPDATE tickets SET closed = 0, reopened = 1, channelId = ? WHERE guildId = ? AND channelId = ?`,
      [newChannelId, guildId, oldChannelId]
    );
  }

  getTicket(guildId, channelId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM tickets WHERE guildId = ? AND channelId = ?`,
        [guildId, channelId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  getAllOpenTickets() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM tickets WHERE closed = 0`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // =====================
  // MENSAGENS POSTADAS
  // =====================

  addPostedMessage(guildId, channelId, messageId) {
    this.db.run(
      `INSERT INTO postedMessages (guildId, channelId, messageId) VALUES (?, ?, ?)`,
      [guildId, channelId, messageId]
    );
  }

  getPostedMessage(guildId, channelId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM postedMessages WHERE guildId = ? AND channelId = ?`,
        [guildId, channelId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  updateTicketMessageId(channelId, messageId) {
    // Se já existe, atualiza. Se não, insere.
    this.db.run(
      `INSERT INTO postedMessages (guildId, channelId, messageId)
       VALUES ((SELECT guildId FROM tickets WHERE channelId = ?), ?, ?)
       ON CONFLICT(channelId) DO UPDATE SET messageId = excluded.messageId`,
      [channelId, channelId, messageId]
    );
  }

  // =====================
  // SISTEMA DE AÇÕES
  // =====================

  createAcao(data) {
    return new Promise((resolve, reject) => {
      const participantesJson = JSON.stringify(data.participantes);
      
      this.db.run(
        `INSERT INTO acoes (
          acaoId, messageId, acaoNome, comandanteId, participantes, 
          status, dataInicio, minParticipantes, maxParticipantes, tipoAcao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.acaoId,
          data.messageId,
          data.acaoNome,
          data.comandanteId,
          participantesJson,
          data.status,
          data.dataInicio,
          data.minParticipantes,
          data.maxParticipantes,
          data.tipoAcao || 'tiro'
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  getAcao(acaoId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM acoes WHERE acaoId = ?`,
        [acaoId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row) {
            // Converter participantes de JSON string para array
            row.participantes = JSON.parse(row.participantes);
            resolve(row);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  updateAcao(acaoId, updates) {
    return new Promise((resolve, reject) => {
      // Construir query dinamicamente baseado nos campos a atualizar
      const fields = [];
      const values = [];

      if (updates.participantes !== undefined) {
        fields.push('participantes = ?');
        values.push(JSON.stringify(updates.participantes));
      }
      if (updates.status !== undefined) {
        fields.push('status = ?');
        values.push(updates.status);
      }
      if (updates.dataFim !== undefined) {
        fields.push('dataFim = ?');
        values.push(updates.dataFim);
      }
      if (updates.tipoAcao !== undefined) {
        fields.push('tipoAcao = ?');
        values.push(updates.tipoAcao);
      }

      if (fields.length === 0) {
        return resolve();
      }

      values.push(acaoId);
      const query = `UPDATE acoes SET ${fields.join(', ')} WHERE acaoId = ?`;

      this.db.run(query, values, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  deleteAcao(acaoId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM acoes WHERE acaoId = ?`,
        [acaoId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  getAllAcoes() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM acoes`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            // Converter participantes de JSON para array em cada linha
            rows.forEach(row => {
              row.participantes = JSON.parse(row.participantes);
            });
            resolve(rows);
          }
        }
      );
    });
  }

  getAcoesEmAndamento() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM acoes WHERE status = 'em_andamento'`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            rows.forEach(row => {
              row.participantes = JSON.parse(row.participantes);
            });
            resolve(rows);
          }
        }
      );
    });
  }

  // =====================
  // SISTEMA DE AUSÊNCIAS
  // =====================

  // Método auxiliar síncrono para get
  get(query, params) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Método auxiliar síncrono para run
  run(query, params) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  // Método auxiliar para all
  all(query, params) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}