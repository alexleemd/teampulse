
/* =====================================================================
   v0.47.0 — Consultant Development Path. The framework below is seeded
   verbatim from the Personal Development Plan template (six
   stages, 40 capabilities, coaching hints from the Notes column). Ticks
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
        title: 'Getting the basics of project execution',
        items: [
          { id: 'cd-b1', text: 'Contribute to project deliverables based on Project Manager guidance and prepare for client review' },
          { id: 'cd-b2', text: 'Prepare meetings under Project Manager guidance', hint: 'Proactively focus on getting integrated in project team' },
          { id: 'cd-b3', text: 'Drive selected meetings under PM support', hint: 'Proactively seek experience and learn from colleagues' },
          { id: 'cd-b4', text: '1:1 meeting with clients under PM guidance' },
          { id: 'cd-b5', text: 'Utilize the firm\'s methodology for deliverables' }
        ]
      },
      {
        title: 'Getting things done',
        items: [
          { id: 'cd-g1', text: 'Contribute to project deliverables under Project Manager support and drive review with clients', hint: 'Proactively seek to expand relationships within project team and be known as a person of choice and for business analysis skills' },
          { id: 'cd-g2', text: '1:1 meeting with clients without Project Manager' },
          { id: 'cd-g3', text: 'Contribute to the plan for timely delivery of selected tasks under Project Manager guidance' }
        ]
      },
      {
        title: 'Getting things done and plan for next steps',
        items: [
          { id: 'cd-n1', text: 'Drive project deliverables on their own', hint: 'Proactively suggest to your PM which deliverables you can drive' },
          { id: 'cd-n2', text: 'Plan for timely delivery of selected tasks', hint: 'Proactively think how you can do better with each deliverable' },
          { id: 'cd-n3', text: 'Support PM in the planning of deliverables', hint: 'Identify a specialty for which you would like to be known for' },
          { id: 'cd-n4', text: 'Raise risks for project deliverables to Project Manager' }
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
        title: 'Execute "right way forward" by following a plan',
        items: [
          { id: 'cs-e1', text: 'Actively completing deliverables from E2E', hint: 'Proactively seek guidance from senior experts' },
          { id: 'cs-e2', text: 'Delegate assignments to other consultants', hint: 'Proactively teach other consultants the firm\'s methods' },
          { id: 'cs-e3', text: 'Support Project Team in defining/mitigating project risks' },
          { id: 'cs-e4', text: 'Support Project Manager in leading projects and/or tracks while applying the firm\'s methodology for deliverables' }
        ]
      },
      {
        title: 'Questioning & outlining the "right way forward"',
        items: [
          { id: 'cs-q1', text: 'Outline deliverables and project/activity plans', hint: 'Identify a specialty to be known for outside the firm' },
          { id: 'cs-q2', text: 'Apply "Root Cause Analysis" thinking to each deliverable (are we solving the right problem?)' },
          { id: 'cs-q3', text: 'Lead projects and analytical tracks under limited guidance from Project Manager' },
          { id: 'cs-q4', text: 'Delegate assignments to other consultants while taking accountability for quality and timelines' }
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
        title: 'Driving the "right way forward"',
        items: [
          { id: 'cp-d1', text: 'Lead projects and/or analytical tracks on their own incl. accountability of individual risks and addressing the risks on a project level, deliverables and possibly project management on client level while applying the firm\'s methodology', hint: 'Proactively seek guidance from senior experts' },
          { id: 'cp-d2', text: 'Understands and pick up on conversations that relate to needs for the client beyond the project scope or boundaries (e.g. potential engagement leads for the firm) and understand how to deliver this information to the Account Lead', hint: 'Proactively seek leads and gaps for which the firm could support client' },
          { id: 'cp-d3', text: 'Ability to coach the way of consultancy excellence to new consultants incl. onboarding to new projects, being the quality governance on deliverables and ability to delegate and oversee other consultants working full-time within their project' }
        ]
      },
      {
        title: 'Creating client value beyond delivery',
        items: [
          { id: 'cp-v1', text: "Understands and can articulate the firm's broader value contribution to clients beyond individual project delivery within their domain" },
          { id: 'cp-v2', text: 'Can frame their professional knowledge and insights in a way that helps clients see broader implications, opportunities, or perspectives relevant to their situation' }
        ]
      },
      {
        title: 'Client-recognised seniority & independence',
        items: [
          { id: 'cp-s1', text: 'Have the profile and competencies (CV) that justifies the hourly rate for Senior Consultant in the eyes of our clients' },
          { id: 'cp-s2', text: 'Can change to another client without significant reduction in independence and ability to drive projects' },
          { id: 'cp-s3', text: 'Can handle allocation on different projects on different clients in parallel' }
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
        title: 'Establishing independent project leadership & actively contributing to client relationship development',
        items: [
          { id: 'sd-pl', text: 'Project Leadership: Leads project(s) with consistent excellence, effectively handling project risks, managing timelines, and ensuring coordination between team members to meet client expectations for deliverables' },
          { id: 'sd-tl', text: 'Team Leadership: Seamlessly onboards consultants of all levels to project teams, demonstrating strong people management skills, especially during peak periods or through handovers, and resolving conflicts efficiently within the team' },
          { id: 'sd-cr', text: 'Client Relationship Development: Builds and manages relationships with client representatives, supporting stakeholder management efforts by understanding client needs and maintaining trust' },
          { id: 'sd-bd', text: 'Business Development: Contributes to the development of Statements of Work (SoW) and assists in the creation of sales proposals for the clients they work with, as well as other clients within their area of expertise' }
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
        title: 'Deepening BD involvement, expanding leadership, and managing senior client relationships',
        items: [
          { id: 'ss-pl', text: 'Project Leadership: Leads complex project(s) independently, consistently ensuring project risks are mitigated, deliverables are met, and team coordination is effective to meet and exceed client expectations' },
          { id: 'ss-tl', text: 'Team Leadership: Manages resource allocation efficiently, especially during time-sensitive project phases, ensuring optimal utilization and prioritization of team members across multiple projects' },
          { id: 'ss-cr', text: 'Client Relationship Development: Manages relationships with senior client representatives, demonstrating the ability to engage with key stakeholders at the senior management level relative to the size and structure of the organization' },
          { id: 'ss-bd', text: 'Business Development: Actively contributor in the outlining proposals for both potential and current clients, being recognized as a key contributor during client-facing engagement meetings alongside Account Managers or Business Development (BD) Leads' }
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
        title: 'Coaching excellence, leading entire teams, and driving business growth independently',
        items: [
          { id: 'sp-pl', text: 'Project Leadership: Fully accountable for all aspects of project delivery, including quality assurance, risk management, and ensuring client satisfaction, driving projects to completion without oversight' },
          { id: 'sp-tl', text: 'Team Leadership: Coaches multiple consultants across all levels, fostering a culture of excellence, while ensuring high-quality project management and stakeholder engagement within the team they lead' },
          { id: 'sp-cr', text: 'Client Relationship Development: Leads executive-level stakeholder management, building and sustaining strong relationships with senior decision-makers (including executive management and steering committees), ensuring alignment with high-level business objectives and long-term client satisfaction' },
          { id: 'sp-bd', text: 'Business Development: Independently creates and completes proposals from end to end (E2E) for new projects (beyond extensions or expansions), guiding the proposal process with limited input from BD Leads or Account Managers, and contributing directly to business growth' }
        ]
      }
    ]
  }
]);
