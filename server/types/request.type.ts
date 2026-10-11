import { Request } from "express";
import { accountInterface } from "./accounts.type";


export interface AuthRequest extends Request {
  id?: string;
  account?: accountInterface
}
