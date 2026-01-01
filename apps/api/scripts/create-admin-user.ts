/**
 * Script to create an admin user
 * Usage: bun scripts/create-admin-user.ts <email> <password> [role]
 */

import { createAdminUser } from "../src/services/admin/auth";

const email = process.argv[2];
const password = process.argv[3];
const role = (process.argv[4] as "ADMIN" | "OPERATOR" | "READ_ONLY") || "ADMIN";

if (!email || !password) {
  console.error("Usage: bun scripts/create-admin-user.ts <email> <password> [role]");
  console.error("Role options: ADMIN, OPERATOR, READ_ONLY (default: ADMIN)");
  process.exit(1);
}

async function main() {
  try {
    const admin = await createAdminUser(email, password, role);
    console.log("✅ Admin user created successfully!");
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   ID: ${admin.id}`);
  } catch (error: any) {
    if (error.code === "P2002") {
      console.error("❌ Error: Admin user with this email already exists");
    } else {
      console.error("❌ Error creating admin user:", error.message);
    }
    process.exit(1);
  }
}

main();

