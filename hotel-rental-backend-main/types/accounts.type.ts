export interface accountInterfaceInput {
    name: string,
    permisions: string[],
    email: string,
    password: string,
    isApproved : boolean
    otp : string | null,
    type?: string,
}

export interface accountInterface extends accountInterfaceInput {
    _id : string,
}