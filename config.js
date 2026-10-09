const INVESTMENT = 'Investment';   // the expense category treated as an investment

// All parameters live here. Nothing else in the code hardcodes lists or options.
const CONFIG = {
  CLIENT_ID: '1049846042399-rf5rsddh0g6t3es2cv0j2bi1hqe8j7gj.apps.googleusercontent.com',
  FILE_NAME: 'money-tracker.json',
  // drive.file = only the file this app creates; userinfo.profile = your name & photo
  SCOPE: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile',

  pageSize: 20,                                   // transactions shown on the home page
  currency: { symbol: '₹', locale: 'en-IN' },
  defaultType: 'expense',

  searchPageSize: 50,
  // Period shortcuts in filters. from/to = month offsets from the current month (omit both = all time)
  datePresets: [
    { label: 'This month',    from: 0,  to: 0 },
    { label: 'Last month',    from: -1, to: -1 },
    { label: 'Last 3 months', from: -2, to: 0 },
    { label: 'Last 6 months', from: -5, to: 0 },
    { label: 'All time' }
  ],
  // Options in the “build your own report” dialog (lists such as payment/account/group are added automatically)
  report: {
    charts: [
      { id: 'bar', label: 'Bars' }, { id: 'column', label: 'Columns' }, { id: 'pie', label: 'Pie' },
      { id: 'line', label: 'Line' }, { id: 'table', label: 'Table' }
    ],
    measures: [
      { id: 'sum', label: 'Total amount' }, { id: 'count', label: 'Number of transactions' }, { id: 'avg', label: 'Average amount' }
    ],
    dimensions: [
      { id: 'month', label: 'Month' }, { id: 'category', label: 'Category' },
      { id: 'subcategory', label: 'Subcategory' }, { id: 'type', label: 'Income / Expense' }
    ]
  },

  // Entry types. sign: +1 adds to balance, -1 subtracts. cls: colour class in style.css
  entryTypes: [
    { id: 'income',  label: 'Income',  sign: 1,  cls: 'inc' },
    { id: 'expense', label: 'Expense', sign: -1, cls: 'exp' }
  ],

  // Left menu (first four pages)
  nav: [
    { id: 'transactions', label: 'Transactions', href: 'index.html',       icon: '🧾' },
    { id: 'search',       label: 'Search',       href: 'search.html',       icon: '🔍' },
    { id: 'investments',  label: 'Investments',  href: 'investments.html', icon: '📈' },
    { id: 'reports',      label: 'Reports',      href: 'reports.html',     icon: '📊' },
    { id: 'settings',     label: 'Settings',     href: 'settings.html',    icon: '⚙️' }
  ],

  // Search page sort options & chart palette (presets and report options are defined above)
  sortOptions: [
    { id: 'newest', label: 'Newest first' }, { id: 'oldest', label: 'Oldest first' },
    { id: 'high', label: 'Amount: high to low' }, { id: 'low', label: 'Amount: low to high' }
  ],
  chartColors: ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#f472b6', '#22d3ee', '#fb923c'],

  // Simple lists: key = where it is stored in the JSON, field = the field on each entry
  lists: [
    { key: 'payments', field: 'payment', label: 'Payment type', singular: 'payment type' },
    { key: 'accounts', field: 'account', label: 'Bank account', singular: 'bank account' },
    // optional = may be left empty; allowAdd = “＋ Add new…” inside the entry form
    { key: 'groups', field: 'group', label: 'Group (trip, event…)', singular: 'group', optional: true, allowAdd: true, metaLabel: 'Group:' }
  ],

  // Accordion rows on the Settings page, in order
  sections: [
    { id: 'income',   title: 'Income Category',  kind: 'categories', type: 'income' },
    { id: 'expense',  title: 'Expense Category', kind: 'categories', type: 'expense' },
    { id: 'payments', title: 'Payment Types',    kind: 'list', list: 'payments' },
    { id: 'accounts', title: 'Bank Account',     kind: 'list', list: 'accounts' },
    { id: 'groups',   title: 'Groups',           kind: 'list', list: 'groups' }
  ],

  // Optional entry fields. Empty values are never written to the JSON.
  // whenCategory: field only appears when that category is chosen (case-insensitive)
  // suggest: offer previously used values; metaLabel: prefix shown in the transaction list
  extraFields: [
    { field: 'maturityDate', label: 'Closing / Maturity date', input: 'date', whenCategory: INVESTMENT, metaLabel: 'Matures' }
  ],

  // Starting values, used only when your Drive file does not have them yet
  defaults: {
    categories: {
      income:  { 'Salary': [], 'Received from friend/family': [], 'Stocks': [], 'Dividends': [], 'Interest': [] },
      expense: { 'Food': [], 'Groceries': [], 'Entertainment': [], 'Bills': [], [INVESTMENT]: [] }
    },
    payments: ['UPI', 'Credit Card', 'Cash'],
    accounts: ['HDFC', 'BoB', 'SBI']
  }
};