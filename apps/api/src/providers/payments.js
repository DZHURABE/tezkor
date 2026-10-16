/* Payment provider interface. Each adapter implements:
     createPayment({ orderId, amount, currency:"TJS", returnUrl }) → { providerRef, redirectUrl? , status }
     handleWebhook(headers, body) → { orderId, status: "paid"|"declined" }   (MUST verify signature)
     refund({ providerRef, amount }) → { status }
   The in-browser prototype uses "mock" (Luhn check; card ending 0002 is declined). */
const mock = {
  name: "mock",
  async createPayment({ orderId, amount }) { return { providerRef: "mock_" + orderId, status: "pending", amount }; },
  async handleWebhook(_h, body) { return { orderId: body.orderId, status: body.status === "paid" ? "paid" : "declined" }; },
  async refund({ providerRef, amount }) { return { providerRef, amount, status: "refunded" }; },
};
/* TODO adapters — fill in once merchant agreements are signed (keys come from .env):
   korti_milli  (national card system, via acquiring bank: Amonatbonk / Orienbank / Eskhata)
   visa_mc      (international cards via acquiring bank 3-D Secure gateway)
   dc_wallet / alif_mobi / tcell_pay (mobile wallets, QR / deep-link flow) */
function notConfigured(name) { const fail = async () => { throw new Error(name + " is not configured — see apps/api/src/providers/payments.js"); }; return { name, createPayment: fail, handleWebhook: fail, refund: fail }; }
const registry = { mock, korti_milli: notConfigured("korti_milli"), visa_mc: notConfigured("visa_mc"), dc_wallet: notConfigured("dc_wallet"), alif_mobi: notConfigured("alif_mobi") };
module.exports = { get: n => registry[n || process.env.PAYMENT_PROVIDER || "mock"], list: () => Object.keys(registry) };
