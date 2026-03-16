const SITE_CONFIG = {
  company: {
    name: 'AszureX',
    phone: '+91 9845803993',
    email: 'vishwasgv123@gmail.com'
  },
  
  services: [
    {
      id: 'customer-support',
      icon: '🧩',
      title: 'Customer Support (Non-Technical)',
      description: 'Comprehensive customer care handling all non-technical inquiries with professionalism and efficiency.',
      features: [
        'Answer customer queries (email/chat)',
        'Account & billing questions',
        'Refunds & cancellations',
        'Order/status tracking',
        'Basic product guidance'
      ]
    },
    {
      id: 'technical-l1',
      icon: '⚙️',
      title: 'Technical Support – L1',
      description: 'First-line technical assistance to quickly resolve common issues and guide users.',
      features: [
        'Troubleshoot issues',
        'Guide users through setup',
        'Validate errors',
        'Reproduce bugs',
        'Basic API checks',
        'Escalate real bugs to engineers'
      ]
    },
    {
      id: 'technical-l2',
      icon: '🧠',
      title: 'Technical Support – L2',
      description: 'Advanced technical expertise for complex problem-solving and deep analysis.',
      features: [
        'Root cause analysis',
        'API debugging',
        'SQL checks',
        'Configuration issues',
        'Environment validation',
        'Performance analysis'
      ]
    },
    {
      id: 'cloud-support',
      icon: '☁️',
      title: 'Cloud & Infrastructure Support',
      description: 'Expert management and monitoring of your cloud infrastructure for optimal performance.',
      features: [
        'Cloud service monitoring',
        'Uptime checks',
        'Deployment support',
        'Incident response',
        'Cloud cost analysis'
      ]
    },
    {
      id: 'application-support',
      icon: '🔁',
      title: 'Application Support',
      description: 'End-to-end application lifecycle support ensuring smooth operations.',
      features: [
        'Production issue handling',
        'Release support',
        'Incident management',
        'SLA tracking',
        'UAT & deployment support'
      ]
    },
    {
      id: 'customer-success',
      icon: '🤝',
      title: 'Customer Success Support',
      description: 'Proactive customer engagement to maximize value and drive retention.',
      features: [
        'Onboarding customers',
        'Usage tracking',
        'Feature adoption',
        'Reduce churn',
        'Success check-ins'
      ]
    },
    {
      id: 'documentation',
      icon: '📘',
      title: 'Documentation & Knowledge Base Support',
      description: 'Professional documentation to empower users and reduce support load.',
      features: [
        'Write FAQs',
        'Setup guides',
        'API docs',
        'Troubleshooting articles'
      ]
    },
    {
      id: 'incident-support',
      icon: '🔐',
      title: 'Incident & On-Call Support',
      description: '24/7 incident response and management to keep your systems running.',
      features: [
        'Incident response',
        'Root cause reports',
        'SLA management',
        'On-call rotations'
      ]
    },
    {
      id: 'data-reporting',
      icon: '📊',
      title: 'Data & Reporting Support',
      description: 'Actionable insights through comprehensive reporting and analytics.',
      features: [
        'Support metrics',
        'KPI tracking',
        'SLA reports',
        'Ticket analytics'
      ]
    },
    {
      id: 'accounting',
      icon: '🧾',
      title: 'Basic Accounting, Billing & Data Entry',
      description: 'Essential back-office support to keep your financial operations running smoothly.',
      features: [
        'Invoice creation & billing support',
        'Accounts receivable tracking',
        'Payment reconciliation',
        'Expense entry',
        'Vendor invoice data entry',
        'Excel / ERP updates',
        'Monthly reports'
      ]
    },
   {
  id: 'custom-software',
  icon: '💻',
  title: 'Custom Software Development',
  description: 'Design and development of custom web applications and internal business systems tailored to your operations.',
  features: [
    'Full-stack web development',
    'Internal business tools',
    'Business dashboards',
    'Workflow automation',
    'Scalable SaaS platforms'
  ]
},
{
  id: 'web-development',
  icon: '🌐',
  title: 'Web Application Development',
  description: 'Modern scalable web applications for startups and growing businesses.',
  features: [
    'Frontend development',
    'Backend development',
    'Admin dashboards',
    'API integrations',
    'Performance optimization'
  ]
},
{
  id: 'erp-implementation',
  icon: '🏢',
  title: 'ERP Implementation',
  description: 'Implementation and customization of ERP systems to automate operations.',
  features: [
    'ERPNext implementation',
    'Odoo implementation',
    'Inventory management',
    'Accounting automation',
    'Business workflow automation'
  ]
},
{
  id: 'crm-implementation',
  icon: '📇',
  title: 'CRM Implementation',
  description: 'CRM systems that help manage leads, sales pipelines and customer relationships.',
  features: [
    'HubSpot CRM setup',
    'Zoho CRM setup',
    'Sales pipeline automation',
    'Lead tracking',
    'Customer lifecycle management'
  ]
},
{
  id: 'api-integration',
  icon: '🔗',
  title: 'API Development & Integration',
  description: 'Connect systems together using APIs and automation workflows.',
  features: [
    'REST API development',
    'Payment gateway integration',
    'Third-party integrations',
    'Automation pipelines',
    'Webhook systems'
  ]
}
  ]
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SITE_CONFIG;
}