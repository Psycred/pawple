# Pawple Operating & Decision Governance

## Purpose and scope

This document defines organizational authority, decision rights, and escalation
boundaries for Pawple.

Pawple is one venture within a broader founder-led structure. Pawple, OXZi, and
Hospitality are distinct businesses with different products, customers,
operations, marketing strategies, approaches, functional requirements, and
skillsets. Hospitality may contain multiple properties.

This document governs Pawple only. It does not define the governance of OXZi or
Hospitality.

## 1. Founder & Managing Director

The Founder & Managing Director holds founder-level authority over Pawple's
fundamental identity, long-term vision, and strategic direction.

This includes:

- Pawple's fundamental vision and identity
- its core product philosophy and pet-first principle
- major strategic direction and pivots
- fundamental changes to scope
- major capital and resource decisions
- founder-level decisions affecting identity, trust, safety, privacy, or
  long-term direction
- appointment, continuation, or removal of executive leadership
- final founder-level go/no-go authority for decisions of material strategic
  significance

This role provides strategic and founder-level oversight. It is not responsible
for approving ordinary operational, design-system, architecture, or engineering
implementation decisions.

## 2. CEO / Executive Leadership

The CEO / Executive Leadership leads Pawple operationally within the strategic
mandate established by the Founder & Managing Director.

This role owns:

- operational execution
- translating strategy into execution
- coordinating functional leadership
- prioritization within the approved company and product direction
- day-to-day product and business decisions
- alignment across functional teams
- resolution of ordinary cross-functional conflicts
- execution against agreed objectives
- escalation of founder-level or materially consequential decisions when
  required

The CEO / Executive Leadership has meaningful autonomy and does not require
Founder & Managing Director approval for every ordinary operational decision.

## 3. Functional leadership

As Pawple develops, functional leadership may be responsible for areas such as:

- Product
- Design / UX
- Architecture / Technology
- Engineering
- Marketing / Growth
- Operations
- other functions appropriate to Pawple's development

Functional leadership operates within the strategic mandate established by the
Founder & Managing Director and the operational direction established by the
CEO / Executive Leadership.

## 4. Product authority

Product leadership owns product execution within Pawple's established strategic
direction.

Product decisions must preserve:

- Pawple's identity
- the pet-first philosophy
- approved product scope
- established Product Contract requirements

Major changes to product identity, scope, or strategic direction escalate
through the CEO / Executive Leadership and, where materially significant, to
the Founder & Managing Director.

The Pawple Beta Architecture & Product Contract remains authoritative for the
specific beta product requirements it defines. This document does not redefine
those requirements.

## 5. Design / UX authority

Design / UX owns visual-system and interaction-design execution within Pawple's
established product philosophy, including:

- typography
- spacing and visual rhythm
- component geometry and consistency
- colour application
- hierarchy
- interaction patterns
- screen composition
- responsive behaviour
- accessibility-oriented presentation
- visual-system consistency

Design / UX may evaluate and resolve ordinary visual-system conflicts without
Founder & Managing Director approval.

The Founder & Managing Director does not need to approve individual spacing
values, corner radii, typography sizes or weights, button geometry,
component-level visual refinements, or responsive layout details when those
decisions remain consistent with Pawple's established principles and approved
product direction.

### Named seat — Product Designer (UI/UX)

Founder PAW-116 (2026-09-03) names **Product Designer (UI/UX)** as the
functional owner of Design / UX. The seat owns every user-facing surface:
flows, screens, components, spacing, typography, and motion.

- Reports to the CEO for wave coordination.
- Peer of the CTO and Engineering; not subordinate to them.
- Holds a protected direct escalation to the Founder on pet-first
  philosophy matters.
- May VETO a user-facing wave on feel grounds with a concrete alternative.
  Feel-based VETOs may be overridden only by the Founder.
- Partners with Copywriter on voice and Frontend on implementation.

### User-facing Definition of Done (immediate)

No user-facing wave closes without:

1. Product Designer emulator walkthrough as a first-time user
2. Founder feel-pass

QA SIGN-OFF requires the designer feel-checklist green.

## 6. Pawple design philosophy

Pawple's core design philosophy is:

**PET-FIRST**

**+ APPLE-INSPIRED DESIGN DISCIPLINE**

**+ PAWPLE WARMTH AND PERSONALITY**

### Pet-first

The pet is Pawple's primary identity and emotional centre. Design should make
the pet central wherever contextually appropriate, including pet identity,
photography, personality, story, activities, relationships, Moments, Meetups,
discovery, and mating discovery.

The owner is important, but should not become the dominant social identity in a
way that turns Pawple into a conventional human social network with pets layered
on top.

### Design Constitution (PAW-136, binding)

Founder PAW-136 (2026-09-03) binds Designer, Frontend, and QA:

- Default is no screen. Every interstitial, primer, or pre-screen must
  justify its existence or be removed. System-standard flows win.
- Permissions: OS system prompt only, at the moment of need. The “why”
  lives in the OS permission string, in Pawple voice. No custom primer
  sheets for camera, photos, location, or notifications.
- Microcopy over screens: one quiet line under the relevant field when
  context is needed. Never a standalone screen.
- No copy may position Pawple as an adult product, a stranger-danger
  product, or a dating product. Pawple is pet parents, pet meetups, and
  UGC events.

This constitution supersedes Wave 2 F1/F3 primer-and-copy direction
where they conflict. F4 delete hardening is unchanged.

### Apple-inspired design discipline

The Apple / Steve Jobs influence is a product-design philosophy, not visual
imitation.

Pawple prioritizes:

- simplicity, clarity, and restraint
- intuitive interaction and progressive disclosure
- strong hierarchy and purposeful whitespace
- excellent typography and beautiful imagery
- consistency and reduction of unnecessary interface elements
- technology that feels unobtrusive

This does not mean copying Apple's visual identity or iOS screens, blindly
reproducing Apple's UI, making Pawple cold or clinical, or sacrificing Pawple's
personality.

### Pawple warmth and personality

Apple-inspired discipline must remain balanced with warmth, emotion,
playfulness, intimacy, trust, premium character, and calmness.

## 7. Architecture authority

Architecture owns:

- technical and data architecture
- system boundaries
- integration patterns
- database and storage architecture
- engineering approach
- technical trade-offs

Architecture must respect the Product Contract, established product principles,
and approved product and design direction. It must not independently redefine
product requirements.

## 8. Engineering authority

Engineering owns implementation of approved product, design, and architecture
decisions and may make ordinary implementation decisions autonomously.

Engineering must not silently alter:

- product behaviour or scope
- Product Contract requirements
- Pawple's design principles
- privacy or safety behaviour

## 9. Decision escalation

Decisions should be made at the lowest appropriate level.

### A. Founder-level decisions

Escalate to the Founder & Managing Director when a decision materially changes:

- Pawple's fundamental identity or long-term vision
- the pet-first philosophy
- major strategic direction
- fundamental scope
- major strategic capital or resource allocation
- founder-level trust, safety, or privacy direction
- major strategic product mechanics
- executive leadership

### B. CEO / Executive decisions

The CEO / Executive Leadership handles ordinary:

- operational decisions
- prioritization
- cross-functional conflicts
- product and business execution
- resource allocation within the approved mandate

### C. Functional decisions

Functional leaders independently handle ordinary decisions within their
domains. Routine decisions should not be escalated merely for the sake of
escalation.

## Execution lanes

The fast lane uses a direct Cursor prompt without a ticket for UI text, labels,
styling, read-only queries, local state, and single-screen fixes.

Read-only queries are fast-lane eligible against the development environment
only. Any read or write against staging or production is ticket-lane.

The ticket lane uses the Paperclip organization for schema, RLS, migrations,
database writes, context APIs, navigation and routing, Feed composition, Auth,
Storage, and parallel work.

Where a change matches both a fast-lane and a ticket-lane category, the ticket
lane takes precedence.

The QA Auditor is appointed by the Founder & Managing Director and holds an
independent veto over any diff that violates the Product Contract,
`.cursorrules` prohibitions, or a ticket's explicit constraints. A veto blocks
merge. Overriding it requires explicit Founder & Managing Director approval.

QA cannot override the Founder.

If the environment prevents material verification, state exactly
what could not be verified and why. The Founder decides whether to
accept the residual risk. QA does not invent conditional sign-offs.

## 10. Product Contract authority

The Pawple Beta Architecture & Product Contract remains the authoritative
product boundary document for the requirements it defines.

This governance document does not replace, rewrite, or supersede the Product
Contract. Any proposed change to an established Product Contract requirement
must follow the appropriate product and strategic escalation process.

## 11. Phase 1 mating / matching boundary

Phase 1 includes pet mating and matching.

The established product requirements are:

- The owner opts their pet into mating discovery.
- Eligibility is same breed and opposite sex.
- Distance is user-adjustable.
- Traits are descriptive and are not matching criteria.
- A pet that has been Pawed remains discoverable and viewable.
- The exact discovery presentation and location remain an open product and
  design decision.
- Matching and chat engineering implementation remain architecture and
  engineering decisions within the Product Contract boundary.

This document does not add age, health, vaccination, AI compatibility, or trait
matching criteria; new mating mechanics; database schema; or chat architecture.

## 12. Governance principles

- Strategic authority should not become operational micromanagement.
- Functional autonomy should not become product drift.
- Design autonomy should not redefine Pawple's identity.
- Architecture autonomy should not redefine product requirements.
- Engineering autonomy should not silently alter product behaviour.
- Decisions should be made at the lowest appropriate level.
- Consequential decisions should be escalated.
- Existing contracts and principles should be respected rather than casually
  overridden.
- Simplicity and clarity apply to governance as well as product design.

## Document boundaries

This document is not:

- a Product Contract
- a technical architecture or database specification
- a UI specification
- an engineering implementation plan
- an employment or HR document
- a corporate legal constitution

It does not define people, individual names, unestablished reporting
relationships, job descriptions, compensation, legal structures, or departments
that do not yet exist.
