import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const count = await prisma.session.count();
    console.log(`Total sessions: ${count}`);
    const sessions = await prisma.session.findMany();
    console.log("Sessions:", JSON.stringify(sessions, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
