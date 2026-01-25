#!/usr/bin/env python3
"""
Create a fully populated demo user account for video recording.
Run this on the server: python scripts/create_demo_user.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
import json
import bcrypt

# Setup database
from app.database import SessionLocal
from app.models import (
    Organization, User, Business, BusinessInfo, BusinessIdentifier,
    Document, Contact, Deadline, Task, TaskBoard, TaskColumn,
    Metric, ProductOffered, ProductUsed, Service, ChecklistProgress,
    BrandColor, BrandFont, WebLink, MetricGoal
)

def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def create_demo_user():
    db = SessionLocal()
    today = datetime.now()

    try:
        # Check if user already exists
        existing = db.query(User).filter(User.email == "founder@made4founders.com").first()
        if existing:
            print("Demo user already exists! Deleting and recreating...")
            if existing.organization_id:
                org = db.query(Organization).filter(Organization.id == existing.organization_id).first()
                if org:
                    db.delete(org)
            db.delete(existing)
            db.commit()

        # ============ ORGANIZATION ============
        org = Organization(
            name="TechVenture Labs",
            slug="techventure-labs",
        )
        db.add(org)
        db.flush()

        # ============ USER ============
        user = User(
            email="founder@made4founders.com",
            name="Business Founder",
            hashed_password=hash_password("Porange333!!!"),
            role="admin",
            organization_id=org.id,
            email_verified=True,
            has_completed_onboarding=True,
        )
        db.add(user)
        db.flush()

        # ============ BUSINESS ============
        business = Business(
            organization_id=org.id,
            name="TechVenture Labs",
            slug="techventure-labs",
            business_type="llc",
            description="AI-powered SaaS solutions for modern businesses. We build tools that help founders scale smarter.",
            color="#6366F1",
            emoji="🚀",
            website="https://techventurelabs.com",
            is_active=True,
            xp=4850,
            level=7,
        )
        db.add(business)
        db.flush()

        # Update user's current business
        user.current_business_id = business.id
        db.flush()

        # ============ BUSINESS INFO ============
        biz_info = BusinessInfo(
            organization_id=org.id,
            legal_name="TechVenture Labs LLC",
            dba_name="TechVenture Labs",
            entity_type="LLC",
            formation_state="Delaware",
            formation_date=datetime(2024, 3, 15),
            fiscal_year_end="December",
            industry="Software as a Service (SaaS)",
            website="https://techventurelabs.com",
            address_line1="123 Innovation Drive, Suite 400",
            city="Austin",
            state="TX",
            zip_code="78701",
            country="United States",
        )
        db.add(biz_info)

        # ============ BUSINESS IDENTIFIERS ============
        identifiers = [
            ("ein", "EIN (Federal Tax ID)", "87-1234567", "IRS"),
            ("duns", "D-U-N-S Number", "123456789", "Dun & Bradstreet"),
            ("cage", "CAGE Code", "8ABC9", "DLA"),
            ("uei", "SAM.gov UEI", "ABCD1234EFG5", "SAM.gov"),
            ("state_tax", "Texas State Tax ID", "32-87654321", "Texas Comptroller"),
        ]
        for id_type, label, value, authority in identifiers:
            db.add(BusinessIdentifier(
                organization_id=org.id,
                business_id=business.id,
                identifier_type=id_type,
                label=label,
                value=value,
                issuing_authority=authority,
            ))

        # ============ CONTACTS ============
        contacts_data = [
            ("Sarah Chen", "sarah@acmeinvestors.com", "Investor", "(415) 555-0101", "ACME Ventures", "Partner, led seed round", "San Francisco", "CA"),
            ("Michael Torres", "michael@legalease.com", "Legal", "(512) 555-0202", "LegalEase LLP", "Corporate attorney", "Austin", "TX"),
            ("Emily Watson", "emily@techpr.io", "Marketing", "(646) 555-0303", "TechPR Agency", "PR lead", "New York", "NY"),
            ("James Liu", "james@cloudhost.com", "Vendor", "(888) 555-0404", "CloudHost Inc", "AWS account manager", "Seattle", "WA"),
            ("Amanda Ross", "amanda@bigcorp.com", "Client", "(303) 555-0505", "BigCorp Industries", "VP Ops, enterprise client", "Denver", "CO"),
            ("David Kim", "david@mercury.com", "Banking", "(512) 555-0606", "Mercury Bank", "Relationship manager", "Austin", "TX"),
            ("Rachel Green", "rachel@taxsmart.com", "Accounting", "(720) 555-0707", "TaxSmart CPAs", "CPA, bookkeeping", "Denver", "CO"),
            ("Tom Bradley", "tom@salesforce.com", "Partner", "(415) 555-0808", "Salesforce", "Partnership dev", "San Francisco", "CA"),
            ("Lisa Park", "lisa@designco.io", "Contractor", "(213) 555-0909", "DesignCo", "Lead designer", "Los Angeles", "CA"),
            ("Chris Martinez", "chris@devshop.io", "Contractor", "(512) 555-1010", "DevShop", "Backend developer", "Austin", "TX"),
        ]
        for name, email, contact_type, phone, company, notes, city, state in contacts_data:
            db.add(Contact(
                organization_id=org.id,
                business_id=business.id,
                name=name,
                email=email,
                contact_type=contact_type,
                phone=phone,
                company=company,
                notes=notes,
                city=city,
                state=state,
            ))

        # ============ DEADLINES ============
        deadlines_data = [
            ("Q1 Tax Estimated Payment", today + timedelta(days=5), "payment", "IRS quarterly estimated tax payment due", 7),
            ("Board Meeting", today + timedelta(days=12), "meeting", "Q1 board meeting - prepare investor update", 7),
            ("SOC 2 Audit Kickoff", today + timedelta(days=20), "meeting", "Initial meeting with auditors", 7),
            ("Insurance Renewal", today + timedelta(days=30), "renewal", "E&O and cyber insurance renewal", 14),
            ("Product Launch - v2.0", today + timedelta(days=45), "other", "Major feature release", 7),
            ("Annual Report Filing", today + timedelta(days=60), "filing", "Delaware annual report", 14),
            ("Team Offsite", today + timedelta(days=75), "meeting", "Q2 team building event", 7),
            ("Patent Application", today + timedelta(days=90), "filing", "Provisional patent filing", 14),
            ("Investor Update", today + timedelta(days=7), "report", "Monthly investor email", 3),
            ("Performance Reviews", today + timedelta(days=25), "meeting", "Q1 team reviews", 7),
        ]
        for title, due_date, d_type, description, reminder in deadlines_data:
            db.add(Deadline(
                organization_id=org.id,
                business_id=business.id,
                title=title,
                due_date=due_date,
                deadline_type=d_type,
                description=description,
                reminder_days=reminder,
            ))

        # ============ TASK BOARD & TASKS ============
        board = TaskBoard(
            organization_id=org.id,
            business_id=business.id,
            name="Product Development",
            description="Main product development board",
            created_by_id=user.id,
        )
        db.add(board)
        db.flush()

        columns = [("Backlog", 0), ("To Do", 1), ("In Progress", 2), ("Review", 3), ("Done", 4)]
        col_map = {}
        for name, pos in columns:
            col = TaskColumn(board_id=board.id, name=name, position=pos)
            db.add(col)
            db.flush()
            col_map[name] = col

        tasks_data = [
            ("Implement SSO integration", "In Progress", "high", "Add SAML/OAuth SSO for enterprise", 480),
            ("Mobile push notifications", "In Progress", "medium", "Firebase for iOS/Android", 300),
            ("API rate limiting", "To Do", "high", "Rate limiting on public API", 180),
            ("Dashboard analytics", "Review", "medium", "Chart.js visualizations", 300),
            ("Onboarding flow", "To Do", "high", "Guided onboarding wizard", 480),
            ("Stripe webhooks", "Done", "high", "Subscription lifecycle events", 300),
            ("Email template builder", "Backlog", "low", "Drag-and-drop editor", 780),
            ("Dark mode", "Done", "low", "Dark mode toggle", 180),
            ("Export CSV/PDF", "To Do", "medium", "Data export features", 300),
            ("Two-factor auth", "In Progress", "high", "TOTP-based 2FA", 300),
        ]
        for title, column, priority, desc, est_mins in tasks_data:
            db.add(Task(
                board_id=board.id,
                column_id=col_map[column].id,
                business_id=business.id,
                title=title,
                description=desc,
                priority=priority,
                estimated_minutes=est_mins,
                created_by_id=user.id,
            ))

        # ============ METRICS ============
        metrics_data = [
            ("Monthly Recurring Revenue", "$48,500", "currency", "$"),
            ("Annual Recurring Revenue", "$582,000", "currency", "$"),
            ("Active Users", "1,247", "number", None),
            ("New Signups", "89", "number", None),
            ("Churn Rate", "2.3", "percentage", "%"),
            ("Net Promoter Score", "67", "number", None),
            ("Customer Acquisition Cost", "$127", "currency", "$"),
            ("Lifetime Value", "$2,840", "currency", "$"),
            ("Support Tickets", "34", "number", None),
            ("Runway", "18", "number", "months"),
            ("Conversion Rate", "4.2", "percentage", "%"),
            ("Page Load Time", "1.2", "number", "seconds"),
        ]
        for name, value, m_type, unit in metrics_data:
            db.add(Metric(
                organization_id=org.id,
                business_id=business.id,
                name=name,
                value=value,
                metric_type=m_type,
                unit=unit,
                date=today,
                created_by_id=user.id,
            ))

        # Metric goals
        db.add(MetricGoal(
            organization_id=org.id,
            business_id=business.id,
            metric_type="currency",
            name="MRR Target Q2",
            target_value=60000,
            target_date=today + timedelta(days=90),
            created_by_id=user.id,
        ))
        db.add(MetricGoal(
            organization_id=org.id,
            business_id=business.id,
            metric_type="number",
            name="Active Users Q2",
            target_value=2000,
            target_date=today + timedelta(days=90),
            created_by_id=user.id,
        ))

        # ============ PRODUCTS OFFERED ============
        products_offered = [
            ("TechVenture Pro", "subscription", "$99/mo", "saas", "Flagship SaaS platform"),
            ("TechVenture Enterprise", "subscription", "$299/mo", "saas", "Enterprise with SSO, API"),
            ("Custom Development", "hourly", "$150/hr", "consulting", "Hourly custom dev rate"),
            ("Onboarding Package", "one-time", "$500", "service", "White-glove onboarding"),
            ("API Access Add-on", "subscription", "$49/mo", "software", "Full API access"),
        ]
        for name, pricing_model, price, category, desc in products_offered:
            db.add(ProductOffered(
                organization_id=org.id,
                business_id=business.id,
                name=name,
                pricing_model=pricing_model,
                price=price,
                category=category,
                description=desc,
                is_active=True,
            ))

        # ============ PRODUCTS USED ============
        # Categories: development, infrastructure, productivity, communication, marketing, finance, hr, analytics, security, design, other
        products_used = [
            ("AWS", "infrastructure", "$2,400/mo", "monthly", "EC2, RDS, S3"),
            ("Vercel", "infrastructure", "$20/mo", "monthly", "Frontend hosting"),
            ("GitHub", "development", "$21/mo", "monthly", "Team repositories"),
            ("Slack", "communication", "$100/mo", "monthly", "Team chat"),
            ("Notion", "productivity", "$80/mo", "monthly", "Wiki and docs"),
            ("Figma", "design", "$45/mo", "monthly", "UI/UX design"),
            ("Linear", "productivity", "$64/mo", "monthly", "Issue tracking"),
            ("Postmark", "communication", "$15/mo", "monthly", "Transactional email"),
            ("DataDog", "analytics", "$75/mo", "monthly", "APM monitoring"),
        ]
        for name, cat, cost, cycle, notes in products_used:
            db.add(ProductUsed(
                organization_id=org.id,
                business_id=business.id,
                name=name,
                category=cat,
                monthly_cost=cost,
                billing_cycle=cycle,
                notes=notes,
                is_paid=True,
            ))

        # ============ SERVICES ============
        # Categories: banking, legal, tax, accounting, government, insurance, vendors, tools, other
        services = [
            ("QuickBooks", "accounting", "https://quickbooks.intuit.com", "Cloud accounting"),
            ("Gusto", "vendors", "https://gusto.com", "Payroll management"),
            ("Mercury", "banking", "https://mercury.com", "Business banking"),
            ("Carta", "legal", "https://carta.com", "Equity management"),
            ("Brex", "banking", "https://brex.com", "Corporate credit card"),
        ]
        for name, cat, url, desc in services:
            db.add(Service(
                organization_id=org.id,
                business_id=business.id,
                name=name,
                category=cat,
                url=url,
                description=desc,
            ))

        # ============ WEB LINKS ============
        weblinks = [
            ("Company Dashboard", "https://app.techventurelabs.com", "business", "Product dashboard"),
            ("Google Analytics", "https://analytics.google.com", "tools", "Analytics"),
            ("AWS Console", "https://console.aws.amazon.com", "tools", "Infrastructure"),
            ("Stripe Dashboard", "https://dashboard.stripe.com", "financial", "Payments"),
            ("GitHub", "https://github.com/techventurelabs", "tools", "Code repos"),
            ("Notion", "https://notion.so/techventurelabs", "reference", "Wiki"),
            ("Figma", "https://figma.com/techventurelabs", "tools", "Design files"),
            ("Linear", "https://linear.app/techventurelabs", "tools", "Issues"),
        ]
        for title, url, cat, desc in weblinks:
            db.add(WebLink(
                organization_id=org.id,
                business_id=business.id,
                title=title,
                url=url,
                category=cat,
                description=desc,
            ))

        # ============ CHECKLIST PROGRESS ============
        completed_items = [
            "formation_articles", "formation_ein", "formation_bylaws",
            "federal_ein", "federal_form_ss4",
            "state_business_license", "state_sales_tax",
            "banking_business_account", "banking_credit_card",
            "governance_bylaws", "governance_operating_agreement",
            "web_domain", "web_website", "web_email",
            "cyber_mfa", "cyber_password_manager",
            "insurance_general_liability",
        ]
        for item_id in completed_items:
            db.add(ChecklistProgress(
                organization_id=org.id,
                business_id=business.id,
                item_id=item_id,
                is_completed=True,
                completed_at=today - timedelta(days=30),
            ))

        # ============ BRAND COLORS ============
        colors = [
            ("Primary", "#6366F1", "primary"),
            ("Secondary", "#8B5CF6", "secondary"),
            ("Accent", "#F59E0B", "accent"),
            ("Background", "#0F172A", "background"),
            ("Text", "#F8FAFC", "text"),
            ("Success", "#10B981", "success"),
            ("Error", "#EF4444", "error"),
        ]
        for name, hex_val, c_type in colors:
            db.add(BrandColor(
                organization_id=org.id,
                business_id=business.id,
                name=name,
                hex_value=hex_val,
                color_type=c_type,
            ))

        # ============ BRAND FONTS ============
        fonts = [
            ("Inter", "'Inter', sans-serif", "heading", "https://fonts.google.com/specimen/Inter"),
            ("Inter", "'Inter', sans-serif", "body", "https://fonts.google.com/specimen/Inter"),
            ("JetBrains Mono", "'JetBrains Mono', monospace", "monospace", "https://fonts.google.com/specimen/JetBrains+Mono"),
        ]
        for name, family, usage, url in fonts:
            db.add(BrandFont(
                organization_id=org.id,
                business_id=business.id,
                name=name,
                font_family=family,
                usage_type=usage,
                font_url=url,
            ))

        # ============ DOCUMENTS ============
        # Categories: formation, contracts, tax, insurance, licenses, agreements, financial, other
        docs = [
            ("Certificate of Formation", "formation", "Delaware LLC certificate"),
            ("Operating Agreement", "formation", "Company operating agreement"),
            ("EIN Confirmation", "tax", "IRS EIN letter"),
            ("Q4 Financial Report", "financial", "Quarterly statements"),
            ("Employee Handbook", "other", "Company policies"),
            ("NDA Template", "contracts", "Non-disclosure agreement"),
            ("SAFE Agreement", "agreements", "Investor agreement"),
            ("Privacy Policy", "other", "Website privacy policy"),
            ("Terms of Service", "other", "Product terms"),
            ("SOC 2 Checklist", "other", "Audit prep document"),
        ]
        for name, category, desc in docs:
            db.add(Document(
                organization_id=org.id,
                business_id=business.id,
                name=name,
                category=category,
                description=desc,
            ))

        db.commit()
        print("✅ Demo user created successfully!")
        print("   Email: founder@made4founders.com")
        print("   Password: Porange333!!!")
        print("   Organization: TechVenture Labs")
        print("   Business: TechVenture Labs (Level 7, 4850 XP)")

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_demo_user()
