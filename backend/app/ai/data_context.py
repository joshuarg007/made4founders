"""
Data Context Builder for AI Assistant.

Builds relevant context from user's business data based on query intent.
Respects organization boundaries and manages token budgets.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, UTC, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc

logger = logging.getLogger(__name__)


class DataContextBuilder:
    """Builds context from user's business data for AI queries."""

    def __init__(self, db: Session, organization_id: int):
        self.db = db
        self.organization_id = organization_id

    def build_context(self, intent: str, query: str = "") -> Dict[str, Any]:
        """
        Build context based on detected intent.

        Args:
            intent: The detected query intent (runway, revenue, cap_table, etc.)
            query: Original user query for additional context

        Returns:
            Dict with relevant business data
        """
        context = {
            "intent": intent,
            "query": query,
            "timestamp": datetime.now(UTC).isoformat()
        }

        # Build context based on intent
        if intent == "runway" or intent == "general":
            context["financial"] = self._get_financial_context()

        if intent == "revenue" or intent == "general":
            context["revenue"] = self._get_revenue_context()

        if intent == "cap_table":
            context["cap_table"] = self._get_cap_table_context()

        if intent == "compliance":
            context["compliance"] = self._get_compliance_context()

        if intent == "investor":
            context["investor"] = self._get_investor_context()

        if intent == "budget":
            context["budget"] = self._get_budget_context()

        if intent == "team":
            context["team"] = self._get_team_context()

        # Always include basic metrics summary for general queries
        if intent == "general":
            context["metrics"] = self._get_metrics_summary()

        return context

    def _get_financial_context(self) -> Dict[str, Any]:
        """Get financial context (cash position, burn rate, runway)."""
        from ..models import TellerAccount, TellerTransaction, Metric

        # Get Teller accounts
        accounts = self.db.query(TellerAccount).filter(
            TellerAccount.organization_id == self.organization_id
        ).all()

        total_cash = sum(
            acc.balance_current or 0 for acc in accounts
            if acc.account_type in ['depository', 'checking', 'savings']
        )

        # Get recent transactions for burn rate
        thirty_days_ago = datetime.now(UTC) - timedelta(days=30)
        transactions = self.db.query(TellerTransaction).filter(
            TellerTransaction.organization_id == self.organization_id,
            TellerTransaction.date >= thirty_days_ago.date()
        ).all()

        expenses = sum(t.amount for t in transactions if t.amount > 0)
        income = sum(abs(t.amount) for t in transactions if t.amount < 0)
        net_burn = expenses - income

        runway_months = total_cash / net_burn if net_burn > 0 else float('inf')

        # Get latest runway metric if available
        runway_metric = self.db.query(Metric).filter(
            Metric.organization_id == self.organization_id,
            Metric.metric_type == "runway"
        ).order_by(desc(Metric.date)).first()

        return {
            "total_cash": total_cash,
            "monthly_burn": net_burn,
            "monthly_expenses": expenses,
            "monthly_income": income,
            "runway_months": round(runway_months, 1) if runway_months != float('inf') else None,
            "runway_metric": runway_metric.value if runway_metric else None,
            "accounts_count": len(accounts),
            "data_period": "last 30 days"
        }

    def _get_revenue_context(self) -> Dict[str, Any]:
        """Get revenue context (MRR, ARR, growth)."""
        from ..models import Metric, StripeSubscriptionSync

        # Get latest revenue metrics
        metrics = {}
        for metric_type in ['mrr', 'arr', 'revenue', 'customers', 'churn']:
            metric = self.db.query(Metric).filter(
                Metric.organization_id == self.organization_id,
                Metric.metric_type == metric_type
            ).order_by(desc(Metric.date)).first()
            if metric:
                metrics[metric_type] = metric.value

        # Get subscription data if available
        subscriptions = self.db.query(StripeSubscriptionSync).filter(
            StripeSubscriptionSync.organization_id == self.organization_id,
            StripeSubscriptionSync.status == "active"
        ).all()

        active_subs = len(subscriptions)
        total_mrr = sum(s.amount_cents / 100 for s in subscriptions if s.interval == 'month')

        return {
            "mrr": metrics.get('mrr', total_mrr),
            "arr": metrics.get('arr', metrics.get('mrr', 0) * 12),
            "total_customers": metrics.get('customers'),
            "churn_rate": metrics.get('churn'),
            "active_subscriptions": active_subs,
            "calculated_mrr_from_stripe": total_mrr if total_mrr > 0 else None
        }

    def _get_cap_table_context(self) -> Dict[str, Any]:
        """Get cap table context (shareholders, ownership, equity)."""
        from ..models import Shareholder, ShareClass, EquityGrant, StockOption

        shareholders = self.db.query(Shareholder).filter(
            Shareholder.organization_id == self.organization_id
        ).all()

        share_classes = self.db.query(ShareClass).filter(
            ShareClass.organization_id == self.organization_id
        ).all()

        grants = self.db.query(EquityGrant).filter(
            EquityGrant.organization_id == self.organization_id
        ).all()

        options = self.db.query(StockOption).filter(
            StockOption.organization_id == self.organization_id
        ).all()

        total_shares = sum(sc.authorized_shares or 0 for sc in share_classes)
        total_granted = sum(g.shares_granted or 0 for g in grants)
        total_options = sum(o.shares_granted or 0 for o in options)

        # Ownership breakdown by type
        ownership_by_type = {}
        for sh in shareholders:
            sh_type = sh.shareholder_type or 'other'
            if sh_type not in ownership_by_type:
                ownership_by_type[sh_type] = 0
            # Sum grants for this shareholder
            sh_grants = [g for g in grants if g.shareholder_id == sh.id]
            ownership_by_type[sh_type] += sum(g.shares_granted or 0 for g in sh_grants)

        return {
            "total_shareholders": len(shareholders),
            "share_classes": len(share_classes),
            "total_authorized_shares": total_shares,
            "total_granted_shares": total_granted,
            "total_options_granted": total_options,
            "ownership_by_type": ownership_by_type,
            "shareholders_list": [
                {"name": sh.name, "type": sh.shareholder_type}
                for sh in shareholders[:10]  # Limit to top 10
            ]
        }

    def _get_compliance_context(self) -> Dict[str, Any]:
        """Get compliance context (deadlines, checklist progress)."""
        from ..models import Deadline, ChecklistProgress

        # Upcoming deadlines
        today = datetime.now(UTC).date()
        upcoming_deadlines = self.db.query(Deadline).filter(
            Deadline.organization_id == self.organization_id,
            Deadline.due_date >= today,
            Deadline.is_completed == False
        ).order_by(Deadline.due_date).limit(10).all()

        # Overdue deadlines
        overdue = self.db.query(Deadline).filter(
            Deadline.organization_id == self.organization_id,
            Deadline.due_date < today,
            Deadline.is_completed == False
        ).all()

        # Checklist progress
        progress = self.db.query(ChecklistProgress).filter(
            ChecklistProgress.organization_id == self.organization_id
        ).all()

        completed_items = sum(1 for p in progress if p.is_completed)
        total_items = 96  # Fixed total - matches frontend checklist items

        return {
            "upcoming_deadlines": [
                {
                    "title": d.title,
                    "due_date": d.due_date.isoformat(),
                    "type": d.deadline_type
                }
                for d in upcoming_deadlines
            ],
            "overdue_count": len(overdue),
            "checklist_progress": f"{completed_items}/{total_items}",
            "checklist_percentage": round(completed_items / total_items * 100, 1) if total_items > 0 else 0
        }

    def _get_investor_context(self) -> Dict[str, Any]:
        """Get investor relations context."""
        from ..models import InvestorUpdate, DataRoomDocument, Shareholder

        # Recent investor updates
        recent_updates = self.db.query(InvestorUpdate).filter(
            InvestorUpdate.organization_id == self.organization_id
        ).order_by(desc(InvestorUpdate.created_at)).limit(5).all()

        # Data room stats
        documents = self.db.query(DataRoomDocument).filter(
            DataRoomDocument.organization_id == self.organization_id
        ).all()

        # Investor shareholders
        investors = self.db.query(Shareholder).filter(
            Shareholder.organization_id == self.organization_id,
            Shareholder.shareholder_type == "investor"
        ).all()

        return {
            "recent_updates": [
                {
                    "title": u.title,
                    "status": u.status,
                    "sent_at": u.sent_at.isoformat() if u.sent_at else None
                }
                for u in recent_updates
            ],
            "data_room_documents": len(documents),
            "total_investors": len(investors),
            "investor_names": [i.name for i in investors[:10]]
        }

    def _get_budget_context(self) -> Dict[str, Any]:
        """Get budget context (spending, variance)."""
        from ..models import BudgetPeriod, BudgetLineItem, BudgetCategory

        # Get current budget period
        today = datetime.now(UTC).date()
        current_period = self.db.query(BudgetPeriod).filter(
            BudgetPeriod.organization_id == self.organization_id,
            BudgetPeriod.start_date <= today,
            BudgetPeriod.end_date >= today
        ).first()

        if not current_period:
            return {"message": "No active budget period found"}

        # Get line items
        line_items = self.db.query(BudgetLineItem).filter(
            BudgetLineItem.period_id == current_period.id
        ).all()

        total_budget = sum(li.budgeted_amount or 0 for li in line_items)
        total_actual = sum(li.actual_amount or 0 for li in line_items)
        variance = total_budget - total_actual

        # Categories over budget
        over_budget = [
            li for li in line_items
            if li.actual_amount and li.budgeted_amount
            and li.actual_amount > li.budgeted_amount
        ]

        return {
            "period": f"{current_period.start_date} to {current_period.end_date}",
            "total_budget": total_budget,
            "total_spent": total_actual,
            "variance": variance,
            "variance_percent": round((variance / total_budget * 100), 1) if total_budget > 0 else 0,
            "categories_over_budget": len(over_budget),
            "status": "on_track" if variance >= 0 else "over_budget"
        }

    def _get_team_context(self) -> Dict[str, Any]:
        """Get team context (employees, PTO, onboarding)."""
        from ..models import Employee, PTORequest, OnboardingChecklist

        employees = self.db.query(Employee).filter(
            Employee.organization_id == self.organization_id
        ).all()

        active_employees = [e for e in employees if e.employment_status == 'active']
        contractors = [e for e in employees if e.is_contractor]

        # Pending PTO requests
        pending_pto = self.db.query(PTORequest).filter(
            PTORequest.organization_id == self.organization_id,
            PTORequest.status == "pending"
        ).count()

        # Active onboarding
        active_onboarding = self.db.query(OnboardingChecklist).filter(
            OnboardingChecklist.organization_id == self.organization_id,
            OnboardingChecklist.is_completed == False
        ).count()

        return {
            "total_employees": len(employees),
            "active_employees": len(active_employees),
            "contractors": len(contractors),
            "pending_pto_requests": pending_pto,
            "active_onboarding": active_onboarding,
            "departments": list(set(e.department for e in employees if e.department))
        }

    def _get_metrics_summary(self) -> Dict[str, Any]:
        """Get a summary of key metrics."""
        from ..models import Metric

        summary = {}
        key_metrics = ['mrr', 'arr', 'runway', 'burn_rate', 'cash', 'customers']

        for metric_type in key_metrics:
            metric = self.db.query(Metric).filter(
                Metric.organization_id == self.organization_id,
                Metric.metric_type == metric_type
            ).order_by(desc(Metric.date)).first()
            if metric:
                summary[metric_type] = {
                    "value": metric.value,
                    "date": metric.date.isoformat() if metric.date else None,
                    "unit": metric.unit
                }

        return summary


def build_context(
    db: Session,
    organization_id: int,
    intent: str,
    query: str = ""
) -> Dict[str, Any]:
    """
    Convenience function to build context.

    Args:
        db: Database session
        organization_id: User's organization ID
        intent: Query intent
        query: Original query

    Returns:
        Context dict for AI prompt
    """
    builder = DataContextBuilder(db, organization_id)
    return builder.build_context(intent, query)


def format_context_for_prompt(context: Dict[str, Any]) -> str:
    """
    Format context dict as a readable string for the AI prompt.

    Args:
        context: Context dictionary

    Returns:
        Formatted string
    """
    parts = []

    if "financial" in context:
        fin = context["financial"]
        parts.append("FINANCIAL STATUS:")
        parts.append(f"  Cash Position: ${float(fin.get('total_cash', 0) or 0):,.2f}")
        parts.append(f"  Monthly Burn Rate: ${float(fin.get('monthly_burn', 0) or 0):,.2f}")
        if fin.get('runway_months'):
            parts.append(f"  Runway: {fin['runway_months']} months")
        parts.append("")

    if "revenue" in context:
        rev = context["revenue"]
        parts.append("REVENUE METRICS:")
        if rev.get('mrr'):
            parts.append(f"  MRR: ${float(rev['mrr']):,.2f}")
        if rev.get('arr'):
            parts.append(f"  ARR: ${float(rev['arr']):,.2f}")
        if rev.get('total_customers'):
            parts.append(f"  Customers: {rev['total_customers']}")
        parts.append("")

    if "cap_table" in context:
        cap = context["cap_table"]
        parts.append("CAP TABLE:")
        parts.append(f"  Total Shareholders: {cap.get('total_shareholders', 0)}")
        parts.append(f"  Total Shares Issued: {int(cap.get('total_granted_shares', 0) or 0):,}")
        if cap.get('ownership_by_type'):
            for stype, shares in cap['ownership_by_type'].items():
                parts.append(f"  {stype.title()}: {int(shares or 0):,} shares")
        parts.append("")

    if "compliance" in context:
        comp = context["compliance"]
        parts.append("COMPLIANCE:")
        parts.append(f"  Checklist Progress: {comp.get('checklist_progress', 'N/A')}")
        parts.append(f"  Overdue Deadlines: {comp.get('overdue_count', 0)}")
        if comp.get('upcoming_deadlines'):
            parts.append("  Upcoming:")
            for d in comp['upcoming_deadlines'][:3]:
                parts.append(f"    - {d['title']} (due {d['due_date']})")
        parts.append("")

    if "budget" in context:
        budget = context["budget"]
        if budget.get('message'):
            parts.append(f"BUDGET: {budget['message']}")
        else:
            parts.append("BUDGET:")
            parts.append(f"  Period: {budget.get('period', 'N/A')}")
            parts.append(f"  Total Budget: ${float(budget.get('total_budget', 0) or 0):,.2f}")
            parts.append(f"  Total Spent: ${float(budget.get('total_spent', 0) or 0):,.2f}")
            parts.append(f"  Variance: ${float(budget.get('variance', 0) or 0):,.2f} ({budget.get('variance_percent', 0)}%)")
        parts.append("")

    if "team" in context:
        team = context["team"]
        parts.append("TEAM:")
        parts.append(f"  Total Employees: {team.get('total_employees', 0)}")
        parts.append(f"  Active: {team.get('active_employees', 0)}")
        parts.append(f"  Contractors: {team.get('contractors', 0)}")
        parts.append(f"  Pending PTO Requests: {team.get('pending_pto_requests', 0)}")
        parts.append("")

    if "metrics" in context:
        metrics = context["metrics"]
        if metrics:
            parts.append("KEY METRICS:")
            for name, data in metrics.items():
                if data.get('value') is not None:
                    unit = data.get('unit', '')
                    parts.append(f"  {name.upper()}: {data['value']} {unit}")
            parts.append("")

    return '\n'.join(parts)
