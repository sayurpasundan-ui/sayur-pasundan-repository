import { expireOverdueOrders } from "../functions/_lib/order-utils.js";

export default {
  async scheduled(_event, env, ctx) {
    if (!env?.DB) throw new Error("Binding D1 bernama DB belum dipasang pada worker kedaluwarsa pesanan.");
    ctx.waitUntil(expireOverdueOrders(env.DB, { env, waitUntil: p => ctx.waitUntil(p) }));
  }
};
