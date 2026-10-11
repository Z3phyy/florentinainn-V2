export interface accountInterfaceInput {
    name: string,
    position?: string,
    permisions: string[],
    email: string,
    password: string,
    isApproved : boolean
    isActive?: boolean,
    isSuspended?: boolean,
    suspensionReason?: string,
    suspendedBy?: string,
    suspendedAt?: Date | null,
    deactivatedAt?: Date | null,
    deactivatedBy?: string,
    rejectionReason?: string,
    rejectedAt?: Date | null,
    rejectedBy?: string,
    sessionVersion?: number,
    lastLogin?: Date | null,
    notificationPrefs?: {
        mutedTypes?: string[],
        mutedSeverities?: string[],
    },
    otp : string | null,
    type?: string,
}

export interface accountInterface extends accountInterfaceInput {
    _id : string,
}