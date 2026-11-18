// Expenses:
const CATEGORIES = Object.freeze({
  feed: 'Feed',
  chicks: 'Chicks',
  medication: 'Medication',
  equipment: 'Equipment',
  labour: 'Labour',
  transport: 'Transport',
  other: 'Other',
});

const AMOUNT_MAX = 10000000000; 
const DESCRIPTION_MAX = 500;
const REASON_MAX = 500;

// The fields an expense accepts when it is recorded.
const FIELDS = Object.freeze(['expenseDate', 'category', 'amount', 'description', 'flockId']);

const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 31;

const SUMMARY_NOTE = 'Totals of the expenses recorded on this farm, in the currency each one was recorded in. ' +
  'Different currencies are never added together or converted. Voided expenses are not counted. ' +
  'These are expenses only: PoultryStart does not record sales or calculate profit.';

module.exports = { CATEGORIES, AMOUNT_MAX, DESCRIPTION_MAX, REASON_MAX, FIELDS, MAX_RANGE_DAYS, DEFAULT_RANGE_DAYS, SUMMARY_NOTE };
