"""
Invoicing API - Create and manage invoices.

Features:
- Invoice creation with line items
- PDF generation
- Email sending
- Payment tracking
"""

from datetime import datetime, date
from typing import Optional, List
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from .database import get_db
from .auth import get_current_user
from .models import User, Contact, Invoice, InvoiceLineItem, InvoicePayment, ProductOffered
from .schemas import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse, InvoiceWithLineItems,
    InvoiceLineItemCreate, InvoiceLineItemResponse,
    InvoicePaymentCreate, InvoicePaymentResponse,
    InvoiceSummary
)

router = APIRouter(prefix="/api/invoices", tags=["Invoicing"])


def generate_invoice_number(db: Session, org_id: int) -> str:
    """Generate a unique invoice number."""
    # Get current year
    year = datetime.now().year

    # Count existing invoices this year
    count = db.query(Invoice).filter(
        Invoice.organization_id == org_id,
        Invoice.invoice_number.like(f"INV-{year}-%")
    ).count()

    # Generate number: INV-2025-0001
    return f"INV-{year}-{str(count + 1).zfill(4)}"


def calculate_invoice_totals(line_items: List[dict], tax_rate: float) -> dict:
    """Calculate invoice totals from line items."""
    subtotal = sum(item.get("quantity", 1) * item.get("unit_price", 0) for item in line_items)
    tax_amount = subtotal * (tax_rate / 100) if tax_rate else 0
    total_amount = subtotal + tax_amount

    return {
        "subtotal": round(subtotal, 2),
        "tax_amount": round(tax_amount, 2),
        "total_amount": round(total_amount, 2)
    }


# ============================================
# SUMMARY (must be before /{invoice_id} route)
# ============================================

@router.get("/summary", response_model=InvoiceSummary)
def get_invoice_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get invoice summary for dashboard."""
    today = date.today()
    first_of_month = today.replace(day=1)

    # Outstanding (sent but not paid)
    outstanding = db.query(func.sum(Invoice.total_amount - Invoice.paid_amount)).filter(
        Invoice.organization_id == current_user.organization_id,
        Invoice.status.in_(["sent", "viewed"])
    ).scalar() or 0

    # Overdue
    overdue_invoices = db.query(Invoice).filter(
        Invoice.organization_id == current_user.organization_id,
        Invoice.status.in_(["sent", "viewed"]),
        Invoice.due_date < today
    ).all()

    overdue_amount = sum(inv.total_amount - inv.paid_amount for inv in overdue_invoices)
    overdue_count = len(overdue_invoices)

    # Paid this month
    paid_this_month = db.query(func.sum(InvoicePayment.amount)).join(Invoice).filter(
        Invoice.organization_id == current_user.organization_id,
        InvoicePayment.payment_date >= first_of_month
    ).scalar() or 0

    # Total invoice count
    invoice_count = db.query(Invoice).filter(
        Invoice.organization_id == current_user.organization_id
    ).count()

    # Recent invoices
    recent = db.query(Invoice).filter(
        Invoice.organization_id == current_user.organization_id
    ).order_by(Invoice.created_at.desc()).limit(5).all()

    recent_invoices = []
    for inv in recent:
        contact = inv.contact
        recent_invoices.append({
            "id": inv.id,
            "organization_id": inv.organization_id,
            "business_id": inv.business_id,
            "contact_id": inv.contact_id,
            "invoice_number": inv.invoice_number,
            "issue_date": inv.issue_date,
            "due_date": inv.due_date,
            "subtotal": inv.subtotal,
            "tax_rate": inv.tax_rate,
            "tax_amount": inv.tax_amount,
            "total_amount": inv.total_amount,
            "status": inv.status,
            "payment_method": inv.payment_method,
            "paid_at": inv.paid_at,
            "paid_amount": inv.paid_amount,
            "notes": inv.notes,
            "terms": inv.terms,
            "email_sent_at": inv.email_sent_at,
            "viewed_at": inv.viewed_at,
            "created_by_id": inv.created_by_id,
            "created_at": inv.created_at,
            "updated_at": inv.updated_at,
            "contact_name": contact.name if contact else None,
            "contact_email": contact.email if contact else None,
            "contact_company": contact.company if contact else None,
        })

    return {
        "total_outstanding": outstanding,
        "total_overdue": overdue_amount,
        "total_paid_this_month": paid_this_month,
        "invoice_count": invoice_count,
        "overdue_count": overdue_count,
        "recent_invoices": recent_invoices,
    }


# ============================================
# INVOICE CRUD
# ============================================

@router.get("", response_model=List[InvoiceResponse])
def list_invoices(
    status: Optional[str] = Query(None),
    contact_id: Optional[int] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List invoices with optional filters."""
    query = db.query(Invoice).filter(
        Invoice.organization_id == current_user.organization_id
    )

    if status:
        query = query.filter(Invoice.status == status)
    if contact_id:
        query = query.filter(Invoice.contact_id == contact_id)

    invoices = query.order_by(Invoice.issue_date.desc()).offset(offset).limit(limit).all()

    result = []
    for inv in invoices:
        contact = inv.contact
        result.append({
            "id": inv.id,
            "organization_id": inv.organization_id,
            "business_id": inv.business_id,
            "contact_id": inv.contact_id,
            "invoice_number": inv.invoice_number,
            "issue_date": inv.issue_date,
            "due_date": inv.due_date,
            "subtotal": inv.subtotal,
            "tax_rate": inv.tax_rate,
            "tax_amount": inv.tax_amount,
            "total_amount": inv.total_amount,
            "status": inv.status,
            "payment_method": inv.payment_method,
            "paid_at": inv.paid_at,
            "paid_amount": inv.paid_amount,
            "notes": inv.notes,
            "terms": inv.terms,
            "email_sent_at": inv.email_sent_at,
            "viewed_at": inv.viewed_at,
            "created_by_id": inv.created_by_id,
            "created_at": inv.created_at,
            "updated_at": inv.updated_at,
            "contact_name": contact.name if contact else None,
            "contact_email": contact.email if contact else None,
            "contact_company": contact.company if contact else None,
        })

    return result


@router.post("", response_model=InvoiceWithLineItems)
def create_invoice(
    invoice_data: InvoiceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new invoice."""
    # Validate contact
    contact = db.query(Contact).filter(
        Contact.id == invoice_data.contact_id,
        Contact.organization_id == current_user.organization_id
    ).first()

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Generate invoice number
    invoice_number = generate_invoice_number(db, current_user.organization_id)

    # Calculate totals
    line_items_data = [item.model_dump() for item in invoice_data.line_items]
    totals = calculate_invoice_totals(line_items_data, invoice_data.tax_rate)

    # Create invoice
    db_invoice = Invoice(
        organization_id=current_user.organization_id,
        contact_id=invoice_data.contact_id,
        invoice_number=invoice_number,
        issue_date=date.today(),
        due_date=invoice_data.due_date,
        subtotal=totals["subtotal"],
        tax_rate=invoice_data.tax_rate,
        tax_amount=totals["tax_amount"],
        total_amount=totals["total_amount"],
        notes=invoice_data.notes,
        terms=invoice_data.terms,
        created_by_id=current_user.id
    )
    db.add(db_invoice)
    db.flush()

    # Add line items
    line_items_result = []
    for idx, item in enumerate(invoice_data.line_items):
        amount = item.quantity * item.unit_price
        db_item = InvoiceLineItem(
            invoice_id=db_invoice.id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            amount=round(amount, 2),
            product_id=item.product_id,
            sort_order=idx
        )
        db.add(db_item)
        db.flush()

        line_items_result.append({
            "id": db_item.id,
            "invoice_id": db_item.invoice_id,
            "description": db_item.description,
            "quantity": db_item.quantity,
            "unit_price": db_item.unit_price,
            "amount": db_item.amount,
            "product_id": db_item.product_id,
            "sort_order": db_item.sort_order,
            "created_at": db_item.created_at,
        })

    db.commit()

    return {
        "id": db_invoice.id,
        "organization_id": db_invoice.organization_id,
        "business_id": db_invoice.business_id,
        "contact_id": db_invoice.contact_id,
        "invoice_number": db_invoice.invoice_number,
        "issue_date": db_invoice.issue_date,
        "due_date": db_invoice.due_date,
        "subtotal": db_invoice.subtotal,
        "tax_rate": db_invoice.tax_rate,
        "tax_amount": db_invoice.tax_amount,
        "total_amount": db_invoice.total_amount,
        "status": db_invoice.status,
        "payment_method": db_invoice.payment_method,
        "paid_at": db_invoice.paid_at,
        "paid_amount": db_invoice.paid_amount,
        "notes": db_invoice.notes,
        "terms": db_invoice.terms,
        "email_sent_at": db_invoice.email_sent_at,
        "viewed_at": db_invoice.viewed_at,
        "created_by_id": db_invoice.created_by_id,
        "created_at": db_invoice.created_at,
        "updated_at": db_invoice.updated_at,
        "contact_name": contact.name,
        "contact_email": contact.email,
        "contact_company": contact.company,
        "line_items": line_items_result,
        "payments": [],
    }


@router.get("/{invoice_id}", response_model=InvoiceWithLineItems)
def get_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get invoice details with line items and payments."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.organization_id == current_user.organization_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    contact = invoice.contact

    line_items = [{
        "id": item.id,
        "invoice_id": item.invoice_id,
        "description": item.description,
        "quantity": item.quantity,
        "unit_price": item.unit_price,
        "amount": item.amount,
        "product_id": item.product_id,
        "sort_order": item.sort_order,
        "created_at": item.created_at,
    } for item in invoice.line_items]

    payments = [{
        "id": p.id,
        "invoice_id": p.invoice_id,
        "amount": p.amount,
        "payment_date": p.payment_date,
        "payment_method": p.payment_method,
        "stripe_payment_intent_id": p.stripe_payment_intent_id,
        "notes": p.notes,
        "created_at": p.created_at,
    } for p in invoice.payments]

    return {
        "id": invoice.id,
        "organization_id": invoice.organization_id,
        "business_id": invoice.business_id,
        "contact_id": invoice.contact_id,
        "invoice_number": invoice.invoice_number,
        "issue_date": invoice.issue_date,
        "due_date": invoice.due_date,
        "subtotal": invoice.subtotal,
        "tax_rate": invoice.tax_rate,
        "tax_amount": invoice.tax_amount,
        "total_amount": invoice.total_amount,
        "status": invoice.status,
        "payment_method": invoice.payment_method,
        "paid_at": invoice.paid_at,
        "paid_amount": invoice.paid_amount,
        "notes": invoice.notes,
        "terms": invoice.terms,
        "email_sent_at": invoice.email_sent_at,
        "viewed_at": invoice.viewed_at,
        "created_by_id": invoice.created_by_id,
        "created_at": invoice.created_at,
        "updated_at": invoice.updated_at,
        "contact_name": contact.name if contact else None,
        "contact_email": contact.email if contact else None,
        "contact_company": contact.company if contact else None,
        "line_items": line_items,
        "payments": payments,
    }


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    updates: InvoiceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an invoice (only draft invoices can be fully edited)."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.organization_id == current_user.organization_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    update_data = updates.model_dump(exclude_unset=True)

    # Only allow status changes for non-draft invoices
    if invoice.status != "draft" and len(update_data) > 1:
        if "status" not in update_data:
            raise HTTPException(status_code=400, detail="Only status can be changed for sent invoices")

    for key, value in update_data.items():
        setattr(invoice, key, value)

    # Recalculate totals if tax rate changed
    if "tax_rate" in update_data:
        totals = calculate_invoice_totals(
            [{"quantity": item.quantity, "unit_price": item.unit_price} for item in invoice.line_items],
            invoice.tax_rate
        )
        invoice.subtotal = totals["subtotal"]
        invoice.tax_amount = totals["tax_amount"]
        invoice.total_amount = totals["total_amount"]

    db.commit()
    db.refresh(invoice)

    contact = invoice.contact

    return {
        "id": invoice.id,
        "organization_id": invoice.organization_id,
        "business_id": invoice.business_id,
        "contact_id": invoice.contact_id,
        "invoice_number": invoice.invoice_number,
        "issue_date": invoice.issue_date,
        "due_date": invoice.due_date,
        "subtotal": invoice.subtotal,
        "tax_rate": invoice.tax_rate,
        "tax_amount": invoice.tax_amount,
        "total_amount": invoice.total_amount,
        "status": invoice.status,
        "payment_method": invoice.payment_method,
        "paid_at": invoice.paid_at,
        "paid_amount": invoice.paid_amount,
        "notes": invoice.notes,
        "terms": invoice.terms,
        "email_sent_at": invoice.email_sent_at,
        "viewed_at": invoice.viewed_at,
        "created_by_id": invoice.created_by_id,
        "created_at": invoice.created_at,
        "updated_at": invoice.updated_at,
        "contact_name": contact.name if contact else None,
        "contact_email": contact.email if contact else None,
        "contact_company": contact.company if contact else None,
    }


@router.delete("/{invoice_id}")
def delete_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a draft invoice."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.organization_id == current_user.organization_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft invoices can be deleted")

    db.delete(invoice)
    db.commit()

    return {"message": "Invoice deleted"}


# ============================================
# LINE ITEMS
# ============================================

@router.post("/{invoice_id}/line-items", response_model=InvoiceLineItemResponse)
def add_line_item(
    invoice_id: int,
    item: InvoiceLineItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a line item to an invoice."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.organization_id == current_user.organization_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status != "draft":
        raise HTTPException(status_code=400, detail="Cannot modify sent invoice")

    # Get max sort order
    max_order = db.query(func.max(InvoiceLineItem.sort_order)).filter(
        InvoiceLineItem.invoice_id == invoice_id
    ).scalar() or -1

    amount = item.quantity * item.unit_price

    db_item = InvoiceLineItem(
        invoice_id=invoice_id,
        description=item.description,
        quantity=item.quantity,
        unit_price=item.unit_price,
        amount=round(amount, 2),
        product_id=item.product_id,
        sort_order=max_order + 1
    )
    db.add(db_item)

    # Recalculate totals
    invoice.subtotal += round(amount, 2)
    invoice.tax_amount = round(invoice.subtotal * (invoice.tax_rate / 100), 2)
    invoice.total_amount = invoice.subtotal + invoice.tax_amount

    db.commit()
    db.refresh(db_item)

    return {
        "id": db_item.id,
        "invoice_id": db_item.invoice_id,
        "description": db_item.description,
        "quantity": db_item.quantity,
        "unit_price": db_item.unit_price,
        "amount": db_item.amount,
        "product_id": db_item.product_id,
        "sort_order": db_item.sort_order,
        "created_at": db_item.created_at,
    }


@router.delete("/{invoice_id}/line-items/{item_id}")
def remove_line_item(
    invoice_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a line item from an invoice."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.organization_id == current_user.organization_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status != "draft":
        raise HTTPException(status_code=400, detail="Cannot modify sent invoice")

    item = db.query(InvoiceLineItem).filter(
        InvoiceLineItem.id == item_id,
        InvoiceLineItem.invoice_id == invoice_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Line item not found")

    # Update totals
    invoice.subtotal -= item.amount
    invoice.tax_amount = round(invoice.subtotal * (invoice.tax_rate / 100), 2)
    invoice.total_amount = invoice.subtotal + invoice.tax_amount

    db.delete(item)
    db.commit()

    return {"message": "Line item removed"}


# ============================================
# PAYMENTS
# ============================================

@router.post("/{invoice_id}/payments", response_model=InvoicePaymentResponse)
def record_payment(
    invoice_id: int,
    payment: InvoicePaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record a payment for an invoice."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.organization_id == current_user.organization_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status in ["cancelled", "draft"]:
        raise HTTPException(status_code=400, detail="Cannot record payment for this invoice")

    db_payment = InvoicePayment(
        invoice_id=invoice_id,
        amount=payment.amount,
        payment_date=payment.payment_date,
        payment_method=payment.payment_method,
        stripe_payment_intent_id=payment.stripe_payment_intent_id,
        notes=payment.notes
    )
    db.add(db_payment)

    # Update invoice
    invoice.paid_amount += payment.amount
    invoice.payment_method = payment.payment_method

    # Check if fully paid
    if invoice.paid_amount >= invoice.total_amount:
        invoice.status = "paid"
        invoice.paid_at = datetime.utcnow()

    db.commit()
    db.refresh(db_payment)

    return {
        "id": db_payment.id,
        "invoice_id": db_payment.invoice_id,
        "amount": db_payment.amount,
        "payment_date": db_payment.payment_date,
        "payment_method": db_payment.payment_method,
        "stripe_payment_intent_id": db_payment.stripe_payment_intent_id,
        "notes": db_payment.notes,
        "created_at": db_payment.created_at,
    }


@router.delete("/{invoice_id}/payments/{payment_id}")
def delete_payment(
    invoice_id: int,
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a payment record."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.organization_id == current_user.organization_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    payment = db.query(InvoicePayment).filter(
        InvoicePayment.id == payment_id,
        InvoicePayment.invoice_id == invoice_id
    ).first()

    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Update invoice
    invoice.paid_amount -= payment.amount

    # Revert status if was paid
    if invoice.status == "paid" and invoice.paid_amount < invoice.total_amount:
        invoice.status = "sent"
        invoice.paid_at = None

    db.delete(payment)
    db.commit()

    return {"message": "Payment deleted"}


# ============================================
# ACTIONS
# ============================================

@router.post("/{invoice_id}/send")
def send_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark invoice as sent (would also email in production)."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.organization_id == current_user.organization_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status not in ["draft", "sent"]:
        raise HTTPException(status_code=400, detail="Invoice cannot be sent")

    invoice.status = "sent"
    invoice.email_sent_at = datetime.utcnow()

    db.commit()

    return {"message": "Invoice sent", "email_sent_at": invoice.email_sent_at}


@router.post("/{invoice_id}/mark-paid")
def mark_invoice_paid(
    invoice_id: int,
    payment_method: Optional[str] = Query("other"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark invoice as fully paid."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.organization_id == current_user.organization_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot mark cancelled invoice as paid")

    # Create payment record for remaining amount
    remaining = invoice.total_amount - invoice.paid_amount
    if remaining > 0:
        db_payment = InvoicePayment(
            invoice_id=invoice_id,
            amount=remaining,
            payment_date=date.today(),
            payment_method=payment_method
        )
        db.add(db_payment)
        invoice.paid_amount = invoice.total_amount

    invoice.status = "paid"
    invoice.paid_at = datetime.utcnow()
    invoice.payment_method = payment_method

    db.commit()

    return {"message": "Invoice marked as paid"}


@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate and download invoice as PDF."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.organization_id == current_user.organization_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Generate simple HTML invoice (PDF generation would require additional library)
    contact = invoice.contact

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 40px; }}
            .header {{ display: flex; justify-content: space-between; margin-bottom: 40px; }}
            .invoice-title {{ font-size: 32px; font-weight: bold; color: #1a1a1a; }}
            .invoice-number {{ color: #666; margin-top: 8px; }}
            table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
            th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
            th {{ background: #f8f9fa; }}
            .amount {{ text-align: right; }}
            .total-row {{ font-weight: bold; background: #f8f9fa; }}
            .footer {{ margin-top: 40px; font-size: 14px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <div class="invoice-title">INVOICE</div>
                <div class="invoice-number">{invoice.invoice_number}</div>
            </div>
            <div>
                <div><strong>Date:</strong> {invoice.issue_date}</div>
                <div><strong>Due:</strong> {invoice.due_date}</div>
            </div>
        </div>

        <div style="margin-bottom: 30px;">
            <strong>Bill To:</strong><br>
            {contact.name if contact else ''}<br>
            {contact.company if contact and contact.company else ''}<br>
            {contact.email if contact else ''}
        </div>

        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th class="amount">Qty</th>
                    <th class="amount">Price</th>
                    <th class="amount">Amount</th>
                </tr>
            </thead>
            <tbody>
    """

    for item in invoice.line_items:
        html += f"""
                <tr>
                    <td>{item.description}</td>
                    <td class="amount">{item.quantity}</td>
                    <td class="amount">${item.unit_price:,.2f}</td>
                    <td class="amount">${item.amount:,.2f}</td>
                </tr>
        """

    html += f"""
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3" class="amount"><strong>Subtotal:</strong></td>
                    <td class="amount">${invoice.subtotal:,.2f}</td>
                </tr>
    """

    if invoice.tax_rate > 0:
        html += f"""
                <tr>
                    <td colspan="3" class="amount"><strong>Tax ({invoice.tax_rate}%):</strong></td>
                    <td class="amount">${invoice.tax_amount:,.2f}</td>
                </tr>
        """

    html += f"""
                <tr class="total-row">
                    <td colspan="3" class="amount"><strong>Total:</strong></td>
                    <td class="amount">${invoice.total_amount:,.2f}</td>
                </tr>
            </tfoot>
        </table>

        <div class="footer">
            {invoice.terms or 'Payment due upon receipt.'}
            {('<br><br>' + invoice.notes) if invoice.notes else ''}
        </div>
    </body>
    </html>
    """

    return StreamingResponse(
        BytesIO(html.encode()),
        media_type="text/html",
        headers={
            "Content-Disposition": f'attachment; filename="invoice-{invoice.invoice_number}.html"'
        }
    )
