export const LEGAL_VERSION = "2026-09-27.1";
export const PRIVACY_VERSION = "2026-10-01.1";
export const OPERATOR = {
  name: "Flushing NY Wireless",
  address: "136-78 Roosevelt Ave, Flushing, NY, United States",
  email: "ezrefillyny@gmail.com",
};
export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};
export type LegalDocument = {
  title: string;
  description: string;
  sections: LegalSection[];
};
export const legalDocuments: Record<string, LegalDocument> = {
  terms: {
    title: "Terms of service",
    description:
      "The agreement for using Curbside, operated by Flushing NY Wireless.",
    sections: [
      {
        title: "1. Who we are and how you agree",
        paragraphs: [
          "Curbside is a service of Flushing NY Wireless, at the address shown below. These terms govern Curbside accounts and services. You agree by selecting Clerk’s legal consent checkbox and completing sign-up. Merely opening this page does not record your agreement. Keep a copy of the version you accept.",
          "You must be at least 18 and able to enter a contract. If acting for a business, you must be authorized to bind it. Our Privacy Policy explains how information is handled; separate Messaging Terms apply only if you opt in to SMS.",
        ],
      },
      {
        title: "2. What Curbside does",
        paragraphs: [
          "Curbside searches NYC public parking and camera violation datasets, organizes available records, and, when activated, checks saved vehicles for newly available records. It does not cover all traffic matters, police-issued moving violations, or every record held by the city. Curbside is independent of NYC, its Department of Finance, and How’s My Driving.",
          "City publication and location enrichment may be delayed. A clean search is not a certificate that you owe nothing. A record disappearing does not establish payment or dismissal. A plate may have belonged to someone else, and a plate search does not identify the current owner. Always verify amounts, deadlines, and case status through official NYC channels.",
        ],
      },
      {
        title: "3. Accounts and acceptable use",
        paragraphs: [
          "Keep your account secure and provide accurate contact information. Save vehicles only if you own them or are authorized to manage them. Do not use Curbside to stalk, harass, identify private individuals, resell personal data, make employment, credit, housing or insurance eligibility decisions, circumvent limits, or interfere with the service.",
          "Do not upload forged evidence, malicious files, unnecessary identity documents, or another person’s private information without authority. We may restrict abusive or compromised accounts proportionately, with notice when practical. You may contact us to contest a restriction.",
        ],
      },
      {
        title: "4. Alerts and your responsibilities",
        paragraphs: [
          "Monitoring begins with an initial successful scan. Existing records are summarized separately from later discoveries. Notifications report discovery in the data, not the moment a ticket was issued. Delivery depends on source availability, your preferences, provider availability, and applicable limits. Quiet hours ordinarily run from 9 p.m. to 8 a.m. in your selected timezone.",
          "You remain responsible for payment, hearings, and official deadlines. A reminder, a saved draft, or a customer-entered paid or submitted label does not change city records or extend a deadline. Camera deadlines may require a Notice of Liability date that is not present in the dataset.",
        ],
      },
      {
        title: "5. Purchases and cancellation",
        paragraphs: [
          "Curbside is free during this release. New subscriptions, purchases, and dealer activation fees are disabled. Service availability and usage limits still apply. Any future paid offer will require separate price disclosure and affirmative consent before a charge.",
          "Cancel future renewal in Account → Manage billing, or contact the support email below if access fails. We do not require a retention call or a reason. Cancellation takes effect for the next renewal unless you request immediate closure. Deleting local browser data does not cancel a subscription. Mandatory refund and cancellation rights remain available regardless of these terms.",
        ],
      },
      {
        title: "6. AI preparation and representation",
        paragraphs: [
          "AI preparation is writing assistance, not legal advice or an attorney-client relationship. It can make mistakes. You must confirm the facts, review the exact draft, and decide whether to submit it. Uploaded filenames are listed for organization; the current drafting feature does not analyze the contents of your uploaded documents or photographs.",
          "No outcome or probability of success is promised. You retain control of submission. Partner filing is unavailable until an eligible partner has been onboarded. If offered, a separate partner agreement, disclosed fees, and required authorization apply. Partner acceptance is not filing; only an official receipt establishes submission. Curbside cannot extend a deadline while a partner considers a case.",
        ],
      },
      {
        title: "7. Your content and service changes",
        paragraphs: [
          "You retain rights to your evidence and statements. You give us only the permission needed to store, process, display, and transmit that content to provide the features you request, including an expressly assigned partner or a requested AI draft. This is not a license to sell your evidence or use it for advertising.",
          "We may fix, suspend, or change features. Material changes to paid plans will be disclosed as required before taking effect. Changes requiring consent will not take effect for you without that consent. Updated contract terms will have a new version and will be presented for acceptance when appropriate; they are not applied retroactively to an existing dispute.",
        ],
      },
      {
        title: "8. Service limitations and consumer rights",
        paragraphs: [
          "We take reasonable care in operating the service, but cannot promise that public data is complete, that every alert arrives, or that the service is uninterrupted. To the extent permitted by law, the service is provided as available without additional implied warranties. Nothing in these terms excludes liability that cannot lawfully be excluded, including fraud, willful misconduct, gross negligence, or mandatory consumer remedies.",
          "We do not impose mandatory arbitration, a class-action waiver, or a waiver of access to small-claims court. New York law governs this agreement except where mandatory law in your jurisdiction provides otherwise. Courts with lawful jurisdiction remain available. If one provision cannot be enforced, the remaining provisions continue to the extent legally permissible.",
        ],
      },
      {
        title: "9. Questions or disputes",
        paragraphs: [
          "Contact Flushing NY Wireless using the details below for service complaints, billing disputes, privacy requests, or accessibility assistance. Include only the information needed to locate your account; do not email passwords, full card numbers, or sensitive evidence. Contacting us does not suspend any legal filing deadline or require you to give up a legal remedy.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    description:
      "What we collect, why we use it, and the choices available to you.",
    sections: [
      {
        title: "Information we process",
        paragraphs: [
          "Flushing NY Wireless operates Curbside. When you search, we process the plate, registration state, optional plate type, search time, and returned public NYC records. A network address is processed for security and rate limiting. Search results may contain summons numbers, dates, locations, vehicle attributes, and financial/status fields reported by the city.",
          "If you create an account, Clerk processes your sign-in details and legal agreement. Curbside processes your verified email, authentication identifier, settings, saved vehicles, and recorded terms acceptance. This release does not offer SMS enrollment, payments, evidence uploads, AI drafting, dealer sponsorships, or partner filing.",
        ],
      },
      {
        title: "How information is used",
        paragraphs: [
          "We use this information to answer searches, refresh saved vehicle histories, save your display preferences, respond to support, prevent abuse, and maintain service security. We do not sell vehicle data or display behavioral ads. Vercel Web Analytics measures public page visits without tracking cookies. Our filter excludes authentication and private account, garage and ticket views, strips plates, emails, ticket details and unapproved query parameters, and does not send custom events.",
          "Public violation history does not prove that a ticket belongs to you. We do not obtain driver identity from DMV records or use violation data to make consumer eligibility decisions.",
        ],
      },
      {
        title: "Service providers and sharing",
        paragraphs: [
          "Vercel hosts the website. Clerk handles authentication, email verification, account security, and built-in legal consent. Supabase stores private saved-car details, profile settings, historical terms acceptance, and shared snapshots of public NYC violation history. Saving a car starts daily history refreshes. Car nicknames and user-entered details remain private to each customer, even when multiple customers save the same plate. Mapbox provides configured maps; NYC Open Data receives plate queries and location providers receive address/intersection queries.",
          "AI preparation, evidence uploads, payment processing, and message delivery integrations are disabled in this release.",
          "We may disclose information when required by lawful process or reasonably necessary to protect rights or security. We will not use an ownership change to silently apply materially different privacy practices to previously collected information.",
        ],
      },
      {
        title: "Cookies, local storage, and signals",
        paragraphs: [
          "The application caches fonts, app icons, an offline page, and public map geometry for performance. An essential welcome cookie remembers completion of onboarding for this browser for up to one year, renewed on visits; clearing cookies lets the welcome appear again. Browser storage remembers the installation guide and guest display preferences. Verified profile settings are also stored in Supabase, with a separate local cache for each account. Clerk uses essential cookies and browser storage to manage authentication. Signing out ends the active Clerk session. Saved city histories are stored on the server, not made available offline. The app does not request precise device GPS location or use advertising cookies.",
          "We do not operate cross-site advertising tracking, sell information, or share it for cross-context behavioral advertising. Vercel Web Analytics uses cookie-free visit measurement; our filter suppresses measurement when Global Privacy Control or Do Not Track is enabled. When configured, hCaptcha or Turnstile processes device and interaction information needed to detect automated abuse under its privacy policy. Essential authentication and abuse prevention still operate. External sites and provider-hosted pages have their own practices.",
        ],
      },
      {
        title: "Retention and deletion",
        paragraphs: [
          "Temporary search/source caches generally last six hours for open-ticket results, one day for the current fiscal year, seven days for older history, and up to 90 days for supported permanent geocoding. Saved vehicles share a public-city history snapshot by plate, registration state, and optional plate type. A morning scheduler starts at 13:00 UTC (8 a.m. or 9 a.m. in New York, depending on daylight saving time), processing up to 500 distinct saved identities in bounded batches. Full historical enrichment is normally rechecked weekly. Failed checks keep the last usable history and show its earlier check time; records missing from a later response are not treated as paid or dismissed. A snapshot is removed when its last saved subscription is removed. Hosting logs and provider backups follow their own retention periods.",
          "Saved cars, preferences, and historical consent records remain until removed through account deletion or an appropriate support request. Account deletion removes the Clerk identity and its Curbside account records; signed webhook delivery retries application cleanup if it fails. Shared public-city snapshots remain while another customer has saved the same vehicle identity. Deletion does not erase public city records, provider logs, or independently retained backups. Legacy authentication records retained for migration rollback require separate administrator cleanup. Contact us for a coordinated deletion or access request. We will explain any specific retention exception.",
        ],
      },
      {
        title: "Your choices and requests",
        paragraphs: [
          "You can correct vehicle details and preferences, remove saved cars, and manage your sign-in details through Clerk. To request access, correction, a portable copy, deletion, or assistance exercising an applicable privacy right, email us below. We may verify your authority without requiring unnecessary identification. An authorized agent may contact us with proof of authorization. We will respond within the period required by applicable law and explain a denial and available review options.",
          "State privacy rights and exemptions depend on location and whether statutory thresholds apply to this business. This notice does not claim every comprehensive state privacy law applies. We do not discriminate against users for exercising an applicable privacy right.",
        ],
      },
      {
        title: "Security, age limits, and updates",
        paragraphs: [
          "Clerk session verification, account-scoped server queries, signed deletion webhooks, and rate limits help protect information. No system can guarantee absolute security. The operator must also maintain administrative safeguards, provider oversight, incident response, and legally required breach notifications.",
          "Curbside accounts and paid services are intended for adults 18 and older and are not directed to children. If you believe a child provided personal information, contact us for removal. This policy’s version and date appear above; material changes will be communicated before applying new practices where required.",
        ],
      },
    ],
  },
  messaging: {
    title: "Messaging terms",
    description: "Separate, optional consent for useful service alerts.",
    sections: [
      {
        title: "Optional Curbside SMS alerts",
        paragraphs: [
          "Curbside, operated by Flushing NY Wireless, sends automated service messages only after you opt in and verify a US phone number you control. Messages concern verification, newly discovered tickets, supported action-date reminders, and service assistance. Consent is not a condition of purchase. SMS consent does not enroll you in marketing or give a dealership permission to message you.",
        ],
      },
      {
        title: "Frequency, costs, and delivery",
        paragraphs: [
          "Frequency varies with your vehicles and city records. Eligible plans include up to 10 outbound alert SMS segments per month. A long message can use multiple segments. Email remains available when the allowance is exhausted. There are no automatic overage purchases. Your carrier may charge message and data rates. Verification messages and required opt-out confirmations may be separate from the plan’s alert allowance.",
          "Delivery is not guaranteed. Quiet hours ordinarily defer alerts from 9 p.m. to 8 a.m. in your chosen timezone. A delayed message does not change an official deadline. Wireless carriers are not responsible for delayed or undelivered messages.",
        ],
      },
      {
        title: "Stop or get help",
        paragraphs: [
          "Reply STOP to stop SMS, or use Account → SMS alerts → Stop SMS alerts. We also honor other clear, reasonable revocation requests through support. A non-promotional confirmation may be sent. Reply HELP for help, or email the contact below. To resume after opting out, use the account verification and consent process again; a dealership cannot opt you back in.",
          "Tell us if you change or give up your number. Email alerts have a separate unsubscribe link and account preference. Stopping SMS does not cancel a paid subscription; billing cancellation is available in Account → Manage billing.",
        ],
      },
      {
        title: "Consent records and privacy",
        paragraphs: [
          "We record the verified opt-in, policy version, time, account, and subsequent changes to support your choices. Phone information is used for verification and requested service delivery through our providers. It is not sold or shared with dealers for marketing. See the Privacy Policy for the complete data practices and request process.",
        ],
      },
    ],
  },
  billing: {
    title: "Billing & cancellation",
    description: "Free access now, with help for any existing billing.",
    sections: [
      {
        title: "Free access",
        paragraphs: [
          "Curbside is free during this release. There are no new subscriptions, dealer activation fees, or purchases. Configured account and notification services remain subject to verification, availability, and usage limits. NYC ticket fines are separate and remain payable to NYC.",
        ],
      },
      {
        title: "Cancel without a call",
        paragraphs: [
          "When subscriptions open, use Account → Manage billing to cancel future renewal online. Cancel before the next billing date shown in your billing portal. If the portal fails, email us with your account email and cancellation request; do not send card information. Cancellation does not require accepting another offer.",
          "Service normally remains available through the paid period. Deleting browser data or stopping messages is not cancellation. Account-data deletion must first stop any future renewal. Dealer sponsorship ends at its stated expiry without automatically charging the sponsored customer; the customer returns to Free unless they separately purchase a plan.",
        ],
      },
      {
        title: "Refunds and billing problems",
        paragraphs: [
          "Request a refund through support for a duplicate or unauthorized charge or a paid feature that was not delivered. Unused AI preparation can be refunded on request; if generation fails, contact support for a replacement or refund before purchasing again. Canceling a subscription ordinarily stops the next charge rather than refunding elapsed service, except where law or the checkout offer provides otherwise.",
          "These terms do not limit mandatory cancellation, refund, dispute, or chargeback rights. Ticket fines are paid directly to NYC, not to Curbside. A partner, if enabled, separately discloses and bills its filing fee. Curbside does not guarantee dismissal or refund city fines.",
        ],
      },
      {
        title: "Renewal notices and changes",
        paragraphs: [
          "Annual renewals require an advance notice with cancellation instructions. We will provide legally required notices of material changes and obtain required consent to changed charges. No automatic price increase or new SMS charge is authorized by silence. Keep your email current so billing notices can reach you.",
        ],
      },
    ],
  },
  accessibility: {
    title: "Accessibility",
    description: "A useful experience should work with the way you navigate.",
    sections: [
      {
        title: "Features built into Curbside",
        paragraphs: [
          "Curbside supports keyboard navigation, visible focus indicators, labeled controls, screen-reader-friendly form fields, custom keyboard-operated dropdowns, and a reduced-motion mode based on your device preference. Ticket details remain available in a list even when a location cannot be placed on a map. The interface adapts to narrow screens and text zoom.",
        ],
      },
      {
        title: "Our ongoing work",
        paragraphs: [
          "We use WCAG 2.2 Level AA as a development target. This is a target, not a certification or a claim that every page and third-party checkout, authentication, or map surface has passed a full accessibility audit. Automated and manual review are part of ongoing improvement.",
        ],
      },
      {
        title: "Request assistance",
        paragraphs: [
          "Email us below with the page URL, the task you were trying to complete, and, if comfortable, the assistive technology or browser involved. Do not include sensitive ticket evidence in the email. We will work with you to provide an accessible alternative and address the issue. An accessibility support request does not pause a city payment or dispute deadline.",
        ],
      },
    ],
  },
  sources: {
    title: "Data & dispute disclosures",
    description:
      "Public records, honest uncertainty, and the boundary between preparation and filing.",
    sections: [
      {
        title: "City data and maps",
        paragraphs: [
          "The app queries NYC Open Data directly: Open Parking and Camera Violations (nc67-uf89) plus fiscal-year Parking Violations Issued datasets for historical detail and locations. Queries are limited to requested plates. Source failures and truncation are displayed. Deduplication uses the summons number and retains field provenance.",
          "The background uses NYC Department of City Planning borough boundaries (gthc-hcne) and a selected subset of NYC street geometry (inkn-q76z). The decorative background is our own locally hosted rendering; it does not use Mapbox tiles or screenshots. The interactive Map view and static ticket-location previews use Mapbox when configured. Geocoding uses NYC Geoclient, NYC Planning GeoSearch, or temporary Mapbox address lookup. Temporary Mapbox results remain in page memory only. Missing locations remain unpinned. A map position may represent an address, intersection, or approximate location as labeled.",
        ],
      },
      {
        title: "Independence and appropriate use",
        paragraphs: [
          "Curbside is not a government agency, payment processor for city fines, law firm, or an affiliate of How’s My Driving. Public records can be incomplete, inaccurate, delayed, or associated with a previous plate holder. Do not use them to infer current ownership, identity, guilt, or a person’s eligibility for employment, credit, insurance, or housing.",
        ],
      },
      {
        title: "Preparing a dispute",
        paragraphs: [
          "A checklist or AI draft is not a finding that a defense applies. Review the ticket, your evidence, and current official guidance. Never submit facts you cannot confirm. Curbside does not read uploaded image/PDF contents in its current AI workflow. You choose whether to self-submit to NYC.",
          "A draft approval applies only to that draft and evidence version. Editing either invalidates approval. A partner must be eligible to act and obtain the authorization required for your case. Handoff, acceptance, and filed are separate states. An official filing receipt is required before a case is marked filed. Do not wait for a partner response if doing so would miss your deadline.",
        ],
      },
    ],
  },
};
export const LEGAL_SOURCES = [
  [
    "NY General Business Law § 527-a — automatic renewal",
    "https://www.nysenate.gov/legislation/laws/GBS/527-A",
  ],
  [
    "FTC — ROSCA disclosure, consent, and cancellation",
    "https://www.ftc.gov/business-guidance/blog/2018/07/time-rosca-recap-ftc-says-risk-free-trial-was-risky-not-free",
  ],
  [
    "FTC — CAN-SPAM business guidance",
    "https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business",
  ],
  [
    "FCC — consent revocation order",
    "https://docs.fcc.gov/public/attachments/FCC-24-24A1.pdf",
  ],
  [
    "NY Attorney General — SHIELD Act",
    "https://ag.ny.gov/resources/organizations/data-breach-reporting/shield-act",
  ],
  [
    "NYC Finance — representative and broker rules",
    "https://www.nyc.gov/assets/finance/downloads/pdf/18pdf/39-09.pdf",
  ],
  [
    "US Department of Justice — web accessibility guidance",
    "https://www.ada.gov/resources/web-guidance/",
  ],
  [
    "California Attorney General — online privacy disclosures",
    "https://oag.ca.gov/sites/all/files/agweb/pdfs/cybersecurity/making_your_privacy_practices_public.pdf",
  ],
];
