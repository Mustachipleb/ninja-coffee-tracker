import QRCode from "qrcode";

export function generateEpcQrCode(
    amount: number,
    options: {
        bic?: string;
        purpose?: string;
        benificiary: string;
        iban: string;
        text: string;
    }
) {
    const payload = generateEpcPaymentString(
        amount,
        options,
    );

    return QRCode.toDataURL(payload, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 400,
        color: { dark: "#000000", light: "#FFFFFF" },
    });
}

export function generateEpcPaymentString(
    amount: number,
    options: {
        bic?: string;
        purpose?: string;
        benificiary: string;
        iban: string;
        text: string;
    }
) {
    return [
        'BCD',
        '002',
        '1',
        'SCT',
        options.bic,
        options.benificiary,
        options.iban.replaceAll(' ', ''),
        formatEpcAmount(amount),
        '',
        '',
        options.text,
        ''
    ].join('\n');
}

/**
 * Formats an EUR amount per EPC spec: "EUR" + comma decimal separator.
 * E.g. 12.34 → "EUR12,34"  |  0 → "" (no amount)
 */
function formatEpcAmount(amountEur?: number): string {
    if (amountEur === undefined || amountEur === 0) return "";
    if (amountEur < 0 || amountEur > 999_999_999.99) {
        throw new Error("Amount must be between 0 and €999,999,999.99");
    }
    // Format with 2 decimal places, then swap dot for comma
    const formatted = amountEur.toFixed(2).replace(".", ",");
    return `EUR${formatted}`;
}