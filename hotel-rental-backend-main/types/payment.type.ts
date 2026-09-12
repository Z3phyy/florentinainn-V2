   


export interface paymentInterfaceInput {
    date: string,
    amount: number,
    receivedBy: string,
    paymentBy: string,
    method?: string,
    refNumber?: string,
    folio?: string,
    balance?: number,
}

export interface paymentInterface extends paymentInterfaceInput {
    _id: string,
    createdAt?: string,
    updatedAt?: string,
}