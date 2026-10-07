/**
 * What we usually see in each kind of business: the places time leaks out,
 * and what fixes each one. Shown on the analysis intro before anyone starts,
 * and used to tailor the suggestions inside the questionnaire.
 *
 * Written as patterns, never as statistics. The site makes no numeric claims it
 * cannot source (see the Twilio compliance notes), and industries.test.ts fails
 * if a digit or a percent sign appears anywhere in here.
 *
 * Keys must match the industry options in config.ts exactly.
 */

export type Leak = { problem: string; fix: string }

export type IndustryGuide = {
  /** Three usual leaks, most common first. */
  leaks: Leak[]
  /** Tap-to-fill answers for "What takes up the most repetitive time?", shown first. */
  repetitive: string[]
}

export const GENERAL_GUIDE: IndustryGuide = {
  leaks: [
    {
      problem: 'The same details typed into more than one place',
      fix: 'Enter it once and it shows up everywhere it is needed',
    },
    {
      problem: 'Follow-ups that depend on someone remembering',
      fix: 'Follow-ups that go out on their own, on time',
    },
    {
      problem: 'Tools that do not talk to each other',
      fix: 'The tools you already pay for, connected so they work as one',
    },
  ],
  repetitive: [],
}

export const INDUSTRY_GUIDE: Record<string, IndustryGuide> = {
  'Restaurant, café or bar': {
    leaks: [
      {
        problem: 'Phone orders written on a pad, then typed into the till',
        fix: 'Orders that land in the till and the kitchen on their own',
      },
      {
        problem: 'Bookings kept in a diary or an app nobody else checks',
        fix: 'One booking list your team and your till both see',
      },
      {
        problem: 'Regulars who are never invited back',
        fix: 'A simple way to remember the people who already like you, and bring them back',
      },
    ],
    repetitive: [
      'Taking orders over the phone',
      'Managing table bookings',
      'Re-ordering stock from suppliers',
      'Writing the staff rota',
    ],
  },
  'Catering or food truck': {
    leaks: [
      {
        problem: 'Every event quote built from scratch',
        fix: 'Quotes that build themselves from your menu and the headcount',
      },
      {
        problem: 'Deposits and final payments chased by hand',
        fix: 'Payments requested and reminded automatically',
      },
      {
        problem: 'Where you will be, posted one channel at a time',
        fix: 'One schedule that updates everywhere at once',
      },
    ],
    repetitive: [
      'Writing event quotes',
      'Chasing deposits',
      'Posting where we will be',
      'Confirming final numbers with clients',
    ],
  },
  'Winery, brewery or tasting room': {
    leaks: [
      {
        problem: 'Tastings booked by phone and email',
        fix: 'Online booking that fills your calendar for you',
      },
      {
        problem: 'Club members managed in a spreadsheet',
        fix: 'A members list that handles shipments, renewals and billing',
      },
      {
        problem: 'Visitors who never hear from you again',
        fix: 'A follow-up after the visit that brings them back, or into the club',
      },
    ],
    repetitive: [
      'Booking tastings',
      'Managing club members',
      'Processing club shipments',
      'Following up after visits',
    ],
  },
  'Trades and construction': {
    leaks: [
      {
        problem: 'Quotes written on site, typed up again at night',
        fix: 'Quotes finished and sent from your phone before you leave the site',
      },
      {
        problem: 'Jobs scheduled by text and memory',
        fix: 'One job board your whole crew can see',
      },
      {
        problem: 'Invoices and deposits chased for weeks',
        fix: 'Invoices that go out when the job is done, and chase themselves',
      },
    ],
    repetitive: [
      'Writing up quotes after site visits',
      'Scheduling crews and jobs',
      'Chasing invoices and deposits',
      'Ordering materials',
    ],
  },
  'Professional services': {
    leaks: [
      {
        problem: 'New clients onboarded by email back-and-forth',
        fix: 'One intake form that collects everything once',
      },
      {
        problem: 'Time tracked in one place and billed from another',
        fix: 'Time that turns into invoices without retyping',
      },
      {
        problem: 'The same documents requested again and again',
        fix: 'A client portal where documents arrive in the right place',
      },
    ],
    repetitive: [
      'Onboarding new clients',
      'Tracking time for billing',
      'Requesting documents from clients',
      'Booking meetings',
    ],
  },
  Retail: {
    leaks: [
      {
        problem: 'Stock counted and re-ordered by hand',
        fix: 'Stock levels that update with every sale',
      },
      {
        problem: 'The shop and the website sold from separate systems',
        fix: 'One inventory for the shop floor and the website',
      },
      {
        problem: 'Customers who buy once and disappear',
        fix: 'A way to know your regulars and bring them back',
      },
    ],
    repetitive: [
      'Counting and re-ordering stock',
      'Updating products on the website',
      'Answering "do you have this in stock?"',
      'Processing returns',
    ],
  },
  'Health, fitness or wellness': {
    leaks: [
      {
        problem: 'Appointments booked by phone and text',
        fix: 'Online booking with reminders that go out on their own',
      },
      {
        problem: 'Intake forms filled in on paper at the front desk',
        fix: 'Forms completed before the client walks in',
      },
      {
        problem: 'Memberships and packages tracked by hand',
        fix: 'Packages that track themselves and prompt renewals',
      },
    ],
    repetitive: [
      'Booking appointments',
      'Chasing no-shows and cancellations',
      'Collecting intake forms',
      'Tracking memberships and packages',
    ],
  },
  'Property or real estate': {
    leaks: [
      {
        problem: 'Maintenance requests arriving by text and phone',
        fix: 'One place tenants report issues, routed to the right person',
      },
      {
        problem: 'Rent and fees chased one person at a time',
        fix: 'Payments that remind and reconcile themselves',
      },
      {
        problem: 'Enquiries from several sites in several inboxes',
        fix: 'Every enquiry in one list, answered fast',
      },
    ],
    repetitive: [
      'Handling maintenance requests',
      'Chasing rent or fees',
      'Answering property enquiries',
      'Scheduling viewings',
    ],
  },
  Automotive: {
    leaks: [
      {
        problem: 'Bookings taken by phone into a paper diary',
        fix: 'Online booking that fills your bays',
      },
      {
        problem: 'Customers calling to ask if the car is ready',
        fix: 'Status updates that go out by text on their own',
      },
      {
        problem: 'Service reminders that never get sent',
        fix: 'Reminders that bring customers back when the next service is due',
      },
    ],
    repetitive: [
      'Booking cars in',
      'Calling customers with updates',
      'Ordering parts',
      'Sending service reminders',
    ],
  },
  'Events or hospitality': {
    leaks: [
      {
        problem: 'Enquiries answered one email at a time',
        fix: 'Enquiries that get an answer and a quote straight away',
      },
      {
        problem: 'Event details spread across email, texts and spreadsheets',
        fix: 'One record per event that your whole team works from',
      },
      {
        problem: 'Suppliers and staff coordinated by phone',
        fix: 'Schedules and confirmations that go out on their own',
      },
    ],
    repetitive: [
      'Answering event enquiries',
      'Building quotes and proposals',
      'Coordinating suppliers',
      'Confirming details with clients',
    ],
  },
  'Manufacturing or distribution': {
    leaks: [
      {
        problem: 'Orders re-entered from email into the system',
        fix: 'Orders that arrive straight in your system',
      },
      {
        problem: 'Stock and production tracked in spreadsheets',
        fix: 'Live stock and production in one place',
      },
      {
        problem: 'Customers calling for order status',
        fix: 'Order status your customers can see for themselves',
      },
    ],
    repetitive: [
      'Entering orders from email',
      'Tracking stock and production',
      'Answering order status questions',
      'Preparing shipping paperwork',
    ],
  },
  'Something else': GENERAL_GUIDE,
}

export function guideFor(industry: unknown): IndustryGuide {
  return (typeof industry === 'string' && INDUSTRY_GUIDE[industry]) || GENERAL_GUIDE
}
