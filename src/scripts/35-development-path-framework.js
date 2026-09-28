
/* =====================================================================
   v0.47.0 — Consultant Development Path. The framework below follows
   the structure of a Personal Development Plan template in the app's own
   words (six stages, 40 capabilities, with coaching hints). Ticks
   live on people[].capabilities as { id, achievedAt } and are the line
   manager's calibration view; the PDP document remains the consultant's
   own copy, so the two can legitimately differ. Stages earlier than a
   person's current level count as complete implicitly, which keeps
   backfill optional. Appended as one block, new functions only.
   v0.47.1 — updateReport now skips fields the payload does not carry
   (instant saves used to wipe initials this way), payloads carry
   initials, and achieved dates are date-only and editable so KPIs can
   be backdated.
   ===================================================================== */

const CDP_FRAMEWORK = Object.freeze([
  {
    level: 'Consultant (Developing)',
    docTitle: 'Associate Consultant · Developing stage',
    short: 'C · Dev',
    groups: [
      {
        title: 'Learning how projects run',
        items: [
          { id: 'cd-b1', text: 'Helps build project deliverables with direction from the project manager and gets them ready for client review' },
          { id: 'cd-b2', text: 'Prepares meetings with direction from the project manager', hint: 'Work on becoming part of the project team' },
          { id: 'cd-b3', text: 'Runs some meetings with support from the project manager', hint: 'Look for chances to gain experience and learn from colleagues' },
          { id: 'cd-b4', text: 'Holds 1:1 meetings with clients with guidance from the project manager' },
          { id: 'cd-b5', text: 'Uses the house methods when building deliverables' }
        ]
      },
      {
        title: 'Delivering the work',
        items: [
          { id: 'cd-g1', text: 'Helps build deliverables with project manager support and leads the review with clients', hint: 'Grow relationships in the project team and become known for strong business analysis' },
          { id: 'cd-g2', text: 'Holds 1:1 meetings with clients without the project manager' },
          { id: 'cd-g3', text: 'Helps plan on time delivery of assigned tasks with direction from the project manager' }
        ]
      },
      {
        title: 'Delivering and looking ahead',
        items: [
          { id: 'cd-n1', text: 'Owns project deliverables independently', hint: 'Tell your project manager which deliverables you could own' },
          { id: 'cd-n2', text: 'Plans on time delivery of assigned tasks', hint: 'Look for ways to improve each deliverable' },
          { id: 'cd-n3', text: 'Helps the project manager plan deliverables', hint: 'Pick an area you want to be known for' },
          { id: 'cd-n4', text: 'Flags delivery risks to the project manager' }
        ]
      }
    ]
  },
  {
    level: 'Consultant (Skilled)',
    docTitle: 'Consultant · Skilled stage',
    short: 'C · Skilled',
    groups: [
      {
        title: 'Following the plan to the right outcome',
        items: [
          { id: 'cs-e1', text: 'Completes deliverables from start to finish', hint: 'Ask senior experts for guidance' },
          { id: 'cs-e2', text: 'Hands out tasks to other consultants', hint: 'Teach other consultants the house methods' },
          { id: 'cs-e3', text: 'Helps the project team identify and reduce project risks' },
          { id: 'cs-e4', text: 'Helps the project manager lead projects or workstreams using the house methods' }
        ]
      },
      {
        title: 'Shaping the plan',
        items: [
          { id: 'cs-q1', text: 'Drafts deliverables and project or activity plans', hint: 'Pick an area to be known for beyond your own team' },
          { id: 'cs-q2', text: 'Checks every deliverable for the underlying cause (are we solving the right problem?)' },
          { id: 'cs-q3', text: 'Leads projects and analysis workstreams with little direction from the project manager' },
          { id: 'cs-q4', text: 'Hands out tasks to other consultants and stays accountable for quality and deadlines' }
        ]
      }
    ]
  },
  {
    level: 'Consultant (Proficient)',
    docTitle: 'Consultant · Proficient stage',
    short: 'C · Prof',
    groups: [
      {
        title: 'Leading the plan',
        items: [
          { id: 'cp-d1', text: 'Leads projects or analysis workstreams independently, owning risks at project level, the deliverables and, where needed, client side project management, using the house methods', hint: 'Ask senior experts for guidance' },
          { id: 'cp-d2', text: 'Spots client needs beyond the current scope, such as possible new work, and passes them to the account lead', hint: 'Look for gaps where the firm could help the client' },
          { id: 'cp-d3', text: 'Coaches new consultants in good consulting practice, onboards them to projects, checks deliverable quality, and oversees consultants working full time on their project' }
        ]
      },
      {
        title: 'Adding value beyond delivery',
        items: [
          { id: 'cp-v1', text: 'Explains the wider value the firm brings to clients beyond a single project in their area' },
          { id: 'cp-v2', text: 'Presents their expertise so clients see the wider implications, opportunities or angles for their situation' }
        ]
      },
      {
        title: 'Seen by clients as senior and independent',
        items: [
          { id: 'cp-s1', text: 'Has the profile and skills (CV) clients would expect at a Senior Consultant rate' },
          { id: 'cp-s2', text: 'Moves to a new client without losing independence or the ability to lead projects' },
          { id: 'cp-s3', text: 'Works on several projects for different clients at the same time' }
        ]
      }
    ]
  },
  {
    level: 'Senior (Developing)',
    docTitle: 'Senior Consultant · Developing stage',
    short: 'S · Dev',
    groups: [
      {
        title: 'Leading projects independently and building client relationships',
        items: [
          { id: 'sd-pl', text: 'Project Leadership: Leads projects to a consistently high standard, handling risks, timelines and team coordination so deliverables meet client expectations' },
          { id: 'sd-tl', text: 'Team Leadership: Onboards consultants of any level smoothly, manages people well during busy periods and handovers, and settles team conflicts quickly' },
          { id: 'sd-cr', text: 'Client Relationship Development: Builds and looks after relationships with client contacts, supports stakeholder management, and keeps client trust' },
          { id: 'sd-bd', text: 'Business Development: Helps write Statements of Work (SoW) and sales proposals for current clients and for other clients in their field' }
        ]
      }
    ]
  },
  {
    level: 'Senior (Skilled)',
    docTitle: 'Senior Consultant · Skilled stage',
    short: 'S · Skilled',
    groups: [
      {
        title: 'More business development, wider leadership and senior client relationships',
        items: [
          { id: 'ss-pl', text: 'Project Leadership: Leads complex projects independently, keeps risks under control, delivers on commitments, and coordinates the team to exceed client expectations' },
          { id: 'ss-tl', text: 'Team Leadership: Allocates people well, especially in time critical phases, so the team is used and prioritized well across several projects' },
          { id: 'ss-cr', text: 'Client Relationship Development: Manages relationships with senior client contacts and engages key stakeholders at senior management level, relative to the size of the organization' },
          { id: 'ss-bd', text: 'Business Development: Helps shape proposals for new and current clients and is seen as a key contributor in client meetings with account managers or business development (BD) leads' }
        ]
      }
    ]
  },
  {
    level: 'Senior (Proficient)',
    docTitle: 'Senior Consultant · Proficient stage',
    short: 'S · Prof',
    groups: [
      {
        title: 'Coaching, leading whole teams and growing the business independently',
        items: [
          { id: 'sp-pl', text: 'Project Leadership: Fully owns project delivery, including quality, risk and client satisfaction, and completes projects without oversight' },
          { id: 'sp-tl', text: 'Team Leadership: Coaches several consultants of all levels, builds a culture of high standards, and ensures strong project and stakeholder management in their team' },
          { id: 'sp-cr', text: 'Client Relationship Development: Leads stakeholder management at executive level, builds lasting relationships with senior decision makers (including executives and steering committees), and keeps work aligned with business goals and long term client satisfaction' },
          { id: 'sp-bd', text: 'Business Development: Writes complete proposals for new projects (not only extensions) from start to finish with little help from BD leads or account managers, and contributes directly to growth' }
        ]
      }
    ]
  }
]);
