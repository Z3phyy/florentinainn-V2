import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { ReportService, ReportMonth } from "../services/report.service";

function parseMonth(raw: unknown): ReportMonth {
  if (typeof raw === "string" && raw.trim().toLowerCase() === "all") {
    return "all";
  }
  const parsed = parseInt(raw as string, 10);
  if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 11) {
    return parsed;
  }
  return new Date().getMonth();
}

function parseYear(raw: unknown): number {
  const parsed = parseInt(raw as string, 10);
  if (Number.isInteger(parsed) && parsed >= 1970 && parsed <= 9999) {
    return parsed;
  }
  return new Date().getFullYear();
}

export class ReportController {
  static getOccupancyReport = async (
    request: AuthRequest,
    response: Response,
  ) => {
    try {
      const data = await ReportService.getOccupancyReport();
      response.send(data);
    } catch (error) {
      console.log(
        "Failed to get occupancy report: " + (error as Error).message,
      );
      response
        .status(500)
        .send("Failed to get occupancy report: " + (error as Error).message);
    }
  };

  static getRevenueReport = async (
    request: AuthRequest,
    response: Response,
  ) => {
    try {
      const month = parseMonth(request.query.month);
      const year = parseYear(request.query.year);
      const data = await ReportService.getRevenueReport(month, year);
      response.send(data);
    } catch (error) {
      console.log("Failed to get revenue report: " + (error as Error).message);
      response
        .status(500)
        .send("Failed to get revenue report: " + (error as Error).message);
    }
  };

  static getReservationReport = async (
    request: AuthRequest,
    response: Response,
  ) => {
    try {
      const month = parseMonth(request.query.month);
      const year = parseYear(request.query.year);
      const data = await ReportService.getReservationReport(month, year);
      response.send(data);
    } catch (error) {
      console.log(
        "Failed to get reservation report: " + (error as Error).message,
      );
      response
        .status(500)
        .send("Failed to get reservation report: " + (error as Error).message);
    }
  };

  static getPopularRoomReport = async (
    request: AuthRequest,
    response: Response,
  ) => {
    try {
      const month = parseMonth(request.query.month);
      const year = parseYear(request.query.year);
      const data = await ReportService.getPopularRoomReport(month, year);
      response.send(data);
    } catch (error) {
      console.log(
        "Failed to get popular room report: " + (error as Error).message,
      );
      response
        .status(500)
        .send("Failed to get popular room report: " + (error as Error).message);
    }
  };
}
