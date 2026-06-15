const STORAGE_KEY = "mis-gastos-state-v1";
const APP_VERSION = "2.3 local";
const DEFAULT_CATEGORIES = ["Comida", "Transporte", "Otros"];

const state = {
  movements: [],
  budget: 0,
  categories: [...DEFAULT_CATEGORIES],
  activeTab: "home",
  installPromptEvent: null,
  pendingServiceWorker: null,
  editingMovementId: null,
  historyFilters: {
    month: "current",
    type: "all",
    payment: "all",
    category: "all",
  },
};

const currency = new Intl.NumberFormat("es-PE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const monthLabel = new Intl.DateTimeFormat("es-PE", {
  month: "long",
  year: "numeric",
});

const shortDate = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  currentMonthLabel: $("#currentMonthLabel"),
  homeBalance: $("#homeBalance"),
  homeIncome: $("#homeIncome"),
  homeExpense: $("#homeExpense"),
  homeBudgetPercent: $("#homeBudgetPercent"),
  homeBudgetText: $("#homeBudgetText"),
  homeBudgetBar: $("#homeBudgetBar"),
  budgetBadge: $("#budgetBadge"),
  recentMovements: $("#recentMovements"),
  historyList: $("#historyList"),
  historyCount: $("#historyCount"),
  highestExpense: $("#highestExpense"),
  dailyAverage: $("#dailyAverage"),
  topCategory: $("#topCategory"),
  categoryTotalLabel: $("#categoryTotalLabel"),
  categoryStats: $("#categoryStats"),
  budgetInput: $("#budgetInput"),
  goalDetail: $("#goalDetail"),
  goalPercent: $("#goalPercent"),
  goalBar: $("#goalBar"),
  budgetAlert: $("#budgetAlert"),
  expenseForm: $("#expenseForm"),
  incomeForm: $("#incomeForm"),
  budgetForm: $("#budgetForm"),
  clearAllButton: $("#clearAllButton"),
  exportJsonButton: $("#exportJsonButton"),
  importJsonButton: $("#importJsonButton"),
  importJsonInput: $("#importJsonInput"),
  exportCsvButton: $("#exportCsvButton"),
  resetBudgetButton: $("#resetBudgetButton"),
  deleteAllDataButton: $("#deleteAllDataButton"),
  appVersionLabel: $("#appVersionLabel"),
  categoryForm: $("#categoryForm"),
  categoryNameInput: $("#categoryNameInput"),
  categoryManagerList: $("#categoryManagerList"),
  installAppButton: $("#installAppButton"),
  pwaStatusText: $("#pwaStatusText"),
  appBanner: $("#appBanner"),
  appBannerText: $("#appBannerText"),
  appBannerButton: $("#appBannerButton"),
  historyMonthFilter: $("#historyMonthFilter"),
  historyTypeFilter: $("#historyTypeFilter"),
  historyPaymentFilter: $("#historyPaymentFilter"),
  historyCategoryFilter: $("#historyCategoryFilter"),
  editModal: $("#editModal"),
  editForm: $("#editForm"),
  editModalType: $("#editModalType"),
  editModalTitle: $("#editModalTitle"),
  editCloseButton: $("#editCloseButton"),
  editCancelButton: $("#editCancelButton"),
  editCategoryField: $("#editCategoryField"),
  editSourceField: $("#editSourceField"),
  editPaymentField: $("#editPaymentField"),
  toast: $("#toast"),
};

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isCurrentMonth(value) {
  const date = parseLocalDate(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function historyFilterMonthMatches(movement) {
  if (state.historyFilters.month === "all") return true;
  return isCurrentMonth(movement.date);
}

function historyFilterTypeMatches(movement) {
  if (state.historyFilters.type === "all") return true;
  return movement.type === state.historyFilters.type;
}

function historyFilterPaymentMatches(movement) {
  if (state.historyFilters.payment === "all") return true;
  return movement.type === "expense" && movement.payment === state.historyFilters.payment;
}

function historyFilterCategoryMatches(movement) {
  if (state.historyFilters.category === "all") return true;
  return movement.type === "expense" && movement.category === state.historyFilters.category;
}

function formatMoney(value) {
  return `S/ ${currency.format(value || 0)}`;
}

function formatMoneyInput(cents) {
  return `S/ ${(Number(cents || 0) / 100).toFixed(2)}`;
}

function setMoneyInputCents(input, cents) {
  const digits = String(cents || "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  input.dataset.cents = digits;
  input.value = digits ? formatMoneyInput(digits) : "";
}

function getMoneyInputAmount(input) {
  return (Number(input.dataset.cents || 0) || 0) / 100;
}

function resetMoneyInputs(form) {
  form.querySelectorAll("[data-money-input]").forEach((input) => {
    setMoneyInputCents(input, "");
  });
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      movements: state.movements,
      budget: state.budget,
      categories: state.categories,
    }),
  );
}

function safeFileDate() {
  return new Date().toISOString().slice(0, 10);
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildBackup() {
  return {
    app: "Mis Gastos",
    version: 1,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      movements: state.movements,
      budget: state.budget,
      categories: state.categories,
    },
  };
}

function exportBackupJson() {
  const content = JSON.stringify(buildBackup(), null, 2);
  downloadFile(`mis-gastos-backup-${safeFileDate()}.json`, content, "application/json;charset=utf-8");
  showToast("Backup JSON exportado");
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function movementsToCsv() {
  const headers = ["tipo", "monto", "fecha", "categoria", "fuente", "metodo_pago", "descripcion", "id", "creado_en"];
  const rows = sortedMovements().map((movement) => [
    movement.type === "income" ? "ingreso" : "gasto",
    Number(movement.amount || 0).toFixed(2),
    movement.date || "",
    movement.category || "",
    movement.source || "",
    movement.payment || "",
    movement.description || "",
    movement.id || "",
    movement.createdAt ? new Date(movement.createdAt).toISOString() : "",
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

function exportMovementsCsv() {
  if (!state.movements.length) {
    showToast("No hay movimientos para exportar");
    return;
  }

  downloadFile(`mis-gastos-movimientos-${safeFileDate()}.csv`, movementsToCsv(), "text/csv;charset=utf-8");
  showToast("CSV exportado");
}

function normalizeCategories(categories) {
  if (!Array.isArray(categories)) return [...DEFAULT_CATEGORIES];

  const normalized = categories
    .map((category) => String(category || "").trim())
    .filter(Boolean)
    .filter((category, index, list) => {
      const key = category.toLocaleLowerCase("es");
      return list.findIndex((item) => item.toLocaleLowerCase("es") === key) === index;
    });

  return normalized.length ? normalized : [...DEFAULT_CATEGORIES];
}

function normalizeMovementCategories(movements) {
  return movements.map((movement) => {
    if (movement.type !== "expense") return movement;
    return { ...movement, category: movement.category || "Otros" };
  });
}

function normalizeImportedMovement(movement) {
  return {
    id: String(movement.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)),
    createdAt: Number(movement.createdAt) || Date.now(),
    type: movement.type === "income" ? "income" : "expense",
    amount: Number(movement.amount) || 0,
    date: movement.date || todayValue(),
    category: movement.category || "",
    source: movement.source || "",
    payment: movement.payment || "",
    description: movement.description || "",
  };
}

function validateImportedBackup(backup) {
  if (!backup || typeof backup !== "object" || !backup.data || typeof backup.data !== "object") {
    throw new Error("El archivo no tiene el formato de backup esperado.");
  }

  if (!Array.isArray(backup.data.movements)) {
    throw new Error("El backup no contiene una lista válida de movimientos.");
  }

  const budget = Number(backup.data.budget);
  if (Number.isNaN(budget)) {
    throw new Error("El presupuesto del backup no es válido.");
  }

  return {
    movements: normalizeMovementCategories(backup.data.movements.map(normalizeImportedMovement)),
    budget,
    categories: normalizeCategories(backup.data.categories),
  };
}

function importBackupJson(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = validateImportedBackup(JSON.parse(reader.result));
      const confirmed = window.confirm("Importar este backup reemplazará todos tus datos actuales. ¿Continuar?");
      if (!confirmed) return;

      state.movements = imported.movements;
      state.budget = imported.budget;
      state.categories = imported.categories;
      saveState();
      render();
      showToast("Backup importado");
    } catch (error) {
      showToast(error.message || "No se pudo importar el backup");
    } finally {
      elements.importJsonInput.value = "";
    }
  });
  reader.addEventListener("error", () => {
    elements.importJsonInput.value = "";
    showToast("No se pudo leer el archivo");
  });
  reader.readAsText(file);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    state.movements = normalizeMovementCategories(Array.isArray(saved.movements) ? saved.movements : []);
    state.budget = Number(saved.budget) || 0;
    state.categories = normalizeCategories(saved.categories);
  } catch {
    state.movements = [];
    state.budget = 0;
    state.categories = [...DEFAULT_CATEGORIES];
  }
}

function monthlyMovements() {
  return state.movements.filter((movement) => isCurrentMonth(movement.date));
}

function getSummary() {
  const monthly = monthlyMovements();
  const income = monthly
    .filter((movement) => movement.type === "income")
    .reduce((total, movement) => total + movement.amount, 0);
  const expense = monthly
    .filter((movement) => movement.type === "expense")
    .reduce((total, movement) => total + movement.amount, 0);
  const balance = income - expense;
  const budgetPercent = state.budget > 0 ? Math.round((expense / state.budget) * 100) : 0;

  return { monthly, income, expense, balance, budgetPercent };
}

function sortedMovements(limit) {
  const sorted = [...state.movements].sort((a, b) => {
    const dateDiff = parseLocalDate(b.date) - parseLocalDate(a.date);
    return dateDiff || b.createdAt - a.createdAt;
  });
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}

function filteredHistoryMovements() {
  return sortedMovements().filter((movement) => {
    return (
      historyFilterMonthMatches(movement) &&
      historyFilterTypeMatches(movement) &&
      historyFilterPaymentMatches(movement) &&
      historyFilterCategoryMatches(movement)
    );
  });
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2200);
}

function confirmDangerousAction(message) {
  const typed = window.prompt(`${message}\n\nEscribe BORRAR para confirmar.`);
  if (typed === "BORRAR") return true;

  showToast("Acción cancelada");
  return false;
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function showAppBanner(message, { actionLabel, onAction } = {}) {
  elements.appBannerText.textContent = message;
  elements.appBanner.classList.remove("hidden");

  if (actionLabel && onAction) {
    elements.appBannerButton.textContent = actionLabel;
    elements.appBannerButton.onclick = onAction;
    elements.appBannerButton.classList.remove("hidden");
  } else {
    elements.appBannerButton.onclick = null;
    elements.appBannerButton.classList.add("hidden");
  }
}

function hideAppBanner() {
  elements.appBanner.classList.add("hidden");
  elements.appBannerButton.classList.add("hidden");
  elements.appBannerButton.onclick = null;
}

function updateOnlineStatus() {
  if (!navigator.onLine) {
    showAppBanner("Sin conexión: usando datos guardados.");
    return;
  }

  if (!state.pendingServiceWorker) hideAppBanner();
}

function updateInstallStatus() {
  if (isStandaloneMode()) {
    elements.pwaStatusText.textContent = "Ya instalada como app.";
    elements.installAppButton.disabled = true;
    elements.installAppButton.textContent = "Ya instalada";
    return;
  }

  if (location.protocol === "file:") {
    elements.pwaStatusText.textContent = "Abre con servidor local para instalar.";
    elements.installAppButton.disabled = true;
    elements.installAppButton.textContent = "Instalación no disponible";
    return;
  }

  if (state.installPromptEvent) {
    elements.pwaStatusText.textContent = "Disponible para instalar.";
    elements.installAppButton.disabled = false;
    elements.installAppButton.textContent = "Instalar app";
    return;
  }

  elements.pwaStatusText.textContent = "Instalación no disponible en este navegador por ahora.";
  elements.installAppButton.disabled = true;
  elements.installAppButton.textContent = "Instalar app";
}

async function installApp() {
  if (!state.installPromptEvent) {
    updateInstallStatus();
    return;
  }

  state.installPromptEvent.prompt();
  await state.installPromptEvent.userChoice;
  state.installPromptEvent = null;
  updateInstallStatus();
}

function showUpdateAvailable(worker) {
  state.pendingServiceWorker = worker;
  showAppBanner("Hay una actualización disponible.", {
    actionLabel: "Actualizar app",
    onAction: () => {
      if (state.pendingServiceWorker) state.pendingServiceWorker.postMessage({ type: "SKIP_WAITING" });
    },
  });
}

function movementTitle(movement) {
  if (movement.type === "income") return movement.source;
  return movement.category;
}

function movementSubtitle(movement) {
  const date = shortDate.format(parseLocalDate(movement.date));
  const description = movement.description ? ` · ${movement.description}` : "";
  const detail = movement.type === "expense" ? movement.payment : "Ingreso";
  return `${date} · ${detail}${description}`;
}

function renderMovementList(container, movements, { allowDelete = false, allowEdit = false, emptyMessage } = {}) {
  if (!movements.length) {
    container.innerHTML = `<p class="empty-state">${emptyMessage || "Aún no hay movimientos registrados."}</p>`;
    return;
  }

  container.innerHTML = movements
    .map((movement) => {
      const sign = movement.type === "income" ? "+" : "-";
      const icon = movement.type === "income" ? "↑" : "↓";
      const editButton = allowEdit
        ? `<button class="edit-button" type="button" data-edit-id="${movement.id}" aria-label="Editar ${movementTitle(movement)}">Editar</button>`
        : "";
      const deleteButton = allowDelete
        ? `<button class="delete-button" type="button" data-delete-id="${movement.id}" aria-label="Eliminar ${movementTitle(movement)}">Eliminar</button>`
        : "";

      return `
        <article class="movement-item">
          <div class="movement-icon ${movement.type}" aria-hidden="true">${icon}</div>
          <div>
            <p class="movement-title">${escapeHtml(movementTitle(movement))}</p>
            <p class="movement-meta">${escapeHtml(movementSubtitle(movement))}</p>
          </div>
          <div class="movement-amount ${movement.type}">
            <span>${sign}${formatMoney(movement.amount)}</span>
            <div class="movement-actions">
              ${editButton}
              ${deleteButton}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function categoryOptionsHtml(categories, selectedCategory = "") {
  return categories
    .map((category) => {
      const selected = category === selectedCategory ? " selected" : "";
      return `<option value="${escapeHtml(category)}"${selected}>${escapeHtml(category)}</option>`;
    })
    .join("");
}

function movementCategories() {
  return state.movements
    .filter((movement) => movement.type === "expense")
    .map((movement) => movement.category)
    .filter(Boolean);
}

function allKnownCategories() {
  return [...new Set([...state.categories, ...movementCategories()])].sort((a, b) => a.localeCompare(b, "es"));
}

function renderCategorySelects() {
  const currentExpense = elements.expenseForm.elements.category.value || state.categories[0] || "Otros";
  const expenseSelected = state.categories.includes(currentExpense) ? currentExpense : state.categories[0];
  elements.expenseForm.elements.category.innerHTML = categoryOptionsHtml(state.categories, expenseSelected);

  const editCategory = elements.editForm.elements.category.value;
  const editCategories = editCategory && !state.categories.includes(editCategory) ? [...state.categories, editCategory] : state.categories;
  elements.editForm.elements.category.innerHTML = categoryOptionsHtml(editCategories, editCategory);
}

function renderCategoryManager() {
  elements.categoryManagerList.innerHTML = state.categories
    .map((category) => {
      const usageCount = state.movements.filter((movement) => movement.type === "expense" && movement.category === category).length;
      const deleteDisabled = state.categories.length <= 1 ? " disabled" : "";
      const deleteTitle = state.categories.length <= 1 ? "No puedes eliminar la última categoría" : `Eliminar ${category}`;
      return `
        <article class="category-manager-item">
          <div>
            <strong>${escapeHtml(category)}</strong>
            <p class="muted">${usageCount} ${usageCount === 1 ? "movimiento" : "movimientos"}</p>
          </div>
          <div class="category-manager-actions">
            <button
              class="delete-button"
              type="button"
              data-delete-category="${escapeHtml(category)}"
              aria-label="${escapeHtml(deleteTitle)}"
              ${deleteDisabled}
            >
              Eliminar
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderHome() {
  const summary = getSummary();
  const percent = Math.min(summary.budgetPercent, 100);
  const overWarning = summary.budgetPercent >= 80 && state.budget > 0;

  elements.currentMonthLabel.textContent = monthLabel.format(new Date());
  elements.homeIncome.textContent = formatMoney(summary.income);
  elements.homeExpense.textContent = formatMoney(summary.expense);
  elements.homeBalance.textContent = formatMoney(summary.balance);
  elements.homeBudgetPercent.textContent = `${summary.budgetPercent}%`;
  elements.homeBudgetBar.style.width = `${percent}%`;
  elements.homeBudgetBar.classList.toggle("warning", overWarning);
  elements.budgetBadge.textContent = state.budget > 0 ? `${summary.budgetPercent}% usado` : "Sin meta";
  elements.homeBudgetText.textContent =
    state.budget > 0
      ? `${formatMoney(summary.expense)} de ${formatMoney(state.budget)} usados este mes.`
      : "Define tu presupuesto mensual en Metas.";

  renderMovementList(elements.recentMovements, sortedMovements(3));
}

function renderHistoryFilters() {
  const categories = allKnownCategories();
  const selectedCategory = categories.includes(state.historyFilters.category) ? state.historyFilters.category : "all";

  state.historyFilters.category = selectedCategory;
  elements.historyMonthFilter.value = state.historyFilters.month;
  elements.historyTypeFilter.value = state.historyFilters.type;
  elements.historyPaymentFilter.value = state.historyFilters.payment;
  elements.historyCategoryFilter.innerHTML = [
    '<option value="all">Todas</option>',
    ...categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`),
  ].join("");
  elements.historyCategoryFilter.value = selectedCategory;
}

function renderHistory() {
  renderHistoryFilters();
  const movements = filteredHistoryMovements();
  elements.historyCount.textContent = `${movements.length} ${movements.length === 1 ? "coincidencia" : "coincidencias"}`;
  renderMovementList(elements.historyList, movements, {
    allowDelete: true,
    allowEdit: true,
    emptyMessage: state.movements.length
      ? "No hay movimientos que coincidan con estos filtros."
      : "Aún no hay movimientos registrados.",
  });
}

function renderStats() {
  const expenses = monthlyMovements().filter((movement) => movement.type === "expense");
  const totalExpense = expenses.reduce((total, movement) => total + movement.amount, 0);
  const highest = expenses.reduce((max, movement) => Math.max(max, movement.amount), 0);
  const dailyAverage = totalExpense / new Date().getDate();
  const categoryTotals = expenses.reduce((totals, movement) => {
    totals[movement.category] = (totals[movement.category] || 0) + movement.amount;
    return totals;
  }, {});
  const rankedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  elements.highestExpense.textContent = formatMoney(highest);
  elements.dailyAverage.textContent = formatMoney(dailyAverage);
  elements.topCategory.textContent = rankedCategories[0] ? rankedCategories[0][0] : "Sin gastos";
  elements.categoryTotalLabel.textContent = formatMoney(totalExpense);

  if (!rankedCategories.length) {
    elements.categoryStats.innerHTML = '<p class="empty-state">Registra gastos para ver tus categorías.</p>';
    return;
  }

  elements.categoryStats.innerHTML = rankedCategories
    .map(([category, amount]) => {
      const width = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
      return `
        <div class="category-item">
          <div class="category-heading">
            <span>${escapeHtml(category)}</span>
            <span>${formatMoney(amount)}</span>
          </div>
          <div class="category-bar" aria-label="${escapeHtml(category)} ${width}%">
            <span style="width: ${width}%"></span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderGoals() {
  const { expense, budgetPercent } = getSummary();
  const percent = Math.min(budgetPercent, 100);
  const hasBudget = state.budget > 0;
  const showWarning = hasBudget && budgetPercent >= 80;

  elements.budgetInput.value = hasBudget ? state.budget : "";
  elements.goalPercent.textContent = `${budgetPercent}%`;
  elements.goalBar.style.width = `${percent}%`;
  elements.goalBar.classList.toggle("warning", showWarning);
  elements.budgetAlert.classList.toggle("hidden", !showWarning);
  elements.goalDetail.textContent = hasBudget
    ? `${formatMoney(expense)} gastados de ${formatMoney(state.budget)}.`
    : "Sin presupuesto mensual.";
}

function render() {
  renderCategorySelects();
  renderCategoryManager();
  renderHome();
  renderHistory();
  renderStats();
  renderGoals();
}

function setTab(tabName) {
  state.activeTab = tabName;
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${tabName}`));
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.tab === tabName));
  const activeView = $(`#view-${tabName}`);
  document.title = `${activeView.dataset.title} · Mis Gastos`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function createMovement(payload) {
  state.movements.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    createdAt: Date.now(),
    ...payload,
  });
  saveState();
  render();
}

function updateMovement(id, payload) {
  state.movements = state.movements.map((movement) => {
    if (movement.id !== id) return movement;
    return {
      ...movement,
      ...payload,
      id: movement.id,
      createdAt: movement.createdAt,
    };
  });
  saveState();
  render();
}

function addCategory(name) {
  const category = String(name || "").trim().replace(/\s+/g, " ");

  if (!category) {
    showToast("Escribe una categoría");
    elements.categoryNameInput.focus();
    return;
  }

  const exists = state.categories.some((item) => item.toLocaleLowerCase("es") === category.toLocaleLowerCase("es"));
  if (exists) {
    showToast("Esa categoría ya existe");
    elements.categoryNameInput.focus();
    return;
  }

  state.categories = [...state.categories, category];
  saveState();
  render();
  elements.categoryForm.reset();
  showToast("Categoría agregada");
}

function deleteCategory(category) {
  if (state.categories.length <= 1) {
    showToast("Debes tener al menos una categoría");
    return;
  }

  if (!state.categories.includes(category)) return;

  const usageCount = state.movements.filter((movement) => movement.type === "expense" && movement.category === category).length;
  const message = usageCount > 0
    ? `Eliminar "${category}" la quitará de nuevos gastos, pero conservará ${usageCount} movimiento(s) antiguos. ¿Continuar?`
    : `¿Eliminar la categoría "${category}"?`;
  const confirmed = window.confirm(message);
  if (!confirmed) return;

  state.categories = state.categories.filter((item) => item !== category);
  if (state.historyFilters.category === category) state.historyFilters.category = "all";
  saveState();
  render();
  showToast("Categoría eliminada");
}

function handleExpenseSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const amount = getMoneyInputAmount(event.currentTarget.elements.amount);

  if (amount <= 0) {
    showToast("Ingresa un monto mayor a S/ 0.00");
    event.currentTarget.elements.amount.focus();
    return;
  }

  createMovement({
    type: "expense",
    amount,
    category: formData.get("category"),
    date: formData.get("date"),
    payment: formData.get("payment"),
    description: formData.get("description").trim(),
  });
  event.currentTarget.reset();
  resetMoneyInputs(event.currentTarget);
  event.currentTarget.elements.date.value = todayValue();
  showToast("Gasto guardado");
  setTab("home");
}

function handleIncomeSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const amount = getMoneyInputAmount(event.currentTarget.elements.amount);

  if (amount <= 0) {
    showToast("Ingresa un monto mayor a S/ 0.00");
    event.currentTarget.elements.amount.focus();
    return;
  }

  createMovement({
    type: "income",
    amount,
    source: formData.get("source").trim(),
    date: formData.get("date"),
    description: formData.get("description").trim(),
  });
  event.currentTarget.reset();
  resetMoneyInputs(event.currentTarget);
  event.currentTarget.elements.date.value = todayValue();
  showToast("Ingreso guardado");
  setTab("home");
}

function handleBudgetSubmit(event) {
  event.preventDefault();
  state.budget = Number(elements.budgetInput.value) || 0;
  saveState();
  render();
  showToast("Presupuesto actualizado");
}

function resetBudget() {
  if (state.budget <= 0) {
    showToast("El presupuesto ya está en cero");
    return;
  }

  const confirmed = window.confirm("¿Resetear el presupuesto mensual? Tus movimientos se conservarán.");
  if (!confirmed) return;

  state.budget = 0;
  saveState();
  render();
  showToast("Presupuesto reseteado");
}

function deleteAllData() {
  const confirmed = confirmDangerousAction("Esto eliminará movimientos, presupuesto y categorías personalizadas.");
  if (!confirmed) return;

  state.movements = [];
  state.budget = 0;
  state.categories = [...DEFAULT_CATEGORIES];
  state.historyFilters = {
    month: "current",
    type: "all",
    payment: "all",
    category: "all",
  };
  saveState();
  render();
  showToast("Todos los datos fueron borrados");
}

function deleteMovement(id) {
  state.movements = state.movements.filter((movement) => movement.id !== id);
  saveState();
  render();
  showToast("Movimiento eliminado");
}

function openEditModal(id) {
  const movement = state.movements.find((item) => item.id === id);
  if (!movement) return;

  state.editingMovementId = id;
  elements.editForm.reset();
  resetMoneyInputs(elements.editForm);
  elements.editModalType.textContent = movement.type === "expense" ? "Gasto" : "Ingreso";
  elements.editModalTitle.textContent = movement.type === "expense" ? "Editar gasto" : "Editar ingreso";
  elements.editCategoryField.classList.toggle("hidden", movement.type !== "expense");
  elements.editPaymentField.classList.toggle("hidden", movement.type !== "expense");
  elements.editSourceField.classList.toggle("hidden", movement.type !== "income");
  elements.editForm.elements.category.required = movement.type === "expense";
  elements.editForm.elements.payment.required = movement.type === "expense";
  elements.editForm.elements.source.required = movement.type === "income";
  setMoneyInputCents(elements.editForm.elements.amount, Math.round((movement.amount || 0) * 100));
  elements.editForm.elements.date.value = movement.date;
  elements.editForm.elements.description.value = movement.description || "";

  if (movement.type === "expense") {
    const editCategories = movement.category && !state.categories.includes(movement.category)
      ? [...state.categories, movement.category]
      : state.categories;
    elements.editForm.elements.category.innerHTML = categoryOptionsHtml(editCategories, movement.category);
    elements.editForm.elements.category.value = movement.category || "Otros";
    elements.editForm.elements.payment.value = movement.payment || "Otro";
  } else {
    elements.editForm.elements.source.value = movement.source || "";
  }

  elements.editModal.classList.remove("hidden");
  elements.editForm.elements.amount.focus();
}

function closeEditModal() {
  state.editingMovementId = null;
  elements.editModal.classList.add("hidden");
  elements.editForm.reset();
  resetMoneyInputs(elements.editForm);
}

function handleEditSubmit(event) {
  event.preventDefault();
  const movement = state.movements.find((item) => item.id === state.editingMovementId);
  if (!movement) {
    closeEditModal();
    return;
  }

  const formData = new FormData(event.currentTarget);
  const amount = getMoneyInputAmount(event.currentTarget.elements.amount);

  if (amount <= 0) {
    showToast("Ingresa un monto mayor a S/ 0.00");
    event.currentTarget.elements.amount.focus();
    return;
  }

  if (movement.type === "expense") {
    updateMovement(movement.id, {
      type: "expense",
      amount,
      category: formData.get("category"),
      date: formData.get("date"),
      payment: formData.get("payment"),
      description: formData.get("description").trim(),
      source: "",
    });
  } else {
    updateMovement(movement.id, {
      type: "income",
      amount,
      source: formData.get("source").trim(),
      date: formData.get("date"),
      description: formData.get("description").trim(),
      category: "",
      payment: "",
    });
  }

  closeEditModal();
  showToast("Movimiento actualizado");
}

function clearAllMovements() {
  if (!state.movements.length) {
    showToast("No hay movimientos para limpiar");
    return;
  }
  const confirmed = confirmDangerousAction("Esto eliminará todos los movimientos. El presupuesto mensual se conservará.");
  if (!confirmed) return;
  state.movements = [];
  saveState();
  render();
  showToast("Historial limpio");
}

function handleHistoryFilterChange(event) {
  const filterName = event.currentTarget.dataset.filter;
  state.historyFilters[filterName] = event.currentTarget.value;
  renderHistory();
}

function setupEvents() {
  $$("[data-money-input]").forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        setMoneyInputCents(input, `${input.dataset.cents || ""}${event.key}`);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        setMoneyInputCents(input, (input.dataset.cents || "").slice(0, -1));
        return;
      }

      if (event.key === "Delete" || event.key === "Escape") {
        event.preventDefault();
        setMoneyInputCents(input, "");
        return;
      }

      if (["Tab", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
    });

    input.addEventListener("paste", (event) => {
      event.preventDefault();
      const pastedDigits = event.clipboardData.getData("text").replace(/\D/g, "");
      if (pastedDigits) setMoneyInputCents(input, `${input.dataset.cents || ""}${pastedDigits}`);
    });

    input.addEventListener("focus", () => {
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });

  $$(".nav-item").forEach((item) => {
    item.addEventListener("click", () => setTab(item.dataset.tab));
  });

  $$("[data-target-tab]").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.targetTab));
  });

  $$(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      const form = button.dataset.form;
      $$(".segment").forEach((item) => item.classList.toggle("active", item === button));
      elements.expenseForm.classList.toggle("active", form === "expense");
      elements.incomeForm.classList.toggle("active", form === "income");
    });
  });

  elements.expenseForm.addEventListener("submit", handleExpenseSubmit);
  elements.incomeForm.addEventListener("submit", handleIncomeSubmit);
  elements.budgetForm.addEventListener("submit", handleBudgetSubmit);
  elements.categoryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addCategory(elements.categoryNameInput.value);
  });
  elements.categoryManagerList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-category]");
    if (deleteButton) deleteCategory(deleteButton.dataset.deleteCategory);
  });
  elements.exportJsonButton.addEventListener("click", exportBackupJson);
  elements.exportCsvButton.addEventListener("click", exportMovementsCsv);
  elements.importJsonButton.addEventListener("click", () => elements.importJsonInput.click());
  elements.importJsonInput.addEventListener("change", () => {
    importBackupJson(elements.importJsonInput.files[0]);
  });
  elements.resetBudgetButton.addEventListener("click", resetBudget);
  elements.deleteAllDataButton.addEventListener("click", deleteAllData);
  elements.installAppButton.addEventListener("click", installApp);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPromptEvent = event;
    updateInstallStatus();
  });
  window.addEventListener("appinstalled", () => {
    state.installPromptEvent = null;
    updateInstallStatus();
    showToast("App instalada");
  });
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  elements.editForm.addEventListener("submit", handleEditSubmit);
  elements.editCloseButton.addEventListener("click", closeEditModal);
  elements.editCancelButton.addEventListener("click", closeEditModal);
  elements.editModal.addEventListener("click", (event) => {
    if (event.target === elements.editModal) closeEditModal();
  });
  elements.historyMonthFilter.dataset.filter = "month";
  elements.historyTypeFilter.dataset.filter = "type";
  elements.historyPaymentFilter.dataset.filter = "payment";
  elements.historyCategoryFilter.dataset.filter = "category";
  [
    elements.historyMonthFilter,
    elements.historyTypeFilter,
    elements.historyPaymentFilter,
    elements.historyCategoryFilter,
  ].forEach((filter) => {
    filter.addEventListener("change", handleHistoryFilterChange);
  });
  elements.clearAllButton.addEventListener("click", clearAllMovements);
  elements.historyList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-id]");
    const deleteButton = event.target.closest("[data-delete-id]");
    if (editButton) openEditModal(editButton.dataset.editId);
    if (deleteButton) deleteMovement(deleteButton.dataset.deleteId);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.editModal.classList.contains("hidden")) {
      closeEditModal();
    }
  });
}

function setInitialDates() {
  $$('input[type="date"]').forEach((input) => {
    input.value = todayValue();
  });
}

function registerServiceWorker() {
  if (location.protocol === "file:") {
    updateInstallStatus();
    return;
  }

  if (!("serviceWorker" in navigator)) {
    updateInstallStatus();
    return;
  }

  navigator.serviceWorker
    .register("./sw.js")
    .then((registration) => {
      updateInstallStatus();

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateAvailable(newWorker);
          }
        });
      });
    })
    .catch(() => {
      elements.pwaStatusText.textContent = "No se pudo activar el modo PWA en este navegador.";
      elements.installAppButton.disabled = true;
    });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}

loadState();
setInitialDates();
setupEvents();
elements.appVersionLabel.textContent = `Mis Gastos v${APP_VERSION}`;
updateInstallStatus();
updateOnlineStatus();
render();
registerServiceWorker();
