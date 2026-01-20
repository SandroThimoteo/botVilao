import { StringSelectMenuBuilder, ActionRowBuilder } from 'discord.js';

export function createTicketSelect() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticketSelect')
      .setPlaceholder('Selecione uma Categoria')
      .addOptions([
        {
          label: 'Suporte',
          description: 'Peça ajuda ou tire suas dúvidas',
          value: 'Suporte',
          emoji: '<:suporte:1422328020806402108>'
        },
        {
          label: 'Curso',
          description: 'Solicitação ou informações de curso',
          value: 'Curso',
          emoji: '<:curso:1422311480727965726>'
        },
        {
          label: 'Corregedoria',
          description: 'Denúncias ou solicitações formais',
          value: 'Corregedoria',
          emoji: '<:corregedoria:1422328554938564649>'
        }
      ])
  );
}
