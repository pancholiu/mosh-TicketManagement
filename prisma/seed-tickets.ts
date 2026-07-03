import { Category, TicketStatus } from "@prisma/client"
import prisma from "../server/src/lib/db"

const firstNames = [
  "James", "Maria", "Liam", "Sophia", "Noah", "Emma", "Oliver", "Ava",
  "Elijah", "Isabella", "Lucas", "Mia", "Mason", "Charlotte", "Ethan",
  "Amelia", "Logan", "Harper", "Aiden", "Evelyn", "Jackson", "Abigail",
  "Sebastian", "Ella", "Carter", "Scarlett", "Owen", "Grace", "Wyatt", "Chloe",
]
const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
  "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
]
const domains = [
  "gmail.com", "yahoo.com", "outlook.com", "icloud.com", "hotmail.com",
  "protonmail.com", "aol.com",
]

function randomOrderNumber() {
  return 10000 + Math.floor(Math.random() * 89999)
}

function randomFrom() {
  const first = firstNames[Math.floor(Math.random() * firstNames.length)]
  const last = lastNames[Math.floor(Math.random() * lastNames.length)]
  const domain = domains[Math.floor(Math.random() * domains.length)]
  const separator = Math.random() < 0.5 ? "." : ""
  return `${first.toLowerCase()}${separator}${last.toLowerCase()}@${domain}`
}

function randomCreatedAt() {
  const now = Date.now()
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000
  return new Date(now - Math.random() * ninetyDaysMs)
}

function randomStatus(): TicketStatus {
  const roll = Math.random()
  if (roll < 0.4) return TicketStatus.OPEN
  if (roll < 0.75) return TicketStatus.RESOLVED
  return TicketStatus.CLOSED
}

type Template = { subject: (n: number) => string; body: (n: number) => string }

const generalTemplates: Template[] = [
  {
    subject: () => "Do you ship internationally?",
    body: () => "Hi, I'm based in Portugal and was wondering if you ship there, and roughly how long delivery takes. Thanks!",
  },
  {
    subject: () => "What are your business hours?",
    body: () => "Just wanted to confirm your support hours before I call in about an issue with my account.",
  },
  {
    subject: () => "How do I reset my password?",
    body: () => "I can't find the 'forgot password' link anywhere on the login page. Can you point me to it?",
  },
  {
    subject: (n) => `Can I change the shipping address on order #${n}?`,
    body: (n) => `I just placed order #${n} but used my old address by mistake. Is it too late to update it?`,
  },
  {
    subject: () => "Do you offer gift wrapping?",
    body: () => "Buying a birthday present for my sister — is gift wrapping available at checkout?",
  },
  {
    subject: () => "What payment methods do you accept?",
    body: () => "I only see credit card at checkout — do you support PayPal or bank transfer as well?",
  },
  {
    subject: () => "How long does shipping usually take?",
    body: () => "Trying to decide if I'll get this in time for a trip next week. What's your average delivery window?",
  },
  {
    subject: (n) => `Can I get a copy of the invoice for order #${n}?`,
    body: (n) => `Need the invoice for order #${n} for expense reporting at work. Could you send it over?`,
  },
  {
    subject: () => "Is there a loyalty or rewards program?",
    body: () => "I order from you pretty often and was curious if there's any kind of rewards program I should sign up for.",
  },
  {
    subject: () => "How do I unsubscribe from the newsletter?",
    body: () => "The unsubscribe link at the bottom of your emails seems to be broken — can you remove me manually?",
  },
  {
    subject: () => "Do you have a physical store I can visit?",
    body: () => "I'd love to see some items in person before buying. Is there a showroom or retail location nearby?",
  },
  {
    subject: () => "What's your return policy?",
    body: () => "Before I order, I want to understand the return window and whether return shipping is free.",
  },
  {
    subject: () => "Can I track multiple orders at once?",
    body: () => "I've placed three separate orders this month — is there a way to see all their statuses in one place?",
  },
  {
    subject: () => "How do I update the email address on my account?",
    body: () => "I switched jobs and need to change the email tied to my account before I lose access to the old one.",
  },
  {
    subject: () => "Are your products cruelty-free?",
    body: () => "Doing some research before purchasing — can you confirm whether your products are tested on animals?",
  },
]

const technicalTemplates: Template[] = [
  {
    subject: () => "App crashes when I try to upload a photo",
    body: () => "Every time I attach a photo to my profile in the mobile app, it crashes immediately. Happens on both wifi and cellular.",
  },
  {
    subject: () => "Can't log in — 'invalid credentials' error",
    body: () => "I'm positive my password is correct (just reset it yesterday) but I keep getting an invalid credentials error.",
  },
  {
    subject: () => "Checkout page is stuck loading",
    body: () => "I get all the way to payment and the page just spins forever. Tried two different browsers with the same result.",
  },
  {
    subject: () => "Two-factor authentication code never arrives",
    body: () => "I have 2FA enabled via SMS but the code hasn't shown up in over 20 minutes. I'm locked out of my account.",
  },
  {
    subject: () => "Mobile app won't sync with my desktop account",
    body: () => "Changes I make on the website don't show up in the app, and vice versa. Logged out and back in with no luck.",
  },
  {
    subject: () => "Getting a 500 error on the contact form",
    body: () => "Tried submitting the contact form three times today and get a server error every time.",
  },
  {
    subject: () => "Dark mode toggle isn't working",
    body: () => "I switch the dark mode setting on but the interface stays light until I refresh, then it reverts back.",
  },
  {
    subject: () => "Push notifications stopped after the last update",
    body: () => "I used to get order updates as push notifications, but nothing since updating the app last week.",
  },
  {
    subject: (n) => `PDF receipt for order #${n} won't download`,
    body: (n) => `Clicking 'download receipt' for order #${n} just opens a blank tab instead of downloading the PDF.`,
  },
  {
    subject: () => "Search bar returns no results for anything",
    body: () => "I've tried searching for products I know you carry and it always says 'no results found.'",
  },
  {
    subject: () => "Video won't play on the product page",
    body: () => "The demo video on the product page just shows a spinning loader indefinitely, on both Chrome and Safari.",
  },
  {
    subject: () => "Account settings page shows a blank screen",
    body: () => "Whenever I click into Account Settings, the whole page goes white. Console shows a JavaScript error.",
  },
  {
    subject: () => "API integration returns 401 even with a valid key",
    body: () => "Our integration started failing with 401 Unauthorized this morning despite the API key not being rotated.",
  },
  {
    subject: () => "Can't upload files larger than 5MB",
    body: () => "I need to upload a 12MB design file but the uploader silently fails with no error message.",
  },
  {
    subject: () => "Password reset email never arrives",
    body: () => "Requested a password reset four times now, checked spam, still nothing. Using the same email as my account.",
  },
]

const refundTemplates: Template[] = [
  {
    subject: (n) => `Item from order #${n} arrived damaged, requesting refund`,
    body: (n) => `The package for order #${n} arrived with the box crushed and the item inside cracked. I'd like a full refund.`,
  },
  {
    subject: (n) => `Wrong item shipped for order #${n}`,
    body: (n) => `I ordered a medium in blue but received a small in red for order #${n}. Please refund or send the correct item.`,
  },
  {
    subject: (n) => `Order #${n} never arrived, please refund`,
    body: (n) => `Tracking says order #${n} was delivered a week ago but I never received it. Requesting a refund.`,
  },
  {
    subject: () => "Product doesn't match the description",
    body: () => "The material feels completely different from what was described on the listing. I'd like to return it for a refund.",
  },
  {
    subject: (n) => `Charged twice for order #${n}`,
    body: (n) => `My statement shows two identical charges for order #${n}. Please refund the duplicate.`,
  },
  {
    subject: () => "Want to cancel my subscription and get a refund",
    body: () => "I was charged for this month's subscription but meant to cancel before the renewal date. Requesting a refund.",
  },
  {
    subject: (n) => `Received wrong size for order #${n}, want a refund instead of exchange`,
    body: (n) => `Rather than exchange, I'd prefer a refund for order #${n} since the style didn't work out for me.`,
  },
  {
    subject: (n) => `Defective product from order #${n}`,
    body: (n) => `The item from order #${n} stopped working after two days of normal use. Requesting a full refund.`,
  },
  {
    subject: (n) => `Refund never processed for returned order #${n}`,
    body: (n) => `I returned order #${n} three weeks ago and tracking confirms it was received, but I still haven't seen a refund.`,
  },
  {
    subject: (n) => `Accidentally ordered wrong item — order #${n}`,
    body: (n) => `I meant to order a different color and didn't catch the mistake until after checkout. Can order #${n} be refunded?`,
  },
  {
    subject: () => "Subscription renewed without consent, want refund",
    body: () => "I thought I had cancelled last month but was charged again. Please refund this renewal and confirm cancellation.",
  },
  {
    subject: (n) => `Item missing from order #${n}`,
    body: (n) => `Order #${n} arrived with one of the three items missing from the box. Requesting a refund for the missing item.`,
  },
  {
    subject: () => "Quality doesn't match what was advertised",
    body: () => "The finish on this item looks nothing like the product photos. I'd like to return it for a refund.",
  },
  {
    subject: () => "Duplicate charge on my card statement",
    body: () => "I see the same amount charged twice on my card for what should have been a single order. Please investigate and refund.",
  },
  {
    subject: (n) => `Refund status for order #${n}?`,
    body: (n) => `Following up — I was told my refund for order #${n} would post within 5-7 business days, but it's been two weeks.`,
  },
]

const uncategorizedTemplates: Template[] = [
  {
    subject: (n) => `Question about order #${n}`,
    body: (n) => `Hey, I had a quick question about order #${n} — not sure who to route this to.`,
  },
  { subject: () => "Need help", body: () => "Having some trouble with my account, can someone reach out?" },
  {
    subject: (n) => `Issue with recent purchase #${n}`,
    body: (n) => `Something's not right with order #${n}, can someone take a look?`,
  },
  { subject: () => "Quick question", body: () => "Just had a quick one — is someone available to help?" },
  {
    subject: () => "Following up on my earlier email",
    body: () => "Haven't heard back in a few days, just wanted to bump this to the top of the queue.",
  },
  {
    subject: (n) => `Order #${n} issue`,
    body: (n) => `Ran into a problem with order #${n}, details to follow once someone picks this up.`,
  },
  { subject: () => "Please help", body: () => "Not sure how to categorize this but I really need some assistance." },
  {
    subject: () => "Regarding my ticket from last week",
    body: () => "Wanted to check in on the status of the issue I reported previously.",
  },
  { subject: () => "Urgent — need a response", body: () => "This is time-sensitive, would appreciate a quick reply." },
  {
    subject: () => "Re: your reply",
    body: () => "Thanks for getting back to me, following up with one more detail.",
  },
]

type Pool = { category: Category | null; templates: Template[] }

const pools: Pool[] = [
  { category: Category.GENERAL_QUESTION, templates: generalTemplates },
  { category: Category.TECHNICAL_QUESTION, templates: technicalTemplates },
  { category: Category.REFUND_REQUEST, templates: refundTemplates },
  { category: null, templates: uncategorizedTemplates },
]

const TICKET_COUNT = 100
const tickets = Array.from({ length: TICKET_COUNT }).map(() => {
  const pool = pools[Math.floor(Math.random() * pools.length)]
  const template = pool.templates[Math.floor(Math.random() * pool.templates.length)]
  const orderNumber = randomOrderNumber()

  return {
    subject: template.subject(orderNumber),
    body: template.body(orderNumber),
    from: randomFrom(),
    status: randomStatus(),
    category: pool.category,
    createdAt: randomCreatedAt(),
  }
})

await prisma.ticket.createMany({ data: tickets })
console.log(`Created ${tickets.length} tickets.`)
process.exit(0)
