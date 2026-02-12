/**
 * Логирование транзакций монет.
 * Типы: route_completion, achievement, gift_sent, gift_received, admin_add, admin_subtract, lobby_completion
 */

/**
 * @param {import('mongodb').Db} db
 * @param {{ userId: string, type: string, amount: number, balance: number, meta?: object }} params
 */
export async function logCoinTransaction(db, { userId, type, amount, balance, meta = {} }) {
  await db.collection("coin_transactions").insertOne({
    userId,
    type,
    amount,
    balance,
    meta,
    createdAt: new Date(),
  });
}
