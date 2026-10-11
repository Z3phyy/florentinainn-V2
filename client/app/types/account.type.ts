export interface accountInterfaceInput {
    name: string,
    position?: string,
    permisions: string[],
    email: string,
    password: string,
    isApproved : boolean,
    isActive?: boolean,
    isSuspended?: boolean,
    suspensionReason?: string,
    suspendedBy?: string,
    suspendedAt?: string | null,
    deactivatedAt?: string | null,
    deactivatedBy?: string,
    rejectionReason?: string,
    rejectedAt?: string | null,
    rejectedBy?: string,
    sessionVersion?: number,
    lastLogin?: string | null,
    hasAccessCode?: boolean,
    accessCodeUpdatedAt?: string | null,
    otp : string | null,
    type?: string,
}

export interface accountInterface extends accountInterfaceInput {
    _id : string,
}

export interface permissionOption {
    value: string;
    operations: string[];
}

export interface accountListResult {
    items: accountInterface[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface adminAccountInterface {
    _id: string;
    name: string;
    email: string;
    type: string;
    isActive: boolean;
    isSuspended?: boolean;
    suspensionReason?: string;
    deactivatedAt?: string | null;
    lastLogin?: string | null;
    hasAccessCode?: boolean;
    accessCodeUpdatedAt?: string | null;
}
