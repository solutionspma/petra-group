The Petra Group Platform

Modern multi-user web platform for The Petra Group Insurance & Financial Services.

This project replaces the legacy marketing website with a scalable, role-based system that supports agents, office staff, and administrators with secure logins, profile management, and backend CRM functionality.

⸻

🚀 Overview

The Petra Group Platform is a full-stack web application designed to:
	•	Support multi-agent onboarding
	•	Provide role-based access control (RBAC)
	•	Allow agent profile management
	•	Manage internal resources
	•	Serve as a lightweight CRM foundation
	•	Scale into future embedded finance + insurance workflows

Built for long-term growth — not just a brochure site.

⸻

🏗 Architecture

Frontend
	•	React / Next.js (App Router)
	•	Responsive UI
	•	Modular component system

Backend
	•	Secure authentication
	•	Role-based permissions (Admin / Agent / Office)
	•	Database-driven agent profiles
	•	API routes for secure operations

Database
	•	Structured multi-tenant schema
	•	Role enforcement
	•	Secure data access policies

⸻

👥 User Roles

Admin
	•	Full dashboard access
	•	Agent management
	•	Content/resource control
	•	Platform configuration

Agent
	•	Profile management
	•	Resource access
	•	Client tools (future expansion)

Office Staff
	•	Limited internal access
	•	Administrative support functions

⸻

🔐 Security
	•	Authenticated routes only
	•	Protected API endpoints
	•	Server-side validation
	•	Role-based permission enforcement
	•	No hardcoded credentials
	•	Environment variable configuration

⸻

📦 Installation

git clone https://github.com/your-org/petra-group-platform.git
cd petra-group-platform
npm install


⸻

⚙️ Environment Variables

Create a .env.local file:

NEXT_PUBLIC_APP_URL=
DATABASE_URL=
AUTH_SECRET=
STORAGE_BUCKET=

Do not commit .env.local.

⸻

🛠 Development

npm run dev

Visit:

http://localhost:3000


⸻

🚀 Production Build

npm run build
npm start


⸻

📈 Roadmap
	•	CRM expansion
	•	Commission tracking
	•	Carrier integrations
	•	Client portal
	•	Secure document upload
	•	Embedded finance integration
	•	Analytics dashboard

⸻

🧱 Design Philosophy

This is not just a website.
It is infrastructure.

Built to support:
	•	Scalable growth
	•	Agent expansion
	•	Clean branding
	•	Future insurance + financial tooling integration

⸻

🏢 Organization

Developed for:

The Petra Group Insurance & Financial Services

⸻

📄 License

Private proprietary software.
All rights reserved.

