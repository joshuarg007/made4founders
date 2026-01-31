"""
Team Management API

Provides endpoints for managing:
- Employees (directory, profiles, org chart)
- PTO (policies, balances, requests)
- Onboarding (templates, checklists, tasks)
- Contractors (1099 tracking)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from datetime import date, datetime, UTC
import json

from .database import get_db
from .auth import get_current_user
from .models import (
    User, Employee, PTOPolicy, PTOBalance, PTORequest,
    OnboardingTemplate, OnboardingChecklist, OnboardingTask,
    Shareholder, StockOption, EquityGrant
)
from .schemas import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse, OrgChartNode,
    PTOPolicyCreate, PTOPolicyUpdate, PTOPolicyResponse,
    PTOBalanceResponse, PTORequestCreate, PTORequestUpdate, PTORequestResponse,
    PTOCalendarEntry,
    OnboardingTemplateCreate, OnboardingTemplateUpdate, OnboardingTemplateResponse,
    OnboardingChecklistCreate, OnboardingChecklistResponse, OnboardingTaskResponse,
    TeamSummary
)

router = APIRouter(prefix="/api/team", tags=["team"])


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_employee_with_org_check(db: Session, employee_id: int, org_id: int) -> Employee:
    """Get employee with organization check."""
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.organization_id == org_id
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


def build_employee_response(emp: Employee, db: Session) -> dict:
    """Build employee response with computed fields."""
    direct_reports = db.query(func.count(Employee.id)).filter(
        Employee.manager_id == emp.id
    ).scalar() or 0

    manager_name = None
    if emp.manager_id:
        manager = db.query(Employee).filter(Employee.id == emp.manager_id).first()
        if manager:
            manager_name = f"{manager.first_name} {manager.last_name}"

    return {
        "id": emp.id,
        "first_name": emp.first_name,
        "last_name": emp.last_name,
        "preferred_name": emp.preferred_name,
        "email": emp.email,
        "personal_email": emp.personal_email,
        "phone": emp.phone,
        "employee_number": emp.employee_number,
        "employment_type": emp.employment_type,
        "employment_status": emp.employment_status,
        "title": emp.title,
        "department": emp.department,
        "manager_id": emp.manager_id,
        "hire_date": emp.hire_date,
        "start_date": emp.start_date,
        "termination_date": emp.termination_date,
        "termination_reason": emp.termination_reason,
        "salary_cents": emp.salary_cents,
        "salary_frequency": emp.salary_frequency,
        "hourly_rate_cents": emp.hourly_rate_cents,
        "work_location": emp.work_location,
        "office_location": emp.office_location,
        "timezone": emp.timezone,
        "is_contractor": emp.is_contractor,
        "tax_classification": emp.tax_classification,
        "avatar_url": emp.avatar_url,
        "bio": emp.bio,
        "linkedin_url": emp.linkedin_url,
        "notes": emp.notes,
        "user_id": emp.user_id,
        "shareholder_id": emp.shareholder_id,
        "contact_id": emp.contact_id,
        "created_at": emp.created_at,
        "updated_at": emp.updated_at,
        "full_name": f"{emp.first_name} {emp.last_name}",
        "manager_name": manager_name,
        "direct_report_count": direct_reports,
    }


# ============================================================================
# TEAM SUMMARY
# ============================================================================

@router.get("/summary", response_model=TeamSummary)
def get_team_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get team dashboard summary."""
    org_id = current_user.organization_id

    total = db.query(func.count(Employee.id)).filter(
        Employee.organization_id == org_id
    ).scalar() or 0

    active = db.query(func.count(Employee.id)).filter(
        Employee.organization_id == org_id,
        Employee.employment_status == "active"
    ).scalar() or 0

    contractors = db.query(func.count(Employee.id)).filter(
        Employee.organization_id == org_id,
        Employee.is_contractor == True
    ).scalar() or 0

    on_leave = db.query(func.count(Employee.id)).filter(
        Employee.organization_id == org_id,
        Employee.employment_status == "on_leave"
    ).scalar() or 0

    pending_pto = db.query(func.count(PTORequest.id)).filter(
        PTORequest.organization_id == org_id,
        PTORequest.status == "pending"
    ).scalar() or 0

    active_onboarding = db.query(func.count(OnboardingChecklist.id)).filter(
        OnboardingChecklist.organization_id == org_id,
        OnboardingChecklist.is_completed == False
    ).scalar() or 0

    # By department
    dept_counts = db.query(
        Employee.department,
        func.count(Employee.id)
    ).filter(
        Employee.organization_id == org_id,
        Employee.employment_status == "active"
    ).group_by(Employee.department).all()

    by_department = {dept or "Unassigned": count for dept, count in dept_counts}

    # Recent hires (last 30 days)
    thirty_days_ago = date.today().replace(day=1)
    recent = db.query(Employee).filter(
        Employee.organization_id == org_id,
        Employee.hire_date >= thirty_days_ago
    ).order_by(Employee.hire_date.desc()).limit(5).all()

    recent_hires = [build_employee_response(emp, db) for emp in recent]

    return {
        "total_employees": total,
        "active_employees": active,
        "contractors": contractors,
        "on_leave": on_leave,
        "pending_pto_requests": pending_pto,
        "active_onboarding": active_onboarding,
        "by_department": by_department,
        "recent_hires": recent_hires,
    }


# ============================================================================
# EMPLOYEES
# ============================================================================

@router.get("/employees", response_model=List[EmployeeResponse])
def list_employees(
    department: Optional[str] = Query(None),
    employment_type: Optional[str] = Query(None),
    employment_status: Optional[str] = Query(None),
    is_contractor: Optional[bool] = Query(None),
    manager_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all employees with filters."""
    org_id = current_user.organization_id

    query = db.query(Employee).filter(Employee.organization_id == org_id)

    if department:
        query = query.filter(Employee.department == department)
    if employment_type:
        query = query.filter(Employee.employment_type == employment_type)
    if employment_status:
        query = query.filter(Employee.employment_status == employment_status)
    if is_contractor is not None:
        query = query.filter(Employee.is_contractor == is_contractor)
    if manager_id:
        query = query.filter(Employee.manager_id == manager_id)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Employee.first_name.ilike(search_filter)) |
            (Employee.last_name.ilike(search_filter)) |
            (Employee.email.ilike(search_filter)) |
            (Employee.title.ilike(search_filter))
        )

    employees = query.order_by(Employee.last_name, Employee.first_name).offset(offset).limit(limit).all()

    return [build_employee_response(emp, db) for emp in employees]


@router.post("/employees", response_model=EmployeeResponse)
def create_employee(
    employee: EmployeeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new employee."""
    org_id = current_user.organization_id

    # Validate manager if provided
    if employee.manager_id:
        manager = db.query(Employee).filter(
            Employee.id == employee.manager_id,
            Employee.organization_id == org_id
        ).first()
        if not manager:
            raise HTTPException(status_code=400, detail="Manager not found")

    db_employee = Employee(
        organization_id=org_id,
        **employee.model_dump()
    )
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)

    return build_employee_response(db_employee, db)


@router.get("/employees/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get employee details."""
    emp = get_employee_with_org_check(db, employee_id, current_user.organization_id)
    return build_employee_response(emp, db)


@router.patch("/employees/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    updates: EmployeeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an employee."""
    emp = get_employee_with_org_check(db, employee_id, current_user.organization_id)

    update_data = updates.model_dump(exclude_unset=True)

    # Validate manager if being updated
    if "manager_id" in update_data and update_data["manager_id"]:
        if update_data["manager_id"] == employee_id:
            raise HTTPException(status_code=400, detail="Employee cannot be their own manager")
        manager = db.query(Employee).filter(
            Employee.id == update_data["manager_id"],
            Employee.organization_id == current_user.organization_id
        ).first()
        if not manager:
            raise HTTPException(status_code=400, detail="Manager not found")

    for key, value in update_data.items():
        setattr(emp, key, value)

    db.commit()
    db.refresh(emp)

    return build_employee_response(emp, db)


@router.delete("/employees/{employee_id}")
def delete_employee(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Terminate/archive an employee."""
    emp = get_employee_with_org_check(db, employee_id, current_user.organization_id)

    # Don't delete, just mark as terminated
    emp.employment_status = "terminated"
    emp.termination_date = date.today()

    db.commit()

    return {"message": "Employee terminated"}


@router.get("/employees/{employee_id}/equity")
def get_employee_equity(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get employee's equity information from cap table."""
    emp = get_employee_with_org_check(db, employee_id, current_user.organization_id)

    if not emp.shareholder_id:
        return {"has_equity": False, "grants": [], "options": []}

    # Get equity grants
    grants = db.query(EquityGrant).filter(
        EquityGrant.shareholder_id == emp.shareholder_id,
        EquityGrant.organization_id == current_user.organization_id
    ).all()

    # Get stock options
    options = db.query(StockOption).filter(
        StockOption.shareholder_id == emp.shareholder_id,
        StockOption.organization_id == current_user.organization_id
    ).all()

    return {
        "has_equity": True,
        "shareholder_id": emp.shareholder_id,
        "grants": [{
            "id": g.id,
            "shares": g.shares,
            "share_class_id": g.share_class_id,
            "grant_date": g.grant_date,
            "status": g.status,
        } for g in grants],
        "options": [{
            "id": o.id,
            "shares_granted": o.shares_granted,
            "shares_vested": o.shares_vested,
            "shares_exercised": o.shares_exercised,
            "strike_price": o.strike_price,
            "grant_date": o.grant_date,
            "vesting_start_date": o.vesting_start_date,
            "expiration_date": o.expiration_date,
            "status": o.status,
        } for o in options],
    }


# ============================================================================
# ORG CHART
# ============================================================================

@router.get("/org-chart")
def get_org_chart(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get organization chart data."""
    org_id = current_user.organization_id

    employees = db.query(Employee).filter(
        Employee.organization_id == org_id,
        Employee.employment_status == "active"
    ).all()

    # Build lookup
    emp_map = {emp.id: emp for emp in employees}

    # Find root nodes (no manager or manager not in active list)
    roots = []
    for emp in employees:
        if not emp.manager_id or emp.manager_id not in emp_map:
            roots.append(emp)

    def build_node(emp: Employee) -> dict:
        children = [e for e in employees if e.manager_id == emp.id]
        return {
            "id": emp.id,
            "name": f"{emp.first_name} {emp.last_name}",
            "title": emp.title,
            "department": emp.department,
            "avatar_url": emp.avatar_url,
            "children": [build_node(c) for c in children],
        }

    return [build_node(root) for root in roots]


# ============================================================================
# PTO POLICIES
# ============================================================================

@router.get("/pto/policies", response_model=List[PTOPolicyResponse])
def list_pto_policies(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List PTO policies."""
    policies = db.query(PTOPolicy).filter(
        PTOPolicy.organization_id == current_user.organization_id
    ).order_by(PTOPolicy.name).all()

    return policies


@router.post("/pto/policies", response_model=PTOPolicyResponse)
def create_pto_policy(
    policy: PTOPolicyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a PTO policy."""
    db_policy = PTOPolicy(
        organization_id=current_user.organization_id,
        **policy.model_dump()
    )
    db.add(db_policy)
    db.commit()
    db.refresh(db_policy)

    return db_policy


@router.patch("/pto/policies/{policy_id}", response_model=PTOPolicyResponse)
def update_pto_policy(
    policy_id: int,
    updates: PTOPolicyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a PTO policy."""
    policy = db.query(PTOPolicy).filter(
        PTOPolicy.id == policy_id,
        PTOPolicy.organization_id == current_user.organization_id
    ).first()

    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(policy, key, value)

    db.commit()
    db.refresh(policy)

    return policy


@router.delete("/pto/policies/{policy_id}")
def delete_pto_policy(
    policy_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a PTO policy."""
    policy = db.query(PTOPolicy).filter(
        PTOPolicy.id == policy_id,
        PTOPolicy.organization_id == current_user.organization_id
    ).first()

    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    db.delete(policy)
    db.commit()

    return {"message": "Policy deleted"}


# ============================================================================
# PTO BALANCES
# ============================================================================

@router.get("/pto/balances", response_model=List[PTOBalanceResponse])
def get_my_pto_balances(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's PTO balances."""
    # Find employee record for current user
    employee = db.query(Employee).filter(
        Employee.user_id == current_user.id,
        Employee.organization_id == current_user.organization_id
    ).first()

    if not employee:
        return []

    current_year = date.today().year

    balances = db.query(PTOBalance).filter(
        PTOBalance.employee_id == employee.id,
        PTOBalance.balance_year == current_year
    ).all()

    result = []
    for bal in balances:
        policy = bal.policy
        result.append({
            "id": bal.id,
            "employee_id": bal.employee_id,
            "policy_id": bal.policy_id,
            "available_days": bal.available_days,
            "used_days": bal.used_days,
            "pending_days": bal.pending_days,
            "balance_year": bal.balance_year,
            "policy_name": policy.name if policy else None,
            "policy_type": policy.pto_type if policy else None,
        })

    return result


@router.get("/pto/balances/{employee_id}", response_model=List[PTOBalanceResponse])
def get_employee_pto_balances(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific employee's PTO balances (admin only)."""
    emp = get_employee_with_org_check(db, employee_id, current_user.organization_id)

    current_year = date.today().year

    balances = db.query(PTOBalance).filter(
        PTOBalance.employee_id == employee_id,
        PTOBalance.balance_year == current_year
    ).all()

    result = []
    for bal in balances:
        policy = bal.policy
        result.append({
            "id": bal.id,
            "employee_id": bal.employee_id,
            "policy_id": bal.policy_id,
            "available_days": bal.available_days,
            "used_days": bal.used_days,
            "pending_days": bal.pending_days,
            "balance_year": bal.balance_year,
            "policy_name": policy.name if policy else None,
            "policy_type": policy.pto_type if policy else None,
        })

    return result


@router.post("/pto/balances/initialize/{employee_id}")
def initialize_pto_balances(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Initialize PTO balances for an employee based on policies."""
    emp = get_employee_with_org_check(db, employee_id, current_user.organization_id)

    current_year = date.today().year

    # Get active policies
    policies = db.query(PTOPolicy).filter(
        PTOPolicy.organization_id == current_user.organization_id,
        PTOPolicy.is_active == True
    ).all()

    created = 0
    for policy in policies:
        # Skip if contractor and policy doesn't apply
        if emp.is_contractor and not policy.applies_to_contractors:
            continue

        # Check if balance already exists
        existing = db.query(PTOBalance).filter(
            PTOBalance.employee_id == employee_id,
            PTOBalance.policy_id == policy.id,
            PTOBalance.balance_year == current_year
        ).first()

        if not existing:
            balance = PTOBalance(
                organization_id=current_user.organization_id,
                employee_id=employee_id,
                policy_id=policy.id,
                available_days=policy.annual_days,
                used_days=0,
                pending_days=0,
                balance_year=current_year
            )
            db.add(balance)
            created += 1

    db.commit()

    return {"message": f"Initialized {created} PTO balances"}


# ============================================================================
# PTO REQUESTS
# ============================================================================

@router.get("/pto/requests", response_model=List[PTORequestResponse])
def list_pto_requests(
    status: Optional[str] = Query(None),
    employee_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List PTO requests."""
    query = db.query(PTORequest).filter(
        PTORequest.organization_id == current_user.organization_id
    )

    if status:
        query = query.filter(PTORequest.status == status)
    if employee_id:
        query = query.filter(PTORequest.employee_id == employee_id)

    requests = query.order_by(PTORequest.start_date.desc()).all()

    result = []
    for req in requests:
        emp = req.employee
        policy = req.policy
        reviewer = req.reviewed_by

        result.append({
            "id": req.id,
            "employee_id": req.employee_id,
            "policy_id": req.policy_id,
            "start_date": req.start_date,
            "end_date": req.end_date,
            "days_requested": req.days_requested,
            "notes": req.notes,
            "status": req.status,
            "reviewed_by_id": req.reviewed_by_id,
            "reviewed_at": req.reviewed_at,
            "review_notes": req.review_notes,
            "created_at": req.created_at,
            "updated_at": req.updated_at,
            "employee_name": f"{emp.first_name} {emp.last_name}" if emp else None,
            "policy_name": policy.name if policy else None,
            "reviewed_by_name": reviewer.full_name if reviewer else None,
        })

    return result


@router.post("/pto/requests", response_model=PTORequestResponse)
def create_pto_request(
    request_data: PTORequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit a PTO request."""
    # Find employee record for current user
    employee = db.query(Employee).filter(
        Employee.user_id == current_user.id,
        Employee.organization_id == current_user.organization_id
    ).first()

    if not employee:
        raise HTTPException(status_code=400, detail="No employee record found for current user")

    # Validate policy
    policy = db.query(PTOPolicy).filter(
        PTOPolicy.id == request_data.policy_id,
        PTOPolicy.organization_id == current_user.organization_id
    ).first()

    if not policy:
        raise HTTPException(status_code=404, detail="PTO policy not found")

    # Check balance
    current_year = date.today().year
    balance = db.query(PTOBalance).filter(
        PTOBalance.employee_id == employee.id,
        PTOBalance.policy_id == policy.id,
        PTOBalance.balance_year == current_year
    ).first()

    if balance:
        available = balance.available_days - balance.pending_days
        if request_data.days_requested > available:
            raise HTTPException(status_code=400, detail=f"Insufficient PTO balance. Available: {available} days")

    # Create request
    db_request = PTORequest(
        organization_id=current_user.organization_id,
        employee_id=employee.id,
        policy_id=request_data.policy_id,
        start_date=request_data.start_date,
        end_date=request_data.end_date,
        days_requested=request_data.days_requested,
        notes=request_data.notes,
        status="pending" if policy.requires_approval else "approved"
    )
    db.add(db_request)

    # Update pending balance
    if balance:
        balance.pending_days += request_data.days_requested

    db.commit()
    db.refresh(db_request)

    return {
        "id": db_request.id,
        "employee_id": db_request.employee_id,
        "policy_id": db_request.policy_id,
        "start_date": db_request.start_date,
        "end_date": db_request.end_date,
        "days_requested": db_request.days_requested,
        "notes": db_request.notes,
        "status": db_request.status,
        "reviewed_by_id": db_request.reviewed_by_id,
        "reviewed_at": db_request.reviewed_at,
        "review_notes": db_request.review_notes,
        "created_at": db_request.created_at,
        "updated_at": db_request.updated_at,
        "employee_name": f"{employee.first_name} {employee.last_name}",
        "policy_name": policy.name,
        "reviewed_by_name": None,
    }


@router.post("/pto/requests/{request_id}/approve")
def approve_pto_request(
    request_id: int,
    review_notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a PTO request."""
    pto_request = db.query(PTORequest).filter(
        PTORequest.id == request_id,
        PTORequest.organization_id == current_user.organization_id
    ).first()

    if not pto_request:
        raise HTTPException(status_code=404, detail="Request not found")

    if pto_request.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    pto_request.status = "approved"
    pto_request.reviewed_by_id = current_user.id
    pto_request.reviewed_at = datetime.now(UTC)
    pto_request.review_notes = review_notes

    # Move from pending to used when request date arrives
    # For simplicity, we'll keep it in pending until the dates pass

    db.commit()

    return {"message": "Request approved"}


@router.post("/pto/requests/{request_id}/deny")
def deny_pto_request(
    request_id: int,
    review_notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deny a PTO request."""
    pto_request = db.query(PTORequest).filter(
        PTORequest.id == request_id,
        PTORequest.organization_id == current_user.organization_id
    ).first()

    if not pto_request:
        raise HTTPException(status_code=404, detail="Request not found")

    if pto_request.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    # Return pending days to balance
    current_year = date.today().year
    balance = db.query(PTOBalance).filter(
        PTOBalance.employee_id == pto_request.employee_id,
        PTOBalance.policy_id == pto_request.policy_id,
        PTOBalance.balance_year == current_year
    ).first()

    if balance:
        balance.pending_days -= pto_request.days_requested

    pto_request.status = "denied"
    pto_request.reviewed_by_id = current_user.id
    pto_request.reviewed_at = datetime.now(UTC)
    pto_request.review_notes = review_notes

    db.commit()

    return {"message": "Request denied"}


@router.delete("/pto/requests/{request_id}")
def cancel_pto_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a PTO request."""
    pto_request = db.query(PTORequest).filter(
        PTORequest.id == request_id,
        PTORequest.organization_id == current_user.organization_id
    ).first()

    if not pto_request:
        raise HTTPException(status_code=404, detail="Request not found")

    if pto_request.status not in ["pending", "approved"]:
        raise HTTPException(status_code=400, detail="Cannot cancel this request")

    # Return days to balance
    current_year = date.today().year
    balance = db.query(PTOBalance).filter(
        PTOBalance.employee_id == pto_request.employee_id,
        PTOBalance.policy_id == pto_request.policy_id,
        PTOBalance.balance_year == current_year
    ).first()

    if balance:
        if pto_request.status == "pending":
            balance.pending_days -= pto_request.days_requested
        # If approved and dates haven't passed, adjust used_days would be more complex

    pto_request.status = "cancelled"

    db.commit()

    return {"message": "Request cancelled"}


@router.get("/pto/calendar", response_model=List[PTOCalendarEntry])
def get_pto_calendar(
    start_date: date = Query(...),
    end_date: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get PTO calendar for date range."""
    requests = db.query(PTORequest).filter(
        PTORequest.organization_id == current_user.organization_id,
        PTORequest.status == "approved",
        PTORequest.start_date <= end_date,
        PTORequest.end_date >= start_date
    ).all()

    result = []
    for req in requests:
        emp = req.employee
        policy = req.policy

        result.append({
            "employee_id": req.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}" if emp else "Unknown",
            "start_date": req.start_date,
            "end_date": req.end_date,
            "days": req.days_requested,
            "policy_type": policy.pto_type if policy else "other",
            "status": req.status,
        })

    return result


# ============================================================================
# ONBOARDING TEMPLATES
# ============================================================================

@router.get("/onboarding/templates", response_model=List[OnboardingTemplateResponse])
def list_onboarding_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List onboarding templates."""
    templates = db.query(OnboardingTemplate).filter(
        OnboardingTemplate.organization_id == current_user.organization_id
    ).order_by(OnboardingTemplate.name).all()

    result = []
    for tmpl in templates:
        tasks = []
        if tmpl.tasks_json:
            try:
                tasks = json.loads(tmpl.tasks_json)
            except json.JSONDecodeError:
                pass

        result.append({
            "id": tmpl.id,
            "name": tmpl.name,
            "description": tmpl.description,
            "role": tmpl.role,
            "department": tmpl.department,
            "employment_type": tmpl.employment_type,
            "tasks": tasks,
            "is_default": tmpl.is_default,
            "is_active": tmpl.is_active,
            "created_at": tmpl.created_at,
            "updated_at": tmpl.updated_at,
        })

    return result


@router.post("/onboarding/templates", response_model=OnboardingTemplateResponse)
def create_onboarding_template(
    template: OnboardingTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create an onboarding template."""
    tasks_json = json.dumps([t.model_dump() for t in template.tasks]) if template.tasks else None

    db_template = OnboardingTemplate(
        organization_id=current_user.organization_id,
        name=template.name,
        description=template.description,
        role=template.role,
        department=template.department,
        employment_type=template.employment_type,
        tasks_json=tasks_json,
        is_default=template.is_default,
        is_active=template.is_active,
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)

    return {
        "id": db_template.id,
        "name": db_template.name,
        "description": db_template.description,
        "role": db_template.role,
        "department": db_template.department,
        "employment_type": db_template.employment_type,
        "tasks": template.tasks,
        "is_default": db_template.is_default,
        "is_active": db_template.is_active,
        "created_at": db_template.created_at,
        "updated_at": db_template.updated_at,
    }


@router.patch("/onboarding/templates/{template_id}", response_model=OnboardingTemplateResponse)
def update_onboarding_template(
    template_id: int,
    updates: OnboardingTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an onboarding template."""
    tmpl = db.query(OnboardingTemplate).filter(
        OnboardingTemplate.id == template_id,
        OnboardingTemplate.organization_id == current_user.organization_id
    ).first()

    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data = updates.model_dump(exclude_unset=True)

    if "tasks" in update_data:
        update_data["tasks_json"] = json.dumps([t.model_dump() if hasattr(t, 'model_dump') else t for t in update_data["tasks"]])
        del update_data["tasks"]

    for key, value in update_data.items():
        setattr(tmpl, key, value)

    db.commit()
    db.refresh(tmpl)

    tasks = []
    if tmpl.tasks_json:
        try:
            tasks = json.loads(tmpl.tasks_json)
        except json.JSONDecodeError:
            pass

    return {
        "id": tmpl.id,
        "name": tmpl.name,
        "description": tmpl.description,
        "role": tmpl.role,
        "department": tmpl.department,
        "employment_type": tmpl.employment_type,
        "tasks": tasks,
        "is_default": tmpl.is_default,
        "is_active": tmpl.is_active,
        "created_at": tmpl.created_at,
        "updated_at": tmpl.updated_at,
    }


@router.delete("/onboarding/templates/{template_id}")
def delete_onboarding_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an onboarding template."""
    tmpl = db.query(OnboardingTemplate).filter(
        OnboardingTemplate.id == template_id,
        OnboardingTemplate.organization_id == current_user.organization_id
    ).first()

    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    db.delete(tmpl)
    db.commit()

    return {"message": "Template deleted"}


# ============================================================================
# ONBOARDING CHECKLISTS
# ============================================================================

@router.get("/onboarding/checklists", response_model=List[OnboardingChecklistResponse])
def list_onboarding_checklists(
    is_completed: Optional[bool] = Query(None),
    employee_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List onboarding checklists."""
    query = db.query(OnboardingChecklist).filter(
        OnboardingChecklist.organization_id == current_user.organization_id
    )

    if is_completed is not None:
        query = query.filter(OnboardingChecklist.is_completed == is_completed)
    if employee_id:
        query = query.filter(OnboardingChecklist.employee_id == employee_id)

    checklists = query.order_by(OnboardingChecklist.start_date.desc()).all()

    result = []
    for cl in checklists:
        emp = cl.employee
        tasks = [{
            "id": t.id,
            "checklist_id": t.checklist_id,
            "name": t.name,
            "description": t.description,
            "category": t.category,
            "due_date": t.due_date,
            "due_days_after_start": t.due_days_after_start,
            "assignee_type": t.assignee_type,
            "assigned_to_id": t.assigned_to_id,
            "is_completed": t.is_completed,
            "completed_at": t.completed_at,
            "completed_by_id": t.completed_by_id,
            "completion_notes": t.completion_notes,
            "sort_order": t.sort_order,
            "assigned_to_name": t.assigned_to.full_name if t.assigned_to else None,
            "completed_by_name": t.completed_by.full_name if t.completed_by else None,
        } for t in cl.tasks]

        progress = (cl.completed_tasks / cl.total_tasks * 100) if cl.total_tasks > 0 else 0

        result.append({
            "id": cl.id,
            "employee_id": cl.employee_id,
            "template_id": cl.template_id,
            "name": cl.name,
            "start_date": cl.start_date,
            "target_completion_date": cl.target_completion_date,
            "total_tasks": cl.total_tasks,
            "completed_tasks": cl.completed_tasks,
            "is_completed": cl.is_completed,
            "completed_at": cl.completed_at,
            "created_at": cl.created_at,
            "updated_at": cl.updated_at,
            "employee_name": f"{emp.first_name} {emp.last_name}" if emp else None,
            "tasks": tasks,
            "progress_percent": progress,
        })

    return result


@router.post("/onboarding/checklists", response_model=OnboardingChecklistResponse)
def create_onboarding_checklist(
    checklist: OnboardingChecklistCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create an onboarding checklist for an employee."""
    org_id = current_user.organization_id

    # Validate employee
    emp = get_employee_with_org_check(db, checklist.employee_id, org_id)

    # Get template if provided
    tasks_to_create = []
    if checklist.template_id:
        tmpl = db.query(OnboardingTemplate).filter(
            OnboardingTemplate.id == checklist.template_id,
            OnboardingTemplate.organization_id == org_id
        ).first()

        if tmpl and tmpl.tasks_json:
            try:
                tasks_to_create = json.loads(tmpl.tasks_json)
            except json.JSONDecodeError:
                pass

    # Create checklist
    db_checklist = OnboardingChecklist(
        organization_id=org_id,
        employee_id=checklist.employee_id,
        template_id=checklist.template_id,
        name=checklist.name,
        start_date=checklist.start_date,
        target_completion_date=checklist.target_completion_date,
        total_tasks=len(tasks_to_create),
        completed_tasks=0,
    )
    db.add(db_checklist)
    db.flush()

    # Create tasks from template
    for idx, task_def in enumerate(tasks_to_create):
        due_date = None
        if task_def.get("due_days"):
            from datetime import timedelta
            due_date = checklist.start_date + timedelta(days=task_def["due_days"])

        db_task = OnboardingTask(
            checklist_id=db_checklist.id,
            name=task_def.get("name", "Task"),
            description=task_def.get("description"),
            category=task_def.get("category"),
            due_date=due_date,
            due_days_after_start=task_def.get("due_days"),
            assignee_type=task_def.get("assignee_type"),
            sort_order=idx,
        )
        db.add(db_task)

    db.commit()
    db.refresh(db_checklist)

    tasks = [{
        "id": t.id,
        "checklist_id": t.checklist_id,
        "name": t.name,
        "description": t.description,
        "category": t.category,
        "due_date": t.due_date,
        "due_days_after_start": t.due_days_after_start,
        "assignee_type": t.assignee_type,
        "assigned_to_id": t.assigned_to_id,
        "is_completed": t.is_completed,
        "completed_at": t.completed_at,
        "completed_by_id": t.completed_by_id,
        "completion_notes": t.completion_notes,
        "sort_order": t.sort_order,
        "assigned_to_name": None,
        "completed_by_name": None,
    } for t in db_checklist.tasks]

    return {
        "id": db_checklist.id,
        "employee_id": db_checklist.employee_id,
        "template_id": db_checklist.template_id,
        "name": db_checklist.name,
        "start_date": db_checklist.start_date,
        "target_completion_date": db_checklist.target_completion_date,
        "total_tasks": db_checklist.total_tasks,
        "completed_tasks": db_checklist.completed_tasks,
        "is_completed": db_checklist.is_completed,
        "completed_at": db_checklist.completed_at,
        "created_at": db_checklist.created_at,
        "updated_at": db_checklist.updated_at,
        "employee_name": f"{emp.first_name} {emp.last_name}",
        "tasks": tasks,
        "progress_percent": 0,
    }


@router.post("/onboarding/tasks/{task_id}/complete")
def complete_onboarding_task(
    task_id: int,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark an onboarding task as complete."""
    task = db.query(OnboardingTask).join(OnboardingChecklist).filter(
        OnboardingTask.id == task_id,
        OnboardingChecklist.organization_id == current_user.organization_id
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.is_completed:
        raise HTTPException(status_code=400, detail="Task already completed")

    task.is_completed = True
    task.completed_at = datetime.now(UTC)
    task.completed_by_id = current_user.id
    task.completion_notes = notes

    # Update checklist progress
    checklist = task.checklist
    checklist.completed_tasks += 1

    if checklist.completed_tasks >= checklist.total_tasks:
        checklist.is_completed = True
        checklist.completed_at = datetime.now(UTC)

    db.commit()

    return {"message": "Task completed"}


# ============================================================================
# CONTRACTORS
# ============================================================================

@router.get("/contractors", response_model=List[EmployeeResponse])
def list_contractors(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all contractors (1099)."""
    contractors = db.query(Employee).filter(
        Employee.organization_id == current_user.organization_id,
        Employee.is_contractor == True
    ).order_by(Employee.last_name, Employee.first_name).all()

    return [build_employee_response(c, db) for c in contractors]
