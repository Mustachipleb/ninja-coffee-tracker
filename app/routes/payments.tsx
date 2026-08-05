import { data, Form, redirect, useNavigation, useSearchParams } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/payments";
import { db } from "~/lib/db.server";
import { getPaymentSettings, getUserReconciliations } from "~/lib/reconciliation.server";
import { generateEpcQrCode } from "~/lib/payment";
import { formatCents } from "~/lib/format";
import { requireAuth } from "~/lib/session.server";
import { getCurrentUserWithRole, canSeeAllBalances } from "~/lib/authorize.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const currentUser = await getCurrentUserWithRole(request);
  const showAll = canSeeAllBalances(currentUser!);

  const [reconciliations, settings] = await Promise.all([
    getUserReconciliations(),
    getPaymentSettings(),
  ]);

  // Filter reconciliations for non-admin users
  const filteredReconciliations = showAll
    ? reconciliations
    : reconciliations.filter((r) => r.id === currentUser!.id);

  // Pre-generate QR codes for users with an outstanding balance.
  const qrCodes: Record<string, string> = {};
  if (settings.paymentIban && settings.paymentRecipient) {
    for (const user of filteredReconciliations) {
      if (user.outstandingCents > 0) {
        try {
          qrCodes[user.id] = await generateEpcQrCode(user.outstandingCents / 100, {
            benificiary: settings.paymentRecipient,
            iban: settings.paymentIban,
            bic: settings.paymentBic ?? undefined,
            text: `${settings.paymentReference} – ${user.name}`,
          });
        } catch {
          // QR generation failed (e.g. invalid IBAN format) — skip silently.
        }
      }
    }
  }

  const settingsConfigured = !!(settings.paymentIban && settings.paymentRecipient);

  // Support pre-populated per-brew payment from wizard redirect.
  const url = new URL(request.url);
  const perBrewUserId = url.searchParams.get("userId") ?? null;
  const perBrewAmountCents = parseInt(url.searchParams.get("amount") ?? "0", 10) || null;
  const perBrewNote = url.searchParams.get("note") ?? null;

  let perBrewQr: string | null = null;
  if (perBrewUserId && perBrewAmountCents && settings.paymentIban && settings.paymentRecipient) {
    const user = filteredReconciliations.find((u) => u.id === perBrewUserId);
    if (user) {
      try {
        perBrewQr = await generateEpcQrCode(perBrewAmountCents / 100, {
          benificiary: settings.paymentRecipient,
          iban: settings.paymentIban,
          bic: settings.paymentBic ?? undefined,
          text: `${settings.paymentReference} – ${user.name}`,
        });
      } catch {
        // skip
      }
    }
  }

  return { reconciliations: filteredReconciliations, settings, qrCodes, settingsConfigured, perBrewUserId, perBrewAmountCents, perBrewNote, perBrewQr };
}

export async function action({ request }: Route.ActionArgs) {
  const currentUser = await getCurrentUserWithRole(request);
  if (!currentUser) throw redirect("/login");

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "settle") {
    const userId = String(formData.get("userId") ?? "");
    const amountCents = parseInt(String(formData.get("amountCents") ?? "0"), 10);

    // Users can only pay their own balance; admins can pay for anyone
    if (!canSeeAllBalances(currentUser) && userId !== currentUser.id) {
      return data({ error: "You can only pay your own balance." }, { status: 403 });
    }

    if (!userId || !Number.isFinite(amountCents) || amountCents <= 0) {
      return data({ error: "Invalid payment details." }, { status: 400 });
    }

    await db.payment.create({
      data: { userId, amountCents, note: "Tab settled" },
    });

    return redirect("/payments");
  }

  if (intent === "custom") {
    const userId = String(formData.get("userId") ?? "");
    const amountEur = parseFloat(String(formData.get("amountEur") ?? "0"));
    const amountCents = Math.round(amountEur * 100);
    const note = String(formData.get("note") ?? "").trim();

    if (!userId || !Number.isFinite(amountCents) || amountCents <= 0) {
      return data({ error: "Invalid payment amount." }, { status: 400 });
    }

    await db.payment.create({
      data: { userId, amountCents, note: note || null },
    });

    return redirect("/payments");
  }

  if (intent === "delete") {
    const paymentId = String(formData.get("paymentId") ?? "");
    await db.payment.delete({ where: { id: paymentId } });
    return redirect("/payments");
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function Payments({ loaderData, actionData }: Route.ComponentProps) {
  const { reconciliations, settings, qrCodes, settingsConfigured, perBrewUserId, perBrewAmountCents, perBrewNote, perBrewQr } = loaderData;
  const error = (actionData as { error?: string } | undefined)?.error;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [showQr, setShowQr] = useState<string | null>(null);

  const totalOutstanding = reconciliations.reduce(
    (sum, u) => sum + Math.max(0, u.outstandingCents),
    0,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-sm text-gray-500">
            Record payments and settle tabs via EPC QR code.
          </p>
        </div>
        <a
          href="/settings"
          className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          ⚙ Settings
        </a>
      </div>

      {/* Per-brew payment panel shown when redirected from wizard with ?userId=&amount= */}
      {perBrewUserId && perBrewAmountCents && (() => {
        const user = reconciliations.find((u) => u.id === perBrewUserId);
        return user ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950 space-y-3">
            <p className="text-base font-semibold text-amber-800 dark:text-amber-200">
              ☕ Pay for this brew — {formatCents(perBrewAmountCents)} for {user.name}
            </p>
            {perBrewQr && (
              <div className="flex flex-col items-center gap-2">
                <img src={perBrewQr} alt="EPC Payment QR" className="w-48 h-48 rounded-md" />
                <p className="text-xs text-amber-700 dark:text-amber-300 text-center">
                  Scan with your banking app to pay {formatCents(perBrewAmountCents)}
                </p>
              </div>
            )}
            <Form method="post" className="flex flex-wrap gap-2 items-center">
              <input type="hidden" name="userId" value={perBrewUserId} />
              <input type="hidden" name="amountCents" value={perBrewAmountCents} />
              <button
                type="submit"
                name="intent"
                value="settle"
                className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800"
              >
                ✓ Mark as paid
              </button>
              <a href="/payments" className="text-xs underline text-amber-700 dark:text-amber-300">Dismiss</a>
            </Form>
          </div>
        ) : null;
      })()}

      {!settingsConfigured && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          Payment recipient not configured yet.{" "}
          <a href="/settings" className="underline font-medium">Configure IBAN & recipient →</a>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950">{error}</p>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-xs uppercase text-gray-500">Total outstanding</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-500">
            {formatCents(totalOutstanding)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-xs uppercase text-gray-500">People</p>
          <p className="text-2xl font-bold">{reconciliations.length}</p>
        </div>
      </div>

      {/* Per-user reconciliation */}
      <div className="space-y-4">
        {reconciliations.map((user) => (
          <div
            key={user.id}
            className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden"
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-base">{user.name}</p>
                <p className="text-xs text-gray-500">
                  {user.brewCount} brew{user.brewCount !== 1 ? "s" : ""} ·{" "}
                  Brewed {formatCents(user.totalBrewedCents)} · Paid {formatCents(user.totalPaidCents)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-lg font-bold ${
                    user.outstandingCents > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-700 dark:text-green-400"
                  }`}
                >
                  {user.outstandingCents > 0
                    ? `Owes ${formatCents(user.outstandingCents)}`
                    : user.outstandingCents < 0
                    ? `Credit ${formatCents(-user.outstandingCents)}`
                    : "Settled ✓"}
                </p>
              </div>
            </div>

            {/* Actions row */}
            <div className="flex flex-wrap gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
              {/* Settle-tab button */}
              {user.outstandingCents > 0 && (
                <Form method="post" className="contents">
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="amountCents" value={user.outstandingCents} />
                  <button
                    type="submit"
                    name="intent"
                    value="settle"
                    disabled={isSubmitting}
                    className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
                  >
                    ✓ Mark full tab paid
                  </button>
                </Form>
              )}

              {/* QR code button */}
              {user.outstandingCents > 0 && qrCodes[user.id] && (
                <button
                  type="button"
                  onClick={() => setShowQr(showQr === user.id ? null : user.id)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                >
                  {showQr === user.id ? "Hide QR" : "📷 Show QR code"}
                </button>
              )}

              {/* Custom payment toggle */}
              <button
                type="button"
                onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                {expandedUser === user.id ? "Cancel" : "Custom amount"}
              </button>
            </div>

            {/* EPC QR code */}
            {showQr === user.id && qrCodes[user.id] && (
              <div className="border-t border-gray-100 p-4 dark:border-gray-800 flex flex-col items-center gap-3">
                <p className="text-sm font-medium">
                  EPC QR – {formatCents(user.outstandingCents)} to {settings.paymentRecipient}
                </p>
                <img
                  src={qrCodes[user.id]}
                  alt={`Payment QR code for ${user.name}`}
                  className="w-48 h-48 rounded-md"
                />
                <p className="text-xs text-gray-500 text-center">
                  Scan with your banking app to pay {formatCents(user.outstandingCents)}
                </p>
              </div>
            )}

            {/* Custom payment form */}
            {expandedUser === user.id && (
              <Form
                method="post"
                className="border-t border-gray-100 p-4 dark:border-gray-800 flex flex-wrap gap-3 items-end"
              >
                <input type="hidden" name="userId" value={user.id} />
                <div>
                  <label className="block text-xs font-medium mb-1" htmlFor={`amount-${user.id}`}>
                    Amount (€)
                  </label>
                  <input
                    id={`amount-${user.id}`}
                    name="amountEur"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    defaultValue={user.outstandingCents > 0 ? (user.outstandingCents / 100).toFixed(2) : ""}
                    className="w-28 rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" htmlFor={`note-${user.id}`}>
                    Note (optional)
                  </label>
                  <input
                    id={`note-${user.id}`}
                    name="note"
                    placeholder="e.g. partial payment"
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
                <button
                  type="submit"
                  name="intent"
                  value="custom"
                  disabled={isSubmitting}
                  className="rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
                >
                  Record payment
                </button>
              </Form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
