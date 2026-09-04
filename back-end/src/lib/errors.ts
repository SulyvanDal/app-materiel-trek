export class AppError extends Error{
    statusCode:number;
    code:string;

    constructor(statusCode:number, code:string, message:string){
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}

export class NotFoundError extends AppError{
    constructor(ressource:string,id:number|string){
        super(404,"NOT_FOUND", `${ressource} ${id} introuvable`)
    }
}

export class ValidationError extends AppError{
    constructor(message:string){
        super(400,"VALIDATION", message)
    }
}