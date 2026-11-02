-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "households" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "currency" CHAR(3) NOT NULL DEFAULT 'MAD',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Africa/Casablanca',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "HouseholdRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "household_members_user_id_idx" ON "household_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "household_members_household_id_user_id_key" ON "household_members"("household_id", "user_id");

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
