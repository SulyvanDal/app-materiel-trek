import type { Request, Response } from "express";
import { getAllItems, getItemById } from "../services/item.service.ts";
import { ValidationError } from "../lib/errors.ts";

export async function getItem(req: Request, res: Response) {

    const id = Number(req.params.id)

    if (!Number.isInteger(id)) {
        throw new ValidationError("id doit être un entier");
    }
    const item = await getItemById(id);
    return res.status(200).json({
        data: item
    });

}   

export async function getItems(req:Request, res:Response) {
    
    const items = await getAllItems();
    return res.status(200).json({
        data:items,
        meta:{}
    });
}