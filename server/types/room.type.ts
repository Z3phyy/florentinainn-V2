export interface housekeepingHistoryEntry {
    status: string;
    from: string;
    note: string;
    changedBy: string;
    changedAt: Date;
}

export interface maintenanceHistoryEntry {
    action: string;
    note: string;
    changedBy: string;
    changedAt: Date;
}

export interface roomInterfaceInput {
    roomNumber?: string,
    category: string,
    amenities: string[],
    bedding?: string[],
    price: number,
    discount: number,
    image: string,
    description: string,
    images: string[],
    status: string,
    maintenance: string,
    housekeeping: string[],
    maxHead : number
}

export interface roomInterface extends roomInterfaceInput {
    _id : string,
    housekeepingStatus?: string;
    assignedHousekeeper?: string;
    housekeepingStartedAt?: Date | null;
    housekeepingUpdatedAt?: Date | null;
    housekeepingNotes?: string;
    housekeepingHistory?: housekeepingHistoryEntry[];
    maintenanceReason?: string;
    assignedMaintainer?: string;
    maintenanceStartedAt?: Date | null;
    maintenanceCompletedAt?: Date | null;
    maintenanceNotes?: string;
    maintenanceHistory?: maintenanceHistoryEntry[];
}
