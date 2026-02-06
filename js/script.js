
// --- Constants & Types ---
const STORAGE_KEYS = {
    TRANSACTIONS: 'transactions',
    CATEGORIES: 'categories',
    INSTALLMENTS: 'installments',
    LIMITS: 'monthly_limits',
    THEME: 'theme',
    GOALS: 'goals',
    THEME: 'theme',
    GOALS: 'goals',
    SHOPPING_LIST: 'shopping_list',
    TODOS: 'todos',
    INVESTMENTS: 'investments'
};

let expenseChartInstance = null;
let barChartInstance = null;

const DEFAULT_CATEGORIES = [
    { id: 'c1', name: 'Ăn uống', color: '#ef4444', isDefault: true },
    { id: 'c2', name: 'Di chuyển', color: '#f97316', isDefault: true },
    { id: 'c3', name: 'Nhà cửa', color: '#eab308', isDefault: true },
    { id: 'c4', name: 'Mua sắm', color: '#3b82f6', isDefault: true },
    { id: 'c5', name: 'Giải trí', color: '#8b5cf6', isDefault: true },
    { id: 'c6', name: 'Sức khỏe', color: '#ec4899', isDefault: true },
    { id: 'c7', name: 'Khác', color: '#64748b', isDefault: true },
];

// --- State ---
const State = {
    transactions: [],
    categories: [],
    installments: [],
    goals: [],
    shoppingList: [],
    todos: [],
    investments: [],
    monthlyLimits: {},
    currentDate: new Date(),
    viewMode: 'daily', // daily, weekly, monthly
    filter: {
        term: '',
        categoryId: '',
        startDate: '',
        endDate: ''
    }
};

// Check for safe dates
function isValidDate(d) {
    return d instanceof Date && !isNaN(d);
}

// --- Storage Service ---
const Storage = {
    get(key, defaultVal) {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultVal;
    },
    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }
};

// --- Utils ---
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

const generateId = () => Date.now().toString();

// --- Core Initialization ---
// --- Core Initialization ---
async function init() {
    // 1. Setup Listeners & UI State IMMEDIATELY (Don't wait for data)
    setupAuthListeners();

    // Check session
    if (AuthService.checkSession()) {
        console.log("Session restored");
    }

    updateAuthUI(); // Update UI based on restored session

    // 2. Load Data (Async - might take time)
    try {
        await loadData();
    } catch (e) {
        console.error("Init loadData failed", e);
    }

    // 3. Render App
    setupEventListeners(); // Main app listeners
    renderApp();
    renderInvestments();
    setupTheme();

    // Initialize Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
}

async function loadData() {
    // 1. Default load from LocalStorage (fast, works offline/guest)
    State.transactions = Storage.get(STORAGE_KEYS.TRANSACTIONS, []);
    State.categories = Storage.get(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    State.installments = Storage.get(STORAGE_KEYS.INSTALLMENTS, []);
    State.goals = Storage.get(STORAGE_KEYS.GOALS, []);
    State.todos = Storage.get(STORAGE_KEYS.TODOS, []);
    State.investments = Storage.get(STORAGE_KEYS.INVESTMENTS, []);
    State.monthlyLimits = Storage.get(STORAGE_KEYS.LIMITS, {});

    // 2. If Logged In, try to fetch Cloud Data and overwrite
    if (AuthService.isLoggedIn) {
        const cloud = await AuthService.loadData();
        if (cloud.success && cloud.data) {
            const d = cloud.data;
            // Overwrite if data exists in cloud
            if (d.transactions) State.transactions = d.transactions;
            if (d.categories) State.categories = d.categories;
            if (d.installments) State.installments = d.installments;
            if (d.goals) State.goals = d.goals;
            if (d.todos) State.todos = d.todos;
            if (d.investments) State.investments = d.investments;
            if (d.limits) State.monthlyLimits = d.limits;
            console.log("Loaded data from Cloud");
        } else {
            console.log("Could not load cloud data or empty");
        }
    }

    // Theme (Local preference usually best, but can sync if needed)
    const theme = Storage.get(STORAGE_KEYS.THEME, 'light');
    if (theme === 'dark') document.body.classList.add('dark');
}

function saveData(key) {
    // 1. Always save to LocalStorage (as cache or guest mode)
    if (key === 'transactions') Storage.set(STORAGE_KEYS.TRANSACTIONS, State.transactions);
    if (key === 'categories') Storage.set(STORAGE_KEYS.CATEGORIES, State.categories);
    if (key === 'installments') Storage.set(STORAGE_KEYS.INSTALLMENTS, State.installments);
    if (key === 'goals') Storage.set(STORAGE_KEYS.GOALS, State.goals);
    if (key === 'todos') Storage.set(STORAGE_KEYS.TODOS, State.todos);
    if (key === 'investments') Storage.set(STORAGE_KEYS.INVESTMENTS, State.investments);
    if (key === 'limits') Storage.set(STORAGE_KEYS.LIMITS, State.monthlyLimits);

    // 2. If Logged In -> Push to Cloud
    if (AuthService.isLoggedIn) {
        // Debounce could be good here, but for now direct save
        const fullData = {
            transactions: State.transactions,
            categories: State.categories,
            installments: State.installments,
            goals: State.goals,
            todos: State.todos,
            investments: State.investments,
            limits: State.monthlyLimits
        };
        // Async save (don't await to not block UI)
        AuthService.saveData(fullData).then(res => {
            if (res.success) console.log("Saved to Cloud");
            else console.error("Cloud Save Failed", res);
        });
    }
}

// --- DOM References ---
const els = {
    // Nav
    tabs: document.querySelectorAll('[data-tab]'),
    tabPanes: document.querySelectorAll('.tab-pane'),

    // Dates
    btnPrevMonth: document.getElementById('btn-prev-month'),
    btnNextMonth: document.getElementById('btn-next-month'),
    currentMonthDisplay: document.getElementById('current-month-display'),

    // Dashboard
    statsGrid: document.getElementById('stats-grid'),
    recentTransactions: document.getElementById('recent-transactions'),
    dailyLimitDisplay: document.getElementById('daily-limit-display'),

    // View Mode
    viewModeBtns: document.querySelectorAll('[data-mode]'),

    // Modals
    modalTransaction: document.getElementById('modal-transaction'),
    modalLimit: document.getElementById('modal-limit'),
    modalCategories: document.getElementById('modal-categories'),
    modalInstallment: document.getElementById('modal-installment'),

    // Forms
    formTransaction: document.getElementById('form-transaction'),
    formLimit: document.getElementById('form-limit'),
    formInstallment: document.getElementById('form-installment'),
    formGoal: document.getElementById('form-goal'),
    formAddCategory: document.getElementById('form-add-category'),

    // History
    historyList: document.getElementById('history-list'),
    searchInput: document.getElementById('search-input'),
    filterCategory: document.getElementById('filter-category'), // Select

    // FAB
    fab: document.getElementById('btn-fab-add'),
};

// --- Event Listeners ---
function setupEventListeners() {
    // Tabs
    els.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            switchTab(target);
        });
    });

    // Mobile Actions
    document.getElementById('btn-categories-mobile').addEventListener('click', () => openModal('categories'));
    document.getElementById('btn-limits-mobile').addEventListener('click', () => openModal('limit'));
    document.getElementById('btn-categories').addEventListener('click', () => openModal('categories')); // Desktop
    document.getElementById('btn-limits').addEventListener('click', () => openModal('limit')); // Desktop

    // Theme Toggle
    const toggleTheme = () => {
        document.body.classList.toggle('dark');
        const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
        Storage.set(STORAGE_KEYS.THEME, theme);
    };
    document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('btn-theme-mobile').addEventListener('click', toggleTheme);

    // Date Nav
    els.btnPrevMonth.addEventListener('click', () => changeMonth(-1));
    els.btnNextMonth.addEventListener('click', () => changeMonth(1));

    // View Mode
    els.viewModeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            State.viewMode = btn.dataset.mode;
            renderDashboard();
            updateActiveClasses(els.viewModeBtns, btn);
        });
    });

    // Default Modals Close
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').classList.add('hidden');
        });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.add('hidden');
        });
    });

    // Transaction Form
    els.fab.addEventListener('click', () => openTransactionModal());
    els.formTransaction.addEventListener('submit', handleTransactionSubmit);

    // Limit Form
    els.formLimit.addEventListener('submit', handleLimitSubmit);

    // Category settings
    els.formAddCategory.addEventListener('submit', handleAddCategory);

    // Installment Button
    document.getElementById('btn-add-installment').addEventListener('click', () => openModal('installment'));
    els.formInstallment.addEventListener('submit', handleInstallmentSubmit);

    // History Filter
    els.searchInput.addEventListener('input', (e) => {
        State.filter.term = e.target.value;
        renderHistory();
    });

    els.filterCategory.addEventListener('change', (e) => {
        State.filter.categoryId = e.target.value;
        renderHistory();
    });

    const dateStart = document.getElementById('filter-start-date');
    const dateEnd = document.getElementById('filter-end-date');

    dateStart.addEventListener('change', (e) => {
        State.filter.startDate = e.target.value; // YYYY-MM-DD
        renderHistory();
    });

    dateEnd.addEventListener('change', (e) => {
        State.filter.endDate = e.target.value;
        renderHistory();
    });

    document.getElementById('btn-clear-filter').addEventListener('click', () => {
        State.filter = { term: '', categoryId: '', startDate: '', endDate: '' };
        els.searchInput.value = '';
        els.filterCategory.value = '';
        dateStart.value = '';
        dateEnd.value = '';
        renderHistory();
    });

    const btnToggleFilter = document.getElementById('btn-toggle-filter');
    const filterPanel = document.getElementById('filter-panel');
    btnToggleFilter.addEventListener('click', () => filterPanel.classList.toggle('hidden'));

    // Global Escape to close modals & Ctrl+R
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(el => {
                el.classList.add('hidden');
            });
        }
        // Ctrl+R to open Add Expense
        if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
            e.preventDefault(); // Prevent page reload
            openTransactionModal();
            setTimeout(() => {
                const amountInput = document.getElementById('trans-amount');
                if (amountInput) amountInput.focus();
            }, 100);
        }
    });

    // Bulk Delete
    document.getElementById('btn-open-bulk-delete').addEventListener('click', () => openModal('bulk-delete'));
    document.getElementById('form-bulk-delete').addEventListener('submit', handleBulkDeleteSubmit);

    // Dynamic Input for Bulk Delete
    const bulkType = document.getElementById('bulk-delete-type');
    const bulkInput = document.getElementById('bulk-delete-date');
    const bulkLabel = document.getElementById('bulk-delete-label');
    const bulkHint = document.getElementById('bulk-delete-hint');

    // Set default date to today
    bulkInput.valueAsDate = new Date();

    setupAccumulationListeners();
    setupInvestmentListeners();
    setupAuthListeners();

    const updateBulkHint = () => {
        const val = bulkInput.value;
        if (!val) { bulkHint.textContent = ''; return; }

        const type = bulkType.value;
        let count = 0;

        if (type === 'day') {
            // val is YYYY-MM-DD
            count = State.transactions.filter(t => t.date === val).length;
            bulkHint.textContent = `Sẽ xóa ${count} giao dịch trong ngày ${formatDate(val)}`;
        } else if (type === 'week') {
            // Calculate week range
            const d = new Date(val);
            // Find Monday
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
            const monday = new Date(d);
            monday.setHours(0, 0, 0, 0);
            monday.setDate(diff);

            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            sunday.setHours(23, 59, 59, 999);

            const startStr = monday.toISOString().split('T')[0];
            const endStr = sunday.toISOString().split('T')[0];

            count = State.transactions.filter(t => t.date >= startStr && t.date <= endStr).length;
            bulkHint.textContent = `Sẽ xóa ${count} giao dịch tuần ${formatDate(startStr)} - ${formatDate(endStr)}`;

        } else if (type === 'month') {
            // In month mode, value could be YYYY-MM if input type changed
            // But we are swapping input types?
            if (bulkInput.type === 'month') {
                // value is YYYY-MM
                count = State.transactions.filter(t => t.date.startsWith(val)).length;
                const [y, m] = val.split('-');
                bulkHint.textContent = `Sẽ xóa ${count} giao dịch trong tháng ${m}/${y}`;
            } else {
                // fallback if type switch failed or using date picker as month anchor
                const d = new Date(val);
                const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                count = State.transactions.filter(t => t.date.startsWith(mStr)).length;
                bulkHint.textContent = `Sẽ xóa ${count} giao dịch trong tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
            }
        }
    };

    bulkType.addEventListener('change', () => {
        const type = bulkType.value;
        if (type === 'month') {
            bulkInput.type = 'month';
            bulkLabel.textContent = 'Chọn tháng';
            // Set default month
            const now = new Date();
            bulkInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        } else {
            bulkInput.type = 'date';
            if (type === 'week') bulkLabel.textContent = 'Chọn một ngày trong tuần';
            else bulkLabel.textContent = 'Chọn ngày';
            bulkInput.valueAsDate = new Date();
        }
        updateBulkHint();
    });

    bulkInput.addEventListener('change', updateBulkHint);
    // Initial update

}

// --- Logic functions ---

function switchTab(tabName) {
    // Update Sidebar UI
    document.querySelectorAll('.nav-item').forEach(el => {
        if (el.dataset.tab === tabName) el.classList.add('active');
        else if (el.dataset.tab) el.classList.remove('active');
    });

    // Show Content
    els.tabPanes.forEach(pane => pane.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    if (tabName === 'history') renderHistory();
    if (tabName === 'installments') renderInstallments();
    if (tabName === 'accumulation') renderAccumulation();
    if (tabName === 'todo') renderTodos();
    if (tabName === 'investment') renderInvestments();
}

// ... (Existing code) Use multireplace for better insertion if needed, but here we append the Logic functions.

// --- Accumulation Logic ---

function renderAccumulation() {
    renderGoals();
    lucide.createIcons();
}

function renderGoals() {
    const grid = document.getElementById('goals-grid');
    if (State.goals.length === 0) {
        grid.innerHTML = '<p class="empty-state">Chưa có mục tiêu nào. Hãy thêm mới!</p>';
        return;
    }

    grid.innerHTML = State.goals.map(g => {
        const percent = Math.min(100, Math.round((g.current / g.target) * 100));
        return `
            <div class="card goal-card" onclick="openGoalModal('${g.id}')">
                <div class="goal-header">
                    <div style="display:flex; align-items:center; gap:0.5rem">
                         <div style="width:12px; height:12px; border-radius:50%; background:${g.color || '#10b981'}"></div>
                         <h3>${g.name}</h3>
                    </div>
                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        <span class="goal-percent">${percent}%</span>
                        <button onclick="event.stopPropagation(); openGoalHistory('${g.id}')" 
                                style="padding:4px; border-radius:4px; border:1px solid var(--border); background:var(--surface); cursor:pointer; position:relative; z-index:10; color:var(--text-primary);">
                             <i data-lucide="history" style="width:16px; height:16px;"></i>
                        </button>
                    </div>
                </div>
                <div class="goal-amounts">
                    <span>${formatCurrency(g.current)}</span>
                    <span class="text-muted"> / ${formatCurrency(g.target)}</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${percent}%; background-color: ${g.color || '#10b981'}"></div>
                </div>
            </div>
        `;
    }).join('');
}

function renderShoppingList() {
    const list = document.getElementById('shopping-list');
    if (State.shoppingList.length === 0) {
        list.innerHTML = '<p class="empty-state">Danh sách trống.</p>';
        return;
    }

    list.innerHTML = State.shoppingList.map(item => `
        <div class="shopping-item" onclick="openShoppingModal('${item.id}')">
            <div class="shopping-info">
                <div class="shopping-name">${item.name}</div>
                ${item.link ? `<a href="${item.link}" target="_blank" onclick="event.stopPropagation()" class="shopping-link"><i data-lucide="link"></i> Link</a>` : ''}
            </div>
            <div class="shopping-price">
                ${item.price ? formatCurrency(item.price) : '---'}
            </div>
        </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

// --- Category Logic (Updated with Color Edit) ---

function renderCategorySettings() {
    const list = document.getElementById('settings-category-list');
    list.innerHTML = State.categories.map(c => `
        <div class="category-setting-item">
             <div class="cat-left">
                <input type="color" class="color-picker-mini" value="${c.color}" onchange="updateCategoryColor('${c.id}', this.value)">
                <input type="text" class="cat-name-edit" value="${c.name}" onchange="updateCategoryName('${c.id}', this.value)">
             </div>
             <button onclick="deleteCategory('${c.id}')" class="btn-icon-danger"><i data-lucide="trash-2"></i></button>
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
}

window.updateCategoryName = (id, newName) => {
    const cat = State.categories.find(c => c.id === id);
    if (cat && newName.trim()) {
        cat.name = newName.trim();
        saveData('categories');
        renderCategoryOptions();
        renderHistory();
        renderDashboard();
    }
};

window.updateCategoryColor = (id, newColor) => {
    const cat = State.categories.find(c => c.id === id);
    if (cat) {
        cat.color = newColor;
        saveData('categories');
        renderCategoryOptions(); // Update select options if needed (though they usually use name)
        renderHistory(); // Update history view colors
        renderDashboard(); // Update dashboard recent list colors
    }
};

window.updateCategoryLimit = (id, newLimit) => {
    const cat = State.categories.find(c => c.id === id);
    if (cat) {
        cat.budgetLimit = parseFloat(newLimit) || 0;
        saveData('categories');
        renderDashboard();
    }
};

// --- Modal Handlers for Accumulation ---

// --- Modal Handlers for Accumulation ---

function openGoalModal(id = null) {
    els.formGoal.reset();
    document.getElementById('form-goal-transaction').reset();
    document.getElementById('goal-id').value = '';
    document.getElementById('goal-modal-title').textContent = 'Thêm mục tiêu';
    document.getElementById('btn-delete-goal').classList.add('hidden');
    document.getElementById('goal-color').value = '#10b981';

    // Switch to Info Tab by default
    switchGoalModalTab('goal-info');

    // Clear History in Modal
    document.getElementById('goal-modal-history-list').innerHTML = '';
    document.getElementById('goal-current-display').textContent = formatCurrency(0);

    // If ID exists (Edit Mode)
    if (id) {
        const g = State.goals.find(x => x.id === id);
        if (g) {
            document.getElementById('goal-id').value = g.id;
            document.getElementById('goal-name').value = g.name;
            document.getElementById('goal-target').value = g.target;
            document.getElementById('goal-deadline').value = g.deadline || ''; // FIX: Load Deadline
            document.getElementById('goal-color').value = g.color || '#10b981';
            document.getElementById('goal-modal-title').textContent = 'Chi tiết mục tiêu';

            document.getElementById('goal-current-display').textContent = formatCurrency(g.current || 0);

            renderGoalHistoryInModal(g);

            const btnDel = document.getElementById('btn-delete-goal');
            btnDel.classList.remove('hidden');
            btnDel.onclick = (e) => {
                e.preventDefault();
                if (confirm('Xóa mục tiêu này?')) {
                    State.goals = State.goals.filter(x => x.id !== id);
                    saveData('goals');
                    document.getElementById('modal-goal').classList.add('hidden');
                    renderAccumulation();
                }
            }
        }
    } else {
        // Create Mode - Hide History Tab initially? Or just show empty
        // Maybe lock History tab if not created yet? For simplicity allow access but it does nothing
    }
    // Trigger calc to show Original Plan immediately
    calcGoalMonthly();
    document.getElementById('modal-goal').classList.remove('hidden');
}

function switchGoalModalTab(tabId) {
    document.querySelectorAll('.modal-tab').forEach(b => {
        if (b.dataset.modalTab === tabId) b.classList.add('active');
        else b.classList.remove('active');
    });
    document.querySelectorAll('.modal-tab-content').forEach(c => {
        if (c.id === `goal-tab-${tabId.split('-')[1]}`) c.classList.remove('hidden'); // map goal-info -> goal-tab-info
        else c.classList.add('hidden');
    });
    // Simplified mapping for the IDs I used in HTML replace
    // HTML IDs: goal-tab-info, goal-tab-history
    // Button Data: goal-info, goal-history
    const targetId = tabId === 'goal-info' ? 'goal-tab-info' : 'goal-tab-history';
    document.getElementById('goal-tab-info').classList.add('hidden');
    document.getElementById('goal-tab-history').classList.add('hidden');
    document.getElementById(targetId).classList.remove('hidden');
}

function renderGoalHistoryInModal(g) {
    const list = document.getElementById('goal-modal-history-list');
    if (!g.history || g.history.length === 0) {
        list.innerHTML = '<p class="text-muted" style="text-align:center; padding:1rem;">Chưa có lịch sử</p>';
        return;
    }
    // Sort DESC
    const sorted = [...g.history].sort((a, b) => new Date(b.date) - new Date(a.date));
    list.innerHTML = sorted.map(h => `
        <div style="display:flex; justify-content:space-between; padding:0.5rem; border-bottom:1px solid var(--border);">
            <div>
               <span style="font-size:0.85rem; font-weight:600;">${h.note || (h.amount > 0 ? 'Nạp tiền' : 'Rút tiền')}</span>
               <div style="font-size:0.75rem; color:var(--text-muted);">${formatDate(h.date)}</div>
            </div>
            <div style="font-weight:600; color:${h.amount > 0 ? 'var(--success)' : 'var(--danger)'}">
                ${h.amount > 0 ? '+' : ''}${formatCurrency(h.amount)}
            </div>
        </div>
    `).join('');
}

function handleGoalSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('goal-id').value;
    const name = document.getElementById('goal-name').value;
    const target = parseFloat(document.getElementById('goal-target').value);
    const color = document.getElementById('goal-color').value;
    const deadline = document.getElementById('goal-deadline').value;

    if (id) {
        const g = State.goals.find(x => x.id === id);
        if (g) {
            g.name = name;
            g.target = target;
            g.deadline = deadline;
            g.color = color;
        }
    } else {
        State.goals.push({
            id: generateId(),
            name,
            target,
            current: 0, // Init 0
            color,
            deadline,
            startDate: new Date().toISOString(),
            history: []
        });
    }
    saveData('goals');
    document.getElementById('modal-goal').classList.add('hidden');
    renderAccumulation();
}

function handleGoalTransaction(e) {
    e.preventDefault();
    const id = document.getElementById('goal-id').value;
    if (!id) {
        alert("Vui lòng lưu mục tiêu trước khi thêm giao dịch!");
        return;
    }

    const amountVal = parseFloat(document.getElementById('goal-trans-amount').value);
    const type = document.getElementById('goal-trans-type').value;
    const note = document.getElementById('goal-trans-note').value;

    if (!amountVal || amountVal <= 0) return;

    const g = State.goals.find(x => x.id === id);
    if (g) {
        const finalAmount = type === 'deposit' ? amountVal : -amountVal;

        g.current = (g.current || 0) + finalAmount;
        if (!g.history) g.history = [];

        g.history.push({
            date: new Date().toISOString(),
            amount: finalAmount,
            note: note || (type === 'deposit' ? 'Nạp tiền' : 'Rút tiền')
        });

        saveData('goals');

        // Update UI in modal
        document.getElementById('goal-current-display').textContent = formatCurrency(g.current);
        renderGoalHistoryInModal(g);
        document.getElementById('form-goal-transaction').reset();

        // Update main view in background
        renderAccumulation();
    }
}

function openGoalHistory(id) {
    const g = State.goals.find(x => x.id === id);
    if (!g) return;

    document.getElementById('history-modal-title').textContent = `Lịch sử: ${g.name}`;
    const list = document.getElementById('goal-history-list');
    const planBox = document.getElementById('history-goal-plan');

    // --- Calculate Plan for History View ---
    if (g.deadline) {
        const target = g.target || 0;
        const current = g.current || 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadline = new Date(g.deadline);
        deadline.setHours(0, 0, 0, 0);

        const startDate = g.startDate ? new Date(g.startDate) : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
        if (g.startDate) startDate.setHours(0, 0, 0, 0);

        // 1. Current Plan
        const diffTime = deadline - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        let months = Math.ceil(diffDays / 30);
        if (months < 1) months = 0.5;
        if (months > 0 && diffDays <= 0) months = 0;

        let currentMsg = '';
        const remaining = target - current;

        if (remaining <= 0) {
            currentMsg = `<span class="text-success">Đã hoàn thành!</span>`;
        } else if (diffDays <= 0) {
            currentMsg = `<span class="text-danger">Đã quá hạn!</span>`;
        } else {
            const monthly = remaining / months;
            currentMsg = `${formatCurrency(monthly)} / tháng <span style="font-size:0.8em; font-weight:400">(còn ${months} tháng)</span>`;
        }

        // 2. Original Plan
        const totalDiffTime = deadline - startDate;
        const totalDiffDays = Math.ceil(totalDiffTime / (1000 * 60 * 60 * 24));
        let totalMonths = Math.ceil(totalDiffDays / 30);
        if (totalMonths < 1) totalMonths = 1;
        const originalMonthly = target / totalMonths;

        planBox.innerHTML = `
            <div style="margin-bottom:0.25rem; font-weight:600;">Kế hoạch hiện tại: ${currentMsg}</div>
            <div style="font-size:0.85rem; color:var(--text-muted); font-weight:500;">
                Kế hoạch gốc: ${formatCurrency(originalMonthly)} / tháng (trong ${totalMonths} tháng)
            </div>
        `;
        planBox.classList.remove('hidden');
    } else {
        planBox.classList.add('hidden');
    }

    if (!g.history || g.history.length === 0) {
        list.innerHTML = '<p class="text-muted" style="text-align:center;">Chưa có lịch sử.</p>';
    } else {
        // Sort DESC
        const sorted = [...g.history].sort((a, b) => new Date(b.date) - new Date(a.date));
        list.innerHTML = sorted.map(h => `
            <div style="display:flex; justify-content:space-between; padding:0.75rem; background: var(--surface); border-radius:8px; border:1px solid var(--border);">
                <div>
                   <p style="font-weight:600; font-size:0.9rem;">${h.amount > 0 ? 'Nạp thêm' : 'Rút bớt'}</p>
                   <p style="font-size:0.75rem; color:var(--text-muted);">${formatDate(h.date)}</p>
                </div>
                <div style="font-weight:700; color:${h.amount > 0 ? 'var(--success)' : 'var(--danger)'}">
                    ${h.amount > 0 ? '+' : ''}${formatCurrency(h.amount)}
                </div>
            </div>
        `).join('');
    }
    document.getElementById('modal-goal-history').classList.remove('hidden');
}

function calcGoalMonthly() {
    const target = parseFloat(document.getElementById('goal-target').value) || 0;
    // Current accumulated is not in the form input anymore? 
    // Wait, I removed goal-current input from HTML. 
    // I need to fetch 'current' from the goal object if editing, or 0 if new.
    const id = document.getElementById('goal-id').value;
    let current = 0;
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    if (id) {
        const g = State.goals.find(x => x.id === id);
        if (g) {
            current = g.current || 0;
            if (g.startDate) {
                startDate = new Date(g.startDate);
                startDate.setHours(0, 0, 0, 0);
            }
        }
    }

    const deadlineVal = document.getElementById('goal-deadline').value;
    const previewBox = document.getElementById('goal-calc-preview');
    const msg = document.getElementById('goal-calc-msg');

    if (!deadlineVal) {
        previewBox.classList.add('hidden');
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(deadlineVal);
    deadline.setHours(0, 0, 0, 0);

    // --- 1. Current Plan (Adjusted) ---
    // Remaining / Remaining Months
    const diffTime = deadline - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    let months = Math.ceil(diffDays / 30);
    if (months < 1) months = 0.5; // near deadline
    if (months > 0 && diffDays <= 0) months = 0; // passed

    let currentMsg = '';
    const remaining = target - current;

    if (remaining <= 0) {
        currentMsg = `<span class="text-success">Đã hoàn thành!</span>`;
    } else if (diffDays <= 0) {
        currentMsg = `<span class="text-danger">Đã quá hạn!</span>`;
    } else {
        const monthly = remaining / months;
        currentMsg = `${formatCurrency(monthly)} / tháng <span style="font-size:0.8em; font-weight:400">(còn ${months} tháng)</span>`;
    }

    // --- 2. Original Plan (Baseline) ---
    // Target / Total Months (Start -> Deadline)
    const totalDiffTime = deadline - startDate;
    const totalDiffDays = Math.ceil(totalDiffTime / (1000 * 60 * 60 * 24));
    let totalMonths = Math.ceil(totalDiffDays / 30);
    if (totalMonths < 1) totalMonths = 1;

    const originalMonthly = target / totalMonths;

    previewBox.classList.remove('hidden');
    msg.innerHTML = `
        <div style="margin-bottom:0.25rem;">Cần tích: ${currentMsg}</div>
        <div style="font-size:0.85rem; color:var(--text-muted); font-weight:500;">
            Kế hoạch gốc: ${formatCurrency(originalMonthly)} / tháng (trong ${totalMonths} tháng)
        </div>
    `;
}
// (Call this in setupEventListeners or ensuring it runs)
function setupAccumulationListeners() {
    const btnAddGoal = document.getElementById('btn-add-goal');
    if (btnAddGoal) btnAddGoal.addEventListener('click', () => openGoalModal());

    // Input listeners for calc

    ['goal-target', 'goal-deadline'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calcGoalMonthly);
    });

    const formGoal = document.getElementById('form-goal');
    if (formGoal) formGoal.addEventListener('submit', handleGoalSubmit);

    // Modal Tabs
    document.querySelectorAll('.modal-tab').forEach(btn => {
        btn.addEventListener('click', () => switchGoalModalTab(btn.dataset.modalTab));
    });

    // Transaction Form
    const transForm = document.getElementById('form-goal-transaction');
    if (transForm) transForm.addEventListener('submit', handleGoalTransaction);
}



function changeMonth(delta) {
    State.currentDate.setMonth(State.currentDate.getMonth() + delta);
    // Be careful with JS dates (e.g. March 31 -> Feb 28/29 logic is auto handled but sometimes jumpy)
    // Ideally use a library like date-fns, but for vanilla we do basic
    renderApp();
}

// --- Todo Logic ---

function renderTodos() {
    const list = document.getElementById('todo-list');
    if (!list) return;

    if (State.todos.length === 0) {
        list.innerHTML = '<p class="empty-state">Chưa có nhiệm vụ nào. Hãy thêm mới!</p>';
        return;
    }

    // Sort: Uncompleted first
    const sortedTodos = [...State.todos].sort((a, b) => {
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;
    });

    list.innerHTML = sortedTodos.map(todo => `
        <div class="todo-item ${todo.completed ? 'completed' : ''}">
            <div class="todo-checkbox" onclick="toggleTodo('${todo.id}')">
                ${todo.completed ? '<i data-lucide="check" style="width:16px; height:16px;"></i>' : ''}
            </div>
            <div class="todo-content">${todo.text}</div>
            <button class="btn-delete-todo" onclick="deleteTodo('${todo.id}')">
                <i data-lucide="trash-2"></i>
            </button>
        </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

function handleAddTodo() {
    const input = document.getElementById('todo-input');
    const text = input.value.trim();

    if (!text) return;

    State.todos.unshift({
        id: generateId(),
        text: text,
        completed: false,
        createdAt: new Date().toISOString()
    });

    saveData('todos');
    input.value = '';
    renderTodos();
}

window.toggleTodo = (id) => {
    const todo = State.todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        saveData('todos');
        renderTodos();
    }
};

window.deleteTodo = (id) => {
    if (confirm('Xóa nhiệm vụ này?')) {
        State.todos = State.todos.filter(t => t.id !== id);
        saveData('todos');
        renderTodos();
    }
};

// Initial setup for Todo listeners
if (document.getElementById('btn-add-todo')) {
    document.getElementById('btn-add-todo').addEventListener('click', handleAddTodo);
    document.getElementById('todo-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddTodo();
    });
}



function renderApp() {
    renderDateDisplay();
    renderDashboard();
    // Pre-fill categories in forms
    renderCategoryOptions();
}

function renderDateDisplay() {
    const month = State.currentDate.getMonth() + 1;
    const year = State.currentDate.getFullYear();
    els.currentMonthDisplay.textContent = `Tháng ${month} ${year}`;

    // Limit for this month
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const limit = State.monthlyLimits[key] || 0;

    const limitEl = document.getElementById('daily-limit-display');
    if (limit > 0) {
        limitEl.classList.remove('hidden');
        limitEl.querySelector('span').textContent = formatCurrency(limit);
    } else {
        limitEl.classList.add('hidden');
    }
}

function getMonthlyTransactions(date) {
    const monthPrefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return State.transactions.filter(t => t.date.startsWith(monthPrefix));
}

function renderDashboard() {
    const monthlyTrans = getMonthlyTransactions(State.currentDate);
    const totalSpent = monthlyTrans.reduce((sum, t) => sum + t.amount, 0);

    // Limit Status Logic
    const dailyLimit = State.monthlyLimits[`${State.currentDate.getFullYear()}-${String(State.currentDate.getMonth() + 1).padStart(2, '0')}`] || 0;
    let limitHTML = '';

    if (dailyLimit > 0) {
        // Simple approximation of limit status logic
        // For full accuracy we need "Accumulated Limit vs Total Spent"
        const today = new Date();
        const isCurrentMonth = today.getMonth() === State.currentDate.getMonth() && today.getFullYear() === State.currentDate.getFullYear();
        let daysPassed = isCurrentMonth ? today.getDate() : new Date(State.currentDate.getFullYear(), State.currentDate.getMonth() + 1, 0).getDate();

        const accumulatedLimit = dailyLimit * daysPassed;
        const diff = accumulatedLimit - totalSpent;
        const isSafe = diff >= 0;

        limitHTML = `
           <div class="stat-card-gradient ${isSafe ? 'stat-limit-safe' : 'stat-limit-danger'}">
                <div style="display:flex; justify-content:space-between; align-items:start">
                    <div>
                        <h3 class="stat-card-title">${isSafe ? 'Tình trạng: An toàn' : 'Tình trạng: Cảnh báo'}</h3>
                        <p class="stat-card-value">${isSafe ? '+' : ''}${formatCurrency(diff)}</p>
                        <p class="stat-card-sub">So với hạn mức lũy kế (${formatCurrency(accumulatedLimit)})</p>
                    </div>
                     <div style="background:rgba(255,255,255,0.2); padding:0.5rem; border-radius:50%;">
                        <i data-lucide="${isSafe ? 'shield-check' : 'alert-triangle'}" style="width:24px; height:24px;"></i>
                     </div>
                </div>
           </div>
        `;
    } else {
        limitHTML = `
             <div class="stat-card-gradient" style="background:linear-gradient(to right, #64748b, #94a3b8); border:1px dashed #cbd5e1;">
                <h3 class="stat-card-title">Chưa cài đặt hạn mức</h3>
                <p style="font-size:0.9rem; opacity:0.8; margin-top:0.5rem">Cài đặt hạn mức ngày để theo dõi chi tiêu hiệu quả hơn.</p>
             </div>
        `;
    }

    // Stats
    els.statsGrid.innerHTML = `
        <div class="stat-card-gradient stat-total-expense">
            <h3 class="stat-card-title">Tổng chi tiêu tháng ${State.currentDate.getMonth() + 1}/${State.currentDate.getFullYear()}</h3>
            <p class="stat-card-value">-${formatCurrency(totalSpent)}</p>
            <p class="stat-card-sub">${monthlyTrans.length} giao dịch</p>
        </div>
        ${limitHTML}
    `;
    if (window.lucide) lucide.createIcons();


    // Recent List (Top 5)
    // Sort desc date, desc created
    const sorted = [...State.transactions].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.createdAt - a.createdAt;
    });

    renderTransactionList(sorted.slice(0, 5), els.recentTransactions);
    setTimeout(renderCharts, 0); // Delay chart rendering to ensure DOM and layout are settled
}

function renderTransactionList(transactions, container, group = false) {
    if (transactions.length === 0) {
        container.innerHTML = '<div style="padding:1rem; text-align:center; color:#999;">Chưa có dữ liệu</div>';
        return;
    }

    // Group by Date if needed (History view usually needs groups, but dashboard simple list)
    // For simplicity locally, we just list them or group them simple

    let html = '';
    let lastDate = '';

    transactions.forEach(t => {
        if (group && t.date !== lastDate) {
            html += `<div class="date-header">${formatDate(t.date)}</div>`;
            lastDate = t.date;
        }

        const cat = State.categories.find(c => c.id === t.categoryId) || { name: '?', color: '#ccc' };

        html += `
            <div class="transaction-item" onclick="openTransactionModal('${t.id}')">
                <div class="trans-left">
                    <div class="cat-icon" style="background-color: ${cat.color}">
                        ${cat.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="trans-info">
                        <p>${t.note || cat.name}</p>
                        <p>${cat.name}</p>
                    </div>
                </div>
                <div class="trans-amount">-${formatCurrency(t.amount)}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderHistory() {
    let raw = State.transactions;
    // Apply filters
    const term = State.filter.term.toLowerCase();
    const catId = State.filter.categoryId;
    const start = State.filter.startDate ? new Date(State.filter.startDate) : null;
    const end = State.filter.endDate ? new Date(State.filter.endDate) : null;

    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);

    let filtered = raw.filter(t => {
        // Text
        const matchesTerm = !term || t.note.toLowerCase().includes(term) || (t.amount.toString().includes(term));
        if (!matchesTerm) return false;

        // Category
        if (catId && t.categoryId !== catId) return false;

        // Date Range
        const tDate = new Date(t.date);
        if (start && tDate < start) return false;
        if (end && tDate > end) return false;

        return true;
    });

    // Sort
    filtered.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

    renderTransactionList(filtered, els.historyList, true);

    // Update Title with count/total?
    const total = filtered.reduce((acc, t) => acc + t.amount, 0);
    document.getElementById('history-title').textContent = `Lịch sử: ${filtered.length} giao dịch (-${formatCurrency(total)})`;
}

// --- Modals & Forms Handlers ---

function openModal(name) {
    let modal;
    if (name === 'transaction') {
        modal = els.modalTransaction;
    } else if (name === 'limit') {
        modal = els.modalLimit;
        // Render current month display
        const today = new Date();
        const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        document.getElementById('limit-month-display').textContent = `${today.getMonth() + 1}/${today.getFullYear()}`;
        document.getElementById('limit-amount').value = State.monthlyLimits[monthKey] || '';

        // Render category limits inputs
        const catList = document.getElementById('limit-category-list');
        if (catList) {
            catList.innerHTML = State.categories.map(c => `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                    <span style="font-size:0.875rem; font-weight:500; color:var(--text-main); display:flex; align-items:center; gap:0.5rem;">
                        <div style="width:12px; height:12px; border-radius:50%; background:${c.color}"></div>
                        ${c.name}
                    </span>
                    <div class="input-wrapper" style="width: 150px;">
                            <input type="number" class="cat-limit-input" data-id="${c.id}" value="${c.budgetLimit || ''}" placeholder="0" style="text-align:right;">
                            <span class="currency">VND</span>
                    </div>
                </div>
            `).join('');
        }
    } else if (name === 'categories') {
        modal = els.modalCategories;
        renderCategorySettings();
    } else if (name === 'installment') {
        modal = els.modalInstallment;
        els.formInstallment.reset();
        document.getElementById('inst-id').value = '';
        document.getElementById('inst-modal-title').textContent = 'Thêm trả góp';
    } else if (name === 'bulk-delete') {
        modal = document.getElementById('modal-bulk-delete');
        // Trigger generic update to show hint default
        document.getElementById('bulk-delete-type').dispatchEvent(new Event('change'));
    }

    if (modal) {
        modal.classList.remove('hidden');
    }
}

function editInstallment(id) {
    const inst = State.installments.find(i => i.id === id);
    if (!inst) return;

    // Close detail modal
    document.getElementById('modal-inst-detail').classList.add('hidden');

    // Populate form
    document.getElementById('inst-id').value = inst.id;
    document.getElementById('inst-name').value = inst.name;
    document.getElementById('inst-value').value = inst.totalValue;
    document.getElementById('inst-rate').value = inst.interestRate;
    document.getElementById('inst-term').value = inst.term;
    document.getElementById('inst-date').value = inst.startDate;

    document.getElementById('inst-modal-title').textContent = 'Sửa trả góp';
    els.modalInstallment.classList.remove('hidden');
}

function openTransactionModal(id = null) {
    els.formTransaction.reset();
    document.getElementById('trans-id').value = '';
    // Defaults
    document.getElementById('trans-date').valueAsDate = new Date(); // To local date

    // Delete button hidden by default
    document.getElementById('btn-delete-trans').classList.add('hidden');
    document.getElementById('trans-modal-title').textContent = 'Thêm khoản chi';

    if (id) {
        const t = State.transactions.find(x => x.id === id);
        if (t) {
            document.getElementById('trans-id').value = t.id;
            document.getElementById('trans-amount').value = t.amount;
            document.getElementById('trans-category').value = t.categoryId;
            document.getElementById('trans-date').value = t.date;
            document.getElementById('trans-note').value = t.note;
            document.getElementById('trans-modal-title').textContent = 'Sửa khoản chi';

            // Show delete
            const btnDelete = document.getElementById('btn-delete-trans');
            btnDelete.classList.remove('hidden');
            btnDelete.onclick = (e) => {
                e.preventDefault(); // Prevent form submit
                if (confirm("Xóa khoản này?")) {
                    State.transactions = State.transactions.filter(x => x.id !== id);
                    saveData('transactions');
                    els.modalTransaction.classList.add('hidden');
                    renderApp();
                    renderHistory(); // if open
                }
            };
        }
    }

    els.modalTransaction.classList.remove('hidden');
}

function handleTransactionSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('trans-id').value;
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const categoryId = document.getElementById('trans-category').value;
    const date = document.getElementById('trans-date').value;
    const note = document.getElementById('trans-note').value;

    if (id) {
        // Edit
        const t = State.transactions.find(x => x.id === id);
        if (t) {
            t.amount = amount;
            t.categoryId = categoryId;
            t.date = date;
            t.note = note;
        }
    } else {
        // Add
        const newT = {
            id: generateId(),
            amount,
            categoryId,
            date,
            note,
            createdAt: Date.now()
        };
        State.transactions.push(newT);
    }

    saveData('transactions');
    els.modalTransaction.classList.add('hidden');
    renderApp();
    renderHistory();
}

function handleLimitSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('limit-amount').value) || 0;
    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    State.monthlyLimits[monthKey] = amount;
    saveData('monthly_limits');

    // Save category limits
    const catInputs = document.querySelectorAll('.cat-limit-input');
    let hasChanges = false;
    catInputs.forEach(input => {
        const id = input.getAttribute('data-id');
        const limitVal = parseFloat(input.value) || 0;
        const cat = State.categories.find(c => c.id === id);
        if (cat && cat.budgetLimit !== limitVal) {
            cat.budgetLimit = limitVal;
            hasChanges = true;
        }
    });

    if (hasChanges) {
        saveData('categories');
    }

    renderDashboard();
    // renderBarChart(); // Assuming this function exists and should be called
    els.modalLimit.classList.add('hidden');
    renderDateDisplay();
}

// --- Bulk Delete Logic ---
function handleBulkDeleteSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('bulk-delete-type').value;
    const val = document.getElementById('bulk-delete-date').value;

    if (!val) return;

    let count = 0;
    let confirmMsg = '';
    let filterFn = null;

    if (type === 'day') {
        count = State.transactions.filter(t => t.date === val).length;
        confirmMsg = `Bạn chắc chắn muốn xóa vĩnh viễn ${count} giao dịch ngày ${formatDate(val)}?`;
        filterFn = (t) => t.date !== val;
    } else if (type === 'week') {
        const d = new Date(val);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setHours(0, 0, 0, 0);
        monday.setDate(diff);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const startStr = monday.toISOString().split('T')[0];
        const endStr = sunday.toISOString().split('T')[0];

        count = State.transactions.filter(t => t.date >= startStr && t.date <= endStr).length;
        confirmMsg = `Bạn chắc chắn muốn xóa vĩnh viễn ${count} giao dịch tuần ${formatDate(startStr)} - ${formatDate(endStr)}?`;
        filterFn = (t) => !(t.date >= startStr && t.date <= endStr);

    } else if (type === 'month') {
        // val is YYYY-MM or YYYY-MM-DD
        let mStr = val;
        // If type input was date but logic month, convert.
        if (val.length > 7) {
            // YYYY-MM-DD
            const d = new Date(val);
            mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }

        count = State.transactions.filter(t => t.date.startsWith(mStr)).length;
        confirmMsg = `Bạn chắc chắn muốn xóa vĩnh viễn ${count} giao dịch tháng ${mStr}?`;
        filterFn = (t) => !t.date.startsWith(mStr);
    }

    if (count === 0) {
        alert("Không có dữ liệu để xóa!");
        return;
    }

    if (confirm(confirmMsg)) {
        State.transactions = State.transactions.filter(filterFn);
        saveData('transactions');
        document.getElementById('modal-bulk-delete').classList.add('hidden');
        renderApp();
        renderHistory();
        alert("Đã xóa thành công!");
    }
}

// --- Categories Logic ---
function renderCategoryOptions() {
    const select = document.getElementById('trans-category');
    const filterSelect = document.getElementById('filter-category');

    const options = State.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    if (select) select.innerHTML = options;
    if (filterSelect) filterSelect.innerHTML = `<option value="">Tất cả danh mục</option>` + options;
}

// function renderCategorySettings() { ... } // Replaced above with color editing support

function handleAddCategory(e) {
    e.preventDefault();
    const name = document.getElementById('new-cat-name').value;
    const color = document.getElementById('new-cat-color').value;

    State.categories.push({
        id: generateId(),
        name,
        color,
        isDefault: false
    });

    saveData('categories');
    document.getElementById('new-cat-name').value = '';
    renderCategorySettings();
    renderCategoryOptions();
}

window.deleteCategory = (id) => {
    if (confirm('Xóa danh mục này?')) {
        State.categories = State.categories.filter(c => c.id !== id);
        saveData('categories');
        renderCategorySettings();
        renderCategoryOptions();
    }
};

// --- Installments Logic ---
// ... (Simplified logic for installments similar to React but vanilla)
function renderInstallments() {
    const grid = document.getElementById('installments-grid');
    if (State.installments.length === 0) {
        grid.innerHTML = '<p style="text-align:center; color:#999; padding:2rem;">Chưa có dữ liệu</p>';
        return;
    }

    let totalMonthlyPayment = 0;

    // First pass to calculate total
    State.installments.forEach(inst => {
        const monthly = (inst.totalValue / inst.term) + (inst.totalValue * (inst.interestRate / 100));
        const paid = inst.paidMonths || 0;
        if (paid < inst.term) {
            totalMonthlyPayment += monthly;
        }
    });

    const itemsHtml = State.installments.map(inst => {
        const monthly = (inst.totalValue / inst.term) + (inst.totalValue * (inst.interestRate / 100));
        const paid = inst.paidMonths || 0;
        const percent = (paid / inst.term) * 100;
        const finished = paid >= inst.term;

        const totalPayable = monthly * inst.term;
        const paidAmount = monthly * paid;
        const remainingAmount = Math.max(0, totalPayable - paidAmount);

        return `
            <div class="card" style="padding:1rem; cursor:pointer; opacity: ${finished ? 0.7 : 1}" onclick="openInstallmentDetail('${inst.id}')">
                <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
                    <h3 style="font-weight:700; margin:0;">${inst.name}</h3>
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
                        <span style="background:#f1f5f9; color:#475569; padding:0.25rem 0.5rem; border-radius:1rem; font-size:0.75rem; font-weight:700; white-space:nowrap;">
                            Giá trị gốc: ${formatCurrency(inst.totalValue)}
                        </span>
                        <span style="background:#f0f9ff; color:#0369a1; padding:0.25rem 0.5rem; border-radius:1rem; font-size:0.75rem; font-weight:700; white-space:nowrap;">
                            Giá trị sau lãi: ${formatCurrency(totalPayable)}
                        </span>
                        ${!finished ? `
                        <span style="background:#fee2e2; color:#991b1b; padding:0.25rem 0.5rem; border-radius:1rem; font-size:0.75rem; font-weight:700; white-space:nowrap;">
                            Còn lại: ${formatCurrency(remainingAmount)}
                        </span>` : ''}
                        <span style="background:${finished ? '#dcfce7' : '#e0e7ff'}; color:${finished ? '#166534' : '#4338ca'}; padding:0.25rem 0.5rem; border-radius:1rem; font-size:0.75rem; font-weight:700; white-space:nowrap;">
                            ${finished ? 'Hoàn thành' : `Còn ${inst.term - paid} tháng`}
                        </span>
                    </div>
                </div>
                
                <div style="display:flex; justify-content:flex-end; margin-bottom:0.5rem;">
                     <span style="color:#6366f1; font-size:0.9rem; font-weight:600;">
                        ${formatCurrency(monthly)} / tháng
                    </span>
                </div>

                 <div style="background:#f1f5f9; height:8px; border-radius:4px; overflow:hidden; margin-top:0.5rem;">
                    <div style="background:#4f46e5; width:${percent}%; height:100%;"></div>
                 </div>
                 <div style="font-size:0.75rem; color:#94a3b8; margin-top:0.25rem; text-align:right;">
                    ${paid}/${inst.term} kỳ
                 </div>
            </div>
        `;
    }).join('');

    const summaryHtml = `
        <div style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:1rem; border-radius:1rem; border:1px solid var(--border); box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <div>
                 <div style="font-size:0.875rem; color:var(--text-muted); font-weight:500;">Tổng phải trả tháng này</div>
                 <div style="font-size:1.5rem; font-weight:800; color:var(--primary);">${formatCurrency(totalMonthlyPayment)}</div>
            </div>
            <button class="btn-primary" onclick="payAllInstallmentsOneMonth()">
                <i data-lucide="check-circle-2"></i> Xác nhận đã trả 1 kỳ
            </button>
        </div>
    `;

    grid.innerHTML = summaryHtml + itemsHtml;
}

window.payAllInstallmentsOneMonth = function () {
    // Check if there are any active installments
    const active = State.installments.filter(i => (i.paidMonths || 0) < i.term);

    if (active.length === 0) {
        alert("Không có khoản trả góp nào cần trả!");
        return;
    }

    if (confirm(`Xác nhận đánh dấu ĐÃ TRẢ khoản tiền tháng này cho ${active.length} hạng mục?`)) {
        active.forEach(i => {
            i.paidMonths = (i.paidMonths || 0) + 1;
        });
        saveData('installments');
        renderInstallments();
        alert("Đã cập nhật thành công!");
    }
};


function handleInstallmentSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('inst-id').value;
    const name = document.getElementById('inst-name').value;
    const value = parseFloat(document.getElementById('inst-value').value);
    const rate = parseFloat(document.getElementById('inst-rate').value) || 0;
    const term = parseInt(document.getElementById('inst-term').value);
    const date = document.getElementById('inst-date').value;

    if (id) {
        const inst = State.installments.find(i => i.id === id);
        if (inst) {
            inst.name = name;
            inst.totalValue = value;
            inst.interestRate = rate;
            inst.term = term;
            inst.startDate = date;
            // paidMonths remains same? Or logic to update it?
            // For now keep paidMonths
        }
    } else {
        const newInst = {
            id: generateId(),
            name,
            totalValue: value,
            interestRate: rate,
            term,
            startDate: date,
            paidMonths: 0,
            createdAt: Date.now()
        };
        State.installments.push(newInst);
    }

    saveData('installments');
    els.modalInstallment.classList.add('hidden');
    renderInstallments();
}

// ... Additional helper functions for Installment Details would go here ...
// For brevity, skipping the detailed breakdown modal logic unless explicitly requested to be pixel perfect to React
// But I will add the 'openInstallmentDetail' placeholder so no error occurs

// --- Chart Logic --- //
// --- Charts Logic --- //
function renderCharts() {
    if (typeof Chart === 'undefined') return;
    renderPieChart();
    renderBarChart();
}

function renderPieChart() {
    const ctx = document.getElementById('expense-chart');
    if (!ctx) return;

    // Get monthly transactions
    const monthlyTrans = getMonthlyTransactions(State.currentDate);

    // Group by category
    const catTotals = {};
    monthlyTrans.forEach(t => {
        if (!catTotals[t.categoryId]) catTotals[t.categoryId] = 0;
        catTotals[t.categoryId] += t.amount;
    });

    const labels = [];
    const data = [];
    const colors = [];

    // Sort by amount desc
    const sortedCats = Object.keys(catTotals).sort((a, b) => catTotals[b] - catTotals[a]);

    sortedCats.forEach(catId => {
        const cat = State.categories.find(c => c.id === catId);
        if (cat) {
            const limit = cat.budgetLimit || 0;
            const currentTotal = catTotals[catId];
            const isOver = limit > 0 && currentTotal > limit;

            let label = `${cat.name} (${formatCurrency(currentTotal)})`;
            if (isOver) {
                const overAmount = currentTotal - limit;
                // Display Total Spent AND Over Amount
                label = `${cat.name} (${formatCurrency(currentTotal)}) ⚠️ Vượt ${formatCurrency(overAmount)}`;
            }

            labels.push(label);
            data.push(currentTotal);
            colors.push(cat.color);
        } else {
            labels.push(`Khác (${formatCurrency(catTotals[catId])})`);
            data.push(catTotals[catId]);
            colors.push('#cbd5e1');
        }
    });

    if (expenseChartInstance) {
        expenseChartInstance.destroy();
    }

    if (data.length === 0) {
        // Clear logic if needed
        return;
    }

    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 12,
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    bodyFont: {
                        size: 14
                    },
                    titleFont: {
                        size: 14
                    }
                }
            }
        }
    });
}

function renderBarChart() {
    const ctx = document.getElementById('bar-chart');
    if (!ctx) return;

    const viewMode = State.viewMode;
    const currentDate = State.currentDate;

    // Update Title
    const mapTitle = {
        'daily': 'Chi tiêu theo ngày',
        'weekly': 'Chi tiêu theo tuần',
        'monthly': 'Chi tiêu 6 tháng gần nhất'
    };
    document.getElementById('bar-chart-title').textContent = mapTitle[viewMode];

    let labels = [];
    let data = [];
    let backgroundColors = [];
    let breakdowns = [];

    // Logic based on ViewMode
    if (viewMode === 'monthly') {
        // Last 6 months
        for (let i = 5; i >= 0; i--) {
            const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
            const label = `${d.getMonth() + 1}/${d.getFullYear()}`;

            const transInMonth = State.transactions.filter(t => t.date.startsWith(monthStr));
            const total = transInMonth.reduce((acc, t) => acc + t.amount, 0);

            // Calculate breakdown
            const catMap = {};
            transInMonth.forEach(t => {
                catMap[t.categoryId] = (catMap[t.categoryId] || 0) + t.amount;
            });
            breakdowns.push(catMap);

            labels.push(label);
            data.push(total);
            backgroundColors.push('#6366f1');
        }
    } else if (viewMode === 'weekly') {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Simple logic for weeks
        let currentStart = new Date(firstDay);
        let weekIndex = 1;

        while (currentStart <= lastDay) {
            const currentEnd = new Date(currentStart);
            currentEnd.setDate(currentStart.getDate() + 6);
            const actualEnd = currentEnd > lastDay ? lastDay : currentEnd;

            const startStr = currentStart.toISOString().split('T')[0];
            const endStr = actualEnd.toISOString().split('T')[0];

            // Filter
            const transInWeek = State.transactions.filter(t => {
                const tDate = new Date(t.date);
                // Compare strings as ISO date YYYY-MM-DD
                return t.date >= startStr && t.date <= endStr;
            });
            const val = transInWeek.reduce((acc, t) => acc + t.amount, 0);

            // Breakdown
            const catMap = {};
            transInWeek.forEach(t => {
                catMap[t.categoryId] = (catMap[t.categoryId] || 0) + t.amount;
            });
            breakdowns.push(catMap);

            labels.push(`Tuần ${weekIndex}`);
            data.push(val);
            backgroundColors.push('#6366f1');

            // Next loop
            currentStart.setDate(currentStart.getDate() + 7);
            weekIndex++;
        }
    } else {
        // Daily (Default)
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const key = `${year}-${String(month + 1).padStart(2, '0')}`;
        const limit = State.monthlyLimits[key] || 0;

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const transInDay = State.transactions.filter(t => t.date === dateStr);
            const val = transInDay.reduce((acc, t) => acc + t.amount, 0);

            // Breakdown
            const catMap = {};
            transInDay.forEach(t => {
                catMap[t.categoryId] = (catMap[t.categoryId] || 0) + t.amount;
            });
            breakdowns.push(catMap);

            labels.push(i.toString());
            data.push(val);

            if (limit > 0 && val > limit) {
                backgroundColors.push('#ef4444');
            } else {
                backgroundColors.push('#6366f1');
            }
        }
    }

    if (barChartInstance) {
        barChartInstance.destroy();
    }

    barChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Chi tiêu',
                data: data,
                backgroundColor: backgroundColors,
                borderRadius: 4,
                borderSkipped: false,
                barPercentage: 0.6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: document.body.classList.contains('dark') ? '#374151' : '#f1f5f9' },
                    ticks: {
                        font: { size: 10 },
                        callback: function (value) {
                            if (value === 0) return '0';
                            return (value / 1000).toFixed(0) + 'k';
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function (context) {
                            // Context is array of active tooltips
                            const label = context[0].label;
                            if (viewMode === 'daily') return `Ngày ${label}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
                            if (viewMode === 'monthly') return `Tháng ${label}`;
                            return label;
                        },
                        label: function (context) {
                            return `Tổng: ${formatCurrency(context.raw)}`;
                        },
                        afterBody: function (context) {
                            const idx = context[0].dataIndex;
                            const catMap = breakdowns[idx];
                            if (!catMap || Object.keys(catMap).length === 0) return [];

                            // Sort top categories
                            const entries = Object.entries(catMap).map(([id, amount]) => {
                                const c = State.categories.find(x => x.id === id);
                                return {
                                    name: c ? c.name : 'Khác',
                                    amount: amount
                                };
                            }).sort((a, b) => b.amount - a.amount);

                            const lines = [];
                            // lines.push('----------------');
                            entries.forEach(e => {
                                lines.push(`${e.name}: ${formatCurrency(e.amount)}`);
                            });
                            return lines;
                        }
                    }
                }
            }
        }
    });
}

// --- Installment Details Logic --- //
window.openInstallmentDetail = (id) => {
    const inst = State.installments.find(i => i.id === id);
    if (!inst) return;

    document.getElementById('inst-detail-title').textContent = inst.name;
    const modal = document.getElementById('modal-inst-detail');

    renderInstallmentSchedule(inst);

    modal.classList.remove('hidden');

    // Setup Delete
    const btnDelete = document.getElementById('btn-delete-inst');
    // Remove old listeners involves cloning or managing refs, but simple onclick override works for vanilla
    btnDelete.onclick = () => {
        if (confirm(`Xóa khoản trả góp "${inst.name}"?`)) {
            State.installments = State.installments.filter(i => i.id !== id);
            saveData('installments');
            modal.classList.add('hidden');
            renderInstallments();
        }
    };

    // Setup Edit
    const btnEdit = document.getElementById('btn-edit-inst');
    btnEdit.onclick = () => {
        editInstallment(id);
    };
};

function renderInstallmentSchedule(inst) {
    const list = document.getElementById('inst-schedule-list');
    const summary = document.getElementById('inst-detail-summary');
    let html = '';
    const startDate = new Date(inst.startDate);

    const monthlyPrincipal = inst.totalValue / inst.term;
    const monthlyInterest = inst.totalValue * (inst.interestRate / 100);
    const monthlyAmount = monthlyPrincipal + monthlyInterest;

    const totalPayable = monthlyAmount * inst.term;
    const totalInterest = monthlyInterest * inst.term;

    if (summary) {
        summary.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem">
                <span style="color:var(--text-muted)">Gốc:</span>
                <span style="font-weight:600">${formatCurrency(inst.totalValue)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem">
                <span style="color:var(--text-muted)">Lãi (${inst.interestRate}%/tháng):</span>
                <span style="font-weight:600">${formatCurrency(totalInterest)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border); padding-top:0.5rem; margin-top:0.5rem">
                <span style="font-weight:700">Tổng phải trả:</span>
                <span style="font-weight:700; color:var(--primary); font-size:1.1rem">${formatCurrency(totalPayable)}</span>
            </div>
        `;
    }

    for (let i = 0; i < inst.term; i++) {
        // Due date: Start Date + i months
        const dueDate = new Date(startDate);
        dueDate.setMonth(startDate.getMonth() + i);

        const isPaid = i < inst.paidMonths;

        html += `
            <div class="inst-item ${isPaid ? 'paid' : ''}" onclick="toggleInstallmentMonth('${inst.id}', ${i})">
                <div class="check-circle">
                     ${isPaid ? '<i data-lucide="check" style="width:20px; height:20px;"></i>' : (i + 1)}
                </div>
                <div class="inst-info">
                    <div>
                        <p style="font-weight:600; font-size:0.9rem;">Kỳ ${i + 1}</p>
                        <p style="font-size:0.75rem; color:#64748b;">${formatDate(dueDate.toISOString())}</p>
                    </div>
                    <p class="money">${formatCurrency(monthlyAmount)}</p>
                </div>
            </div>
        `;
    }
    list.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

window.toggleInstallmentMonth = (id, index) => {
    const inst = State.installments.find(i => i.id === id);
    if (!inst) return;

    // Toggle logic: 
    // If we click index 3 (4th item):
    // If paidMonths = 3, means 0,1,2 paid. Click 3 -> paidMonths = 4.
    // If paidMonths = 4, means 0,1,2,3 paid. Click 3 -> paidMonths = 3 (Undo).

    // Allow jumping? If we click index 5 but paidMonths is 2? 
    // Let's force sequential or "Auto fill previous".
    // Most user friendly: Set paidMonths = index + 1. 

    if (index < inst.paidMonths) {
        // Currently paid, so unpay this and any after.
        // If I click index 0 (1st), and 3 are paid. paidMonths becomes 0.
        // Wait, usually users uncheck the latest one.
        // If I click index 2 (3rd) and paidMonths is 3. I want to Uncheck 3rd. Result paidMonths = 2.
        // If I click index 0 and paidMonths is 3. Do I Uncheck 1st?
        // Let's behave like a toggle for that specific index if valid? 
        // No, installment is sequential.

        // Behavior: Set paid count to index. (Uncheck this and all subsequent)
        inst.paidMonths = index;
    } else {
        // Currently unpaid. Check this and all previous.
        inst.paidMonths = index + 1;
    }

    saveData('installments');
    renderInstallments(); // Update main list
    renderInstallmentSchedule(inst); // Update detail list
};

function updateActiveClasses(nodeList, activeNode) {
    nodeList.forEach(n => n.classList.remove('active'));
    activeNode.classList.add('active');
}

// Initialize
window.addEventListener('DOMContentLoaded', init);


// --- Investment Logic ---

function renderInvestments() {
    const grid = document.getElementById('investment-grid');
    const summaryBoard = document.getElementById('investment-summary-board');

    // --- Migration & Summary Board ---
    let totalInvested = 0;
    let totalRevenue = 0;

    // Auto-migrate old data structure if needed
    // Old: capital, profit. New: invested, revenue.
    // revenue = capital + profit. invested = capital.
    State.investments.forEach(inv => {
        if (typeof inv.invested === 'undefined') {
            inv.invested = inv.capital || 0;
            inv.revenue = (inv.capital || 0) + (inv.profit || 0);
            // Cleanup old keys if desired, or keep for safety. Let's just use new ones.
        }
        totalInvested += inv.invested;
        totalRevenue += inv.revenue;
    });

    // Save migration if it happened
    if (State.investments.length > 0 && typeof State.investments[0].capital !== 'undefined') {
        // We can do a one-time clean or just save.
        // Let's remove old keys to be clean.
        State.investments.forEach(inv => {
            if (typeof inv.capital !== 'undefined') {
                delete inv.capital;
                delete inv.profit;
            }
        });
        saveData('investments');
    }

    const totalNet = totalRevenue - totalInvested; // Lời/Lỗ = Thu - Chi
    const isNetProfit = totalNet >= 0;

    // Monthly Target Total
    const totalMonthlyTarget = State.investments.reduce((sum, i) => sum + (i.monthlyTarget || 0), 0);

    if (summaryBoard) {
        summaryBoard.innerHTML = `
           <div class="stat-card-gradient" style="background: linear-gradient(to right, #3b82f6, #2563eb);">
               <h3 class="stat-card-title">Tổng Chi (Vốn)</h3>
               <p class="stat-card-value">${formatCurrency(totalInvested)}</p>
           </div>

           <div class="stat-card-gradient" style="background: linear-gradient(to right, #8b5cf6, #7c3aed);">
               <h3 class="stat-card-title">Tổng Thu</h3>
               <p class="stat-card-value">${formatCurrency(totalRevenue)}</p>
           </div>
           
           <div class="stat-card-gradient" style="background: linear-gradient(to right, ${isNetProfit ? '#10b981, #059669' : '#ef4444, #dc2626'});">
               <h3 class="stat-card-title">Tổng Lời/Lỗ</h3>
               <p class="stat-card-value">${isNetProfit ? '+' : ''}${formatCurrency(totalNet)}</p>
           </div>

           <div class="stat-card-gradient" style="background: linear-gradient(to right, #0ea5e9, #0284c7);">
               <h3 class="stat-card-title">Kế hoạch mỗi tháng</h3>
               <p class="stat-card-value">${formatCurrency(totalMonthlyTarget)}</p>
               <p class="stat-card-sub">Tổng tiền cần đầu tư định kỳ</p>
           </div>
        `;
        // Adjust grid columns
        summaryBoard.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
    }

    // --- Grid ---
    if (State.investments.length === 0) {
        grid.innerHTML = '<p class="empty-state">Chưa có danh mục nào.</p>';
        return;
    }

    grid.innerHTML = State.investments.map(inv => {
        // Logic:
        // Invested (Chi)
        // Revenue (Thu)
        // Net = Thu - Chi (Tổng đang có/Lời lỗ)

        const net = inv.revenue - inv.invested; // "Tổng đang có" logic per user request
        const isProfit = net >= 0;

        return `
            <div class="card goal-card" onclick="openInvestmentModal('${inv.id}')">
                <div class="goal-header">
                    <div style="display:flex; align-items:center; gap:0.5rem">
                         <div style="width:12px; height:12px; border-radius:50%; background:${inv.color || '#8b5cf6'}"></div>
                         <h3>${inv.name}</h3>
                    </div>
                    <button class="btn-icon-sm" onclick="openInvestmentHistory('${inv.id}', event)" title="Xem lịch sử">
                        <i data-lucide="history"></i>
                    </button>
                </div>
                
                <div style="margin-bottom:0.5rem">
                    <p style="font-size:0.75rem; color:var(--text-muted)">Tổng đang có (Lời/Lỗ)</p>
                    <p style="font-size:1.25rem; font-weight:700; color:${isProfit ? 'var(--success)' : 'var(--danger)'}">
                        ${isProfit ? '+' : ''}${formatCurrency(net)}
                    </p>
                </div>
                
                <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border); padding-top:0.5rem; font-size:0.85rem;">
                    <div>
                        <span style="color:var(--text-muted)">Tổng Chi:</span>
                        <span style="font-weight:600">${formatCurrency(inv.invested || 0)}</span>
                    </div>
                    <div>
                        <span style="color:var(--text-muted)">Mỗi tháng:</span>
                         <span style="font-weight:600">${formatCurrency(inv.monthlyTarget || 0)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();

    // Render Chart
    renderInvestmentChart();
}

let investmentChartInstance = null;

function renderInvestmentChart() {
    const ctx = document.getElementById('investment-profit-chart');
    const legendContainer = document.getElementById('investment-legend-list');

    if (!ctx || !legendContainer) return;

    // 1. Prepare Data
    // Chart Data: Only Profitable Items (Net > 0)
    const profitableInv = State.investments
        .map(inv => {
            const net = (inv.revenue || 0) - (inv.invested || 0);
            return {
                ...inv,
                net: net
            };
        })
        .filter(item => item.net > 0);

    // Legend Data: All Items
    const allInvSorted = State.investments.map(inv => {
        const net = (inv.revenue || 0) - (inv.invested || 0);
        return { ...inv, net };
    }).sort((a, b) => b.net - a.net); // Sort high to low profit

    // 2. Render Chart
    if (investmentChartInstance) {
        investmentChartInstance.destroy();
    }

    if (profitableInv.length > 0) {
        investmentChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: profitableInv.map(i => i.name),
                datasets: [{
                    data: profitableInv.map(i => i.net),
                    backgroundColor: profitableInv.map(i => i.color || '#8b5cf6'),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // We use custom legend
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                const value = context.raw;
                                const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100) + '%';
                                label += formatCurrency(value) + ' (' + percentage + ')';
                                return label;
                            }
                        }
                    }
                }
            }
        });
    } else {
        // Clear canvas if no profit
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        // Optional: Draw text "Chưa có lợi nhuận"
        const ctx2d = ctx.getContext('2d');
        ctx2d.font = "14px Inter";
        ctx2d.fillStyle = "#64748b";
        ctx2d.textAlign = "center";
        ctx2d.fillText("Chưa có danh mục nào có lời", ctx.width / 2, ctx.height / 2);
    }

    // 3. Render Legend List
    legendContainer.innerHTML = allInvSorted.map(inv => {
        const isProfit = inv.net >= 0;
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid var(--border);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 12px; height: 12px; rounded: 50%; border-radius: 50%; background-color: ${inv.color || '#ccc'}"></div>
                    <span style="font-weight: 500; font-size: 0.9rem;">${inv.name}</span>
                </div>
                <span style="font-weight: 600; font-size: 0.9rem; color: ${isProfit ? 'var(--success)' : 'var(--danger)'}">
                    ${isProfit ? '+' : ''}${formatCurrency(inv.net)}
                </span>
            </div>
        `;
    }).join('');
}

window.openInvestmentHistory = function (id, event) {
    event.stopPropagation();
    openInvestmentModal(id, 'history');
};

window.openInvestmentModal = function (id = null, viewMode = 'full') {
    document.getElementById('form-inv').reset();
    document.getElementById('form-inv-transaction').reset();
    document.getElementById('inv-id').value = '';
    document.getElementById('inv-modal-title').textContent = 'Thêm danh mục';
    document.getElementById('inv-color').value = '#8b5cf6';
    document.getElementById('inv-target').value = '';

    // Manage Tabs Visibility based on viewMode
    const modalTabs = document.querySelector('#modal-investment .modal-tabs');
    const transForm = document.getElementById('form-inv-transaction');

    if (viewMode === 'history') {
        modalTabs.classList.add('hidden');
        if (transForm) transForm.classList.add('hidden');
    } else {
        modalTabs.classList.remove('hidden');
        if (transForm) transForm.classList.remove('hidden');
    }

    const btnDel = document.getElementById('btn-delete-inv');
    if (btnDel) btnDel.classList.add('hidden'); // Hide by default

    // Hide history/transaction tab for new items or force info first
    if (viewMode === 'history') {
        switchInvestmentModalTab('inv-history');
    } else {
        // If editing existing item (id present), default to History tab
        // If creating new item (id null), default to Info tab
        if (id) {
            switchInvestmentModalTab('inv-history');
        } else {
            switchInvestmentModalTab('inv-info');
        }
    }
    document.getElementById('inv-capital-display').textContent = formatCurrency(0);
    document.getElementById('inv-revenue-display').textContent = formatCurrency(0);
    document.getElementById('inv-total-display').textContent = formatCurrency(0);
    document.getElementById('inv-history-list').innerHTML = '';

    if (id) {
        const inv = State.investments.find(x => x.id === id);
        if (inv) {
            document.getElementById('inv-id').value = inv.id;
            document.getElementById('inv-name').value = inv.name;
            document.getElementById('inv-target').value = inv.monthlyTarget || '';
            document.getElementById('inv-color').value = inv.color || '#8b5cf6';
            document.getElementById('inv-modal-title').textContent = 'Chi tiết đầu tư';

            if (btnDel) {
                btnDel.classList.remove('hidden');
                btnDel.onclick = (e) => {
                    e.preventDefault();
                    if (confirm('Xóa danh mục đầu tư này?')) {
                        State.investments = State.investments.filter(x => x.id !== id);
                        saveData('investments');
                        document.getElementById('modal-investment').classList.add('hidden');
                        renderInvestments();
                    }
                };
            }

            updateInvestmentDisplays(inv);
            renderInvestmentHistory(inv);
        }
    }
    document.getElementById('modal-investment').classList.remove('hidden');
};

function renderInvestmentHistory(inv) {
    const list = document.getElementById('inv-history-list');
    if (!inv.history || inv.history.length === 0) {
        list.innerHTML = '<p class="text-muted" style="text-align:center; padding:1rem;">Chưa có giao dịch</p>';
        return;
    }

    // Reverse sort
    const sorted = [...inv.history].sort((a, b) => new Date(b.date) - new Date(a.date) || 0);

    list.innerHTML = sorted.map(h => {
        // dOut (Chi), dIn (Thu)
        const dOut = h.out || 0;
        const dIn = h.in || 0;
        return `
            <div style="padding:0.5rem; border-bottom:1px solid var(--border); font-size:0.85rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                     <span style="color:var(--text-muted)">${new Date(h.date).toLocaleString('vi-VN')}</span>
                     ${dOut > 0 ? `<span style="color:var(--danger); font-weight:600;">- Chi: ${formatCurrency(dOut)}</span>` : ''}
                     ${dIn > 0 ? `<span style="color:var(--success); font-weight:600;">+ Thu: ${formatCurrency(dIn)}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function updateInvestmentDisplays(inv) {
    const invested = inv.invested || 0;
    const revenue = inv.revenue || 0;
    const net = revenue - invested;
    const isProfit = net >= 0;

    document.getElementById('inv-capital-display').textContent = formatCurrency(invested);
    document.getElementById('inv-revenue-display').textContent = formatCurrency(revenue);

    // Total Display (Net)
    const tEl = document.getElementById('inv-total-display');
    tEl.textContent = `${isProfit ? '+' : ''}${formatCurrency(net)}`;
    tEl.style.color = isProfit ? 'var(--success)' : 'var(--danger)';
}

function switchInvestmentModalTab(tabId) {
    document.querySelectorAll('.modal-tab').forEach(b => {
        const t = b.dataset.modalTab;
        if (!t) return;
        if (t === tabId) b.classList.add('active');
        else b.classList.remove('active');
    });
    document.querySelectorAll('.modal-tab-content').forEach(c => {
        if (!c.id) return;
        // Map inv-info -> inv-tab-info
        if (c.id === `inv-tab-${tabId.split('-')[1]}`) c.classList.remove('hidden');
        else c.classList.add('hidden');
    });
}

function handleInvestmentSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('inv-id').value;
    const name = document.getElementById('inv-name').value;
    const color = document.getElementById('inv-color').value;
    const target = parseFloat(document.getElementById('inv-target').value) || 0;

    if (id) {
        const inv = State.investments.find(x => x.id === id);
        if (inv) {
            inv.name = name;
            inv.color = color;
            inv.monthlyTarget = target;
        }
    } else {
        State.investments.push({
            id: generateId(),
            name,
            color,
            monthlyTarget: target,
            invested: 0,
            revenue: 0,
            history: []
        });
    }
    saveData('investments');
    document.getElementById('modal-investment').classList.add('hidden'); // Close on create or edit
    renderInvestments();
}

function handleInvestmentTransaction(e) {
    e.preventDefault();
    const id = document.getElementById('inv-id').value;
    if (!id) return;

    const inv = State.investments.find(x => x.id === id);
    if (!inv) return;

    const dOut = parseFloat(document.getElementById('inv-trans-out').value) || 0; // Chi
    const dIn = parseFloat(document.getElementById('inv-trans-in').value) || 0;   // Thu

    if (dOut === 0 && dIn === 0) return;

    inv.invested = (inv.invested || 0) + dOut;
    inv.revenue = (inv.revenue || 0) + dIn;

    // Record history
    if (!inv.history) inv.history = [];
    inv.history.push({
        date: new Date().toISOString(),
        out: dOut,
        in: dIn
    });

    saveData('investments');
    updateInvestmentDisplays(inv);
    renderInvestmentHistory(inv);
    document.getElementById('form-inv-transaction').reset();
    renderInvestments(); // Update background
}

function setupInvestmentListeners() {
    document.getElementById('btn-add-investment').addEventListener('click', () => openInvestmentModal());
    document.getElementById('form-inv').addEventListener('submit', handleInvestmentSubmit);
    document.getElementById('form-inv-transaction').addEventListener('submit', handleInvestmentTransaction);

    document.querySelectorAll('.modal-tab').forEach(btn => {
        if (btn.dataset.modalTab && btn.dataset.modalTab.startsWith('inv-')) {
            btn.addEventListener('click', () => switchInvestmentModalTab(btn.dataset.modalTab));
        }
    });
}

// --- Auth UI Logic ---
function updateAuthUI() {
    const btnLogin = document.getElementById('btn-login-sidebar');
    const statusArea = document.getElementById('user-status-area');

    if (AuthService.isLoggedIn && AuthService.currentUser) {
        // Logged In State
        btnLogin.innerHTML = `
            <i data-lucide="log-out"></i>
            <span>Đăng xuất</span>
        `;
        btnLogin.onclick = () => {
            if (confirm('Đăng xuất khỏi tài khoản này?')) {
                AuthService.logout();
            }
        };

        statusArea.innerHTML = `
            <div class="user-badge">
                <i data-lucide="user"></i>
                <span>${AuthService.currentUser.username}</span>
            </div>
        `;
    } else {
        // Guest State
        btnLogin.innerHTML = `
            <i data-lucide="log-in"></i>
            <span>Đăng nhập / Cloud</span>
        `;
        btnLogin.onclick = () => {
            document.getElementById('auth-modal').classList.remove('hidden');
        };

        statusArea.innerHTML = '';
    }
    if (window.lucide) lucide.createIcons();
}

function setupAuthListeners() {
    const modal = document.getElementById('auth-modal');
    const btnClose = document.getElementById('btn-auth-close');
    const btnSubmit = document.getElementById('btn-auth-submit');
    const btnSwitch = document.getElementById('btn-switch-mode');

    // Safety checks
    if (!modal || !btnClose || !btnSubmit || !btnSwitch) {
        console.error("Auth elements missing from DOM");
        return;
    }

    // Inputs
    const inputUrl = document.getElementById('auth-api-url');
    const inputUser = document.getElementById('auth-username');
    const inputPass = document.getElementById('auth-password');
    const title = document.getElementById('auth-title');
    const switchText = document.getElementById('auth-switch-text');

    let isRegisterMode = false;

    // Init URL safely
    try {
        if (inputUrl && AuthService) {
            inputUrl.value = AuthService.getApiUrl();
        }
    } catch (e) {
        console.error("Error setting API URL", e);
    }

    // Use addEventListener to prevent overwrites
    const closeModal = () => modal.classList.add('hidden');

    btnClose.addEventListener('click', closeModal);

    const btnCloseX = document.getElementById('btn-auth-close-x');
    if (btnCloseX) {
        btnCloseX.addEventListener('click', closeModal);
    }

    btnSwitch.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        if (isRegisterMode) {
            title.textContent = 'Đăng ký tài khoản';
            btnSubmit.textContent = 'Đăng ký';
            switchText.textContent = 'Đã có tài khoản?';
            btnSwitch.textContent = 'Đăng nhập ngay';
        } else {
            title.textContent = 'Đăng nhập';
            btnSubmit.textContent = 'Đăng nhập';
            switchText.textContent = 'Chưa có tài khoản?';
            btnSwitch.textContent = 'Đăng ký ngay';
        }
    });

    btnSubmit.addEventListener('click', async () => {
        const url = inputUrl.value.trim();
        const u = inputUser.value.trim();
        const p = inputPass.value.trim();

        if (!url || !u || !p) {
            alert("Vui lòng nhập đầy đủ thông tin: URL, Tài khoản, Mật khẩu!");
            return;
        }

        AuthService.setApiUrl(url);

        const originalText = btnSubmit.textContent;
        btnSubmit.textContent = 'Đang xử lý...';
        btnSubmit.disabled = true;

        try {
            let res;
            if (isRegisterMode) {
                res = await AuthService.register(u, p);
                if (res.success) {
                    alert("Đăng ký thành công! Vui lòng đăng nhập.");
                    // Switch to login
                    btnSwitch.click();
                } else {
                    alert("Lỗi đăng ký: " + (res.message || "Không xác định"));
                }
            } else {
                res = await AuthService.login(u, p);
                if (res.success) {
                    alert("Đăng nhập thành công!");
                    closeModal();
                    // Reload data from cloud
                    await init();
                } else {
                    alert("Lỗi đăng nhập: " + (res.message || "Sai thông tin hoặc lỗi backend"));
                }
            }
        } catch (err) {
            console.error("Auth Action Error", err);
            alert("Đã xảy ra lỗi khi kết nối. Vui lòng thử lại.");
        } finally {
            btnSubmit.textContent = originalText;
            btnSubmit.disabled = false;
        }
    });
}
