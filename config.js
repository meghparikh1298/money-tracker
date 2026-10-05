
  // All parameters live here. Nothing else in the code hardcodes lists or options.
const CONFIG = {
  CLIENT_ID: '1049846042399-rf5rsddh0g6t3es2cv0j2bi1hqe8j7gj.apps.googleusercontent.com',
  FILE_NAME: 'money-tracker.json',
  // drive.file = only the file this app creates; userinfo.profile = your name & photo
  SCOPE: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile',

  pageSize: 20,                                   // transactions shown on the home page
  currency: { symbol: '₹', locale: 'en-IN' },
  defaultType: 'expense',

  // Entry types. sign: +1 adds to balance, -1 subtracts. cls: colour class in style.css
  entryTypes: [
    { id: 'income',  label: 'Income',  sign: 1,  cls: 'inc' },
    { id: 'expense', label: 'Expense', sign: -1, cls: 'exp' }
  ],

  // Simple lists: key = where it is stored in the JSON, field = the field on each entry
  lists: [
    { key: 'payments', field: 'payment', label: 'Payment type', singular: 'payment type' },
    { key: 'accounts', field: 'account', label: 'Bank account', singular: 'bank account' }
  ],

  // Accordion rows on the Settings page, in order
  sections: [
    { id: 'income',   title: 'Income Category',  kind: 'categories', type: 'income' },
    { id: 'expense',  title: 'Expense Category', kind: 'categories', type: 'expense' },
    { id: 'payments', title: 'Payment Types',    kind: 'list', list: 'payments' },
    { id: 'accounts', title: 'Bank Account',     kind: 'list', list: 'accounts' }
  ],

  // Optional entry fields. Empty values are never written to the JSON.
  // whenCategory: field only appears when that category is chosen (case-insensitive)
  // suggest: offer previously used values; metaLabel: prefix shown in the transaction list
  extraFields: [
    { field: 'group', label: 'Group (trip, event…)', input: 'text', placeholder: 'e.g. Goa trip, Concert', suggest: true, metaLabel: 'Group:' },
    { field: 'maturityDate', label: 'Closing / Maturity date', input: 'date', whenCategory: 'Investment', metaLabel: 'Matures' }
  ],

  // Starting values, used only when your Drive file does not have them yet
  defaults: {
    categories: {
      income:  { 'Salary': [], 'Received from friend/family': [], 'Stocks': [], 'Dividends': [], 'Interest': [] },
      expense: { 'Food': [], 'Groceries': [], 'Entertainment': [], 'Bills': [], 'Investment': [] }
    },
    payments: ['UPI', 'Credit Card', 'Cash'],
    accounts: ['HDFC', 'BoB', 'SBI']
  }
};