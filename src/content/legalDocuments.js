/**
 * Canonical in-app legal copy for Phase 1 / Beta.
 * Kept in one place so Terms, Privacy, Guidelines, and retired Legal routes stay aligned.
 * Voice: calm, short, honest about what Pawple actually does today.
 *
 * Phase 1a launch (PAW-114): pet profiles, Moments/Feed, Meetups, Open to
 * Mating, Paw, and mutual-Paw introduction chat. Privacy Policy and Community
 * Guidelines are updated on their own schedule — termsSections reflects Step
 * 21C; privacySections Step 21D; guidelinesSections Step 21F consistency pass.
 */

export const LEGAL_LAST_UPDATED = 'September 2026';

/** First RSVP acknowledgment — title + body (PAW-101 §6.1). Live in Phase 1a. */
export const MEETUP_RSVP_DISCLAIMER_TITLE = 'Before you RSVP';
export const MEETUP_RSVP_DISCLAIMER =
  "Meetups are public gatherings organized by other pet parents. Pawple doesn't vet hosts or attendees, so please use your judgment and prioritize your safety.";

/**
 * Mating / Chat in-app copy (PAW-205). Canonical source — Legal owns this file.
 * Phase 1a users must not see these surfaces until Founder re-exposes mating/chat.
 * Dormant Terms/Guidelines sections below stay unattached until Legal re-attaches.
 */

/** Phase 1a repair wave: fixed discovery radius (Founder f67e783b). */
export const MATING_FIXED_DISCOVERY_RADIUS_KM = 100;

/** Conditional bottom nav — active-pet Mating entry. */
export const MATING_DISCOVER_TAB_LABEL = 'Mating';
export const MATING_DISCOVER_TAB_ACCESSIBILITY_LABEL = 'Discover';

/** Conditional bottom nav — eligible introduction threads. */
export const MATING_CHAT_TAB_LABEL = 'Chat';

/**
 * Chat thread header: pet-pair only, honest approximate distance.
 * @param {{ petAName: string, petBName: string, distanceKm?: number | null }} opts
 */
export function formatMatingChatHeaderTitle({ petAName, petBName, distanceKm }) {
  const a = String(petAName ?? 'Pet').trim() || 'Pet';
  const b = String(petBName ?? 'Pet').trim() || 'Pet';
  const km = Number(distanceKm);
  if (Number.isFinite(km) && km >= 0) {
    return `${a} ↔ ${b} · ~${Math.round(km)} km`;
  }
  return `${a} ↔ ${b}`;
}

/** Calm empty-thread copy when a mutual Paw channel opens. */
export const MATING_CHAT_EMPTY_COMPANION = 'You found a companion';
export const MATING_CHAT_EMPTY_SAY_HELLO = 'Say hello.';

/** Pet-centric introduction CTA on a matched pet profile. */
export function formatMatingIntroProfileCta(petName) {
  const name = String(petName ?? '').trim() || 'this pet';
  return `Introduction with ${name}`;
}

/** Shown once per introduction channel at open (Founder §7.7 / PAW-205). */
export const MATING_CHAT_DISCLAIMER_TITLE = 'Before you continue';
export const MATING_CHAT_DISCLAIMER =
  "Keep it pet-first and respectful. Sharing phone, address, or where to meet is your choice — public, pet-friendly places work well. Pawple isn't part of what you share or arrange here. Report or block if something feels off.";

/** Before turning Open to Mating off (PAW-205; matches opt_out freeze truth). */
export const MATING_COMPANIONSHIP_OFF_CONFIRM_TITLE = 'Taking a little pause?';
export const MATING_COMPANIONSHIP_OFF_CONFIRM_BODY =
  "[Pet Name] won't appear in Mating, and any chats for this pet will close. Your other pets stay the same. You can turn this back on anytime.";
export const MATING_COMPANIONSHIP_OFF_CONFIRM_ACTION = 'Turn off';
export const MATING_COMPANIONSHIP_OFF_CONFIRM_CANCEL = 'Keep on';

/** Discovery empty — stale or missing approximate location. */
export const MATING_DISCOVER_EMPTY_STALE_LOCATION_TITLE = 'We need your location';
export const MATING_DISCOVER_EMPTY_STALE_LOCATION_BODY =
  'Pawple uses your approximate location to find pets nearby.';
export const MATING_DISCOVER_UPDATE_LOCATION_ACTION = 'Update location';

/** Discovery empty — fresh location, zero eligible candidates within fixed radius. */
export const MATING_DISCOVER_EMPTY_NO_MATCHES_TITLE = 'No matches just yet';
export const MATING_DISCOVER_EMPTY_NO_MATCHES_BODY =
  "There aren't any pets nearby to connect with right now. Check back a little later.";

/** Feed empty — successful load with no moments or meetups. */
export const FEED_EMPTY_TITLE = 'Nothing to see just yet';
export const FEED_EMPTY_BODY =
  'Your Pawple community is still waking up. Check back soon.';

/** Pet Journal empty — successful load with no moments for this pet. */
export const PET_JOURNAL_EMPTY_TITLE = 'Their story starts here';
export const PET_JOURNAL_EMPTY_BODY =
  'Add a Moment to keep track of the little things that matter.';

/** Reversible Mating unpaw confirmation. */
export const MATING_UNPAW_CONFIRM_TITLE = 'Unpaw?';
export const MATING_UNPAW_CONFIRM_BODY =
  'This will end your connection. You may see each other again in Mating.';
export const MATING_UNPAW_CONFIRM_ACTION = 'Unpaw';
export const MATING_UNPAW_CONFIRM_CANCEL = 'Cancel';

/** Optional report prompt after successful unpaw. */
export const MATING_UNPAW_REPORT_PROMPT = 'Would you like to report this pet?';
export const MATING_UNPAW_REPORT_NO = 'No';
export const MATING_UNPAW_REPORT_YES = 'Yes';

/** Post-submit copy for introduction chat reports (reporter only). */
export const MATING_CHAT_REPORT_DONE_LINES = [
  'Thank you for letting us know.',
  "We've received your report and will look into it.",
  'We appreciate you helping us keep Pawple a safe and respectful place.',
];

/** Anonymous ended conversation — reported party list + detail. */
export const MATING_CHAT_ENDED_TITLE = 'Conversation ended';
export const MATING_CHAT_ENDED_SUBTITLE = 'This conversation is no longer available.';
export const MATING_CHAT_ENDED_BODY =
  'Please continue to be mindful and respectful in your interactions on Pawple.';
export const MATING_CHAT_BACK_TO_CHAT = 'Back to Chat';

/** Open introduction chat — bilateral delete confirmation. */
export const MATING_DELETE_CHAT_CONFIRM_TITLE = 'Delete chat?';
export const MATING_DELETE_CHAT_CONFIRM_ACTION = 'Delete chat';
export const MATING_DELETE_CHAT_CONFIRM_CANCEL = 'Cancel';

export function formatMatingDeleteChatConfirmBody(petName) {
  const name = String(petName ?? '').trim() || 'this pet';
  return `This closes your conversation with ${name}. You'll both need to Paw again to chat.`;
}

/** Shown when turning Open to Mating on (wire when toggle gains disclaimer). */
export const MATING_OPT_IN_DISCLAIMER_TITLE = 'Open to Mating';
export const MATING_OPT_IN_DISCLAIMER =
  'Your pet may appear to other opted-in pets nearby. Mutual Paw unlocks a one-to-one introduction chat. You can turn this off anytime.';

/** Historical draft — live copy is in termsSections ("Open to Mating and introduction chat"). */
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
    body:
      'Pawple is a private, invite-only, authenticated community for pets and the people who love them. Access requires sign-in; the Feed and community are not publicly browsable on the web. By using Pawple, you agree to these Terms.',
  },
  {
    title: 'The service',
    body:
      'Pawple lets you create pet profiles, save Moments, browse a Feed of community content, discover and join Meetups, and—when you opt in—use Discover within Open to Mating.\n\nOpen to Mating includes Discover, expressing a Paw, seeing Interested and Connected pets, and—after mutual Paw—a one-to-one introduction chat between those two pet parents only.\n\nPawple may send in-app and device notifications for relevant activity. You may share Moments or Meetups outside Pawple when you choose.\n\nPawple is not a conventional social network. There are no public like counts, comments, or follower systems. There is no general direct-message inbox, no open DMs to strangers, and no group Meetup chat.',
  },
  {
    title: 'Sign-in',
    body:
      'You sign in with Apple or Google (passwordless OAuth). Pawple does not use phone numbers or passwords for sign-in.',
  },
  {
    title: 'Eligibility',
    body:
      'Phase 1 India launch is 18+ only. You must be 18 or older to own a Pawple account and to accept these Terms. Open to Mating and introduction chat are available only to users 18 and older. Minors may not independently create accounts or accept these Terms.',
  },
  {
    title: 'Your account',
    body:
      'Keep your sign-in secure. You are responsible for activity on your account. Invite codes are personal—do not sell or trade them.',
  },
  {
    title: 'Pets and content',
    body:
      'Only share pets and photos you have the right to share. You own your content. By posting, you give Pawple permission to host, store, display, and transmit your content as needed to operate Pawple—including within the app and when you initiate external sharing of a Moment or Meetup. [COUNSEL REVIEW REQUIRED: user-content licence scope]',
  },
  {
    title: 'Community',
    body:
      'Be kind to pets and people. Follow the Community Guidelines. Do not harass, spam, scam, or post content that is sexual, violent, abusive to animals, or otherwise harmful.',
  },
  {
    title: 'Meetups',
    body:
      'Meetups are events organized by pet parents and listed for discovery by signed-in members. You can create, host, join, and RSVP with a pet. You may receive nearby Meetup notifications and Meetup reminders before an event. Cancelling or changing an RSVP may stop related reminders. You may share a Meetup outside Pawple; hosts may include external map links in event details.\n\nPawple does not verify hosts, attendees, venues, or pets, and does not supervise in-person gatherings. Attendance and any offline meeting are at your own risk. You are responsible for your pet and your choices. Meetups do not include group chat within Pawple.',
  },
  {
    title: 'Open to Mating and introduction chat',
    body:
      'Open to Mating is opt-in per pet (18+ only). When enabled, your pet may appear in Discover for other opted-in pets within a fixed 100 km radius of your approximate location. Eligibility rules apply—for example, pet type and gender pairing.\n\nYou can express a Paw on another pet. Mutual Paw creates a one-to-one introduction chat between those two pet parents—not a general inbox. You can unPaw to withdraw a one-sided Paw you expressed. If you and another pet are Connected through mutual Paw, unPaw ends that mutual connection and closes the open introduction chat between you. You can dismiss an incoming Paw with Not for me. Blocking terminates the relevant mating and chat relationship for that pair.\n\nIntroduction chat currently supports text messages. Link sharing is blocked in introduction chat. Reporting an introduction chat may freeze or end the channel and clear the mating relationship between those pets. Either party can Delete Chat to close an open introduction chat; you would need to Paw again to reconnect. Turning off Open to Mating closes applicable mating visibility and chats for that pet.\n\n[COUNSEL REVIEW REQUIRED: regulatory characterization of mutual-Paw introduction chat]\n\nSharing phone numbers, addresses, or meeting details in chat or offline is your choice. Pawple is not part of what you share or arrange there.',
  },
  {
    title: 'Notifications',
    body:
      'Pawple may notify you about activity relevant to you, including: a Paw received, mutual Paw, introduction chat messages, Meetup guest joined, nearby Meetups, Meetup reminders, and app announcements. Permission reminders may appear when location or notification access would help a feature you use.\n\nNotifications may be delivered through in-app notifications and/or device push notifications, depending on the feature. Push delivery depends on your device, operating system, network, notification permissions, and third-party delivery services. Pawple does not guarantee delivery.',
  },
  {
    title: 'Location',
    body:
      'When you grant location permission, Pawple may process your device\'s approximate location. Before server storage, approximate coordinates are rounded to reduce precision. Pawple uses this for proximity features: Feed Moments are prioritised within about 200 km when location is available; Meetup discovery and Discover within Open to Mating generally use approximate proximity within about 100 km. Approximate distance (for example, ~5 km) may be shown to relevant members. Exact latitude and longitude are not displayed to other members as coordinates.\n\nPawple does not use background or silent location tracking in the current app. A host may include written venue or meeting-point details in a Meetup—review carefully before attending.',
  },
  {
    title: 'External sharing',
    body:
      'You may intentionally share a Moment or Meetup link outside Pawple—for example through your device share sheet. For link sharing, Pawple may upload a temporary preview image; these preview images are automatically removed after 24 hours, on a best-effort basis when the related Moment is deleted, or when your account is deleted. Instagram sharing generates the image on your device only and does not upload a Pawple preview image.\n\nA public preview endpoint may expose limited information such as a caption, pet names, and a preview image so link recipients can see a preview. This does not make the full Pawple Feed or community publicly accessible; in-app content remains for signed-in members unless you choose to share a specific link.',
  },
  {
    title: 'Uploaded photo checks',
    body:
      'Before certain photos upload, Pawple may run on-device checks that can flag disallowed or unsuitable imagery and verify that the image appears to contain an animal. This is upload screening for Moments and pet photos—not automated scanning of introduction-chat messages. Human review remains part of how we handle reports. [COUNSEL REVIEW REQUIRED: legally appropriate description of automated photo screening]',
  },
  {
    title: 'Reporting and moderation',
    body:
      'You can report Moments, Meetups, pets, mating interest, and introduction chats when something feels wrong. Pawple may review reports and take moderation or other action, including restricting content or accounts. Not every report automatically removes content. Reporting an introduction chat may freeze or terminate that channel and clear the mating relationship between those pets. Blocking can terminate relevant mating and chat contact. There is no in-app appeal workflow at this time.',
  },
  {
    title: 'Safety and offline interactions',
    body:
      'Pawple facilitates pet discovery, introductions, and Meetups, but does not verify identity, user representations, pet information, vaccination status, temperament, breeding suitability, compatibility, intentions, conduct, attendance, safety, or the outcome of any offline interaction. [COUNSEL REVIEW REQUIRED: offline interaction / mating / breeding liability language]',
  },
  {
    title: 'What Pawple is not',
    body:
      'Pawple is not a general messaging platform, open DM inbox, or group Meetup chat. This launch does not include phone or password sign-in, a marketplace, behavioural advertising, background location tracking, AI scanning of introduction-chat messages, verified hosts, attendees, or pets, or guaranteed notification delivery.',
  },
  {
    title: 'Enforcement',
    body:
      'We may remove or restrict content, limit feature access, suspend or terminate accounts, act on reports, and block or end relevant interactions when we believe it is appropriate under these Terms or the Community Guidelines. We may preserve information where required by law. [COUNSEL REVIEW REQUIRED: enforcement / appeal / grievance process]',
  },
  {
    title: 'Export',
    body:
      'You can export your account data from Settings. Pawple generates a JSON file on your device. The export includes your profile, pets, Moments, hearts, invites, Meetups you created, Meetup host and participation rows, mating-interest records, and references to your stored photos. It does not include every piece of Pawple data—for example, introduction-chat messages, in-app notifications, reports, blocks, or temporary link-preview images. See the Privacy Policy for more detail.',
  },
  {
    title: 'Ending your account',
    body:
      'You may delete your account in Settings at any time. Deletion runs a server process that removes your profile, pets, Moments, Meetup host and participant relationships, Paws and mating relationships, introduction chats and messages, notifications, blocks, reports you filed or that name you, related storage objects, and your authentication account. Signing out is not deletion. [COUNSEL REVIEW REQUIRED: retention of moderation/report evidence and legal holds after account deletion]',
  },
  {
    title: 'Changes',
    body:
      'We may update these Terms. When we do, we will refresh the in-app copy. Continued use means you accept the updated Terms. [COUNSEL REVIEW REQUIRED: whether material legal changes require notice beyond in-app document updates]',
  },
  {
    title: 'Contact',
    body:
      'Questions: hello@pawple.app\n\n[COUNSEL REVIEW REQUIRED: legal entity name and registered address]\n[COUNSEL REVIEW REQUIRED: grievance officer / grievance mechanism]\n[COUNSEL REVIEW REQUIRED: governing law, jurisdiction, and dispute resolution]',
  },
];

export const privacySections = [
  {
    title: 'Introduction',
    body:
      'This policy explains what Pawple collects, how we use it, and what happens when you delete your account. Pawple is a private, invite-only community for signed-in members. We aim to be clear and limited—only what the product needs.',
  },
  {
    title: 'What we collect',
    body:
      'Account and profile: email and name from Apple or Google sign-in; the name and city you add; your date of birth when you confirm you are 18 or older; notification preference; and your device\'s latest timezone when the app is active.\n\nPets: name, breed, age, photos, mating preferences you opt into, and other details you choose to share.\n\nMoments: photos, captions, memory dates, written location labels, and—when location permission is granted—approximate coordinates attached to a Moment.\n\nMeetups: events you create or join, including title, description, city, date and time, venue or meeting-point text, optional map links, host and participant pet names, and RSVP relationships visible to signed-in members.\n\nFeed and proximity: a rounded location snapshot on your profile for server-side proximity features; and, on your device only, a cached approximate location used to sort your Feed.\n\nOpen to Mating: Paw interest, Interested and Connected status, introduction-chat messages you send, and related pet and account relationships.\n\nNotifications: in-app notification records and, when you allow push, a device push token linked to your account.\n\nSafety: reports you file (reason, optional details, and the content or account reported) and block lists you create.\n\nInvites: invite codes you receive or use for access.\n\nHearts: Moments you heart.\n\nExternal link previews: when you share a Moment or Meetup link, Pawple may upload a temporary preview image so recipients can see a link preview.',
  },
  {
    title: 'What we do not collect for sign-in',
    body:
      'We do not collect a Pawple password or phone number for authentication. Sign-in is passwordless via Apple or Google.',
  },
  {
    title: 'How we use information',
    body:
      'We use your information to run Pawple: create and show pet profiles, Moments, and Meetups; sort and show community content; support invite-only access; deliver in-app and push notifications; schedule Meetup reminders in your timezone; operate Open to Mating, Paw, and introduction chat; handle reports and blocks; host photos and temporary link previews; keep the service secure; and meet legal duties.\n\nWe do not use your information for behavioural advertising or to sell personal data.',
  },
  {
    title: 'Location',
    body:
      'Pawple uses foreground location only when you grant permission. We do not use background or silent location tracking.\n\nBefore storage, approximate coordinates are rounded to reduce precision. Your latest rounded location may be stored on your profile for server-side proximity features. A separate approximate location cache may be stored on your device to sort your Feed; other members do not receive that device cache.\n\nHow proximity is used today:\n• Feed Moments: when location is available, Pawple prioritises Moments within about 200 km; otherwise it shows a broader mix.\n• Meetups: discovery uses your city and approximate proximity—generally within about 100 km between city areas.\n• Open to Mating: discovery uses your stored approximate location within a fixed 100 km radius.\n\nOther members may see approximate distance (for example, ~5 km), not your exact coordinates. If a host includes written venue or map-link text in a Meetup, that information is visible to signed-in members who can view the event.',
  },
  {
    title: 'Notifications and timezone',
    body:
      'Pawple may send in-app notifications and, when you allow them, device push notifications about activity relevant to you—such as a Paw received, mutual Paw, introduction-chat messages, Meetup guest joined, nearby Meetups, Meetup reminders, and app announcements.\n\nTo schedule Meetup reminders at a sensible local time, Pawple stores your device\'s latest IANA timezone while the app is active. Push delivery depends on your device, permissions, network, and delivery services. Pawple does not guarantee delivery.',
  },
  {
    title: 'Open to Mating and introduction chat',
    body:
      'When you opt a pet into Open to Mating, Pawple uses your pet profile, mating preferences, and approximate location to show eligible pets in Discover and to manage Paw, Interested, Connected, and introduction-chat relationships.\n\nIntroduction chat is one-to-one between two pet parents after mutual Paw. Messages are stored so the conversation can load for participants. Link sharing is blocked in introduction chat. You can unPaw to withdraw a one-sided Paw; mutual unPaw ends a Connected relationship and closes the open introduction chat. Either party may Delete Chat to close an open chat; reporting may freeze or end a channel. Turning off Open to Mating affects visibility and applicable chats for that pet.',
  },
  {
    title: 'Uploaded photo checks',
    body:
      'Before certain pet photos and Moment photos upload, Pawple may run automated checks on your device that can flag disallowed or unsuitable imagery and help verify that the image appears to contain an animal. Rejected images are not published. These checks are for upload screening only—not automated scanning of introduction-chat messages. [COUNSEL REVIEW REQUIRED: legally appropriate description of on-device automated photo screening]',
  },
  {
    title: 'Reporting and moderation',
    body:
      'You can report Moments, Meetups, pets, mating interest, and introduction chats. Reports may include a reason and optional details. Pawple team members with authorized server access may review reports and related content to investigate and take action.\n\nReporting an introduction chat may freeze or end that channel. While a report-related freeze is active, the reported party may see an anonymous ended state rather than the full conversation. Pawple does not use automated scanning of introduction-chat messages. There is no in-app appeal workflow at this time.\n\nWhile your account exists, report and moderation records are kept for investigation and safety. Pawple does not currently apply a fixed time limit to those records. [COUNSEL REVIEW REQUIRED: retention of moderation/report evidence and legal holds]',
  },
  {
    title: 'External sharing and link previews',
    body:
      'You may share a Moment or Meetup link outside Pawple through your device share sheet or other apps you choose. Pawple cannot tell whether an external app actually completed a share.\n\nFor link sharing, Pawple may upload a temporary preview image so link recipients and preview services can show limited information such as a caption, pet names, event details, and a preview image. These preview images are stored in a public preview bucket and are automatically removed after 24 hours and when your account is deleted. Moment link previews are also removed on a best-effort basis when you delete the Moment. Temporary preview objects are otherwise cleaned up by scheduled deletion. Instagram sharing from Pawple generates the image on your device only and does not upload a Pawple preview image.\n\nExternal sharing does not make the full Pawple Feed or community publicly browsable; in-app content remains for signed-in members unless you share a specific link.',
  },
  {
    title: 'What we do not do',
    body:
      'We do not sell your personal data. We do not run behavioural advertising or third-party ad tracking in this launch. We do not offer a general direct-message inbox or group Meetup chat. We do not use background location tracking. We do not use automated scanning of introduction-chat messages. This launch does not include third-party analytics or crash-reporting SDKs.',
  },
  {
    title: 'Sharing with others and service providers',
    body:
      'Signed-in members see what you place on pet profiles, Moments, Meetups you host or join, and other community content according to how Pawple works today. Introduction chat is visible to the two participants only.\n\nWe use service providers only to operate Pawple, including Supabase (authentication, database, storage, and server functions), Apple and Google (sign-in), and Expo\'s push notification service for device delivery. We may disclose information when the law requires it. [COUNSEL REVIEW REQUIRED: data controller identity, cross-border processing, and processor disclosures]',
  },
  {
    title: 'Retention and deletion',
    body:
      'Most of your Pawple data stays until you delete your account or delete the underlying content.\n\nTemporary Moment and Meetup link-preview images are kept for up to 24 hours after upload, then removed automatically through scheduled cleanup. Moment link previews are also removed on a best-effort basis when you delete the Moment.\n\nWhen you delete your account in Settings, a server process removes your profile, pets, Moments, Meetup host and participant relationships, Paws and mating relationships, introduction chats and messages, in-app notifications, blocks, reports you filed or that name you, device push tokens, related storage objects (including moment photos, pet photos, and share previews), and your sign-in identity. Signing out is not deletion.\n\nIf a preview image, report record, or other item is already gone, deletion still completes. [COUNSEL REVIEW REQUIRED: whether any moderation or legal-hold retention should survive account deletion]',
  },
  {
    title: 'Export',
    body:
      'You can export your data from Settings. Pawple generates a JSON file on your device through the in-app export flow. The export includes your profile, pets, Moments, hearts, invites, Meetups you created, Meetup host and participation rows, mating-interest records, and references to your stored photos. It does not include every piece of Pawple data—for example, introduction-chat messages, in-app notifications, reports, blocks, or temporary link-preview images. Export is provided in-app; Pawple does not email exports.',
  },
  {
    title: 'Your choices',
    body:
      'Edit profile and pet details anytime. Control location and notification permissions in your device settings. Turn Open to Mating on or off per pet. Block, report, export, or delete your account from Settings.',
  },
  {
    title: 'Age and minors',
    body:
      'Phase 1 India launch is 18+ only. You confirm your date of birth to use Pawple, and account ownership requires you to be 18 or older. Minors may not independently create accounts. If we learn an account belongs to someone under 18, we will delete it.',
  },
  {
    title: 'Changes',
    body:
      'We may update this policy in the app. Continued use means you accept the updated policy. [COUNSEL REVIEW REQUIRED: whether material legal changes require notice beyond in-app document updates]',
  },
  {
    title: 'Contact',
    body:
      'Privacy questions: hello@pawple.app\n\n[COUNSEL REVIEW REQUIRED: legal entity name and registered address]\n[COUNSEL REVIEW REQUIRED: grievance officer / grievance mechanism]\n[COUNSEL REVIEW REQUIRED: governing law, jurisdiction, and dispute resolution]',
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
    body: 'Meetups are real-world gatherings discoverable by signed-in members using city and approximate proximity. RSVP only when you intend to attend. Be considerate. Supervise your pet. Leave places as you found them. Pawple does not verify attendees or supervise events. Do not harass, pressure, or solicit others at or through Meetups. Meetups have no group chat within Pawple.',
  },
  {
    title: 'Meetup discovery',
    body: 'Meetups are visible to signed-in members through city and approximate proximity—not a public web listing. Keep posts pet-first. Do not use Meetups for spam, scams, or unrelated promotion.',
  },
  {
    title: 'Open to Mating, Discover, and Chat',
    body: 'Open to Mating is opt-in per pet (18+ only). Discover helps you find eligible opted-in pets nearby. You can express a Paw on another pet. If they Paw back, you become Connected and a one-to-one introduction chat may open between the two pet parents—not a general inbox.\n\nYou can unPaw to withdraw a one-sided Paw you expressed. Mutual unPaw ends a Connected relationship and closes the open introduction chat. Not for me quietly dismisses an incoming Paw. Block ends relevant mating and chat contact for that pair; unblocking does not reopen a prior chat.\n\nIntroduction chat supports text messages only; link sharing is blocked there. Either party can Delete Chat to close an open introduction chat. Report if something feels wrong. Turning off Open to Mating affects visibility and applicable chats for that pet.',
  },
  {
    title: 'How we enforce (Phase 1)',
    body: 'Before certain pet photos and Moment photos upload, Pawple may run on-device automated checks that can flag disallowed or unsuitable imagery and help verify that the image appears to contain an animal. Rejected images are not published. Safety reports are reviewed by people on the Pawple team. Reporting an issue does not guarantee removal. There is no in-app appeal workflow at this time. Introduction-chat messages are not automatically scanned.',
  },
  {
    title: 'Reports',
    body: 'Reports are filed for the pets involved and flag the human account for review. You can report Moments, Meetups, pets, mating interest, and introduction chats. Block stops further contact on supported surfaces. Unblocking does not restore a prior introduction chat.',
  },
  {
    title: 'Contact',
    body: 'Concerns: hello@pawple.app',
  },
];
