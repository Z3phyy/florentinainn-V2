import { roomInterface } from "./room.type"

export interface bookingInterfaceInput {
    clientName: string,
    clientAddress: string,
    clientEmail?: string,
    clientPhone?: string,
    paymentAmount?: number,
    paymentMethod?: string,
    paymentRefNumber?: string,
    totalAmount?: number,
    type: string,
    status: string,
    arrivalDate: string,
    departureDate?: string,
    arrivalTime: string,
    room : string
}

export interface bookingInterface  {
    _id: string,
    clientName: string,
    clientAddress: string,
    clientEmail?: string,
    clientPhone?: string,
    paymentAmount?: number,
    paymentMethod?: string,
    paymentRefNumber?: string,
    totalAmount?: number,
    type: string,
    status: string,
    arrivalDate: string,
    departureDate?: string,
    arrivalTime: string,
    room : roomInterface,
}