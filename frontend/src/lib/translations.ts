export type Language = 'en' | 'bn';

export interface PresetScenario {
  label: string;
  tag: string;
  lang: 'en' | 'bn';
  email: string;
  message: string;
}

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    label: "📦 Order Status Check (ORD-1001)",
    tag: "Tool Calling",
    lang: "en",
    email: "john@example.com",
    message: "Hi team, could you check the status of my order ORD-1001 and let me know when it arrives?"
  },
  {
    label: "📚 RAG Knowledge Base Query",
    tag: "Qdrant RAG",
    lang: "en",
    email: "visitor@techcorp.io",
    message: "What AI services, custom agent architectures, and RAG integration does ZENIVIXON offer for modern businesses?"
  },
  {
    label: "⚠️ Delayed Delivery (Enterprise)",
    tag: "Enterprise Tier",
    lang: "en",
    email: "enterprise@bigcorp.com",
    message: "Our high-priority shipment ORD-1003 is still marked delayed. Please provide an expedited status update."
  },
  {
    label: "🚨 Urgent Refund (Safety Gate)",
    tag: "Safety Gate",
    lang: "en",
    email: "angry@customer.com",
    message: "I demand an immediate refund for invoice INV-9902! Your service went down and this is completely unacceptable."
  },
  {
    label: "🇧🇩 অর্ডারের খবর (ORD-1001)",
    tag: "বাংলা / Tool Calling",
    lang: "bn",
    email: "john@example.com",
    message: "আমার অর্ডার ORD-1001 এর খবর কী? কবে ডেলিভারি পাব?"
  },
  {
    label: "🇧🇩 রিফান্ড দাবি (Safety Gate)",
    tag: "বাংলা / Safety Gate",
    lang: "bn",
    email: "angry@customer.com",
    message: "আপনাদের সার্ভিস বন্ধ হয়ে যাওয়ার কারণে আমার অনেক ক্ষতি হয়েছে! আমি অবিলম্বে ইনভয়েস INV-9902 এর ফুল রিফান্ড চাই।"
  }
];

export const TRANSLATIONS = {
  en: {
    // Brand & Header
    brandSubCustomer: "Customer Support & Helpdesk",
    brandSubTeam: "Operations & Triage Control Center",
    supportAi: "SUPPORT AI",
    customerPortal: "Customer Portal",
    teamConsole: "Team Console",
    langEn: "English",
    langBn: "বাংলা",
    
    // Customer Portal Hero
    heroBadge: "Powered by ZENIVIXON Autonomous Support Engine",
    heroTitle: "How can we help you today?",
    heroDesc: "Submit your inquiry or technical issue below. Our AI support engine resolves common requests instantly, with direct escalation to senior engineers when needed.",
    tabSubmit: "Submit Support Ticket",
    tabTrack: "Track Ticket Status",
    
    // Customer Submit Form
    formEmailLabel: "Your Email Address",
    formEmailReq: "*",
    formEmailPlaceholder: "e.g. name@company.com",
    formEmailSub: "We'll send the resolution or engineering update to this email.",
    formMessageLabel: "Describe Your Issue or Inquiry",
    formMessagePlaceholder: "Please describe your question, issue, or request in detail (e.g. Where is my order ORD-1001?)...",
    commonInquiries: "Common Inquiries:",
    submitBtn: "Submit Support Ticket",
    submittingBtn: "Processing with AI Support Engine...",
    
    // Quick Inquiry Prompts
    promptAiServices: "What AI services and custom agent solutions does ZENIVIXON build?",
    promptRagPipeline: "I need help integrating an enterprise vector RAG pipeline",
    promptOrderStatus: "Check status of my latest active order ORD-1001",
    promptRefundIssue: "Urgent inquiry regarding refund for invoice INV-9902",
    
    // Customer Submission Result
    resolvedHeader: "Ticket Automatically Resolved by AI Engine",
    escalatedHeader: "Ticket Prioritized & Escalated to Senior Team",
    resolvedSub: "Our knowledge-grounded AI support engine successfully analyzed and answered your inquiry below.",
    escalatedSub: "Our automated safety gate has escalated your request to a senior ZENIVIXON engineer. We will review your context and contact you shortly.",
    officialResponse: "Official Response:",
    copy: "Copy",
    copied: "Copied",
    ticketIdNotice: "Save Ticket ID",
    forTracking: "for future tracking.",
    submitAnother: "Submit Another Ticket",
    
    // Customer Track
    trackTitle: "Track Existing Support Ticket",
    trackDesc: "Enter your numeric Ticket ID (e.g. 26 or #TKT-26) to see live status, findings, and responses.",
    trackPlaceholder: "Enter Ticket ID (e.g. 26)",
    trackBtn: "Track",
    yourMessage: "Your Submitted Message:",
    trackUnderReview: "This ticket is currently under review by our senior support engineers. We will update you via email soon.",
    categoryLabel: "Category:",
    createdLabel: "Created:",
    
    // Team Operations Header & Nav
    internalOps: "INTERNAL OPERATIONS",
    authorizedSession: "Authorized Session",
    telemetryTitle: "Support AI Telemetry & Triage Engine",
    backCustomer: "Back to Customer Portal",
    syncDb: "Sync DB",
    opsConsole: "Operations Console",
    inboundLedger: "Inbound Ticket Ledger",
    
    // KPI Cards
    kpiTotal: "Total Tickets",
    kpiTotalSub: "Recorded in PostgreSQL ledger",
    kpiResolved: "Autonomous Resolved",
    kpiEscalated: "Human Escalated",
    kpiAvgChurn: "Avg Churn Risk",
    kpiRetentionSafe: "Customer Retention Safe",
    kpiLatency: "Pipeline Latency",
    kpiLatencySub: "LangGraph 6-Node Execution",
    resolutionRate: "Resolution Rate",
    escalationRate: "Safety Escalation Rate",
    
    // Monitoring Charts
    trendTitle: "7-Day Resolution & Triage Live Trend",
    trendDesc: "Daily incoming ticket volume and autonomous vs escalated outcome",
    trendTotal: "Total",
    trendResolved: "Auto-Resolved",
    trendEscalated: "Escalated",
    catDistribution: "Category Breakdown",
    liveDistribution: "Live Distribution",
    portfolioRisk: "Portfolio Risk",
    healthy: "Healthy",
    
    // Simulator
    simulatorTitle: "Agent Simulator & Quick Discovery Presets",
    simulatorDesc: "Test how the LangGraph pipeline categorizes, retrieves knowledge, executes tools, and evaluates safety.",
    simEmailLabel: "Simulated Customer Email",
    simMessageLabel: "Customer Inquiry Message",
    simRunBtn: "Run LangGraph Pipeline",
    simRunningBtn: "Executing 6 Agent Nodes...",
    
    // LangGraph Architecture
    architectureTitle: "LangGraph Architecture Pipeline Flow",
    node1: "1. Intake & NLU",
    node1Desc: "Gemini classifies category, sentiment & intent",
    node2: "2. Identity Verification",
    node2Desc: "Validates customer & tier from DB",
    node3: "3. Tool Execution",
    node3Desc: "Queries Orders, Invoices & Qdrant RAG",
    node4: "4. Resolution Engine",
    node4Desc: "Synthesizes contextual grounded answer",
    node5: "5. Safety & Churn Gate",
    node5Desc: "Evaluates deterministic policy & Churn %",
    node6: "6. Zendesk Handoff",
    node6Desc: "Packages context for human escalation",
    
    // Inbound Ticket Ledger Table
    ledgerTitle: "Inbound Support Ticket Ledger",
    ledgerDesc: "Real-time audit log of customer tickets, deterministic routing outcomes, and sentiment triage.",
    searchPlaceholder: "Search by email, message or ID...",
    filterAllStatus: "All Statuses",
    filterResolved: "Resolved Only",
    filterEscalated: "Escalated Only",
    filterAllCats: "All Categories",
    colId: "ID",
    colCustomer: "Customer",
    colCategory: "Category",
    colSentiment: "Sentiment",
    colPriority: "Priority",
    colChurnRisk: "Churn Risk",
    colStatus: "Status",
    colActions: "Actions",
    inspectBtn: "Inspect",
    noTicketsFound: "No tickets found matching your query.",
    
    // Ticket Inspector Modal
    inspectorTitle: "Ticket Inspector",
    retentionAdvisorTitle: "AI Churn Risk & Retention Advisor Guidance",
    rawInquiryTitle: "Raw Customer Inquiry",
    diagnosticFindings: "AI Diagnostic Findings",
    officialResponseModal: "Official Response / Solution",
    escalationReasonModal: "Escalation Policy Triggered",
    quickChangeStatus: "Update Status:",
    closeBtn: "Close Inspector",
    
    // Passcode Modal
    passcodeTitle: "Restricted Operations Console",
    passcodeDesc: "Enter team passphrase to access operations telemetry, internal metrics, and Zendesk queue.",
    passcodePlaceholder: "Enter Passphrase (e.g. zenivixon)",
    passcodeSubmit: "Unlock Console",
    passcodeInvalid: "Invalid passphrase. Try 'zenivixon' or 'zenivixon admin panel'."
  },
  bn: {
    // Brand & Header
    brandSubCustomer: "গ্রাহক সহায়তা ও হেল্পডেস্ক",
    brandSubTeam: "অপারেশনস ও ট্রায়াজ কন্ট্রোল সেন্টার",
    supportAi: "সাপোর্ট এআই",
    customerPortal: "কাস্টমার পোর্টাল",
    teamConsole: "টিম কনসোল",
    langEn: "English",
    langBn: "বাংলা",
    
    // Customer Portal Hero
    heroBadge: "ZENIVIXON স্বয়ংক্রিয় সাপোর্ট ইঞ্জিন দ্বারা চালিত",
    heroTitle: "আজ আমরা আপনাকে কীভাবে সাহায্য করতে পারি?",
    heroDesc: "আপনার অনুসন্ধান বা সমস্যা নিচে লিখুন। সাধারণ জিজ্ঞাসাগুলো আমাদের এআই তাত্ক্ষণিকভাবে সমাধান করে এবং জটিল বিষয়ে সিনিয়র ইঞ্জিনিয়ারদের কাছে এসকেলেট করে।",
    tabSubmit: "সাপোর্ট টিকেট জমা দিন",
    tabTrack: "টিকেট স্ট্যাটাস ট্র্যাক করুন",
    
    // Customer Submit Form
    formEmailLabel: "আপনার ইমেইল ঠিকানা",
    formEmailReq: "*",
    formEmailPlaceholder: "যেমন: name@company.com",
    formEmailSub: "আমরা সমাধানের বিবরণ বা ইঞ্জিনিয়ারিং আপডেট এই ইমেইলে পাঠাব।",
    formMessageLabel: "আপনার সমস্যা বা প্রশ্ন বিস্তারিত লিখুন",
    formMessagePlaceholder: "অনুগ্রহ করে আপনার প্রশ্ন বা সমস্যা বিস্তারিত লিখুন (যেমন: আমার অর্ডার ORD-1001 এর খবর কী?)...",
    commonInquiries: "সাধারণ জিজ্ঞাসা:",
    submitBtn: "অনুরোধ পাঠান",
    submittingBtn: "এআই সাপোর্ট ইঞ্জিন বিশ্লেষণ করছে...",
    
    // Quick Inquiry Prompts
    promptAiServices: "ZENIVIXON কোন কোন এআই সার্ভিস ও কাস্টম এজেন্ট সলিউশন তৈরি করে?",
    promptRagPipeline: "আমাদের এন্টারপ্রাইজ ভেক্টর RAG পাইপলাইন ইন্টিগ্রেশন প্রয়োজন",
    promptOrderStatus: "আমার সর্বশেষ একটিভ অর্ডার ORD-1001 এর স্ট্যাটাস চেক করুন",
    promptRefundIssue: "ইনভয়েস INV-9902 এর রিফান্ড সংক্রান্ত জরুরি আবেদন",
    
    // Customer Submission Result
    resolvedHeader: "এআই ইঞ্জিন দ্বারা স্বয়ংক্রিয় সমাধান সম্পন্ন",
    escalatedHeader: "টিকেট অগ্রাধিকারসহ সিনিয়র টিমের কাছে পাঠানো হয়েছে",
    resolvedSub: "আমাদের নলেজ বেস ও সিস্টেম ডাটা বিশ্লেষণ করে আপনার প্রশ্নের নির্ভুল উত্তর নিচে তৈরি করা হয়েছে।",
    escalatedSub: "স্বয়ংক্রিয় সেফটি গেট এই অনুরোধটি সিনিয়র ইঞ্জিনিয়ারের কাছে হস্তান্তর করেছে। আমরা দ্রুত আপনার ইমেইলে যোগাযোগ করব।",
    officialResponse: "অফিসিয়াল উত্তর:",
    copy: "কপি",
    copied: "কপি হয়েছে",
    ticketIdNotice: "টিকেট আইডি সংরক্ষণ করুন:",
    forTracking: "ভবিষ্যতে ট্র্যাকিংয়ের জন্য।",
    submitAnother: "নতুন টিকেট পাঠান",
    
    // Customer Track
    trackTitle: "পূর্বের টিকেট স্ট্যাটাস ট্র্যাক করুন",
    trackDesc: "লাইভ স্ট্যাটাস ও উত্তর দেখতে আপনার টিকেট নম্বর দিন (যেমন: ২৬ বা #TKT-26)।",
    trackPlaceholder: "টিকেট নম্বর দিন (যেমন: 26)",
    trackBtn: "ট্র্যাক করুন",
    yourMessage: "আপনার পাঠানো মেসেজ:",
    trackUnderReview: "এই টিকেটটি বর্তমানে আমাদের সিনিয়র সাপোর্ট ইঞ্জিনিয়ারদের পর্যালোচনায় রয়েছে। দ্রুত ইমেইলে আপডেট জানানো হবে।",
    categoryLabel: "ক্যাটাগরি:",
    createdLabel: "তৈরি:",
    
    // Team Operations Header & Nav
    internalOps: "অভ্যন্তরীণ অপারেশনস",
    authorizedSession: "অনুমোদিত সেশন",
    telemetryTitle: "সাপোর্ট এআই টেলিমেট্রি ও ট্রায়াজ ইঞ্জিন",
    backCustomer: "কাস্টমার পোর্টালে ফিরুন",
    syncDb: "ডাটাবেজ রিফ্রেশ",
    opsConsole: "অপারেশনস কনসোল",
    inboundLedger: "ইনবাউন্ড টিকেট লেজার",
    
    // KPI Cards
    kpiTotal: "মোট টিকেট",
    kpiTotalSub: "PostgreSQL লেজারে সংরক্ষিত",
    kpiResolved: "স্বয়ংক্রিয় সমাধান",
    kpiEscalated: "হিউম্যান এসকেলেশন",
    kpiAvgChurn: "গড় চার্ন রিস্ক",
    kpiRetentionSafe: "কাস্টমার রিটেনশন নিরাপদ",
    kpiLatency: "পাইপলাইন লেটেন্সি",
    kpiLatencySub: "ল্যাংগ্রাফ ৬-নোড এক্সিকিউশন",
    resolutionRate: "রেজল্যুশন হার",
    escalationRate: "সেফটি এসকেলেশন হার",
    
    // Monitoring Charts
    trendTitle: "৭ দিনের রেজল্যুশন ও ট্রায়াজ লাইভ ট্রেন্ড",
    trendDesc: "দৈনিক আগত টিকেটের পরিমাণ এবং এআই সমাধান বনাম এসকেলেশন অনুপাত",
    trendTotal: "মোট",
    trendResolved: "অটো-রিসলভড",
    trendEscalated: "এসকেলেটেড",
    catDistribution: "ক্যাটাগরি অনুযায়ী টিকেট বিন্যাস",
    liveDistribution: "লাইভ ডিস্ট্রিবিউশন",
    portfolioRisk: "পোর্টফোলিও রিস্ক",
    healthy: "নিরাপদ",
    
    // Simulator
    simulatorTitle: "অটোনোমাস ট্রায়াজ সিমুলেশন রানার",
    simulatorDesc: "৬-নোডের ল্যাংগ্রাফ পাইপলাইনে কাস্টমার টিকেট চালিয়ে লাইভ রাউটিং এবং টুল কলিং পরীক্ষা করুন।",
    simEmailLabel: "সিমুলেটেড কাস্টমার ইমেইল",
    simMessageLabel: "কাস্টমার ইনকোয়ারি মেসেজ",
    simRunBtn: "সম্পূর্ণ ল্যাংগ্রাফ পাইপলাইন চালান",
    simRunningBtn: "৬টি এজেন্ট নোড চলছে...",
    
    // LangGraph Architecture
    architectureTitle: "ল্যাংগ্রাফ আর্কিটেকচার পাইপলাইন ফ্লো",
    node1: "১. ইনটেক ও এনএলইউ",
    node1Desc: "Gemini ক্যাটাগরি, সেন্টিমেন্ট ও ইনটেন্ট বিশ্লেষণ করে",
    node2: "২. আইডেন্টিটি ভেরিফিকেশন",
    node2Desc: "ডাটাবেজ থেকে কাস্টমার ও টিয়ার ভেরিফাই করে",
    node3: "৩. টুল এক্সিকিউশন",
    node3Desc: "অর্ডার, ইনভয়েস ও Qdrant RAG কোয়েরি করে",
    node4: "৪. রেজল্যুশন ইঞ্জিন",
    node4Desc: "সিস্টেম ডাটা নির্ভর প্রাসঙ্গিক উত্তর তৈরি করে",
    node5: "৫. সেফটি ও চার্ন গেট",
    node5Desc: "ডিটারমিনিস্টিক পলিসি ও চার্ন % নির্ণয় করে",
    node6: "৬. জেনডেস্ক হ্যান্ডঅফ",
    node6Desc: "হিউম্যান এসকেলেশনের জন্য কনটেক্সট তৈরি করে",
    
    // Inbound Ticket Ledger Table
    ledgerTitle: "ইনবাউন্ড সাপোর্ট টিকেট লেজার",
    ledgerDesc: "কাস্টমার টিকেট, রাউটিং ফলাফল এবং সেন্টিমেন্ট বিশ্লেষণের রিয়েল-টাইম অডিট লগ।",
    searchPlaceholder: "ইমেইল, মেসেজ বা আইডি দিয়ে খুঁজুন...",
    filterAllStatus: "সব স্ট্যাটাস",
    filterResolved: "শুধুমাত্র রিসলভড",
    filterEscalated: "শুধুমাত্র এসকেলেটেড",
    filterAllCats: "সব ক্যাটাগরি",
    colId: "আইডি",
    colCustomer: "কাস্টমার",
    colCategory: "ক্যাটাগরি",
    colSentiment: "সেন্টিমেন্ট",
    colPriority: "অগ্রাধিকার",
    colChurnRisk: "চার্ন রিস্ক",
    colStatus: "স্ট্যাটাস",
    colActions: "অ্যাকশন",
    inspectBtn: "বিস্তারিত",
    noTicketsFound: "কোনো টিকেট পাওয়া যায়নি।",
    
    // Ticket Inspector Modal
    inspectorTitle: "টিকেট ইন্সপেক্টর",
    retentionAdvisorTitle: "এআই চার্ন রিস্ক ও রিটেনশন অ্যাডভাইজর পরামর্শ",
    rawInquiryTitle: "গ্রাহকের মূল জিজ্ঞাসা",
    diagnosticFindings: "এআই ডায়াগনস্টিক তথ্য",
    officialResponseModal: "অফিসিয়াল উত্তর / সমাধান",
    escalationReasonModal: "পলিসি কারণে এসকেলেট করা হয়েছে",
    quickChangeStatus: "স্ট্যাটাস আপডেট করুন:",
    closeBtn: "ইন্সপেক্টর বন্ধ করুন",
    
    // Passcode Modal
    passcodeTitle: "সুরক্ষিত অপারেশনস কনসোল",
    passcodeDesc: "অপারেশনস টেলিমেট্রি এবং জেনডেস্ক কিউ অ্যাক্সেস করতে টিম পাসকোড প্রবেশ করান।",
    passcodePlaceholder: "পাসকোড দিন (যেমন: zenivixon)",
    passcodeSubmit: "কনসোল আনলক করুন",
    passcodeInvalid: "ভুল পাসকোড। 'zenivixon' অথবা 'zenivixon admin panel' ব্যবহার করুন।"
  }
};
