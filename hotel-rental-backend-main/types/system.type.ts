export interface systemInterfaceInput {
    systemInfo: string,
    paymentMin: number,
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
}

export interface systemInterface extends systemInterfaceInput {
    _id: string,
}
