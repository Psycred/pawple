/**
 * Canonical in-app legal copy for Phase 1 / Beta.
 * Kept in one place so Terms, Privacy, Guidelines, and retired Legal routes stay aligned.
 * Voice: calm, short, honest about what Pawple actually does today.
 *
 * Phase 1a launch (PAW-114 / Founder 4ac03812): 18+ Bulletin Board only —
 * pet profiles, Moments/Feed, public city Meetups + RSVP. Mating, matching,
 * and intro chat are hidden from users. Code is preserved; do not delete the
 * dormant mating legal architecture below. Re-attach those sections only when
 * Founder re-exposes those surfaces.
 *
 * User-facing arrays (termsSections, privacySections, guidelinesSections)
 * must not present mating or intro chat as current features.
 */

export const LEGAL_LAST_UPDATED = 'September 2026';

/** First RSVP acknowledgment — title + body (PAW-101 §6.1). Live in Phase 1a. */
export const MEETUP_RSVP_DISCLAIMER_TITLE = 'Before you RSVP';
export const MEETUP_RSVP_DISCLAIMER =
  'Meetups are public gatherings organized by other pet parents. Pawple does not verify hosts, attendees, or safety. Attend thoughtfully.';

/**
 * Dormant mating legal architecture (PAW-101 §6.2–6.3). Preserved under
 * Founder 4ac03812 — code stays; Phase 1a users must not be offered these
 * surfaces. Do not import into Phase 1a-facing documents. Re-use when mating
 * is later re-exposed (18+ only, consent-gated).
 */
export const MATING_OPT_IN_DISCLAIMER_TITLE = 'Open to Companionship';
export const MATING_OPT_IN_DISCLAIMER =
  'Mating discovery is for users 18 and older. Your pet may appear to other opted-in pets nearby. Mutual Paw unlocks a one-to-one introduction chat—not open messaging. You can turn this off anytime.';

export const MATING_CHAT_DISCLAIMER =
  'This chat opened after mutual Paw. Mating discovery is 18+ only. Sharing personal details is at your discretion. Pawple encourages public, pet-friendly first meetups. Pawple is not responsible for chat exchanges or offline meetings.';

/** Preserved Terms section — not included in termsSections for Phase 1a. */
export const DORMANT_MATING_TERMS_SECTION = {
  title: 'Mating introduction chat',
  body: 'When you opt a pet into mating discovery (18+ only) and two pets share mutual Paw interest, Pawple may unlock a mating-introduction chat between those two pet parents only. That channel is for introduction after mutual consent—not an open inbox. Sharing personal details (address, phone, exact meeting spot) is at your discretion. Pawple encourages public, pet-friendly first meetups and is not responsible for chat exchanges or offline meetings arranged through them. Report and block are available. Phase 1 does not use AI message scanning.',
};

/** Preserved Guidelines section — not included in guidelinesSections for Phase 1a. */
export const DORMANT_MATING_GUIDELINES_SECTION = {
  title: 'Mating introduction chat',
  body: 'After mutual Paw, Pawple may unlock a mating-introduction chat between the two pet parents only—not general messaging. Keep it respectful and pet-centric. Do not harass, solicit, or pressure. Sharing personal details is your choice; prefer public, pet-friendly first meetups. Pawple is not responsible for chat exchanges or offline meetings. Use report and block if something feels wrong. Mating discovery and introduction chat are available only to users 18 and older.',
};

export const termsSections = [
  {
    title: 'Welcome',
    body: 'Pawple is a private, invite-only home for pets and the people who love them. By using Pawple, you agree to these Terms.',
  },
  {
    title: 'The service',
    body: 'Pawple lets you create pet profiles, save Moments and journals, discover public Meetups in your city, and RSVP to gatherings. It is not a conventional social network. There are no public like counts, comments, or follower systems.',
  },
  {
    title: 'Sign-in',
    body: 'You sign in with Apple or Google (passwordless OAuth). Pawple does not use phone numbers or passwords for sign-in.',
  },
  {
    title: 'Eligibility',
    body: 'Phase 1 India launch is 18+ only. You must be 18 or older to own a Pawple account and to accept these Terms. Minors may not independently create accounts or accept these Terms.',
  },
  {
    title: 'Your account',
    body: 'Keep your sign-in secure. You are responsible for activity on your account. Invite codes are personal—do not sell or trade them.',
  },
  {
    title: 'Pets and content',
    body: 'Only share pets and photos you have the right to share. You own your content. By posting, you give Pawple permission to display it inside the app as needed to run the service.',
  },
  {
    title: 'Community',
    body: 'Be kind to pets and people. Follow the Community Guidelines. Do not harass, spam, scam, or post content that is sexual, violent, abusive to animals, or otherwise harmful.',
  },
  {
    title: 'Meetups',
    body: 'Meetups are public events organized by pet parents and listed by city. Signed-in members can discover events in a city, RSVP with a pet, and see attending pets. Pawple does not verify hosts, attendees, venues, or safety, and does not supervise in-person gatherings. Attendance is at your own risk. You are responsible for your pet and your choices. Meetups do not include group chat within Pawple.',
  },
  {
    title: 'Messaging and chat',
    body: 'This launch does not include in-app messaging, open direct messages, group meetup chat, or a general inbox. Users may exchange contact details offline at their own discretion.',
  },
  {
    title: 'Location',
    body: 'Pawple uses city-level location for Meetup discovery. Pawple does not store or share your precise GPS coordinates with other users. A host may include written venue or meeting-point details in an event—review carefully before attending.',
  },
  {
    title: 'What Pawple is not',
    body: 'This launch does not include general direct messages, group meetup chat, an in-app inbox, push notifications as a product feature, phone or password accounts, marketplace, behavioural advertising, or AI moderation.',
  },
  {
    title: 'Safety',
    body: 'We may remove content or restrict accounts that break these Terms or the Community Guidelines. Reports are reviewed by people on the Pawple team. We do not claim guaranteed safety, verified attendees, or AI moderation.',
  },
  {
    title: 'Ending your account',
    body: 'You may delete your account in Settings at any time. Deletion removes your profile, pets, Moments, related meetup ties, and sign-in identity through our server process. Signing out is not deletion.',
  },
  {
    title: 'Changes',
    body: 'We may update these Terms. When we do, we will refresh the in-app copy. Continued use means you accept the updated Terms.',
  },
  {
    title: 'Contact',
    body: 'Questions: support@pawple.app',
  },
];

export const privacySections = [
  {
    title: 'Introduction',
    body: 'This policy explains what Pawple collects and how we use it. We aim to be clear and limited—only what the product needs.',
  },
  {
    title: 'What we collect',
    body: 'Account: email and name from Apple or Google sign-in, plus the profile details you add.\nPets: name, breed, age, photos, and other details you choose to share.\nContent: Moments, captions, journals, and meetup posts you create or join.\nMeetups: events you host or RSVP to, including your pet\'s name on attendee lists visible to signed-in members.\nCity selection: the city you choose for Meetup discovery—not precise GPS coordinates shared with other users.\nDevice and usage: basic technical data needed to run and improve the app (for example crash and session signals).',
  },
  {
    title: 'What we do not collect for sign-in',
    body: 'We do not collect a Pawple password or phone number for authentication. Sign-in is passwordless via Apple or Google.',
  },
  {
    title: 'How we use information',
    body: 'To run your account and pet profiles, show Moments and city-scoped Meetups and RSVP lists, support invite-only access, keep the service secure, and meet legal duties.',
  },
  {
    title: 'What we do not do',
    body: 'We do not sell your personal data. We do not build behavioural profiles for advertising, and this launch does not include targeted advertising or third-party ad tracking. This launch does not offer general direct messages, group meetup chat, or an in-app inbox, and does not use AI moderation or AI message scanning.',
  },
  {
    title: 'Location',
    body: 'Pawple uses city-level location for Meetup discovery. Precise GPS coordinates are not stored or shared with other users. If a host publishes written venue or meeting-point text in an event, that information is visible to signed-in members who can view the event.',
  },
  {
    title: 'Sharing',
    body: 'Other members see what you place on a pet\'s public profile and content you share in the community. We use trusted service providers (hosting, auth, storage) only to operate Pawple. We may disclose information when the law requires it.',
  },
  {
    title: 'Retention and deletion',
    body: 'When you delete your account in Settings, our server deletion process removes your profile, pets, Moments, related relationships, owned media, and sign-in identity. That happens as part of that deletion—not after a separate waiting period. Signing out leaves your data in place.',
  },
  {
    title: 'Export',
    body: 'You can export your data from Settings when that option is available. Export is provided in-app; we do not promise email delivery unless that exists.',
  },
  {
    title: 'Your choices',
    body: 'Edit profile and pet details anytime. Adjust location preferences. Export or delete your account from Settings.',
  },
  {
    title: 'Age and minors',
    body: 'Phase 1 India launch is 18+ only. Account ownership and Terms acceptance require the user to be 18 or older. Minors may not independently create accounts. If we learn an account belongs to someone under 18, we will delete it.',
  },
  {
    title: 'Changes',
    body: 'We may update this policy in the app. Continued use means you accept the updated policy.',
  },
  {
    title: 'Contact',
    body: 'Privacy questions: support@pawple.app',
  },
];

/** Pawple Community Guidelines v1 — Founder (F). Phase 1a launch surfaces only. */
export const guidelinesSections = [
  {
    title: 'Our spirit',
    body: 'Pawple celebrates the bond between pets and humans. Share your life together. Keep it pet-centric, respectful, and safe.',
  },
  {
    title: 'Welcome here',
    body: 'Photos of humans with their pets, Meetup group photos, and incidental people in the frame are all fine—when the moment stays about the pet and the care you share.',
  },
  {
    title: 'Never allowed',
    body: 'Nudity or sexual content involving humans or animals.\nHate, harassment, or bullying.\nViolence, gore, or animal abuse.\nIdentifiable minors in compromising situations.\nSpam, scams, or commercial solicitation.\nHarmful misinformation.',
  },
  {
    title: 'Age',
    body: 'Phase 1 India launch is 18+ only. Account ownership, Terms acceptance, and Meetup attendance require an 18+ account holder. Minors may not independently create accounts or accept Terms.',
  },
  {
    title: 'Meetups and real life',
    body: 'Meetups are real-world gatherings listed by city. RSVP only when you intend to attend. Be considerate. Supervise your pet. Leave places as you found them. Pawple does not verify attendees or supervise events. Do not harass, pressure, or solicit others at or through Meetups. Meetups have no group chat within Pawple.',
  },
  {
    title: 'Public city events',
    body: 'City Meetups are visible to signed-in members browsing that city. Keep posts pet-first. Do not use Meetups for spam, scams, or unrelated promotion.',
  },
  {
    title: 'How we enforce (Phase 1)',
    body: 'Safety is report-driven. Reports are reviewed by people on the Pawple team. There is a clear path to appeal. We do not claim AI moderation or AI message scanning.',
  },
  {
    title: 'Reports',
    body: 'Reports are filed for the pets involved and flag the human account for review. You can report Moments and Meetups. Block stops further contact on supported surfaces.',
  },
  {
    title: 'Contact',
    body: 'Concerns: support@pawple.app',
  },
];
