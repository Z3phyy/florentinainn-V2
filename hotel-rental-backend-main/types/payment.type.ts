export interface paymentInterfaceInput {
    date: string,
    amount: number,
    receivedBy: string,
    paymentBy: string,
    method?: string,
    refNumber?: string,
    folio?: string,
    balance?: number,
    status?: string,
    refundedAt?: Date | null,
    refundedBy?: string,
    refundReason?: string,
    refundRef?: string,
}

export interface paymentInterface extends paymentInterfaceInput {
    _id: string,
    createdAt?: string,
    updatedAt?: string,
}