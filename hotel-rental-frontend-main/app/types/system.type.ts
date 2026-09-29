export interface aiFaq {
    question: string,
    answer: string,
}

export interface aiKnowledge {
    location: string,
    contactPhone: string,
    frontDesk: string,
    support: string,
    checkInPolicy: string,
    checkOutPolicy: string,
    bookingPolicy: string,
    cancellationPolicy: string,
    refundPolicy: string,
    paymentPolicy: string,
    idRequirements: string,
    houseRules: string,
    petPolicy: string,
    smokingPolicy: string,
    visitorPolicy: string,
    otherPolicies: string,
    amenities: string[],
    faqs: aiFaq[],
    instructions?: string,
}

export interface systemInterfaceInput {
    systemInfo: string,
    paymentMin: number,
    gracePeriodHours?: number,
    gracePeriodMinutes?: number,
    securityAlertEmail?: string,
    securityAlertScope?: "off" | "admins" | "all",
    logo: string,
    systemName: string,
    header: string,
    description: string,
    heroBackground?: string,
    facebook?: string,
    contactEmail?: string,
    aboutImg1?: string,
    aboutImg2?: string,
    aboutImg3?: string,
    aboutImg4?: string,
    aiKnowledge?: Partial<aiKnowledge>,
}

export interface systemInterface extends systemInterfaceInput {
    _id: string,
}
