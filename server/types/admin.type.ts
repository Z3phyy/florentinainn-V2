export interface adminInterfaceInput {
    name?: string,
    email: string,
    password: string,
    type: string,
    otp : string | null,
}

export interface adminInterface extends adminInterfaceInput {
    _id : string,
}