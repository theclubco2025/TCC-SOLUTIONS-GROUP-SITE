/**
 * Everything about the analysis that is a business decision rather than logic:
 * the questions, the opportunity categories, the money ranges, the ROI
 * assumptions. Centralised here so changing them is one edit and not a hunt
 * through components — without becoming an admin CMS nobody asked for.
 */

/** Bump when the questions change. Stored per session so old answers stay readable. */
export const QUESTIONNAIRE_VERSION = 1

// ---------------------------------------------------------------------------
// Questionnaire
// ---------------------------------------------------------------------------

export type QuestionType = 'text' | 'textarea' | 'select' | 'multiselect'

export type Question = {
  id: string
  label: string
  help?: string
  type: QuestionType
  required?: boolean
  placeholder?: string
  options?: string[]
  maxLength?: number
  /**
   * Tap-to-fill answers for free-text questions. They only ever write into the
   * text box, which the visitor can still edit, so the stored answer stays plain
   * text and nothing about validation or the model prompt changes.
   */
  suggestions?: string[]
  /** Joins suggestions in the text box. Lists of tools read better with commas. */
  suggestionSeparator?: string
}

export type QuestionSection = {
  id: string
  title: string
  blurb?: string
  questions: Question[]
}

/**
 * Twelve questions, four required. Kept short on purpose: a business owner
 * abandons a long form, and an abandoned questionnaire tells us nothing.
 * The two open-ended ones carry most of the signal.
 */
export const QUESTIONNAIRE: QuestionSection[] = [
  {
    id: 'business',
    title: 'Your business',
    questions: [
      {
        id: 'businessName',
        label: 'Business name',
        type: 'text',
        required: true,
        maxLength: 160,
      },
      {
        id: 'industry',
        label: 'What kind of business is it?',
        type: 'select',
        required: true,
        options: [
          'Restaurant, café or bar',
          'Catering or food truck',
          'Winery, brewery or tasting room',
          'Trades and construction',
          'Professional services',
          'Retail',
          'Health, fitness or wellness',
          'Property or real estate',
          'Automotive',
          'Events or hospitality',
          'Manufacturing or distribution',
          'Something else',
        ],
      },
      {
        id: 'employees',
        label: 'Roughly how many people work there?',
        type: 'select',
        options: ['Just me', '2–5', '6–15', '16–50', '51–200', 'More than 200'],
      },
      {
        id: 'website',
        label: 'Website',
        type: 'text',
        placeholder: 'yourbusiness.com',
        maxLength: 200,
      },
    ],
  },
  {
    id: 'operations',
    title: 'How the work actually gets done',
    blurb: 'Plain answers are more useful here than tidy ones.',
    questions: [
      {
        id: 'repetitiveWork',
        label: 'What takes up the most repetitive time?',
        help: 'The thing you or your team do over and over that never feels like the actual job.',
        type: 'textarea',
        required: true,
        maxLength: 1500,
        suggestions: [
          'Answering the same customer questions',
          'Taking orders or bookings by phone',
          'Typing the same details into more than one place',
          'Chasing invoices, deposits or payments',
          'Scheduling staff, jobs or appointments',
          'Following up with enquiries',
          'Putting quotes together',
          'Keeping spreadsheets up to date',
        ],
      },
      {
        id: 'manualTransfer',
        label: 'Where does information get typed in twice, or moved by hand?',
        type: 'textarea',
        maxLength: 1500,
        suggestions: [
          'From emails into a spreadsheet',
          'From phone calls into the order system',
          'Between the till and the accounts',
          'From forms into the calendar',
          'Onto a whiteboard or printed sheet',
        ],
      },
      {
        id: 'customerFriction',
        label: 'Where do customers most often wait, or get stuck?',
        type: 'textarea',
        maxLength: 1500,
        suggestions: [
          'Waiting for a reply or a quote',
          'Booking or ordering is awkward',
          'Paying is clunky',
          'Nobody follows up after the first contact',
          'Asking the same question twice',
        ],
      },
      {
        id: 'manualTools',
        label: 'What is currently handled outside of proper software?',
        type: 'multiselect',
        options: [
          'Spreadsheets',
          'Text messages',
          'Email threads',
          'Paper or printouts',
          'A whiteboard or wall planner',
          'Phone calls and memory',
          'Nothing — it is all in software',
        ],
      },
    ],
  },
  {
    id: 'technology',
    title: 'What you already use',
    questions: [
      {
        id: 'currentSoftware',
        label: 'What software do you pay for or rely on?',
        help: 'Rough names are fine. Booking, POS, accounting, scheduling, whatever comes to mind.',
        type: 'textarea',
        maxLength: 1500,
        suggestions: [
          'Square',
          'QuickBooks',
          'Google Sheets or Excel',
          'Gmail or Outlook',
          'Mailchimp',
          'Shopify',
          'Toast',
          'Calendly',
          'Xero',
          'Jobber',
        ],
        suggestionSeparator: ', ',
      },
      {
        id: 'systemsConnected',
        label: 'Do those systems talk to each other?',
        type: 'select',
        options: [
          'Not at all — everything is separate',
          'A couple are connected, most are not',
          'Mostly connected',
          'I honestly do not know',
        ],
      },
    ],
  },
  {
    id: 'growth',
    title: 'What you want to be different',
    questions: [
      {
        id: 'improvementGoals',
        label: 'What would you most like to improve?',
        help: 'Pick as many as apply.',
        type: 'multiselect',
        options: [
          'Save time',
          'Increase sales',
          'Increase average customer value',
          'Keep customers coming back',
          'Improve the customer experience',
          'Reduce labour costs',
          'Get better visibility into the numbers',
          'Automate day-to-day operations',
        ],
      },
      {
        id: 'oneThingToEliminate',
        label: 'If you could get rid of one frustrating part of running the business tomorrow, what would it be?',
        type: 'textarea',
        required: true,
        maxLength: 1500,
        suggestions: [
          'Chasing payments',
          'Repeating myself to customers',
          'Paperwork and admin',
          'No-shows and last-minute changes',
          'Not knowing my real numbers',
          'Doing the same job twice',
        ],
      },
    ],
  },
]

export const ALL_QUESTIONS: Question[] = QUESTIONNAIRE.flatMap((s) => s.questions)

/**
 * The order the questionnaire is SHOWN in, one screen at a time. Separate from
 * QUESTIONNAIRE (which is how answers are stored, sent to the model and shown in
 * the admin) so the experience can be tuned without touching the data.
 *
 * The order is deliberate. It opens with taps, not typing — a first answer that
 * costs one click makes the second one easier. The two questions that need real
 * thought sit in the middle once there is momentum. The business name comes LAST,
 * framed as "who is this report for": asked first it feels like a form; asked last
 * it feels like the report is being made for you.
 *
 * Every question must appear here exactly once — flow.test.ts enforces it, because
 * a required question missing from the flow could never be answered.
 */
export type FlowStep = {
  id: string
  questions: string[]
  /** The heading for a step with more than one question; otherwise the question is the heading. */
  title?: string
}

export const FLOW: FlowStep[] = [
  { id: 'industry', questions: ['industry'] },
  { id: 'employees', questions: ['employees'] },
  { id: 'goals', questions: ['improvementGoals'] },
  { id: 'repetitive', questions: ['repetitiveWork'] },
  { id: 'tools', questions: ['manualTools'] },
  { id: 'transfer', questions: ['manualTransfer'] },
  { id: 'friction', questions: ['customerFriction'] },
  { id: 'software', questions: ['currentSoftware'] },
  { id: 'connected', questions: ['systemsConnected'] },
  { id: 'eliminate', questions: ['oneThingToEliminate'] },
  {
    id: 'business',
    questions: ['businessName', 'website'],
    title: 'Who is this report for?',
  },
]

export const REQUIRED_QUESTION_IDS = ALL_QUESTIONS.filter((q) => q.required).map((q) => q.id)

// ---------------------------------------------------------------------------
// ROI inputs — the optional second step
// ---------------------------------------------------------------------------

export type RoiField = {
  id: string
  label: string
  /** The label beside the box on the live calculator, where space is tight. */
  short: string
  /** Which half of the calculator it belongs to. */
  group: 'time' | 'customers'
  help?: string
  unit?: string
  min?: number
  max?: number
}

export const ROI_FIELDS: RoiField[] = [
  {
    id: 'hoursPerWeek',
    label: 'Hours per week spent on that repetitive work',
    short: 'Hours a week',
    group: 'time',
    unit: 'hours',
    min: 0,
    max: 400,
  },
  {
    id: 'peopleInvolved',
    label: 'How many people are involved in it',
    short: 'People doing it',
    group: 'time',
    min: 0,
    max: 500,
  },
  {
    id: 'hourlyValue',
    label: 'Roughly what an hour of that time costs you',
    short: 'Cost of an hour',
    group: 'time',
    help: 'Wage plus overhead is closer than wage alone.',
    unit: '$',
    min: 0,
    max: 1000,
  },
  {
    id: 'monthlyLeads',
    label: 'New enquiries or leads in a typical month',
    short: 'Enquiries a month',
    group: 'customers',
    min: 0,
    max: 100000,
  },
  {
    id: 'conversionRate',
    label: 'Roughly what percentage of those become customers',
    short: 'Become customers',
    group: 'customers',
    unit: '%',
    min: 0,
    max: 100,
  },
  {
    id: 'averageCustomerValue',
    label: 'What an average customer is worth to you',
    short: 'Worth of a customer',
    group: 'customers',
    unit: '$',
    min: 0,
    max: 1000000,
  },
]

export const ROI_FIELD_IDS = ROI_FIELDS.map((f) => f.id)

/**
 * Assumptions applied to ROI arithmetic. Every one of these is shown to the
 * reader alongside the number it produced — an unexplained figure is worse
 * than no figure.
 */
export const ROI_ASSUMPTIONS = {
  weeksPerYear: 52,
  /** Share of the identified time a system realistically recovers. */
  recoveryRate: 0.6,
  /** Illustrative conversion improvement, in percentage points. */
  conversionUpliftPoints: 2,
} as const

// ---------------------------------------------------------------------------
// Opportunity categories and money ranges
// ---------------------------------------------------------------------------

/**
 * A plain list rather than a Postgres enum, so adding a category is an edit
 * here and not a database migration.
 */
export const OPPORTUNITY_CATEGORIES = [
  'Workflow automation',
  'Lead management',
  'Customer follow-up',
  'Customer retention',
  'Scheduling',
  'Ordering',
  'Payments',
  'Internal communication',
  'Reporting',
  'Data integration',
  'CRM',
  'Marketing automation',
  'Administrative automation',
  'Document processing',
  'Customer support',
  'Inventory and process management',
  'Custom software',
  'Existing software replacement',
  'Existing software integration',
  'Process change, no software',
] as const

export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number]

export const COMPLEXITY_BANDS = ['QUICK_WIN', 'WORKFLOW', 'CUSTOM'] as const
export type ComplexityBand = (typeof COMPLEXITY_BANDS)[number]

/**
 * Planning ranges, not quotes. The model classifies the band; the application
 * assigns the money. If the model emitted prices directly, changing them here
 * later would leave old analyses contradicting new ones.
 */
export const IMPLEMENTATION_RANGES: Record<ComplexityBand, { low: number; high: number; label: string }> = {
  QUICK_WIN: { low: 500, high: 2500, label: 'Quick win' },
  WORKFLOW: { low: 2500, high: 7500, label: 'Workflow or system' },
  CUSTOM: { low: 7500, high: 15000, label: 'Custom solution' },
}

export const CONFIDENCE_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number]

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const ANALYSIS_LIMITS = {
  /** Completed analyses allowed from one IP per hour. The model call costs money. */
  completionsPerIpPerHour: 5,
  /** Started analyses allowed from one IP per hour. Cheap, but not free to store. */
  startsPerIpPerHour: 20,
  /** Proposals the report will show: a few real options, not a long list. */
  maxOpportunities: 3,
  minOpportunities: 2,
  /**
   * What the response is allowed to contain before it counts as malformed. Looser
   * than what the prompt asks for on purpose: the SDK checks these limits after
   * the call, and one proposal too many must not throw away a whole analysis.
   * Anything past maxOpportunities is dropped when saving.
   */
  acceptOpportunities: 6,
  /** A stale ANALYZING session can be retried after this many seconds. */
  retryAfterSeconds: 120,
} as const
