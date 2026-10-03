// Historical database consent version: never rewrite existing acceptance records.
export const LEGAL_VERSION = "2026-09-27.1";
export const PRIVACY_VERSION = "2026-10-03.1";
export const LEGAL_DISPLAY_REVISION = "2026-10-03.1";
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
      "The terms for using TicketSafe, operated by Flushing NY Wireless.",
    sections: [
      {
        title: "1. The service and your agreement",
        paragraphs: [
          "TicketSafe is operated by Flushing NY Wireless at the address below. It lets you search public NYC parking and camera violation records, view available ticket locations, save cars and city-record histories, and choose display preferences.",
          "You must be at least 18 and authorized to use the account and vehicles you save. Before saving cars, verify your email and use TicketSafe’s agreement checkbox to confirm that you meet the age requirement and accept the Terms of Service and Privacy Policy. Your acceptance is recorded with its version and time. Opening a policy page does not record agreement.",
        ],
      },
      {
        title: "2. Public records and your responsibilities",
        paragraphs: [
          "TicketSafe is independent of the City of New York and its Department of Finance. Public data can be incomplete, delayed, incorrect, or associated with an earlier plate holder. A search with no results does not prove that no fine is owed. A record disappearing does not prove payment or dismissal.",
          "Verify ticket status, amounts and deadlines through official NYC channels. Map positions may be approximate and some records have no usable location. You remain responsible for official deadlines and decisions based on the records.",
        ],
      },
      {
        title: "3. Accounts and acceptable use",
        paragraphs: [
          "Keep your sign-in details secure and your contact information accurate. Save cars only when you own them or have permission to manage them. You can change your email, request password recovery, sign out, and edit or remove saved cars through TicketSafe’s account controls.",
          "Do not use the service to stalk, harass, identify private individuals, resell personal information, make employment, credit, housing or insurance eligibility decisions, bypass limits, or disrupt the service. We may restrict abusive or compromised accounts and provide notice when practical. Contact us to contest a restriction.",
        ],
      },
      {
        title: "4. Saved history and service changes",
        paragraphs: [
          "If you opt in to email notifications in Account, TicketSafe checks only your saved vehicles and sends a daily email when new tickets are found after a complete baseline check. Balance changes alone do not trigger emails. Messages include saved-vehicle and ticket details, reported balances, available approximate location maps, and links to official NYC payment services. Public records and email delivery can be delayed; alerts are not a guarantee of timely notice or a substitute for checking official deadlines. SMS notifications are unavailable.",
          "Saving a car stores its private details and connects it to a shared history of public city records for that plate, registration state and plate type. History refreshes depend on city data and service availability. Failed checks retain the last usable results and show an earlier check time.",
          "We may fix or change the service and will explain material changes when required. Changes requiring your agreement will be presented before applying to you. Earlier acceptance records keep their original dates; updating this page does not record new consent or retroactively replace an earlier agreement.",
        ],
      },
      {
        title: "5. Service limitations and your rights",
        paragraphs: [
          "We take reasonable care in operating TicketSafe but cannot guarantee complete public data, exact map positions or uninterrupted availability. To the extent permitted by law, the service is provided as available. Nothing in these terms excludes liability or consumer rights that cannot lawfully be excluded.",
          "These terms do not require arbitration or waive access to courts or small-claims court. New York law applies except where mandatory law in your jurisdiction provides otherwise. If a provision cannot be enforced, the remaining provisions continue to the extent permitted by law.",
        ],
      },
      {
        title: "6. Contact",
        paragraphs: [
          "Contact the operator below for service questions, privacy requests or accessibility assistance. Share only what is needed to locate your account or understand the problem. Do not email passwords or unnecessary personal information. Contacting us does not change a city deadline.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    description: "The information TicketSafe uses and the choices you have.",
    sections: [
      {
        title: "Information we process",
        paragraphs: [
          "Flushing NY Wireless operates TicketSafe. A search processes the plate, registration state, optional plate type, search time and returned public NYC records. Results can include summons numbers, dates, locations, vehicle attributes, amounts and status fields. Network and device information may be processed for hosting, security and abuse prevention.",
          "For accounts, Supabase processes sign-in details, email verification and authentication sessions. TicketSafe processes your verified email, authentication identifier, saved car details, display preferences and recorded terms acceptance. Support requests include the information you choose to send.",
        ],
      },
      {
        title: "How we use information",
        paragraphs: [
          "We use information to answer searches, show available locations, retain and refresh saved city histories, save preferences, manage accounts, respond to support, prevent abuse and maintain security. We do not sell vehicle information or display behavioral advertising. Public records are not proof of current ownership, identity or a person’s eligibility for a service.",
        ],
      },
      {
        title: "Providers and sharing",
        paragraphs: [
          "Resend delivers account emails and opted-in new-ticket notifications. For ticket alerts it receives the verified recipient email, saved-vehicle and ticket details, reported balances, available location maps, and a signed unsubscribe link. Location maps are attached to the email and do not require remote map-image loading. Clicking a payment link opens NYC CityPay; TicketSafe does not collect payment details or take payments.",
          "Mapbox generates attached ticket-location maps from ticket coordinates and numbered pins. These map requests do not include your email address, license plate, car nickname or summons number. Maps are prepared on the server; opening the email does not send a map request from your mailbox to Mapbox. If a map cannot be generated, the alert still includes the available location text.",
          "Vercel hosts TicketSafe. Supabase provides authentication and stores private car details, preferences, historical consent records and shared public-city snapshots. Account confirmation and password recovery emails use the configured email delivery service. NYC Open Data receives plate queries. When maps or location lookup are used, Mapbox and the configured NYC location services process map requests or address and intersection queries. Car nicknames and other user-entered details are private to the account that saved them.",
          "Authorized TicketSafe administrators can access account contact information, saved vehicles and notification choices to provide support. The CRM stores support notes, tags, access roles and email delivery records. Operational online counts use a signed-in account's most recent active timestamp, not a guest browsing history. Stale presence entries are removed during subsequent presence updates. Notes and announcement preferences are removed with the related account; audit and campaign records older than 90 days are removed during subsequent administrator activity. Unresolved deliveries remain available for review until this cleanup. Access and sending changes are recorded for accountability.",
          "When hCaptcha is shown, it processes device and interaction information to detect automated abuse under the applicable provider terms. Providers may process information in the United States or other locations where they operate. Their own policies explain their processing and retention. We may disclose information when required by law or reasonably necessary to protect rights and security.",
        ],
      },
      {
        title: "Analytics and privacy signals",
        paragraphs: [
          "Optional Vercel Web Analytics loads only after you allow Analytics in our cookie choices. It counts public search, map and legal page visits without tracking cookies, using a request-derived visitor hash discarded after 24 hours. It may process page URLs, referrers, general location, browser and device information. Our filter excludes authentication and private account, garage and ticket views, removes plates, emails, ticket details and unapproved query parameters from measured URLs, and rejects custom events.",
          "Optional Vercel Speed Insights measures page performance, such as loading speed and responsiveness, after the same Analytics choice. We sample 10% of eligible events, remove unapproved URL parameters, and exclude authentication, private account, garage and CRM pages. Global Privacy Control, Do Not Track and withdrawing Analytics consent also stop future performance events.",
          "Analytics is off before a choice and when you choose Necessary only. Global Privacy Control and Do Not Track also keep analytics off, even after Accept all. We do not sell or share personal information for cross-context behavioral advertising. Essential authentication, hosting and abuse prevention still operate when these privacy signals are enabled.",
        ],
      },
      {
        title: "Cookies and local storage",
        paragraphs: [
          "A signed, secure, HTTP-only search-verification cookie can last up to five minutes. It is bound to network and browser information and permits a limited number of searches; server-side limits still apply to every request. The service-only security ledger stores keyed hashes and short-lived nonces rather than raw IP addresses or account information.",
          "Supabase stores the authentication session in browser storage so you can remain signed in. A welcome cookie remembers completed onboarding for up to one year and is renewed on visits. Browser storage also keeps guest display preferences, account-specific preference caches and installation-guide choices. Signing out clears the local authentication session. Clearing local data does not delete server records.",
          "The necessary ticketsafe_consent cookie records your optional analytics choice, the consent-purpose version and the decision time for 180 days. It contains no account identifier or advertising identifier. We remember acceptance and refusal equally and do not renew this period on ordinary visits. We ask again after expiry, clearing cookies or a change to optional purposes or providers. Choices apply to this browser and site address; another browser, device or domain has its own storage.",
          "The first notice offers Customize, Necessary only and Accept all. Analytics is not preselected for a first visit. You can withdraw or change your choice through Cookie settings in the page footer, Account or the privacy pages. Withdrawal blocks future analytics events immediately; it does not erase information already processed or affect necessary features. Closing the choices without saving leaves the previous choice unchanged, or keeps analytics off if no choice exists. If your browser blocks saving the choice, analytics stays off.",
          "Necessary storage supports sign-in, search security, your privacy choice and functionality you request, such as remembering display settings. Guest display settings stay in device storage and do not require a Supabase account. Optional analytics consent is separate from account terms acceptance and new-ticket email subscriptions. Refusing analytics does not prevent searching, signing in, saving vehicles or using maps.",
          "The installable app caches public fonts, icons, an offline page and decorative map assets. Your current view, filters and returned city records are kept in this tab's session storage to restore your search after refresh. Search records are separated by profile and cleared on sign-out or when you clear browser session data. Restored records retain their original source and check timestamps. Temporary Mapbox matches and private account responses are not stored in this search cache. TicketSafe does not request your precise device GPS location.",
        ],
      },
      {
        title: "Retention and deletion",
        paragraphs: [
          "Email preferences and new-ticket baselines are linked to your account. Unsubscribing stops future alerts, cancels pending messages and clears discovery baselines. Queued message details are private and are removed with terminal notification records after 30 days; the frozen rendered email is cleared when delivery is accepted or permanently fails. Pending jobs expire after seven days. Account deletion removes related notification data. Email already delivered to a mailbox and provider logs are subject to their own retention.",
          "Temporary search caches have bounded lifetimes that depend on the source; supported permanent geocoding may be cached for up to 90 days. Saved cars share city-history snapshots by plate, registration state and plate type. The morning worker normally refreshes saved histories daily, with full historical enrichment normally checked weekly. Failed checks keep the last usable history and its earlier check time. A shared snapshot is removed when no account has that vehicle saved.",
          "After you explicitly confirm account deletion, the account-deletion service verifies your signed-in identity and active session, then deletes the Supabase user and related saved cars, preferences and acceptance records. Another account’s saved details and shared city history remain. If deletion cannot be completed, the app reports the failure so you can retry or contact support. Deletion does not erase public city records, provider logs or independently retained backups. Contact us for coordinated deletion and an explanation of any retention exception.",
        ],
      },
      {
        title: "Your choices and requests",
        paragraphs: [
          "New-ticket emails are off until you explicitly enable them. You can turn them off in Account or use an email unsubscribe link. Only saved vehicles are monitored; removing a saved vehicle stops its future ticket alerts.",
          "TicketSafe product announcements have a separate, optional email subscription that is off by default. Ticket alert consent does not subscribe you to announcements. Change this choice in Account or use an announcement's unsubscribe link. Administrators can send individual service messages about your account; these must not be used to bypass announcement consent.",
          "You can edit or remove saved cars, change display preferences, update your email, recover your password or delete your account through TicketSafe. Contact the operator below to request access, correction, a portable copy, deletion or help with an applicable privacy right. We may verify your authority without requesting unnecessary identification and will respond as required by applicable law.",
          "Applicable privacy rights depend on your location and the laws that apply to this business. We do not discriminate against people for exercising applicable rights. We will explain a denied request and any available review process.",
          "Where applicable, essential account services rely on performance of a contract, and security and abuse prevention rely on legitimate interests or legal duties. Optional analytics relies on your consent. For users in the EEA, United Kingdom and Canada, applicable rights may also include withdrawing consent, objecting to processing, restricting processing and complaining to your local data protection authority. US state privacy rights, where applicable, can include access, correction, deletion, portability and appeals. Contact the operator to exercise rights or ask about international processing and applicable safeguards.",
        ],
      },
      {
        title: "Security and policy updates",
        paragraphs: [
          "Email verification, database row-level security, account-scoped access, active-session checks for deletion and rate limits help protect information. No system can guarantee absolute security. Accounts are intended for adults aged 18 or older. Contact us if you believe a child has provided personal information. We will communicate material policy changes before applying new practices where required.",
        ],
      },
    ],
  },
  accessibility: {
    title: "Accessibility",
    description: "Help using TicketSafe with your preferred way of navigating.",
    sections: [
      {
        title: "Using the interface",
        paragraphs: [
          "TicketSafe includes keyboard-operable controls, labeled forms, light and dark display preferences, and reduced-motion behavior. Ticket information is available as a list when a map position is missing. Third-party authentication, maps and security checks have their own interfaces.",
          "We work to improve accessibility but do not claim that every page or provider interface has passed a complete accessibility audit. If a task is difficult to complete, contact us with the page, the task and, if comfortable, the browser or assistive technology you use. Share only the personal information needed for assistance.",
        ],
      },
    ],
  },
  sources: {
    title: "Data sources",
    description: "Where TicketSafe’s city records and map locations come from.",
    sections: [
      {
        title: "NYC violation records",
        paragraphs: [
          "TicketSafe queries NYC Open Data’s Open Parking and Camera Violations dataset (nc67-uf89) and fiscal-year Parking Violations Issued datasets. Queries use the requested plate, registration state and optional plate type. Records are grouped by summons number while retaining their source information. Source failures and incomplete results are shown in the interface.",
          "Published records may be delayed or corrected and can relate to a previous plate holder. TicketSafe does not identify the current owner. Check current ticket status and deadlines with NYC Department of Finance.",
        ],
      },
      {
        title: "Map locations and backgrounds",
        paragraphs: [
          "Interactive maps and ticket-location previews use Mapbox when configured. Location lookup uses NYC Geoclient, NYC Planning GeoSearch or temporary Mapbox geocoding. Temporary Mapbox lookup results remain in page memory. A location may describe an address, an intersection or an approximate position; records without a usable location stay unpinned.",
          "The decorative background is a locally hosted rendering based on NYC borough boundaries and selected street geometry. It is separate from interactive map requests.",
        ],
      },
    ],
  },
};
export const LEGAL_SOURCES = [
  [
    "NYC Open Data — Open Parking and Camera Violations",
    "https://data.cityofnewyork.us/City-Government/Open-Parking-and-Camera-Violations/nc67-uf89",
  ],
  [
    "NYC Open Data — Parking Violations Issued, FY2027",
    "https://data.cityofnewyork.us/City-Government/Parking-Violations-Issued-Fiscal-Year-2027/pvqr-7yc4",
  ],
  [
    "NYC Department of Finance — Parking and camera violations",
    "https://www.nyc.gov/site/finance/vehicles/parking-and-camera-violations.page",
  ],
  [
    "Mapbox — Geocoding documentation",
    "https://docs.mapbox.com/api/search/geocoding/",
  ],
];
