// Historical database consent version: never rewrite existing acceptance records.
export const LEGAL_VERSION = "2026-09-27.1";
export const PRIVACY_VERSION = "2026-10-02.1";
export const LEGAL_DISPLAY_REVISION = "2026-10-02.1";
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
          "Vercel hosts TicketSafe. Supabase provides authentication and stores private car details, preferences, historical consent records and shared public-city snapshots. Account confirmation and password recovery emails use the configured email delivery service. NYC Open Data receives plate queries. When maps or location lookup are used, Mapbox and the configured NYC location services process map requests or address and intersection queries. Car nicknames and other user-entered details are private to the account that saved them.",
          "When hCaptcha is shown, it processes device and interaction information to detect automated abuse under the applicable provider terms. Providers may process information in the United States or other locations where they operate. Their own policies explain their processing and retention. We may disclose information when required by law or reasonably necessary to protect rights and security.",
        ],
      },
      {
        title: "Analytics and privacy signals",
        paragraphs: [
          "Vercel Web Analytics measures visits to public search, map and legal pages without tracking cookies. Our filter excludes authentication and private account, garage and ticket views, removes plates, emails, ticket details and unapproved query parameters from measured URLs, and rejects custom events. Vercel may derive general location, browser and device information from the request.",
          "We suppress analytics events when Global Privacy Control or Do Not Track is enabled. We do not operate cross-site behavioral advertising. Essential authentication, hosting and abuse prevention still operate when those privacy signals are enabled.",
        ],
      },
      {
        title: "Cookies and local storage",
        paragraphs: [
          "Supabase stores the authentication session in browser storage so you can remain signed in. A welcome cookie remembers completed onboarding for up to one year and is renewed on visits. Browser storage also keeps guest display preferences, account-specific preference caches and installation-guide choices. Signing out clears the local authentication session. Clearing local data does not delete server records.",
          "The installable app caches public fonts, icons, an offline page and decorative map assets. It does not cache private account responses or ticket searches for offline access. TicketSafe does not request your precise device GPS location.",
        ],
      },
      {
        title: "Retention and deletion",
        paragraphs: [
          "Temporary search caches have bounded lifetimes that depend on the source; supported permanent geocoding may be cached for up to 90 days. Saved cars share city-history snapshots by plate, registration state and plate type. The morning worker normally refreshes saved histories daily, with full historical enrichment normally checked weekly. Failed checks keep the last usable history and its earlier check time. A shared snapshot is removed when no account has that vehicle saved.",
          "After you explicitly confirm account deletion, the account-deletion service verifies your signed-in identity and active session, then deletes the Supabase user and related saved cars, preferences and acceptance records. Another account’s saved details and shared city history remain. If deletion cannot be completed, the app reports the failure so you can retry or contact support. Deletion does not erase public city records, provider logs or independently retained backups. Contact us for coordinated deletion and an explanation of any retention exception.",
        ],
      },
      {
        title: "Your choices and requests",
        paragraphs: [
          "You can edit or remove saved cars, change display preferences, update your email, recover your password or delete your account through TicketSafe. Contact the operator below to request access, correction, a portable copy, deletion or help with an applicable privacy right. We may verify your authority without requesting unnecessary identification and will respond as required by applicable law.",
          "Applicable privacy rights depend on your location and the laws that apply to this business. We do not discriminate against people for exercising applicable rights. We will explain a denied request and any available review process.",
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
