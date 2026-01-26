"""
Smart Response System - Logic-based responses without AI.

Handles common questions with direct data lookups, trend analysis,
and templated responses. Falls back to AI only for complex/novel queries.
"""

import re
import logging
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_

logger = logging.getLogger(__name__)


# =============================================================================
# PATTERN DEFINITIONS - Expanded for comprehensive coverage
# =============================================================================

QUESTION_PATTERNS = {
    # -------------------------------------------------------------------------
    # RUNWAY & CASH
    # -------------------------------------------------------------------------
    r"(what('s| is)|how much).*(runway|cash.*(left|have|position)|money.*(left|have))": "handle_runway",
    r"(how long|when).*(cash|money|funds).*(last|run out)": "handle_runway",
    r"runway": "handle_runway",
    r"(will i|am i going to).*(run out|go broke|bankrupt)": "handle_runway",
    r"(how much|what).*(bank|account|balance)": "handle_cash_position",
    r"cash.?(flow|position|balance)": "handle_cash_position",

    # -------------------------------------------------------------------------
    # BURN RATE & EXPENSES
    # -------------------------------------------------------------------------
    r"(what('s| is)|how much).*(burn|burning|spend|spending)": "handle_burn_rate",
    r"burn.?rate": "handle_burn_rate",
    r"(monthly|weekly|daily).*(expense|cost|spend)": "handle_burn_rate",
    r"(where|what).*(money|cash).*(go|going|spent)": "handle_expenses_breakdown",
    r"(expense|cost|spending).*(breakdown|category|categories)": "handle_expenses_breakdown",
    r"(biggest|largest|top|main).*(expense|cost|spend)": "handle_expenses_breakdown",

    # -------------------------------------------------------------------------
    # REVENUE / MRR / ARR
    # -------------------------------------------------------------------------
    r"(what('s| is)).*(mrr|arr|revenue|income|earnings)": "handle_revenue",
    r"(mrr|arr|monthly.*(recurring|revenue))": "handle_revenue",
    r"(how.*(much|is)).*(making|earning|revenue)": "handle_revenue",
    r"(revenue|income|earnings).*(trend|growth|change)": "handle_revenue",
    r"(how|what).*(revenue|mrr|arr).*(grow|growing|trend|change)": "handle_revenue",
    r"(show|tell).*(revenue|mrr|arr|sales)": "handle_revenue",

    # -------------------------------------------------------------------------
    # GROWTH & TRENDS
    # -------------------------------------------------------------------------
    r"(how|what).*(grow|growth|growing)": "handle_growth",
    r"(am i|are we).*(grow|growing|scaling)": "handle_growth",
    r"growth.?rate": "handle_growth",
    r"(month.over.month|mom|yoy|year.over.year)": "handle_growth",
    r"(trend|trending|trajectory)": "handle_growth",
    r"(compare|comparison|vs|versus).*(last|previous|month|year|week)": "handle_comparison",

    # -------------------------------------------------------------------------
    # CUSTOMERS & CHURN
    # -------------------------------------------------------------------------
    r"(how many|what('s| is)).*(customer|subscriber|user|client)": "handle_customers",
    r"(customer|user|subscriber).*(count|number|total)": "handle_customers",
    r"churn": "handle_churn",
    r"(customer|user).*(lose|losing|lost|leave|leaving|cancel)": "handle_churn",
    r"retention": "handle_churn",
    r"(who|what).*(top|best|biggest|largest).*(customer|client)": "handle_top_customers",
    r"(customer|client).*(list|breakdown)": "handle_top_customers",

    # -------------------------------------------------------------------------
    # UNIT ECONOMICS
    # -------------------------------------------------------------------------
    r"(cac|customer acquisition cost|acquisition cost)": "handle_unit_economics",
    r"(ltv|lifetime value|customer.*(value|worth))": "handle_unit_economics",
    r"(ltv|cac).*(ratio|compare)": "handle_unit_economics",
    r"(arpu|average revenue per user)": "handle_unit_economics",
    r"unit.?economics": "handle_unit_economics",

    # -------------------------------------------------------------------------
    # PROFITABILITY
    # -------------------------------------------------------------------------
    r"(profit|profitable|profitability)": "handle_profitability",
    r"(am i|are we).*(profit|making money|losing money)": "handle_profitability",
    r"(net|gross).*(income|profit|margin)": "handle_profitability",
    r"break.?even": "handle_profitability",
    r"(when|how long).*(profit|break.?even)": "handle_profitability",

    # -------------------------------------------------------------------------
    # CAP TABLE & EQUITY
    # -------------------------------------------------------------------------
    r"(cap.?table|equity|ownership|shareholder|dilution)": "handle_cap_table",
    r"(who|what).*(own|investor|shareholder)": "handle_cap_table",
    r"(how much|what).*(own|ownership|equity|stake)": "handle_cap_table",
    r"(option|options|stock.?option|esop|pool)": "handle_options",
    r"(vesting|vest|vested)": "handle_options",
    r"(safe|convertible|note)": "handle_fundraising_instruments",

    # -------------------------------------------------------------------------
    # FUNDRAISING & INVESTORS
    # -------------------------------------------------------------------------
    r"(raise|raised|raising|fundrais)": "handle_fundraising",
    r"(how much).*(raise|raised|funding)": "handle_fundraising",
    r"(investor|investment).*(update|relation|communicate)": "handle_investor_updates",
    r"(valuation|worth|company value)": "handle_valuation",
    r"(pre.?money|post.?money)": "handle_valuation",
    r"(data.?room|due diligence)": "handle_data_room",

    # -------------------------------------------------------------------------
    # DEADLINES & COMPLIANCE
    # -------------------------------------------------------------------------
    r"(what|any|upcoming|next).*(deadline|due|filing|compliance)": "handle_deadlines",
    r"(when|what).*(due|deadline)": "handle_deadlines",
    r"(overdue|late|missed|past.?due)": "handle_overdue",
    r"(tax|taxes|filing|irs|state)": "handle_tax_deadlines",
    r"(compliance|regulatory|legal).*(status|check|item)": "handle_compliance",
    r"(checklist|getting.?started|setup)": "handle_checklist",

    # -------------------------------------------------------------------------
    # BUDGET
    # -------------------------------------------------------------------------
    r"(budget|spending|expense|over.?budget|under.?budget)": "handle_budget",
    r"(am i|are we).*(on track|over|under).*budget": "handle_budget",
    r"(how much).*(left|remaining|budget)": "handle_budget",
    r"(forecast|project|predict).*(spend|expense|cost)": "handle_forecast",

    # -------------------------------------------------------------------------
    # TEAM & HR
    # -------------------------------------------------------------------------
    r"(how many|team|employee|headcount|staff|people)": "handle_team",
    r"(pto|time.?off|vacation|leave|out of office)": "handle_pto",
    r"(hire|hiring|recruit|open.*(position|role))": "handle_hiring",
    r"(payroll|salary|salaries|compensation|pay)": "handle_payroll",
    r"(contractor|freelance|1099)": "handle_contractors",
    r"(onboard|onboarding|new.*(hire|employee))": "handle_onboarding",

    # -------------------------------------------------------------------------
    # TASKS & PRODUCTIVITY
    # -------------------------------------------------------------------------
    r"(task|todo|to.?do|action.?item)": "handle_tasks",
    r"(what|anything).*(need|should|must).*(do|done|complete)": "handle_tasks",
    r"(overdue|late|pending).*(task|item)": "handle_tasks",
    r"(priority|priorities|urgent|important)": "handle_priorities",

    # -------------------------------------------------------------------------
    # MEETINGS & CALENDAR
    # -------------------------------------------------------------------------
    r"(meeting|meetings|call|calls|calendar)": "handle_meetings",
    r"(what|any).*(meeting|call).*(today|tomorrow|week)": "handle_meetings",
    r"(schedule|scheduled|upcoming).*(meeting|call)": "handle_meetings",

    # -------------------------------------------------------------------------
    # DOCUMENTS
    # -------------------------------------------------------------------------
    r"(document|documents|file|files|paperwork)": "handle_documents",
    r"(missing|need|required).*(document|file|paperwork)": "handle_documents",

    # -------------------------------------------------------------------------
    # HELP & CAPABILITIES
    # -------------------------------------------------------------------------
    r"(what can you|how can you|help|assist|capable|do for me)": "handle_help",
    r"(who are you|what are you)": "handle_help",
    r"(feature|features|can you|able to)": "handle_help",
    r"(how do i|how to|show me how)": "handle_how_to",

    # -------------------------------------------------------------------------
    # DASHBOARD & OVERVIEW
    # -------------------------------------------------------------------------
    r"(overview|summary|dashboard|status)": "handle_overview",
    r"(how('s| is).*(business|company|startup|doing|going))": "handle_overview",
    r"(give me|show me|tell me).*(summary|overview|status|update)": "handle_overview",
    r"(what('s| is)).*(new|happening|update)": "handle_whats_new",
    r"(health|healthy|shape)": "handle_health_score",

    # -------------------------------------------------------------------------
    # GREETINGS & SMALL TALK
    # -------------------------------------------------------------------------
    r"^(hi|hello|hey|good morning|good afternoon|good evening)": "handle_greeting",
    r"^(thanks|thank you|thx)": "handle_thanks",
    r"(how are you|what's up|sup)": "handle_greeting",
}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def format_currency(amount: float, decimals: int = 0) -> str:
    """Format a number as currency."""
    if amount is None:
        return "N/A"
    if decimals == 0:
        return f"${amount:,.0f}"
    return f"${amount:,.{decimals}f}"


def format_percent(value: float, decimals: int = 1) -> str:
    """Format a number as percentage."""
    if value is None:
        return "N/A"
    return f"{value:+.{decimals}f}%" if value >= 0 else f"{value:.{decimals}f}%"


def format_trend(current: float, previous: float) -> Tuple[str, str, str]:
    """
    Calculate trend between two values.
    Returns: (change_percent, trend_direction, trend_emoji)
    """
    if previous is None or previous == 0:
        return ("N/A", "stable", "➡️")

    change = ((current - previous) / abs(previous)) * 100

    if change > 5:
        return (f"+{change:.1f}%", "up", "📈")
    elif change < -5:
        return (f"{change:.1f}%", "down", "📉")
    else:
        return (f"{change:+.1f}%", "stable", "➡️")


def get_metric_with_trend(db: Session, org_id: int, metric_type: str, days_back: int = 30) -> Dict[str, Any]:
    """Get current metric value and compare to previous period."""
    from ..models import Metric

    # Get current (most recent)
    current = db.query(Metric).filter(
        Metric.organization_id == org_id,
        Metric.metric_type == metric_type
    ).order_by(desc(Metric.date)).first()

    if not current:
        return {"current": None, "previous": None, "trend": "stable", "change": None}

    # Get value from previous period
    cutoff = datetime.utcnow() - timedelta(days=days_back)
    previous = db.query(Metric).filter(
        Metric.organization_id == org_id,
        Metric.metric_type == metric_type,
        Metric.date <= cutoff.date()
    ).order_by(desc(Metric.date)).first()

    try:
        current_val = float(current.value)
    except (ValueError, TypeError):
        current_val = 0

    try:
        previous_val = float(previous.value) if previous else None
    except (ValueError, TypeError):
        previous_val = None

    change_str, trend, emoji = format_trend(current_val, previous_val)

    return {
        "current": current_val,
        "previous": previous_val,
        "trend": trend,
        "change": change_str,
        "emoji": emoji,
        "date": current.date
    }


def get_period_transactions(db: Session, org_id: int, days: int = 30) -> Dict[str, float]:
    """Get transaction totals for a period."""
    from ..models import PlaidTransaction

    start_date = (datetime.utcnow() - timedelta(days=days)).date()

    transactions = db.query(PlaidTransaction).filter(
        PlaidTransaction.organization_id == org_id,
        PlaidTransaction.date >= start_date
    ).all()

    expenses = sum(t.amount for t in transactions if t.amount > 0)
    income = sum(abs(t.amount) for t in transactions if t.amount < 0)

    return {
        "expenses": expenses,
        "income": income,
        "net": expenses - income,
        "transaction_count": len(transactions)
    }


def get_greeting_time() -> str:
    """Get time-appropriate greeting."""
    hour = datetime.now().hour
    if hour < 12:
        return "Good morning"
    elif hour < 17:
        return "Good afternoon"
    else:
        return "Good evening"


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def get_smart_response(
    db: Session,
    organization_id: int,
    message: str
) -> Optional[Dict[str, Any]]:
    """
    Try to answer the question using logic trees without AI.
    """
    message_lower = message.lower().strip()

    # Try to match against known patterns
    for pattern, handler_name in QUESTION_PATTERNS.items():
        if re.search(pattern, message_lower):
            handler = globals().get(handler_name)
            if handler:
                try:
                    result = handler(db, organization_id, message)
                    if result:
                        logger.info(f"Smart response handled: {handler_name}")
                        return result
                except Exception as e:
                    logger.error(f"Smart response error in {handler_name}: {e}")

    # No pattern matched - fall back to AI
    return None


# =============================================================================
# HANDLER FUNCTIONS
# =============================================================================

def handle_greeting(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle greetings warmly."""
    greeting = get_greeting_time()

    return {
        "response": f"""{greeting}! 👋 I'm your business assistant.

I can help you with:
• **Financial insights** - runway, burn rate, revenue trends
• **Business metrics** - MRR, customers, growth rates
• **Operations** - deadlines, tasks, team updates

What would you like to know about your business today?""",
        "data_cards": [],
        "suggested_actions": [
            {"label": "Check runway", "action": "query", "target": "What's my runway?"},
            {"label": "View MRR", "action": "query", "target": "What's my MRR?"},
            {"label": "See overview", "action": "query", "target": "Give me a business overview"},
        ],
        "intent": "greeting",
        "source": "smart_response"
    }


def handle_thanks(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle thank you messages."""
    return {
        "response": """You're welcome! 😊

Is there anything else I can help you with? Try asking about:
• Your runway or burn rate
• Revenue and growth trends
• Upcoming deadlines""",
        "data_cards": [],
        "suggested_actions": [],
        "intent": "thanks",
        "source": "smart_response"
    }


def handle_help(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle questions about capabilities."""
    return {
        "response": """I'm your AI business assistant. Here's what I can help with:

**💰 Financial Health**
• "What's my runway?" - Cash runway projection
• "What's my burn rate?" - Monthly spending analysis
• "Show cash flow" - Income vs expenses breakdown

**📈 Revenue & Growth**
• "What's my MRR?" - Monthly recurring revenue
• "How's my growth?" - Trend analysis with comparisons
• "Show customer metrics" - Users, churn, retention

**📊 Business Operations**
• "Any deadlines coming up?" - Upcoming due dates
• "Am I on budget?" - Budget vs actual spending
• "Team overview" - Headcount and HR status

**🏦 Equity & Fundraising**
• "Show cap table" - Ownership breakdown
• "How much have I raised?" - Funding history
• "Valuation?" - Current company value

**💡 Pro Tips**
• Ask about trends: "How's my MRR trending?"
• Compare periods: "Compare to last month"
• Get specific: "What's my biggest expense?"

I pull real data from your connected integrations. Connect Plaid, Stripe, and others in Settings → Integrations for the most accurate insights.""",
        "data_cards": [],
        "suggested_actions": [
            {"label": "Connect Integrations", "action": "navigate", "target": "/app/integrations"},
            {"label": "View Dashboard", "action": "navigate", "target": "/app"},
            {"label": "Check my runway", "action": "query", "target": "What's my runway?"},
        ],
        "intent": "help",
        "source": "smart_response"
    }


def handle_runway(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle runway and cash position questions with trend analysis."""
    from ..models import PlaidAccount, PlaidTransaction, Metric

    # Get cash from connected accounts
    accounts = db.query(PlaidAccount).filter(
        PlaidAccount.organization_id == org_id,
        PlaidAccount.account_type.in_(['depository', 'checking', 'savings'])
    ).all()

    total_cash = sum(acc.current_balance or 0 for acc in accounts)

    # Get burn rate for current and previous period
    current_period = get_period_transactions(db, org_id, 30)
    previous_period = get_period_transactions(db, org_id, 60)

    # Calculate previous 30 days (days 31-60)
    prev_expenses = previous_period["expenses"] - current_period["expenses"]
    prev_net = previous_period["net"] - current_period["net"]

    net_burn = current_period["net"]
    burn_change, burn_trend, burn_emoji = format_trend(net_burn, prev_net if prev_net else None)

    # Check for manual metrics
    runway_metric = get_metric_with_trend(db, org_id, "runway")
    cash_metric = get_metric_with_trend(db, org_id, "cash")

    # Use manual metrics if no Plaid data
    if total_cash == 0 and cash_metric["current"]:
        total_cash = cash_metric["current"]

    # Build response
    data_cards = []

    if total_cash > 0 and net_burn > 0:
        runway_months = total_cash / net_burn

        # Determine urgency level
        if runway_months < 3:
            urgency = "🚨 **CRITICAL:** Less than 3 months runway! Take immediate action."
            urgency_level = "critical"
        elif runway_months < 6:
            urgency = "⚠️ **Warning:** Under 6 months runway. Start fundraising or cut costs now."
            urgency_level = "warning"
        elif runway_months < 12:
            urgency = "📋 **Note:** Under 12 months runway. Good time to plan your next raise."
            urgency_level = "caution"
        else:
            urgency = "✅ **Healthy runway.** You have time to focus on growth."
            urgency_level = "good"

        # Trend context
        trend_text = ""
        if burn_trend == "up":
            trend_text = f"\n\n{burn_emoji} Your burn rate increased {burn_change} vs last month. Monitor spending closely."
        elif burn_trend == "down":
            trend_text = f"\n\n{burn_emoji} Great news! Burn rate decreased {burn_change} vs last month."

        response = f"""**Runway Analysis** 📊

| Metric | Value | Trend |
|--------|-------|-------|
| 💵 Cash Position | {format_currency(total_cash)} | {cash_metric.get('emoji', '➡️')} {cash_metric.get('change', '')} |
| 🔥 Monthly Burn | {format_currency(net_burn)} | {burn_emoji} {burn_change} |
| ⏱️ Runway | **{runway_months:.1f} months** | |

{urgency}{trend_text}

*Based on {current_period['transaction_count']} transactions in the last 30 days.*"""

        data_cards = [
            {"type": "metric", "title": "Cash", "value": format_currency(total_cash), "trend": cash_metric.get("trend", "stable")},
            {"type": "metric", "title": "Monthly Burn", "value": format_currency(net_burn), "trend": burn_trend},
            {"type": "metric", "title": "Runway", "value": f"{runway_months:.1f} mo", "trend": urgency_level},
        ]

    elif total_cash > 0:
        response = f"""**Cash Position** 💵

You have **{format_currency(total_cash)}** in connected accounts.

I don't have enough transaction history to calculate your burn rate yet.

**To get runway projections:**
1. Wait for 30 days of transaction data, or
2. Manually add a "burn_rate" metric in Insights"""

        data_cards = [
            {"type": "metric", "title": "Cash Position", "value": format_currency(total_cash), "trend": "stable"},
        ]

    elif runway_metric["current"]:
        response = f"""Based on your manually entered metrics:

• **Runway:** {runway_metric['current']:.1f} months

For automatic tracking, connect your bank account via Plaid."""

        data_cards = [
            {"type": "metric", "title": "Runway", "value": f"{runway_metric['current']:.1f} mo", "trend": runway_metric["trend"]},
        ]

    else:
        response = """**No Financial Data Available** 📭

I don't have cash or transaction data to calculate your runway.

**Get started:**
1. **Connect your bank** → Settings → Integrations → Plaid
2. **Or** manually add "cash" and "burn_rate" metrics

Once connected, I'll automatically track your runway and alert you to any concerns."""

    return {
        "response": response,
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "Financial Dashboard", "action": "navigate", "target": "/app/financial-dashboard"},
            {"label": "Connect Bank", "action": "navigate", "target": "/app/integrations"},
            {"label": "View burn breakdown", "action": "query", "target": "What are my biggest expenses?"},
        ],
        "intent": "runway",
        "source": "smart_response"
    }


def handle_cash_position(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle cash position / bank balance questions."""
    from ..models import PlaidAccount

    accounts = db.query(PlaidAccount).filter(
        PlaidAccount.organization_id == org_id
    ).all()

    if accounts:
        checking = sum(a.current_balance or 0 for a in accounts if a.account_type in ['checking', 'depository'])
        savings = sum(a.current_balance or 0 for a in accounts if a.account_type == 'savings')
        total = checking + savings

        account_list = "\n".join([
            f"• **{a.name}** ({a.account_type}): {format_currency(a.current_balance or 0)}"
            for a in accounts[:5]
        ])

        response = f"""**Bank Accounts** 🏦

{account_list}

**Totals:**
• Checking: {format_currency(checking)}
• Savings: {format_currency(savings)}
• **Total Cash: {format_currency(total)}**

*Last synced: {accounts[0].last_synced.strftime('%b %d, %Y') if accounts[0].last_synced else 'Unknown'}*"""

        data_cards = [
            {"type": "metric", "title": "Total Cash", "value": format_currency(total), "trend": "stable"},
        ]
    else:
        response = """**No Bank Accounts Connected** 🏦

Connect your bank via Plaid to see real-time balances and automatic cash tracking.

Go to **Settings → Integrations → Connect Bank Account**"""
        data_cards = []

    return {
        "response": response,
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "Connect Bank", "action": "navigate", "target": "/app/integrations"},
        ],
        "intent": "cash",
        "source": "smart_response"
    }


def handle_burn_rate(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle burn rate questions with trend analysis."""
    from ..models import PlaidTransaction, Metric

    current = get_period_transactions(db, org_id, 30)
    previous = get_period_transactions(db, org_id, 60)

    # Calculate previous 30-day period
    prev_expenses = previous["expenses"] - current["expenses"]
    prev_income = previous["income"] - current["income"]
    prev_net = previous["net"] - current["net"]

    if current["transaction_count"] > 0:
        exp_change, exp_trend, exp_emoji = format_trend(current["expenses"], prev_expenses)
        inc_change, inc_trend, inc_emoji = format_trend(current["income"], prev_income)
        net_change, net_trend, net_emoji = format_trend(current["net"], prev_net)

        # Analysis text
        if current["net"] < 0:
            status = "🎉 **Cash flow positive!** You're making more than you spend."
            status_type = "positive"
        elif current["net"] < current["income"] * 0.5:
            status = "📊 **Moderate burn.** Expenses are manageable relative to income."
            status_type = "moderate"
        else:
            status = "⚠️ **High burn rate.** Expenses significantly exceed income."
            status_type = "high"

        response = f"""**Burn Rate Analysis** 🔥 *(Last 30 Days)*

| Category | Amount | vs Last Month |
|----------|--------|---------------|
| 💸 Expenses | {format_currency(current['expenses'])} | {exp_emoji} {exp_change} |
| 💰 Income | {format_currency(current['income'])} | {inc_emoji} {inc_change} |
| 🔥 **Net Burn** | **{format_currency(current['net'])}** | {net_emoji} {net_change} |

{status}

*Analysis based on {current['transaction_count']} transactions.*"""

        data_cards = [
            {"type": "metric", "title": "Monthly Expenses", "value": format_currency(current['expenses']), "trend": exp_trend},
            {"type": "metric", "title": "Net Burn", "value": format_currency(current['net']), "trend": net_trend},
        ]
    else:
        # Check for manual metric
        burn_metric = get_metric_with_trend(db, org_id, "burn_rate")

        if burn_metric["current"]:
            response = f"""**Burn Rate** (from manual metrics)

• Monthly Burn: **{format_currency(burn_metric['current'])}**
• Trend: {burn_metric['emoji']} {burn_metric['change']} vs previous

Connect your bank via Plaid for automatic, detailed tracking."""
            data_cards = [{"type": "metric", "title": "Burn Rate", "value": format_currency(burn_metric['current']), "trend": burn_metric["trend"]}]
        else:
            response = """**No Burn Rate Data** 📭

I need transaction data to calculate your burn rate.

**Options:**
1. Connect your bank via **Plaid** for automatic tracking
2. Add a "burn_rate" metric manually in **Insights**"""
            data_cards = []

    return {
        "response": response,
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "See expense breakdown", "action": "query", "target": "What are my biggest expenses?"},
            {"label": "Financial Dashboard", "action": "navigate", "target": "/app/financial-dashboard"},
        ],
        "intent": "burn_rate",
        "source": "smart_response"
    }


def handle_expenses_breakdown(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle expense breakdown questions."""
    from ..models import PlaidTransaction

    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).date()

    transactions = db.query(PlaidTransaction).filter(
        PlaidTransaction.organization_id == org_id,
        PlaidTransaction.date >= thirty_days_ago,
        PlaidTransaction.amount > 0  # Expenses only
    ).all()

    if transactions:
        # Group by category
        categories = {}
        for t in transactions:
            cat = t.category or "Uncategorized"
            # Take first category if it's a list
            if isinstance(cat, list):
                cat = cat[0] if cat else "Uncategorized"
            categories[cat] = categories.get(cat, 0) + t.amount

        # Sort by amount
        sorted_cats = sorted(categories.items(), key=lambda x: x[1], reverse=True)
        total = sum(categories.values())

        # Top 5 categories
        breakdown = "\n".join([
            f"| {cat[:20]} | {format_currency(amt)} | {amt/total*100:.0f}% |"
            for cat, amt in sorted_cats[:7]
        ])

        response = f"""**Expense Breakdown** 📊 *(Last 30 Days)*

| Category | Amount | % of Total |
|----------|--------|------------|
{breakdown}

**Total Expenses: {format_currency(total)}**

*{len(transactions)} transactions across {len(categories)} categories*"""

        data_cards = [
            {"type": "metric", "title": sorted_cats[0][0][:15], "value": format_currency(sorted_cats[0][1]), "trend": None}
        ] if sorted_cats else []
    else:
        response = """**No Expense Data** 📭

Connect your bank via Plaid to see expense breakdowns by category."""
        data_cards = []

    return {
        "response": response,
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "View Budget", "action": "navigate", "target": "/app/budget"},
        ],
        "intent": "expenses",
        "source": "smart_response"
    }


def handle_revenue(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle MRR/ARR/revenue questions with trends."""
    from ..models import Metric, StripeSubscriptionSync

    # Get from Stripe subscriptions
    active_subs = db.query(StripeSubscriptionSync).filter(
        StripeSubscriptionSync.organization_id == org_id,
        StripeSubscriptionSync.status == "active"
    ).all()

    stripe_mrr = sum(
        (s.amount_cents or 0) / 100
        for s in active_subs
        if s.interval == 'month'
    )

    # Get metrics with trends
    mrr_data = get_metric_with_trend(db, org_id, "mrr")
    arr_data = get_metric_with_trend(db, org_id, "arr")
    revenue_data = get_metric_with_trend(db, org_id, "revenue")

    # Determine which source to use
    if stripe_mrr > 0:
        mrr = stripe_mrr
        arr = stripe_mrr * 12
        source = "Stripe"
        mrr_trend = "stable"  # Can't calculate trend from Stripe alone
        mrr_change = ""
    elif mrr_data["current"]:
        mrr = mrr_data["current"]
        arr = arr_data["current"] if arr_data["current"] else mrr * 12
        source = "manual metrics"
        mrr_trend = mrr_data["trend"]
        mrr_change = f"{mrr_data['emoji']} {mrr_data['change']}" if mrr_data["change"] else ""
    else:
        mrr = 0
        arr = 0
        source = None
        mrr_trend = "stable"
        mrr_change = ""

    data_cards = []

    if mrr > 0:
        # Growth analysis
        if mrr_data["previous"] and mrr_data["current"]:
            growth_pct = ((mrr_data["current"] - mrr_data["previous"]) / mrr_data["previous"]) * 100
            if growth_pct > 10:
                growth_text = f"🚀 **Strong growth!** MRR up {growth_pct:.0f}% month-over-month."
            elif growth_pct > 0:
                growth_text = f"📈 **Growing.** MRR up {growth_pct:.1f}% month-over-month."
            elif growth_pct > -5:
                growth_text = f"➡️ **Flat.** MRR relatively stable ({growth_pct:+.1f}%)."
            else:
                growth_text = f"📉 **Declining.** MRR down {abs(growth_pct):.1f}%. Investigate churn."
        else:
            growth_text = "_Add historical MRR data to see growth trends._"

        response = f"""**Revenue Metrics** 💰 *(from {source})*

| Metric | Value | Trend |
|--------|-------|-------|
| 📊 MRR | **{format_currency(mrr)}** | {mrr_change} |
| 📈 ARR | {format_currency(arr)} | |
| 👥 Active Subs | {len(active_subs)} | |

{growth_text}"""

        data_cards = [
            {"type": "metric", "title": "MRR", "value": format_currency(mrr), "trend": mrr_trend},
            {"type": "metric", "title": "ARR", "value": format_currency(arr), "trend": mrr_trend},
        ]
    else:
        response = """**No Revenue Data** 💰

I don't have revenue data yet.

**To track MRR/ARR:**
1. **Connect Stripe** → Settings → Integrations (automatic tracking)
2. **Or** add "mrr" metrics manually in Insights

Once connected, I'll track trends and alert you to changes."""

    return {
        "response": response,
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "Revenue Dashboard", "action": "navigate", "target": "/app/revenue"},
            {"label": "Connect Stripe", "action": "navigate", "target": "/app/integrations"},
            {"label": "Check churn", "action": "query", "target": "What's my churn rate?"},
        ],
        "intent": "revenue",
        "source": "smart_response"
    }


def handle_growth(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle growth rate questions."""
    mrr_data = get_metric_with_trend(db, org_id, "mrr")
    customer_data = get_metric_with_trend(db, org_id, "customers")
    revenue_data = get_metric_with_trend(db, org_id, "revenue")

    parts = ["**Growth Analysis** 📈\n"]
    data_cards = []
    has_data = False

    if mrr_data["current"] and mrr_data["previous"]:
        has_data = True
        growth = ((mrr_data["current"] - mrr_data["previous"]) / mrr_data["previous"]) * 100
        parts.append(f"• **MRR Growth:** {growth:+.1f}% month-over-month {mrr_data['emoji']}")
        parts.append(f"  - Current: {format_currency(mrr_data['current'])}")
        parts.append(f"  - Previous: {format_currency(mrr_data['previous'])}")
        data_cards.append({"type": "metric", "title": "MRR Growth", "value": f"{growth:+.1f}%", "trend": mrr_data["trend"]})

    if customer_data["current"] and customer_data["previous"]:
        has_data = True
        growth = ((customer_data["current"] - customer_data["previous"]) / customer_data["previous"]) * 100
        parts.append(f"\n• **Customer Growth:** {growth:+.1f}% {customer_data['emoji']}")
        parts.append(f"  - Current: {int(customer_data['current'])}")
        parts.append(f"  - Previous: {int(customer_data['previous'])}")

    if not has_data:
        parts.append("I need historical metric data to calculate growth rates.\n")
        parts.append("Add metrics over time in **Insights**, and I'll automatically calculate growth trends.")

    return {
        "response": "\n".join(parts),
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "View Insights", "action": "navigate", "target": "/app/insights"},
        ],
        "intent": "growth",
        "source": "smart_response"
    }


def handle_customers(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle customer count questions with trends."""
    from ..models import Metric, StripeSubscriptionSync

    # Count from Stripe
    active_subs = db.query(StripeSubscriptionSync).filter(
        StripeSubscriptionSync.organization_id == org_id,
        StripeSubscriptionSync.status == "active"
    ).count()

    # Get metric with trend
    customer_data = get_metric_with_trend(db, org_id, "customers")

    customers = active_subs if active_subs > 0 else (int(customer_data["current"]) if customer_data["current"] else 0)

    if customers > 0:
        trend_text = ""
        if customer_data["previous"]:
            change = customers - int(customer_data["previous"])
            if change > 0:
                trend_text = f"\n\n📈 **+{change} customers** compared to last month!"
            elif change < 0:
                trend_text = f"\n\n📉 **{change} customers** vs last month. Check churn."

        response = f"""**Customer Metrics** 👥

• **Active Customers:** {customers}
• **Source:** {'Stripe subscriptions' if active_subs > 0 else 'Manual metrics'}{trend_text}"""

        data_cards = [{"type": "metric", "title": "Customers", "value": str(customers), "trend": customer_data.get("trend", "stable")}]
    else:
        response = """**No Customer Data** 👥

Track customers by:
1. **Connect Stripe** for automatic subscription counting
2. **Add a "customers" metric** in Insights"""
        data_cards = []

    return {
        "response": response,
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "Check churn", "action": "query", "target": "What's my churn rate?"},
        ],
        "intent": "customers",
        "source": "smart_response"
    }


def handle_churn(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle churn questions."""
    churn_data = get_metric_with_trend(db, org_id, "churn")

    if churn_data["current"] is not None:
        churn = churn_data["current"]

        # Benchmark analysis
        if churn < 3:
            analysis = "🌟 **Excellent!** Below 3% is best-in-class for SaaS."
        elif churn < 5:
            analysis = "✅ **Good.** 3-5% is healthy for most SaaS businesses."
        elif churn < 7:
            analysis = "⚠️ **Moderate.** 5-7% is acceptable but worth investigating."
        else:
            analysis = "🚨 **High churn.** Above 7% needs immediate attention."

        trend_text = f" ({churn_data['emoji']} {churn_data['change']})" if churn_data["change"] else ""

        response = f"""**Churn Analysis** 📉

• **Monthly Churn Rate:** {churn:.1f}%{trend_text}

{analysis}

**SaaS Benchmarks:**
• < 3% = Excellent
• 3-5% = Good
• 5-7% = Moderate
• > 7% = Needs attention"""

        data_cards = [{"type": "metric", "title": "Churn Rate", "value": f"{churn:.1f}%", "trend": churn_data["trend"]}]
    else:
        response = """**No Churn Data** 📉

Track churn by adding a "churn" metric in **Insights**.

Calculate it as: (Customers lost this month / Customers at start of month) × 100"""
        data_cards = []

    return {
        "response": response,
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "Add Metrics", "action": "navigate", "target": "/app/insights"},
        ],
        "intent": "churn",
        "source": "smart_response"
    }


def handle_cap_table(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle cap table questions."""
    from ..models import Shareholder, ShareClass, EquityGrant

    shareholders = db.query(Shareholder).filter(
        Shareholder.organization_id == org_id
    ).all()

    share_classes = db.query(ShareClass).filter(
        ShareClass.organization_id == org_id
    ).all()

    grants = db.query(EquityGrant).filter(
        EquityGrant.organization_id == org_id
    ).all()

    total_authorized = sum(sc.authorized_shares or 0 for sc in share_classes)
    total_granted = sum(g.shares_granted or 0 for g in grants)

    if shareholders or grants:
        # Calculate ownership by type
        ownership_by_type = {}
        for sh in shareholders:
            sh_type = sh.shareholder_type or 'other'
            sh_grants = [g for g in grants if g.shareholder_id == sh.id]
            shares = sum(g.shares_granted or 0 for g in sh_grants)
            ownership_by_type[sh_type] = ownership_by_type.get(sh_type, 0) + shares

        # Format ownership breakdown
        if total_granted > 0:
            breakdown = "\n".join([
                f"| {stype.title()} | {shares:,} | {shares/total_granted*100:.1f}% |"
                for stype, shares in sorted(ownership_by_type.items(), key=lambda x: x[1], reverse=True)
            ])
        else:
            breakdown = "| No shares granted yet | | |"

        response = f"""**Cap Table Summary** 📊

| Stat | Value |
|------|-------|
| 👥 Shareholders | {len(shareholders)} |
| 📜 Share Classes | {len(share_classes)} |
| ✅ Authorized | {total_authorized:,} shares |
| 📝 Granted | {total_granted:,} shares |
| 📦 Unallocated | {total_authorized - total_granted:,} shares |

**Ownership Breakdown:**

| Type | Shares | % |
|------|--------|---|
{breakdown}"""

        data_cards = [
            {"type": "metric", "title": "Shareholders", "value": str(len(shareholders)), "trend": None},
            {"type": "metric", "title": "Granted", "value": f"{total_granted:,}", "trend": None},
        ]
    else:
        response = """**No Cap Table Data** 📊

Set up your cap table to track:
• Shareholders and ownership percentages
• Share classes and authorized shares
• Option pools and grants
• Dilution modeling

Go to **Cap Table** to get started."""
        data_cards = []

    return {
        "response": response,
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "View Cap Table", "action": "navigate", "target": "/app/cap-table"},
            {"label": "Check options", "action": "query", "target": "What's my option pool status?"},
        ],
        "intent": "cap_table",
        "source": "smart_response"
    }


def handle_options(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle stock option questions."""
    from ..models import StockOption, ShareClass

    options = db.query(StockOption).filter(
        StockOption.organization_id == org_id
    ).all()

    share_classes = db.query(ShareClass).filter(
        ShareClass.organization_id == org_id
    ).all()

    total_pool = sum(sc.authorized_shares or 0 for sc in share_classes if 'option' in (sc.name or '').lower() or 'pool' in (sc.name or '').lower())
    total_granted = sum(o.shares_granted or 0 for o in options)
    total_vested = sum(o.shares_vested or 0 for o in options)
    total_exercised = sum(o.shares_exercised or 0 for o in options)

    if options or total_pool > 0:
        available = total_pool - total_granted if total_pool > 0 else 0

        response = f"""**Stock Options Summary** 📜

| Status | Shares |
|--------|--------|
| 🏊 Pool Size | {total_pool:,} |
| ✅ Granted | {total_granted:,} |
| 🔓 Vested | {total_vested:,} |
| 💰 Exercised | {total_exercised:,} |
| 📦 Available | {available:,} |

**{len(options)} option grants** across your team."""

        data_cards = [
            {"type": "metric", "title": "Available Options", "value": f"{available:,}", "trend": None},
        ]
    else:
        response = """**No Option Data** 📜

Set up your option pool in **Cap Table** to track:
• Option grants and vesting schedules
• Available pool for future hires
• Exercise activity"""
        data_cards = []

    return {
        "response": response,
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "View Cap Table", "action": "navigate", "target": "/app/cap-table"},
        ],
        "intent": "options",
        "source": "smart_response"
    }


def handle_deadlines(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle deadline questions."""
    from ..models import Deadline

    today = datetime.utcnow().date()
    week_later = today + timedelta(days=7)
    month_later = today + timedelta(days=30)

    # Upcoming deadlines
    this_week = db.query(Deadline).filter(
        Deadline.organization_id == org_id,
        Deadline.due_date >= today,
        Deadline.due_date <= week_later,
        Deadline.is_completed == False
    ).order_by(Deadline.due_date).all()

    this_month = db.query(Deadline).filter(
        Deadline.organization_id == org_id,
        Deadline.due_date > week_later,
        Deadline.due_date <= month_later,
        Deadline.is_completed == False
    ).order_by(Deadline.due_date).all()

    # Overdue
    overdue = db.query(Deadline).filter(
        Deadline.organization_id == org_id,
        Deadline.due_date < today,
        Deadline.is_completed == False
    ).all()

    parts = ["**Upcoming Deadlines** 📅\n"]
    data_cards = []

    if overdue:
        parts.append(f"🚨 **{len(overdue)} OVERDUE:**")
        for d in overdue[:3]:
            days_late = (today - d.due_date.date()).days
            parts.append(f"• ~~{d.title}~~ - {days_late} days late")
        parts.append("")
        data_cards.append({"type": "alert", "title": "Overdue", "value": str(len(overdue)), "trend": "down"})

    if this_week:
        parts.append(f"📌 **This Week ({len(this_week)}):**")
        for d in this_week[:5]:
            days_until = (d.due_date.date() - today).days
            urgency = "🔴" if days_until <= 2 else "🟡"
            parts.append(f"• {urgency} {d.title} - {d.due_date.strftime('%a, %b %d')}")
        parts.append("")
        data_cards.append({"type": "metric", "title": "This Week", "value": str(len(this_week)), "trend": None})

    if this_month:
        parts.append(f"📋 **This Month ({len(this_month)}):**")
        for d in this_month[:5]:
            parts.append(f"• {d.title} - {d.due_date.strftime('%b %d')}")

    if not (overdue or this_week or this_month):
        parts.append("✅ No upcoming deadlines in the next 30 days!\n")
        parts.append("Add deadlines in the **Deadlines** page to track important dates.")

    return {
        "response": "\n".join(parts),
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "View All Deadlines", "action": "navigate", "target": "/app/deadlines"},
            {"label": "Check compliance", "action": "query", "target": "What's my checklist progress?"},
        ],
        "intent": "deadlines",
        "source": "smart_response"
    }


def handle_overdue(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle overdue items questions."""
    from ..models import Deadline, Task

    today = datetime.utcnow().date()

    overdue_deadlines = db.query(Deadline).filter(
        Deadline.organization_id == org_id,
        Deadline.due_date < today,
        Deadline.is_completed == False
    ).all()

    overdue_tasks = db.query(Task).filter(
        Task.organization_id == org_id,
        Task.due_date < datetime.utcnow(),
        Task.status != 'done'
    ).all()

    parts = ["**Overdue Items** ⚠️\n"]

    if overdue_deadlines:
        parts.append(f"**{len(overdue_deadlines)} Overdue Deadlines:**")
        for d in overdue_deadlines[:5]:
            days_late = (today - d.due_date).days
            parts.append(f"• 🔴 {d.title} - {days_late} days late")
        parts.append("")

    if overdue_tasks:
        parts.append(f"**{len(overdue_tasks)} Overdue Tasks:**")
        for t in overdue_tasks[:5]:
            parts.append(f"• 🟠 {t.title}")
        parts.append("")

    if not overdue_deadlines and not overdue_tasks:
        parts.append("✅ **Nothing overdue!** You're all caught up.")

    total_overdue = len(overdue_deadlines) + len(overdue_tasks)
    data_cards = [{"type": "alert", "title": "Overdue", "value": str(total_overdue), "trend": "down"}] if total_overdue > 0 else []

    return {
        "response": "\n".join(parts),
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "View Deadlines", "action": "navigate", "target": "/app/deadlines"},
            {"label": "View Tasks", "action": "navigate", "target": "/app/tasks"},
        ],
        "intent": "overdue",
        "source": "smart_response"
    }


def handle_checklist(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle checklist/getting started questions."""
    from ..models import ChecklistProgress

    progress = db.query(ChecklistProgress).filter(
        ChecklistProgress.organization_id == org_id
    ).all()

    completed = sum(1 for p in progress if p.is_completed)
    total = 96  # Fixed total - matches frontend checklist items
    percentage = (completed / total * 100) if total > 0 else 0

    # Progress bar
    filled = int(percentage / 10)
    bar = "█" * filled + "░" * (10 - filled)

    if percentage >= 90:
        status = "🏆 **Almost there!** Just a few items left."
    elif percentage >= 70:
        status = "💪 **Great progress!** Keep going."
    elif percentage >= 50:
        status = "📈 **Halfway there!** You're making good progress."
    elif percentage >= 25:
        status = "🚀 **Good start!** Keep checking off items."
    else:
        status = "👋 **Just getting started.** Take it one step at a time."

    response = f"""**Business Checklist Progress** ✅

[{bar}] **{percentage:.0f}%**

• Completed: {completed} / {total} items

{status}

The checklist covers essential startup compliance, legal setup, and operational best practices."""

    data_cards = [
        {"type": "metric", "title": "Progress", "value": f"{percentage:.0f}%", "trend": "up" if percentage > 50 else "stable"},
    ]

    return {
        "response": response,
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "View Checklist", "action": "navigate", "target": "/app/getting-started"},
        ],
        "intent": "checklist",
        "source": "smart_response"
    }


def handle_budget(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle budget questions."""
    from ..models import BudgetPeriod, BudgetLineItem

    today = datetime.utcnow().date()
    current_period = db.query(BudgetPeriod).filter(
        BudgetPeriod.organization_id == org_id,
        BudgetPeriod.start_date <= today,
        BudgetPeriod.end_date >= today
    ).first()

    if current_period:
        line_items = db.query(BudgetLineItem).filter(
            BudgetLineItem.period_id == current_period.id
        ).all()

        total_budget = sum(li.budgeted_amount or 0 for li in line_items)
        total_actual = sum(li.actual_amount or 0 for li in line_items)
        variance = total_budget - total_actual
        variance_pct = (variance / total_budget * 100) if total_budget > 0 else 0

        # Days into period for projection
        days_elapsed = (today - current_period.start_date).days
        total_days = (current_period.end_date - current_period.start_date).days
        pct_elapsed = (days_elapsed / total_days * 100) if total_days > 0 else 0

        # Projected spend
        if days_elapsed > 0:
            projected = (total_actual / days_elapsed) * total_days
            projected_variance = total_budget - projected
        else:
            projected = 0
            projected_variance = total_budget

        # Categories over budget
        over_budget = [li for li in line_items if (li.actual_amount or 0) > (li.budgeted_amount or 0)]

        if variance >= 0 and projected_variance >= 0:
            status = "✅ **On Track**"
            status_detail = "Spending is within budget."
        elif variance >= 0:
            status = "⚠️ **Watch Spending**"
            status_detail = f"Currently under budget, but projected to exceed by {format_currency(abs(projected_variance))}."
        else:
            status = "🚨 **Over Budget**"
            status_detail = f"Already {format_currency(abs(variance))} over budget."

        response = f"""**Budget Status** 💵 *({current_period.name or 'Current Period'})*

| Metric | Amount |
|--------|--------|
| 📊 Total Budget | {format_currency(total_budget)} |
| 💸 Spent to Date | {format_currency(total_actual)} |
| 📈 Variance | {format_currency(variance)} ({variance_pct:+.1f}%) |
| 🔮 Projected Total | {format_currency(projected)} |

**Status:** {status}
{status_detail}

{f'⚠️ **{len(over_budget)} categories over budget**' if over_budget else ''}

*{pct_elapsed:.0f}% through budget period*"""

        data_cards = [
            {"type": "metric", "title": "Budget", "value": format_currency(total_budget), "trend": None},
            {"type": "metric", "title": "Spent", "value": format_currency(total_actual), "trend": None},
            {"type": "metric", "title": "Variance", "value": format_currency(variance), "trend": "up" if variance >= 0 else "down"},
        ]
    else:
        response = """**No Active Budget** 💵

Create a budget to track spending against your plan.

Go to **Budget** to set up your first budget period."""
        data_cards = []

    return {
        "response": response,
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "View Budget", "action": "navigate", "target": "/app/budget"},
        ],
        "intent": "budget",
        "source": "smart_response"
    }


def handle_team(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle team/headcount questions."""
    from ..models import Employee

    employees = db.query(Employee).filter(
        Employee.organization_id == org_id
    ).all()

    if employees:
        active = [e for e in employees if e.employment_status == 'active']
        contractors = [e for e in employees if e.is_contractor]
        full_time = [e for e in active if not e.is_contractor]

        # Department breakdown
        departments = {}
        for e in active:
            dept = e.department or 'Unassigned'
            departments[dept] = departments.get(dept, 0) + 1

        dept_breakdown = "\n".join([
            f"• {dept}: {count}"
            for dept, count in sorted(departments.items(), key=lambda x: x[1], reverse=True)[:5]
        ])

        response = f"""**Team Overview** 👥

| Category | Count |
|----------|-------|
| 👥 Total Team | {len(employees)} |
| ✅ Active | {len(active)} |
| 💼 Full-time | {len(full_time)} |
| 📋 Contractors | {len(contractors)} |

**By Department:**
{dept_breakdown}"""

        data_cards = [
            {"type": "metric", "title": "Team Size", "value": str(len(active)), "trend": "stable"},
        ]
    else:
        response = """**No Team Data** 👥

Add team members in the **Team** page to track:
• Employee directory
• Department organization
• PTO and time off
• Equity grants"""
        data_cards = []

    return {
        "response": response,
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "View Team", "action": "navigate", "target": "/app/team"},
            {"label": "Check PTO requests", "action": "query", "target": "Any pending PTO requests?"},
        ],
        "intent": "team",
        "source": "smart_response"
    }


def handle_pto(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle PTO questions."""
    from ..models import PTORequest

    pending = db.query(PTORequest).filter(
        PTORequest.organization_id == org_id,
        PTORequest.status == "pending"
    ).all()

    approved_upcoming = db.query(PTORequest).filter(
        PTORequest.organization_id == org_id,
        PTORequest.status == "approved",
        PTORequest.start_date >= datetime.utcnow().date()
    ).all()

    parts = ["**PTO Status** 🏖️\n"]

    if pending:
        parts.append(f"**{len(pending)} Pending Requests:**")
        for p in pending[:5]:
            emp_name = f"{p.employee.first_name} {p.employee.last_name}" if p.employee else "Unknown"
            parts.append(f"• {emp_name}: {p.start_date.strftime('%b %d')} - {p.end_date.strftime('%b %d')}")
        parts.append("")

    if approved_upcoming:
        parts.append(f"**{len(approved_upcoming)} Upcoming Approved:**")
        for p in approved_upcoming[:5]:
            emp_name = f"{p.employee.first_name} {p.employee.last_name}" if p.employee else "Unknown"
            parts.append(f"• {emp_name}: {p.start_date.strftime('%b %d')} - {p.end_date.strftime('%b %d')}")

    if not pending and not approved_upcoming:
        parts.append("✅ No pending PTO requests and no upcoming time off scheduled.")

    data_cards = []
    if pending:
        data_cards.append({"type": "alert", "title": "Pending PTO", "value": str(len(pending)), "trend": None})

    return {
        "response": "\n".join(parts),
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "View Team", "action": "navigate", "target": "/app/team"},
        ],
        "intent": "pto",
        "source": "smart_response"
    }


def handle_tasks(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle task questions."""
    from ..models import Task

    tasks = db.query(Task).filter(
        Task.organization_id == org_id,
        Task.status != 'done'
    ).all()

    high_priority = [t for t in tasks if t.priority == 'high']
    overdue = [t for t in tasks if t.due_date and t.due_date < datetime.utcnow()]
    in_progress = [t for t in tasks if t.status == 'in_progress']
    todo = [t for t in tasks if t.status == 'todo']

    parts = ["**Task Overview** ✅\n"]
    data_cards = []

    if overdue:
        parts.append(f"🚨 **{len(overdue)} Overdue Tasks:**")
        for t in overdue[:3]:
            parts.append(f"• {t.title}")
        parts.append("")
        data_cards.append({"type": "alert", "title": "Overdue", "value": str(len(overdue)), "trend": "down"})

    if high_priority:
        parts.append(f"🔴 **{len(high_priority)} High Priority:**")
        for t in high_priority[:3]:
            parts.append(f"• {t.title}")
        parts.append("")

    parts.append(f"""**Summary:**
• 📋 To Do: {len(todo)}
• 🔄 In Progress: {len(in_progress)}
• ⚠️ Overdue: {len(overdue)}""")

    if not tasks:
        parts = ["**No Open Tasks** ✅\n\nYou're all caught up! Add tasks in the **Tasks** page."]

    return {
        "response": "\n".join(parts),
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "View Tasks", "action": "navigate", "target": "/app/tasks"},
        ],
        "intent": "tasks",
        "source": "smart_response"
    }


def handle_overview(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle overview/dashboard questions."""
    from ..models import PlaidAccount, Metric, Deadline, StripeSubscriptionSync

    # Gather all key metrics
    accounts = db.query(PlaidAccount).filter(PlaidAccount.organization_id == org_id).all()
    cash = sum(acc.current_balance or 0 for acc in accounts if acc.account_type in ['depository', 'checking', 'savings'])

    mrr_data = get_metric_with_trend(db, org_id, "mrr")
    burn_period = get_period_transactions(db, org_id, 30)

    active_subs = db.query(StripeSubscriptionSync).filter(
        StripeSubscriptionSync.organization_id == org_id,
        StripeSubscriptionSync.status == "active"
    ).count()

    today = datetime.utcnow().date()
    overdue = db.query(Deadline).filter(
        Deadline.organization_id == org_id,
        Deadline.due_date < today,
        Deadline.is_completed == False
    ).count()

    upcoming = db.query(Deadline).filter(
        Deadline.organization_id == org_id,
        Deadline.due_date >= today,
        Deadline.due_date <= today + timedelta(days=7),
        Deadline.is_completed == False
    ).count()

    # Build overview
    parts = [f"**Business Overview** 📊\n"]
    data_cards = []

    # Financial section
    financial_items = []
    if cash > 0:
        financial_items.append(f"• 💵 **Cash:** {format_currency(cash)}")
        data_cards.append({"type": "metric", "title": "Cash", "value": format_currency(cash), "trend": "stable"})

    if burn_period["net"] != 0:
        financial_items.append(f"• 🔥 **Burn:** {format_currency(burn_period['net'])}/mo")

    if cash > 0 and burn_period["net"] > 0:
        runway = cash / burn_period["net"]
        financial_items.append(f"• ⏱️ **Runway:** {runway:.1f} months")
        data_cards.append({"type": "metric", "title": "Runway", "value": f"{runway:.1f}mo", "trend": "stable"})

    if financial_items:
        parts.append("**Financial Health:**")
        parts.extend(financial_items)
        parts.append("")

    # Revenue section
    revenue_items = []
    if mrr_data["current"]:
        trend_str = f" ({mrr_data['emoji']} {mrr_data['change']})" if mrr_data["change"] else ""
        revenue_items.append(f"• 📈 **MRR:** {format_currency(mrr_data['current'])}{trend_str}")
        data_cards.append({"type": "metric", "title": "MRR", "value": format_currency(mrr_data['current']), "trend": mrr_data["trend"]})

    if active_subs > 0:
        revenue_items.append(f"• 👥 **Customers:** {active_subs}")

    if revenue_items:
        parts.append("**Revenue:**")
        parts.extend(revenue_items)
        parts.append("")

    # Action items
    action_items = []
    if overdue > 0:
        action_items.append(f"• 🚨 **{overdue} overdue deadline(s)**")

    if upcoming > 0:
        action_items.append(f"• 📅 **{upcoming} deadline(s) this week**")

    if action_items:
        parts.append("**Needs Attention:**")
        parts.extend(action_items)

    if len(parts) == 1:
        parts.append("Connect your integrations to see your business overview!\n")
        parts.append("Go to **Settings → Integrations** to connect:\n• Plaid (banking)\n• Stripe (revenue)")

    return {
        "response": "\n".join(parts),
        "data_cards": data_cards,
        "suggested_actions": [
            {"label": "Dashboard", "action": "navigate", "target": "/app"},
            {"label": "Check runway", "action": "query", "target": "What's my runway?"},
            {"label": "View MRR", "action": "query", "target": "What's my MRR?"},
        ],
        "intent": "overview",
        "source": "smart_response"
    }


# =============================================================================
# STUB HANDLERS (for less common questions)
# =============================================================================

def handle_comparison(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle comparison questions - redirect to growth."""
    return handle_growth(db, org_id, message)


def handle_top_customers(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle top customers questions."""
    from ..models import StripeSubscriptionSync

    subs = db.query(StripeSubscriptionSync).filter(
        StripeSubscriptionSync.organization_id == org_id,
        StripeSubscriptionSync.status == "active"
    ).order_by(desc(StripeSubscriptionSync.amount_cents)).limit(10).all()

    if subs:
        customers = "\n".join([
            f"| {s.customer_email or 'Unknown'} | {format_currency((s.amount_cents or 0)/100)}/mo |"
            for s in subs[:10]
        ])
        response = f"""**Top Customers** 👑

| Customer | MRR |
|----------|-----|
{customers}"""
    else:
        response = "Connect Stripe to see your top customers by revenue."

    return {
        "response": response,
        "data_cards": [],
        "suggested_actions": [{"label": "Connect Stripe", "action": "navigate", "target": "/app/integrations"}],
        "intent": "customers",
        "source": "smart_response"
    }


def handle_unit_economics(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle CAC/LTV questions."""
    cac_data = get_metric_with_trend(db, org_id, "cac")
    ltv_data = get_metric_with_trend(db, org_id, "ltv")
    arpu_data = get_metric_with_trend(db, org_id, "arpu")

    parts = ["**Unit Economics** 📊\n"]

    if ltv_data["current"] and cac_data["current"]:
        ratio = ltv_data["current"] / cac_data["current"]
        parts.append(f"• **LTV:** {format_currency(ltv_data['current'])}")
        parts.append(f"• **CAC:** {format_currency(cac_data['current'])}")
        parts.append(f"• **LTV:CAC Ratio:** {ratio:.1f}x")

        if ratio >= 3:
            parts.append("\n✅ **Excellent!** 3x+ is the gold standard.")
        elif ratio >= 1:
            parts.append("\n⚠️ **Okay.** Aim for 3x+ for healthy economics.")
        else:
            parts.append("\n🚨 **Warning:** LTV < CAC means you're losing money on each customer.")
    else:
        parts.append("Add 'cac' and 'ltv' metrics in **Insights** to track unit economics.")

    return {
        "response": "\n".join(parts),
        "data_cards": [],
        "suggested_actions": [{"label": "Add Metrics", "action": "navigate", "target": "/app/insights"}],
        "intent": "unit_economics",
        "source": "smart_response"
    }


def handle_profitability(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle profitability questions."""
    revenue_data = get_metric_with_trend(db, org_id, "revenue")
    burn = get_period_transactions(db, org_id, 30)

    if revenue_data["current"] or burn["income"] > 0:
        income = revenue_data["current"] or burn["income"]
        expenses = burn["expenses"]
        profit = income - expenses

        if profit > 0:
            status = f"✅ **Profitable!** Net income: {format_currency(profit)}/month"
        else:
            status = f"📉 **Not yet profitable.** Monthly loss: {format_currency(abs(profit))}"

        response = f"""**Profitability Analysis** 💰

• **Revenue:** {format_currency(income)}/mo
• **Expenses:** {format_currency(expenses)}/mo
• **Net:** {format_currency(profit)}/mo

{status}"""
    else:
        response = "I need revenue and expense data to analyze profitability. Connect Plaid and Stripe, or add metrics."

    return {
        "response": response,
        "data_cards": [],
        "suggested_actions": [{"label": "Financial Dashboard", "action": "navigate", "target": "/app/financial-dashboard"}],
        "intent": "profitability",
        "source": "smart_response"
    }


def handle_fundraising(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle fundraising questions."""
    from ..models import Shareholder, EquityGrant

    investors = db.query(Shareholder).filter(
        Shareholder.organization_id == org_id,
        Shareholder.shareholder_type == "investor"
    ).all()

    # Sum investments (simplified - would need actual funding rounds model)
    response = f"""**Fundraising Status** 💰

• **Investors:** {len(investors)}

For detailed fundraising tracking:
• View **Cap Table** for equity ownership
• Use **Data Room** to share documents with investors
• Send **Investor Updates** to keep them informed"""

    return {
        "response": response,
        "data_cards": [],
        "suggested_actions": [
            {"label": "Cap Table", "action": "navigate", "target": "/app/cap-table"},
            {"label": "Data Room", "action": "navigate", "target": "/app/data-room"},
        ],
        "intent": "fundraising",
        "source": "smart_response"
    }


def handle_valuation(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle valuation questions."""
    val_data = get_metric_with_trend(db, org_id, "valuation")

    if val_data["current"]:
        response = f"""**Company Valuation** 🏷️

• **Current Valuation:** {format_currency(val_data['current'])}
• **As of:** {val_data.get('date', 'Unknown')}

*Valuation based on your last funding round or 409A assessment.*"""
    else:
        response = """**No Valuation Data** 🏷️

Add a 'valuation' metric in **Insights** to track:
• Post-money valuation from funding rounds
• 409A fair market value
• Internal estimates"""

    return {
        "response": response,
        "data_cards": [],
        "suggested_actions": [{"label": "Cap Table", "action": "navigate", "target": "/app/cap-table"}],
        "intent": "valuation",
        "source": "smart_response"
    }


def handle_data_room(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle data room questions."""
    from ..models import DataRoomDocument, ShareableLink

    docs = db.query(DataRoomDocument).filter(DataRoomDocument.organization_id == org_id).count()
    links = db.query(ShareableLink).filter(ShareableLink.organization_id == org_id, ShareableLink.is_active == True).count()

    response = f"""**Data Room Status** 📁

• **Documents:** {docs}
• **Active Share Links:** {links}

Use the Data Room to securely share documents with investors during due diligence."""

    return {
        "response": response,
        "data_cards": [],
        "suggested_actions": [{"label": "Data Room", "action": "navigate", "target": "/app/data-room"}],
        "intent": "data_room",
        "source": "smart_response"
    }


def handle_investor_updates(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle investor update questions."""
    from ..models import InvestorUpdate

    updates = db.query(InvestorUpdate).filter(
        InvestorUpdate.organization_id == org_id
    ).order_by(desc(InvestorUpdate.created_at)).limit(5).all()

    if updates:
        recent = updates[0]
        response = f"""**Investor Updates** 📧

**Last Update:** {recent.title}
• Sent: {recent.sent_at.strftime('%b %d, %Y') if recent.sent_at else 'Draft'}
• Status: {recent.status}

**Total Updates Sent:** {len([u for u in updates if u.status == 'sent'])}"""
    else:
        response = """**No Investor Updates** 📧

Keep your investors informed with regular updates.

Go to **Investor Updates** to create and send your first update."""

    return {
        "response": response,
        "data_cards": [],
        "suggested_actions": [{"label": "Investor Updates", "action": "navigate", "target": "/app/investor-updates"}],
        "intent": "investor_updates",
        "source": "smart_response"
    }


def handle_compliance(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle compliance questions."""
    return handle_checklist(db, org_id, message)


def handle_tax_deadlines(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle tax deadline questions."""
    return handle_deadlines(db, org_id, message)


def handle_forecast(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle forecast questions."""
    return handle_budget(db, org_id, message)


def handle_hiring(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle hiring questions."""
    return {
        "response": "Track open positions and hiring in the **Team** page.",
        "data_cards": [],
        "suggested_actions": [{"label": "View Team", "action": "navigate", "target": "/app/team"}],
        "intent": "hiring",
        "source": "smart_response"
    }


def handle_payroll(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle payroll questions."""
    return {
        "response": "Payroll tracking coming soon. For now, view team costs in **Budget**.",
        "data_cards": [],
        "suggested_actions": [{"label": "View Budget", "action": "navigate", "target": "/app/budget"}],
        "intent": "payroll",
        "source": "smart_response"
    }


def handle_contractors(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle contractor questions."""
    return handle_team(db, org_id, message)


def handle_onboarding(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle onboarding questions."""
    from ..models import OnboardingChecklist

    active = db.query(OnboardingChecklist).filter(
        OnboardingChecklist.organization_id == org_id,
        OnboardingChecklist.is_completed == False
    ).count()

    response = f"**{active} active onboarding(s)** in progress. View details in **Team**."

    return {
        "response": response,
        "data_cards": [],
        "suggested_actions": [{"label": "View Team", "action": "navigate", "target": "/app/team"}],
        "intent": "onboarding",
        "source": "smart_response"
    }


def handle_priorities(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle priority questions."""
    return handle_tasks(db, org_id, message)


def handle_meetings(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle meeting questions."""
    return {
        "response": "Meeting tracking is available in **Calendar**. Connect Google Calendar in **Integrations** for sync.",
        "data_cards": [],
        "suggested_actions": [
            {"label": "View Calendar", "action": "navigate", "target": "/app/calendar"},
            {"label": "Connect Calendar", "action": "navigate", "target": "/app/integrations"},
        ],
        "intent": "meetings",
        "source": "smart_response"
    }


def handle_documents(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle document questions."""
    from ..models import Document

    docs = db.query(Document).filter(Document.organization_id == org_id).count()

    response = f"""**Documents** 📄

You have **{docs} documents** uploaded.

View and manage documents in the **Documents** page."""

    return {
        "response": response,
        "data_cards": [],
        "suggested_actions": [{"label": "View Documents", "action": "navigate", "target": "/app/documents"}],
        "intent": "documents",
        "source": "smart_response"
    }


def handle_how_to(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle how-to questions."""
    return handle_help(db, org_id, message)


def handle_whats_new(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle what's new questions."""
    return handle_overview(db, org_id, message)


def handle_health_score(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle business health score questions."""
    return handle_overview(db, org_id, message)


def handle_fundraising_instruments(db: Session, org_id: int, message: str) -> Dict[str, Any]:
    """Handle SAFE/convertible note questions."""
    return handle_cap_table(db, org_id, message)
