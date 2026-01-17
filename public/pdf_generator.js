// PDF Generation Function - Redesigned (Vyapar Style)
// Extracted from app.js for better maintainability

function generateBillPDF(bill, title = 'TAX INVOICE') {
    // Validate bill object
    if (!bill) { alert('Error: Bill data is missing.'); return; }

    console.log('Generating PDF:', title, bill);

    // Default Values
    bill.subtotal = parseFloat(bill.subtotal) || 0;
    bill.totalGST = parseFloat(bill.totalGST) || 0;
    bill.total = parseFloat(bill.total) || 0;

    // Determine Display ID (Invoice No or Proforma No)
    let displayId = 'N/A';
    if (title.toUpperCase().includes('PROFORMA') || title.toUpperCase().includes('ESTIMATE')) {
        displayId = bill.proformaNo || bill.id || 'N/A';
    } else {
        displayId = bill.customInvoiceNo || bill.invoiceNo || bill.id || 'N/A';
    }

    bill.createdAt = bill.createdAt || new Date();
    bill.gstBreakdown = bill.gstBreakdown || {};
    bill.paymentStatus = bill.paymentStatus || 'paid';
    bill.customer = bill.customer || { name: 'Cash Customer' };

    // Normalize Items
    bill.items = (bill.items || []).map(item => ({
        ...item,
        quantity: parseFloat(item.quantity) || 0,
        price: parseFloat(item.price) || 0,
        amount: parseFloat(item.amount) || 0,
        gst: parseFloat(item.gst) || 0,
        gstAmount: parseFloat(item.gstAmount) || 0,
        total: parseFloat(item.total) || 0,
        name: item.name || 'Unknown Item',
        size: item.size || '',
        unit: item.unit || ''
    }));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // -- COLORS & STYLES (Vyapar Inspired) --
    const themeColor = [41, 128, 185]; // Nice Blue
    const headerBg = [240, 240, 240]; // Light Gray for boxes
    const borderColor = [100, 100, 100]; // Dark Grey borders
    const textColor = [0, 0, 0];

    // Company & Banking Details (Global Access)
    // Ensure these variables are available globally or passed in. 
    // In app.js they are global. In this file, they rely on app.js having loaded them or localstorage.
    // Ideally we should read from localStorage to be safe if globals aren't ready, but app.js loads them.
    // For safety, let's grab them from localStorage if global is missing.
    const companyInfo = (typeof companyDetails !== 'undefined') ? companyDetails : JSON.parse(localStorage.getItem('companyDetails') || '{}');
    const bankInfo = (typeof bankingDetails !== 'undefined') ? bankingDetails : JSON.parse(localStorage.getItem('bankingDetails') || '{}');

    // Dimensions
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = pageWidth - (margin * 2);

    let y = margin;

    // --- 1. HEADER SECTION ---
    doc.setFillColor(...themeColor);
    doc.rect(margin, y, contentWidth, 12, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), pageWidth / 2, y + 8, { align: 'center' });

    y += 15;

    // Company Name (Left)
    doc.setTextColor(...themeColor);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(companyInfo.name || "COMPANY NAME", margin, y + 8);

    y += 12;

    // Company Details (Left) + Logo
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");

    // Logo (if exists)
    if (companyInfo.logo) {
        try {
            doc.addImage(companyInfo.logo, 'PNG', pageWidth - margin - 25, y - 5, 25, 25);
        } catch (e) { console.error('Logo error', e); }
    }

    const addrLines = doc.splitTextToSize(companyInfo.address || "", 120);
    doc.text(addrLines, margin, y);

    let currentY = y + (addrLines.length * 4);
    if (companyInfo.phone) {
        doc.text(`Phone: ${companyInfo.phone}`, margin, currentY);
        currentY += 4;
    }
    if (companyInfo.email) {
        doc.text(`Email: ${companyInfo.email}`, margin, currentY);
        currentY += 4;
    }
    if (companyInfo.gst) {
        doc.setFont("helvetica", "bold");
        doc.text(`GSTIN: ${companyInfo.gst}`, margin, currentY);
        doc.setFont("helvetica", "normal");
    }

    y = Math.max(y + 25, currentY + 6);

    // --- 2. GRID LAYOUT FOR DETAILS ---
    const boxHeight = 35;
    const midX = pageWidth / 2;

    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.1);

    // -- Left Box (Billing To) --
    doc.setFillColor(...headerBg);
    doc.rect(margin, y, (contentWidth / 2), 6, 'F');
    doc.rect(margin, y, (contentWidth / 2), boxHeight); // Outline

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("BILLED TO", margin + 2, y + 4);

    // Content
    const custY = y + 10;
    doc.setFontSize(9);
    doc.text(bill.customer.name || "Cash Customer", margin + 2, custY);

    doc.setFont("helvetica", "normal");
    const custAddr = doc.splitTextToSize(bill.customer.address || "", (contentWidth / 2) - 4);
    doc.text(custAddr, margin + 2, custY + 5);

    let custNextY = custY + 5 + (custAddr.length * 4);
    if (bill.customer.phone) doc.text(`Phone: ${bill.customer.phone}`, margin + 2, custNextY);
    if (bill.customer.gst) doc.text(`GSTIN: ${bill.customer.gst}`, margin + 2, custNextY + 4);

    // -- Right Box (Invoice Details) --
    doc.setFillColor(...headerBg);
    doc.rect(midX, y, (contentWidth / 2), 6, 'F');
    doc.rect(midX, y, (contentWidth / 2), boxHeight);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("INVOICE DETAILS", midX + 2, y + 4);

    const detX = midX + 2;
    const detY = y + 10;
    const gap = 5;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(title.includes('PROFORMA') ? "Quote No:" : "Invoice No:", detX, detY);
    doc.setFont("helvetica", "normal");
    doc.text(displayId, detX + 25, detY);

    doc.setFont("helvetica", "bold");
    doc.text("Date:", detX, detY + gap);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(bill.createdAt).toLocaleDateString('en-IN'), detX + 25, detY + gap);

    doc.setFont("helvetica", "bold");
    doc.text("Place:", detX, detY + (gap * 2));
    doc.setFont("helvetica", "normal");
    doc.text(bill.customer.state === 'same' ? 'Intra-State' : 'Inter-State', detX + 25, detY + (gap * 2));

    if (bill.paymentStatus) {
        doc.setFont("helvetica", "bold");
        doc.text("Status:", detX, detY + (gap * 3));
        doc.setFont("helvetica", "normal");
        doc.text(bill.paymentStatus.toUpperCase(), detX + 25, detY + (gap * 3));
    }


    // --- 3. ITEMS TABLE ---
    y += boxHeight;

    const headers = [['#', 'Item Description', 'HSN', 'Qty', 'Rate', 'GST', 'Amount']];
    const data = bill.items.map((item, i) => {
        let desc = item.name;
        if (item.size) desc += `\n(${item.size} ${item.unit})`;
        if (item.length && item.width) desc += `\n${item.length}x${item.width} (${item.pieces}pcs)`;

        return [
            i + 1,
            desc,
            // HSN check from global inventory or item property
            (typeof inventory !== 'undefined' ? inventory.find(inv => inv.id === item.id)?.hsn : item.hsn) || '-',
            `${item.quantity} ${item.unit}`,
            item.price.toFixed(2),
            `${item.gst}%`,
            item.total.toFixed(2)
        ];
    });

    doc.autoTable({
        startY: y,
        head: headers,
        body: data,
        theme: 'grid',
        headStyles: {
            fillColor: themeColor,
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            lineWidth: 0.1,
            lineColor: borderColor
        },
        bodyStyles: {
            textColor: 0,
            lineWidth: 0.1,
            lineColor: borderColor,
            valign: 'middle'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { cellWidth: 70 },
            2: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'right' },
            5: { halign: 'center' },
            6: { halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin },
        tableLineColor: borderColor,
        tableLineWidth: 0.1,
    });

    y = doc.lastAutoTable.finalY;

    // --- 4. FOOTER / SUMMARY ---
    // Make sure we have enough space for footer (approx 65 units)
    if (pageHeight - y < 70) {
        doc.addPage();
        y = margin;
    }

    const footerHeight = 65;

    // Draw Footer Outline Box
    doc.rect(margin, y, contentWidth, footerHeight);
    // Draw Vertical Split
    doc.line(midX, y, midX, y + footerHeight);

    // -- LEFT FOOTER --
    let fy = y + 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Amount In Words:", margin + 2, fy);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    // Use Helper from app.js if available, else simple fallback
    const amountWords = (typeof numberToWords !== 'undefined') ?
        numberToWords(Math.round(bill.total)) :
        Math.round(bill.total).toString();

    const words = amountWords + " Rupees Only";
    const wordsSplit = doc.splitTextToSize(words, (contentWidth / 2) - 5);
    doc.text(wordsSplit, margin + 2, fy + 5);

    fy += 15;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Bank Details:", margin + 2, fy);
    fy += 5;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Bank: ${bankInfo.bankName || '-'}`, margin + 2, fy);
    doc.text(`A/c : ${bankInfo.accountNumber || '-'}`, margin + 2, fy + 4);
    doc.text(`IFSC: ${bankInfo.ifsc || '-'}`, margin + 2, fy + 8);
    if (bankInfo.upiId) doc.text(`UPI : ${bankInfo.upiId}`, margin + 2, fy + 12);

    // Terms
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(companyInfo.terms || "Subject to local jurisdiction.", margin + 2, y + footerHeight - 2);


    // -- RIGHT FOOTER --
    const rX = midX + 2;
    const rValX = pageWidth - margin - 2;
    let ry = y + 5;

    doc.setTextColor(0);
    const drawRow = (lbl, val, bold = false) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(9);
        doc.text(lbl, rX, ry);
        doc.text(val, rValX, ry, { align: 'right' });
        ry += 5;
    };

    drawRow("Taxable Amount", `Rs. ${bill.subtotal.toFixed(2)}`);
    drawRow("Total GST", `Rs. ${bill.totalGST.toFixed(2)}`);

    ry += 2;
    doc.line(midX, ry - 3, pageWidth - margin, ry - 3);

    doc.setFontSize(12);
    doc.setTextColor(...themeColor);
    drawRow("Grand Total", `Rs. ${bill.total.toFixed(2)}`, true);
    doc.setTextColor(0);
    doc.setFontSize(9);

    // Outstanding Logic
    let previousOutstanding = 0;
    if (!title.toUpperCase().includes('PROFORMA')) {
        try {
            if (bill.customer.phone && typeof bills !== 'undefined') {
                previousOutstanding = bills.filter(b => {
                    const bDisplayId = b.proformaNo || b.customInvoiceNo || b.invoiceNo || b.id || 'N/A';
                    return b.customerPhone === bill.customer.phone &&
                        bDisplayId != displayId &&
                        (b.paymentStatus === 'pending' || b.paymentStatus === 'partial');
                }).reduce((sum, b) => {
                    if (b.paymentStatus === 'pending') return sum + (parseFloat(b.total) || 0);
                    if (b.paymentStatus === 'partial') {
                        const tracking = typeof b.paymentTracking === 'string' ? JSON.parse(b.paymentTracking) : b.paymentTracking;
                        return sum + (tracking && tracking.dueAmount ? parseFloat(tracking.dueAmount) : (parseFloat(b.total) || 0));
                    }
                    return sum;
                }, 0);
            }
        } catch (e) { console.error(e); }
    }

    if (previousOutstanding > 0) {
        ry += 5;
        doc.setTextColor(231, 76, 60);
        drawRow("Previous Balance", `Rs. ${previousOutstanding.toFixed(2)}`, true);

        doc.setFillColor(240, 240, 240);
        doc.rect(midX, ry - 4, (contentWidth / 2), 7, 'F');
        doc.setTextColor(0);

        const netPayable = bill.total + previousOutstanding;
        doc.setFont("helvetica", "bold");
        doc.text("Net Payable", rX, ry);
        doc.text(`Rs. ${netPayable.toFixed(2)}`, rValX, ry, { align: 'right' });
        ry += 5;
    }

    // Signature
    if (bankInfo.signature) {
        try {
            doc.addImage(bankInfo.signature, 'PNG', rValX - 35, y + footerHeight - 20, 30, 10);
        } catch (e) { }
    }
    doc.setFontSize(8);
    doc.text("Authorized Signatory", rValX, y + footerHeight - 5, { align: 'right' });

    doc.save(`${title.replace(/ /g, '_')}_${displayId}.pdf`);
}
