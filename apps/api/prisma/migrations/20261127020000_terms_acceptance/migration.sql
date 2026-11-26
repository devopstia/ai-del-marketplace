-- Terms acceptance at purchase (owner 2026-11-26): which version of the Terms of use and the Access and refunds
-- policy the buyer accepted, when, and from which IP. Null for orders created before this change.
ALTER TABLE "orders"
ADD COLUMN     "termsVersion" TEXT,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedIp" TEXT;
