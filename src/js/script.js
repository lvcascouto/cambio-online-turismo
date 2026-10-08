document.addEventListener("DOMContentLoaded", () => {
  console.log("🟢 Script iniciado. DOM carregado.");

  const SPREADSHEET_ID = "1BvDKkVQAzH3kZkuhxxqbLjwIvG3MEB-YCWrI3H0NcX4";
  const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`;
  const IOF_RATE = 0.035;
  const UPDATE_INTERVAL_SECONDS = 600;
  const SERVICE_ID = "service_bka9lcb";
  const TEMPLATE_ADMIN = "template_9fzmu0n";
  const TEMPLATE_CLIENTE = "template_u5saecn";
  const OPERATORS = ["5511953505626", "5511938059556"];

  // Regra do delivery: grátis a partir do equivalente a USD 500, senão R$ 30
  const DELIVERY_FREE_MIN_USD = 500;
  const DELIVERY_FEE_BRL = 30;

  // Tabela antiga de isenção de frete — usada só como reserva se a taxa do USD
  // não estiver disponível (a regra principal é a equivalência em USD acima)
  const DELIVERY_FREE_THRESHOLDS = {
    USD: 500,
    EUR: 500,
    GBP: 500,
    JPY: 70000,
    CLP: 400000,
    MXN: 8500,
    UYU: 17000,
    NZD: 900,
    AED: 1600,
    CNY: 2900,
    PEN: 1400,
    ARS: 600000,
    COP: 1300000,
    ZAR: 70000,
  };

  // --- ATUALIZADO COM REGRAS DE NOTAS PARA EXÓTICAS ---
  const PAPER_RULES = {
    USD: { minStep: 50, notes: "100 (50 apenas sob consulta)" },
    EUR: { minStep: 50, notes: "100 (50 apenas sob consulta)" },
    JPY: { minStep: 10000, notes: "10.000" },
    GBP: { minStep: 50, notes: "50" },
    CHF: { minStep: 100, notes: "100" },
    AUD: { minStep: 100, notes: "100" },
    CAD: { minStep: 100, notes: "100" },
    CLP: { minStep: 20000, notes: "20.000" },
    MXN: { minStep: 200, notes: "200" },
    UYU: { minStep: 1000, notes: "1.000" },
    NZD: { minStep: 100, notes: "100" },

    // Moedas Exóticas com regras definidas
    AED: {
      isExotic: !0,
      minStep: 50,
      notes: "50, 100 e 500",
      name: "Dirham (AED)",
    },
    CNY: { isExotic: !0, minStep: 100, notes: "100", name: "Iuan (CNY)" },
    PEN: {
      isExotic: !0,
      minStep: 50,
      notes: "50 e 100",
      name: "Novo Sol (PEN)",
    },
    ARS: {
      isExotic: !0,
      minStep: 1000,
      notes: "1.000 ou 20.000",
      name: "Peso Argentino (ARS)",
    },
    COP: {
      isExotic: !0,
      minStep: 2000,
      notes: "2.000, 50.000 e 100.000",
      name: "Peso Colombiano (COP)",
    },
    ZAR: { isExotic: !0, minStep: 100, notes: "100 e 200", name: "Rand (ZAR)" },
  };

  // --- CARTÃO PRÉ-PAGO (carga e recarga) ---
  // Valor mínimo por moeda, igual para carga (cartão novo) e recarga (cartão M&A)
  const CARD_MIN = {
    USD: 50,
    EUR: 40,
    GBP: 30,
    CAD: 50,
    AUD: 50,
    NZD: 50,
    MXN: 900,
    JPY: 8000,
    CHF: 40,
  };
  // Moedas que só aceitam valores redondos no cartão (múltiplos do passo)
  const CARD_STEP = { JPY: 1000 };
  // Na carga, delivery só a partir do dobro do mínimo (ex.: mínimo USD 50 → delivery a partir de USD 100)
  const CARD_DELIVERY_MIN_MULTIPLIER = 2;

  // --- DESCARGA DE CARTÃO (cliente vende o saldo integral do cartão M&A) ---
  // Taxas: planilha K22:K30, nesta ordem (não existe descarga parcial).
  const UNLOAD_CURRENCIES = [
    "USD",
    "EUR",
    "JPY",
    "GBP",
    "CHF",
    "AUD",
    "CAD",
    "NZD",
    "MXN",
  ];
  // Linhas do gviz = linha da planilha − 2 (K22 → 20, K30 → 28).
  // Se a coluna J tiver o código da moeda, a leitura usa o código; senão, a ordem acima.
  // IOF da descarga: 0,38%, descontado do valor que o cliente recebe.
  // A taxa da planilha (K22:K30) já é a VET líquida, ou seja, já com o IOF descontado.
  const UNLOAD_IOF_RATE = 0.0038;
  // IOF da venda de papel espécie: 3,5%, também descontado do valor a receber.
  // A taxa da planilha (H22:I28) já é a VET líquida, com o IOF descontado.
  const SELL_IOF_RATE = 0.035;
  const UNLOAD_SHEET_ROWS = { from: 20, to: 28 };

  // --- VENDA DE PAPEL-MOEDA (cliente vende, M&A compra) ---
  // Taxas: planilha H22:I28 (já com IOF). Só estas moedas têm taxa no simulador.
  const SELL_RATED = ["USD", "EUR", "JPY", "GBP", "CHF", "AUD", "CAD"];
  // A M&A também compra estas, mas sem taxa no site: sob consulta via WhatsApp
  const SELL_CONSULT = [
    "NZD",
    "MXN",
    "CLP",
    "UYU",
    "CNY",
    "PEN",
    "ARS",
    "COP",
    "ZAR",
  ];
  // Linhas da planilha (índice do gviz: linha da planilha − 2) onde fica a tabela de venda.
  // A leitura confere o código da moeda na coluna H, então o cabeçalho é ignorado.
  const SELL_SHEET_ROWS = { from: 19, to: 28 };
  // Mínimo e passo (menor cédula — não aceitamos moedas metálicas)
  const SELL_RULES = {
    USD: { min: 100, step: 1, notes: "1, 2, 5, 10, 20, 50 e 100" },
    EUR: { min: 100, step: 5, notes: "5, 10, 20, 50, 100, 200 e 500" },
    JPY: { min: 1000, step: 1000, notes: "1.000, 2.000, 5.000 e 10.000" },
    GBP: { min: 100, step: 5, notes: "5, 10, 20 e 50" },
    CHF: { min: 100, step: 10, notes: "10, 20, 50, 100, 200 e 1.000" },
    AUD: { min: 100, step: 5, notes: "5, 10, 20, 50 e 100" },
    CAD: { min: 100, step: 5, notes: "5, 10, 20, 50 e 100" },
  };

  // E-mails: compra e venda usam os MESMOS 2 templates do EmailJS (plano gratuito).
  // O template mostra a versão certa pelos blocos {{#is_sell}} / {{^is_sell}}.

  // Elementos do DOM
  const getEl = (id) => document.getElementById(id);
  const dataStatus = getEl("dataStatus");
  const btnPapel = getEl("btnPapel");
  const btnCartao = getEl("btnCartao");
  const currencyList = getEl("currencyList");
  const fromSel = getEl("from");
  const amountInput = getEl("amount");
  const convertBtn = getEl("convertBtn");
  const clearBtn = getEl("clearBtn");
  const resultCard = getEl("resultCard");
  const resultValue = getEl("resultValue");
  const quoteTime = getEl("quoteTime");
  const calcDetails = getEl("calcDetails");
  const comparisonGrid = getEl("comparisonGrid");
  const errorMsg = getEl("errorMsg");
  const lastUpdate = getEl("lastUpdate");
  const nextUpdate = getEl("nextUpdate");
  const buyBtn = getEl("buyBtn");
  const budgetModal = getEl("budgetModal");
  const closeModalBtn = getEl("closeModalBtn");
  const budgetForm = getEl("budgetForm");
  const successStep = getEl("successStep");
  const finalWhatsAppBtn = getEl("finalWhatsAppBtn");
  const modalCurrencyAmount = getEl("modalCurrencyAmount");
  const modalCurrencyCode = getEl("modalCurrencyCode");
  const modalTotalBRL = getEl("modalTotalBRL");
  const modalDetails = getEl("modalDetails");
  const operationalInfo = getEl("operationalInfo");
  const clientName = getEl("clientName");
  const clientPhone = getEl("clientPhone");
  const deliveryCheck = getEl("deliveryCheck");
  const deliveryFields = getEl("deliveryFields");
  // Novos elementos (operação, venda e cartão)
  const btnVenda = getEl("btnVenda");
  const btnCarga = getEl("btnCarga");
  const btnRecarga = getEl("btnRecarga");
  const btnDescarga = getEl("btnDescarga");
  const opBackBtn = getEl("opBackBtn");
  const opMain = getEl("opMain");
  const opCard = getEl("opCard");
  const opTitle = getEl("opTitle");
  const opSubtitle = getEl("opSubtitle");
  const currencyListHint = getEl("currencyListHint");
  const resultLabel = getEl("resultLabel");
  const comparisonHint = getEl("comparisonHint");
  const modalTotalLabel = getEl("modalTotalLabel");
  const deliveryBlock = getEl("deliveryBlock");
  const deliveryToggle = getEl("deliveryToggle");
  const deliveryRestriction = getEl("deliveryRestriction");
  const storeBlock = getEl("storeBlock");
  const paymentBlock = getEl("paymentBlock");
  const pixFields = getEl("pixFields");
  const tedFields = getEl("tedFields");
  const successNextStep = getEl("successNextStep");

  // Salva o HTML original do botão para restaurar depois
  const originalBuyBtnHTML = buyBtn ? buyBtn.outerHTML : null;

  // // Lógica do Checkbox de Delivery
  // if (deliveryCheck) {
  //   deliveryCheck.addEventListener("change", function () {
  //     if (this.checked) {
  //       deliveryFields.classList.remove("hidden");
  //       getEl("deliveryCEP").required = !0;
  //       getEl("deliveryAddress").required = !0;
  //     } else {
  //       deliveryFields.classList.add("hidden");
  //       getEl("deliveryCEP").required = !1;
  //       getEl("deliveryAddress").required = !1;
  //     }
  //   });
  // }

  // OUVINTE DO CLIQUE NA CAIXINHA DE DELIVERY
  if (deliveryCheck) {
    deliveryCheck.addEventListener("change", function () {
      if (this.checked) {
        // Se marcou a caixinha, mostra os campos de endereço
        deliveryFields.classList.remove("hidden");
        document.getElementById("deliveryCEP").required = true;
        document.getElementById("deliveryAddress").required = true;
      } else {
        // Se desmarcou, esconde os campos de endereço
        deliveryFields.classList.add("hidden");
        document.getElementById("deliveryCEP").required = false;
        document.getElementById("deliveryAddress").required = false;
      }

      // AQUI É A MÁGICA: Recalcula tudo toda vez que o cliente clica!
      updateModalFinance();
    });
  }

  // Máscaras de Input (CPF, Telefone, CEP)
  const maskInputs = () => {
    const cpfInput = getEl("clientCPF");
    const phoneInput = getEl("clientPhone");
    const cepInput = getEl("clientCEP");
    const deliveryCepInput = getEl("deliveryCEP");

    const applyMask = (input, maskFunction) => {
      if (!input) return;
      input.addEventListener("input", (e) => {
        e.target.value = maskFunction(e.target.value);
      });
    };

    const masks = {
      cpf: (v) =>
        v
          .replace(/\D/g, "")
          .replace(/(\d{3})(\d)/, "$1.$2")
          .replace(/(\d{3})(\d)/, "$1.$2")
          .replace(/(\d{3})(\d{1,2})/, "$1-$2")
          .replace(/(-\d{2})\d+?$/, "$1"),
      phone: (v) =>
        v
          .replace(/\D/g, "")
          .replace(/^(\d{2})(\d)/g, "($1) $2")
          .replace(/(\d)(\d{4})$/, "$1-$2"),
      cep: (v) =>
        v
          .replace(/\D/g, "")
          .replace(/^(\d{5})(\d)/, "$1-$2")
          .substring(0, 9),
    };

    applyMask(cpfInput, masks.cpf);
    applyMask(phoneInput, masks.phone);
    applyMask(cepInput, masks.cep);
    if (deliveryCepInput) applyMask(deliveryCepInput, masks.cep);
  };
  maskInputs();

  // Variáveis de Estado
  let ratesPapel = {};
  let ratesCartao = {};
  let ratesVenda = {};
  let ratesDescarga = {};
  // currentMode: "papel" (comprar papel), "venda" (vender papel), "cartao" ou
  // "descarga" (vender o saldo integral do cartão M&A)
  // cardOp (só no cartão): "carga" (cartão novo) ou "recarga" (cartão M&A)
  let currentMode = "";
  let cardOp = "carga";
  let available = {};
  let lastFetchTime = null;
  let countdownInterval;
  let currentQuote = null;
  // Controle de envio dos e-mails da solicitação (zerado a cada abertura do modal)
  let emailStatus = { admin: false, client: false };
  const EMAIL_TIMEOUT_MS = 20000;

  // Formatadores
  function formatBRL(v) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(v);
  }

  function formatRate(v) {
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(v);
  }

  // Quantidade de moeda estrangeira no padrão brasileiro (ex.: 1.000,00)
  function formatAmount(v) {
    return Number(v).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function getRatesForMode(mode) {
    if (mode === "venda") return ratesVenda;
    if (mode === "descarga") return ratesDescarga;
    if (mode === "cartao") return ratesCartao;
    return ratesPapel;
  }

  // Moeda sem taxa no simulador (venda ou descarga): cotação sob consulta
  function isSellConsult(code) {
    if (currentMode === "venda") return !!ratesVenda[code]?.isConsult;
    if (currentMode === "descarga") return !!ratesDescarga[code]?.isConsult;
    return false;
  }

  // Validação de CPF (dígitos verificadores)
  function isValidCPF(value) {
    const cpf = String(value).replace(/\D/g, "");
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    for (let t = 9; t < 11; t++) {
      let sum = 0;
      for (let i = 0; i < t; i++) sum += Number(cpf[i]) * (t + 1 - i);
      const digit = ((sum * 10) % 11) % 10;
      if (digit !== Number(cpf[t])) return false;
    }
    return true;
  }

  // Nome da operação para e-mails e mensagens
  function getOperationLabel(quote) {
    if (quote.mode === "venda") return "Papel Espécie — Venda";
    if (quote.mode === "descarga")
      return "Cartão Pré-pago — Descarga (saldo integral)";
    if (quote.mode === "cartao")
      return quote.cardOp === "recarga"
        ? "Cartão Pré-pago — Recarga (cartão M&A)"
        : "Cartão Pré-pago — Carga (cartão novo)";
    return "Papel Espécie — Compra";
  }

  function pickOperator() {
    const phoneDigits = (getEl("clientPhone")?.value || "").replace(/\D/g, "");
    const idx =
      phoneDigits.length > 0
        ? parseInt(phoneDigits.charAt(phoneDigits.length - 1), 10) % 2
        : Date.now() % 2;
    return OPERATORS[idx];
  }

  function openWhatsApp(operator, msg) {
    window.open(
      `https://api.whatsapp.com/send?phone=${operator}&text=${formatarMsgWhatsApp(msg)}`,
      "_blank",
    );
  }

  function formatarMsgWhatsApp(texto) {
    // 1. Força a quebra de linha dupla (\r\n) que o app Desktop entende
    const textoComCRLF = texto.replace(/\r?\n/g, "\r\n");

    // 2. Retorna o texto codificado de forma segura
    return encodeURIComponent(textoComCRLF);
  }

  // Geradores de HTML (Bandeiras)
  function getFlagElement(currencyCode) {
    const countryMap = {
      USD: "us",
      EUR: "eu",
      JPY: "jp",
      GBP: "gb",
      CHF: "ch",
      AUD: "au",
      CAD: "ca",
      NZD: "nz",
      MXN: "mx",
      UYU: "uy",
      CLP: "cl",
      AED: "ae",
      CNY: "cn",
      PEN: "pe",
      ARS: "ar",
      COP: "co",
      ZAR: "za",
      BRL: "br",
    };
    const countryCode = countryMap[currencyCode];
    return countryCode
      ? `<img src="https://flagcdn.com/24x18/${countryCode}.png" alt="${currencyCode}" class="w-5 h-auto shadow-sm inline-block mr-1.5 align-middle">`
      : "";
  }

  function getFlagEmoji(currencyCode) {
    const countryMap = {
      USD: "US",
      EUR: "EU",
      JPY: "JP",
      GBP: "GB",
      CHF: "CH",
      AUD: "AU",
      CAD: "CA",
      NZD: "NZ",
      MXN: "MX",
      UYU: "UY",
      CLP: "CL",
      AED: "AE",
      CNY: "CN",
      PEN: "PE",
      ARS: "AR",
      COP: "CO",
      ZAR: "ZA",
    };
    const code = countryMap[currencyCode];
    return code
      ? code
          .toUpperCase()
          .replace(/./g, (char) =>
            String.fromCodePoint(char.charCodeAt(0) + 127397),
          )
      : "";
  }

  // function getWhatsAppLinkForExotic(currencyCode, amount, operator) {
  //   const msg = `Olá, M&A Consultoria Câmbio! Tenho interesse na moeda exótica *${currencyCode}*.\nQuantidade: *${amount}*.\n\nPor favor, me ajude com a cotação.`;
  //   return `https://api.whatsapp.com/send?phone=${operator}&text=${encodeURIComponent(msg)}`;
  // }
  function getWhatsAppLinkForExotic(currencyCode, amount, operator) {
    const msg = `Olá, M&A Consultoria Câmbio! Tenho interesse na moeda exótica *${currencyCode}*.\nQuantidade: *${amount}*.\n\nPor favor, me ajude com a cotação.`;
    // Aplicando a blindagem aqui:
    return `https://api.whatsapp.com/send?phone=${operator}&text=${formatarMsgWhatsApp(msg)}`;
  }

  // --- FETCH DE DADOS (GOOGLE SHEETS) ---
  async function fetchSheetRates() {
    if (dataStatus)
      dataStatus.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Carregando...`;

    try {
      const res = await fetch(SHEET_URL);
      const text = await res.text();
      const m = text.match(/setResponse\((.*)\);/);
      if (!m) throw new Error("Erro de leitura do Google Sheets");

      const json = JSON.parse(m[1]);
      const rows = json.table.rows || [];

      ratesPapel = {};
      ratesCartao = {};
      lastFetchTime = new Date();

      // Processa Papel Moeda (Colunas 7 e 8 - H e I)
      for (let i = 1; i <= 18; i++) {
        const r = rows[i];
        if (!r) continue;
        // const m = r.c[7]?.v; // Moeda
        // const v = r.c[8]?.v; // Valor
        // if (m && v) {
        //   ratesPapel[String(m).trim()] = {
        //     raw: Number(v),
        //     display: r.c[8].f || String(v),
        //   };
        // }
        const m = r.c[7]?.v; // Moeda
        const valRaw = r.c[8]?.v; // Valor cru (ignorar)
        const valFormatted = r.c[8]?.f; // Valor formatado (o que a gente quer!)

        if (m) {
          // Converte o valor formatado (ex: "5,3147") para Number (5.3147)
          // Precisamos trocar a vírgula por ponto para o JS entender
          const sanitizedValue = valFormatted
            ? Number(valFormatted.replace(",", "."))
            : Number(valRaw);

          ratesPapel[String(m).trim()] = {
            raw: sanitizedValue, // Agora usamos o valor "travado" visualmente
            display: valFormatted || String(valRaw),
          };
        }
      }

      // --- LOGICA DE EXÓTICAS (Permitir taxas da planilha) ---
      Object.keys(PAPER_RULES).forEach((code) => {
        if (PAPER_RULES[code].isExotic) {
          if (ratesPapel[code]) {
            // Se veio da planilha, mantém o valor mas marca como exótica
            ratesPapel[code].isExotic = true;
          } else {
            // Se NÃO veio da planilha, cria o objeto zerado padrão
            ratesPapel[code] = { isExotic: !0, raw: 0, display: "Consulta" };
          }
        }
      });

      // Processa Cartão (Colunas 9 e 10 - J e K)
      for (let i = 1; i <= 10; i++) {
        const r = rows[i];
        if (!r) continue;
        // const m = r.c[9]?.v;
        // const v = r.c[10]?.v;
        // if (m && v) {
        //   ratesCartao[String(m).trim()] = {
        //     raw: Number(v),
        //     display: r.c[10].f || String(v),
        //   };
        // }
        const mCartao = r.c[9]?.v;
        const valRawCartao = r.c[10]?.v;
        const valFormattedCartao = r.c[10]?.f;

        if (mCartao) {
          const sanitizedValue = valFormattedCartao
            ? Number(valFormattedCartao.replace(",", "."))
            : Number(valRawCartao);

          ratesCartao[String(mCartao).trim()] = {
            raw: sanitizedValue,
            display: valFormattedCartao || String(valRawCartao),
          };
        }
      }

      // Processa Descarga de cartão (Coluna 10 - K, linhas 22 a 30 da planilha)
      const unloadFromSheet = {};
      for (let i = UNLOAD_SHEET_ROWS.from; i <= UNLOAD_SHEET_ROWS.to; i++) {
        const r = rows[i];
        if (!r) continue;
        const codeInJ = String(r.c[9]?.v ?? "").trim();
        const code = UNLOAD_CURRENCIES.includes(codeInJ)
          ? codeInJ
          : UNLOAD_CURRENCIES[i - UNLOAD_SHEET_ROWS.from];
        if (!code) continue;
        const valFormatted = r.c[10]?.f;
        const value = valFormatted
          ? Number(String(valFormatted).replace(",", "."))
          : Number(r.c[10]?.v);
        if (value > 0) {
          unloadFromSheet[code] = {
            raw: value,
            display: valFormatted || String(r.c[10]?.v),
          };
        }
      }
      ratesDescarga = {};
      UNLOAD_CURRENCIES.forEach((code) => {
        // Sem taxa válida na planilha → "sob consulta" (o especialista informa)
        ratesDescarga[code] = unloadFromSheet[code] || {
          raw: 0,
          display: "Consulta",
          isConsult: true,
        };
      });

      // Processa Venda de papel-moeda (Colunas 7 e 8 - H e I, linhas 22 a 28 da planilha)
      const sellFromSheet = {};
      for (let i = SELL_SHEET_ROWS.from; i <= SELL_SHEET_ROWS.to; i++) {
        const r = rows[i];
        if (!r) continue;
        const code = String(r.c[7]?.v ?? "").trim();
        if (!SELL_RATED.includes(code)) continue; // ignora cabeçalho/linhas vazias
        const valFormatted = r.c[8]?.f;
        const value = valFormatted
          ? Number(String(valFormatted).replace(",", "."))
          : Number(r.c[8]?.v);
        if (value > 0) {
          sellFromSheet[code] = {
            raw: value,
            display: valFormatted || String(r.c[8]?.v),
          };
        }
      }
      ratesVenda = {};
      SELL_RATED.forEach((code) => {
        // Sem taxa válida na planilha → vira "sob consulta" (WhatsApp)
        ratesVenda[code] = sellFromSheet[code] || {
          raw: 0,
          display: "Consulta",
          isConsult: true,
        };
      });
      SELL_CONSULT.forEach((code) => {
        ratesVenda[code] = { raw: 0, display: "Consulta", isConsult: true };
      });

      if (dataStatus) {
        dataStatus.innerHTML = `<i class="ph-bold ph-check-circle"></i> Atualizado`;
        setTimeout(() => dataStatus.classList.add("hidden"), 1500);
      }

      if (currentMode) {
        available = getRatesForMode(currentMode);
        populateCurrencyList();
      }

      if (resultCard && !resultCard.classList.contains("hidden")) {
        console.log("🔄 Recalculando valores na tela com novas taxas...");
        updateDisplayConversion();
      }

      startUpdateTimer();
    } catch (err) {
      console.error("❌ Erro crítico ao buscar taxas:", err);
      ratesPapel = {};
      ratesCartao = {};
      ratesVenda = {};
      ratesDescarga = {};

      if (dataStatus) {
        dataStatus.className =
          "text-xs text-red-600 font-bold bg-red-50 px-3 py-1 rounded-full border border-red-200 flex items-center gap-1 animate-pulse";
        dataStatus.innerHTML = `<i class="ph-bold ph-warning-circle"></i> Sistema Indisponível`;
        dataStatus.classList.remove("hidden");
      }
      if (resultCard) resultCard.classList.add("hidden");
      if (comparisonGrid) comparisonGrid.innerHTML = "";
      startUpdateTimer();
    }
  }

  function startUpdateTimer() {
    if (countdownInterval) clearInterval(countdownInterval);
    updateTimerUI();
    countdownInterval = setInterval(updateTimerUI, 1000);
  }

  function updateTimerUI() {
    if (!lastFetchTime) return;
    const now = new Date();
    const remaining =
      UPDATE_INTERVAL_SECONDS - Math.floor((now - lastFetchTime) / 1000);

    if (lastUpdate)
      lastUpdate.textContent = `${lastFetchTime.toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })} às ${lastFetchTime.toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })}`;

    if (nextUpdate) {
      if (remaining <= 0) {
        nextUpdate.textContent = "Atualizando...";
        clearInterval(countdownInterval);
        fetchSheetRates();
      } else {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        nextUpdate.textContent = `${m}:${s.toString().padStart(2, "0")}`;
      }
    }
  }

  // function calculateConversion(mode, currencyCode, amount) {
  //   const ratesObj = mode === "papel" ? ratesPapel : ratesCartao;
  //   const data = ratesObj[currencyCode];

  //   if (!data) return null;

  //   const IOF_RATE = 0.035;

  //   // 1. O VET Oficial que já vem formatado da planilha
  //   const VET = Number(data.raw);

  //   // 2. Descobre a Cotação Base exata em 4 casas (Corta a dízima)
  //   const baseRate = Number((VET / (1 + IOF_RATE)).toFixed(4));

  //   // ===========================================
  //   // 3. A REGRA DO SEU AVISO: LÍQUIDO + IMPOSTOS
  //   // ===========================================
  //   // Usamos a Matemática Inteira para garantir a exatidão dos centavos

  //   const conversionBase_cents = Math.round(amount * baseRate * 100);

  //   const totalIOF_cents = Math.round(conversionBase_cents * IOF_RATE);

  //   const totalBRL_cents = conversionBase_cents + totalIOF_cents;

  //   return {
  //     mode,
  //     currencyCode,
  //     amount,
  //     cotaçãoBase: baseRate,
  //     conversionBase: conversionBase_cents / 100,
  //     iofRate: IOF_RATE,
  //     totalIOFValue: totalIOF_cents / 100,
  //     totalBRL: totalBRL_cents / 100,
  //     VET: VET,
  //     rateDisplay: data.display,
  //     time: typeof lastFetchTime !== "undefined" ? lastFetchTime : new Date(),
  //   };
  // }

  function calculateConversion(mode, currencyCode, amount) {
    const ratesObj = getRatesForMode(mode);
    const data = ratesObj[currencyCode];

    if (!data) return null;

    // VENDA e DESCARGA: a taxa da planilha (VET) já é líquida de IOF.
    // Total a receber = saldo × VET (intocável, em centavos inteiros).
    // Detalhamento: Cotação Turismo = VET / (1 − IOF), Valor Líquido = saldo × Cotação Turismo,
    // e o IOF é a diferença, para a conta sempre fechar no centavo.
    if (mode === "descarga" || mode === "venda") {
      const iofRate = mode === "venda" ? SELL_IOF_RATE : UNLOAD_IOF_RATE;
      const VET = Number(data.raw);
      const totalBRL_cents = Math.round(amount * VET * 100);
      const baseRate = Number((VET / (1 - iofRate)).toFixed(4));
      const conversionBase_cents = Math.round(amount * baseRate * 100);
      const totalIOF_cents = conversionBase_cents - totalBRL_cents;
      return {
        mode,
        cardOp: null,
        isSell: true,
        currencyCode,
        amount,
        cotaçãoBase: baseRate,
        conversionBase: conversionBase_cents / 100,
        iofRate: iofRate,
        totalIOFValue: totalIOF_cents / 100,
        totalBRL: totalBRL_cents / 100,
        VET: VET,
        rateDisplay: data.display,
        time: lastFetchTime || new Date(),
      };
    }

    const IOF_RATE = 0.035;

    // 1. O VET Oficial da planilha
    const VET = Number(data.raw);

    // ==========================================
    // 2. A REGRA DE OURO DO BANCO CENTRAL
    // ==========================================
    // O Total a Pagar é intocável: VET * Quantidade (calculado em centavos inteiros)
    const totalBRL_cents = Math.round(amount * VET * 100);

    // 3. Descobre a Cotação Base (Turismo) em 4 casas
    const baseRate = Number((VET / (1 + IOF_RATE)).toFixed(4));

    // 4. Calcula o Valor Líquido (Quantidade * Turismo)
    const conversionBase_cents = Math.round(amount * baseRate * 100);

    // 5. O IOF absorve a diferença de centavos para a soma fechar perfeitamente!
    const totalIOF_cents = totalBRL_cents - conversionBase_cents;

    return {
      mode,
      cardOp: mode === "cartao" ? cardOp : null,
      isSell: false,
      currencyCode,
      amount,
      cotaçãoBase: baseRate,
      conversionBase: conversionBase_cents / 100,
      iofRate: IOF_RATE,
      totalIOFValue: totalIOF_cents / 100,
      totalBRL: totalBRL_cents / 100,
      VET: VET,
      rateDisplay: data.display,
      time: typeof lastFetchTime !== "undefined" ? lastFetchTime : new Date(),
    };
  }

  function isBankHoliday(dateObj) {
    const day = dateObj.getDate();
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();
    const dateStr = `${day}/${month}`;
    const fixedHolidays = [
      "1/1",
      "21/4",
      "1/5",
      "9/7",
      "7/9",
      "12/10",
      "2/11",
      "15/11",
      "20/11",
      "25/12",
      "31/12",
    ];

    if (fixedHolidays.includes(dateStr)) return !0;

    if (month === 12) {
      let lastDayYear = new Date(year, 11, 31);
      while (lastDayYear.getDay() === 0 || lastDayYear.getDay() === 6) {
        lastDayYear.setDate(lastDayYear.getDate() - 1);
      }
      if (day === lastDayYear.getDate()) return !0;
    }

    // Cálculo de Páscoa e Carnaval
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const easterMonth = Math.floor((h + l - 7 * m + 114) / 31);
    const easterDay = ((h + l - 7 * m + 114) % 31) + 1;

    const checkMoveable = (diffDays) => {
      const target = new Date(year, easterMonth - 1, easterDay);
      target.setDate(target.getDate() + diffDays);
      return target.getDate() === day && target.getMonth() + 1 === month;
    };

    if (checkMoveable(-48)) return !0; // Carnaval (segunda)
    if (checkMoveable(-47)) return !0; // Carnaval (terça)
    if (checkMoveable(-2)) return !0; // Paixão de Cristo
    if (checkMoveable(60)) return !0; // Corpus Christi

    return !1;
  }

  function isMarketOpen() {
    const nowSP = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
    );
    const day = nowSP.getDay();

    if (day === 0 || day === 6) return !1; // Fim de semana fechado
    if (isBankHoliday(nowSP)) return !1; // Feriado fechado

    const hour = nowSP.getHours();
    const minutes = nowSP.getMinutes();

    // Regra: 09:30 as 18:00
    if (hour < 9) return !1;
    if (hour >= 18) return !1;
    if (hour === 9 && minutes < 30) return !1;

    return !0;
  }

  function validatePaperAmount(currency, amount) {
    if (currentMode !== "papel") return { valid: !0 };

    const rule = PAPER_RULES[currency];
    if (!rule) return { valid: !0 }; // Se não tem regra, passa

    // Valida múltiplo (minStep)
    if (amount % rule.minStep !== 0) {
      return {
        valid: !1,
        msg: `Para ${currency} em Papel, o valor deve ser múltiplo de ${rule.minStep}. (Notas disponíveis: ${rule.notes})`,
      };
    }
    return { valid: !0 };
  }

  // CARTÃO (carga e recarga): mínimo por moeda e valores redondos para o iene
  function validateCardAmount(currency, amount) {
    if (currentMode !== "cartao") return { valid: !0 };
    const opName = cardOp === "recarga" ? "recarga" : "carga";
    const min = CARD_MIN[currency];
    if (min && amount < min) {
      return {
        valid: !1,
        msg: `Valor abaixo do mínimo permitido. Para ${opName} de cartão em ${currency}, o mínimo é ${currency} ${formatAmount(min)}.`,
      };
    }
    const step = CARD_STEP[currency];
    if (step && amount % step !== 0) {
      return {
        valid: !1,
        msg: `Para ${currency} no cartão, apenas valores redondos, em múltiplos de ${step.toLocaleString("pt-BR")} (ex.: ${min.toLocaleString("pt-BR")}, ${(min + step).toLocaleString("pt-BR")}).`,
      };
    }
    return { valid: !0 };
  }

  // VENDA: só cédulas (sem moedas metálicas), mínimo e múltiplo da menor cédula
  function validateSellAmount(currency, amount) {
    if (currentMode !== "venda") return { valid: !0 };
    if (!Number.isInteger(amount)) {
      return {
        valid: !1,
        msg: "Na venda, informe apenas valores inteiros em cédulas. Não aceitamos moedas metálicas.",
      };
    }
    const rule = SELL_RULES[currency];
    if (isSellConsult(currency) || !rule) return { valid: !0 };
    if (amount < rule.min) {
      return {
        valid: !1,
        msg: `O valor mínimo para venda de ${currency} é ${currency} ${rule.min.toLocaleString("pt-BR")}.`,
      };
    }
    if (amount % rule.step !== 0) {
      return {
        valid: !1,
        msg: `Para ${currency}, o valor deve ser múltiplo de ${rule.step.toLocaleString("pt-BR")} (menor cédula aceita). Cédulas aceitas: ${rule.notes}. Não aceitamos moedas metálicas.`,
      };
    }
    return { valid: !0 };
  }

  function setInputHint(html) {
    const hint = document.createElement("div");
    hint.id = "inputHint";
    hint.className =
      "text-xs text-gray-500 mt-1 font-medium flex items-start gap-1";
    hint.innerHTML = `<i class="ph-bold ph-info text-[#d6c07a] mt-0.5"></i><span>${html}</span>`;
    amountInput.parentNode.appendChild(hint);
  }

  function updateInputHelper() {
    if (!amountInput || !fromSel.value) return;
    const currency = fromSel.value;
    const existingHint = document.getElementById("inputHint");
    if (existingHint) existingHint.remove();

    if (currentMode === "papel" && PAPER_RULES[currency]) {
      const rule = PAPER_RULES[currency];
      amountInput.step = rule.minStep;
      amountInput.min = rule.minStep;
      amountInput.placeholder = `Múltiplos de ${rule.minStep}`;
      setInputHint(`Notas disponíveis: ${rule.notes}`);
    } else if (currentMode === "venda") {
      const rule = SELL_RULES[currency];
      if (isSellConsult(currency) || !rule) {
        amountInput.step = "1";
        amountInput.min = "1";
        amountInput.placeholder = "Exemplo: 500";
        setInputHint(
          "Cotação sob consulta: o especialista informa a taxa pelo WhatsApp. Apenas cédulas (sem moedas metálicas).",
        );
      } else {
        amountInput.step = rule.step;
        amountInput.min = rule.min;
        amountInput.placeholder = `Mínimo ${rule.min.toLocaleString("pt-BR")}`;
        setInputHint(
          `Mínimo ${currency} ${rule.min.toLocaleString("pt-BR")} · Cédulas aceitas: ${rule.notes} (sem moedas metálicas)`,
        );
      }
    } else if (currentMode === "descarga") {
      amountInput.step = "0.01";
      amountInput.min = "0";
      amountInput.placeholder = "Saldo total do cartão";
      setInputHint(
        "Informe o <strong>saldo total</strong> do seu cartão M&A nesta moeda. A descarga é sempre do valor integral (não existe descarga parcial).",
      );
    } else if (currentMode === "cartao" && CARD_MIN[currency]) {
      const min = CARD_MIN[currency];
      const step = CARD_STEP[currency];
      amountInput.step = step || "0.01";
      amountInput.min = min;
      amountInput.placeholder = `Mínimo ${min.toLocaleString("pt-BR")}`;
      let hint = `Mínimo para ${cardOp === "recarga" ? "recarga" : "carga"}: ${currency} ${min.toLocaleString("pt-BR")}`;
      if (step)
        hint += ` · Apenas valores redondos (múltiplos de ${step.toLocaleString("pt-BR")})`;
      if (cardOp === "carga")
        hint += ` · Delivery a partir de ${currency} ${(min * CARD_DELIVERY_MIN_MULTIPLIER).toLocaleString("pt-BR")}`;
      setInputHint(hint);
    } else {
      amountInput.step = "0.01";
      amountInput.min = "0";
      amountInput.placeholder = "Exemplo: 1000";
    }
  }

  function setMode(mode, op) {
    if (mode === "cartao" && op) cardOp = op;
    if (Object.keys(ratesPapel).length === 0) {
      fetchSheetRates().then(() => setModeUI(mode));
    } else {
      setModeUI(mode);
    }
  }

  // Menu de operação: principal (Papel Comprar / Papel Vender / Cartão)
  // ou submenu do cartão (Carga / Recarga / Descarga)
  let cardMenuOpen = false;

  function renderOperationMenu() {
    const setActive = (btn, active) => {
      if (btn) btn.classList.toggle("is-active", !!active);
    };
    setActive(btnPapel, currentMode === "papel");
    setActive(btnVenda, currentMode === "venda");
    setActive(
      btnCartao,
      currentMode === "cartao" || currentMode === "descarga",
    );
    setActive(btnDescarga, currentMode === "descarga");
    setActive(btnCarga, currentMode === "cartao" && cardOp === "carga");
    setActive(btnRecarga, currentMode === "cartao" && cardOp === "recarga");

    if (opMain) opMain.classList.toggle("hidden", cardMenuOpen);
    if (opCard) opCard.classList.toggle("hidden", !cardMenuOpen);
    if (opBackBtn) opBackBtn.classList.toggle("hidden", !cardMenuOpen);
    if (opTitle)
      opTitle.textContent = cardMenuOpen ? "Cartão Pré-pago" : "Operação";
    if (opSubtitle)
      opSubtitle.textContent = cardMenuOpen
        ? "Selecione o tipo da sua operação"
        : "Selecione o tipo da sua operação entre Papel-Espécie ou Cartão Pré-pago (carga, recarga ou descarga)";
  }

  function updateCurrencyListHint() {
    if (!currencyListHint) return;
    const hints = {
      papel: "Selecione a moeda estrangeira que deseja comprar em espécie",
      venda:
        "Valor que a M&A paga por unidade (taxas válidas para cédulas de série atual)",
      carga: "Selecione a moeda da carga do seu cartão novo da M&A",
      recarga: "Selecione a moeda da recarga do seu cartão M&A",
      descarga: "Valor que a M&A paga por unidade do saldo do seu cartão M&A",
    };
    const key = currentMode === "cartao" ? cardOp : currentMode;
    currencyListHint.textContent =
      hints[key] || "Selecione a moeda estrangeira de sua preferência";
  }

  function setModeUI(mode) {
    currentMode = mode;
    available = getRatesForMode(mode);

    renderOperationMenu();
    updateCurrencyListHint();
    populateCurrencyList();
    fillSelector();
    updateInputHelper();
    if (errorMsg) errorMsg.classList.add("hidden");

    const currentCurrency = fromSel.value;

    // Se tiver moeda e valor, já recalcula ao trocar de operação
    if (currentCurrency && available[currentCurrency] && amountInput.value) {
      highlightSelectedCurrency(currentCurrency);
      updateDisplayConversion();
    } else {
      resultCard.classList.add("hidden");
      comparisonGrid.innerHTML = "";
      restoreBuyBtn();
    }
    // Comparativo não se aplica à descarga
    getEl("comparisonSection")?.classList.toggle("hidden", mode === "descarga");
  }

  function restoreBuyBtn() {
    const currentBuyBtn = getEl("buyBtn");
    if (currentBuyBtn && originalBuyBtnHTML) {
      currentBuyBtn.outerHTML = originalBuyBtnHTML;
      window.buyBtn = getEl("buyBtn");
      if (window.buyBtn) {
        window.buyBtn.onclick = (e) => {
          e.preventDefault();
          openModal();
        };
      }
    }
    const w = document.getElementById("closedWarning");
    if (w) w.remove();
    // Remove também os avisos (exóticas, venda sob consulta, recarga) se existirem
    document.querySelectorAll(".exotic-warning").forEach((el) => el.remove());
  }

  if (btnPapel)
    btnPapel.onclick = () => {
      cardMenuOpen = false;
      setMode("papel");
    };
  if (btnVenda)
    btnVenda.onclick = () => {
      cardMenuOpen = false;
      setMode("venda");
    };
  if (btnCartao)
    btnCartao.onclick = () => {
      cardMenuOpen = true;
      setMode("cartao", cardOp || "carga");
    };
  if (btnCarga) btnCarga.onclick = () => setMode("cartao", "carga");
  if (btnRecarga) btnRecarga.onclick = () => setMode("cartao", "recarga");
  if (btnDescarga)
    btnDescarga.onclick = () => {
      cardMenuOpen = true;
      setMode("descarga");
    };
  if (opBackBtn)
    opBackBtn.onclick = () => {
      cardMenuOpen = false;
      renderOperationMenu();
    };

  function populateCurrencyList() {
    currencyList.innerHTML = "";
    Object.keys(available).forEach((code) => {
      const btn = document.createElement("button");
      const isSelected = fromSel.value === code;
      const isExoticDisplay =
        currentMode === "papel" && PAPER_RULES[code]?.isExotic;
      const isConsultDisplay = isSellConsult(code);

      // Valor da taxa
      const rateValue = `R$ ${formatRate(available[code].raw)}`;

      let rateDisplay;
      if (isConsultDisplay) {
        // Venda sem taxa no simulador: só a tag "Sob Consulta"
        rateDisplay = `<span class="text-[9px] uppercase tracking-wide text-red-400 bg-red-50 px-1.5 py-0.5 rounded">Sob Consulta</span>`;
      } else if (isExoticDisplay) {
        // Exótica (compra): taxa em vermelho + "Sob Consulta"
        rateDisplay = `<div class="flex flex-col items-start">
             <span class="text-red-500 font-bold">${rateValue}</span>
             <span class="text-[9px] uppercase tracking-wide text-red-400 bg-red-50 px-1.5 py-0.5 rounded mt-0.5">Sob Consulta</span>
           </div>`;
      } else {
        rateDisplay = `<span class="text-gray-500">${rateValue}</span>`;
      }

      btn.className = `text-left p-3 rounded-lg border transition-all h-full flex flex-col justify-center ${
        isSelected
          ? "border-[#d6c07a] bg-[#fffdf5] ring-2 ring-[#d6c07a]/20"
          : "border-gray-200 bg-white hover:bg-gray-50"
      }`;

      btn.innerHTML = `
        <div class="text-sm font-medium flex items-center text-gray-800 mb-1">
          ${getFlagElement(code)} ${code}
        </div>
        <div class="text-xs mt-auto">
          ${rateDisplay}
        </div>`;

      btn.onclick = () => {
        fromSel.value = code;
        highlightSelectedCurrency(code);
        updateInputHelper();

        if (amountInput.value > 0) {
          updateDisplayConversion();
        } else {
          resultCard.classList.add("hidden");
        }
      };
      currencyList.appendChild(btn);
    });
    highlightSelectedCurrency(fromSel.value);
  }

  function highlightSelectedCurrency(code) {
    document.querySelectorAll("#currencyList button").forEach((btn) => {
      btn.classList.remove(
        "border-[#d6c07a]",
        "bg-[#fffdf5]",
        "ring-2",
        "ring-[#d6c07a]/20",
      );
      btn.classList.add("border-gray-200", "bg-white");
      if (code && btn.textContent.includes(code)) {
        btn.classList.remove("border-gray-200", "bg-white");
        btn.classList.add(
          "border-[#d6c07a]",
          "bg-[#fffdf5]",
          "ring-2",
          "ring-[#d6c07a]/20",
        );
      }
    });
  }

  // --- SELECT COM SINCRONIZAÇÃO ATUALIZADA ---
  function fillSelector() {
    const current = fromSel.value;
    fromSel.disabled = false;
    fromSel.innerHTML =
      '<option value="" disabled selected>Selecione a moeda...</option>';

    Object.keys(available).forEach((code) => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = `${getFlagEmoji(code)} ${code}`;
      fromSel.appendChild(opt);
    });

    if (current && available[current]) fromSel.value = current;

    // Sincronização ao mudar o Select
    fromSel.onchange = () => {
      const selectedCode = fromSel.value;
      highlightSelectedCurrency(selectedCode);
      updateInputHelper();

      if (amountInput.value > 0) {
        updateDisplayConversion();
      }
    };
  }

  const CLOSED_ALERT_MSG =
    "Para solicitar e finalizar sua operação, nosso atendimento funciona de Segunda a Sexta, das 09h30 às 18h00. Fora desse horário (período noturno), finais de semana e feriados, o sistema de solicitação permanece fechado.";

  // Troca o botão de ação do resultado. Fora do horário comercial vira
  // "Atendimento Encerrado" (simulação continua liberada).
  //  - style "gold": abre o formulário (compra, venda, carga)
  //  - style "whatsapp": vai direto ao WhatsApp (exótica, venda sob consulta, recarga)
  function setActionButton({ label, style, onClick }) {
    const oldBtn = getEl("buyBtn");
    if (!oldBtn) return;
    const existingWarning = getEl("closedWarning");
    if (existingWarning) existingWarning.remove();

    const btn = document.createElement("button");
    btn.id = "buyBtn";
    btn.type = "button";

    if (!isMarketOpen()) {
      btn.className =
        "group mt-4 w-full h-14 px-4 rounded-xl bg-gray-400 cursor-not-allowed text-white font-bold text-lg shadow-none flex items-center justify-center gap-2";
      btn.innerHTML = `<i class="ph-bold ph-clock-afternoon"></i> Atendimento Encerrado`;
      btn.onclick = (e) => {
        e.preventDefault();
        alert(CLOSED_ALERT_MSG);
      };
      oldBtn.replaceWith(btn);
      const warningBox = document.createElement("div");
      warningBox.id = "closedWarning";
      warningBox.className =
        "mt-3 text-center text-xs text-red-500 font-medium bg-red-50 p-2 rounded border border-red-100 animate-pulse";
      warningBox.innerHTML =
        "O mercado está fechado. Simulações liberadas, solicitações apenas em horário comercial.";
      btn.parentNode.appendChild(warningBox);
    } else {
      btn.className =
        style === "whatsapp"
          ? "group mt-4 w-full h-14 px-4 rounded-xl bg-[#25D366] hover:bg-[#128C7E] text-white font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
          : "group mt-4 w-full h-14 px-4 rounded-xl bg-gold hover:bg-gold-hover text-gray-700 font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-2";
      btn.innerHTML =
        style === "whatsapp"
          ? `<i class="ph-bold ph-whatsapp-logo text-xl"></i> ${label}`
          : `${label} <i class="ph-bold ph-arrow-right text-xl transition-transform group-hover:translate-x-1.5"></i>`;
      btn.onclick = (e) => {
        e.preventDefault();
        onClick();
      };
      oldBtn.replaceWith(btn);
    }
    window.buyBtn = btn;
  }

  // Aviso destacado no topo dos detalhes do resultado
  function insertResultNotice(title, text, tone) {
    const tones = {
      yellow: [
        "bg-yellow-50 border-yellow-200",
        "text-yellow-800",
        "text-yellow-700",
      ],
      blue: ["bg-blue-50 border-blue-100", "text-blue-800", "text-blue-700"],
      gray: ["bg-gray-50 border-gray-200", "text-gray-800", "text-gray-600"],
    };
    const [box, titleColor, textColor] = tones[tone] || tones.yellow;
    calcDetails.insertAdjacentHTML(
      "afterbegin",
      `<div class="exotic-warning mb-4 p-3 border rounded-lg ${box}">
        <div class="text-sm font-bold ${titleColor} flex items-center gap-2">
          <i class="ph-bold ph-warning-circle text-xl"></i> ${title}
        </div>
        <p class="text-xs ${textColor} mt-1 leading-relaxed">${text}</p>
      </div>`,
    );
  }

  // Envia ao WhatsApp e recarrega a página (mesmo comportamento das exóticas)
  function sendToWhatsAppAndReset(msg) {
    openWhatsApp(OPERATORS[Date.now() % 2], msg);
    setTimeout(() => window.location.reload(), 2000);
  }

  // --- COMPRA DE EXÓTICAS: aviso + botão WhatsApp ---
  function displayExoticWarning(currencyCode, amount, res) {
    const currencyName = PAPER_RULES[currencyCode].name;
    const formattedTotal = formatBRL(res.totalBRL);

    insertResultNotice(
      "Cotação Sujeita a Confirmação",
      `O valor de <strong>${formattedTotal}</strong> é uma estimativa baseada na taxa de fechamento, e a cotação pode sofrer alterações por ser uma moeda exótica, ${currencyName}. Portanto, a operação deve ser confirmada diretamente com a mesa.`,
      "yellow",
    );

    setActionButton({
      label: "Confirmar no WhatsApp",
      style: "whatsapp",
      onClick: () => {
        const msg = `Olá, M&A Consultoria Câmbio! 😊

Fiz uma simulação de *compra de moeda exótica* no site:

• *Moeda:* ${formatAmount(amount)} ${currencyCode} (${currencyName})
• *Cotação Turismo:* R$ ${formatRate(res.cotaçãoBase)}
• *IOF:* ${formatBRL(res.totalIOFValue)}
• *VET estimado:* R$ ${formatRate(res.VET)}

👉 *TOTAL ESTIMADO: ${formattedTotal}*

Gostaria de confirmar a taxa exata e a disponibilidade para fechar a operação.`;
        sendToWhatsAppAndReset(msg);
      },
    });
  }

  function renderQuoteTime(time) {
    if (!quoteTime) return;
    quoteTime.innerHTML = `<i class="ph-bold ph-clock"></i> Cotação: ${time.toLocaleDateString(
      "pt-BR",
      { timeZone: "America/Sao_Paulo" },
    )} às ${time.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    })}`;
  }

  const SELL_NOTES_NOTICE =
    "Taxas válidas para <strong>cédulas de série atual</strong>. Cédulas de séries antigas, somente com o especialista pelo WhatsApp. Não compramos cédulas rabiscadas, manchadas ou rasgadas, nem moedas metálicas. As cédulas são entregues por você na <strong>loja parceira da M&A mais próxima do seu CEP</strong>.";

  // --- VENDA SEM TAXA NO SIMULADOR (sob consulta) ---
  function renderSellConsult(currencyCode, amount) {
    currentQuote = null;
    resultCard.classList.remove("hidden");
    resultCard.classList.add("fade-in");
    if (resultLabel) resultLabel.textContent = "Valor Total a Receber";
    resultValue.textContent = "Sob consulta";
    renderQuoteTime(lastFetchTime || new Date());

    calcDetails.innerHTML = `
      <div class="flex justify-between text-sm border-b pb-2 mb-2">
        <span class="text-gray-600">Quantidade</span>
        <span class="font-mono">${formatAmount(amount)} ${currencyCode}</span>
      </div>
      <div class="flex justify-between text-sm pt-1">
        <span class="text-gray-600">Taxa de venda unitária</span>
        <span class="font-mono font-bold text-[#d6c07a]">Sob consulta</span>
      </div>`;
    insertResultNotice(
      "Cotação sob consulta",
      `A M&A compra ${currencyCode}, mas a taxa desta moeda é informada diretamente pelo especialista no WhatsApp. ${SELL_NOTES_NOTICE}`,
      "yellow",
    );

    updateComparison(currencyCode, amount);

    setActionButton({
      label: "Consultar no WhatsApp",
      style: "whatsapp",
      onClick: () => {
        const msg = `Olá, M&A Consultoria Câmbio! 😊

Gostaria de *vender papel espécie* e consultar a cotação:

• *Moeda:* ${formatAmount(amount)} ${currencyCode}

Pode me informar a taxa e a loja mais próxima para eu levar as cédulas?`;
        sendToWhatsAppAndReset(msg);
      },
    });
  }

  // --- DESCARGA DE CARTÃO: simulação + nome/CPF + WhatsApp ---
  // --- IDENTIFICAÇÃO DO TITULAR (recarga e descarga de cartão) ---
  // Cliente já é da M&A: não preenche cadastro. Informa nome e CPF e envia a
  // foto do cartão (com o número completo) ao especialista pelo WhatsApp.
  // O que foi digitado fica guardado, porque a tela é redesenhada a cada
  // atualização de taxas e ao trocar entre recarga e descarga.
  const cardHolder = { name: "", cpf: "" };

  function cardHolderBlockHTML(opName) {
    return `
      <div class="mt-4 p-4 rounded-lg border border-gray-200 bg-white">
        <p class="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2"><i class="ph-bold ph-identification-card text-[#d6c07a]"></i> Identificação do titular</p>
        <p class="text-xs text-gray-500 mb-3">Para o especialista localizar seu cadastro. Não é preciso preencher o cadastro completo.</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="sm:col-span-2"><label for="unloadName" class="block text-xs font-bold text-gray-600 mb-1">Nome completo</label><input type="text" id="unloadName" autocomplete="name" class="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#d6c07a] focus:border-[#d6c07a]" placeholder="Igual ao documento"></div>
          <div class="sm:col-span-2"><label for="unloadCPF" class="block text-xs font-bold text-gray-600 mb-1">CPF</label><input type="text" id="unloadCPF" inputmode="numeric" class="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#d6c07a] focus:border-[#d6c07a]" placeholder="000.000.000-00"></div>
        </div>
        <p class="text-xs text-gray-600 mt-3 leading-relaxed flex items-start gap-1.5"><i class="ph-bold ph-camera text-[#d6c07a] mt-0.5"></i><span>No WhatsApp, envie uma <strong>foto do cartão onde apareça o número completo</strong>, para o especialista fazer a ${opName}.</span></p>
      </div>`;
  }

  // Liga os campos (restaura o digitado e aplica a máscara do CPF)
  function mountCardHolderInputs() {
    const nameInput = getEl("unloadName");
    const cpfInput = getEl("unloadCPF");
    if (!nameInput || !cpfInput) return;
    nameInput.value = cardHolder.name;
    cpfInput.value = cardHolder.cpf;
    nameInput.addEventListener("input", (e) => {
      cardHolder.name = e.target.value;
    });
    cpfInput.addEventListener("input", (e) => {
      e.target.value = e.target.value
        .replace(/\D/g, "")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})/, "$1-$2")
        .replace(/(-\d{2})\d+?$/, "$1");
      cardHolder.cpf = e.target.value;
    });
  }

  // Valida nome completo e CPF. Retorna { name, cpf } ou null (e mostra o erro).
  function readCardHolder(opName) {
    const name = getEl("unloadName").value.trim().replace(/\s+/g, " ");
    const cpf = getEl("unloadCPF").value.trim();
    if (name.split(" ").length < 2) {
      getEl("unloadName").focus();
      showError(`Informe seu nome completo para a ${opName}.`);
      return null;
    }
    if (!isValidCPF(cpf)) {
      getEl("unloadCPF").focus();
      showError(`Informe um CPF válido para a ${opName}.`);
      return null;
    }
    return { name, cpf };
  }

  // --- DESCARGA DE CARTÃO: simulação + identificação do titular + WhatsApp ---
  function renderUnload(currencyCode, amount) {
    const consult = isSellConsult(currencyCode);
    const res = consult
      ? null
      : calculateConversion("descarga", currencyCode, amount);
    if (!consult && (!res || res.VET === 0)) {
      showError("Taxa não disponível para esta moeda no momento.");
      resultCard.classList.add("hidden");
      return;
    }
    currentQuote = res;

    resultCard.classList.remove("hidden");
    resultCard.classList.add("fade-in");
    if (resultLabel) resultLabel.textContent = "Valor Total a Receber";
    resultValue.textContent = res ? formatBRL(res.totalBRL) : "Sob consulta";
    renderQuoteTime(res ? res.time : lastFetchTime || new Date());

    const detailRows = res
      ? renderSellBreakdown(res, "Saldo do cartão (integral)")
      : `
      <div class="flex justify-between text-sm border-b pb-2 mb-2">
        <span class="text-gray-600">Saldo do cartão (integral)</span>
        <span class="font-mono">${formatAmount(amount)} ${currencyCode}</span>
      </div>
      <div class="flex justify-between text-sm pt-1">
        <span class="text-gray-600">Taxa VET Unitária</span>
        <span class="font-mono font-bold text-[#d6c07a]">Sob consulta</span>
      </div>`;

    calcDetails.innerHTML = detailRows + cardHolderBlockHTML("descarga");
    insertResultNotice(
      "Descarga somente do saldo integral",
      "Não existe descarga parcial: é vendido todo o saldo do cartão na moeda escolhida (ex.: com USD 200 no cartão, a descarga é de USD 200).",
      "blue",
    );

    mountCardHolderInputs();

    updateComparison(currencyCode, amount);

    setActionButton({
      label: "Solicitar Descarga no WhatsApp",
      style: "whatsapp",
      onClick: () => {
        const holder = readCardHolder("descarga");
        if (!holder) return;
        const { name, cpf } = holder;
        const valueLines = res
          ? `• *Valor líquido:* ${formatBRL(res.conversionBase)}
• *Cotação turismo:* R$ ${formatRate(res.cotaçãoBase)}
• *IOF (${(UNLOAD_IOF_RATE * 100).toFixed(2).replace(".", ",")}%):* − ${formatBRL(res.totalIOFValue)}
• *VET Final:* R$ ${formatRate(res.VET)}

👉 *VALOR ESTIMADO A RECEBER: ${formatBRL(res.totalBRL)}*`
          : `• *VET:* sob consulta (pode me informar?)`;
        const msg = `Olá, M&A Consultoria Câmbio! 😊

Meu nome é *${name}* (CPF *${cpf}*).

Já sou cliente e gostaria de fazer a *descarga do meu cartão pré-pago M&A* (saldo integral):

• *Saldo do cartão:* ${formatAmount(amount)} ${currencyCode}
${valueLines}

📎 Estou enviando a foto do cartão com o número completo para vocês fazerem a descarga.`;
        sendToWhatsAppAndReset(msg);
      },
    });
  }

  // Detalhamento das operações em que o cliente recebe (venda e descarga):
  // mesmas linhas da compra, com o IOF descontado do valor a receber.
  function renderSellBreakdown(res, amountLabel) {
    const iofPct = (res.iofRate * 100).toFixed(2).replace(".", ",");
    const row = (label, tip, value, last) => `
      <div class="flex justify-between text-sm ${last ? "pt-1" : "border-b pb-2 mb-2"}">
        <span class="text-gray-600 flex items-center gap-1">${label}${tip ? ` <span class="tooltip"><i class="ph-bold ph-info cursor-pointer hover:text-[#d6c07a] transition-colors"></i><span class="tooltiptext font-normal normal-case tracking-normal text-left">${tip}</span></span>` : ""}</span>
        ${value}
      </div>`;
    return (
      row(
        amountLabel,
        "",
        `<span class="font-mono">${formatAmount(res.amount)} ${res.currencyCode}</span>`,
      ) +
      row(
        "Valor Líquido",
        "Valor total convertido sem impostos",
        `<span class="font-mono">${formatBRL(res.conversionBase)}</span>`,
      ) +
      row(
        "Cotação Turismo",
        "Valor unitário da moeda sem impostos",
        `<span class="font-mono">R$ ${formatRate(res.cotaçãoBase)}</span>`,
      ) +
      row(
        `IOF (${iofPct}%)`,
        "Imposto obrigatório sobre Operações Financeiras, descontado do valor a receber",
        `<span class="font-mono">− ${formatBRL(res.totalIOFValue)}</span>`,
      ) +
      row(
        "Taxa VET Unitária",
        "O Valor Efetivo Total (VET) é um índice médio exibido com 4 casas por norma do Bacen. O total a receber é o Valor Líquido menos o IOF.",
        `<span class="font-mono font-bold text-[#d6c07a]">R$ ${formatRate(res.VET)}</span>`,
        true,
      )
    );
  }

  // --- FUNÇÃO DE EXIBIÇÃO PRINCIPAL ---
  function updateDisplayConversion() {
    const from = fromSel.value;
    const amount = parseFloat(amountInput.value);

    if (!currentMode || !from || !amount || amount <= 0) {
      resultCard.classList.add("hidden");
      return;
    }

    // Restaura botão padrão e remove avisos antes de tudo
    restoreBuyBtn();

    // 1. Validações por operação
    const validations = [
      validatePaperAmount(from, amount),
      validateSellAmount(from, amount),
      validateCardAmount(from, amount),
    ];
    const failed = validations.find((v) => !v.valid);
    if (failed) {
      showError(failed.msg);
      resultCard.classList.add("hidden");
      comparisonGrid.innerHTML = "";
      currentQuote = null;
      return;
    }
    if (errorMsg) errorMsg.classList.add("hidden");

    // 2. Descarga de cartão: fluxo próprio (sem cadastro, direto ao WhatsApp)
    if (currentMode === "descarga") {
      renderUnload(from, amount);
      return;
    }

    // 3. Venda de moeda sem taxa no simulador → sob consulta (WhatsApp)
    if (isSellConsult(from)) {
      renderSellConsult(from, amount);
      return;
    }

    // 3. Cálculo
    const res = calculateConversion(currentMode, from, amount);

    if (!res || res.VET === 0) {
      showError("Taxa não disponível para esta moeda no momento.");
      resultCard.classList.add("hidden");
      currentQuote = null;
      return;
    }

    currentQuote = res;
    resultCard.classList.remove("hidden");
    resultCard.classList.add("fade-in");
    if (resultLabel)
      resultLabel.textContent = res.isSell
        ? "Valor Total a Receber"
        : "Valor Total (VET)";
    resultValue.textContent = formatBRL(res.totalBRL);
    renderQuoteTime(res.time);

    // 4. Detalhes
    if (calcDetails) {
      if (res.isSell) {
        calcDetails.innerHTML = renderSellBreakdown(res, "Quantidade");
        insertResultNotice("Atenção às cédulas", SELL_NOTES_NOTICE, "gray");
      } else {
        const iofPct = (res.iofRate * 100).toFixed(2).replace(".", ",");
        calcDetails.innerHTML = `
        <div class="flex justify-between text-sm border-b pb-2 mb-2">
          <span class="text-gray-600 flex items-center gap-1">Valor Líquido <span class="tooltip"><i class="ph-bold ph-info"></i><span class="tooltiptext">Valor total convertido sem impostos</span></span></span>
          <span class="font-mono">${formatBRL(res.conversionBase)}</span>
        </div>
        <div class="flex justify-between text-sm border-b pb-2 mb-2">
          <span class="text-gray-600 flex items-center gap-1">Cotação Turismo<span class="tooltip"><i class="ph-bold ph-info"></i><span class="tooltiptext">Valor unitário da moeda sem impostos</span></span></span>
          <span class="font-mono">R$ ${formatRate(res.cotaçãoBase)}</span>
        </div>
        <div class="flex justify-between text-sm border-b pb-2 mb-2">
          <span class="text-gray-600 flex items-center gap-1">IOF (${iofPct}%) <span class="tooltip"><i class="ph-bold ph-info"></i><span class="tooltiptext">Imposto obrigatório sobre Operações Financeiras</span></span></span>
          <span class="font-mono">${formatBRL(res.totalIOFValue)}</span>
        </div>
        <div class="flex justify-between text-sm pt-1">
          <span class="text-gray-600 flex items-center gap-1">Taxa VET Unitária 
            <span class="tooltip">
              <i class="ph-bold ph-info cursor-pointer hover:text-[#d6c07a] transition-colors"></i>
              <span class="tooltiptext font-normal normal-case tracking-normal text-left">O Valor Efetivo Total (VET) é um índice médio exibido com 4 casas por norma do Bacen, o total a pagar é calculado pela soma exata do Valor Líquido com os Impostos.</span>
            </span>
          </span>
          <span class="font-mono font-bold text-[#d6c07a]">R$ ${formatRate(res.VET)}</span>
        </div>`;
      }
    }

    updateComparison(from, amount);

    // 5. Botão de ação conforme a operação
    const isExotic = PAPER_RULES[from] && PAPER_RULES[from].isExotic;

    if (currentMode === "papel" && isExotic) {
      displayExoticWarning(from, amount, res);
    } else if (currentMode === "venda") {
      setActionButton({
        label: "Solicitar Venda",
        style: "gold",
        onClick: openModal,
      });
    } else if (currentMode === "cartao" && cardOp === "recarga") {
      calcDetails.insertAdjacentHTML(
        "beforeend",
        cardHolderBlockHTML("recarga"),
      );
      mountCardHolderInputs();
      insertResultNotice(
        "Recarga direto com o especialista",
        "Como você já é cliente M&A, a recarga não precisa de cadastro completo: informe seu nome e CPF abaixo e você será direcionado ao WhatsApp para enviar a foto do cartão e efetuar o pagamento.",
        "blue",
      );
      setActionButton({
        label: "Solicitar Recarga no WhatsApp",
        style: "whatsapp",
        onClick: () => {
          const holder = readCardHolder("recarga");
          if (!holder) return;
          const iofPct = (res.iofRate * 100).toFixed(2).replace(".", ",");
          const msg = `Olá, M&A Consultoria Câmbio! 😊

Meu nome é *${holder.name}* (CPF *${holder.cpf}*).

Já sou cliente e gostaria de fazer uma *recarga no meu cartão pré-pago M&A*:

• *Moeda:* ${formatAmount(res.amount)} ${res.currencyCode}
• *Valor líquido:* ${formatBRL(res.conversionBase)}
• *Cotação turismo:* R$ ${formatRate(res.cotaçãoBase)}
• *IOF (${iofPct}%):* ${formatBRL(res.totalIOFValue)}
• *VET Final:* R$ ${formatRate(res.VET)}

👉 *TOTAL ESTIMADO A PAGAR: ${formatBRL(res.totalBRL)}*

📎 Estou enviando a foto do cartão com o número completo para vocês fazerem a recarga.`;
          sendToWhatsAppAndReset(msg);
        },
      });
    } else {
      setActionButton({
        label:
          currentMode === "cartao" ? "Solicitar Cartão" : "Solicitar Câmbio",
        style: "gold",
        onClick: openModal,
      });
    }
  }

  function buildComparisonCard({
    title,
    icon,
    isCurrent,
    bigLabel,
    res,
    rows,
    onClick,
    unavailableText,
  }) {
    const borderClass = isCurrent
      ? "border-[#d6c07a] bg-[#fffdf5] ring-1 ring-[#d6c07a]/20 shadow-md"
      : "border-gray-200 bg-white hover:border-gray-300";
    const div = document.createElement("div");
    div.className = `p-5 rounded-xl border transition-all ${isCurrent ? "" : "cursor-pointer"} flex flex-col justify-between ${borderClass}`;
    const selectedTag = isCurrent
      ? '<span class="text-[10px] font-bold text-[#d6c07a] bg-[#d6c07a]/10 px-2 py-1 rounded uppercase tracking-wider">Selecionado</span>'
      : "";

    if (res) {
      div.innerHTML = `
        <div class="flex justify-between items-start mb-4"><div class="font-bold text-gray-800 flex items-center gap-2">${icon} ${title}</div>${selectedTag}</div>
        <div class="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">${bigLabel}</div>
        <div class="text-3xl font-extrabold text-gray-800 mb-6 tracking-tight">${res.totalText}</div>
        <div class="space-y-2 text-xs text-gray-500 border-t border-gray-100 pt-4">
          ${rows.map(([k, v]) => `<div class="flex justify-between items-center"><span>${k}</span><span class="font-mono text-gray-700">${v}</span></div>`).join("")}
        </div>`;
      if (!isCurrent && onClick) div.onclick = onClick;
    } else {
      div.innerHTML = `<div class="flex justify-between items-start mb-2"><div class="font-bold text-gray-500 flex items-center gap-2">${icon} ${title}</div>${selectedTag}</div><div class="text-sm text-red-400 bg-red-50 p-2 rounded">${unavailableText || "Indisponível no momento"}</div>`;
    }
    return div;
  }

  function updateComparison(currency, amount) {
    comparisonGrid.innerHTML = "";
    const comparisonSection = getEl("comparisonSection");
    if (comparisonSection)
      comparisonSection.classList.toggle("hidden", currentMode === "descarga");
    if (currentMode === "descarga") return;

    // VENDA: compra × venda da mesma moeda
    if (currentMode === "venda") {
      if (comparisonHint)
        comparisonHint.textContent =
          "Compare o valor de compra e de venda da mesma moeda";

      const buy = calculateConversion("papel", currency, amount);
      comparisonGrid.appendChild(
        buildComparisonCard({
          title: "Papel Espécie — Comprar",
          icon: `<i class="ph-bold ph-money text-xl"></i>`,
          isCurrent: false,
          bigLabel: "Você paga",
          res:
            buy && buy.VET > 0 ? { totalText: formatBRL(buy.totalBRL) } : null,
          rows:
            buy && buy.VET > 0
              ? [
                  ["Taxa VET Un.", `R$ ${formatRate(buy.VET)}`],
                  ["Cotação Turismo", `R$ ${formatRate(buy.cotaçãoBase)}`],
                ]
              : [],
          onClick: () => {
            cardMenuOpen = false;
            setMode("papel");
          },
        }),
      );

      const sellConsult = isSellConsult(currency);
      const sell = sellConsult
        ? null
        : calculateConversion("venda", currency, amount);
      comparisonGrid.appendChild(
        buildComparisonCard({
          title: "Papel Espécie — Vender",
          icon: `<i class="ph-bold ph-hand-coins text-xl"></i>`,
          isCurrent: true,
          bigLabel: "Você recebe",
          res:
            sell && sell.VET > 0
              ? { totalText: formatBRL(sell.totalBRL) }
              : null,
          rows:
            sell && sell.VET > 0
              ? [
                  ["Valor Líquido", formatBRL(sell.conversionBase)],
                  ["Cotação Turismo", `R$ ${formatRate(sell.cotaçãoBase)}`],
                  [
                    `IOF (${(sell.iofRate * 100).toFixed(2).replace(".", ",")}%)`,
                    `− ${formatBRL(sell.totalIOFValue)}`,
                  ],
                  ["Taxa VET Un.", `R$ ${formatRate(sell.VET)}`],
                ]
              : [],
          unavailableText: sellConsult
            ? "Cotação sob consulta no WhatsApp"
            : null,
        }),
      );
      return;
    }

    // COMPRA (papel) e CARTÃO: papel × cartão
    if (comparisonHint)
      comparisonHint.textContent =
        "Veja a diferença de valores para cada operação e escolha a melhor opção";

    ["papel", "cartao"].forEach((mode) => {
      // Exóticas só existem no papel, então ignora cartao
      if (PAPER_RULES[currency]?.isExotic && mode === "cartao") return;

      const res = calculateConversion(mode, currency, amount);
      const isCurrent = mode === currentMode;
      let titleText = mode === "papel" ? "Papel Espécie" : "Cartão Pré-pago";
      if (mode === "cartao" && currentMode === "cartao")
        titleText += cardOp === "recarga" ? " — Recarga" : " — Carga";
      const iofPct = res
        ? (res.iofRate * 100).toFixed(2).replace(".", ",")
        : "";

      comparisonGrid.appendChild(
        buildComparisonCard({
          title: titleText,
          icon:
            mode === "papel"
              ? `<i class="ph-bold ph-money text-xl"></i>`
              : `<i class="ph-bold ph-credit-card text-xl"></i>`,
          isCurrent,
          bigLabel: "Você paga",
          res:
            res && res.VET > 0 ? { totalText: formatBRL(res.totalBRL) } : null,
          rows:
            res && res.VET > 0
              ? [
                  ["Valor Líquido", formatBRL(res.conversionBase)],
                  ["Cotação Turismo", `R$ ${formatRate(res.cotaçãoBase)}`],
                  [`IOF (${iofPct}%)`, formatBRL(res.totalIOFValue)],
                  ["Taxa VET Un.", `R$ ${formatRate(res.VET)}`],
                ]
              : [],
          onClick: () => {
            cardMenuOpen = mode === "cartao";
            setMode(mode);
          },
        }),
      );
    });
  }

  if (convertBtn) {
    convertBtn.onclick = async () => {
      if (!currentMode) return showError("Selecione o tipo de operação.");
      if (!fromSel.value || !amountInput.value)
        return showError("Preencha os campos.");

      const originalText = convertBtn.innerText;
      convertBtn.innerText = "Atualizando...";
      convertBtn.disabled = !0;

      await fetchSheetRates();
      updateDisplayConversion();

      convertBtn.innerText = originalText;
      convertBtn.disabled = !1;
    };
  }

  if (clearBtn) clearBtn.onclick = () => window.location.reload();

  function showError(msg) {
    if (errorMsg) {
      errorMsg.innerHTML = `<i class="ph-bold ph-warning-circle"></i> ${msg}`;
      errorMsg.classList.remove("hidden");
      setTimeout(() => errorMsg.classList.add("hidden"), 5000);
    } else {
      alert(msg);
    }
  }

  // Frete grátis quando a operação equivale a USD 500 ou mais (qualquer moeda,
  // papel-moeda ou cartão). A equivalência usa as taxas da mesma modalidade:
  // quantidade × taxa da moeda  >=  500 × taxa do USD.
  function isDeliveryFree(quote) {
    const ratesObj = quote.mode === "papel" ? ratesPapel : ratesCartao;
    const usdRate = Number(ratesObj.USD?.raw);
    const currencyRate = Number(ratesObj[quote.currencyCode]?.raw);

    if (usdRate > 0 && currencyRate > 0) {
      // Comparação em centavos inteiros para evitar erro de ponto flutuante
      const operationCents = Math.round(quote.amount * currencyRate * 100);
      const thresholdCents = Math.round(DELIVERY_FREE_MIN_USD * usdRate * 100);
      return operationCents >= thresholdCents;
    }

    // Fallback (taxa do USD indisponível): usa a tabela fixa antiga
    const threshold = DELIVERY_FREE_THRESHOLDS[quote.currencyCode];
    return !!threshold && quote.amount >= threshold;
  }

  // Delivery: venda nunca tem (cédulas vão à loja); carga de cartão só a partir
  // do dobro do mínimo da moeda; compra de papel sempre pode.
  function isDeliveryAllowed(quote) {
    if (quote.mode === "venda") return false;
    if (quote.mode === "cartao") {
      const min = CARD_MIN[quote.currencyCode];
      if (!min) return true;
      return quote.amount >= min * CARD_DELIVERY_MIN_MULTIPLIER;
    }
    return true;
  }

  function updateModalFinance() {
    if (!currentQuote) return;
    const isSell = currentQuote.isSell;

    // 1. Verifica se o usuário marcou a opção de delivery (nunca na venda)
    const isDelivery =
      !isSell &&
      isDeliveryAllowed(currentQuote) &&
      deliveryCheck &&
      deliveryCheck.checked;
    let deliveryFee = 0;

    // 2. Aplica a regra: frete grátis para operações equivalentes a USD 500 ou mais
    if (isDelivery) {
      deliveryFee = isDeliveryFree(currentQuote) ? 0 : DELIVERY_FEE_BRL;
    }

    // 3. Salva os dados atualizados no objeto para usarmos no WhatsApp
    currentQuote.deliveryFee = deliveryFee;
    currentQuote.finalTotalBRL = currentQuote.totalBRL + deliveryFee;

    // 4. Atualiza o Valor Total GIGANTE no Modal
    if (modalTotalLabel)
      modalTotalLabel.textContent = isSell
        ? "Total a receber (BRL)"
        : "Total a pagar (BRL)";
    if (modalTotalBRL) {
      modalTotalBRL.textContent = formatBRL(currentQuote.finalTotalBRL);
    }

    // 5. Constrói a linha visual do Frete (só aparece se a caixinha estiver marcada)
    let deliveryHtml = "";
    if (isDelivery) {
      const isFree = deliveryFee === 0;
      deliveryHtml = `
        <div class="flex justify-between text-gray-500">
          <span>Frete Delivery:</span>
          <span class="font-mono ${isFree ? "text-green-600 font-bold" : ""}">${isFree ? "R$ 0,00 (Grátis)" : formatBRL(deliveryFee)}</span>
        </div>`;
    }

    // 6. Atualiza o quadro de taxas interno (mantendo a sanfona no estado que estava)
    if (modalDetails) {
      const iofPct = (currentQuote.iofRate * 100).toFixed(2).replace(".", ",");
      const isHidden =
        document
          .getElementById("ratesContainer")
          ?.classList.contains("hidden") ?? true;

      const rowsHtml = isSell
        ? `<div class="flex justify-between text-gray-500"><span>Valor Líquido:</span><span class="font-mono">${formatBRL(currentQuote.conversionBase)}</span></div>
          <div class="flex justify-between text-gray-500"><span>IOF (${iofPct}%):</span><span class="font-mono">− ${formatBRL(currentQuote.totalIOFValue)}</span></div>
          <div class="flex justify-between text-gray-800 font-semibold mt-1 pt-1 border-t border-dashed border-gray-200">
            <span class="flex items-center gap-1">VET Final:</span>
            <span class="font-mono text-[#d6c07a]">R$ ${formatRate(currentQuote.VET)}</span>
          </div>`
        : `<div class="flex justify-between text-gray-500"><span>Valor Líquido:</span><span class="font-mono">${formatBRL(currentQuote.conversionBase)}</span></div>
          <div class="flex justify-between text-gray-500"><span>IOF (${iofPct}%):</span><span class="font-mono">${formatBRL(currentQuote.totalIOFValue)}</span></div>
          ${deliveryHtml}
          <div class="flex justify-between text-gray-800 font-semibold mt-1 pt-1 border-t border-dashed border-gray-200">
            <span class="flex items-center gap-1">VET Final:</span>
            <span class="font-mono text-[#d6c07a]">R$ ${formatRate(currentQuote.VET)}</span>
          </div>`;

      modalDetails.innerHTML = `
        <button type="button" id="toggleRatesBtn" class="text-[10px] uppercase font-bold text-gray-400 hover:text-[#d6c07a] flex items-center justify-end gap-1 w-full transition-colors focus:outline-none">
          ${isHidden ? 'Ver taxas <i class="ph-bold ph-caret-down"></i>' : 'Ocultar taxas <i class="ph-bold ph-caret-up"></i>'}
        </button>
        <div id="ratesContainer" class="${isHidden ? "hidden" : ""} mt-2 pt-2 border-t border-[#d6c07a]/10 text-xs space-y-1">
          ${rowsHtml}
        </div>`;

      // Religa o botão do clique nas taxas
      const btn = document.getElementById("toggleRatesBtn");
      const container = document.getElementById("ratesContainer");
      if (btn && container) {
        btn.onclick = () => {
          container.classList.toggle("hidden");
          btn.innerHTML = container.classList.contains("hidden")
            ? 'Ver taxas <i class="ph-bold ph-caret-down"></i>'
            : 'Ocultar taxas <i class="ph-bold ph-caret-up"></i>';
        };
      }
    }
  }

  // --- FORMA DE RECEBIMENTO (VENDA) ---
  const receiveRadios = document.querySelectorAll(
    'input[name="receiveMethod"]',
  );
  const PIX_INPUTS = ["pixKey"];
  const TED_INPUTS = ["bankName", "bankAgency", "bankAccount"];

  function getReceiveMethod() {
    const checked = document.querySelector(
      'input[name="receiveMethod"]:checked',
    );
    return checked ? checked.value : "";
  }

  function updateReceiveFields() {
    const method = getReceiveMethod();
    const isSell = currentQuote?.isSell;
    if (pixFields) pixFields.classList.toggle("hidden", method !== "pix");
    if (tedFields) tedFields.classList.toggle("hidden", method !== "ted");
    PIX_INPUTS.forEach((id) => {
      if (getEl(id)) getEl(id).required = !!isSell && method === "pix";
    });
    TED_INPUTS.forEach((id) => {
      if (getEl(id)) getEl(id).required = !!isSell && method === "ted";
    });
  }
  receiveRadios.forEach((r) =>
    r.addEventListener("change", updateReceiveFields),
  );

  // Texto da forma de recebimento para e-mail e WhatsApp
  function getReceiveInfo() {
    const method = getReceiveMethod();
    if (method === "pix") {
      return {
        method: "PIX",
        details: `Chave PIX (${getEl("pixKeyType").value}): ${getEl("pixKey").value}`,
      };
    }
    if (method === "ted") {
      return {
        method: "TED",
        details: `Banco ${getEl("bankName").value} · Ag. ${getEl("bankAgency").value} · Conta ${getEl("bankAccount").value} (${getEl("bankAccountType").value})`,
      };
    }
    return { method: "Espécie", details: "Em espécie na loja" };
  }

  const OPERATIONAL_INFO = {
    papel: [
      "O Valor Efetivo Total (VET) é um índice médio exibido com 4 casas por norma do Bacen e representa o custo final, incluindo câmbio, impostos (IOF) e tarifas. O cálculo real da operação é a soma do Valor Líquido + Impostos.",
      "A operação está sujeita a disponibilidade de estoque e validação de dados/documento de identificação (é obrigatório o envio de documento válido como RG, RNE ou CNH).",
      "Valores/taxas sujeitos a alteração até o fechamento efetivo da operação com um de nossos operadores.",
      "Câmbio Delivery: Grátis para operações a partir de USD 500,00 (ou equivalente em outra moeda). Para valores menores, taxa de R$ 30,00 (consulte a cobertura do seu CEP e a disponibilidade diretamente com um especialista). Sem delivery, a retirada é feita na loja mais próxima do seu CEP.",
    ],
    cartao: [
      "O Valor Efetivo Total (VET) é um índice médio exibido com 4 casas por norma do Bacen e representa o custo final, incluindo câmbio, impostos (IOF) e tarifas. O cálculo real da operação é a soma do Valor Líquido + Impostos.",
      "Pela plataforma é solicitada apenas a carga de cartão novo, respeitando o valor mínimo de cada moeda. Recarga e descarga de cartão M&A são feitas pelos menus Recarga e Descarga, direto com um especialista no WhatsApp.",
      "A operação está sujeita a validação de dados/documento de identificação (é obrigatório o envio de documento válido como RG, RNE ou CNH).",
      "Valores/taxas sujeitos a alteração até o fechamento efetivo da operação com um de nossos operadores.",
      "Câmbio Delivery: disponível para cargas a partir do dobro do valor mínimo da moeda. Grátis a partir de USD 500,00 (ou equivalente em outra moeda); abaixo disso, taxa de R$ 30,00. Para cargas menores, a retirada é feita na loja mais próxima do seu CEP.",
    ],
    venda: [
      "O valor a receber é a quantidade de moeda multiplicada pela taxa de venda, que já considera o IOF.",
      "As taxas são válidas para cédulas de série atual. Cédulas de séries antigas somente com o especialista pelo WhatsApp. Não compramos cédulas rabiscadas, manchadas ou rasgadas, nem moedas metálicas.",
      "Você leva as cédulas até a loja parceira da M&A mais próxima do seu CEP (não realizamos coleta). O pagamento é feito após a conferência das cédulas: via PIX ou TED para conta de mesma titularidade do CPF informado, ou em espécie na loja.",
      "É obrigatório o envio de documento de identificação válido (RG, RNE ou CNH).",
      "Valores/taxas sujeitos a alteração até o fechamento efetivo da operação com um de nossos operadores.",
    ],
  };

  // Ajusta o formulário conforme a operação (compra, carga de cartão ou venda)
  function applyModalLayout() {
    const q = currentQuote;
    const isSell = q.isSell;

    // Delivery
    if (deliveryBlock) deliveryBlock.classList.toggle("hidden", isSell);
    const allowed = isDeliveryAllowed(q);
    if (deliveryCheck) deliveryCheck.disabled = !allowed;
    if (deliveryToggle) {
      deliveryToggle.classList.toggle("opacity-40", !allowed);
      deliveryToggle.classList.toggle("cursor-not-allowed", !allowed);
      deliveryToggle.classList.toggle("cursor-pointer", allowed);
    }
    if (deliveryRestriction) {
      if (!allowed && !isSell && q.mode === "cartao") {
        const min = CARD_MIN[q.currencyCode];
        deliveryRestriction.innerHTML = `<i class="ph-bold ph-info"></i> O delivery está disponível para cargas a partir de <strong>${q.currencyCode} ${formatAmount(min * CARD_DELIVERY_MIN_MULTIPLIER)}</strong> (o dobro do mínimo). Para este valor, a retirada é feita na <strong>loja parceira da M&A mais próxima do seu CEP</strong>.`;
        deliveryRestriction.classList.remove("hidden");
      } else {
        deliveryRestriction.classList.add("hidden");
      }
    }

    // Venda: loja + forma de recebimento
    if (storeBlock) storeBlock.classList.toggle("hidden", !isSell);
    if (paymentBlock) paymentBlock.classList.toggle("hidden", !isSell);
    receiveRadios.forEach((r) => {
      r.checked = false;
      r.required = isSell;
    });
    updateReceiveFields();

    // Textos
    if (successNextStep)
      successNextStep.textContent = isSell
        ? "Para combinar a entrega das cédulas na loja e o seu recebimento, fale agora com um de nossos especialistas!"
        : "Para efetuar o pagamento de sua operação com segurança e combinar a entrega ou retirada, fale agora com um de nossos especialistas!";

    if (operationalInfo) {
      const items = OPERATIONAL_INFO[q.mode] || OPERATIONAL_INFO.papel;
      operationalInfo.innerHTML = `<div class="bg-gray-100 p-4 rounded-xl border border-gray-200 text-xs text-gray-600 space-y-2 text-justify">
      <p class="font-bold text-gray-700 mb-1 flex items-center gap-1"><i class="ph-bold ph-info"></i> Informações Importantes:</p>
      ${items.map((t, i) => `<p>${i + 1}. ${t}</p>`).join("")}
    </div>`;
    }
  }

  function getSubmitLabel() {
    if (currentQuote?.isSell)
      return `Confirmar Venda <i class="ph-bold ph-check-circle text-xl"></i>`;
    if (currentQuote?.mode === "cartao")
      return `Confirmar Pedido do Cartão <i class="ph-bold ph-check-circle text-xl"></i>`;
    return `Confirmar Compra <i class="ph-bold ph-check-circle text-xl"></i>`;
  }

  function openModal() {
    if (!currentQuote) return showError("Faça uma cotação antes.");

    // 1. Preenche a quantidade e a moeda lá no topo do modal
    modalCurrencyAmount.textContent = formatAmount(currentQuote.amount);
    modalCurrencyCode.textContent = currentQuote.currencyCode;

    // 2. Zera o estado do delivery para não puxar lixo da cotação anterior
    if (deliveryCheck) {
      deliveryCheck.checked = false;
      if (deliveryFields) deliveryFields.classList.add("hidden");
      const cepInput = document.getElementById("deliveryCEP");
      const addressInput = document.getElementById("deliveryAddress");
      if (cepInput) cepInput.required = false;
      if (addressInput) addressInput.required = false;
    }

    // 3. Layout conforme a operação + valores (frete, total, taxas)
    applyModalLayout();
    updateModalFinance();

    // Nova solicitação: zera o controle de e-mails e qualquer aviso de falha anterior
    emailStatus = { admin: false, client: false };
    hideSubmitError();
    const submitBtn = budgetForm?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.innerHTML = getSubmitLabel();
      submitBtn.disabled = !1;
    }

    // 4. Exibe as telas corretas do modal
    if (budgetForm) budgetForm.classList.remove("hidden");
    if (successStep) successStep.classList.add("hidden");
    if (budgetModal) budgetModal.classList.remove("hidden");
  }

  function closeModal() {
    budgetModal.classList.add("hidden");
  }

  if (buyBtn)
    buyBtn.onclick = (e) => {
      e.preventDefault();
      openModal();
    };

  if (closeModalBtn) closeModalBtn.onclick = closeModal;
  window.addEventListener("click", (e) => {
    if (e.target == budgetModal) closeModal();
  });

  function getDeliveryText() {
    const q = currentQuote;
    if (q.isSell) return "Não se aplica (cliente leva as cédulas à loja)";
    const isDeliveryChecked =
      isDeliveryAllowed(q) && deliveryCheck && deliveryCheck.checked;
    if (!isDeliveryChecked) return "Não (Retirada na Loja)";
    return q.deliveryFee === 0
      ? "Sim (Frete Grátis)"
      : `Sim (Frete ${formatBRL(q.deliveryFee)})`;
  }

  if (budgetForm) {
    budgetForm.onsubmit = async (e) => {
      e.preventDefault();
      const name = clientName.value;
      const phone = clientPhone.value;
      const email = getEl("clientEmail").value;

      if (!name || !phone || !email || !currentQuote)
        return showError("Por favor, preencha todos os campos.");

      const btn = budgetForm.querySelector('button[type="submit"]');
      const originalContent = btn.innerHTML;
      btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-xl"></i> Enviando...`;
      btn.disabled = !0;

      try {
        const q = currentQuote;
        const isDeliveryChecked =
          !q.isSell &&
          isDeliveryAllowed(q) &&
          deliveryCheck &&
          deliveryCheck.checked;

        let templateParams = {
          currency_amount: formatAmount(q.amount),
          currency_code: q.currencyCode,
          quote_date: new Date().toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          }),
          exchange_rate: formatRate(q.cotaçãoBase),
          iof_value: q.isSell
            ? `${formatBRL(q.totalIOFValue)} (${(q.iofRate * 100).toFixed(2).replace(".", ",")}%, descontado)`
            : formatBRL(q.totalIOFValue),
          vet_rate: formatRate(q.VET),
          total_brl: formatBRL(q.finalTotalBRL || q.totalBRL),
          operation_type: getOperationLabel(q),
          client_name: name,
          client_email: email,
          client_phone: phone,
          // Só dígitos, para o link wa.me/55{{client_phone_digits}} funcionar no e-mail
          client_phone_digits: phone.replace(/\D/g, ""),
          client_cpf: getEl("clientCPF").value,
          client_rg: getEl("clientRG").value,
          client_birth: getEl("clientBirth").value,
          client_birth_city: getEl("clientBirthCity").value,
          client_mother: getEl("clientMother").value,
          client_job: getEl("clientJob").value,
          client_cep: getEl("clientCEP").value,
          client_address: getEl("clientAddress").value,
          delivery_needed: getDeliveryText(),
          delivery_address: isDeliveryChecked
            ? getEl("deliveryAddress").value
            : "—",
          delivery_cep: isDeliveryChecked ? getEl("deliveryCEP").value : "—",

          file_preview: "",
          obs_documento:
            "Cliente instruído a enviar documentação via WhatsApp ou E-mail.",
        };

        // Flags para os blocos condicionais do template. Usar "" (e não false),
        // porque o EmailJS trata qualquer texto não vazio como verdadeiro.
        templateParams.is_sell = q.isSell ? "sim" : "";
        templateParams.total_label = q.isSell
          ? "Valor a Receber Total"
          : "Total a Pagar";

        // Venda: dados de recebimento
        if (q.isSell) {
          const info = getReceiveInfo();
          templateParams = {
            ...templateParams,
            receive_method: info.method,
            receive_details: info.details,
            pix_key_type:
              info.method === "PIX" ? getEl("pixKeyType").value : "—",
            pix_key: info.method === "PIX" ? getEl("pixKey").value : "—",
            bank_name: info.method === "TED" ? getEl("bankName").value : "—",
            bank_agency:
              info.method === "TED" ? getEl("bankAgency").value : "—",
            bank_account:
              info.method === "TED" ? getEl("bankAccount").value : "—",
            bank_account_type:
              info.method === "TED" ? getEl("bankAccountType").value : "—",
            store_note:
              "Cliente levará as cédulas à loja parceira da M&A mais próxima do CEP informado.",
          };
        }

        const templateAdmin = TEMPLATE_ADMIN;
        const templateCliente = TEMPLATE_CLIENTE;

        if (typeof emailjs === "undefined") {
          throw new Error("EmailJS não carregou");
        }

        // 1º e-mail: M&A (o mais importante). Se já foi numa tentativa
        // anterior, não reenvia — evita solicitação duplicada.
        if (!emailStatus.admin) {
          await sendEmailWithTimeout(templateAdmin, templateParams);
          emailStatus.admin = true;
        }

        // 2º e-mail: cópia para o cliente
        if (!emailStatus.client) {
          await sendEmailWithTimeout(templateCliente, {
            ...templateParams,
            to_email: email,
          });
          emailStatus.client = true;
        }

        // Só chega aqui se os DOIS e-mails foram aceitos pelo EmailJS
        hideSubmitError();

        if (typeof gtag === "function") {
          gtag("event", "conversion", {
            send_to: "AW-738500529/ZX95CJWVhM4bELG_kuAC",
          });
        }

        budgetForm.classList.add("hidden");
        successStep.classList.remove("hidden");
        setupFinalWhats(name);
      } catch (error) {
        // Falhou: NÃO mostra "Confirmada!". O cliente fica no formulário,
        // com os dados preenchidos, e pode tentar de novo ou ir ao WhatsApp.
        console.error("❌ Erro envio", error, emailStatus);
        showSubmitError(name);
        btn.innerHTML = `<i class="ph-bold ph-arrow-clockwise text-xl"></i> Tentar novamente`;
        btn.disabled = !1;
        return;
      } finally {
        // Restaura o botão só quando deu certo (no erro ele vira "Tentar novamente")
        if (emailStatus.admin && emailStatus.client) {
          btn.innerHTML = originalContent;
          btn.disabled = !1;
        }
      }
    };
  }

  // Envia um e-mail pelo EmailJS com limite de tempo (se travar, conta como falha)
  function sendEmailWithTimeout(templateId, params) {
    return Promise.race([
      emailjs.send(SERVICE_ID, templateId, params),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Tempo esgotado no envio do e-mail")),
          EMAIL_TIMEOUT_MS,
        ),
      ),
    ]);
  }

  // Mensagem do WhatsApp após o formulário (ou quando o envio falhou)
  function buildFinalMessage(name, sendFailed) {
    const q = currentQuote;
    const cpf = getEl("clientCPF").value;
    const clientCep = getEl("clientCEP").value;
    const total = formatBRL(q.finalTotalBRL || q.totalBRL);
    const intro = sendFailed
      ? "Tentei enviar meus dados pelo *Site Conversor*, mas o envio falhou. Gostaria de prosseguir com a seguinte operação:"
      : "Acabei de enviar meus dados pelo *Site Conversor* e gostaria de prosseguir com a seguinte operação:";
    const docLine =
      "📎 Estou enviando em anexo a foto do meu documento (CNH, RG ou RNE) para concluir meu cadastro.";

    let lines;
    if (q.isSell) {
      const info = getReceiveInfo();
      lines = [
        `• *Operação:* Papel Espécie — Venda 💵`,
        `• *Moeda:* ${formatAmount(q.amount)} ${q.currencyCode}`,
        `• *Valor líquido:* ${formatBRL(q.conversionBase)}`,
        `• *Cotação turismo:* R$ ${formatRate(q.cotaçãoBase)}`,
        `• *IOF (${(q.iofRate * 100).toFixed(2).replace(".", ",")}%):* − ${formatBRL(q.totalIOFValue)}`,
        `• *VET Final:* R$ ${formatRate(q.VET)}`,
        `• *Recebimento:* ${info.method === "Espécie" ? info.details : `${info.method} — ${info.details}`}`,
        `• *Entrega das cédulas:* na loja mais próxima do meu CEP *${clientCep}*`,
        ``,
        `👉 *VALOR A RECEBER: ${total}*`,
      ];
    } else {
      const isDeliveryChecked =
        isDeliveryAllowed(q) && deliveryCheck && deliveryCheck.checked;
      const deliveryLine = isDeliveryChecked
        ? `• *Entrega:* Delivery no CEP *${getEl("deliveryCEP").value}* (${q.deliveryFee === 0 ? "frete grátis" : `frete ${formatBRL(q.deliveryFee)}`})`
        : `• *Entrega:* Retirada na loja mais próxima do meu CEP *${clientCep}*`;
      lines = [
        `• *Operação:* ${getOperationLabel(q)} ${q.mode === "cartao" ? "💳" : "💵"}`,
        `• *Moeda:* ${formatAmount(q.amount)} ${q.currencyCode}`,
        `• *VET Final (com IOF):* R$ ${formatRate(q.VET)}`,
        deliveryLine,
        ``,
        `👉 *TOTAL A PAGAR: ${total}*`,
      ];
    }

    return `Olá, M&A Consultoria Câmbio! 😊\n\nMeu nome é *${name}* (CPF *${cpf}*).\n\n${intro}\n\n${lines.join("\n")}\n\n${docLine}`;
  }

  function showSubmitError(name) {
    hideSubmitError();
    const submitBtn = budgetForm.querySelector('button[type="submit"]');
    const box = document.createElement("div");
    box.id = "submitError";
    box.setAttribute("role", "alert");
    box.className =
      "mt-6 p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700 fade-in";
    box.innerHTML = `
      <p class="font-bold flex items-center gap-2 mb-1"><i class="ph-bold ph-warning-circle text-lg"></i> Não conseguimos enviar sua solicitação</p>
      <p class="text-xs text-red-600 leading-relaxed mb-3">Houve uma falha de conexão no envio. Seus dados continuam preenchidos: clique em <strong>"Tentar novamente"</strong> abaixo. Se o problema continuar, fale direto com um especialista pelo WhatsApp.</p>
      <button type="button" id="submitErrorWhats" class="w-full h-11 px-4 rounded-lg bg-[#25D366] hover:bg-[#128C7E] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"><i class="ph-bold ph-whatsapp-logo text-lg"></i> Falar com Especialista no WhatsApp</button>`;
    submitBtn.parentNode.insertBefore(box, submitBtn);

    getEl("submitErrorWhats").onclick = () => {
      openWhatsApp(pickOperator(), buildFinalMessage(name, true));
    };
  }

  function hideSubmitError() {
    const box = getEl("submitError");
    if (box) box.remove();
  }

  function setupFinalWhats(name) {
    if (!finalWhatsAppBtn || !currentQuote) return;

    finalWhatsAppBtn.onclick = () => {
      openWhatsApp(pickOperator(), buildFinalMessage(name, false));
      setTimeout(() => window.location.reload(), 1000);
    };
  }
});

function openInfoModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("hidden");
}

function closeInfoModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("hidden");
}

function toggleFaq(button) {
  const content = button.nextElementSibling;
  const icon = button.querySelector("i");
  if (content.classList.contains("hidden")) {
    content.classList.remove("hidden");
    content.classList.add("block");
    icon.style.transform = "rotate(180deg)";
    button.setAttribute("aria-expanded", "true");
  } else {
    content.classList.add("hidden");
    content.classList.remove("block");
    icon.style.transform = "rotate(0deg)";
    button.setAttribute("aria-expanded", "false");
  }
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeInfoModal("termsModal");
    closeInfoModal("privacyModal");
    closeInfoModal("contactModal");
  }
});
