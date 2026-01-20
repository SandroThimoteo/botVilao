import { EmbedBuilder } from 'discord.js';

export function createTicketEmbed() {
  return new EmbedBuilder()
    .setAuthor({ name: 'Batalhão de Policia Militar Villa 2025' }) // Ícone + título em cima
    .setTitle(' ')
    .setDescription(
     '# Sistema de Atendimento | BPM-V.\n'+ 
      '**INFORMAÇÕES**\n' +
      'Quando abrir um ticket, por favor, **tenha em mente** tudo o que precisa ser informado para nossa equipe. ' +
      'Isso **permitirá** que o processo de **resolução** do problema seja mais **rápido e eficiente**.\n\n' +

      'Para abrir um **ticket**, clique no menu **Selecione uma Categoria** e escolha a categoria que melhor atenda suas necessidades.\n\n' +

      '**OBSERVAÇÕES**\n' +
      'Nosso prazo de resposta é de até **2 horas**, podendo em casos específicos, acarretar em um prazo maior devido a diversos fatores.\n\n' +

      '⚠️ **NÃO ABRA** tickets caso não seja realmente necessário, nossa equipe de atendimento preza pela comunidade e deseja fornecer a **melhor experiência** possível.'
    )
    .setColor('#131416') // fundo escuro parecido com da imagem
    .setImage('https://cdn.discordapp.com/attachments/1428418733734625315/1428427557455532142/Group_2.png?ex=68f27654&is=68f124d4&hm=8cd33b7cbd224f9b0a09a2ce5471eae54b1783deae03127458ae1de7d157cee6&') // imagem inferior
    .setFooter({ 
        text: "Polícia Militar APP • " + new Date().toLocaleDateString("pt-BR"),
         iconURL: "https://cdn.discordapp.com/attachments/1428418733734625315/1428427890529275944/BPMV.png?ex=68f276a4&is=68f12524&hm=68f254205a3f65ede78297ec501c17df084c640f312555b951d7179a7aeb6a36&"
    })
    .setTimestamp();
}