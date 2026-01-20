// config.js
import dotenv from "dotenv";
dotenv.config();

export default {
  // 🔑 Token
  token: process.env.TOKEN,

  // 🎫 Sistema de tickets
  staffRoleId: process.env.STAFF_ROLE_ID ? process.env.STAFF_ROLE_ID.split(",").map(id => id.trim()) : [],
  channelTicket: process.env.CHANNEL_TICKET,
  logTicket: process.env.LOG_TICKET,

  // 🎯 Sistema de Ações
  policeId: process.env.POLICE_ID || null,
  channelAcaoEmbed: process.env.CHANNEL_ACAO_EMBED || null,  // Canal para o painel de seleção
  channelAcaoLog: process.env.CHANNEL_ACAO_LOG || null,      // Canal para logs das ações

  // 📋 Sistema de registro policial
  channelRegister: process.env.CHANNEL_REGISTER,
  channelLogRegister: process.env.CHANNEL_LOG_REGISTER,
  role1Id: process.env.ROLE1_ID,
  role2Id: process.env.ROLE2_ID,

  // 👮 Staff para aprovar/reprovar registro (pode ser lista separada por vírgula)
  staffRoleInd: process.env.STAFF_ROLE_IND ? process.env.STAFF_ROLE_IND.split(",") : [],

  // 🔄 Sistema de atualização de registro
  channelIdAtt: process.env.CHANNEL_ID_ATT,
  channelLogAtt: process.env.CHANNEL_LOG_ATT,
  staffAttId: process.env.STAFF_ATT_ID ? process.env.STAFF_ATT_ID.split(",") : [],

  // Entrada e Saida
  channelEnter: process.env.CHANNEL_ENTER,
  channelExit: process.env.CHANNEL_EXIT,

  // 🎖️ Patentes e unidades
  patenteRoleIds: process.env.PATENTE_ROLE_IDS ? process.env.PATENTE_ROLE_IDS.split(",") : [],
  unidadeRoleIds: process.env.UNIDADE_ROLE_IDS ? process.env.UNIDADE_ROLE_IDS.split(",") : [],
  cursoRoleIds: process.env.CURSO_ROLE_IDS ? process.env.CURSO_ROLE_IDS.split(",") : [],

  // 📅 Sistema de Ausências
  ausenciaRoleId: process.env.AUSENCIA_ROLE_ID,
  channelLogAusencia: process.env.CHANNEL_LOG_AUSENCIA,

  // 🚪 Sistema de Exonerações
  staffExoneracaoId: process.env.STAFF_EXONERACAO_ID,
  channelLogExoneracao: process.env.CHANNEL_LOG_EXONERACAO,

  // 🎫 Mapeamento de Cargos por Categoria de Ticket
  ticketCategoryRoles: {
    "Suporte": ["1428418473205170366"],
    "Curso": ["1428418534160990340", "1428418473205170366"],
    "Corregedoria": ["1428418473205170366"],
  },
};