<div align="center">

<img src="assets/img/logo-MA.ico" width="110" height="110" alt="Logo M&A Consultoria Câmbio"/>

# Sistema de Câmbio Online // M&A Consultoria

**Plataforma web para cotação, simulação e solicitação de operações de câmbio turismo**

*Solução desenvolvida desenvolvida para digitalizar e automatizar parte do processo operacional da corretora de câmbio, com integração de dados, regras de negócio, cálculos financeiros e envio automatizado de solicitações*

[![Status](https://img.shields.io/badge/status-em%20evolução-e8e4de?style=flat-square&labelColor=3437e6&color=1c1b2e)]()&nbsp;
[![Finalidade](https://img.shields.io/badge/finalidade-freelance-e8e4de?style=flat-square&labelColor=f59e0b&color=1c1b2e)]()&nbsp;
[![Licença](https://img.shields.io/badge/licença-personalizada-e8e4de?style=flat-square&labelColor=ef4444&color=1c1b2e)](./LICENSE)

</div>

<p align="center">
  <a href="#projeto">Sobre</a>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
  <a href="#funcionalidades">Funcionalidades</a>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
  <a href="#arquitetura">Arquitetura</a>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
  <a href="#tecnologias">Tecnologias</a>
</p>

<h2 id="projeto">SOBRE O PROJETO</h2>

O **Sistema de Câmbio Online** foi desenvolvido para a **M&A Consultoria Câmbio**, com o objetivo de levar para o ambiente digital parte do processo de cotação e solicitação de operações de câmbio turismo.

A aplicação foi construída do zero para atender às regras e necessidades específicas do negócio, substituindo um fluxo que dependia de consultas e cálculos manuais por uma experiência digital centralizada.

Diferente de um conversor de moedas convencional, o sistema considera regras específicas da operação de câmbio, incluindo **cotação atualizada, IOF, VET, custos da operação, disponibilidade de atendimento e validações de dados.**

A aplicação funciona em uma arquitetura **client-side, sem frameworks JavaScript**, utilizando APIs externas como fonte de dados e serviços de apoio.

<h4>Principais objetivos:</h4>

-  Automatizar o processo de cotação e simulação;
-  Reduzir cálculos manuais;
-  Centralizar as informações necessárias para uma operação;
-  Aplicar regras específicas do negócio diretamente na aplicação;
-  Simplificar a experiência do cliente;
- Facilitar o recebimento e processamento das solicitações pela equipe da consultoria.


🌐 [Acesse a aplicação](https://cotacaoonline.maconsultoriacambio.com.br/)

<p align="center">
  <img src="assets/img/print.png" alt="Preview do Sistema" width="100%"/>
</p>

## FUNCIONALIDADES

### 💱 Cotações e simulações

* Consulta dinâmica das taxas de câmbio;
* Atualização das cotações a partir do Google Sheets;
* Simulação de compra de moeda estrangeira;
* Cálculo automático dos valores da operação;
* Aplicação de IOF;
* Cálculo de VET;
* Exibição do custo total da operação.

### 🧠 Regras de negócio

A aplicação implementa regras específicas para controlar o comportamento do sistema conforme o contexto da operação.

* Validação de horário de atendimento;
* Identificação de finais de semana;
* Tratamento de feriados nacionais;
* Consideração de feriados com datas móveis;
* Controle de fuso horário;
* Bloqueio de operações quando os dados necessários não estão disponíveis ou estão desatualizados.

### 📩 Solicitação de operação

Após a simulação, o usuário pode enviar uma solicitação diretamente pelo sistema.

O fluxo utiliza **EmailJS** para encaminhar as informações da operação ao cliente e à equipe responsável pelo atendimento.

### 🔐 Validação e tratamento de dados

* Validação de CPF;
* Validação e formatação de telefone;
* Validação e formatação de CEP;
* Sanitização de entradas;
* Validações com RegEx;
* Tratamento de estados inválidos;
* Feedback visual durante as etapas do fluxo.

### 📱 Experiência e responsividade

* Interface responsiva;
* Layout adaptado para desktop, tablet e mobile;
* Fluxo simplificado de simulação;
* Feedback visual para diferentes estados da aplicação;
* FAQ integrado ao fluxo;
* Interface focada em clareza e redução de fricção.

## ARQUITETURA

A aplicação foi desenvolvida utilizando uma abordagem **client-side / SPA-like**, sem a utilização de frameworks JavaScript.

A estrutura foi pensada para manter a aplicação leve, modular e independente de um backend dedicado para o fluxo principal.

### Fluxo simplificado

```text
Google Sheets
     │
     ▼
Cotações atualizadas
     │
     ▼
JavaScript
     │
     ├── Regras de negócio
     ├── IOF
     ├── VET
     ├── Horários
     ├── Feriados
     └── Validações
     │
     ▼
Simulação
     │
     ▼
Solicitação
     │
     ▼
EmailJS
     │
     ├── Cliente
     └── M&A Consultoria
```

### Fonte de dados

O **Google Sheets API** é utilizado como fonte de dados operacional para as taxas de câmbio.

A escolha permite que a equipe responsável atualize as cotações sem necessidade de alterar o código da aplicação.

### Comunicação

O **EmailJS** é utilizado para o envio das solicitações geradas pelo usuário, permitindo que o sistema encaminhe os dados da operação diretamente para os destinatários configurados.

### Fail-Safe

Como o sistema depende de dados externos para realizar cálculos financeiros, a aplicação possui mecanismos para evitar que uma operação seja processada com informações inválidas ou desatualizadas.

Entre os controles implementados estão:

* Verificação da disponibilidade da fonte de dados;
* Validação da atualização das cotações;
* Bloqueio do fluxo quando informações críticas não estão disponíveis;
* Tratamento de erros de comunicação;
* Feedback ao usuário em situações de indisponibilidade.

O objetivo é priorizar a **integridade das informações utilizadas na simulação**, evitando apresentar ao usuário um resultado baseado em dados que não possam ser considerados confiáveis.

### Decisões Técnicas

**Por que JavaScript sem framework?**

O projeto foi desenvolvido sem frameworks JavaScript para manter o controle direto sobre a aplicação, reduzir dependências e atender ao escopo específico do sistema.

A utilização de JavaScript puro também permitiu implementar as regras de negócio diretamente sobre o DOM e manter uma estrutura enxuta.

**Por que Google Sheets?**

O Google Sheets foi utilizado como fonte operacional das cotações porque permite que a equipe da consultoria atualize os valores sem precisar acessar ou modificar o código da aplicação.

Isso cria uma separação simples entre **dados operacionais** e **código da aplicação**.

**Por que uma abordagem client-side?**

Para o escopo atual, uma arquitetura client-side atende às necessidades da aplicação e elimina a necessidade de manter um backend dedicado para o fluxo principal.

A abordagem também permite uma experiência rápida e interativa, com as principais operações acontecendo sem recarregamento da página.

### Estrutura

```text
cambio-online-turismo/
├── assets/
│   └── img/
│       └── ...              → Logos, imagens e recursos visuais
│
├── src/
│   ├── css/
│   │   └── style.css       → Estilos customizados
│   │
│   └── js/
│       └── script.js       → Lógica principal da aplicação
│
├── index.html               → Interface principal
├── CNAME                    → Domínio personalizado
├── LICENSE                  → Licença do projeto
└── README.md
```

## TECNOLOGIAS

| Tecnologia            | Utilização                                   |
| --------------------- | -------------------------------------------- |
| **HTML5**             | Estrutura semântica da aplicação             |
| **Tailwind CSS**      | Estilização e construção da interface        |
| **JavaScript ES6+**   | Lógica da aplicação, DOM e regras de negócio |
| **Google Sheets API** | Fonte de dados para as cotações              |
| **EmailJS**           | Envio das solicitações por e-mail            |
| **Phosphor Icons**    | Ícones da interface                          |
| **Git / GitHub**      | Versionamento e gerenciamento do projeto     |

---

## LICENÇA

Este projeto possui uma **licença personalizada**.
O código está disponível publicamente para fins de consulta e portfólio, porém sua reprodução, redistribuição, modificação ou utilização comercial não é permitida sem autorização expressa de **Lucas Code** e **M&A Consultoria Câmbio**.

Consulte o arquivo [LICENSE](./LICENSE) para mais informações.

## AUTOR    

**`</>` ᴅᴇᴠᴇʟᴏᴘᴇᴅ ʙʏ**

**ʟᴜᴄᴀꜱ ᴄᴏᴅᴇ // ᴡᴇʙ ᴅᴇᴠᴇʟᴏᴘᴍᴇɴᴛ ꜱᴛᴜᴅɪᴏ**  
[**ᴡᴇʙꜱɪᴛᴇ**](https://lvcascode.com.br) ▪ [**ɪɴꜱᴛᴀɢʀᴀᴍ**](https://instagram.com/lvcascode)

**ʟᴜᴄᴀꜱ ᴄᴏᴜᴛᴏ // ᴡᴇʙ ᴅᴇᴠᴇʟᴏᴘᴇʀ**  
[**ʟɪɴᴋᴇᴅɪɴ**](https://linkedin.com/in/lucascouto-dev) ▪ [**ɢɪᴛʜᴜʙ**](https://github.com/lvcascouto)
