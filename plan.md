# ZENIVIXON Support AI — Portfolio-Best Upgrade & Bug Fix Plan

## 🎯 মূল লক্ষ্য (North Star Goal)
**ZENIVIXON Support AI**-কে একটি সাধারণ ডেমো থেকে **Production-Grade, Recruiter-Ready ও Client-Ready Flagship Portfolio Project**-এ রূপান্তর করা—যেখানে কোনো ক্রিটিক্যাল বাগ, সিকিউরিটি দুর্বলতা, ফেক মেট্রিক্স বা অকার্যকর UI বাটন থাকবে না এবং একজন টেকনিক্যাল ইন্টারভিউয়ার বা ক্লায়েন্ট ৫ মিনিটেই এর রিয়েল-ওয়ার্ল্ড ইঞ্জিনিয়ারিং মান বুঝতে পারবে।

### পোর্টফোলিও "Best-in-Class" হওয়ার মানদণ্ড (Success Criteria)
- [x] **Zero Critical Bugs:** LangGraph state, LLM config, এবং DB/RAG পাইপলাইন ১০০% নির্ভুলভাবে কাজ করবে।
- [x] **Security Hardened:** হার্ডকোডেড সিক্রেট, IDOR ঝুঁকি, এবং Email Impersonation সম্পূর্ণভাবে বন্ধ থাকবে।
- [x] **100% Real Telemetry:** ড্যাশবোর্ডের প্রতিটি সংখ্যা (Latency, Churn Risk, 7-Day Trend, Category Breakdown) রিয়েল ডাটাবেজ/রানটাইম থেকে আসবে—কোনো ডামি বা হার্ডকোডেড ডেটা থাকবে না।
- [x] **Clean, Modular Codebase:** ফ্রন্টএন্ড ছোট কম্পোনেন্টে বিভক্ত, টাইপ-সেফ (`no any`), এবং ব্যাকএন্ডে পিন করা ডিপেন্ডেন্সি ও ক্লিন টেস্ট স্যুট থাকবে।
- [x] **Live Interactive Proof:** Automated API + Agent টেস্ট স্যুট (CI-ready), একদম নির্ভুল আর্কিটেকচার ডায়াগ্রাম, এবং একটি পরিষ্কার ডেমো ফ্লো।

---

## 🛠️ Phase 1: Critical Bug Fixes (সর্বোচ্চ অগ্রাধিকার)

### 1.1 LangGraph State-এ `customer_tier` যুক্ত করা
- **ফাইল:** `backend/agents/state.py`
- **সমস্যা:** `TicketState`-এ `customer_tier` না থাকায় LangGraph সেটি ড্রপ করে দেয়, ফলে Enterprise VIP কাস্টমারের Churn Risk (`+15%`) ও VIP রিটেনশন অ্যাডভাইস কখনো ট্রিগার হয় না।
- **সমাধান:** `TicketState`-এ `customer_tier: Optional[str]` যুক্ত করা এবং `verify_node` ও `calculate_churn_risk`-এর জন্য ইউনিট টেস্ট যোগ করা।

### 1.2 ডিফল্ট Gemini মডেল ফিক্স করা
- **ফাইল:** `backend/agents/nodes.py`, `README.md`
- **সমস্যা:** ডিফল্ট মডেল `"gemini-3.8-flash"` সেট করা, যা ইনভ্যালিড।
- **সমাধান:** ডিফল্ট মডেল `"gemini-2.5-flash"` করা (যা `.env.example`-এর সাথে সামঞ্জস্যপূর্ণ) এবং `README.md`-এর ব্যাজ ও ডকস আপডেট করা।

### 1.3 `is_verified` ফ্ল্যাগ ফিক্স করা
- **ফাইল:** `backend/main.py`
- **সমস্যা:** `portal_track_ticket`, `get_ticket_detail`, এবং `submit_ticket`-এ `is_active=False` গেস্ট ইউজারদেরও `is_verified: True` রিটার্ন করে।
- **সমাধান:**
  - `portal_track_ticket` ও `get_ticket_detail`-এ `bool(ticket.customer and ticket.customer.is_active)` ব্যবহার করা।
  - `submit_ticket`-এ ডিফল্ট ফলব্যাক `final_state.get("is_verified", False)` করা।

### 1.4 ক্যাটাগরি ও KPI অসঙ্গতি ফিক্স করা
- **ফাইল:** `backend/main.py`, `frontend/src/app/page.tsx`
- **সমস্যা:** `Refund` ও `Security` ক্যাটাগরি ড্যাশবোর্ডে ড্রপ হয়; `"Tickets Today"` আসলে all-time total।
- **সমাধান:**
  - `dashboard_stats`-এর `categories` লিস্টে `"Refund"` এবং `"Security"` যুক্ত করা (এবং ফ্রন্টএন্ডের Category Breakdown-এ সব ক্যাটাগরি দেখানো)।
  - API-তে `total_tickets` (all-time) ও `tickets_today` (আজকের UTC তারিখের টিকেট) আলাদাভাবে রিটার্ন করা।

---

## 🔒 Phase 2: Security Hardening (প্রোডাকশন সিকিউরিটি)

### 2.1 হার্ডকোডেড পাসকোড ও ক্লায়েন্ট-সাইড সিক্রেট অপসারণ
- **ফাইল:** `backend/main.py`, `frontend/src/app/page.tsx`, `frontend/src/lib/translations.ts`
- **সমাধান:**
  - ফ্রন্টএন্ড থেকে `'X-Admin-Passcode': adminPasscode || 'zenivixon'` ফলব্যাক সম্পূর্ণ মুছে ফেলা।
  - এরর মেসেজ থেকে পাসকোড হিন্ট (`Try 'zenivixon'...`) সরিয়ে ফেলা।
  - ব্যাকএন্ডে `ADMIN_PASSCODES` এনভায়রনমেন্ট ভেরিয়েবল থেকে লোড করা (শুধু ডেভেলপমেন্টের জন্য `.env.example`-এ ডকুমেন্ট করা), এবং সিকিউর টাইমিং-সেফ কম্প্যারিসন (`hmac.compare_digest`) ব্যবহার করা।

### 2.2 IDOR ও Account Impersonation প্রতিরোধ
- **ফাইল:** `backend/core/tools.py`, `backend/agents/nodes.py`, `backend/main.py`
- **সমাধান:**
  - `get_order` এবং `get_invoice`-এ `customer_id: int` বাধ্যতামূলক (required) করা—`customer_id` না থাকলে বা `is_verified=False` হলে সরাসরি `None` রিটার্ন করবে।
  - Unverified পাবলিক টিকেট সাবমিশনে প্রাইভেট অর্ডার/ইনভয়েস ডেটা সরাসরি এক্সপোজ না করে শুধু পাবলিক KB উত্তর দেওয়া বা ভেরিফিকেশন টোকেন/অর্ডার কোড ম্যাচিং চালু করা (ডেমো মোডের জন্য স্পষ্ট ব্যাজসহ)।

### 2.3 Input Validation, Rate Limiting ও CORS
- **ফাইল:** `backend/main.py`, `backend/requirements.txt`
- **সমাধান:**
  - `TicketRequest`-এ `pydantic.EmailStr` এবং `message: str = Field(..., min_length=3, max_length=2000)` যুক্ত করা।
  - `POST /api/tickets` এবং `/api/portal/track`-এ বেসিক ইন-মেমোরি রেট লিমিটিং (যেমন `slowapi` বা কাস্টম middleware) যুক্ত করা।
  - `ALLOWED_ORIGINS` প্রোডাকশনের জন্য নির্দিষ্ট অরিজিনে সীমাবদ্ধ রাখার ব্যবস্থা করা।

### 2.4 Zendesk ও Infrastructure হার্ডেনিং
- **ফাইল:** `backend/core/zendesk.py`, `docker-compose.yml`, `bridge/base/postgres-deployment.yaml`
- **সমাধান:**
  - `zendesk.py`-এ `load_dotenv()` যুক্ত করা এবং সব `requests.post`-এ `timeout=10` সেট করা।
  - `docker-compose.yml`-এ `${POSTGRES_PASSWORD:-changeme}` ব্যবহার করা এবং অব্যবহৃত `redis` সার্ভিস বাদ দেওয়া (অথবা রেট-লিমিটিং/ক্যাশিংয়ে সত্যিকারের কাজে লাগানো)।

---

## 🎨 Phase 3: Frontend Refactoring & Real UX Polish

### 3.1 `page.tsx` মডুলার রিফ্যাক্টর (1,789 লাইন → ক্লিন কম্পোনেন্টস)
- **ফাইল:** `frontend/src/app/page.tsx` → নতুন কম্পোনেন্টস:
  - `frontend/src/components/Header.tsx`
  - `frontend/src/components/CustomerPortal.tsx` (Submit + Track sub-tabs)
  - `frontend/src/components/TeamDashboard.tsx` (KPIs + Charts + Simulator)
  - `frontend/src/components/TicketLedger.tsx` (Filterable Table)
  - `frontend/src/components/TicketInspectorModal.tsx`
  - `frontend/src/components/PasscodeModal.tsx`
- **উপকারিতা:** কোড রিডেবিলিটি, মেইনটেন্যান্স এবং পোর্টফোলিও রিভিউয়ে বিশাল ইমপ্যাক্ট ফেলবে।

### 3.2 অকার্যকর বাটন ও UX বাগ ফিক্স
- **ফাইল:** `frontend/src/components/HandoffPackage.tsx`, `frontend/src/app/page.tsx`
- **সমাধান:**
  - `HandoffPackage`-এর **Dismiss** বাটনে `onDismiss` প্রপ এবং **Start Replying in Zendesk** বাটনে আসল অ্যাকশন (যেমন ড্রাফট কপি + Zendesk URL/Modal ওপেন) যুক্ত করা।
  - `handleCustomerSubmit` এবং `simulateTicket`-এ এরর স্টেট (`submitError`, `simError`) দেখানো যেন API ফেইল হলে ইউজার স্পষ্ট ফিডব্যাক পায়।
  - `HandoffPackage`-এ লাইভ `simMessage`-এর বদলে API রেসপন্স থেকে পাওয়া `raw_message` পাস করা।
  - `useEffect`-এর ডুপ্লিকেট ফেচ বাগ ফিক্স করা।

### 3.3 ডামি মেট্রিক্স সরিয়ে ১০০% রিয়েল টেলিমেট্রি
- **ফাইল:** `backend/main.py`, `backend/db/models.py`, `frontend/src/app/page.tsx`
- **সমাধান:**
  - ব্যাকএন্ডে প্রতিটি টিকেটের আসল `processing_time_ms` (পাইপলাইন লেটেন্সি) মেপে ডাটাবেজে সেভ করা এবং ড্যাশবোর্ডে আসল Average Latency দেখানো (হার্ডকোডেড `~ 1.8 sec`-এর বদলে)।
  - `Portfolio Risk` ব্যাজকে ডাইনামিক করা: `<35%` = Healthy (সবুজ), `35-60%` = Moderate (অ্যাম্বার), `>60%` = High Risk (লাল)।
  - `daily_trend` ফাঁকা থাকলে ডামি `Oct 14–Oct 20` না দেখিয়ে আসল Empty State দেখানো।

---

## ⭐ Phase 4: Portfolio "Wow Factor" Features (Standout Upgrades)

পোর্টফোলিওতে অন্য সবার থেকে আলাদা হতে নিচের ৩টি হাই-ইমপ্যাক্ট ফিচার যুক্ত করা যেতে পারে:

1. **Real-Time SSE Streaming Pipeline Trace (লাইভ এজেন্ট স্টেপার):**
   - বর্তমানে ফ্রন্টএন্ডে `setInterval` দিয়ে ফেক প্রোগ্রেস স্টেপ (`1.1s` পরপর) দেখানো হয়। এর বদলে FastAPI `StreamingResponse` (SSE) + LangGraph `.stream()` ব্যবহার করে আসল নোড এক্সিকিউশন লাইভ UI-তে দেখালে এটি ইন্টারভিউয়ারদের দারুণভাবে ইমপ্রেস করবে।
2. **Admin Knowledge Base Manager (UI থেকে KB আপলোড):**
   - Team Console-এ একটি ছোট ট্যাব যোগ করা যেখানে নতুন FAQ/ডকুমেন্ট (Markdown/Text) যোগ করে সরাসরি Qdrant-এ ইনজেস্ট ও টেস্ট করা যাবে।
3. **Interactive Evaluation / Benchmark Report:**
   - একটি ছোট Evaluation স্ক্রিপ্ট (`backend/eval_agent.py`) যা ১০–১৫টি টেস্ট কেসে (English + Bengali) Classification Accuracy, Escalation Precision, এবং Average Latency মেপে Markdown রিপোর্ট জেনারেট করবে।

---

## 🧪 Phase 5: Testing, Cleanup & Documentation

### 5.1 প্রোপার টেস্ট স্যুট ও CI
- `pytest` + `FastAPI TestClient` দিয়ে ইউনিট ও ইন্টিগ্রেশন টেস্ট লেখা:
  - সব API এন্ডপয়েন্ট (`/health`, `/api/health/deep`, `/api/tickets`, `/api/portal/track`, `/api/dashboard/stats`, `PATCH /api/tickets/{id}`)।
  - Auth (401/200), IDOR প্রোটেকশন, Enterprise `customer_tier` Churn Risk, Fast-Track Escalation, ও Fallback মোড।
- `.github/workflows/ci.yml` যুক্ত করে প্রতি পুশে `pytest` + `npm run lint` + `npm run build` অটোমেটিক রান করা।

### 5.2 রিপোজিটরি ক্লিনআপ ও ডকুমেন্টেশন
- `backend/requirements.txt`-এ সব ডিপেন্ডেন্সির ভার্সন পিন করা।
- অব্যবহৃত কোড (`check_service_status`, `create_zendesk_ticket`, unused Lucide imports) ও লিগ্যাসি নাম (`logiflow_support.db` → `zenivixon_support.db`) ক্লিন করা।
- `frontend/out/` কে `.gitignore`-এ যুক্ত করে Git ট্র্যাকিং থেকে সরানো এবং ডুপ্লিকেট `frontend/netlify.toml` রিমুভ করা।
- `README.md` আপডেট করা:
  - সঠিক আর্কিটেকচার ডায়াগ্রাম (`Verify → Tools → Fast-Track Check`)।
  - সঠিক API টেবিল (সব এন্ডপয়েন্ট ও Auth হেডারসহ)।
  - সঠিক টেস্ট সংখ্যা ও লাইভ ডেমো GIF/স্ক্রিনশট (নতুন ZENIVIXON নামে)।

---

## 📅 প্রস্তাবিত বাস্তবায়ন ক্রম (Execution Order)
1. **ধাপ ১:** Phase 1 (Critical Bugs) + Phase 2 (Security) — *সিস্টেমকে নির্ভুল ও নিরাপদ করা*
2. **ধাপ ২:** Phase 3 (Frontend Refactor & Real Telemetry) — *UI/UX ও কোড কোয়ালিটি আপগ্রেড*
3. **ধাপ ৩:** Phase 5 (Pytest + CI + Cleanup + Accurate README) — *ইঞ্জিনিয়ারিং স্ট্যান্ডার্ড নিশ্চিত করা*
4. **ধাপ ৪:** Phase 4 (SSE Live Streaming + KB Upload + Eval) — *পোর্টফোলিও Standout ফিচার*
