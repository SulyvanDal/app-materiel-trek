import { NotFoundError } from "../lib/errors.ts";
import { prisma } from "../lib/prisma.ts";

export async function getItemById(id: number) {
    const item = await prisma.item.findUnique({ where: { id } });

    if (item === null) throw new NotFoundError("item", id);

    return item;
}

export function getAllItems() {
    return prisma.item.findMany({orderBy:{name:"asc"}})
}