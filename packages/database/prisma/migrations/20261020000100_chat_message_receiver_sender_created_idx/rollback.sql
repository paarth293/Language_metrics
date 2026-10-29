-- Undo 20261020000100_chat_message_receiver_sender_created_idx.
-- Run by hand, outside a transaction. Prisma does not run this file.
-- To let `prisma migrate deploy` apply the migration again afterwards:
--   npx prisma migrate resolve --rolled-back 20261020000100_chat_message_receiver_sender_created_idx
DROP INDEX CONCURRENTLY IF EXISTS "ChatMessage_receiverId_senderId_createdAt_idx";
