import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { ReportService } from "../services/report.service";

export class ReportController {

  static getOccupancyReport = async (request: AuthRequest, response: Response) => {
    try {
      const data = await ReportService.getOccupancyReport();
      response.send(data);
    } catch (error) {
      console.log("Failed to get occupancy report: " + (error as Error).message);
      response.status(500).send("Failed to get occupancy report: " + (error as Error).message);
    }
  };

  static getRevenueReport = async (request: AuthRequest, response: Response) => {
    try {
      const month = parseInt(request.query.month as string) || new Date().getMonth();
      const year = parseInt(request.query.year as string) || new Date().getFullYear();
      const data = await ReportService.getRevenueReport(month, year);
      response.send(data);
    } catch (error) {
      console.log("Failed to get revenue report: " + (error as Error).message);
      response.status(500).send("Failed to get revenue report: " + (error as Error).message);
    }
  };

  static getReservationReport = async (request: AuthRequest, response: Response) => {
    try {
      const month = parseInt(request.query.month as string) || new Date().getMonth();
      const year = parseInt(request.query.year as string) || new Date().getFullYear();
      const data = await ReportService.getReservationReport(month, year);
      response.send(data);
    } catch (error) {
      console.log("Failed to get reservation report: " + (error as Error).message);
      response.status(500).send("Failed to get reservation report: " + (error as Error).message);
    }
  };

  static getPopularRoomReport = async (request: AuthRequest, response: Response) => {
    try {
      const month = parseInt(request.query.month as string) || new Date().getMonth();
      const year = parseInt(request.query.year as string) || new Date().getFullYear();
      const data = await ReportService.getPopularRoomReport(month, year);
      response.send(data);
    } catch (error) {
      console.log("Failed to get popular room report: " + (error as Error).message);
      response.status(500).send("Failed to get popular room report: " + (error as Error).message);
    }
  };
}
