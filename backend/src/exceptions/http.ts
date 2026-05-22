import type { ParamsDictionary } from "express-serve-static-core";
import type { Request, Response } from "express";

type HttpHandler<Params extends ParamsDictionary = ParamsDictionary> = (
  req: Request<Params>,
  res: Response
) => Promise<void>;

interface HttpErrorOptions {
  exposeErrorMessage?: boolean;
}

export function sendHttpError(res: Response, statusCode: number, message: string): void {
  res.status(statusCode).json({ error: message });
}

export function routeHandler<Params extends ParamsDictionary = ParamsDictionary>(
  handler: HttpHandler<Params>,
  logMessage: string,
  fallbackMessage: string,
  options: HttpErrorOptions = {}
) {
  return (req: Request<Params>, res: Response): void => {
    void handler(req, res).catch((error: unknown) => {
      console.error(logMessage, error);
      const message =
        options.exposeErrorMessage && error instanceof Error
          ? error.message
          : fallbackMessage;
      sendHttpError(res, 500, message);
    });
  };
}
