export default interface IUser {
	email: string
	username: string
	password: string
	stripeCustomerId: string
	stripeAccountId?: string
	stripeAccountCompleted: boolean
	accountBalance: number
	paymentMethods: string[]
	verificationCode: string
	isVerified: boolean
	createdAt?: Date
	updatedAt?: Date
}
