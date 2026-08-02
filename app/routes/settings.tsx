import { data, Form, redirect } from "react-router";
import type { Route } from "./+types/settings";
import { db } from "~/lib/db.server";
import { getPaymentSettings } from "~/lib/reconciliation.server";

export async function loader() {
  const settings = await getPaymentSettings();
  return { settings };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save") {
    const paymentRecipient = String(formData.get("paymentRecipient") ?? "").trim();
    const paymentIban = String(formData.get("paymentIban") ?? "").trim();
    const paymentBic = String(formData.get("paymentBic") ?? "").trim();
    const paymentReference = String(formData.get("paymentReference") ?? "").trim();

    if (!paymentRecipient || !paymentIban) {
      return data({ error: "Recipient name and IBAN are required." }, { status: 400 });
    }

    await db.appSettings.upsert({
      where: { id: "global" },
      update: {
        paymentRecipient,
        paymentIban: paymentIban.replaceAll(" ", ""),
        paymentBic: paymentBic || null,
        paymentReference: paymentReference || "Ninja Coffee",
      },
      create: {
        id: "global",
        paymentRecipient,
        paymentIban: paymentIban.replaceAll(" ", ""),
        paymentBic: paymentBic || null,
        paymentReference: paymentReference || "Ninja Coffee",
      },
    });

    return redirect("/settings");
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const { settings } = loaderData;
  const error = (actionData as { error?: string } | undefined)?.error;

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-500">
          Configure the payment recipient for EPC QR-code payments.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950">{error}</p>
      )}

      <Form method="post" className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <div>
          <label htmlFor="paymentRecipient" className="block text-sm font-medium">
            Recipient name *
          </label>
          <input
            id="paymentRecipient"
            name="paymentRecipient"
            required
            defaultValue={settings.paymentRecipient}
            placeholder="Coffee Kitty"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div>
          <label htmlFor="paymentIban" className="block text-sm font-medium">
            IBAN *
          </label>
          <input
            id="paymentIban"
            name="paymentIban"
            required
            defaultValue={settings.paymentIban}
            placeholder="DE02 1203 0000 0000 2020 51"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div>
          <label htmlFor="paymentBic" className="block text-sm font-medium">
            BIC / SWIFT <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="paymentBic"
            name="paymentBic"
            defaultValue={settings.paymentBic ?? ""}
            placeholder="BYLADEM1001"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div>
          <label htmlFor="paymentReference" className="block text-sm font-medium">
            Payment reference
          </label>
          <input
            id="paymentReference"
            name="paymentReference"
            defaultValue={settings.paymentReference}
            placeholder="Ninja Coffee"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <p className="mt-1 text-xs text-gray-500">
            Used as the description in the generated QR code.
          </p>
        </div>

        <button
          type="submit"
          name="intent"
          value="save"
          className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          Save settings
        </button>
      </Form>
    </div>
  );
}
