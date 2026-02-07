# 📘 Documentação Geral do Projeto

## 1. Visão Geral

Este projeto consiste no desenvolvimento de um **bot administrativo para Discord**, idealizado em **2025**, com o objetivo de **facilitar e centralizar a gestão administrativa** de um servidor de **GTA RP**, especificamente voltado para a **corporação policial**.

Desde o início, a proposta foi criar uma solução que fosse **prática, intuitiva e confiável**, reduzindo processos manuais, erros humanos e retrabalho por parte da equipe administrativa.

O bot foi pensado não apenas como um conjunto de comandos, mas como um **sistema administrativo completo**, capaz de evoluir conforme novas necessidades e diretrizes surgissem.

---

## 2. Contexto e Problema

Em servidores de GTA RP, principalmente aqueles com estruturas organizacionais complexas (como forças policiais), a administração envolve diversas tarefas repetitivas e sensíveis, como:

* Alteração de apelidos no Discord conforme patente ou função
* Gerenciamento de cargos e permissões
* Controle de ausências
* Exoneração de membros (remoção da corporação e/ou do servidor)
* Manutenção de registros administrativos
* Auditoria de ações administrativas

Antes do projeto, essas ações eram feitas **manualmente**, o que gerava:

* Perda de tempo
* Inconsistência de padrões
* Erros humanos
* Dificuldade de rastrear ações

O bot surge como resposta direta a esse cenário.

---

## 3. Objetivo do Projeto

O objetivo principal foi **automatizar e padronizar processos administrativos**, oferecendo uma ferramenta que:

* Seja fácil de usar, mesmo para usuários sem conhecimento técnico
* Centralize ações administrativas em um único local
* Garanta consistência nas regras aplicadas
* Registre ações para controle e histórico
* Seja facilmente extensível e mantida ao longo do tempo

---

## 4. Princípios do Projeto

Desde a concepção, alguns princípios guiaram o desenvolvimento:

* **Intuitividade**: qualquer administrador deve conseguir usar sem treinamento complexo
* **Praticidade**: menos cliques, menos comandos, mais resultado
* **Organização**: código e fluxos claros
* **Manutenção contínua**: preparado para mudanças futuras
* **Segurança**: ações sensíveis protegidas por permissões

---

## 5. Arquitetura da Solução

O bot foi desenvolvido em **Node.js**, utilizando a biblioteca **discord.js v14**, adotando uma **arquitetura modular**, separando responsabilidades de forma clara.

### Principais camadas:

* **Commands**: comandos de interação direta (Slash Commands)
* **Events**: escuta e resposta a eventos do Discord
* **Handlers**: tratamento específico de botões, menus e modais
* **Database**: persistência de dados administrativos

Essa separação permite:

* Fácil leitura do código
* Manutenção simplificada
* Inclusão rápida de novas funcionalidades

---

## 6. Experiência do Usuário (UX)

Um ponto central do projeto foi a **experiência do usuário administrativo**.

Em vez de exigir comandos longos ou complexos, o bot utiliza:

* Slash Commands claros
* Botões interativos
* Menus de seleção
* Modais para entrada de dados

Isso garante que ações como **exonerar um membro**, **registrar uma ausência** ou **atualizar um registro** sejam feitas de forma guiada e segura.

---

## 7. Funcionalidades Administrativas

Entre as principais funcionalidades implementadas:

* Alteração automatizada de apelidos no Discord
* Gerenciamento de cargos administrativos
* Sistema de exoneração e cancelamento
* Controle de ausências
* Atualização de registros internos
* Logs automáticos de entrada e saída de membros
* Envio de mensagens privadas para usuários selecionados
* **Sistema de Hierarquia de Patentes** com rebaixamento automático
* **Sistema de Advertências Progressivas** com exoneração automática

Todas essas ações seguem regras previamente definidas e documentadas.

---

## 8. Sistema de Hierarquia de Patentes

### 🏅 Como Funciona

O sistema de rebaixamento segue uma **hierarquia ordenada de patentes**. Quando um membro recebe uma advertência com punição contendo "patente" ou "rebaixa", ele é automaticamente rebaixado para a próxima patente na sequência.

#### Exemplo de Hierarquia
```
1º Tenente (mais alta)
    ↓
2º Tenente
    ↓
Subtenente
    ↓
1º Sargento
    ↓
2º Sargento
    ↓
3º Sargento
    ↓
Cabo
    ↓
Soldado
    ↓
Aluno (mais baixa)
```

**Quando um membro é rebaixado:**
- Se é **1º Tenente** → vira **2º Tenente**
- Se é **Cabo** → vira **Soldado**
- Se é **Aluno** (última patente) → apenas remove a patente

#### Configuração no `.env`

```env
PATENTE_HIERARQUIA=1º Tenente:1428418504469516511|2º Tenente:1428418506042638518|Subtenente:1428418507044945950|1º Sargento:1428418508336926820|2º sargento:1428418509398081698|3º sargento:1428418510610108597|Cabo:1428418511339782227|Soldado:1428418512275243192|Aluno:1428418513755967488
```

#### Formato da Configuração
- **`|`** (pipe) = Separa diferentes patentes (da mais alta para a mais baixa)
- **`:`** (dois pontos) = Separa o nome da patente do seu ID de role

#### Como Usar

Quando usar o comando `/advertencia`, coloque **"rebaixa"** ou **"patente"** no campo **Punição**:

```
Motivo: Comportamento inadequado em operação
Punição: rebaixa (rebaixamento de patente)
```

#### O que Acontece
1. ✅ Cargo de advertência é adicionado automaticamente
2. ✅ Patente atual é **removida**
3. ✅ Próxima patente (mais baixa) é **adicionada**
4. ✅ Log é registrado no canal de advertências
5. ✅ Membro recebe DM notificando sobre a advertência

---

## 9. Sistema de Advertências Progressivas

### ⚠️ Como Funciona

O sistema de advertências funciona de forma **progressiva e automática**:

#### Fluxo de Advertências

```
1ª Advertência → Adiciona cargo de "1ª Aviso"
                    ↓
2ª Advertência → Adiciona cargo de "2ª Aviso" 
                    ↓
3ª Advertência → ⚠️ EXONERAÇÃO AUTOMÁTICA
```

#### Comportamento

| Situação | Ação |
|----------|------|
| Nenhum cargo de advertência | ➕ Adiciona **1ª Advertência** |
| Tem 1ª advertência | ➕ Adiciona **2ª Advertência** |
| Tem 1ª e 2ª advertências | 🔴 **EXONERA AUTOMATICAMENTE** |

#### Configuração no `.env`

```env
# ⚠️ Cargos de Advertência (Sistema de Avisos)
ADVERTENCIA_1_ROLE_ID=1433610281426092053
ADVERTENCIA_2_ROLE_ID=1454650345127936081
```

#### Características Importantes

✅ **A advertência é SEMPRE adicionada**, independentemente da punição especificada
- Sistema de advertências executa **PRIMEIRO**
- Outras punições (curso, patente, unidade) são **OPCIONAIS** e dependem do campo "Punição"

#### Exoneração Automática

Quando a 3ª advertência é acionada:

1. 🔴 Membro recebe status de **exonerado**
2. ❌ **TODOS os cargos** são removidos automaticamente:
   - Cargos de advertência
   - Cargos de patente
   - Cargos de unidade
   - Cargos de curso
   - Cargo de ausência
   - Cargos de registro policial
3. 📝 Mensagem é registrada no canal de exonerações (`CHANNEL_LOG_EXONERACAO`)
4. ⏰ Membro será **automaticamente removido do servidor em 7 dias**

#### Exemplo de Uso

```
/advertencia
→ QRA: Sandro TEP
→ Passaporte: 123456
→ Motivo: Comportamento inadequado
→ Punição: advertência (qualquer coisa aqui funciona)
```

**Resultado:**
- ✅ Adicionado cargo de 1ª Advertência
- ✅ Log enviado ao canal
- ✅ Membro recebe notificação por DM

Na **segunda vez**:
- ✅ Adicionado cargo de 2ª Advertência

Na **terceira vez**:
- 🔴 Membro é **exonerado automaticamente**
- ❌ Todos os cargos removidos
- ⏰ Será removido do servidor em 7 dias

#### Logs e Registros

A exoneração automática segue o **mesmo padrão** do comando `/exoneracao`, com mensagem no formato:

```ini
[Nome do oficial] João Silva
[Motivo] Atingido limite máximo de advertências (2)
[Autorizado por: StaffUser#1234]
[Tipo] Automática - Sistema de Advertências
```

---

## 10. Persistência de Dados

Para garantir histórico e consistência, o projeto utiliza **SQLite** como banco de dados local.

O banco é responsável por armazenar:

* Registros administrativos
* Histórico de ausências
* Exonerações
* Ações realizadas pela equipe administrativa

A persistência permite auditoria e acompanhamento das decisões tomadas.

---

## 11. Documentação do Projeto

Um diferencial importante deste projeto é a **documentação completa**, que cobre:

* Idealização inicial
* Objetivos e regras do sistema
* Estrutura do projeto
* Funcionamento dos comandos
* Fluxos administrativos
* Sistema de Hierarquia de Patentes
* Sistema de Advertências Progressivas

A documentação foi pensada para facilitar tanto a **manutenção futura** quanto o **entendimento por novos desenvolvedores**.

---

## 12. Evolução Contínua

O projeto não é estático.

Sempre que há:

* Mudança de diretrizes administrativas
* Necessidade de novos comandos
* Ajustes em regras internas

O sistema é atualizado para refletir essas mudanças, mantendo o bot alinhado com a realidade do servidor.

---

## 13. Considerações Finais

Este projeto representa a construção de uma solução real, pensada para uso contínuo, onde o foco não foi apenas escrever código, mas:

* Resolver um problema concreto
* Criar uma ferramenta confiável
* Manter organização e documentação
* Pensar em longo prazo

Mais do que um bot, o projeto se consolidou como um **sistema administrativo integrado ao Discord**, atendendo às necessidades de uma organização complexa dentro de um ambiente de RP.
