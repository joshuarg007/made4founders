"""
Document Templates API - Pre-built legal and business document templates.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
import re

from .database import get_db
from .models import User, Organization, DocumentTemplate, DocumentTemplateCategory
from .auth import get_current_user
from pydantic import BaseModel

router = APIRouter()


# ============ Pre-built Templates ============

TEMPLATES = {
    "nda_mutual": {
        "name": "Mutual Non-Disclosure Agreement",
        "category": "legal",
        "description": "Standard mutual NDA for sharing confidential information between two parties.",
        "variables": ["party_a_name", "party_a_address", "party_b_name", "party_b_address", "effective_date", "term_years", "governing_state"],
        "content": """MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement (this "Agreement") is entered into as of {{effective_date}} (the "Effective Date") by and between:

Party A: {{party_a_name}}
Address: {{party_a_address}}

AND

Party B: {{party_b_name}}
Address: {{party_b_address}}

(each a "Party" and collectively the "Parties")

RECITALS

WHEREAS, the Parties wish to explore a potential business relationship (the "Purpose") and in connection therewith, each Party may disclose to the other certain confidential and proprietary information;

NOW, THEREFORE, in consideration of the mutual covenants and agreements set forth herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Parties agree as follows:

1. DEFINITION OF CONFIDENTIAL INFORMATION

"Confidential Information" means any and all information or data, whether in written, oral, electronic, or other form, that is disclosed by one Party (the "Disclosing Party") to the other Party (the "Receiving Party") that:

(a) Is designated as "confidential," "proprietary," or with a similar legend; or
(b) By its nature or the circumstances of its disclosure, would reasonably be understood to be confidential.

Confidential Information includes, but is not limited to: trade secrets, inventions, ideas, processes, formulas, source code, data, programs, know-how, improvements, discoveries, developments, designs, techniques, customer lists, financial information, business plans, marketing plans, and personnel information.

2. EXCLUSIONS FROM CONFIDENTIAL INFORMATION

Confidential Information does not include information that:

(a) Was publicly available at the time of disclosure or becomes publicly available through no fault of the Receiving Party;
(b) Was rightfully known to the Receiving Party prior to disclosure without restriction;
(c) Is rightfully obtained by the Receiving Party from a third party without breach of any confidentiality obligation;
(d) Is independently developed by the Receiving Party without use of or reference to the Disclosing Party's Confidential Information.

3. OBLIGATIONS OF RECEIVING PARTY

The Receiving Party agrees to:

(a) Hold the Disclosing Party's Confidential Information in strict confidence;
(b) Not disclose any Confidential Information to any third parties without prior written consent;
(c) Use the Confidential Information solely for the Purpose;
(d) Take reasonable measures to protect the confidentiality of the Confidential Information, but in no event less than the measures it takes to protect its own confidential information;
(e) Limit access to Confidential Information to those employees, agents, or contractors who need to know such information and who are bound by confidentiality obligations at least as protective as those contained herein.

4. TERM

This Agreement shall remain in effect for {{term_years}} years from the Effective Date unless earlier terminated by either Party upon thirty (30) days' written notice. The obligations of confidentiality shall survive termination for a period of three (3) years.

5. RETURN OF CONFIDENTIAL INFORMATION

Upon termination of this Agreement or upon request of the Disclosing Party, the Receiving Party shall promptly return or destroy all Confidential Information and any copies thereof in its possession.

6. NO LICENSE

Nothing in this Agreement grants any license, by implication or otherwise, to any Confidential Information.

7. REMEDIES

The Parties acknowledge that monetary damages may be inadequate for any breach of this Agreement. Accordingly, in addition to any other remedies, the Disclosing Party shall be entitled to seek equitable relief, including injunction and specific performance.

8. GENERAL PROVISIONS

(a) Governing Law: This Agreement shall be governed by and construed in accordance with the laws of the State of {{governing_state}}.
(b) Entire Agreement: This Agreement constitutes the entire agreement between the Parties concerning the subject matter hereof.
(c) Amendment: This Agreement may not be amended except by a written instrument signed by both Parties.
(d) Waiver: No waiver of any provision of this Agreement shall be effective unless in writing and signed by the waiving Party.

IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.

PARTY A:                           PARTY B:

_____________________________      _____________________________
Signature                          Signature

_____________________________      _____________________________
Print Name                         Print Name

_____________________________      _____________________________
Title                              Title

_____________________________      _____________________________
Date                               Date
"""
    },

    "nda_one_way": {
        "name": "One-Way Non-Disclosure Agreement",
        "category": "legal",
        "description": "NDA where only one party discloses confidential information.",
        "variables": ["disclosing_party_name", "receiving_party_name", "receiving_party_address", "effective_date", "purpose", "term_years", "governing_state"],
        "content": """NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement (this "Agreement") is entered into as of {{effective_date}} by and between:

Disclosing Party: {{disclosing_party_name}}

AND

Receiving Party: {{receiving_party_name}}
Address: {{receiving_party_address}}

1. PURPOSE

The Disclosing Party wishes to disclose certain confidential and proprietary information to the Receiving Party for the purpose of: {{purpose}} (the "Purpose").

2. CONFIDENTIAL INFORMATION

"Confidential Information" means any information, technical data, or know-how relating to the Disclosing Party's business that is disclosed by the Disclosing Party to the Receiving Party, whether orally, in writing, or by any other means.

3. OBLIGATIONS

The Receiving Party agrees to:
(a) Hold all Confidential Information in strict confidence;
(b) Not disclose any Confidential Information to third parties;
(c) Use Confidential Information only for the Purpose;
(d) Protect Confidential Information using reasonable care.

4. EXCLUSIONS

This Agreement does not apply to information that:
(a) Is or becomes publicly known through no fault of the Receiving Party;
(b) Was known to the Receiving Party before disclosure;
(c) Is independently developed by the Receiving Party;
(d) Is received from a third party without restriction.

5. TERM

This Agreement shall remain in effect for {{term_years}} years from the date first written above.

6. GOVERNING LAW

This Agreement shall be governed by the laws of the State of {{governing_state}}.

7. RETURN OF INFORMATION

Upon request or termination, the Receiving Party shall return or destroy all Confidential Information.

DISCLOSING PARTY:                  RECEIVING PARTY:

_____________________________      _____________________________
Signature                          Signature

_____________________________      _____________________________
Print Name                         Print Name

_____________________________      _____________________________
Date                               Date
"""
    },

    "llc_operating_agreement": {
        "name": "LLC Operating Agreement (Single Member)",
        "category": "corporate",
        "description": "Operating agreement for a single-member LLC.",
        "variables": ["company_name", "state_of_formation", "principal_office_address", "member_name", "member_address", "initial_contribution", "effective_date", "fiscal_year_end"],
        "content": """OPERATING AGREEMENT
OF
{{company_name}}
A {{state_of_formation}} LIMITED LIABILITY COMPANY

This Operating Agreement (this "Agreement") of {{company_name}} (the "Company"), is adopted and effective as of {{effective_date}}, by {{member_name}} (the "Member").

ARTICLE I
FORMATION

1.1 Formation. The Company was formed as a {{state_of_formation}} limited liability company by the filing of Articles of Organization with the {{state_of_formation}} Secretary of State.

1.2 Name. The name of the Company is {{company_name}}.

1.3 Principal Office. The principal office of the Company is located at {{principal_office_address}}.

1.4 Registered Agent. The registered agent and office shall be as set forth in the Articles of Organization or as changed from time to time.

1.5 Term. The Company shall exist perpetually unless dissolved in accordance with this Agreement.

ARTICLE II
PURPOSE

The Company is formed for the purpose of engaging in any lawful business activity for which a limited liability company may be organized under the laws of {{state_of_formation}}.

ARTICLE III
MEMBER

3.1 Member. The name and address of the sole Member is:

Name: {{member_name}}
Address: {{member_address}}

3.2 Admission of Additional Members. Additional members may be admitted only with the written consent of the Member.

ARTICLE IV
CAPITAL CONTRIBUTIONS

4.1 Initial Contribution. The Member has made an initial capital contribution to the Company in the amount of ${{initial_contribution}}.

4.2 Additional Contributions. The Member is not obligated to make any additional capital contributions.

ARTICLE V
ALLOCATIONS AND DISTRIBUTIONS

5.1 Allocations. All profits and losses shall be allocated to the Member.

5.2 Distributions. Distributions shall be made at such times and in such amounts as determined by the Member.

ARTICLE VI
MANAGEMENT

6.1 Management by Member. The Company shall be managed by the Member. The Member shall have full and exclusive authority to manage and control the business and affairs of the Company.

6.2 Officers. The Member may appoint officers and agents as necessary.

6.3 Banking. The Member may open and maintain bank accounts in the Company's name and may designate signatories.

ARTICLE VII
TAXES

7.1 Tax Treatment. The Company shall be treated as a disregarded entity for federal income tax purposes unless the Member elects otherwise.

7.2 Fiscal Year. The fiscal year of the Company shall end on {{fiscal_year_end}}.

ARTICLE VIII
TRANSFER OF MEMBERSHIP INTEREST

The Member may transfer all or any portion of the membership interest at any time.

ARTICLE IX
DISSOLUTION

9.1 Events of Dissolution. The Company shall be dissolved upon:
(a) The written decision of the Member to dissolve;
(b) The sale of all Company assets;
(c) Any event that makes it unlawful for the Company to continue.

9.2 Winding Up. Upon dissolution, the Company's affairs shall be wound up and its assets distributed.

ARTICLE X
INDEMNIFICATION

The Company shall indemnify the Member to the fullest extent permitted by law.

ARTICLE XI
GENERAL PROVISIONS

11.1 Amendments. This Agreement may be amended only in writing by the Member.

11.2 Governing Law. This Agreement shall be governed by the laws of {{state_of_formation}}.

11.3 Severability. If any provision is found to be invalid, the remaining provisions shall remain in effect.

IN WITNESS WHEREOF, the Member has executed this Agreement as of the date first written above.

MEMBER:

_____________________________
{{member_name}}

_____________________________
Date
"""
    },

    "board_resolution": {
        "name": "Board Resolution Template",
        "category": "corporate",
        "description": "Template for corporate board resolutions.",
        "variables": ["company_name", "resolution_date", "resolution_title", "resolution_text", "director_1_name", "director_2_name"],
        "content": """BOARD RESOLUTION
OF
{{company_name}}

UNANIMOUS WRITTEN CONSENT OF THE BOARD OF DIRECTORS
IN LIEU OF A SPECIAL MEETING

Pursuant to the bylaws of {{company_name}} (the "Corporation"), the undersigned, being all of the directors of the Corporation, hereby adopt the following resolutions by unanimous written consent without a meeting:

RESOLUTION: {{resolution_title}}

WHEREAS, the Board of Directors deems it in the best interest of the Corporation to take the following action;

NOW, THEREFORE, BE IT RESOLVED:

{{resolution_text}}

FURTHER RESOLVED, that any officer of the Corporation is authorized and directed to take any and all actions and to execute any and all documents as may be necessary or appropriate to carry out the intent and purpose of the foregoing resolution.

FURTHER RESOLVED, that all actions heretofore taken by any officer or director of the Corporation in connection with the matters contemplated by the foregoing resolutions are hereby ratified, approved, and confirmed in all respects.

This consent shall be effective as of {{resolution_date}}.

DIRECTORS:

_____________________________
{{director_1_name}}

_____________________________
{{director_2_name}}

_____________________________
Date
"""
    },

    "consulting_agreement": {
        "name": "Consulting Agreement",
        "category": "contracts",
        "description": "Independent contractor consulting agreement.",
        "variables": ["company_name", "company_address", "consultant_name", "consultant_address", "effective_date", "scope_of_services", "hourly_rate", "payment_terms", "term_months", "governing_state"],
        "content": """CONSULTING AGREEMENT

This Consulting Agreement (this "Agreement") is entered into as of {{effective_date}}, by and between:

Company: {{company_name}}
Address: {{company_address}}

AND

Consultant: {{consultant_name}}
Address: {{consultant_address}}

1. ENGAGEMENT

The Company hereby engages the Consultant, and the Consultant hereby accepts such engagement, to provide consulting services on the terms and conditions set forth herein.

2. SERVICES

The Consultant shall provide the following services (the "Services"):

{{scope_of_services}}

3. TERM

This Agreement shall commence on the Effective Date and continue for {{term_months}} months unless earlier terminated in accordance with this Agreement.

4. COMPENSATION

4.1 Rate. The Company shall pay the Consultant at the rate of ${{hourly_rate}} per hour for Services rendered.

4.2 Payment Terms. {{payment_terms}}

4.3 Expenses. The Company shall reimburse the Consultant for reasonable out-of-pocket expenses incurred in connection with the Services, provided such expenses are pre-approved in writing.

5. INDEPENDENT CONTRACTOR

The Consultant is an independent contractor and not an employee of the Company. The Consultant shall be solely responsible for all taxes, insurance, and other obligations arising from compensation paid hereunder.

6. CONFIDENTIALITY

The Consultant agrees to maintain the confidentiality of all proprietary information of the Company and shall not disclose such information to any third party without prior written consent.

7. INTELLECTUAL PROPERTY

All work product, inventions, and intellectual property created by the Consultant in the course of performing the Services shall be the sole property of the Company. The Consultant hereby assigns all rights therein to the Company.

8. NON-SOLICITATION

During the term of this Agreement and for one (1) year thereafter, the Consultant shall not directly or indirectly solicit any employee of the Company.

9. TERMINATION

Either party may terminate this Agreement upon thirty (30) days' written notice. The Company may terminate immediately for cause.

10. REPRESENTATIONS AND WARRANTIES

The Consultant represents and warrants that:
(a) The Consultant has the right and authority to enter into this Agreement;
(b) The Services will be performed in a professional and workmanlike manner;
(c) The Services will not infringe any third-party rights.

11. LIMITATION OF LIABILITY

In no event shall either party be liable for any indirect, incidental, special, or consequential damages.

12. GENERAL PROVISIONS

12.1 Governing Law. This Agreement shall be governed by the laws of the State of {{governing_state}}.

12.2 Entire Agreement. This Agreement constitutes the entire agreement between the parties.

12.3 Amendment. This Agreement may be amended only in writing signed by both parties.

12.4 Notices. All notices shall be in writing and sent to the addresses set forth above.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

COMPANY:                           CONSULTANT:

_____________________________      _____________________________
Signature                          Signature

_____________________________      _____________________________
Print Name                         Print Name

_____________________________      _____________________________
Title                              Title

_____________________________      _____________________________
Date                               Date
"""
    },

    "employee_offer_letter": {
        "name": "Employee Offer Letter",
        "category": "employment",
        "description": "Standard employment offer letter template.",
        "variables": ["company_name", "employee_name", "position_title", "start_date", "salary", "pay_frequency", "manager_name", "benefits_summary", "location"],
        "content": """{{company_name}}

[Date]

{{employee_name}}
[Address]

Dear {{employee_name}},

We are pleased to offer you employment with {{company_name}} (the "Company") on the following terms:

POSITION

You will be employed as {{position_title}}, reporting to {{manager_name}}. Your primary work location will be {{location}}.

COMPENSATION

Your starting salary will be ${{salary}} per year, payable {{pay_frequency}}, less applicable withholdings and deductions.

START DATE

Your anticipated start date is {{start_date}}, subject to completion of all required documentation and background checks.

BENEFITS

You will be eligible to participate in the Company's benefit programs, including:

{{benefits_summary}}

Specific details regarding these benefits will be provided during your onboarding.

EMPLOYMENT AT-WILL

Your employment with the Company is "at-will," meaning that either you or the Company may terminate the employment relationship at any time, with or without cause or notice. This at-will employment relationship cannot be changed except in writing signed by an authorized officer of the Company.

CONFIDENTIALITY AND INVENTIONS

As a condition of employment, you will be required to sign the Company's standard Confidentiality and Inventions Assignment Agreement.

CONTINGENCIES

This offer is contingent upon:
- Satisfactory completion of a background check
- Verification of your right to work in the United States
- Execution of all required employment documents

ACCEPTANCE

To accept this offer, please sign and date this letter below and return it by [acceptance deadline]. This offer will remain open until that date.

We are excited about the possibility of you joining our team and believe you will make significant contributions to our organization.

Sincerely,

_____________________________
[Hiring Manager Name]
[Title]
{{company_name}}

ACCEPTANCE

I, {{employee_name}}, accept the offer of employment as described above.

_____________________________      _____________________________
Signature                          Date
"""
    },

    "invoice_template": {
        "name": "Invoice Template",
        "category": "financial",
        "description": "Professional invoice template.",
        "variables": ["company_name", "company_address", "company_phone", "company_email", "client_name", "client_address", "invoice_number", "invoice_date", "due_date", "line_items", "subtotal", "tax_rate", "tax_amount", "total", "payment_instructions"],
        "content": """{{company_name}}
{{company_address}}
Phone: {{company_phone}}
Email: {{company_email}}

--------------------------------------------------------------------------------
                                   INVOICE
--------------------------------------------------------------------------------

Invoice #:      {{invoice_number}}
Invoice Date:   {{invoice_date}}
Due Date:       {{due_date}}

BILL TO:
{{client_name}}
{{client_address}}

--------------------------------------------------------------------------------
DESCRIPTION                                    QTY     RATE         AMOUNT
--------------------------------------------------------------------------------
{{line_items}}

--------------------------------------------------------------------------------
                                             Subtotal:          ${{subtotal}}
                                             Tax ({{tax_rate}}%):         ${{tax_amount}}
                                             ------------------------
                                             TOTAL DUE:         ${{total}}
--------------------------------------------------------------------------------

PAYMENT INSTRUCTIONS:

{{payment_instructions}}

--------------------------------------------------------------------------------

Thank you for your business!

Please remit payment within the terms specified above.
Questions? Contact us at {{company_email}}
"""
    },

    "privacy_policy": {
        "name": "Privacy Policy Template",
        "category": "legal",
        "description": "Website/app privacy policy template.",
        "variables": ["company_name", "website_url", "contact_email", "effective_date", "data_retention_period"],
        "content": """PRIVACY POLICY

Last Updated: {{effective_date}}

{{company_name}} ("we," "us," or "our") operates {{website_url}} (the "Service"). This Privacy Policy informs you of our policies regarding the collection, use, and disclosure of personal information when you use our Service.

1. INFORMATION WE COLLECT

1.1 Information You Provide
- Account information (name, email, password)
- Profile information
- Payment information
- Communications with us

1.2 Information Collected Automatically
- Log data (IP address, browser type, pages visited)
- Device information
- Cookies and similar technologies
- Usage data

2. HOW WE USE YOUR INFORMATION

We use the information we collect to:
- Provide and maintain our Service
- Process transactions
- Send you updates and marketing communications (with your consent)
- Respond to your requests
- Improve our Service
- Comply with legal obligations

3. INFORMATION SHARING

We may share your information with:
- Service providers who assist in our operations
- Business partners (with your consent)
- Law enforcement when required by law
- Other parties in connection with a merger or acquisition

We do not sell your personal information.

4. DATA SECURITY

We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.

5. DATA RETENTION

We retain your personal information for {{data_retention_period}} or as long as necessary to fulfill the purposes described in this policy, unless a longer retention period is required by law.

6. YOUR RIGHTS

Depending on your location, you may have the right to:
- Access your personal information
- Correct inaccurate information
- Delete your information
- Object to processing
- Data portability
- Withdraw consent

7. COOKIES

We use cookies and similar tracking technologies. You can manage cookie preferences through your browser settings.

8. CHILDREN'S PRIVACY

Our Service is not intended for children under 13. We do not knowingly collect information from children under 13.

9. CHANGES TO THIS POLICY

We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.

10. CONTACT US

If you have any questions about this Privacy Policy, please contact us at:

{{company_name}}
Email: {{contact_email}}
Website: {{website_url}}
"""
    },

    "terms_of_service": {
        "name": "Terms of Service Template",
        "category": "legal",
        "description": "Website/app terms of service template.",
        "variables": ["company_name", "website_url", "contact_email", "effective_date", "governing_state"],
        "content": """TERMS OF SERVICE

Last Updated: {{effective_date}}

Please read these Terms of Service ("Terms") carefully before using {{website_url}} (the "Service") operated by {{company_name}} ("we," "us," or "our").

1. ACCEPTANCE OF TERMS

By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the Terms, you may not access the Service.

2. USE OF SERVICE

2.1 Eligibility
You must be at least 18 years old to use the Service.

2.2 Account Registration
You may be required to create an account. You are responsible for maintaining the confidentiality of your account credentials.

2.3 Acceptable Use
You agree not to:
- Violate any laws or regulations
- Infringe on intellectual property rights
- Transmit harmful code or malware
- Interfere with the operation of the Service
- Use the Service for unauthorized purposes

3. INTELLECTUAL PROPERTY

The Service and its original content, features, and functionality are owned by {{company_name}} and are protected by intellectual property laws.

4. USER CONTENT

4.1 Ownership
You retain ownership of content you submit to the Service.

4.2 License
By submitting content, you grant us a non-exclusive, worldwide, royalty-free license to use, reproduce, and display such content in connection with the Service.

5. DISCLAIMERS

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.

6. LIMITATION OF LIABILITY

IN NO EVENT SHALL {{company_name}} BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.

7. INDEMNIFICATION

You agree to indemnify and hold harmless {{company_name}} from any claims, damages, or expenses arising from your use of the Service or violation of these Terms.

8. TERMINATION

We may terminate or suspend your access to the Service immediately, without prior notice, for any reason.

9. GOVERNING LAW

These Terms shall be governed by the laws of the State of {{governing_state}}, without regard to its conflict of law provisions.

10. CHANGES TO TERMS

We reserve the right to modify these Terms at any time. We will notify users of any material changes.

11. CONTACT US

If you have any questions about these Terms, please contact us at:

{{company_name}}
Email: {{contact_email}}
Website: {{website_url}}
"""
    }
}


# ============ Pydantic Schemas ============

class TemplateInfo(BaseModel):
    name: str
    category: str
    description: str
    variables: List[str]

class TemplateListResponse(BaseModel):
    templates: List[TemplateInfo]
    categories: List[str]

class RenderTemplateRequest(BaseModel):
    template_id: str
    variables: dict

class SavedTemplateCreate(BaseModel):
    template_id: str
    name: str
    rendered_content: str

class SavedTemplateResponse(BaseModel):
    id: int
    organization_id: int
    template_id: str
    name: str
    rendered_content: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


def get_user_organization(user: User, db: Session) -> Organization:
    """Get the user's organization or raise 403."""
    if not user.organization_id:
        raise HTTPException(status_code=403, detail="User does not belong to an organization")
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


# ============ Routes ============

@router.get("/", response_model=TemplateListResponse)
def list_templates():
    """List all available document templates."""
    templates = [
        TemplateInfo(
            name=t["name"],
            category=t["category"],
            description=t["description"],
            variables=t["variables"]
        )
        for key, t in TEMPLATES.items()
    ]

    categories = list(set(t["category"] for t in TEMPLATES.values()))

    return TemplateListResponse(
        templates=templates,
        categories=sorted(categories)
    )


@router.get("/{template_id}")
def get_template(template_id: str):
    """Get a specific template with its content."""
    if template_id not in TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")

    template = TEMPLATES[template_id]
    return {
        "id": template_id,
        "name": template["name"],
        "category": template["category"],
        "description": template["description"],
        "variables": template["variables"],
        "content": template["content"]
    }


@router.post("/render")
def render_template(request: RenderTemplateRequest):
    """Render a template with the provided variables."""
    if request.template_id not in TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")

    template = TEMPLATES[request.template_id]
    content = template["content"]

    # Replace variables
    for var in template["variables"]:
        placeholder = "{{" + var + "}}"
        value = request.variables.get(var, f"[{var}]")
        content = content.replace(placeholder, str(value))

    return {
        "template_id": request.template_id,
        "name": template["name"],
        "rendered_content": content,
        "missing_variables": [
            var for var in template["variables"]
            if var not in request.variables
        ]
    }


@router.get("/saved/list", response_model=List[SavedTemplateResponse])
def list_saved_templates(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List saved/rendered templates for the organization."""
    org = get_user_organization(current_user, db)
    query = db.query(DocumentTemplate).filter(DocumentTemplate.organization_id == org.id)

    if category:
        query = query.filter(DocumentTemplate.category == category)

    return query.order_by(DocumentTemplate.created_at.desc()).all()


@router.post("/saved", response_model=SavedTemplateResponse)
def save_template(
    template: SavedTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save a rendered template."""
    org = get_user_organization(current_user, db)

    # Get category from original template
    category = "other"
    if template.template_id in TEMPLATES:
        category = TEMPLATES[template.template_id]["category"]

    db_template = DocumentTemplate(
        organization_id=org.id,
        template_id=template.template_id,
        name=template.name,
        category=category,
        content=template.rendered_content
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)

    return SavedTemplateResponse(
        id=db_template.id,
        organization_id=db_template.organization_id,
        template_id=db_template.template_id,
        name=db_template.name,
        rendered_content=db_template.content,
        created_at=db_template.created_at,
        updated_at=db_template.updated_at
    )


@router.delete("/saved/{template_id}")
def delete_saved_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a saved template."""
    org = get_user_organization(current_user, db)
    template = db.query(DocumentTemplate).filter(
        DocumentTemplate.id == template_id,
        DocumentTemplate.organization_id == org.id
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    db.delete(template)
    db.commit()
    return {"message": "Template deleted"}
