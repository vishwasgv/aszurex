const SITE_CONFIG = {
  company: {
    name: 'AszureX',
    phone: '+91 9845803993',
    email: 'contact@aszurex.com'
  },

  services: [
    {
      id: 'custom-software',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
      title: 'Custom Software Development',
      description: 'Design and development of custom web applications and internal business systems built precisely around your operations.',
      features: [
        'Full-stack web application development',
        'Internal business tools and dashboards',
        'Workflow automation systems',
        'Scalable SaaS platform architecture',
        'Admin panels and reporting interfaces'
      ]
    },
    {
      id: 'web-development',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
      title: 'Web Application Development',
      description: 'Modern, scalable web applications for startups and growth-stage businesses that need to move fast without breaking things.',
      features: [
        'Frontend development (React, Next.js)',
        'Backend APIs and services',
        'Admin dashboards and portals',
        'Third-party API integrations',
        'Performance optimization'
      ]
    },
    {
      id: 'erp-implementation',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
      title: 'ERP Implementation',
      description: 'End-to-end implementation and customization of ERP systems that automate operations and give you real visibility into your business.',
      features: [
        'ERPNext implementation and configuration',
        'Odoo setup and customization',
        'Inventory and supply chain management',
        'Accounting and finance automation',
        'Business workflow design and automation'
      ]
    },
    {
      id: 'crm-implementation',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      title: 'CRM Implementation',
      description: 'CRM systems configured to manage leads, automate follow-ups, and give your sales team a clear view of every opportunity.',
      features: [
        'HubSpot CRM setup and onboarding',
        'Zoho CRM configuration',
        'Sales pipeline design and automation',
        'Lead capture and tracking workflows',
        'Customer lifecycle management'
      ]
    },
    {
      id: 'api-integration',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
      title: 'API Development & Integration',
      description: 'Connect your systems, tools, and data sources through clean API architecture and automated integration pipelines.',
      features: [
        'REST API design and development',
        'Payment gateway integration',
        'Third-party service connections',
        'Automation pipelines and webhooks',
        'System data synchronization'
      ]
    },
    {
      id: 'customer-support',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      title: 'Customer Support (Non-Technical)',
      description: 'Professional customer care handling all non-technical inquiries with speed, clarity, and a consistent brand voice.',
      features: [
        'Email and chat query handling',
        'Account and billing questions',
        'Refunds, returns, and cancellations',
        'Order and status tracking',
        'Basic product guidance and FAQs'
      ]
    },
    {
      id: 'technical-l1',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>',
      title: 'Technical Support – L1',
      description: 'First-line technical assistance that quickly resolves common issues, guides users through setup, and escalates only what truly needs engineering.',
      features: [
        'User troubleshooting and guidance',
        'Bug reproduction and validation',
        'Basic API and configuration checks',
        'Error log review and triage',
        'Escalation of confirmed engineering issues'
      ]
    },
    {
      id: 'technical-l2',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>',
      title: 'Technical Support – L2',
      description: 'Advanced technical expertise for complex problem-solving, root cause analysis, and deep system investigation.',
      features: [
        'Root cause analysis and reporting',
        'API and backend debugging',
        'Database query investigation',
        'Environment and configuration validation',
        'Performance and regression analysis'
      ]
    },
    {
      id: 'cloud-support',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
      title: 'Cloud & Infrastructure Support',
      description: 'Expert management and monitoring of your cloud infrastructure to keep systems performant, available, and cost-efficient.',
      features: [
        'Cloud service monitoring and alerting',
        'Uptime and availability checks',
        'Deployment and release support',
        'Incident detection and response',
        'Cloud cost analysis and optimization'
      ]
    },
    {
      id: 'application-support',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
      title: 'Application Support',
      description: 'End-to-end application lifecycle support that handles production issues, release coordination, and SLA management so your engineers can focus on building.',
      features: [
        'Production issue triage and resolution',
        'Release and deployment coordination',
        'Incident management and post-mortems',
        'SLA tracking and reporting',
        'UAT and pre-release validation'
      ]
    },
    {
      id: 'customer-success',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>',
      title: 'Customer Success Support',
      description: 'Proactive customer engagement that drives adoption, reduces churn, and turns your users into long-term advocates.',
      features: [
        'New customer onboarding and guidance',
        'Product usage and engagement tracking',
        'Feature adoption campaigns',
        'Churn risk identification and recovery',
        'Regular success check-ins'
      ]
    },
    {
      id: 'documentation',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
      title: 'Documentation & Knowledge Base',
      description: 'Professional documentation that empowers users to self-serve and reduces inbound support volume over time.',
      features: [
        'User-facing FAQs and guides',
        'Product setup and onboarding docs',
        'API reference documentation',
        'Troubleshooting article creation',
        'Knowledge base structure and taxonomy'
      ]
    },
    {
      id: 'incident-support',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      title: 'Incident & On-Call Support',
      description: 'Reliable incident response and on-call coverage that keeps your systems running and your customers informed when things go wrong.',
      features: [
        'Incident detection and escalation',
        'Root cause analysis reports',
        'SLA management and compliance',
        'On-call rotation coverage',
        'Post-incident documentation'
      ]
    },
    {
      id: 'data-reporting',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
      title: 'Data & Reporting Support',
      description: 'Actionable reporting and analytics that give you visibility into support performance, SLA compliance, and customer health.',
      features: [
        'Support metrics dashboards',
        'KPI definition and tracking',
        'SLA compliance reports',
        'Ticket volume and trend analytics',
        'Monthly performance summaries'
      ]
    },
    {
      id: 'accounting',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
      title: 'Basic Accounting, Billing & Data Entry',
      description: 'Dependable back-office support to keep your financial records accurate, your invoices moving, and your books clean.',
      features: [
        'Invoice creation and billing support',
        'Accounts receivable tracking',
        'Payment reconciliation',
        'Expense and vendor invoice entry',
        'ERP and spreadsheet data updates',
        'Monthly financial summary reports'
      ]
    }
  ]
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SITE_CONFIG;
}
