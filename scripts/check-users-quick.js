const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ select: { username: true, name: true, role: true } });
  console.log('Users:', JSON.stringify(users, null, 2));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
