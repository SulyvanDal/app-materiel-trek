import type { Request, Response, NextFunction } from "express"
import { AppError } from "../lib/errors.ts"

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction){
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error : {
                code : err.code,message : err.message
            }
        });
    }
    console.error(err);
    res.status(500).json({
        error : {code : "INTERNAL", message:"Erreur interne"}
    });
}