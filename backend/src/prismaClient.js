// Thin Prisma client wrapper so we only instantiate the client once.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;

